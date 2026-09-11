// verify_ledger_single_robot.mjs
// 验证 V2.6 修复(2026-07-03):台账页面(/app/ledger 与 /app/ledger/*)只能显示
// AgentFloatHost 独家机器人,接入中心 AgentAssistant 在该路径家族下整体隐藏。
//
// 验收点：
//   1) /app/ledger (总览) → 整个页面上「fixed 定位 + 64x64」机器人节点恰好 1 个
//   2) /app/ledger/list → 仍为 1 个
//   3) /app/ledger/detail/:id → 仍为 1 个
//   4) /app/agent-center → 1 个(AgentAssistant 独家),证明没误杀接入中心
//   5) /app/agent-center/register → 1 个

import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';
const VIEWPORT = { width: 1440, height: 900 };

const log = (...a) => console.log('[single-robot]', ...a);

// 机器人 wrapper 特征:fixed 定位 + 64x64(±4)+ 内嵌 svg
//   - AgentFloatHost 路径:wrapper 内含 AgentRobotIcon 渲染的 svg,position fixed
//   - AgentAssistant 路径:wrapper 也有 fixed + 64x64 + svg
//   - 通过「fixed + width≈64 + height≈64 + 包含 svg」三特征定位
async function countRobots(page) {
  return page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('div'));
    const matches = all.filter((d) => {
      const cs = window.getComputedStyle(d);
      if (cs.position !== 'fixed') return false;
      const w = parseFloat(cs.width);
      const h = parseFloat(cs.height);
      if (Math.abs(w - 64) > 4 || Math.abs(h - 64) > 4) return false;
      // 包含 svg 子节点(机器人的图形)
      if (!d.querySelector('svg')) return false;
      return true;
    });
    return matches.length;
  });
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();

  let failed = 0;
  const expect = async (path, expected, label) => {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const n = await countRobots(page);
    const ok = n === expected;
    log(`${ok ? '✅' : '❌'} ${label} (${path}) → 机器人 ${n} 个 (期望 ${expected})`);
    if (!ok) {
      const fname = `verify_ledger_single_robot_${label}.png`;
      await page.screenshot({ path: fname, fullPage: false });
      log(`   截图: ${fname}`);
      failed++;
    }
  };

  await expect('/app/ledger', 1, '总览');
  await expect('/app/ledger/list', 1, '列表');
  await expect('/app/ledger/detail/diag-assist-001', 1, '详情');
  await expect('/app/agent-center', 1, '接入中心');
  await expect('/app/agent-center/register', 1, '接入中心-注册');

  await browser.close();

  if (failed > 0) {
    console.error(`\n❌ 失败 ${failed} 项`);
    process.exit(1);
  } else {
    console.log('\n✅ 全部通过 — 台账页面只显示 1 个机器人,接入中心未被误伤');
  }
})();

