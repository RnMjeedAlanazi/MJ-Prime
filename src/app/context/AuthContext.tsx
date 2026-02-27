
'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter, usePathname } from 'next/navigation';

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  pin?: string | null;
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
        setProfiles([]);
        setActiveProfileState(null);
      }
    } catch (e: any) {
      console.error('Error in fetchProfiles:', e);
      setProfiles([]); 
      setActiveProfileState(null);
    }
  };

  const setActiveProfile = (profile: Profile | null) => {
    setActiveProfileState(profile);
    if (user && profile) {
      Storage.set(`active_profile_${user.uid}`, profile.id, 86400 * 30);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      const publicPaths = ['/login', '/register'];
      const isPublic = publicPaths.includes(pathname);

      if (firebaseUser) {
        await fetchProfiles(firebaseUser.uid);
        if (isPublic) {
          router.push('/');
        }
      } else {
        setProfiles([]);
        setActiveProfileState(null);
        if (!isPublic) {
          // If we are not on a public path and not logged in, we MUST be loading/redirecting
          setLoading(true); 
          router.replace('/login');
        }
      }
      
      // Only stop loading if we are NOT redirecting
      const willRedirect = (!firebaseUser && !isPublic) || (firebaseUser && isPublic);
      if (!willRedirect) {
        setLoading(false);
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
      {loading ? (
        <div style={{ 
          height: '100vh', 
          width: '100vw', 
          background: '#030014', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          gap: '20px'
        }}>
           <h1 style={{ color: '#fff', fontSize: '32px', fontWeight: 800, fontFamily: 'Almarai, sans-serif' }}>
             بوس <span style={{ color: '#00f0ff' }}>الواوا</span>
           </h1>
           <div className="spinner" style={{ 
             width: '40px', 
             height: '40px', 
             border: '3px solid rgba(255,255,255,0.1)', 
             borderTop: '3px solid #00f0ff', 
             borderRadius: '50%',
             animation: 'spin 1s linear infinite'
           }} />
           <style>{`
             @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
           `}</style>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
