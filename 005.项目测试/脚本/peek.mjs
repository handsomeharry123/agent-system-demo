import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
await page.goto('http://localhost:3001/app/login?role=admin', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.goto('http://localhost:3001/app/agent-center', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const html = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="submit-range"]');
  return el ? el.outerHTML.slice(0, 400) : 'NOT FOUND';
});
console.log('SUBMIT-RANGE:', html);
const found = await page.locator('[data-testid="submit-range"]').count();
console.log('FOUND COUNT:', found);
const placeholders = await page.locator('input[placeholder*="提交时间"]').count();
console.log('placeholder count:', placeholders);
await b.close();
