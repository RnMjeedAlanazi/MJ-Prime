import type { Metadata } from 'next';
import { Almarai, Outfit } from 'next/font/google';
import './globals.css';
import NavBar from './components/NavBar';

const almarai = Almarai({ subsets: ['arabic'], weight: ['300', '400', '700', '800'], variable: '--font-almarai' });
const outfit = Outfit({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700', '800', '900'], variable: '--font-outfit' });

export const metadata: Metadata = {
  title: 'MJ Prime - Watch Movies & Series',
  description: 'Watch the latest movies, series, anime, and Asian dramas. Free streaming in HD.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning className={`${almarai.variable} ${outfit.variable}`}>
      <body suppressHydrationWarning>
        <NavBar />
        <main>{children}</main>
      </body>
    </html>
  );
}
