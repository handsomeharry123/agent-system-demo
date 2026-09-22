/**
 * 验证 V2.8 多级辐射拓扑视觉效果
 * 访问 /app/ledger/detail/AGT-2024-001 (或任一 DiagAssist-* 智能体)，
 * 默认进入 360 画像视图，截取中间拓扑模块的视觉效果。
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const URL_BASE = 'http://localhost:3001';
const ARTEFACT_DIR = 'verify_topology_v28_artefacts';

if (!fs.existsSync(ARTEFACT_DIR)) {
  fs.mkdirSync(ARTEFACT_DIR);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error(`[browser] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => console.error(`[pageerror] ${err.message}`));

  // 1. 登录 admin
  console.log('Step 1: 登录 admin...');
  await page.goto(`${URL_BASE}/app/ledger/detail/AGT-2024-001`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // 2. 截图整页（确认 360 画像视图已加载）
  await page.screenshot({
    path: path.join(ARTEFACT_DIR, '01_full_page.png'),
    fullPage: false,
  });

  // 3. 定位拓扑模块并裁剪截图
  console.log('Step 2: 定位拓扑模块...');
  // 通过文本「关联资源拓扑地图」定位
  const topoHeader = page.locator('text=关联资源拓扑地图').first();
  await topoHeader.waitFor({ timeout: 8000 });
  // 找到 header 的父容器（带 panel border 那个 div）
  const topoPanel = topoHeader.locator('xpath=ancestor::div[contains(@style, "radial-gradient") or contains(@style, "border-radius: 8")][1]');

  // 截面板
  await topoHeader.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  const panelBox = await topoPanel.boundingBox();
  console.log('topo panel box:', panelBox);
  if (panelBox) {
    await page.screenshot({
      path: path.join(ARTEFACT_DIR, '02_topo_panel.png'),
      clip: {
        x: Math.max(0, panelBox.x - 10),
        y: Math.max(0, panelBox.y - 10),
        width: panelBox.width + 20,
        height: panelBox.height + 20,
      },
    });
  }

  // 4. 等待动画跑一会儿，再截一张（流动效果）
  await page.waitForTimeout(1500);
  if (panelBox) {
    await page.screenshot({
      path: path.join(ARTEFACT_DIR, '03_topo_panel_after_1.5s.png'),
      clip: {
        x: Math.max(0, panelBox.x - 10),
        y: Math.max(0, panelBox.y - 10),
        width: panelBox.width + 20,
        height: panelBox.height + 20,
      },
    });
  }

  // 5. 截一个不同的智能体（多资源场景）
  console.log('Step 3: 切换到 DiagAssist 智能体（多资源场景）...');
  await page.goto(`${URL_BASE}/app/ledger/detail/DiagAssist-CT-2024-001`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: path.join(ARTEFACT_DIR, '04_diag_assist_full.png'),
    fullPage: false,
  });

  const topoHeader2 = page.locator('text=关联资源拓扑地图').first();
  await topoHeader2.waitFor({ timeout: 8000 });
  await topoHeader2.scrollIntoViewIfNeeded();
  const topoPanel2 = topoHeader2.locator('xpath=ancestor::div[contains(@style, "radial-gradient") or contains(@style, "border-radius: 8")][1]');
  const panelBox2 = await topoPanel2.boundingBox();
  if (panelBox2) {
    await page.screenshot({
      path: path.join(ARTEFACT_DIR, '05_diag_assist_topo.png'),
      clip: {
        x: Math.max(0, panelBox2.x - 10),
        y: Math.max(0, panelBox2.y - 10),
        width: panelBox2.width + 20,
        height: panelBox2.height + 20,
      },
    });
  }

  // 6. 截一个含 idx%5===0 的智能体（演示 4 节点 ESB/MQ 边缘圈）
  console.log('Step 4: 切换到其他智能体（演示边缘圈 ESB/MQ）...');
  await page.goto(`${URL_BASE}/app/ledger`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  // 找到第一个台账列表项，点击进入
  const firstAgentRow = page.locator('.ant-table-tbody tr.ant-table-row').first();
  await firstAgentRow.waitFor({ timeout: 5000 }).catch(() => {});
  if (await firstAgentRow.isVisible().catch(() => false)) {
    await firstAgentRow.click();
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(ARTEFACT_DIR, '06_first_list_agent.png'),
      fullPage: false,
    });
  }

  // 7. 关闭
  await browser.close();
  console.log('Done. Artefacts saved to:', ARTEFACT_DIR);
})();