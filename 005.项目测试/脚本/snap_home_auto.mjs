// Visual diff helper: snap two pages for /app/home/overview (embedded auto-tasks)
// and /app/home/auto-tasks, then write A_overview.png / B_embedded.png
import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
const page = await ctx.newPage();

// Step 1: enter the embedded auto-tasks view
await page.goto('http://localhost:3001/app/home/overview', { waitUntil: 'networkidle' });
await page.click('[data-testid="home-v1-side-workbench-auto"]');
await page.waitForSelector('[data-testid="home-v1-middle-auto-tasks"]', { timeout: 5000 });
await page.waitForTimeout(300);
await page.screenshot({ path: '/Users/harry/Desktop/CC_TEST/agent-system/assets/ref/CURRENT_embedded.png', fullPage: true });

// Step 2: directly navigate to /app/home/auto-tasks
await page.goto('http://localhost:3001/app/home/auto-tasks', { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.screenshot({ path: '/Users/harry/Desktop/CC_TEST/agent-system/assets/ref/CURRENT_standalone.png', fullPage: true });

await browser.close();
console.log('snap done');
