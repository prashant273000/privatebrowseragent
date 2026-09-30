import { pipeline, env } from '@huggingface/transformers';
import { PiiDetection } from './schemas';

const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

const PII_MODEL_ID = 'onnx-community/bert-small-pii-detection-ONNX';

function configurePiiEnv() {
    env.allowRemoteModels = true; // True for E2E testing in browser
    env.allowLocalModels = true;

    if (!isNode && typeof chrome !== 'undefined' && chrome.runtime) {
        env.localModelPath = chrome.runtime.getURL('models/');
        env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('wasm/');
    } else if (isNode) {
        env.localModelPath = './extension/public/models/';
        env.backends.onnx.wasm.wasmPaths = './extension/public/wasm/';
    }
}

configurePiiEnv();

let piiPipelinePromise: Promise<any> | null = null;

function getPiiPipeline(): Promise<any> {
    if (!piiPipelinePromise) {
        piiPipelinePromise = pipeline('token-classification', PII_MODEL_ID, {
            dtype: 'fp32'
        }).catch(err => {
            piiPipelinePromise = null;
            throw err;
        });
    }
    return piiPipelinePromise;
}

export async function detectPiiModel(text: string): Promise<Partial<PiiDetection>[]> {
    if (!text.trim()) return [];
    
    const clf = await getPiiPipeline();

    // BERT has a hard max of 512 tokens. Truncate conservatively at the character
    // level (avg English token ≈ 4 chars). Going over causes an ONNX shape
    // broadcast error: "Attempting to broadcast an axis by a dimension other than 1."
    const MAX_CHARS = 500 * 4; // ~500 tokens × 4 chars/token safety margin
    const truncatedText = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;
    if (text.length > MAX_CHARS) {
        console.warn(`[PiiDetector] Input truncated from ${text.length} to ${MAX_CHARS} chars for BERT.`);
    }
    
    // Aggregation strategy 'simple' merges B-PERSON, I-PERSON into one PERSON entity
    const rawResults = await clf(truncatedText, { ignore_labels: ['O'], aggregation_strategy: 'simple' });
    
    const detections: Partial<PiiDetection>[] = [];
    
    for (const result of rawResults) {
        if (result.score > 0.5) {
            let start = result.start;
            let end = result.end;
            let value = result.word;
            
            // If model is uncased and doesn't provide offsets, find the actual word in the text
            if (start === undefined || end === undefined) {
                // Remove ## prefix for subwords just in case
                const searchWord = value.replace(/^##/, '');
                // Simple case-insensitive search to find the first occurrence not yet consumed
                // For a robust implementation we'd track lastIndex, but this is okay for small strings
                const match = new RegExp('\\b' + searchWord.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'i').exec(text);
                
                if (match) {
                    start = match.index;
                    value = match[0]; // Get the correctly cased original string
                    end = start + value.length;
                } else {
                    // Fallback if boundary match fails
                    const fallbackIndex = text.toLowerCase().indexOf(searchWord.toLowerCase());
                    if (fallbackIndex !== -1) {
                        start = fallbackIndex;
                        value = text.substring(fallbackIndex, fallbackIndex + searchWord.length);
                        end = start + value.length;
                    }
                }
            }
            
            if (start !== undefined && end !== undefined) {
                detections.push({
                    type: result.entity_group,
                    value: value,
                    start: start,
                    end: end,
                    confidence: result.score,
                    source: 'MODEL'
                });
            }
        }
    }
    
    return detections;
}
