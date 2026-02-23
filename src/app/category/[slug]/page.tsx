import { fetchCategoryPage } from '@/lib/scraper';
import styles from '../../grid.module.css';
import Link from 'next/link';
import { Play, Star } from 'lucide-react';

export const revalidate = 120;

const categoryNames: Record<string, string> = {
  'movies': 'جميع الأفلام',
  'series': 'جميع المسلسلات',
  'dubbed-movies': 'أفلام مدبلجة',
  'hindi': 'أفلام هندي',
  'asian-movies': 'أفلام آسيوية',
  'anime-movies': 'أفلام أنمي',
  'anime': 'أنمي',
  'asian-series': 'مسلسلات آسيوية',
  'recent-series': 'أحدث المسلسلات',
  'short-series': 'مسلسلات قصيرة',
  'tvshows': 'برامج تلفزيونية',
  'movies-top-imdb': 'الأعلى تقييماً IMDB',
  'movies-top-views': 'الأعلى مشاهدة',
  'episodes': 'أحدث الحلقات',
};

import QualityBadge from '../../components/QualityBadge';

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const actualPath = slug.replace('___', '/');
  const decodedPath = decodeURIComponent(actualPath);
  const items = await fetchCategoryPage(actualPath, 1);
  const rawTitle = categoryNames[slug] || decodedPath.replace('movies-cats/', 'أفلام: ').replace('series_genres/', 'مسلسلات: ');
  const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
  const proxyImg = (url: string) => `/api/proxy-image?url=${encodeURIComponent(url)}`;

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>{title}</h1>
      <div className={styles.grid}>
        {items.filter(i => i.poster).map((item, idx) => (
          <Link key={idx} href={item.link} className={styles.card}>
            <div className={styles.cardImageWrapper}>
              {item.quality && <QualityBadge quality={item.quality} className={styles.qualityBadge} />}
              {item.rating && (
                <div className="ratingBadgeOverlay">
                  <span className="imdbLogo">IMDb</span> {item.rating}
                </div>
              )}
              <img src={proxyImg(item.poster)} alt={item.title} className={styles.cardImage} loading="lazy" />
              <div className={styles.cardHoverOverlay}>
                <div className={styles.hoverTitle}>{item.title}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {items.length === 0 && (
        <div className={styles.empty}>لا توجد نتائج</div>
      )}
    </div>
  );
}
