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

  // === FAST PATH: Fetch & Regex Extract ===
  try {
    const res = await fetch(playUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': baseDomain
      },
      next: { revalidate: 0 }
    });

    if (res.ok) {
      const html = await res.text();
      
      // Look for hidden buttons or data attributes
      let m3u8Url: string | null = null;
      let quality = 'Auto';

      const dataUrlMatch = html.match(/data-url=["']([^"']+\.m3u8[^"']*)["']/i);
      if (dataUrlMatch) {
        m3u8Url = dataUrlMatch[1];
      } else {
        // Look for typical player setup scripts
        const fileMatch = html.match(/(?:file|url|src)["']?\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i);
        if (fileMatch) {
          m3u8Url = fileMatch[1];
        }
      }

      if (m3u8Url) {
        if (m3u8Url.includes('1080')) quality = '1080p';
        else if (m3u8Url.includes('720')) quality = '720p';
        else if (m3u8Url.includes('480')) quality = '480p';

        // Additional streams if available in the same HTML block
        const allMatches = [...html.matchAll(/(?:file|url|src|data-url)["']?\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/gi)];
        const uniqueUrls = Array.from(new Set(allMatches.map(m => m[1])));
        
        let streams = uniqueUrls.map(url => {
          let q = 'Auto';
          if (url.includes('1080')) q = '1080p';
          else if (url.includes('720')) q = '720p';
          else if (url.includes('480')) q = '480p';
          return { quality: q, url };
        });

        if (streams.length === 0) {
            streams = [{ quality, url: m3u8Url }];
        } else {
            // Deduplicate streams by quality (prefer first found if duplicates)
            const map = new Map<string, any>();
            streams.forEach(s => {
                if (!map.has(s.quality)) {
                    map.set(s.quality, s);
                }
            });
            streams = Array.from(map.values());
        }

        console.log("Fast path extraction successful!");
        cache.set(token, { streams, expiry: Date.now() + 1800000 });
        return NextResponse.json({ streams });
      } else {
         console.log("Fast path failed to find m3u8, attempting puppeteer...");
      }
    }
  } catch (e) {
    console.error("Fast path error:", e);
  }

  // === SLOW PATH: Puppeteer Extraction ===
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

    try {
        await page.goto(playUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });
    } catch (e) {
        console.log("Initial goto failed, waiting for stream specifically...");
    }
    
    let retries = 0;
    const maxRetries = 120; // 6 seconds total
    while (retries < maxRetries && !caughtStream) {
        await new Promise(r => setTimeout(r, 50));
        retries++;
    }

    if (!caughtStream) {
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
