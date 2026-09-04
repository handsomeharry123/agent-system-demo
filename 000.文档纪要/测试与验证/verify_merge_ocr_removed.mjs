#!/usr/bin/env node
/**
 * 验证 ① 合并入口 + ② 删除 OCR
 *
 * 截图：
 *   - merge_001_list.png          列表页头部右上角：只有 1 个「新建注册（智能填写）」按钮
 *   - merge_002_register_page.png 旧 /register 页：备案材料上传区下方不应再出现「触发 OCR 识别」按钮
 */
import { chromium } from 'playwright';
import { setTimeout as wait } from 'node:timers/promises';

const BASE = 'http://localhost:3001';
const OUT = '/Users/harry/Desktop/CC_TEST/agent-system/.verify-downloads';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const errs = [];
  page.on('pageerror', (e) => errs.push(`PAGEERROR: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errs.push(`CONSOLE.ERROR: ${msg.text()}`);
  });

  // ── 1. 列表页 ──
  console.log('→ 跳到 /app/agent-center');
  await page.goto(`${BASE}/app/agent-center`, { waitUntil: 'networkidle' });
  await wait(1500);

  // 数「新建注册」按钮数量 (应只有 1 个, 且带 (智能填写) 后缀)
  const allCreateBtns = await page.locator('button').filter({ hasText: /新建注册/ }).all();
  console.log(`找到「新建注册」相关按钮 ${allCreateBtns.length} 个`);
  for (const b of allCreateBtns) {
    const txt = (await b.innerText()).trim();
    console.log('  ·', txt);
  }

  await page.screenshot({
    path: `${OUT}/merge_001_list.png`,
    fullPage: false,
  });
  console.log('✓ merge_001_list.png');

  // ── 2. 进入智能填写版表单页 ──
  console.log('→ 跳到 /app/agent-center/smart-register');
  await page.goto(`${BASE}/app/agent-center/smart-register`, { waitUntil: 'networkidle' });
  await wait(1200);

  // 智能填写版头部 PageHeader 截图
  await page.screenshot({
    path: `${OUT}/merge_002_smart_register.png`,
    fullPage: false,
  });
  console.log('✓ merge_002_smart_register.png');

  // ── 3. 旧版 register 页 —— 验证 OCR 按钮已消失 ──
  console.log('→ 跳到旧版 /app/agent-center/register');
  await page.goto(`${BASE}/app/agent-center/register`, { waitUntil: 'networkidle' });
  await wait(1200);

  // 检查 OCR 按钮是否存在
  const ocrBtn = await page.locator('button').filter({ hasText: /触发 OCR 识别/ }).count();
  console.log(`「触发 OCR 识别」按钮数量: ${ocrBtn} (应为 0)`);

  await page.screenshot({
    path: `${OUT}/merge_003_old_register_no_ocr.png`,
    fullPage: false,
  });
  console.log('✓ merge_003_old_register_no_ocr.png');

  // 全页面截图, 确认「备案材料上传」Card 下不再有 OCR 区域
  await page.screenshot({
    path: `${OUT}/merge_003_old_register_full.png`,
    fullPage: true,
  });
  console.log('✓ merge_003_old_register_full.png');

  // ── 总结 ──
  console.log('—— 错误汇总 ——');
  if (errs.length === 0) {
    console.log('✓ 无页面错误');
  } else {
    errs.slice(0, 20).forEach((e) => console.log(e));
  }

  await browser.close();
  console.log('done');
})();