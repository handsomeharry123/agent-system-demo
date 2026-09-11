import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();

await page.goto('http://localhost:3001/app/evaluation/tasks/task-009/review?fromTab=%E5%BE%85%E5%AE%A1%E6%A0%B8');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(800);

await page.screenshot({ path: '/tmp/review-page.png', fullPage: true });

// 找底部居中区域的两个按钮
const centerBtns = page.locator('div[style*="text-align: center"] button');
const count = await centerBtns.count();
console.log('Bottom center buttons count:', count);
for (let i = 0; i < count; i++) {
  const t = (await centerBtns.nth(i).textContent()) || '';
  console.log(`  button[${i}]:`, JSON.stringify(t));
}

// 点击第一个（即"返回"按钮）
console.log('Clicking 底部"返回"...');
await centerBtns.nth(0).click();
await page.waitForTimeout(1000);

console.log('After click URL:', page.url());

// 等 tab 渲染
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/after-back.png', fullPage: true });

// 看一下当前激活的 tab 是不是「待审核」
const activeTab = await page.locator('.ant-tabs-tab-active').textContent();
console.log('Active tab text:', activeTab);

await browser.close();
console.log('Done');
