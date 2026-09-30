import { Step1Result } from '../nlp/schemas/promptSchema';
import { parsePrompt } from '../nlp/promptParser';

export function segmentTasks(step1: Step1Result): Step1Result[] {
    const segments: string[] = [];
    
    // We split on explicit workflow boundaries
    const text = step1.rawText;
    
    // Splitting on:
    // 1. semicolons or explicit periods between sentences
    // 2. ", then " or " and then " or " then "
    // 3. ", and " or ", " or " and " BUT ONLY IF followed by a specific action verb as a whole word
    // We avoid generic " and " because it's too aggressive (e.g. "between X and Y").
    
    const splitRegex = /\s*(?:;\s*|\.\s+|,?\s+and\s+then\s+|,?\s+then\s+|(?:,\s*(?:and\s+)?|\band\s+)(?=(?:search|find|compare|show|open|book|buy|cancel|send|read|download|upload|fill|submit|navigate|go to)\b))(?![^]*?(?:rupees|rs|bucks|inr))/i;
    
    let parts = text.split(splitRegex);
    
    for (let part of parts) {
        if (!part) continue;
        part = part.trim();
        
        if (part.length > 2) {
             const cleanSegment = part.replace(/^(\d+[\.\)]\s*|-\s*)/, '');
             segments.push(cleanSegment);
        }
    }
    
    return segments.map(seg => parsePrompt(seg));
}
