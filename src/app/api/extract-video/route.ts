import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { getBaseUrl } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const cache = new Map<string, { streams: {quality: string, url: string}[], expiry: number }>();

// Singleton browser instance for Railway/Docker
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

  // 1. Check Cache
  const cached = cache.get(token);
  if (cached && cached.expiry > Date.now()) return NextResponse.json({ streams: cached.streams });

  // 2. Prepare URL
  let baseDomain = domainParam || await getBaseUrl();
  baseDomain = baseDomain.replace('.xyz', '.best').replace(/\/$/, '');
  const playUrl = `${baseDomain}/video_player?player_token=${token}`;

  let page: any = null;
  let caughtStream: string | null = null;
  let caughtQuality: string = 'Auto';

  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    
    // Minimalistic Page
    await page.setViewport({ width: 800, height: 600 });
    
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
      } else if (['image', 'stylesheet', 'font', 'media', 'other'].includes(type) || url.includes('analytics') || url.includes('google') || url.includes('ads')) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Fast Load
    page.goto(playUrl, { waitUntil: 'domcontentloaded', timeout: 7000 } as any).catch(() => {});
    
    // Quick Poll
    const maxRetries = 100; // 5 seconds
    for (let i = 0; i < maxRetries; i++) {
        if (caughtStream) break;
        await new Promise(r => setTimeout(r, 50));
    }

    if (!caughtStream) {
        caughtStream = await page.evaluate(() => {
           const btn = document.querySelector('.hd_btn');
           return btn ? btn.getAttribute('data-url') : null;
        }).catch(() => null);
    }

    if (caughtStream) {
      const result = [{ quality: caughtQuality, url: caughtStream }];
      cache.set(token, { streams: result, expiry: Date.now() + 1800000 }); // 30 mins cache
      return NextResponse.json({ streams: result });
    }
  } catch (err) {
    console.error('Extraction Error:', err);
  } finally {
    if (page) await page.close().catch(() => {});
  }

  return NextResponse.json({ streams: [], error: 'Extraction failed or timed out' }, { status: 200 });
}
