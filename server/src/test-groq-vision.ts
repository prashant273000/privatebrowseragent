import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../server/.env') });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const model = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';

// Minimal valid 1x1 JPEG base64
const TINY_JPEG_B64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
const DATA_URL = `data:image/jpeg;base64,${TINY_JPEG_B64}`;

async function testVision() {
    console.log(`Testing model: ${model}`);
    
    // Test 1: Full data URL
    console.log('\n--- Test 1: Using full data:image/jpeg;base64,... URL ---');
    try {
        const response1 = await groq.chat.completions.create({
            model: model,
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
        console.log('Test 1 SUCCESS!');
        console.log(response1.choices[0]?.message?.content);
    } catch (e: any) {
        console.log(`Test 1 FAILED: [${e.status}] ${e.message}`);
        console.log(JSON.stringify(e.error, null, 2));
    }

    // Test 2: Llama vision preview (to compare if qwen just doesn't support it)
    console.log('\n--- Test 2: Using llama-3.2-90b-vision-preview with full data URL ---');
    try {
        const response2 = await groq.chat.completions.create({
            model: 'llama-3.2-90b-vision-preview',
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
        console.log('Test 2 SUCCESS!');
        console.log(response2.choices[0]?.message?.content);
    } catch (e: any) {
        console.log(`Test 2 FAILED: [${e.status}] ${e.message}`);
        console.log(JSON.stringify(e.error, null, 2));
    }
}

testVision().catch(console.error);
