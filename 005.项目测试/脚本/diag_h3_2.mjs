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
const subs = ['来源分布', '风险分级', '高频调用', '对接业务系统总量', '对接系统数量排行', '对接系统具体情况', '告警情况', '存在的问题', '下一步工作建议'];
for (const s of subs) {
  const idx = (text || '').indexOf(s);
  console.log(`  ${idx >= 0 ? '✓' : '✗'} ${s} @ idx=${idx}`);
}

await browser.close();