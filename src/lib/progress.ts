
import { db, auth, ref, set, get, update } from './firebase';

export interface WatchProgress {
  mediaId: string; // Slug or unique ID
  title: string;
  type: 'movie' | 'episode';
  currentTime: number;
  duration: number;
  lastUpdated: number;
}

/**
 * Saves watch progress to LocalStorage first (for speed) 
 * and then optionally syncs to Firebase.
 */
export const ProgressTracker = {
  // --- Local Buffer ---
  async saveLocal(progress: WatchProgress, profileId?: string) {
    if (typeof window === 'undefined' || !progress || !progress.mediaId) return;
    const user = auth.currentUser;
    const finalProfileId = profileId || 'main';
    const storageKey = user ? `watch_progress_${user.uid}_${finalProfileId}` : 'watch_progress_v2';
    
    const progressMap = JSON.parse(localStorage.getItem(storageKey) || '{}');
    progressMap[progress.mediaId] = progress;
    localStorage.setItem(storageKey, JSON.stringify(progressMap));

    // Optimistic sync to Firebase if user is logged in
    if (user) {
      const dbRef = ref(db, `users/${user.uid}/profiles/${finalProfileId}/progress`);
      const updates: any = {};
      updates[progress.mediaId.replace(/\./g, '_')] = {
        ...progress,
        lastUpdated: Date.now()
      };
      update(dbRef, updates).catch(e => console.error('Firebase Sync Error:', e));
    }
  },

  async getProgress(mediaId: string, profileId?: string): Promise<WatchProgress | null> {
    if (typeof window === 'undefined' || !mediaId) return null;
    const user = auth.currentUser;
    const finalProfileId = profileId || 'main';
    const storageKey = user ? `watch_progress_${user.uid}_${finalProfileId}` : 'watch_progress_v2';
    
    // 1. Check LocalStorage
    const progressMap = JSON.parse(localStorage.getItem(storageKey) || '{}');
    const local = progressMap[mediaId];
    
    // 2. If not in local or older than 1 hour, try Firebase
    if (user) {
      const dbRef = ref(db, `users/${user.uid}/profiles/${finalProfileId}/progress/${mediaId.replace(/\./g, '_')}`);
      try {
        const snapshot = await get(dbRef);
        if (snapshot.exists()) {
          const remote = snapshot.val();
          if (!local || remote.lastUpdated > local.lastUpdated) {
             return remote;
          }
        }
      } catch (e) {
        console.error('Firebase Fetch Error:', e);
      }
    }
    
    return local || null;
  },

  async getAllProgress(profileId?: string): Promise<WatchProgress[]> {
    const user = auth.currentUser;
    const finalProfileId = profileId || 'main';
    if (user) {
      const dbRef = ref(db, `users/${user.uid}/profiles/${finalProfileId}/progress`);
      try {
        const snapshot = await get(dbRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          return Object.values(data) as WatchProgress[];
        }
      } catch (e) {
        console.warn('Firebase progress fetch failed (Access Denied). Using local only.');
      }
    }
    
    const storageKey = user ? `watch_progress_${user.uid}_${finalProfileId}` : 'watch_progress_v2';
    const progressMap = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return Object.values(progressMap);
  }
};
