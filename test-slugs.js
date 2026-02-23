const axios = require('axios');
const cheerio = require('cheerio');
const headers = { 'User-Agent': 'Mozilla/5.0' };

async function m() {
    let slug = '1-1%d9%81%d9%8a%d9%84%d9%85-kings-man-2021-%d9%85%d8%aa%d8%b1%d8%ac%d9%85';
    // Let's decode it first just to see what Next.js gets
    try {
      slug = decodeURIComponent(slug);
    } catch(e) {}
    
    // Now let's try the fetch
    const url = encodeURI(`https://web22012x.faselhdx.best/movies/${slug}`);
    console.log('Fetching:', url);
    try {
        const { data } = await axios.get(url, { headers });
        const $ = cheerio.load(data);
        console.log($('title').text());
    } catch(e) {
        console.error('Movies Error:', e.message);
    }

    // Series test
    let slug2 = '%d9%85%d8%b3%d9%84%d8%b3%d9%84-euphoria-%d8%a7%d9%84%d9%85%d9%88%d8%b3%d9%85-%d8%a7%d9%84%d8%a3%d9%88%d9%84';
    try { slug2 = decodeURIComponent(slug2); } catch(e) {}
    const urlsToTry = [
      `https://web22012x.faselhdx.best/seasons/${slug2}`,
      `https://web22012x.faselhdx.best/series/${slug2}`,
      `https://web22012x.faselhdx.best/scategory/${slug2}`,
      `https://web22012x.faselhdx.best/${slug2}`
    ];
    
    for(let u of urlsToTry) {
        const fetchUrl = encodeURI(u);
        console.log('Trying:', fetchUrl);
        try {
            const { data } = await axios.get(fetchUrl, { headers });
            console.log('SUCCESS for:', fetchUrl);
            break;
        } catch(e) {
            console.error('Failed:', e.message);
        }
    }
}
m();
