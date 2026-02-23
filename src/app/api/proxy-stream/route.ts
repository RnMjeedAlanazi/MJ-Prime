import { NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/config';

export const runtime = 'edge';

async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
    const baseUrl = await getBaseUrl();
    const response = await fetch(url, {
        headers: {
          'Referer': `${baseUrl.replace(/\/$/, '')}/video_player`,
          'Origin': baseUrl.replace(/\/$/, ''),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
        },
        signal: AbortSignal.timeout(12000), 
      });
      return response;
    } catch (err) {
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 200 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing url', { status: 400 });
  }

  try {
    const response = await fetchWithRetry(url);
    
    if (!response.ok) {
      console.error(`[proxy-stream] Remote fetch failed: ${response.status} for ${url.substring(0, 100)}`);
      return new NextResponse(`Remote error: ${response.status}`, { status: response.status });
    }

    const contentType = response.headers.get('content-type') || '';
    const isM3U8 = contentType.includes('mpegurl') || 
                   contentType.includes('m3u8') || 
                   url.split('?')[0].toLowerCase().endsWith('.m3u8');

    if (isM3U8) {
      let text = await response.text();
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);

      // Robust M3U8 rewriting
      const lines = text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;
        
        // If it's a metadata line, check for URI attributes (like for encryption keys or subtitles)
        if (trimmed.startsWith('#')) {
          return trimmed.replace(/URI=["'](.*?)["']/g, (match, p1) => {
             const absUrl = p1.startsWith('http') ? p1 : new URL(p1, baseUrl).href;
             return `URI="/api/proxy-stream?url=${encodeURIComponent(absUrl)}"`;
          });
        }
        
        // It's a URL (segment or sub-playlist)
        const absUrl = trimmed.startsWith('http') ? trimmed : new URL(trimmed, baseUrl).href;
        return `/api/proxy-stream?url=${encodeURIComponent(absUrl)}`;
      });

      return new NextResponse(lines.join('\n'), {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache', // Don't cache playlists
        },
      });
    }

    // Direct streaming for segments (.ts, .vtt, etc.)
    return new NextResponse(response.body, {
      headers: {
        'Content-Type': contentType || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
        'Content-Length': response.headers.get('content-length') || '',
      },
    });
  } catch (error: any) {
    console.error('[proxy-stream] Final Error:', error.message);
    return new NextResponse(error.message, { status: 502 });
  }
}
