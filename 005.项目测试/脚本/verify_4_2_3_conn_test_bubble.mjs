/**
 * PRD §4.2.3 验证脚本：
 *  - 连通测试成功：仅弹「✓ 测试验证正常」气泡（无知识库/方案复用提示）
 *  - 连通测试失败：弹「✗ 测试验证异常（错误码 XXX）」+ Agent 联网搜索解决方案气泡
 *    - NXDOMAIN / 504 / 401 / 400 各自对应 2 张解决方案卡片
 *  - 不在页面上展示独立「历史方案复用」Card（PRD §3.3.2 已下线）
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const ART = '/Users/harry/Desktop/CC_TEST/agent-system/verify_4_2_3_conn_test_bubble_artefacts';
fs.mkdirSync(ART, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});

const log = (s) => console.log(`[verify] ${s}`);

await page.goto('http://localhost:5173/app/agent-center/smart-register', {
  waitUntil: 'networkidle',
  timeout: 30000,
});
await page.waitForTimeout(1500);

// 1) 备案材料 — 必须上传产品/技术规格书才能让表单不阻塞（这里只是测连通，先绕过）
// 但连通测试按钮的 disabled 仅看 tech 字段是否齐全，与备案材料无关——无需上传
// 2) 基本信息填齐
log('fill basic info');
await page.locator('input[id="name"]').fill('VerifyConnTesterAgent');
await page.locator('input[id="contactName"]').fill('张三');
await page.locator('input[id="contactPhone"]').fill('13800001111');
await page.locator('textarea[id="description"]').fill('用于连通测试验证');
// 所属科室
await page.locator('div.ant-select:has-text("请选择科室（科室代码+科室名称）")').first().click();
await page.waitForTimeout(300);
await page.locator('.ant-select-item-option').first().click();
await page.waitForTimeout(300);

// 进入 ③ 技术信息 区
await page.locator('text=③ 技术信息').scrollIntoViewIfNeeded();
await page.waitForTimeout(300);

// 通用工具
const robotSelector = '[aria-label="唤起医小管(台账助手)"], [aria-label*="医小管"]';
const testerSelector = '[data-testid="connectivity-tester"]';

async function openChat() {
  const robot = page.locator(robotSelector).first();
  if ((await robot.count()) === 0) {
    log('  robot icon not found');
    return;
  }
  await robot.click();
  await page.waitForTimeout(800);
}

async function fillAndTest({ apiEndpoint, apiKey, label }) {
  log(`Case ${label}`);
  await page.locator('input[id="apiEndpoint"]').fill(apiEndpoint);
  await page.locator('input[id="apiKey"]').fill(apiKey);
  // 重置再开始（避免上次状态残留）
  const resetBtn = page.locator(`${testerSelector} button:has-text("重置")`);
  if (await resetBtn.count() > 0) {
    await resetBtn.click();
    await page.waitForTimeout(300);
  }
  await page.locator(`${testerSelector} button:has-text("测试验证")`).click();
  // 5 阶段 × 600ms + buffer ≈ 3.5s
  await page.waitForTimeout(4000);
}

// 打开 ChatPanel 一次，后续 case 都看得见
await openChat();

// ── Case A：成功 ──
await fillAndTest({
  apiEndpoint: 'http://10.10.10.20:8080/chat',
  apiKey: 'sk-test-key-success',
  label: 'A: success',
});
await page.screenshot({ path: `${ART}/A_success_full.png`, fullPage: false });
const a_pass = await page.locator('[data-testid="conn-test-result-msg"]').count();
const a_ws = await page.locator('[data-testid="web-search-solution-msg"]').count();
const a_hp = await page.locator('[data-testid="historical-plan-msg"]').count();
log(`  conn-test-result=${a_pass} (期望 ≥1), web-search=${a_ws} (期望 0), historical-plan=${a_hp} (期望 0)`);
const aPassMsg = page.locator('[data-testid="conn-test-result-msg"]').last();
if (await aPassMsg.count() > 0) {
  await aPassMsg.scrollIntoViewIfNeeded();
  await aPassMsg.screenshot({ path: `${ART}/A_success_bubble.png` });
}

// ── Case B：401 鉴权失败 ──
await fillAndTest({
  apiEndpoint: 'http://10.10.10.20:8080/chat',
  apiKey: 'sk-401-FAIL-test',
  label: 'B: 401',
});
await page.screenshot({ path: `${ART}/B_401_full.png`, fullPage: false });
const b_fail = await page.locator('[data-testid="conn-test-result-msg"]').count();
const b_ws = await page.locator('[data-testid="web-search-solution-msg"]').count();
const b_wsCards = await page.locator('[data-testid^="web-search-solution-ws-"]').count();
log(`  conn-test-result=${b_fail} (期望 ≥1), web-search=${b_ws} (期望 ≥1), cards=${b_wsCards} (期望 2)`);
const bFailMsg = page.locator('[data-testid="conn-test-result-msg"]').last();
if (await bFailMsg.count() > 0) {
  await bFailMsg.scrollIntoViewIfNeeded();
  await bFailMsg.screenshot({ path: `${ART}/B_401_result_bubble.png` });
}
const bWsMsg = page.locator('[data-testid="web-search-solution-msg"]').last();
if (await bWsMsg.count() > 0) {
  await bWsMsg.scrollIntoViewIfNeeded();
  await bWsMsg.screenshot({ path: `${ART}/B_401_websearch_bubble.png` });
}

// ── Case C：NXDOMAIN ──
await fillAndTest({
  apiEndpoint: 'http://badhost.example.com/api',
  apiKey: 'sk-test-key',
  label: 'C: NXDOMAIN',
});
await page.screenshot({ path: `${ART}/C_nxdomain_full.png`, fullPage: false });
const c_wsCards = await page.locator('[data-testid^="web-search-solution-ws-"]').count();
log(`  web-search cards=${c_wsCards} (期望 2)`);
const cWsMsg = page.locator('[data-testid="web-search-solution-msg"]').last();
if (await cWsMsg.count() > 0) {
  await cWsMsg.scrollIntoViewIfNeeded();
  await cWsMsg.screenshot({ path: `${ART}/C_nxdomain_websearch_bubble.png` });
}

// ── Case D：504 ──
await fillAndTest({
  apiEndpoint: 'http://10.10.10.20:8080/chat',
  apiKey: 'sk-504-FAIL-test',
  label: 'D: 504',
});
await page.screenshot({ path: `${ART}/D_504_full.png`, fullPage: false });
const d_wsCards = await page.locator('[data-testid^="web-search-solution-ws-"]').count();
log(`  web-search cards=${d_wsCards} (期望 2)`);
const dWsMsg = page.locator('[data-testid="web-search-solution-msg"]').last();
if (await dWsMsg.count() > 0) {
  await dWsMsg.scrollIntoViewIfNeeded();
  await dWsMsg.screenshot({ path: `${ART}/D_504_websearch_bubble.png` });
}

// ── Case E：400 ──
await fillAndTest({
  apiEndpoint: 'http://10.10.10.20:8080/400/bad',
  apiKey: 'sk-test-key',
  label: 'E: 400',
});
await page.screenshot({ path: `${ART}/E_400_full.png`, fullPage: false });
const e_wsCards = await page.locator('[data-testid^="web-search-solution-ws-"]').count();
log(`  web-search cards=${e_wsCards} (期望 2)`);
const eWsMsg = page.locator('[data-testid="web-search-solution-msg"]').last();
if (await eWsMsg.count() > 0) {
  await eWsMsg.scrollIntoViewIfNeeded();
  await eWsMsg.screenshot({ path: `${ART}/E_400_websearch_bubble.png` });
}

// 最终聊天面板整图
await page.screenshot({ path: `${ART}/F_chatpanel_final.png`, fullPage: false });

console.log('--- summary ---');
console.log('errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

await browser.close();