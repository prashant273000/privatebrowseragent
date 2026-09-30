import { parsePrompt } from './nlp/index';
import { processTaskUnderstanding } from './task-understanding/index';
import { runPrivacyPipeline, getSessionVault } from './privacy/privacyPipeline';
import { requestNextTool } from './network/serverClient';
import { AgentContext, ToolCall, ToolResult } from '../shared/schemas';
import { computeRedactionBoxes, maskScreenshot } from './vision/visualMasking';
import { detectObjects, initVisionModel } from './vision/visionModel';

export interface AgentCallbacks {
    onStatusUpdate: (status: string, details?: any) => void;
    onResult: (result: string) => void;
    onError: (error: string) => void;
    onRequireConfirmation: (plan: any, onConfirm: () => void, onCancel: () => void) => void;
    onVisualUpdate?: (originalBase64: string, sanitizedBase64: string, redactions: any[]) => void;
}

export async function runTask(prompt: string, callbacks: AgentCallbacks) {
    try {
        callbacks.onStatusUpdate('STEP 1: Natural Language Processing...');
        const step1Result = parsePrompt(prompt);
        
        callbacks.onStatusUpdate('STEP 2: Task Understanding...', step1Result);
        const step2Result = await processTaskUnderstanding(step1Result);
        
        callbacks.onStatusUpdate('STEP 3: Privacy Sanitization...', step2Result);
        const { safeContext, result: sanitizationResult } = await runPrivacyPipeline(step2Result, prompt);
        
        // Pre-load vision model in background to save time
        initVisionModel();

        console.log('[TabDebug] Fetching tabs from currentWindow...');
        let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        console.log('[TabDebug] tabs found =', tabs.length);
        
        // Fallback if currentWindow returns empty (e.g. background service worker context)
        if (tabs.length === 0) {
            console.log('[TabDebug] currentWindow returned 0, trying lastFocusedWindow...');
            tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
            console.log('[TabDebug] fallback tabs found =', tabs.length);
        }

        let tab = null;
        for (const t of tabs) {
            console.log(`[TabDebug] id=${t.id} windowId=${t.windowId} active=${t.active} highlighted=${t.highlighted} discarded=${t.discarded} url=${t.url ? new URL(t.url).origin : 'unknown'}`);
            
            if (t.url && (t.url.startsWith('http://') || t.url.startsWith('https://') || t.url.startsWith('file://'))) {
                // Reject internal browser pages explicitly
                if (!t.url.startsWith('chrome://') && !t.url.startsWith('devtools://') && !t.url.startsWith('chrome-extension://')) {
                    tab = t;
                    break;
                }
            }
        }

        if (!tab || !tab.id) {
            throw new Error('NO_WEBPAGE_TAB: Could not find an active localhost/http/https webpage tab. Please click on a valid page.');
        }
        
        console.log('[Browser] Found active webpage tab. URL:', tab.url);

        const ensureContentScript = async (tabId: number): Promise<void> => {
            try {
                await new Promise<void>((resolve, reject) => {
                    chrome.tabs.sendMessage(tabId, { type: 'PING' }, () => {
                        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                        else resolve();
                    });
                });
            } catch (e: any) {
                console.log('[Browser] PING failed, injecting content script...');
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId },
                        files: ['content.js']
                    });
                    await new Promise(r => setTimeout(r, 500));
                } catch (injectError: any) {
                    throw new Error('CONTENT_SCRIPT_UNAVAILABLE: Cannot inject script into ' + tab!.url + '. ' + injectError.message);
                }
            }
        };

        const captureAndSanitizeVisuals = async (domResult: any): Promise<{ sanitizedBase64: string | null, visualDetections: any[] }> => {
            callbacks.onStatusUpdate('Capturing screenshot...');
            let dataUrl = '';
            try {
                // Rate limiting protection: do not capture constantly
                const now = performance.now();
                if ((window as any).__lastCapture && now - (window as any).__lastCapture < 1000) {
                    await new Promise(r => setTimeout(r, 1000 - (now - (window as any).__lastCapture)));
                }
                (window as any).__lastCapture = performance.now();

                dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId!, { format: 'jpeg', quality: 50 });
                if (!dataUrl || dataUrl.length < 50) {
                    throw new Error('Captured screenshot dataUrl is empty or invalid');
                }

                // Size guard: if base64 > ~1.5MB, scale down on a canvas at lower quality
                if (dataUrl.length > 2_000_000) {
                    console.warn('[Vision] Screenshot too large (' + dataUrl.length + ' chars), re-encoding at lower quality...');
                    try {
                        dataUrl = await new Promise<string>((resolve, reject) => {
                            const img = new Image();
                            img.onload = () => {
                                const canvas = document.createElement('canvas');
                                // Scale to max 800px wide
                                const scale = Math.min(1, 800 / img.width);
                                canvas.width = Math.round(img.width * scale);
                                canvas.height = Math.round(img.height * scale);
                                const ctx = canvas.getContext('2d');
                                if (!ctx) return reject(new Error('No canvas context for downscale'));
                                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                                resolve(canvas.toDataURL('image/jpeg', 0.35));
                            };
                            img.onerror = () => reject(new Error('Image load failed during downscale'));
                            img.src = dataUrl;
                        });
                        console.log('[Vision] Re-encoded screenshot size=' + dataUrl.length);
                    } catch (scaleErr: any) {
                        console.error('[Vision] Downscale failed:', scaleErr.message);
                        // Continue with original — server will strip it anyway
                    }
                }

                // Get dimensions to log
                const imgInfo = await new Promise<{width: number, height: number}>((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve({ width: img.width, height: img.height });
                    img.onerror = () => reject(new Error('Failed to load image for dimensions'));
                    img.src = dataUrl;
                });

                console.log('[Vision] Screenshot captured=true');
                console.log('[Vision] Screenshot bytes=' + dataUrl.length);
                console.log('[Vision] Width=' + imgInfo.width);
                console.log('[Vision] Height=' + imgInfo.height);
            } catch (e: any) {
                console.error('[Vision] Failed to capture screenshot:', e.message);
                // Non-fatal: return null so pipeline can continue with DOM-only context
                return { sanitizedBase64: null, visualDetections: [] };
            }

            let visualDetections: any[] = [];
            try {
                callbacks.onStatusUpdate('Running Local Vision (yolos-tiny)...');
                const tStart = performance.now();
                visualDetections = await detectObjects(dataUrl);
                const tInfer = performance.now() - tStart;
                callbacks.onStatusUpdate('VisionStats', { inferMs: tInfer, detCount: visualDetections.length });
            } catch (visionErr: any) {
                console.error('[Vision] YOLOS detection failed:', visionErr.message);
                callbacks.onStatusUpdate('VisionStats', { inferMs: 0, detCount: 0 });
            }

            let sanitizedBase64: string | null = null;
            try {
                callbacks.onStatusUpdate('Computing Privacy Redactions...');
                const redactionBoxes = await computeRedactionBoxes(domResult.sensitiveNodes || []);
                if (redactionBoxes.length === 0) {
                    callbacks.onStatusUpdate('PrivacyScan: No PII');
                } else {
                    callbacks.onStatusUpdate('PrivacyScan: Redacted', redactionBoxes);
                }

                // The screenshot might be retina (e.g. 2x width/height)
                let scale = 1;
                const img = new Image();
                img.src = dataUrl;
                await new Promise(r => { img.onload = r; });
                if (domResult.viewport && domResult.viewport.width > 0) {
                    scale = img.width / domResult.viewport.width;
                }

                callbacks.onStatusUpdate('Applying Local Visual Masking...');
                sanitizedBase64 = await maskScreenshot(dataUrl, redactionBoxes, scale);

                if (callbacks.onVisualUpdate) {
                    callbacks.onVisualUpdate(dataUrl, sanitizedBase64, redactionBoxes, visualDetections);
                }
            } catch (maskErr: any) {
                console.error('[Vision] Masking failed:', maskErr.message);
                callbacks.onStatusUpdate('PrivacyScan: No PII');
            }

            return { sanitizedBase64, visualDetections };
        };

        const executeToolInContentScript = async (toolCall: ToolCall): Promise<ToolResult> => {
            if (toolCall.name === 'browser.observe') {
                return new Promise<ToolResult>((resolve, reject) => {
                    chrome.tabs.sendMessage(tab.id!, { type: 'REQUEST_DOM_SNAPSHOT' }, async (response: any) => {
                        if (chrome.runtime.lastError) resolve({ success: false, error: chrome.runtime.lastError.message });
                        else if (response && response.type === 'DOM_SNAPSHOT_RESULT') {
                            const domData = response.payload;
                            try {
                                const { sanitizedBase64, visualDetections } = await captureAndSanitizeVisuals(domData);
                                resolve({ 
                                    success: true, 
                                    data: { 
                                        elements: domData.elements,
                                        screenshotBase64: sanitizedBase64,
                                        visualDetections
                                    } 
                                });
                            } catch (e: any) {
                                resolve({ success: false, error: e.message });
                            }
                        } else resolve({ success: false, error: 'Invalid response from content script' });
                    });
                });
            }
            
            const vault = getSessionVault();
            const resolvedTool = { ...toolCall, arguments: { ...toolCall.arguments } };
            if (resolvedTool.name === 'browser.type' && typeof resolvedTool.arguments.value === 'string') {
                resolvedTool.arguments.value = resolvedTool.arguments.value.replace(/<([A-Z_]+_\d+)>/g, (tok: string) => vault.getRawValue(tok) ?? tok);
            }

            return new Promise<ToolResult>((resolve) => {
                chrome.tabs.sendMessage(tab.id!, { type: 'EXECUTE_TOOL', payload: resolvedTool }, (response: ToolResult) => {
                    if (chrome.runtime.lastError) resolve({ success: false, error: chrome.runtime.lastError.message });
                    else resolve(response || { success: false, error: 'No response' });
                });
            });
        };

        callbacks.onStatusUpdate('AGENT SESSION STARTED');
        try { await ensureContentScript(tab.id!); console.log('[Browser] Content script available: true'); } catch(e) { console.log('[Browser] Content script available: false'); throw e; }

        const context: AgentContext = {
            safeContext,
            history: []
        };

        callbacks.onStatusUpdate('Initial Observation...');
        const initialObserve = await executeToolInContentScript({ name: 'browser.observe', arguments: {} } as any);
        if (initialObserve.success && initialObserve.data) {
            console.log('[Browser] Initial observation: success');
            context.safeContext.pageData = { 
                elements: initialObserve.data.elements,
                screenshotBase64: initialObserve.data.screenshotBase64,
                visualDetections: initialObserve.data.visualDetections
            };
        } else {
            console.log('[Browser] Initial observation: failure');
            throw new Error('Failed to capture initial page observation. Result: ' + JSON.stringify(initialObserve));
        }

        const MAX_STEPS = 20;
        let stepCount = 0;
        let finished = false;

        while (!finished && stepCount < MAX_STEPS) {
            stepCount++;
            callbacks.onStatusUpdate(`Thinking (Step ${stepCount})...`, context);

            // ── Local payload size guard ──────────────────────────────────────
            // Reduce context before sending to avoid GROQ_CONTEXT_TOO_LARGE
            const INTERACTIVE_TYPES_LOCAL = new Set(['button', 'input', 'link', 'submit', 'text', 'email', 'search', 'textarea', 'select', 'checkbox', 'radio', 'a']);
            const payloadSize = JSON.stringify(context).length;
            console.log(`[Agent] Context payload size (chars): ${payloadSize}`);
            if (payloadSize > 150_000 && context.safeContext.pageData?.elements) {
                console.warn(`[Agent] Payload too large (${payloadSize}), trimming elements locally...`);
                const allEls = context.safeContext.pageData.elements;
                const interactive = allEls
                    .filter((e: any) => INTERACTIVE_TYPES_LOCAL.has((e.type || '').toLowerCase()))
                    .slice(0, 30);
                const nonInteractive = allEls
                    .filter((e: any) => !INTERACTIVE_TYPES_LOCAL.has((e.type || '').toLowerCase()))
                    .slice(0, 10);
                context.safeContext.pageData.elements = [...interactive, ...nonInteractive].map((e: any) => ({
                    ...e,
                    text: typeof e.text === 'string' && e.text.length > 100 ? e.text.slice(0, 100) + '…' : e.text,
                    title: typeof e.title === 'string' && e.title.length > 100 ? e.title.slice(0, 100) + '…' : e.title,
                }));
                if (context.safeContext.pageData.visualDetections) {
                    context.safeContext.pageData.visualDetections = context.safeContext.pageData.visualDetections.slice(0, 5);
                }
                // Trim history to last 5
                if (context.history.length > 5) context.history = context.history.slice(-5);
                console.log(`[Agent] Post-trim payload size: ${JSON.stringify(context).length}`);
            }
            // ─────────────────────────────────────────────────────────────────

            const toolCall = await requestNextTool(context);
            context.history.push({ role: 'model', content: toolCall });

            if (toolCall.name === 'browser.finish') {
                callbacks.onResult('Task successfully completed.');
                finished = true;
                break;
            }

            callbacks.onStatusUpdate(`Executing: ${toolCall.name}`, toolCall.arguments);
            const toolResult = await executeToolInContentScript(toolCall);
            
            if (toolCall.name === 'browser.observe' && toolResult.success && toolResult.data) {
                context.safeContext.pageData = { 
                    elements: toolResult.data.elements,
                    screenshotBase64: toolResult.data.screenshotBase64,
                    visualDetections: toolResult.data.visualDetections
                };
                const summary = {
                    success: true,
                    pageChanged: true,
                    elementsFound: toolResult.data.elements.length,
                    interactiveElements: toolResult.data.elements.filter((e: any) => e.type === 'button' || e.type === 'input' || e.type === 'link').length,
                    visualDetections: (toolResult.data.visualDetections || []).length,
                    screenshotCaptured: !!toolResult.data.screenshotBase64,
                    topElements: toolResult.data.elements.slice(0, 5).map((e: any) => ({ ref: e.elementRef, type: e.type, text: (e.text || '').substring(0, 50) }))
                };
                context.history.push({ role: 'browser', content: summary });
            } else {
                context.history.push({ role: 'browser', content: toolResult });
            }

            if (!toolResult.success) {
                console.warn(`[Agent] Tool ${toolCall.name} failed:`, toolResult.error);
            }
        }

        if (!finished) {
            callbacks.onError('Agent loop terminated: Max steps reached.');
        }

    } catch (e: any) {
        callbacks.onError(e.message);
    } finally {
        if (typeof globalAgentTimeout !== 'undefined') clearTimeout(globalAgentTimeout);
    }
}
