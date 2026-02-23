// @ts-nocheck
import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';
import { getBaseUrl } from '@/lib/config';

const VERSION = '1.0.1'; // Force fresh build
const cache = new Map<string, { streams: {quality: string, url: string}[], expiry: number }>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const baseUrl = (await getBaseUrl()) || 'https://web22312x.faselhdx.best';

  if (!token) {
    return NextResponse.json({ streams: [], error: 'Missing token parameter' }, { status: 400 });
  }

  // Check cache first (valid for 10 minutes)
  const cached = cache.get(token);
  if (cached && cached.expiry > Date.now()) {
    return NextResponse.json({ streams: cached.streams });
  }

  const playUrl = `${baseUrl}/video_player?player_token=${token}`;

  // FAST PATH: Try direct fetch and regex first (10-20x faster than Puppeteer)
  try {
    const fetchWithTimeout = async (url: string, timeout = 5000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(url, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Referer': baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`,
            },
            signal: controller.signal,
            next: { revalidate: 600 }
        });
        clearTimeout(id);
        return response;
    };

    const fastRes = await fetchWithTimeout(playUrl);
    const html = await fastRes.text();
    
    const streams: {quality: string, url: string}[] = [];
    
    // Pattern 1: Look for data-url attributes in buttons
    const btnRegex = /class="hd_btn"[^>]*data-url="(.*?)"[^>]*>(.*?)<\/button>/g;
    let match;
    while ((match = btnRegex.exec(html)) !== null) {
      if (match[1]) streams.push({ quality: match[2].trim() || 'Auto', url: match[1] });
    }

    // Pattern 2: Look for m3u8 in scripts (JWPlayer/VideoJS setup)
    const m3u8Regex = /(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/gi;
    const m3u8Matches = html.match(m3u8Regex);
    if (m3u8Matches) {
        m3u8Matches.forEach(url => {
            if (!url.includes('google-analytics') && !url.includes('mixpanel')) {
                // Try to guess quality from URL or just use Direct
                const qualityMatch = url.match(/_(\d+p)\.m3u8/i);
                streams.push({ quality: qualityMatch ? qualityMatch[1] : 'Direct', url });
            }
        });
    }

    if (streams.length > 0) {
      const uniqueStreams = streams.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
      console.log(`[extract-video] Fast extracted ${uniqueStreams.length} streams`);
      cache.set(token, { streams: uniqueStreams, expiry: Date.now() + 10 * 60000 });
      return NextResponse.json({ streams: uniqueStreams });
    }
  } catch (e) {
    console.warn('[extract-video] Fast path failed or timed out:', e);
  }

  // SLOW PATH: Puppeteer
  // Only attempt on Vercel, or ignore if chromium-min is missing locally
  const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  
  if (!isVercel) {
    console.log('[extract-video] Local environment detected. Skipping Puppeteer to avoid brotli error.');
    return NextResponse.json({ streams: [], error: 'Fast path failed. Slow path disabled locally.' }, { status: 500 });
  }

  let browser;
  try {
    console.log('[extract-video] Launching Puppeteer (Production mode)');

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
      if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Tight 7s timeout for Vercel
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
    
    return NextResponse.json({ streams: [], error: 'No video streams found' }, { status: 404 });
  } catch (error) {
    console.error('[extract-video] Puppeteer error:', error);
    if (browser) await browser.close();
    return NextResponse.json({ streams: [], error: 'Video extraction timed out' }, { status: 504 });
  }
}
