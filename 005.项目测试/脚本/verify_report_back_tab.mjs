import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const out = { steps: [], errors: [] };
const log = (m) => { console.log(`[STEP] ${m}`); out.steps.push(m); };

try {
  log('launch chromium');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') out.errors.push(`[console] ${m.text()}`); });

  // 1. 进入评测中 Tab
  log('open evaluation tasks (all tab)');
  await page.goto(`${BASE}/app/evaluation/tasks`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  log('click 评测中 tab');
  await page.getByRole('tab', { name: /评测中/ }).click();
  await page.waitForTimeout(500);

  // 2. 点第一条「查看详情」
  log('click 查看详情 of first row in 评测中');
  await page.getByRole('button', { name: /查看详情/ }).first().click();
  await page.waitForURL(/\/tasks\/.+\/report/);
  await page.waitForTimeout(500);

  const reportUrl = page.url();
  out.reportUrl = reportUrl;
  log(`report url = ${reportUrl}`);
  if (!reportUrl.includes('fromTab=')) {
    out.errors.push(`URL should carry fromTab, got: ${reportUrl}`);
  } else {
    out.fromTabParam = new URL(reportUrl).searchParams.get('fromTab');
  }

  // 3. 点返回（Card 顶部的 返回 按钮，type="text"）
  log('click 返回 button');
  await page.locator('button.ant-btn-text', { hasText: '返回' }).first().click();
  await page.waitForURL(/\/app\/evaluation\/tasks/);
  await page.waitForTimeout(500);

  const backUrl = page.url();
  out.backUrl = backUrl;
  log(`back url = ${backUrl}`);

  // 4. 检查当前 active tab 是否是「评测中」
  const activeTabText = await page.evaluate(() => {
    const el = document.querySelector('.ant-tabs-tab.ant-tabs-tab-active');
    return el ? el.textContent : null;
  });
  out.activeTabText = activeTabText;
  log(`active tab = ${activeTabText}`);

  if (!activeTabText || !/评测中/.test(activeTabText)) {
    out.errors.push(`expected 评测中 tab active, got: ${activeTabText}`);
  }

  // 5. 截图存档
  await page.screenshot({ path: 'verify_report_back_tab.png', fullPage: false });
  out.screenshot = 'verify_report_back_tab.png';

  await browser.close();
} catch (e) {
  out.errors.push(`[exception] ${e?.message || e}`);
}

console.log(JSON.stringify(out, null, 2));
process.exit(out.errors.length === 0 ? 0 : 1);