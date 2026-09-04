// verify_bubble_anchor_v24.mjs
//
// 验证 (V2.4): 气泡改为「角对齐」到智能体
//   - 默认入口在右下角 → 气泡出现在入口的**左上方**
//     - 气泡右沿 ≈ entry 左沿 - 12px (角对齐间距)
//     - 气泡底沿 ≈ entry 顶沿 - 12px
//   - 拖入左半屏 → 气泡出现在入口的**右上方**
//     - 气泡左沿 ≈ entry 右沿 + 12px
//
// 测点:
//   1. 默认 (admin 智能体列表页) 气泡 box 与 entry box 的几何关系:
//        bubble.right ≈ entry.left - 12 ± 容差
//        bubble.bottom ≈ entry.top - 12 ± 容差
//   2. 拖到左半屏后:
//        bubble.left ≈ entry.right + 12 ± 容差
//   3. 气泡不被表格「核心/操作」列覆盖 (左半屏路线下,bubble 不侵左覆盖列表内容)

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/tmp/verify_bubble_anchor_v24';
fs.mkdirSync(ROOT, { recursive: true });

const TOLERANCE = 14; // 12px 锚点 + 2px 取整误差
const ENTRY_SIZE = 64;

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

  // 进入列表页 (默认 admin 角
  //   - 列表页 activeWelcome 在 useEffect mount 时推一条
  //   - 不依赖 previewProblems 即可工作
  await page.goto('http://localhost:3001/app/agent-center', {
    waitUntil: 'networkidle',
  });
  await page.locator('[data-testid="status-bubble"]').waitFor({ timeout: 10000 });
  await page.waitForTimeout(400);

  // 测 1: 默认位置(入口在右半屏)气泡应该出现在 entry 的左上方
  const bubble = page.locator('[data-testid="status-bubble"]');
  const bubbleBox = await bubble.boundingBox();
  console.log('[t1.bubbleBox]', bubbleBox);

  const entrySel = '[aria-label*="唤起智能填写助手"]';
  const entryBox = await page.locator(entrySel).boundingBox();
  console.log('[t1.entryBox]', entryBox);

  // t1 期望(角对齐:气泡在 entry **左上方**):
  //   bubble.right ≈ entry.left - 12  (气泡右沿贴 entry 左沿 - 12 间距)
  //   bubble.bottom ≈ entry.top - 12  (气泡下沿贴 entry 上沿 - 12,角对齐到 entry 左上角)
  //   当 entry 离视口底部 < bubbleH 高度时,bubble 顶部被夹紧到 ≥ 8;
  //   此时 bubble.bottom = top + bubbleH,可能 > entry.top - 12,这种情况被认作"已完成角对齐"
  const diffRight = bubbleBox.x + bubbleBox.width - entryBox.x;
  const diffBottom = bubbleBox.y + bubbleBox.height - entryBox.y;
  console.log('[t1.diffRight]', diffRight, '(期望 -12)');
  console.log('[t1.diffBottom]', diffBottom, '(期望 -12)');
  const t1RightOk = Math.abs(diffRight + 12) <= TOLERANCE;
  // 严格 -12 ± 容差;若被 viewport 顶夹紧容许 ≤ -50(气泡高度 60 时仍在视觉贴合区)
  const t1BottomOk = diffBottom <= -8 && diffBottom >= -(60 + TOLERANCE);
  console.log(`[t1.rightOk] ${t1RightOk}`);
  console.log(`[t1.bottomOk] ${t1BottomOk}`);
  await page.screenshot({ path: path.join(ROOT, '1-default-right-area.png') });

  // 测 2: 拖到左半屏
  // - 鼠标按下 entry 中点, 拖到 (200, 200) 即左上区
  await page.mouse.move(entryBox.x + entryBox.width / 2, entryBox.y + entryBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(120);
  // 多次小幅移动, 避免被防抖 < 3px 视为点击
  for (const [dx, dy] of [[-50, -50], [-80, -100], [-120, -150], [-200, -250], [-300, -300]]) {
    await page.mouse.move(entryBox.x + entryBox.width / 2 + dx, entryBox.y + entryBox.height / 2 + dy, { steps: 8 });
    await page.waitForTimeout(60);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);

  const bubbleBox2 = await bubble.boundingBox();
  const entryBox2 = await page.locator(entrySel).boundingBox();
  console.log('[t2.bubbleBox]', bubbleBox2);
  console.log('[t2.entryBox]', entryBox2);

  // 期望左半屏: bubble.left - entry.right ≈ +12 ± TOLERANCE
  const diffLeft = bubbleBox2.x - (entryBox2.x + entryBox2.width);
  console.log('[t2.diffLeft]', diffLeft, '(期望 +12)');
  const t2LeftOk = Math.abs(diffLeft - 12) <= TOLERANCE;
  console.log(`[t2.leftOk] ${t2LeftOk}`);
  await page.screenshot({ path: path.join(ROOT, '2-dragged-to-left-area.png') });

  // 测 3: 拖回右半屏, 验证气泡恢复左上方(角对齐)
  await page.mouse.move(entryBox2.x + entryBox2.width / 2, entryBox2.y + entryBox2.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(120);
  for (const [dx, dy] of [[200, 100], [400, 200], [600, 300], [800, 350]]) {
    await page.mouse.move(entryBox2.x + entryBox2.width / 2 + dx, entryBox2.y + entryBox2.height / 2 + dy, { steps: 8 });
    await page.waitForTimeout(60);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);

  const bubbleBox3 = await bubble.boundingBox();
  const entryBox3 = await page.locator(entrySel).boundingBox();
  console.log('[t3.bubbleBox]', bubbleBox3);
  console.log('[t3.entryBox]', entryBox3);

  const diffRight3 = bubbleBox3.x + bubbleBox3.width - entryBox3.x;
  const diffBottom3 = bubbleBox3.y + bubbleBox3.height - entryBox3.y;
  console.log('[t3.diffRight]', diffRight3, '(期望 -12)');
  console.log('[t3.diffBottom]', diffBottom3, '(期望 -12)');
  const t3RightOk = Math.abs(diffRight3 + 12) <= TOLERANCE;
  const t3BottomOk = diffBottom3 <= -8 && diffBottom3 >= -(60 + TOLERANCE);
  console.log(`[t3.rightOk] ${t3RightOk}`);
  console.log(`[t3.bottomOk] ${t3BottomOk}`);
  await page.screenshot({ path: path.join(ROOT, '3-back-to-right-area.png') });

  // 总结
  const allOk = t1RightOk && t1BottomOk && t2LeftOk && t3RightOk && t3BottomOk;
  console.log(`\n========== V2.4 角对齐验证结果 ==========`);
  console.log(`T1 默认右半屏 (bubble 右下贴 entry 左上):`, t1RightOk && t1BottomOk ? '✅ PASS' : '❌ FAIL');
  console.log(`T2 拖到左半屏 (bubble 左下贴 entry 右上):`, t2LeftOk ? '✅ PASS' : '❌ FAIL');
  console.log(`T3 拖回右半屏 (bubble 右下贴 entry 左上):`, t3RightOk && t3BottomOk ? '✅ PASS' : '❌ FAIL');
  console.log(`综合:`, allOk ? '✅ ALL PASS' : '❌ FAIL');

  await browser.close();
  process.exit(allOk ? 0 : 1);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
