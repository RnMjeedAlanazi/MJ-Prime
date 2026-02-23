'use client';
import { useEffect, useState } from 'react';
import { getFavorites } from '@/lib/userProfile';
import styles from '../grid.module.css';
import Link from 'next/link';
import { Star, HeartCrack } from 'lucide-react';
import { motion } from 'framer-motion';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<any[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setFavorites(getFavorites());
  }, []);

  const proxyImg = (url: string) => `/api/proxy-image?url=${encodeURIComponent(url)}`;

  if (!isClient) return <div style={{ minHeight: '100vh', background: 'var(--bg-dark)' }} />;

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        المفضلة <span style={{fontSize: 16, color: 'var(--text-secondary)', fontWeight: 400}}>({favorites.length} أعمال)</span>
      </h1>
      
      {favorites.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', textAlign: 'center' }}>
          <HeartCrack size={64} color="var(--accent-purple)" style={{ marginBottom: 20, opacity: 0.5 }} />
          <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Almarai, sans-serif', color: '#fff', marginBottom: 10 }}>قائمتك المفضلة فارغة</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16, fontFamily: 'Almarai, sans-serif' }}>قم بتصفح الأفلام والمسلسلات وأضف ما يعجبك هنا للرجوع إليه لاحقاً.</p>
          <Link href="/movies" style={{ marginTop: 20 }}>
            <button className={styles.btnPrimary} style={{ padding: '12px 30px', borderRadius: 30, border: 'none', background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))', color: '#fff', fontWeight: 800, cursor: 'pointer', fontFamily: 'Almarai, sans-serif', fontSize: 15 }}>
              تصفح الأفلام
            </button>
          </Link>
        </div>
      ) : (
        <div className={styles.grid}>
          {favorites.map((item, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Link href={item.link} className={styles.card}>
                <div className={styles.cardImageWrapper}>
                  {item.quality && <span className={styles.qualityBadge}>{item.quality}</span>}
                  {item.rating && <span className={styles.ratingBadge}><Star size={11} fill="currentColor" style={{display:'inline', marginBottom:'-2px'}}/> {item.rating}</span>}
                  <img src={proxyImg(item.poster)} alt={item.title} className={styles.cardImage} loading="lazy" />
                  <div className={styles.cardHoverOverlay}>
                    <div className={styles.hoverTitle}>{item.title}</div>
                    <div className={styles.hoverGenre} style={{ fontSize: 11, color: '#aaa', marginTop: 5 }}>{item.genre}</div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
