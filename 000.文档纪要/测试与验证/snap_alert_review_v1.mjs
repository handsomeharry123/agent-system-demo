import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();

const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') { pageErrors.push('[console] ' + m.text()); }
});

// 1) 直接访问 review 页（无 tab 参数，应该走 event.status = pending_review，显示「待审核」）
await page.goto('http://localhost:3001/app/monitoring/alert-events/evt-v18-001/review', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: '/Users/harry/Desktop/CC_TEST/agent-system/verify_review_default.png', fullPage: true });
console.log('REVIEW_DEFAULT_OK');

// 2) 带 ?tab=pending_review 参数（应一致显示「待审核」）
await page.goto('http://localhost:3001/app/monitoring/alert-events/evt-v18-001/review?tab=pending_review', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: '/Users/harry/Desktop/CC_TEST/agent-system/verify_review_pending_review.png', fullPage: true });
console.log('REVIEW_PENDING_REVIEW_OK');

// 3) 带 ?tab=reviewing 参数（应显示「审核中」，即便 event.status 是 pending_review）
await page.goto('http://localhost:3001/app/monitoring/alert-events/evt-v18-001/review?tab=reviewing', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: '/Users/harry/Desktop/CC_TEST/agent-system/verify_review_reviewing.png', fullPage: true });
console.log('REVIEW_REVIEWING_OK');

if (pageErrors.length) {
  console.log('PAGE_ERRORS:');
  for (const e of pageErrors) console.log(' -', e);
} else {
  console.log('NO_PAGE_ERRORS');
}

await browser.close();
