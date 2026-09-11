#!/usr/bin/env node
/**
 * §4.2 fix verify:
 * 1. 进入新建注册页
 * 2. 通过 __smartDraft.applyPrefill 模拟「PDF 一次性预填」(12 个字段)
 * 3. 验证:
 *    - ConnectivityTester 自动跑(产生 conn-test-result 气泡)
 *    - 必填完整 + 缺「产品说明书」时, material-offer-bubble 出现
 *
 * 关键 store dev hook:
 *   window.__smartDraft.applyPrefill(fields)  // 模拟 PDF 预填
 *   window.__useAuthSetRole('admin' | 'dept')
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';

const cases = [];
function record(name, pass, detail = '') {
  cases.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
}

async function switchRole(page, role) {
  await page.evaluate((r) => {
    const hook = window.__useAuthSetRole;
    if (typeof hook === 'function') hook(r);
  }, role);
  await page.waitForTimeout(200);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

  // 1. 先访问接入中心主页 → 切 admin → 然后跳 smart-register
  await page.goto(`${BASE}/app/agent-center`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await switchRole(page, 'admin');

  await page.goto(`${BASE}/app/agent-center/smart-register`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 2. 通过 dev hook 模拟 PDF 一次性预填(不触发 blur、不动 fileList)
  //    字段集合: 跟 AgentAssistant.recognizeFile isTechSpec=true 分支对齐,共 12 个
  const prefilled = await page.evaluate(() => {
    const hook = window.__smartDraft;
    if (!hook) return { ok: false, reason: 'no __smartDraft hook' };
    hook.applyPrefill([
      { fieldKey: 'name',           value: '门诊预问诊智能体',  confidence: 0.96, source: '示例智能体-技术规格说明书.pdf §1.1' },
      { fieldKey: 'version',        value: '2.1',              confidence: 0.93, source: '§1.3' },
      { fieldKey: 'department',     value: '急诊科',            confidence: 0.88, source: '§1.4 语义联动' },
      { fieldKey: 'clinicalStage',  value: '导诊分诊',          confidence: 0.82, source: '§1.4 语义联动' },
      { fieldKey: 'source',         value: '合作研发',          confidence: 0.85, source: '§1.5' },
      { fieldKey: 'supplier',       value: '医智未来科技有限公司', confidence: 0.92, source: '§2.1' },
      { fieldKey: 'contactName',    value: '李文博',            confidence: 0.9,  source: '§2.2' },
      { fieldKey: 'contactPhone',   value: '13800138000',       confidence: 0.86, source: '§2.2' },
      { fieldKey: 'description',    value: '面向门诊患者开展预问诊服务，自动采集主诉、现病史、既往史等信息。', confidence: 0.91, source: '§3.1' },
      { fieldKey: 'accessMode',     value: 'API',               confidence: 0.92, source: '§4.1' },
      { fieldKey: 'apiEndpoint',    value: 'http://10.10.10.20:8080/api/triage', confidence: 0.9, source: '§4.2' },
      { fieldKey: 'apiKey',         value: 'sk-demo-aBcD3FgH9jKlMnOpQ2rStUvWxYz', confidence: 0.65, source: '§4.3' },
    ]);
    return { ok: true, count: 12 };
  });
  record('PDF 预填 hook 调用成功', prefilled.ok && prefilled.count === 12, JSON.stringify(prefilled));

  // 3. 等 ConnectivityTester 跑完(默认 mock 1500ms + 步骤推进)
  await page.waitForTimeout(3500);

  // 4. 验证: ① ConnectivityTester autoTriggerKey 已签到非空 ② DOM 出现测试步骤/结果
  const connState = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="connectivity-tester"]');
    if (!root) return { ok: false, autoKey: null, bodyText: '' };
    return {
      ok: true,
      autoKey: root.getAttribute('data-auto-trigger-key') || '',
      bodyText: (root.textContent || '').slice(0, 500),
    };
  });
  record(
    'PDF 预填后 ConnectivityTester autoTriggerKey 非空',
    connState.ok && connState.autoKey.startsWith('API::'),
    `autoKey=${connState.autoKey}`,
  );

  // 5. 验证:机器人旁/对话窗口出现测试结果文案
  const chatTexts = await page.evaluate(() => {
    const root = document.querySelector('.agent-chat-window, .agent-assistant, [class*="chat-panel"]');
    return root ? (root.textContent || '') : '';
  });
  const flatChat = chatTexts || '';
  record(
    'PDF 预填后连通测试自动跑(对话窗口出现测试结果文案)',
    /联通成功|测试验证正常|全流程通过|联通失败|全流程失败/.test(flatChat) ||
      /DNS|建连|鉴权/.test(connState.bodyText),
    'chat=' + flatChat.slice(0, 200) + ' || tester=' + connState.bodyText.slice(0, 200),
  );

  // 5. 验证:必填信息完整 + 缺产品说明书 → material-offer-bubble 出现
  await page.waitForTimeout(800);
  const offerBubble = await page.locator('[data-testid="material-offer-bubble"]').count();
  const offerText = offerBubble > 0
    ? await page.locator('[data-testid="material-offer-bubble-content"]').textContent()
    : '';
  record(
    'PDF 预填后材料缺失提示立即出现(product 缺 → 提示「产品说明书」)',
    offerBubble > 0 && /产品说明书/.test(offerText || ''),
    offerText || 'no bubble',
  );

  // 6. 截图留证
  fs.mkdirSync('verify_smart_register_pdf_autotest_artefacts', { recursive: true });
  await page.screenshot({
    path: 'verify_smart_register_pdf_autotest_artefacts/after_pdf_prefill.png',
    fullPage: false,
  });

  // 7. 副测:在 offer 弹出后,模拟「现在生成」点击,验证落地链路
  if (offerBubble > 0) {
    const beforeFileCount = await page.locator('.ant-tag-blue').count();
    await page.locator('[data-testid="side-bubble-generate-product-doc-btn"]').click().catch(() => {});
    await page.waitForTimeout(1500);
    const afterFileCount = await page.locator('.ant-tag-blue').count();
    record(
      '点「立即生成产品说明书」→ 备案材料列表新增 product 类',
      afterFileCount >= beforeFileCount + 1,
      `before=${beforeFileCount}, after=${afterFileCount}`,
    );
  } else {
    record('点「立即生成产品说明书」(跳过:offer 未出现)', false);
  }

  await browser.close();
  const passed = cases.filter((c) => c.pass).length;
  const failed = cases.length - passed;
  console.log(`\nTotal ${cases.length}: ${passed} PASS / ${failed} FAIL`);
  if (failed > 0) process.exit(1);
})();