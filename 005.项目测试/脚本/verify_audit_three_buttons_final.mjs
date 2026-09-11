import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';

function line() { console.log('─'.repeat(72)); }

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();
page.on('pageerror', e => console.log(`[PAGE-ERR] ${e.message}`));

console.log('\n[1] Login as 信息科管理员 (default admin)');
await page.goto(`${BASE}/app/login?role=admin`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
console.log(`    URL: ${page.url()}`);

console.log('\n[2] Navigate to 审核通过 tab');
await page.goto(`${BASE}/app/agent-center?tab=审核通过`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: '/tmp/audit_v3_admin.png', fullPage: true });

console.log('\n[3] Verify 3 buttons per row for 信息科管理员');
const adminRows = await page.evaluate(() => {
  const trs = Array.from(document.querySelectorAll('.ant-table-tbody > tr.ant-table-row'));
  return trs.map((row, idx) => {
    const cells = row.querySelectorAll('td');
    const lastCell = cells[cells.length - 1];
    const btnTexts = lastCell ? Array.from(lastCell.querySelectorAll('button, a')).map(b => b.innerText.trim()) : [];
    const code = cells[1]?.querySelector('button')?.innerText.trim() || cells[1]?.innerText.trim();
    const name = cells[2]?.querySelector('button')?.innerText.trim() || cells[2]?.innerText.trim();
    return { idx, code, name, btnTexts };
  });
});

line();
console.log('  Row | 智能体编号 | 智能体名称       | 操作列按钮');
line();
adminRows.forEach(r => {
  console.log(`   ${r.idx}  |   ${r.code}   | ${r.name.padEnd(12)} | ${r.btnTexts.join(' | ')}`);
});
line();

const adminAllOk = adminRows.length > 0 && adminRows.every(r =>
  r.btnTexts.includes('查看详情') && r.btnTexts.includes('立即评测') && r.btnTexts.includes('查看台账')
);
console.log(`\n  CHECK 1.1: All ${adminRows.length} rows have 3 buttons [查看详情 + 立即评测 + 查看台账]: ${adminAllOk ? 'PASS' : 'FAIL'}`);

console.log('\n[4] Click 立即评测 on row 0 (肺部 CT 影像分析 - no match in mockAgents)');
const evalBtn0 = page.locator('button:has-text("立即评测")').nth(0);
await evalBtn0.click();
await page.waitForTimeout(3000);

const evalUrl = page.url();
console.log(`    URL: ${evalUrl}`);
const evalUrlOk = evalUrl.includes('/app/evaluation/tasks/create') && evalUrl.includes('agentName=');
console.log(`  CHECK 2.1: 立即评测 navigates to /app/evaluation/tasks/create with agentName param: ${evalUrlOk ? 'PASS' : 'FAIL'}`);

if (evalUrlOk) {
  const params = new URL(evalUrl).searchParams;
  console.log(`           agentName = "${params.get('agentName')}", agentCode = "${params.get('agentCode')}"`);
}

const evalAlerts = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('.ant-alert')).map(a => ({
    type: a.className.match(/ant-alert-(success|info|warning|error)/)?.[1],
    message: a.innerText,
  }));
});
console.log(`  Alerts found on evaluation create page:`);
evalAlerts.forEach((a, i) => console.log(`    [${i}] type=${a.type}: ${a.message.substring(0, 200)}`));
await page.screenshot({ path: '/tmp/audit_v3_eval.png', fullPage: true });

const hasAlert = evalAlerts.length > 0;
console.log(`  CHECK 2.2: Alert with agent info is displayed: ${hasAlert ? 'PASS' : 'FAIL'}`);

console.log('\n[5] Navigate back to 审核通过 tab');
await page.goto(`${BASE}/app/agent-center?tab=审核通过`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

console.log('\n[6] Click 查看台账 on row 0');
const ledgerBtn0 = page.locator('button:has-text("查看台账")').nth(0);
await ledgerBtn0.click();
await page.waitForTimeout(4000);

const ledgerUrl = page.url();
console.log(`    URL: ${ledgerUrl}`);

const ledgerUrlOk = ledgerUrl.includes('/app/ledger/detail/') &&
                    ledgerUrl.includes('search=');
console.log(`  CHECK 3.1: 查看台账 navigates to /app/ledger/detail/... (with search preserved): ${ledgerUrlOk ? 'PASS' : 'FAIL'}`);

const detailPageState = await page.evaluate(() => {
  return {
    hasAgentHeader: !!Array.from(document.querySelectorAll('h1, h2, h3, .ant-typography'))
      .find(e => /胸部 CT|心电图|随访/.test(e.innerText)),
    hasBasicInfo: document.body.innerText.includes('基本信息'),
    hasTechnicalInfo: document.body.innerText.includes('技术信息'),
    bodyStart: document.body.innerText.substring(0, 400),
  };
});
console.log(`  Detail page content check:`);
console.log(`    Has agent name header: ${detailPageState.hasAgentHeader}`);
console.log(`    Has 基本信息 section: ${detailPageState.hasBasicInfo}`);
console.log(`    Has 技术信息 section: ${detailPageState.hasTechnicalInfo}`);
await page.screenshot({ path: '/tmp/audit_v3_ledger_detail.png', fullPage: true });
const detailLoaded = detailPageState.hasBasicInfo && detailPageState.hasTechnicalInfo;
console.log(`  CHECK 3.2: Agent detail page auto-opens: ${detailLoaded ? 'PASS' : 'FAIL'}`);

console.log('\n[7] Switch role to 科室管理员');
await page.evaluate(() => {
  const settings = JSON.parse(localStorage.getItem('demo_settings_v1') || '{}');
  settings.demoRole = '科室管理员';
  localStorage.setItem('demo_settings_v1', JSON.stringify(settings));
});
await page.goto(`${BASE}/app/agent-center?tab=审核通过`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: '/tmp/audit_v3_dept_admin.png', fullPage: true });

const deptRows = await page.evaluate(() => {
  const trs = Array.from(document.querySelectorAll('.ant-table-tbody > tr.ant-table-row'));
  return trs.map((row, idx) => {
    const cells = row.querySelectorAll('td');
    const lastCell = cells[cells.length - 1];
    const btnTexts = lastCell ? Array.from(lastCell.querySelectorAll('button, a')).map(b => b.innerText.trim()) : [];
    const code = cells[1]?.querySelector('button')?.innerText.trim() || cells[1]?.innerText.trim();
    const name = cells[2]?.querySelector('button')?.innerText.trim() || cells[2]?.innerText.trim();
    return { idx, code, name, btnTexts };
  });
});
console.log(`  科室管理员 视图 - 可见行 (按角色过滤后):`);
line();
console.log('  Row | 智能体编号 | 智能体名称       | 操作列按钮');
line();
deptRows.forEach(r => {
  console.log(`   ${r.idx}  |   ${r.code}   | ${r.name.padEnd(12)} | ${r.btnTexts.join(' | ')}`);
});
line();

const deptEvalHidden = deptRows.every(r => !r.btnTexts.includes('立即评测'));
const deptDetailVisible = deptRows.every(r => r.btnTexts.includes('查看详情'));
const deptLedgerVisible = deptRows.every(r => r.btnTexts.includes('查看台账'));
console.log(`\n  CHECK 4.1: 立即评测 HIDDEN for 科室管理员: ${deptEvalHidden ? 'PASS' : 'FAIL'}`);
console.log(`  CHECK 4.2: 查看详情 visible for 科室管理员: ${deptDetailVisible ? 'PASS' : 'FAIL'}`);
console.log(`  CHECK 4.3: 查看台账 visible for 科室管理员: ${deptLedgerVisible ? 'PASS' : 'FAIL'}`);

console.log('\n=== SUMMARY ===');
const allChecks = {
  '3 buttons per row (admin)': adminAllOk,
  '立即评测 nav + agentName': evalUrlOk,
  '立即评测 alert shown': hasAlert,
  '查看台账 → /app/ledger/detail/': ledgerUrlOk,
  'detail page loaded': detailLoaded,
  '立即评测 HIDDEN (科室管理员)': deptEvalHidden,
  '查看详情 visible (科室管理员)': deptDetailVisible,
  '查看台账 visible (科室管理员)': deptLedgerVisible,
};
Object.entries(allChecks).forEach(([k, v]) => {
  console.log(`  ${v ? '✓' : '✗'} ${k}`);
});
const pass = Object.values(allChecks).every(v => v);
console.log(`\n  Overall: ${pass ? 'ALL PASS' : 'FAILED'}`);

await browser.close();
process.exit(pass ? 0 : 1);