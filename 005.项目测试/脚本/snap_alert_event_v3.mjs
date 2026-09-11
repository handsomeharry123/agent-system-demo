import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();

const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') { pageErrors.push('[console] ' + m.text()); }
});

// 列表页（验证抽屉已移除 + 查看详情按钮为 link）
await page.goto('http://localhost:3001/app/monitoring/alert-events', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: '/Users/harry/Desktop/CC_TEST/agent-system/verify_alert_list_v3.png', fullPage: false });
console.log('LIST_OK');

// 下钻详情页（验证 ① 标号去除 + 字段中文化）
await page.goto('http://localhost:3001/app/monitoring/alert-events/evt-v18-001', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: '/Users/harry/Desktop/CC_TEST/agent-system/verify_alert_detail_v3.png', fullPage: true });
console.log('DETAIL_OK');

if (pageErrors.length) {
  console.log('PAGE_ERRORS:');
  for (const e of pageErrors) console.log(' -', e);
} else {
  console.log('NO_PAGE_ERRORS');
}

await browser.close();
