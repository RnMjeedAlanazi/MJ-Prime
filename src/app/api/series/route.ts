
import { NextResponse } from 'next/server';
import { fetchFilteredSeries, fetchCategoryPage } from '@/lib/scraper';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const cat = searchParams.get('category') || '';
  const quality = searchParams.get('quality') || '';
  const status = searchParams.get('status') || '';
  const type = searchParams.get('type') || '';

  // If ANY filter is present, use fetchFilteredSeries
  if (cat || quality || status || type) {
    const data = await fetchFilteredSeries({
      category: cat,
      quality,
      status,
      type,
      page
    });
    return NextResponse.json(data);
  }

  // Use general category page if no filters
  const data = await fetchCategoryPage('series', page);
  return NextResponse.json(data);
}
