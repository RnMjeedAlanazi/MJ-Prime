'use client';
import { useRef } from 'react';
import Link from 'next/link';
import { Star, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import styles from '../page.module.css';

interface MediaItem { title: string; link: string; poster: string; quality: string; rating: string; views: string; genre: string; }

import QualityBadge from './QualityBadge';

const proxyImg = (url: string) => `/api/proxy-image?url=${encodeURIComponent(url)}`;

export default function Row({ title, link, items, numbered }: {
  title: string; link?: string; items: MediaItem[]; numbered?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const filtered = items.filter(i => i.poster);
  if (filtered.length === 0) return null;

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 680;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <section className={styles.section}>
      <div className={styles.secHead}>
        <h2 className={styles.secTitle}>{title}</h2>
        <div className={styles.secActions}>
          <button className={styles.scrollBtn} onClick={() => scroll('right')} aria-label="السابق">
            <ChevronRight size={20} />
          </button>
          <button className={styles.scrollBtn} onClick={() => scroll('left')} aria-label="التالي">
            <ChevronLeft size={20} />
          </button>
          {link && <Link href={link} className={styles.secMore}>عرض الكل</Link>}
        </div>
      </div>
      <div className={styles.scrollWrap}>
        <div className={styles.scroll} ref={scrollRef}>
          {filtered.map((item, i) => (
            <Link key={i} href={item.link} className={styles.card}>
              <div className={styles.cardImgWrap}>
                {numbered && <div className={styles.cardNum}>{i + 1}</div>}
                {item.quality && <QualityBadge quality={item.quality} className={styles.cardBadge} />}
                {item.rating && (
                  <div className="ratingBadgeOverlay">
                    <span className="imdbLogo">IMDb</span> {item.rating}
                  </div>
                )}
                <img alt={item.title} className={styles.cardImg} loading="lazy" src={proxyImg(item.poster)} />
                {item.views && (
                  <span className={styles.cardViews}>
                    <Eye size={12} /> {item.views}
                  </span>
                )}
                <div className={styles.cardGlow}>
                  <div className={styles.hoverTitle}>{item.title}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
