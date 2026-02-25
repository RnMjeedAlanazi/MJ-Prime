
'use client';
import { useAuth } from '@/app/context/AuthContext';
import ProfileSelector from './ProfileSelector';
import { usePathname } from 'next/navigation';

export default function ProfileGuard({ children }: { children: React.ReactNode }) {
  const { user, activeProfile, loading } = useAuth();
  const pathname = usePathname();

  // If loading auth state, show nothing or a splash
  if (loading) return null;

  // If not logged in, let the AuthProvider/Router handle redirect or public views
  if (!user) return <>{children}</>;

  // Public paths don't require a profile (Auth handles redirecting logged-in users to / from these)
  const publicPaths = ['/login', '/register'];
  if (publicPaths.includes(pathname)) return <>{children}</>;

  // Mandatory profile selection if logged in but no profile is active
  // This will show ProfileSelector on any other page (like /settings) without a redirect
  if (!activeProfile) {
    return <ProfileSelector />;
  }

  return <>{children}</>;
}
