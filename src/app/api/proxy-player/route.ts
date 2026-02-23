import { NextResponse } from 'next/server';
import axios from 'axios';

const BASE_URL = 'https://web2210x.faselhdx.best';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    const response = await axios.get(url, {
      headers: {
        'Referer': BASE_URL,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      responseType: 'arraybuffer'
    });

    let html = response.data.toString('utf-8');
    
    // Inject base tag so scripts/css load correctly from the original origin
    html = html.replace('<head>', `<head><base href="${BASE_URL}/" />`);

    const headers = new Headers();
    headers.set('Content-Type', 'text/html; charset=utf-8');
    // No X-Frame-Options set, which allows us to embed it!

    return new NextResponse(html, { headers });
  } catch (error) {
    console.error('Proxy Player Error:', error);
    return new NextResponse('Failed to proxy player HTML', { status: 500 });
  }
}
