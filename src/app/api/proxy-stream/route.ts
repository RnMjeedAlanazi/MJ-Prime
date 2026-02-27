import { NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/config';

export const runtime = 'edge';

const playlistCache = new Map<string, { text: string; expiry: number }>();

async function fetchWithRetry(url: string, userAgent: string, maxRetries = 2): Promise<Response> {
  const urlObj = new URL(url);
  
  // High-Speed Origin Detection for scdns.io clusters
  // This regex is more specific to the webNx.domain.tld pattern
  let detectedOrigin = urlObj.origin;
  const domainMatch = url.match(/(web\d+x\.[a-z0-9.-]+)/); // More robust regex for domain
  if (domainMatch) {
    detectedOrigin = `https://${domainMatch[1]}`;
  }

  const headers = {
    'Referer': `${detectedOrigin}/`,
    'Origin': detectedOrigin,
    'User-Agent': userAgent,
    'Accept': '*/*, application/vnd.apple.mpegurl',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache' // Added no-cache for fresh content
  };
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    // More aggressive timeout for master playlists (12s)
    const timeoutId = setTimeout(() => controller.abort(), 12000); 

    try {
      const response = await fetch(url, { 
        headers: headers as any, 
        signal: controller.signal,
        priority: 'high' // Added priority hint
      } as any);

      clearTimeout(timeoutId);

      // If server returns error 5xx or 429, we should retry!
      if (!response.ok && (response.status >= 500 || response.status === 429)) {
         throw new Error(`HTTP Error: ${response.status}`);
      }
      return response;
    } catch (err: any) {
      clearTimeout(timeoutId);
      // Simplified retry logic with fixed backoff
      if (attempt < maxRetries) {
        console.warn(`[proxy-stream] attempt ${attempt} failed for ${url.substring(0, 60)}... Error: ${err.message || 'Unknown Error'}. Retrying...`);
        await new Promise(r => setTimeout(r, 400 * attempt)); // Fixed backoff
        continue;
      }
      console.error(`[proxy-stream] Max retries reached for ${url.substring(0, 100)}. Error: ${err.message}`);
      throw err;
    }
  }
  throw new Error('Max retries');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const userAgent = request.headers.get('user-agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

  if (!url) {
    return new NextResponse('Missing url', { status: 400 });
  }

  // Fast-path: Memory Cache Check
  const cached = playlistCache.get(url);
  if (cached && cached.expiry > Date.now()) {
    return new NextResponse(cached.text, {
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60',
        'X-Cache': 'HIT'
      },
    });
  }

  try {
    const response = await fetchWithRetry(url, userAgent);
    
    if (!response.ok) {
      return new NextResponse(`Remote error: ${response.status}`, { status: response.status });
    }

    const contentType = response.headers.get('content-type') || '';
    const isM3U8 = contentType.includes('mpegurl') || 
                   contentType.includes('m3u8') || 
                   url.split('?')[0].toLowerCase().endsWith('.m3u8');

    if (isM3U8) {
      const text = await response.text();
      const urlObj = new URL(url);
      const rootDomain = urlObj.origin;
      const urlSearch = urlObj.search;
      
      let baseUrl = url.split('?')[0];
      if (!baseUrl.endsWith('/')) {
         baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
      }

      const proxyPath = '/api/proxy-stream?url=';

      const lines = text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#EXT-X-VERSION') || trimmed.startsWith('#EXT-X-MEDIA-SEQUENCE')) return line;
        
        if (trimmed.startsWith('#')) {
          if (trimmed.includes('URI=')) {
              return line.replace(/URI=["'](.*?)["']/g, (match, p1) => {
                 let absUrl = p1;
                 if (!p1.startsWith('http')) {
                     absUrl = p1.startsWith('/') ? rootDomain + p1 : baseUrl + p1;
                 }
                 return `URI="${proxyPath}${encodeURIComponent(absUrl)}"`;
              });
          }
          return line;
        }
        
        let absUrl = trimmed;
        if (!trimmed.startsWith('http')) {
             absUrl = trimmed.startsWith('/') ? rootDomain + trimmed : baseUrl + trimmed;
             if (urlSearch && !absUrl.includes('?')) {
                 absUrl += urlSearch;
             }
        }
        return `${proxyPath}${encodeURIComponent(absUrl)}`;
      });

      const processedText = lines.join('\n');
      
      // Store in memory for other concurrent requests
      playlistCache.set(url, { text: processedText, expiry: Date.now() + 60000 });

      return new NextResponse(processedText, {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=60',
          'X-Cache': 'MISS'
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
