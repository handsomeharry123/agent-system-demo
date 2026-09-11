// 验证 360 画像气泡修复:
//   1. 标题只剩「医小管」(没有「360画像」前缀 + 「全院/本科室」tag)
//   2. 气泡位置上移(相对机器人),bottom-anchor 对齐机器人顶部
import { chromium } from 'playwright';

const URL = 'http://localhost:3001/app/ledger/detail/AGT-2024-001';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  page.on('pageerror', (err) => console.error('[pageerror]', err.message));

  await page.goto(URL, { waitUntil: 'networkidle' });
  // 等待气泡出现
  await page.waitForSelector('[data-testid="ledger-status-bubble"]', { timeout: 10000 });
  // 立即截图(气泡 8s 后自动收起)
  await page.screenshot({ path: 'verify_360_bubble_fix_artefacts/01-detail-before-collapse.png', fullPage: false });

  // 检查标题文字
  const titleText = await page.locator('[data-testid="ledger-status-bubble"] strong').first().textContent();
  console.log('[标题文字]', JSON.stringify(titleText));

  // 检查没有 scopeLabel tag
  const tagSpans = await page.locator('[data-testid="ledger-status-bubble"] span').allTextContents();
  console.log('[所有 span 文本]', tagSpans);

  // 检查气泡定位
  const bubbleBox = await page.locator('[data-testid="ledger-status-bubble"]').boundingBox();
  const robotBox = await page.locator('.agent-robot-bounce, [aria-label="唤起医小管(台账助手)"]').first().boundingBox();
  console.log('[气泡 box]', bubbleBox);
  console.log('[机器人 box]', robotBox);
  if (robotBox && bubbleBox) {
    console.log('[气泡相对机器人] top 差 =', bubbleBox.y - robotBox.y, ' left 差 =', bubbleBox.x - robotBox.x);
    console.log('[气泡底相对机器人顶]', bubbleBox.y + bubbleBox.height - robotBox.y);
    console.log('[气泡底是否在机器人顶上方]', bubbleBox.y + bubbleBox.height <= robotBox.y + 16);
  }

  await browser.close();
})();