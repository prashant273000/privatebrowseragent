import { AgentContext, ToolCall, ToolCallSchema } from '../../shared/schemas';
import { detectPiiModel } from '../privacy/piiDetector';
import { detectPiiRules } from '../privacy/privacyRules';
import { getRawVaultValues } from '../privacy/privacyPipeline';

const SERVER_URL = 'http://localhost:3000';

export async function requestNextTool(context: AgentContext): Promise<ToolCall> {
    const taskSerialized = JSON.stringify(context.safeContext.task);

    const vaultValues = getRawVaultValues();
    for (const value of vaultValues) {
        if (value.length > 2 && taskSerialized.includes(value)) {
            throw new Error(`Privacy Violation: Raw vault value leaked into outbound context.`);
        }
    }

    const modelDetections = await detectPiiModel(taskSerialized);
    if (modelDetections.length > 0) {
        throw new Error(`Privacy Violation: Residual PII detected by model in outbound context.`);
    }

    const ruleDetections = detectPiiRules(taskSerialized);
    if (ruleDetections.length > 0) {
        throw new Error(`Privacy Violation: Residual PII detected by rules in outbound context.`);
    }

    let serializedContext = JSON.stringify(context);
    for (const value of vaultValues) {
        if (value.length > 2) {
            serializedContext = serializedContext.split(value).join('<REDACTED>');
        }
    }

    try {
        console.log('[Groq] Request started');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const response = await fetch(`${SERVER_URL}/agent/tool`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: serializedContext,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        console.log('[Groq] Request completed');

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const parseResult = ToolCallSchema.safeParse(data);
        if (!parseResult.success) {
            throw new Error(`Malformed ToolCall received from server: ${parseResult.error.message}`);
        }

        return parseResult.data;
    } catch (e: any) {
        if (e.name === 'AbortError') {
            console.error('[Groq] GROQ_TIMEOUT');
            throw new Error('GROQ_TIMEOUT');
        }
        console.error(`[Client] Network error: ${e.message}`);
        throw new Error('GROQ_REQUEST_FAILED: ' + e.message);
    }
}
