import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false; 
env.useBrowserCache = typeof window !== 'undefined';

let detectorPipeline: any = null;
let isInitializing = false;
const VISION_TIMEOUT_MS = 15000;

export async function initVisionModel() {
    if (detectorPipeline) return;
    if (isInitializing) {
        let waitTime = 0;
        while(isInitializing && waitTime < VISION_TIMEOUT_MS) {
            await new Promise(r => setTimeout(r, 100));
            waitTime += 100;
        }
        return;
    }
    isInitializing = true;
    try {
        console.log('[Vision] Loading Xenova/yolos-tiny...');
        const loadPromise = pipeline('object-detection', 'Xenova/yolos-tiny');
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Model load timeout')), VISION_TIMEOUT_MS));
        
        detectorPipeline = await Promise.race([loadPromise, timeoutPromise]);
        console.log('[Vision] Model loaded.');
    } catch (e: any) {
        console.error('[Vision] Failed to load model:', e.message);
    } finally {
        isInitializing = false;
    }
}

export async function detectObjects(imageUri: string): Promise<any[]> {
    if (process.env.VISION_DISABLED === 'true') {
        console.log('[Vision] VISION_DISABLED=true, skipping inference.');
        return [];
    }

    if (!detectorPipeline) await initVisionModel();
    if (!detectorPipeline) {
        console.log('[Vision] detectorPipeline is null, skipping inference.');
        return [];
    }

    try {
        const start = performance.now();
        console.log('[Vision] Inference started');
        const inferPromise = detectorPipeline(imageUri, { threshold: 0.1 });
        const timeoutPromise = new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('VISION_TIMEOUT')), VISION_TIMEOUT_MS));
        
        const output = await Promise.race([inferPromise, timeoutPromise]);
        console.log(`[Vision] Inference completed: ${performance.now() - start} ms. Detection count=${output.length}`);
        return output;
    } catch (e: any) {
        console.error('[Vision] Inference error:', e.message);
        throw new Error('VISION_TIMEOUT: ' + e.message);
    }
}
