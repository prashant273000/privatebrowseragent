import { nlp, its } from './wink';
import { Step1Result } from './schemas/promptSchema';

export function parsePrompt(prompt: string): Step1Result {
    if (!prompt || prompt.trim() === '') {
        throw new Error("Validation Error: Prompt cannot be empty or just whitespace.");
    }

    try {
        // Read the document using the pre-initialized NLP instance
        const doc = nlp.readDoc(prompt);

        // 1. Raw Text
        const rawText = prompt;

        // 2. Normalized Text
        // We use doc.tokens().out(its.normal) to get lowercased, normalized tokens
        // and join them into a clean string.
        const normalizedText = doc.tokens().out(its.normal).join(' ').trim();

        // 3. Sentences
        const sentences = doc.sentences().out();

        // 4. Tokens
        const tokens = doc.tokens().out();

        // 5. POS Tokens (and populate verbs/nouns/adjectives)
        const verbs: string[] = [];
        const nouns: string[] = [];
        const adjectives: string[] = [];
        const posTokens: { value: string; pos: string }[] = [];

        doc.tokens().each((t: any) => {
            const value = t.out();
            const pos = t.out(its.pos);
            posTokens.push({ value, pos });

            if (pos === 'VERB') verbs.push(value);
            if (pos === 'NOUN' || pos === 'PROPN') nouns.push(value);
            if (pos === 'ADJ') adjectives.push(value);
        });

        // 6. Built-in Entities (DATE, TIME, MONEY, etc.)
        const entities = doc.entities().out(its.detail).map((e: any) => ({
            value: e.value,
            type: e.type
        }));

        // 7. Custom Entities (WEBSITE, ACTION_WORD)
        const customEntities = doc.customEntities().out(its.detail).map((e: any) => ({
            value: e.value,
            type: e.type
        }));

        return {
            rawText,
            normalizedText,
            sentences,
            tokens,
            posTokens,
            entities,
            verbs,
            nouns,
            adjectives,
            customEntities
        };
    } catch (error) {
        console.error("NLP parsing error:", error);
        throw new Error("Failed to parse prompt with local NLP.");
    }
}
