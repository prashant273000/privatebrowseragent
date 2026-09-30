import * as fs from 'fs';
let code = fs.readFileSync('src/local-agent/network/serverClient.ts', 'utf8');

const target = `    try {
        const response = await fetch(\`\${SERVER_URL}/agent/tool\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: serializedContext
        });

        if (!response.ok) {`;

const replacement = `    try {
        console.log('[Groq] Request started');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const response = await fetch(\`\${SERVER_URL}/agent/tool\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: serializedContext,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        console.log('[Groq] Request completed');

        if (!response.ok) {`;

code = code.replace(target, replacement);

const targetError = `    } catch (e: any) {
        console.error(\`[Client] Network error: \${e.message}\`);
        throw e;
    }`;

const replacementError = `    } catch (e: any) {
        if (e.name === 'AbortError') {
            console.error('[Groq] GROQ_TIMEOUT');
            throw new Error('GROQ_TIMEOUT');
        }
        console.error(\`[Client] Network error: \${e.message}\`);
        throw new Error('GROQ_REQUEST_FAILED: ' + e.message);
    }`;

code = code.replace(targetError, replacementError);
fs.writeFileSync('src/local-agent/network/serverClient.ts', code);
