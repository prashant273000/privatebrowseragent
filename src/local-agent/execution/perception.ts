export interface SemanticItem {
    elementRef: string;
    type: string;
    title?: string;
    price?: string;
    rating?: string;
    specifications?: string[];
    actions?: Array<{ elementRef: string, type: string, label: string }>;
    text?: string;
    ariaLabel?: string;
    placeholder?: string;
    role?: string;
    name?: string;
    id?: string;
    isVisible: boolean;
    isDisabled: boolean;
    isSensitive: boolean;
    boundingBox?: { x: number, y: number, width: number, height: number };
}

let elementCache: Map<string, HTMLElement> = new Map();

export function getCachedElement(elementRef: string): HTMLElement | null {
    return elementCache.get(elementRef) || null;
}

function checkIsVisible(el: HTMLElement): boolean {
    let curr: HTMLElement | null = el;
    while (curr) {
        if (curr.style && (curr.style.display === 'none' || curr.style.visibility === 'hidden')) {
            return false;
        }
        curr = curr.parentElement;
    }
    return true;
}

function extractCardData(card: HTMLElement, counterRef: { count: number }): Partial<SemanticItem> {
    const text = card.textContent || '';
    
    let title = '';
    const heading = card.querySelector('h1, h2, h3, h4, h5, h6, strong');
    if (heading) {
        title = heading.textContent?.trim() || '';
    } else {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length > 0) title = lines[0];
    }

    let price = undefined;
    const priceMatch = text.match(/[$₹€£]\s?\d+(?:,\d+)*(?:\.\d+)?/);
    if (priceMatch) price = priceMatch[0];

    let rating = undefined;
    const ratingMatch = text.match(/\d(?:\.\d)?\s*(?:out of 5|rating|stars|\/5)/i) || text.match(/\b[1-5]\.\d\b/);
    if (ratingMatch) rating = ratingMatch[0];

    let specifications: string[] = [];
    const specRegex = /\b\d+\s*(?:GB|TB|MB|RAM|SSD|HDD|Hz|GHz|Core)\b/gi;
    let match;
    while ((match = specRegex.exec(text)) !== null) {
        specifications.push(match[0]);
    }

    const actions: any[] = [];
    const interactive = card.querySelectorAll('button, a, input, [role="button"], [role="link"]');
    interactive.forEach((el) => {
        const htmlEl = el as HTMLElement;
        const isVisible = checkIsVisible(htmlEl);
        
        let typeStr = htmlEl.tagName.toLowerCase();
        if (typeStr === 'input') {
            typeStr = (htmlEl as HTMLInputElement).type || 'text';
        }
        if (!isVisible || typeStr === 'hidden' || typeStr === 'password') return;

        const ref = `el_${counterRef.count++}`;
        elementCache.set(ref, htmlEl);
        
        let label = (htmlEl.innerText || htmlEl.textContent || '').trim();
        if (htmlEl.tagName.toLowerCase() === 'input') {
            label = (htmlEl as HTMLInputElement).placeholder || (htmlEl as HTMLInputElement).value || '';
        }

        actions.push({
            elementRef: ref,
            type: htmlEl.tagName.toLowerCase(),
            label: label.slice(0, 50)
        });
    });

    return { 
        title: title.slice(0, 100), 
        price, 
        rating, 
        specifications: specifications.length ? specifications : undefined, 
        actions: actions.length ? actions : undefined,
        text: text.replace(/\s+/g, ' ').trim().slice(0, 150)
    };
}

function isCard(el: HTMLElement): boolean {
    const tag = el.tagName.toLowerCase();
    if (['article', 'li', 'tr'].includes(tag)) return true;
    if (tag === 'div' && el.parentElement && el.parentElement.children.length > 1) {
        const siblings = Array.from(el.parentElement.children);
        const sameTagClass = siblings.filter(s => s.tagName === el.tagName && s.className === el.className);
        if (sameTagClass.length > 1) {
            if (el.querySelector('button, a, input, h1, h2, h3, h4, h5, h6')) {
                return true;
            }
        }
    }
    return false;
}

function getBoundingBox(el: HTMLElement) {
    if (typeof el.getBoundingClientRect !== 'function') return undefined;
    const rect = el.getBoundingClientRect();
    // Normalize to devicePixelRatio if necessary, but chrome.tabs.captureVisibleTab 
    // usually matches physical pixels. We will send logical pixels and scale on the canvas.
    return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
    };
}

// We need to return ALL text nodes and sensitive inputs for redaction mapping
export interface SensitiveDOMNode {
    type: 'PASSWORD' | 'CREDIT_CARD' | 'TEXT' | 'EMAIL' | 'PHONE';
    text: string;
    boundingBox: { x: number, y: number, width: number, height: number };
}

export function observePage(doc: Document = document): { items: SemanticItem[], sensitiveNodes: SensitiveDOMNode[], viewport: { width: number, height: number } } {
    const items: SemanticItem[] = [];
    const sensitiveNodes: SensitiveDOMNode[] = [];
    elementCache.clear();
    
    let counterRef = { count: 1 };
    const cards = new Set<HTMLElement>();

    // Scan for Sensitive Inputs (Password, CC)
    const inputs = doc.querySelectorAll('input');
    inputs.forEach(input => {
        const type = input.type.toLowerCase();
        const auto = (input.autocomplete || '').toLowerCase();
        
        const box = getBoundingBox(input);
        if (!box) return;

        if (type === 'password') {
            sensitiveNodes.push({ type: 'PASSWORD', text: '', boundingBox: box });
        } else if (auto.includes('cc-number') || auto.includes('cc-csc')) {
            sensitiveNodes.push({ type: 'CREDIT_CARD', text: '', boundingBox: box });
        } else if (type === 'email' || auto.includes('email')) {
            sensitiveNodes.push({ type: 'EMAIL', text: input.value, boundingBox: box });
        } else if (type === 'tel' || auto.includes('phone')) {
            sensitiveNodes.push({ type: 'PHONE', text: input.value, boundingBox: box });
        }
    });

    // Scan for ALL text nodes for PII matching
    const treeWalker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
            if (node.parentElement && !checkIsVisible(node.parentElement)) return NodeFilter.FILTER_REJECT;
            if (node.textContent && node.textContent.trim().length > 2) return NodeFilter.FILTER_ACCEPT;
            return NodeFilter.FILTER_SKIP;
        }
    });

    let textNode = treeWalker.nextNode();
    while (textNode) {
        const range = doc.createRange();
        range.selectNodeContents(textNode);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            sensitiveNodes.push({
                type: 'TEXT',
                text: textNode.textContent!.trim(),
                boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
            });
        }
        textNode = treeWalker.nextNode();
    }

    // 1. Find Cards
    const allContainers = doc.querySelectorAll('article, li, tr, div');
    allContainers.forEach((el) => {
        const htmlEl = el as HTMLElement;
        if (!checkIsVisible(htmlEl)) return;

        if (isCard(htmlEl)) {
            let parent = htmlEl.parentElement;
            let inCard = false;
            while (parent && parent !== doc.body) {
                if (cards.has(parent)) {
                    inCard = true;
                    break;
                }
                parent = parent.parentElement;
            }
            if (!inCard) {
                cards.add(htmlEl);
            }
        }
    });

    cards.forEach((card) => {
        const ref = `el_${counterRef.count++}`;
        elementCache.set(ref, card);
        const data = extractCardData(card, counterRef);
        items.push({
            elementRef: ref,
            type: 'group',
            isVisible: true,
            isDisabled: false,
            isSensitive: false,
            boundingBox: getBoundingBox(card),
            ...data
        });
    });

    // 2. Find Interactive elements not in a card
    const interactiveElements = doc.querySelectorAll('button, a, input, textarea, select, [role="button"], [role="link"], [role="textbox"], [role="checkbox"]');
    interactiveElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        
        let parent = htmlEl.parentElement;
        let inCard = false;
        while (parent && parent !== doc.body) {
            if (cards.has(parent)) {
                inCard = true;
                break;
            }
            parent = parent.parentElement;
        }
        
        if (!inCard) {
            const isVisible = checkIsVisible(htmlEl);
            const rawType = htmlEl.tagName.toLowerCase();
            let semanticType = rawType;
            if (rawType === 'input') {
                semanticType = (htmlEl as HTMLInputElement).type || 'text';
            }
            
            if (!isVisible || semanticType === 'hidden' || semanticType === 'password') return;

            const ref = `el_${counterRef.count++}`;
            elementCache.set(ref, htmlEl);
            
            let isSensitive = false;
            let placeholder = '';

            if (rawType === 'input') {
                const inputEl = htmlEl as HTMLInputElement;
                placeholder = inputEl.placeholder || '';
                const autocomplete = inputEl.autocomplete || '';
                if (['username', 'email', 'cc-number', 'cc-csc'].includes(autocomplete)) {
                    isSensitive = true;
                }
            } else if (rawType === 'textarea') {
                placeholder = (htmlEl as HTMLTextAreaElement).placeholder || '';
            }

            items.push({
                elementRef: ref,
                type: semanticType,
                text: (htmlEl.innerText || htmlEl.textContent || '').trim().slice(0, 100),
                placeholder: placeholder,
                ariaLabel: htmlEl.getAttribute('aria-label') || '',
                role: htmlEl.getAttribute('role') || '',
                name: htmlEl.getAttribute('name') || '',
                id: htmlEl.id,
                isVisible: isVisible,
                isDisabled: (htmlEl as any).disabled === true || htmlEl.getAttribute('aria-disabled') === 'true',
                isSensitive: isSensitive,
                boundingBox: getBoundingBox(htmlEl)
            });
        }
    });

    const viewport = {
        width: doc.documentElement.clientWidth || doc.body.clientWidth || typeof window !== 'undefined' ? window.innerWidth : 1000,
        height: doc.documentElement.clientHeight || doc.body.clientHeight || typeof window !== 'undefined' ? window.innerHeight : 1000
    };

    return { items, sensitiveNodes, viewport };
}
