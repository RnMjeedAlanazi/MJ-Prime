'use client';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { ProgressTracker, WatchProgress } from '@/lib/progress';
import { ChevronLeft, ChevronRight, Play, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import styles from '../page.module.css';
import { motion, AnimatePresence } from 'framer-motion';

const proxyImg = (url: string) => `/api/proxy-image?url=${encodeURIComponent(url)}`;

export default function ContinueWatching() {
  const { user, activeProfile } = useAuth();
  const [progressList, setProgressList] = useState<WatchProgress[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadProgress = async () => {
      if (!activeProfile?.id) return;
      const data = await ProgressTracker.getAllProgress(activeProfile.id);
      
      // Filter out items that are nearly finished (>95%) and sort by lastUpdated
      const filtered = data
        .filter(p => p.duration > 0 && (p.currentTime / p.duration) < 0.95)
        .sort((a, b) => b.lastUpdated - a.lastUpdated)
        .slice(0, 15);
      setProgressList(filtered);
    };
    loadProgress();
  }, [activeProfile?.id]);

  if (progressList.length === 0) return null;

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 300;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <section className={styles.section} style={{ paddingBottom: '0px' }}>
      <div className={styles.secHead}>
        <h2 className={styles.secTitle}>تابع المشاهدة</h2>
        <div className={styles.secActions}>
          <button className={styles.scrollBtn} onClick={() => scroll('right')}><ChevronRight size={20} /></button>
          <button className={styles.scrollBtn} onClick={() => scroll('left')}><ChevronLeft size={20} /></button>
        </div>
      </div>

      <div className={styles.scrollWrap}>
        <div className={styles.scroll} ref={scrollRef}>
          {progressList.map((item, idx) => {
             // We need to guess the link if not in progress.
             // In current app, mediaId is used as slug often or composite.
             // Let's assume the mediaId for movies is the slug, 
             // and for episodes it's "Title_EpLink".
             // We'll try to find the link from title or composite.
             let link = '#';
             if (item.type === 'movie') {
               link = `/movies/${item.mediaId.replace(/\s+/g, '-').toLowerCase()}`;
             } else {
               // For episodes, we store epLink in the mediaId suffix usually.
               const parts = item.mediaId.split('_');
               if (parts.length > 1) link = parts[parts.length-1];
             }

             const progressPercent = (item.currentTime / item.duration) * 100;

             return (
               <Link key={idx} href={link} className={styles.continueCard}>
                  <div className={styles.continuePosterWrapper}>
                    {/* Cloud Pending Warning Icon */}
                    {item._isPending && !item._inCloud && (
                      <div className={styles.cloudPendingBadge} title="بانتظار المزامنة مع السحاب (شاهد أكثر للمزامنة)">
                        <AlertCircle size={14} />
                      </div>
                    )}

                    {/* Progress Bar under poster */}
                    <div className={styles.progressTrack}>
                      <div 
                        className={styles.progressFill} 
                        style={{ width: `${progressPercent}%` }} 
                      />
                    </div>
                    
                    <div className={styles.continueOverlay}>
                      <Play size={24} fill="white" />
                    </div>
                    
                    {/* Episode/Season info overlay */}
                    <div className={styles.continueText}>
                      <div className={styles.continueTitle}>{item.title}</div>
                      <div className={styles.continueSeason}>
                        متابعة {item.type === 'episode' ? 'الحلقة' : 'الفيلم'}
                      </div>
                    </div>
                  </div>
               </Link>
             );
          })}
        </div>
      </div>
    </section>
  );
}
