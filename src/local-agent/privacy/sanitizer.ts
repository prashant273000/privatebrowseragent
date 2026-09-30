import { PiiDetection } from './schemas';

export function sanitizeText(text: string, detections: PiiDetection[]): string {
    if (!text) return text;
    
    let sanitized = text;
    // Apply longer values first so we don't partially replace overlapping ones
    const sorted = [...detections].sort((a, b) => b.value.length - a.value.length);
    
    const processedValues = new Set<string>();
    
    for (const d of sorted) {
        if (processedValues.has(d.value)) continue;
        processedValues.add(d.value);
        
        if (d.action === 'TOKENIZE' && d.token) {
            sanitized = sanitized.split(d.value).join(d.token);
        } else if (d.action === 'BLOCK' || d.action === 'OMIT') {
            sanitized = sanitized.split(d.value).join('[REDACTED]');
        }
    }
    
    return sanitized;
}

export function sanitizeObject<T>(obj: T, detections: PiiDetection[]): T {
    if (obj === null || obj === undefined) return obj;
    
    // We replace occurrences of the raw value in the strings of the object
    if (typeof obj === 'string') {
        let str = obj;
        // Apply longer values first so we don't partially replace overlapping ones
        const sorted = [...detections].sort((a, b) => b.value.length - a.value.length);
        const processedValues = new Set<string>();
        
        for (const d of sorted) {
            if (processedValues.has(d.value)) continue;
            processedValues.add(d.value);
            
            if (d.action === 'TOKENIZE' && d.token) {
                // simple global replace
                str = str.split(d.value).join(d.token);
            } else if (d.action === 'BLOCK' || d.action === 'OMIT') {
                str = str.split(d.value).join('[REDACTED]');
            }
        }
        return str as any;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item, detections)) as any;
    }
    
    if (typeof obj === 'object') {
        const sanitizedObj: any = {};
        for (const [key, value] of Object.entries(obj)) {
            sanitizedObj[key] = sanitizeObject(value, detections);
        }
        return sanitizedObj;
    }
    
    return obj;
}
