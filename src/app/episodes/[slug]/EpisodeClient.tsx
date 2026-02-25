'use client';
import { useState, useEffect } from 'react';
import styles from '../../series/[slug]/series.module.css';
import NativePlayer from '@/app/components/NativePlayer';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Play, PlayCircle, ArrowRight, Film, Star, Languages, Globe, ListVideo, Heart } from 'lucide-react';
import { saveUserView, toggleFavorite, isFavorite } from '@/lib/userProfile';
import RecommendationRow from '@/app/components/RecommendationRow';
import QualityBadge from '@/app/components/QualityBadge';

interface EpisodeDetails {
  title: string; story: string; poster: string; iframeSource: string;
  genres: { name: string; link: string }[]; year: string; rating: string; duration: string; quality: string;
  episodes?: { epTitle: string; epLink: string }[];
  seasons?: { title: string; link: string; poster: string; isActive?: boolean }[];
  seriesId?: string;
}

export default function EpisodeClient({ episode, currentSlug, candidates }: { episode: EpisodeDetails; currentSlug: string; candidates?: any[] }) {
  const [iframeSource, setIframeSource] = useState<string>(episode.iframeSource || '');
  const [activeEpLink, setActiveEpLink] = useState<string>(decodeURIComponent(currentSlug));
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    saveUserView(episode.title, 'episode', episode.genres);
    setFavorite(isFavorite(episode.title));
  }, [episode.title, episode.genres]);

  const handleFavorite = () => {
    const item = {
      title: episode.title,
      link: typeof window !== 'undefined' ? window.location.pathname : '',
      poster: episode.poster,
      quality: episode.quality,
      rating: episode.rating,
      genre: episode.genres.map(g => g.name).join(', '),
      type: 'episode'
    };
    setFavorite(toggleFavorite(item));
  };

  const proxyImg = (url: string) => `/api/proxy-image?url=${encodeURIComponent(url)}`;

  const playEpisode = async (epLink: string) => {
    const slug = epLink.replace('/episodes/', '');
    setActiveEpLink(slug);
    setLoadingSlug(slug);
    setIframeSource('');
    try {
      const res = await fetch(`/api/episode-iframe?slug=${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (data.iframeSource) setIframeSource(data.iframeSource);
    } catch (e) {
      console.error('Failed to load episode:', e);
    }
    setLoadingSlug(null);
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
            {episode.poster && <img src={proxyImg(episode.poster)} alt={episode.title} className={styles.poster} />}
            {episode.rating && (
              <div className="ratingBadgeOverlay">
                <span className="imdbLogo">IMDb</span> {episode.rating}
              </div>
            )}
          </div>
        </div>
        <div className={styles.detailSide}>
          <motion.h1
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
            className={styles.title}
          >{episode.title}</motion.h1>

          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} 
            className={styles.unifiedMeta}
          >
            {/* Top Row: Quality, Rating, Year, Episodes count */}
            <div className={styles.metaRow}>
              {episode.quality && (
                <QualityBadge quality={episode.quality} large />
              )}
              {episode.year && <span className="premiumTag">{episode.year}</span>}
              {episode.episodes && episode.episodes.length > 0 && (
                <span className="premiumTag">
                   {episode.episodes.length} حلقة
                </span>
              )}
            </div>

            {/* Bottom Row: Genres Badges separated by commas */}
            {episode.genres.length > 0 && (
              <div className={styles.metaRow}>
                {episode.genres.map((g, i) => (
                  <span key={i} className={styles.genreItem}>
                    <Link href={g.link} className={styles.genreBadge}>{g.name}</Link>
                    {i < episode.genres.length - 1 && <span className={styles.separator}>،</span>}
                  </span>
                ))}
              </div>
            )}
          </motion.div>

          {episode.story && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className={styles.story}>
              {episode.story}
            </motion.p>
          )}

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className={styles.actions}>
            <button 
              className="premiumBtn"
              onClick={() => playEpisode(activeEpLink)}
            >
              <Play size={20} fill="currentColor" strokeWidth={2.5} /> مشاهدة الحلقة
            </button>
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
      {episode.seasons && episode.seasons.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className={styles.seasonsSection}
        >
          <h2 className={styles.sectionTitle}><Film size={24} /> المواسم المرتبطة</h2>
          <div className={styles.seasonsPillBox}>
            {episode.seasons.map((s, idx) => (
              <Link key={idx} href={s.link} className={`${styles.seasonPill} ${s.isActive ? styles.seasonPillActive : ''}`}>
                {s.title}
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* Player */}
      {iframeSource && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className={styles.playerSection}
        >
          <div className={styles.playerHeader}>
            <h2 className={styles.playerTitle}>
              <PlayCircle size={24} color="var(--accent-cyan)" /> مشاهدة الحلقة
            </h2>
          </div>
          <div className={styles.playerBox}>
            <NativePlayer 
              iframeSource={iframeSource} 
              mediaId={`${episode.title}_${activeEpLink}`}
              title={`${episode.title}`}
              type="episode"
              nextEpisode={(() => {
                if (!episode.episodes) return undefined;
                const idx = episode.episodes.findIndex(ep => 
                  decodeURIComponent(ep.epLink.replace('/episodes/', '')) === decodeURIComponent(activeEpLink)
                );
                const next = idx !== -1 && idx < episode.episodes.length - 1 ? episode.episodes[idx + 1] : null;
                return next ? {
                  title: next.epTitle,
                  onPlay: () => playEpisode(next.epLink)
                } : undefined;
              })()}
            />
          </div>
        </motion.div>
      )}


      {/* Episodes */}
      {episode.episodes && episode.episodes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className={styles.epSection}
        >
          <h2 className={styles.epSectionTitle}><ListVideo size={28} color="var(--accent-magenta)" /> الحلقات</h2>
          <div className={styles.epGrid}>
            {(episode.episodes || []).map((ep, idx) => (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.02 }}
                key={idx}
                className={`${styles.epCard} ${decodeURIComponent(ep.epLink.replace('/episodes/', '')) === decodeURIComponent(activeEpLink) ? styles.epCardActive : ''}`}
                onClick={() => playEpisode(ep.epLink)}
              >
                <div className={styles.epNum}>{idx + 1}</div>
                <div className={styles.epName}>{ep.epTitle}</div>
                <div className={styles.epArrow}>
                  {loadingSlug === ep.epLink.replace('/episodes/', '') 
                    ? <span style={{fontSize: 12}}>...</span>
                    : <PlayCircle size={22} />}
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {candidates && candidates.length > 0 && (
        <RecommendationRow 
          title="أعمال مشابهة قد تعجبك" 
          candidates={candidates} 
          baseGenres={episode.genres.map(g => g.name)} 
          ignoreTitle={episode.title}
        />
      )}
    </div>
  );
}
