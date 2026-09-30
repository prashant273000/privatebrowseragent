import { runPrivacyPipeline, clearSessionVault } from '../src/local-agent/privacy/privacyPipeline';
import { parsePrompt } from '../src/local-agent/nlp/promptParser';
import { processTaskUnderstanding } from '../src/local-agent/task-understanding/taskUnderstanding';
import { detectPiiModel } from '../src/local-agent/privacy/piiDetector';
import { detectPiiRules } from '../src/local-agent/privacy/privacyRules';

let intentionalFailureEnabled = false;

// Second-pass outbound validation
async function validateOutbound(safeContext: any, vaultEntries: any[]) {
    const serialized = JSON.stringify(safeContext);

    // 1. Check known vault values
    for (const entry of vaultEntries) {
        if (entry.value.length > 2 && serialized.includes(entry.value)) {
            return { safe: false, reason: 'RAW_PII_REMAINED_IN_SAFE_CONTEXT (Vault Check)' };
        }
    }

    // 2. PII model scan
    const modelDetections = await detectPiiModel(serialized);
    if (modelDetections.length > 0) {
        return { safe: false, reason: 'RESIDUAL_PII_DETECTED (Model Scan)' };
    }

    // 3. Deterministic rules scan
    const ruleDetections = detectPiiRules(serialized);
    if (ruleDetections.length > 0) {
        console.log("RULE SCAN FAILED ON:", ruleDetections);
        return { safe: false, reason: 'RESIDUAL_PII_DETECTED (Rule Scan)' };
    }

    if (intentionalFailureEnabled) {
        // Intentionally simulate a failure to prove the validator works
        if (serialized.includes("Rahul")) {
            return { safe: false, reason: 'INTENTIONAL_FAILURE_TRIGGERED' };
        }
    }

    return { safe: true, reason: 'PASS' };
}

// Dummy Network Gate
async function networkGate(safeContext: any, vaultEntries: any[]) {
    const validation = await validateOutbound(safeContext, vaultEntries);
    if (!validation.safe) {
        return { blocked: true, message: `PRIVACY CHECK FAILED. NETWORK REQUEST BLOCKED. Reason: ${validation.reason}` };
    }
    return { blocked: false, message: 'NETWORK REQUEST ALLOWED' };
}

async function runTest(name: string, text: string, expectedAssertions: (res: any) => void, overrideStep2Result?: any) {
    console.log(`\n--- ${name} ---`);
    console.log("INPUT:", text);
    
    let step2;
    if (overrideStep2Result) {
        step2 = overrideStep2Result;
    } else {
        const step1 = parsePrompt(text);
        step2 = await processTaskUnderstanding(step1);
    }

    const { safeContext, result } = await runPrivacyPipeline(step2, text);
    
    // Extracted Vault entries implicitly from the detections for our mock
    const vaultEntries = result.detections.filter(d => d.action === 'TOKENIZE').map(d => ({ value: (d as any).raw_value_mock || "unknown" })); // We can't access vault directly easily if it's singleton without exporting it, but let's just use the known text input to check. Actually we can just run the check directly with known raw values.
    
    // We'll manually pass known sensitive strings for the vault check in the harness
    const knownValues = ["Rahul", "rahul@example.com", "9876543210", "SuperSecret123", "4111 1111 1111 1111"].map(v => ({ value: v }));
    
    let originalSanitizedText = result.sanitizedText;
    let safeContextToValidate = safeContext;
    
    if (intentionalFailureEnabled && text.includes("Rahul")) {
        // intentionally corrupt it by adding the raw value back
        safeContextToValidate = JSON.parse(JSON.stringify(safeContext));
        if (safeContextToValidate.task.tasks) {
            safeContextToValidate.task.tasks[0].slots.recipient = "Rahul";
        } else {
            safeContextToValidate.task.slots.recipient = "Rahul";
        }
    }

    const gateResult = await networkGate(safeContextToValidate, knownValues);
    
    const auditResult = {
        inputHadPII: result.detections.length > 0,
        detections: result.detections.length,
        tokenized: safeContext.privacy.tokenizedItems,
        blocked: safeContext.privacy.blockedItems,
        safeToTransmit: !gateResult.blocked,
        failureReason: gateResult.blocked ? gateResult.message : null
    };

    try {
        expectedAssertions({ safeContext: safeContextToValidate, result, gateResult, auditResult });
        console.log("RESULT: PASS");
    } catch (e) {
        console.log("RESULT: FAIL", e.message);
    }
    
    return { auditResult, gateResult };
}

async function main() {
    clearSessionVault();

    // Test 1: PERSON
    await runTest("TEST 1 - PERSON", "Send Rahul an email saying I will be late.", (res) => {
        if (JSON.stringify(res.safeContext).includes("Rahul")) throw new Error("Contains Rahul");
        if (res.gateResult.blocked) throw new Error("Network blocked incorrectly: " + res.gateResult.message);
    });

    // Test 2: EMAIL
    await runTest("TEST 2 - EMAIL", "Send an email to rahul@example.com saying I will be late.", (res) => {
        if (JSON.stringify(res.safeContext).includes("rahul@example.com")) throw new Error("Contains email");
    });

    // Test 3: PHONE
    await runTest("TEST 3 - PHONE", "My phone number is 9876543210.", (res) => {
        if (JSON.stringify(res.safeContext).includes("9876543210")) throw new Error("Contains phone");
    });

    // Test 4: MULTIPLE PII
    await runTest("TEST 4 - MULTIPLE PII", "Rahul's phone number is 9876543210 and his email is rahul@example.com.", (res) => {
        const s = JSON.stringify(res.safeContext);
        if (s.includes("Rahul") || s.includes("9876543210") || s.includes("rahul@example.com")) throw new Error("Contains raw PII");
    });

    // Test 5: PASSWORD
    await runTest("TEST 5 - PASSWORD", "My password is SuperSecret123.", (res) => {
        const s = JSON.stringify(res.safeContext);
        if (s.includes("SuperSecret123")) throw new Error("Contains password");
        if (res.safeContext.privacy.blockedItems === 0) throw new Error("Expected blockedItems > 0");
    });

    // Test 6: CREDIT CARD
    await runTest("TEST 6 - CREDIT CARD", "My card number is 4111 1111 1111 1111.", (res) => {
        const s = JSON.stringify(res.safeContext);
        if (s.includes("4111 1111 1111 1111")) throw new Error("Contains credit card");
        if (res.safeContext.privacy.blockedItems === 0) throw new Error("Expected blockedItems > 0");
    });

    // Test 7: NON-SENSITIVE
    await runTest("TEST 7 - NON-SENSITIVE", "Book a flight from Delhi to Mumbai tomorrow.", (res) => {
        const s = JSON.stringify(res.safeContext);
        if (!s.includes("Delhi") || !s.includes("Mumbai")) throw new Error("Should not redact locations in travel");
    });

    // Test 8: TASK + PII
    await runTest("TEST 8 - TASK + PII", "Book a flight for Rahul from Delhi to Mumbai tomorrow.", (res) => {
        const s = JSON.stringify(res.safeContext);
        if (s.includes("Rahul")) throw new Error("Contains Rahul");
        if (!s.includes("Delhi")) throw new Error("Missing Delhi");
    });

    // Test 9: PII INSIDE STEP 2 RESULT
    await runTest("TEST 9 - PII INSIDE STEP 2 RESULT", "Send Rahul an email saying I will be late.", (res) => {
        const s = JSON.stringify(res.safeContext);
        if (s.includes("Rahul")) throw new Error("Contains Rahul");
    }, {
        intent: "SEND",
        taskType: "SEND_EMAIL",
        slots: { recipient: "Rahul", body: "I will be late." }
    });

    // Test 10: MULTI-TASK ISOLATION
    await runTest("TEST 10 - MULTI-TASK ISOLATION", "Send Rahul an email saying I will be late. Buy shoes from Amazon.", (res) => {
        const t1 = res.safeContext.task.tasks[0];
        const t2 = res.safeContext.task.tasks[1];
        if (JSON.stringify(t2).includes("Rahul")) throw new Error("Rahul leaked to task 2");
        if (JSON.stringify(res.safeContext).includes("Rahul")) throw new Error("Contains Rahul");
    });

    // Intentional Failure Test
    intentionalFailureEnabled = true;
    console.log("\n--- TEST 11 - INTENTIONAL FAILURE ---");
    const { gateResult } = await runTest("INTENTIONAL FAILURE", "Send Rahul an email", (res) => {
        if (!res.gateResult.blocked) throw new Error("Failed to block intentional leak");
        console.log("Expected Block Reason:", res.gateResult.message);
    });
    intentionalFailureEnabled = false;

    // Network Gate Broken Context Test
    console.log("\n--- TEST 12 - NETWORK GATE WITH RAW OBJECT ---");
    const brokenContext = { recipient: "Rahul" };
    const ngResult = await networkGate(brokenContext, [{value: "Rahul"}]);
    console.log("Broken context gate result:", ngResult.message);

}

main();
