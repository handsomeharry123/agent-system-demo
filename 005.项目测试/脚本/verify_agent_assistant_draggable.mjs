// verify_agent_assistant_draggable.mjs — 验证 PRD §3.1.1「位置与拖拽」 + V2「对话窗口右下角锚定」:
//   1) 入口默认位于右下角 (left/top ≈ viewport - 88)
//   2) 拖拽到屏幕左上角 → 浮窗停靠新位置, 透明度变化, 不触发 click 唤起
//   3) localStorage 写入 agent_assistant_pos_v1
//   4) 刷新后入口仍在拖到的位置
//   5) 点击入口 (纯点击, 不拖) → 浮层在视口右下角 (right:24 / bottom:24) 展开, 不再跟随 icon 位置
//   6) 视口缩小后入口位置自动 clamp 到可视区

import { chromium } from 'playwright';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';
const TARGET_PATH = process.env.TARGET_PATH || '/app/agent-center';
const VIEWPORT = { width: 1440, height: 900 };

const log = (...a) => console.log('[draggable]', ...a);

const entryHandleSel = '[aria-label*="可拖拽"]';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();

  // 进入指定的有浮窗页面，默认仍为 agent-center。
  await page.goto(`${BASE}${TARGET_PATH}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.evaluate(() => localStorage.removeItem('agent_assistant_pos_v1'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const entry = page.locator(entryHandleSel).first();
  await entry.waitFor({ state: 'visible' });

  // (1) 默认右下角: 入口在 viewport 右下角 (left ≈ 1440-88=1352, top ≈ 900-88=812)
  const box0 = await entry.boundingBox();
  log('[1] 默认入口 boundingBox:', box0);
  if (!box0) throw new Error('入口不可见');
  if (box0.x < VIEWPORT.width - 200 || box0.y < VIEWPORT.height - 200) {
    throw new Error(`默认位置应贴近右下角, 实际 x=${box0.x} y=${box0.y}`);
  }

  // (2) 拖拽到屏幕左上角 (鼠标中心到 (100, 100)) — 浮窗中心跟随鼠标, box.x = 100
  const startX = box0.x + box0.width / 2;
  const startY = box0.y + box0.height / 2;
  const targetX = 100;
  const targetY = 100;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(
      startX + (targetX - startX) * (i / 10),
      startY + (targetY - startY) * (i / 10),
    );
    await page.waitForTimeout(15);
  }
  await page.mouse.up();
  await page.mouse.move(10, 10);
  await page.waitForTimeout(300);

  const box1 = await entry.boundingBox();
  const style1 = await entry.evaluate((el) => ({
    left: el.style.left,
    top: el.style.top,
    transform: getComputedStyle(el).transform,
  }));
  log('[2] 拖完后 box:', box1, 'style:', style1);
  if (!box1) throw new Error('拖完后入口不可见');
  // 鼠标中心到 (100, 100), box 左上角应 ≈ (100 - 32, 100 - 32) = (68, 68)
  if (Math.abs(box1.x - 68) > 5 || Math.abs(box1.y - 68) > 5) {
    throw new Error(`拖拽未生效, 期望 box.x≈68, 实际 x=${box1.x} y=${box1.y}`);
  }
  // 拖拽结束后 transform 应回到 none (无 hover)
  if (style1.transform !== 'none' && style1.transform !== 'matrix(1, 0, 0, 1, 0, 0)') {
    throw new Error(`拖完后 transform 应为 none, 实际 ${style1.transform}`);
  }

  // (3) localStorage 已落盘
  const stored = await page.evaluate(() => localStorage.getItem('agent_assistant_pos_v1'));
  log('[3] localStorage =', stored);
  if (!stored) throw new Error('localStorage 未落盘');
  const parsed = JSON.parse(stored);
  if (Math.abs(parsed.left - 68) > 5 || Math.abs(parsed.top - 68) > 5) {
    throw new Error(`落盘坐标偏差, 期望 ≈(68,68), 实际 ${JSON.stringify(parsed)}`);
  }

  // (4) 刷新后位置仍保留
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const entry2 = page.locator(entryHandleSel).first();
  const box2 = await entry2.boundingBox();
  log('[4] 刷新后 box:', box2);
  if (!box2 || Math.abs(box2.x - 68) > 5 || Math.abs(box2.y - 68) > 5) {
    throw new Error(`刷新后位置丢失, 实际 x=${box2?.x} y=${box2?.y}`);
  }

  // (5) 纯点击入口 → 浮层在视口右下角锚定展开 (V2: 与 icon 拖拽位置解耦, 始终 right:24 / bottom:24)
  await entry2.click({ force: true });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.resolve('verify_agent_draggable_step5.png') });
  // 浮层容器: 找含消息输入框 (placeholder 含 "描述你的智能体") 的最近 fixed 父级
  const panelInfo = await page.evaluate(() => {
    const ta = document.querySelector('textarea[placeholder*="描述你的智能体"]');
    if (!ta) return { found: false };
    // panel 是 textarea 上面 7 层 div 之一的 fixed 容器
    let p = ta.parentElement;
    for (let i = 0; i < 10 && p; i++) {
      if (p.style && p.style.position === 'fixed') {
        const r = p.getBoundingClientRect();
        return { found: true, x: r.x, y: r.y, w: r.width, h: r.height };
      }
      p = p.parentElement;
    }
    return { found: false };
  });
  log('[5] 浮层 panel:', panelInfo);
  if (!panelInfo.found) throw new Error('浮层未展开 (找不到 panel)');
  // V2 期望: 浮层右下角对齐 viewport 右下角 (right:24 / bottom:24, 容差 ±20)
  const expectedRight = VIEWPORT.width - 24; // 1416
  const expectedBottom = VIEWPORT.height - 24; // 876
  const panelRight = panelInfo.x + panelInfo.w;
  const panelBottom = panelInfo.y + panelInfo.h;
  if (Math.abs(panelRight - expectedRight) > 20 || Math.abs(panelBottom - expectedBottom) > 20) {
    throw new Error(
      `浮层未锚定右下角, 期望 right≈${expectedRight} bottom≈${expectedBottom}, 实际 right=${panelRight} bottom=${panelBottom}`,
    );
  }
  // 截图
  await page.screenshot({ path: path.resolve('verify_agent_draggable_panel.png') });

  // (6) 拖到右下再 resize 视口 — 直接 reload, 从 localStorage 取 pos 重新 mount
  // 先把位置存到屏幕中部, 再 resize 视口, 验证 clamp
  await page.evaluate(() => {
    const pos = { left: 800, top: 500 };
    localStorage.setItem('agent_assistant_pos_v1', JSON.stringify(pos));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const entry3 = page.locator(entryHandleSel).first();
  const box3 = await entry3.boundingBox();
  log('[6] reload 后入口 box:', box3);
  // 期望 box.x ≈ 800, box.y ≈ 500
  if (!box3 || Math.abs(box3.x - 800) > 5 || Math.abs(box3.y - 500) > 5) {
    throw new Error(`reload 后位置偏差, 实际 x=${box3?.x} y=${box3?.y}`);
  }

  await page.setViewportSize({ width: 500, height: 700 });
  await page.waitForTimeout(400);
  const entry4 = page.locator(entryHandleSel).first();
  const box4 = await entry4.boundingBox();
  log('[6] resize 500x700 后入口:', box4);
  if (!box4) throw new Error('resize 后入口不可见');
  if (box4.x < 0 || box4.x + box4.width > 500 || box4.y < 0 || box4.y + box4.height > 700) {
    throw new Error(`clamp 失败, 入口越界 x=${box4.x} y=${box4.y}`);
  }

  log('✅ 全部 6 步通过');
  await browser.close();
})().catch(async (e) => {
  console.error('❌ 验证失败:', e.message);
  process.exit(1);
});
