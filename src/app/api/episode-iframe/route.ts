import { fetchEpisodeDetails } from '@/lib/scraper';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

  const episode = await fetchEpisodeDetails(slug);
  if (!episode) return NextResponse.json({ error: 'Episode not found' }, { status: 404 });

  return NextResponse.json({ iframeSource: episode.iframeSource, title: episode.title });
}
