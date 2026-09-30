import { PiiDetection } from './schemas';

export function detectPiiRules(text: string): Partial<PiiDetection>[] {
    const detections: Partial<PiiDetection>[] = [];
    
    const rules = [
        {
            type: 'EMAIL_ADDRESS',
            regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
        },
        {
            type: 'PHONE_NUMBER',
            regex: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g
        },
        {
            type: 'CREDIT_CARD',
            regex: /(?<!\d\.?)\b(?:\d[ -]?){13,16}\b(?!\.?\d)/g
        },
        {
            type: 'PASSWORD',
            // Simple heuristic: "password is X" or "password: X"
            regex: /password\s*(?:is|:|=)\s*([^\s]+)/gi,
            groupIndex: 1
        },
        {
            type: 'AUTH_TOKEN',
            regex: /\b(?:Bearer|token)\s+([A-Za-z0-9\-_~+/]+={0,2})\b/gi,
            groupIndex: 1
        }
    ];

    for (const rule of rules) {
        let match;
        while ((match = rule.regex.exec(text)) !== null) {
            const value = rule.groupIndex ? match[rule.groupIndex] : match[0];
            const start = rule.groupIndex ? match.index + match[0].indexOf(value) : match.index;
            const end = start + value.length;
            
            detections.push({
                type: rule.type,
                value,
                start,
                end,
                confidence: 1.0,
                source: 'RULE'
            });
        }
    }
    
    return detections;
}
