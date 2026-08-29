const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const domPage = await browser.newPage();
    console.log("Navigating...");
    await domPage.goto('https://www.target.com/p/elmer-39-s-2pk-washable-school-glue-sticks-disappearing-purple/-/A-17088980', { waitUntil: 'domcontentloaded' });
    
    // Wait for hydration
    await new Promise(r => setTimeout(r, 2000));
    
    console.log("Evaluating...");
    const data = await domPage.evaluate(() => {
        let __NEXT_DATA__ = null;
        try {
            __NEXT_DATA__ = JSON.parse(document.getElementById('__NEXT_DATA__').innerText);
        } catch(e) {}
        
        return {
            hasNextData: !!__NEXT_DATA__,
            data: __NEXT_DATA__
        };
    });
    
    const fs = require('fs');
    fs.writeFileSync('next_data.json', JSON.stringify(data.data, null, 2));
    console.log("Saved next_data.json");
    await browser.close();
})();
