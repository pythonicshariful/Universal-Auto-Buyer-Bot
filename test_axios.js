const axios = require('axios');
async function testApi() {
    const url = 'https://redsky.target.com/redsky_aggregations/v1/web/pdp_client_v1?key=ff457966e64d5e877fdbad070f276d18ecec4a01&tcin=1001304528&store_id=3991&pricing_store_id=3991';
    try {
        const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }});
        console.log("Success! Price:", res.data.data.product.price.current_retail);
    } catch(e) {
        console.error("Failed:", e.response ? e.response.status : e.message);
    }
}
testApi();
