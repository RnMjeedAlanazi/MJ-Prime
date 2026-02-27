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
        "--disable-features=IsolateOrigins,site-per-process,Translate,OptimizationHints,BackForwardCache",
        "--disable-extensions",
        "--disable-gpu",
        "--disable-infobars",
        "--disable-notifications",
        "--disable-background-networking",
        "--disable-default-apps",
        "--disable-sync",
        "--metrics-recording-only",
        "--no-first-run",
        "--no-zygote",
        "--mute-audio",
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

  // 1. Initial Domain Setup
  let baseDomain = domainParam || getBaseUrl();
  if (baseDomain.includes('faselhd')) {
      baseDomain = baseDomain.replace(/\.([a-z0-9]+)$/, '.best');
  }
  const playUrl = `${baseDomain.replace(/\/$/, '')}/video_player?player_token=${token}`;

  // 2. COMPETITIVE PARALLEL RACE
  // We run Firebase Check and Fast Extraction in parallel. Whichever finishes first with data wins.
  const abortController = new AbortController();
  
  const firebaseTask = GlobalCache.get(`streams/${storageKey}`, 172800);
  const extractionTask = (async () => {
    try {
      const fetchWithRetry = async (url: string, retries = 2) => {
        for (let i = 0; i < retries; i++) {
          try {
            const res = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Referer': baseDomain,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
              },
              signal: abortController.signal,
              next: { revalidate: 0 }
            });
            if (res.ok) return res;
            throw new Error(`Status ${res.status}`);
          } catch (err: any) {
            if (i === retries - 1 || abortController.signal.aborted) throw err;
            await new Promise(r => setTimeout(r, 200)); // Faster retry
          }
        }
      };

      const res = await fetchWithRetry(playUrl);
      if (res && res.ok) {
        const html = await res.text();
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
          const map = new Map<string, any>();
          streams.forEach(s => {
            if (!map.has(s.quality) || (s.url.length < map.get(s.quality).url.length)) map.set(s.quality, s);
          });
          return Array.from(map.values()).sort((a, b) => parseInt(b.quality) - parseInt(a.quality));
        }
      }
    } catch (e) {
      if (!abortController.signal.aborted) console.error("Fast extraction failed:", e);
    }
    return null;
  })();

  // Race between Firebase and Extraction
  // We wait for the first valid result
  const firstResult = await Promise.race([
    firebaseTask.then(data => data ? { source: 'firebase', streams: data } : null),
    extractionTask.then(streams => streams ? { source: 'extract', streams } : null)
  ]);

  // If one of them returned data immediately, return it
  if (firstResult && firstResult.streams) {
    if (firstResult.source === 'firebase') abortController.abort(); // Cancel fetch if we got from DB
    
    const streams = firstResult.streams;
    cache.set(storageKey, { streams, expiry: Date.now() + 3600000 });
    if (firstResult.source === 'extract') GlobalCache.set(`streams/${storageKey}`, streams);
    return NextResponse.json({ streams });
  }

  // Fallback: wait for the second one if the first one was null
  const [persistent, fastStreams] = await Promise.all([firebaseTask, extractionTask]);
  const finalStreams = persistent || fastStreams;

  if (finalStreams) {
    cache.set(storageKey, { streams: finalStreams, expiry: Date.now() + 3600000 });
    if (fastStreams && !persistent) GlobalCache.set(`streams/${storageKey}`, fastStreams);
    return NextResponse.json({ streams: finalStreams });
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
    // 4. Aggressive Resource Blocking & Optimization
    await page.setRequestInterception(true);
    // Disable features that slow down page execution
    await page.setJavaScriptEnabled(true);
    await (page as any).setCacheEnabled(true); // Allow caching for faster subsequent navigations if browser stays open

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
        return;
      } 
      
      // BLOCK EVERYTHING ELSE
      // We only need the main document and essential scripts that trigger the player
      const blockTypes = ['image', 'font', 'stylesheet', 'media', 'object', 'texttrack', 'eventsource', 'websocket', 'manifest'];
      const blockDomains = ['google', 'analytics', 'ads', 'facebook', 'twitter', 'adnxs', 'doubleclick', 'amazon-adsystem', 'popads', 'onclickads'];

      if (blockTypes.includes(type) || blockDomains.some(d => url.includes(d))) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Disable extra features to save CPU/Memory
    const client = await (page as any).target().createCDPSession();
    await client.send('Page.setAdBlockingEnabled', { enabled: true });
    await client.send('Network.setBypassServiceWorker', { bypass: true });

    // NAVIGATION: Fast-load strategy
    // We don't wait for 'load' or 'networkidle', just trigger and poll
    page.goto(playUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    
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
