// @ts-nocheck
import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';
import { getBaseUrl } from '@/lib/config';

const cache = new Map<string, { streams: {quality: string, url: string}[], expiry: number }>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const baseUrl = (await getBaseUrl()) || 'https://web22312x.faselhdx.best';

  if (!token) {
    return NextResponse.json({ streams: [], error: 'Missing token parameter' }, { status: 400 });
  }

  const cached = cache.get(token);
  if (cached && cached.expiry > Date.now()) {
    return NextResponse.json({ streams: cached.streams });
  }

  const playUrl = `${baseUrl}/video_player?player_token=${token}`;

  // 1. FAST PATH (REGEX) - Attempt it everywhere
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
        
        // Pattern: data-url buttons
        const btnRegex = /class="hd_btn"[^>]*data-url="(.*?)"[^>]*>(.*?)<\/button>/g;
        let match;
        while ((match = btnRegex.exec(html)) !== null) {
          if (match[1]) streams.push({ quality: match[2].trim() || 'Auto', url: match[1] });
        }

        // Pattern: JWPlayer sources
        if (streams.length === 0) {
            const jwRegex = /{\s*file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']\s*,\s*label\s*:\s*["']([^"']+)["']/g;
            let jwMatch;
            while ((jwMatch = jwRegex.exec(html)) !== null) {
                streams.push({ quality: jwMatch[2] || 'Auto', url: jwMatch[1] });
            }
        }

        // Catch-all m3u8
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
            console.log(`[extract-video] Fast Path Success: ${unique.length} streams`);
            cache.set(token, { streams: unique, expiry: Date.now() + 10 * 60000 });
            return NextResponse.json({ streams: unique });
        }
    }
  } catch (e) {
    console.warn('[extract-video] Fast Path failed:', e.message);
  }

  // 2. SLOW PATH (PUPPETEER) - Only on Vercel/Production
  const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  
  if (!isVercel) {
    console.log('[extract-video] Fast path failed locally. Skipping Puppeteer fallback.');
    return NextResponse.json({ 
        streams: [], 
        error: 'تعذر جلب الفيديو (Fast Path Failed). السيرفر المحلي لا يدعم المتصفح الوهمي.' 
    }, { status: 404 });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executable_path: await chromium.executablePath(),
      headless: chromium.headless,
    } as any);

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    await page.goto(playUrl, { waitUntil: 'domcontentloaded', timeout: 7000 });

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
    console.error('[extract-video] Puppeteer error:', error.message);
    if (browser) await browser.close();
  }

  return NextResponse.json({ streams: [], error: 'فشل استخراج روابط الفيديو' }, { status: 504 });
}
