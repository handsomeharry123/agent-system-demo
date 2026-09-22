#!/usr/bin/env node
/**
 * Agent 对话窗口宽度 480 — Demo 路由验证脚本（2026-07-03）
 *
 * 覆盖范围:
 *   1) /app/ledger-demo/overview — 点击中央蓝色"医小管"按钮唤起 ChatPanel
 *   2) /app/ledger-demo/report   — 该页不带 ChatPanel(导航目标页), 仅核对页面正常加载
 *   3) 浮层宽度必须 = 480(±1 px 渲染容差)
 *
 * 背景: ChatPanelV31 同步抬到 480, Demo overview 是唯一渲染 ChatPanel 的 Demo 路由;
 *       Report 路由虽不弹窗, 也跑一次, 防止 ReportV33.tsx 内 width 字段与新值冲突。
 *
 * 用法: node verify_chat_panel_width_480_demo.mjs
 * 输出: 控制台 PASS/FAIL + 截图到 verify_chat_panel_width_480_demo_artefacts/
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173';
const VIEWPORT = { width: 1440, height: 900 };
const EXPECTED_WIDTH = 480;
const TOLERANCE = 1;

const OUT = join(process.cwd(), 'verify_chat_panel_width_480_demo_artefacts');
mkdirSync(OUT, { recursive: true });

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? '  -- ' + detail : ''}`);
}

async function measurePanel(page, placeholder) {
  return await page.evaluate((ph) => {
    const ta = document.querySelector(`textarea[placeholder*="${ph}"]`);
    if (!ta) return { found: false };
    let p = ta.parentElement;
    for (let i = 0; i < 10 && p; i++) {
      if (p.style && p.style.position === 'fixed') {
        const r = p.getBoundingClientRect();
        return {
          found: true,
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      }
      p = p.parentElement;
    }
    return { found: false };
  }, placeholder);
}

async function runOverview(browser) {
  console.log('\n====== Demo /app/ledger-demo/overview ======');
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(`${BASE}/app/ledger-demo/overview`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // Demo overview 中央蓝色圆形按钮唤起(不是可拖拽机器人 icon)
  // title="点击唤起医小管对话窗口" — 唯一选它
  const btn = page.locator('div[title="点击唤起医小管对话窗口"]').first();
  await btn.waitFor({ state: 'visible' });
  await btn.click({ force: true });
  await page.waitForTimeout(700);

  const m = await measurePanel(page, '描述你想了解的台账信息');
  await page.screenshot({ path: join(OUT, 'demo-overview-chat.png') });
  record(
    '[1] Demo overview ChatPanel 已展开',
    m.found,
    m.found ? `x=${m.x} y=${m.y} w=${m.w} h=${m.h}` : '未找到 textarea',
  );
  if (!m.found) {
    await page.close();
    return;
  }
  const diff = Math.abs(m.w - EXPECTED_WIDTH);
  record(
    `[2] Demo overview ChatPanel width = ${EXPECTED_WIDTH}px`,
    diff <= TOLERANCE,
    `实测 ${m.w}px, 偏差 ${diff}px (容差 ${TOLERANCE}px)`,
  );
  await page.close();
}

async function runReport(browser) {
  console.log('\n====== Demo /app/ledger-demo/report ======');
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(`${BASE}/app/ledger-demo/report`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT, 'demo-report.png') });

  // Report 页不应有 ChatPanel(不是浮窗路由, 是被导航目标)
  const m = await measurePanel(page, '描述你想了解的台账信息');
  record(
    '[3] Demo report 不渲染 ChatPanel',
    !m.found,
    m.found ? `异常出现浮层 w=${m.w}` : '符合预期(无浮层)',
  );
  // 基本可读性: 页面应有"生成报告"/"报告预览"等关键文字
  const hasReportWord = await page.evaluate(() =>
    document.body.innerText.includes('报告') || document.body.innerText.includes('生成报告'),
  );
  record('[4] Demo report 页面文案正常', hasReportWord, hasReportWord ? '含"报告"关键字' : '未找到关键字');
  await page.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await runOverview(browser);
    await runReport(browser);
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.pass);
  console.log(
    `\n====== ${failed.length === 0 ? '✅ ALL PASS' : `❌ ${failed.length} FAILED`} ======`,
  );
  console.log(`总计 ${results.length} 项, 通过 ${results.length - failed.length} 项`);
  console.log(`产物: ${OUT}/`);
  process.exit(failed.length === 0 ? 0 : 1);
})().catch((e) => {
  console.error('❌ 脚本异常:', e.message);
  process.exit(2);
});
