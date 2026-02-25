import type { Metadata } from 'next';
import { IBM_Plex_Sans_Arabic, Outfit } from 'next/font/google';
import './globals.css';
import NavBar from './components/NavBar';
import BottomNav from './components/BottomNav';
import IOSActiveStateFix from './components/IOSActiveStateFix';
import ClientInitialization from './components/ClientInitialization';
import { AuthProvider } from './context/AuthContext';
import ProfileGuard from './components/ProfileGuard';
import PageTransition from './components/PageTransition';
import TopProgressBar from './components/TopProgressBar';

const ibmPlexArabic = IBM_Plex_Sans_Arabic({ subsets: ['arabic'], weight: ['300', '400', '500', '600', '700'], variable: '--font-ibm-plex-arabic' });
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
    <html lang="ar" dir="rtl" suppressHydrationWarning data-scroll-behavior="smooth" className={`${ibmPlexArabic.variable} ${outfit.variable}`}>
      <body suppressHydrationWarning>
        <AuthProvider>
          <TopProgressBar />
          <ClientInitialization />
          <IOSActiveStateFix />
          <ProfileGuard>
            <NavBar />
            <PageTransition>
              <main>{children}</main>
            </PageTransition>
            <BottomNav />
          </ProfileGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
