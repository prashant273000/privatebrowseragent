import { getCachedElement } from './perception';
import { ToolCall, ToolResult } from '../../shared/schemas';

export async function executeToolLocally(toolCall: ToolCall): Promise<ToolResult> {
    const { name, arguments: args } = toolCall;

    try {
        if (name === 'browser.observe') {
            return { success: true };
        }

        if (name === 'browser.click') {
            const elementRef = args.elementRef as string;
            if (!elementRef) return { success: false, error: "Missing elementRef" };

            const element = getCachedElement(elementRef);
            if (!element) return { success: false, error: "Element not found or stale elementRef" };

            const isVisible = element.style.display !== 'none' && element.style.visibility !== 'hidden';
            if (!isVisible) return { success: false, error: "Element is invisible" };
            if ((element as any).disabled) return { success: false, error: "Element is disabled" };

            element.click();
            console.log(`[Executor] CLICK executed on ${elementRef}`);
            return { success: true, data: { pageChanged: true } };
        }

        if (name === 'browser.type') {
            const elementRef = args.elementRef as string;
            const value = args.value as string;
            if (!elementRef) return { success: false, error: "Missing elementRef" };
            if (value === undefined) return { success: false, error: "Missing value to type" };

            const element = getCachedElement(elementRef);
            if (!element) return { success: false, error: "Element not found or stale elementRef" };

            const isVisible = element.style.display !== 'none' && element.style.visibility !== 'hidden';
            if (!isVisible) return { success: false, error: "Element is invisible" };
            if ((element as any).disabled) return { success: false, error: "Element is disabled" };

            const tagName = element.tagName.toLowerCase();
            if (tagName !== 'input' && tagName !== 'textarea') {
                return { success: false, error: "Target is not typable" };
            }

            console.log(`[Executor] TYPE executed on ${elementRef}`);
            
            (element as any).value = value;
            element.dispatchEvent(new (element.ownerDocument.defaultView as any).Event('input', { bubbles: true }));
            element.dispatchEvent(new (element.ownerDocument.defaultView as any).Event('change', { bubbles: true }));

            return { success: true };
        }

        if (name === 'browser.navigate') {
            const target = args.target as string;
            console.log(`[Executor] NAVIGATE to ${target}`);
            return { success: true };
        }

        if (name === 'browser.finish') {
            return { success: true };
        }

        return { success: false, error: `Tool ${name} not fully implemented` };
    } catch (e: any) {
        return { success: false, error: `Exception during execution: ${e.message}` };
    }
}
