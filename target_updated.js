// ==UserScript==
// @name         Target Auto Buyer (Universal Dashboard)
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Auto buy from target.com connected to Universal Dashboard
// @author       Pythonic Shariful
// @match        https://www.target.com/*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// ==/UserScript==

(function() {
    'use strict';

    // Global Config State
    let botConfig = {
        bot_running: false,
        target_qty: 1,
        max_price: 0,
        min_delay: 3000,
        max_delay: 5000,
        cvv: '123'
    };

    function gmFetch(url, options = {}) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: options.method || 'GET',
                url: url,
                headers: options.headers || {},
                data: options.body || null,
                onload: (response) => {
                    resolve({
                        ok: response.status >= 200 && response.status < 300,
                        status: response.status,
                        text: () => Promise.resolve(response.responseText),
                        json: () => {
                            try { return Promise.resolve(JSON.parse(response.responseText)); } 
                            catch (e) { return Promise.reject(e); }
                        }
                    });
                },
                onerror: reject
            });
        });
    }

    async function sendLog(message, level='info') {
        try {
            await gmFetch('http://localhost:8000/api/pok/log', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ message: '[Target] ' + message, level })
            });
        } catch (e) {}
    }

    // Hook console.log
    const originalConsoleLog = console.log;
    console.log = function(...args) {
        originalConsoleLog.apply(console, args);
        sendLog(args.join(' '));
    };

    async function sendHeartbeat() {
        try {
            await gmFetch('http://localhost:8000/api/pok/heartbeat', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ url: window.location.href })
            });
        } catch (e) {}
    }

    async function fetchConfig() {
        try {
            let u = encodeURIComponent(window.location.href.split('?')[0]);
            let res = await gmFetch('http://localhost:8000/api/pok/config?url=' + u);
            if (res.ok) {
                let data = await res.json();
                botConfig.bot_running = !!data.bot_running;
                if (data.target_qty) botConfig.target_qty = parseInt(data.target_qty) || 1;
                if (data.max_price) botConfig.max_price = parseFloat(data.max_price) || 0;
                if (data.min_delay) botConfig.min_delay = parseInt(data.min_delay) || 3000;
                if (data.max_delay) botConfig.max_delay = parseInt(data.max_delay) || 5000;
                if (data.payment && data.payment.cvv) botConfig.cvv = data.payment.cvv;
            }
        } catch (e) {}
    }

    setInterval(() => {
        fetchConfig();
        sendHeartbeat();
    }, 2000);

    function getElementByXpath(path) {
        return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }



    function getWaitTimeMs() {
        const minDelay = parseInt(botConfig.min_delay, 10);
        const maxDelay = parseInt(botConfig.max_delay, 10);

        const safeMin = Number.isFinite(minDelay) ? Math.max(0, minDelay) : 3000;
        const safeMax = Number.isFinite(maxDelay) ? Math.max(safeMin, maxDelay) : Math.max(safeMin, 5000);

        return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
    }

    let ws = null;
    function connectWebSocket() {
        if (ws) return;
        console.log("Target Bot: Connecting to local WebSocket...");
        ws = new WebSocket("ws://localhost:8000/ws");
        
        ws.onopen = () => {
            console.log("Target Bot: Connected to WebSocket Server!");
        };
        
        ws.onmessage = (event) => {
            if (!botConfig.bot_running) return;
            
            try {
                const data = JSON.parse(event.data);
                if (data.action === "RESTOCK" && data.atc_url) {
                    const targetTcin = "".trim();
                    if (targetTcin && !data.atc_url.includes(targetTcin)) {
                        console.log(`Target Bot: Ignored restock for different TCIN. (Signal for: ${data.atc_url})`);
                        return;
                    }
                    console.log(`Target Bot: RESTOCK DETECTED! Redirecting to: ${data.atc_url}`);
                    window.location.href = data.atc_url;
                }
            } catch (e) {
                console.error("Target Bot: WebSocket parse error", e);
            }
        };
        
        ws.onclose = () => {
            console.log("Target Bot: WebSocket disconnected. Reconnecting in 3s...");
            ws = null;
            setTimeout(connectWebSocket, 3000);
        };
        
        ws.onerror = (e) => {
            // Silently handle to avoid spam, onclose will retry
        };
    }

    function isOutOfStock() {
        const oosEl = getElementByXpath("//*[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'out of stock')]");
        if (oosEl && isElementVisible(oosEl)) return true;

        const boldSpans = document.querySelectorAll('span.h-text-bold');
        for (const el of boldSpans) {
            const t = (el.textContent || '').trim().toLowerCase();
            if (t === 'out of stock' || t.includes('out of stock')) return true;
        }
        const ariaEls = document.querySelectorAll('[aria-label]');
        for (const el of ariaEls) {
            const label = (el.getAttribute('aria-label') || '').trim().toLowerCase();
            if (label.includes('out of stock')) return true;
        }
        const bodyText = (document.body && document.body.innerText) ? document.body.innerText.toLowerCase() : '';
        if (bodyText.includes('out of stock')) return true;
        return false;
    }

    function isElementVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function isDisabled(el) {
        if (!el) return true;
        if (el.disabled) return true;
        const ariaDisabled = (el.getAttribute('aria-disabled') || '').toLowerCase();
        return ariaDisabled === 'true';
    }

    function getCurrentPrice() {
        const priceEl = document.querySelector('[data-test="product-price"]') ||
                        document.querySelector('span.styles_currentPriceFontSize__Xps20');
        if (!priceEl) return null;
        const raw = (priceEl.textContent || '').trim();
        const cleaned = raw.replace(/[^0-9.]/g, '');
        const price = parseFloat(cleaned);
        return Number.isFinite(price) ? price : null;
    }

    function getMaxPrice() {
        const raw = (botConfig.max_price || '0').toString().trim();
        const maxPrice = parseFloat(raw);
        return Number.isFinite(maxPrice) ? maxPrice : 0;
    }

    // State machine logic
    function runBot() {
        if (!botConfig.bot_running) return;

        const currentUrl = window.location.href;
        
        if (currentUrl.includes('target.com/p/')) {
            connectWebSocket();
            handleProductPage();
        } else if (currentUrl.includes('/checkout') || currentUrl.includes('/co-')) {
            handleCheckoutPage();
        } else if (currentUrl.includes('/cart')) {
            console.log("Target Bot: In cart page, waiting 2s for add-to-cart to process then proceeding to checkout...");
            setTimeout(() => {
                if (botConfig.bot_running) {
                    window.location.href = "https://www.target.com/checkout";
                }
            }, 2000);
        } else {
            console.log("Target Bot: Idle page. Listening for restock signals...");
            connectWebSocket();
        }
    }

    function handleProductPage() {
        console.log("Target Bot: Handling product page...");

        if (isOutOfStock()) {
            console.log("Target Bot: Out of stock detected. Waiting for WebSocket signal...");
            return;
        }

        const maxPrice = getMaxPrice();
        const currentPrice = getCurrentPrice();
        if (maxPrice > 0 && currentPrice !== null && currentPrice > maxPrice) {
            console.log(`Target Bot: Price ${currentPrice} is above max ${maxPrice}. Waiting for WebSocket signal...`);
            return;
        }
        
        // 1. Check and set Quantity if present
        const targetQty = botConfig.target_qty;
        const qtyBtn = document.querySelector('button[id^="select-"]') || getElementByXpath("//button[contains(., 'Qty')]");
        
        if (qtyBtn) {
            const qtyTextDiv = qtyBtn.querySelector('div');
            const currentQty = qtyTextDiv ? qtyTextDiv.innerText.trim() : "";
            if (currentQty && currentQty !== targetQty) {
                console.log(`Target Bot: Current quantity is ${currentQty}, target is ${targetQty}. Updating...`);
                const optionLink = document.querySelector(`ul.Options_styles_options__UapY8 a[aria-label="${targetQty}"]`) || 
                                   document.querySelector(`ul a[aria-label="${targetQty}"]`);
                if (optionLink) {
                    optionLink.click();
                    console.log(`Target Bot: Clicked quantity option ${targetQty}`);
                } else {
                    qtyBtn.click();
                    console.log("Target Bot: Clicked quantity selector dropdown");
                }
                // Delay a bit and re-run handleProductPage
                setTimeout(handleProductPage, 500);
                return;
            }
        }
        
        // Look for Add to cart or Preorder
        const addToCartBtn = document.querySelector('button[data-test="shippingButton"]') ||
                             document.querySelector('button[id^="addToCartButtonOrTextIdFor"]') ||
                             getElementByXpath("//button[contains(text(),'Add to cart')]") ||
                             getElementByXpath("//button[text()='Preorder']");
        
        if (addToCartBtn && isElementVisible(addToCartBtn) && !isDisabled(addToCartBtn)) {
            console.log("Target Bot: Found Add to Cart/Preorder button! Clicking...");
            addToCartBtn.click();
            
            // Wait for it to be added to cart, then navigate to checkout
            let checkCartInterval = setInterval(() => {
                if (!botConfig.bot_running) {
                    clearInterval(checkCartInterval);
                    return;
                }
                const picker = document.querySelector('button[data-test="custom-quantity-picker"]');
                const viewCartBtn = getElementByXpath("//a[contains(text(),'View cart')]") || 
                                    getElementByXpath("//button[contains(text(),'View cart')]");

                if ((picker && picker.innerText.toLowerCase().includes('in cart')) || viewCartBtn) {
                    console.log("Target Bot: Item is in cart. Proceeding to checkout...");
                    clearInterval(checkCartInterval);
                    window.location.href = "https://www.target.com/checkout";
                }
            }, 1000);

            setTimeout(() => {
                if (!botConfig.bot_running) return;
                if (!checkCartInterval) return;
                clearInterval(checkCartInterval);
                checkCartInterval = null;
                console.log("Target Bot: Add to cart did not succeed. Waiting for WebSocket signal...");
            }, 15000);
        } else {
            console.log("Target Bot: Add to cart not available. Waiting for WebSocket signal...");
        }
    }

    function handleCheckoutPage() {
        console.log("Target Bot: Handling checkout page...");

        if (window.botCheckoutLoop) return;

        window.botCheckoutLoop = setInterval(() => {
            if (!botConfig.bot_running) {
                clearInterval(window.botCheckoutLoop);
                window.botCheckoutLoop = null;
                clearTimeout(window.botPlaceOrderTimeout);
                window.botPlaceOrderTimeout = null;
                return;
            }

            const currentUrl = window.location.href;
            if (!currentUrl.includes('/checkout') && !currentUrl.includes('/co-')) {
                console.log("Target Bot: Checkout complete (URL changed). Stopping.");
                botConfig.bot_running = false;
                const statusEl = document.getElementById('bot-status');
                if (statusEl) {
                    statusEl.innerText = 'Finished';
                    statusEl.style.color = 'red';
                }
                clearInterval(window.botCheckoutLoop);
                window.botCheckoutLoop = null;
                clearTimeout(window.botPlaceOrderTimeout);
                window.botPlaceOrderTimeout = null;
                return;
            }

            // 1. Handle Login if present
            const passwordField = document.getElementById('password');
            if (passwordField) {
                console.log("Target Bot: Login page detected. Entering password...");
                const pass = GM_getValue('password', 'Hacktanha');
                
                // Set value and trigger React events
                const lastValue = passwordField.value;
                passwordField.value = pass;
                const event = new Event('input', { bubbles: true });
                const tracker = passwordField._valueTracker;
                if (tracker) tracker.setValue(lastValue);
                passwordField.dispatchEvent(event);
                
                setTimeout(() => {
                    const loginBtn = document.getElementById('login');
                    if (loginBtn) {
                        loginBtn.click();
                        console.log("Target Bot: Clicked Login");
                    }
                }, 1000);
                return;
            }

            // 2. Skip button (mobile number etc)
            const skipBtn = getElementByXpath("//a[normalize-space()='Skip']") ||
                            getElementByXpath("//button[normalize-space()='Skip']");
            if (skipBtn) {
                console.log("Target Bot: Clicking Skip");
                skipBtn.click();
                return;
            }

            // 3. Save and continue button
            const sncBtn = getElementByXpath("//button[contains(text(),'Save and continue')]");
            if (sncBtn) {
                console.log("Target Bot: Clicking Save and Continue");
                sncBtn.click();
                return;
            }

            // 4. CVV Input if needed (slides open after Place Order sometimes)
            const cvvField = document.getElementById('enter-cvv');
            if (cvvField && !cvvField.disabled && cvvField.getBoundingClientRect().width > 0) {
                console.log("Target Bot: Entering CVV...");
                const cvv = botConfig.cvv;
                
                // Set value and trigger React events
                const lastValue = cvvField.value || "";
                cvvField.value = cvv;
                const event = new Event('input', { bubbles: true });
                const tracker = cvvField._valueTracker;
                if (tracker) tracker.setValue(lastValue);
                cvvField.dispatchEvent(event);
                
                setTimeout(() => {
                    const confirmBtn = document.querySelector('button[data-test="confirm-button"]');
                    if (confirmBtn) {
                        confirmBtn.click();
                        console.log("Target Bot: Clicked Confirm CVV");
                    }
                }, 1000);
                return;
            }

            // 5. Place order button
            const placeOrderBtn = document.querySelector('button[data-test="placeOrderButton"]');
            if (placeOrderBtn && !isDisabled(placeOrderBtn) && !window.botPlaceOrderTimeout) {
                if (!window.botPlaceOrderAttempted) {
                    window.botPlaceOrderAttempted = true;
                    placeOrderBtn.click();
                    console.log("Target Bot: First place order attempt. Clicked immediately.");
                    return;
                }

                const delay = getWaitTimeMs();
                console.log(`Target Bot: Place Order available. Clicking in ${(delay / 1000).toFixed(1)} seconds...`);
                window.botPlaceOrderTimeout = setTimeout(() => {
                    window.botPlaceOrderTimeout = null;
                    if (!botConfig.bot_running) return;
                    const stillOnCheckout = window.location.href.includes('/checkout') || window.location.href.includes('/co-');
                    if (!stillOnCheckout) return;

                    const btn = document.querySelector('button[data-test="placeOrderButton"]');
                    if (btn && !isDisabled(btn) && isElementVisible(btn)) {
                        btn.click();
                        console.log("Target Bot: Clicked Place Order");
                    }
                }, delay);
            }

        }, 2000);
    }

    // Wait for the page to load, then initialize UI and logic
    window.addEventListener('load', () => {
        setTimeout(async () => {
            await fetchConfig();
            fetchConfig();
            if (botConfig.bot_running) {
                runBot();
            }
        }, 1000); // slight delay to let Target's react elements render
    });

})();
