import type { Metadata } from 'next';
import { Almarai, Outfit } from 'next/font/google';
import './globals.css';
import NavBar from './components/NavBar';
import BottomNav from './components/BottomNav';
import IOSActiveStateFix from './components/IOSActiveStateFix';
import ClientInitialization from './components/ClientInitialization';
import { AuthProvider } from './context/AuthContext';
import ProfileGuard from './components/ProfileGuard';

const almarai = Almarai({ subsets: ['arabic'], weight: ['300', '400', '700', '800'], variable: '--font-almarai' });
const outfit = Outfit({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700', '800', '900'], variable: '--font-outfit' });

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#030014',
};

export const metadata: Metadata = {
  title: 'بوس الواوا - مشاهدة الأفلام والمسلسلات',
  description: 'شاهد أحدث الأفلام والمسلسلات والأنمي والدراما الآسيوية. بث مجاني بجودة عالية.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MJ Prime',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning data-scroll-behavior="smooth" className={`${almarai.variable} ${outfit.variable}`}>
      <body suppressHydrationWarning>
        <AuthProvider>
          <ClientInitialization />
          <IOSActiveStateFix />
          <ProfileGuard>
            <NavBar />
            <main>{children}</main>
            <BottomNav />
          </ProfileGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
