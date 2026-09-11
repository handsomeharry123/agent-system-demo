/**
 * 接入中心智能化升级 - PRD §4.1-§4.4 Demo 端到端验证
 *
 * 角色：信息科管理员（admin）
 * 路径：
 *   4.1 列表页: 审核态势气泡 + 6 维分布 + 点击切 Tab + 列表项「预审建议」Tag
 *   4.2 审核页: 预审问题列表 + 联通测试步骤条 + 严重度筛选 + 预审结论
 *   4.3 审核页: 退回时汇总预审草稿 + 单条「采纳」到人工意见
 *   4.4 审核页: 通过后「下一步动作」引导 + 一键直达
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

  // 1. Login as admin
  log('Login as 信息科管理员');
  await page.goto(`${BASE}/app/login?role=admin`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // 2. Navigate to agent-center 全部 Tab
  log('4.1 Open 注册管理 (全部)');
  await page.goto(`${BASE}/app/agent-center`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/4_1_all_overview.png', fullPage: true });

  // 检查 4.1.1: 顶部审核态势气泡 (GlobalInsightBar)
  const insightBarVisible = await page.locator('[data-testid="global-insight-bar"]').isVisible().catch(() => false);
  result.checks['4.1_global_bar_visible'] = insightBarVisible;
  log(`4.1.1 GlobalInsightBar 可见: ${insightBarVisible}`);

  // 检查 4.1.2: 列表项「预审建议」Tag
  const preAuditTags = await page.locator('[data-testid="pre-audit-tip"]').count();
  result.checks['4.1_pre_audit_tip_count'] = preAuditTags;
  log(`4.1.2 预审建议 Tag 数: ${preAuditTags}`);

  // 检查 4.1.1 状态分布卡可点击切 Tab
  // 6 个 chip 卡位于 global-insight-bar 内, 点击「待审核」chip
  const clickTab = await page.evaluate(() => {
    const bar = document.querySelector('[data-testid="global-insight-bar"]');
    if (!bar) return null;
    // 找到包含"待审核"字样的 Card hoverable
    const cards = Array.from(bar.querySelectorAll('.ant-card-hoverable'));
    const target = cards.find((c) => c.innerText.includes('待审核'));
    if (!target) return null;
    target.click();
    return target.innerText;
  });
  log(`4.1.1 点击"待审核"chip: ${clickTab}`);
  await page.waitForTimeout(1500);
  const url = page.url();
  result.checks['4.1_jump_tab_url'] = url;
  log(`4.1.1 跳转后 URL: ${url}`);
  await page.screenshot({ path: '/tmp/4_1_jump_to_pending.png', fullPage: true });

  // 3. 进入「待审核」Tab，选一条进入审核
  log('4.2 进入审核注册页');
  // 取第一条「审核」按钮
  const auditBtn = page.locator('button:has-text("审核")').first();
  if (await auditBtn.count() === 0) {
    // 「全部」Tab 走「更多」下拉
    await page.goto(`${BASE}/app/agent-center?tab=待审核`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
  }
  // 找到任意一个审核链接 / 按钮
  await page.goto(`${BASE}/app/agent-center?tab=待审核`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const auditBtns = await page.locator('button:has-text("审核")').all();
  log(`待审核 Tab 审核按钮数: ${auditBtns.length}`);
  if (auditBtns.length > 0) {
    await auditBtns[0].click();
  } else {
    log('WARN: 无「审核」按钮, 强制跳转到 acc-003 (审核中) 的审核页');
    await page.goto(`${BASE}/app/agent-center/audit/acc-003`, { waitUntil: 'networkidle' });
  }
  await page.waitForTimeout(3000); // 等待 1.5s 预审 + 测试

  // 4.2 检查: 预审卡 + 联通测试步骤条
  const preAuditCard = await page.locator('[data-testid="pre-audit-card"]').isVisible();
  const severityFilter = await page.locator('[data-testid="pre-audit-severity-filter"]').isVisible();
  result.checks['4.2_pre_audit_card'] = preAuditCard;
  result.checks['4.2_severity_filter'] = severityFilter;
  log(`4.2 预审卡可见: ${preAuditCard}, 严重度筛选可见: ${severityFilter}`);
  await page.screenshot({ path: '/tmp/4_2_pre_audit.png', fullPage: true });

  // 4.2 严重度筛选
  if (severityFilter) {
    await page.locator('[data-testid="pre-audit-severity-filter"] label:has-text("错误")').click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: '/tmp/4_2_severity_error.png', fullPage: true });
    // 切回全部
    await page.locator('[data-testid="pre-audit-severity-filter"] label:has-text("全部")').click();
    await page.waitForTimeout(500);
  }

  // 4.3 检查: 预审问题项「采纳」按钮
  const adoptBtns = await page.locator('[data-testid="pre-audit-adopt"]').count();
  result.checks['4.3_adopt_btns'] = adoptBtns;
  log(`4.3 单条「采纳」按钮数: ${adoptBtns}`);
  if (adoptBtns > 0) {
    await page.locator('[data-testid="pre-audit-adopt"]').first().click();
    await page.waitForTimeout(800);
  }

  // 选「退回修改」 → 触发自动汇总草稿
  log('4.3 选「退回修改」触发自动汇总草稿');
  const returnRadio = page.locator('label:has-text("退回修改") input[type="radio"]').first();
  if (await returnRadio.count() > 0) {
    await page.locator('label:has-text("退回修改")').first().click();
    await page.waitForTimeout(800);
  }
  // 退回说明应已自动填入预审草稿
  const returnReasonValue = await page.locator('textarea').first().inputValue().catch(() => '');
  result.checks['4.3_return_reason_filled'] = returnReasonValue.includes('【预审标注问题】') || returnReasonValue.includes('字段');
  log(`4.3 退回说明已自动汇总: ${result.checks['4.3_return_reason_filled']}, 长度=${returnReasonValue.length}`);
  await page.screenshot({ path: '/tmp/4_3_return_with_draft.png', fullPage: true });

  // 4.4 检查: 选「审核通过」 → 触发通过后引导
  log('4.4 选「审核通过」触发引导');
  const passRadio = page.locator('label:has-text("审核通过") input[type="radio"]').first();
  if (await passRadio.count() > 0) {
    await page.locator('label:has-text("审核通过")').first().click();
    await page.waitForTimeout(500);
  }
  // 点确认
  const confirmBtn = page.locator('button:has-text("确认审核通过")').first();
  if (await confirmBtn.count() > 0) {
    await confirmBtn.click();
    await page.waitForTimeout(800);
    // 二次确认 Modal
    const modalOk = page.locator('.ant-modal-content button:has-text("确认通过")');
    if (await modalOk.count() > 0) {
      await modalOk.click();
      await page.waitForTimeout(2000);
    }
  }
  const passGuide = await page.locator('[data-testid="audit-pass-guide"]').isVisible().catch(() => false);
  result.checks['4.4_pass_guide'] = passGuide;
  log(`4.4 审核通过后引导卡可见: ${passGuide}`);
  await page.screenshot({ path: '/tmp/4_4_pass_guide.png', fullPage: true });

  // 一键直达按钮可见性
  const evalBtn = await page.locator('[data-testid="audit-pass-guide"] button:has-text("立即发起准入评测")').isVisible().catch(() => false);
  const ledgerBtn = await page.locator('[data-testid="audit-pass-guide"] button:has-text("查看统一台账")').isVisible().catch(() => false);
  result.checks['4.4_eval_btn'] = evalBtn;
  result.checks['4.4_ledger_btn'] = ledgerBtn;
  log(`4.4 一键直达 — 立即发起准入评测: ${evalBtn}, 查看统一台账: ${ledgerBtn}`);

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
