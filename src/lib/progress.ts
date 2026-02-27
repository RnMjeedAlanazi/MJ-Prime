
import { db, auth, ref, get, update } from './firebase';

export interface WatchProgress {
  mediaId: string; // Slug or unique ID
  title: string;
  type: 'movie' | 'episode';
  currentTime: number;
  duration: number;
  lastUpdated: number;
  _isPending?: boolean;
  _inCloud?: boolean;
}

/**
 * Saves watch progress to LocalStorage first (for speed) 
 * and then optionally syncs to Firebase.
 */
export const ProgressTracker = {
  // --- High Performance Batch Sync ---
  async saveLocal(progress: WatchProgress, profileId?: string) {
    if (typeof window === 'undefined' || !progress || !progress.mediaId) return;
    const user = auth.currentUser;
    const finalProfileId = profileId || 'main';
    const storageKey = user ? `watch_progress_${user.uid}_${finalProfileId}` : 'watch_progress_v3';
    
    // 1. Update Local Store (Always Instant & Reliable)
    const progressMap = JSON.parse(localStorage.getItem(storageKey) || '{}');
    progressMap[progress.mediaId] = progress;
    localStorage.setItem(storageKey, JSON.stringify(progressMap));

    // 2. Handle Batch Sync to Firebase (3 Episodes or 2 Movies)
    if (user) {
      const counterKey = `sync_counter_${user.uid}_${finalProfileId}`;
      const counters = JSON.parse(localStorage.getItem(counterKey) || '{"episode": 0, "movie": 0}');
      
      // Increment counter for THIS media type session
      if (progress.currentTime > 10) {
          counters[progress.type] = (counters[progress.type] || 0) + 1;
          localStorage.setItem(counterKey, JSON.stringify(counters));
      }

      const thresholdReached = (progress.type === 'episode' && counters.episode >= 3) || 
                             (progress.type === 'movie' && counters.movie >= 2);

      if (thresholdReached) {
        // RESET COUNTERS
        counters.episode = 0;
        counters.movie = 0;
        localStorage.setItem(counterKey, JSON.stringify(counters));

        // SYNC ALL LOCAL PROGRESS TO FIREBASE
        const dbRef = ref(db, `users/${user.uid}/profiles/${finalProfileId}/progress`);
        const cleanedMetadata: any = {};
        
        Object.keys(progressMap).forEach(key => {
            const firebaseKey = key.replace(/\./g, '_').replace(/[\$#\[\]]/g, '_');
            cleanedMetadata[firebaseKey] = progressMap[key];
        });

        update(dbRef, cleanedMetadata)
          .then(() => {
            console.log(`[ProgressSync] Cloud Sync Success. Cleaning local storage.`);
            // REMOVE FROM LOCAL STORAGE TO SAVE SPACE (User request)
            localStorage.removeItem(storageKey);
          })
          .catch(e => console.error('[ProgressSync] Cloud Sync Error:', e));
      } else {
        // Safe Fallback: Sync current item immediately if NEAR END
        const isNearEnd = progress.duration > 0 && (progress.currentTime / progress.duration > 0.9);
        if (isNearEnd) {
             const itemRef = ref(db, `users/${user.uid}/profiles/${finalProfileId}/progress`);
             const safeKey = progress.mediaId.replace(/\./g, '_').replace(/[\$#\[\]]/g, '_');
             const updates: any = {};
             updates[safeKey] = progress;
             update(itemRef, updates).catch(() => {});
        }
      }
    }
  },

  async getProgress(mediaId: string, profileId?: string): Promise<WatchProgress | null> {
    if (typeof window === 'undefined' || !mediaId) return null;
    const user = auth.currentUser;
    const finalProfileId = profileId || 'main';
    const storageKey = user ? `watch_progress_${user.uid}_${finalProfileId}` : 'watch_progress_v3';
    
    // 1. Check LocalStorage (Prioritized for speed)
    const progressMap = JSON.parse(localStorage.getItem(storageKey) || '{}');
    const local = progressMap[mediaId];
    
    // 2. Cloud Fallback if local is missing or very old (cached for 30m)
    if (user && (!local || (local.lastUpdated && Date.now() - local.lastUpdated > 1800000))) {
      const safeKey = mediaId.replace(/\./g, '_').replace(/[\$#\[\]]/g, '_');
      const dbRef = ref(db, `users/${user.uid}/profiles/${finalProfileId}/progress/${safeKey}`);
      try {
        const snapshot = await get(dbRef);
        if (snapshot.exists()) {
           const remote = snapshot.val();
           if (!local || remote.lastUpdated > local.lastUpdated) {
              progressMap[mediaId] = remote;
              localStorage.setItem(storageKey, JSON.stringify(progressMap));
              return remote;
           }
        }
      } catch (e) {}
    }
    
    return local || null;
  },

  async getAllProgress(profileId?: string): Promise<(WatchProgress & { _isPending?: boolean; _inCloud?: boolean })[]> {
    const user = auth.currentUser;
    const finalProfileId = profileId || 'main';
    const storageKey = user ? `watch_progress_${user.uid}_${finalProfileId}` : 'watch_progress_v3';
    
    // 1. Get Local (Pending items)
    const localMap: Record<string, WatchProgress> = JSON.parse(localStorage.getItem(storageKey) || '{}');
    const results: Record<string, WatchProgress & { _isPending?: boolean; _inCloud?: boolean }> = {};

    // Load local items first and mark them as pending
    Object.keys(localMap).forEach(id => {
       results[id] = { ...localMap[id], _isPending: true, _inCloud: false };
    });
    
    // 2. Get Remote if possible
    if (user) {
      const dbRef = ref(db, `users/${user.uid}/profiles/${finalProfileId}/progress`);
      try {
        const snapshot = await get(dbRef);
        if (snapshot.exists()) {
          const remoteData = snapshot.val();
          Object.keys(remoteData).forEach(firebaseKey => {
             const remoteItem = remoteData[firebaseKey] as WatchProgress;
             const mid = remoteItem.mediaId;
             const existing = results[mid];
             
             if (!existing || remoteItem.lastUpdated > existing.lastUpdated) {
                results[mid] = { ...remoteItem, _isPending: false, _inCloud: true };
             } else if (existing) {
                // local is newer, but it's IN CLOUD (older version exists)
                results[mid]._inCloud = true;
             }
          });
        }
      } catch (e) {
        console.warn('[ProgressSync] Cloud Sync check failed.');
      }
    }
    
    return Object.values(results);
  }
};
