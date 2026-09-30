import { SensitivityLevel, PrivacyAction } from './schemas';

export function getSensitivityPolicy(piiType: string): { level: SensitivityLevel, defaultAction: PrivacyAction } {
    const type = piiType.toUpperCase();
    
    // Highly Sensitive - BLOCK/OMIT by default
    if (['PASSWORD', 'AUTH_TOKEN', 'CREDIT_CARD', 'IBAN_CODE', 'FINANCIAL'].includes(type)) {
        return { level: 'HIGHLY_SENSITIVE', defaultAction: 'BLOCK' };
    }
    
    // Personal - TOKENIZE by default
    if (['PERSON', 'EMAIL_ADDRESS', 'PHONE_NUMBER', 'LOCATION', 'IP_ADDRESS', 'IMEI', 'AGE', 'DATE_TIME'].includes(type)) {
        return { level: 'PERSONAL', defaultAction: 'TOKENIZE' };
    }
    
    // Unknown or other types treated as personal to be safe
    return { level: 'PERSONAL', defaultAction: 'TOKENIZE' };
}
