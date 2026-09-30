import winkNLP from 'wink-nlp';
import model from 'wink-eng-lite-web-model';

// Initialize winkNLP once and reuse the instance
export const nlp = winkNLP(model);
export const its = nlp.its;
export const as = nlp.as;

// Define custom entities specific to our browser agent domain
const customEntities = [
    { name: 'WEBSITE', patterns: ['BookMyShow', 'MakeMyTrip', 'Amazon', 'Flipkart', 'Gmail', 'LinkedIn'] },
    { name: 'ACTION_WORD', patterns: ['book', 'buy', 'reserve', 'search', 'find', 'open', 'cancel', 'order', 'navigate'] }
];

nlp.learnCustomEntities(customEntities, {
    usePOS: false
});
