// verify_report_reeval_role.mjs — 验证评测结果详情页「重新评测」按钮仅信息科管理员可见
import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const TARGET_TASK = 'task-005'; // 截图里 EVL-20260505-0001 / 退回重测
const TARGET_URL = `${BASE}/app/evaluation/tasks/${TARGET_TASK}/report?fromTab=退回重测`;
const out = { steps: [], errors: [], screenshots: [] };
const log = (m) => { console.log(`[STEP] ${m}`); out.steps.push(m); };

const pickReevalVisible = async (page) => {
  // 「重新评测」按钮：type="primary" + icon ReloadOutlined，在 Card 顶部 Space 内
  // 通过 text + role 找更稳
  const btns = page.getByRole('button', { name: /重新评测/ });
  const c = await btns.count();
  if (c === 0) return { count: 0, visible: false };
  // 检查是否真的在 viewport 内可见
  const first = btns.first();
  const visible = await first.isVisible().catch(() => false);
  return { count: c, visible };
};

const switchRole = async (page, roleKeyword) => {
  // 点右下角演示浮窗 → 抽屉 → 演示角色 Select → 选项
  const floatBtn = page.locator('.ant-float-btn').first();
  await floatBtn.waitFor({ state: 'visible', timeout: 8000 });
  await floatBtn.click();
  await page.waitForTimeout(800);
  const drawer = page.locator('.ant-drawer-content').first();
  await drawer.waitFor({ state: 'visible', timeout: 5000 });
  const roleSelect = drawer.locator('.ant-select').first();
  await roleSelect.click();
  await page.waitForTimeout(500);
  const option = page.locator('.ant-select-item-option').filter({ hasText: roleKeyword }).first();
  await option.waitFor({ state: 'visible', timeout: 5000 });
  await option.click();
  await page.waitForTimeout(1200);
  // 关闭抽屉
  const closeBtn = drawer.locator('.ant-drawer-close').first();
  if (await closeBtn.count()) {
    await closeBtn.click().catch(() => {});
    await page.waitForTimeout(400);
  }
};

try {
  log('launch chromium');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') out.errors.push(`[console] ${m.text()}`); });
  page.on('pageerror', (e) => out.errors.push(`[pageerror] ${e.message}`));

  // ---------------------------------------------------------------------------
  // Case A: 信息科管理员（默认）— 「重新评测」应该可见
  // ---------------------------------------------------------------------------
  log('--- Case A: 信息科管理员 ---');
  log(`open ${TARGET_URL}`);
  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  // 确认进入正确的任务详情页（标题含「评测结果详情」）
  await page.waitForSelector('text=/评测结果详情/', { timeout: 8000 });

  // 确认任务状态是「退回重测」
  const statusTag = await page.locator('.ant-tag', { hasText: /退回/ }).first().textContent().catch(() => '');
  log(`status tag = ${statusTag}`);
  out.adminStatusTag = statusTag;

  const admin = await pickReevalVisible(page);
  out.adminReeval = admin;
  log(`信息科管理员: count=${admin.count}, visible=${admin.visible}`);

  await page.screenshot({ path: 'verify_report_reeval_admin.png', fullPage: false });
  out.screenshots.push('verify_report_reeval_admin.png');

  if (!admin.visible) {
    out.errors.push('信息科管理员 应能看到「重新评测」按钮');
  }

  // ---------------------------------------------------------------------------
  // Case B: 切到科室管理员 — 「重新评测」应该不可见
  // ---------------------------------------------------------------------------
  log('--- Case B: 科室管理员 ---');
  await switchRole(page, '科室管理员');
  log('切换角色后重新打开详情页');
  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.waitForSelector('text=/评测结果详情/', { timeout: 8000 });

  // 确认当前用户名/角色已切换
  const headerUser = await page.locator('header').first().textContent().catch(() => '');
  log(`header text snippet = ${headerUser?.slice(0, 80)}`);

  const dept = await pickReevalVisible(page);
  out.deptReeval = dept;
  log(`科室管理员: count=${dept.count}, visible=${dept.visible}`);

  await page.screenshot({ path: 'verify_report_reeval_dept.png', fullPage: false });
  out.screenshots.push('verify_report_reeval_dept.png');

  if (dept.count > 0 && dept.visible) {
    out.errors.push('科室管理员 不应能看到「重新评测」按钮（计数>0 且可见）');
  }

  // 其他按钮仍应可见
  const previewBtn = page.getByRole('button', { name: /评测结果报告查看/ });
  const previewCount = await previewBtn.count();
  out.deptPreviewCount = previewCount;
  if (previewCount === 0) {
    out.errors.push('科室管理员 仍应能看到「评测结果报告查看」按钮');
  }

  await browser.close();
} catch (e) {
  out.errors.push(`[exception] ${e?.message || e}`);
}

console.log(JSON.stringify(out, null, 2));
process.exit(out.errors.length === 0 ? 0 : 1);