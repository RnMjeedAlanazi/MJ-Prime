'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from '../layout.module.css';
import { useAuth } from '../context/AuthContext';
import ProfileSelector from './ProfileSelector';
import { auth } from '@/lib/firebase';
import { User, Settings as SettingsIcon, LogOut, Plus, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, usePathname } from 'next/navigation';
import SearchOverlay from './SearchOverlay';

export default function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const { user, activeProfile, setActiveProfile } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handle = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handle, { passive: true });
    return () => window.removeEventListener('scroll', handle);
  }, []);

  const isAuthPage = ['/login', '/register', '/profiles/selector'].includes(pathname);
  if (isAuthPage) return null;

  return (
    <>
    <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
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
        <Link href="/" className={styles.logo}>بوس <span className={styles.logoAccent}>الواوا</span></Link>
        <div className={styles.navLinks}>
          <Link href="/" className={styles.navLink}>الرئيسية</Link>
          <Link href="/movies" className={styles.navLink}>أفلام</Link>
          <Link href="/series" className={styles.navLink}>مسلسلات</Link>
          <Link href="/category/anime" className={styles.navLink}>أنمي</Link>
          <Link href="/category/asian-series" className={styles.navLink}>آسيوي</Link>
          <Link href="/favorites" className={styles.navLink}>المفضلة</Link>
        </div>
        <div className={styles.navRight}>
          <button 
            className={styles.searchBtn} 
            aria-label="Search"
            onClick={() => setIsSearchOpen(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>

          {activeProfile && (
            <div style={{ position: 'relative' }}>
              <button 
                className={styles.profileToggle} 
                onClick={() => setShowDropdown(!showDropdown)}
              >
                <img src={activeProfile.avatar} alt={activeProfile.name} />
              </button>
              
              <AnimatePresence>
                {showDropdown && (
                   <motion.div 
                     initial={{ opacity: 0, y: 15, scale: 0.95 }} 
                     animate={{ opacity: 1, y: 0, scale: 1 }} 
                     exit={{ opacity: 0, y: 15, scale: 0.95 }}
                     className={styles.profileDropdown}
                   >
                      <div className={styles.dropdownProfileInfo}>
                         <div className={styles.dropAvatarWrap}>
                            <img src={activeProfile.avatar} alt={activeProfile.name} />
                         </div>
                         <div className={styles.dropText}>
                            <span className={styles.dropName}>{activeProfile.name}</span>
                            <span className={styles.dropSub}>تعديل البيانات</span>
                         </div>
                      </div>

                      <div className={styles.dropdownBody}>
                        <Link href="/profiles" className={styles.dropdownItem} onClick={() => setShowDropdown(false)}>
                          <div className={styles.dropIcon}><User size={18} /></div>
                          <span>ملفي المشاهدة</span>
                        </Link>
                        <Link href="/settings" className={styles.dropdownItem} onClick={() => setShowDropdown(false)}>
                          <div className={styles.dropIcon}><SettingsIcon size={18} /></div>
                          <span>إعدادات النظام</span>
                        </Link>
                        
                        <div className={styles.dropDivider} />

                         <button 
                           className={styles.dropdownItem} 
                           onClick={() => { 
                             setActiveProfile(null); 
                             setShowDropdown(false);
                             window.location.href = '/profiles/selector';
                           }}
                         >
                           <div className={styles.dropIcon}><Users size={18} /></div>
                           <span>تبديل البروفايل</span>
                         </button>
                      </div>

                      <div className={styles.dropdownFooter}>
                        <button 
                          className={styles.logoutAction} 
                          onClick={() => { auth.signOut(); setActiveProfile(null); setShowDropdown(false); }}
                        >
                          <LogOut size={16} /> تسجيل الخروج
                        </button>
                      </div>
                   </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </nav>
    </>
  );
}
