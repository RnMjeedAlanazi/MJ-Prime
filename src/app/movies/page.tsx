import { fetchCategoryPage } from '@/lib/scraper';
import styles from '../grid.module.css';
import Link from 'next/link';
import { Play } from 'lucide-react';

export const revalidate = 60;

import QualityBadge from '../components/QualityBadge';

export default async function MoviesPage() {
  const movies = await fetchCategoryPage('movies', 1);
  const proxyImg = (url: string) => `/api/proxy-image?url=${encodeURIComponent(url)}`;

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>جميع الأفلام</h1>
      <div className={styles.grid}>
        {movies.filter(m => m.poster).map((movie, idx) => (
          <Link key={idx} href={movie.link} className={styles.card}>
            <div className={styles.cardImageWrapper}>
              {movie.quality && <QualityBadge quality={movie.quality} className={styles.qualityBadge} />}
              {movie.rating && (
                <div className="ratingBadgeOverlay">
                  <span className="imdbLogo">IMDb</span> {movie.rating}
                </div>
              )}
              <img src={proxyImg(movie.poster)} alt={movie.title} className={styles.cardImage} loading="lazy" />
              <div className={styles.cardHoverOverlay}>
                <div className={styles.hoverTitle}>{movie.title}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
