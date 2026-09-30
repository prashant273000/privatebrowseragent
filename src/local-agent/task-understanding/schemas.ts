export interface MultiTaskStep2Result {
    isMultiTask: boolean;
    tasks: Step2Result[];
    workflow?: boolean;
}

export interface Step2Result {
    taskCategory: string;
    intent: string;
    taskType?: string;
    actions: string[];
    slots: Record<string, string | number | boolean | null>;
    constraints: Record<string, string | number | boolean | null>;
    // Raw model output (not calibrated probability — do not use as accuracy indicator)
    modelScore: number;
    // Heuristic confidence combining model, rules, slots, negation
    systemConfidence: number;
    // MASSIVE debug fields
    massiveLabel?: string;
    massiveRawScore?: number;
    
    // Modifiers
    negated?: boolean;
    negatedIntent?: string;
    executionPolicy?: 'DRAFT_ONLY' | 'PROHIBITED';

    topPredictions: {
        intent: string;
        modelScore: number;
    }[];
    needsClarification: boolean;
    missingSlots: string[];
    clarificationQuestion?: string;
}

export interface IntentPrediction {
    intent: string;
    modelScore: number;
}
