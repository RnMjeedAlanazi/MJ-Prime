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
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    } : {
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true
    };

    browser = await puppeteer.launch(launchOptions as any);
    const page = await browser.newPage();
    
    let caughtStream: string | null = null;
    let caughtQuality: string = 'Auto';

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      // Sniff for manifest or stream files
      if (url.includes('.m3u8') || url.includes('.mp4') || url.includes('/playlist.m3u8')) {
        caughtStream = url;
        // Try to guess quality from URL if possible
        if (url.includes('1080')) caughtQuality = '1080p';
        else if (url.includes('720')) caughtQuality = '720p';
        else if (url.includes('480')) caughtQuality = '480p';
        req.continue();
      } else if (['image', 'font', 'media'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Strategy: Stop as soon as we catch a stream OR reach 8.5s
    const navigationPromise = page.goto(playUrl, { waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
    
    // Polling for the caught stream to speed up response
    for (let i = 0; i < 40; i++) {
        if (caughtStream) break;
        await new Promise(r => setTimeout(r, 200));
    }

    if (!caughtStream) {
        // Final check for buttons if sniffing didn't work immediately
        const buttons = await page.evaluate(() => {
           return Array.from(document.querySelectorAll('.hd_btn')).map(btn => ({
             quality: btn.textContent?.trim() || 'HD',
             url: btn.getAttribute('data-url')
           })).filter(x => x.url);
        }).catch(() => []);

        if (buttons.length > 0) {
            await browser.close();
            cache.set(token, { streams: buttons, expiry: Date.now() + 600000 });
            return NextResponse.json({ streams: buttons });
        }
    }

    await browser.close();

    if (caughtStream) {
      const result = [{ quality: caughtQuality, url: caughtStream }];
      cache.set(token, { streams: result, expiry: Date.now() + 600000 });
      return NextResponse.json({ streams: result });
    }
  } catch (err) {
    if (browser) await browser.close();
    console.error('Sniffer Error:', err);
  }

  return NextResponse.json({ streams: [], error: 'Timeout or Empty Results' }, { status: 200 });
}
