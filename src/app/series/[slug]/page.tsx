import { fetchSeasonDetails, fetchCategoryPage } from '@/lib/scraper';
import SeriesClient from './SeriesClient';
import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { GlobalCache } from '@/lib/server-cache';

interface SeriesPageProps {
  params: Promise<{ slug: string }>;
}

export default async function SeriesDetailsPage({ params }: SeriesPageProps) {
  const { slug } = await params;

  // Try Persistent Cache
  let season = await GlobalCache.get(`season_details/${slug}`, 86400); // 24h

  const [freshSeason, recent, topViews, topImdb] = await Promise.all([
    !season ? fetchSeasonDetails(slug) : Promise.resolve(null),
    fetchCategoryPage('series', 1),
    fetchCategoryPage('series-top-views', 1),
    fetchCategoryPage('series-top-imdb', 1)
  ]);

  if (!season && freshSeason) {
    season = freshSeason;
    GlobalCache.set(`season_details/${slug}`, season);
  }

  if (!season) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 80, textAlign: 'center' }}>
        <AlertTriangle size={64} color="var(--accent-purple)" style={{marginBottom: 20}} />
        <h1 style={{ fontSize: 28, fontWeight: 900, fontFamily: 'Almarai, sans-serif', marginBottom: 16 }}>المسلسل غير موجود</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 30, fontFamily: 'Almarai, sans-serif', fontSize: 16 }}>عذراً، لم يتم العثور على هذا المسلسل أو أنه غير متوفر حالياً.</p>
        <Link href="/series">
          <button style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 36px', background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))', color: '#fff', border: 'none', borderRadius: 30, fontWeight: 800, cursor: 'pointer', fontFamily: 'Almarai, sans-serif', fontSize: 15, boxShadow: '0 8px 30px var(--glow-purple)' }}>
            <ArrowRight size={20} /> تصفح المسلسلات
          </button>
        </Link>
      </div>
    );
  }

  const candidates = [...recent, ...topViews, ...topImdb];

  return <SeriesClient season={season} candidates={candidates} />;
}
