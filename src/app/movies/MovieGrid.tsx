
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
    { name: 'أكشن', id: '11' },
    { name: 'مغامرة', id: '21' },
    { name: 'أنيميشن', id: '127' },
    { name: 'كوميديا', id: '10' },
    { name: 'جريمة', id: '54' },
    { name: 'وثائقي', id: '97' },
    { name: 'دراما', id: '16' },
    { name: 'عائلي', id: '219596' },
    { name: 'تاريخي', id: '141' },
    { name: 'رعب', id: '8' },
    { name: 'رومانسي', id: '9' },
    { name: 'غموض', id: '3612' },
    { name: 'خيال علمي', id: '2' },
    { name: 'إثارة', id: '43' },
    { name: 'حربي', id: '110' },
  ],
  years: [
    { name: 'أي سنة', id: '' },
    { name: '2025', id: '228520' },
    { name: '2024', id: '214282' },
    { name: '2023', id: '198151' },
    { name: '2022', id: '24962' },
    { name: '2021', id: '17938' },
    { name: '2020', id: '14061' },
    { name: '2019', id: '12701' },
    { name: '2018', id: '8198' },
    { name: '2017', id: '3577' },
    { name: '2016', id: '170' },
    { name: '2015', id: '3' },
  ],
  qualities: [
    { name: 'الكل', id: '' },
    { name: '1080p fhd', id: '6382' },
    { name: '720p hd', id: '6383' },
    { name: '480p sd', id: '6384' },
    { name: 'Bluray', id: '4' },
  ],
  types: [
    { name: 'الكل', id: '' },
    { name: 'مترجم', id: '2' },
    { name: 'مدبلج', id: '3' },
  ],
  countries: [
    { name: 'أي دولة', id: '' },
    { name: 'أمريكا', id: '10719' },
    { name: 'مصر', id: '10861' },
    { name: 'فرنسا', id: '10740' },
    { name: 'بريطانيا', id: '10737' },
    { name: 'كوريا الجنوبية', id: '10786' },
    { name: 'اليابان', id: '10769' },
    { name: 'الهند', id: '10734' },
  ]
};

const proxyImg = (url: string) => `/api/proxy-image?url=${encodeURIComponent(url)}`;

export default function MovieGrid({ initialData }: { initialData: MediaItem[] }) {
  const [items, setItems] = useState<MediaItem[]>(initialData);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  // Filters
  const [category, setCategory] = useState('');
  const [year, setYear] = useState('');
  const [quality, setQuality] = useState('');
  const [type, setType] = useState('');
  const [country, setCountry] = useState('');

  const loaderRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(false);

  const fetchItems = useCallback(async (pageNum: number, currentFilters: any, reset = false) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        page: pageNum.toString(),
        category: currentFilters.category,
        year: currentFilters.year,
        quality: currentFilters.quality,
        type: currentFilters.type,
        country: currentFilters.country,
      });
      
      const res = await fetch(`/api/movies?${q.toString()}`);
      const data = await res.json();
      
      if (data.length === 0) {
        setHasMore(false);
      } else {
        setItems(prev => reset ? data : [...prev, ...data]);
      }
    } catch (err) {
      console.error('Failed to fetch movies:', err);
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
    
    setItems([]);
    setPage(1);
    setHasMore(true);
    fetchItems(1, { category, year, quality, type, country }, true);
  }, [category, year, quality, type, country, fetchItems]);

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchItems(nextPage, { category, year, quality, type, country });
      }
    }, { threshold: 0.1 });

    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, page, category, year, quality, type, country, fetchItems]);

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>جميع الأفلام</h1>

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
          <label>السنة</label>
          <div className={styles.selectWrap}>
            <select value={year} onChange={e => setYear(e.target.value)}>
              {FILTER_OPTIONS.years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
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
          <label>المحتوى</label>
          <div className={styles.selectWrap}>
            <select value={type} onChange={e => setType(e.target.value)}>
              {FILTER_OPTIONS.types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <ChevronDown size={16} />
          </div>
        </div>

        <div className={styles.filterGroup}>
          <label>الدولة</label>
          <div className={styles.selectWrap}>
            <select value={country} onChange={e => setCountry(e.target.value)}>
              {FILTER_OPTIONS.countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown size={16} />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className={styles.grid}>
        {items.filter(m => m.poster).map((movie, idx) => (
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
