
import { searchMedia } from '@/lib/scraper';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const page = parseInt(searchParams.get('page') || '1');

  if (!query) return NextResponse.json([]);

  const results = await searchMedia(query, page);
  return NextResponse.json(results);
}
