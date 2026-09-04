#!/usr/bin/env node
import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:3001';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`${BASE}/app/ledger`, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  localStorage.removeItem('ledger_report_draft_v1::platform_admin');
  localStorage.setItem('demo_settings_v1', JSON.stringify({ demoRole: '信息科管理员' }));
  if (window.__useAuthSetRole) window.__useAuthSetRole('信息科管理员', 'admin');
});
await page.goto(`${BASE}/app/ledger`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.locator('button:has-text("生成报告")').first().click();
await page.waitForTimeout(2000);

// 找包含「总体规模」的元素
const found = await page.locator('text=/总体规模/').count();
console.log(`Found "总体规模": ${found}`);

const allH3 = await page.locator('[data-testid="report-h3"], .ant-typography h3, h3').count();
console.log(`All h3 elements: ${allH3}`);

// 抓所有含 "（" 的元素文本
const withParen = await page.locator('text=/（[一二三四五]）/').count();
console.log(`Elements with （一）（二）etc: ${withParen}`);

// 抓取含 「告警情况」的元素
const alarmText = await page.locator('text=/告警情况/').count();
console.log(`Found 告警情况: ${alarmText}`);

const kpi68 = await page.locator('text=/68/').count();
console.log(`Found "68" anywhere: ${kpi68}`);

const alarmCount = await page.locator('text=/告警次数（次）|告警次数\\(次\\)/').count();
console.log(`Found 告警次数(次): ${alarmCount}`);

// 直接看 body 全部文本
const allText = await page.locator('body').textContent();
console.log('---');
console.log('contains 总体规模与关键指标:', /总体规模与关键指标/.test(allText));
console.log('contains 告警情况:', /告警情况/.test(allText));
console.log('contains 68:', /68/.test(allText));
console.log('contains 68 次:', /68\s*次/.test(allText));
console.log('contains 告警次数:', /告警次数/.test(allText));
console.log('contains 第三章问题:', /(一)\s*存/.test(allText));
console.log('contains 下一步工作建议:', /下一步工作建议/.test(allText));

await browser.close();