// verify_bubble_v21.mjs — 验证医小管气泡在简单文案场景下宽度贴内容自适应
import { chromium } from 'playwright';
import fs from 'node:fs';

const URL = 'http://localhost:3001/app/agent-center?tab=待审核';

const out = (name, buf) => {
  const p = `/Users/harry/Desktop/CC_TEST/agent-system/${name}.png`;
  fs.writeFileSync(p, buf);
  console.log(`✓ saved ${p}`);
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('  [console.error]', msg.text());
  });
  page.on('pageerror', (err) => console.log('  [pageerror]', err.message));

  // 1. 默认 admin 视角, 进入 agent-center 待审核 Tab
  await page.goto(URL, { waitUntil: 'networkidle' });
  // 等欢迎气泡出现
  try {
    await page.waitForSelector('[data-testid="status-bubble"]', { timeout: 5000 });
  } catch (e) {
    console.log('  ! status bubble 未在 5s 内出现, 等待更长');
    await page.waitForTimeout(2000);
  }
  await page.waitForTimeout(800);

  // 截取气泡所在的右下区域
  const bubble = await page.$('[data-testid="status-bubble"]');
  if (!bubble) {
    console.log('✗ 未找到 status bubble');
    process.exit(1);
  }
  const box = await bubble.boundingBox();
  console.log('  bubble box:', box);
  if (!box) {
    console.log('✗ bubble 无 bounding box');
    process.exit(1);
  }
  // 整体页面截图
  out('verify_bubble_v21_full', await page.screenshot({ fullPage: false }));
  // 气泡区域 + 周围 60px
  const clip = {
    x: Math.max(0, box.x - 60),
    y: Math.max(0, box.y - 60),
    width: Math.min(1440 - Math.max(0, box.x - 60), box.width + 120),
    height: Math.min(900 - Math.max(0, box.y - 60), box.height + 120),
  };
  out('verify_bubble_v21_crop', await page.screenshot({ clip }));

  // 读取气泡的 computed 宽度
  const computed = await bubble.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      width: cs.width,
      minWidth: cs.minWidth,
      maxWidth: cs.maxWidth,
      padding: cs.padding,
      border: cs.border,
    };
  });
  console.log('  computed:', JSON.stringify(computed));

  await browser.close();

  // 校验：computed width 应 <= max-width: 360, 且 minWidth 必须为 0（已去掉 min-width 强制）
  const w = parseFloat(computed.width);
  const minW = parseFloat(computed.minWidth);
  if (minW > 0) {
    console.log(`✗ 气泡 min-width 仍为 ${computed.minWidth}, 期望 0 (自适应)`);
    process.exit(1);
  }
  if (w > 360) {
    console.log(`✗ 气泡宽度 ${computed.width} 超过 max-width: 360`);
    process.exit(1);
  }
  console.log(`✓ 气泡宽度 ${computed.width}, min-width=${computed.minWidth} (已自适应, 不强制 280px)`);
})();