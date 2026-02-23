// @ts-nocheck
import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';
import { getBaseUrl } from '@/lib/config';

// Force dynamic rendering and cache settings for Vercel
export const dynamic = 'force-dynamic';
export const maxDuration = 10; // Vercel Hobby Limit is 10s

const cache = new Map<string, { streams: {quality: string, url: string}[], expiry: number }>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const domainParam = searchParams.get('domain');
  const baseUrl = domainParam || await getBaseUrl();

  if (!token) {
    return NextResponse.json({ streams: [], error: 'Missing token parameter' }, { status: 400 });
  }

  // Check cache first
  const cached = cache.get(token);
  if (cached && cached.expiry > Date.now()) {
    return NextResponse.json({ streams: cached.streams });
  }

  const playUrl = `${baseUrl}/video_player?player_token=${token}`;

  // 1. FAST PATH (REGEX) - Aggressive Timeout for Vercel
  try {
    const fetchWithTimeout = async (url: string, timeout = 6000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const fbUrl = await getBaseUrl();
        const response = await fetch(url, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
                'Referer': fbUrl.endsWith('/') ? fbUrl : `${fbUrl}/`,
                'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'Upgrade-Insecure-Requests': '1',
            },
            signal: controller.signal,
            cache: 'no-store'
        });
        clearTimeout(id);
        return response;
    };

    const fastRes = await fetchWithTimeout(playUrl);
    if (fastRes.ok) {
        const html = await fastRes.text();
        const streams: {quality: string, url: string}[] = [];
        
        // Pattern 1: data-url buttons
        const btnRegex = /class="hd_btn"[^>]*data-url="(.*?)"[^>]*>(.*?)<\/button>/g;
        let match;
        while ((match = btnRegex.exec(html)) !== null) {
          if (match[1]) streams.push({ quality: match[2].trim() || 'Auto', url: match[1] });
        }

        // Pattern 2: JWPlayer configs
        const jwRegex = /file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']\s*,\s*label\s*:\s*["']([^"']+)["']/g;
        let jwMatch;
        while ((jwMatch = jwRegex.exec(html)) !== null) {
            streams.push({ quality: jwMatch[2] || 'Auto', url: jwMatch[1] });
        }

        // Pattern 3: Fallback m3u8 search
        if (streams.length === 0) {
            const m3u8Regex = /(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/gi;
            const m3u8Matches = html.match(m3u8Regex);
            if (m3u8Matches) {
                m3u8Matches.forEach(url => {
                    if (!url.includes('google-analytics')) {
                        const qMatch = url.match(/_(\d+p)\.m3u8/i);
                        streams.push({ quality: qMatch ? qMatch[1] : 'Direct', url });
                    }
                });
            }
        }

        if (streams.length > 0) {
            const unique = streams.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
            console.log(`[extract-video] Fast Path Success: found ${unique.length} streams`);
            cache.set(token, { streams: unique, expiry: Date.now() + 10 * 60000 });
            return NextResponse.json({ streams: unique });
        }
    }
  } catch (e) {
    console.warn('[extract-video] Fast Path failed/timed out:', e.message);
  }

  // 2. SLOW PATH (PUPPETEER) - Only if Vercel has time left
  const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  let browser;
  try {
    const launchOptions = isVercel ? {
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    } : {
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true,
      args: ['--no-sandbox']
    };

    console.log(`[extract-video] Launching Puppeteer (${isVercel ? 'Serverless' : 'Local'})`);
    browser = await puppeteer.launch(launchOptions as any);
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font', 'media', 'ping'].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    // Reduce Puppeteer timeout for Vercel
    await page.goto(playUrl, { waitUntil: 'domcontentloaded', timeout: 7000 });
    await page.waitForSelector('.hd_btn', { timeout: 2500 }).catch(() => {});

    const results = await page.evaluate(() => {
      const items: any[] = [];
      document.querySelectorAll('.hd_btn').forEach(btn => {
        const url = btn.getAttribute('data-url');
        if (url) items.push({ quality: btn.textContent?.trim() || 'Auto', url });
      });
      return items;
    });

    await browser.close();
    
    if (results.length > 0) {
      const unique = results.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
      cache.set(token, { streams: unique, expiry: Date.now() + 10 * 60000 });
      return NextResponse.json({ streams: unique });
    }
  } catch (error) {
    console.error('[extract-video] Puppeteer Error:', error.message);
    if (browser) await browser.close();
  }

  return NextResponse.json({ streams: [], error: 'انتهى الوقت المسموح للاستخراج على الخادم' }, { status: 504 });
}
