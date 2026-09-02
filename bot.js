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
        // Handle format: ip:port:user:pass or user:pass@ip:port
        let server = proxyStr;
        let username = null;
        let password = null;

        // Remove http:// or https://
        let cleanProxy = proxyStr.replace(/^https?:\/\//, '');

        if (cleanProxy.includes('@')) {
            // format: user:pass@ip:port
            const parts = cleanProxy.split('@');
            const auth = parts[0].split(':');
            username = auth[0];
            password = auth[1];
            server = parts[1];
        } else {
            const parts = cleanProxy.split(':');
            if (parts.length === 4) {
                // format: ip:port:user:pass
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

    getRandomProxyAgent() {
        const proxy = this.getRandomProxy();
        if (!proxy) return null;
        let authString = '';
        if (proxy.username && proxy.password) {
            authString = `${proxy.username}:${proxy.password}@`;
        }
        return new HttpsProxyAgent(`http://${authString}${proxy.server}`);
    }
}

const proxyManager = new ProxyManager();

const API_HOST = process.env.API_HOST || "http://localhost:8000";
const API_URL = `${API_HOST}/api/products`;
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
        
        // Update proxies from API and return whether they changed
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
let consecutiveErrors = 0;

async function sendWebhook(title, productData, color = 0x00ff00) {
    if (!config.discordWebhookUrl) return;
    
    // Dedup: prevent duplicate messages for the same URL within 60s
    const now = Date.now();
    const dedupKey = `${title}_${productData.url}`;
    if (webhookDedupCache[dedupKey] && now - webhookDedupCache[dedupKey] < 60000) {
        console.log(`[Dedup] Skipping duplicate webhook for ${title}`);
        return;
    }
    
    // Dry-run mode
    if (process.argv.includes('--dry-run') || config.dryRun) {
        console.log(`[Dry-Run] Would send webhook: ${title}`);
        webhookDedupCache[dedupKey] = now;
        return;
    }

    const payload = {
        embeds: [{
            title: title,
            url: productData.url,
            color: color,
            thumbnail: { url: productData.image_url || productData.imageUrl },
            fields: [
                { name: 'Product', value: productData.name || 'Unknown', inline: false },
                { name: 'Price', value: productData.price ? `$${productData.price}` : 'Unknown', inline: true },
                { name: 'Status', value: productData.in_stock ? '✅ In Stock' : '❌ Out of Stock', inline: true },
                { name: 'TCIN', value: productData.tcin || 'Unknown', inline: true },
                { name: 'DPCI', value: productData.dpci || 'Unknown', inline: true },
                { name: 'UPC', value: productData.upc || 'Unknown', inline: true },
                { name: 'Limit', value: productData.purchase_limit || 'None', inline: true },
                { name: 'Cart Link', value: productData.atc_url ? `[Add to Cart](${productData.atc_url})` : 'N/A', inline: false }
            ],
            timestamp: new Date().toISOString()
        }]
    };

    let retries = 5;
    let delay = 2000;
    while (retries > 0) {
        try {
            await axios.post(config.discordWebhookUrl, payload);
            console.log("Webhook delivered successfully.");
            webhookDedupCache[dedupKey] = now;
            consecutiveErrors = 0; // Reset errors on success
            return;
        } catch (e) {
            consecutiveErrors++;
            console.error(`Error sending webhook (${retries} retries left):`, e.message);
            
            // Emergency stop
            if (consecutiveErrors > 10 && !process.env.TESTING) {
                console.error("[EMERGENCY STOP] Too many consecutive network errors. Halting.");
                process.exit(1);
            }
            
            retries--;
            if (retries > 0) {
                console.log(`Waiting ${delay}ms before retrying webhook...`);
                await sleep(delay);
                delay *= 2; // exponential backoff
            } else {
                console.error("Failed to deliver webhook after multiple attempts.");
            }
        }
    }
}

function computeFingerprint(data) {
    const obj = {
        price: data.price,
        in_stock: data.in_stock,
        name: data.name,
        dpci: data.dpci,
        upc: data.upc,
        purchase_limit: data.purchase_limit
    };
    return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

function extractTcin(url) {
    const match = url.match(/\/-?\/?A-(\d+)/);
    return match ? match[1] : null;
}

function diagnoseApiResponse(data) {
    let hasStock = false;
    let hasLimit = false;
    let hasPrice = false;
    let missingFields = [];

    const product_data = data?.data?.product || {};
    const price_info = product_data.price || {};
    const fulfillment = product_data.fulfillment || {};
    const shipping = fulfillment.shipping_options || {};

    if (shipping.availability_status) {
        hasStock = true;
    } else {
        missingFields.push('shipping.availability_status');
    }

    if (shipping.max_order_qty !== undefined && shipping.max_order_qty !== null) {
        hasLimit = true;
    } else {
        missingFields.push('shipping.max_order_qty');
    }

    if (price_info.current_retail !== undefined && price_info.current_retail !== null) {
        hasPrice = true;
    } else {
        missingFields.push('price.current_retail');
    }

    let summary = `Stock:${hasStock} Limit:${hasLimit} Price:${hasPrice}`;
    if (missingFields.length > 0) {
        summary += ` | Missing: ${missingFields.join(', ')}`;
    }

    return { hasStock, hasLimit, hasPrice, missingFields, summary, shippingData: shipping };
}

function deepFind(obj, key) {
    if (!obj || typeof obj !== 'object') return undefined;
    if (key in obj) return obj[key];
    for (const k of Object.keys(obj)) {
        const r = deepFind(obj[k], key);
        if (r !== undefined) return r;
    }
    return undefined;
}

async function handleProduct(productUrl, page, client) {
    const tcin = extractTcin(productUrl);
    if (!tcin) return;

    console.log(`Checking: ${productUrl}`);

    // Capture both Redsky PDP and Sapphire responses
    let redskyData = null;
    let sapphireData = null;

    const responseHandler = async (event) => {
        const { requestId, response } = event;
        const url = response.url;
        const isRedsky = url.includes('redsky_aggregations/v1/web/pdp_client_v1');
        const isSapphire = url.includes('sapphire-api.target.com') && url.includes('/raw/');

        if (isRedsky || isSapphire) {
            try {
                const rb = await client.send('Network.getResponseBody', { requestId });
                const body = rb.base64Encoded ? Buffer.from(rb.body, 'base64').toString() : rb.body;
                const parsed = JSON.parse(body);
                if (isRedsky) { redskyData = parsed; console.log(`  [CDP] Captured Redsky PDP`); }
                if (isSapphire) { sapphireData = parsed; console.log(`  [CDP] Captured Sapphire`); }
            } catch (e) {}
        }
    };

    client.on('Network.responseReceived', responseHandler);

    try {
        await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 35000 });
        await sleep(2000); // Allow async API calls to resolve
        client.off('Network.responseReceived', responseHandler);

        const pageTitle = await page.title();
        console.log(`  [Debug] Title: "${pageTitle}" | Redsky: ${!!redskyData} | Sapphire: ${!!sapphireData}`);

        if (['access denied','just a moment','robot'].some(s => pageTitle.toLowerCase().includes(s))) {
            await page.screenshot({ path: 'blocked_page.png' });
            console.log('  [ALERT] Bot detection page! Screenshot saved.');
        }

        // --- Extract from Sapphire first (most complete: name, dpci, upc, image) ---
        let name = null, dpci = null, upc = null, imageUrl = null;
        let price = null, in_stock = false, limit = null;

        if (sapphireData) {
            name = deepFind(sapphireData, 'title') || deepFind(sapphireData, 'product_title');
            dpci = deepFind(sapphireData, 'dpci');
            upc = deepFind(sapphireData, 'primary_barcode') || deepFind(sapphireData, 'upc');
            imageUrl = deepFind(sapphireData, 'primary_image_url');
            const rawPrice = deepFind(sapphireData, 'current_retail') || deepFind(sapphireData, 'formatted_current_price');
            if (rawPrice) price = parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) || null;
            const stockStatus = deepFind(sapphireData, 'availability_status');
            if (stockStatus) in_stock = ['IN_STOCK','LIMITED'].includes(stockStatus.toUpperCase());
            const maxQty = deepFind(sapphireData, 'max_order_qty');
            if (maxQty != null) limit = String(maxQty);
        }

        // --- Fill gaps from Redsky PDP ---
        if (redskyData?.data?.product) {
            const pd = redskyData.data.product;
            const item = pd.item || {};
            const pi = pd.price || {};
            const ship = (pd.fulfillment?.shipping_options) || {};
            if (!name) name = item.product_description?.title;
            if (!dpci) dpci = item.dpci;
            if (!upc) upc = item.primary_barcode;
            if (!imageUrl) imageUrl = item.enrichment?.images?.primary_image_url;
            if (!price && pi.current_retail) price = parseFloat(pi.current_retail);
            if (!limit && ship.max_order_qty != null) limit = String(ship.max_order_qty);
            if (!sapphireData && ship.availability_status) {
                in_stock = ['IN_STOCK','LIMITED'].includes(ship.availability_status.toUpperCase());
            }
        }

        // --- DOM fallbacks ---
        const dom = await page.evaluate(() => {
            // __NEXT_DATA__ (legacy, may be empty on CDUI pages)
            let nextItem = {};
            try {
                const nd = JSON.parse(document.getElementById('__NEXT_DATA__').innerText);
                nextItem = nd?.props?.pageProps?.initialData?.data?.product?.item || {};
            } catch(e) {}

            const html = document.documentElement.innerHTML;

            // Stock: "Out of stock" span is the most reliable DOM indicator
            const inStock = !html.includes('Out of stock');

            // Name
            const nameEl = document.querySelector('[data-test="product-title"]') ||
                           document.querySelector('h1[class*="Heading"]') ||
                           document.querySelector('h1');

            // Price
            const priceEl = document.querySelector('[data-test="product-price"]');

            // Image
            const imgEl = document.querySelector('[data-test="product-image"] img') ||
                          document.querySelector('div[data-module-type="ProductDetailImageGallery"] img');

            // DPCI pattern in page HTML
            const dpciM = html.match(/["']dpci["']\s*:\s*["']([0-9\-]+)["']/);
            const upcM = html.match(/["']primary_barcode["']\s*:\s*["']([0-9]+)["']/);

            return {
                inStock,
                domName: nameEl?.innerText?.trim() || null,
                domPrice: priceEl?.innerText?.replace(/[^0-9.]/g, '') || null,
                domImg: imgEl?.src || null,
                domDpci: dpciM?.[1] || nextItem.dpci || null,
                domUpc: upcM?.[1] || nextItem.primary_barcode || null,
                nextName: nextItem.product_description?.title || null,
                nextImg: nextItem.enrichment?.images?.primary_image_url || null,
            };
        });

        // Always trust DOM for stock status (most reliable)
        in_stock = dom.inStock;

        // Apply DOM fallbacks for any still-missing fields
        if (!name) name = dom.domName || dom.nextName;
        if (!dpci) dpci = dom.domDpci;
        if (!upc) upc = dom.domUpc;
        if (!imageUrl) imageUrl = dom.domImg || dom.nextImg;
        if (!price && dom.domPrice) price = parseFloat(dom.domPrice) || null;

        // --- Purchase limit: try API first, then DOM qty dropdown ---
        // Check if Sapphire/Redsky already gave us max_order_qty
        if (!limit && redskyData?.data?.product?.fulfillment?.shipping_options?.max_order_qty != null) {
            limit = String(redskyData.data.product.fulfillment.shipping_options.max_order_qty);
        }

        // Fall back to clicking the Qty dropdown button
        if (in_stock && !limit) {
            try {
                // Use page.evaluate to do a JS click — bypasses Puppeteer's visibility check in headless mode
                const limitResult = await page.evaluate(() => {
                    return new Promise((resolve) => {
                        // Find the Qty button by id prefix or class name
                        const btn = document.querySelector('button[id^="select-"]') ||
                                    document.querySelector('button[class*="selectCustomButton"]');

                        if (!btn) return resolve(null);

                        // Listen for the popover to appear
                        const observer = new MutationObserver(() => {
                            const sels = [
                                'ul[class*="Options_styles_options"] li a[aria-label]',
                                'ul[class*="Options_"] li a[aria-label]',
                                'a[class*="OptionItem_styles_optionItem"][aria-label]'
                            ];
                            let items = [];
                            for (const s of sels) {
                                items = [...document.querySelectorAll(s)];
                                if (items.length > 0) break;
                            }
                            if (items.length > 0) {
                                observer.disconnect();
                                // Find the highest numeric aria-label = purchase limit
                                let max = 0;
                                items.forEach(o => {
                                    const v = parseInt(o.getAttribute('aria-label'), 10);
                                    if (!isNaN(v) && v > max) max = v;
                                });
                                resolve(max > 0 ? String(max) : null);
                            }
                        });

                        // Observe DOM for popover insertion
                        observer.observe(document.body, { childList: true, subtree: true });

                        // Trigger click (bypasses Puppeteer visibility requirement)
                        btn.click();

                        // Timeout fallback — resolve null after 4s if popover never appears
                        setTimeout(() => { observer.disconnect(); resolve(null); }, 4000);
                    });
                });

                limit = limitResult;
                if (limit) {
                    console.log(`  [Limit] Dropdown max qty: ${limit}`);
                } else {
                    console.log(`  [Limit] No qty dropdown found or no limit set`);
                }

                // Close any open popover
                await page.keyboard.press('Escape');
            } catch (e) {
                console.log(`  [Limit] Dropdown read failed: ${e.message}`);
            }
        }

        await page.goto('about:blank');

        const productData = {
            url: productUrl,
            name: name || null,
            price: price || null,
            tcin: tcin,
            dpci: dpci || null,
            upc: upc || null,
            in_stock,
            image_url: imageUrl || null,
            atc_url: `https://www.target.com/cart?item=${tcin}`,
            purchase_limit: limit || null,
            timestamp: new Date().toISOString()
        };

        const lastData = previousState[productUrl];
        if (lastData) {
            // Carry forward cached metadata if current check is null/partial
            if (productData.purchase_limit === null) productData.purchase_limit = lastData.purchase_limit;
            if (productData.dpci === null) productData.dpci = lastData.dpci;
            if (productData.upc === null) productData.upc = lastData.upc;
            if (productData.name === null || productData.name === 'Unknown') productData.name = lastData.name;
            if (productData.price === null) productData.price = lastData.price;
            if (productData.image_url === null) productData.image_url = lastData.image_url;
        }

        console.log(`[${new Date().toLocaleTimeString()}] ${productData.name} | $${productData.price} | Stock: ${productData.in_stock} | DPCI: ${productData.dpci} | UPC: ${productData.upc} | Limit: ${productData.purchase_limit}`);

        const fingerprint = computeFingerprint(productData);
        const lastFingerprint = lastData ? computeFingerprint(lastData) : null;

        // Send to dashboard DB
        try {
            await apiClient.post(`${API_URL}/update`, productData);
        } catch (e) {
            console.error("Failed to update Dashboard:", e.message);
        }

        // Webhook notifications
        if (!lastData) {
            console.log(`Initial state logged for TCIN ${productData.tcin}.`);
            console.log(`[STATE CHANGE] ✨ NEW LISTING ✨ - ${productData.name}`);
            await sendWebhook('✨ NEW LISTING ✨', productData, 0x9b59b6);
            previousState[productUrl] = productData;
        } else if (fingerprint !== lastFingerprint) {
            let webhookTitle = '';
            let color = 0x00ff00;

            if (!lastData.in_stock && productData.in_stock) {
                webhookTitle = '🚨 RESTOCK DETECTED 🚨'; color = 0x00ff00;
            } else if (lastData.in_stock && !productData.in_stock) {
                webhookTitle = '⚠️ OUT OF STOCK ⚠️'; color = 0xff0000;
            } else if (lastData.price !== productData.price && productData.price) {
                webhookTitle = '💰 PRICE CHANGED 💰'; color = 0xffff00;
            } else if (lastData.purchase_limit !== productData.purchase_limit && productData.in_stock) {
                webhookTitle = '🛒 LIMIT CHANGED 🛒'; color = 0x00ffff;
            }

            if (webhookTitle) {
                console.log(`[STATE CHANGE] ${webhookTitle} - ${productData.name}`);
                await sendWebhook(webhookTitle, productData, color);
            }
            previousState[productUrl] = productData;
        }
    } catch (e) {
        client.off('Network.responseReceived', responseHandler);
        console.error(`Error checking ${productUrl}:`, e.message);
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
    
    const client = await page.target().createCDPSession();
    await client.send('Network.enable');
    
    return { browser, page, client };
}

async function runBot() {
    console.log("Starting Target Monitor (CDP Network Interceptor Architecture)...");
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
            console.log("No products to monitor in database. Waiting...");
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

        // Group by profile
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
                    await handleProduct(p.url, session.page, session.client);
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

module.exports = {
    ProxyManager,
    sendWebhook,
    handleProduct,
    runBot,
    computeFingerprint,
    diagnoseApiResponse,
    extractTcin,
    getConfig: () => config,
    setConfig: (newConfig) => { Object.assign(config, newConfig) },
    getPreviousState: () => previousState,
    setPreviousState: (key, val) => previousState[key] = val,
    clearPreviousState: () => { for(let k in previousState) delete previousState[k]; }
};
