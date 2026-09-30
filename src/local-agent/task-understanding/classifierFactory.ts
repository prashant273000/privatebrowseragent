/**
 * classifierFactory.ts
 *
 * Controls which intent classifier is active.
 *
 * Set MODEL_MODE to:
 *   "massive"    → MassiveIntentClassifier (DistilBERT fine-tuned on MASSIVE)
 *   "zero-shot"  → ZeroShotMobileBERTClassifier (MobileBERT zero-shot baseline)
 */
import { ZeroShotMobileBERTClassifier } from './intentClassifier';
import { MassiveIntentClassifier } from './massiveIntentClassifier';
import { IntentClassifier } from './intentClassifier';

export const MODEL_MODE: 'massive' | 'zero-shot' = 'massive';

/**
 * TransformerIntentClassifier — factory that returns the active classifier.
 * Named this way to keep backward compat with taskUnderstanding.ts imports.
 */
export class TransformerIntentClassifier implements IntentClassifier {
    private delegate: IntentClassifier;

    constructor() {
        if (MODEL_MODE === 'massive') {
            this.delegate = new MassiveIntentClassifier();
            console.log('[Classifier] Mode: MASSIVE (DistilBERT fine-tuned on MASSIVE dataset)');
        } else {
            this.delegate = new ZeroShotMobileBERTClassifier();
            console.log('[Classifier] Mode: ZERO-SHOT (MobileBERT MNLI)');
        }
    }

    classify(input: import('../nlp/schemas/promptSchema').Step1Result) {
        return this.delegate.classify(input);
    }
}
