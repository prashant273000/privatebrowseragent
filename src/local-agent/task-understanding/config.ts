export const INTENTS = [
    'SEARCH', 'OPEN', 'BOOK', 'BUY', 'ORDER', 'RESERVE', 'CANCEL', 
    'FIND', 'SEND', 'READ', 'FILL_FORM', 'DOWNLOAD', 'UPLOAD', 
    'COMPARE', 'NAVIGATE', 'CHECK', 'SUBMIT', 'CONFIRM', 'EDIT', 'DELETE'
];

export const TASK_CATEGORIES = [
    'TRAVEL', 'SHOPPING', 'ENTERTAINMENT', 'COMMUNICATION', 
    'PRODUCTIVITY', 'FOOD', 'FINANCE', 'GENERAL', 'OTHER'
];

export const ACTION_MAP: Record<string, string[]> = {
    'BOOK': ['SEARCH', 'SELECT', 'FILL', 'REVIEW', 'CONFIRM'],
    'BUY': ['SEARCH', 'SELECT', 'FILL', 'REVIEW', 'CONFIRM'],
    'ORDER': ['SEARCH', 'SELECT', 'FILL', 'REVIEW', 'CONFIRM'],
    'RESERVE': ['SEARCH', 'SELECT', 'FILL', 'REVIEW', 'CONFIRM'],
    'SEARCH': ['SEARCH', 'CHECK'],
    'FIND': ['SEARCH', 'CHECK'],
    'OPEN': ['OPEN'],
    'NAVIGATE': ['OPEN', 'NAVIGATE'],
    'CANCEL': ['FIND', 'SELECT', 'CONFIRM'],
    'SEND': ['FILL', 'REVIEW', 'CONFIRM'],
    'DOWNLOAD': ['SEARCH', 'SELECT', 'DOWNLOAD'],
    'UPLOAD': ['OPEN', 'SELECT', 'UPLOAD'],
    'READ': ['OPEN', 'SCROLL', 'READ']
};

export const CONFIDENCE_THRESHOLDS = {
    HIGH: 0.80,
    MEDIUM: 0.50
};
