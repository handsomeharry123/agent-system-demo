#!/usr/bin/env node
/**
 * 台账详情页 360 画像视图验证脚本
 *
 * 依据《台账中心智能化升级-需求说明V1》§3.2：
 *   - 详情页默认展示本次新增的「360 画像视图」
 *   - 区块：① 实体信息 / ② 关联资源拓扑 / ③ 准入评测 / ④ 运行监测
 *   - 关联资源拓扑:中央智能体 + 周围对接资源,异常连接醒目提示
 *   - 切换回原「智能体信息详情页」(V1.8 §2.2)
 *
 * 用法：node verify_ledger_360_view.mjs
 * 输出：JSON 到 stdout + exit code 0=PASS / 1=FAIL
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'http://localhost:5173';
const OUT = join(process.cwd(), 'verify_ledger_360_artefacts');
mkdirSync(OUT, { recursive: true });

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? '  -- ' + detail : ''}`);
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // 取一个已知有 evaluationReport + linkedResources 的智能体(优先影像类 — 触发 abnormal PACS)
  // AGT-2025-002 = DiagAssist-CARD-2.1 或 AGT-2025-005 = CTVision-RAD-1.5
  // 这两个 idCode 以 DiagAssist/CTVision 开头,会带 2 个资源(EMR + 异常 PACS)
  const testId = 'AGT-2025-005';
  const url = `${BASE}/app/ledger/detail/${testId}`;
  console.log('Opening:', url);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // 1) 页面标题 + 视图切换存在
  const headerText = await page.locator('h4').first().textContent().catch(() => '');
  record('页面标题渲染', !!headerText && headerText.length > 0, `header="${headerText}"`);

  // 2) 视图切换 Segmented 出现
  const segmentedCount = await page.locator('.ant-segmented').count();
  record('视图切换 Segmented 渲染', segmentedCount > 0, `count=${segmentedCount}`);

  // 3) 默认就是 360 画像视图:section 标题应包含 "① 实体信息"
  const sec1 = await page.getByText('① 实体信息').count();
  record('默认展示 360 画像视图(① 实体信息 区块存在)', sec1 > 0, `count=${sec1}`);

  // 4) 4 大区块全部渲染
  const sec2 = await page.getByText('② 关联资源拓扑').count();
  const sec3 = await page.getByText('③ 准入评测').count();
  const sec4 = await page.getByText('④ 运行监测').count();
  record('② 关联资源拓扑 区块存在', sec2 > 0, `count=${sec2}`);
  record('③ 准入评测 区块存在', sec3 > 0, `count=${sec3}`);
  record('④ 运行监测 区块存在', sec4 > 0, `count=${sec4}`);

  // 5) 关联资源拓扑:中心机器人 + 至少 2 个资源节点 + 异常醒目
  // SVG 节点名称按 9 字符截断,实际显示为 "电子病历系统 EM..." / "医学影像归档系统" + "..."
  const centerAgent = await page.locator('text=中心智能体').count();
  const emrText = await page.getByText(/电子病历系统 EM/).count();
  const pacsText = await page.getByText(/医学影像归档系统/).count();
  record('关联资源拓扑·EMR 节点', emrText > 0, `count=${emrText}`);
  record('关联资源拓扑·PACS 节点', pacsText > 0, `count=${pacsText}`);
  // 异常 PACS 应有 "对接异常" 文本
  const abnormal = await page.getByText(/对接异常/).count();
  record('异常连接醒目提示(对接异常)', abnormal > 0, `count=${abnormal}`);

  // 6) 准入评测区:综合总分 / 各维度得分 / 多次评测趋势
  const totalScore = await page.getByText(/综合总分/).count();
  const dimensions = await page.getByText(/安全性各维度得分/).count();
  const history = await page.getByText(/多次评测结果趋势/).count();
  record('准入评测·综合总分', totalScore > 0, `count=${totalScore}`);
  record('准入评测·各维度得分', dimensions > 0, `count=${dimensions}`);
  record('准入评测·多次评测趋势', history > 0, `count=${history}`);

  // 7) 运行监测:总调用量 / 正常运行率 / 告警 / 故障
  const callVolume = await page.getByText('总调用量').count();
  const onlineRate = await page.getByText('正常运行率').count();
  const alarm = await page.getByText(/告警\(预警/).count();
  const fault = await page.getByText(/故障\(中断/).count();
  record('运行监测·总调用量', callVolume > 0, `count=${callVolume}`);
  record('运行监测·正常运行率', onlineRate > 0, `count=${onlineRate}`);
  record('运行监测·告警(预警,较浅)', alarm > 0, `count=${alarm}`);
  record('运行监测·故障(中断,较重)', fault > 0, `count=${fault}`);

  // 8) 截屏存档
  await page.screenshot({ path: join(OUT, '01_360_default.png'), fullPage: true });
  console.log('📸 截图:01_360_default.png');

  // 9) 切换回"智能体信息详情页" → 5 个 Tab 出现
  const detailOption = page.getByText('智能体信息详情页').first();
  await detailOption.click();
  await page.waitForTimeout(800);
  const basicTab = await page.getByRole('tab').filter({ hasText: '基本信息' }).count();
  const techTab = await page.getByRole('tab').filter({ hasText: '技术信息' }).count();
  const filingTab = await page.getByRole('tab').filter({ hasText: '备案材料' }).count();
  const linkedTab = await page.getByRole('tab').filter({ hasText: '已对接资源信息' }).count();
  const evalTab = await page.getByRole('tab').filter({ hasText: '评测结果信息' }).count();
  const allFive = basicTab && techTab && filingTab && linkedTab && evalTab;
  record('切换到信息详情页(5 Tab)', allFive, `basic=${basicTab} tech=${techTab} filing=${filingTab} linked=${linkedTab} eval=${evalTab}`);

  await page.screenshot({ path: join(OUT, '02_info_detail.png'), fullPage: true });
  console.log('📸 截图:02_info_detail.png');

  // 10) 切回 360 画像视图
  await page.getByText('🆕 360 画像视图').first().click();
  await page.waitForTimeout(800);
  const sec1Again = await page.getByText('① 实体信息').count();
  record('切回 360 画像视图', sec1Again > 0, `count=${sec1Again}`);

  await browser.close();

  // 总结
  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  console.log(`\n========== ${passed}/${total} PASS ==========`);
  if (passed < total) {
    console.log('失败项:');
    results.filter((r) => !r.pass).forEach((r) => console.log(`  - ${r.name}: ${r.detail}`));
  }
  process.exit(passed === total ? 0 : 1);
}

run().catch((e) => {
  console.error('验证脚本执行失败:', e);
  process.exit(2);
});
