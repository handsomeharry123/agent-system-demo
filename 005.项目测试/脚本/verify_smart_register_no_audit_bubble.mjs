// verify_smart_register_no_audit_bubble.mjs
//
// 验证 PRD §4.2 新建注册页改版:
//   1. 进入页面 / 改动非技术字段时, 对话窗口不应再出现 pre-audit-* 气泡
//   2. 接入方式 + 接口地址 + API Key 完整 → ConnectivityTester 自动跑 (autoTriggerKey 触发)
//   3. 任一接入字段再修改 → 再次触发自动重跑
//
// 输出: verify_smart_register_no_audit_bubble/*.png + console.log 报告

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'verify_smart_register_no_audit_bubble';
fs.mkdirSync(ROOT, { recursive: true });

const log = (...a) => console.log('[verify]', ...a);

const main = async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

  // §1. 默认 admin 角色 → 进入新建注册页
  await page.goto('http://localhost:3001/app/agent-center/smart-register', {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(1500); // 等欢迎语 / store hydrate
  log('STEP-1 加载完成');
  await page.screenshot({ path: path.join(ROOT, '1-initial-load.png'), fullPage: false });

  // 测点 A: 进入页面 1.5s 后, 对话窗口 / 机器人旁气泡不应出现 pre-audit-summary / pre-audit-issue 气泡
  const preAuditSummary = await page.locator('[data-testid="pre-audit-summary-msg"]').count();
  const preAuditIssues = await page.locator('[data-testid^="pre-audit-issue-msg-"]').count();
  log(`pre-audit-summary count: ${preAuditSummary}`);
  log(`pre-audit-issue count: ${preAuditIssues}`);

  // 测点 A 加固: 试着改动几个"非技术字段" (智能体名称), 看是否还会触发任何 pre-audit
  // 找到智能体名称输入
  await page.locator('input#name').first().fill('测试智能体-验证-A');
  await page.waitForTimeout(1200); // 等老逻辑 800ms debounce + 1.2s auto; 即便装老也不该出现
  const preAuditSummary2 = await page.locator('[data-testid="pre-audit-summary-msg"]').count();
  const preAuditIssues2 = await page.locator('[data-testid^="pre-audit-issue-msg-"]').count();
  log(`改动 name 后 pre-audit-summary count: ${preAuditSummary2}`);
  log(`改动 name 后 pre-audit-issue count: ${preAuditIssues2}`);
  await page.screenshot({ path: path.join(ROOT, '2-after-name-change.png'), fullPage: false });

  // 测点 B: 接入方式 (API) + 接口地址 + API Key 完整 → 自动跳起
  // 用 type 而不是 fill:fill 在 React Controlled input 下有时不会触发 onChange
  const apiEndpointInput = page.locator('input#apiEndpoint');
  const apiKeyInput = page.locator('input#apiKey');
  await apiEndpointInput.scrollIntoViewIfNeeded();
  // 用 focus + keyboard 模拟真实键入
  await apiEndpointInput.click();
  await apiEndpointInput.fill('');
  await apiEndpointInput.type('http://10.10.10.20:8080/chat', { delay: 10 });
  await apiKeyInput.click();
  await apiKeyInput.fill('');
  await apiKeyInput.type('sk-verify-bubble-pass', { delay: 10 });
  // tab 触发 blur
  await page.keyboard.press('Tab');
  await page.waitForTimeout(1500);
  log('STEP-2 已填接口地址 + API Key (type + blur)');

  // 等 ConnectivityTester 卡片自动跑起来
  const testerLocator = page.locator('[data-testid="connectivity-tester"]');
  await testerLocator.waitFor({ timeout: 5000 });
  await testerLocator.scrollIntoViewIfNeeded();
  log('connectivity-tester 已渲染');

  // 调试: 通过 page.evaluate 直接读 form state
  const debug = await page.evaluate(() => {
    const w = window;
    const ep = document.querySelector('input#apiEndpoint');
    const ak = document.querySelector('input#apiKey');
    const tester = document.querySelector('[data-testid="connectivity-tester"]');
    // 拿到 tester 上所有属性,判断 react 是否真的渲染了 data-auto-trigger-key
    let attrList = [];
    if (tester) {
      for (const a of tester.attributes) attrList.push(`${a.name}=${JSON.stringify(a.value)}`);
    }
    return {
      apiEndpointValue: ep?.value || null,
      apiKeyValueLen: ak?.value?.length || 0,
      testerNode: !!tester,
      testerAttrs: attrList,
      inputsCount: document.querySelectorAll('input').length,
      smartDraftReady: typeof w.__smartDraft === 'object',
    };
  });
  log('STEP-2 debug', JSON.stringify(debug, null, 2));

  await page.screenshot({ path: path.join(ROOT, '3-just-after-fill.png'), fullPage: true });

  // 等出现 "全流程通过" 或失败诊断 (< 8s 一般就完事; 5 阶段 * 600ms ≈ 3s)
  const passTag = testerLocator.locator('text=全流程通过');
  const failTag = testerLocator.locator('text=失败于');
  let autoTriggered = false;
  let testOutcome = '';
  try {
    await passTag.waitFor({ timeout: 15000 });
    autoTriggered = true;
    testOutcome = 'pass';
  } catch (_) {
    try {
      await failTag.waitFor({ timeout: 2000 });
      autoTriggered = true;
      testOutcome = 'fail';
    } catch (__) {}
  }
  log(`测点 B autoTriggered: ${autoTriggered}, outcome: ${testOutcome}`);
  await page.screenshot({ path: path.join(ROOT, '4-after-auto-test.png'), fullPage: false });

  // 测点 C: 改动任意接入字段 (改接口地址) → 再次"测试中…"
  // 先记一下 data-auto-trigger-key 当前值
  const keyBefore = await testerLocator.getAttribute('data-auto-trigger-key');
  log(`auto-trigger-key before change: ${keyBefore}`);

  await apiEndpointInput.fill('http://10.10.10.30:9090/chat-v2');
  await page.waitForTimeout(200);
  const keyAfter = await testerLocator.getAttribute('data-auto-trigger-key');
  log(`auto-trigger-key after change: ${keyAfter}`);

  // 等待再次出现"测试中…" 或进入"全流程通过"
  let reTriggered = false;
  try {
    await testerLocator.locator('text=测试中').first().waitFor({ timeout: 5000 });
    reTriggered = true;
  } catch (_) {}
  // 即使没等来"测试中", 也等最终结果
  try {
    await passTag.waitFor({ timeout: 15000 });
    reTriggered = true;
  } catch (_) {}
  log(`测点 C reTriggered: ${reTriggered}`);

  await page.screenshot({ path: path.join(ROOT, '5-after-modify-endpoint.png'), fullPage: false });

  // Probe: SDK 分支
  log('PROBE-SDK 切换到 SDK 分支');
  await page.locator('label.ant-radio-button-wrapper').filter({ hasText: 'SDK 接入' }).click();
  await page.waitForTimeout(800); // 等 react 状态更新
  // 默认应该自动签发 platformUrl+platformKey; 看 ConnectivityTester 是否再次自动跑
  await page.screenshot({ path: path.join(ROOT, '6-probe-sdk-mode.png'), fullPage: false });

  log('console errors:', consoleErrors.length);
  if (consoleErrors.length) {
    log(consoleErrors.slice(0, 10).join('\n  '));
  }

  await browser.close();

  // 总结
  const result = {
    preAuditCount_initial: preAuditSummary + preAuditIssues,
    preAuditCount_afterNameChange: preAuditSummary2 + preAuditIssues2,
    autoTriggered,
    testOutcome,
    reTriggered,
    consoleErrors: consoleErrors.length,
  };
  log('FINAL', JSON.stringify(result, null, 2));
};

main().catch((e) => {
  console.error('[verify] crashed:', e);
  process.exit(1);
});
