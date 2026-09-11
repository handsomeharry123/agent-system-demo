/**
 * 验证 V2.8 多级辐射拓扑 — DiagAssist 4 节点场景
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const URL_BASE = 'http://localhost:3001';
const ARTEFACT_DIR = 'verify_topology_v28_artefacts';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error(`[browser ERR] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => console.error(`[pageerror] ${err.message}`));

  // 通过台账列表页查找 DiagAssist 智能体的实际 id
  console.log('Step 1: 进入台账列表查找 DiagAssist 智能体...');
  await page.goto(`${URL_BASE}/app/ledger`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 搜索 DiagAssist
  const searchInput = page.locator('input[placeholder*="搜索"]').first();
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill('DiagAssist');
    await page.waitForTimeout(800);
  }

  // 找第一个 DiagAssist 行
  const diagRow = page.locator('.ant-table-tbody tr.ant-table-row').filter({ hasText: 'DiagAssist' }).first();
  await diagRow.waitFor({ timeout: 5000 }).catch(() => null);
  const diagExists = await diagRow.isVisible().catch(() => false);
  console.log('DiagAssist row found:', diagExists);

  if (diagExists) {
    // 点击「详情」按钮 (而非整行,避免跳到其他链接)
    const detailBtn = diagRow.locator('button:has-text("详情"), a:has-text("详情")').first();
    if (await detailBtn.isVisible().catch(() => false)) {
      await detailBtn.click();
    } else {
      // 尝试点击智能体名称链接
      const nameLink = diagRow.locator('a').first();
      if (await nameLink.isVisible().catch(() => false)) {
        await nameLink.click();
      } else {
        await diagRow.click();
      }
    }
  } else {
    // 直接访问已知的 idCode
    console.log('直接尝试 idCode...');
    await page.goto(`${URL_BASE}/app/ledger`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    // 清空搜索
    const searchInput2 = page.locator('input[placeholder*="搜索"]').first();
    if (await searchInput2.isVisible().catch(() => false)) {
      await searchInput2.fill('');
      await page.waitForTimeout(400);
    }
    const allRows = await page.locator('.ant-table-tbody tr.ant-table-row').all();
    console.log('total rows:', allRows.length);
    for (let i = 0; i < Math.min(allRows.length, 10); i++) {
      const txt = await allRows[i].textContent();
      console.log(`row ${i}:`, txt?.slice(0, 100));
    }
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(ARTEFACT_DIR, '10_after_click.png'), fullPage: false });

  // 检查是否在详情页
  const topoHeader = page.locator('text=关联资源拓扑地图').first();
  const inDetail = await topoHeader.isVisible().catch(() => false);
  console.log('In detail page:', inDetail);

  if (inDetail) {
    await topoHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    const topoPanel = topoHeader.locator('xpath=ancestor::div[contains(@style, "radial-gradient") or contains(@style, "border-radius: 8")][1]');
    const box = await topoPanel.boundingBox();
    console.log('topo box:', box);
    if (box) {
      await page.screenshot({
        path: path.join(ARTEFACT_DIR, '11_diagassist_topo.png'),
        clip: { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 },
      });
    }
    // 1.5s 后再截一张(动画不同帧)
    await page.waitForTimeout(1500);
    if (box) {
      await page.screenshot({
        path: path.join(ARTEFACT_DIR, '12_diagassist_topo_anim.png'),
        clip: { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 },
      });
    }
  }

  await browser.close();
  console.log('Done.');
})();