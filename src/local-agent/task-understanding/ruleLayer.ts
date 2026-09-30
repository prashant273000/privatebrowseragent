import { Step1Result } from '../nlp/schemas/promptSchema';
import { IntentPrediction } from './schemas';
import { INTENTS } from './config';

export function getRuleBasedSignals(step1: Step1Result): IntentPrediction[] {
    const signals: IntentPrediction[] = [];
    
    // Look at ACTION_WORD from Step 1 custom entities
    const actionEntities = step1.customEntities.filter(e => e.type === 'ACTION_WORD');
    const textLower = step1.rawText.toLowerCase();

    // Check for negation
    const hasNegationNear = (verb: string) => {
        const regex = new RegExp(`(?:do\\s*not|don't|not|never)\\s+(?:\\w+\\s+){0,2}${verb}`, 'i');
        return regex.test(textLower);
    };
    
    if (actionEntities.length > 0) {
        for (const action of actionEntities) {
            const val = action.value.toUpperCase();
            const rawVal = action.value.toLowerCase();

            if (hasNegationNear(rawVal)) {
                // If negated, we do NOT boost this intent. We might even penalize it later,
                // but for now, just ignore the keyword rule so it doesn't artificially spike.
                continue;
            }
            
            // Map action words to our formal INTENT taxonomy
            if (['BOOK', 'RESERVE'].includes(val)) signals.push({ intent: 'BOOK', modelScore: 0.95 });
            if (['BUY', 'ORDER'].includes(val)) signals.push({ intent: 'BUY', modelScore: 0.95 });
            if (['FIND', 'SEARCH'].includes(val)) signals.push({ intent: 'SEARCH', modelScore: 0.95 });
            if (['OPEN', 'NAVIGATE'].includes(val)) signals.push({ intent: 'OPEN', modelScore: 0.95 });
            if (['CANCEL'].includes(val)) signals.push({ intent: 'CANCEL', modelScore: 0.95 });
            if (['SEND'].includes(val)) signals.push({ intent: 'SEND', modelScore: 0.95 });
            if (['DOWNLOAD'].includes(val)) signals.push({ intent: 'DOWNLOAD', modelScore: 0.95 });
            if (['UPLOAD'].includes(val)) signals.push({ intent: 'UPLOAD', modelScore: 0.95 });
        }
    }
    
    // Fallback: look at primary verbs
    for (const verb of step1.verbs) {
        const v = verb.toUpperCase();
        if (hasNegationNear(verb.toLowerCase())) continue;

        if (INTENTS.includes(v)) {
            signals.push({ intent: v, modelScore: 0.3 }); // Weak signal from raw verbs
        }
        
        // Custom verb mapping
        if (v === 'EMAIL' || v === 'MESSAGE') {
            signals.push({ intent: 'SEND', modelScore: 0.8 });
        }
        if (['DOWNLOAD', 'OPEN', 'CANCEL', 'UPLOAD', 'FIND', 'SEARCH', 'BUY', 'BOOK', 'COMPARE', 'FILL', 'SUBMIT', 'NAVIGATE'].includes(v)) {
            let mappedIntent = ['FIND', 'SEARCH'].includes(v) ? 'SEARCH' : v;
            if (mappedIntent === 'NAVIGATE') mappedIntent = 'OPEN';
            signals.push({ intent: mappedIntent, modelScore: 0.95 });
        }
    }

    // Heuristics for commands that winkNLP might miss as verbs
    if (textLower.startsWith('open ')) {
        signals.push({ intent: 'OPEN', modelScore: 0.95 });
    }

    return signals;
}

export function fusePredictions(modelPreds: IntentPrediction[], rulePreds: IntentPrediction[]): IntentPrediction[] {
    const fusedMap = new Map<string, number>();

    // Add model predictions
    for (const pred of modelPreds) {
        fusedMap.set(pred.intent, pred.modelScore);
    }

    // Boost with rules
    for (const pred of rulePreds) {
        const current = fusedMap.get(pred.intent) || 0;
        // Simple additive fusion, capped at 0.99
        fusedMap.set(pred.intent, Math.min(0.99, current + pred.modelScore));
    }

    // Convert back to array and sort
    const fusedArray = Array.from(fusedMap.entries()).map(([intent, modelScore]) => ({
        intent, modelScore
    }));

    fusedArray.sort((a, b) => b.modelScore - a.modelScore);

    return fusedArray;
}
