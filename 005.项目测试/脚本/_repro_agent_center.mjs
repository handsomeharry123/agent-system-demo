// 复现 /app/agent-center 的"拒绝请求"现象
import { chromium } from 'playwright';

const URL = 'http://localhost:3001/app/agent-center';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const consoleMsgs = [];
page.on('console', (m) => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => consoleMsgs.push(`[pageerror] ${e.message}\n${e.stack ?? ''}`));
page.on('requestfailed', (r) => consoleMsgs.push(`[reqfail] ${r.url()} :: ${r.failure()?.errorText}`));
page.on('response', (r) => {
  if (r.status() >= 400) consoleMsgs.push(`[http ${r.status()}] ${r.url()}`);
});

try {
  const resp = await page.goto(URL, { waitUntil: 'networkidle', timeout: 15000 });
  console.log('NAV status:', resp?.status());
  await page.waitForTimeout(1500);
  const url = page.url();
  const title = await page.title();
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 800));
  const visibleHeadings = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('h1,h2,h3,.ant-empty-description,.ant-result-title'))
      .map((n) => n.textContent?.trim()).filter(Boolean).slice(0, 10);
  });
  const hasErrorBoundary = await page.evaluate(() => {
    return {
      empty: !!document.querySelector('.ant-empty'),
      result: !!document.querySelector('.ant-result'),
      errorBoundary: !!document.querySelector('[class*="error"], [class*="Error"]'),
      permission: !!document.body.innerText.match(/无权限|拒绝|无权访问|Permission/),
    };
  });
  console.log('FINAL_URL:', url);
  console.log('TITLE:', title);
  console.log('HEADINGS:', JSON.stringify(visibleHeadings));
  console.log('FLAGS:', JSON.stringify(hasErrorBoundary));
  console.log('BODY:', bodyText);
} catch (e) {
  console.log('NAV_FAIL:', e.message);
}

console.log('\n===== CONSOLE / NETWORK =====');
for (const m of consoleMsgs) console.log(m);

await browser.close();
