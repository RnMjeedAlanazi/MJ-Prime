import * as cheerio from 'cheerio';
import { getBaseUrl } from './config';

async function getHeaders() {
  const baseUrl = await getBaseUrl();
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`,
  };
}

const RETRYABLE_STATUSES = [522, 521, 520, 502, 503, 504, 429];

async function retryGet(url: string, maxRetries = 3): Promise<{ data: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // Faster initial timeout
      
      const baseUrl = await getBaseUrl();
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
          'Cache-Control': 'no-cache',
          'Referer': baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`,
          'Upgrade-Insecure-Requests': '1',
        },
        signal: controller.signal,
        next: { revalidate: 3600 } 
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        if (RETRYABLE_STATUSES.includes(res.status)) {
            throw new Error(`Retryable status ${res.status}`);
        }
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.text();
      return { data };
      } catch (err: any) {
        if (attempt < maxRetries) {
          const wait = 500 * attempt;
          console.warn(`[scraper] Attempt ${attempt} failed for ${url}, retrying in ${wait}ms…`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        throw err;
      }
  }
  throw new Error('Max retries exceeded');
}

function processLink(href: string, baseUrl: string): { link: string; type: 'movie' | 'series' | 'episode' } {
  try {
    const url = new URL(href, baseUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    const slug = parts[parts.length - 1] || '';
    
    // Check if it's a page link ?p=
    if (url.searchParams.has('p')) {
        return { link: `/?p=${url.searchParams.get('p')}`, type: 'series' };
    }

    if (url.pathname.includes('/movies/')) return { link: `/movies/${slug}`, type: 'movie' };
    if (url.pathname.includes('/episodes/')) return { link: `/episodes/${slug}`, type: 'episode' };
    if (url.pathname.includes('/series/') || url.pathname.includes('/seasons/') || url.pathname.includes('/scategory/'))
      return { link: `/series/${slug}`, type: 'series' };
      
    // Default fallback
    return { link: url.pathname + url.search, type: 'movie' };
  } catch {
    return { link: href, type: 'movie' };
  }
}

export function cleanMediaTitle(title: string): string {
  // 1. Remove ratings like 8.5/10 or 8.5 (numbers with dots)
  let cleaned = title.replace(/\s*\d\.\d\s*(\/\s*10)?/g, ' ');

  // 2. Remove all Arabic characters and words
  cleaned = cleaned.replace(/[\u0600-\u06FF]+/g, ' ').trim();
  
  // 3. Remove extra spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // 4. If cleaning removed everything (e.g. title was only Arabic), revert to original but trimmed
  if (!cleaned) {
    cleaned = title.replace(/\s+/g, ' ').trim();
    // Re-apply basic removals if we had to revert
    cleaned = cleaned.replace(/^(مسلسل|فيلم)\s+/g, '');
    const seasonPattern = /الموسم (الأول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر|الحادي عشر|الثاني عشر|\d+)/g;
    cleaned = cleaned.replace(seasonPattern, '').trim();
  }

  return cleaned.replace(/\s+/g, ' ').trim();
}

// ===== Types =====
export interface MediaItem {
  title: string;
  link: string;
  poster: string;
  quality: string;
  rating: string;
  views: string;
  genre: string;
  type: 'movie' | 'series' | 'episode';
}

export interface SliderItem {
  title: string;
  description: string;
  link: string;
  poster: string;
  rating: string;
  views: string;
  genres: string[];
}

export interface EpisodeListItem {
  title: string;
  link: string;
  poster: string;
  status: string;
  episodeCount: string;
}

export interface HomePageData {
  slider: SliderItem[];
  latestMovies: MediaItem[];
  latestEpisodes: EpisodeListItem[];
  latestAsianEpisodes: MediaItem[];
  latestAnime: EpisodeListItem[];
  bestSeriesMonth: MediaItem[];
}

export interface GenreItem {
  name: string;
  link: string;
}

export interface MovieDetails {
  title: string;
  story: string;
  poster: string;
  iframeSource: string;
  genres: GenreItem[];
  year: string;
  rating: string;
  duration: string;
  quality: string;
  episodes?: { epTitle: string; epLink: string }[];
  seasons?: { title: string; link: string; poster: string; isActive?: boolean }[];
  seriesId?: string;
}

export interface EpisodeItem {
  epTitle: string;
  epLink: string;
}

export interface SeasonDetails {
  title: string;
  story: string;
  poster: string;
  episodes: EpisodeItem[];
  seasons: { title: string; link: string; poster: string; isActive?: boolean }[];
  genres: GenreItem[];
  year: string;
  rating: string;
  quality?: string;
  status?: string;
  country?: string;
  language?: string;
  watchLevel?: string;
  totalEpisodes?: string;
  seriesId?: string;
}

// ===== Scraper functions =====

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPostDiv($: cheerio.CheerioAPI, el: any): MediaItem | null {
  const imgPath = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
  const href = $(el).find('a').attr('href') || '';
  const rawTitle = $(el).find('img').attr('alt') || $(el).find('.title, .h5, .h4').first().text().trim();
  
  // High-precision quality extraction
  const candidates: string[] = [];
  $(el).find('.quality, .epCount').each((_, q) => {
    const text = $(q).text().trim();
    if (text) candidates.push(text);
  });

  // 1. Identification: Separate real quality from season/episode counts
  const badKeywords = ['موسم', 'مواسم', 'حلقة', 'حلقات', 'season', 'episode'];
  const qualityKeywords = ['hd', '1080', '720', '4k', 'uhd', 'bluray', 'bdrip', 'brrip', 'web', 'rip', 'cam', 'dvd', 'fhd', 'sd'];

  // Filter candidates that DEFINITELY look like video quality
  const bestQuality = candidates.find(c => {
    const low = c.toLowerCase();
    const hasBad = badKeywords.some(bk => low.includes(bk));
    const hasGood = qualityKeywords.some(gk => low.includes(gk));
    return !hasBad && hasGood;
  });

  // If no "best" found, try any candidate that doesn't have "bad" keywords
  const fallbackQuality = bestQuality || candidates.find(c => {
    const low = c.toLowerCase();
    return !badKeywords.some(bk => low.includes(bk));
  });

  // Final fallback to the first thing we found if all else fails
  const quality = fallbackQuality || candidates[0] || '';

  let rating = $(el).find('.bimdb, .pImdb').first().text().trim() || $(el).find('.fa-star').parent().text().trim();
  rating = rating.replace(/\/10.*/, '').trim();
  const views = $(el).find('.viewsWatch, .pViews').first().text().trim();
  const genreTags: string[] = [];
  $(el).find('.catName, .cat').each((_, g) => {
    const t = $(g).text().trim();
    if (t) genreTags.push(t);
  });
  const genre = genreTags.length > 0 ? genreTags.join(', ') : '';

  if (!rawTitle || !href || !imgPath) return null;
    const baseUrl = (global as any).currentBaseUrl || 'https://web22418x.faselhdx.best';
    const { link, type } = processLink(href, baseUrl);
    return {
      title: cleanMediaTitle(rawTitle),
      link, poster: imgPath, quality, rating, views, genre, type,
    };
}

export async function fetchFullHomePage(): Promise<HomePageData> {
  const result: HomePageData = {
    slider: [], latestMovies: [], latestEpisodes: [],
    latestAsianEpisodes: [], latestAnime: [], bestSeriesMonth: [],
  };

  try {
    const baseUrl = await getBaseUrl();
    (global as any).currentBaseUrl = baseUrl;
    const { data } = await retryGet(`${baseUrl}/main`);
    const $ = cheerio.load(data);

    // 1) Slider items (featured carousel)
    $('.mainslide .swiper-slide, .swiperSlider .swiper-slide').each((_, el) => {
      const href = $(el).find('a').attr('href') || '';
      const title = $(el).find('.slideTitle, h3, .title').first().text().trim();
      const desc = $(el).find('.slideDesc, .desc, p').first().text().trim();
      const poster = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
      const rating = $(el).find('.bimdb, .rating, .pImdb').first().text().trim() || $(el).find('.fa-star').parent().text().trim();
      const views = $(el).find('.viewsWatch, .views, .pViews').first().text().trim();
      const genres: string[] = [];
      $(el).find('.genres a, .catName, .cat').each((_, g) => {
        const t = $(g).text().trim();
        if (t) genres.push(t);
      });
      if (title && href) {
        const { link } = processLink(href, baseUrl);
        result.slider.push({ title: cleanMediaTitle(title), description: desc, link, poster, rating, views, genres });
      }
    });

    // 2) Latest Movies (آخر الأفلام المضافة)
    let movieSection = false;
    $('.secTitle, .sec-title, h2').each((_, el) => {
      const t = $(el).text().trim();
      if (t.includes('الأفلام المضافة') || t.includes('آخر الأفلام')) movieSection = true;
    });

    // Collect all .postDiv items - first batch = latest movies
    const allPosts: MediaItem[] = [];
    $('.postDiv').each((_, el) => {
      const item = extractPostDiv($, el);
      if (item) allPosts.push(item);
    });

    result.latestMovies = allPosts.filter(i => i.type === 'movie').slice(0, 20);

    // 3) Latest Episodes (آخر الحلقات المضافة)
    $('.epAll a[href*="/episodes/"], .lastEpisodes a[href*="/episodes/"]').each((_, el) => {
      const title = $(el).text().trim().replace(/\n\s+/g, ' ');
      const href = $(el).attr('href') || '';
      const poster = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
      const status = $(el).find('.epStatus, .status').first().text().trim();
      const epCount = $(el).find('.epCount').first().text().trim();
      if (title && href) {
        const { link } = processLink(href, baseUrl);
        result.latestEpisodes.push({ title: cleanMediaTitle(title), link, poster, status, episodeCount: epCount });
      }
    });

    // 4) Asian episodes
    result.latestAsianEpisodes = allPosts.filter(i => 
      i.genre.includes('كوري') || i.genre.includes('ياباني') || i.genre.includes('صيني') ||
      i.genre.includes('Romance') || i.genre.includes('Comedy')
    ).slice(0, 12);

    // 5) Best Series This Month (أفضل مسلسلات هذا الشهر)
    result.bestSeriesMonth = allPosts.filter(i => i.type === 'series').slice(0, 8);

    // 6) Anime
    $('.animeDiv a, a[href*="/anime"]').each((_, el) => {
      const title = $(el).text().trim().replace(/\n\s+/g, ' ');
      const href = $(el).attr('href') || '';
      const poster = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
      if (title && href && href.includes('/anime')) {
        const { link } = processLink(href, baseUrl);
        result.latestAnime.push({ title: cleanMediaTitle(title), link, poster, status: '', episodeCount: '' });
      }
    });

  } catch (error) {
    console.error('Failed to fetch home page:', error);
  }
  return result;
}

export async function fetchHomePage(): Promise<MediaItem[]> {
  const { latestMovies, bestSeriesMonth } = await fetchFullHomePage();
  return [...latestMovies, ...bestSeriesMonth];
}

export async function fetchCategoryPage(category: string, page: number = 1): Promise<MediaItem[]> {
  const pathMap: Record<string, string> = {
    movies: 'all-movies', series: 'series',
    'dubbed-movies': 'dubbed-movies', hindi: 'hindi',
    'asian-movies': 'asian-movies', 'anime-movies': 'anime-movies',
    'movies-top-imdb': 'movies_top_imdb', 'movies-top-views': 'movies_top_views',
    'series-top-views': 'series_top_views', 'series-top-imdb': 'series_top_imdb',
    'asian-series': 'asian-series', anime: 'anime',
    'recent-series': 'recent_series', 'short-series': 'short_series',
    tvshows: 'tvshows',
  };
  const path = pathMap[category] || category;
  const baseUrl = await getBaseUrl();
  const url = page === 1 ? `${baseUrl}/${path}` : `${baseUrl}/${path}/page/${page}`;

  // Short term cache for categories (10 mins)
  const cacheKey = `category_${category}_p${page}`;
  const { GlobalCache } = await import('./server-cache');
  const cached = await GlobalCache.get(cacheKey, 600);
  if (cached) return cached;

  try {
    const { data } = await retryGet(url);
    const $ = cheerio.load(data);
    const items: MediaItem[] = [];
    const elements = $('#postList').length > 0 ? $('#postList .postDiv') : $('.postDiv').not('.slider .postDiv');
    elements.each((_, el) => {
      const item = extractPostDiv($, el);
      if (item) items.push(item);
    });
    
    if (items.length > 0) {
      await GlobalCache.set(cacheKey, items);
    }
    return items;
  } catch (error) {
    console.error(`Failed to fetch ${category} page ${page}:`, error);
    return [];
  }
}

export async function fetchMovieDetails(slug: string): Promise<MovieDetails | null> {
  const baseUrl = await getBaseUrl();
  const decodedSlug = decodeURIComponent(slug);
  const url = encodeURI(`${baseUrl}/movies/${decodedSlug}`);
  try {
    const { data } = await retryGet(url);
    const $ = cheerio.load(data);
    const titleEl = $('.h1, h1, .title').first().clone();
    titleEl.find('span, blockquote, i, a').remove(); // Skip any extra metadata spans
    const rawTitle = titleEl.text().trim().replace(/\n\s+/g, ' ');
    const title = cleanMediaTitle(rawTitle);
    const story = $('.singleDesc p').text().trim();
    const poster = $('.posterImg img').attr('src') || $('.img-fluid').attr('src') || '';
    let iframeSource = ($('iframe[src*="video_player"]').attr('src') || '').replace('.xyz', '.best');
    if (iframeSource && !iframeSource.startsWith('http')) {
      iframeSource = baseUrl.replace(/\/$/, '') + (iframeSource.startsWith('/') ? iframeSource : '/' + iframeSource);
    }
    const genres: GenreItem[] = [];
    $('.catsSingle a, .singleInfoCats a, .col-xl-6:contains("تصنيف") a, .series-module__qYAgva__genre').each((_, el) => {
      const g = $(el).text().trim(); 
      if (g && !g.includes('تصنيف') && !genres.some(i => i.name === g)) {
        let href = $(el).attr('href') || $(el).parent('a').attr('href') || '';
        let link = '';
        if (href.includes('movies-cats') || href.includes('movies_cats')) {
          const parts = href.split('/').filter(Boolean);
          link = `/category/movies-cats___${parts[parts.length - 1]}`;
        } else if (href) {
          const parts = href.split('/').filter(Boolean);
          link = `/category/${parts[parts.length - 2]}___${parts[parts.length - 1]}`;
        } else {
          link = `/category/movies-cats___${encodeURIComponent(g)}`;
        }
        genres.push({ name: g, link });
      }
    });
    let year = '', duration = '', rating = '', quality = '';
    $('.singleInfoP, .singleInfoVal').each((_, el) => {
      const text = $(el).text().trim();
      const prev = $(el).prev().text().trim();
      if (prev.includes('سنة') || prev.includes('Year')) year = text;
      if (prev.includes('مدة') || prev.includes('Duration')) duration = text;
      if (prev.includes('IMDB') || prev.includes('التقييم')) rating = text;
      if (prev.includes('الجودة') || prev.includes('Quality')) quality = text;
    });
    if (!year) { const m = title.match(/\b(19|20)\d{2}\b/); if (m) year = m[0]; }
    if (!rating) rating = $('.bimdb, .imdb-rating, .singleStar strong').first().text().trim();
    if (!quality) quality = $('.quality').first().text().trim();
    
    rating = rating.replace(/\/10.*/, '').trim();
    return { title, story, poster, iframeSource, genres, year, rating, duration, quality };
  } catch (error) {
    console.error(`Failed to fetch movie details:`, error);
    return null;
  }
}

export async function fetchEpisodeIframeOnly(slug: string): Promise<{ iframeSource: string; title: string } | null> {
  const baseUrl = await getBaseUrl();
  const decodedSlug = decodeURIComponent(slug);
  const url = encodeURI(`${baseUrl}/episodes/${decodedSlug}`);
  try {
    const { data } = await retryGet(url);
    const $ = cheerio.load(data);
    
    // Quick extract just title and iframe, skip the rest
    const titleEl = $('.h1.title, h1.title, .h1, h1').first().clone();
    titleEl.find('span, blockquote, i, a').remove(); 
    const rawTitle = titleEl.text().trim().replace(/\n\s+/g, ' ');
    const title = cleanMediaTitle(rawTitle);

    let iframeSource = '';
    const activeOnclick = $('li.active[onclick]').attr('onclick') || $('li[onclick]').first().attr('onclick') || '';
    const onclickMatch = activeOnclick.match(/player_iframe\.location\.href\s*=\s*['"]([^'"]+)['"]/);
    if (onclickMatch) {
      iframeSource = onclickMatch[1].replace('.xyz', '.best');
    } else {
      iframeSource = ($('iframe[src*="video_player"]').attr('src') || '').replace('.xyz', '.best');
    }

    if (iframeSource && !iframeSource.startsWith('http')) {
      iframeSource = baseUrl.replace(/\/$/, '') + (iframeSource.startsWith('/') ? iframeSource : '/' + iframeSource);
    }

    return { title, iframeSource };
  } catch (error) {
    console.error(`Failed to fetch episode iframe only:`, error);
    return null;
  }
}

export async function fetchEpisodeDetails(slug: string): Promise<MovieDetails | null> {
  const baseUrl = await getBaseUrl();
  const decodedSlug = decodeURIComponent(slug);
  const url = encodeURI(`${baseUrl}/episodes/${decodedSlug}`);
  try {
    const { data } = await retryGet(url);
    const $ = cheerio.load(data);
    const titleEl = $('.h1.title, h1.title, .h1, h1').first().clone();
    titleEl.find('span, blockquote, i, a').remove(); // Remove rating tags or extra info
    const rawTitle = titleEl.text().trim().replace(/\n\s+/g, ' ');
    const title = cleanMediaTitle(rawTitle);
    const story = $('.singleDesc p').text().trim();
    let poster = $('.posterImg img').attr('src') || $('.img-fluid').attr('src') || '';

    // Player: extracted from onclick on server tabs
    let iframeSource = '';
    const activeOnclick = $('li.active[onclick]').attr('onclick') || $('li[onclick]').first().attr('onclick') || '';
    const onclickMatch = activeOnclick.match(/player_iframe\.location\.href\s*=\s*['"]([^'"]+)['"]/);
    if (onclickMatch) {
      iframeSource = onclickMatch[1].replace('.xyz', '.best');
    } else {
      iframeSource = ($('iframe[src*="video_player"]').attr('src') || '').replace('.xyz', '.best');
    }

    const genres: GenreItem[] = [];
    $('[class*="col-xl-6"] a[href*="series_genres"], .series-module__qYAgva__genre').each((_, el) => {
      const g = $(el).text().trim();
      if (g && !genres.some(i => i.name === g)) {
        let href = $(el).attr('href') || $(el).parent('a').attr('href') || '';
        let link = '';
        if (href.includes('series_genres') || href.includes('series-genres')) {
          const parts = href.split('/').filter(Boolean);
          link = `/category/series_genres___${parts[parts.length - 1]}`;
        } else if (href) {
          const parts = href.split('/').filter(Boolean);
          link = `/category/${parts[parts.length - 2]}___${parts[parts.length - 1]}`;
        } else {
          link = `/category/series_genres___${encodeURIComponent(g)}`;
        }
        genres.push({ name: g, link });
      }
    });

    let year = '';
    const m = title.match(/\b(19|20)\d{2}\b/); if (m) year = m[0];
    if (!year) year = $('[class*="col-xl-6"]:contains("موعد الصدور")').first().text().replace(/.*?:\s*/, '').trim().slice(0, 4);
    let rating = $('.bimdb, .imdb-rating, .singleStar strong').first().text().trim();
    rating = rating.replace(/\/10.*/, '').trim();
    const quality = $('[class*="col-xl-6"] a[href*="series_quality"]').first().text().trim() || $('.quality').first().text().trim();

    // Episodes list from .epAll
    const episodes: { epTitle: string; epLink: string }[] = [];
    $('.epAll a[href*="/episodes/"]').each((_, el) => {
      const epTitle = $(el).text().trim().replace(/\n\s+/g, ' ');
      const epHref = $(el).attr('href') || '';
      if (epTitle && epHref) {
        const epUrl = new URL(epHref, baseUrl);
        const parts = epUrl.pathname.split('/').filter(Boolean);
        const epSlug = parts[parts.length - 1] || '';
        episodes.push({ epTitle, epLink: epSlug ? `/episodes/${epSlug}` : '' });
      }
    });

    // Seasons list from .seasonDiv
    const seasons: { title: string; link: string; poster: string; isActive: boolean }[] = [];
    $('.seasonDiv').each((_, el) => {
      const sTitle = $(el).find('.title').text().trim();
      const sPoster = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
      const isActive = $(el).hasClass('active');
      const onClick = $(el).attr('onclick') || '';
      const match = onClick.match(/href\s*=\s*'([^']+)'/);
      
      let link = '';
      if (match) {
        link = match[1];
        if (link.startsWith('/?p=')) link = `/series/p-${link.split('=')[1]}`;
        else {
            const processed = processLink(link, baseUrl).link;
            link = processed.startsWith('/?p=') ? `/series/p-${processed.split('=')[1]}` : processed;
        }
      } else if (isActive) {
        link = '#';
      }

      if (sTitle && (match || isActive)) {
        seasons.push({ title: sTitle, poster: sPoster, link, isActive });
      }
    });

    // Update main poster to the latest season's poster 
    if (seasons.length > 0) {
      const latestSeasonWithPoster = seasons.slice().reverse().find(s => s.poster);
      if (latestSeasonWithPoster) {
        poster = latestSeasonWithPoster.poster;
      }
    }

    const seriesId = $('[class*="col-xl-6"]:contains("رقم المسلسل")').first().text().replace(/.*?#/, '').trim();

    return { title, story, poster, iframeSource, genres, year, rating, duration: '', quality, episodes, seasons, seriesId };
  } catch (error) {
    console.error(`Failed to fetch episode details:`, error);
    return null;
  }
}

export async function fetchSeasonDetails(slug: string): Promise<SeasonDetails | null> {
  const baseUrl = await getBaseUrl();
  const decodedSlug = decodeURIComponent(slug);
  let paths = [`${baseUrl}/seasons/${decodedSlug}`, `${baseUrl}/series/${decodedSlug}`, `${baseUrl}/scategory/${decodedSlug}`];
  if (decodedSlug.startsWith('p-')) {
    paths = [`${baseUrl}/?p=${decodedSlug.slice(2)}`];
  }

  let data = '';
  for (const url of paths) {
    try { data = (await retryGet(encodeURI(url))).data; break; } catch { continue; }
  }
  if (!data) return null;

  const $ = cheerio.load(data);
  const titleEl = $('.h1.title, h1.title, .h1, h1').first().clone();
  titleEl.find('span, blockquote, i, a').remove(); // Remove rating tags or extra info
  const rawTitle = titleEl.text().trim().replace(/\n\s+/g, ' ');
  const title = cleanMediaTitle(rawTitle);
  const story = $('.singleDesc p').text().trim();
  let poster = $('.img-fluid.posterImg').attr('src') || $('img.lazy.img-fluid').attr('data-src') || '';
  const genres: GenreItem[] = [];
  $('.catsSingle a, .singleInfoCats a, .col-xl-6:contains("تصنيف") a, .series-module__qYAgva__genre').each((_, el) => {
    const g = $(el).text().trim(); 
    if (g && !g.includes('تصنيف') && !genres.some(i => i.name === g)) {
      let href = $(el).attr('href') || $(el).parent('a').attr('href') || '';
      let link = '';
      if (href.includes('series_genres') || href.includes('series-genres')) {
        const parts = href.split('/').filter(Boolean);
        link = `/category/series_genres___${parts[parts.length - 1]}`;
      } else if (href) {
        const parts = href.split('/').filter(Boolean);
        link = `/category/${parts[parts.length - 2]}___${parts[parts.length - 1]}`;
      } else {
        link = `/category/series_genres___${encodeURIComponent(g)}`;
      }
      genres.push({ name: g, link });
    }
  });
  let year = $('.col-xl-6:contains("موعد الصدور")').first().text().replace(/.*?:/, '').trim();
  if (!year) {
    const m = title.match(/\b(19|20)\d{2}\b/);
    if (m) year = m[0];
  }

  let rating = $('.bimdb, .imdb-rating, .singleStar strong').first().text().trim();
  rating = rating.replace(/\/10.*/, '').trim();

  const quality = $('.col-xl-6:contains("جودة") a').first().text().trim();
  const status = $('.col-xl-6:contains("حالة") a').first().text().trim();
  const country = $('.col-xl-6:contains("دولة")').first().text().replace(/.*?:/, '').trim();
  const language = $('.col-xl-6:contains("لغة")').first().text().replace(/.*?:/, '').trim();
  const watchLevel = $('.col-xl-6:contains("مستوي المشاهدة") a').first().text().trim();
  
  let totalEpisodes = '';
  $('.col-xl-6').each((_, el) => {
    const text = $(el).text();
    if (text.includes('الحلقات') && !text.includes('جودة')) {
      const match = text.match(/\d+/);
      if (match) totalEpisodes = match[0];
    }
  });

  const seriesId = $('.col-xl-6:contains("رقم المسلسل")').first().text().replace(/.*?:/, '').trim();

  const episodes: EpisodeItem[] = [];
  $('.epAll a, .episodes-list a, .epDiv a, a[href*="/episodes/"]').each((_, el) => {
    const epTitle = $(el).text().trim().replace(/\n\s+/g, ' ') || $(el).find('.title').text().trim();
    const epLinkRaw = $(el).attr('href');
    if (epTitle && epLinkRaw && epLinkRaw.includes('/episodes/')) {
      const epUrl = new URL(epLinkRaw, baseUrl);
      const parts = epUrl.pathname.split('/').filter(Boolean);
      const epSlug = parts[parts.length - 1] || '';
      episodes.push({ epTitle, epLink: epSlug ? `/episodes/${epSlug}` : '' });
    }
  });

  const seasons: { title: string; link: string; poster: string; isActive: boolean }[] = [];
  $('.seasonDiv').each((_, el) => {
    const sTitle = $(el).find('.title').text().trim();
    const sPoster = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
    const isActive = $(el).hasClass('active');
    const onClick = $(el).attr('onclick');
    const match = onClick?.match(/href\s*=\s*'([^']+)'/);
    
    let link = '';
    if (match) {
       link = match[1];
       if (link.startsWith('/?p=')) link = `/series/p-${link.split('=')[1]}`;
       else {
           const processed = processLink(link, baseUrl).link;
           link = processed.startsWith('/?p=') ? `/series/p-${processed.split('=')[1]}` : processed;
       }
    } else if (isActive) {
       link = '#';
    }

    if (sTitle && (match || isActive)) {
       seasons.push({ title: sTitle, poster: sPoster, link, isActive });
    }
  });

  // Automatically update poster to the latest season's poster
  if (seasons.length > 0) {
    const latestSeasonWithPoster = seasons.slice().reverse().find(s => s.poster);
    if (latestSeasonWithPoster) {
      poster = latestSeasonWithPoster.poster;
    }
  }

  return { title, story, poster, genres, year, rating, quality, status, country, language, watchLevel, totalEpisodes, episodes, seasons, seriesId };
}

export async function fetchFilteredSeries(filters: { 
  category?: string; 
  quality?: string; 
  status?: string; 
  type?: string; 
  page?: number 
}): Promise<MediaItem[]> {
  const baseUrl = await getBaseUrl();
  const url = `${baseUrl}/wp-admin/admin-ajax.php`;
  
  const body = `categoryfilter=${filters.category || ''}&yearfilter=&qualityfilter=${filters.quality || ''}&statusfilter=${filters.status || ''}&typesfilter=${filters.type || ''}&countryfilter=&action=fillter_all_series${filters.page && filters.page > 1 ? `&pagenum=${filters.page}` : ''}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': baseUrl,
        'Referer': `${baseUrl}/series/`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Sec-CH-UA': '"Not:A-Brand";v="99", "Chromium";v="121", "Google Chrome";v="121"',
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
      },
      body: body,
    });

    if (!res.ok) {
        const errText = await res.text();
        console.error(`Series Ajax ${res.status} details: ${errText} | Body: ${body}`);
        return [];
    }
    const html = await res.text();
    if (html === '0' || !html.trim()) {
      return [];
    }
    const $ = cheerio.load(html);
    const items: MediaItem[] = [];
    
    // Ajax response often lacks the <html> tags, treat as a fragment
    $('.postDiv').each((_, el) => {
        const item = extractPostDiv($, el);
        if (item) items.push(item);
    });

    if (items.length === 0) {
        // Fallback for direct elements
        const fragment = cheerio.load(`<div>${html}</div>`);
        fragment('.postDiv').each((_, el) => {
            const item = extractPostDiv(fragment as any, el);
            if (item) items.push(item);
        });
    }

    return items;
  } catch (error) {
    console.error('Ajax series filter failed:', error);
    return [];
  }
}

export async function fetchFilteredMovies(filters: { 
  category?: string; 
  year?: string; 
  quality?: string; 
  type?: string; 
  country?: string; 
  page?: number 
}): Promise<MediaItem[]> {
  const baseUrl = await getBaseUrl();
  const url = `${baseUrl}/wp-admin/admin-ajax.php`;
  
  const body = `typefilter=none&categoryfilter=${filters.category || ''}&yearsfilter=${filters.year || ''}&qualityfilter=${filters.quality || ''}&typesfilter=${filters.type || ''}&countryfilter=${filters.country || ''}&action=fillter_all_movies${filters.page && filters.page > 1 ? `&pagenum=${filters.page}` : ''}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': baseUrl,
        'Referer': `${baseUrl}/all-movies/`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Sec-CH-UA': '"Not:A-Brand";v="99", "Chromium";v="121", "Google Chrome";v="121"',
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
      },
      body: body,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Movie Ajax ${res.status} details: ${errText} | Body: ${body}`);
      return [];
    }
    const html = await res.text();
    if (html === '0' || !html.trim()) {
      return [];
    }
    const $ = cheerio.load(html);
    const items: MediaItem[] = [];
    
    $('.postDiv').each((_, el) => {
        const item = extractPostDiv($, el);
        if (item) items.push(item);
    });

    if (items.length === 0) {
        const fragment = cheerio.load(`<div>${html}</div>`);
        fragment('.postDiv').each((_, el) => {
            const item = extractPostDiv(fragment as any, el);
            if (item) items.push(item);
        });
    }

    return items;
  } catch (error) {
    console.error('Ajax movie filter failed:', error);
    return [];
  }
}

export async function searchMedia(query: string, page: number = 1): Promise<MediaItem[]> {
  const baseUrl = await getBaseUrl();
  const url = page === 1 
    ? `${baseUrl}/?s=${encodeURIComponent(query)}` 
    : `${baseUrl}/page/${page}/?s=${encodeURIComponent(query)}`;

  try {
    const { data } = await retryGet(url);
    const $ = cheerio.load(data);
    const items: MediaItem[] = [];
    $('.postDiv').each((_, el) => {
      const item = extractPostDiv($, el);
      if (item) items.push(item);
    });
    return items;
  } catch (error) {
    console.error(`Failed to search for "${query}":`, error);
    return [];
  }
}
