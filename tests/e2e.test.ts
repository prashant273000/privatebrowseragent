import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import * as path from 'path';
import { app } from '../server/src/index';
import * as http from 'http';

describe('End-to-End Integration Test with Real Chrome', () => {
    let browser: Browser;
    let page: Page;
    let extensionId: string;
    let server: http.Server;

    beforeAll(async () => {
        return new Promise(async (resolve, reject) => {
            try {
                // 1. Start backend server
                server = app.listen(3000, async () => {
                    // 2. Launch Puppeteer with extension loaded
                    const extensionPath = path.resolve(__dirname, '../dist');
                    
                    browser = await puppeteer.launch({
                        headless: "new",
                        args: [
                            `--disable-extensions-except=${extensionPath}`,
                            `--load-extension=${extensionPath}`
                        ]
                    });

                    // 3. Find extension background target to get ID
                    const dummyPage = await browser.newPage();
                    await dummyPage.goto('chrome://extensions/'); // Sometimes helps initialization
                    const targets = await browser.targets();
                    const extensionTarget = targets.find(t => t.type() === 'service_worker' || t.type() === 'background_page' || t.url().startsWith('chrome-extension://'));
                    
                    if (!extensionTarget) {
                        throw new Error('Extension target not found in Puppeteer.');
                    }
                    
                    const url = extensionTarget.url();
                    extensionId = url.split('/')[2];
                    
                    resolve(undefined);
                });
            } catch(e) {
                reject(e);
            }
        });
    }, 60000); // 60s timeout for boot

    afterAll(async () => {
        if (browser) await browser.close();
        return new Promise((resolve) => {
            server.close(() => resolve(undefined));
        });
    });

    it('Should execute task successfully through extension UI to active tab', async () => {
        // 1. Open our mock Google page
        const testPageUrl = `file://${path.resolve(__dirname, 'google-mock.html')}`;
        const activeTab = await browser.newPage();
        activeTab.on('console', msg => console.log('[ActiveTab]', msg.text()));
        await activeTab.goto(testPageUrl);

        // 2. Open side panel as a normal page
        const popupPage = await browser.newPage();
        popupPage.on('console', msg => console.log('[Popup]', msg.text()));
        await popupPage.goto(`chrome-extension://${extensionId}/extension/sidepanel.html`);

        // 3. Ensure popup loaded
        await popupPage.waitForSelector('#taskPrompt');
        
        // 4. Enter prompt
        await popupPage.type('#taskPrompt', 'Open Google and search for laptops under ₹50,000.');
        
        // Bring the active tab (google mock) to the front so it is the active tab
        await activeTab.bringToFront();
        
        // 5. Click Run Task in popup (even if it's in background)
        await popupPage.click('#analyzeBtn');
        
        // 6. Wait for success status
        await popupPage.waitForFunction(() => {
            const el = document.getElementById('currentStatus');
            return el && el.innerText.includes('Task successfully completed');
        }, { timeout: 45000 });
        
        const finalStatus = await popupPage.$eval('#currentStatus', el => el.innerText);
        expect(finalStatus).toContain('Task successfully completed');
        
        // 7. Verify the content script actually typed into the mock google page!
        const searchValue = await activeTab.$eval('#search-box', (el: HTMLInputElement) => el.value);
        expect(searchValue).toContain('laptops');
    }, 60000);
});
