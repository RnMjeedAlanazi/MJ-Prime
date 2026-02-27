import { fetchEpisodeDetails, fetchCategoryPage } from '@/lib/scraper';
import EpisodeClient from './EpisodeClient';
import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { GlobalCache } from '@/lib/server-cache';

interface EpisodePageProps {
  params: Promise<{ slug: string }>;
}

export default async function EpisodeDetailsPage({ params }: EpisodePageProps) {
  const { slug } = await params;

  // Try Persistent Cache
  let episode = await GlobalCache.get(`episode_details/${slug}`, 86400); // 24h

  const [freshEpisode, recent, topViews, topImdb] = await Promise.all([
    !episode ? fetchEpisodeDetails(slug) : Promise.resolve(null),
    fetchCategoryPage('series', 1),
    fetchCategoryPage('series-top-views', 1),
    fetchCategoryPage('series-top-imdb', 1)
  ]);

  if (!episode && freshEpisode) {
    episode = freshEpisode;
    GlobalCache.set(`episode_details/${slug}`, episode);
  }

  if (!episode) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 80, textAlign: 'center' }}>
        <AlertTriangle size={64} color="var(--accent-purple)" style={{marginBottom: 20}} />
        <h1 style={{ fontSize: 32, fontWeight: 900, fontFamily: 'Tajawal, sans-serif', marginBottom: 16 }}>الحلقة غير موجودة</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 30, fontFamily: 'Tajawal, sans-serif', fontSize: 18 }}>عذراً، لم يتم العثور على هذه الحلقة أو أنها غير متوفرة حالياً.</p>
        <Link href="/series">
          <button style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 36px', background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))', color: '#fff', border: 'none', borderRadius: 30, fontWeight: 800, cursor: 'pointer', fontFamily: 'Tajawal, sans-serif', fontSize: 16, boxShadow: '0 8px 30px var(--glow-purple)' }}>
            <ArrowRight size={20} /> تصفح المسلسلات
          </button>
        </Link>
      </div>
    );
  }

  const candidates = [...recent, ...topViews, ...topImdb];

  return <EpisodeClient episode={episode} currentSlug={slug} candidates={candidates} />;
}
