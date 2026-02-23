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

  // 3. DIRECT PUPPETEER PATH (Priority)
  const isVercel = process.env.VERCEL === '1';
  let browser;
  try {
    const launchOptions = isVercel ? {
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    } : {
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true
    };

    browser = await puppeteer.launch(launchOptions as any);
    const page = await browser.newPage();
    
    // Aggressive optimization: block everything except scripts and document
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'font', 'media', 'stylesheet', 'other'].includes(type) || req.url().includes('google-analytics') || req.url().includes('ads')) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Go to player and wait for the buttons to appear
    await page.goto(playUrl, { waitUntil: 'domcontentloaded', timeout: 7000 });
    
    // Extract both data-url buttons and any m3u8 in scripts
    const results = await page.evaluate(() => {
      const streams: any[] = [];
      // Catch buttons
      document.querySelectorAll('.hd_btn').forEach(btn => {
        const url = btn.getAttribute('data-url');
        if (url) streams.push({ quality: btn.textContent?.trim() || 'Auto', url });
      });
      // Fallback: look for m3u8 in scripts if no buttons
      if (streams.length === 0) {
        const html = document.documentElement.innerHTML;
        const matches = html.matchAll(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/g);
        for (const m of matches) streams.push({ quality: 'HD', url: m[1] });
      }
      return streams;
    });

    await browser.close();

    if (results.length > 0) {
      const unique = results.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
      cache.set(token, { streams: unique, expiry: Date.now() + 600000 });
      return NextResponse.json({ streams: unique });
    }
  } catch (err) {
    if (browser) await browser.close();
    console.error('Puppeteer Error:', err);
  }

  return NextResponse.json({ streams: [], error: 'Timeout or Extraction Failed' }, { status: 200 });
}
