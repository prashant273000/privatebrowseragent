import { detectPiiModel } from './piiDetector';
import { detectPiiRules } from './privacyRules';
import { getSensitivityPolicy } from './sensitivityPolicy';
import { TokenVault } from './tokenVault';
import { sanitizeObject, sanitizeText } from './sanitizer';
import { validateSafeContext } from './privacyValidator';
import { PiiDetection, SafeContext, SanitizationResult } from './schemas';

// Single vault for the agent session
const sessionVault = new TokenVault();

export function clearSessionVault() {
    sessionVault.clear();
}

export function getSessionVault() {
    return sessionVault;
}

export function getRawVaultValues(): string[] {
    // This is explicitly for the local network gate to verify nothing leaked
    return sessionVault.getAllRawValues();
}

export async function sanitizePageContext(pageData: any): Promise<any> {
    // This allows Step 3 to later sanitize page DOM metadata
    // Not fully implemented yet, but respects the API contract
    return pageData;
}

export async function runPrivacyPipeline(
    step2Result: any, 
    rawText: string
): Promise<{ safeContext: SafeContext, result: SanitizationResult }> {
    
    // 1. Model Detections
    const modelDets = await detectPiiModel(rawText);
    
    // 2. Rule Detections
    const ruleDets = detectPiiRules(rawText);
    
    // 3. Merge & Deduplicate (Rules override model for exact matches)
    const allDetections: Partial<PiiDetection>[] = [...ruleDets];
    for (const m of modelDets) {
        // If it doesn't overlap strongly with a rule, keep it
        const overlap = allDetections.some(r => Math.max(r.start!, m.start!) < Math.min(r.end!, m.end!));
        if (!overlap) {
            allDetections.push(m);
        }
    }
    
    // 4. Assign Policies and Tokens
    const finalDetections: PiiDetection[] = [];
    let blockedItems = 0;
    let tokenizedItems = 0;
    
    for (const d of allDetections) {
        const policy = getSensitivityPolicy(d.type!);
        
        let action = policy.defaultAction;
        let token = undefined;
        
        let isTravel = false;
        if (step2Result.tasks) {
            isTravel = step2Result.tasks.some((t: any) => t.taskCategory === 'TRAVEL');
        } else {
            isTravel = step2Result.taskCategory === 'TRAVEL';
        }
        
        if (d.type === 'LOCATION' && isTravel) {
            action = 'ALLOW';
        } else if (action === 'TOKENIZE') {
            token = sessionVault.getToken(d.type!, d.value!);
            tokenizedItems++;
        } else if (action === 'BLOCK' || action === 'OMIT') {
            blockedItems++;
        }
        
        finalDetections.push({
            ...d,
            sensitivity: policy.level,
            action,
            token
        } as PiiDetection);
    }
    
    // 5. Sanitize Text & Object
    const sanitizedText = sanitizeText(rawText, finalDetections);
    const sanitizedTask = sanitizeObject(step2Result, finalDetections);
    
    // 6. Build SafeContext
    const safeContext: SafeContext = {
        task: sanitizedTask,
        privacy: {
            sanitized: true,
            piiDetected: finalDetections.length > 0,
            blockedItems,
            tokenizedItems
        }
    };
    
    // 7. Validate
    validateSafeContext(safeContext, finalDetections);
    
    // 8. Result
    return {
        safeContext,
        result: {
            sanitizedText,
            detections: finalDetections.map(d => {
                const { value, ...rest } = d;
                return rest as Omit<PiiDetection, 'value'>;
            })
        }
    };
}
