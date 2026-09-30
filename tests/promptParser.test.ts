import { expect, test, describe } from 'vitest';
import { parsePrompt } from '../src/local-agent/nlp/promptParser';

const testPrompts = [
    "Book a movie ticket for Interstellar tomorrow evening for 2 people.",
    "Find a flight from Delhi to Mumbai next Monday morning.",
    "Buy Nike shoes under 5000 rupees.",
    "Open Gmail and find unread emails from Rahul.",
    "Book a table for two tonight.",
    "Search Amazon for an iPhone charger.",
    "Cancel my Ola ride.",
    "Open https://example.com"
];

describe('Step 1: NLP Prompt Parsing', () => {
    for (const prompt of testPrompts) {
        test(`Parses: "${prompt}"`, () => {
            const result = parsePrompt(prompt);
            
            // Log the result to see it locally (run with: npx vitest)
            console.log(`\n--- RESULT FOR: "${prompt}" ---`);
            console.log(JSON.stringify(result, null, 2));

            // Verify the required fields exist
            expect(result).toHaveProperty('rawText', prompt);
            expect(result).toHaveProperty('normalizedText');
            expect(result.sentences.length).toBeGreaterThan(0);
            expect(result.tokens.length).toBeGreaterThan(0);
            expect(result.posTokens.length).toBeGreaterThan(0);
            expect(Array.isArray(result.verbs)).toBe(true);
            expect(Array.isArray(result.nouns)).toBe(true);
            expect(Array.isArray(result.adjectives)).toBe(true);
            expect(Array.isArray(result.entities)).toBe(true);
            expect(Array.isArray(result.customEntities)).toBe(true);
        });
    }
});
