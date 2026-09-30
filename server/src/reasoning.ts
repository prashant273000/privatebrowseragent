import { AgentContext, ToolCall } from '../../src/shared/schemas';
import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ─── Structured error codes ────────────────────────────────────────────────────
export type GroqErrorCode =
    | 'GROQ_BAD_REQUEST'
    | 'GROQ_AUTH_ERROR'
    | 'GROQ_CONTEXT_TOO_LARGE'
    | 'GROQ_RATE_LIMITED'
    | 'GROQ_MODEL_UNAVAILABLE'
    | 'GROQ_TIMEOUT'
    | 'GROQ_RESPONSE_PARSE_ERROR'
    | 'GROQ_TOOL_SCHEMA_ERROR'
    | 'GROQ_UNKNOWN_ERROR';

export class GroqError extends Error {
    public readonly code: GroqErrorCode;
    public readonly httpStatus: number;
    constructor(code: GroqErrorCode, message: string, httpStatus: number = 500) {
        super(message);
        this.name = 'GroqError';
        this.code = code;
        this.httpStatus = httpStatus;
    }
}

function classifyGroqError(err: any): GroqError {
    const status = err.status ?? err.statusCode ?? 0;
    const msg: string = (err.message || '').toLowerCase();

    if (err.name === 'AbortError' || msg.includes('abort') || msg.includes('timeout')) {
        return new GroqError('GROQ_TIMEOUT', 'Request timed out', 504);
    }
    if (status === 400 || msg.includes('invalid image') || msg.includes('bad request')) {
        return new GroqError('GROQ_BAD_REQUEST', err.message || 'Bad request to Groq', 400);
    }
    if (status === 401 || status === 403) {
        return new GroqError('GROQ_AUTH_ERROR', 'Groq authentication failed', 401);
    }
    if (status === 413 || msg.includes('request too large') || msg.includes('rate_limit_exceeded') || msg.includes('context') || msg.includes('token')) {
        return new GroqError('GROQ_CONTEXT_TOO_LARGE', 'Groq context too large / ITPM exceeded', 413);
    }
    if (status === 429) {
        return new GroqError('GROQ_RATE_LIMITED', 'Groq rate limited', 429);
    }
    if (status === 500 || status === 502 || status === 503) {
        return new GroqError('GROQ_MODEL_UNAVAILABLE', 'Groq model unavailable', 502);
    }
    if (msg.includes('json') || msg.includes('parse') || msg.includes('syntax')) {
        return new GroqError('GROQ_RESPONSE_PARSE_ERROR', 'Failed to parse Groq response as JSON', 500);
    }
    if (msg.includes('schema') || msg.includes('zod') || msg.includes('malformed toolcall')) {
        return new GroqError('GROQ_TOOL_SCHEMA_ERROR', 'Groq returned invalid tool call schema', 500);
    }
    return new GroqError('GROQ_UNKNOWN_ERROR', err.message || 'Unknown Groq error', 500);
}

// ─── Context size reduction ────────────────────────────────────────────────────
const MAX_ELEMENTS = 30;
const MAX_INTERACTIVE = 30;
const MAX_NON_INTERACTIVE = 10;
const MAX_VISUAL_DETECTIONS = 10;
const MAX_HISTORY = 10;
const MAX_TEXT_LEN = 200;
const INTERACTIVE_TYPES = new Set(['button', 'input', 'link', 'submit', 'text', 'email', 'password', 'search', 'textarea', 'select', 'checkbox', 'radio', 'a']);

function truncateText(s: string | undefined, max = MAX_TEXT_LEN): string | undefined {
    if (!s) return s;
    return s.length > max ? s.slice(0, max) + '…' : s;
}

function reduceContext(context: AgentContext): { reduced: AgentContext; visualDetectionsText: string; hasScreenshot: boolean } {
    // Clone shallowly
    const reduced: AgentContext = {
        safeContext: { ...context.safeContext },
        history: [...(context.history || [])]
    };

    let hasScreenshot = false;
    let visualDetectionsText = '';

    // ── Strip screenshot ───────────────────────────────────────────────────────
    if (reduced.safeContext.pageData) {
        reduced.safeContext.pageData = { ...reduced.safeContext.pageData };
        if (reduced.safeContext.pageData.screenshotBase64) {
            hasScreenshot = true;
            delete reduced.safeContext.pageData.screenshotBase64;
        }

        // ── Reduce elements ────────────────────────────────────────────────────
        if (reduced.safeContext.pageData.elements) {
            const allEls: any[] = reduced.safeContext.pageData.elements;
            const interactive = allEls
                .filter(e => INTERACTIVE_TYPES.has((e.type || '').toLowerCase()))
                .slice(0, MAX_INTERACTIVE);
            const nonInteractive = allEls
                .filter(e => !INTERACTIVE_TYPES.has((e.type || '').toLowerCase()))
                .slice(0, MAX_NON_INTERACTIVE);

            const trimmed = [...interactive, ...nonInteractive].slice(0, MAX_ELEMENTS).map(e => ({
                ...e,
                text: truncateText(e.text),
                placeholder: truncateText(e.placeholder),
                ariaLabel: truncateText(e.ariaLabel),
                title: truncateText(e.title),
            }));
            reduced.safeContext.pageData.elements = trimmed;
        }

        // ── Reduce visual detections ───────────────────────────────────────────
        if (reduced.safeContext.pageData.visualDetections) {
            reduced.safeContext.pageData.visualDetections =
                reduced.safeContext.pageData.visualDetections.slice(0, MAX_VISUAL_DETECTIONS);
        }

        // ── Build visual detections text summary ───────────────────────────────
        const vd: any[] = reduced.safeContext.pageData.visualDetections || [];
        if (vd.length > 0) {
            visualDetectionsText = '\n\nVisual Detections (from local YOLOS-tiny model, NOT sent as image):\n' +
                vd.map((d, i) => `  ${i + 1}. ${d.label || d.class || 'object'} — confidence ${((d.score || d.confidence || 0) * 100).toFixed(1)}%`).join('\n');
        } else {
            visualDetectionsText = '\n\n[No visual object detections from local YOLOS-tiny model]';
        }
    }

    // ── Trim history ───────────────────────────────────────────────────────────
    if (reduced.history.length > MAX_HISTORY) {
        reduced.history = reduced.history.slice(-MAX_HISTORY);
    }

    return { reduced, visualDetectionsText, hasScreenshot };
}

// ─── Build a rich text prompt ──────────────────────────────────────────────────
function buildPromptText(context: AgentContext, visualDetectionsText: string, hasScreenshot: boolean): string {
    const pageData = context.safeContext.pageData;
    const task = context.safeContext.task || {};
    const elements = pageData?.elements || [];

    // Build element summary
    const elementSummary = elements.map((e: any) => {
        const parts = [`[${e.elementRef}] type=${e.type}`];
        if (e.text) parts.push(`text="${e.text.substring(0, 80)}"`);
        if (e.placeholder) parts.push(`placeholder="${e.placeholder}"`);
        if (e.ariaLabel) parts.push(`aria-label="${e.ariaLabel}"`);
        if (e.name) parts.push(`name="${e.name}"`);
        if (e.id) parts.push(`id="${e.id}"`);
        if (e.isDisabled) parts.push('disabled=true');
        return parts.join(' ');
    }).join('\n');

    const historyText = (context.history || []).length > 0
        ? '\n\nAction History (last ' + context.history.length + ' steps):\n' + JSON.stringify(context.history, null, 2)
        : '\n\n[No action history — this is the first step]';

    const screenshotNote = hasScreenshot
        ? '[Screenshot captured locally — visual detections listed above — NOT sent to Groq due to API constraints]'
        : '[No screenshot captured]';

    return `=== BROWSER AGENT CONTEXT ===

Task Intent: ${task.intent || 'Unknown'}
Task Type: ${task.taskType || 'Unknown'}
Task Category: ${task.category || 'Unknown'}
Task Slots: ${JSON.stringify(task.slots || {})}
Task Constraints: ${JSON.stringify(task.constraints || {})}
Original Task Text: ${task.originalText || 'Not provided'}

Privacy:
  PII Detected: ${context.safeContext.privacy?.piiDetected}
  Sanitized: ${context.safeContext.privacy?.sanitized}
  Redactions: ${JSON.stringify(context.safeContext.privacy?.redactions || [])}

Page Elements (${elements.length} total — interactive elements prioritized):
${elementSummary || '[No elements]'}
${visualDetectionsText}

Screenshot Status: ${screenshotNote}
${historyText}

=== END CONTEXT ===

Based on the above context, select the NEXT browser action to perform. Return EXACTLY ONE tool call as a JSON object:
{ "type": "tool_call", "id": "call_1", "name": "browser.<tool>", "arguments": { ... } }`;
}

export interface ReasoningModel {
    decideNextTool(context: AgentContext): Promise<ToolCall>;
}

export class MockReasoningModel implements ReasoningModel {
    async decideNextTool(context: AgentContext): Promise<ToolCall> {
        return { name: 'browser.finish', arguments: {} };
    }
}

const GROQ_SYSTEM_PROMPT = `You are the reasoning engine of a privacy-preserving browser agent.
You do not directly control the browser.
You must use the provided browser tools.
The browser is represented by the latest observation.
elementRef values are temporary references to local browser elements.
Only use elementRefs that appear in the latest observation.
Never invent elementRefs.
Never request raw passwords, credit cards, or token-vault values.
Opaque tokens such as <PERSON_1> must remain opaque.

For every action:
1. inspect the latest observation,
2. choose the next tool,
3. execute only one tool at a time unless parallel calls are explicitly safe,
4. inspect the tool result,
5. continue until success, failure, or clarification is required.

If the current page can satisfy the task, do not navigate away unnecessarily.
If the target is ambiguous, call browser.observe again or request clarification rather than guessing.

Tools: browser.observe, browser.click, browser.type, browser.select, browser.scroll, browser.wait, browser.navigate, browser.finish.

You must return EXACTLY ONE tool call as a JSON object, e.g.:
{ "type": "tool_call", "id": "call_1", "name": "browser.click", "arguments": { "elementRef": "el_1" } }`;

export class GroqReasoningModel implements ReasoningModel {
    private groq: Groq;
    private model: string;

    constructor() {
        const apiKey = process.env.GROQ_API_KEY;
        console.log('[Reasoning] Provider: GROQ');
        this.model = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
        console.log('[Reasoning] Model: ' + this.model);

        if (!apiKey) {
            console.log('[Reasoning] API key present: false');
            console.error('[Groq] GROQ_API_KEY is missing. Please add your real key to server/.env');
        } else {
            console.log('[Reasoning] API key present: true');
        }

        this.groq = new Groq({ apiKey: apiKey || 'missing' });
    }

    async decideNextTool(context: AgentContext): Promise<ToolCall> {
        console.log(`[Groq] Request started`);

        // Reduce context to fit within token limits
        const { reduced, visualDetectionsText, hasScreenshot } = reduceContext(context);
        const promptText = buildPromptText(reduced, visualDetectionsText, hasScreenshot);

        console.log(`[Groq] Prompt size (chars): ${promptText.length}`);
        console.log(`[Groq] Elements in context: ${reduced.safeContext.pageData?.elements?.length ?? 0}`);
        console.log(`[Groq] History entries: ${reduced.history.length}`);
        console.log(`[Groq] Visual detections: ${reduced.safeContext.pageData?.visualDetections?.length ?? 0}`);
        console.log(`[Groq] Screenshot stripped: ${hasScreenshot}`);

        const contentArray: any[] = [{ type: 'text', text: promptText }];
        // NOTE: No image_url attachment — qwen/qwen3.8-27b does NOT support data: URIs
        // Visual context is provided as text descriptions of YOLOS-tiny detections above.

        let retries = 0;
        while (retries < 3) {
            try {
                const response = await this.groq.chat.completions.create({
                    messages: [
                        { role: 'system', content: GROQ_SYSTEM_PROMPT },
                        { role: 'user', content: contentArray as any }
                    ],
                    model: this.model,
                    temperature: 0.1,
                    response_format: { type: 'json_object' }
                });

                console.log(`[Groq] Response received`);
                const text = response.choices[0]?.message?.content || '{}';

                let parsed: any;
                try {
                    parsed = JSON.parse(text);
                } catch (jsonErr: any) {
                    throw classifyGroqError({ message: 'JSON parse error: ' + jsonErr.message });
                }

                const internalToolCall: ToolCall = {
                    name: (parsed.name || parsed.tool) as any,
                    arguments: parsed.arguments || {}
                };

                console.log('[Groq] Tool call=' + internalToolCall.name);
                return internalToolCall;

            } catch (err: any) {
                // If already a GroqError, re-throw immediately
                if (err instanceof GroqError) throw err;

                const classified = classifyGroqError(err);
                console.error(`[Groq] Error code=${classified.code} status=${classified.httpStatus} msg=${classified.message}`);

                if (classified.code === 'GROQ_RATE_LIMITED' && retries < 2) {
                    retries++;
                    console.warn(`[Groq] Rate limited — retry ${retries}/2 after ${2000 * retries}ms`);
                    await new Promise(r => setTimeout(r, 2000 * retries));
                } else {
                    throw classified;
                }
            }
        }

        throw new GroqError('GROQ_RATE_LIMITED', 'Groq rate limited after retries', 429);
    }
}
