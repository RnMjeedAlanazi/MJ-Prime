import { NextResponse } from 'next/server';
import { BASE_URL } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    const targetUrl = new URL(imageUrl);
    const referer = BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`;
    
    let response: Response | null = null;
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

        // First attempt: original referer. Second attempt: image origin as referer
        const activeReferer = attempts === 0 ? referer : `${targetUrl.origin}/`;

        response = await fetch(imageUrl, {
          headers: {
            'Referer': activeReferer,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) break;
      } catch (e: any) {
        attempts++;
        if (attempts === maxAttempts) throw e;
        // Wait a bit before retrying, especially on connection resets
        const waitTime = (e.code === 'ECONNRESET' || e.cause?.code === 'ECONNRESET') ? 1500 : 500;
        await new Promise(r => setTimeout(r, waitTime));
      }
    }

    if (!response || !response.ok) {
        // Return transparent pixel immediately if fetch fails to avoid breaking UI
        throw new Error('Image fetch failed');
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    // Return a 1x1 transparent pixel on error to prevent broken image icons silently
    const transparentPixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    return new NextResponse(transparentPixel, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
