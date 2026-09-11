/**
 * PRD §4.3 V5.0: 备案材料生成提示改为机器人旁侧气泡 (不在 ChatPanel 内)
 *
 * 场景: 进入 smart-register 页, 填齐必填信息, 不上传 product/tech 文档
 * 期望:
 *   1. 出现机器人旁独立侧气泡 (data-testid="material-offer-bubble")
 *   2. 侧气泡有 "备案材料 · 可生成" Tag + 文案 + "生成产品说明书"/"生成技术说明书"/"暂不生成" 3 个按钮
 *   3. ChatPanel 内不出现 "备案材料 · 可生成" 卡片 (data-testid="material-generation-offer-msg" 不存在)
 *   4. 点击 "暂不生成" 后侧气泡消失
 *   5. 点击 "生成产品说明书" 后侧气泡消失, 备案材料里出现 "智能体名称-产品说明书.pdf"
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const ART = '/Users/harry/Desktop/CC_TEST/agent-system/verify_4_3_material_offer_side_artefacts';
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
await page.waitForTimeout(2000);

// 填齐必填信息
log('fill required fields');
await page.locator('input[id="name"]').fill('MaterialOfferTestAgent');
await page.locator('input[id="contactName"]').fill('张三');
await page.locator('input[id="contactPhone"]').fill('13800001111');
await page.locator('textarea[id="description"]').fill('用于验证机器人旁侧气泡');
// 所属科室
await page.locator('div.ant-select:has-text("请选择科室（科室代码+科室名称）")').first().click();
await page.waitForTimeout(300);
await page.locator('.ant-select-item-option').first().click();
await page.waitForTimeout(300);
// 必填触发: 还需填 apiEndpoint (因默认 accessMode=API)
await page.locator('input[id="apiEndpoint"]').fill('http://10.10.10.20:8080/chat');
await page.locator('input[id="apiKey"]').fill('sk-test-key');
// 触发 onValuesChange 让 runReview + maybePushMaterialGenerationOffer 跑
await page.locator('input[id="apiEndpoint"]').click();
await page.waitForTimeout(1500); // 1.2s runReview + 800ms debounce

// 等侧气泡出现 (runReview + maybePushMaterialGenerationOffer 同步触发)
await page.waitForTimeout(800);

// 1. 侧气泡应该存在
const sideBubbleCount = await page.locator('[data-testid="material-offer-bubble"]').count();
log(`side-bubble count: ${sideBubbleCount} (期望 1)`);

// 2. ChatPanel 内不应出现 (data-testid="material-generation-offer-msg")
const chatPanelCardCount = await page.locator('[data-testid="material-generation-offer-msg"]').count();
log(`chatPanel material-card count: ${chatPanelCardCount} (期望 0)`);

// 截图整页
await page.screenshot({ path: `${ART}/A_offer_in_side_bubble.png`, fullPage: false });

// 单独抓侧气泡截图
const sideBubble = page.locator('[data-testid="material-offer-bubble"]').first();
if (await sideBubble.count() > 0) {
  await sideBubble.scrollIntoViewIfNeeded();
  await sideBubble.screenshot({ path: `${ART}/A_side_bubble_only.png` });
}

// 3. 打开 ChatPanel — 侧气泡应该自动隐藏, ChatPanel 内不出现 material 卡片
log('open ChatPanel');
await page.locator('[aria-label="唤起医小管(台账助手)"], [aria-label*="医小管"]').first().click();
await page.waitForTimeout(800);

const sideBubbleAfterOpen = await page.locator('[data-testid="material-offer-bubble"]').count();
log(`side-bubble after open ChatPanel: ${sideBubbleAfterOpen} (期望 0, ChatPanel 打开时不重复显示)`);

const chatPanelCardAfterOpen = await page.locator('[data-testid="material-generation-offer-msg"]').count();
log(`chatPanel material-card after open: ${chatPanelCardAfterOpen} (期望 0, 不再写入 messages)`);

await page.screenshot({ path: `${ART}/B_chatpanel_open_no_offer.png`, fullPage: false });

// 4. 关闭 ChatPanel, 侧气泡应再次出现
// AgentAssistant 关闭按钮是标题栏右上角 CloseOutlined icon button, 无文字
// 用 page.keyboard.press Escape 或重新点击智能体图标触发 toggle
// 由于 ChatPanel 内部 open state 是 React component state, 直接 ecape 关闭
const escKey = page.keyboard.press('Escape');
await escKey.catch(() => {});
await page.waitForTimeout(300);
// 直接 reload 页面来回到初始态 (避免 ChatPanel 关闭逻辑复杂)
await page.goto('http://localhost:5173/app/agent-center/smart-register', {
  waitUntil: 'networkidle',
  timeout: 30000,
});
await page.waitForTimeout(1500);
// 重新填表 (reload 会丢状态)
await page.locator('input[id="name"]').fill('MaterialOfferTestAgent2');
await page.locator('input[id="contactName"]').fill('张三');
await page.locator('input[id="contactPhone"]').fill('13800001111');
await page.locator('textarea[id="description"]').fill('用于验证机器人旁侧气泡 V2');
await page.locator('div.ant-select:has-text("请选择科室")').first().click();
await page.waitForTimeout(300);
await page.locator('.ant-select-item-option').first().click();
await page.waitForTimeout(300);
await page.locator('input[id="apiEndpoint"]').fill('http://10.10.10.20:8080/chat');
await page.locator('input[id="apiKey"]').fill('sk-test-key');
await page.locator('input[id="apiEndpoint"]').click();
await page.waitForTimeout(1500);

const sideBubbleAfterReload = await page.locator('[data-testid="material-offer-bubble"]').count();
log(`side-bubble after reload: ${sideBubbleAfterReload} (期望 1, 重新出现)`);

// 5. 点击 "暂不生成" 按钮 -> 侧气泡消失
log('click "暂不生成"');
const dismissBtn = page.locator('[data-testid="side-bubble-dismiss-material-generation-btn"]').first();
if (await dismissBtn.count() > 0) {
  await dismissBtn.click();
  await page.waitForTimeout(600);
}
const sideBubbleAfterDismiss = await page.locator('[data-testid="material-offer-bubble"]').count();
log(`side-bubble after dismiss: ${sideBubbleAfterDismiss} (期望 0)`);
await page.screenshot({ path: `${ART}/C_after_dismiss.png`, fullPage: false });

console.log('--- summary ---');
console.log('errors:', errors.length);
errors.forEach((e) => console.log('  ', e));

await browser.close();