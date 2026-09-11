#!/usr/bin/env node
/**
 * 「全部采纳」采纳后字段是否真正写回表单 —— 排查脚本
 * 1. 进入 smart-register
 * 2. 唤起 Agent 上传 PDF
 * 3. 等识别气泡完成（3 个字段: accessMode/apiEndpoint/apiKey）
 * 4. 截 1：识别刚完成时的表单右侧（看是否已有内容）
 * 5. 点「全部采纳」
 * 6. 截 2：采纳后表单右侧（核心：观察字段是否填入 + 高亮是否消失）
 * 7. 抓 form 字段值 + store 状态（通过 debug 钩子/dom 推断）
 */
import { chromium } from 'playwright';
import { setTimeout as wait } from 'node:timers/promises';

const BASE = 'http://localhost:3001';
const OUT = '/Users/harry/Desktop/CC_TEST/agent-system/.verify-downloads';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();

  const logs = [];
  page.on('pageerror', (e) => logs.push(`PAGEERROR: ${e.message}`));
  page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));

  await page.goto(`${BASE}/app/agent-center/smart-register`, { waitUntil: 'networkidle' });
  await wait(1200);

  // 唤起 Agent
  await page.getByRole('button', { name: '唤起智能填写助手' }).click();
  await wait(600);

  // 上传 PDF —— 选 Agent 浮层里的 Upload（accept=.pdf,.png,.jpg,.jpeg），而非表单里的 Upload.Dragger
  const fileInputs = page.locator('input[type="file"]');
  const cnt = await fileInputs.count();
  console.log('文件 input 数量:', cnt);
  // 最后一个通常是 Agent 浮层里的（Dragger 的 input 在最前）
  const fileInput = fileInputs.last();
  // 用用户截图里的文件名（无任何关键词 — 验证 mock 现在统一返回 9 字段）
  await fileInput.setInputFiles({
    name: '临床用药决策支持系统_评测报告_EVL-20260615-0001.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%fake'),
  });
  await wait(2200);
  // 等识别气泡完成（detect 1.5s + 100ms 缓冲）
  await page.screenshot({ path: `${OUT}/smart_ackall_after_detect.png`, fullPage: true });

  // 此时表单里应已回填 (SmartRegistrationForm useEffect)
  // 抓表单字段值 - 用 React 内部属性
  const dump1 = await page.evaluate(() => {
    const out = {};
    // 拿所有 antd Form 的 input (有 .ant-input class)
    const inputs = Array.from(document.querySelectorAll('.ant-form .ant-input, .ant-form .ant-input-affix-wrapper > input'));
    inputs.forEach((el) => {
      // 上溯找 form-item 拿 label
      let p = el.closest('.ant-form-item');
      let label = '';
      if (p) {
        const lbl = p.querySelector('.ant-form-item-label label');
        label = lbl?.textContent?.trim() || '';
      }
      out[label || el.id || el.name] = el.value;
    });
    // TextArea
    const tas = Array.from(document.querySelectorAll('.ant-form textarea.ant-input'));
    tas.forEach((el) => {
      let p = el.closest('.ant-form-item');
      let label = '';
      if (p) {
        const lbl = p.querySelector('.ant-form-item-label label');
        label = lbl?.textContent?.trim() || '';
      }
      out['TA:' + (label || el.id || el.name)] = el.value;
    });
    return out;
  });
  console.log('识别后表单字段:', JSON.stringify(dump1, null, 2));

  // 检查 store 中 pendingPrefills 与 prefillMeta
  // store 在 React Context 里, 只能通过 dom 副作用推断 (highlighted class)
  const highlightedCount = await page.locator('.ai-prefill-highlight').count();
  console.log('识别后高亮 Input 数:', highlightedCount);

  // 点「全部采纳」
  const ackBtn = page.getByRole('button', { name: /全部采纳/ });
  console.log('全部采纳按钮可见:', await ackBtn.isVisible());
  await ackBtn.click();
  await wait(800);
  await page.screenshot({ path: `${OUT}/smart_ackall_after_ack.png`, fullPage: true });

  // 检查 toast (message.success) 是否弹出
  const toastVisible = await page.locator('.ant-message-notice').first().isVisible().catch(() => false);
  console.log('toast 可见:', toastVisible);
  if (toastVisible) {
    const toastText = await page.locator('.ant-message-notice').first().innerText().catch(() => '');
    console.log('toast 内容:', toastText);
  }

  // 检查 "✓ 已采纳" Badge (绿色) 数
  const ackBadgeCount = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('span'))
      .filter(s => s.textContent?.includes('已采纳')).length;
  });
  console.log('"已采纳" Badge 数:', ackBadgeCount);

  // 检查顶部 Alert "已采纳全部"
  const successAlert = await page.locator('.ant-alert-success').first().innerText().catch(() => '');
  console.log('顶部 success Alert:', successAlert.replace(/\n/g, ' | '));

  // 截最终验收图：采纳后表单 + 顶部 Alert + toast
  await wait(400);
  await page.screenshot({ path: `${OUT}/smart_ackall_final.png`, fullPage: true });

  // 截 5.5s 后的状态（确认绿色对勾 + ack-flash 已自动消失，但字段值仍保留）
  await wait(5500);
  await page.screenshot({ path: `${OUT}/smart_ackall_after_5s.png`, fullPage: true });
  const ackBadgeAfter = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('span'))
      .filter(s => s.textContent?.trim() === '已采纳').length;
  });
  console.log('5.5s 后"已采纳" Badge 数 (期望 0):', ackBadgeAfter);
  const dump3 = await page.evaluate(() => {
    const out = {};
    const inputs = Array.from(document.querySelectorAll('.ant-form .ant-input, .ant-form .ant-input-affix-wrapper > input'));
    inputs.forEach((el) => {
      let p = el.closest('.ant-form-item');
      let label = '';
      if (p) {
        const lbl = p.querySelector('.ant-form-item-label label');
        label = lbl?.textContent?.trim() || '';
      }
      out[label || el.id || el.name] = el.value;
    });
    return out;
  });
  console.log('5.5s 后表单字段仍保留值:', JSON.stringify(dump3, null, 2));

  // 抓表单字段值 - 用 React 内部属性
  const dump2 = await page.evaluate(() => {
    const out = {};
    const inputs = Array.from(document.querySelectorAll('.ant-form .ant-input, .ant-form .ant-input-affix-wrapper > input'));
    inputs.forEach((el) => {
      let p = el.closest('.ant-form-item');
      let label = '';
      if (p) {
        const lbl = p.querySelector('.ant-form-item-label label');
        label = lbl?.textContent?.trim() || '';
      }
      out[label || el.id || el.name] = el.value;
    });
    const tas = Array.from(document.querySelectorAll('.ant-form textarea.ant-input'));
    tas.forEach((el) => {
      let p = el.closest('.ant-form-item');
      let label = '';
      if (p) {
        const lbl = p.querySelector('.ant-form-item-label label');
        label = lbl?.textContent?.trim() || '';
      }
      out['TA:' + (label || el.id || el.name)] = el.value;
    });
    return out;
  });
  console.log('采纳后表单字段:', JSON.stringify(dump2, null, 2));

  const highlightedCount2 = await page.locator('.ai-prefill-highlight').count();
  console.log('采纳后高亮 Input 数:', highlightedCount2);

  // 检查 store 中 pendingPrefills 是否还在
  // 这里我们直接看 store 状态：watch 中 React fiber 上 context
  console.log('—— 关键错误/日志 ——');
  logs.slice(0, 30).forEach((l) => console.log(l));

  await browser.close();
})();