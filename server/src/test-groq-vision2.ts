import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../server/.env') });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const model = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';

const TINY_JPEG_B64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

async function testVision() {
    console.log(`Testing model: ${model}`);
    
    console.log('\n--- Test 3: Using base64 directly (no data URL prefix) ---');
    try {
        const response1 = await groq.chat.completions.create({
            model: model,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "What is in this image?" },
                        { type: "image_url", image_url: { url: TINY_JPEG_B64 } }
                    ]
                }
            ],
            max_tokens: 50
        });
        console.log('Test 3 SUCCESS!');
        console.log(response1.choices[0]?.message?.content);
    } catch (e: any) {
        console.log(`Test 3 FAILED: [${e.status}] ${e.message}`);
    }

    // According to OpenAI spec, image_url must be a URL. 
    // What if we try Llama 3.2 vision (11b)? Maybe it's not decommissioned?
    console.log('\n--- Test 4: Using llama-3.2-11b-vision-preview ---');
    try {
        const response2 = await groq.chat.completions.create({
            model: 'llama-3.2-11b-vision-preview',
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "What is in this image?" },
                        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${TINY_JPEG_B64}` } }
                    ]
                }
            ],
            max_tokens: 50
        });
        console.log('Test 4 SUCCESS!');
        console.log(response2.choices[0]?.message?.content);
    } catch (e: any) {
        console.log(`Test 4 FAILED: [${e.status}] ${e.message}`);
    }
}

testVision().catch(console.error);
