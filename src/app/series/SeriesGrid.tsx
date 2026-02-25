
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ChevronDown, Loader2 } from 'lucide-react';
import styles from '../grid.module.css';
import QualityBadge from '../components/QualityBadge';

interface MediaItem {
  title: string;
  link: string;
  poster: string;
  quality: string;
  rating: string;
  views: string;
  genre: string;
  type: string;
}

const FILTER_OPTIONS = {
  categories: [
    { name: 'الكل', id: '' },
    { name: 'أكشن', id: '10717' },
    { name: 'جريمة', id: '10714' },
    { name: 'دراما', id: '10715' },
    { name: 'غموض', id: '10721' },
    { name: 'رعب', id: '10729' },
    { name: 'خيال علمي', id: '10726' },
    { name: 'كوميديا', id: '10725' },
    { name: 'رومانسي', id: '10731' },
    { name: 'تاريخي', id: '10727' },
    { name: 'حربي', id: '10748' },
    { name: 'وثائقي', id: '10746' },
    { name: 'عائلي', id: '10712' },
    { name: 'رسوم متحركة', id: '10724' },
    { name: 'مغامرة', id: '10718' },
    { name: 'تشويق', id: '10730' },
  ],
  qualities: [
    { name: 'الكل', id: '' },
    { name: '1080p fhd', id: '6382' },
    { name: '720p hd', id: '6383' },
    { name: '480p sd', id: '6384' },
  ],
  statuses: [
    { name: 'الكل', id: '' },
    { name: 'مستمر', id: '2381' },
    { name: 'منتهي', id: '2382' },
  ],
  types: [
    { name: 'الكل', id: '' },
    { name: 'TV-MA', id: '2374' },
    { name: 'TV-14', id: '2901' },
    { name: 'TV-PG', id: '2921' },
    { name: 'G', id: '14675' },
    { name: 'PG', id: '14676' },
    { name: 'PG-13', id: '252' },
    { name: 'R', id: '253' },
    { name: '+18', id: '1452' },
    { name: 'جميع الأعمار', id: '73' },
  ]
};

const proxyImg = (url: string) => `/api/proxy-image?url=${encodeURIComponent(url)}`;

export default function SeriesGrid({ initialData }: { initialData: MediaItem[] }) {
  const [items, setItems] = useState<MediaItem[]>(initialData);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  // Filters
  const [category, setCategory] = useState('');
  const [quality, setQuality] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');

  const loaderRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(false);

  const fetchItems = useCallback(async (pageNum: number, currentFilters: any, reset = false) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        page: pageNum.toString(),
        category: currentFilters.category,
        quality: currentFilters.quality,
        status: currentFilters.status,
        type: currentFilters.type,
      });
      
      const res = await fetch(`/api/series?${q.toString()}`);
      const data = await res.json();
      
      if (data.length === 0) {
        setHasMore(false);
      } else {
        setItems(prev => reset ? data : [...prev, ...data]);
      }
    } catch (err) {
      console.error('Failed to fetch series:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle filter changes
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    
    // Reset and fetch
    setItems([]);
    setPage(1);
    setHasMore(true);
    fetchItems(1, { category, quality, status, type }, true);
  }, [category, quality, status, type, fetchItems]);

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchItems(nextPage, { category, quality, status, type });
      }
    }, { threshold: 0.1 });

    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, page, category, quality, status, type, fetchItems]);

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>جميع المسلسلات</h1>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <label>التصنيف</label>
          <div className={styles.selectWrap}>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {FILTER_OPTIONS.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown size={16} />
          </div>
        </div>

        <div className={styles.filterGroup}>
          <label>الجودة</label>
          <div className={styles.selectWrap}>
            <select value={quality} onChange={e => setQuality(e.target.value)}>
              {FILTER_OPTIONS.qualities.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
            </select>
            <ChevronDown size={16} />
          </div>
        </div>

        <div className={styles.filterGroup}>
          <label>الحالة</label>
          <div className={styles.selectWrap}>
            <select value={status} onChange={e => setStatus(e.target.value)}>
              {FILTER_OPTIONS.statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <ChevronDown size={16} />
          </div>
        </div>

        <div className={styles.filterGroup}>
          <label>المحتوى</label>
          <div className={styles.selectWrap}>
            <select value={type} onChange={e => setType(e.target.value)}>
              {FILTER_OPTIONS.types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <ChevronDown size={16} />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className={styles.grid}>
        {items.filter(s => s.poster).map((show, idx) => (
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

        {items.length === 0 && !loading && (
          <div className={styles.empty}>لا توجد نتائج تطابق هذه الفلاتر</div>
        )}
      </div>

      {/* Loader for Infinite Scroll */}
      <div ref={loaderRef} className={styles.loaderContainer}>
        {loading && (
          <div className={styles.loadingSpinner}>
            <Loader2 className={styles.spin} />
            <span>جاري تحميل المزيد...</span>
          </div>
        )}
        {!hasMore && items.length > 0 && <div className={styles.endReached}>نهاية القائمة</div>}
      </div>
    </div>
  );
}
