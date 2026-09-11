import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto('http://localhost:5173/app/ledger-demo/report', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const allSeg = await page.evaluate(() => {
  const segs = document.querySelectorAll('.ant-segmented');
  return Array.from(segs).map(s => s.outerHTML.slice(0, 800));
});
console.log('Found', allSeg.length, 'segmented groups:');
allSeg.forEach((s, i) => console.log(`\n--- [${i}] ---\n${s}`));
await browser.close();
