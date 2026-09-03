// ==UserScript==
// @name         Universal Auto Buyer Bot
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Universal Auto Buyer Bot for Pokemon Center, Target, and Walmart connected to the Universal Dashboard
// @author       Pythonic Shariful
// @match        https://www.pokemoncenter.com/*
// @match        https://flex.cybersource.com/*
// @match        https://www.target.com/*
// @match        https://www.walmart.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @grant        GM_addValueChangeListener
// @connect      localhost
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // =========================================================================
    // UNIVERSAL ROUTING ENGINE
    // =========================================================================
    const hostname = window.location.hostname;
    
    if (hostname.includes('pokemoncenter.com') || hostname.includes('flex.cybersource.com')) {
        console.log('[Universal Bot] Routing to Pokemon Center Bot');
        runPokemonBot();
    } else if (hostname.includes('target.com')) {
        console.log('[Universal Bot] Routing to Target Bot');
        runTargetBot();
    } else if (hostname.includes('walmart.com')) {
        console.log('[Universal Bot] Routing to Walmart Bot');
        runWalmartBot();
    } else {
        console.log('[Universal Bot] Unrecognized hostname: ' + hostname);
    }


function runPokemonBot() {

    

    // =========================================================================
    // 0. ADVANCED HUMANIZATION UTILITIES & BIOMETRIC SIMULATION
    // =========================================================================

    // Helper to simulate sleep/delays
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // Polyfill fetch to bypass mixed content and CORS restrictions using GM_xmlhttpRequest
    function gmFetch(url, options = {}) {
        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest === 'undefined') {
                return reject(new Error('GM_xmlhttpRequest is not defined. Please add @grant GM_xmlhttpRequest'));
            }
            GM_xmlhttpRequest({
                method: options.method || 'GET',
                url: url,
                headers: options.headers || {},
                data: options.body || null,
                onload: (response) => {
                    resolve({
                        ok: response.status >= 200 && response.status < 300,
                        status: response.status,
                        statusText: response.statusText,
                        text: () => Promise.resolve(response.responseText),
                        json: () => {
                            try {
                                return Promise.resolve(JSON.parse(response.responseText));
                            } catch (e) {
                                return Promise.reject(e);
                            }
                        }
                    });
                },
                onerror: (err) => reject(err),
                ontimeout: (err) => reject(err)
            });
        });
    }

    // Gaussian (Normal) distribution generator via Box-Muller transform
    function gaussianRandom(mean, stdDev, min = null, max = null) {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        let result = mean + num * stdDev;
        if (min !== null && result < min) result = min;
        if (max !== null && result > max) result = max;
        return result;
    }

    // Get realistic click coordinates inside an element (avoiding exact edge/center)
    function getRandomElementCoordinates(element) {
        const rect = element.getBoundingClientRect();
        const offsetX = rect.width * (0.25 + Math.random() * 0.5);
        const offsetY = rect.height * (0.25 + Math.random() * 0.5);
        
        const clientX = Math.round(rect.left + offsetX);
        const clientY = Math.round(rect.top + offsetY);
        const pageX = clientX + window.scrollX;
        const pageY = clientY + window.scrollY;
        const screenX = clientX + (window.screenX || 0);
        const screenY = clientY + (window.screenY || 0);

        return { clientX, clientY, pageX, pageY, screenX, screenY, rect };
    }

    // Simulate realistic multi-event human click (PointerEvent + MouseEvent + Focus)
    async function simulateHumanClick(element) {
        if (!element) return;

        const rect = element.getBoundingClientRect();
        const isInViewport = (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );

        if (!isInViewport) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            await sleep(gaussianRandom(280, 40, 200, 420));
        }

        const coords = getRandomElementCoordinates(element);
        const eventInit = {
            bubbles: true,
            cancelable: true,
            composed: true,
            clientX: coords.clientX,
            clientY: coords.clientY,
            screenX: coords.screenX,
            screenY: coords.screenY,
            pageX: coords.pageX,
            pageY: coords.pageY,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
            pressure: 0.5,
            width: 1,
            height: 1,
            sourceCapabilities: window.InputDeviceCapabilities ? new InputDeviceCapabilities({ firesTouchEvents: false }) : null
        };

        // Approach & Hover
        element.dispatchEvent(new PointerEvent('pointerover', eventInit));
        element.dispatchEvent(new PointerEvent('pointerenter', { ...eventInit, bubbles: false }));
        element.dispatchEvent(new MouseEvent('mouseover', eventInit));
        element.dispatchEvent(new MouseEvent('mouseenter', { ...eventInit, bubbles: false }));
        
        // Micro-jitter movements
        for (let i = 0; i < 2; i++) {
            const jitterX = coords.clientX + (Math.random() * 4 - 2);
            const jitterY = coords.clientY + (Math.random() * 4 - 2);
            element.dispatchEvent(new PointerEvent('pointermove', { ...eventInit, clientX: jitterX, clientY: jitterY }));
            element.dispatchEvent(new MouseEvent('mousemove', { ...eventInit, clientX: jitterX, clientY: jitterY }));
            await sleep(gaussianRandom(20, 5, 10, 35));
        }

        // Press Down
        await sleep(gaussianRandom(35, 8, 15, 65));
        element.dispatchEvent(new PointerEvent('pointerdown', { ...eventInit, buttons: 1 }));
        element.dispatchEvent(new MouseEvent('mousedown', { ...eventInit, buttons: 1 }));
        
        if (typeof element.focus === 'function') {
            element.focus();
        }

        // Hold Duration
        await sleep(gaussianRandom(75, 15, 45, 130));

        // Release
        element.dispatchEvent(new PointerEvent('pointerup', { ...eventInit, buttons: 0 }));
        element.dispatchEvent(new MouseEvent('mouseup', { ...eventInit, buttons: 0 }));
        element.dispatchEvent(new MouseEvent('click', { ...eventInit, buttons: 0 }));

        await sleep(gaussianRandom(80, 20, 40, 160));
    }

    // Simulate realistic human typing with keydown/keyup hold duration & flight time
    async function simulateHumanType(element, text) {
        if (!element || text === undefined || text === null) return;
        text = String(text);

        await simulateHumanClick(element);
        await sleep(gaussianRandom(150, 30, 80, 260));
        
        // Clear existing value
        element.select();
        try {
            document.execCommand('delete');
        } catch (e) {}

        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        if (element.value !== "") {
            if (nativeInputValueSetter) {
                if (element._valueTracker) element._valueTracker.setValue('__val__' + Math.random());
                nativeInputValueSetter.call(element, "");
            } else {
                element.value = "";
            }
            element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        }

        await sleep(gaussianRandom(120, 25, 60, 200));

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const keyCode = char.charCodeAt(0);
            const sc = window.InputDeviceCapabilities ? new InputDeviceCapabilities({ firesTouchEvents: false }) : null;

            const keyEventInit = {
                key: char,
                code: isNaN(char) ? `Key${char.toUpperCase()}` : `Digit${char}`,
                keyCode: keyCode,
                which: keyCode,
                bubbles: true,
                cancelable: true,
                composed: true,
                sourceCapabilities: sc
            };

            element.dispatchEvent(new KeyboardEvent('keydown', keyEventInit));
            element.dispatchEvent(new KeyboardEvent('keypress', keyEventInit));

            let inserted = false;
            try {
                inserted = document.execCommand('insertText', false, char);
            } catch (e) {}

            if (!inserted) {
                if (element._valueTracker) element._valueTracker.setValue('__val__' + Math.random());
                if (nativeInputValueSetter) {
                    nativeInputValueSetter.call(element, element.value + char);
                } else {
                    element.value += char;
                }
                element.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: char, inputType: 'insertText' }));
                element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            }

            // Human Key Press Hold duration (typically 45-85ms)
            await sleep(gaussianRandom(52, 10, 32, 95));

            element.dispatchEvent(new KeyboardEvent('keyup', keyEventInit));

            // Inter-key flight latency
            let flightTime = gaussianRandom(85, 18, 50, 160);
            if (char === ' ' || char === '@' || char === '.') {
                flightTime += gaussianRandom(100, 25, 50, 180);
            } else if (Math.random() < 0.1) {
                flightTime += gaussianRandom(70, 20, 30, 130);
            }
            await sleep(flightTime);
        }

        await sleep(gaussianRandom(160, 30, 90, 280));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.blur();
        element.dispatchEvent(new Event('blur', { bubbles: true }));

        await sleep(gaussianRandom(180, 35, 100, 300));
    }

    // Simulate complete human dropdown selection for React & native selects
    async function simulateHumanSelect(selectElement, targetValue) {
        if (!selectElement || targetValue === undefined || targetValue === null) return;
        targetValue = String(targetValue).trim();

        // 1. Ensure element is visible in viewport
        const rect = selectElement.getBoundingClientRect();
        const isInViewport = (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );

        if (!isInViewport) {
            selectElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            await sleep(gaussianRandom(260, 35, 180, 380));
        }

        // 2. Focus and click the select element to simulate opening dropdown
        await simulateHumanClick(selectElement);
        await sleep(gaussianRandom(200, 30, 140, 300));

        // 3. Locate matching option
        const options = Array.from(selectElement.options || []);
        const targetValPadded = targetValue.padStart(2, '0');
        const targetValUnpadded = targetValue.replace(/^0+/, '') || '0';

        const targetOption = options.find(o => 
            o.value === targetValue || 
            o.value === targetValPadded ||
            o.value === targetValUnpadded ||
            o.text.trim().toLowerCase() === targetValue.toLowerCase() ||
            o.text.trim().toLowerCase() === targetValPadded.toLowerCase() ||
            o.text.trim().toLowerCase().includes(targetValue.toLowerCase())
        );

        const finalValue = targetOption ? targetOption.value : targetValue;

        if (targetOption) {
            options.forEach(o => o.selected = false);
            targetOption.selected = true;
            selectElement.selectedIndex = targetOption.index;
            
            try {
                const sc = window.InputDeviceCapabilities ? new InputDeviceCapabilities({ firesTouchEvents: false }) : null;
                targetOption.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, sourceCapabilities: sc }));
                targetOption.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, sourceCapabilities: sc }));
                targetOption.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, sourceCapabilities: sc }));
                targetOption.dispatchEvent(new MouseEvent('click', { bubbles: true, sourceCapabilities: sc }));
            } catch(e) {}
        }

        // 4. Trigger React value setter
        const nativeSelectValueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
        
        // Bypass React's event tracker if it exists
        if (selectElement._valueTracker) {
            selectElement._valueTracker.setValue('__old_val__' + Math.random());
        }

        if (nativeSelectValueSetter) {
            nativeSelectValueSetter.call(selectElement, finalValue);
        } else {
            selectElement.value = finalValue;
        }

        // 5. Dispatch input and change events
        selectElement.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        selectElement.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

        // Simulate hitting Enter to confirm selection
        const keyEventInit = { 
            key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, composed: true,
            sourceCapabilities: window.InputDeviceCapabilities ? new InputDeviceCapabilities({ firesTouchEvents: false }) : null
        };
        selectElement.dispatchEvent(new KeyboardEvent('keydown', keyEventInit));
        selectElement.dispatchEvent(new KeyboardEvent('keypress', keyEventInit));
        selectElement.dispatchEvent(new KeyboardEvent('keyup', keyEventInit));

        if (selectElement.form) {
            selectElement.form.dispatchEvent(new Event('change', { bubbles: true }));
        }

        selectElement.blur();
        selectElement.dispatchEvent(new Event('blur', { bubbles: true }));

        await sleep(gaussianRandom(220, 40, 140, 360));
    }

    // =========================================================================
    // 1. CYBERSOURCE MICROFORM IFRAME HANDLER
    // =========================================================================
    if (window.location.hostname.includes('cybersource.com')) {
        let pendingCard = '';
        let pendingCVV = '';
        let isTyping = false;

        async function tryFillIframeInput() {
            const input = document.querySelector('input');
            if (!input) return;
            if (isTyping) {
                console.log("[CS Iframe] Already typing, ignoring fill request.");
                return;
            }

            const hash = decodeURIComponent(window.location.hash || '').toLowerCase();
            const href = decodeURIComponent(window.location.href || '').toLowerCase();
            const placeholder = (input.placeholder || '').toLowerCase();
            const name = (input.name || '').toLowerCase();
            const id = (input.id || '').toLowerCase();
            
            const isCVV = hash.includes('securitycode') || 
                          hash.includes('cvv') ||
                          href.includes('securitycode') || 
                          href.includes('cvv') ||
                          placeholder.includes('*') || 
                          placeholder.includes('cvv') || 
                          placeholder.includes('security') ||
                          name.includes('cvv') || 
                          name.includes('security') || 
                          id.includes('cvv') ||
                          id.includes('security');

            const isCardNumber = !isCVV && (
                                 hash.includes('card') || 
                                 hash.includes('number') || 
                                 href.includes('card') || 
                                 href.includes('number') ||
                                 placeholder.includes('card') || 
                                 placeholder.includes('number') || 
                                 name.includes('card') || 
                                 name.includes('number') || 
                                 id.includes('card') ||
                                 id.includes('number') ||
                                 true
            );

            let valToType = '';
            let fieldLabel = '';
            if (isCVV) {
                fieldLabel = 'CVV';
                if (typeof GM_getValue !== 'undefined') {
                    try { valToType = GM_getValue('pc_bot_cvv', '') || pendingCVV; } catch(e) { valToType = pendingCVV; }
                } else {
                    valToType = pendingCVV;
                }
            } else if (isCardNumber) {
                fieldLabel = 'Card Number';
                if (typeof GM_getValue !== 'undefined') {
                    try { valToType = GM_getValue('pc_bot_card_num', '') || pendingCard; } catch(e) { valToType = pendingCard; }
                } else {
                    valToType = pendingCard;
                }
            }

            const currentClean = (input.value || '').replace(/\D/g, '');
            const targetClean = (valToType || '').replace(/\D/g, '');

            if (targetClean && currentClean !== targetClean) {
                console.log(`[CS Iframe] Found matching field [${fieldLabel}]. Current length: ${currentClean.length}, Target length: ${targetClean.length}. Typing value...`);
                isTyping = true;
                try {
                    await typeIntoMicroform(input, targetClean);
                } finally {
                    isTyping = false;
                }
                console.log(`[CS Iframe] Finished typing [${fieldLabel}]. Resulting input.value: "${input.value}"`);
            }
        }

        async function typeIntoMicroform(input, value) {
            if (!value) return;
            const currentClean = (input.value || '').replace(/\D/g, '');
            if (currentClean === value) {
                console.log(`[CS Iframe] Field already matches UI value (${value.length} digits). Skipping typing.`);
                return;
            }
            
            console.log(`[CS Iframe] Simulating human keystrokes for target value length: ${value.length}`);
            try {
                input.focus();
                await sleep(gaussianRandom(180, 30, 90, 300));
                
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;

                // Clear previous value
                if (input.value !== '') {
                    if (setter) {
                        setter.call(input, "");
                    } else {
                        input.value = "";
                    }
                    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                }

                await sleep(gaussianRandom(120, 20, 60, 180));

                for (let i = 0; i < value.length; i++) {
                    const char = value[i];
                    const keyCode = char.charCodeAt(0);
                    const sc = window.InputDeviceCapabilities ? new InputDeviceCapabilities({ firesTouchEvents: false }) : null;
                    const keyEventInit = {
                        key: char,
                        code: isNaN(char) ? `Key${char.toUpperCase()}` : `Digit${char}`,
                        keyCode: keyCode,
                        which: keyCode,
                        bubbles: true,
                        cancelable: true,
                        composed: true,
                        sourceCapabilities: sc
                    };

                    input.dispatchEvent(new KeyboardEvent('keydown', keyEventInit));
                    input.dispatchEvent(new KeyboardEvent('keypress', keyEventInit));
                    
                    // Dispatch beforeinput
                    try {
                        input.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, composed: true, data: char, inputType: 'insertText' }));
                    } catch(e) {}

                    const curVal = input.value;
                    let inserted = false;
                    try {
                        inserted = document.execCommand('insertText', false, char);
                    } catch (e) {}

                    if (!inserted || input.value === curVal) {
                        const nextVal = curVal + char;
                        if (input._valueTracker) {
                            input._valueTracker.setValue('__val__' + Math.random());
                        }
                        if (setter) {
                            setter.call(input, nextVal);
                        } else {
                            input.value = nextVal;
                        }
                        input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: char, inputType: 'insertText' }));
                        input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                    }
                    
                    // Human Key Press Hold duration
                    await sleep(gaussianRandom(48, 8, 30, 80));
                    
                    input.dispatchEvent(new KeyboardEvent('keyup', keyEventInit));
                    
                    // Inter-key flight latency
                    let flightTime = gaussianRandom(85, 16, 50, 150);
                    
                    // Credit card 4-digit chunk glance pause (e.g. 4111 [pause] 2222 [pause] ...)
                    if (value.length > 6 && i > 0 && (i + 1) % 4 === 0 && (i + 1) < value.length) {
                        flightTime = gaussianRandom(220, 35, 140, 320);
                    } else if (Math.random() < 0.1) {
                        flightTime += gaussianRandom(70, 15, 30, 120);
                    }
                    
                    await sleep(flightTime);
                }

                await sleep(gaussianRandom(140, 25, 70, 220));

                // Verification check against UI settings
                const finalDigits = (input.value || '').replace(/\D/g, '');
                if (finalDigits !== value) {
                    console.log(`[CS Iframe] Field digits (${finalDigits}) did not match UI target (${value}). Applying direct correction...`);
                    if (input._valueTracker) {
                        input._valueTracker.setValue('__val__' + Math.random());
                    }
                    if (setter) {
                        setter.call(input, value);
                    } else {
                        input.value = value;
                    }
                    input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: value, inputType: 'insertText' }));
                    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                }

                input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                input.blur();
                input.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
                await sleep(gaussianRandom(150, 30, 80, 250));
            } catch (err) {
                console.error("[CS Iframe] Error during typeIntoMicroform execution:", err);
            }
        }

        // Listen for postMessage from parent
        window.addEventListener('message', async (e) => {
            if (e.data && e.data.type === 'PC_FILL_CYBERSOURCE') {
                if (e.data.cardNumber) pendingCard = e.data.cardNumber;
                if (e.data.cvv) pendingCVV = e.data.cvv;
                await tryFillIframeInput();
            }
        });

        // Listen for GM value changes when bot is active
        if (typeof GM_addValueChangeListener !== 'undefined') {
            try {
                GM_addValueChangeListener('pc_bot_trigger_fill', (name, oldValue, newValue) => {
                    tryFillIframeInput();
                });
            } catch (e) {
                console.warn("[CS Iframe] GM listener failed:", e);
            }
        }

        console.log("[CS Iframe] CyberSource microform handler ready on: " + window.location.hostname);
        return; // Terminate execution for iframe so UI doesn't render inside iframe
    }

    // =========================================================================
    // 2. MAIN POKEMON CENTER SCRIPT (Parent Window)
    // =========================================================================
    let uiContainer = null;
    let consoleContainer = null;
    let lastUrl = '';
    let isBotRunning = false;
    let botActionInProgress = false;

    // Broadcast card details to all CyberSource Flex Microform iframes
    function broadcastToCybersourceIframes(cardNumber, cvv) {
        const payload = {
            type: 'PC_FILL_CYBERSOURCE',
            cardNumber: cardNumber,
            cvv: cvv,
            timestamp: Date.now()
        };

        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            try {
                iframe.contentWindow.postMessage(payload, '*');
            } catch (e) {}
        });

        try {
            if (typeof GM_setValue !== 'undefined') {
                GM_setValue('pc_bot_card_num', cardNumber);
                GM_setValue('pc_bot_cvv', cvv);
                GM_setValue('pc_bot_trigger_fill', Date.now());
            }
        } catch (e) {}
    }

    // Function to append logs to our custom UI console
    function logToConsole(message, type = 'info') {
        if (!consoleContainer) return;
        
        const time = new Date().toLocaleTimeString();
        let color = '#ccc';
        if (type === 'success') color = '#28a745';
        if (type === 'error') color = '#dc3545';
        if (type === 'warning') color = '#ffcc00';
        if (type === 'info') color = '#00d2ff';
        
        const logLine = document.createElement('div');
        logLine.style.color = color;
        logLine.style.marginBottom = '6px';
        logLine.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
        logLine.style.paddingBottom = '4px';
        logLine.innerHTML = `<span style="color: #666; font-size: 11px;">[${time}]</span> ${message}`;
        
        consoleContainer.appendChild(logLine);
        consoleContainer.scrollTop = consoleContainer.scrollHeight;
        
        try {
            gmFetch('http://localhost:8000/api/pok/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level: type, message: message })
            }).catch(() => {});
        } catch (e) {}
    }

    // Function to initialize the UI
    function initUI() {
        if (!uiContainer) {
            uiContainer = document.createElement('div');
            uiContainer.id = 'pokemon-center-script-ui';
            uiContainer.style.position = 'fixed';
            uiContainer.style.bottom = '20px';
            uiContainer.style.right = '20px';
            uiContainer.style.background = 'rgba(15, 23, 42, 0.75)';
            uiContainer.style.backdropFilter = 'blur(12px)';
            uiContainer.style.webkitBackdropFilter = 'blur(12px)';
            uiContainer.style.color = '#f8fafc';
            uiContainer.style.padding = '20px';
            uiContainer.style.borderRadius = '16px';
            uiContainer.style.zIndex = '999999';
            uiContainer.style.fontFamily = '"Inter", system-ui, -apple-system, sans-serif';
            uiContainer.style.fontSize = '14px';
            uiContainer.style.boxShadow = '0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)';
            uiContainer.style.pointerEvents = 'auto'; 
            uiContainer.style.width = '380px';
            uiContainer.style.border = '1px solid rgba(255,255,255,0.1)';
            uiContainer.style.maxHeight = '90vh';
            uiContainer.style.overflowY = 'auto';
            uiContainer.style.transition = 'all 0.3s ease';
            
            document.body.appendChild(uiContainer);
        }
        
        uiContainer.innerHTML = `
            <div id="botPageType" style="margin-bottom: 12px; font-size: 15px; font-weight: bold; color: #fff;">🌐 Initializing...</div>
            
            <!-- Controls -->
            <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 16px; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 10px; flex-wrap: wrap; border: 1px solid rgba(255,255,255,0.05);">
                <div style="flex: 1; min-width: 80px;">
                    <label style="font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Target Qty</label>
                    <input type="number" id="botTargetQty" value="1" min="1" max="99" style="width: 100%; margin-top: 4px; padding: 8px; background: rgba(0,0,0,0.3); color: #fff; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); outline: none; transition: 0.2s;" />
                </div>
                <div style="flex: 1; min-width: 80px;">
                    <label style="font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Min Delay (s)</label>
                    <input type="number" id="botMinDelay" value="5" min="1" max="300" style="width: 100%; margin-top: 4px; padding: 8px; background: rgba(0,0,0,0.3); color: #fff; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); outline: none; transition: 0.2s;" />
                </div>
                <div style="flex: 1; min-width: 80px;">
                    <label style="font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Max Delay (s)</label>
                    <input type="number" id="botMaxDelay" value="15" min="1" max="300" style="width: 100%; margin-top: 4px; padding: 8px; background: rgba(0,0,0,0.3); color: #fff; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); outline: none; transition: 0.2s;" />
                </div>
            </div>
            
            <!-- Scheduling -->
            <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 16px; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="flex: 1;">
                    <label style="font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Schedule Start (Local Time)</label>
                    <input type="datetime-local" id="botScheduleTime" style="width: 100%; margin-top: 4px; padding: 8px; background: rgba(0,0,0,0.3); color: #fff; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); outline: none; transition: 0.2s; color-scheme: dark;" />
                </div>
                <button id="botScheduleBtn" style="padding: 10px 16px; cursor: pointer; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border: none; border-radius: 8px; font-weight: 700; font-size: 13px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3); align-self: flex-end; transition: transform 0.1s, filter 0.2s;">⏳ Set</button>
            </div>
            
            <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                <button id="botStartBtn" style="flex: 1; padding: 10px; cursor: pointer; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 8px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: transform 0.1s, filter 0.2s;">▶ START</button>
                <button id="botStopBtn" style="flex: 1; padding: 10px; cursor: pointer; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; border: none; border-radius: 8px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); transition: transform 0.1s, filter 0.2s;">⏹ STOP</button>
            </div>

            <!-- Shipping Profile Settings -->
            <details style="margin-bottom: 12px; background: rgba(255,255,255,0.03); padding: 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
                <summary style="cursor: pointer; font-weight: 600; color: #fbbf24; outline: none; user-select: none;">📦 Shipping Profile</summary>
                <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 10px;">
                    <input type="text" id="p_fn" placeholder="First Name" style="padding: 8px; background: rgba(0,0,0,0.3); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; outline: none;" />
                    <input type="text" id="p_ln" placeholder="Last Name" style="padding: 8px; background: rgba(0,0,0,0.3); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; outline: none;" />
                    <input type="text" id="p_addr" placeholder="Street Address" style="padding: 8px; background: rgba(0,0,0,0.3); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; outline: none;" />
                    <input type="text" id="p_apt" placeholder="Apt/Suite (Optional)" style="padding: 8px; background: rgba(0,0,0,0.3); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; outline: none;" />
                    <input type="text" id="p_zip" placeholder="Zip Code" style="padding: 8px; background: rgba(0,0,0,0.3); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; outline: none;" />
                    <input type="text" id="p_phone" placeholder="Phone Number" style="padding: 8px; background: rgba(0,0,0,0.3); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; outline: none;" />
                    <input type="email" id="p_email" placeholder="Email" style="padding: 8px; background: rgba(0,0,0,0.3); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; outline: none;" />
                </div>
            </details>

            <!-- Payment Details Settings -->
            <details open style="margin-bottom: 16px; background: rgba(255,255,255,0.03); padding: 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
                <summary style="cursor: pointer; font-weight: 600; color: #38bdf8; outline: none; user-select: none;">💳 Payment Details</summary>
                <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
                    <div>
                        <div style="font-size: 11px; font-weight: 600; color: #94a3b8; margin-bottom: 4px;">CARD NUMBER:</div>
                        <input type="text" id="p_card_num" placeholder="16-digit Card Number" style="width: 100%; box-sizing: border-box; padding: 8px; background: rgba(0,0,0,0.3); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; outline: none;" />
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <div style="flex: 1;">
                            <div style="font-size: 11px; font-weight: 600; color: #94a3b8; margin-bottom: 4px;">MONTH:</div>
                            <input type="text" id="p_exp_month" placeholder="MM (08)" maxlength="2" style="width: 100%; box-sizing: border-box; padding: 8px; background: rgba(0,0,0,0.3); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; outline: none;" />
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 11px; font-weight: 600; color: #94a3b8; margin-bottom: 4px;">YEAR:</div>
                            <input type="text" id="p_exp_year" placeholder="YYYY (2026)" maxlength="4" style="width: 100%; box-sizing: border-box; padding: 8px; background: rgba(0,0,0,0.3); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; outline: none;" />
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 11px; font-weight: 600; color: #94a3b8; margin-bottom: 4px;">CVV2:</div>
                            <input type="text" id="p_cvv" placeholder="CVV2" maxlength="4" style="width: 100%; box-sizing: border-box; padding: 8px; background: rgba(0,0,0,0.3); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; outline: none;" />
                        </div>
                    </div>
                    <button id="botSaveSettingsBtn" style="margin-top: 10px; padding: 10px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); transition: transform 0.1s, filter 0.2s;">💾 Save Profile & Card</button>
                </div>
            </details>
            
            <!-- Terminal Log -->
            <div style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 6px; letter-spacing: 1px; text-transform: uppercase;">System Activity</div>
            <div id="botConsole" style="background: rgba(0,0,0,0.5); border-radius: 8px; padding: 12px; height: 180px; overflow-y: auto; font-family: 'Fira Code', 'Consolas', monospace; font-size: 12px; border: 1px solid rgba(255,255,255,0.05); box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);">
            </div>
        `;

        consoleContainer = document.getElementById('botConsole');

        // Attach event listeners
        const startBtn = document.getElementById('botStartBtn');
        const stopBtn = document.getElementById('botStopBtn');
        const qtyInput = document.getElementById('botTargetQty');
        const minDelayInput = document.getElementById('botMinDelay');
        const maxDelayInput = document.getElementById('botMaxDelay');

        // Profile Elements
        const p_fn = document.getElementById('p_fn');
        const p_ln = document.getElementById('p_ln');
        const p_addr = document.getElementById('p_addr');
        const p_apt = document.getElementById('p_apt');
        const p_zip = document.getElementById('p_zip');
        const p_phone = document.getElementById('p_phone');
        const p_email = document.getElementById('p_email');

        // Payment Elements
        const p_card_num = document.getElementById('p_card_num');
        const p_exp_month = document.getElementById('p_exp_month');
        const p_exp_year = document.getElementById('p_exp_year');
        const p_cvv = document.getElementById('p_cvv');

        const saveSettingsBtn = document.getElementById('botSaveSettingsBtn');

        // Load Settings
        if (qtyInput) qtyInput.value = localStorage.getItem('pc_bot_target_qty') || '1';
        if (minDelayInput) minDelayInput.value = localStorage.getItem('pc_bot_min_delay') || '5';
        if (maxDelayInput) maxDelayInput.value = localStorage.getItem('pc_bot_max_delay') || '15';
        if (p_fn) p_fn.value = localStorage.getItem('pc_bot_fn') || '';
        if (p_ln) p_ln.value = localStorage.getItem('pc_bot_ln') || '';
        if (p_addr) p_addr.value = localStorage.getItem('pc_bot_addr') || '';
        if (p_apt) p_apt.value = localStorage.getItem('pc_bot_apt') || '';
        if (p_zip) p_zip.value = localStorage.getItem('pc_bot_zip') || '';
        if (p_phone) p_phone.value = localStorage.getItem('pc_bot_phone') || '';
        if (p_email) p_email.value = localStorage.getItem('pc_bot_email') || '';

        if (p_card_num) p_card_num.value = localStorage.getItem('pc_bot_card_num') || '';
        if (p_exp_month) p_exp_month.value = localStorage.getItem('pc_bot_exp_month') || '08';
        if (p_exp_year) p_exp_year.value = localStorage.getItem('pc_bot_exp_year') || '2026';
        if (p_cvv) p_cvv.value = localStorage.getItem('pc_bot_cvv') || '';

        if (qtyInput) {
            qtyInput.addEventListener('change', (e) => {
                localStorage.setItem('pc_bot_target_qty', e.target.value);
            });
        }
        
        if (minDelayInput) {
            minDelayInput.addEventListener('change', (e) => {
                localStorage.setItem('pc_bot_min_delay', e.target.value);
            });
        }

        if (maxDelayInput) {
            maxDelayInput.addEventListener('change', (e) => {
                localStorage.setItem('pc_bot_max_delay', e.target.value);
            });
        }

        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => {
                localStorage.setItem('pc_bot_fn', p_fn.value.trim());
                localStorage.setItem('pc_bot_ln', p_ln.value.trim());
                localStorage.setItem('pc_bot_addr', p_addr.value.trim());
                localStorage.setItem('pc_bot_apt', p_apt.value.trim());
                localStorage.setItem('pc_bot_zip', p_zip.value.trim());
                localStorage.setItem('pc_bot_phone', p_phone.value.trim());
                localStorage.setItem('pc_bot_email', p_email.value.trim());

                const cardNum = p_card_num.value.replace(/\s+/g, '');
                const expMonth = p_exp_month.value.trim().padStart(2, '0');
                let expYear = p_exp_year.value.trim();
                if (expYear.length === 2) expYear = '20' + expYear;
                const cvv = p_cvv.value.trim();

                localStorage.setItem('pc_bot_card_num', cardNum);
                localStorage.setItem('pc_bot_exp_month', expMonth);
                localStorage.setItem('pc_bot_exp_year', expYear);
                localStorage.setItem('pc_bot_cvv', cvv);

                try {
                    if (typeof GM_setValue !== 'undefined') {
                        GM_setValue('pc_bot_card_num', cardNum);
                        GM_setValue('pc_bot_cvv', cvv);
                        GM_setValue('pc_bot_trigger_fill', Date.now());
                    }
                } catch (e) {}

                logToConsole("Settings & Card profile saved successfully.", "success");
            });
        }

        if (startBtn) {
            startBtn.addEventListener('click', () => {
                if (!isBotRunning) {
                    isBotRunning = true;
                    localStorage.setItem('pc_bot_running', 'true');
                    logToConsole('Bot started manually.', 'success');
                    updateButtons();
                }
            });
        }
        
        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                if (isBotRunning) {
                    isBotRunning = false;
                    localStorage.setItem('pc_bot_running', 'false');
                    botActionInProgress = false; 
                    logToConsole('Bot stopped manually.', 'error');
                    updateButtons();
                }
            });
        }
        
        const scheduleBtn = document.getElementById('botScheduleBtn');
        const scheduleTimeInput = document.getElementById('botScheduleTime');
        
        if (scheduleBtn && scheduleTimeInput) {
            scheduleBtn.addEventListener('click', () => {
                if (window.botScheduledInterval) {
                    // Cancel schedule if it's already running
                    clearInterval(window.botScheduledInterval);
                    window.botScheduledInterval = null;
                    scheduleBtn.innerText = "â³ Set";
                    logToConsole("ðŸ›‘ Schedule cancelled.", "warning");
                    return;
                }

                const targetTime = new Date(scheduleTimeInput.value).getTime();
                if (!targetTime || isNaN(targetTime)) {
                    logToConsole("âš ï¸ Invalid schedule time.", "warning");
                    return;
                }
                
                if (targetTime <= Date.now()) {
                    logToConsole("âš ï¸ Scheduled time is in the past.", "warning");
                    return;
                }
                
                if (isBotRunning) {
                    isBotRunning = false;
                    localStorage.setItem('pc_bot_running', 'false');
                    botActionInProgress = false;
                    updateButtons();
                    logToConsole('â¸ï¸ Bot paused until scheduled time.', 'warning');
                }

                logToConsole(`â³ Bot scheduled to start at: ${new Date(targetTime).toLocaleTimeString()}`, "info");
                
                window.botScheduledInterval = setInterval(() => {
                    const remainingMs = targetTime - Date.now();
                    
                    if (remainingMs <= 0) {
                        clearInterval(window.botScheduledInterval);
                        window.botScheduledInterval = null;
                        scheduleBtn.innerText = "â³ Set";
                        
                        if (!isBotRunning) {
                            isBotRunning = true;
                            localStorage.setItem('pc_bot_running', 'true');
                            logToConsole('ðŸš€ Scheduled start triggered!', 'success');
                            updateButtons();
                        }
                    } else {
                        // Update button with live countdown
                        const h = Math.floor(remainingMs / 3600000);
                        const m = Math.floor((remainingMs % 3600000) / 60000).toString().padStart(2, '0');
                        const s = Math.floor((remainingMs % 60000) / 1000).toString().padStart(2, '0');
                        scheduleBtn.innerText = `ðŸ›‘ Cancel (${h}:${m}:${s})`;
                    }
                }, 1000);
            });
        }
    }

    function updateButtons() {
        const startBtn = document.getElementById('botStartBtn');
        const stopBtn = document.getElementById('botStopBtn');
        if (startBtn) {
            startBtn.style.opacity = isBotRunning ? '0.4' : '1';
            startBtn.disabled = isBotRunning;
        }
        if (stopBtn) {
            stopBtn.style.opacity = !isBotRunning ? '0.4' : '1';
            stopBtn.disabled = !isBotRunning;
        }
    }

    // Helper to extract the cart count from the header element
    function getCartCount() {
        const cartEl = document.querySelector('a.header-cart--_2R2kd, a[class*="header-cart"]');
        if (cartEl) {
            return parseInt(cartEl.getAttribute('data-count') || "0", 10);
        }
        return -1;
    }

    // --- Product Page Logic ---
    let nextRestockCheckTime = 0;

    async function executeProductPageBot() {
        if (!isBotRunning || botActionInProgress) return;
        botActionInProgress = true;
        
        const targetQty = parseInt(document.getElementById('botTargetQty')?.value || "1", 10);
        
        const increaseBtn = document.getElementById('increaseQty');
        const decreaseBtn = document.getElementById('decreaseQty');
        const input = document.getElementById('productQuantity');
        
        let addToCartBtn = document.querySelector('button.add-to-cart-button--PZmQF');
        if (!addToCartBtn) {
            const btns = Array.from(document.querySelectorAll('button'));
            addToCartBtn = btns.find(b => b.innerText && (b.innerText.includes('Add to Cart') || b.innerText.includes('Unavailable')));
        }
        
        const isUnavailable = !addToCartBtn || 
                              addToCartBtn.disabled || 
                              addToCartBtn.classList.contains('disabled--vkECP') || 
                              (addToCartBtn.innerText && addToCartBtn.innerText.includes('Unavailable'));

        if (isUnavailable) {
            // It's out of stock or loading. Do a background fetch to check for restock if enough time has passed.
            const now = Date.now();
            if (now > nextRestockCheckTime) {
                const minDelaySecs = parseFloat(document.getElementById('botMinDelay')?.value || "5");
                const maxDelaySecs = parseFloat(document.getElementById('botMaxDelay')?.value || "15");
                const minMs = minDelaySecs * 1000;
                const maxMs = Math.max(minMs + 1000, maxDelaySecs * 1000);
                const waitTimeMs = minMs + Math.random() * (maxMs - minMs);
                
                nextRestockCheckTime = now + waitTimeMs;
                logToConsole(`Checking background API for restock... (Next check in ~${(waitTimeMs/1000).toFixed(1)}s)`, "info");
                
                try {
                    const res = await fetch(window.location.href, { cache: 'no-store' });
                    const html = await res.text();
                    
                    // Parse the HTML into a temporary DOM to robustly check the button state
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    
                    let fetchedBtn = doc.querySelector('button.add-to-cart-button--PZmQF');
                    if (!fetchedBtn) {
                        const fetchedBtns = Array.from(doc.querySelectorAll('button'));
                        fetchedBtn = fetchedBtns.find(b => b.innerText && (b.innerText.includes('Add to Cart') || b.innerText.includes('Unavailable')));
                    }
                    
                    let isNowAvailable = false;
                    if (fetchedBtn) {
                        const isBtnUnavailable = fetchedBtn.disabled || 
                                                 fetchedBtn.classList.contains('disabled--vkECP') || 
                                                 (fetchedBtn.innerText && fetchedBtn.innerText.includes('Unavailable'));
                        if (!isBtnUnavailable && fetchedBtn.innerText && fetchedBtn.innerText.includes('Add to Cart')) {
                            isNowAvailable = true;
                        }
                    }

                    if (isNowAvailable) {
                        logToConsole("ðŸš¨ RESTOCK DETECTED in background! Refreshing page...", "success");
                        window.location.reload();
                        return; // Stop execution, page is reloading
                    } else {
                        logToConsole("Still out of stock in background.", "warning");
                    }
                } catch (e) {
                    logToConsole("Background check failed: " + e.message, "error");
                }
            } else {
                logToConsole("Waiting for product availability...", "warning");
                await sleep(1500);
            }
            botActionInProgress = false;
            return;
        }

        if (!input || (!increaseBtn && !decreaseBtn)) {
            logToConsole("Waiting for Quantity controls...", "warning");
            await sleep(1500);
            botActionInProgress = false;
            return;
        }

        let currentQty = parseInt(input.value, 10) || 1;
        
        if (currentQty !== targetQty) {
            logToConsole(`Adjusting qty: ${currentQty} -> ${targetQty}`, "info");
        }

        let attempts = 0;
        const maxAttempts = 100;
        
        // Step 1: Adjust Quantity via human clicks
        while (currentQty !== targetQty && attempts < maxAttempts && isBotRunning) {
            attempts++;
            if (currentQty < targetQty) {
                if (increaseBtn && increaseBtn.disabled) break;
                await simulateHumanClick(increaseBtn);
            } else if (currentQty > targetQty) {
                if (decreaseBtn && decreaseBtn.disabled) break;
                await simulateHumanClick(decreaseBtn);
            }
            
            await sleep(gaussianRandom(260, 45, 180, 400));
            currentQty = parseInt(input.value, 10);
        }

        if (!isBotRunning) {
            botActionInProgress = false;
            return;
        }

        // Step 2: Add to Cart and Verify
        if (addToCartBtn && !addToCartBtn.disabled) {
            const initialCartCount = getCartCount();
            
            await sleep(gaussianRandom(450, 80, 300, 700));
            logToConsole(`Clicking 'Add to Cart'...`, "info");
            await simulateHumanClick(addToCartBtn);
            
            logToConsole(`Verifying cart addition...`, "warning");
            
            let added = false;
            for (let i = 0; i < 20; i++) { 
                await sleep(500);
                const newCartCount = getCartCount();
                if (newCartCount !== -1 && newCartCount > initialCartCount) {
                    added = true;
                    logToConsole(`âœ… Added! New Cart Count is: ${newCartCount}`, "success");
                    break;
                }
            }
            
            if (!added) {
                logToConsole(`âŒ Cart count didn't increase in time.`, "error");
            } else {
                logToConsole(`Proceeding to Cart...`, "info");
                await sleep(gaussianRandom(600, 90, 400, 900));
                
                const cartBtn = document.querySelector('a.header-cart--_2R2kd, a[class*="header-cart"]');
                if (cartBtn) {
                    await simulateHumanClick(cartBtn);
                    try { cartBtn.click(); } catch(e) {}
                }
            }
        } else {
            logToConsole(`âŒ 'Add to Cart' button is disabled.`, "error");
        }

        await sleep(2500);
        botActionInProgress = false;
    }

    // --- Cart Page Logic ---
    async function executeCartPageBot() {
        if (!isBotRunning || botActionInProgress) return;
        botActionInProgress = true;
        
        logToConsole(`Evaluating Checkout options on Cart...`, "info");
        await sleep(gaussianRandom(700, 90, 450, 1000));
        
        const signInRegisterBtn = document.getElementById('signIn-register') || 
                                  document.querySelector('a[href*="/signin"]') || 
                                  document.querySelector('button[data-testid="signin-button"]');
        
        const accountIndicator = document.querySelector('.header-account--_1-XWn, a[href*="/account"], div[class*="account"], button[class*="account"]');
        const isAccountLoggedIn = !signInRegisterBtn || !!accountIndicator;

        let targetBtn = null;
        let btnLabel = "";
        
        if (isAccountLoggedIn && !signInRegisterBtn) {
            logToConsole(`ðŸ‘¤ Account detected! Targeting 'Continue Checkout'...`, "info");
            targetBtn = document.getElementById('checkout') || 
                        document.querySelector('button[data-ge-checkout-button="true"]') || 
                        document.querySelector('button[data-testid="checkout-button"]') || 
                        document.querySelector('a[href*="/checkout"]') ||
                        document.getElementById('guest-checkout');
            btnLabel = "Continue Checkout";
        } else {
            logToConsole(`Guest flow: Looking for Guest Checkout...`, "info");
            targetBtn = document.getElementById('guest-checkout') || 
                        document.getElementById('checkout') || 
                        document.querySelector('button[data-ge-checkout-button="true"]');
            btnLabel = targetBtn?.id === 'guest-checkout' ? "Guest Checkout" : "Continue Checkout";
        }
        
        if (!targetBtn) {
            const btns = Array.from(document.querySelectorAll('button, a'));
            targetBtn = btns.find(b => b.innerText && (b.innerText.toLowerCase().includes('checkout') || b.innerText.toLowerCase().includes('continue')));
            btnLabel = "Checkout";
        }

        if (!targetBtn) {
            logToConsole(`Waiting for Checkout button...`, "warning");
            await sleep(1000);
            botActionInProgress = false;
            return;
        }

        if (targetBtn.disabled) {
            logToConsole(`${btnLabel} is disabled. Waiting...`, "warning");
            await sleep(1000);
            botActionInProgress = false;
            return;
        }

        logToConsole(`Clicking ${btnLabel}...`, "success");
        await sleep(gaussianRandom(550, 80, 400, 850));
        await simulateHumanClick(targetBtn);
        try { targetBtn.click(); } catch(e) {}
        
        logToConsole(`âœ… Proceeding to Checkout Page!`, "success");

        await sleep(2500);
        botActionInProgress = false;
    }

    // --- Checkout Page Logic ---
    async function executeCheckoutPageBot() {
        if (!isBotRunning || botActionInProgress) return;
        botActionInProgress = true;

        logToConsole(`Checking Checkout Page state...`, "info");
        await sleep(gaussianRandom(1000, 120, 750, 1400));

        // Step 0: Check for Order Summary Page
        if (window.location.href.includes('/checkout/summary')) {
            logToConsole(`ðŸ“‘ Order Summary Page detected.`, "info");
            await sleep(gaussianRandom(1500, 200, 1000, 2500));
            
            let placeOrderBtn = document.querySelector('button[value="PLACE ORDER"]') ||
                                Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.toUpperCase().includes('PLACE ORDER'));

            if (placeOrderBtn && !placeOrderBtn.disabled) {
                logToConsole(`âœ… Clicking PLACE ORDER...`, "success");
                await simulateHumanClick(placeOrderBtn);
                try { placeOrderBtn.click(); } catch(e) {}
                await sleep(3000);
                
                logToConsole(`ðŸŽ‰ Checkout completed! Stopping bot.`, "success");
                isBotRunning = false;
                localStorage.setItem('pc_bot_running', 'false');
                updateButtons();
            } else {
                logToConsole(`Waiting for PLACE ORDER button...`, "info");
            }
            botActionInProgress = false;
            return;
        }

        // Step 1: Check if Billing Form is already displayed
        const isPaymentUrl = window.location.href.includes('/checkout/payment');
        const billingSelector = document.getElementById('billing-selector') || 
                                document.querySelector('select.billing-method-selector--hoF5C') ||
                                document.querySelector('#billing-form select');
        const billingForm = document.getElementById('billing-form') || 
                            document.querySelector('form.billing--_3mMdc') ||
                            document.querySelector('form[class*="billing"]');
        const cardIframe = document.querySelector('iframe[src*="cybersource.com"]');

        if (billingSelector || billingForm || cardIframe || isPaymentUrl) {
            await handleBillingForm();
            botActionInProgress = false;
            return;
        }

        // Step 2: Check for Shipping Form
        const firstName = document.getElementById('shipping-givenName') || document.querySelector('input[name="firstName"]');
        const lastName = document.getElementById('shipping-familyName') || document.querySelector('input[name="lastName"]');

        if (firstName && lastName) {
            if (!firstName.value || !lastName.value) {
                logToConsole(`ðŸ“¦ Shipping Form detected. Filling details humanly...`, "info");

                const p_fn = localStorage.getItem('pc_bot_fn') || '';
                const p_ln = localStorage.getItem('pc_bot_ln') || '';
                const p_addr = localStorage.getItem('pc_bot_addr') || '';
                const p_apt = localStorage.getItem('pc_bot_apt') || '';
                const p_zip = localStorage.getItem('pc_bot_zip') || '';
                const p_phone = localStorage.getItem('pc_bot_phone') || '';
                const p_email = localStorage.getItem('pc_bot_email') || '';

                if (!p_fn || !p_ln || !p_addr || !p_zip || !p_phone || !p_email) {
                    logToConsole(`âŒ Shipping Profile incomplete! Fill in UI settings.`, "error");
                    isBotRunning = false;
                    localStorage.setItem('pc_bot_running', 'false');
                    updateButtons();
                    botActionInProgress = false;
                    return;
                }

                // Fill shipping fields humanly with keystroke dynamics
                await simulateHumanType(firstName, p_fn);
                await simulateHumanType(lastName, p_ln);

                const street = document.getElementById('shipping-streetAddress') || document.querySelector('input[name="streetAddress"]');
                if (street) await simulateHumanType(street, p_addr);

                const ext = document.getElementById('shipping-extendedAddress') || document.querySelector('input[name="extendedAddress"]');
                if (ext && p_apt) await simulateHumanType(ext, p_apt);

                const zip = document.getElementById('shipping-postalCode') || document.querySelector('input[name="postalCode"]');
                if (zip) await simulateHumanType(zip, p_zip);

                const phone = document.getElementById('shipping-phoneNumber') || document.querySelector('input[name="phoneNumber"]');
                if (phone) await simulateHumanType(phone, p_phone);

                const email = document.getElementById('shipping-email') || document.querySelector('input[name="email"]');
                if (email) await simulateHumanType(email, p_email);

                logToConsole(`âœ… Shipping Form filled!`, "success");
                await sleep(gaussianRandom(500, 70, 350, 750));
            } else {
                logToConsole(`ðŸ“¦ Shipping details already populated.`, "info");
            }
        } else {
            const savedAddress = document.querySelector('.saved-address--_2eS2L, div[class*="saved-address"], div[class*="address-card"]');
            if (savedAddress) {
                logToConsole(`ðŸ‘¤ Saved account shipping address detected!`, "info");
            }
        }

        // Look for the CONTINUE button (e.g. after shipping address or on saved address screen)
        logToConsole(`Looking for CONTINUE / Proceed to Payment button...`, "info");
        let continueBtn = document.querySelector('button[value="CONTINUE"]') ||
                          document.querySelector('button[data-testid="continue-to-payment"]') ||
                          document.querySelector('button.delivery-continue-button') ||
                          document.querySelector('button.shipping-continue-button') ||
                          document.querySelector('button[type="submit"]');

        if (!continueBtn) {
            const btns = Array.from(document.querySelectorAll('button'));
            continueBtn = btns.find(b => b.innerText && (
                b.innerText.toUpperCase().includes('CONTINUE') || 
                b.innerText.toUpperCase().includes('PAYMENT') ||
                b.innerText.toUpperCase().includes('SAVE & CONTINUE') ||
                b.innerText.toUpperCase().includes('PROCEED')
            ));
        }

        if (continueBtn && !continueBtn.disabled) {
            logToConsole(`Clicking CONTINUE to proceed to Payment...`, "success");
            await simulateHumanClick(continueBtn);
            try { continueBtn.click(); } catch(e) {}
            await sleep(gaussianRandom(1500, 200, 1100, 2000));
        }

        // Wait and check for Billing Form after clicking continue
        for (let i = 0; i < 20; i++) {
            const billSelect = document.getElementById('billing-selector') || 
                               document.querySelector('select.billing-method-selector--hoF5C') ||
                               document.querySelector('#billing-form');
            if (billSelect) {
                await handleBillingForm();
                break;
            }
            await sleep(500);
        }

        botActionInProgress = false;
    }

    // --- Billing & Payment Logic ---
    async function handleBillingForm() {
        logToConsole(`ðŸ’³ Billing & Payment Form detected!`, "info");

        // Try to find the billing selector (dropdown)
        let billingSelector = document.getElementById('billing-selector') || 
                               document.querySelector('select.billing-method-selector--hoF5C') || 
                               document.querySelector('#billing-form select');
                               
        const expiryMonthEl = document.getElementById('expiryMonth') || 
                              document.querySelector('select.billing-month-selector--lXrUh') || 
                              document.querySelector('select[name="expiryMonth"]');
        const cardIframe = document.querySelector('iframe[src*="cybersource.com"]');

        if (!billingSelector && !expiryMonthEl && !cardIframe) {
            // Wait up to 10 seconds for any of them to appear
            for (let i = 0; i < 20; i++) {
                await sleep(400);
                billingSelector = document.getElementById('billing-selector') || 
                                  document.querySelector('select.billing-method-selector--hoF5C') || 
                                  document.querySelector('#billing-form select');
                const tempExpiry = document.getElementById('expiryMonth') || 
                                   document.querySelector('select.billing-month-selector--lXrUh') || 
                                   document.querySelector('select[name="expiryMonth"]');
                const tempIframe = document.querySelector('iframe[src*="cybersource.com"]');
                if (billingSelector || tempExpiry || tempIframe) {
                    break;
                }
            }
        }

        // Re-check
        const finalExpiry = document.getElementById('expiryMonth') || 
                            document.querySelector('select.billing-month-selector--lXrUh') || 
                            document.querySelector('select[name="expiryMonth"]');
        const finalIframe = document.querySelector('iframe[src*="cybersource.com"]');
        billingSelector = document.getElementById('billing-selector') || 
                          document.querySelector('select.billing-method-selector--hoF5C') || 
                          document.querySelector('#billing-form select');

        if (!billingSelector && !finalExpiry && !finalIframe) {
            logToConsole(`Waiting for Payment / Billing section to load...`, "warning");
            return;
        }

        if (billingSelector) {
            logToConsole(`âœ… Billing selector ready! Selecting 'Credit/Debit Card'...`, "info");
            await sleep(gaussianRandom(400, 60, 250, 600));

            // Click "Select payment method" dropdown and select "Credit/Debit Card"
            if (billingSelector.value !== 'credit-card') {
                logToConsole(`Selecting 'Credit/Debit Card' method...`, "info");
                await simulateHumanSelect(billingSelector, 'credit-card');
            } else {
                logToConsole(`'Credit/Debit Card' already selected.`, "info");
            }

            // Wait for card container to expand
            logToConsole(`Waiting for Credit Card fields container to appear...`, "info");
            let cardContainer = null;
            for (let i = 0; i < 20; i++) {
                cardContainer = document.getElementById('card-number-container') || 
                                document.querySelector('.billing-card-number--rchpm') || 
                                document.querySelector('#expiryMonth') || 
                                document.querySelector('select.billing-month-selector--lXrUh');
                if (cardContainer) break;
                
                // If not expanded after 4 attempts, re-trigger selection
                if (i === 4 || i === 10) {
                    logToConsole(`Re-triggering payment method selection...`, "warning");
                    await simulateHumanSelect(billingSelector, 'credit-card');
                }
                await sleep(400);
            }

            if (!cardContainer) {
                logToConsole(`âš ï¸ Card inputs container did not appear after selection.`, "error");
            }
        } else {
            logToConsole(`No billing selector dropdown found, but payment input fields are directly on screen. Proceeding...`, "info");
        }

        await sleep(gaussianRandom(600, 80, 450, 900));

        // Retrieve card details from storage
        const cardNum = localStorage.getItem('pc_bot_card_num') || '';
        const expMonth = (localStorage.getItem('pc_bot_exp_month') || '08').padStart(2, '0');
        let expYear = localStorage.getItem('pc_bot_exp_year') || '2026';
        if (expYear.length === 2) expYear = '20' + expYear;
        const cvv = localStorage.getItem('pc_bot_cvv') || '';

        if (!cardNum || !expMonth || !expYear || !cvv) {
            logToConsole(`âš ï¸ Payment details missing in UI settings! Please configure them.`, "warning");
            isBotRunning = false;
            localStorage.setItem('pc_bot_running', 'false');
            updateButtons();
            return;
        }

        // Fill Expiry Month
        const expiryMonthElFill = finalExpiry || 
                                  document.getElementById('expiryMonth') || 
                                  document.querySelector('select.billing-month-selector--lXrUh') || 
                                  document.querySelector('select[name="expiryMonth"]');
        if (expiryMonthElFill) {
            logToConsole(`ðŸ—“ï¸ Selecting Expiration Month: ${expMonth}`, "info");
            await simulateHumanSelect(expiryMonthElFill, expMonth);
        } else {
            logToConsole(`âš ï¸ Expiration Month dropdown not found.`, "warning");
        }

        await sleep(gaussianRandom(350, 50, 220, 550));

        // Fill Expiry Year
        const expiryYearEl = document.getElementById('expiryYear') || 
                             document.querySelector('select.billing-year-selector--_8jgch') || 
                             document.querySelector('select[name="expiryYear"]');
        if (expiryYearEl) {
            logToConsole(`ðŸ—“ï¸ Selecting Expiration Year: ${expYear}`, "info");
            await simulateHumanSelect(expiryYearEl, expYear);
        } else {
            logToConsole(`âš ï¸ Expiration Year dropdown not found.`, "warning");
        }

        await sleep(gaussianRandom(450, 60, 300, 650));

        // Fill Card Number & CVV via CyberSource Microform iframes
        logToConsole(`ðŸ”’ Autofilling Card Number & CVV via secure CyberSource microforms...`, "info");
        broadcastToCybersourceIframes(cardNum, cvv);
        
        // Wait comfortably for realistic human typing keystrokes to complete in iframes
        await sleep(4000);

        logToConsole(`âœ… Credit Card & Billing information autofilled successfully!`, "success");
        
        await sleep(gaussianRandom(800, 150, 500, 1200));

        // Find and click the CONTINUE button on the payment form
        let paymentContinueBtn = document.querySelector('button[value="CONTINUE"]') ||
                                 Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.trim().toUpperCase() === 'CONTINUE');

        if (paymentContinueBtn && !paymentContinueBtn.disabled) {
            logToConsole(`âœ… Clicking CONTINUE to review order...`, "success");
            await simulateHumanClick(paymentContinueBtn);
            try { paymentContinueBtn.click(); } catch(e) {}
            await sleep(gaussianRandom(2000, 300, 1500, 3000));
        } else {
            logToConsole(`âš ï¸ CONTINUE button on billing not found or disabled.`, "warning");
        }
    }

    // Function to check URL and state, update Title
    function checkUrlAndUI() {
        const currentUrl = window.location.href;
        const pageTypeEl = document.getElementById('botPageType');
        
        let message = "ðŸŒ General Page";
        if (currentUrl.includes('/checkout')) {
            message = "ðŸ’³ Checkout Page Detected";
        } else if (currentUrl.includes('/product')) {
            message = "ðŸ›ï¸ Product Page Detected";
        } else if (currentUrl.includes('/search')) {
            message = "ðŸ” Search Page Detected";
        } else if (currentUrl.includes('/cart')) {
            message = "ðŸ›’ Cart Page Detected";
        }
        
        if (pageTypeEl && currentUrl !== lastUrl) {
            pageTypeEl.innerText = message;
            lastUrl = currentUrl;
            logToConsole(`Navigated: ${message}`, "info");
        }
    }

    // Main loop to continuously evaluate bot actions
    async function botLoop() {
        if (isBotRunning) {
            const currentUrl = window.location.href;
            if (currentUrl.includes('/product')) {
                await executeProductPageBot();
            } else if (currentUrl.includes('/cart')) {
                await executeCartPageBot();
            } else if (currentUrl.includes('/checkout')) {
                await executeCheckoutPageBot();
            }
        }
    }

    // Initialize UI
    initUI();
    logToConsole("System initialized with biometric humanization.", "success");
    
    // Restore bot state
    if (localStorage.getItem('pc_bot_running') === 'true') {
        isBotRunning = true;
        updateButtons();
        logToConsole("Restored state: Bot is running.", "info");
    } else {
        updateButtons();
    }

    checkUrlAndUI();
    
    // Monitor for navigation/SPA changes
    setInterval(checkUrlAndUI, 500);
    
    // Sync with Flask Dashboard
    async function syncWithDashboard() {
        try {
            const res = await gmFetch(`http://localhost:8000/api/pok/config?url=${encodeURIComponent(window.location.href)}`);
            if (res.ok) {
                const config = await res.json();
                
                if (config.bot_running !== undefined) {
                    if (config.bot_running && !isBotRunning) {
                        isBotRunning = true;
                        localStorage.setItem('pc_bot_running', 'true');
                        updateButtons();
                        logToConsole('Bot started remotely (synced).', 'success');
                    } else if (!config.bot_running && isBotRunning) {
                        isBotRunning = false;
                        localStorage.setItem('pc_bot_running', 'false');
                        botActionInProgress = false;
                        updateButtons();
                        logToConsole('Bot stopped remotely (synced).', 'error');
                    }
                }

                                if (config.schedule_time !== undefined) {
                    localStorage.setItem('pc_bot_schedule_time', config.schedule_time);
                }
                if (config.target_qty !== undefined) localStorage.setItem('pc_bot_target_qty', config.target_qty);
                if (config.min_delay !== undefined) localStorage.setItem('pc_bot_min_delay', config.min_delay);
                if (config.max_delay !== undefined) localStorage.setItem('pc_bot_max_delay', config.max_delay);
                
                if (config.profile) {
                    if (config.profile.first_name !== undefined) localStorage.setItem('pc_bot_fn', config.profile.first_name);
                    if (config.profile.last_name !== undefined) localStorage.setItem('pc_bot_ln', config.profile.last_name);
                    if (config.profile.address !== undefined) localStorage.setItem('pc_bot_addr', config.profile.address);
                    if (config.profile.apt !== undefined) localStorage.setItem('pc_bot_apt', config.profile.apt);
                    if (config.profile.zip !== undefined) localStorage.setItem('pc_bot_zip', config.profile.zip);
                    if (config.profile.phone !== undefined) localStorage.setItem('pc_bot_phone', config.profile.phone);
                    if (config.profile.email !== undefined) localStorage.setItem('pc_bot_email', config.profile.email);
                }

                if (config.payment) {
                    let paymentChanged = false;
                    if (config.payment.card_num !== undefined && localStorage.getItem('pc_bot_card_num') !== config.payment.card_num) {
                        localStorage.setItem('pc_bot_card_num', config.payment.card_num);
                        paymentChanged = true;
                    }
                    if (config.payment.exp_month !== undefined && localStorage.getItem('pc_bot_exp_month') !== config.payment.exp_month) {
                        localStorage.setItem('pc_bot_exp_month', config.payment.exp_month);
                        paymentChanged = true;
                    }
                    if (config.payment.exp_year !== undefined && localStorage.getItem('pc_bot_exp_year') !== config.payment.exp_year) {
                        localStorage.setItem('pc_bot_exp_year', config.payment.exp_year);
                        paymentChanged = true;
                    }
                    if (config.payment.cvv !== undefined && localStorage.getItem('pc_bot_cvv') !== config.payment.cvv) {
                        localStorage.setItem('pc_bot_cvv', config.payment.cvv);
                        paymentChanged = true;
                    }
                    
                    if (paymentChanged) {
                        try {
                            if (typeof GM_setValue !== 'undefined') {
                                GM_setValue('pc_bot_card_num', config.payment.card_num || '');
                                GM_setValue('pc_bot_cvv', config.payment.cvv || '');
                                GM_setValue('pc_bot_trigger_fill', Date.now());
                            }
                        } catch (e) {}
                    }
                }

                // Update UI inputs to reflect dashboard values
                const qtyInput = document.getElementById('botTargetQty');
                const minDelayInput = document.getElementById('botMinDelay');
                const maxDelayInput = document.getElementById('botMaxDelay');
                if (qtyInput && config.target_qty !== undefined) qtyInput.value = config.target_qty;
                if (minDelayInput && config.min_delay !== undefined) minDelayInput.value = config.min_delay;
                if (maxDelayInput && config.max_delay !== undefined) maxDelayInput.value = config.max_delay;
                
                const p_fn = document.getElementById('p_fn');
                const p_ln = document.getElementById('p_ln');
                const p_addr = document.getElementById('p_addr');
                const p_apt = document.getElementById('p_apt');
                const p_zip = document.getElementById('p_zip');
                const p_phone = document.getElementById('p_phone');
                const p_email = document.getElementById('p_email');
                if (p_fn && config.profile && config.profile.first_name !== undefined) p_fn.value = config.profile.first_name;
                if (p_ln && config.profile && config.profile.last_name !== undefined) p_ln.value = config.profile.last_name;
                if (p_addr && config.profile && config.profile.address !== undefined) p_addr.value = config.profile.address;
                if (p_apt && config.profile && config.profile.apt !== undefined) p_apt.value = config.profile.apt;
                if (p_zip && config.profile && config.profile.zip !== undefined) p_zip.value = config.profile.zip;
                if (p_phone && config.profile && config.profile.phone !== undefined) p_phone.value = config.profile.phone;
                if (p_email && config.profile && config.profile.email !== undefined) p_email.value = config.profile.email;

                const p_card_num = document.getElementById('p_card_num');
                const p_exp_month = document.getElementById('p_exp_month');
                const p_exp_year = document.getElementById('p_exp_year');
                const p_cvv = document.getElementById('p_cvv');
                if (p_card_num && config.payment && config.payment.card_num !== undefined) p_card_num.value = config.payment.card_num;
                if (p_exp_month && config.payment && config.payment.exp_month !== undefined) p_exp_month.value = config.payment.exp_month;
                if (p_exp_year && config.payment && config.payment.exp_year !== undefined) p_exp_year.value = config.payment.exp_year;
                if (p_cvv && config.payment && config.payment.cvv !== undefined) p_cvv.value = config.payment.cvv;
            }
        } catch (e) {}
    }

    
    // Send heartbeat to dashboard
    async function sendHeartbeat() {
        try {
            console.log("PokÃ©Bot: Sending heartbeat to dashboard...");
            await gmFetch('http://localhost:8000/api/pok/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: window.location.href })
            });
        } catch (e) {}
    }
    sendHeartbeat();
    setInterval(sendHeartbeat, 5000);

    // Fetch Commands from Dashboard
    async function fetchCommands() {
        try {
            const res = await gmFetch('http://localhost:8000/api/pok/commands');
            if (res.ok) {
                const data = await res.json();
                if (data.commands && data.commands.length > 0) {
                    for (const cmdObj of data.commands) {
                        if (cmdObj.cmd === 'navigate' && cmdObj.url) {
                            logToConsole(`Navigating to ${cmdObj.url}...`, 'info');
                            window.location.href = cmdObj.url;
                        } else if (cmdObj.cmd === 'start') {
                            if (!isBotRunning) {
                                isBotRunning = true;
                                localStorage.setItem('pc_bot_running', 'true');
                                updateButtons();
                                logToConsole('Bot started remotely.', 'success');
                            }
                        } else if (cmdObj.cmd === 'stop') {
                            if (isBotRunning) {
                                isBotRunning = false;
                                localStorage.setItem('pc_bot_running', 'false');
                                botActionInProgress = false;
                                updateButtons();
                                logToConsole('Bot stopped remotely.', 'error');
                            }
                        }
                    }
                }
            }
        } catch (e) {}
    }

    syncWithDashboard();
    setInterval(syncWithDashboard, 3000);
    
    fetchCommands();
    setInterval(fetchCommands, 1500);

    // Evaluate bot conditions frequently
    setInterval(botLoop, 1000);


}

function runTargetBot() {

    

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
            if (sncBtn && !sncBtn.disabled && sncBtn.getAttribute('aria-disabled') !== 'true') {
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


}

function runWalmartBot() {

    

    // Global Config State
    let botConfig = {
        bot_running: false,
        target_qty: 1,
        max_price: 50.00,
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
                body: JSON.stringify({ message: '[Walmart] ' + message, level })
            });
        } catch (e) {}
    }

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
                if (data.payment && data.payment.cvv) botConfig.cvv = data.payment.cvv;
            }
        } catch (e) {}
    }

    setInterval(() => {
        fetchConfig();
        sendHeartbeat();
    }, 2000);

    // ─── State ───────────────────────────────────────────────────────────────
    let botInterval         = null;
    let autoBuyTriggered    = false;
    let stockStatus         = 'UNKNOWN';  
    let currentPrice        = null;
    let stockPollTimer      = null;
    let stockObserver       = null;
// ─── LAYER 1: Fetch Interceptor ──────────────────────────────────────────
    // Intercept Walmart's own fetch calls to detect stock changes with ZERO extra requests.
    (function installFetchInterceptor() {
        const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
        const originalFetch = win.fetch;

        win.fetch = function(...args) {
            return originalFetch.apply(this, args).then(response => {
                try {
                    const url = (args[0] && typeof args[0] === 'string') ? args[0] : (args[0] && args[0].url ? args[0].url : '');
                    const isRelevant = url.includes('api/2/items') ||
                                       url.includes('graphql') ||
                                       url.includes('orchestra') ||
                                       url.includes('product') ||
                                       url.includes('availability') ||
                                       url.includes('offers');

                    if (isRelevant) {
                        const cloned = response.clone();
                        cloned.json().then(data => {
                            const extracted = extractStockFromData(data);
                            if (extracted) {
                                onStockDataReceived(extracted.status, extracted.price, 'fetch-interceptor');
                            }
                        }).catch(() => {});
                    }
                } catch(e) {}
                return response;
            });
        };

        // Also intercept XHR for older Walmart API calls
        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            this._wpd_url = url;
            return origOpen.apply(this, [method, url, ...rest]);
        };
        XMLHttpRequest.prototype.send = function(...args) {
            const url = this._wpd_url || '';
            const isRelevant = url.includes('api/2/items') || url.includes('graphql') || url.includes('availability');
            if (isRelevant) {
                this.addEventListener('load', () => {
                    try {
                        const data = JSON.parse(this.responseText);
                        const extracted = extractStockFromData(data);
                        if (extracted) {
                            onStockDataReceived(extracted.status, extracted.price, 'xhr-interceptor');
                        }
                    } catch(e) {}
                });
            }
            return origSend.apply(this, args);
        };
    })();

    // ─── Stock Data Parser ───────────────────────────────────────────────────
    // Recursively search any JSON response for availability fields.
    function extractStockFromData(data) {
        if (!data || typeof data !== 'object') return null;
        const str = JSON.stringify(data);
        let status = null;
        let price = null;

        // Look for availabilityStatus field
        const statusMatch = str.match(/"availabilityStatus"\s*:\s*"([^"]+)"/);
        if (statusMatch) {
            status = statusMatch[1]; // "IN_STOCK" | "OUT_OF_STOCK" | "PRE_ORDER"
        }
        // Look for price field
        const priceMatch = str.match(/"price"\s*:\s*([\d.]+)/);
        if (priceMatch) {
            price = parseFloat(priceMatch[1]);
        }
        return status ? { status, price } : null;
    }

    // ─── Stock Event Handler ─────────────────────────────────────────────────
    function onStockDataReceived(status, price, source) {
        const wasOutOfStock = stockStatus !== 'IN_STOCK';
        stockStatus = status;
        if (price !== null && !isNaN(price)) currentPrice = price;

        console.log(`[WPD] Stock update from ${source}: ${status} @ $${currentPrice}`);
        updateStockUI();

        // If it just came IN_STOCK, try to buy
        if (status === 'IN_STOCK' && wasOutOfStock && botConfig.bot_running && !autoBuyTriggered) {
            if (currentPrice === null || currentPrice <= botConfig.max_price) {
                console.log('[WPD] Stock just became available! Triggering buy flow...');
                triggerBuyFlow();
            }
        }
    }

    // ─── LAYER 2: DOM MutationObserver ───────────────────────────────────────
    // Watch for Buy Now / Add to Cart button becoming enabled.
    function installDomObserver() {
        if (stockObserver) stockObserver.disconnect();

        stockObserver = new MutationObserver(() => {
            const buyBtn = document.querySelector('[data-testid="buy-now-wrapper"]:not([disabled])');
            const addBtn = document.querySelector('[data-testid="add-to-cart-button"]:not([disabled])');

            if ((buyBtn || addBtn) && stockStatus !== 'IN_STOCK') {
                console.log('[WPD] DOM observer: Buy/Cart button appeared/enabled!');
                onStockDataReceived('IN_STOCK', currentPrice, 'dom-observer');
            }
        });

        stockObserver.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['disabled', 'aria-disabled'] });
    }

    // ─── LAYER 3: Lightweight Background Poll ────────────────────────────────
    // Only used as fallback when page is idle and makes no native calls.
    function startStockPoll(itemId) {
        stopStockPoll();

        function poll() {
            // Randomized 45–90 second interval to look human
            const delay = (45 + Math.random() * 45) * 1000;
            stockPollTimer = setTimeout(async () => {
                if (!window.location.pathname.includes('/ip/')) return;
                try {
                    console.log('[WPD] Background poll checking stock...');
                    const res = await fetch(`/api/2/items?ids=${itemId}`, {
                        headers: { 'Accept': 'application/json' }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        const extracted = extractStockFromData(data);
                        if (extracted) {
                            onStockDataReceived(extracted.status, extracted.price, 'background-poll');
                        }
                    }
                } catch(e) {
                    console.log('[WPD] Poll error:', e);
                }
                poll(); // schedule next poll
            }, delay);
        }

        poll();
    }

    function stopStockPoll() {
        if (stockPollTimer) {
            clearTimeout(stockPollTimer);
            stockPollTimer = null;
        }
    }

    // ─── LAYER 4: __NEXT_DATA__ Reader ───────────────────────────────────────
    // Read embedded JSON on initial page load — instant, no extra request.
    function readNextData() {
        const nextDataEl = document.getElementById('__NEXT_DATA__');
        if (nextDataEl) {
            try {
                const data = JSON.parse(nextDataEl.textContent);
                const extracted = extractStockFromData(data);
                if (extracted) {
                    onStockDataReceived(extracted.status, extracted.price, '__NEXT_DATA__');
                    return true;
                }
            } catch(e) {}
        }
        return false;
    }

    // ─── UI Injection ─────────────────────────────────────────────────────────
    // We inject the UI after DOMContentLoaded so elements are ready.
    function initUI() {
        if (document.getElementById('walmart-page-detector-ui')) return;

        const fontLink = document.createElement('link');
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);

        const style = document.createElement('style');
        style.innerHTML = `
            #walmart-page-detector-ui {
                position: fixed;
                bottom: 30px;
                right: 30px;
                background: rgba(15, 23, 42, 0.92);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 16px;
                padding: 20px 24px;
                color: #f8fafc;
                font-family: 'Inter', system-ui, -apple-system, sans-serif;
                z-index: 9999999;
                box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3);
                transform: translateY(30px) scale(0.95);
                opacity: 0;
                transition: all 0.5s cubic-bezier(0.175,0.885,0.32,1.275);
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: auto;
                width: 270px;
            }
            #walmart-page-detector-ui.wpd-visible { transform: translateY(0) scale(1); opacity: 1; }
            .wpd-title {
                font-weight: 700;
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 0.12em;
                color: #64748b;
            }
            .wpd-row {
                display: flex;
                align-items: center;
                gap: 10px;
                font-weight: 600;
                font-size: 17px;
            }
            .wpd-indicator {
                width: 11px; height: 11px;
                border-radius: 50%;
                flex-shrink: 0;
                animation: wpdPulse 2s infinite;
            }
            .wpd-led-home    { background:#8b5cf6; box-shadow:0 0 10px #8b5cf6; }
            .wpd-led-search  { background:#ec4899; box-shadow:0 0 10px #ec4899; }
            .wpd-led-product { background:#10b981; box-shadow:0 0 10px #10b981; }
            .wpd-led-checkout{ background:#f59e0b; box-shadow:0 0 10px #f59e0b; }
            .wpd-led-default { background:#3b82f6; box-shadow:0 0 10px #3b82f6; }
            .wpd-stock-row {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 12px;
                padding: 6px 10px;
                border-radius: 8px;
                background: rgba(255,255,255,0.06);
            }
            .wpd-stock-dot {
                width: 8px; height: 8px;
                border-radius: 50%;
                flex-shrink: 0;
            }
            .wpd-stock-dot.in  { background: #10b981; box-shadow: 0 0 6px #10b981; }
            .wpd-stock-dot.out { background: #ef4444; box-shadow: 0 0 6px #ef4444; }
            .wpd-stock-dot.unk { background: #64748b; }
            .wpd-badge {
                background: rgba(255,255,255,0.1);
                padding: 2px 8px;
                border-radius: 20px;
                font-size: 11px;
                font-family: monospace;
                color: #e2e8f0;
            }
            .wpd-divider { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 2px 0; }
            .wpd-settings { display: none; flex-direction: column; gap: 10px; }
            .wpd-input-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 12px;
                color: #94a3b8;
            }
            .wpd-input-row input {
                background: rgba(0,0,0,0.25);
                border: 1px solid rgba(255,255,255,0.1);
                color: white;
                border-radius: 6px;
                padding: 5px 9px;
                width: 85px;
                font-family: 'Inter', sans-serif;
                font-size: 13px;
                outline: none;
                transition: border-color 0.2s;
            }
            .wpd-input-row input:focus { border-color: #3b82f6; }
            .wpd-btn {
                padding: 9px;
                border-radius: 8px;
                border: none;
                font-weight: 600;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s;
                font-family: 'Inter', sans-serif;
                width: 100%;
            }
            .wpd-btn-off { background: rgba(255,255,255,0.08); color:#94a3b8; }
            .wpd-btn-off:hover { background: rgba(255,255,255,0.13); }
            .wpd-btn-on  { background:#10b981; color:white; box-shadow:0 4px 14px rgba(16,185,129,0.35); }
            .wpd-btn-on:hover { background:#059669; }
            .wpd-source-tag {
                font-size: 10px;
                color: #475569;
                text-align: right;
                font-family: monospace;
            }
            @keyframes wpdPulse {
                0%   { opacity:0.7; transform:scale(0.9); }
                50%  { opacity:1;   transform:scale(1.15); }
                100% { opacity:0.7; transform:scale(0.9); }
            }
        `;
        document.head.appendChild(style);

        const ui = document.createElement('div');
        ui.id = 'walmart-page-detector-ui';
        ui.innerHTML = `
            <div class="wpd-title">Walmart Bot v2.0</div>
            <div class="wpd-row">
                <div class="wpd-indicator wpd-led-default" id="wpd-led"></div>
                <span id="wpd-text">Detecting...</span>
            </div>
            <div id="wpd-stock-row" class="wpd-stock-row" style="display:none;">
                <div class="wpd-stock-dot unk" id="wpd-stock-dot"></div>
                <span id="wpd-stock-text" style="flex:1;color:#cbd5e1;">Checking stock...</span>
                <span class="wpd-badge" id="wpd-price-badge" style="display:none;"></span>
            </div>
            <div class="wpd-source-tag" id="wpd-source"></div>
            <hr class="wpd-divider" id="wpd-settings-divider" style="display:none;">
            <div class="wpd-settings" id="wpd-settings">
                <div class="wpd-input-row">
                    <label>Max Price ($)</label>
                    <input type="number" id="wpd-max-price" step="0.01" min="0">
                </div>
                <div class="wpd-input-row">
                    <label>Quantity</label>
                    <input type="number" id="wpd-quantity" min="1" max="99">
                </div>
                <div class="wpd-input-row">
                    <label>CVV</label>
                    <input type="password" id="wpd-cvv" maxlength="4" placeholder="3 digits">
                </div>
                <button id="wpd-auto-buy-btn" class="wpd-btn wpd-btn-off">Auto Buy: OFF</button>
            </div>
        `;
        document.body.appendChild(ui);
        setTimeout(() => ui.classList.add('wpd-visible'), 100);

        // Wire up elements
        const led          = document.getElementById('wpd-led');
        const textEl       = document.getElementById('wpd-text');
        const stockRow     = document.getElementById('wpd-stock-row');
        const stockDot     = document.getElementById('wpd-stock-dot');
        const stockText    = document.getElementById('wpd-stock-text');
        const priceBadge   = document.getElementById('wpd-price-badge');
        const sourceTag    = document.getElementById('wpd-source');
        const settingDiv   = document.getElementById('wpd-settings');
        const settingDiv2  = document.getElementById('wpd-settings-divider');
        const maxPriceInput= document.getElementById('wpd-max-price');
        const qtyInput     = document.getElementById('wpd-quantity');
        const cvvInput     = document.getElementById('wpd-cvv');
        const autoBuyBtn   = document.getElementById('wpd-auto-buy-btn');

        // Pre-fill saved values
        maxPriceInput.value = botConfig.max_price.toFixed(2);
        qtyInput.value      = botConfig.target_qty;
        cvvInput.value      = botConfig.cvv;

        // Persist on input
        maxPriceInput.addEventListener('input', e => {
            botConfig.max_price = parseFloat(e.target.value) || 0;
            localStorage.setItem('wpd-max-price', botConfig.max_price);
        });
        qtyInput.addEventListener('input', e => {
            botConfig.target_qty = parseInt(e.target.value) || 1;
            localStorage.setItem('wpd-quantity', botConfig.target_qty);
        });
        cvvInput.addEventListener('input', e => {
            botConfig.cvv = e.target.value;
            localStorage.setItem('wpd-cvv', botConfig.cvv);
            // Live-update checkout page CVV field if visible
            const actualCvvField = document.getElementById('cvv-field');
            if (actualCvvField) {
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(actualCvvField, botConfig.cvv);
                actualCvvField.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });

        autoBuyBtn.addEventListener('click', () => {
            botConfig.bot_running = !botConfig.bot_running;
            localStorage.setItem('wpd-autobuy', botConfig.bot_running);
            syncBtnState();
        });

        function syncBtnState() {
            autoBuyBtn.innerText = botConfig.bot_running ? 'Auto Buy: ON' : 'Auto Buy: OFF';
            autoBuyBtn.className = botConfig.bot_running ? 'wpd-btn wpd-btn-on' : 'wpd-btn wpd-btn-off';
        }
        syncBtnState();

        // ── Expose update functions globally so other code can call them ──
        window._wpdUpdatePageUI = function(pageType, extra) {
            const configs = {
                home:     { label:'Home Page',     cls:'wpd-led-home'    },
                search:   { label:'Search Page',   cls:'wpd-led-search'  },
                product:  { label:'Product Page',  cls:'wpd-led-product' },
                checkout: { label:'Checkout Page', cls:'wpd-led-checkout'},
                other:    { label:'Other Page',    cls:'wpd-led-default' },
            };
            const cfg = configs[pageType] || configs.other;
            textEl.innerText = cfg.label;
            led.className = 'wpd-indicator ' + cfg.cls;

            const isProduct  = pageType === 'product';
            const isCheckout = pageType === 'checkout';
            settingDiv.style.display   = (isProduct || isCheckout) ? 'flex' : 'none';
            settingDiv2.style.display  = (isProduct || isCheckout) ? 'block' : 'none';
            stockRow.style.display     = isProduct ? 'flex' : 'none';

            if (extra && extra.query) {
                stockText.innerText = `Query: ${extra.query}`;
                stockRow.style.display = 'flex';
                stockDot.className = 'wpd-stock-dot unk';
            }
        };

        window._wpdUpdateStockUI = function(status, price, source) {
            const isIn = status === 'IN_STOCK';
            stockDot.className = 'wpd-stock-dot ' + (isIn ? 'in' : status === 'OUT_OF_STOCK' ? 'out' : 'unk');
            stockText.innerText = isIn ? 'IN STOCK' : status === 'OUT_OF_STOCK' ? 'Out of Stock' : 'Checking...';
            if (price != null) {
                priceBadge.style.display = '';
                priceBadge.innerText = `$${price.toFixed(2)}`;
            }
            sourceTag.innerText = source ? `via ${source}` : '';
        };
    }

    function updateStockUI() {
        if (window._wpdUpdateStockUI) {
            window._wpdUpdateStockUI(stockStatus, currentPrice, '');
        }
    }

    // ─── Page Router ──────────────────────────────────────────────────────────
    function checkPage() {
        const pathname = window.location.pathname;

        if (pathname === '/' || pathname === '/home') {
            if (window._wpdUpdatePageUI) window._wpdUpdatePageUI('home');
            stopStockPoll();
            if (stockObserver) stockObserver.disconnect();

        } else if (pathname.includes('/search')) {
            const q = new URLSearchParams(window.location.search).get('q');
            if (window._wpdUpdatePageUI) window._wpdUpdatePageUI('search', { query: q });
            stopStockPoll();

        } else if (pathname.includes('/ip/')) {
            if (window._wpdUpdatePageUI) window._wpdUpdatePageUI('product');
            stockStatus = 'UNKNOWN';
            currentPrice = null;
            autoBuyTriggered = false;

            // Start price bot
            startPriceBot();

            // Layer 4: read embedded data first
            const gotData = readNextData();

            // Layer 2: watch the DOM
            installDomObserver();

            // Layer 3: start lightweight background poll
            const itemIdMatch = pathname.match(/\/ip\/[^/]+\/(\d+)/);
            const itemId = itemIdMatch ? itemIdMatch[1] : null;
            if (itemId) startStockPoll(itemId);

        } else if (pathname.includes('/checkout')) {
            if (window._wpdUpdatePageUI) window._wpdUpdatePageUI('checkout');
            stopStockPoll();
            if (botConfig.bot_running) startCheckoutBot();

        } else {
            if (window._wpdUpdatePageUI) window._wpdUpdatePageUI('other');
            stopStockPoll();
        }
    }

    // ─── Price Bot (product page) ─────────────────────────────────────────────
    function startPriceBot() {
        if (botInterval) clearInterval(botInterval);
        botInterval = setInterval(() => {
            const priceEl = document.querySelector('[itemprop="price"], [data-fs-element="price"]');
            if (priceEl) {
                const price = parseFloat(priceEl.innerText.replace(/[^0-9.]/g, ''));
                if (!isNaN(price)) {
                    currentPrice = price;
                    updateStockUI();
                }
            }
        }, 1500);
    }

    // ─── Buy Flow ─────────────────────────────────────────────────────────────
    function triggerBuyFlow() {
        autoBuyTriggered = true;
        const buyBtn = document.querySelector('button[data-testid="buy-now-wrapper"]');
        if (buyBtn && !buyBtn.disabled) {
            buyBtn.click();
            waitForPanelAndSetQuantity();
        } else {
            autoBuyTriggered = false; // retry next stock event
        }
    }

    function waitForPanelAndSetQuantity() {
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            const incBtn  = document.querySelector('[data-testid="quantity-stepper-inc-button"]');
            const qtyLabel= document.querySelector('[data-testid="quantity-label"]');
            if (incBtn && qtyLabel) {
                const cur = parseInt(qtyLabel.innerText);
                if (cur < botConfig.target_qty) {
                    if (!incBtn.disabled) incBtn.click();
                    else {
                        clearInterval(interval);
                        proceedToCheckoutOrPlaceOrder();
                    }
                } else {
                    clearInterval(interval);
                    proceedToCheckoutOrPlaceOrder();
                }
            }
            if (attempts > 40) clearInterval(interval);
        }, 400);
    }

    function proceedToCheckoutOrPlaceOrder() {
        setTimeout(() => {
            const cvvBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Enter your CVV'));
            if (cvvBtn) {
                cvvBtn.click();
            } else {
                const btn = document.querySelector('button[aria-label*="Place order"]');
                if (btn) btn.click();
            }
        }, 400);
    }

    // ─── Checkout Bot ─────────────────────────────────────────────────────────
    function startCheckoutBot() {
        const interval = setInterval(() => {
            if (!botConfig.bot_running || !window.location.pathname.includes('/checkout')) {
                clearInterval(interval);
                return;
            }
            const cvvField = document.getElementById('cvv-field');
            if (cvvField) {
                if (botConfig.cvv && cvvField.value !== botConfig.cvv) {
                    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    setter.call(cvvField, botConfig.cvv);
                    cvvField.dispatchEvent(new Event('input', { bubbles: true }));
                    cvvField.dispatchEvent(new Event('change', { bubbles: true }));
                }
                const placeBtn = document.querySelector('[data-testid="place-order-button"], [data-automation-id="place-order-button"]');
                if (placeBtn && !placeBtn.disabled) {
                    placeBtn.click();
                    console.log('[WPD] Final Place Order clicked!');
                }
            }
        }, 50);
    }

    // ─── Bootstrap ────────────────────────────────────────────────────────────
    // UI needs DOM, routing can start immediately
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { initUI(); checkPage(); });
    } else {
        initUI();
        checkPage();
    }

    // SPA navigation watcher
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            checkPage();
        }
    }).observe(document.documentElement, { subtree: true, childList: true });


}
})();
