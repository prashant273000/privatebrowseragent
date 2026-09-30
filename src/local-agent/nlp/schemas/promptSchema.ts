export interface Step1Result {
    rawText: string;
    normalizedText: string;
    sentences: string[];
    tokens: string[];
    posTokens: {
        value: string;
        pos: string;
    }[];
    entities: {
        value: string;
        type: string;
    }[];
    verbs: string[];
    nouns: string[];
    adjectives: string[];
    customEntities: {
        value: string;
        type: string;
    }[];
}
