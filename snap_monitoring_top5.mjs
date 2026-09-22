import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto('http://localhost:3001/app/monitoring', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(800);

// 截 TOP5 卡片
const top5Card = page.locator('.ant-card:has-text("智能体告警次数排行 TOP5")').first();
await top5Card.screenshot({ path: '/tmp/monitoring_top5.png' });

// 整页截图便于查看整体
await page.screenshot({ path: '/tmp/monitoring_full.png', fullPage: true });
await browser.close();
console.log('done');
