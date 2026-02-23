import { fetchEpisodeDetails } from './src/lib/scraper';

async function run() {
  const result = await fetchEpisodeDetails('مسلسل-love-story-الموسم-الأول-الحلقة-4');
  console.log(JSON.stringify(result, null, 2));
}

run();
