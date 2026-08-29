// ==UserScript==
// @name         Pokemon Center Script
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Advanced script for pokemoncenter.com with UI Console, Humanized Account Checkout & Payment Autofill
// @author       Pythonic Shariful
// @match        https://www.pokemoncenter.com/*
// @match        https://flex.cybersource.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        GM_xmlhttpRequest
// @connect      localhost
// ==/UserScript==

(function() {
    'use strict';

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
            <div id="botPageType" style="margin-bottom: 12px; font-size: 15px; font-weight: bold; color: #fff;">ðŸŒ Initializing...</div>
            
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
                <button id="botScheduleBtn" style="padding: 10px 16px; cursor: pointer; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border: none; border-radius: 8px; font-weight: 700; font-size: 13px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3); align-self: flex-end; transition: transform 0.1s, filter 0.2s;">â³ Set</button>
            </div>
            
            <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                <button id="botStartBtn" style="flex: 1; padding: 10px; cursor: pointer; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 8px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: transform 0.1s, filter 0.2s;">â–¶ START</button>
                <button id="botStopBtn" style="flex: 1; padding: 10px; cursor: pointer; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; border: none; border-radius: 8px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); transition: transform 0.1s, filter 0.2s;">â¹ STOP</button>
            </div>

            <!-- Shipping Profile Settings -->
            <details style="margin-bottom: 12px; background: rgba(255,255,255,0.03); padding: 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
                <summary style="cursor: pointer; font-weight: 600; color: #fbbf24; outline: none; user-select: none;">ðŸ“¦ Shipping Profile</summary>
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
                <summary style="cursor: pointer; font-weight: 600; color: #38bdf8; outline: none; user-select: none;">ðŸ’³ Payment Details</summary>
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
                    <button id="botSaveSettingsBtn" style="margin-top: 10px; padding: 10px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); transition: transform 0.1s, filter 0.2s;">ðŸ’¾ Save Profile & Card</button>
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

})();
