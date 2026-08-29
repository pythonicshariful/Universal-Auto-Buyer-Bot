import os
import httpx
from bs4 import BeautifulSoup
from datetime import datetime
import re
from typing import Optional
from tenacity import retry, wait_exponential, stop_after_attempt
from .models import ProductSnapshot

class TargetConnector:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("TARGET_API_KEY", "ff457966e64d5e877fdbad070f276d18ecec4a01")
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9"
        }

    def _extract_tcin_from_url(self, url: str) -> Optional[str]:
        match = re.search(r'/-/?A-(\d+)', url)
        return match.group(1) if match else None

    @retry(wait=wait_exponential(multiplier=1, min=4, max=10), stop=stop_after_attempt(3))
    async def scrape(self, url: str) -> ProductSnapshot:
        tcin = self._extract_tcin_from_url(url)
        
        snapshot = ProductSnapshot(
            url=url,
            tcin=tcin,
            timestamp=datetime.utcnow(),
            in_stock=False
        )

        if not tcin:
            return snapshot # Can't do much without TCIN for the Redsky API

        # Try Redsky API first
        api_url = f"https://redsky.target.com/redsky_aggregations/v1/web/pdp_client_v1"
        params = {
            "key": self.api_key,
            "tcin": tcin,
            "store_id": "3991", # Default store for generic stock checks
            "pricing_store_id": "3991"
        }

        async with httpx.AsyncClient(headers=self.headers, timeout=10.0) as client:
            try:
                response = await client.get(api_url, params=params)
                if response.status_code == 200:
                    data = response.json()
                    product_data = data.get("data", {}).get("product", {})
                    
                    if product_data:
                        item = product_data.get("item", {})
                        price_info = product_data.get("price", {})
                        fulfillment = product_data.get("fulfillment", {})

                        # Extract details
                        snapshot.name = item.get("product_description", {}).get("title")
                        snapshot.dpci = item.get("dpci")
                        primary_barcode = item.get("primary_barcode")
                        if primary_barcode:
                            snapshot.upc = primary_barcode

                        # Price
                        current_price = price_info.get("current_retail")
                        if current_price is not None:
                            snapshot.price = float(current_price)

                        # Image
                        images = item.get("enrichment", {}).get("images", {})
                        primary_image = images.get("primary_image_url")
                        if primary_image:
                            snapshot.image_url = primary_image

                        # Stock Status
                        shipping = fulfillment.get("shipping_options", {})
                        if shipping.get("availability_status") in ["IN_STOCK", "PRE_ORDER"]:
                            snapshot.in_stock = True

                        # ATC URL
                        snapshot.atc_url = f"https://www.target.com/cart?item={tcin}"
                        
                        return snapshot

            except httpx.RequestError as e:
                print(f"Redsky API failed for {url}: {e}, falling back to DOM scraping")

            # Fallback to DOM scraping
            try:
                response = await client.get(url)
                if response.status_code == 200:
                    soup = BeautifulSoup(response.content, 'html.parser')
                    
                    # Name
                    title_el = soup.find('h1', {'data-test': 'product-title'})
                    if title_el:
                        snapshot.name = title_el.text.strip()
                        
                    # Price
                    price_el = soup.find(attrs={'data-test': 'product-price'})
                    if price_el:
                        price_text = price_el.text.strip().replace('$', '').replace(',', '')
                        try:
                            snapshot.price = float(price_text)
                        except ValueError:
                            pass

                    # Stock
                    oos_text = soup.find(string=re.compile("out of stock", re.IGNORECASE))
                    if oos_text:
                        snapshot.in_stock = False
                    else:
                        add_btn = soup.find('button', {'data-test': 'shippingButton'})
                        if add_btn and not add_btn.get('disabled'):
                            snapshot.in_stock = True
            except httpx.RequestError as e:
                print(f"DOM scraping failed for {url}: {e}")

        return snapshot
