import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => {
  if (m.type() === 'log') console.log('[browser]', m.text());
});

await page.goto('http://localhost:3001/app/ledger', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(5500);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(800);

const trendCard = page.locator('.ant-card:has-text("每月新增纳管智能体数量")').first();
const deptCard = page.locator('.ant-card:has-text("智能体科室分布情况")').first();

await trendCard.screenshot({ path: '/tmp/ledger_trend.png' });
await deptCard.screenshot({ path: '/tmp/ledger_dept_desc.png' });

await page.locator('label:has-text("从少到多")').first().click();
await page.waitForTimeout(800);
await deptCard.screenshot({ path: '/tmp/ledger_dept_asc.png' });

await page.locator('label:has-text("从多到少")').first().click();
await page.waitForTimeout(500);

await page.screenshot({ path: '/tmp/ledger_full.png', fullPage: true });
await browser.close();
console.log('done');
