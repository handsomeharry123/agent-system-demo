import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1200 } });
await page.goto('http://localhost:3001/app/monitoring/status', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'verify_status_kpi_white.png', fullPage: true });
await browser.close();
console.log('done');
