import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../server/.env') });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const TINY_JPEG_B64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
const DATA_URL = `data:image/jpeg;base64,${TINY_JPEG_B64}`;

async function test(modelName: string) {
    try {
        const response = await groq.chat.completions.create({
            model: modelName,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "What is in this image?" },
                        { type: "image_url", image_url: { url: DATA_URL } }
                    ]
                }
            ],
            max_tokens: 50
        });
        console.log(`[SUCCESS] ${modelName}:`, response.choices[0]?.message?.content);
    } catch (e: any) {
        console.log(`[FAILED] ${modelName}:`, e.message);
    }
}

async function main() {
    const modelsToTest = [
        'llama-3.2-11b-vision-instruct',
        'llama-3.2-90b-vision-instruct',
        'llama3-vision-8b',
        'llama-3.2-11b-vision',
        'qwen-2.5-vl-72b',
        'qwen-vl'
    ];
    for (const m of modelsToTest) {
        await test(m);
    }
}

main().catch(console.error);
