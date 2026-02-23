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
  
  if (!token) {
    return NextResponse.json({ streams: [], error: 'Missing token parameter' }, { status: 400 });
  }

  // 1. Check Cache
  const cached = cache.get(token);
  if (cached && cached.expiry > Date.now()) {
    return NextResponse.json({ streams: cached.streams });
  }

  // 2. Normalize Domain to avoid redirects (Crucial for Vercel speed)
  let baseDomain = domainParam || await getBaseUrl();
  // User confirmed .xyz redirects to .best, so we jump straight to .best to save 2-3 seconds of redirect lag
  if (baseDomain.includes('.faselhdx.xyz')) {
    baseDomain = baseDomain.replace('.faselhdx.xyz', '.faselhdx.best');
  }
  const playUrl = `${baseDomain.replace(/\/$/, '')}/video_player?player_token=${token}`;

  // Helper to check if we are running out of time (Vercel limit is 10s)
  const getRemainingTime = () => 9000 - (Date.now() - startTime);

  // 3. FAST PATH (REGEX) - Timeout based on remaining time
  try {
    const fastTimeout = Math.min(getRemainingTime(), 5000); 
    if (fastTimeout > 1000) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), fastTimeout);
      
      const res = await fetch(playUrl, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Referer': baseDomain,
        },
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(id);

      if (res.ok) {
        const html = await res.text();
        const streams: {quality: string, url: string}[] = [];
        
        // Pattern 1: hd_btn buttons
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

        if (streams.length > 0) {
          const unique = streams.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
          cache.set(token, { streams: unique, expiry: Date.now() + 600000 });
          return NextResponse.json({ streams: unique });
        }
      }
    }
  } catch (e) {
    console.warn('[extract-video] Fast Path skipped/failed');
  }

  // 4. SLOW PATH (PUPPETEER)
  const isVercel = process.env.VERCEL === '1';
  const isRailway = !!process.env.RAILWAY_ENVIRONMENT;
  const remaining = isRailway ? 30000 : getRemainingTime(); // Railway gets 30s+
  
  if (remaining > 4000) {
    let browser;
    try {
      let launchOptions;
      if (isVercel) {
        launchOptions = {
          args: chromium.args,
          defaultViewport: chromium.defaultViewport,
          executablePath: await chromium.executablePath(),
          headless: chromium.headless,
        };
      } else if (isRailway) {
        launchOptions = {
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
          executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
          headless: true
        };
      } else {
        // Local Windows
        launchOptions = {
          executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          headless: true
        };
      }

      browser = await puppeteer.launch(launchOptions as any);
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
      
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        if (['image', 'font', 'media', 'stylesheet'].includes(req.resourceType())) req.abort();
        else req.continue();
      });

      // Very tight timeout for the page load
      await page.goto(playUrl, { waitUntil: 'domcontentloaded', timeout: Math.min(remaining - 2000, 4000) });
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
        cache.set(token, { streams: unique, expiry: Date.now() + 600000 });
        return NextResponse.json({ streams: unique });
      }
    } catch (error) {
      if (browser) await browser.close();
    }
  }

  // Final generic error instead of letting Vercel timeout
  return NextResponse.json({ streams: [], error: 'تعذر الاستخراج ضمن الوقت المسموح' }, { status: 504 });
}
