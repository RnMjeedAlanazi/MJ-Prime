'use client';
import { useEffect } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';

export default function ProfileGuard({ children }: { children: React.ReactNode }) {
  const { user, activeProfile, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const publicPaths = ['/login', '/register', '/profiles/selector'];
    if (!loading && user && !activeProfile && !publicPaths.includes(pathname)) {
      router.replace('/profiles/selector');
    }
  }, [user, activeProfile, loading, pathname, router]);

  // If loading auth state, show nothing or a splash
  if (loading) return null;

  // If not logged in, let the AuthProvider/Router handle redirect or public views
  if (!user) return <>{children}</>;

  // Public paths and the profiles selection page don't require an active profile
  const publicPaths = ['/login', '/register', '/profiles/selector'];
  if (publicPaths.includes(pathname)) return <>{children}</>;

  // Mandatory profile selection if logged in but no profile is active
  if (!activeProfile) {
    return (
      <div style={{ height: '100vh', background: '#030014' }} />
    );
  }

  return <>{children}</>;
}
