
'use client';
import { useEffect } from 'react';
import { Storage } from '@/lib/storage';

export default function ClientInitialization() {
  useEffect(() => {
    // Record last visit via Cookie
    Storage.setCookie('last_visit', new Date().toISOString(), 30);
    
    // Ensure initial volume is set if not exist
    if (Storage.get('player_volume') === null) {
      Storage.set('player_volume', '1', 86400 * 30);
    }
    
    console.log('MJ Prime: User state initialized.');
  }, []);

  return null;
}
