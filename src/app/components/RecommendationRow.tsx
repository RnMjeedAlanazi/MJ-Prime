'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import Row from './Row';
import { getUserTopGenres } from '@/lib/userProfile';
import { MediaItem } from '@/lib/scraper';

interface RecommendationRowProps {
  candidates: MediaItem[];
  title?: string;
  baseGenres?: string[]; // If provided, prioritize items matching these genres (for "Similar to this movie" section)
  ignoreTitle?: string;  // Do not show the current movie itself
}

export default function RecommendationRow({ candidates, title, baseGenres = [], ignoreTitle }: RecommendationRowProps) {
  const { activeProfile } = useAuth();
  
  const displayTitle = title ? (
    <span>{title}</span>
  ) : (
    activeProfile ? (
      <span>
        اخترنا لك يا <span style={{ color: 'var(--accent-cyan)', textShadow: '0 0 10px var(--glow-cyan)' }}>{activeProfile.name}</span>
      </span>
    ) : (
      <span>اخترنا لك حسب ذوقك</span>
    )
  );

  const [recommended, setRecommended] = useState<MediaItem[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    let topUserGenres: string[] = [];
    try {
      topUserGenres = getUserTopGenres(activeProfile?.id).slice(0, 5); // Take top 5 profile preferences
    } catch {
      // Ignore errors reading local storage
    }

    // Determine the combined weight of attributes to look for
    const calculateScore = (item: MediaItem) => {
      let score = 0;
      let hasGenreMatch = false;
      
      if (item.genre) {
        const itemGenres = item.genre.split(',').map(g => g.trim());
        
        // Context Match (if on a movie/series page)
        if (baseGenres.length > 0) {
          baseGenres.forEach(g => {
            if (itemGenres.includes(g)) {
              score += 15; 
              hasGenreMatch = true;
            }
          });
        }

        // History Match (Profile Preferences)
        topUserGenres.forEach(g => {
          if (itemGenres.includes(g)) {
            score += baseGenres.length === 0 ? 10 : 3; 
            hasGenreMatch = true;
          }
        });
      }

      if (!hasGenreMatch) return 0;

      if (item.rating) {
        const ratingNum = parseFloat(item.rating);
        if (!isNaN(ratingNum)) {
          score += ratingNum * 1.5; 
        }
      }

      if (item.views) {
        const viewsNum = parseInt(item.views.replace(/,/g, ''), 10);
        if (!isNaN(viewsNum)) {
          score += Math.min(viewsNum / 100000, 5); 
        }
      }

      return parseFloat(score.toFixed(2));
    };

    const scored = candidates
      .filter(item => item.title !== ignoreTitle) 
      .map(item => ({ ...item, score: calculateScore(item) }))
      .filter(item => item.score > 0) 
      .sort((a, b) => b.score - a.score);

    const unique: MediaItem[] = [];
    scored.forEach(item => {
      if (!unique.some(u => u.title === item.title)) unique.push(item);
    });

    setRecommended(unique.slice(0, 15));
  }, [JSON.stringify(candidates), JSON.stringify(baseGenres), ignoreTitle, activeProfile?.id]);

  if (!isClient || recommended.length === 0) return null;

  return (
    <div style={{ marginTop: '40px' }}>
      <Row title={displayTitle} items={recommended} numbered={false} />
    </div>
  );
}
