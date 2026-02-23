'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from '../layout.module.css';

export default function NavBar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handle = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handle, { passive: true });
    return () => window.removeEventListener('scroll', handle);
  }, []);

  return (
    <nav
      className={styles.navbar}
      style={scrolled ? {
        top: '16px',
        width: '90%',
        maxWidth: '1200px',
        left: '50%',
        right: 'auto',
        transform: 'translateX(-50%)',
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--border-glass)',
        borderRadius: 'var(--pill-radius)',
        boxShadow: 'var(--shadow-glass)',
      } : {
        top: '0',
        width: '100%',
        maxWidth: '100%',
        left: '0',
        right: '0',
        transform: 'none',
        background: 'rgba(3, 0, 20, 0.95)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: '0',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        boxShadow: 'none',
      }}
    >
      <div className={styles.navContent}>
        <Link href="/" className={styles.logo}>MJ<span className={styles.logoAccent}>Prime</span></Link>
        <div className={styles.navLinks}>
          <Link href="/" className={styles.navLink}>الرئيسية</Link>
          <Link href="/movies" className={styles.navLink}>أفلام</Link>
          <Link href="/series" className={styles.navLink}>مسلسلات</Link>
          <Link href="/category/anime" className={styles.navLink}>أنمي</Link>
          <Link href="/category/asian-series" className={styles.navLink}>آسيوي</Link>
          <Link href="/favorites" className={styles.navLink}>المفضلة</Link>
        </div>
        <div className={styles.navRight}>
          <button className={styles.searchBtn} aria-label="Search">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}
