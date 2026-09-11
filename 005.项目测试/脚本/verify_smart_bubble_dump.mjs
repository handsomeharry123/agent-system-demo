#!/usr/bin/env node
import { chromium } from 'playwright';
import { setTimeout as wait } from 'node:timers/promises';

const BASE = 'http://localhost:3001';
const OUT = '/Users/harry/Desktop/CC_TEST/agent-system/.verify-downloads';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();

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

  // 把对话浮层整段 innerText 打印
  const chatText = await page.evaluate(() => {
    // 找包含「智能填写助手」标题的容器
    const titles = Array.from(document.querySelectorAll('div')).filter(d => d.textContent?.includes('智能填写助手') && d.children.length < 10);
    // 取最大的那个浮层
    let panel = null;
    let max = 0;
    for (const t of titles) {
      const r = t.getBoundingClientRect();
      if (r.width * r.height > max) { max = r.width * r.height; panel = t; }
    }
    if (!panel) return '(no panel)';
    // 取 panel 上几级（dialog 容器）
    let p = panel;
    while (p.parentElement && p.parentElement.getBoundingClientRect().width >= 400) {
      p = p.parentElement;
    }
    return p.innerText;
  });
  console.log('—— 浮层文本 ——');
  console.log(chatText);
  console.log('—— end ——');

  // 同时检查消息区是否有「文件识别」Tag
  const tags = await page.evaluate(() => Array.from(document.querySelectorAll('.ant-tag')).map(t => t.textContent));
  console.log('页面 Tags:', JSON.stringify(tags));

  // 检查 ant-spin 是否还在转
  const spinning = await page.locator('.ant-spin-spinning').count();
  console.log('Spin 计数:', spinning);

  await page.screenshot({ path: `${OUT}/smart_debug_full.png`, fullPage: false });
  await browser.close();
})();