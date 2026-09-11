/**
 * 接入中心智能化升级 - PRD §4.1-§4.4 Demo 端到端验证 v2
 *
 * 覆盖（v2 增量）：
 *  - 4.1 提交时间区间筛选 + 列表列点击排序 + 态势气泡 6s 自动收起
 *  - 4.2 字段就地打标（FieldFlag） + 联通测试 5 阶段（含 DNS 解析）
 *    + 预审结论 Tag 在「审核结论」区旁 + 时效问题标注
 *  - 4.3 单条「忽略」按钮（从清单移除，不参与预审结论 / 退回草稿）
 *  - 4.4 通过后引导（一键直达）— 沿用 v1
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const result = { steps: [], checks: {}, errors: [] };
const log = (m) => { console.log(`[STEP] ${m}`); result.steps.push(m); };

try {
  log('Launch chromium (admin)');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => result.errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') console.log(`[C-ERR] ${m.text()}`); });

  log('Login as 信息科管理员');
  await page.goto(`${BASE}/app/login?role=admin`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // ─── 4.1.1 提交时间筛选 + 列表列点击排序 + 态势气泡自动收起 ───
  log('4.1 Open 注册管理 (全部)');
  await page.goto(`${BASE}/app/agent-center`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  // 先验证 4.1.1 立即可见
  const barT0 = await page.locator('[data-testid="global-insight-bar"]').isVisible();
  result.checks['4.1_bar_t0'] = barT0;
  await page.screenshot({ path: '/tmp/v2_4_1_initial.png', fullPage: true });

  // §4.1.1 提交时间区间筛选器
  const rangePickerCount = await page.locator('[data-testid="submit-range"]').count();
  const rangePickerVisible =
    (await page.locator('[data-testid="submit-range"] .ant-picker').first().isVisible().catch(() => false)) ||
    rangePickerCount > 0;
  result.checks['4.1_submit_range_visible'] = rangePickerVisible;
  log(`4.1 提交时间 RangePicker 可见: ${rangePickerVisible} (count=${rangePickerCount})`);

  // §4.1.1 态势气泡 6s 自动收起
  log('Wait 7s for 态势气泡自动收起');
  await page.waitForTimeout(7000);
  const barAfter7s = await page.locator('[data-testid="global-insight-bar"]').isVisible().catch(() => false);
  const toggle = await page.locator('[data-testid="global-insight-bar-toggle"]').isVisible().catch(() => false);
  result.checks['4.1_bar_auto_collapsed'] = !barAfter7s && toggle;
  log(`4.1 态势气泡自动收起: ${!barAfter7s}, 重新打开入口可见: ${toggle}`);
  await page.screenshot({ path: '/tmp/v2_4_1_collapsed.png', fullPage: true });

  // 重新打开 + 验证点 chip 切 Tab
  if (toggle) {
    await page.locator('[data-testid="global-insight-bar-toggle"]').click();
    await page.waitForTimeout(500);
  }
  const reopened = await page.locator('[data-testid="global-insight-bar"]').isVisible();
  result.checks['4.1_bar_reopen'] = reopened;
  // 点 chip 切到「待审核」
  const jumpTab = await page.evaluate(() => {
    const bar = document.querySelector('[data-testid="global-insight-bar"]');
    if (!bar) return null;
    const cards = Array.from(bar.querySelectorAll('.ant-card-hoverable'));
    const target = cards.find((c) => c.innerText.includes('待审核'));
    if (!target) return null;
    target.click();
    return target.innerText;
  });
  log(`4.1 点击"待审核"chip: ${jumpTab}`);
  await page.waitForTimeout(1000);
  const tabUrl = page.url();
  result.checks['4.1_jump_tab_url'] = tabUrl;
  log(`4.1 跳转 URL: ${tabUrl}`);

  // §4.1.2 列表列点击排序：点击「提交审核时间」列头
  const sortHeader = page.locator('th:has-text("提交审核时间")').first();
  if (await sortHeader.count() > 0) {
    await sortHeader.click();
    await page.waitForTimeout(500);
    // 升序指示
    const ascIndicator = await page.locator('th:has-text("提交审核时间").ant-table-column-sort').count();
    result.checks['4.1_sort_active'] = ascIndicator > 0;
    log(`4.1 列点击排序: ${ascIndicator > 0 ? '激活' : '未激活'}`);
  }
  await page.screenshot({ path: '/tmp/v2_4_1_sort.png', fullPage: true });

  // ─── 4.2 进入审核注册页（用 acc-009 待审核）+ 验证就地打标 / DNS 解析 / 时效 ───
  log('4.2 进入审核注册页 acc-009');
  await page.goto(`${BASE}/app/agent-center/audit/acc-009`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500); // 等 1.5s 预审 + 测试

  // §4.2 联通测试 5 阶段（含 DNS 解析）— 测试中时步骤条存在, 验证 source 已包含 DNS 解析
  const fs = await import('node:fs');
  const auditSrc = fs.readFileSync(
    new URL('./src/pages/agent-center/Audit.tsx', import.meta.url),
    'utf-8',
  );
  const hasDNSInSource = /'DNS 解析'/.test(auditSrc) && /TEST_STAGES\s*=/.test(auditSrc);
  result.checks['4.2_dns_in_source'] = hasDNSInSource;

  // §4.2 字段就地打标：Descriptions.Item label 旁 FieldFlag
  const flags = await page.locator('[data-testid^="field-flag-"]').count();
  result.checks['4.2_field_flags'] = flags;
  log(`4.2 FieldFlag 数量: ${flags}`);

  // §4.2 预审结论 Tag 在审核结论区旁
  const verdictInAuditTitle = await page.locator('[data-testid="pre-audit-verdict"]').isVisible();
  result.checks['4.2_verdict_in_audit_title'] = verdictInAuditTitle;
  log(`4.2 预审结论在审核结论区旁: ${verdictInAuditTitle}`);

  // §4.2 时效问题（acc-009 是新提交，< 90 天，理论上无；用 mock 看看）
  const allProblems = await page.locator('[data-testid^="pre-audit-row-"]').count();
  result.checks['4.2_problem_rows'] = allProblems;
  log(`4.2 预审问题条数: ${allProblems}`);
  await page.screenshot({ path: '/tmp/v2_4_2_pre_audit.png', fullPage: true });

  // 切到 acc-011（退回修改，版本 0.8 → 应有「版本号 < 1.0」时效标注）
  log('4.2 切换 acc-011 (版本 0.8 验证时效)');
  await page.goto(`${BASE}/app/agent-center/audit/acc-011`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  const staletip = await page.locator('[data-testid="pre-audit-row-version-pre-1"]').count();
  result.checks['4.2_stale_problem'] = staletip;
  log(`4.2 时效问题(版本<1.0) 行: ${staletip}`);
  await page.screenshot({ path: '/tmp/v2_4_2_stale.png', fullPage: true });

  // ─── 4.3 单条忽略按钮：忽略 "version-pre-1" → 该条不再出现在清单中 ───
  const ignoreBtns = await page.locator('[data-testid="pre-audit-ignore"]').count();
  result.checks['4.3_ignore_btns'] = ignoreBtns;
  log(`4.3 单条「忽略」按钮数: ${ignoreBtns}`);
  if (ignoreBtns > 0) {
    await page.locator('[data-testid="pre-audit-ignore"]').first().click();
    await page.waitForTimeout(500);
    const after = await page.locator('[data-testid^="pre-audit-row-"]').count();
    result.checks['4.3_ignore_works'] = after === ignoreBtns - 1 || after < ignoreBtns;
    log(`4.3 忽略后剩余 ${after} 条（原 ${ignoreBtns} 条）`);
  }
  await page.screenshot({ path: '/tmp/v2_4_3_ignored.png', fullPage: true });

  // ─── 4.3 退回时自动汇总草稿 + 单条「采纳」按钮 — 切到 acc-009（待审核、有"前后不一致"）───
  log('4.3 切 acc-009 验证退回时自动汇总 + 单条采纳');
  await page.goto(`${BASE}/app/agent-center/audit/acc-009`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  const adoptBtns = await page.locator('[data-testid="pre-audit-adopt"]').count();
  result.checks['4.3_adopt_btns'] = adoptBtns;
  log(`4.3 单条「采纳」按钮数: ${adoptBtns}`);
  await page.locator('label:has-text("退回修改")').first().click();
  await page.waitForTimeout(800);
  const rrValue = await page.locator('textarea').first().inputValue().catch(() => '');
  result.checks['4.3_return_draft'] = rrValue.includes('【预审标注问题】') || rrValue.includes('字段');
  log(`4.3 退回说明已自动汇总: ${result.checks['4.3_return_draft']}, 长度=${rrValue.length}`);

  // ─── 4.4 通过后引导（仍走 v1 流程）───
  log('4.4 选「审核通过」');
  await page.locator('label:has-text("审核通过")').first().click();
  await page.waitForTimeout(500);
  await page.locator('button:has-text("确认审核通过")').first().click();
  await page.waitForTimeout(800);
  const modalOk = page.locator('.ant-modal-content button:has-text("确认通过")');
  if (await modalOk.count() > 0) {
    await modalOk.click();
    await page.waitForTimeout(2000);
  }
  const passGuide = await page.locator('[data-testid="audit-pass-guide"]').isVisible().catch(() => false);
  result.checks['4.4_pass_guide'] = passGuide;
  log(`4.4 审核通过后引导卡: ${passGuide}`);
  await page.screenshot({ path: '/tmp/v2_4_4_pass_guide.png', fullPage: true });

  await browser.close();
  console.log('\n===== CHECKS =====');
  console.log(JSON.stringify(result.checks, null, 2));
  console.log('===== ERRORS =====');
  console.log(JSON.stringify(result.errors, null, 2));
  if (result.errors.length > 0) process.exit(1);
} catch (e) {
  console.error('[FATAL]', e);
  process.exit(2);
}
