// @ts-nocheck
import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';
import { getBaseUrl } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const maxDuration = 10; 

const cache = new Map<string, { streams: {quality: string, url: string}[], expiry: number }>();

export async function GET(request: Request) {
  const startTime = Date.now();
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

  // 3. DIRECT PUPPETEER SNIFFER (Priority)
  const isVercel = process.env.VERCEL === '1';
  let browser;
  try {
    const launchOptions = isVercel ? {
      args: [
        ...chromium.args, 
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    } : {
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true
    };

    browser = await puppeteer.launch(launchOptions as any);
    const page = await browser.newPage();
    
    // Set a realistic User Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    let caughtStream: string | null = null;
    let caughtQuality: string = 'Auto';

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      const type = req.resourceType();
      
      if (url.includes('.m3u8') || url.includes('.mp4') || url.includes('playlist.m3u8')) {
        caughtStream = url;
        if (url.includes('1080')) caughtQuality = '1080p';
        else if (url.includes('720')) caughtQuality = '720p';
        else if (url.includes('480')) caughtQuality = '480p';
        req.continue();
      } else if (['image', 'font', 'media', 'stylesheet'].includes(type) || url.includes('google') || url.includes('ads')) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Go! Using 'commit' is the fastest possible way to start the lifecycle
    page.goto(playUrl, { waitUntil: 'commit', timeout: 8500 }).catch(() => {});
    
    // Super fast polling (every 100ms)
    const maxRetries = 85; // 8.5 seconds
    for (let i = 0; i < maxRetries; i++) {
        if (caughtStream) break;
        await new Promise(r => setTimeout(r, 100));
    }

    if (!caughtStream) {
        // One last quick check in the DOM
        caughtStream = await page.evaluate(() => {
           const btn = document.querySelector('.hd_btn');
           return btn ? btn.getAttribute('data-url') : null;
        }).catch(() => null);
    }

    await browser.close();

    if (caughtStream) {
      const result = [{ quality: caughtQuality, url: caughtStream }];
      cache.set(token, { streams: result, expiry: Date.now() + 600000 });
      return NextResponse.json({ streams: result });
    }
  } catch (err) {
    if (browser) await browser.close();
    console.error('Final Sniffer Error:', err);
  }

  return NextResponse.json({ streams: [], error: 'Timeout' }, { status: 200 });
}
