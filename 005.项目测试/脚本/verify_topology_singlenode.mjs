/**
 * 验证 V2.8 多级辐射拓扑 — 单节点异常场景
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

  // AGT-2024-001 → idx=0 → idx%4===0 命中院内知识库分支
  console.log('Step: 访问 AGT-2024-001 (单节点异常)...');
  await page.goto(`${URL_BASE}/app/ledger/detail/AGT-2024-001`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const topoHeader = page.locator('text=关联资源拓扑地图').first();
  const ok = await topoHeader.isVisible().catch(() => false);
  console.log('topo visible:', ok);

  if (ok) {
    await topoHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    const topoPanel = topoHeader.locator('xpath=ancestor::div[contains(@style, "radial-gradient") or contains(@style, "border-radius: 8")][1]');
    const box = await topoPanel.boundingBox();
    if (box) {
      await page.screenshot({
        path: path.join(ARTEFACT_DIR, '40_single_abnormal.png'),
        clip: { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 },
      });
    }
  }

  await browser.close();
  console.log('Done.');
})();