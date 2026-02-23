// @ts-nocheck
import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';
import { getBaseUrl } from '@/lib/config';

const VERSION = '1.0.1'; // Force fresh build
const cache = new Map<string, { streams: {quality: string, url: string}[], expiry: number }>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const baseUrl = (await getBaseUrl()) || 'https://web22312x.faselhdx.best';

  if (!token) {
    return NextResponse.json({ streams: [], error: 'Missing token parameter' }, { status: 400 });
  }

  // Check cache first (valid for 10 minutes)
  const cached = cache.get(token);
  if (cached && cached.expiry > Date.now()) {
    return NextResponse.json({ streams: cached.streams });
  }

  const playUrl = `${baseUrl}/video_player?player_token=${token}`;

  // FAST PATH: Try direct fetch and regex first (10-20x faster than Puppeteer)
  try {
    const fastRes = await fetch(playUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      next: { revalidate: 600 }
    });
    const html = await fastRes.text();
    
    const streams: {quality: string, url: string}[] = [];
    
    // Pattern 1: Look for data-url attributes in buttons
    const btnRegex = /class="hd_btn"[^>]*data-url="(.*?)"[^>]*>(.*?)<\/button>/g;
    let match;
    while ((match = btnRegex.exec(html)) !== null) {
      streams.push({ quality: match[2].trim(), url: match[1] });
    }

    // Pattern 2: Look for file properties in JWPlayer setup
    if (streams.length === 0) {
      const jwRegex = /["']?file["']?\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/gi;
      let jwMatch;
      while ((jwMatch = jwRegex.exec(html)) !== null) {
        streams.push({ quality: 'Auto', url: jwMatch[1] });
      }
    }

    // Pattern 3: Look for sources array in Setup call
    if (streams.length === 0) {
       const sourcesRegex = /sources\s*:\s*\[([\s\S]*?)\]/i;
       const sourcesMatch = html.match(sourcesRegex);
       if (sourcesMatch) {
         const singleSourceRegex = /\{\s*file\s*:\s*["']([^"']+)["']\s*,\s*label\s*:\s*["']([^"']+)["']/g;
         let sMatch;
         while ((sMatch = singleSourceRegex.exec(sourcesMatch[1])) !== null) {
           streams.push({ quality: sMatch[2], url: sMatch[1] });
         }
       }
    }

    if (streams.length > 0) {
      // Remove duplicates
      const uniqueStreams = streams.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
      console.log(`[extract-video] Fast extracted ${uniqueStreams.length} streams`);
      cache.set(token, { streams: uniqueStreams, expiry: Date.now() + 10 * 60000 });
      return NextResponse.json({ streams: uniqueStreams });
    }
  } catch (e) {
    console.log('[extract-video] Fast path error:', e);
  }

  // SLOW PATH: Falling back to Puppeteer if regex fails
  let browser;
  try {
    console.log('[extract-video] Launching optimized puppeteer for:', playUrl.substring(0, 80));

    browser = await puppeteer.launch({
      args: (chromium as any).args || [],
      defaultViewport: (chromium as any).defaultViewport || null,
      executablePath: await (chromium as any).executablePath(),
      headless: (chromium as any).headless !== undefined ? (chromium as any).headless : true,
    } as any);

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Block unnecessary resources to speed things up
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media', 'other', 'manifest', 'ping'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Use domcontentloaded for speed
    console.log('[extract-video] Navigating to:', playUrl);
    await page.goto(playUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // Wait for the hd_btn buttons or a short timeout
    console.log('[extract-video] Waiting for .hd_btn...');
    await page.waitForSelector('.hd_btn', { timeout: 8000 }).catch(e => {
        console.warn('[extract-video] Selector .hd_btn not found within 8s');
    });

    // Extract stream URLs from buttons
    const streams = await page.evaluate(() => {
      const results: {quality: string, url: string}[] = [];
      try {
        const buttons = document.querySelectorAll('.hd_btn');
        buttons.forEach((btn) => {
            const quality = btn.textContent?.trim() || 'Auto';
            const url = btn.getAttribute('data-url');
            if (url) results.push({ quality, url });
        });

        if (results.length === 0) {
            // @ts-expect-error jwplayer
            const player = window.jwplayer?.('player');
            if (player) {
                const sources = player.getPlaylist?.()?.[0]?.sources;
                if (sources?.length) {
                    sources.forEach((s: any) => results.push({ quality: s.label || 'Auto', url: s.file }));
                }
            }
        }
      } catch (e) {
          console.error('Evaluate error:', e);
      }
      return results;
    });

    await browser.close();
    browser = null;

    console.log(`[extract-video] Puppeteer extracted ${streams.length} streams`);

    // Cache the result for 10 minutes
    if (streams.length > 0) {
      cache.set(token, { streams, expiry: Date.now() + 10 * 60000 });
    }

    return NextResponse.json({ streams });
  } catch (error) {
    console.error('[extract-video] Error:', error instanceof Error ? error.message : error);
    if (browser) {
      try { await browser.close(); } catch {}
    }
    return NextResponse.json({ streams: [], error: 'Failed to extract video streams' }, { status: 500 });
  }
}
