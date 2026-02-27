import { fetchEpisodeIframeOnly } from '@/lib/scraper';
import { NextResponse } from 'next/server';
import { GlobalCache } from '@/lib/server-cache';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

  // 1. Check Cache
  const cached = await GlobalCache.get(`iframes/${slug}`, 604800); // 7 days cache
  if (cached) return NextResponse.json(cached);

  // 2. Extract fresh
  const episode = await fetchEpisodeIframeOnly(slug);
  if (!episode) return NextResponse.json({ error: 'Episode not found' }, { status: 404 });

  // 3. Save to Global Cache
  await GlobalCache.set(`iframes/${slug}`, episode);

  return NextResponse.json({ iframeSource: episode.iframeSource, title: episode.title });
}
