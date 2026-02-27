
import { db, ref, get, set } from './firebase';

export const GlobalCache = {
  /**
   * Get cached data from Firebase
   * @param path - Key path (e.g., 'iframe_cache/slug')
   * @param ttlSeconds - Time back to consider valid (default 24h)
   */
  async get(path: string, ttlSeconds: number = 86400): Promise<any | null> {
    try {
      const dbRef = ref(db, `global_cache/${path}`);
      const snapshot = await get(dbRef).catch(err => {
        if (err.message?.includes('PERMISSION_DENIED')) {
           return null;
        }
        throw err;
      });

      if (snapshot && snapshot.exists()) {
        const data = snapshot.val();
        const now = Date.now();
        if (now - data.timestamp < ttlSeconds * 1000) {
          return data.value;
        }
      }
    } catch (e) {
      console.warn(`[GlobalCache] Read avoided/error at ${path}`);
    }
    return null;
  },

  /**
   * Save data to Firebase
   * @param path - Key path
   * @param value - Data to save
   */
  async set(path: string, value: any): Promise<void> {
    try {
      const dbRef = ref(db, `global_cache/${path}`);
      await set(dbRef, {
        value,
        timestamp: Date.now()
      }).catch(() => {
         // Silently fail on write permissions
      });
    } catch (e) {
      // Avoid crash on write
    }
  }
};
