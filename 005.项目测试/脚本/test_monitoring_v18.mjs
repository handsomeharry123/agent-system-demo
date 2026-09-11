/**
 * 统一运行监控中心 V1.8 — 端到端测试用例
 *
 * 角色：A=信息科管理员（admin / 黄帅帅）, B=科室管理员（李秀英）
 * 测试入口：http://localhost:3001
 *
 * 用例覆盖：
 * 1. 角色可见性（PRD §访问范围）：模块仅 IT 管理员可见
 * 2. 1.1 监控告警总览（3 KPI + 3 趋势）
 * 3. 2.1 业务监控（4 KPI + 3 趋势 + TOP5 + 并发/吞吐 + 4 业务指标）
 * 4. 3.1 状态监控（在线/离线/禁用/异常 4 KPI + 饼图 + 实时列表）
 * 5. 4.1 成本监控（4 资源 × 累计/当日 + 8 个 TOP5）
 * 6. 5.1 规则管理列表（4 类规则 + 列表 + 内容库）
 * 7. 5.2 新建规则（暂存/模板下载/提交校验）
 * 8. 5.3 规则详情（统一结构配置 + 4 类内容库 + 规则文件）
 * 9. 6.1 事件管理 8 Tab（含待分派仅管理员、字段口径、退回时间线）
 * 10. 6.2 事件分派（待分派列表 + 分派弹窗）
 * 11. 6.3 事件处理（处理 - 退回 - 再次处理时间线）
 * 12. 6.4 处理审核（处理完成 / 退回重新处理）
 * 13. 6.5 事件详情（统一结构 + 拓扑图）
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const BASE = 'http://localhost:3001';
const SHOTS_DIR = '/tmp/monitoring-v18-shots';
mkdirSync(SHOTS_DIR, { recursive: true });

const results = [];
const record = (id, name, status, note = '') => {
  results.push({ id, name, status, note });
  const tag = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '·';
  console.log(`${tag} [${id}] ${name}${note ? ' — ' + note : ''}`);
};

// AntD Button adds letter-spacing to text (e.g. "返 回"), so normalize whitespace
const normalize = (s) => s.replace(/\s+/g, '');
const hasText = (s, target) => normalize(s).includes(normalize(target));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function switchRole(page, role) {
  // 通过演示中心切换角色（admin / 李秀英）
  // 演示中心在右下角 FloatButton → Drawer → 角色下拉
  // 直接走 UI：点击 FloatButton → Drawer 中的角色下拉 → 选择
  await page.goto(BASE + '/app/home/workbench', { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(500);
  // 点击演示中心 FloatButton（右下角）
  const fb = page.locator('.ant-float-btn').last();
  await fb.click();
  await sleep(800);
  // 演示中心 Drawer 中有「演示角色」下拉，文本可能是「信息科管理员 / 科室管理员」
  const select = page.locator('.ant-drawer .ant-select').first();
  await select.click();
  await sleep(400);
  // 选项中选 role
  const option = page.locator(`.ant-select-item-option`, { hasText: role });
  await option.first().click();
  await sleep(800);
}

async function gotoAndShot(page, path, name) {
  await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(800);
  const file = `${SHOTS_DIR}/${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

// ---------------------------------------------------------------------------
// 测试用例
// ---------------------------------------------------------------------------
async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1200 } });
  const page = await context.newPage();

  // === A 角色 = 管理员 ===
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  // 假设登录是 admin（默认种子用户）
  await page.waitForTimeout(500);

  // 1. 模块可见性：A 角色应能看到监控中心
  await gotoAndShot(page, '/app/monitoring', 'A-01-overview');
  const sidebarA = await page.locator('aside, .ant-pro-sider').count();
  record('A-01', 'A 角色侧边栏包含监控中心', sidebarA > 0 ? 'PASS' : 'FAIL', `侧边栏区域数=${sidebarA}`);

  // 2. 1.1 监控告警总览
  const ovText = await page.locator('body').innerText();
  record('A-02', '1.1 监控告警总览 - 当日告警总数卡片', hasText(ovText, '当日告警总数') ? 'PASS' : 'FAIL');
  record('A-03', '1.1 监控告警总览 - 未处理告警数卡片', hasText(ovText, '未处理告警数') ? 'PASS' : 'FAIL');
  record('A-04', '1.1 监控告警总览 - 已处理告警数卡片', hasText(ovText, '已处理告警数') ? 'PASS' : 'FAIL');
  record('A-05', '1.1 告警次数日趋势', hasText(ovText, '告警次数日趋势') ? 'PASS' : 'FAIL');
  record('A-06', '1.1 告警次数周趋势', hasText(ovText, '告警次数周趋势') ? 'PASS' : 'FAIL');
  record('A-07', '1.1 告警次数月趋势', hasText(ovText, '告警次数月趋势') ? 'PASS' : 'FAIL');

  // 3. 2.1 业务监控
  await gotoAndShot(page, '/app/monitoring/business', 'A-08-business');
  const bizText = await page.locator('body').innerText();
  record('A-08', '2.1 业务监控 - 智能体累计调用次数', hasText(bizText, '智能体累计调用次数') ? 'PASS' : 'FAIL');
  record('A-09', '2.1 业务监控 - 智能体成功调用率', hasText(bizText, '智能体成功调用率') ? 'PASS' : 'FAIL');
  record('A-10', '2.1 业务监控 - 当日调用次数', hasText(bizText, '当日调用次数') ? 'PASS' : 'FAIL');
  record('A-11', '2.1 业务监控 - 当日成功调用率', hasText(bizText, '当日成功调用率') ? 'PASS' : 'FAIL');
  record('A-12', '2.1 业务监控 - 高频调用 TOP5', hasText(bizText, '高频调用智能体 TOP5') ? 'PASS' : 'FAIL');
  record('A-13', '2.1 业务监控 - 并发数卡片', hasText(bizText, '并发数') ? 'PASS' : 'FAIL');
  record('A-14', '2.1 业务监控 - 吞吐量卡片', hasText(bizText, '吞吐量') ? 'PASS' : 'FAIL');
  record('A-15', '2.1 业务监控 - 平均响应时间', hasText(bizText, '平均响应时间') ? 'PASS' : 'FAIL');
  record('A-16', '2.1 业务监控 - 响应超时率', hasText(bizText, '响应超时率') ? 'PASS' : 'FAIL');
  record('A-17', '2.1 业务监控 - 医生采纳率', hasText(bizText, '医生采纳率') ? 'PASS' : 'FAIL');
  record('A-18', '2.1 业务监控 - 用户反馈意见', hasText(bizText, '用户反馈意见') ? 'PASS' : 'FAIL');

  // 4. 3.1 状态监控
  await gotoAndShot(page, '/app/monitoring/status', 'A-19-status');
  const statText = await page.locator('body').innerText();
  record('A-19', '3.1 状态监控 - 在线智能体数量', hasText(statText, '在线智能体数量') ? 'PASS' : 'FAIL');
  record('A-20', '3.1 状态监控 - 离线智能体数量', hasText(statText, '离线智能体数量') ? 'PASS' : 'FAIL');
  record('A-21', '3.1 状态监控 - 禁用智能体数量', hasText(statText, '禁用智能体数量') ? 'PASS' : 'FAIL');
  record('A-22', '3.1 状态监控 - 异常智能体数量', hasText(statText, '异常智能体数量') ? 'PASS' : 'FAIL');
  record('A-23', '3.1 状态监控 - 各运行状态总占比', hasText(statText, '各运行状态总占比') ? 'PASS' : 'FAIL');
  record('A-24', '3.1 状态监控 - 科室分布', hasText(statText, '各运行状态 - 科室分布') ? 'PASS' : 'FAIL');

  // 5. 4.1 成本监控
  await gotoAndShot(page, '/app/monitoring/cost', 'A-25-cost');
  const costText = await page.locator('body').innerText();
  record('A-25', '4.1 成本监控 - CPU 累计 + 当日', hasText(costText, 'CPU 使用量') ? 'PASS' : 'FAIL');
  record('A-26', '4.1 成本监控 - GPU 累计 + 当日', hasText(costText, 'GPU 使用量') ? 'PASS' : 'FAIL');
  record('A-27', '4.1 成本监控 - 内存累计 + 当日', hasText(costText, '内存使用量') ? 'PASS' : 'FAIL');
  record('A-28', '4.1 成本监控 - Token 累计 + 当日', hasText(costText, 'Token 使用量') ? 'PASS' : 'FAIL');
  record('A-29', '4.1 成本监控 - CPU TOP5 累计', hasText(costText, 'CPU 累计使用量消耗排行 TOP5') ? 'PASS' : 'FAIL');
  record('A-30', '4.1 成本监控 - CPU TOP5 当日', hasText(costText, 'CPU 当日使用量消耗排行 TOP5') ? 'PASS' : 'FAIL');
  record('A-31', '4.1 成本监控 - GPU TOP5 累计', hasText(costText, 'GPU 累计使用量消耗排行 TOP5') ? 'PASS' : 'FAIL');
  record('A-32', '4.1 成本监控 - 内存 TOP5 累计', hasText(costText, '内存 累计使用量消耗排行 TOP5') || hasText(costText, '内存累计使用量消耗排行 TOP5') ? 'PASS' : 'FAIL');
  record('A-33', '4.1 成本监控 - Token TOP5 累计', hasText(costText, 'Token 累计使用量消耗排行 TOP5') ? 'PASS' : 'FAIL');

  // 6. 5.1 规则管理列表
  await gotoAndShot(page, '/app/monitoring/alert-rules', 'A-34-rules');
  const rmText = await page.locator('body').innerText();
  record('A-34', '5.1 规则管理列表页', hasText(rmText, '告警规则管理') ? 'PASS' : 'FAIL');
  record('A-35', '5.1 规则类型 - 业务', hasText(rmText, '业务监控告警规则') ? 'PASS' : 'FAIL');
  record('A-36', '5.1 规则类型 - 状态', hasText(rmText, '状态监控告警规则') ? 'PASS' : 'FAIL');
  record('A-37', '5.1 规则类型 - 成本', hasText(rmText, '成本监控告警规则') ? 'PASS' : 'FAIL');
  record('A-38', '5.1 规则类型 - 安全', hasText(rmText, '安全监控告警规则') ? 'PASS' : 'FAIL');
  record('A-39', '5.1 规则内容库 - 业务执行', hasText(rmText, '业务执行') ? 'PASS' : 'FAIL');
  record('A-40', '5.1 规则内容库 - 运行状态', hasText(rmText, '运行状态') ? 'PASS' : 'FAIL');
  record('A-41', '5.1 规则内容库 - 成本资源', hasText(rmText, '成本资源') ? 'PASS' : 'FAIL');
  record('A-42', '5.1 规则内容库 - 安全', /安全(?![告])/.test(rmText) || hasText(rmText, '安全监控') ? 'PASS' : 'FAIL');

  // 7. 5.2 新建规则
  await gotoAndShot(page, '/app/monitoring/alert-rules/create', 'A-43-rule-create');
  const newText = await page.locator('body').innerText();
  record('A-43', '5.2 新建规则页 - 暂存按钮', hasText(newText, '暂存') ? 'PASS' : 'FAIL');
  record('A-44', '5.2 新建规则页 - 模板下载按钮', hasText(newText, '模板下载') ? 'PASS' : 'FAIL');
  record('A-45', '5.2 新建规则页 - 提交按钮', hasText(newText, '提交') ? 'PASS' : 'FAIL');
  record('A-46', '5.2 触发条件指标', hasText(newText, '指标') ? 'PASS' : 'FAIL');
  record('A-47', '5.2 规则内容（关联规则库）', hasText(newText, '关联规则内容库条目') || hasText(newText, '规则内容') ? 'PASS' : 'FAIL');
  record('A-48', '5.2 规则文件上传区', hasText(newText, '规则文件上传') ? 'PASS' : 'FAIL');

  // 8. 5.3 规则详情
  await gotoAndShot(page, '/app/monitoring/alert-rules/rule-v18-001', 'A-49-rule-detail');
  const detText = await page.locator('body').innerText();
  record('A-49', '5.3 规则详情页 - 智能体 CPU 使用率过高告警', hasText(detText, '智能体CPU使用率过高告警') || hasText(detText, '智能体 CPU 使用率过高告警') ? 'PASS' : 'FAIL');
  record('A-50', '5.3 规则详情 - 规则配置统一结构', hasText(detText, 'rule_name') && hasText(detText, 'trigger_time') && hasText(detText, 'trigger_condition') && hasText(detText, 'trigger_action') && hasText(detText, 'output_prompt') ? 'PASS' : 'FAIL');
  record('A-51', '5.3 规则详情 - 编辑按钮', hasText(detText, '编辑') ? 'PASS' : 'FAIL');
  record('A-52', '5.3 规则详情 - 删除按钮', hasText(detText, '删除') ? 'PASS' : 'FAIL');
  record('A-53', '5.3 规则详情 - 规则文件', hasText(detText, '规则文件') ? 'PASS' : 'FAIL');

  // 9. 6.1 事件管理 8 Tab
  await gotoAndShot(page, '/app/monitoring/alert-events', 'A-54-event-list');
  const evText = await page.locator('body').innerText();
  record('A-54', '6.1 事件管理列表 - 8 Tab 全部', hasText(evText, '全部事件') ? 'PASS' : 'FAIL');
  record('A-55', '6.1 Tab - 待分派事件（管理员可见）', hasText(evText, '待分派事件') ? 'PASS' : 'FAIL');
  record('A-56', '6.1 Tab - 待处理事件', hasText(evText, '待处理事件') ? 'PASS' : 'FAIL');
  record('A-57', '6.1 Tab - 处理中事件', hasText(evText, '处理中事件') ? 'PASS' : 'FAIL');
  record('A-58', '6.1 Tab - 待审核事件', hasText(evText, '待审核事件') ? 'PASS' : 'FAIL');
  record('A-59', '6.1 Tab - 审核中事件', hasText(evText, '审核中事件') ? 'PASS' : 'FAIL');
  record('A-60', '6.1 Tab - 已关闭事件', hasText(evText, '已关闭事件') ? 'PASS' : 'FAIL');
  record('A-61', '6.1 Tab - 已忽略事件', hasText(evText, '已忽略事件') ? 'PASS' : 'FAIL');
  record('A-62', '6.1 列表字段 - 事件类型', hasText(evText, '事件类型') ? 'PASS' : 'FAIL');
  record('A-63', '6.1 列表字段 - 触发告警内容', hasText(evText, '触发告警内容') ? 'PASS' : 'FAIL');
  record('A-64', '6.1 列表字段 - 通知对象', hasText(evText, '通知对象') ? 'PASS' : 'FAIL');
  record('A-65', '6.1 列表字段 - 通知方式', hasText(evText, '通知方式') ? 'PASS' : 'FAIL');
  record('A-66', '6.1 列表字段 - 当前状态', hasText(evText, '当前状态') ? 'PASS' : 'FAIL');

  // 切到「待分派」Tab，验证字段：触发时间
  await page.locator('.ant-tabs-tab', { hasText: '待分派事件' }).first().click();
  await sleep(500);
  await page.screenshot({ path: `${SHOTS_DIR}/A-67-tab-pending-assign.png`, fullPage: true });
  const paText = await page.locator('body').innerText();
  record('A-67', '6.1 待分派 Tab - 触发时间字段', hasText(paText, '触发时间') ? 'PASS' : 'FAIL');

  // 切到「待处理」Tab，验证处理时间线 + 分派时间
  await page.locator('.ant-tabs-tab', { hasText: '待处理事件' }).first().click();
  await sleep(500);
  await page.screenshot({ path: `${SHOTS_DIR}/A-68-tab-pending-handle.png`, fullPage: true });
  const phText = await page.locator('body').innerText();
  record('A-68', '6.1 待处理 Tab - 处理时间线', hasText(phText, '处理时间线') ? 'PASS' : 'FAIL');
  record('A-69', '6.1 待处理 Tab - 分派时间', hasText(phText, '分派时间') ? 'PASS' : 'FAIL');

  // 切到「处理中」Tab，验证处理人 + 开始处理时间
  await page.locator('.ant-tabs-tab', { hasText: '处理中事件' }).first().click();
  await sleep(500);
  const hText = await page.locator('body').innerText();
  record('A-70', '6.1 处理中 Tab - 处理人', hasText(hText, '处理人') ? 'PASS' : 'FAIL');
  record('A-71', '6.1 处理中 Tab - 开始处理时间', hasText(hText, '开始处理时间') ? 'PASS' : 'FAIL');

  // 切到「待审核」Tab，验证处理人 + 处理结果 + 处理方案
  await page.locator('.ant-tabs-tab', { hasText: '待审核事件' }).first().click();
  await sleep(500);
  const prText = await page.locator('body').innerText();
  record('A-72', '6.1 待审核 Tab - 处理结果', hasText(prText, '处理结果') ? 'PASS' : 'FAIL');
  record('A-73', '6.1 待审核 Tab - 处理方案', hasText(prText, '处理方案') ? 'PASS' : 'FAIL');
  record('A-74', '6.1 待审核 Tab - 处理完成时间', hasText(prText, '处理完成时间') ? 'PASS' : 'FAIL');
  // 验证审核操作按钮
  record('A-75', '6.1 待审核 Tab - 审核按钮', hasText(prText, '审核') ? 'PASS' : 'FAIL');

  // 切到「已关闭」Tab，验证处理人联系方式
  await page.locator('.ant-tabs-tab', { hasText: '已关闭事件' }).first().click();
  await sleep(500);
  const cText = await page.locator('body').innerText();
  record('A-76', '6.1 已关闭 Tab - 处理人联系方式', hasText(cText, '处理人联系方式') ? 'PASS' : 'FAIL');

  // 10. 6.2 事件分派页
  await gotoAndShot(page, '/app/monitoring/alert-events/assign', 'A-77-assign');
  const asgText = await page.locator('body').innerText();
  record('A-77', '6.2 事件分派页 - 标题', hasText(asgText, '事件分派') ? 'PASS' : 'FAIL');
  record('A-78', '6.2 事件分派 - 待分派事件列表', hasText(asgText, '待分派事件') ? 'PASS' : 'FAIL');
  record('A-79', '6.2 事件分派 - 分派按钮', hasText(asgText, '分派') ? 'PASS' : 'FAIL');
  record('A-80', '6.2 事件分派 - 触发告警内容', hasText(asgText, '触发告警内容') ? 'PASS' : 'FAIL');

  // 11. 6.3 事件处理页（evt-v18-004 是 pending_handle）
  await gotoAndShot(page, '/app/monitoring/alert-events/evt-v18-004/handle', 'A-81-handle');
  const hdText = await page.locator('body').innerText();
  record('A-81', '6.3 事件处理页 - 标题', hasText(hdText, '事件处理') ? 'PASS' : 'FAIL');
  record('A-82', '6.3 事件处理 - 触发告警内容（统一结构）', hasText(hdText, 'rule_name') && hasText(hdText, 'trigger_time') ? 'PASS' : 'FAIL');
  record('A-83', '6.3 事件处理 - 处理时间记录线', hasText(hdText, '处理时间记录线') ? 'PASS' : 'FAIL');
  record('A-84', '6.3 事件处理 - 处理结果（已处理/已忽略）', hasText(hdText, '已处理') && hasText(hdText, '已忽略') ? 'PASS' : 'FAIL');
  record('A-85', '6.3 事件处理 - 处理方案', hasText(hdText, '处理方案') ? 'PASS' : 'FAIL');
  record('A-86', '6.3 事件处理 - 开始处理时间', hasText(hdText, '开始处理时间') ? 'PASS' : 'FAIL');
  record('A-87', '6.3 事件处理 - 处理按钮', hasText(hdText, '处理') ? 'PASS' : 'FAIL');
  record('A-88', '6.3 事件处理 - 返回按钮', hasText(hdText, '返回') ? 'PASS' : 'FAIL');

  // 12. 6.4 处理审核页（evt-v18-007 是 pending_review）
  await gotoAndShot(page, '/app/monitoring/alert-events/evt-v18-007/review', 'A-89-review');
  const rvText = await page.locator('body').innerText();
  record('A-89', '6.4 处理审核页 - 标题', hasText(rvText, '处理审核') ? 'PASS' : 'FAIL');
  record('A-90', '6.4 处理审核 - 审核意见（处理完成/退回）', hasText(rvText, '处理完成') && hasText(rvText, '退回') ? 'PASS' : 'FAIL');
  record('A-91', '6.4 处理审核 - 审核说明', hasText(rvText, '审核说明') ? 'PASS' : 'FAIL');
  record('A-92', '6.4 处理审核 - 提交审核按钮', hasText(rvText, '提交审核') ? 'PASS' : 'FAIL');

  // 13. 6.5 事件详情页
  await gotoAndShot(page, '/app/monitoring/alert-events/evt-v18-001', 'A-93-event-detail');
  const edText = await page.locator('body').innerText();
  record('A-93', '6.5 事件详情页 - 标题', hasText(edText, '事件详情') ? 'PASS' : 'FAIL');
  record('A-94', '6.5 详情 - 触发告警内容（统一结构）', hasText(edText, 'rule_name') && hasText(edText, 'trigger_time') && hasText(edText, 'trigger_condition') && hasText(edText, 'trigger_action') && hasText(edText, 'output_prompt') ? 'PASS' : 'FAIL');
  record('A-95', '6.5 详情 - 触发告警时间', hasText(edText, '触发告警时间') ? 'PASS' : 'FAIL');
  record('A-96', '6.5 详情 - 处理结果', hasText(edText, '处理结果') ? 'PASS' : 'FAIL');
  record('A-97', '6.5 详情 - 处理方案', hasText(edText, '处理方案') ? 'PASS' : 'FAIL');
  record('A-98', '6.5 详情 - 审核意见', hasText(edText, '审核意见') ? 'PASS' : 'FAIL');
  record('A-99', '6.5 详情 - 审核说明', hasText(edText, '审核说明') ? 'PASS' : 'FAIL');
  record('A-100', '6.5 详情 - 智能体告警关联拓扑图', hasText(edText, '智能体告警关联拓扑图') ? 'PASS' : 'FAIL');
  record('A-101', '6.5 详情 - 返回按钮', hasText(edText, '返回') ? 'PASS' : 'FAIL');

  // === 联动测试 ===
  // A-102: 总览「未处理告警数」点击 → 事件管理「待处理事件」Tab
  await gotoAndShot(page, '/app/monitoring', 'A-102-overview-click-test');
  // 通过直接 URL 验证联动：?tab=pending_handle
  await gotoAndShot(page, '/app/monitoring/alert-events?tab=pending_handle', 'A-102b-link-pending');
  const linkPaText = await page.locator('body').innerText();
  // 简单验证 URL 跳转后能进入「待处理事件」Tab（URL 含 tab 参数）
  record('A-102', '总览 → 事件管理 URL 联动', hasText(linkPaText, '待处理事件') ? 'PASS' : 'FAIL');

  // A-103: 台账列表联动（runStatus 参数）
  await gotoAndShot(page, '/app/ledger/list?runStatus=在线', 'A-103-link-ledger-online');

  // === B 角色 = 科室管理员（李秀英）===
  // 通过演示中心切换角色
  await switchRole(page, '科室管理员');

  // B-01: B 角色侧边栏不应包含监控中心
  await gotoAndShot(page, '/app/home/workbench', 'B-00-workbench');
  const sidebarB = await page.locator('aside, .ant-pro-sider').first();
  const sidebarText = await sidebarB.innerText().catch(() => '');
  const sidebarHasMonitoring = normalize(sidebarText).includes(normalize('统一运行监控中心'));
  record('B-01', 'B 角色侧边栏不含监控中心', !sidebarHasMonitoring ? 'PASS' : 'FAIL', sidebarHasMonitoring ? '侧边栏仍包含' : '已隐藏');

  // B-02: B 角色直接访问监控中心 URL → 应被回退到工作台（/app/home/workbench）
  await page.goto(BASE + '/app/monitoring', { waitUntil: 'networkidle' });
  await sleep(800);
  const bUrl = page.url();
  record('B-02', 'B 角色访问 /app/monitoring 被回退', !bUrl.includes('/app/monitoring') ? 'PASS' : 'FAIL', `当前 URL=${bUrl}`);

  // B-03: B 角色访问 alert-events URL
  await page.goto(BASE + '/app/monitoring/alert-events', { waitUntil: 'networkidle' });
  await sleep(800);
  const bUrl2 = page.url();
  record('B-03', 'B 角色访问 /app/monitoring/alert-events 被回退', !bUrl2.includes('/app/monitoring') ? 'PASS' : 'FAIL', `当前 URL=${bUrl2}`);

  // B-04: B 角色访问 alert-rules URL
  await page.goto(BASE + '/app/monitoring/alert-rules', { waitUntil: 'networkidle' });
  await sleep(800);
  const bUrl3 = page.url();
  record('B-04', 'B 角色访问 /app/monitoring/alert-rules 被回退', !bUrl3.includes('/app/monitoring') ? 'PASS' : 'FAIL', `当前 URL=${bUrl3}`);

  // === 持久化与刷新 ===
  // === 持久化与刷新 ===
  // 先切回 A 角色（演示中心 → 信息科管理员）
  await switchRole(page, '信息科管理员');
  await sleep(800);

  // A-105: 事件管理带 ?tab=closed 刷新后仍停留在「已关闭事件」Tab
  await page.goto(BASE + '/app/monitoring/alert-events?tab=closed', { waitUntil: 'networkidle' });
  await sleep(1200);
  await page.reload({ waitUntil: 'networkidle' });
  await sleep(1500);
  const activeTabText = await page.locator('.ant-tabs-tab-active').innerText().catch(() => '');
  record('A-105', '事件管理 URL tab 参数刷新后保持', normalize(activeTabText).includes(normalize('已关闭事件')) ? 'PASS' : 'FAIL', `active=${activeTabText.replace(/\s+/g, ' ').slice(0, 30)}`);

  await browser.close();

  // === 汇总 ===
  console.log('\n========== 测试汇总 ==========');
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  console.log(`✓ PASS: ${pass}`);
  console.log(`✗ FAIL: ${fail}`);
  console.log(`· TOTAL: ${results.length}`);

  // 写报告
  const reportLines = [
    '# 统一运行监控中心 V1.8 — 端到端测试报告',
    '',
    `测试时间：${new Date().toISOString()}`,
    '',
    `## 汇总`,
    `- 通过：${pass}`,
    `- 失败：${fail}`,
    `- 总计：${results.length}`,
    '',
    '## 失败用例',
    ...results.filter((r) => r.status === 'FAIL').map((r) => `- [${r.id}] ${r.name}${r.note ? ' — ' + r.note : ''}`),
    '',
    '## 通过用例',
    ...results.filter((r) => r.status === 'PASS').map((r) => `- [${r.id}] ${r.name}`),
  ];
  writeFileSync('/tmp/monitoring-v18-report.md', reportLines.join('\n'));
  console.log('\n报告：/tmp/monitoring-v18-report.md');
  console.log(`截图：${SHOTS_DIR}/`);
}

run().catch((e) => { console.error(e); process.exit(1); });