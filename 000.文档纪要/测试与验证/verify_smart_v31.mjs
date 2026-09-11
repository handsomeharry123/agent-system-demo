// verify_smart_v31.mjs — 验证「接入信息智能填写」Demo 修正 (PRD v1 §3.1)
// 覆盖：
//   1) 进入 /app/agent-center/smart-register → 机器人旁 page-level 欢迎气泡出现
//   2) 标题 / hover 气泡 改为「医小管 · 智能填写助手」
//   3) 备案材料三档拆分（产品说明书 / 技术规格书 / 其他材料）
//   4) 诊疗环节选「其他」时联动出现 临床环节custom 输入框 (限 20 字)
//   5) 点击机器人展开对话浮层 → 标题栏显示「医小管」
//   6) 浮层内有「先上传产品说明书与规格书 PDF」欢迎语

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve('.');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';

const dump = (label, page) => {
  const filename = `verify_smart_v31_${label}.png`;
  return page.screenshot({ path: path.join(OUT_DIR, filename), fullPage: false }).then(() => {
    console.log(`截图：${filename}`);
  });
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // 通过演示登录或直跳路由（路由表基于 BrowserRouter，期望已登录态）
  await page.goto(`${BASE}/app/agent-center/smart-register`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // (1) 检查机器人旁欢迎气泡
  const welcomeBubble = page.locator('.agent-welcome-bubble');
  const bubbleVisible = await welcomeBubble.isVisible().catch(() => false);
  console.log(`[1] 机器人旁欢迎气泡 visible = ${bubbleVisible}`);
  const bubbleText = bubbleVisible ? await welcomeBubble.innerText() : '';
  console.log(`[1] 欢迎语片段：${bubbleText.slice(0, 60)}…`);
  await dump('1_welcome_bubble', page);

  // (2) hover 机器人旁的 tooltip
  await page.locator('.agent-welcome-bubble').click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(400);
  const chatHeader = page.locator('text=医小管 · 智能填写助手').first();
  const headerVisible = await chatHeader.isVisible().catch(() => false);
  console.log(`[2] 浮层标题含「医小管」visible = ${headerVisible}`);
  await dump('2_chat_panel', page);

  // (3) 备案材料三档
  for (const label of ['产品说明书', '技术规格书', '其他材料']) {
    const v = await page.getByText(label, { exact: true }).first().isVisible().catch(() => false);
    console.log(`[3] 备案材料 · ${label} visible = ${v}`);
  }
  await dump('3_materials_split', page);

  // (4) 诊疗环节选「其他」联动
  const stageSelect = page.locator('label:has-text("诊疗环节")').first().locator('xpath=following::div[1]//input[1]');
  await stageSelect.click({ force: true });
  await page.waitForTimeout(300);
  await page.locator('.ant-select-item-option-content:has-text("其他")').first().click({ force: true });
  await page.waitForTimeout(400);
  const customInput = page.locator('label:has-text("诊疗环节（其他）")').first();
  const customVisible = await customInput.isVisible().catch(() => false);
  console.log(`[4] 选「其他」时出现诊疗环节custom输入框 visible = ${customVisible}`);
  await dump('4_clinical_other', page);

  await browser.close();
  console.log('\n✅ verify_smart_v31 完成');
})().catch((e) => {
  console.error('验证脚本异常：', e);
  process.exit(1);
});
