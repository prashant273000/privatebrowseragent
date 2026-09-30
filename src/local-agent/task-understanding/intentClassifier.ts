/**
 * Intent Classifiers
 *
 * Exports two classifiers:
 *   - ZeroShotMobileBERTClassifier: original zero-shot MobileBERT (baseline)
 *   - MassiveIntentClassifier: fine-tuned DistilBERT on MASSIVE dataset (new)
 *
 * Controlled by MODEL_MODE in classifierConfig.ts
 */
import { pipeline, env } from '@huggingface/transformers';
import { INTENTS, TASK_CATEGORIES } from './config';
import { Step1Result } from '../nlp/schemas/promptSchema';
import { IntentPrediction } from './schemas';

export interface IntentClassifier {
    classify(input: Step1Result): Promise<{ 
        intents: IntentPrediction[]; 
        categories: IntentPrediction[];
        massiveLabel?: string;
        massiveScore?: number;
    }>;
}

// ── Shared environment setup ────────────────────────────────────────────────
const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

env.allowRemoteModels = isNode;
env.allowLocalModels = true;

env.localModelPath = typeof chrome !== 'undefined' && chrome.runtime
    ? chrome.runtime.getURL('models/')
    : (isNode ? './extension/public/models/' : '/models/');

env.backends.onnx.wasm.wasmPaths = typeof chrome !== 'undefined' && chrome.runtime
    ? chrome.runtime.getURL('wasm/')
    : (isNode ? './extension/public/wasm/' : '/wasm/');

// ── ZeroShotMobileBERTClassifier (Baseline) ─────────────────────────────────
class ZeroShotModelManager {
    static pipelinePromise: Promise<any> | null = null;

    static getInstance() {
        if (!this.pipelinePromise) {
            this.pipelinePromise = pipeline('zero-shot-classification', 'Xenova/mobilebert-uncased-mnli', {
                dtype: 'q8'
            });
        }
        return this.pipelinePromise;
    }
}

export class ZeroShotMobileBERTClassifier implements IntentClassifier {
    async classify(input: Step1Result): Promise<{ intents: IntentPrediction[], categories: IntentPrediction[] }> {
        const classifier = await ZeroShotModelManager.getInstance();

        if (env.allowRemoteModels !== false) {
            console.warn("WARNING: Remote models are still enabled!");
        } else {
            console.log("[ZeroShot] Offline execution. Model from:", env.localModelPath);
        }

        const intentResult = await classifier(input.normalizedText, INTENTS);
        const intents: IntentPrediction[] = intentResult.labels.map((label: string, i: number) => ({
            intent: label.toUpperCase(),
            modelScore: intentResult.scores[i]
        }));

        const categoryResult = await classifier(input.normalizedText, TASK_CATEGORIES);
        const categories: IntentPrediction[] = categoryResult.labels.map((label: string, i: number) => ({
            intent: label.toUpperCase(),
            modelScore: categoryResult.scores[i]
        }));

        return { intents, categories };
    }
}

// ── Default export: TransformerIntentClassifier (kept for backward compat) ──
// taskUnderstanding.ts instantiates TransformerIntentClassifier; it is now
// a re-export of whichever class is selected by MODEL_MODE.
export { TransformerIntentClassifier } from './classifierFactory';
