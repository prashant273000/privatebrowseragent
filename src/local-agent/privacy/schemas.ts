export type SensitivityLevel = 'NON_SENSITIVE' | 'PERSONAL' | 'HIGHLY_SENSITIVE';

export type PrivacyAction = 'ALLOW' | 'TOKENIZE' | 'BLOCK' | 'OMIT';

export interface PiiDetection {
    start: number;
    end: number;
    value: string;         // The raw value (omitted in final logs/SafeContext)
    type: string;          // e.g., PERSON, EMAIL_ADDRESS, PASSWORD
    confidence: number;
    source: 'MODEL' | 'RULE' | 'DOM';
    sensitivity: SensitivityLevel;
    action: PrivacyAction;
    token?: string;        // e.g., <PERSON_1> if action is TOKENIZE
}

export interface SanitizationResult {
    sanitizedText: string;
    detections: Omit<PiiDetection, 'value'>[]; // Stripped of raw values for logging
}

// Token Vault must NEVER be sent to the server.
export interface TokenVaultEntry {
    type: string;
    value: string;
}

// The output of Step 3 that is permitted to cross the network boundary
export interface SafeContext {
    task: any; // The sanitized Step2Result (or MultiTaskStep2Result)
    pageData?: any; // Sanitized page data
    privacy: {
        sanitized: boolean;
        piiDetected: boolean;
        blockedItems: number;
        tokenizedItems: number;
    };
}
