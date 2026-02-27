import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { getBaseUrl } from '@/lib/config';
import { GlobalCache } from '@/lib/server-cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

const cache = new Map<string, { streams: {quality: string, url: string}[], expiry: number }>();
let globalBrowser: any = null;
let activePages = 0;
let lastUsed = Date.now();
const MAX_CONCURRENT_PAGES = 5; // Hard limit to prevent server crash

// Background worker to clean up memory
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    if (globalBrowser && Date.now() - lastUsed > 300000 && activePages === 0) {
        console.log("Closing idle browser to save memory...");
        globalBrowser.close().catch(() => {});
        globalBrowser = null;
    }
  }, 60000);
}

async function getBrowser() {
  lastUsed = Date.now();
  if (globalBrowser && globalBrowser.connected) return globalBrowser;
  
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
        "--disable-infobars",
        "--window-position=-2100,-2100",
        "--window-size=1,1"
      ],
      headless: "new"
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
  const mediaId = searchParams.get('mediaId'); // Path/Season/Ep identifier
  
  if (!token) return NextResponse.json({ streams: [], error: 'Missing token' }, { status: 400 });

  // Sanitize mediaId for Firebase (remove forbidden characters)
  const safeMediaId = mediaId ? mediaId.replace(/\./g, '_').replace(/[\$#\[\]]/g, '_') : null;
  const storageKey = safeMediaId || token;

  const cached = cache.get(storageKey);
  if (cached && cached.expiry > Date.now()) return NextResponse.json({ streams: cached.streams });

  // Check Persistent Cache (Firebase)
  const persistent = await GlobalCache.get(`streams/${storageKey}`, 172800); // 48 hours for streams
  if (persistent) {
    // Also update memory cache
    cache.set(storageKey, { streams: persistent, expiry: Date.now() + 3600000 });
    return NextResponse.json({ streams: persistent });
  }

  let baseDomain = domainParam || await getBaseUrl();
  if (baseDomain.includes('faselhd')) {
      baseDomain = baseDomain.replace(/\.([a-z0-9]+)$/, '.best');
  }
  const playUrl = `${baseDomain.replace(/\/$/, '')}/video_player?player_token=${token}`;

  // === ULTRA-FAST PATH: Fetch & Multi-Regex ===
  try {
    const fetchWithRetry = async (url: string, retries = 2) => {
      for (let i = 0; i < retries; i++) {
        try {
          return await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Referer': baseDomain,
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
            },
            next: { revalidate: 0 }
          });
        } catch (err: any) {
          if (i === retries - 1) throw err;
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    };

    const res = await fetchWithRetry(playUrl);
    if (res && res.ok) {
      const html = await res.text();
      
      // Improved multi-source detection
      const patterns = [
        /data-url=["']([^"']+\.m3u8[^"']*)["']/gi,
        /(?:file|url|src)["']?\s*:\s*["']([^"']+\.m3u8[^"']*)["']/gi,
        /["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/gi,
        /source\s+src=["']([^"']+\.m3u8[^"']*)["']/gi
      ];

      const allUrls = new Set<string>();
      for (const pattern of patterns) {
        const matches = [...html.matchAll(pattern)];
        matches.forEach(m => allUrls.add(m[1]));
      }

      if (allUrls.size > 0) {
        let streams = Array.from(allUrls).map(url => {
          let q = 'Auto';
          if (url.includes('1080')) q = '1080p';
          else if (url.includes('720')) q = '720p';
          else if (url.includes('480')) q = '480p';
          else if (url.includes('360')) q = '360p';
          return { quality: q, url };
        });

        // Deduplicate and prioritize
        const map = new Map<string, any>();
        streams.forEach(s => {
          if (!map.has(s.quality) || (s.url.length < map.get(s.quality).url.length)) {
             map.set(s.quality, s);
          }
        });
        
        streams = Array.from(map.values()).sort((a, b) => parseInt(b.quality) - parseInt(a.quality));

        console.log("Ultra-fast path successful!");
        cache.set(storageKey, { streams, expiry: Date.now() + 3600000 }); // 1 hour memory
        GlobalCache.set(`streams/${storageKey}`, streams); // 48h persistent
        return NextResponse.json({ streams });
      }
    }
  } catch (e) {
    console.error("Fast path failed:", e);
  }

  // === SLOW PATH: Optimization Puppeteer (Turbo Mode) ===
  if (activePages >= MAX_CONCURRENT_PAGES) {
      return NextResponse.json({ 
        streams: [], 
        error: 'The server is currently processing many requests. Please wait a few seconds and try again.' 
      }, { status: 429 });
  }

  let page: any = null;
  let caughtStream: string | null = null;
  let caughtQuality: string = 'Auto';

  try {
    activePages++;
    const browser = await getBrowser();
    page = await browser.newPage();
    
    // Minimal footprint
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setRequestInterception(true);

    page.on('request', (req: any) => {
      const type = req.resourceType();
      const url = req.url();
      
      // Catch stream immediately
      if (url.includes('.m3u8') || url.includes('.mp4') || url.includes('playlist.m3u8')) {
        caughtStream = url;
        if (url.includes('1080')) caughtQuality = '1080p';
        else if (url.includes('720')) caughtQuality = '720p';
        else if (url.includes('480')) caughtQuality = '480p';
        req.continue();
      } 
      // Aggressive Blocking
      else if (['image', 'font', 'stylesheet', 'media', 'other'].includes(type) || 
               url.includes('google') || url.includes('analytics') || url.includes('ads') || 
               url.includes('facebook') || url.includes('twitter')) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // We don't wait for load, we wait for 'request'
    page.goto(playUrl).catch(() => {});
    
    // Polling with shorter interval
    for (let i = 0; i < 120; i++) { // 6 seconds max
      if (caughtStream) break;
      await new Promise(r => setTimeout(r, 50));
    }

    if (!caughtStream) {
      // Last ditch effort: Scrape the DOM
      caughtStream = await page.evaluate(() => {
        const el = document.querySelector('[data-url]') || 
                   document.querySelector('.hd_btn') || 
                   document.querySelector('source') ||
                   document.querySelector('video');
        if (el) {
          return el.getAttribute('data-url') || 
                 el.getAttribute('src') || 
                 (el as any).value || 
                 (el as any).src;
        }
        return null;
      }).catch(() => null);
    }

    if (caughtStream) {
      const streams = [{ quality: caughtQuality, url: caughtStream }];
      cache.set(storageKey, { streams, expiry: Date.now() + 3600000 });
      GlobalCache.set(`streams/${storageKey}`, streams);
      return NextResponse.json({ streams });
    }
  } catch (err) {
    console.error('Turbo Scraper Error:', err);
  } finally {
    activePages = Math.max(0, activePages - 1);
    if (page) await page.close().catch(() => {});
  }

  return NextResponse.json({ streams: [], error: 'Could not extract streams. Please refresh or try another source.' });
}
