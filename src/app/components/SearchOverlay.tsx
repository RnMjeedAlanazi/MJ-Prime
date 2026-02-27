
'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Film, Tv, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import styles from './searchOverlay.module.css';
import { MediaItem } from '@/lib/scraper';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      document.body.style.overflow = 'auto';
      setQuery('');
      setResults([]);
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data);
      } catch (e) {
        console.error('Search failed:', e);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={styles.overlay}
        >
          <div className={styles.searchHeader}>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close search">
              <X size={24} />
            </button>
            
            <div className={styles.searchInputWrapper}>
              <Search className={styles.searchIcon} size={22} />
              <input 
                ref={inputRef}
                type="text" 
                placeholder="ابحث عن أفلام، مسلسلات، أنمي..." 
                className={styles.input}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.resultsArea}>
            {loading ? (
              <div className={styles.loaderWrap}>
                <div className={styles.spinner} />
                <p>جاري البحث في قاعدة البيانات...</p>
              </div>
            ) : results.length > 0 ? (
              <div className={styles.grid}>
                {results.map((item, idx) => (
                  <Link href={item.link} key={idx} onClick={onClose}>
                    <motion.div 
                      initial={{ opacity: 0, y: 15 }} 
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                      className={styles.resultCard}
                    >
                      <img 
                        src={`/api/proxy-image?url=${encodeURIComponent(item.poster || '')}`} 
                        alt={item.title} 
                        className={styles.poster} 
                        loading="lazy"
                      />
                      <div className={styles.cardOverlay}>
                        <h3 className={styles.cardTitle}>{item.title}</h3>
                        <div className={styles.cardMeta}>
                          {item.type === 'movie' ? 'فيلم' : 'مسلسل'}
                        </div>
                      </div>
                    </motion.div>
                  </Link>
                ))}
              </div>
            ) : query.trim() ? (
              <div className={styles.emptyState}>
                <Sparkles size={48} style={{opacity: 0.3, marginBottom: 15}} />
                <p>لم نجد نتائج لـ "{query}"</p>
                <p style={{fontSize: 14, marginTop: 5}}>تأكد من كتابة الاسم بشكل صحيح</p>
              </div>
            ) : (
              <div className={styles.emptyState}>
                <Search size={48} style={{opacity: 0.2, marginBottom: 15}} />
                <p>اكتب اسم العمل للبدء</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
