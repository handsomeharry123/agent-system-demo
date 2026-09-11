#!/usr/bin/env node
/**
 * Agent 对话窗口宽度 480 V2 验证脚本（2026-07-03）
 *
 * 覆盖范围:
 *   1) 接入中心 — 任意带浮窗页面, 点击机器人 icon 唤起 ChatPanel
 *   2) 台账线上 — /app/ledger/list, 点击机器人 icon 唤起 ChatPanel
 *   3) 两处浮层宽度都必须 = 480(±1 px 渲染容差)
 *
 * 背景: V1.2 把台账 ChatPanel 收敛到 440 与接入中心对齐; 2026-07-03 用户要求
 *       "统一增加 Agent 对话窗口页面宽度", 同步抬到 480。
 *
 * 用法: node verify_chat_panel_width_480.mjs
 * 输出: 控制台 PASS/FAIL + 截图到 verify_chat_panel_width_480_artefacts/
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173';
const VIEWPORT = { width: 1440, height: 900 };
const EXPECTED_WIDTH = 480;
const TOLERANCE = 1; // 1px 渲染容差

const OUT = join(process.cwd(), 'verify_chat_panel_width_480_artefacts');
mkdirSync(OUT, { recursive: true });

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? '  -- ' + detail : ''}`);
}

// 唤起浮层 → 测 fixed 容器宽度
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

async function openChatPanel(page) {
  // 清掉旧的拖拽位置, 保证入口固定在右下角, 点击纯 click 不带 drag
  await page.evaluate(() => localStorage.removeItem('agent_assistant_pos_v1'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const entry = page.locator('[aria-label*="可拖拽"]').first();
  await entry.waitFor({ state: 'visible' });
  await entry.click({ force: true });
  await page.waitForTimeout(700); // 等 agentChatPanelIn 250ms + 渲染稳定
}

async function runAgentCenter(browser) {
  console.log('\n====== 接入中心 ======');
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(`${BASE}/app/agent-center`, { waitUntil: 'networkidle' });
  await openChatPanel(page);

  const m = await measurePanel(page, '描述你的智能体');
  await page.screenshot({ path: join(OUT, 'agent-center-chat.png') });
  record(
    '[1] 接入中心 ChatPanel 已展开',
    m.found,
    m.found ? `x=${m.x} y=${m.y} w=${m.w} h=${m.h}` : '未找到 textarea',
  );
  if (!m.found) {
    await page.close();
    return;
  }
  const diff = Math.abs(m.w - EXPECTED_WIDTH);
  record(
    `[2] 接入中心 ChatPanel width = ${EXPECTED_WIDTH}px`,
    diff <= TOLERANCE,
    `实测 ${m.w}px, 偏差 ${diff}px (容差 ${TOLERANCE}px)`,
  );
  await page.close();
}

async function runLedgerList(browser) {
  console.log('\n====== 台账线上 /app/ledger/list ======');
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(`${BASE}/app/ledger/list`, { waitUntil: 'networkidle' });
  await openChatPanel(page);

  const m = await measurePanel(page, '描述你想了解的台账信息');
  await page.screenshot({ path: join(OUT, 'ledger-list-chat.png') });
  record(
    '[3] 台账列表 ChatPanel 已展开',
    m.found,
    m.found ? `x=${m.x} y=${m.y} w=${m.w} h=${m.h}` : '未找到 textarea',
  );
  if (!m.found) {
    await page.close();
    return;
  }
  const diff = Math.abs(m.w - EXPECTED_WIDTH);
  record(
    `[4] 台账列表 ChatPanel width = ${EXPECTED_WIDTH}px`,
    diff <= TOLERANCE,
    `实测 ${m.w}px, 偏差 ${diff}px (容差 ${TOLERANCE}px)`,
  );
  await page.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await runAgentCenter(browser);
    await runLedgerList(browser);
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
