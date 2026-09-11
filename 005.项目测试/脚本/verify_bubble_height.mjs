#!/usr/bin/env node
/**
 * 验证: 医小管 page-level 欢迎气泡高度
 *  进入 /app/agent-center/smart-register (浮层未开), 测量气泡 div 实际尺寸
 *  期望: 高度 ≤ 280px, 视觉上紧凑不撑屏
 */
import { chromium } from 'playwright';
import { setTimeout as wait } from 'node:timers/promises';

const BASE = 'http://localhost:3001';
const OUT = '/Users/harry/Desktop/CC_TEST/agent-system/.verify-downloads';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/app/agent-center/smart-register`, { waitUntil: 'networkidle' });
  // 等待 welcome bubble 渲染
  await wait(800);

  const measure = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="status-bubble"]');
    if (!el) return { found: false };
    const r = el.getBoundingClientRect();
    const cs = window.getComputedStyle(el);
    return {
      found: true,
      rect: { width: Math.round(r.width), height: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left) },
      maxHeight: cs.maxHeight,
      padding: cs.padding,
      fontSize: cs.fontSize,
      lineHeight: cs.lineHeight,
    };
  });
  console.log('气泡测量:', JSON.stringify(measure, null, 2));

  await page.screenshot({ path: `${OUT}/bubble_height_after.png`, fullPage: false, clip: { x: 1280, y: 60, width: 320, height: 360 } });
  await page.screenshot({ path: `${OUT}/bubble_height_full.png`, fullPage: false });
  await browser.close();
})();
