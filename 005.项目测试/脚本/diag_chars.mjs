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

// 找 「总体规模」前 10 个字符的 codepoints
const idx = (text || '').indexOf('总体规模');
console.log(`found at idx ${idx}`);
const ctx = (text || '').substring(Math.max(0, idx - 5), idx + 20);
console.log(`Context: ${ctx}`);
console.log('Codepoints:');
for (const ch of ctx) {
  console.log(`  '${ch}' U+${ch.codePointAt(0).toString(16).toUpperCase()}`);
}

// 检查正则匹配
console.log('regex /（一）总体规模与关键指标/.test(text):', /（一）总体规模与关键指标/.test(text || ''));
console.log('regex /总体规模与关键指标/.test(text):', /总体规模与关键指标/.test(text || ''));
console.log('regex /\\uFF08一\\uFF09总体规模与关键指标/.test(text):', /（一）总体规模与关键指标/.test(text || ''));

await browser.close();