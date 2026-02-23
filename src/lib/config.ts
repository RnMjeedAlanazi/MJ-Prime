import { db, ref, get } from './firebase';

let cachedBaseUrl = 'https://web2230x.faselhdx.best';
let lastFetch = 0;
const CACHE_TTL = 300000; // 5 minutes (less frequent DB hits)
let fetchPromise: Promise<string> | null = null;

export async function getBaseUrl(): Promise<string> {
  const now = Date.now();
  
  // Return cache if fresh
  if (now - lastFetch < CACHE_TTL) {
    return cachedBaseUrl;
  }

  // If already fetching, return the existing promise
  if (fetchPromise) {
    return fetchPromise;
  }

  // Start new fetch
  fetchPromise = (async () => {
    try {
      const snapshot = await get(ref(db, 'config/fasel_base_url'));
      if (snapshot.exists()) {
        cachedBaseUrl = snapshot.val();
        lastFetch = Date.now();
      }
    } catch (error) {
      console.error('Failed to fetch BASE_URL from Firebase:', error);
      // Fallback to cache even if old to avoid blocking the whole site
    } finally {
      fetchPromise = null;
    }
    return cachedBaseUrl;
  })();

  return fetchPromise;
}
