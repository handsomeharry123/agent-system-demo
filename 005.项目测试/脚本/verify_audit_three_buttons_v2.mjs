import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const result = { steps: [], errors: [], checks: {} };

function log(msg) {
  console.log(`[STEP] ${msg}`);
  result.steps.push(msg);
}

try {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  page.on('pageerror', (err) => {
    result.errors.push(`pageerror: ${err.message}`);
  });

  // Login as admin
  await page.goto(`${BASE}/app/login?role=admin`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Navigate to 审核通过 tab
  await page.goto(`${BASE}/app/agent-center?tab=审核通过`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Collect row data: agent name + agent code for each row
  const rows = await page.evaluate(() => {
    const trs = Array.from(document.querySelectorAll('.ant-table-tbody > tr.ant-table-row'));
    return trs.map((row, idx) => {
      const cells = row.querySelectorAll('td');
      // 智能体编号 column 1, 智能体名称 column 2
      const codeCell = cells[1];
      const nameCell = cells[2];
      const code = codeCell?.querySelector('button')?.innerText.trim() || codeCell?.innerText.trim();
      const name = nameCell?.querySelector('button')?.innerText.trim() || nameCell?.innerText.trim();
      return { idx, code, name };
    });
  });
  console.log(`[ROWS]`);
  rows.forEach(r => console.log(`  Row ${r.idx}: code=${r.code} name=${r.name}`));

  // ============================================================
  // Test 1: Click 立即评测 on first row (肺部 CT 影像分析 - no match)
  // ============================================================
  log('Test 1: Click 立即评测 on row 0 (肺部 CT 影像分析)');
  const evalBtns = page.locator('button:has-text("立即评测")');
  console.log(`[EVAL-BTNS-COUNT] ${await evalBtns.count()}`);

  await evalBtns.nth(0).click();
  await page.waitForTimeout(2500);

  const evalUrl0 = page.url();
  console.log(`[URL-AFTER-EVAL-0] ${evalUrl0}`);
  await page.screenshot({ path: '/tmp/audit_eval_row0.png', fullPage: true });

  // Inspect alerts and form
  const inspectRow0 = await page.evaluate(() => {
    const alerts = Array.from(document.querySelectorAll('.ant-alert')).map(a => ({
      type: a.querySelector('.ant-alert-icon')?.className || '',
      classes: a.className,
      message: a.innerText.substring(0, 300),
    }));
    const selectValue = document.querySelector('.ant-select-selection-item')?.innerText || '';
    return { alerts, selectValue };
  });
  console.log(`[INSPECT-ROW0]`);
  console.log(`  Alerts:`, JSON.stringify(inspectRow0.alerts, null, 2));
  console.log(`  Select value: ${inspectRow0.selectValue}`);
  result.checks.eval_row0 = inspectRow0;

  // Go back to list
  await page.goto(`${BASE}/app/agent-center?tab=审核通过`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // ============================================================
  // Test 2: Click 立即评测 on row 2 (心电图智能辅助诊断 - matches)
  // ============================================================
  log('Test 2: Click 立即评测 on row 2 (心电图智能辅助诊断 - matches)');

  const evalBtns2 = page.locator('button:has-text("立即评测")');
  await evalBtns2.nth(2).click();
  await page.waitForTimeout(2500);

  const evalUrl2 = page.url();
  console.log(`[URL-AFTER-EVAL-2] ${evalUrl2}`);
  await page.screenshot({ path: '/tmp/audit_eval_row2.png', fullPage: true });

  const inspectRow2 = await page.evaluate(() => {
    const alerts = Array.from(document.querySelectorAll('.ant-alert')).map(a => ({
      type: a.querySelector('.ant-alert-icon')?.className || '',
      classes: a.className,
      message: a.innerText.substring(0, 300),
    }));
    const selectValue = document.querySelector('.ant-select-selection-item')?.innerText || '';
    return { alerts, selectValue };
  });
  console.log(`[INSPECT-ROW2]`);
  console.log(`  Alerts:`, JSON.stringify(inspectRow2.alerts, null, 2));
  console.log(`  Select value: ${inspectRow2.selectValue}`);
  result.checks.eval_row2 = inspectRow2;

  const matchedGreenAlert = inspectRow2.alerts.some(a =>
    a.classes.includes('ant-alert-success') && a.message.includes('已自动带入智能体')
  );
  console.log(`[CHECK] Matched green Alert '已自动带入智能体：XXX': ${matchedGreenAlert ? 'PASS' : 'FAIL'}`);
  result.checks.matched_green_alert = matchedGreenAlert;

  // ============================================================
  // Test 3: Verify 查看台账 auto-opens detail drawer
  // ============================================================
  log('Test 3: Verify 查看台账 auto-opens detail');
  await page.goto(`${BASE}/app/agent-center?tab=审核通过`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Find first row's agent name
  const firstRowName = rows[0].name;
  console.log(`[FIRST-ROW-NAME] ${firstRowName}`);

  const ledgerBtns = page.locator('button:has-text("查看台账")');
  await ledgerBtns.nth(0).click();
  await page.waitForTimeout(3000);
  const ledgerUrl = page.url();
  console.log(`[LEDGER-URL] ${ledgerUrl}`);
  await page.screenshot({ path: '/tmp/audit_ledger_detail_open.png', fullPage: true });

  // Check for any open drawer/modal
  const detailCheck = await page.evaluate(() => {
    // All drawers
    const drawers = Array.from(document.querySelectorAll('.ant-drawer'));
    const drawerInfo = drawers.map(d => {
      const style = window.getComputedStyle(d);
      const wrap = d.closest('.ant-drawer-wrapper-body, .ant-drawer-content-wrapper');
      const wrapStyle = wrap ? window.getComputedStyle(wrap) : null;
      return {
        visible: style.display !== 'none' && style.visibility !== 'hidden',
        content: d.innerText.substring(0, 250),
      };
    });

    // All modals
    const modals = Array.from(document.querySelectorAll('.ant-modal-wrap, .ant-modal'));
    const modalInfo = modals.map(m => {
      const style = window.getComputedStyle(m);
      return {
        visible: style.display !== 'none' && style.visibility !== 'hidden',
        content: m.innerText.substring(0, 250),
      };
    });

    // Check for inline expanded detail in table (e.g. expand row showing agent details)
    const expandedRows = document.querySelectorAll('.ant-table-expanded-row, tr.ant-table-expanded-row');

    return {
      drawers: drawerInfo,
      modals: modalInfo,
      expandedRows: expandedRows.length,
    };
  });
  console.log(`[DETAIL-CHECK]`);
  console.log(`  Drawers:`, JSON.stringify(detailCheck.drawers, null, 2));
  console.log(`  Modals:`, JSON.stringify(detailCheck.modals, null, 2));
  console.log(`  Expanded rows: ${detailCheck.expandedRows}`);
  result.checks.ledger_detail_check = detailCheck;

  // Wait longer for drawer animation
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/audit_ledger_detail_after_wait.png', fullPage: true });

  const detailCheck2 = await page.evaluate(() => {
    const drawers = Array.from(document.querySelectorAll('.ant-drawer'));
    const openDrawers = drawers.filter(d => {
      const style = window.getComputedStyle(d);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    const modals = Array.from(document.querySelectorAll('.ant-modal-wrap'));
    const openModals = modals.filter(m => {
      const style = window.getComputedStyle(m);
      return style.display !== 'none' && style.visibility !== 'hidden' && m.querySelector('.ant-modal');
    });
    return {
      drawerCount: openDrawers.length,
      drawerContents: openDrawers.map(d => d.innerText.substring(0, 500)),
      modalCount: openModals.length,
      modalContents: openModals.map(m => m.innerText.substring(0, 500)),
    };
  });
  console.log(`[DETAIL-CHECK-2-WAIT]`);
  console.log(`  Drawer count: ${detailCheck2.drawerCount}`);
  console.log(`  Modal count: ${detailCheck2.modalCount}`);
  detailCheck2.drawerContents.forEach((c, i) => console.log(`  Drawer ${i}: ${c.substring(0, 200)}`));
  detailCheck2.modalContents.forEach((c, i) => console.log(`  Modal ${i}: ${c.substring(0, 200)}`));
  result.checks.ledger_detail_check_2 = detailCheck2;

  await browser.close();
} catch (err) {
  console.log(`[FATAL] ${err.message}`);
  console.log(err.stack);
  result.errors.push(err.message);
}

console.log('\n=== FINAL RESULT ===');
console.log(JSON.stringify(result, null, 2));
process.exit(0);