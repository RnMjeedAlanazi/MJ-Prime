
import { fetchCategoryPage } from '@/lib/scraper';
import SeriesGrid from './SeriesGrid';

export const revalidate = 60;

export default async function SeriesPage() {
  const initialData = await fetchCategoryPage('series', 1);

  return (
    <SeriesGrid initialData={initialData} />
  );
}
