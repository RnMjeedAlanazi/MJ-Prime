
'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter, usePathname } from 'next/navigation';

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  pin?: string;
  settings?: {
    autoplay?: boolean;
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  profiles: Profile[];
  activeProfile: Profile | null;
  setActiveProfile: (profile: Profile | null) => void;
  refreshProfiles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true, 
  profiles: [], 
  activeProfile: null,
  setActiveProfile: () => {},
  refreshProfiles: async () => {} 
});

import { db, ref, get, set, update } from '@/lib/firebase';
import { Storage } from '@/lib/storage';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfileState] = useState<Profile | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const fetchProfiles = async (uid: string) => {
    const localDefault: Profile = { 
      id: 'main', 
      name: 'الأساسي', 
      avatar: '/api/proxy-image?url=' + encodeURIComponent('https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png'),
      settings: { autoplay: true }
    };
    try {
      const dbRef = ref(db, `users/${uid}/profiles`);
      const snapshot = await get(dbRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data && typeof data === 'object') {
          const profileList = Object.values(data) as Profile[];
          setProfiles(profileList);
          
          const savedProfileId = Storage.get(`active_profile_${uid}`);
          if (savedProfileId) {
            const found = profileList.find(p => p.id === savedProfileId);
            if (found) setActiveProfileState(found);
          }
        }
      } else {
        const defaultProfile: Profile = {
          id: 'main',
          name: 'الأساسي',
          avatar: '/api/proxy-image?url=' + encodeURIComponent('https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png'),
          settings: { autoplay: true }
        };
        try {
          await update(ref(db, `users/${uid}/profiles`), { main: defaultProfile });
        } catch (dbErr) {
          console.warn('Firebase Write Denied - using local session');
        }
        setProfiles([defaultProfile]);
        setActiveProfileState(defaultProfile);
      }
    } catch (e: any) {
      console.warn('Firebase Access Denied - Falling back to local profile session.');
      setProfiles([localDefault]);
      setActiveProfileState(localDefault);
    }
  };

  const setActiveProfile = (profile: Profile | null) => {
    setActiveProfileState(profile);
    if (user && profile) {
      Storage.set(`active_profile_${user.uid}`, profile.id, 86400 * 30);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        await fetchProfiles(user.uid);
      } else {
        setProfiles([]);
        setActiveProfileState(null);
      }
      setLoading(false);
      
      const publicPaths = ['/login', '/register'];
      if (!user && !publicPaths.includes(pathname)) {
        router.push('/login');
      }
      if (user && publicPaths.includes(pathname)) {
        router.push('/');
      }
    });

    return () => unsubscribe();
  }, [pathname, router]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      profiles, 
      activeProfile, 
      setActiveProfile,
      refreshProfiles: () => user ? fetchProfiles(user.uid) : Promise.resolve()
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
