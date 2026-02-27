'use client';
import { useState, useEffect } from 'react';
import styles from './movieClient.module.css';
import NativePlayer from '@/app/components/NativePlayer';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/app/context/AuthContext';
import { Play, X, Star, Clock, ArrowRight, Heart, Film, Award } from 'lucide-react';
import { saveUserView, toggleFavorite, isFavorite } from '@/lib/userProfile';
import RecommendationRow from '@/app/components/RecommendationRow';
import QualityBadge from '@/app/components/QualityBadge';

interface MovieDetails {
  title: string; story: string; poster: string; iframeSource: string;
  genres: { name: string; link: string }[]; year: string; rating: string; duration: string; quality: string;
}

export default function MovieClient({ movie, candidates }: { movie: MovieDetails, candidates: any[] }) {
  const { activeProfile } = useAuth();
  const [showPlayer, setShowPlayer] = useState(false);
  const [favorite, setFavorite] = useState(false);
  
  useEffect(() => {
    saveUserView(movie.title, 'movie', movie.genres, activeProfile?.id);
    setFavorite(isFavorite(movie.title, activeProfile?.id));
  }, [movie.title, movie.genres, activeProfile?.id]);

  const handleFavorite = () => {
    const item = {
      title: movie.title,
      link: typeof window !== 'undefined' ? window.location.pathname : '',
      poster: movie.poster,
      quality: movie.quality,
      rating: movie.rating,
      genre: movie.genres.map(g => g.name).join(', '),
      type: 'movie'
    };
    setFavorite(toggleFavorite(item, activeProfile?.id));
  };

  const proxyImg = (url: string) => `/api/proxy-image?url=${encodeURIComponent(url)}`;

  const handleWatch = () => {
    setShowPlayer(true);
    setTimeout(() => {
      document.getElementById('player-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  return (
    <div className={styles.page}>
      {/* Scroll Anchor */}
      <div id="player-anchor" style={{ position: 'absolute', top: '100vh' }} />

      {/* Info Section */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className={styles.infoSection}
      >
        <div className={styles.posterSide}>
          <div style={{ position: 'relative' }}>
              <img 
                src={proxyImg(movie.poster)} 
                alt={movie.title} 
                className={styles.poster} 
                decoding="async"
              />
            {movie.rating && (
              <div className="ratingBadgeOverlay">
                <span className="imdbLogo">IMDb</span> {movie.rating}
              </div>
            )}
          </div>
        </div>
        <div className={styles.detailSide}>
          <motion.h1 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
            className={styles.title}
          >{movie.title}</motion.h1>

          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} 
            className={styles.unifiedMeta}
          >
            {/* Top Row: Quality, Rating, Year, Duration */}
            <div className={styles.metaRow}>
              {movie.quality && (
                <QualityBadge quality={movie.quality} large />
              )}
              {movie.year && <span className="premiumTag">{movie.year}</span>}
              {movie.duration && (
                <span className="premiumTag" style={{ color: 'var(--text-secondary)' }}>
                   {movie.duration}
                </span>
              )}
            </div>

            {/* Bottom Row: Genres Badges separated by commas */}
            {movie.genres.length > 0 && (
              <div className={styles.metaRow}>
                {movie.genres.map((g, i) => (
                  <span key={i} className={styles.genreItem}>
                    <Link href={g.link} className={styles.genreBadge}>{g.name}</Link>
                    {i < movie.genres.length - 1 && <span className={styles.separator}>،</span>}
                  </span>
                ))}
              </div>
            )}
          </motion.div>

          {movie.story && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className={styles.story}>
              {movie.story}
            </motion.p>
          )}

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className={styles.actions}>
            {movie.iframeSource && (
              <button className="premiumBtn" onClick={handleWatch}>
                <Play size={20} fill="currentColor" strokeWidth={2.5} /> مشاهدة الفيلم
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

      {/* Player Section */}
      <AnimatePresence>
        {showPlayer && movie.iframeSource && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            animate={{ opacity: 1, y: 0 }}
            className={styles.playerSection}
          >
            <div className={styles.playerHeader}>
              <h2 className={styles.playerTitle}>
                <Film size={24} color="var(--accent-cyan)" /> مشاهدة: {movie.title}
              </h2>
              <button className={styles.closeBtn} onClick={() => setShowPlayer(false)}>
                <X size={18} /> إغلاق المشغل
              </button>
            </div>
            <div className={styles.playerBox}>
              <NativePlayer 
                iframeSource={movie.iframeSource} 
                mediaId={movie.title}
                title={movie.title}
                poster={movie.poster}
                type="movie"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <RecommendationRow 
        title="أعمال مشابهة قد تعجبك" 
        candidates={candidates} 
        baseGenres={movie.genres.map(g => g.name)} 
        ignoreTitle={movie.title}
      />
    </div>
  );
}
