const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    const client = await page.target().createCDPSession();
    await client.send('Network.enable');
    
    const wsMessages = [];
    const httpRequests = [];
    
    client.on('Network.webSocketCreated', params => {
        wsMessages.push(`[WS CREATED] ${params.url}`);
    });
    
    client.on('Network.webSocketFrameReceived', params => {
        const data = params.response.payloadData;
        wsMessages.push(`[WS RECV] ${data.substring(0, 100)}...`);
    });
    
    client.on('Network.webSocketFrameSent', params => {
        const data = params.response.payloadData;
        wsMessages.push(`[WS SENT] ${data.substring(0, 100)}...`);
    });

    page.on('request', request => {
        const url = request.url();
        if (url.includes('redsky') || url.includes('api.target.com') || url.includes('graphql') || url.includes('stream') || url.includes('sse')) {
            httpRequests.push(`[HTTP] ${request.method()} ${url}`);
        }
    });

    console.log("Navigating to Target product page...");
    try {
        await page.goto('https://www.target.com/p/pokemon-trading-card-game-scarlet-violet-s6-twilight-masquerade-booster-bundle/-/A-90494420', { waitUntil: 'networkidle2', timeout: 30000 });
        
        console.log("Waiting for 20 seconds to observe idle traffic...");
        await new Promise(r => setTimeout(r, 20000));
        
        fs.writeFileSync('network_capture_results.txt', `
=== WEBSOCKETS ===
${wsMessages.join('\n')}

=== RELEVANT HTTP REQUESTS ===
${httpRequests.join('\n')}
        `);
        console.log("Capture complete. Results saved.");
    } catch (err) {
        console.error("Error during capture:", err);
    } finally {
        await browser.close();
    }
})();
