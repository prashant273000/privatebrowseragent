import { Step1Result } from '../nlp/schemas/promptSchema';

export function extractSlots(
    step1: Step1Result, 
    category: string, 
    intent: string, 
    taskType?: string
): Record<string, string | number | boolean | null> {
    const slots: Record<string, any> = {};
    const text = step1.rawText.toLowerCase();

    // 1. DATES / TIMES
    const dateEntity = step1.entities.find(e => e.type === 'DATE');
    if (dateEntity) slots['date'] = dateEntity.value;

    const timeEntity = step1.entities.find(e => e.type === 'TIME');
    if (timeEntity) slots['time'] = timeEntity.value;

    // TimePeriod fallback
    if (text.includes('morning')) slots['timePeriod'] = 'morning';
    if (text.includes('evening')) slots['timePeriod'] = 'evening';
    if (text.includes('night') || text.includes('tonight')) slots['timePeriod'] = 'night';

    // 2. Custom Entities from Step 1
    const websiteEntity = step1.customEntities.find(e => e.type === 'WEBSITE');
    if (websiteEntity) slots['website'] = websiteEntity.value;
    
    // Website fallback from "on X" or "from X" where X is a known domain
    const websiteMatch = text.match(/(?:from|on)\s+(amazon|flipkart|myntra|gmail|linkedin|bookmyshow|makemytrip)/i);
    if (websiteMatch && !slots['website']) {
        slots['website'] = websiteMatch[1].charAt(0).toUpperCase() + websiteMatch[1].slice(1);
    }

    // 3. CARDINALS -> quantity (Careful not to grab RAM or size)
    const cardinalEntity = step1.entities.find(e => e.type === 'CARDINAL');
    if (cardinalEntity) {
        const val = parseInt(cardinalEntity.value.replace(/\D/g, ''), 10);
        // Only assign to quantity if it's explicitly people/tickets or standalone, NOT size/RAM/storage
        if (!isNaN(val)) {
            const surrounding = text.substring(Math.max(0, text.indexOf(cardinalEntity.value) - 10), text.indexOf(cardinalEntity.value) + 15);
            if (!surrounding.match(/(size|gb|mb|tb|ram|ssd|hdd)/i)) {
                if (surrounding.match(/(people|person|ticket|item)/i) || Object.keys(slots).length === 0) {
                     slots['quantity'] = val;
                }
            }
        }
        
        // Handle explicit "two people", "for 2"
        if (text.includes(cardinalEntity.value + ' people') || text.includes(cardinalEntity.value + ' person')) {
             slots['quantity'] = isNaN(val) ? cardinalEntity.value : val;
        }
    }
    
    // Explicit quantity fallback
    if (!slots['quantity']) {
        if (text.match(/two\s+people/i) || text.match(/two\s+persons/i) || text.match(/2\s+people/i)) slots['quantity'] = 2;
        if (text.match(/one\s+person/i) || text.match(/1\s+person/i)) slots['quantity'] = 1;
        if (text.match(/four\s+people/i) || text.match(/4\s+people/i)) slots['quantity'] = 4;
        if (text.match(/two\s+(?:\w+\s+)?tickets/i) || text.match(/2\s+tickets/i)) slots['quantity'] = 2;
    }

    // 4. TASK-SPECIFIC EXTRACTION

    // COMMUNICATION
    if (category === 'COMMUNICATION' || taskType === 'SEND_EMAIL' || taskType === 'SEND_MESSAGE' || taskType === 'READ_EMAIL') {
        
        if (taskType === 'READ_EMAIL' || intent === 'SEARCH' || intent === 'READ' || intent === 'FIND') {
            // Find sender
            const fromMatch = step1.rawText.match(/from\s+([A-Z][a-zA-Z]+)/i);
            if (fromMatch) slots['sender'] = fromMatch[1];
            
            if (text.includes('unread')) slots['status'] = 'unread';
            if (text.includes('attachment')) slots['attachment'] = true;
            
            // "emails about meeting" -> query
            const aboutMatch = step1.rawText.match(/about\s+([a-zA-Z0-9\s]+?)(?=\s+from|\s+with|\s*$)/i);
            if (aboutMatch) slots['query'] = aboutMatch[1];
        } else {
            // SENDing
            let recipient = null;
            const sendSomeoneMatch = step1.rawText.match(/(?:send|email|message|write to)\s+([A-Z][a-zA-Z]+)(?=\s+(?:an\s+email|a\s+message|saying|that|with|:))/i);
            if (sendSomeoneMatch) recipient = sendSomeoneMatch[1];
            
            if (!recipient) {
                 const toMatch = step1.rawText.match(/to\s+([A-Z][a-zA-Z]+)(?=\s|$|\.|,|\s+(?:saying|that|with|:))/i);
                 if (toMatch) recipient = toMatch[1];
            }
            
            if (!recipient) {
                 const emailSomeoneMatch = step1.rawText.match(/email\s+([A-Z][a-zA-Z]+)(?=\s|$|\.|,|\s+(?:saying|that|with|:))/i);
                 if (emailSomeoneMatch) recipient = emailSomeoneMatch[1];
            }
    
            if (recipient) slots['recipient'] = recipient;
            
            // Subject extraction
            const subjectMatch = step1.rawText.match(/(?:with|having)\s+subject\s+(?:of\s+)?([a-zA-Z0-9\s]+?)(?=\s+and|\s+say|\s+that|\s+with|\s*$)/i);
            if (subjectMatch) slots['subject'] = subjectMatch[1].trim();
    
            // Body extraction 
            // Avoid workflow execution instructions leaking into the body!
            const bodyMatch = step1.rawText.match(/(?:saying|and say|with the message|that|:|message|say)\s+(.*)$/i);
            if (bodyMatch) {
                let rawBody = bodyMatch[1].trim();
                // Strip workflow instructions like ", but don't", ", then", " and then"
                const splitIndex = rawBody.search(/(?:,|\b)(?:but don't|but do not|then|and then)\b/i);
                if (splitIndex !== -1) {
                    rawBody = rawBody.substring(0, splitIndex).trim();
                }
                rawBody = rawBody.replace(/,\s*$/, '').replace(/^["']|["']$/g, '').trim();
                slots['body'] = rawBody;
            }
        }
    }

    // TRAVEL (origin/destination only for travel semantics)
    if (category === 'TRAVEL' || taskType?.includes('FLIGHT') || taskType?.includes('TRAIN') || taskType?.includes('TRAVEL')) {
        const originMatch = step1.rawText.match(/from\s+([A-Z][a-zA-Z]+)/);
        if (originMatch && originMatch[1]) slots['origin'] = originMatch[1];

        const destMatch = step1.rawText.match(/to\s+([A-Z][a-zA-Z]+)/);
        if (destMatch && destMatch[1]) slots['destination'] = destMatch[1];
    }
    
    // ENTERTAINMENT
    if (category === 'ENTERTAINMENT' || taskType === 'BOOK_MOVIE' || taskType === 'SEARCH_MOVIE') {
        const movieMatch = step1.rawText.match(/(?:for|watch|tickets for|ticket for)\s+([A-Z][a-zA-Z\s]+?)(?=\s+on|\s+tomorrow|\s+tonight|\s+at|$)/);
        if (movieMatch && !slots['origin']) { 
            const possibleMovie = movieMatch[1].trim();
            if (possibleMovie.length > 2 && !['A', 'The'].includes(possibleMovie)) {
                slots['movie'] = possibleMovie;
            }
        }
    }
    
    // SHOPPING
    if (category === 'SHOPPING' || taskType === 'BUY_PRODUCT' || taskType === 'SEARCH_PRODUCT' || text.includes('buy') || text.includes('cheapest') || text.includes('order')) {
        let productMatch = step1.rawText.match(/(?:buy|find|search for|order|get|show)\s+(?:me\s+a\s+|me\s+|a\s+|an\s+|the\s+)?([a-zA-Z0-9\s]+?)(?=\s+from|\s+under|\s+on|\s+in|\s+with|\s*$)/i);
        if (productMatch && productMatch[1].trim().length > 0) {
            let prod = productMatch[1].trim();
            
            // Strip syntactic filler
            const fillers = ['me a ', 'me ', 'a ', 'an ', 'the ', 'please find ', 'find me ', 'show me '];
            for (const f of fillers) {
                if (prod.toLowerCase().startsWith(f.toLowerCase())) {
                    prod = prod.substring(f.length);
                }
            }
            slots['product'] = prod;
        }
    }

    return slots;
}

export function extractConstraints(step1: Step1Result, slots: Record<string, any>): Record<string, any> {
    const constraints: Record<string, any> = {};
    const text = step1.rawText.toLowerCase();

    // 1. Budgets and Prices
    const underMatch = text.match(/under\s+(?:₹|rs\.?|rs|rupees|inr)?\s*(\d+)/i);
    if (underMatch) constraints['budgetMax'] = underMatch[1];
    
    const maxMatch = text.match(/max(?:imum)?\s*(?:price)?\s*(?:₹|rs\.?|rs|rupees|inr)?\s*(\d+)/i);
    if (maxMatch && !constraints['budgetMax']) constraints['budgetMax'] = maxMatch[1];

    const betweenMatch = text.match(/between\s+(?:₹|rs\.?|rs|rupees|inr)?\s*(\d+)\s+and\s+(?:₹|rs\.?|rs|rupees|inr)?\s*(\d+)/i);
    if (betweenMatch) {
        constraints['priceMin'] = betweenMatch[1];
        constraints['priceMax'] = betweenMatch[2];
    }

    // 2. Hardware specs
    const ramMatch = text.match(/(\d+)\s*gb\s*ram/i);
    if (ramMatch) constraints['ram'] = `${ramMatch[1]}GB`;

    const storageMatches = Array.from(text.matchAll(/(\d+)\s*(gb|tb)\s*(ssd|hdd)?/gi));
    for (const m of storageMatches) {
        if (m.index !== undefined && !text.substring(m.index, m.index + m[0].length + 5).match(/ram/i)) {
            constraints['storage'] = `${m[1]}${m[2].toUpperCase()}`;
            if (m[3]) constraints['storageType'] = m[3].toUpperCase();
        }
    }
    
    const sizeMatch = text.match(/size\s*(\d+)/i);
    if (sizeMatch) constraints['size'] = sizeMatch[1];

    // 3. Colors / Brands (very basic extraction)
    if (text.match(/\b(black|white|red|blue|green|silver|grey|gray)\b/i)) {
        constraints['color'] = text.match(/\b(black|white|red|blue|green|silver|grey|gray)\b/i)![1].toLowerCase();
    }

    // 4. Features
    if (text.includes('noise cancellation') || text.includes('noise cancelling')) constraints['noiseCancellation'] = true;
    if (text.includes('good camera') || text.includes('camera quality')) constraints['cameraQuality'] = 'good';
    if (text.includes('breakfast included') || text.includes('with breakfast')) constraints['breakfastIncluded'] = true;

    // 5. Sort preferences
    if (text.includes('cheapest')) constraints['sortPreference'] = 'cheapest';
    if (text.includes('fastest')) constraints['sortPreference'] = 'fastest';
    if (text.includes('best') || text.includes('top rated')) constraints['sortPreference'] = 'best';

    return constraints;
}
