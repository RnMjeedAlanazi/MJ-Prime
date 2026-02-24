import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { getBaseUrl } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const maxDuration = 45; // Increased slightly

const cache = new Map<string, { streams: {quality: string, url: string}[], expiry: number }>();

let globalBrowser: any = null;

async function getBrowser() {
  if (globalBrowser && globalBrowser.connected) return globalBrowser;
  
  const isProduction = process.env.NODE_ENV === 'production';
  try {
    globalBrowser = await puppeteer.launch({
      args: [
        "--no-sandbox", 
        "--disable-setuid-sandbox", 
        "--disable-dev-shm-usage",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-extensions",
        "--disable-gpu",
      ],
      headless: "new",
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || (
        isProduction ? '/usr/bin/google-chrome-stable' : undefined
      )
    } as any);
    return globalBrowser;
  } catch (err) {
    console.error("Failed to launch global browser:", err);
    throw err;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const domainParam = searchParams.get('domain');
  
  if (!token) return NextResponse.json({ streams: [], error: 'Missing token' }, { status: 400 });

  const cached = cache.get(token);
  if (cached && cached.expiry > Date.now()) return NextResponse.json({ streams: cached.streams });

  let baseDomain = domainParam || await getBaseUrl();
  // Ensure we use the latest working domain
  if (baseDomain.includes('faselhd')) {
      baseDomain = baseDomain.replace(/\.([a-z0-9]+)$/, '.best');
  }
  const playUrl = `${baseDomain.replace(/\/$/, '')}/video_player?player_token=${token}`;

  let page: any = null;
  let caughtStream: string | null = null;
  let caughtQuality: string = 'Auto';

  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 720 });
    
    await page.setRequestInterception(true);
    page.on('request', (req: any) => {
      const type = req.resourceType();
      const url = req.url();
      
      if (url.includes('.m3u8') || url.includes('.mp4') || url.includes('playlist.m3u8')) {
        caughtStream = url;
        if (url.includes('1080')) caughtQuality = '1080p';
        else if (url.includes('720')) caughtQuality = '720p';
        else if (url.includes('480')) caughtQuality = '480p';
        req.continue();
      } else if (['image', 'font', 'media'].includes(type) || url.includes('analytics') || url.includes('google') || url.includes('ads')) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Try multiple wait conditions if one fails, but keep it snappy
    try {
        await page.goto(playUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });
    } catch (e) {
        // Fallback for slow connection
        console.log("Initial goto failed, waiting for stream specifically...");
    }
    
    // Polling for network capture
    let retries = 0;
    const maxRetries = 120; // 6 seconds total
    while (retries < maxRetries && !caughtStream) {
        await new Promise(r => setTimeout(r, 50));
        retries++;
    }

    if (!caughtStream) {
        // Final attempt: check the DOM for the hidden data-url attribute in quality buttons
        caughtStream = await page.evaluate(() => {
           const btn = document.querySelector('.hd_btn') || document.querySelector('[data-url]');
           return btn ? btn.getAttribute('data-url') : null;
        }).catch(() => null);
    }

    if (caughtStream) {
      const result = [{ quality: caughtQuality, url: caughtStream }];
      cache.set(token, { streams: result, expiry: Date.now() + 1800000 });
      return NextResponse.json({ streams: result });
    }
  } catch (err) {
    console.error('Extraction Error:', err);
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }

  return NextResponse.json({ streams: [], error: 'Extraction failed or timed out. Please try again.' }, { status: 200 });
}
