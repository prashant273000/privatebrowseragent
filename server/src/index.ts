import express from 'express';
import cors from 'cors';
import { GroqReasoningModel, MockReasoningModel, GroqError } from './reasoning';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.use(cors());
// Increased to 50mb to handle screenshots sent locally from the extension
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../../')));

const provider = process.env.REASONING_PROVIDER || 'mock';
console.log('[Server] REASONING_PROVIDER=' + provider);

const reasoningModel = provider === 'groq' ? new GroqReasoningModel() : new MockReasoningModel();

// Pre-send payload size limit (200 KB in JSON chars)
const MAX_PAYLOAD_CHARS = 200_000;

app.post('/agent/tool', async (req, res) => {
    try {
        const context = req.body;
        console.log('[Server] Request received. Checking privacy flag...');
        console.log('[Server] Privacy state:', context.safeContext?.privacy);

        if (!context.safeContext || !context.safeContext.privacy || !context.safeContext.privacy.sanitized) {
            return res.status(403).json({ error: 'Context not sanitized' });
        }

        // Pre-send payload size guard — reject before even calling Groq
        const rawSize = JSON.stringify(context).length;
        console.log(`[Server] Payload size (chars): ${rawSize}`);
        if (rawSize > MAX_PAYLOAD_CHARS) {
            console.warn(`[Server] Payload too large (${rawSize} chars > ${MAX_PAYLOAD_CHARS} limit). Returning GROQ_CONTEXT_TOO_LARGE.`);
            return res.status(413).json({ error: 'GROQ_CONTEXT_TOO_LARGE: Context payload exceeds 200KB limit. Reduce page elements or history.' });
        }

        const stepCount = (context.history || []).length;
        console.log('[Server] Received tool request. step=' + stepCount);

        const toolCall = await reasoningModel.decideNextTool(context);
        res.json(toolCall);

    } catch (e: any) {
        if (e instanceof GroqError) {
            // Structured Groq error — log safely server-side and return proper HTTP status
            console.error(`[Server] Groq error: code=${e.code} httpStatus=${e.httpStatus} message=${e.message}`);
            return res.status(e.httpStatus).json({ error: e.code + ': ' + e.message, code: e.code });
        }

        // Unexpected server error
        console.error('[Server] Unexpected error generating tool call:', e);
        res.status(500).json({ error: e.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log('Server listening on port ' + PORT);
});
