
import { fetchCategoryPage } from '@/lib/scraper';
import MovieGrid from './MovieGrid';

export const revalidate = 60;

export default async function MoviesPage() {
  const initialData = await fetchCategoryPage('movies', 1);

  return (
    <MovieGrid initialData={initialData} />
  );
}
