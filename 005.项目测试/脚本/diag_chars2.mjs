#!/usr/bin/env node
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:3001/app/ledger', { waitUntil: 'networkidle' });
await page.evaluate(() => {
  localStorage.removeItem('ledger_report_draft_v1::platform_admin');
  localStorage.setItem('demo_settings_v1', JSON.stringify({ demoRole: '信息科管理员' }));
  if (window.__useAuthSetRole) window.__useAuthSetRole('信息科管理员', 'admin');
});
await page.goto('http://127.0.0.1:3001/app/ledger', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.locator('button:has-text("生成报告")').first().click();
await page.waitForTimeout(2000);

const text = await page.locator('body').textContent();
const idx = (text || '').indexOf('来源分布');
console.log('Context around 来源分布:');
console.log(JSON.stringify((text || '').substring(idx - 8, idx + 10)));
console.log('Codepoints:');
const ctx = (text || '').substring(idx - 8, idx + 10);
for (const ch of ctx) {
  console.log(`  '${ch}' U+${ch.codePointAt(0).toString(16).toUpperCase()}`);
}

// 测试正则
console.log('--- regex ---');
console.log('/(六)来源分布情况/.test:', /(六)来源分布情况/.test(text || ''));
console.log('/(六)来源分布/.test:', /(六)来源分布/.test(text || ''));
console.log('/来源分布情况/.test:', /来源分布情况/.test(text || ''));

await browser.close();