'use client';
import { useEffect, useState } from 'react';
import Row from './Row';
import { getUserTopGenres, UserHistoryItem } from '@/lib/userProfile';
import { MediaItem } from '@/lib/scraper';

interface RecommendationRowProps {
  candidates: MediaItem[];
  title?: string;
  baseGenres?: string[]; // If provided, prioritize items matching these genres (for "Similar to this movie" section)
  ignoreTitle?: string;  // Do not show the current movie itself
}

export default function RecommendationRow({ candidates, title = "موصى بها لك حسب ذوقك", baseGenres = [], ignoreTitle }: RecommendationRowProps) {
  const [recommended, setRecommended] = useState<MediaItem[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    let topUserGenres: string[] = [];
    try {
      topUserGenres = getUserTopGenres().slice(0, 5); // Take top 5 user preferences
    } catch {
      // Ignore errors reading local storage
    }

    // Determine the combined weight of attributes to look for
    // If we're on a movie page, `baseGenres` has high weight.
    const calculateScore = (item: MediaItem) => {
      let score = 0;
      let hasGenreMatch = false;
      
      // 1. Genre Processing
      if (item.genre) {
        const itemGenres = item.genre.split(',').map(g => g.trim());
        
        // Context Match (if on a movie/series page)
        if (baseGenres.length > 0) {
          baseGenres.forEach(g => {
            if (itemGenres.includes(g)) {
              score += 15; // Very high weight for matching the currently viewed item
              hasGenreMatch = true;
            }
          });
        }

        // History Match (User Preferences)
        topUserGenres.forEach(g => {
          if (itemGenres.includes(g)) {
            // Give history a very high weight if this is the homepage (no baseGenres)
            score += baseGenres.length === 0 ? 10 : 3; 
            hasGenreMatch = true;
          }
        });
      }

      // If there is no genre match at all with history or context, reject it.
      if (!hasGenreMatch) return 0;

      // 2. Rating Bonus (reward high quality content)
      if (item.rating) {
        const ratingNum = parseFloat(item.rating);
        if (!isNaN(ratingNum)) {
          score += ratingNum * 1.5; // Quality heavily boosts up ranking
        }
      }

      // 3. Views/Popularity Bonus (if available)
      if (item.views) {
        const viewsNum = parseInt(item.views.replace(/,/g, ''), 10);
        if (!isNaN(viewsNum)) {
          score += Math.min(viewsNum / 100000, 5); // Add up to 5 points for extremely popular items
        }
      }

      return parseFloat(score.toFixed(2));
    };

    // Calculate score for each candidate and sort
    const scored = candidates
      .filter(item => item.title !== ignoreTitle) // Don't recommend the item we are currently viewing
      .map(item => ({ ...item, score: calculateScore(item) }))
      .filter(item => item.score > 0) // Only recommend if score is greater than zero
      .sort((a, b) => b.score - a.score);

    // Deduplicate by title
    const unique: MediaItem[] = [];
    scored.forEach(item => {
      if (!unique.some(u => u.title === item.title)) unique.push(item);
    });

    setRecommended(unique.slice(0, 15));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(candidates), JSON.stringify(baseGenres), ignoreTitle]);

  if (!isClient || recommended.length === 0) return null;

  return (
    <div style={{ marginTop: '40px' }}>
      <Row title={title} items={recommended} numbered={false} />
    </div>
  );
}
