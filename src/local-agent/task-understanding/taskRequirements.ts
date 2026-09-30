export const TASK_REQUIREMENTS: Record<string, { required: string[], optional: string[] }> = {
    'BOOK_FLIGHT': { required: ['origin', 'destination'], optional: ['date', 'timePeriod', 'quantity'] },
    'SEARCH_FLIGHT': { required: [], optional: ['origin', 'destination', 'date', 'timePeriod', 'quantity'] },
    'BOOK_TRAIN': { required: ['origin', 'destination'], optional: ['date', 'timePeriod', 'quantity'] },
    'SEARCH_TRAIN': { required: [], optional: ['origin', 'destination', 'date'] },
    'BOOK_TRAVEL': { required: ['origin', 'destination'], optional: ['date'] },
    'BOOK_RESTAURANT': { required: ['quantity', 'date', 'time'], optional: ['location'] },
    'SEARCH_RESTAURANT': { required: [], optional: ['location'] },
    'BOOK_MOVIE': { required: ['movie'], optional: ['date', 'time', 'quantity', 'website'] },
    'SEARCH_MOVIE': { required: ['movie'], optional: ['date', 'time', 'quantity', 'website'] },
    'BUY_PRODUCT': { required: ['product'], optional: ['budget', 'website'] },
    'SEARCH_PRODUCT': { required: ['product'], optional: ['budget', 'website'] },
    'SEND_EMAIL': { required: ['recipient', 'body'], optional: ['subject'] },
    'READ_EMAIL': { required: [], optional: ['sender', 'query', 'status'] },
    'SEND_MESSAGE': { required: ['recipient', 'body'], optional: [] }
};

export function checkCompleteness(taskKey: string, slots: Record<string, any>) {
    // Check if there is a match in our specific TASK_REQUIREMENTS
    const requirements = TASK_REQUIREMENTS[taskKey];
    
    if (!requirements) {
        return { needsClarification: false, missingSlots: [] };
    }

    const missingSlots = requirements.required.filter(slot => !slots[slot]);
    
    let clarificationQuestion = undefined;
    if (missingSlots.length > 0) {
        if (missingSlots.includes('recipient') && missingSlots.includes('body')) clarificationQuestion = "Who do you want to send this to, and what's the message?";
        else if (missingSlots.includes('recipient')) clarificationQuestion = "Who should I send this to?";
        else if (missingSlots.includes('body')) clarificationQuestion = "What should the message say?";
        else if (missingSlots.includes('origin')) clarificationQuestion = "What city are you travelling from?";
        else if (missingSlots.includes('destination')) clarificationQuestion = "Where are you travelling to?";
        else if (missingSlots.includes('movie')) clarificationQuestion = "Which movie do you want to book?";
        else if (missingSlots.includes('product')) clarificationQuestion = "What exactly do you want to buy?";
        else clarificationQuestion = `Please provide the following missing info: ${missingSlots.join(', ')}.`;
    }

    return {
        needsClarification: missingSlots.length > 0,
        missingSlots,
        clarificationQuestion
    };
}
