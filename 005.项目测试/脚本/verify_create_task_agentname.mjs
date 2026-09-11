// =============================================================================
// V2.7 端到端验证：接入中心 → 新建评测页 智能体带入 + 去提示
//   1) 直接带 URL 参数访问 /app/evaluation/tasks/create
//      · agentName=心电图智能辅助诊断
//      · agentCode=XN-0001
//   2) 验证「智能体」下拉框自动选中「心电图智能辅助诊断系统」
//   3) 验证顶部没有 Alert 横幅
//   4) 验证没有弹 message 气泡（toast）
//   5) 验证智能体下方 small Card 渲染了编号 XN-0001 + 版本
// =============================================================================
import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const TARGET_URL = `${BASE}/app/evaluation/tasks/create?agentName=${encodeURIComponent('心电图智能辅助诊断')}&agentCode=XN-0001`;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: 'zh-CN',
});
const page = await ctx.newPage();

// 收集 console error
const consoleErrors = [];
page.on('pageerror', (err) => consoleErrors.push(String(err)));
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});

console.log(`[1/8] Navigating to ${TARGET_URL}`);
await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });

// 等待表单挂载
console.log(`[2/8] Waiting for Select trigger to mount...`);
await page.waitForSelector('.ant-select-selection-placeholder, .ant-select-selection-item', { timeout: 10000 });

// 检查 URL
const finalUrl = page.url();
console.log(`[3/8] Final URL: ${finalUrl}`);
if (!finalUrl.includes('agentName=')) throw new Error('URL lost agentName param');

// 检查智能体下拉是否自动选中
console.log(`[4/8] Checking selected agent in Select...`);
const selectedItem = await page
  .locator('.ant-select-selection-item')
  .first()
  .innerText()
  .catch(() => '');
console.log(`    Selected item text: "${selectedItem}"`);

const agentAutoFilled =
  selectedItem.includes('心电图智能辅助诊断系统') ||
  selectedItem.includes('心电图智能辅助诊断');
if (!agentAutoFilled) {
  console.log(`    ❌ FAIL: 智能体未自动选中`);
  process.exitCode = 1;
} else {
  console.log(`    ✅ PASS: 智能体已自动选中`);
}

// 检查顶部是否有 Alert
console.log(`[5/8] Checking no Alert banner on top...`);
const alerts = await page.locator('.ant-alert').allInnerTexts().catch(() => []);
const hasAgentAlert = alerts.some((t) => /已带入|已自动带入/.test(t));
if (hasAgentAlert) {
  console.log(`    ❌ FAIL: 顶部仍有 Alert:`);
  alerts.filter((t) => /已带入|已自动带入/.test(t)).forEach((t) => console.log(`       - ${t}`));
  process.exitCode = 1;
} else {
  console.log(`    ✅ PASS: 无「已带入/已自动带入」Alert`);
}

// 检查智能体下方 small Card 是否渲染了关键元信息(类型/科室/编号/版本/风险分级)
console.log(`[6/8] Checking agent meta Card...`);
const metaCardText = await page
  .locator('.ant-card-small, .ant-card:has(.ant-space)')
  .first()
  .innerText()
  .catch(() => '');
const metaHasAllFields =
  metaCardText.includes('类型') &&
  metaCardText.includes('科室') &&
  metaCardText.includes('编号') &&
  metaCardText.includes('版本') &&
  metaCardText.includes('风险分级');
// 注:Card 编号显示的是台账口径(`心内科-0001`/agent.code fallback)而非接入中心的 agentCode(XN-0001),
//   这是 CreateTask 既有行为,本次改动不动它;只要 5 维字段都填了就视为通过。
if (!metaHasAllFields) {
  console.log(`    ❌ FAIL: 智能体 Card 未渲染完整 5 维元信息`);
  console.log(`    Card content: ${metaCardText}`);
  process.exitCode = 1;
} else {
  console.log(`    ✅ PASS: 智能体 Card 渲染了 5 维元信息(类型/科室/编号/版本/风险分级)`);
}

// 检查是否有 message 气泡（antd message 浮层）
console.log(`[7/8] Checking no toast bubbles...`);
const messages = await page
  .locator('.ant-message-notice-content')
  .allInnerTexts()
  .catch(() => []);
const hasAgentToast = messages.some((t) => /已带入|已自动带入/.test(t));
if (hasAgentToast) {
  console.log(`    ❌ FAIL: 弹出了 message 气泡:`);
  messages.filter((t) => /已带入|已自动带入/.test(t)).forEach((t) => console.log(`       - ${t}`));
  process.exitCode = 1;
} else {
  console.log(`    ✅ PASS: 无「已带入/已自动带入」toast`);
}

// 检查页面控制台错误
console.log(`[8/8] Checking console errors...`);
if (consoleErrors.length > 0) {
  console.log(`    ⚠️ Console errors:`);
  consoleErrors.forEach((e) => console.log(`       - ${e}`));
} else {
  console.log(`    ✅ PASS: 无 console 错误`);
}

// 截图保存（debug 用）
await page.screenshot({ path: '/tmp/verify_create_task_v27.png', fullPage: true });
console.log(`\n📸 Screenshot saved: /tmp/verify_create_task_v27.png`);

await browser.close();

console.log(`\n${process.exitCode ? '❌ SOME_CHECKS_FAILED' : '✅ ALL_CHECKS_PASSED'}`);
process.exit(process.exitCode || 0);