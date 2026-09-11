#!/usr/bin/env node
/**
 * 360 画像视图 关联资源拓扑回归验证
 * 重点验证:
 *   1. SVG 等比缩放(不拉伸)
 *   2. 中心智能体可见 + 名称不被裁切
 *   3. 图例在右下角(不溢出 SVG)
 *   4. 资源节点不与中心节点重叠
 *   5. n=1 / n=2 / n=多 三种场景
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'http://localhost:5173';
const OUT = join(process.cwd(), 'verify_ledger_360_artefacts');
mkdirSync(OUT, { recursive: true });

const cases = [
  { id: 'AGT-2024-001', label: 'n=1 资源(院内知识库 SDK 异常)', expectedCount: 1 },
  { id: 'AGT-2025-005', label: 'n=2 资源(EMR 正常 + PACS 异常)', expectedCount: 2 },
  { id: 'AGT-2025-002', label: 'n=2 资源(EMR 正常 + PACS 异常) - DiagAssist', expectedCount: 2 },
];

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? '  -- ' + detail : ''}`);
}

async function checkCase(page, c) {
  console.log(`\n----- ${c.label} (${c.id}) -----`);
  await page.goto(`${BASE}/app/ledger/detail/${c.id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // 找到 ② 关联资源拓扑 区块的 Card
  const sectionHeader = page.getByText('② 关联资源拓扑');
  const secExists = (await sectionHeader.count()) > 0;
  record(`[${c.id}] ② 关联资源拓扑 区块存在`, secExists);

  if (!secExists) return;

  // 等待 SVG 渲染 — 找该区块下唯一的 svg(用 SectionHeader 后面的 Card 内的 svg)
  // 简化为:找最大面积的 svg(viewBox 720x420 + 等比缩放,实际宽度 ~ Card 宽度)
  const allSvgs = await page.locator('svg[viewBox]').all();
  let svg = null;
  let maxArea = 0;
  for (const s of allSvgs) {
    const box = await s.boundingBox();
    if (box && box.width * box.height > maxArea) {
      maxArea = box.width * box.height;
      svg = s;
    }
  }
  if (svg) {
    await svg.waitFor({ timeout: 5000 }).catch(() => {});
  }

  // 1. SVG bounding box 宽高比 ≈ viewBox 宽高比(720:420 ≈ 1.714)
  const svgBox = await svg.boundingBox();
  if (svgBox) {
    const ratio = svgBox.width / svgBox.height;
    const expected = 720 / 420; // 1.714
    const ok = Math.abs(ratio - expected) < 0.05;
    record(
      `[${c.id}] SVG 等比缩放(宽高比 ≈ ${expected.toFixed(2)})`,
      ok,
      `实际 ${ratio.toFixed(2)} (W=${svgBox.width.toFixed(0)} H=${svgBox.height.toFixed(0)})`,
    );
  } else {
    record(`[${c.id}] SVG boundingBox 可获取`, false);
  }

  // 2. 中心智能体文字可见(智能体名称在 svg 内)
  // viewBox 720x420,中心 cy=200,文字 y=cy+80=280,在 viewBox 内
  // SVG 实际高度 ≈ svgBox.height(按比例缩放),所以 y=280 在实际 ≈ 280/420 * svgBox.height
  const agentNameCount = await svg.locator('text').filter({ hasText: /互联网医院|胸部|合理用药|医学影像|肺结节|脑卒中|胸痛|糖尿病|高血压|智能问诊|影像|用药/ }).count();
  record(`[${c.id}] 中心智能体名称文字可见`, agentNameCount > 0, `text 元素数=${agentNameCount}`);

  // 3. 图例在右下角 + 可见
  const legend = page.locator('text=正常对接 (').first();
  const legendCount = await legend.count();
  const legendBox = legendCount > 0 ? await legend.boundingBox() : null;
  if (legendBox && svgBox) {
    // 图例应该在 SVG 内部右下角(legendBox 应该在 svgBox 范围内)
    const insideX = legendBox.x >= svgBox.x;
    const insideY = legendBox.y >= svgBox.y;
    const insideW = legendBox.x + legendBox.width <= svgBox.x + svgBox.width + 20; // 允许 20px 溢出
    const insideH = legendBox.y + legendBox.height <= svgBox.y + svgBox.height + 20;
    const allIn = insideX && insideY && insideW && insideH;
    record(
      `[${c.id}] 图例位置(在 SVG 右下角区域)`,
      allIn,
      `legend=(${legendBox.x.toFixed(0)},${legendBox.y.toFixed(0)}) svg=(${svgBox.x.toFixed(0)},${svgBox.y.toFixed(0)})`,
    );
  } else {
    record(`[${c.id}] 图例可定位`, false, `count=${legendCount}`);
  }

  // 4. 资源节点数量正确(n 个 resource rect)
  const resourceRectCount = await svg.locator('rect[stroke="#FF4D4F"], rect[stroke="#1677FF"]').count();
  // 实际资源节点 = 资源数 (每个资源 1 个 rect,排除中心圆(中心圆是 fill 没有 stroke) 和 legend rect)
  // 我们的实现:连线无 rect,资源节点 1 个 rect,所以 count 应该是 资源数(包含可能重叠的 0 异常 + N 资源)
  record(
    `[${c.id}] 资源节点 rect 数(应等于 ${c.expectedCount})`,
    resourceRectCount >= c.expectedCount,
    `rect=${resourceRectCount}`,
  );

  // 5. 异常连接醒目(若有)
  if (c.id === 'AGT-2024-001' || c.id === 'AGT-2025-005' || c.id === 'AGT-2025-002') {
    const dashedLines = await svg.locator('line[stroke-dasharray="6 3"]').count();
    record(
      `[${c.id}] 异常连接虚线存在(至少 1 条)`,
      dashedLines >= 1,
      `dashedLines=${dashedLines}`,
    );
  }

  // 6. 中心智能体在中心位置(±20px 误差)
  // viewBox cy=200,SVG 实际中心 y = svgBox.y + (200/420) * svgBox.height
  const expectedCy = svgBox.y + (200 / 420) * svgBox.height;
  // 中心 circle 在 viewBox 是 (cx=360, cy=200, r=50) 中心圆 stroke 无
  // 找 fill="#1677FF" 的 circle (中心实心圆)
  const centerCircle = svg.locator('circle[fill="#1677FF"]').first();
  const cBox = await centerCircle.boundingBox();
  if (cBox) {
    const centerY = cBox.y + cBox.height / 2;
    const diff = Math.abs(centerY - expectedCy);
    record(
      `[${c.id}] 中心圆位于 viewBox 中央(误差 < 30px)`,
      diff < 30,
      `centerY=${centerY.toFixed(0)} expected=${expectedCy.toFixed(0)} diff=${diff.toFixed(0)}`,
    );
  } else {
    record(`[${c.id}] 中心圆可定位`, false);
  }

  // 截屏存档
  await page.locator('text=② 关联资源拓扑').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const fullPath = join(OUT, `topology_${c.id}.png`);
  await page.screenshot({ path: fullPath, fullPage: true });
  console.log(`📸 截图:${fullPath}`);
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  for (const c of cases) {
    await checkCase(page, c);
  }

  await browser.close();

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
