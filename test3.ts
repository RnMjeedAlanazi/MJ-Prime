import axios from 'axios';

async function test() {
  const url1 = 'https://web2210x.faselhdx.best/series/%D9%85%D8%B3%D9%84%D8%B3%D9%84-euphoria-%D8%A7%D9%84%D9%85%D9%88%D8%B3%D9%85-%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A'; // original
  const url2 = 'https://web2210x.faselhdx.best/series/euphoria-2'; // somewhat stripped
  const url3 = 'https://web2210x.faselhdx.best/series/euphoria'; // extremely stripped

  try {
    const res1 = await axios.get(url1, { headers: { referer: 'https://web2210x.faselhdx.best' }, timeout: 5000 });
    console.log("Original works: ", res1.status);
  } catch (e: any) {
    console.log("Original fails", e.response?.status);
  }

  try {
    const res2 = await axios.get(url2, { headers: { referer: 'https://web2210x.faselhdx.best' }, timeout: 5000 });
    console.log("Stripped 1 works: ", res2.status);
  } catch (e: any) {
    console.log("Stripped 1 fails", e.response?.status);
  }

  try {
    const res3 = await axios.get(url3, { headers: { referer: 'https://web2210x.faselhdx.best' }, timeout: 5000 });
    console.log("Stripped 2 works: ", res3.status);
  } catch (e: any) {
    console.log("Stripped 2 fails", e.response?.status);
  }
}

test();
