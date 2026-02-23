// @ts-nocheck
import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';
import { getBaseUrl } from '@/lib/config';

const cache = new Map<string, { streams: {quality: string, url: string}[], expiry: number }>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const baseUrl = await getBaseUrl();

  if (!token) {
    return NextResponse.json({ streams: [], error: 'Missing token parameter' }, { status: 400 });
  }

  // Check cache first (valid for 10 minutes)
  const cached = cache.get(token);
  if (cached && cached.expiry > Date.now()) {
    return NextResponse.json({ streams: cached.streams });
  }

  const playUrl = `${baseUrl}/video_player?player_token=${token}`;

  // 1. FAST PATH (REGEX) - Direct fetch with stealth headers
  try {
    const fetchWithTimeout = async (url: string, timeout = 10000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const fbUrl = await getBaseUrl();
        const response = await fetch(url, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
                'Referer': fbUrl.endsWith('/') ? fbUrl : `${fbUrl}/`,
                'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'Upgrade-Insecure-Requests': '1',
            },
            signal: controller.signal,
            next: { revalidate: 600 }
        });
        clearTimeout(id);
        return response;
    };

    const fastRes = await fetchWithTimeout(playUrl);
    if (fastRes.ok) {
        const html = await fastRes.text();
        const streams: {quality: string, url: string}[] = [];
        
        // Pattern 1: Look for data-url attributes in buttons
        const btnRegex = /class="hd_btn"[^>]*data-url="(.*?)"[^>]*>(.*?)<\/button>/g;
        let match;
        while ((match = btnRegex.exec(html)) !== null) {
          if (match[1]) streams.push({ quality: match[2].trim() || 'Auto', url: match[1] });
        }

        // Pattern 2: Look for JWPlayer setup sources
        if (streams.length === 0) {
            const jwRegex = /{\s*file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']\s*,\s*label\s*:\s*["']([^"']+)["']/g;
            let jwMatch;
            while ((jwMatch = jwRegex.exec(html)) !== null) {
                streams.push({ quality: jwMatch[2] || 'Auto', url: jwMatch[1] });
            }
        }

        // Pattern 3: Look for sources array in Setup call
        if (streams.length === 0) {
            const sourcesRegex = /sources\s*:\s*\[([\s\S]*?)\]/i;
            const sourcesMatch = html.match(sourcesRegex);
            if (sourcesMatch) {
              const singleSourceRegex = /\{\s*file\s*:\s*["']([^"']+)["']\s*,\s*label\s*:\s*["']([^"']+)["']/g;
              let sMatch;
              while ((sMatch = singleSourceRegex.exec(sourcesMatch[1])) !== null) {
                streams.push({ quality: sMatch[2], url: sMatch[1] });
              }
            }
        }

        // Pattern 4: Catch-all for ANY m3u8 link in the page
        if (streams.length === 0) {
            const m3u8Regex = /(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/gi;
            const m3u8Matches = html.match(m3u8Regex);
            if (m3u8Matches) {
                m3u8Matches.forEach(url => {
                    if (!url.includes('google-analytics')) {
                        const qualityMatch = url.match(/_(\d+p)\.m3u8/i);
                        streams.push({ quality: qualityMatch ? qualityMatch[1] : 'Direct', url });
                    }
                });
            }
        }

        if (streams.length > 0) {
            const unique = streams.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
            console.log(`[extract-video] Fast Path Successful: ${unique.length} streams`);
            cache.set(token, { streams: unique, expiry: Date.now() + 10 * 60000 });
            return NextResponse.json({ streams: unique });
        }
    }
  } catch (e) {
    console.warn('[extract-video] Fast Path fallback failed:', e.message);
  }

  // 2. SLOW PATH (PUPPETEER)
  let browser;
  try {
    console.log('[extract-video] Launching Puppeteer');

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    } as any);

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    // Maximize time (Vercel limit is 10s)
    await page.goto(playUrl, { waitUntil: 'domcontentloaded', timeout: 7000 });

    const finalStreams = await page.evaluate(() => {
      const results: {quality: string, url: string}[] = [];
      document.querySelectorAll('.hd_btn').forEach((btn) => {
        const url = btn.getAttribute('data-url');
        if (url) results.push({ quality: btn.textContent?.trim() || 'Auto', url });
      });
      return results;
    });

    await browser.close();
    
    if (finalStreams.length > 0) {
      const unique = finalStreams.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
      cache.set(token, { streams: unique, expiry: Date.now() + 10 * 60000 });
      return NextResponse.json({ streams: unique });
    }
  } catch (error) {
    console.error('[extract-video] Puppeteer Error:', error.message);
    if (browser) await browser.close();
  }

  return NextResponse.json({ streams: [], error: 'انتهى الوقت المسموح للاستخراج' }, { status: 504 });
}
