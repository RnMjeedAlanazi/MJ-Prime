import { NextResponse } from 'next/server';

async function fetchWithRetry(url: string, maxRetries = 5): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'Referer': 'https://web2210x.faselhdx.best/',
          'Origin': 'https://web2210x.faselhdx.best',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(45000),
      });
      return response;
    } catch (err) {
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 300 * attempt));
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
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    // Optimize: Only read into memory if it's an M3U8 playlist
    if (contentType.includes('mpegurl') || contentType.includes('m3u8') || url.split('?')[0].endsWith('.m3u8')) {
      let text = await response.text();
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);

      const lines = text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;
        
        // Make URL absolute if relative
        const absUrl = trimmed.startsWith('http') ? trimmed : baseUrl + trimmed;
        return `/api/proxy-stream?url=${encodeURIComponent(absUrl)}`;
      });

      return new NextResponse(lines.join('\n'), {
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // For segments (.ts, .mp4, etc.), stream the response directly
    return new NextResponse(response.body, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400', // Cache segments for 24h
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    console.error('Proxy Stream Error:', msg);
    return new NextResponse(msg, { status: 502 });
  }
}
