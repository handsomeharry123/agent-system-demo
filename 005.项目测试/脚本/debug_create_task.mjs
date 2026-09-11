import { chromium } from 'playwright';
const BASE = 'http://localhost:3001';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await sleep(800);
  const adminBtn = await page.getByRole('button', { name: /管理员登录|信息科管理员登录/ }).first();
  if (await adminBtn.count() > 0) await adminBtn.click();
  await sleep(1500);
  await page.goto(`${BASE}/app/evaluation/tasks/create?agentName=心电图智能辅助诊断系统&agentCode=心内科-0001`, { waitUntil: 'networkidle' });
  await sleep(2000);
  // dump 所有按钮
  const btns = await page.locator('button').allInnerTexts();
  console.log('所有按钮:', JSON.stringify(btns));
  await browser.close();
})();
