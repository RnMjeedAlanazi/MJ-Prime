'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './series.module.css';
import NativePlayer from '@/app/components/NativePlayer';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '@/app/context/AuthContext';
import { Play, PlayCircle, ArrowRight, Film, Star, Languages, Globe, Award, ListVideo, Heart } from 'lucide-react';
import { saveUserView, toggleFavorite, isFavorite } from '@/lib/userProfile';
import RecommendationRow from '@/app/components/RecommendationRow';
import QualityBadge from '@/app/components/QualityBadge';
import { ProgressTracker, WatchProgress } from '@/lib/progress';
import { CheckCircle2 } from 'lucide-react';

interface EpisodeItem { epTitle: string; epLink: string; }
interface SeasonData {
  title: string; story: string; poster: string;
  episodes: EpisodeItem[]; genres: { name: string; link: string }[]; year: string; rating: string;
  seasons: { title: string; link: string; poster: string; isActive?: boolean }[];
  quality?: string; status?: string; country?: string; language?: string;
  watchLevel?: string; totalEpisodes?: string; seriesId?: string;
}

export default function SeriesClient({ season, candidates }: { season: SeasonData, candidates: any[] }) {
  const { activeProfile } = useAuth();
  const [activeEp, setActiveEp] = useState<EpisodeItem | null>(null);
  const [iframeSource, setIframeSource] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [hasRedirected, setHasRedirected] = useState(false);
  const [watchedData, setWatchedData] = useState<Record<string, WatchProgress>>({});

  // Auto-play the last watched episode silently without redirecting, keeping metadata safe
  useEffect(() => {
    if (!season.seriesId || hasRedirected) return;

    const lastWatchedStr = localStorage.getItem(`last_watched_series_${season.seriesId}`);
    if (lastWatchedStr) {
      try {
        const lastWatched = JSON.parse(lastWatchedStr);
        if (lastWatched.epLink && !activeEp) {
          // Check if it belongs to the currently displayed season
          let ep = season.episodes.find(e => e.epLink === lastWatched.epLink);
          // If it's from another season, we can still play it directly without ruining the page!
          if (!ep) {
            ep = { epTitle: 'متابعة المشاهدة', epLink: lastWatched.epLink };
          }
          playEpisode(ep);
        }
      } catch (e) {}
    }
    setHasRedirected(true);
  }, [season.seriesId, hasRedirected, activeEp, season.episodes]);

  useEffect(() => {
    saveUserView(season.title, 'series', season.genres, activeProfile?.id);
    setFavorite(isFavorite(season.title, activeProfile?.id));

    // Load watch progress to show checkmarks
    ProgressTracker.getAllProgress(activeProfile?.id).then(data => {
      const map: Record<string, WatchProgress> = {};
      data.forEach(p => { map[p.mediaId] = p; });
      setWatchedData(map);
    });
  }, [season.title, season.genres, activeProfile?.id]);

  const handleFavorite = () => {
    const item = {
      title: season.title,
      link: typeof window !== 'undefined' ? window.location.pathname : '',
      poster: season.poster,
      quality: season.quality,
      rating: season.rating,
      genre: season.genres.map(g => g.name).join(', '),
      type: 'series'
    };
    setFavorite(toggleFavorite(item, activeProfile?.id));
  };

  const proxyImg = (url: string) => `/api/proxy-image?url=${encodeURIComponent(url)}`;

  const playEpisode = async (ep: EpisodeItem) => {
    setActiveEp(ep);
    setLoading(true);
    setIframeSource('');
    
    // Save the last watched marker
    if (season.seriesId) {
      const activeSeason = season.seasons?.find(s => s.isActive);
      localStorage.setItem(`last_watched_series_${season.seriesId}`, JSON.stringify({
        seasonLink: activeSeason ? activeSeason.link : window.location.pathname,
        epLink: ep.epLink
      }));
    }
    try {
      const slug = ep.epLink.replace('/episodes/', '');
      const res = await fetch(`/api/episode-iframe?slug=${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (data.iframeSource) setIframeSource(data.iframeSource);
    } catch (e) {
      console.error('Failed to load episode:', e);
    }
    setLoading(false);
  };

  // Find next episode information
  const getNextEpisodeInfo = () => {
    if (!activeEp) return undefined;
    const currentIndex = season.episodes.findIndex(ep => ep.epLink === activeEp.epLink);
    if (currentIndex !== -1 && currentIndex < season.episodes.length - 1) {
      const nextEp = season.episodes[currentIndex + 1];
      return {
        title: nextEp.epTitle,
        onPlay: () => playEpisode(nextEp)
      };
    }
    return undefined;
  };

  return (
    <div className={styles.page}>
      {/* Info Section */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className={styles.infoSection}
      >
        <div className={styles.posterSide}>
          <div style={{ position: 'relative' }}>
            {season.poster && (
              <img 
                src={proxyImg(season.poster)} 
                alt={season.title} 
                className={styles.poster} 
                decoding="async"
              />
            )}
            {season.rating && (
              <div className="ratingBadgeOverlay">
                <span className="imdbLogo">IMDb</span> {season.rating}
              </div>
            )}
          </div>
        </div>
        <div className={styles.detailSide}>
          <motion.h1 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
            className={styles.title}
          >{season.title}</motion.h1>
          
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ delay: 0.2 }} 
            className={styles.unifiedMeta}
          >
            {/* Main Info Row */}
            {/* Unified Metadata Row */}
            {/* Top Row: Quality, WatchLevel, Year, Status, Episodes */}
            <div className={styles.metaRow}>
              {season.quality && (
                <QualityBadge quality={season.quality} large />
              )}
              {season.watchLevel && (
                <span className="premiumTag" style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}>
                  {season.watchLevel}
                </span>
              )}
              {season.year && <span className="premiumTag">{season.year}</span>}
              {season.status && (
                <span className="premiumTag" style={{ 
                  color: season.status.includes('مكتمل') ? '#10b981' : '#fff',
                  borderColor: season.status.includes('مكتمل') ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.15)'
                }}>
                  {season.status}
                </span>
              )}
              {(season.totalEpisodes || season.episodes.length > 0) && (
                <span className="premiumTag">
                   {season.totalEpisodes ? `${season.totalEpisodes} حلقة` : `${season.episodes.length} حلقة`}
                </span>
              )}
            </div>
            
            {/* Bottom Row: Genres Badges separated by commas */}
            {season.genres.length > 0 && (
              <div className={styles.metaRow}>
                {season.genres.map((g, i) => (
                  <span key={i} className={styles.genreItem}>
                    <Link href={g.link} className={styles.genreBadge}>{g.name}</Link>
                    {i < season.genres.length - 1 && <span className={styles.separator}>،</span>}
                  </span>
                ))}
              </div>
            )}

            {/* Country & Language Group */}
            {(season.country || season.language) && (
              <div className={styles.metaItems}>
                {season.country && (
                  <div className={styles.clItem}>
                    <Globe size={14} color="var(--accent-cyan)" />
                    {season.country}
                  </div>
                )}
                {season.language && (
                  <div className={styles.clItem}>
                    <Languages size={14} color="var(--accent-purple)" />
                    {season.language}
                  </div>
                )}
              </div>
            )}
          </motion.div>
          
          {season.story && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className={styles.story}>
              {season.story}
            </motion.p>
          )}

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className={styles.actions}>
            {season.episodes.length > 0 && (
              <button 
                className="premiumBtn"
                onClick={() => playEpisode(season.episodes[0])}
              >
                <Play size={20} fill="currentColor" strokeWidth={2.5} /> مشاهدة الآن
              </button>
            )}
            <button 
              className={styles.favBtn} 
              onClick={handleFavorite}
              style={{ color: favorite ? '#ef4444' : '#fff', border: favorite ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.2)' }}
            >
              <Heart size={20} fill={favorite ? 'currentColor' : 'none'} /> 
              {favorite ? 'في المفضلة' : 'أضف للمفضلة'}
            </button>
          </motion.div>
        </div>
      </motion.div>

      {/* Seasons */}
      {season.seasons && season.seasons.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className={styles.seasonsSection}
        >
          <h2 className={styles.sectionTitle}><Film size={24} /> المواسم المرتبطة</h2>
          <div className={styles.seasonsPillBox}>
            {season.seasons.map((s, idx) => (
              <Link key={idx} href={s.link} className={`${styles.seasonPill} ${s.isActive ? styles.seasonPillActive : ''}`}>
                {s.title}
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* Player */}
      {activeEp && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className={styles.playerSection}
        >
          <div className={styles.playerHeader}>
            <h2 className={styles.playerTitle}>
              <PlayCircle size={24} color="var(--accent-cyan)" /> {activeEp.epTitle}
            </h2>
          </div>
          <div className={styles.playerBox}>
            {loading && <div className={styles.loadingPulse}>جاري المعالجة...</div>}
            {!loading && iframeSource && activeEp && (
                <NativePlayer 
                  iframeSource={iframeSource} 
                  nextEpisode={getNextEpisodeInfo()}
                  mediaId={`${season.title}_${activeEp.epLink.replace('/episodes/', '')}`}
                  title={`${season.title} - ${activeEp.epTitle}`}
                  type="episode"
                />
            )}
          </div>
        </motion.div>
      )}

      {/* Episodes */}
      {season.episodes.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className={styles.epSection}
        >
          <h2 className={styles.epSectionTitle}><ListVideo size={28} color="var(--accent-magenta)" /> الحلقات</h2>
          <div className={styles.epGrid}>
            {season.episodes.map((ep, idx) => (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.02 }}
                key={idx}
                className={`${styles.epCard} ${activeEp?.epLink === ep.epLink ? styles.epCardActive : ''}`}
                onClick={() => playEpisode(ep)}
              >
                <div className={styles.epNum}>{idx + 1}</div>
                <div className={styles.epName}>{ep.epTitle}</div>
                
                {/* Watch indicator */}
                {(() => {
                   const pid = `${season.title}_${ep.epLink}`;
                   const p = watchedData[pid];
                   if (p && p.currentTime / p.duration > 0.9) {
                     return <div className={styles.epWatchedIcon}><CheckCircle2 size={18} /></div>;
                   }
                   return null;
                })()}

                <div className={styles.epArrow}><PlayCircle size={22} /></div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {candidates && candidates.length > 0 && (
        <RecommendationRow 
          title="أعمال مشابهة قد تعجبك" 
          candidates={candidates} 
          baseGenres={season.genres.map(g => g.name)} 
          ignoreTitle={season.title}
        />
      )}
    </div>
  );
}
