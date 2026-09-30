import * as fs from 'fs';
let code = fs.readFileSync('src/local-agent/agentController.ts', 'utf8');

const target1 = `                        else if (response && response.type === 'DOM_SNAPSHOT_RESULT') {
                            const domData = response.payload;
                            
                            // 🚀 Run Visual Pipeline on Top of DOM Snapshot
                            const { sanitizedBase64, visualDetections } = await captureAndSanitizeVisuals(domData);
                            
                            resolve({ 
                                success: true, 
                                data: { 
                                    elements: domData.elements,
                                    screenshotBase64: sanitizedBase64,
                                    visualDetections
                                } 
                            });
                        }`;

const replacement1 = `                        else if (response && response.type === 'DOM_SNAPSHOT_RESULT') {
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
                        }`;
code = code.replace(target1, replacement1);

// Add global timeout
const target2 = `        callbacks.onStatusUpdate('AGENT SESSION STARTED');
        try { await ensureContentScript(tab.id!); console.log('[Browser] Content script available: true'); } catch(e: any) { console.log('[Browser] Content script available: false'); throw e; }

        const context: AgentContext = {
            safeContext,
            history: []
        };`;

const replacement2 = `        callbacks.onStatusUpdate('AGENT SESSION STARTED');
        try { await ensureContentScript(tab.id!); console.log('[Browser] Content script available: true'); } catch(e: any) { console.log('[Browser] Content script available: false'); throw e; }

        const context: AgentContext = {
            safeContext,
            history: []
        };

        const MAX_AGENT_RUNTIME_MS = 120000;
        const globalAgentTimeout = setTimeout(() => {
            callbacks.onError('AGENT_TIMEOUT: Maximum agent execution time exceeded.');
        }, MAX_AGENT_RUNTIME_MS);`;

code = code.replace(target2, replacement2);

// Add clear timeout at the end
const target3 = `    } catch (e: any) {
        callbacks.onError(e.message);
    }
}`;

const replacement3 = `    } catch (e: any) {
        callbacks.onError(e.message);
    } finally {
        if (typeof globalAgentTimeout !== 'undefined') clearTimeout(globalAgentTimeout);
    }
}`;

code = code.replace(target3, replacement3);
fs.writeFileSync('src/local-agent/agentController.ts', code);
