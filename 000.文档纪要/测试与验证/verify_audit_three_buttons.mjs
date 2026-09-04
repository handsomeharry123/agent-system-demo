import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const result = {
  steps: [],
  errors: [],
  checks: {},
};

function log(msg) {
  console.log(`[STEP] ${msg}`);
  result.steps.push(msg);
}

try {
  log('Launching chromium...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`[CONSOLE-ERR] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    result.errors.push(`pageerror: ${err.message}`);
    console.log(`[PAGE-ERR] ${err.message}`);
  });

  // ============================================================
  // STEP 1: Login as admin (信息科管理员) - default role
  // ============================================================
  log('Step 1: Login as 信息科管理员 (default admin)');
  await page.goto(`${BASE}/app/login?role=admin`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  console.log(`[URL] ${page.url()}`);

  // ============================================================
  // STEP 2: Navigate to 审核通过 tab
  // ============================================================
  log('Step 2: Navigate to 审核通过 tab');
  await page.goto(`${BASE}/app/agent-center?tab=审核通过`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/audit_three_btn_admin.png', fullPage: true });

  // ============================================================
  // STEP 3: Verify all 3 buttons appear for 信息科管理员
  // ============================================================
  log('Step 3: Verify all 3 buttons appear for 信息科管理员');

  // Count rows in 审核通过 tab
  const rowCount = await page.locator('.ant-table-tbody > tr.ant-table-row').count();
  console.log(`[ROWS] 审核通过 tab row count: ${rowCount}`);
  result.checks.admin_row_count = rowCount;

  // Get all action buttons in each row
  const actionBtnsByRow = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.ant-table-tbody > tr.ant-table-row'));
    return rows.map((row, idx) => {
      const cells = row.querySelectorAll('td');
      const lastCell = cells[cells.length - 1];
      const btnTexts = lastCell ? Array.from(lastCell.querySelectorAll('button, a')).map(b => b.innerText.trim()) : [];
      return { rowIdx: idx, btnTexts };
    });
  });
  console.log(`[ADMIN-BUTTONS] Per-row action buttons:`);
  actionBtnsByRow.forEach(r => {
    console.log(`  Row ${r.rowIdx}: ${r.btnTexts.join(' | ')}`);
  });

  // Verify all rows have 3 buttons
  const adminAllRowsHave3 = actionBtnsByRow.every(r =>
    r.btnTexts.includes('查看详情') && r.btnTexts.includes('立即评测') && r.btnTexts.includes('查看台账')
  );
  result.checks.admin_all_rows_have_3_buttons = adminAllRowsHave3;
  console.log(`[CHECK] All rows have 查看详情 + 立即评测 + 查看台账: ${adminAllRowsHave3 ? 'PASS' : 'FAIL'}`);

  // Capture the first row's agent name for later verification
  const firstRowAgentName = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.ant-table-tbody > tr.ant-table-row'));
    if (!rows.length) return null;
    // 智能体名称 column - find button with the name
    const cells = rows[0].querySelectorAll('td');
    // 智能体名称 is column index 2 (序号=0, 智能体编号=1, 智能体名称=2)
    const nameCell = cells[2];
    if (!nameCell) return null;
    const btn = nameCell.querySelector('button');
    return btn ? btn.innerText.trim() : null;
  });
  console.log(`[FIRST-ROW] Agent name: ${firstRowAgentName}`);
  result.checks.first_row_agent_name = firstRowAgentName;

  // ============================================================
  // STEP 4: Click 立即评测 and verify navigation + Alert
  // ============================================================
  log('Step 4: Click 立即评测 on first row');
  const evalBtn = page.locator('button:has-text("立即评测")').first();
  await evalBtn.click();
  await page.waitForTimeout(2500);
  const evalUrl = page.url();
  console.log(`[URL-AFTER-EVAL] ${evalUrl}`);

  await page.screenshot({ path: '/tmp/audit_three_btn_eval_page.png', fullPage: true });

  // Check URL has agentName param
  const evalUrlOk = evalUrl.includes('/app/evaluation/tasks/create') &&
                    evalUrl.includes('agentName=');
  result.checks.eval_url_ok = evalUrlOk;
  console.log(`[CHECK] 立即评测 navigation: ${evalUrlOk ? 'PASS' : 'FAIL'}`);
  if (evalUrlOk) {
    const params = new URL(evalUrl).searchParams;
    console.log(`  agentName param: ${params.get('agentName')}`);
    console.log(`  agentCode param: ${params.get('agentCode')}`);
  }

  // Check for green Alert "已自动带入智能体：XXX"
  await page.waitForTimeout(1500);
  const alertText = await page.evaluate(() => {
    const alerts = Array.from(document.querySelectorAll('.ant-alert'));
    return alerts.map(a => ({
      type: a.className,
      message: a.innerText,
    }));
  });
  console.log(`[ALERTS] Found ${alertText.length} alerts:`);
  alertText.forEach((a, i) => console.log(`  Alert ${i}: ${a.message.substring(0, 200)}`));
  result.checks.eval_alerts = alertText;

  const hasAutoFillAlert = alertText.some(a => a.message.includes('已自动带入智能体'));
  result.checks.eval_auto_fill_alert = hasAutoFillAlert;
  console.log(`[CHECK] 立即评测 Alert "已自动带入智能体": ${hasAutoFillAlert ? 'PASS' : 'FAIL'}`);

  // ============================================================
  // STEP 5: Navigate back to agent-center
  // ============================================================
  log('Step 5: Navigate back to 审核通过 tab');
  await page.goto(`${BASE}/app/agent-center?tab=审核通过`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // ============================================================
  // STEP 6: Click 查看台账 and verify navigation + auto-open detail
  // ============================================================
  log('Step 6: Click 查看台账 on first row');
  const ledgerBtn = page.locator('button:has-text("查看台账")').first();
  await ledgerBtn.click();
  await page.waitForTimeout(2500);
  const ledgerUrl = page.url();
  console.log(`[URL-AFTER-LEDGER] ${ledgerUrl}`);

  await page.screenshot({ path: '/tmp/audit_three_btn_ledger_page.png', fullPage: true });

  // Check URL has search + openDetail params
  const ledgerUrlOk = ledgerUrl.includes('/app/ledger/list') &&
                      ledgerUrl.includes('search=') &&
                      ledgerUrl.includes('openDetail=1');
  result.checks.ledger_url_ok = ledgerUrlOk;
  console.log(`[CHECK] 查看台账 navigation: ${ledgerUrlOk ? 'PASS' : 'FAIL'}`);
  if (ledgerUrlOk) {
    const params = new URL(ledgerUrl).searchParams;
    console.log(`  search param: ${params.get('search')}`);
    console.log(`  openDetail param: ${params.get('openDetail')}`);
  }

  // Check if detail page (drawer/modal) auto-opens
  await page.waitForTimeout(2000);
  const detailOpen = await page.evaluate(() => {
    // Drawer or Modal containing detail content
    const drawers = Array.from(document.querySelectorAll('.ant-drawer-open, .ant-drawer:not(.ant-drawer-hidden)'));
    const modals = Array.from(document.querySelectorAll('.ant-modal:not([style*="display: none"])'));
    // Look for visible drawer/modal with content indicating a detail view
    const visibleDrawer = drawers.find(d => {
      const style = window.getComputedStyle(d);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    const visibleModal = modals.find(m => {
      const style = window.getComputedStyle(m);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    // Check text content for detail-like content (agent code, name, etc.)
    const allText = (visibleDrawer?.innerText || visibleModal?.innerText || '');
    return {
      drawerOpen: !!visibleDrawer,
      modalOpen: !!visibleModal,
      drawerText: visibleDrawer?.innerText?.substring(0, 300) || '',
      modalText: visibleModal?.innerText?.substring(0, 300) || '',
      text: allText.substring(0, 300),
    };
  });
  console.log(`[DETAIL-OPEN] drawer=${detailOpen.drawerOpen} modal=${detailOpen.modalOpen}`);
  console.log(`  Drawer text: ${detailOpen.drawerText.substring(0, 200)}`);
  console.log(`  Modal text: ${detailOpen.modalText.substring(0, 200)}`);
  result.checks.ledger_detail_auto_open = detailOpen;

  await page.screenshot({ path: '/tmp/audit_three_btn_ledger_detail.png', fullPage: true });

  // ============================================================
  // STEP 7: Switch role to 科室管理员 and re-verify
  // ============================================================
  log('Step 7: Switch role to 科室管理员');

  // Navigate back to agent-center
  await page.goto(`${BASE}/app/agent-center?tab=审核通过`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Programmatically switch role via localStorage and reload
  await page.evaluate(() => {
    const settings = JSON.parse(localStorage.getItem('demo_settings_v1') || '{}');
    settings.demoRole = '科室管理员';
    localStorage.setItem('demo_settings_v1', JSON.stringify(settings));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Verify role switched via header
  const headerText = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log(`[HEADER-TEXT] ${headerText.replace(/\n+/g, ' | ').substring(0, 200)}`);

  // Navigate to 审核通过 tab
  await page.goto(`${BASE}/app/agent-center?tab=审核通过`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/audit_three_btn_dept_admin.png', fullPage: true });

  // Get action buttons in each row for 科室管理员
  const deptAdminButtons = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.ant-table-tbody > tr.ant-table-row'));
    return rows.map((row, idx) => {
      const cells = row.querySelectorAll('td');
      const lastCell = cells[cells.length - 1];
      const btnTexts = lastCell ? Array.from(lastCell.querySelectorAll('button, a')).map(b => b.innerText.trim()) : [];
      return { rowIdx: idx, btnTexts };
    });
  });
  console.log(`[DEPT-ADMIN-BUTTONS] Per-row action buttons (科室管理员):`);
  deptAdminButtons.forEach(r => {
    console.log(`  Row ${r.rowIdx}: ${r.btnTexts.join(' | ')}`);
  });

  const deptAdminEvalHidden = deptAdminButtons.every(r => !r.btnTexts.includes('立即评测'));
  const deptAdminDetailVisible = deptAdminButtons.every(r => r.btnTexts.includes('查看详情'));
  const deptAdminLedgerVisible = deptAdminButtons.every(r => r.btnTexts.includes('查看台账'));
  result.checks.dept_admin_eval_hidden = deptAdminEvalHidden;
  result.checks.dept_admin_detail_visible = deptAdminDetailVisible;
  result.checks.dept_admin_ledger_visible = deptAdminLedgerVisible;
  console.log(`[CHECK] 立即评测 HIDDEN for 科室管理员: ${deptAdminEvalHidden ? 'PASS' : 'FAIL'}`);
  console.log(`[CHECK] 查看详情 visible for 科室管理员: ${deptAdminDetailVisible ? 'PASS' : 'FAIL'}`);
  console.log(`[CHECK] 查看台账 visible for 科室管理员: ${deptAdminLedgerVisible ? 'PASS' : 'FAIL'}`);

  await browser.close();
} catch (err) {
  console.log(`[FATAL] ${err.message}`);
  result.errors.push(err.message);
  console.log(err.stack);
}

console.log('\n=== FINAL RESULT ===');
console.log(JSON.stringify(result, null, 2));
console.log('\n=== SCREENSHOTS ===');
console.log('  /tmp/audit_three_btn_admin.png');
console.log('  /tmp/audit_three_btn_eval_page.png');
console.log('  /tmp/audit_three_btn_ledger_page.png');
console.log('  /tmp/audit_three_btn_ledger_detail.png');
console.log('  /tmp/audit_three_btn_dept_admin.png');
process.exit(0);