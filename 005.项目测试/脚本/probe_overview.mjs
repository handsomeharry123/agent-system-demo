import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto('http://localhost:5173/app/ledger', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/probe_overview.png' });
const hasErr = await page.evaluate(() => {
  return document.body.textContent.includes('Something went wrong');
});
console.log('Something went wrong?', hasErr);
const oGen = await page.$('button:has-text("生成报告")');
const oSub = await page.$('button:has-text("订阅速读")');
console.log('生成报告 btn:', !!oGen, ' 订阅速读 btn:', !!oSub);
await browser.close();
