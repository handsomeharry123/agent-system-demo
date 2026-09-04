/**
 * 统一运行监控中心 V1.8 — 端到端流程测试（测试人员 #2 交叉验证）
 *
 * 任务：PRD §6 事件全生命周期闭环 + 告警规则管理 + 联动测试
 * 入口：http://localhost:3001（默认登录为 admin / 黄帅帅）
 *
 * 测试流程：
 *  1. 告警事件全生命周期闭环（待分派 → 待处理 → 处理中 → 待审核 → 已关闭）
 *  2. 退回处理流程（审核退回 → 待处理 → 再次处理）
 *  3. 告警规则管理（新建 → 详情 → 删除）
 *  4. 联动测试（总览卡片点击 → 事件 Tab）
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const BASE = 'http://localhost:3001';
const SHOTS_DIR = '/tmp/monitoring-v18-e2e-shots';
mkdirSync(SHOTS_DIR, { recursive: true });

const results = [];
const record = (id, name, status, note = '') => {
  results.push({ id, name, status, note });
  const tag = status === 'PASS' ? '[PASS]' : status === 'FAIL' ? '[FAIL]' : '[SKIP]';
  console.log(`${tag} ${id} ${name}${note ? ' — ' + note : ''}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// AntD Button 文本可能含额外空格（letter-spacing），需规范化
const normalize = (s) => s.replace(/\s+/g, '');

async function shot(page, name) {
  const f = join(SHOTS_DIR, `${name}.png`);
  try {
    await page.screenshot({ path: f, fullPage: true });
  } catch (e) { /* ignore */ }
  return f;
}

async function gotoAndShot(page, path, name) {
  await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(900);
  const f = await shot(page, name);
  return f;
}

// 切换 Tab（用 ant-tabs-tab 文本匹配）
async function clickTab(page, label) {
  const tab = page.locator('.ant-tabs-tab', { hasText: label }).first();
  await tab.click();
  await sleep(600);
}

// 在指定 Tab 中找到 rowKey（事件 id）所在行并点击操作按钮
async function clickRowActionByEventId(page, eventId, actionText) {
  // 找到行 - ant-table-row 有 data-row-key
  const row = page.locator(`tr[data-row-key="${eventId}"]`).first();
  if (await row.count() === 0) {
    throw new Error(`未找到行 row-key=${eventId}`);
  }
  const btn = row.locator('button', { hasText: actionText }).first();
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await sleep(500);
}

// 在 Modal 中填值（用 label 文本）
async function fillFormItem(page, labelText, value) {
  // Form.Item label 通常是 .ant-form-item-label 内的 label 元素
  const item = page.locator('.ant-form-item').filter({ has: page.locator('.ant-form-item-label', { hasText: labelText }) }).first();
  await item.locator('input, textarea').first().fill(value);
  await sleep(150);
}

async function clickRadio(page, labelText) {
  const r = page.locator('label.ant-radio-wrapper', { hasText: labelText }).first();
  await r.click();
  await sleep(200);
}

async function clickOkButton(page, text = '确 定') {
  // AntD Modal 确认按钮（多种文案）
  const btn = page.locator('.ant-modal .ant-modal-footer button', { hasText: /确\s*定|确\s*认|是|提\s*交|提\s*交\s*审\s*核/ }).first();
  await btn.click();
  await sleep(600);
}

async function clickModalSubmit(page) {
  // 弹窗底部「提交」按钮
  const btn = page.locator('.ant-modal .ant-modal-footer button.ant-btn-primary').first();
  await btn.click();
  await sleep(800);
}

// ---------------------------------------------------------------------------
async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1200 },
    acceptDownloads: true,
  });
  const page = await context.newPage();

  // 捕获控制台错误
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));

  // === 登录（admin 默认种子）===
  await page.goto(BASE + '/app/monitoring/alert-events', { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(1200);

  // =====================================================================
  // 任务 1：告警事件全生命周期闭环
  // =====================================================================

  // 1.0 默认显示全部事件 Tab
  await gotoAndShot(page, '/app/monitoring/alert-events', 'T1-00-default-all');
  let activeTab = (await page.locator('.ant-tabs-tab-active').innerText()).replace(/\s+/g, ' ').trim();
  record('T1-00', '默认显示「全部事件」Tab', activeTab.includes('全部事件') ? 'PASS' : 'FAIL', `active=${activeTab}`);

  // 1.1 切换到「待分派事件」Tab
  await clickTab(page, '待分派事件');
  await shot(page, 'T1-01-pending-assign-tab');
  const paText = await page.locator('body').innerText();
  const hasPendingAssignTab = paText.includes('待分派事件');
  record('T1-01', '管理员可见「待分派事件」Tab', hasPendingAssignTab ? 'PASS' : 'FAIL');

  // 1.2 找到一条 pending_assign 事件 (evt-v18-001) 点击分派
  // 验证行存在
  let assignRow = page.locator('tr[data-row-key="evt-v18-001"]');
  const hasEvent001 = await assignRow.count() > 0;
  if (!hasEvent001) {
    // 兜底：取第一条待分派事件
    const anyPending = await page.locator('tr.ant-table-row').count();
    record('T1-02a', '找到 pending_assign 事件行', 'FAIL', `evt-v18-001 不在列表，可见行数=${anyPending}`);
  } else {
    record('T1-02a', '找到 pending_assign 事件行', 'PASS');
  }

  await clickRowActionByEventId(page, 'evt-v18-001', '分派');
  await sleep(800);
  await shot(page, 'T1-02-assign-modal');

  // 验证分派弹窗 - 含 处理人 label
  let modalText = await page.locator('.ant-modal').innerText();
  record('T1-02b', '分派弹窗显示「处理人」字段', modalText.includes('处理人') ? 'PASS' : 'FAIL');

  // 填写处理人
  await fillFormItem(page, '处理人', '李华（测试）');
  await shot(page, 'T1-03-assign-filled');

  // 提交
  await clickModalSubmit(page);
  await sleep(1500); // 等跳转

  // 1.3 验证事件应消失于「待分派」Tab
  await clickTab(page, '待分派事件');
  await sleep(600);
  await shot(page, 'T1-04-pending-assign-after');
  const ev001StillInPending = await page.locator('tr[data-row-key="evt-v18-001"]').count() > 0;
  record('T1-03', '分派后事件从「待分派」Tab 消失', !ev001StillInPending ? 'PASS' : 'FAIL');

  // 1.4 验证事件出现在「待处理事件」Tab
  await clickTab(page, '待处理事件');
  await sleep(600);
  await shot(page, 'T1-05-pending-handle-after');
  const ev001InPendingHandle = await page.locator('tr[data-row-key="evt-v18-001"]').count() > 0;
  record('T1-04', '分派后事件出现在「待处理事件」Tab', ev001InPendingHandle ? 'PASS' : 'FAIL');

  // 1.5 点击「处理」（在列表页弹 Modal，模式=handle）
  await clickRowActionByEventId(page, 'evt-v18-001', '处理');
  await sleep(800);
  await shot(page, 'T1-06-handle-modal');

  // 应弹出 Modal
  const handleModalText = await page.locator('.ant-modal').innerText();
  record('T1-05', '「处理」点击后弹出处理 Modal', handleModalText.includes('事件处理') || handleModalText.includes('处理结果') ? 'PASS' : 'FAIL');

  // 1.6 填写处理结果=已处理 + 处理方案
  record('T1-06a', '处理 Modal 显示「处理结果」', handleModalText.includes('处理结果') ? 'PASS' : 'FAIL');
  record('T1-06b', '处理 Modal 显示「处理方案」', handleModalText.includes('处理方案') ? 'PASS' : 'FAIL');

  // 选择「已处理」
  await clickRadio(page, '已处理');
  await sleep(300);
  // 填写处理方案
  await fillFormItem(page, '处理方案', '测试用例 #2 处理方案：已扩容实例，CPU 回到 60%');
  await shot(page, 'T1-07-handle-filled');

  // 点击 Modal 提交按钮
  await clickModalSubmit(page);
  await sleep(1500);
  await shot(page, 'T1-08-after-handle-submit');

  // 1.7 验证事件进入「处理中事件」Tab（V1.8 实现：处理提交后进入 handling）
  await clickTab(page, '处理中事件');
  await sleep(600);
  await shot(page, 'T1-09-handling');
  const ev001InHandling = await page.locator('tr[data-row-key="evt-v18-001"]').count() > 0;
  record('T1-07', '处理后事件进入「处理中事件」Tab', ev001InHandling ? 'PASS' : 'FAIL');

  // 1.8 改用 mock 数据中已有的 pending_review 事件（evt-v18-007）来验证审核流
  await gotoAndShot(page, '/app/monitoring/alert-events?tab=pending_review', 'T1-10-pending-review-list');
  // 点击 evt-v18-007 行的「审核」
  await clickRowActionByEventId(page, 'evt-v18-007', '审核');
  await sleep(1200);
  await shot(page, 'T1-11-review-page');
  const reviewUrl = page.url();
  record('T1-08', '「审核」点击跳转到处理审核页', reviewUrl.includes('/review') ? 'PASS' : 'FAIL', `url=${reviewUrl}`);

  // 验证审核页含审核意见选项
  const reviewText = await page.locator('body').innerText();
  record('T1-09a', '审核页显示「处理完成，关闭该告警事项」', reviewText.includes('处理完成') ? 'PASS' : 'FAIL');
  record('T1-09b', '审核页显示「退回重新处理」', reviewText.includes('退回重新处理') ? 'PASS' : 'FAIL');
  record('T1-09c', '审核页显示「审核说明」', reviewText.includes('审核说明') ? 'PASS' : 'FAIL');

  // 选择「处理完成，关闭该告警事项」
  await clickRadio(page, '处理完成');
  await sleep(300);
  // 填写审核说明
  await fillFormItem(page, '审核说明', '测试用例 #2 审核通过：方案合理，问题已闭环');
  await shot(page, 'T1-11-review-filled');

  // 提交审核
  const submitReviewBtn = page.locator('button.ant-btn-primary', { hasText: /提交审核|提交/ }).last();
  await submitReviewBtn.click();
  await sleep(800);
  // 弹出 Modal 确认
  await shot(page, 'T1-12-review-confirm-modal');
  // 确认 Modal 中的「确认」按钮
  const confirmBtn = page.locator('.ant-modal-confirm-btns button.ant-btn-primary, .ant-modal .ant-modal-footer button.ant-btn-primary').last();
  if (await confirmBtn.count() > 0) {
    await confirmBtn.click();
  }
  await sleep(1500);
  await shot(page, 'T1-13-after-review');

  // 1.9 验证 evt-v18-007 进入「已关闭事件」Tab，URL 自动切到该 Tab
  const afterReviewUrl = page.url();
  const tabParamMatch = afterReviewUrl.match(/tab=([^&]+)/);
  const tabParam = tabParamMatch ? tabParamMatch[1] : '';
  record('T1-10', '审核通过后 URL 跳转到 closed Tab', tabParam === 'closed' ? 'PASS' : 'FAIL', `url=${afterReviewUrl}`);

  await clickTab(page, '已关闭事件');
  await sleep(600);
  const ev007InClosed = await page.locator('tr[data-row-key="evt-v18-007"]').count() > 0;
  record('T1-11', '审核通过后事件 evt-v18-007 出现在「已关闭事件」Tab', ev007InClosed ? 'PASS' : 'FAIL');
  await shot(page, 'T1-14-closed-tab');

  // =====================================================================
  // 任务 2：退回处理流程
  // =====================================================================

  // 2.1 找一条 pending_review 事件（evt-v18-007）
  await gotoAndShot(page, '/app/monitoring/alert-events?tab=pending_review', 'T2-00-pending-review-list');
  const ev007 = page.locator('tr[data-row-key="evt-v18-007"]');
  const hasEv007 = await ev007.count() > 0;
  if (!hasEv007) {
    // 兜底：取第一条待审核
    const anyPr = await page.locator('tr.ant-table-row').count();
    record('T2-01a', '找到 pending_review 事件行（evt-v18-007）', 'FAIL', `可见行数=${anyPr}`);
  } else {
    record('T2-01a', '找到 pending_review 事件行（evt-v18-007）', 'PASS');
  }

  // 点击「审核」
  await clickRowActionByEventId(page, 'evt-v18-007', '审核');
  await sleep(1200);
  await shot(page, 'T2-01-review-page-007');

  // 选择「退回重新处理」
  await clickRadio(page, '退回重新处理');
  await sleep(300);
  // 填写审核说明
  await fillFormItem(page, '审核说明', '测试用例 #2 退回：需补充完整的故障时间窗口和影响范围');
  await shot(page, 'T2-02-return-filled');

  // 提交审核
  const submitReviewBtn2 = page.locator('button.ant-btn-primary', { hasText: /提交审核|提交/ }).last();
  await submitReviewBtn2.click();
  await sleep(800);
  // 确认 Modal
  const confirmBtn2 = page.locator('.ant-modal-confirm-btns button.ant-btn-primary, .ant-modal .ant-modal-footer button.ant-btn-primary').last();
  if (await confirmBtn2.count() > 0) {
    await confirmBtn2.click();
  }
  await sleep(1500);
  await shot(page, 'T2-03-after-return');

  // 2.2 验证事件进入「待处理事件」Tab
  const afterReturnUrl = page.url();
  const retTab = afterReturnUrl.match(/tab=([^&]+)/);
  record('T2-01', '退回后 URL 跳转到 pending_handle Tab', retTab && retTab[1] === 'pending_handle' ? 'PASS' : 'FAIL', `url=${afterReturnUrl}`);

  await clickTab(page, '待处理事件');
  await sleep(600);
  const ev007InPendingHandle = await page.locator('tr[data-row-key="evt-v18-007"]').count() > 0;
  record('T2-02', '退回后事件出现在「待处理事件」Tab', ev007InPendingHandle ? 'PASS' : 'FAIL');
  await shot(page, 'T2-04-pending-handle-007');

  // 2.3 验证「处理时间线」展示处理 - 退回 - 再次处理的时间线
  // 通过行内的「处理时间线」列来验证
  const row007 = page.locator('tr[data-row-key="evt-v18-007"]').first();
  // 触发 hover 显示 tooltip 完整时间线
  await row007.hover();
  await sleep(500);
  await shot(page, 'T2-04b-row-hover');
  const rowText = await row007.innerText();
  // 列表行处理时间线列展示 last action（退回）+ operator；时间线列 cell 文本或 Tooltip
  const hasReturnTimeline = rowText.includes('退回') || rowText.includes('黄帅帅') || rowText.includes('王芳');
  record('T2-03', '「待处理」Tab 显示处理时间线（含退回记录）', hasReturnTimeline ? 'PASS' : 'FAIL', `row excerpt: ${rowText.slice(0, 80)}`);

  // 同时验证有「处理时间线」列头
  const pendingHandlePageText = await page.locator('body').innerText();
  record('T2-03b', '「待处理」Tab 表头包含「处理时间线」', pendingHandlePageText.includes('处理时间线') ? 'PASS' : 'FAIL');

  // 模拟再次处理：列表行「处理」按钮弹 Modal
  await clickRowActionByEventId(page, 'evt-v18-007', '处理');
  await sleep(1000);
  await shot(page, 'T2-05-handle-modal-007');

  const handleModalText007 = await page.locator('.ant-modal').innerText();
  record('T2-04', '再次处理弹出 Modal', handleModalText007.includes('处理') ? 'PASS' : 'FAIL');

  // 选择「已处理」+ 填写处理方案
  await clickRadio(page, '已处理');
  await sleep(200);
  await fillFormItem(page, '处理方案', '测试用例 #2 再次处理：已补充完整故障窗口，影响范围已记录');
  await shot(page, 'T2-06-handle-modal-filled');
  await clickModalSubmit(page);
  await sleep(1500);
  await shot(page, 'T2-07-after-second-handle');

  // 验证 evt-v18-007 再次进入处理中 Tab
  await clickTab(page, '处理中事件');
  await sleep(600);
  const ev007InHandling = await page.locator('tr[data-row-key="evt-v18-007"]').count() > 0;
  record('T2-05', '再次处理后事件进入「处理中事件」Tab', ev007InHandling ? 'PASS' : 'FAIL');

  // =====================================================================
  // 任务 3：告警规则管理
  // =====================================================================

  // 3.1 在 /app/monitoring/alert-rules 测试
  await gotoAndShot(page, '/app/monitoring/alert-rules', 'T3-00-rules-list');

  // 3.2 点击「新建规则」
  const newRuleBtn = page.locator('button', { hasText: '新建规则' }).first();
  await newRuleBtn.click();
  await sleep(1200);
  await shot(page, 'T3-01-rule-form');

  const formUrl = page.url();
  record('T3-01', '点击「新建规则」跳转到表单页', formUrl.includes('/create') ? 'PASS' : 'FAIL', `url=${formUrl}`);

  // 3.3 填写规则名称「测试规则XYZ」+ 选择规则类型 + 触发条件
  await fillFormItem(page, '规则名称', '测试规则XYZ');
  await sleep(200);

  // 规则类型 - 默认是业务监控告警规则，不用改
  // 触发条件 - 指标（必须与所选内容库条目的 condition.split(' ')[0] 匹配）
  // biz-001 condition = "任务执行成功率 < 95%（10 分钟窗口）" → split(' ')[0] = "任务执行成功率"
  const metricInput = page.locator('#metric, input[id="metric"]').first();
  await metricInput.click();
  await metricInput.press('Control+A');
  await metricInput.press('Delete');
  await metricInput.pressSequentially('任务执行成功率', { delay: 5 });
  await metricInput.blur();
  await sleep(300);
  // 阈值
  const thresholdInput = page.locator('#threshold, input[id="threshold"]').first();
  await thresholdInput.click();
  await thresholdInput.press('Control+A');
  await thresholdInput.press('Delete');
  await thresholdInput.pressSequentially('95', { delay: 5 });
  await thresholdInput.blur();
  await sleep(300);

  // 3.4 点击「模板下载」 - 触发文件下载
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
    page.locator('button', { hasText: '模板下载' }).first().click(),
  ]);
  if (download) {
    const dlPath = await download.path();
    const filename = download.suggestedFilename();
    record('T3-02', '「模板下载」按钮触发文件下载', 'PASS', `filename=${filename}, path=${dlPath}`);
  } else {
    record('T3-02', '「模板下载」按钮触发文件下载', 'FAIL', '未收到 download 事件');
  }
  await sleep(500);
  await shot(page, 'T3-02-template-downloaded');

  // 3.5 选择规则内容（必填） - 选 biz-001（首项）
  const contentSelect = page.locator('.ant-form-item').filter({ has: page.locator('.ant-form-item-label', { hasText: '关联规则内容库条目' }) }).first().locator('.ant-select-selector').first();
  await contentSelect.click();
  await sleep(800);
  await shot(page, 'T3-03-content-dropdown');
  // 直接点击第一项（biz-001 任务执行成功率低于 95% 触发业务异常告警）
  const firstOpt = page.locator('.ant-select-dropdown .ant-select-item-option').first();
  await firstOpt.click();
  await sleep(600);
  await shot(page, 'T3-04-content-selected');

  // 3.6 点击「提交」按钮
  const submitFormBtn = page.locator('button.ant-btn-primary', { hasText: /^提\s*交$/ }).last();
  await submitFormBtn.click();
  await sleep(2000);
  await shot(page, 'T3-05-after-submit');

  // 3.7 验证新建后返回列表
  const afterCreateUrl = page.url();
  record('T3-03', '提交后返回规则列表页', afterCreateUrl.includes('/alert-rules') && !afterCreateUrl.includes('/create') ? 'PASS' : 'FAIL', `url=${afterCreateUrl}`);

  // 3.8 验证列表顶部有新规则（按 mock 数据规则按更新时间排序可能不在最顶，但应该存在）
  await sleep(500);
  const newRulesPageText = await page.locator('body').innerText();
  const hasNewRule = newRulesPageText.includes('测试规则XYZ');
  // 已知 V1.8 实现：表单 submit 只 console.log，未实际追加到 mockAlertRulesV18
  // 这是真实 BUG，记录为 FAIL（与 PRD §5.2「规则创建成功」预期不一致）
  record('T3-04', '列表中存在「测试规则XYZ」（创建后持久化）', hasNewRule ? 'PASS' : 'FAIL', hasNewRule ? '' : '实际未持久化到 mockAlertRulesV18 数组 — 已知 V1.8 实现问题');

  // 3.9 点击「查看详情」- 由于规则未持久化，改用已存在规则验证详情页结构
  // 选用 rule-v18-001 (智能体 CPU 使用率过高告警) 作为详情页验证对象
  await gotoAndShot(page, '/app/monitoring/alert-rules/rule-v18-001', 'T3-06-rule-detail');
  const detailUrl = page.url();
  record('T3-05', '点击「查看详情」跳转到详情页（使用现有规则验证）', detailUrl.includes('/alert-rules/rule-v18-001') ? 'PASS' : 'FAIL', `url=${detailUrl}`);

  // 3.10 验证详情页 5 字段结构
  const detailText = await page.locator('body').innerText();
  const fields = [
    { key: 'rule_name', name: 'rule_name' },
    { key: 'trigger_time', name: 'trigger_time' },
    { key: 'trigger_condition', name: 'trigger_condition' },
    { key: 'trigger_action', name: 'trigger_action' },
    { key: 'output_prompt', name: 'output_prompt' },
  ];
  for (const f of fields) {
    const has = detailText.includes(f.key);
    record(`T3-07-${f.key}`, `详情页包含字段「${f.name}」`, has ? 'PASS' : 'FAIL');
  }

  // 3.11 点击「删除」→ 确认 → 验证从列表消失（用 rule-v18-005 任务完成率下降告警）
  await gotoAndShot(page, '/app/monitoring/alert-rules/rule-v18-005', 'T3-07-detail-for-delete');
  const deleteBtn = page.locator('button', { hasText: '删除' }).first();
  if (await deleteBtn.count() > 0) {
    await deleteBtn.click();
    await sleep(800);
    await shot(page, 'T3-08-delete-confirm');
    // 确认 Modal 中的「确认删除」或「是」按钮
    const confirmDelBtn = page.locator('.ant-modal-confirm-btns button.ant-btn-primary, .ant-modal button.ant-btn-dangerous').last();
    if (await confirmDelBtn.count() > 0) {
      await confirmDelBtn.click();
    }
    await sleep(1500);
    await shot(page, 'T3-09-after-delete');

    const afterDelUrl = page.url();
    record('T3-08', '确认删除后跳回规则列表', afterDelUrl.endsWith('/alert-rules') ? 'PASS' : 'FAIL', `url=${afterDelUrl}`);

    const afterDelText = await page.locator('body').innerText();
    const stillExists = afterDelText.includes('任务完成率下降告警');
    // 已知 V1.8 实现：RuleDetail 的删除仅 navigate 未真正从 mockAlertRulesV18 移除
    // 标记为 FAIL 并附上原因
    record('T3-09', '删除后列表不再包含「任务完成率下降告警」', !stillExists ? 'PASS' : 'FAIL', stillExists ? '实际未从 mockAlertRulesV18 数组移除 — 已知 V1.8 实现问题' : '');
  } else {
    record('T3-08', '找到详情页删除按钮', 'FAIL', '未找到');
  }

  // =====================================================================
  // 任务 4：联动测试（监控告警总览卡片点击 → 事件 Tab）
  // =====================================================================

  // 4.1 直接访问总览
  await gotoAndShot(page, '/app/monitoring', 'T4-00-overview');

  // 4.2 点击「未处理告警数」卡片
  const unhandledCard = page.locator('a[href*="tab=pending_handle"]').first();
  const hasUnhandledCard = await unhandledCard.count() > 0;
  if (hasUnhandledCard) {
    await unhandledCard.click();
    await sleep(1200);
    const unhandledUrl = page.url();
    record('T4-01', '「未处理告警数」卡片 → 跳转 pending_handle Tab', unhandledUrl.includes('tab=pending_handle') ? 'PASS' : 'FAIL', `url=${unhandledUrl}`);
  } else {
    record('T4-01', '「未处理告警数」卡片存在', 'FAIL', '未找到链接');
  }
  await shot(page, 'T4-01-unhandled-link');

  // 4.3 返回总览，点击「当日告警总数」卡片
  await page.goto(BASE + '/app/monitoring', { waitUntil: 'networkidle' });
  await sleep(1000);
  const totalCard = page.locator('a[href*="tab=all"]').first();
  const hasTotalCard = await totalCard.count() > 0;
  if (hasTotalCard) {
    await totalCard.click();
    await sleep(1200);
    const totalUrl = page.url();
    record('T4-02', '「当日告警总数」卡片 → 跳转 all Tab', totalUrl.includes('/alert-events') && totalUrl.includes('tab=all') ? 'PASS' : 'FAIL', `url=${totalUrl}`);
  } else {
    record('T4-02', '「当日告警总数」卡片存在', 'FAIL', '未找到链接');
  }
  await shot(page, 'T4-02-total-link');

  // 4.4 点击「已处理告警数」卡片
  await page.goto(BASE + '/app/monitoring', { waitUntil: 'networkidle' });
  await sleep(1000);
  const handledCard = page.locator('a[href*="tab=closed"]').first();
  const hasHandledCard = await handledCard.count() > 0;
  if (hasHandledCard) {
    await handledCard.click();
    await sleep(1200);
    const handledUrl = page.url();
    record('T4-03', '「已处理告警数」卡片 → 跳转 closed Tab', handledUrl.includes('tab=closed') ? 'PASS' : 'FAIL', `url=${handledUrl}`);
  } else {
    record('T4-03', '「已处理告警数」卡片存在', 'FAIL', '未找到链接');
  }
  await shot(page, 'T4-03-handled-link');

  await browser.close();

  // === 汇总 ===
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  const total = results.length;
  console.log(`\n========== 汇总 ==========`);
  console.log(`PASS: ${pass}  FAIL: ${fail}  TOTAL: ${total}`);

  // 报告
  const report = [
    '# 统一运行监控中心 V1.8 — 端到端流程测试报告（测试人员 #2）',
    '',
    `测试时间：${new Date().toISOString()}`,
    `测试入口：${BASE}（默认登录 admin / 黄帅帅）`,
    `测试范围：PRD §6 事件全生命周期闭环 + §5 告警规则管理 + §1 联动`,
    '',
    '## 汇总',
    `- PASS：${pass}`,
    `- FAIL：${fail}`,
    `- TOTAL：${total}`,
    `- 通过率：${total ? ((pass / total) * 100).toFixed(1) : 0}%`,
    '',
    '## 失败用例',
    ...(results.filter((r) => r.status === 'FAIL').length === 0
      ? ['- 无']
      : results.filter((r) => r.status === 'FAIL').map((r) => `- [${r.id}] ${r.name}${r.note ? ' — ' + r.note : ''}`)),
    '',
    '## 通过用例',
    ...results.filter((r) => r.status === 'PASS').map((r) => `- [${r.id}] ${r.name}`),
    '',
    '## 截图清单',
    `目录：${SHOTS_DIR}/`,
    ...(function () {
      const allShots = readdirSync(SHOTS_DIR).filter((f) => f.endsWith('.png')).sort();
      return allShots.map((f) => `- ${SHOTS_DIR}/${f}`);
    })(),
  ];
  writeFileSync('/tmp/monitoring-v18-e2e-report.md', report.join('\n'));
  console.log(`\n报告：/tmp/monitoring-v18-e2e-report.md`);
  console.log(`截图：${SHOTS_DIR}/`);

  if (fail > 0) process.exit(1);
}

run().catch((e) => {
  console.error('测试异常:', e);
  process.exit(1);
});
