import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

// 1) 用户打开 总览页 /app/ledger
await page.goto('http://localhost:5173/app/ledger', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const overviewBubble1 = await page.evaluate(() => {
  const fixedDivs = document.querySelectorAll('div[style*="position: fixed"]');
  for (const d of fixedDivs) {
    if (d.textContent && d.textContent.includes('医小管 · 台账速览')) {
      return { has: true, text: d.textContent.slice(0, 80) };
    }
  }
  return { has: false };
});
console.log('1) 总览页直接打开, 气泡:', overviewBubble1.has, overviewBubble1.text || '');

// 2) 用户点 × 关闭气泡
const closeBtn = await page.$('button[aria-label="关闭"]');
if (closeBtn) {
  await closeBtn.click();
  await page.waitForTimeout(800);
}
const ss1 = await page.evaluate(() => Object.keys(sessionStorage).filter(k => k.includes('bubble')));
console.log('2) 总览页关闭后 sessionStorage:', ss1);

// 3) 用户切到列表页
await page.goto('http://localhost:5173/app/ledger/list', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const listBubble1 = await page.evaluate(() => {
  const fixedDivs = document.querySelectorAll('div[style*="position: fixed"]');
  for (const d of fixedDivs) {
    if (d.textContent && d.textContent.includes('医小管 · 台账速览')) {
      return { has: true, text: d.textContent.slice(0, 80) };
    }
  }
  return { has: false };
});
console.log('3) 切到列表页, 气泡:', listBubble1.has, listBubble1.text || '');

// 4) 切回总览页
await page.goto('http://localhost:5173/app/ledger', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const overviewBubble2 = await page.evaluate(() => {
  const fixedDivs = document.querySelectorAll('div[style*="position: fixed"]');
  for (const d of fixedDivs) {
    if (d.textContent && d.textContent.includes('医小管 · 台账速览')) {
      return { has: true, text: d.textContent.slice(0, 80) };
    }
  }
  return { has: false };
});
console.log('4) 切回总览页, 气泡:', overviewBubble2.has, overviewBubble2.text || '');

const ssFinal = await page.evaluate(() => Object.keys(sessionStorage).filter(k => k.includes('bubble')));
console.log('最终 sessionStorage:', ssFinal);

await page.screenshot({ path: '/tmp/repro_step4.png', fullPage: false });
await browser.close();
