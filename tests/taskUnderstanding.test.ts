import { describe, expect, test } from 'vitest';
import { parsePrompt } from '../src/local-agent/nlp/promptParser';
import { processTaskUnderstanding } from '../src/local-agent/task-understanding/taskUnderstanding';

async function runTest(promptText: string) {
    const step1 = parsePrompt(promptText);
    const result = await processTaskUnderstanding(step1);
    return result.tasks[0]; // Get the first parsed task
}

describe('Step 2: Local Task Understanding', () => {

    test('1. Book two movie tickets for Interstellar tomorrow evening after 7 PM.', async () => {
        const r = await runTest("Book two movie tickets for Interstellar tomorrow evening after 7 PM.");
        expect(r.intent).toBe('BOOK');
        expect(r.taskType).toBe('BOOK_MOVIE');
        expect(r.slots.movie).toMatch(/Interstellar/i);
        expect(r.slots.quantity).toBe(2);
        // Expect no massive label override like play_radio/OPEN
        expect(r.intent).not.toBe('OPEN');
    }, 60000);

    test('2. Search for wireless headphones under ₹3000 with noise cancellation.', async () => {
        const r = await runTest("Search for wireless headphones under ₹3000 with noise cancellation.");
        expect(r.intent).toBe('SEARCH');
        expect(r.taskType).toBe('SEARCH_PRODUCT');
        expect(r.slots.product).toMatch(/wireless headphones/i);
        expect(r.constraints.budgetMax).toBe('3000');
        expect(r.constraints.noiseCancellation).toBe(true);
    }, 60000);

    test('3. Navigate to LinkedIn.', async () => {
        const r = await runTest("Navigate to LinkedIn.");
        expect(r.intent).toBe('OPEN'); // NAVIGATE maps to OPEN
        expect(r.taskType).toBe('NAVIGATE_WEBSITE');
        expect(r.slots.website).toMatch(/LinkedIn/i);
    }, 60000);

    test('4. Buy Nike running shoes from Amazon in black, size 9, under ₹5000.', async () => {
        const r = await runTest("Buy Nike running shoes from Amazon in black, size 9, under ₹5000.");
        expect(r.intent).toBe('BUY');
        expect(r.taskType).toBe('BUY_PRODUCT');
        expect(r.slots.product).toMatch(/Nike running shoes/i);
        expect(r.slots.website).toMatch(/Amazon/i);
        expect(r.slots.origin).toBeUndefined(); // Website vs Origin
        expect(r.constraints.color).toBe('black');
        expect(r.constraints.size).toBe('9');
        expect(r.constraints.budgetMax).toBe('5000');
    }, 60000);

    test('5. Find me a laptop on Amazon under ₹70000 with at least 16GB RAM and 512GB SSD.', async () => {
        const r = await runTest("Find me a laptop on Amazon under ₹70000 with at least 16GB RAM and 512GB SSD.");
        expect(r.intent).toBe('SEARCH');
        expect(r.taskType).toBe('SEARCH_PRODUCT');
        expect(r.slots.product).toMatch(/^laptop$/i); // Strip syntactic filler
        expect(r.slots.website).toMatch(/Amazon/i);
        expect(r.constraints.budgetMax).toBe('70000');
        expect(r.constraints.ram).toBe('16GB');
        expect(r.constraints.storage).toBe('512GB');
        expect(r.constraints.storageType).toBe('SSD');
    }, 60000);

    test('6. Do not cancel my flight reservation.', async () => {
        const r = await runTest("Do not cancel my flight reservation.");
        expect(r.intent).toBe('CANCEL');
        expect(r.negated).toBe(true);
        // OR executionPolicy = PROHIBITED depending on how I coded it
        expect(r.negatedIntent).toBe('CANCEL');
    }, 60000);

    test('7. I want to search for flights from Mumbai to Bangalore, not book one.', async () => {
        const r = await runTest("I want to search for flights from Mumbai to Bangalore, not book one.");
        expect(r.intent).toBe('SEARCH');
        expect(r.taskType).toBe('SEARCH_FLIGHT');
        expect(r.slots.origin).toBe('Mumbai');
        expect(r.slots.destination).toBe('Bangalore');
        expect(r.negatedIntent).toBe('BOOK');
    }, 60000);

    test('8. Don\'t buy the laptop yet; just compare the available options.', async () => {
        const step1 = parsePrompt("Don't buy the laptop yet; just compare the available options.");
        const result = await processTaskUnderstanding(step1);
        
        expect(result.isMultiTask).toBe(true);
        const tasks = result.tasks;
        expect(tasks[0].negatedIntent).toBe('BUY');
        expect(tasks[1].intent).toBe('COMPARE');
    }, 60000);

    test('9. Send Ananya an email saying the meeting has been postponed, but don\'t send it yet.', async () => {
        const step1 = parsePrompt("Send Ananya an email saying the meeting has been postponed, but don't send it yet.");
        const result = await processTaskUnderstanding(step1);
        
        expect(result.isMultiTask).toBe(false);
        const r = result.tasks[0];
        expect(r.intent).toBe('SEND');
        expect(r.taskType).toBe('SEND_EMAIL');
        expect(r.slots.recipient).toBe('Ananya');
        expect(r.slots.body).toBe('the meeting has been postponed');
        expect(r.executionPolicy).toBe('DRAFT_ONLY');
    }, 60000);

    test('10. Find unread emails from Rahul.', async () => {
        const r = await runTest("Find unread emails from Rahul.");
        expect(r.intent).toBe('SEARCH');
        expect(r.taskType).toBe('READ_EMAIL');
        expect(r.slots.sender).toBe('Rahul'); // Sender not recipient
        expect(r.slots.status).toBe('unread');
    }, 60000);

    test('11. Find something cheap.', async () => {
        const r = await runTest("Find something cheap.");
        expect(r.intent).toBe('SEARCH');
        expect(r.needsClarification).toBe(true);
        expect(r.missingSlots).toContain('object');
    }, 60000);

    test('12. Book it.', async () => {
        const r = await runTest("Book it.");
        expect(r.intent).toBe('BOOK');
        expect(r.needsClarification).toBe(true);
        expect(r.missingSlots).toContain('object');
    }, 60000);

    test('13. Upload my resume and then submit the application.', async () => {
        const step1 = parsePrompt("Upload my resume and then submit the application.");
        const result = await processTaskUnderstanding(step1);
        
        expect(result.isMultiTask).toBe(true);
        expect(result.tasks.length).toBe(2);
        expect(result.tasks[0].intent).toBe('UPLOAD');
        expect(result.tasks[1].intent).toBe('SUBMIT');
    }, 60000);

    test('14. Open Gmail, read the latest email from Rahul, and download its attachment.', async () => {
        const step1 = parsePrompt("Open Gmail, read the latest email from Rahul, and download its attachment.");
        const result = await processTaskUnderstanding(step1);
        
        expect(result.isMultiTask).toBe(true);
        expect(result.tasks.length).toBe(3);
        expect(result.tasks[0].intent).toBe('OPEN');
        expect(result.tasks[1].intent).toBe('SEARCH'); // read mapped to SEARCH for email
        expect(result.tasks[2].intent).toBe('DOWNLOAD');
    }, 60000);

});
