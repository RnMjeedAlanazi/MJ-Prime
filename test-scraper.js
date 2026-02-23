const axios = require('axios');
const cheerio = require('cheerio');

async function testFetch(url) {
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    });
    const $ = cheerio.load(data);
    
    // Check for standard items
    const items = [];
    $('.postDiv').each((i, el) => {
      // Find title
      const title = $(el).find('.postInner .h5, .postInner .title').text().trim() || $(el).find('.postInner').text().trim();
      const link = $(el).find('a').attr('href');
      const poster = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');
      
      const quality = $(el).find('.quality').text().trim() || $(el).find('.epCount').text().trim();
      
      if (title && link) {
        items.push({ title: title.replace(/\n\s+/g, ' '), link, poster, quality });
      }
    });

    console.log(`URL: ${url}`);
    console.log(`Found ${items.length} items`);
    if(items.length > 0) {
      console.log('Sample item:', items[0]);
    }

  } catch (e) {
    console.error('Error fetching', url, e.message);
  }
}

testFetch('https://web22012x.faselhdx.best/all-movies');
testFetch('https://web22012x.faselhdx.best/series');
