'use client';
import Link from 'next/link';
import { Home, Film, Tv, Heart, Compass, Search } from 'lucide-react';
import styles from './BottomNav.module.css';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();

  const isAuthPage = ['/login', '/register', '/profiles/selector'].includes(pathname);
  if (isAuthPage) return null;

  return (
    <nav className={styles.bottomNav}>
      <Link href="/" className={`${styles.navItem} ${pathname === '/' ? styles.active : ''}`}>
        <Home size={22} />
        <span>الرئيسية</span>
      </Link>
      <Link href="/movies" className={`${styles.navItem} ${pathname === '/movies' ? styles.active : ''}`}>
        <Film size={22} />
        <span>أفلام</span>
      </Link>
      <Link href="/series" className={`${styles.navItem} ${pathname === '/series' ? styles.active : ''}`}>
        <Tv size={22} />
        <span>مسلسلات</span>
      </Link>
      <Link href="/favorites" className={`${styles.navItem} ${pathname === '/favorites' ? styles.active : ''}`}>
        <Heart size={22} />
        <span>المفضلة</span>
      </Link>
    </nav>
  );
}
