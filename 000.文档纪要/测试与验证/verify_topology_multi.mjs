/**
 * 验证 V2.8 多级辐射拓扑 — DiagAssist 4 节点场景 + ESB/MQ 边缘圈场景
 */

import { chromium } from 'playwright';
import path from 'node:path';

const URL_BASE = 'http://localhost:3001';
const ARTEFACT_DIR = 'verify_topology_v28_artefacts';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();

  page.on('pageerror', (err) => console.error(`[pageerror] ${err.message}`));

  // DiagAssist (4 节点: PACS/EMR/LIS/NIS, 含 1 异常)
  console.log('Step A: 访问 DiagAssist-CARD-2.1 (AGT-2025-002)...');
  await page.goto(`${URL_BASE}/app/ledger/detail/AGT-2025-002`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  let topoHeader = page.locator('text=关联资源拓扑地图').first();
  let ok = await topoHeader.isVisible().catch(() => false);
  console.log('DiagAssist topo visible:', ok);

  if (ok) {
    await topoHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    const topoPanel = topoHeader.locator('xpath=ancestor::div[contains(@style, "radial-gradient") or contains(@style, "border-radius: 8")][1]');
    const box = await topoPanel.boundingBox();
    if (box) {
      await page.screenshot({
        path: path.join(ARTEFACT_DIR, '20_diagassist_topo_4nodes.png'),
        clip: { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 },
      });
      console.log('截图 20 成功, size:', box.width, 'x', box.height);
    }
    // 整页
    await page.screenshot({ path: path.join(ARTEFACT_DIR, '21_diagassist_full.png'), fullPage: false });

    // 1.5s 后再截一张 (动画不同帧)
    await page.waitForTimeout(1500);
    if (box) {
      await page.screenshot({
        path: path.join(ARTEFACT_DIR, '22_diagassist_topo_anim.png'),
        clip: { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 },
      });
    }
  }

  // 尝试 idx%5===0 场景 (AGT-2024-004 是 idx=6, AGT-2026-001 idx=5)
  console.log('Step B: 访问 AGT-2026-001 (idx=5, ESB+MQ 边缘圈)...');
  await page.goto(`${URL_BASE}/app/ledger/detail/AGT-2026-001`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  topoHeader = page.locator('text=关联资源拓扑地图').first();
  ok = await topoHeader.isVisible().catch(() => false);
  console.log('AGT-2026-001 topo visible:', ok);

  if (ok) {
    await topoHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    const topoPanel = topoHeader.locator('xpath=ancestor::div[contains(@style, "radial-gradient") or contains(@style, "border-radius: 8")][1]');
    const box = await topoPanel.boundingBox();
    if (box) {
      await page.screenshot({
        path: path.join(ARTEFACT_DIR, '30_esb_mq_topo.png'),
        clip: { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 },
      });
    }
  }

  await browser.close();
  console.log('Done.');
})();