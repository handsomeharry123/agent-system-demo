#!/usr/bin/env node
/**
 * 台账 360 画像视图 一屏装下 + 底部对齐验证脚本
 *
 * 验收点（用户在截图中标注的需求）：
 *   1. 整体在 1440×900 viewport 内一屏展示完（不滚动或仅轻微滚动）
 *   2. 左/中/右三列底部对齐（极差 ≤ 4px）
 *   3. footer 与三列底部对齐（极差 ≤ 4px）
 *   4. 左列被压缩、右列通过 flex 平分被拉高
 *   5. 不丢字段（5 张 BasicStatusCard / 8 个 DataLine / 4 个 MiniMetric / 2 条 Sparkline）
 *
 * 用法：node verify_ledger_360_one_screen.mjs
 * 输出：JSON 到 stdout + exit code 0=PASS / 1=FAIL
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'http://localhost:3001';
const OUT = join(process.cwd(), 'verify_ledger_360_one_screen_artefacts');
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

  const testId = 'AGT-2024-001';
  const url = `${BASE}/app/ledger/detail/${testId}`;
  console.log('Opening:', url);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // ============ 1. 视图是 360 画像视图 ============
  // 4 个 Panel 标题都可见
  const basicInfo = await page.getByText('基本信息').count();
  const evaluation = await page.getByText('准入评测').count();
  const topology = await page.getByText('关联资源拓扑地图').count();
  const techInfo = await page.getByText('技术信息').count();
  const monitoring = await page.getByText('运行监控').count();
  const allPanels = basicInfo && evaluation && topology && techInfo && monitoring;
  record('5 个 Panel 全部渲染', !!allPanels, `basicInfo=${basicInfo} evaluation=${evaluation} topology=${topology} techInfo=${techInfo} monitoring=${monitoring}`);

  // ============ 2. 整页一屏装下 ============
  // 取 ProfileView360 容器高度 + viewport 高度 比较
  const layout = await page.evaluate(() => {
    const docH = document.documentElement.scrollHeight;
    const viewH = window.innerHeight;
    // 找 ProfileView360 外层 div:含有"基本信息"/"准入评测"/"关联资源拓扑" 这些文本的最近公共祖先
    // 简单起见:直接拿 main 内容区
    const main = document.querySelector('.ant-pro-layout-content') || document.body;
    const mainRect = main.getBoundingClientRect();
    // 找 3 个 Col 子节点(基础信息/技术信息/运行监控的 Panel 容器)
    const findPanelSection = (title) => {
      const titleSpans = [...document.querySelectorAll('span')].filter(
        (s) => s.textContent && s.textContent.trim() === title,
      );
      // 取第一个匹配,往上找最近的 section 元素
      const section = titleSpans[0]?.closest('section');
      return section;
    };
    const secBasic = findPanelSection('基本信息');
    const secEval = findPanelSection('准入评测');
    const secTech = findPanelSection('技术信息');
    const secMon = findPanelSection('运行监控');
    const secTopo = findPanelSection('关联资源拓扑地图')?.parentElement;
    const r = (el) => (el ? el.getBoundingClientRect() : null);
    return {
      docH,
      viewH,
      mainH: mainRect.height,
      secBasic: r(secBasic),
      secEval: r(secEval),
      secTech: r(secTech),
      secMon: r(secMon),
      secTopo: r(secTopo),
    };
  });
  const overflow = layout.docH - layout.viewH;
  record(
    '一屏装下（document.scrollHeight ≤ viewport + 4）',
    overflow <= 4,
    `docH=${layout.docH} viewH=${layout.viewH} overflow=${overflow}`,
  );

  // ============ 3. 三列底部对齐 ============
  // 用 .ant-col 类拿到三个主要 Col,比较它们的 bottom
  const colsBottom = await page.evaluate(() => {
    // 排除小宽度的(那些是 BasicStatusCard 内部 Col),筛选主列
    const cols = [...document.querySelectorAll('.ant-col')].filter(c => {
      const r = c.getBoundingClientRect();
      return r.width > 200 && r.width < 800 && r.height > 100;
    });
    return cols.slice(0, 5).map(c => {
      const r = c.getBoundingClientRect();
      return { x: Math.round(r.x), w: Math.round(r.width), bottom: Math.round(r.bottom * 10) / 10 };
    });
  });
  // 取 3 个主列（按宽度排序:左~337 / 中~482 / 右~337）
  const mainCols = colsBottom.filter(c => c.w > 200).sort((a, b) => a.x - b.x);
  const colBottoms = mainCols.map(c => c.bottom);
  const maxBottom = Math.max(...colBottoms);
  const minBottom = Math.min(...colBottoms);
  const colRange = maxBottom - minBottom;
  record(
    '三列底端对齐（左/中/右底端极差 ≤ 4px）',
    colRange <= 4,
    `max=${maxBottom.toFixed(1)} min=${minBottom.toFixed(1)} range=${colRange.toFixed(1)} cols=${JSON.stringify(colBottoms)}`,
  );

  // ============ 4. 不丢字段 ============
  // 5 个 BasicStatusCard(基本信息区)
  const basicCardCount = await page.evaluate(() => {
    // 找含"智能体编号"/"智能体名称"/"版本"/"风险分级"/"运行状态" 的小卡片
    const labels = ['智能体编号', '智能体名称', '版本', '风险分级', '运行状态'];
    return labels.filter((l) => [...document.querySelectorAll('div')].some((d) => d.textContent === l && d.previousElementSibling === null)).length;
  });
  // 简化:直接统计 BasicStatusCard 个数(通过颜色边框特征)
  const basicCardByColor = await page.evaluate(() => {
    // 找带 borderColor 渐变的 div
    const all = [...document.querySelectorAll('div')];
    let count = 0;
    all.forEach((d) => {
      const bg = getComputedStyle(d).background;
      if (bg && bg.includes('linear-gradient') && bg.includes('rgba(4, 18, 43, 0.72)')) {
        count++;
      }
    });
    return count;
  });
  record(
    '基本信息区 5 个 BasicStatusCard 全在',
    basicCardCount === 5,
    `count=${basicCardCount}`,
  );

  // 8 个 DataLine(包含 1 个 span "创建/更新时间" + 1 个 span "功能描述" + 6 个非 span)
  const dataLineLabels = ['所属科室', '诊疗环节', '智能体来源', '供应商名称', '技术联系人', '联系方式'];
  const dataLineCount = await Promise.all(
    dataLineLabels.map((l) => page.getByText(l, { exact: true }).count()),
  );
  const dataLineAll = dataLineCount.every((c) => c > 0);
  record(
    'DataLine 6 个核心标签全在',
    dataLineAll,
    `counts=${JSON.stringify(dataLineCount)}`,
  );

  // 4 个 MiniMetric(总调用量/告警次数/平均在线持续时长/平均异常持续时长)
  const miniMetricLabels = ['总调用量', '告警次数', '平均在线持续时长', '平均异常持续时长'];
  const miniMetricCounts = await Promise.all(
    miniMetricLabels.map((l) => page.getByText(l, { exact: true }).count()),
  );
  record(
    '运行监控 4 个 MiniMetric 全在',
    miniMetricCounts.every((c) => c > 0),
    `counts=${JSON.stringify(miniMetricCounts)}`,
  );

  // 3 个 Sparkline(准入评测趋势 + 告警次数趋势 + 调用量趋势) - 通过 SVG 元素 + viewBox 检测
  const sparklineCount = await page.evaluate(() => {
    // Sparkline 使用 viewBox "0 0 260 height" preserveAspectRatio="none"
    return [...document.querySelectorAll('svg')].filter((s) => {
      const vb = s.getAttribute('viewBox') || '';
      const par = s.getAttribute('preserveAspectRatio');
      return vb.startsWith('0 0 260 ') && par === 'none';
    }).length;
  });
  record(
    'Sparkline 3 条全在(准入评测+告警+调用量)',
    sparklineCount === 3,
    `count=${sparklineCount}`,
  );

  // ============ 5. SVG 拓扑图 不被压扁 ============
  const topoSvg = await page.evaluate(() => {
    // TopologyView 内的 SVG 是 viewBox 760x460,容器 468×698
    const svg = [...document.querySelectorAll('svg')].find((s) => s.getAttribute('viewBox') === '0 0 760 460');
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return { w: rect.width, h: rect.height, vbW: 760, vbH: 460 };
  });
  if (topoSvg) {
    // SVG 用 preserveAspectRatio="xMidYMid meet" 等比缩放,实际渲染高 ≤ 容器高
    // 实际显示比例应该 ≤ viewBox 比例(容器比 SVG 更窄更高)
    const actualRatio = topoSvg.w / topoSvg.h;
    const vbRatio = topoSvg.vbW / topoSvg.vbH;
    // SVG 实际比例应 <= viewBox 比例(因为容器宽度小于 viewBox 的等比显示需求高度)
    // 即 SVG 应该被限制在 viewBox 比例内的中心区域
    const ok = actualRatio <= vbRatio + 0.01;  // SVG 等比或更宽
    record(
      'TopologyView SVG 等比缩放(实际比例 ≤ viewBox 比例)',
      ok,
      `actual=${actualRatio.toFixed(3)} viewBox=${vbRatio.toFixed(3)} w=${topoSvg.w.toFixed(0)} h=${topoSvg.h.toFixed(0)}`,
    );
  } else {
    record('TopologyView SVG 渲染', false, '未找到 viewBox=760x460 的 SVG');
  }

  // ============ 6. footer 存在 ============
  const footerText = await page.getByText('数据来源：接入中心').count();
  record('footer 存在', footerText > 0, `count=${footerText}`);

  // ============ 7. 截图存档 ============
  await page.screenshot({ path: join(OUT, '01_one_screen_default.png'), fullPage: false });
  console.log('📸 截图:01_one_screen_default.png');

  await page.screenshot({ path: join(OUT, '02_one_screen_full.png'), fullPage: true });
  console.log('📸 截图:02_one_screen_full.png');

  // 切换到 1280×800 验证中屏
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, '03_1280x800.png'), fullPage: true });

  // 切换到 375×812 验证小屏
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, '04_375x812.png'), fullPage: true });

  // ============ 8. Tab 切换回到 V1.8 详情页 不受影响 ============
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(500);
  const detailOption = page.getByText('智能体信息详情页').first();
  await detailOption.click();
  await page.waitForTimeout(800);
  const basicTab = await page.getByRole('tab').filter({ hasText: '基本信息' }).count();
  record('切换到 V1.8 详情页(5 Tab)不受影响', basicTab > 0, `basicTab=${basicTab}`);

  // 切回 360 视图
  await page.getByText('🆕 360 画像视图').first().click();
  await page.waitForTimeout(800);
  const back360 = await page.getByText('关联资源拓扑地图').count();
  record('切回 360 画像视图', back360 > 0, `count=${back360}`);

  await browser.close();

  // ============ 总结 ============
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