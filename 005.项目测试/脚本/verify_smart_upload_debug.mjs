#!/usr/bin/env node
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

  await page.getByRole('button', { name: '唤起智能填写助手' }).click();
  await wait(600);

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles({
    name: '产品说明书.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%fake'),
  });
  await wait(2500);

  // 截屏看对话浮层里的内容
  await page.screenshot({ path: `${OUT}/smart_debug_chat.png`, fullPage: false, clip: { x: 1180, y: 380, width: 400, height: 600 } });

  // 列所有按钮
  const buttons = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim() || '').filter(Boolean));
  console.log('页面所有按钮:', JSON.stringify(buttons, null, 2));

  // 检查 chat 浮层是否包含「采纳」字样
  const html = await page.evaluate(() => document.body.innerHTML);
  const ackAllIdx = html.indexOf('全部采纳');
  console.log('「全部采纳」在 DOM 出现位置:', ackAllIdx);
  const ackIdx = html.indexOf('采纳');
  console.log('「采纳」在 DOM 出现位置:', ackIdx);

  // 检查 pageerror
  console.log('—— log ——');
  logs.slice(0, 50).forEach((l) => console.log(l));

  await browser.close();
})();