#!/usr/bin/env node
/**
 * §3.1.1 + §3.1.2 智能化升级端到端验证
 *
 * 1. 登录后进入接入中心列表页 —— 截图列表头部「新建注册（智能填写）」入口按钮
 * 2. 点击进入 smart-register 页 —— 截图整体表单 + 顶部提示 + 备案材料区
 * 3. 点击右下角机器人 —— 截图对话浮层打开态
 * 4. 在对话里输入文本触发 Agent 识别 —— 截图预填结果 + 高亮态
 * 5. 字段高亮气泡 —— 截图 AI 预填标识 + 置信度 Tooltip
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

  // ── 1. 直接进入登录后内部页面 (本地 dev 默认已登录态) ──
  console.log('→ 跳到登录页 (门户 Layout)');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await wait(800);
  // 大多数页面有「进入工作台」按钮, 直接 navigate 到 /app
  console.log('→ 跳到接入中心列表');
  await page.goto(`${BASE}/app/agent-center`, { waitUntil: 'networkidle' });
  await wait(1500);
  await page.screenshot({
    path: `${OUT}/smart_v1_list.png`,
    fullPage: false,
  });
  console.log('✓ smart_v1_list.png');

  // 检查按钮存在
  const smartBtn = page.getByRole('button', { name: /新建注册（智能填写）/ });
  if (!(await smartBtn.isVisible().catch(() => false))) {
    console.log('⚠ 未找到「新建注册（智能填写）」按钮, 可能已被遮挡');
  }

  // ── 2. 直接进入 smart-register 页 ──
  console.log('→ 跳到 /app/agent-center/smart-register');
  await page.goto(`${BASE}/app/agent-center/smart-register`, { waitUntil: 'networkidle' });
  await wait(1500);
  await page.screenshot({
    path: `${OUT}/smart_v1_form.png`,
    fullPage: false,
  });
  console.log('✓ smart_v1_form.png');

  // ── 3. 点击右下角机器人唤起对话 ──
  console.log('→ 唤起 Agent 对话浮层');
  // 悬浮入口是 [aria-label="唤起智能填写助手"]
  const entry = page.getByRole('button', { name: '唤起智能填写助手' });
  await entry.click();
  await wait(800);
  await page.screenshot({
    path: `${OUT}/smart_v1_chat_open.png`,
    fullPage: false,
  });
  console.log('✓ smart_v1_chat_open.png');

  // ── 4. 在文本框输入 + 发送, 触发识别 ──
  console.log('→ 输入文本触发 Agent');
  // 找最后一个 TextArea (输入栏)
  const ta = page.locator('.ant-input').last();
  await ta.fill('我想接入一个智能导诊分诊助手,功能是面向门诊大厅');
  await wait(200);
  await page.keyboard.press('Enter');
  await wait(2500); // 等「识别中」气泡
  await page.screenshot({
    path: `${OUT}/smart_v1_chat_detecting.png`,
    fullPage: false,
  });
  console.log('✓ smart_v1_chat_detecting.png');

  // ── 5. 等识别完成 + 字段高亮 ──
  await wait(2500);
  await page.screenshot({
    path: `${OUT}/smart_v1_chat_result.png`,
    fullPage: false,
  });
  console.log('✓ smart_v1_chat_result.png');

  // ── 6. 关闭对话浮层, 单独看表单高亮 ──
  await page.locator('.ant-btn').filter({ hasText: /^$/ }).first(); // 无操作
  // 找「智能填写助手」标题旁的关闭按钮
  const closeBtn = page.locator('button[aria-label]').filter({ has: page.locator('.anticon-close') }).first();
  // 退而求其次: 通过 Tooltip 标题「收起对话」找
  const closeByTitle = page.locator('[aria-label="收起对话（不清空会话）"]');
  if (await closeByTitle.count() > 0) {
    await closeByTitle.first().click();
  } else {
    // fallback: 找对话浮层右上角的 X (svg close)
    await page.locator('.anticon-close').last().click({ trial: false }).catch(() => {});
  }
  await wait(800);
  await page.screenshot({
    path: `${OUT}/smart_v1_form_highlighted.png`,
    fullPage: true,
  });
  console.log('✓ smart_v1_form_highlighted.png');

  // ── 7. 悬停 AI 预填标识 ──
  const badge = page.locator('.ai-prefill-highlight').first();
  if (await badge.count() > 0) {
    await badge.hover();
    await wait(800);
    await page.screenshot({
      path: `${OUT}/smart_v1_badge_tooltip.png`,
      fullPage: false,
    });
    console.log('✓ smart_v1_badge_tooltip.png');
  }

  // 总结
  console.log('—— 错误汇总 ——');
  if (errs.length === 0) {
    console.log('✓ 无页面错误');
  } else {
    errs.slice(0, 20).forEach((e) => console.log(e));
  }

  await browser.close();
  console.log('done');
})();