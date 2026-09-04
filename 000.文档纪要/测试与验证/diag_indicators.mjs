import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[console.error]', m.text());
});
page.on('response', (r) => {
  if (r.status() >= 400) console.log('[HTTP', r.status(), ']', r.url());
});

await page.goto('http://localhost:3001/app/evaluation/indicators', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

const html = await page.content();
console.log('--- HTML (first 3000) ---');
console.log(html.slice(0, 3000));
console.log('--- end ---');
console.log('URL:', page.url());

// Search for any of our key text in the body
const body = await page.locator('body').textContent();
console.log('Body length:', body.length);
console.log('Has 指标列表:', body.includes('指标列表'));
console.log('Has 指标展示:', body.includes('指标展示'));
console.log('Has 查看评分规则:', body.includes('查看评分规则'));
console.log('Has 前往任务管理:', body.includes('前往任务管理'));

// All ant-page-header class variants
const h1 = await page.locator('[class*="page-header-heading"]').count();
const h2 = await page.locator('[class*="page-header"]').count();
const h3 = await page.locator('header').count();
console.log('page-header-heading count:', h1, 'page-header count:', h2, 'header count:', h3);

await page.screenshot({ path: '/tmp/indicators_diag.png', fullPage: true });
await browser.close();
