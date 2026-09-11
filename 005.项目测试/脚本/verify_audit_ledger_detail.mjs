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

  // Get all rows
  const rows = await page.evaluate(() => {
    const trs = Array.from(document.querySelectorAll('.ant-table-tbody > tr.ant-table-row'));
    return trs.map((row, idx) => {
      const cells = row.querySelectorAll('td');
      const code = cells[1]?.querySelector('button')?.innerText.trim() || cells[1]?.innerText.trim();
      const name = cells[2]?.querySelector('button')?.innerText.trim() || cells[2]?.innerText.trim();
      return { idx, code, name };
    });
  });
  console.log(`[ROWS]`);
  rows.forEach(r => console.log(`  Row ${r.idx}: code=${r.code} name=${r.name}`));

  // ============================================================
  // Test detail page auto-open for 查看台账
  // ============================================================
  log('Test: Verify 查看台账 auto-navigates to detail');

  const ledgerBtns = page.locator('button:has-text("查看台账")');
  await ledgerBtns.nth(0).click();

  // Wait for navigation
  await page.waitForTimeout(4000);

  const finalUrl = page.url();
  console.log(`[FINAL-URL] ${finalUrl}`);

  // Check if URL changed to detail
  const onDetailPage = finalUrl.includes('/app/ledger/detail/');
  console.log(`[DETAIL-PAGE] ${onDetailPage}`);
  result.checks.ledger_navigated_to_detail = onDetailPage;
  result.checks.ledger_final_url = finalUrl;

  await page.screenshot({ path: '/tmp/audit_ledger_final.png', fullPage: true });

  // Check what's on the page (URL bar text)
  const pageTitle = await page.title();
  console.log(`[PAGE-TITLE] ${pageTitle}`);

  // Check for any message warnings
  const messages = await page.evaluate(() => {
    const msgs = Array.from(document.querySelectorAll('.ant-message-notice'));
    return msgs.map(m => m.innerText);
  });
  console.log(`[MESSAGES]`, messages);

  // Check the page content for any indication
  const pageContent = await page.evaluate(() => {
    return {
      url: location.href,
      bodyTextStart: document.body.innerText.substring(0, 500),
      hasDrawer: !!document.querySelector('.ant-drawer-content-wrapper'),
      hasModal: !!document.querySelector('.ant-modal-wrap'),
    };
  });
  console.log(`[PAGE-CONTENT]`);
  console.log(`  URL: ${pageContent.url}`);
  console.log(`  Has drawer: ${pageContent.hasDrawer}`);
  console.log(`  Has modal: ${pageContent.hasModal}`);
  console.log(`  Body text start: ${pageContent.bodyTextStart.replace(/\n/g, ' | ').substring(0, 300)}`);
  result.checks.page_state = pageContent;

  // Wait for potential message popups
  await page.waitForTimeout(2000);

  // Check message API for any pending toasts
  const messagesLater = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.ant-message-notice')).map(m => m.innerText);
  });
  console.log(`[MESSAGES-LATER]`, messagesLater);
  result.checks.messages = messagesLater;

  await browser.close();
} catch (err) {
  console.log(`[FATAL] ${err.message}`);
  console.log(err.stack);
  result.errors.push(err.message);
}

console.log('\n=== FINAL RESULT ===');
console.log(JSON.stringify(result, null, 2));
process.exit(0);