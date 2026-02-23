// @ts-nocheck
import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';
import { getBaseUrl } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const maxDuration = 10; 

const cache = new Map<string, { streams: {quality: string, url: string}[], expiry: number }>();

async function fastExtract(playUrl: string) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 6000);
    
    try {
        const response = await fetch(playUrl, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
                'Cache-Control': 'no-cache',
            },
            signal: controller.signal,
            cache: 'no-store'
        });
        clearTimeout(id);

        if (!response.ok) return null;
        const html = await response.text();
        const streams: {quality: string, url: string}[] = [];
        
        // 1. Buttons Pattern
        const btnRegex = /class="hd_btn"[^>]*data-url="(.*?)"[^>]*>(.*?)<\/button>/g;
        let match;
        while ((match = btnRegex.exec(html)) !== null) {
          if (match[1]) streams.push({ quality: match[2].trim() || 'Auto', url: match[1] });
        }

        // 2. JWPlayer / Script Pattern
        if (streams.length === 0) {
            const jwRegex = /file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']\s*,\s*label\s*:\s*["']([^"']+)["']/g;
            let jwMatch;
            while ((jwMatch = jwRegex.exec(html)) !== null) {
                streams.push({ quality: jwMatch[2] || 'Auto', url: jwMatch[1] });
            }
        }

        // 3. Raw m3u8 Pattern
        if (streams.length === 0) {
            const m3u8Regex = /(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/gi;
            const m3u8Matches = html.match(m3u8Regex);
            if (m3u8Matches) {
                m3u8Matches.forEach(url => {
                    if (!url.includes('google-analytics') && !url.includes('doubleclick')) {
                        const qMatch = url.match(/_(\d+p)\.m3u8/i);
                        streams.push({ quality: qMatch ? qMatch[1] : 'Direct', url });
                    }
                });
            }
        }

        return streams.length > 0 ? streams : null;
    } catch (e) {
        console.warn('[extract-video] fastExtract error:', e.message);
        return null;
    } finally {
        clearTimeout(id);
    }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const domainParam = searchParams.get('domain');
  
  if (!token) {
    return NextResponse.json({ streams: [], error: 'Missing token parameter' }, { status: 400 });
  }

  const cached = cache.get(token);
  if (cached && cached.expiry > Date.now()) {
    return NextResponse.json({ streams: cached.streams });
  }

  // Handle Domain Fallback: Try provided domain first, then fallback to .best
  let primaryBase = domainParam || await getBaseUrl();
  let fallbackBase = primaryBase.includes('.xyz') ? primaryBase.replace('.xyz', '.best') : null;

  console.log(`[extract-video] Fast Path Primary: ${primaryBase}`);
  let streams = await fastExtract(`${primaryBase}/video_player?player_token=${token}`);

  if (!streams && fallbackBase) {
    console.log(`[extract-video] Fast Path Fallback: ${fallbackBase}`);
    streams = await fastExtract(`${fallbackBase}/video_player?player_token=${token}`);
  }

  if (streams && streams.length > 0) {
    const unique = streams.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
    cache.set(token, { streams: unique, expiry: Date.now() + 10 * 60000 });
    return NextResponse.json({ streams: unique });
  }

  // 2. SLOW PATH (PUPPETEER) - Only if Vercel and still under limit
  const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  let browser;
  try {
    const finalUrl = `${primaryBase}/video_player?player_token=${token}`;
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

    console.log(`[extract-video] Launching Puppeteer...`);
    browser = await puppeteer.launch(launchOptions as any);
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'font', 'media'].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    // Final attempt with Puppeteer (very tight timeout)
    await page.goto(finalUrl, { waitUntil: 'domcontentloaded', timeout: 5000 });
    await page.waitForSelector('.hd_btn', { timeout: 2000 }).catch(() => {});

    const results = await page.evaluate(() => {
      const items: any[] = [];
      document.querySelectorAll('.hd_btn').forEach(btn => {
        const url = btn.getAttribute('data-url');
        if (url) items.push({ quality: btn.textContent?.trim() || 'Auto', url });
      });
      return items;
    });

    await browser.close();
    
    if (results && results.length > 0) {
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
