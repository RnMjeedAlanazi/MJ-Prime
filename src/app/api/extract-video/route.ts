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

  // 2. Direct Domain Strategy (Best for Vercel speed)
  let baseDomain = domainParam || await getBaseUrl();
  // Always use .best to avoid the redirect lag
  baseDomain = baseDomain.replace('.xyz', '.best').replace(/\/$/, '');
  
  const playUrl = `${baseDomain}/video_player?player_token=${token}`;

  // 3. AGGRESSIVE FAST PATH (Regex is king on Vercel)
  try {
    const res = await fetch(playUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Referer': baseDomain,
      },
      next: { revalidate: 0 }
    });

    if (res.ok) {
      const html = await res.text();
      const streams: {quality: string, url: string}[] = [];
      
      // Pattern 1: hd_btn with data-url
      const btnRegex = /class="hd_btn"[^>]*data-url="(.*?)"[^>]*>(.*?)<\/button>/g;
      let m; while ((m = btnRegex.exec(html)) !== null) if (m[1]) streams.push({ quality: m[2].trim() || 'Auto', url: m[1] });

      // Pattern 2: JWPlayer / Multi-source configs (file: "...", label: "...")
      const multiMatch = html.matchAll(/["']?file["']?\s*:\s*["']([^"']+\.m3u8[^"']*)["']\s*,\s*["']?label["']?\s*:\s*["']([^"']+)["']/g);
      for (const match of multiMatch) streams.push({ quality: match[2] || 'Auto', url: match[1] });

      // Pattern 3: Simple m3u8 in JS arrays or strings
      if (streams.length === 0) {
        const m3u8Match = html.matchAll(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/g);
        for (const match of m3u8Match) {
          const url = match[1];
          // Try to guess quality from URL or just call it HD
          let q = 'HD';
          if (url.includes('1080')) q = '1080p';
          else if (url.includes('720')) q = '720p';
          else if (url.includes('480')) q = '480p';
          streams.push({ quality: q, url });
        }
      }

      if (streams.length > 0) {
        // Clean and prioritize unique URLs
        const unique = streams.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
        // Sort by quality (descending)
        unique.sort((a, b) => {
          const qA = parseInt(a.quality) || 0;
          const qB = parseInt(b.quality) || 0;
          return qB - qA;
        });
        
        cache.set(token, { streams: unique, expiry: Date.now() + 600000 });
        return NextResponse.json({ streams: unique });
      }
    }
  } catch (e) {
    console.warn('Fast path failed');
  }

  // 4. LAST CHANCE: PUPPETEER (Only if time allows < 8s)
  const isVercel = process.env.VERCEL === '1';
  if ((Date.now() - startTime) < 5000) {
    let browser;
    try {
      const launchOptions = isVercel ? {
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      } : {
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: true
      };

      browser = await puppeteer.launch(launchOptions as any);
      const page = await browser.newPage();
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        if (['image', 'font', 'media', 'stylesheet'].includes(req.resourceType())) req.abort();
        else req.continue();
      });

      await page.goto(playUrl, { waitUntil: 'domcontentloaded', timeout: 4000 });
      const results = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.hd_btn')).map(btn => ({
          quality: btn.textContent?.trim() || 'Auto',
          url: btn.getAttribute('data-url')
        })).filter(x => x.url);
      });

      await browser.close();
      if (results.length > 0) {
        cache.set(token, { streams: results, expiry: Date.now() + 600000 });
        return NextResponse.json({ streams: results });
      }
    } catch (err) {
      if (browser) await browser.close();
    }
  }

  // If we reach here, we are very close to Vercel's limit. 
  // Return empty instead of 504 to let the player UI handle it.
  return NextResponse.json({ streams: [], error: 'Timeout' }, { status: 200 });
}
