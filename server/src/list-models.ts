import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../server/.env') });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function list() {
    const models = await groq.models.list();
    models.data.forEach(m => {
        if (m.id.toLowerCase().includes('vision') || m.id.toLowerCase().includes('llama') || m.id.toLowerCase().includes('qwen')) {
            console.log(m.id);
        }
    });
}

list().catch(console.error);
