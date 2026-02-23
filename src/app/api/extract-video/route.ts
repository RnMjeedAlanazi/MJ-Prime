import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';
import { getBaseUrl } from '@/lib/config';

// Cache to avoid re-extracting for the same token
const cache = new Map<string, { streams: {quality: string, url: string}[], expiry: number }>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const baseUrl = await getBaseUrl();

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

    // Pattern 2: Look for JWPlayer style file source
    if (streams.length === 0) {
      const fileRegex = /["']?file["']?\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i;
      const fileMatch = html.match(fileRegex);
      if (fileMatch) {
        streams.push({ quality: 'Auto', url: fileMatch[1] });
      }
    }

    if (streams.length > 0) {
      console.log(`[extract-video] Fast extracted ${streams.length} streams`);
      cache.set(token, { streams, expiry: Date.now() + 10 * 60000 });
      return NextResponse.json({ streams });
    }
  } catch (e) {
    console.log('[extract-video] Fast path failed, falling back to Puppeteer');
  }

  // SLOW PATH: Falling back to Puppeteer if regex fails
  let browser;
  try {
    console.log('[extract-video] Launching optimized puppeteer for:', playUrl.substring(0, 80));

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: (chromium as any).defaultViewport || null,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless as any,
    });

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
    await page.goto(playUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Wait for the hd_btn buttons or a short timeout
    await page.waitForSelector('.hd_btn', { timeout: 3000 }).catch(() => {});

    // Extract stream URLs from buttons
    const streams = await page.evaluate(() => {
      const buttons = document.querySelectorAll('.hd_btn');
      const results: {quality: string, url: string}[] = [];
      buttons.forEach((btn) => {
        const quality = btn.textContent?.trim() || 'Auto';
        const url = btn.getAttribute('data-url');
        if (url) {
          results.push({ quality, url });
        }
      });

      if (results.length === 0) {
        try {
          // @ts-expect-error jwplayer is global
          const player = window.jwplayer?.('player');
          if (player) {
            const item = player.getPlaylistItem?.();
            const sources = player.getPlaylist?.()?.[0]?.sources;
            if (sources?.length) {
              sources.forEach((s: any) => results.push({ quality: s.label || 'Auto', url: s.file }));
            } else if (item?.file) {
              results.push({ quality: 'Auto', url: item.file });
            }
          }
        } catch {}
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
