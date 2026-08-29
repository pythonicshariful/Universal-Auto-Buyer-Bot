const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    console.log("Navigating to Elmer's Glue...");
    await page.goto('https://www.target.com/p/elmer-39-s-2pk-washable-school-glue-sticks-disappearing-purple/-/A-17088980', { waitUntil: 'networkidle2' });
    
    await page.screenshot({ path: 'target_debug.png' });
    
    const domInfo = await page.evaluate(() => {
        const oosText = document.body.innerText.toLowerCase().includes('out of stock');
        const atcBtn = document.querySelector('button[data-test="shippingButton"]');
        const h1 = document.querySelector('h1');
        return {
            title: h1 ? h1.innerText : 'No H1',
            oosText,
            atcBtnFound: !!atcBtn,
            atcBtnDisabled: atcBtn ? atcBtn.disabled : null,
            atcText: atcBtn ? atcBtn.innerText : null,
            bodyPreview: document.body.innerText.substring(0, 200)
        };
    });
    
    console.log("DOM Info:", domInfo);
    
    await browser.close();
})();
