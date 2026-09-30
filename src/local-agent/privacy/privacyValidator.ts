import { SafeContext, PiiDetection } from './schemas';

export function validateSafeContext(context: SafeContext, rawDetections: PiiDetection[]) {
    // Stringify context and verify no raw highly sensitive values exist
    const jsonString = JSON.stringify(context.task);
    
    for (const d of rawDetections) {
        if (d.action === 'BLOCK' || d.action === 'OMIT' || d.action === 'TOKENIZE') {
            // Check if the raw value somehow leaked into the stringified JSON
            // For very short values (e.g. 1 digit), this might false positive, but for normal PII it's safe.
            if (d.value.length > 2 && jsonString.includes(d.value)) {
                throw new Error(`Privacy Violation: Raw sensitive value of type ${d.type} leaked into SafeContext.`);
            }
        }
    }
}
