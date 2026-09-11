import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

// 完全模拟用户：先访问 list 关闭气泡,再访问 总览
await page.goto('http://localhost:5173/app/ledger/list', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const dismissBtn1 = await page.$('button[aria-label="关闭"]');
if (dismissBtn1) await dismissBtn1.click();
await page.waitForTimeout(800);
const ss1 = await page.evaluate(() => Object.keys(sessionStorage).filter(k => k.includes('bubble')));
console.log('list 页关闭后 sessionStorage bubble keys:', ss1);

await page.goto('http://localhost:5173/app/ledger', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const ss2 = await page.evaluate(() => Object.keys(sessionStorage).filter(k => k.includes('bubble')));
console.log('总览页 sessionStorage bubble keys:', ss2);

const overviewBubble = await page.evaluate(() => {
  const els = document.querySelectorAll('div');
  for (const e of els) {
    if (e.textContent && e.textContent.includes('医小管 · 台账速览') && e.offsetWidth > 100) {
      return {
        hasBubble: true,
        text: e.textContent.slice(0, 100),
        rect: e.getBoundingClientRect(),
      };
    }
  }
  return { hasBubble: false };
});
console.log('总览页气泡检测:', JSON.stringify(overviewBubble, null, 2));
await page.screenshot({ path: '/tmp/verify_overview_bubble_repro.png', fullPage: false });
await browser.close();
