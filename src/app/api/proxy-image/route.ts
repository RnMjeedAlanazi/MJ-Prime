import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    const targetUrl = new URL(imageUrl);
    const referer = targetUrl.origin + '/';
    
    let response;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        response = await fetch(imageUrl, {
          headers: {
            'Referer': referer,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
          },
          next: { revalidate: 86400 }
        });
        if (response.ok) break;
      } catch (e) {
        attempts++;
        if (attempts === maxAttempts) throw e;
        await new Promise(r => setTimeout(r, 500)); // Wait before retry
      }
    }

    if (!response || !response.ok) {
      throw new Error(`Failed to fetch image: ${response?.statusText || 'Unknown error'}`);
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Proxy Image Error:', error);
    // Fallback: return a generic broken image or empty response instead of 500 if possible, 
    // but here we stick to 500 with a log.
    return new NextResponse('Failed to fetch image', { status: 500 });
  }
}
