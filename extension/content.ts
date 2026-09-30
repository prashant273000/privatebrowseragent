import { AnyMessage, ExecuteToolMsg, DomSnapshotResultMsg } from '../src/shared/messages';
import { observePage, SemanticItem, SensitiveDOMNode } from '../src/local-agent/execution/perception';
import { executeToolLocally } from '../src/local-agent/execution/actionExecutor';

console.log('[Private Browser Agent] Content script loaded (Tool Calling & Visuals).');

chrome.runtime.onMessage.addListener((message: AnyMessage, sender, sendResponse) => {
    if ((message as any).type === 'PING') {
        sendResponse({ alive: true });
        return false;
    }

    if (message.type === 'REQUEST_DOM_SNAPSHOT') {
        const { items: candidates, sensitiveNodes, viewport } = observePage(document);
        
        const elements = candidates.map((c: SemanticItem) => {
            if (c.type === 'group') {
                return {
                    elementRef: c.elementRef,
                    type: c.type,
                    title: c.title,
                    price: c.price,
                    rating: c.rating,
                    specifications: c.specifications,
                    actions: c.actions,
                    text: c.text,
                    boundingBox: c.boundingBox
                };
            }
            return {
                elementRef: c.elementRef,
                type: c.type,
                text: c.text,
                ariaLabel: c.ariaLabel,
                placeholder: c.placeholder,
                role: c.role,
                boundingBox: c.boundingBox
            };
        });
            
        const response: DomSnapshotResultMsg = { type: 'DOM_SNAPSHOT_RESULT', payload: { elements, sensitiveNodes, viewport } };
        sendResponse(response);
        return false;
    }

    if (message.type === 'EXECUTE_TOOL') {
        const msg = message as ExecuteToolMsg;
        console.log('[Content Script] Received ToolCall:', msg.payload);
        
        executeToolLocally(msg.payload)
            .then(result => {
                console.log('[Content Script] Tool execution finished:', result);
                sendResponse(result);
            })
            .catch(err => {
                console.error('[Content Script] Tool execution failed:', err);
                sendResponse({ success: false, error: err.message });
            });
            
        return true; 
    }
});
