import { Storage } from './storage';
import { db, auth, ref, set, update } from './firebase';

export interface UserHistoryItem {
  id: string; // Movie or Series Title
  genres: string[];
  type: 'movie' | 'series' | 'episode';
  timestamp: number;
}

const HISTORY_KEY = 'faselhd_history';
const FAVS_KEY = 'faselhd_favorites';

export function getProfileStorageKey(baseKey: string, profileId?: string) {
  const user = auth.currentUser;
  const pId = profileId || 'main';
  return user ? `${baseKey}_${user.uid}_${pId}` : baseKey;
}

export function saveUserView(title: string, type: 'movie' | 'series' | 'episode', genres: { name: string }[], profileId?: string) {
  try {
    const storageKey = getProfileStorageKey(HISTORY_KEY, profileId);
    let history: UserHistoryItem[] = Storage.get(storageKey) || [];
    history = history.filter(h => h.id !== title);
    
    const newItem: UserHistoryItem = {
      id: title,
      type,
      genres: genres.map(g => g.name),
      timestamp: Date.now()
    };
    
    history.unshift(newItem);
    if (history.length > 30) history = history.slice(0, 30);
    Storage.set(storageKey, history, 86400 * 365);
    
    const user = auth.currentUser;
    if (user) {
      const pId = profileId || 'main';
      update(ref(db, `users/${user.uid}/profiles/${pId}`), { history: history }).catch(console.error);
    }
  } catch (e) {
    console.error('Failed to save to history', e);
  }
}

export function getUserTopGenres(profileId?: string): string[] {
  try {
    const storageKey = getProfileStorageKey(HISTORY_KEY, profileId);
    const history: UserHistoryItem[] = Storage.get(storageKey) || [];
    if (history.length === 0) return [];
    
    const genreCounts: Record<string, number> = {};
    history.forEach((item, index) => {
      const weight = Math.max(1, 30 - index);
      item.genres.forEach(g => {
        genreCounts[g] = (genreCounts[g] || 0) + weight;
      });
    });

    return Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);
  } catch (e) {
    return [];
  }
}

export function toggleFavorite(item: any, profileId?: string): boolean {
  try {
    const storageKey = getProfileStorageKey(FAVS_KEY, profileId);
    let favs: any[] = Storage.get(storageKey) || [];
    const existsIndex = favs.findIndex(f => f.title === item.title);
    let added = false;

    if (existsIndex >= 0) {
      favs.splice(existsIndex, 1);
      added = false;
    } else {
      favs.unshift(item);
      added = true;
    }

    Storage.set(storageKey, favs, 86400 * 365);
    
    const user = auth.currentUser;
    if (user) {
      const pId = profileId || 'main';
      update(ref(db, `users/${user.uid}/profiles/${pId}`), { favorites: favs }).catch(console.error);
    }
    
    return added;
  } catch (e) {
    return false;
  }
}

export function getFavorites(profileId?: string): any[] {
  try {
    const storageKey = getProfileStorageKey(FAVS_KEY, profileId);
    return Storage.get(storageKey) || [];
  } catch (e) {
    return [];
  }
}

export function isFavorite(title: string, profileId?: string): boolean {
  try {
    const storageKey = getProfileStorageKey(FAVS_KEY, profileId);
    const favs: any[] = Storage.get(storageKey) || [];
    return favs.some(f => f.title === title);
  } catch (e) {
    return false;
  }
}
