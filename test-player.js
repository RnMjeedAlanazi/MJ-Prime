const axios = require('axios');
const cheerio = require('cheerio');
const url = 'https://web22012x.faselhdx.best/video_player?player_token=TnE4QmxZOWthc1VkY2pSVTBxSzZkNmpnWHpzUlZHczNDODFFV3BSTnpZRGd5ZStVVmdxTlY2SGk2RFdwOW0vaUppTHU1bTZDd1YzOUtRMzk5UXNFQ3Ixei9aK2tRL201MytKYU41cnVRNldvZnJrMmRSVHdWZm53d1JLMUtzeUtTVnhJRlNoUUNDNFNueDFZTmdTN3dXV25DQnNRTk5UbEtXd2l2dFJ4cUdzdHBkajVnZllzYmdtVnZiZjRpdDNia1dudHM5emwvdFdVMStjVlJvaXlLdlpSdUF1TnFidXMxVG9qVkR1dVk0Zz06OhuqP0XiDcRZbTw02EDa53w%3D';

axios.get(url, { headers: { 'Referer': 'https://web22012x.faselhdx.best/', 'User-Agent': 'Mozilla/5.0' } }).then(r => {
    let html = r.data;
    const match = html.match(/file["\s:]+([^"]+)/);
    if(match) console.log("Regex match file:", match[1]);

    const m2 = html.match(/"([^"]+\.m3u8[^"]*)"/i);
    if(m2) console.log("Regex match m3u8:", m2[1]);
}).catch(e => console.error(e.message));
