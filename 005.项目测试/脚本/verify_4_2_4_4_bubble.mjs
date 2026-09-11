/**
 * 接入中心智能化升级 - PRD §4.2-§4.4 验证 v4
 *
 * 核心断言（PRD §4.2.1 / §4.3.1 严格措辞）：
 *  - 审核注册页**不**新增"智能预审 · 问题清单"独立卡片 / 状态条
 *  - 审核注册页技术信息区**不**就地展示步骤条 / 连通 Alert
 *  - 审核注册页**不**在审核结论 Card 标题旁放预审 Tag
 *  - 预审问题清单汇总 / 联通测试结果 / 预审结论 全部由 Agent 气泡 / 对话窗口呈现
 *  - 字段就地打标（FieldFlag）保留
 *  - 退回时汇总草稿保留
 *  - 通过后引导（audit-pass-guide）保留
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

  log('Login admin');
  await page.goto(`${BASE}/app/login?role=admin`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // 1. 进入 acc-009 (有"前后不一致"问题)
  log('进入 acc-009 审核页');
  await page.goto(`${BASE}/app/agent-center/audit/acc-009`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500); // 等 1.5s 预审 + 测试 + 4 条消息推送

  // §4.2.1 禁止：审核页不应再有 "智能预审 · 问题清单" 独立 Card / 顶部问题清单
  const oldPreAuditCard = await page.locator('[data-testid="pre-audit-card"]').count();
  result.checks['4.2_no_old_card'] = oldPreAuditCard === 0;
  log(`4.2.1 顶部"问题清单"Card 已下线: ${oldPreAuditCard === 0} (count=${oldPreAuditCard})`);

  // §4.2.1 禁止：审核页不应有 antd Steps 步骤条（应在对话窗口）
  const stepsOnPage = await page.locator('.ant-steps').count();
  result.checks['4.2_no_steps_on_page'] = stepsOnPage === 0;
  log(`4.2.1 审核页内 antd Steps 已下线: ${stepsOnPage === 0} (count=${stepsOnPage})`);

  // §4.2.1 禁止：审核页不应有"预审:建议通过" Tag（应在对话窗口）
  const verdictTag = await page.locator('[data-testid="pre-audit-verdict"]').count();
  result.checks['4.2_no_verdict_tag_in_title'] = verdictTag === 0;
  log(`4.2.1 审核页审核结论 Card 标题"预审:"Tag 已下线: ${verdictTag === 0} (count=${verdictTag})`);

  // §4.2.1 字段就地打标保留
  const fieldFlags = await page.locator('[data-testid^="field-flag-"]').count();
  result.checks['4.2_field_flag_kept'] = fieldFlags > 0;
  log(`4.2.1 字段就地打标 FieldFlag 保留: ${fieldFlags} 个`);

  // 2. 展开对话窗口
  log('展开 Agent 对话窗口');
  // 点机器人
  await page.evaluate(() => {
    // 找悬浮入口, click 它
    const robot = document.querySelector('[aria-label*="智能填写助手"]');
    if (robot) (robot).click();
  });
  await page.waitForTimeout(800);

  // §4.2.1 对话窗口呈现 4 类预审消息
  const summary = await page.locator('[data-testid="pre-audit-summary-msg"]').count();
  const test = await page.locator('[data-testid="pre-audit-test-msg"]').count();
  const verdict = await page.locator('[data-testid="pre-audit-verdict-msg"]').count();
  result.checks['4.2_summary_in_chat'] = summary > 0;
  result.checks['4.2_test_in_chat'] = test > 0;
  result.checks['4.2_verdict_in_chat'] = verdict > 0;
  log(`4.2.1 对话窗口: 汇总 ${summary}, 联通测试 ${test}, 预审结论 ${verdict}`);

  // §4.2.1 预审汇总 + 严重度筛选
  const filterInSummary = await page.locator('[data-testid="pre-audit-severity-filter"]').count();
  result.checks['4.2_severity_filter_in_chat'] = filterInSummary > 0;
  log(`4.2.1 严重度筛选 Radio.Group 在汇总消息内: ${filterInSummary > 0}`);

  // §4.2.1 单条预审问题
  const issueMsgs = await page.locator('[data-testid^="pre-audit-issue-msg-"]').count();
  result.checks['4.2_issue_msgs'] = issueMsgs;
  log(`4.2.1 预审问题消息数: ${issueMsgs}`);

  // §4.2.1 联通测试 5 阶段
  const testSteps = await page.locator('[data-testid^="pre-audit-test-step-"]').count();
  result.checks['4.2_test_5_stages'] = testSteps;
  log(`4.2.1 联通测试 5 阶段 step 行: ${testSteps}`);

  // 截图：审核页 + 展开对话窗口
  await page.screenshot({ path: '/tmp/v4_4_2_audit_and_chat.png', fullPage: true });

  // 3. 点采纳按钮（acc-009 应有"前后不一致"问题，source-mismatch）
  log('点单条「采纳到退回说明」按钮');
  const adoptBtn = page.locator('[data-testid^="pre-audit-issue-adopt-"]').first();
  if (await adoptBtn.count() > 0) {
    await adoptBtn.click();
    await page.waitForTimeout(800);
    // 状态应改为 adopted
    const adopted = await page.evaluate(() => {
      return Object.values(window.__preAuditIssueStatus || {});
    });
    result.checks['4.3_adopt_status_set'] = adopted.includes('adopted');
    log(`4.3.1 采纳后 window.__preAuditIssueStatus: ${JSON.stringify(adopted)}`);

    // 自动选"退回"+ 退回说明已填
    const rrValue = await page.locator('textarea').first().inputValue().catch(() => '');
    result.checks['4.3_auto_set_return_reason'] = rrValue.includes('字段') || rrValue.includes('不一致');
    log(`4.3.1 采纳后 returnReason 自动追加: ${result.checks['4.3_auto_set_return_reason']}, 长度=${rrValue.length}`);
  } else {
    result.checks['4.3_adopt_status_set'] = false;
    log('4.3.1 无单条采纳按钮');
  }

  // 4. 点单条"忽略"
  log('点单条「忽略本条」按钮（acc-011 验证多 issue）');
  await page.goto(`${BASE}/app/agent-center/audit/acc-011`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  await page.evaluate(() => {
    const robot = document.querySelector('[aria-label*="智能填写助手"]');
    if (robot) (robot).click();
  });
  await page.waitForTimeout(500);
  const ignoreBtn = page.locator('[data-testid^="pre-audit-issue-ignore-"]').first();
  if (await ignoreBtn.count() > 0) {
    await ignoreBtn.click();
    await page.waitForTimeout(500);
    const ig = await page.evaluate(() => {
      return Object.entries(window.__preAuditIssueStatus || {}).filter(([_, v]) => v === 'ignored');
    });
    result.checks['4.3_ignore_works'] = ig.length > 0;
    log(`4.3.1 忽略后状态: ${JSON.stringify(ig)}`);
  } else {
    result.checks['4.3_ignore_works'] = false;
  }

  // 5. 退回时自动汇总草稿（再次退回）
  log('切到 acc-009 验证 退回时自动汇总草稿');
  await page.goto(`${BASE}/app/agent-center/audit/acc-009`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  // 选"退回修改" → 草稿应自动汇总
  await page.locator('label:has-text("退回修改")').first().click();
  await page.waitForTimeout(800);
  const rr2 = await page.locator('textarea').first().inputValue().catch(() => '');
  result.checks['4.3_return_draft'] = rr2.includes('【预审标注问题】') || rr2.includes('字段');
  log(`4.3.1 退回说明自动汇总草稿: ${result.checks['4.3_return_draft']}, 长度=${rr2.length}`);

  // 6. 通过后引导（audit-pass-guide）保留
  log('选「审核通过」验证 §4.4.1 通过后引导');
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
  log(`4.4.1 通过后引导卡保留: ${passGuide}`);

  await page.screenshot({ path: '/tmp/v4_4_4_pass_guide.png', fullPage: true });

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
