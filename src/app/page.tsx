import { fetchCategoryPage } from '@/lib/scraper';
import styles from './page.module.css';
import Link from 'next/link';
import { Play, Info, Star } from 'lucide-react';
import Row from './components/Row';

import HeroSlider from './components/HeroSlider';
import RecommendationRow from './components/RecommendationRow';

export const revalidate = 240; // Revalidate every 4 minutes

export default async function Home() {
  const [movies, series, topMovies, topSeries, topImdbMovies, topImdbSeries, recentSeries] = await Promise.all([
    fetchCategoryPage('movies', 1),
    fetchCategoryPage('series', 1),
    fetchCategoryPage('movies-top-views', 1),
    fetchCategoryPage('series-top-views', 1),
    fetchCategoryPage('movies-top-imdb', 1),
    fetchCategoryPage('series-top-imdb', 1),
    fetchCategoryPage('recent-series', 1),
  ]);

  // Combine top movies and top series
  const candidates = [...topMovies, ...topSeries, ...movies, ...series].filter(m => m.poster && m.title);
  
  // Ensure uniqueness by Link to prevent duplicate slides
  const uniqueUrls = new Set<string>();
  const uniqueCandidates = candidates.filter(item => {
    if (uniqueUrls.has(item.link)) return false;
    uniqueUrls.add(item.link);
    return true;
  });

  // Randomize (shuffle) and pick 5 items 
  const heroItems = uniqueCandidates.sort(() => 0.5 - Math.random()).slice(0, 5);

  return (
    <div className={styles.page}>
      
      {/* Dynamic Animated Hero Slider */}
      <HeroSlider items={heroItems} />

      <RecommendationRow candidates={uniqueCandidates} />

      <Row title="أحدث الحلقات"                  link="/category/recent-series"     items={recentSeries.slice(0, 15)}  />
      <Row title="المسلسلات الأكثر مشاهدة هذا الأسبوع"  link="/category/series-top-views"  items={topSeries.slice(0, 15)}    numbered />
      <Row title="الأفلام الأكثر مشاهدة هذا الأسبوع"    link="/category/movies-top-views"  items={topMovies.slice(0, 15)}     numbered />
      <Row title="الأفلام"                        link="/movies"                      items={movies.slice(0, 15)}        />
      <Row title="المسلسلات"                link="/series"                      items={series.slice(0, 15)}        />
      <Row title="الأفلام الأعلى تقييماً في IMDB"      link="/category/movies-top-imdb"   items={topImdbMovies.slice(0, 15)} />
      <Row title="المسلسلات الأعلى تقييماً في IMDB"    link="/category/series-top-imdb"   items={topImdbSeries.slice(0, 15)} />


      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.fLogo}>بوس الواوا</div>
          <div className={styles.fLinks}>
            <Link href="/movies">أفلام</Link>
            <Link href="/series">مسلسلات</Link>
            <Link href="/category/anime">أنمي</Link>
            <Link href="/category/asian-series">آسيوي</Link>
            <Link href="/category/movies-top-imdb">الأعلى تقييماً</Link>
          </div>
          <p className={styles.fCopy}>© 2026 FaselHD - جميع الحقوق محفوظة. تم إعادة التصميم بواسطة الذكاء الاصطناعي.</p>
        </div>
      </footer>
    </div>
  );
}
