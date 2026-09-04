// 同时跑 4 个常见路径 + 看是否有任何错误
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const log = [];
page.on('console', (m) => log.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => log.push(`[PAGE_ERR] ${e.message}`));

for (const path of [
  '/',
  '/login',
  '/app/home/overview',
  '/app/agent-center',
  '/app/agent-center/smart-register',
  '/app/agent-center/detail/A001',
  '/app/audit',
]) {
  log.push(`\n=== ${path} ===`);
  const r = await page.goto('http://localhost:3001' + path, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1000);
  log.push(`status=${r?.status()} finalURL=${page.url()} bodyLen=${(await page.content()).length}`);
}

console.log(log.join('\n'));
await browser.close();
