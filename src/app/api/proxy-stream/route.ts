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

    let body: ArrayBuffer | string = await response.arrayBuffer();

    // Rewrite M3U8 playlists to route through proxy
    if (contentType.includes('mpegurl') || contentType.includes('m3u8') || url.endsWith('.m3u8')) {
      let text = new TextDecoder().decode(body);
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);

      const lines = text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;
        
        // Make URL absolute if relative
        const absUrl = trimmed.startsWith('http') ? trimmed : baseUrl + trimmed;
        return `/api/proxy-stream?url=${encodeURIComponent(absUrl)}`;
      });

      text = lines.join('\n');
      body = text;
    }

    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    console.error('Proxy Stream Error:', msg);
    return new NextResponse(msg, { status: 502 });
  }
}
