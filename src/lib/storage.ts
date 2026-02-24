
/**
 * Browser Storage Utility
 * Handles localStorage with expiry and Cookie management
 */

export const Storage = {
  // --- LocalStorage with Expiry ---
  set(key: string, value: any, ttlSeconds: number = 3600) {
    if (typeof window === 'undefined') return;
    const now = new Date();
    const item = {
      value,
      expiry: now.getTime() + (ttlSeconds * 1000),
    };
    localStorage.setItem(key, JSON.stringify(item));
  },

  get(key: string) {
    if (typeof window === 'undefined') return null;
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return null;

    try {
      const item = JSON.parse(itemStr);
      const now = new Date();
      if (now.getTime() > item.expiry) {
        localStorage.removeItem(key);
        return null;
      }
      return item.value;
    } catch (e) {
      return null;
    }
  },

  remove(key: string) {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  },

  // --- Cookies ---
  setCookie(name: string, value: string, days: number = 7) {
    if (typeof window === 'undefined') return;
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
  },

  getCookie(name: string) {
    if (typeof window === 'undefined') return null;
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }
};
