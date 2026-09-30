import { z } from 'zod';

// All tools the system prompt mentions — must be complete or Zod parse will reject
export const ToolCallSchema = z.object({
    name: z.enum([
        'browser.observe',
        'browser.navigate',
        'browser.click',
        'browser.type',
        'browser.select',
        'browser.scroll',
        'browser.wait',
        'browser.finish'
    ]),
    arguments: z.record(z.any())
});
export type ToolCall = z.infer<typeof ToolCallSchema>;

export interface ToolResult {
    success: boolean;
    data?: any;
    error?: string;
    pageChanged?: boolean;
}

export interface AgentContext {
    safeContext: SafeContext;
    history: Array<{ role: 'model' | 'browser', content: ToolCall | ToolResult }>;
}

export interface TaskContext {
    originalText: string;
    intent: string;
    taskType: string;
    category: string;
    slots: Record<string, string>;
    constraints: Record<string, string>;
    systemConfidence: number;
    requiresClarification: boolean;
}

export interface PrivacyContext {
    piiDetected: boolean;
    redactions: Array<{ type: string; placeholder: string; originalToken: string }>;
    sanitized: boolean;
    appliedRules: string[];
}

export interface SafeContext {
    task: Partial<TaskContext>;
    privacy: PrivacyContext;
    pageData?: {
        elements: any[];
        visualDetections?: any[];
        screenshotBase64?: string;
    };
}

export interface ActionPlan {
    id: string;
    goal: string;
    steps: ActionStep[];
}

export interface ActionStep {
    tool: string;
    target: string;
    action: string;
    value?: string;
    description: string;
}

// ─── Message types ─────────────────────────────────────────────────────────────
// Adding PING so the content script PING handshake is properly typed
export type MessageType =
    | 'PING'
    | 'PONG'
    | 'REQUEST_DOM_SNAPSHOT'
    | 'DOM_SNAPSHOT_RESULT'
    | 'EXECUTE_TOOL'
    | 'TOOL_RESULT';
