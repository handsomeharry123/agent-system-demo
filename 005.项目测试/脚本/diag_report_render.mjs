#!/usr/bin/env node
/**
 * 诊断脚本:检查报告页实际渲染的 DOM,看 h3 子标题是否出现
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${BASE}/app/ledger`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.removeItem('ledger_report_draft_v1::platform_admin');
    localStorage.removeItem('ledger_report_draft_v1::dept_admin');
    localStorage.setItem(
      'demo_settings_v1',
      JSON.stringify({ demoRole: '信息科管理员', visibleModules: {}, visibleSubPages: {} }),
    );
    if (typeof window.__useAuthSetRole === 'function') {
      window.__useAuthSetRole('信息科管理员', 'admin');
    }
  });

  await page.goto(`${BASE}/app/ledger`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const generateBtn = page.locator('button:has-text("生成报告")').first();
  await generateBtn.click();
  await page.waitForTimeout(1500);
  await page.waitForTimeout(800);

  // 搜索特定的子标题
  const checks = [
    '（一）总体规模与关键指标',
    '（八）高频调用智能体排行',
    '（一）告警情况',
    '告警次数（次）',
    '告警次数(次)',
    '图 2-2',
    '图 2-1',
    '医院资源管理中心对接业务系统数量',
    '（一）对接业务系统总量',
  ];
  for (const c of checks) {
    const count = await page.locator(`text=${c}`).count();
    console.log(`  ${count > 0 ? '✓' : '✗'} "${c}" (count=${count})`);
  }

  // 抓取首屏前 80 个文本节点
  const text = await page.locator('body').textContent();
  console.log('\n--- 查找模式 ---');
  console.log('contains (一):', /（一）/.test(text || ''));
  console.log('contains (二):', /（二）/.test(text || ''));
  console.log('contains (三):', /（三）/.test(text || ''));
  console.log('contains 一、: ', /一、/.test(text || ''));
  console.log('contains 二、: ', /二、/.test(text || ''));

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(2); });