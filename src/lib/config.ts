import { db, ref, get } from './firebase';

let cachedBaseUrl = 'https://web2230x.faselhdx.best';
let lastFetch = 0;
const CACHE_TTL = 60000; // 1 minute

export async function getBaseUrl(): Promise<string> {
  const now = Date.now();
  if (now - lastFetch < CACHE_TTL) {
    return cachedBaseUrl;
  }

  try {
    const snapshot = await get(ref(db, 'config/fasel_base_url'));
    if (snapshot.exists()) {
      cachedBaseUrl = snapshot.val();
      lastFetch = now;
    }
  } catch (error) {
    console.error('Failed to fetch BASE_URL from Firebase:', error);
  }
  
  return cachedBaseUrl;
}
