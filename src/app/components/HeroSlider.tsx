'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Play, Info } from 'lucide-react';
import styles from '../page.module.css';
import QualityBadge from './QualityBadge';

interface MediaItem {
  title: string;
  link: string;
  poster: string;
  quality: string;
  rating: string;
  views: string;
  genre: string;
}

const proxyImg = (url: string) => `/api/proxy-image?url=${encodeURIComponent(url)}`;

export default function HeroSlider({ items }: { items: MediaItem[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [items.length]);

  if (!items || items.length === 0) return <div style={{height: 100}} />;

  const hero = items[currentIndex];

  return (
    <section className={styles.hero}>
      
      {/* BACKGROUND IMAGE */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`bg-${hero.link}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          style={{ position: 'absolute', inset: 0, zIndex: 0 }}
        >
          <img src={proxyImg(hero.poster)} alt="" className={styles.heroImg} aria-hidden="true" />
        </motion.div>
      </AnimatePresence>
      <div className={styles.heroFade} />

      <AnimatePresence mode="wait">
        <motion.div 
          key={`inner-${hero.link}`}
          className={styles.heroInner} 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.6 }}
        >
          {/* POSTER CARD */}
          <div className={styles.heroPosterWrap}>
            <img src={proxyImg(hero.poster)} alt={hero.title} className={styles.heroPoster} />
          </div>

          {/* DETAILS */}
          <div className={styles.heroBody}>
            <h1 className={styles.heroTitle}> {hero.title} </h1>
            
            <div className={styles.heroTags}>
              {hero.quality && (
                <QualityBadge quality={hero.quality} large />
              )}
              {hero.rating && (
                <div className="premiumTag" style={{ color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.4)' }}>
                  <span className="imdbLogo" style={{ fontSize: '8px', padding: '1px 3px' }}>IMDb</span>
                  <span style={{ fontWeight: 800 }}>{hero.rating}</span>
                </div>
              )}
              {hero.genre && (
                <span className="premiumTag">
                  {hero.genre.split(',')[0]}
                </span>
              )}
            </div>

            <div className={styles.heroBtns}>
              <Link href={hero.link}>
                <button className="premiumBtn">
                  <Play size={20} fill="currentColor" strokeWidth={2.5} /> شاهد الآن
                </button>
              </Link>
              <Link href={hero.link}>
                <button className="premiumBtn" style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <Info size={20} /> تفاصيل
                </button>
              </Link>
            </div>

            {/* DOTS */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '40px', justifyContent: 'center' }}>
              {items.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  style={{
                    width: idx === currentIndex ? '35px' : '10px',
                    height: '4px',
                    borderRadius: '2px',
                    background: idx === currentIndex ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.2)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.4s ease',
                    padding: 0
                  }}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
