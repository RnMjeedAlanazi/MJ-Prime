export interface UserHistoryItem {
  id: string; // Movie or Series Title
  genres: string[];
  type: 'movie' | 'series' | 'episode';
  timestamp: number;
}

export function saveUserView(title: string, type: 'movie' | 'series' | 'episode', genres: { name: string }[]) {
  if (typeof window === 'undefined') return;
  try {
    const rawHistory = localStorage.getItem('faselhd_history');
    let history: UserHistoryItem[] = rawHistory ? JSON.parse(rawHistory) : [];
    
    // Remove if already exists so we can move it to the top
    history = history.filter(h => h.id !== title);
    
    history.unshift({
      id: title,
      type,
      genres: genres.map(g => g.name),
      timestamp: Date.now()
    });

    // Keep only the last 30 views to save storage and keep recent preferences fresh
    if (history.length > 30) history = history.slice(0, 30);
    
    localStorage.setItem('faselhd_history', JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save to history', e);
  }
}

export function getUserTopGenres(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const rawHistory = localStorage.getItem('faselhd_history');
    if (!rawHistory) return [];
    const history: UserHistoryItem[] = JSON.parse(rawHistory);
    
    const genreCounts: Record<string, number> = {};
    history.forEach((item, index) => {
      // Give more weight to more recently viewed items
      const weight = Math.max(1, 30 - index);
      item.genres.forEach(g => {
        genreCounts[g] = (genreCounts[g] || 0) + weight;
      });
    });

      return Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);
  } catch (e) {
    console.error('Failed to read history', e);
    return [];
  }
}

// ----- Favorites -----
export function toggleFavorite(item: any): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const rawFav = localStorage.getItem('faselhd_favorites');
    let favs: any[] = rawFav ? JSON.parse(rawFav) : [];
    
    const existsIndex = favs.findIndex(f => f.title === item.title);
    if (existsIndex >= 0) {
      favs.splice(existsIndex, 1);
      localStorage.setItem('faselhd_favorites', JSON.stringify(favs));
      return false; // Removed
    } else {
      favs.unshift(item);
      localStorage.setItem('faselhd_favorites', JSON.stringify(favs));
      return true; // Added
    }
  } catch (e) {
    console.error('Failed to toggle favorite', e);
    return false;
  }
}

export function getFavorites(): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const rawFav = localStorage.getItem('faselhd_favorites');
    return rawFav ? JSON.parse(rawFav) : [];
  } catch (e) {
    console.error('Failed to read favorites', e);
    return [];
  }
}

export function isFavorite(title: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const rawFav = localStorage.getItem('faselhd_favorites');
    if (!rawFav) return false;
    const favs: any[] = JSON.parse(rawFav);
    return favs.some(f => f.title === title);
  } catch (e) {
    return false;
  }
}
