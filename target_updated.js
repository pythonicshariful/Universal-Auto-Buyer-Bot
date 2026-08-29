// ==UserScript==
// @name         Target Auto Buyer
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Auto buy from target.com (equivalent to Python bot)
// @author       Pythonic Shariful
// @match        https://www.target.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // Hook console.log to print to UI
    const originalConsoleLog = console.log;
    console.log = function(...args) {
        originalConsoleLog.apply(console, args);
        const logArea = document.getElementById('bot-log-area');
        if (logArea) {
            const message = args.join(' ');
            const time = new Date().toLocaleTimeString();
            logArea.textContent += `[${time}] ${message}\n`;
            logArea.scrollTop = logArea.scrollHeight;
        }
    };

    // 1. UI Creation
    function createUI() {
        if (document.getElementById('target-bot-ui')) return;

        GM_addStyle(`
            #target-bot-ui {
                position: fixed;
                right: 18px;
                bottom: 18px;
                z-index: 999999;
                font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
                color: #111827;
            }
            #target-bot-ui .tb-card {
                width: 320px;
                border-radius: 14px;
                background: rgba(255, 255, 255, 0.92);
                border: 1px solid rgba(17, 24, 39, 0.12);
                box-shadow: 0 18px 40px rgba(0, 0, 0, 0.18);
                overflow: hidden;
                backdrop-filter: blur(8px);
            }
            #target-bot-ui .tb-header {
                padding: 12px 14px;
                background: linear-gradient(135deg, #cc0000 0%, #ff3b30 100%);
                color: #ffffff;
                display: flex;
                align-items: baseline;
                justify-content: space-between;
                gap: 12px;
            }
            #target-bot-ui .tb-title {
                font-size: 14px;
                font-weight: 800;
                letter-spacing: 0.2px;
                line-height: 1.1;
            }
            #target-bot-ui .tb-pill {
                font-size: 11px;
                font-weight: 700;
                padding: 4px 8px;
                border-radius: 999px;
                background: rgba(255, 255, 255, 0.18);
                border: 1px solid rgba(255, 255, 255, 0.25);
                white-space: nowrap;
            }
            #target-bot-ui .tb-body {
                padding: 12px 14px 14px;
            }
            #target-bot-ui .tb-grid-2 {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
            }
            #target-bot-ui .tb-field {
                margin-bottom: 10px;
            }
            #target-bot-ui .tb-label {
                display: block;
                font-size: 12px;
                font-weight: 700;
                color: #374151;
                margin-bottom: 6px;
            }
            #target-bot-ui .tb-input {
                width: 100%;
                box-sizing: border-box;
                padding: 10px 10px;
                border-radius: 10px;
                border: 1px solid rgba(17, 24, 39, 0.16);
                background: #ffffff;
                outline: none;
                font-size: 13px;
                transition: border-color 140ms ease, box-shadow 140ms ease;
            }
            #target-bot-ui .tb-input:focus {
                border-color: rgba(204, 0, 0, 0.5);
                box-shadow: 0 0 0 4px rgba(204, 0, 0, 0.12);
            }
            #target-bot-ui .tb-status-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin: 10px 0 12px;
                padding: 10px 10px;
                border-radius: 12px;
                background: rgba(17, 24, 39, 0.04);
                border: 1px solid rgba(17, 24, 39, 0.08);
            }
            #target-bot-ui .tb-status-value {
                font-size: 12px;
                font-weight: 800;
                padding: 4px 8px;
                border-radius: 999px;
                background: rgba(255, 255, 255, 0.8);
                border: 1px solid rgba(17, 24, 39, 0.08);
            }
            #target-bot-ui .tb-log {
                width: 100%;
                height: 120px;
                border-radius: 12px;
                border: 1px solid rgba(17, 24, 39, 0.12);
                background: rgba(17, 24, 39, 0.03);
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                font-size: 11px;
                overflow-y: auto;
                padding: 10px 10px;
                box-sizing: border-box;
                white-space: pre-wrap;
            }
            #target-bot-ui .tb-actions {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-top: 12px;
            }
            #target-bot-ui .tb-btn {
                border: none;
                border-radius: 12px;
                padding: 10px 12px;
                font-size: 13px;
                font-weight: 800;
                cursor: pointer;
                transition: transform 120ms ease, filter 120ms ease, box-shadow 120ms ease;
            }
            #target-bot-ui .tb-btn:active {
                transform: translateY(1px);
            }
            #target-bot-ui .tb-btn-primary {
                background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%);
                color: #ffffff;
                box-shadow: 0 10px 18px rgba(34, 197, 94, 0.22);
            }
            #target-bot-ui .tb-btn-danger {
                background: linear-gradient(135deg, #b91c1c 0%, #ef4444 100%);
                color: #ffffff;
                box-shadow: 0 10px 18px rgba(239, 68, 68, 0.22);
            }
            #target-bot-ui .tb-btn:hover {
                filter: brightness(1.03);
            }
        `);
        
        const ui = document.createElement('div');
        ui.id = 'target-bot-ui';
        ui.innerHTML = `
            <div class="tb-card">
                <div class="tb-header">
                    <div class="tb-title">Target Auto Buyer</div>
                    <div class="tb-pill">Per-Tab</div>
                </div>
                <div class="tb-body">
                    <div class="tb-field">
                        <label class="tb-label" for="bot-tcin">TCIN (Leave empty for ANY product)</label>
                        <input class="tb-input" type="text" id="bot-tcin" value="${GM_getValue('tcin', '')}" placeholder="e.g. 12345678" />
                    </div>

                    <div class="tb-field">
                        <label class="tb-label" for="bot-qty">Quantity</label>
                        <input class="tb-input" type="number" id="bot-qty" min="1" max="10" value="${GM_getValue('qty', '1')}" />
                    </div>

                    <div class="tb-field">
                        <label class="tb-label" for="bot-max-price">Max Price (0 = no limit)</label>
                        <input class="tb-input" type="number" id="bot-max-price" min="0" step="0.01" value="${GM_getValue('maxPrice', '0')}" />
                    </div>

                    <div class="tb-field">
                        <label class="tb-label" for="bot-cvv">CVV</label>
                        <input class="tb-input" type="text" id="bot-cvv" value="${GM_getValue('cvv', '123')}" />
                    </div>

                    <div class="tb-grid-2">
                        <div class="tb-field">
                            <label class="tb-label" for="bot-min-delay">Min Delay (ms)</label>
                            <input class="tb-input" type="number" id="bot-min-delay" value="${GM_getValue('minDelay', '3000')}" />
                        </div>
                        <div class="tb-field">
                            <label class="tb-label" for="bot-max-delay">Max Delay (ms)</label>
                            <input class="tb-input" type="number" id="bot-max-delay" value="${GM_getValue('maxDelay', '5000')}" />
                        </div>
                    </div>

                    <div class="tb-status-row">
                        <span class="tb-label" style="margin: 0;">Status</span>
                        <span id="bot-status" class="tb-status-value" style="color: ${getTabRunning() ? 'green' : 'red'};">${getTabRunning() ? 'Running' : 'Stopped'}</span>
                    </div>

                    <div class="tb-field" style="margin-bottom: 0;">
                        <label class="tb-label" for="bot-log-area">Logs</label>
                        <div id="bot-log-area" class="tb-log"></div>
                    </div>

                    <div class="tb-actions">
                        <button id="bot-start" class="tb-btn tb-btn-primary">Start</button>
                        <button id="bot-stop" class="tb-btn tb-btn-danger">Stop</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(ui);

        const saveInputs = () => {
            GM_setValue('tcin', document.getElementById('bot-tcin').value.trim());
            GM_setValue('qty', document.getElementById('bot-qty').value);
            GM_setValue('maxPrice', document.getElementById('bot-max-price').value);
            GM_setValue('cvv', document.getElementById('bot-cvv').value);
            GM_setValue('minDelay', document.getElementById('bot-min-delay').value);
            GM_setValue('maxDelay', document.getElementById('bot-max-delay').value);
        };

        const updateStatusUI = (running) => {
            const statusEl = document.getElementById('bot-status');
            if (!statusEl) return;
            statusEl.innerText = running ? 'Running' : 'Stopped';
            statusEl.style.color = running ? 'green' : 'red';
        };

        const bindSave = (id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', saveInputs);
        };

        bindSave('bot-tcin');
        bindSave('bot-qty');
        bindSave('bot-max-price');
        bindSave('bot-min-delay');
        bindSave('bot-max-delay');

        const cvvEl = document.getElementById('bot-cvv');
        if (cvvEl) cvvEl.addEventListener('change', saveInputs);

        document.getElementById('bot-start').addEventListener('click', () => {
            // Auto-extract TCIN if on a product page and input is empty
            const tcinInput = document.getElementById('bot-tcin');
            if (tcinInput && !tcinInput.value.trim()) {
                const match = window.location.href.match(/\/-?\/?A-(\d+)/);
                if (match) {
                    tcinInput.value = match[1];
                    console.log(`Target Bot: Auto-detected TCIN ${match[1]} from URL.`);
                }
            }

            saveInputs();
            setTabRunning(true);
            updateStatusUI(true);
            window.botPlaceOrderAttempted = false;
            runBot();
        });

        document.getElementById('bot-stop').addEventListener('click', () => {
            setTabRunning(false);
            updateStatusUI(false);
            window.botPlaceOrderAttempted = false;
            clearTimeout(window.botTimeout);
            clearTimeout(window.botPlaceOrderTimeout);
            if (window.botCheckoutLoop) {
                clearInterval(window.botCheckoutLoop);
                window.botCheckoutLoop = null;
            }
        });
        updateStatusUI(getTabRunning());
    }

    // Node selector helper
    function getElementByXpath(path) {
        return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }

    function getTabRunning() {
        try {
            return window.sessionStorage.getItem('targetBotRunning') === '1';
        } catch (e) {
            return false;
        }
    }

    function setTabRunning(running) {
        try {
            if (running) {
                window.sessionStorage.setItem('targetBotRunning', '1');
            } else {
                window.sessionStorage.removeItem('targetBotRunning');
            }
        } catch (e) {}
    }

    function getWaitTimeMs() {
        const minDelay = parseInt(GM_getValue('minDelay', '3000'), 10);
        const maxDelay = parseInt(GM_getValue('maxDelay', '5000'), 10);

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
            if (!getTabRunning()) return;
            
            try {
                const data = JSON.parse(event.data);
                if (data.action === "RESTOCK" && data.atc_url) {
                    const targetTcin = GM_getValue('tcin', '').trim();
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
        const raw = (GM_getValue('maxPrice', '0') || '0').toString().trim();
        const maxPrice = parseFloat(raw);
        return Number.isFinite(maxPrice) ? maxPrice : 0;
    }

    // State machine logic
    function runBot() {
        if (!getTabRunning()) return;

        const currentUrl = window.location.href;
        
        if (currentUrl.includes('target.com/p/')) {
            connectWebSocket();
            handleProductPage();
        } else if (currentUrl.includes('/checkout') || currentUrl.includes('/co-')) {
            handleCheckoutPage();
        } else if (currentUrl.includes('/cart')) {
            console.log("Target Bot: In cart page, waiting 2s for add-to-cart to process then proceeding to checkout...");
            setTimeout(() => {
                if (getTabRunning()) {
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
        const targetQty = GM_getValue('qty', '1');
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
                if (!getTabRunning()) {
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
                if (!getTabRunning()) return;
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
            if (!getTabRunning()) {
                clearInterval(window.botCheckoutLoop);
                window.botCheckoutLoop = null;
                clearTimeout(window.botPlaceOrderTimeout);
                window.botPlaceOrderTimeout = null;
                return;
            }

            const currentUrl = window.location.href;
            if (!currentUrl.includes('/checkout') && !currentUrl.includes('/co-')) {
                console.log("Target Bot: Checkout complete (URL changed). Stopping.");
                setTabRunning(false);
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
                const cvv = GM_getValue('cvv', '123');
                
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
                    if (!getTabRunning()) return;
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
        setTimeout(() => {
            createUI();
            if (getTabRunning()) {
                runBot();
            }
        }, 1000); // slight delay to let Target's react elements render
    });

})();
