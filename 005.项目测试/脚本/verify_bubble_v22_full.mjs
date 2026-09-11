// verify_bubble_v22_full.mjs
//
// 验证: 医小管 page-level 欢迎气泡在「智能预审 N=4」场景下,
//   4 条问题全部可见(第 4 条的「采纳 / 忽略本条」链接不被截掉)
//
// 修复要点(V2.2):
//   - 外层 bubble 在 previewProblems 触发时 maxHeight 280 → 420
//   - previewProblems 内层 block 加 maxHeight 200 + overflowY auto 双重保险
//
// 用 Playwright 截图(初始页 + 滚到第 4 条时),对比修复前后

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/tmp/verify_bubble_v22_full';
fs.mkdirSync(ROOT, { recursive: true });

const main = async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[console.${msg.type()}]`, msg.text());
    }
  });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));

  // 进入新建注册页(信息科管理员 admin) — 该页会 pushWelcomeGreeting('smart-register')
  //   并在 useEffect 里调 runReview() 把 4 条 previewProblems 同步到气泡
  await page.goto('http://localhost:3001/app/agent-center/smart-register', {
    waitUntil: 'networkidle',
  });
  await page.waitForSelector('text=① 备案材料上传', { timeout: 15000 });

  // 等气泡 + previewProblems 出现
  const bubble = page.locator('[data-testid="status-bubble"]');
  await bubble.waitFor({ timeout: 10000 });
  await page.locator('[data-testid="status-bubble-preview-issues"]').waitFor({ timeout: 10000 });
  await page.waitForTimeout(500);

  // 测 1: 气泡外层 box
  const outerBox = await bubble.boundingBox();
  console.log('[bubble.outerBox]', outerBox);

  // 测 2: previewProblems 内层 box
  const previewBox = await page
    .locator('[data-testid="status-bubble-preview-issues"]')
    .boundingBox();
  console.log('[preview.innerBox]', previewBox);

  // 测 3: 第 4 条问题 row
  const rows = page.locator('[data-testid^="status-bubble-preview-issue-"]');
  const rowCount = await rows.count();
  console.log(`[preview.rowCount] ${rowCount}`);

  let fourthVisible = false;
  let fourthIgnoreBtnVisible = false;
  if (rowCount >= 4) {
    const fourth = rows.nth(3);
    fourthVisible = await fourth.isVisible();
    // 第 4 条内部的 忽略本条 按钮
    const ignoreBtn = fourth.locator('[data-testid^="status-bubble-preview-ignore-"]');
    fourthIgnoreBtnVisible = await ignoreBtn.isVisible();
    console.log(`[preview.4th.rowVisible] ${fourthVisible}`);
    console.log(`[preview.4th.ignoreBtnVisible] ${fourthIgnoreBtnVisible}`);
  }

  // 测 4: 滚动 internal 后第 4 条应可达
  let fourthAfterScroll = false;
  if (rowCount >= 4) {
    await page.evaluate(() => {
      const el = document.querySelector(
        '[data-testid="status-bubble-preview-issues"]',
      );
      if (el) el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(200);
    const fourth = rows.nth(3);
    fourthAfterScroll = await fourth.isVisible();
    const ignoreBtn = fourth.locator('[data-testid^="status-bubble-preview-ignore-"]');
    const ignoreAfterScroll = await ignoreBtn.isVisible();
    console.log(`[preview.4th.rowAfterScroll] ${fourthAfterScroll}`);
    console.log(`[preview.4th.ignoreAfterScroll] ${ignoreAfterScroll}`);
  }

  // 截图
  await page.screenshot({ path: path.join(ROOT, '1-bubble-initial.png') });
  console.log('✓ 截图 1: 初始(bubble 未滚动)');

  // 滚到 preview 底
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="status-bubble-preview-issues"]');
    if (el) el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(ROOT, '2-bubble-scrolled.png') });
  console.log('✓ 截图 2: preview 滚到第 4 条可见');

  // 仅截 bubble 本身
  await bubble.screenshot({ path: path.join(ROOT, '3-bubble-crop.png') });
  console.log('✓ 截图 3: bubble 单独');

  // 断言总结
  const pass =
    rowCount === 4 &&
    fourthIgnoreBtnVisible === true; // 第 4 条 + 忽略按钮初始就完全可见
  console.log(pass ? '✅ PASS' : `❌ FAIL — rowCount=${rowCount}, fourthIgnoreVisible=${fourthIgnoreBtnVisible}`);

  await browser.close();
  process.exit(pass ? 0 : 1);
};

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
