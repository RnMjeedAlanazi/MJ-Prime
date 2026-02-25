import { fetchMovieDetails, fetchCategoryPage } from '@/lib/scraper';
import MovieClient from './MovieClient';
import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';

interface MoviePageProps {
  params: Promise<{ slug: string }>;
}

export default async function MovieDetailsPage({ params }: MoviePageProps) {
  const { slug } = await params;
  const [movie, recent, topViews, topImdb] = await Promise.all([
    fetchMovieDetails(slug),
    fetchCategoryPage('movies', 1),
    fetchCategoryPage('movies-top-views', 1),
    fetchCategoryPage('movies-top-imdb', 1)
  ]);

  if (!movie) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 80, textAlign: 'center' }}>
        <AlertTriangle size={64} color="var(--accent-purple)" style={{marginBottom: 20}} />
        <h1 style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font-almarai), sans-serif', marginBottom: 16 }}>الفيلم غير موجود</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 30, fontFamily: 'var(--font-almarai), sans-serif', fontSize: 16 }}>عذراً، لم يتم العثور على هذا الفيلم أو أنه غير متوفر حالياً.</p>
        <Link href="/movies">
          <button style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 36px', background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))', color: '#fff', border: 'none', borderRadius: 30, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-almarai), sans-serif', fontSize: 15, boxShadow: '0 8px 30px var(--glow-purple)' }}>
            <ArrowRight size={20} /> تصفح الأفلام
          </button>
        </Link>
      </div>
    );
  }

  const candidates = [...recent, ...topViews, ...topImdb];

  return <MovieClient movie={movie} candidates={candidates} />;
}
