const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    console.log("Navigating...");
    await page.goto('https://www.target.com/p/elmer-39-s-2pk-washable-school-glue-sticks-disappearing-purple/-/A-17088980', { waitUntil: 'networkidle2' });
    
    console.log("Evaluating...");
    const data = await page.evaluate(() => {
        const popovers = document.querySelectorAll('div[class*="ndsPopover"]');
        const qtyLists = document.querySelectorAll('ul[class*="Options_styles_options"]');
        
        let __NEXT_DATA__ = null;
        try {
            __NEXT_DATA__ = JSON.parse(document.getElementById('__NEXT_DATA__').innerText);
        } catch(e) {}
        
        return {
            popoversFound: popovers.length,
            qtyListsFound: qtyLists.length,
            hasNextData: !!__NEXT_DATA__
        };
    });
    
    console.log("Result:", data);
    await browser.close();
})();
