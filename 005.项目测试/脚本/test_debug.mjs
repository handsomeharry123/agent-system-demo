import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1200 } });
await page.goto('http://localhost:3001/app/monitoring/alert-events/evt-v18-004/handle', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
// Check if "返回" exists anywhere on the page
const has = await page.evaluate(() => document.body.innerText.includes('返回'));
console.log('body.innerText has 返回:', has);
const allText = await page.evaluate(() => document.body.innerText.length);
console.log('body.innerText length:', allText);
const matches = await page.evaluate(() => {
  const m = document.body.innerText.match(/返回/g);
  return m ? m.length : 0;
});
console.log('returns match count:', matches);
// dump first 600 chars and last 600 chars
const t = await page.evaluate(() => document.body.innerText);
console.log('FIRST 300:', t.slice(0, 300));
console.log('LAST 600:', t.slice(-600));
await browser.close();