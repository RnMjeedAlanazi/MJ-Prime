import { Storage } from './storage';

export interface UserHistoryItem {
  id: string; // Movie or Series Title
  genres: string[];
  type: 'movie' | 'series' | 'episode';
  timestamp: number;
}

const HISTORY_KEY = 'faselhd_history';
const FAVS_KEY = 'faselhd_favorites';

export function saveUserView(title: string, type: 'movie' | 'series' | 'episode', genres: { name: string }[]) {
  try {
    let history: UserHistoryItem[] = Storage.get(HISTORY_KEY) || [];
    
    // Remove if already exists so we can move it to the top
    history = history.filter(h => h.id !== title);
    
    history.unshift({
      id: title,
      type,
      genres: genres.map(g => g.name),
      timestamp: Date.now()
    });

    // Keep only the last 30 views
    if (history.length > 30) history = history.slice(0, 30);
    
    Storage.set(HISTORY_KEY, history, 86400 * 365); // Save for a year
  } catch (e) {
    console.error('Failed to save to history', e);
  }
}

export function getUserTopGenres(): string[] {
  try {
    const history: UserHistoryItem[] = Storage.get(HISTORY_KEY) || [];
    if (history.length === 0) return [];
    
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
  try {
    let favs: any[] = Storage.get(FAVS_KEY) || [];
    
    const existsIndex = favs.findIndex(f => f.title === item.title);
    if (existsIndex >= 0) {
      favs.splice(existsIndex, 1);
      Storage.set(FAVS_KEY, favs, 86400 * 365);
      return false; // Removed
    } else {
      favs.unshift(item);
      Storage.set(FAVS_KEY, favs, 86400 * 365);
      return true; // Added
    }
  } catch (e) {
    console.error('Failed to toggle favorite', e);
    return false;
  }
}

export function getFavorites(): any[] {
  try {
    return Storage.get(FAVS_KEY) || [];
  } catch (e) {
    console.error('Failed to read favorites', e);
    return [];
  }
}

export function isFavorite(title: string): boolean {
  try {
    const favs: any[] = Storage.get(FAVS_KEY) || [];
    return favs.some(f => f.title === title);
  } catch (e) {
    return false;
  }
}
