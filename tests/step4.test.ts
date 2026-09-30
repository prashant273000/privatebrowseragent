import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { app } from '../server/src/index';
import { requestActionPlan } from '../src/local-agent/network/serverClient';
import { SafeContext, ActionPlan } from '../src/shared/schemas';
import { clearSessionVault } from '../src/local-agent/privacy/privacyPipeline';
import { runPrivacyPipeline } from '../src/local-agent/privacy/privacyPipeline';
import * as http from 'http';

let server: http.Server;

beforeAll(async () => {
    return new Promise((resolve) => {
        server = app.listen(3000, () => {
            resolve(undefined);
        });
    });
});

afterAll(async () => {
    return new Promise((resolve) => {
        server.close(() => resolve(undefined));
    });
});

describe('Step 4: Network and Server Reasoning', () => {
    
    beforeAll(() => {
        clearSessionVault();
    });

    const mockSafeContext: SafeContext = {
        task: {
            intent: "SEND",
            taskType: "SEND_EMAIL",
            slots: {
                recipient: "<PERSON_1>",
                body: "I will be late."
            }
        },
        privacy: {
            sanitized: true,
            piiDetected: true,
            blockedItems: 0,
            tokenizedItems: 1
        }
    };

    it('Test 1: SafeContext successfully reaches the mock server', async () => {
        const plan = await requestActionPlan(mockSafeContext);
        expect(plan).toBeDefined();
        expect(plan.planId).toBeDefined();
        expect(plan.steps.length).toBeGreaterThan(0);
    });

    it('Test 2: <PERSON_1> remains tokenized in server', async () => {
        const plan = await requestActionPlan(mockSafeContext);
        // The mock reasoning model echoes the recipient token in TYPE action
        const typeStep = plan.steps.find(s => s.action === 'TYPE' && s.targetDescription === 'recipient');
        expect(typeStep).toBeDefined();
        expect(typeStep?.value).toBe('<PERSON_1>');
    });

    it('Test 3: Raw "Rahul" cannot be sent through network client', async () => {
        // We simulate a complete pipeline run to populate the local vault
        const rawText = "Send Rahul an email";
        const step2Result = { intent: "SEND", taskType: "SEND_EMAIL", slots: { recipient: "Rahul" } };
        
        // This will securely populate vault with "Rahul" -> <PERSON_1>
        const { safeContext } = await runPrivacyPipeline(step2Result, rawText);
        
        // Now suppose a malicious bug injected "Rahul" back into the payload
        const maliciousContext = JSON.parse(JSON.stringify(safeContext));
        maliciousContext.task.slots.recipient = "Rahul";
        
        // It must throw
        await expect(requestActionPlan(maliciousContext)).rejects.toThrow(/Privacy Violation/);
    });

    it('Test 4: Malformed SafeContext is rejected locally and by server', async () => {
        const badContext = {
            task: { intent: "SEND" }
            // missing privacy object entirely
        } as any;
        
        // Fails locally during schema validation
        await expect(requestActionPlan(badContext)).rejects.toThrow(/Invalid SafeContext schema/);
        
        // Also test server rejects it directly
        const res = await fetch('http://localhost:3000/agent/plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(badContext)
        });
        expect(res.status).toBe(400);
    });

    it('Test 5: Malformed ActionPlan is rejected (client validation)', async () => {
        // We mock global fetch to return malformed ActionPlan
        const originalFetch = global.fetch;
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                planId: "123",
                // missing steps array!
                requiresUserConfirmation: true
            })
        } as any);

        await expect(requestActionPlan(mockSafeContext)).rejects.toThrow(/Malformed ActionPlan/);

        // Restore
        global.fetch = originalFetch;
    });

    it('Test 6: Mock reasoning generates expected plan for SEND_EMAIL', async () => {
        const plan = await requestActionPlan(mockSafeContext);
        const actions = plan.steps.map(s => s.action);
        
        expect(actions).toEqual([
            'NAVIGATE',
            'CLICK',
            'TYPE',
            'TYPE',
            'REVIEW',
            'CONFIRM'
        ]);
        
        expect(plan.steps[0].target).toBe('Gmail');
        expect(plan.steps[1].targetDescription).toBe('Compose button');
    });

    it('Test 7: Server cannot access token vault', async () => {
        // There is no API for the server to access the vault, we just verify the plan doesn't contain "Rahul"
        const plan = await requestActionPlan(mockSafeContext);
        const planString = JSON.stringify(plan);
        expect(planString).not.toContain("Rahul");
        expect(planString).toContain("<PERSON_1>");
    });

    it('Test 8: Privacy gate blocks an unsafe payload before fetch', async () => {
        // Create a payload that has credit card format (rules scan should catch it before fetch)
        const unsafeContext: SafeContext = {
            task: {
                intent: "SEND",
                slots: { card: "4111 1111 1111 1111" } // Raw card number!
            },
            privacy: { sanitized: true, piiDetected: false, blockedItems: 0, tokenizedItems: 0 }
        };
        
        await expect(requestActionPlan(unsafeContext)).rejects.toThrow(/Residual PII detected/);
    });

    it('Test 9: Server response preserves opaque tokens', async () => {
        const plan = await requestActionPlan(mockSafeContext);
        const typeStep = plan.steps.find(s => s.action === 'TYPE' && s.targetDescription === 'recipient');
        expect(typeStep?.value).toBe('<PERSON_1>'); // Token is perfectly preserved
    });

    it('Test 10: Server failure returns a controlled error to the extension', async () => {
        // Mock server 500 error
        const originalFetch = global.fetch;
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            statusText: "Internal Server Error"
        } as any);

        await expect(requestActionPlan(mockSafeContext)).rejects.toThrow(/Server returned 500/);

        global.fetch = originalFetch;
    });

});
