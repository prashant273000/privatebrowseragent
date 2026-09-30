import { Step1Result } from '../nlp/schemas/promptSchema';
import { MultiTaskStep2Result, Step2Result } from './schemas';
import { TransformerIntentClassifier } from './intentClassifier';
import { getRuleBasedSignals, fusePredictions } from './ruleLayer';
import { extractSlots, extractConstraints } from './slotExtractor';
import { checkCompleteness } from './taskRequirements';
import { ACTION_MAP } from './config';
import { segmentTasks } from './taskSegmenter';
import { mapMassiveToProject } from './massiveIntentMap';

const classifier = new TransformerIntentClassifier();

export async function processTaskUnderstanding(step1: Step1Result): Promise<MultiTaskStep2Result> {
    const segments = segmentTasks(step1);
    const tasks: Step2Result[] = [];

    for (const segment of segments) {
        if (segment.rawText.trim().length < 2) continue;
        const taskResult = await processSingleTaskUnderstanding(segment);
        tasks.push(taskResult);
    }

    return {
        isMultiTask: tasks.length > 1,
        workflow: tasks.length > 1,
        tasks
    };
}

async function processSingleTaskUnderstanding(step1: Step1Result): Promise<Step2Result> {
    const textLower = step1.rawText.toLowerCase();

    // Modifiers
    let negated = false;
    let negatedIntent = undefined;
    let executionPolicy: 'DRAFT_ONLY' | 'PROHIBITED' | undefined = undefined;

    if (textLower.match(/\b(don't|do not|not)\s+(send|submit)\b/i) || textLower.match(/\bbut don't\b/i)) {
        executionPolicy = 'DRAFT_ONLY';
    } else if (textLower.match(/\b(don't|do not|not)\s+(cancel|buy|book|purchase|order)\b/i)) {
        negated = true;
        const match = textLower.match(/\b(cancel|buy|book|purchase|order)\b/i);
        if (match) {
            negatedIntent = match[1].toUpperCase();
            if (negatedIntent === 'PURCHASE' || negatedIntent === 'ORDER') negatedIntent = 'BUY';
        }
    } else if (textLower.match(/\bnot\s+(book|buy|send)\b/i)) {
        const match = textLower.match(/\bnot\s+(book|buy|send)\b/i);
        negatedIntent = match![1].toUpperCase();
    }

    // 1. Transformer Classification 
    const { intents: modelIntents, categories: modelCategories, massiveLabel, massiveScore } =
        await classifier.classify(step1);

    // 2. Rule-based signals
    const ruleIntents = getRuleBasedSignals(step1);

    // 3. Fusion
    const fusedIntents = fusePredictions(modelIntents, ruleIntents);

    // Filter out negated intent if it got top score, ONLY IF negated is false (meaning the user explicitly wants something else)
    const validIntents = fusedIntents.filter(i => {
        if (negated) return true; // Keep it if it's the primary intent (e.g. "Do not cancel")
        return i.intent !== negatedIntent;
    });
    
    const topIntent = validIntents.length > 0 ? validIntents[0] : { intent: 'UNKNOWN', modelScore: 0.1 };
    const secondIntent = validIntents.length > 1 ? validIntents[1] : { intent: 'UNKNOWN', modelScore: 0 };
    
    // Also filter categories if possible? Keep simple.
    const topCategory = [...modelCategories].sort((a, b) => b.modelScore - a.modelScore)[0];

    // ── 4. Determine Task Type ─────────────────────────────────────────────────
    let taskType: string | undefined = undefined;

    // Keyword-based rules for taskType take precedence
    if (topIntent.intent === 'SEND' && (topCategory.intent === 'COMMUNICATION' || topCategory.intent === 'PRODUCTIVITY' || textLower.includes('email') || textLower.includes('message'))) {
        taskType = textLower.includes('email') ? 'SEND_EMAIL' : 'SEND_MESSAGE';
        topCategory.intent = 'COMMUNICATION';
    } else if (topIntent.intent === 'SEARCH' && textLower.match(/\b(email|emails)\b/i)) {
        taskType = 'READ_EMAIL';
        topCategory.intent = 'COMMUNICATION';
    } else if (topIntent.intent === 'READ' && textLower.match(/\b(email|emails)\b/i)) {
        taskType = 'READ_EMAIL';
        topIntent.intent = 'SEARCH';
        topCategory.intent = 'COMMUNICATION';
    } else if (topIntent.intent === 'BOOK' && (textLower.includes('flight') || textLower.includes('train'))) {
        taskType = textLower.includes('flight') ? 'BOOK_FLIGHT' : 'BOOK_TRAIN';
        topCategory.intent = 'TRAVEL';
    } else if (topIntent.intent === 'SEARCH' && (textLower.includes('flight') || textLower.includes('train'))) {
        taskType = textLower.includes('flight') ? 'SEARCH_FLIGHT' : 'SEARCH_TRAIN';
        topCategory.intent = 'TRAVEL';
    } else if (topIntent.intent === 'BOOK' && (textLower.includes('movie') || textLower.includes('ticket')) && !textLower.includes('flight') && !textLower.includes('train')) {
        taskType = 'BOOK_MOVIE';
        topCategory.intent = 'ENTERTAINMENT';
    } else if (topIntent.intent === 'SEARCH' && (textLower.includes('movie') || textLower.includes('ticket')) && !textLower.includes('flight') && !textLower.includes('train')) {
        taskType = 'SEARCH_MOVIE';
        topCategory.intent = 'ENTERTAINMENT';
    } else if (topIntent.intent === 'BOOK' && (textLower.includes('hotel') || textLower.includes('room'))) {
        taskType = 'BOOK_HOTEL';
        topCategory.intent = 'TRAVEL';
    } else if (topIntent.intent === 'SEARCH' && (textLower.includes('hotel') || textLower.includes('room'))) {
        taskType = 'SEARCH_HOTEL';
        topCategory.intent = 'TRAVEL';
    } else if (['BOOK','RESERVE','ORDER'].includes(topIntent.intent) && (textLower.includes('restaurant') || textLower.includes('table') || textLower.includes('food'))) {
        taskType = 'BOOK_RESTAURANT';
        topCategory.intent = 'FOOD';
    } else if (['SEARCH','FIND'].includes(topIntent.intent) && (textLower.includes('restaurant') || textLower.includes('food'))) {
        taskType = 'SEARCH_RESTAURANT';
        topCategory.intent = 'FOOD';
    } else if (topIntent.intent === 'BUY') {
        taskType = 'BUY_PRODUCT';
        topCategory.intent = 'SHOPPING';
    } else if (topIntent.intent === 'SEARCH' && (topCategory.intent === 'SHOPPING' || textLower.match(/\b(buy|price|under|amazon|flipkart|headphones|laptop|shoes)\b/i))) {
        taskType = 'SEARCH_PRODUCT';
        topCategory.intent = 'SHOPPING';
    } else if (topIntent.intent === 'UPLOAD') {
        taskType = 'UPLOAD_FILE';
    } else if (topIntent.intent === 'DOWNLOAD') {
        taskType = 'DOWNLOAD_FILE';
    } else if (topIntent.intent === 'SUBMIT') {
        taskType = 'SUBMIT_FORM';
    } else if (topIntent.intent === 'FILL') {
        taskType = 'FILL_FORM';
    } else if (topIntent.intent === 'OPEN' || topIntent.intent === 'NAVIGATE') {
        taskType = 'NAVIGATE_WEBSITE';
    } else if (topCategory.intent === 'TRAVEL' && topIntent.intent === 'BOOK') {
        taskType = 'BOOK_TRAVEL';
    }

    // If still no taskType, use MASSIVE mapping override if available
    if (!taskType && massiveLabel) {
        const mapping = mapMassiveToProject(massiveLabel);
        if (mapping.taskType) {
            taskType = mapping.taskType;
        }
    }

    // ── 5. Task-aware Slot Extraction ─────────────────────────────────────────
    const slots = extractSlots(step1, topCategory.intent, topIntent.intent, taskType);
    const constraints = extractConstraints(step1, slots);

    // ── 6. Action Mapping ─────────────────────────────────────────────────────
    const actions = ACTION_MAP[topIntent.intent] || [];

    // ── 7. Completeness Validation ────────────────────────────────────────────
    let completeness = checkCompleteness(taskType || `${topCategory.intent}_${topIntent.intent}`, slots);
    
    // Explicit ambiguity checks
    const cleanText = textLower.replace(/[^a-z0-9\s]/g, '').trim();
    if (cleanText === 'book it' || cleanText === 'book') {
        completeness.needsClarification = true;
        if (!completeness.missingSlots.includes('object')) completeness.missingSlots.push('object');
    }
    if (cleanText === 'find the cheapest one' || cleanText === 'find something cheap' || cleanText === 'find cheap') {
        completeness.needsClarification = true;
        if (!completeness.missingSlots.includes('object')) completeness.missingSlots.push('object');
    }

    // ── 8. Confidence Calculation ─────────────────────────────────────────────
    const rawModelScore = topIntent.modelScore;
    let systemConfidence = rawModelScore;
    const margin = rawModelScore - secondIntent.modelScore;

    if (margin < 0.1) systemConfidence -= 0.10;
    if (Object.keys(slots).length > 0) systemConfidence += 0.05;
    if (completeness.missingSlots.length > 0) systemConfidence -= 0.05;
    
    // Penalize if intent contradicts text heavily (e.g. MASSIVE label overrides strong local evidence)
    if (topIntent.intent === 'UNKNOWN' || massiveLabel === 'iot_cleaning') systemConfidence -= 0.3;

    systemConfidence = Math.max(0, Math.min(0.99, systemConfidence));

    // ── Debug log ─────────────────────────────────────────────────────────────
    console.log(`[Step2 Debug]
  Task text      : "${step1.rawText}"
  MASSIVE label  : ${massiveLabel ?? 'N/A'} (raw score: ${massiveScore?.toFixed(3) ?? 'N/A'})
  Project intent : ${topIntent.intent}
  Task type      : ${taskType ?? '—'}
  Category       : ${topCategory.intent}
  Slots          : ${JSON.stringify(slots)}
  Constraints    : ${JSON.stringify(constraints)}
  systemConf     : ${systemConfidence.toFixed(3)}
  clarification  : ${completeness.needsClarification}`);

    return {
        taskCategory: topCategory.intent,
        intent: topIntent.intent,
        taskType,
        actions,
        slots,
        constraints,
        modelScore: parseFloat(rawModelScore.toFixed(3)),
        systemConfidence: parseFloat(systemConfidence.toFixed(3)),
        massiveLabel,
        massiveRawScore: massiveScore,
        negated: negated ? true : undefined,
        negatedIntent: negatedIntent,
        executionPolicy: executionPolicy,
        topPredictions: fusedIntents.slice(0, 3).map(p => ({
            intent: p.intent,
            modelScore: parseFloat(p.modelScore.toFixed(3))
        })),
        needsClarification: completeness.needsClarification,
        missingSlots: completeness.missingSlots,
        clarificationQuestion: completeness.clarificationQuestion
    };
}
