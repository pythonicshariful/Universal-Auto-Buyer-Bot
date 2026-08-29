const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const axios = require('axios');

const API_URL = "http://localhost:8000/api/products";
const TARGET_API_KEY = "ff457966e64d5e877fdbad070f276d18ecec4a01";

function extractTcin(url) {
    const match = url.match(/\/-?\/?A-(\d+)/);
    return match ? match[1] : null;
}

function checkFields(data) {
    let hasStock = false;
    let hasLimit = false;
    let hasPrice = false;
    let missingFields = [];

    const product_data = data?.data?.product || {};
    const item = product_data.item || {};
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

    return { hasStock, hasLimit, hasPrice, missingFields, dataDump: data };
}

function deepSearch(obj, key) {
    if (obj && typeof obj === 'object') {
        if (obj[key] !== undefined) return obj[key];
        for (let k in obj) {
            let res = deepSearch(obj[k], key);
            if (res !== undefined) return res;
        }
    }
    return undefined;
}

function checkSapphireFields(data) {
    let hasStock = false;
    let hasLimit = false;
    let hasPrice = false;
    let missingFields = [];

    const availability_status = deepSearch(data, 'availability_status');
    if (availability_status) hasStock = true;
    else missingFields.push('availability_status');

    const max_order_qty = deepSearch(data, 'max_order_qty');
    if (max_order_qty !== undefined) hasLimit = true;
    else missingFields.push('max_order_qty');

    const current_retail = deepSearch(data, 'current_retail') || deepSearch(data, 'price');
    if (current_retail !== undefined) hasPrice = true;
    else missingFields.push('price/current_retail');

    return { hasStock, hasLimit, hasPrice, missingFields, dataDump: data };
}

(async () => {
    console.log("Starting Network Interceptor...");
    let products = [];
    try {
        const res = await axios.get(API_URL);
        products = res.data;
    } catch (e) {
        console.log("FastAPI not available, using fallback products...");
        products = [
            "https://www.target.com/p/pokemon-scarlet-violet-151-booster-pack/-/A-1001304528",
            "https://www.target.com/p/pokemon-tcg-scarlet-violet-151-mini-tin-electabuzz-and-magnemite-2-booster-packs-1-coin-1-art-card/-/A-1011937034"
        ];
    }

    if (products.length === 0) {
        console.log("No products found.");
        return;
    }

    console.log(`Found ${products.length} products to check.`);

    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    // Stealth settings
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    const client = await page.target().createCDPSession();
    await client.send('Network.enable');

    const report = {};
    let interceptedResponses = {};

    client.on('Network.responseReceived', async (event) => {
        const { requestId, response } = event;
        const url = response.url;
        
        if (
            url.includes('redsky_aggregations/v1/web/pdp_client_v1') || 
            url.includes('sapphire/runtime/api/v1/raw') ||
            url.includes('nearby_stores_v1') ||
            url.includes('location_fulfillment_aggregations')
        ) {
            let type = 'unknown';
            if (url.includes('pdp_client_v1')) type = 'redsky_pdp';
            if (url.includes('sapphire')) type = 'sapphire';
            if (url.includes('nearby_stores')) type = 'nearby_stores';
            if (url.includes('location_fulfillment')) type = 'fulfillment';
            
            interceptedResponses[requestId] = { url, type };
        }
    });

    client.on('Network.loadingFinished', async (event) => {
        const { requestId } = event;
        if (interceptedResponses[requestId]) {
            try {
                const responseBody = await client.send('Network.getResponseBody', { requestId });
                let bodyStr = responseBody.body;
                if (responseBody.base64Encoded) {
                    bodyStr = Buffer.from(bodyStr, 'base64').toString('utf8');
                }
                const jsonData = JSON.parse(bodyStr);
                
                const meta = interceptedResponses[requestId];
                meta.data = jsonData;
            } catch (err) {
                // Ignore errors related to failed decodes or unparseable JSON
            }
        }
    });

    console.log("Loading target.com to establish context...");
    await page.goto('https://www.target.com', { waitUntil: 'domcontentloaded' });

    for (const url of products) {
        console.log(`\nChecking ${url}...`);
        const tcin = extractTcin(url);
        
        interceptedResponses = {}; // clear per product
        
        const diagnostic = {
            tcin,
            url,
            redsky_pdp: null,
            sapphire: null,
            nearby_stores: null,
            fulfillment: null,
            timestamp: new Date().toISOString()
        };

        // Navigate to product page to trigger Sapphire/Redsky via UI
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
        } catch (e) {
            console.log(`  Timeout loading page, proceeding anyway...`);
        }

        // Also force Redsky API call just in case it didn't fire from the page load
        if (tcin) {
            const apiUrl = `https://redsky.target.com/redsky_aggregations/v1/web/pdp_client_v1?key=${TARGET_API_KEY}&tcin=${tcin}&store_id=3991&pricing_store_id=3991`;
            try {
                await page.evaluate(async (fetchUrl) => {
                    await window.fetch(fetchUrl, { headers: { 'accept': 'application/json' } });
                }, apiUrl);
            } catch (e) {}
        }
        
        // Wait a bit for bodies to be captured
        await new Promise(r => setTimeout(r, 2000));

        // Process intercepted bodies
        for (const reqId in interceptedResponses) {
            const res = interceptedResponses[reqId];
            if (!res.data) continue;
            
            if (res.type === 'redsky_pdp' && res.url.includes(tcin)) {
                diagnostic.redsky_pdp = checkFields(res.data);
            } else if (res.type === 'sapphire' && res.url.includes(tcin)) {
                diagnostic.sapphire = checkSapphireFields(res.data);
            } else if (res.type === 'nearby_stores') {
                diagnostic.nearby_stores = { hasStock: false, hasLimit: false, hasPrice: false, missingFields: [], dataDump: res.data };
            } else if (res.type === 'fulfillment') {
                diagnostic.fulfillment = { hasStock: false, hasLimit: false, hasPrice: false, missingFields: [], dataDump: res.data };
            }
        }

        report[tcin] = diagnostic;
        
        // Console summary
        let rSum = diagnostic.redsky_pdp ? `Stock:${diagnostic.redsky_pdp.hasStock} Limit:${diagnostic.redsky_pdp.hasLimit}` : 'No Data';
        let sSum = diagnostic.sapphire ? `Stock:${diagnostic.sapphire.hasStock} Limit:${diagnostic.sapphire.hasLimit}` : 'No Data';
        let nSum = diagnostic.nearby_stores ? 'Data Captured (Check Report)' : 'No Data';
        let fSum = diagnostic.fulfillment ? 'Data Captured (Check Report)' : 'No Data';
        
        console.log(`  [Redsky PDP]     ${rSum}`);
        console.log(`  [Sapphire]       ${sSum}`);
        console.log(`  [Nearby Stores]  ${nSum}`);
        console.log(`  [Fulfillment]    ${fSum}`);
    }

    await browser.close();

    // Generate JSON
    fs.writeFileSync('api_diagnostic_report.json', JSON.stringify(report, null, 2));
    console.log('\nSaved api_diagnostic_report.json');

    // Generate HTML
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Target API Diagnostic Report</title>
        <style>
            body { font-family: system-ui, sans-serif; background: #f9fafb; margin: 2rem; color: #111827; }
            h1 { font-size: 1.5rem; margin-bottom: 1rem; }
            table { width: 100%; border-collapse: collapse; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden; }
            th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
            th { background: #f3f4f6; font-weight: 600; font-size: 0.875rem; color: #374151; }
            .ok { color: #16a34a; font-weight: bold; }
            .fail { color: #dc2626; font-weight: bold; }
            .json-view { background: #1f2937; color: #f3f4f6; padding: 1rem; border-radius: 6px; font-family: monospace; font-size: 0.8rem; overflow: auto; max-height: 400px; display: none; margin-top: 8px; }
            .toggle-btn { background: #3b82f6; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; }
        </style>
        <script>
            function toggleJson(id) {
                const el = document.getElementById(id);
                el.style.display = el.style.display === 'block' ? 'none' : 'block';
            }
        </script>
    </head>
    <body>
        <h1>Target API Diagnostic Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <table>
            <thead>
                <tr>
                    <th>TCIN</th>
                    <th>API Source</th>
                    <th>Stock Data</th>
                    <th>Limit Data</th>
                    <th>Price Data</th>
                    <th>Missing Fields</th>
                    <th>Raw Data</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const tcin in report) {
        const diag = report[tcin];
        
        const renderRow = (type, data) => {
            if (!data) return `<tr><td><strong>${tcin}</strong></td><td>${type}</td><td colspan="5" class="fail">No Intercepted Data</td></tr>`;
            
            const stockIcon = data.hasStock ? '<span class="ok">✅ Yes</span>' : '<span class="fail">❌ No</span>';
            const limitIcon = data.hasLimit ? '<span class="ok">✅ Yes</span>' : '<span class="fail">❌ No</span>';
            const priceIcon = data.hasPrice ? '<span class="ok">✅ Yes</span>' : '<span class="fail">❌ No</span>';
            const missingStr = data.missingFields.length > 0 ? data.missingFields.join(', ') : 'None';
            const jsonId = `json_${type.split(' ')[0]}_${tcin}`;
            
            return `
            <tr>
                <td><strong>${tcin}</strong></td>
                <td><strong>${type}</strong></td>
                <td>${stockIcon}</td>
                <td>${limitIcon}</td>
                <td>${priceIcon}</td>
                <td style="color:#d97706; font-size: 0.875rem;">${missingStr}</td>
                <td>
                    <button class="toggle-btn" onclick="toggleJson('${jsonId}')">Show JSON</button>
                    <div id="${jsonId}" class="json-view"><pre>${JSON.stringify(data.dataDump, null, 2).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></div>
                </td>
            </tr>
            `;
        };

        html += renderRow('Redsky PDP', diag.redsky_pdp);
        html += renderRow('Sapphire', diag.sapphire);
        html += renderRow('Nearby Stores', diag.nearby_stores);
        html += renderRow('Fulfillment', diag.fulfillment);
    }

    html += `
            </tbody>
        </table>
    </body>
    </html>
    `;

    fs.writeFileSync('api_diagnostic_report.html', html);
    console.log('Saved api_diagnostic_report.html');
})();
