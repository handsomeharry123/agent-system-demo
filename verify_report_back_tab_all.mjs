import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const out = { steps: [], errors: [] };
const log = (m) => { console.log(`[STEP] ${m}`); out.steps.push(m); };

try {
  log('launch chromium');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();

  log('open evaluation tasks (all tab)');
  await page.goto(`${BASE}/app/evaluation/tasks`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  log('click 查看详情 of first row in 全部');
  await page.getByRole('button', { name: /查看详情/ }).first().click();
  await page.waitForURL(/\/tasks\/.+\/report/);
  await page.waitForTimeout(500);

  const reportUrl = page.url();
  out.reportUrl = reportUrl;
  out.fromTabParam = new URL(reportUrl).searchParams.get('fromTab');
  log(`report url = ${reportUrl}; fromTab = ${out.fromTabParam}`);

  log('click 返回 button');
  await page.locator('button.ant-btn-text', { hasText: '返回' }).first().click();
  await page.waitForURL(/\/app\/evaluation\/tasks/);
  await page.waitForTimeout(500);

  const activeTabText = await page.evaluate(() => {
    const el = document.querySelector('.ant-tabs-tab.ant-tabs-tab-active');
    return el ? el.textContent : null;
  });
  out.activeTabText = activeTabText;
  log(`active tab = ${activeTabText}`);

  if (!activeTabText || !/全部任务/.test(activeTabText)) {
    out.errors.push(`expected 全部任务 tab active, got: ${activeTabText}`);
  }

  await browser.close();
} catch (e) {
  out.errors.push(`[exception] ${e?.message || e}`);
}

console.log(JSON.stringify(out, null, 2));
process.exit(out.errors.length === 0 ? 0 : 1);