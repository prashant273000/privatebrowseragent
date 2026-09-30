import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../server/.env') });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const model = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';

// Valid 10x10 PNG (red square)
const PNG_10x10_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FAAhKDveksOjmAAAAAElFTkSuQmCC";
const DATA_URL = `data:image/png;base64,${PNG_10x10_B64}`;

async function testVision() {
    try {
        const response = await groq.chat.completions.create({
            model: model,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "What color is the square in this image?" },
                        { type: "image_url", image_url: { url: DATA_URL } }
                    ]
                }
            ],
            max_tokens: 50
        });
        console.log('[SUCCESS]', response.choices[0]?.message?.content);
    } catch (e: any) {
        console.log(`[FAILED]`, e.status, JSON.stringify(e.error));
    }
}

testVision().catch(console.error);
