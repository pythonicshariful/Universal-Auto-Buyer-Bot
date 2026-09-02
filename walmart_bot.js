require('dotenv').config();
const crypto = require('crypto');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

class ProxyManager {
    constructor() {
        this.proxies = [];
    }
    
    updateProxies(proxyText) {
        if (!proxyText) {
            if (this.proxies.length !== 0) {
                console.log(`[ProxyManager] Proxies cleared from Dashboard.`);
                this.proxies = [];
                return true;
            }
            return false;
        }
        
        const newProxies = proxyText.split('\n')
            .map(p => p.trim())
            .filter(p => p && !p.startsWith('#'));
            
        if (newProxies.join(',') !== this.proxies.join(',')) {
            console.log(`[ProxyManager] Loaded ${newProxies.length} proxies from Dashboard API.`);
            this.proxies = newProxies;
            return true;
        }
        return false;
    }
    
    parseProxy(proxyStr) {
        let server = proxyStr;
        let username = null;
        let password = null;

        let cleanProxy = proxyStr.replace(/^https?:\/\//, '');

        if (cleanProxy.includes('@')) {
            const parts = cleanProxy.split('@');
            const auth = parts[0].split(':');
            username = auth[0];
            password = auth[1];
            server = parts[1];
        } else {
            const parts = cleanProxy.split(':');
            if (parts.length === 4) {
                server = `${parts[0]}:${parts[1]}`;
                username = parts[2];
                password = parts[3];
            } else {
                server = cleanProxy;
            }
        }
        return { server, username, password };
    }

    getRandomProxy() {
        if (this.proxies.length === 0) return null;
        const index = Math.floor(Math.random() * this.proxies.length);
        return this.parseProxy(this.proxies[index]);
    }
}

const proxyManager = new ProxyManager();

const API_HOST = process.env.API_HOST || "http://localhost:8000";
const API_URL = `${API_HOST}/api/walmart/products`;
const SETTINGS_URL = `${API_HOST}/api/settings`;
const BOT_API_KEY = process.env.BOT_API_KEY || "";

const apiClient = axios.create({
    headers: {
        "X-API-Key": BOT_API_KEY
    }
});

let config = {
    discordWebhookUrl: "",
    minDelay: 100,
    maxDelay: 200
};

async function fetchSettings() {
    try {
        const res = await apiClient.get(SETTINGS_URL);
        const data = res.data;
        config.discordWebhookUrl = data.discordWebhookUrl || config.discordWebhookUrl;
        config.minDelay = data.minDelay;
        config.maxDelay = data.maxDelay;
        
        return proxyManager.updateProxies(data.proxies);
    } catch (e) {
        console.error("Could not fetch settings from API:", e.message);
        return false;
    }
}

function getWaitTimeMs() {
    const minD = config.minDelay !== undefined && config.minDelay !== null ? config.minDelay : 100;
    const maxD = config.maxDelay !== undefined && config.maxDelay !== null ? config.maxDelay : 200;
    
    const minDelay = Math.max(0, minD);
    const maxDelay = Math.max(minDelay, maxD);
    return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const previousState = {};
let webhookDedupCache = {};

async function sendWebhook(title, productData, color = 0x00ff00) {
    if (!config.discordWebhookUrl) return;
    
    const now = Date.now();
    const dedupKey = `${title}_${productData.url}`;
    if (webhookDedupCache[dedupKey] && now - webhookDedupCache[dedupKey] < 60000) {
        return;
    }
    
    const payload = {
        embeds: [{
            title: title,
            url: productData.url,
            color: color,
            thumbnail: { url: productData.image_url },
            fields: [
                { name: 'Product', value: productData.name || 'Unknown', inline: false },
                { name: 'Price', value: productData.price ? `$${productData.price}` : 'Unknown', inline: true },
                { name: 'Status', value: productData.in_stock ? '✅ In Stock' : '❌ Out of Stock', inline: true }
            ],
            timestamp: new Date().toISOString()
        }]
    };

    try {
        await axios.post(config.discordWebhookUrl, payload);
        console.log("Walmart Webhook delivered successfully.");
        webhookDedupCache[dedupKey] = now;
    } catch (e) {
        console.error(`Error sending webhook:`, e.message);
    }
}

function computeFingerprint(data) {
    const obj = {
        price: data.price,
        in_stock: data.in_stock,
        name: data.name
    };
    return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

async function handleProduct(productUrl, page) {
    console.log(`Checking Walmart: ${productUrl}`);

    try {
        await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 35000 });
        await sleep(2000);

        const pageTitle = await page.title();
        if (['robot', 'human', 'verify', 'captcha', 'security'].some(s => pageTitle.toLowerCase().includes(s))) {
            console.log('  [ALERT] Walmart Bot detection page! Skipping this cycle.');
            return;
        }

        const dom = await page.evaluate(() => {
            let nextItem = {};
            try {
                const nd = JSON.parse(document.getElementById('__NEXT_DATA__').innerText);
                nextItem = nd?.props?.pageProps?.initialData?.data?.product || {};
            } catch(e) {}
            
            const html = document.documentElement.innerHTML.toLowerCase();
            
            // Stock: Out of stock check
            const oosText = ['out of stock', 'currently out of stock', 'not available'];
            const inStock = !oosText.some(t => html.includes(t));
            
            // Name
            const nameEl = document.querySelector('h1');
            
            // Price (Walmart usually puts price in itemprops or spans)
            const priceEl = document.querySelector('[itemprop="price"]') || document.querySelector('.price-characteristic');
            
            // Image
            const imgEl = document.querySelector('img[data-testid="hero-image"]');
            
            return {
                inStock,
                domName: nameEl?.innerText?.trim() || nextItem.name || null,
                domPrice: priceEl?.getAttribute('content') || priceEl?.innerText?.replace(/[^0-9.]/g, '') || null,
                domImg: imgEl?.src || null
            };
        });

        let price = dom.domPrice ? parseFloat(dom.domPrice) : null;
        if (isNaN(price)) price = null;

        const productData = {
            url: productUrl,
            name: dom.domName,
            price: price,
            in_stock: dom.inStock,
            image_url: dom.domImg,
            timestamp: new Date().toISOString()
        };

        const lastData = previousState[productUrl];
        if (lastData) {
            if (productData.name === null || productData.name === 'Unknown') productData.name = lastData.name;
            if (productData.price === null) productData.price = lastData.price;
            if (productData.image_url === null) productData.image_url = lastData.image_url;
        }

        console.log(`[Walmart] ${productData.name} | $${productData.price} | Stock: ${productData.in_stock}`);

        const fingerprint = computeFingerprint(productData);
        const lastFingerprint = lastData ? computeFingerprint(lastData) : null;

        try {
            await apiClient.post(`${API_URL}/update`, productData);
        } catch (e) {
            console.error("Failed to update Dashboard:", e.message);
        }

        if (!lastData) {
            console.log(`[STATE CHANGE] ✨ NEW WALMART LISTING ✨ - ${productData.name}`);
            await sendWebhook('✨ NEW WALMART LISTING ✨', productData, 0x0071ce);
            previousState[productUrl] = productData;
        } else if (fingerprint !== lastFingerprint) {
            let webhookTitle = '';
            let color = 0x00ff00;

            if (!lastData.in_stock && productData.in_stock) {
                webhookTitle = '🚨 WALMART RESTOCK DETECTED 🚨'; color = 0x00ff00;
            } else if (lastData.in_stock && !productData.in_stock) {
                webhookTitle = '⚠️ WALMART OUT OF STOCK ⚠️'; color = 0xff0000;
            } else if (lastData.price !== productData.price && productData.price) {
                webhookTitle = '💰 WALMART PRICE CHANGED 💰'; color = 0xffff00;
            }

            if (webhookTitle) {
                console.log(`[STATE CHANGE] ${webhookTitle} - ${productData.name}`);
                await sendWebhook(webhookTitle, productData, color);
            }
            previousState[productUrl] = productData;
        }
        
        await page.goto('about:blank');
    } catch (e) {
        console.error(`Error checking Walmart ${productUrl}:`, e.message);
    }
}

async function launchBrowser(profilePath) {
    const args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
    const proxy = proxyManager.getRandomProxy();
    
    if (proxy) {
        args.push(`--proxy-server=${proxy.server}`);
        console.log(`[Browser] Launching with proxy: ${proxy.server}`);
    } else {
        console.log(`[Browser] Launching without proxy (direct connection)`);
    }

    const launchOptions = {
        headless: profilePath ? false : 'new',
        args: args
    };
    
    if (profilePath) {
        launchOptions.userDataDir = profilePath;
        console.log(`[Browser] Launching with Chrome Profile: ${profilePath}`);
    }

    const browser = await puppeteer.launch(launchOptions);
    
    const page = await browser.newPage();
    
    if (proxy && proxy.username && proxy.password) {
        await page.authenticate({ username: proxy.username, password: proxy.password });
        console.log(`[Browser] Proxy authentication configured`);
    }
    
    return { browser, page };
}

async function runBot() {
    console.log("Starting Walmart Monitor...");
    await fetchSettings();
    let checkCount = 0;

    while (true) {
        await fetchSettings();
        
        let products = [];
        let profiles = [];
        try {
            const res = await apiClient.get(API_URL);
            products = res.data;
            const resProfiles = await apiClient.get(`${API_HOST}/api/chrome_profiles`);
            profiles = resProfiles.data;
        } catch(e) {
            console.error("Could not fetch data from API. Is FastAPI running?", e.message);
        }

        if (products.length === 0) {
            console.log("No Walmart products to monitor in database. Waiting...");
            await sleep(5000);
            continue;
        }

        const productUrls = products.map(p => p.url);
        for (const oldUrl of Object.keys(previousState)) {
            if (!productUrls.includes(oldUrl)) {
                console.log(`Removed tracking for: ${oldUrl}`);
                delete previousState[oldUrl];
            }
        }

        const productGroups = {};
        for (const p of products) {
            const pid = p.profile_id || 'default';
            if (!productGroups[pid]) productGroups[pid] = [];
            productGroups[pid].push(p);
        }

        for (const [pid, groupProducts] of Object.entries(productGroups)) {
            let profilePath = null;
            if (pid !== 'default') {
                const profile = profiles.find(pr => String(pr.id) === String(pid));
                if (profile) profilePath = profile.path;
            }

            console.log(`[Group] Processing ${groupProducts.length} product(s) for profile: ${pid} (${profilePath || 'Headless'})`);
            let session = null;
            try {
                session = await launchBrowser(profilePath);
                
                for (const p of groupProducts) {
                    await handleProduct(p.url, session.page);
                    checkCount++;
                    if (groupProducts.length > 1) await sleep(1500); 
                }
            } catch (e) {
                console.error(`Error processing profile group ${pid}:`, e.message);
            } finally {
                if (session && session.browser) {
                    await session.browser.close();
                }
            }
        }
        
        const waitTime = getWaitTimeMs();
        console.log(`Waiting ${(waitTime / 1000).toFixed(1)} seconds before next cycle...`);
        await sleep(waitTime);
    }
}

if (require.main === module) {
    runBot();
}
