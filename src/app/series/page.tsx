import { fetchCategoryPage } from '@/lib/scraper';
import styles from '../grid.module.css';
import Link from 'next/link';
import { Play } from 'lucide-react';

export const revalidate = 60;

import QualityBadge from '../components/QualityBadge';

export default async function SeriesPage() {
  const series = await fetchCategoryPage('series', 1);
  const proxyImg = (url: string) => `/api/proxy-image?url=${encodeURIComponent(url)}`;

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>جميع المسلسلات</h1>
      <div className={styles.grid}>
        {series.filter(s => s.poster).map((show, idx) => (
          <Link key={idx} href={show.link} className={styles.card}>
            <div className={styles.cardImageWrapper}>
              {show.quality && <QualityBadge quality={show.quality} className={styles.qualityBadge} />}
              {show.rating && (
                <div className="ratingBadgeOverlay">
                  <span className="imdbLogo">IMDb</span> {show.rating}
                </div>
              )}
              <img src={proxyImg(show.poster)} alt={show.title} className={styles.cardImage} loading="lazy" />
              <div className={styles.cardHoverOverlay}>
                <div className={styles.hoverTitle}>{show.title}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
