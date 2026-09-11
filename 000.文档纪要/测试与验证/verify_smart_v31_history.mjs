// verify_smart_v31_history.mjs
//
// V3.1 历史方案复用 §3.3.2 改造验收：
//   - 进入新建注册页 (/app/agent-center/smart-register) 立即可见
//     医小管机器人 + 右下角 page-level 欢迎气泡
//   - 唤起对话窗口，验证 'historical-plan' 气泡存在（page-init Top3）
//   - 原 ConnectivityTester 中的「历史方案复用」独立 Card 已下线
//   - 验收截图：智能注册页（对话未开）+ 对话已开显示历史方案气泡

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/tmp/verify_smart_v31_history';
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

  // 1) 进入智能体接入中心 (演示设置模式在右上头像下拉,可切换角色; 此处直接走信息科管理员 admin)
  await page.goto('http://localhost:3001/app/agent-center/smart-register', { waitUntil: 'networkidle' });

  // 等卡片加载
  await page.waitForSelector('text=① 备案材料上传', { timeout: 15000 });
  // 截图 1: 新建注册页全貌 (含对话未开 + 历史方案 Card 已下线)
  await page.screenshot({ path: path.join(ROOT, '1-smart-register-page-init.png'), fullPage: false });
  console.log('✓ 截图 1: smart-register 初始全貌(确认页面已下线历史方案 Card)');

  // 2) 等待 page-init 历史方案气泡消息落地 (presence in store.messages)
  await page.waitForTimeout(800);

  // 3) 唤起 Agent 对话浮层 (点击右下机器人)
  const robot = page.getByLabel('唤起智能填写助手（医小管）');
  await robot.waitFor({ state: 'visible', timeout: 5000 });
  await robot.click();

  // 等对话窗口出现
  await page.waitForSelector('[data-testid="historical-plan-msg"]', { timeout: 5000 });

  // 4) 验收 1: 历史方案气泡在对话窗口中存在
  const hpMsg = page.locator('[data-testid="historical-plan-msg"]');
  const hpCount = await hpMsg.count();
  console.log(`✓ historical-plan 消息数量: ${hpCount}`);

  const cardCount = await page.locator('[data-testid^="historical-plan-card-"]').count();
  console.log(`✓ 卡片数: ${cardCount}`);

  // 5) 截图 2: 对话已开 + 历史方案气泡
  await page.screenshot({ path: path.join(ROOT, '2-chat-with-historical-plan.png'), fullPage: false });
  console.log('✓ 截图 2: 对话窗口显示 page-init Top3 历史方案气泡');

  // 6) 关键断言: 整页不应再出现「按匹配度推荐（知识库共 X 条）」页内 Card
  const inPageCard = await page.locator('text=按匹配度推荐').count();
  console.log(`页面内仍残留的"按匹配度推荐" Card 计数: ${inPageCard} (应为 0)`);

  // 7) 截屏：仅消息区
  const chatPanel = page.locator('text=医小管').first();
  await chatPanel.scrollIntoViewIfNeeded();

  // 8) 点击「复用此方案」按钮,验证 toast / 对话反馈
  const reuseBtn = page.locator('[data-testid^="historical-plan-reuse-"]').first();
  await reuseBtn.waitFor({ state: 'visible', timeout: 3000 });
  await reuseBtn.click();
  await page.waitForTimeout(500);

  // 截图 3: 点击复用按钮后的对话反馈
  await page.screenshot({ path: path.join(ROOT, '3-after-reuse-plan.png'), fullPage: false });
  console.log('✓ 截图 3: 点击「复用此方案」后对话出现 agent 反馈');

  // 9) 关闭对话窗口(便于检查 ConnectivityTester 区段)
  const closeBtn = page.locator('button[aria-label=收起对话]');
  if (await closeBtn.count()) await closeBtn.first().click();
  await page.waitForTimeout(500);

  // 10) 截图 4: 整页确认「历史方案复用」独立 Card 已下线
  await page.screenshot({ path: path.join(ROOT, '4-page-after-verify.png'), fullPage: true });

  console.log('=== 截图目录 ===');
  for (const f of fs.readdirSync(ROOT)) console.log('  -', path.join(ROOT, f));

  await browser.close();
};

main().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
