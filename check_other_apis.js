const axios = require('axios');

const TARGET_API_KEY = "ff457966e64d5e877fdbad070f276d18ecec4a01";
const TCIN = "1001304528"; // Pokemon Scarlet Violet 151
const ZIP = "01211"; // From network capture

async function testApi(url, name) {
    try {
        console.log(`\n--- Testing ${name} ---`);
        console.log(`URL: ${url}`);
        const res = await axios.get(url, {
            headers: {
                'accept': 'application/json',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const dataStr = JSON.stringify(res.data, null, 2);
        console.log(dataStr.substring(0, 500) + (dataStr.length > 500 ? '\n...[truncated]' : ''));
        
        if (dataStr.toLowerCase().includes('stock') || dataStr.toLowerCase().includes('qty') || dataStr.toLowerCase().includes('limit')) {
            console.log("\n✅ Found potential stock/limit keywords in response!");
        } else {
            console.log("\n❌ No obvious stock/limit keywords found.");
        }
        
    } catch (e) {
        console.log(`Failed: ${e.message}`);
        if (e.response) {
            console.log(`Status: ${e.response.status}`);
            console.log(`Data:`, e.response.data);
        }
    }
}

(async () => {
    // API 1: nearby_stores_v1
    const nearbyUrl = `https://redsky.target.com/redsky_aggregations/v1/web/nearby_stores_v1?limit=5&within=100&place=${ZIP}&key=${TARGET_API_KEY}&channel=WEB&page=%2Fp%2FA-${TCIN}`;
    await testApi(nearbyUrl, "Nearby Stores (Redsky)");

    // API 2: location_fulfillment_aggregations
    const fulfillmentUrl = `https://api.target.com/location_fulfillment_aggregations/v1/secured/preferred_stores?key=${TARGET_API_KEY}&zipcode=${ZIP}`;
    await testApi(fulfillmentUrl, "Location Fulfillment Aggregations");
})();
