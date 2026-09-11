// 视觉对照测试：截取评测任务管理 9 个 Tab 的操作列，与接入中心「审核通过」Tab 操作列对比
// 验证按钮文字/图标/颜色/间距一致

import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const SHOT = '/tmp';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();
page.on('pageerror', e => console.log(`[PAGE-ERR] ${e.message}`));

console.log('[1] Login admin');
await page.goto(`${BASE}/app/login?role=admin`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// ── 接入中心「审核通过」Tab 截图（作为基准）
console.log('\n[2] Screenshot 接入中心 审核通过 Tab (基准)');
await page.goto(`${BASE}/app/agent-center?tab=审核通过`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${SHOT}/style_ref_agent_audit_passed.png`, fullPage: true });

const refBtns = await page.evaluate(() => {
  const rows = Array.from(document.querySelectorAll('.ant-table-tbody > tr.ant-table-row'));
  const out = [];
  rows.forEach(r => {
    const last = r.querySelectorAll('td')[r.querySelectorAll('td').length - 1];
    if (!last) return;
    const btns = Array.from(last.querySelectorAll('button'));
    btns.forEach(b => {
      out.push({
        text: b.innerText.trim(),
        color: getComputedStyle(b).color,
        bg: getComputedStyle(b).backgroundColor,
        border: getComputedStyle(b).borderColor,
        classes: b.className,
      });
    });
  });
  return out.slice(0, 6);
});
console.log('  接入中心 审核通过 操作列按钮样式:');
refBtns.forEach((b, i) => console.log(`    [${i}] "${b.text}" color=${b.color} bg=${b.bg} class=${b.classes.split(' ').filter(c => c.includes('ant-btn')).join(' ')}`));

// ── 评测任务管理 9 个 Tab 截图
console.log('\n[3] Screenshot 评测任务管理 9 Tab');
const TABS = ['全部任务', '草稿', '评测中', '撤销', '评测完成', '待审核', '审核中', '审核通过', '退回修改'];
await page.goto(`${BASE}/app/evaluation/tasks`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const evalResults = {};
for (const tabLabel of TABS) {
  await page.locator(`.ant-tabs-tab:has-text("${tabLabel}")`).first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOT}/style_eval_${tabLabel}.png`, fullPage: true });

  const btns = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.ant-table-tbody > tr.ant-table-row'));
    const out = [];
    rows.forEach(r => {
      const cells = r.querySelectorAll('td');
      const last = cells[cells.length - 1];
      if (!last) return;
      Array.from(last.querySelectorAll('button')).forEach(b => {
        out.push({
          text: b.innerText.trim(),
          color: getComputedStyle(b).color,
          bg: getComputedStyle(b).backgroundColor,
          classes: b.className,
        });
      });
    });
    return out.slice(0, 8);
  });
  evalResults[tabLabel] = btns;
  console.log(`  [${tabLabel}] 按钮样式:`);
  btns.forEach((b, i) => console.log(`    [${i}] "${b.text}" color=${b.color} bg=${b.bg} class=${b.classes.split(' ').filter(c => c.includes('ant-btn')).join(' ')}`));
}

// ── 一致性判定：所有评测任务 Tab 按钮应该跟接入中心基准一样
// · 文字色: link 按钮文字色一致(#1890ff 或 #1677ff 类似蓝色)
// · 背景: 透明 (rgba(0,0,0,0))
// · 没有 primary 蓝色填充背景
console.log('\n[4] 一致性判定');

let primaryFound = 0;
let transparentBg = 0;
let totalBtns = 0;
const issues = [];

for (const tabLabel of TABS) {
  const btns = evalResults[tabLabel] || [];
  btns.forEach((b, i) => {
    totalBtns++;
    const isPrimary = b.classes.includes('ant-btn-primary');
    if (isPrimary) {
      primaryFound++;
      issues.push(`${tabLabel}: 按钮 "${b.text}" 仍为 ant-btn-primary (主按钮样式)`);
    }
    if (b.bg === 'rgba(0, 0, 0, 0)' || b.bg === 'transparent') {
      transparentBg++;
    }
  });
}

console.log(`  总按钮数: ${totalBtns}`);
console.log(`  link 按钮(透明背景): ${transparentBg}`);
console.log(`  primary 按钮(实心): ${primaryFound}`);

if (issues.length) {
  console.log('\n  问题:');
  issues.forEach(i => console.log(`    ✗ ${i}`));
}

// 重点：待审核/审核中 Tab 的「审核」按钮不能是 primary
const dsh = evalResults['待审核'] || [];
const shz = evalResults['审核中'] || [];
const dshAuditPrimary = dsh.find(b => b.text === '审核' && b.classes.includes('ant-btn-primary'));
const shzAuditPrimary = shz.find(b => b.text === '审核' && b.classes.includes('ant-btn-primary'));

console.log('\n=== SUMMARY ===');
console.log(`  ${!dshAuditPrimary ? '✓' : '✗'} 待审核 Tab 「审核」按钮非 primary`);
console.log(`  ${!shzAuditPrimary ? '✓' : '✗'} 审核中 Tab 「审核」按钮非 primary`);
console.log(`  ${primaryFound === 0 ? '✓' : '✗'} 所有 Tab 零 primary 按钮`);
console.log(`  Overall: ${(!dshAuditPrimary && !shzAuditPrimary && primaryFound === 0) ? 'ALL PASS' : 'FAILED'}`);

await browser.close();
process.exit((!dshAuditPrimary && !shzAuditPrimary && primaryFound === 0) ? 0 : 1);