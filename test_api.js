const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function run() {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    const tcin = '1001304528';
    console.log("Loading target.com...");
    await page.goto(`https://www.target.com/p/-/A-${tcin}`, { waitUntil: 'domcontentloaded' });
    
    console.log("Fetching Redsky API inside browser context...");
    try {
        const data = await page.evaluate(async (tcin) => {
            const url = `https://redsky.target.com/redsky_aggregations/v1/web/pdp_client_v1?key=ff457966e64d5e877fdbad070f276d18ecec4a01&tcin=${tcin}&store_id=3991&pricing_store_id=3991`;
            const res = await window.fetch(url, {
                headers: {
                    'accept': 'application/json'
                }
            });
            if (!res.ok) return { error: res.status };
            return await res.json();
        }, tcin);
        
        console.log("Result:", JSON.stringify(data).substring(0, 500));
    } catch(e) {
        console.error("Error:", e);
    }
    
    await browser.close();
}

run();
