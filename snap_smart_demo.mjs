// Full-page 截图
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
await ctx.addInitScript(() => {
  localStorage.setItem('hospital_user_v1', JSON.stringify({
    id: 'u1', name: '陈志远', department: '信息科',
    roles: ['信息科管理员'], isPlatformAdmin: true,
  }));
});
const page = await ctx.newPage();
const errorPages = [];
page.on('pageerror', (e) => errorPages.push(e.message));

await page.goto('http://localhost:3001/app/agent-center?tab=审核通过', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/smart_demo_v32/full_passed-list.png', fullPage: true });

const detailBtn = page.locator('a:has-text("查看详情"), button:has-text("查看详情")').first();
await detailBtn.click();
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/smart_demo_v32/full_detail.png', fullPage: true });

await page.goto('http://localhost:3001/app/agent-center/smart-register', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/smart_demo_v32/full_register_review.png', fullPage: true });

await page.goto('http://localhost:3001/app/agent-center?tab=待审核', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const auditBtn = page.locator('button:has-text("审核"), a:has-text("审核")').first();
await auditBtn.click();
await page.waitForTimeout(2800);
await page.screenshot({ path: '/tmp/smart_demo_v32/full_audit_preaudit.png', fullPage: true });

console.log('errors:', errorPages.length);
await browser.close();
