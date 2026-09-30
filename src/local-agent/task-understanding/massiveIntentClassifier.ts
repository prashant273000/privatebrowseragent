/**
 * MassiveIntentClassifier
 *
 * Uses joaobarroca/distilbert-base-uncased-finetuned-massive-intent-detection-english
 * (converted to ONNX) as a text-classification pipeline via @huggingface/transformers.
 *
 * Outputs are mapped from 60 MASSIVE labels → project intent ontology.
 */
import { pipeline, env } from '@huggingface/transformers';
import { Step1Result } from '../nlp/schemas/promptSchema';
import { IntentPrediction } from './schemas';
import { IntentClassifier } from './intentClassifier';
import { mapMassiveToProject, inferCategoryFromMassiveDomain } from './massiveIntentMap';
import { TASK_CATEGORIES } from './config';

const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

// ─── Model ID ──────────────────────────────────────────────────────────────────
const MASSIVE_MODEL_ID = 'cartesinus/multilingual_minilm-amazon-massive-intent';

/** 
 * In the browser extension, we load from locally bundled ONNX files.
 * In Node/Vitest, we allow remote download for test convenience.
 */
function configureMassiveEnv() {
    env.allowRemoteModels = true; // True for E2E in browser
    env.allowLocalModels = true;

    if (!isNode && typeof chrome !== 'undefined' && chrome.runtime) {
        env.localModelPath = chrome.runtime.getURL('models/');
        env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('wasm/');
    } else if (isNode) {
        env.localModelPath = './extension/public/models/';
        env.backends.onnx.wasm.wasmPaths = './extension/public/wasm/';
    }
}

configureMassiveEnv();

// ─── Singleton pipeline ────────────────────────────────────────────────────────
let massivePipelinePromise: Promise<any> | null = null;

function getMassivePipeline(): Promise<any> {
    if (!massivePipelinePromise) {
        massivePipelinePromise = pipeline('text-classification', MASSIVE_MODEL_ID, {
            dtype: 'fp32'
        }).catch(err => {
            massivePipelinePromise = null; // Allow retry
            throw err;
        });
    }
    return massivePipelinePromise;
}

// ─── Classifier Class ─────────────────────────────────────────────────────────
export class MassiveIntentClassifier implements IntentClassifier {
    async classify(input: Step1Result): Promise<{ intents: IntentPrediction[], categories: IntentPrediction[], massiveLabel?: string, massiveScore?: number }> {
        const clf = await getMassivePipeline();

        if (!isNode) {
            console.log('[MASSIVE] Running offline inference from:', env.localModelPath);
        }

        // Run text-classification — returns array of { label, score } sorted descending
        const rawResults: { label: string; score: number }[] = await clf(input.normalizedText, { topk: 10 });

        // ── Map MASSIVE labels → project intents ──────────────────────────────
        const projectIntentMap = new Map<string, number>();
        const categoryMap = new Map<string, number>();

        let topMassiveLabel = '';
        let topMassiveScore = 0;

        for (const { label, score } of rawResults) {
            const mapping = mapMassiveToProject(label);

            // Track top MASSIVE label for debug output
            if (score > topMassiveScore) {
                topMassiveScore = score;
                topMassiveLabel = label;
            }

            if (mapping.projectIntent === 'UNKNOWN' || mapping.reliability < 0.6) {
                continue; // Skip unmapped/unreliable
            }

            const adjustedScore = score * mapping.reliability;
            const existing = projectIntentMap.get(mapping.projectIntent) ?? 0;
            projectIntentMap.set(mapping.projectIntent, Math.max(existing, adjustedScore));

            // Infer category
            const category = inferCategoryFromMassiveDomain(mapping.massiveDomain);
            const catExisting = categoryMap.get(category) ?? 0;
            categoryMap.set(category, Math.max(catExisting, adjustedScore));
        }

        // ── Build sorted intent predictions ───────────────────────────────────
        const intents: IntentPrediction[] = Array.from(projectIntentMap.entries())
            .map(([intent, modelScore]) => ({ intent, modelScore }))
            .sort((a, b) => b.modelScore - a.modelScore);

        // ── Build category predictions ────────────────────────────────────────
        const categories: IntentPrediction[] = Array.from(categoryMap.entries())
            .map(([intent, modelScore]) => ({ intent, modelScore }))
            .sort((a, b) => b.modelScore - a.modelScore);

        // Ensure at least one entry in each
        if (intents.length === 0) {
            intents.push({ intent: 'UNKNOWN', modelScore: 0.1 });
        }
        if (categories.length === 0) {
            categories.push({ intent: 'GENERAL', modelScore: 0.1 });
        }

        return {
            intents,
            categories,
            massiveLabel: topMassiveLabel,
            massiveScore: topMassiveScore,
        };
    }
}
