
import { NextResponse } from 'next/server';
import { fetchFilteredMovies, fetchCategoryPage } from '@/lib/scraper';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const cat = searchParams.get('category') || '';
  const year = searchParams.get('year') || '';
  const quality = searchParams.get('quality') || '';
  const type = searchParams.get('type') || '';
  const country = searchParams.get('country') || '';

  // If ANY filter is present, use fetchFilteredMovies
  if (cat || year || quality || type || country) {
    const data = await fetchFilteredMovies({
      category: cat,
      year,
      quality,
      type,
      country,
      page
    });
    return NextResponse.json(data);
  }

  // Use general category page if no filters
  const data = await fetchCategoryPage('movies', page);
  return NextResponse.json(data);
}
