import { NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/config';

export const runtime = 'edge';

async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const baseUrl = await getBaseUrl();
      // Use standard fetch without custom AbortSignal first for simplicity
      const response = await fetch(url, {
        headers: {
          'Referer': `${baseUrl.replace(/\/$/, '')}/video_player`,
          'Origin': baseUrl.replace(/\/$/, ''),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': '*/*, application/vnd.apple.mpegurl',
          'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
        }
      });
      // If server returns error 5xx or 429, we should retry!
      if (!response.ok && (response.status >= 500 || response.status === 429)) {
         throw new Error(`HTTP Error: ${response.status}`);
      }
      return response;
    } catch (err) {
      if (attempt < maxRetries) {
        console.warn(`[proxy-stream] attempt ${attempt} failed, retrying for ${url.substring(0, 50)}...`);
        // Progressive backoff delay
        await new Promise(r => setTimeout(r, 500 * attempt));
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
      let baseUrl = url.split('?')[0]; // strip search params for correct pathing
      if (!baseUrl.endsWith('/')) {
         baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
      }

      // Robust M3U8 rewriting
      const lines = text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;
        
        // If it's a metadata line, check for URI attributes (like for encryption keys or subtitles)
        if (trimmed.startsWith('#')) {
          if (trimmed.includes('URI=')) {
              return line.replace(/URI=["'](.*?)["']/g, (match, p1) => {
                 let absUrl = p1;
                 if (!p1.startsWith('http')) {
                     if (p1.startsWith('/')) {
                         const rootDomain = new URL(baseUrl).origin;
                         absUrl = rootDomain + p1;
                     } else {
                         try {
                             absUrl = new URL(p1, baseUrl).href;
                         } catch(e) {
                             absUrl = baseUrl + p1;
                         }
                     }
                 }
                 return `URI="/api/proxy-stream?url=${encodeURIComponent(absUrl)}"`;
              });
          }
          return line;
        }
        
        // It's a URL (segment or sub-playlist)
        let absUrl = trimmed;
        if (!trimmed.startsWith('http')) {
             if (trimmed.startsWith('/')) {
                 const rootDomain = new URL(baseUrl).origin;
                 absUrl = rootDomain + trimmed;
             } else {
                 try {
                     absUrl = new URL(trimmed, baseUrl).href;
                 } catch(e) {
                     absUrl = baseUrl + trimmed;
                 }
             }

             // If original URL had search params (like token) and the segment doesn't, append them
             const originalUrlObj = new URL(url);
             if (originalUrlObj.search && !absUrl.includes('?')) {
                 absUrl += originalUrlObj.search;
             }
        }
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
