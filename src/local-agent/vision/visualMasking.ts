import { SensitiveDOMNode } from '../execution/perception';
import { getSessionVault, runPrivacyPipeline } from '../privacy/privacyPipeline';

export interface RedactionBox {
    x: number;
    y: number;
    width: number;
    height: number;
    type: string;
}

export async function computeRedactionBoxes(sensitiveNodes: SensitiveDOMNode[]): Promise<RedactionBox[]> {
    const boxes: RedactionBox[] = [];
    
    for (const node of sensitiveNodes) {
        if (!node.boundingBox || node.boundingBox.width === 0) continue;
        
        if (node.type === 'PASSWORD' || node.type === 'CREDIT_CARD' || node.type === 'EMAIL' || node.type === 'PHONE') {
            boxes.push({ ...node.boundingBox, type: node.type });
        } else if (node.type === 'TEXT' && node.text.length > 2) {
            // Run PII pipeline on this text snippet
            try {
                const { safeContext } = await runPrivacyPipeline({ 
                    originalText: node.text, 
                    intent: 'UNKNOWN', 
                    taskType: '', 
                    category: '', 
                    slots: {}, 
                    constraints: {}, 
                    systemConfidence: 0, 
                    requiresClarification: false 
                }, node.text);
                
                if (safeContext.privacy.piiDetected) {
                    // It has PII! Redact the bounding box.
                    // (For a precise UI we would measure text offsets, but for SIH masking the whole node is acceptable)
                    boxes.push({ ...node.boundingBox, type: 'PII_TEXT' });
                }
            } catch (e) {
                console.error(e)
            }
        }
    }
    return boxes;
}

export async function maskScreenshot(base64Image: string, boxes: RedactionBox[], scale: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject('No canvas context');

            // Draw original
            ctx.drawImage(img, 0, 0);

            // Draw redactions
            for (const box of boxes) {
                // The bounding box is in logical pixels, we need to scale to device pixels (screenshot resolution)
                const rx = box.x * scale;
                const ry = box.y * scale;
                const rw = box.width * scale;
                const rh = box.height * scale;

                if (box.type === 'PASSWORD' || box.type === 'CREDIT_CARD') {
                    ctx.fillStyle = 'black'; // Blackout
                } else {
                    // Mask (blur/grey)
                    ctx.fillStyle = 'rgba(128, 128, 128, 0.9)';
                }
                ctx.fillRect(rx, ry, rw, rh);
            }

            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = reject;
        img.src = base64Image;
    });
}
