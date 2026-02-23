const axios = require('axios');
const cheerio = require('cheerio');
const headers = { 'User-Agent': 'Mozilla/5.0' };

async function m() {
    const slug = '1-1فيلم-kings-man-2021-مترجم';
    let url = encodeURI(`https://web22012x.faselhdx.best/movies/${slug}`);
    console.log(url);
    try {
        const { data } = await axios.get(url, { headers });
        const $ = cheerio.load(data);
        console.log($('title').text());
    } catch(e) {
        console.error(e.message);
    }
}
m();
