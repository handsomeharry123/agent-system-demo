import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const results = {
  test1: { name: 'Test 1: 立即评测 flow', pass: false, steps: [], errors: [], assertions: {} },
  test2: { name: 'Test 2: 查看台账 flow', pass: false, steps: [], errors: [], assertions: {} },
  test3: { name: 'Test 3: 立即评测 with non-matching agent', pass: false, steps: [], errors: [], assertions: {} },
};

function log(testKey, msg) {
  console.log(`[${testKey}] ${msg}`);
  results[testKey].steps.push(msg);
}

async function setupPage(browser) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[CONSOLE-ERR] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(`[PAGE-ERR] ${err.message}`);
  });

  // Auto-login as admin
  await page.goto(`${BASE}/app/login?role=admin`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  return { page, context, consoleErrors };
}

const browser = await chromium.launch({ headless: true });

// =====================================================================
// TEST 1: 立即评测 flow
// =====================================================================
try {
  console.log('\n========================================');
  console.log('TEST 1: 立即评测 flow');
  console.log('========================================');

  const { page, consoleErrors } = await setupPage(browser);

  log('test1', 'Step 1: Navigate to /app/agent-center?tab=审核通过');
  await page.goto(`${BASE}/app/agent-center?tab=${encodeURIComponent('审核通过')}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Take initial screenshot
  await page.screenshot({ path: '/tmp/test1_initial.png', fullPage: true });
  log('test1', 'Initial screenshot saved: /tmp/test1_initial.png');

  // Check the active tab
  const activeTab = await page.locator('.ant-tabs-tab-active').first().textContent();
  log('test1', `Active tab: ${activeTab}`);
  results.test1.assertions.activeTabCorrect = activeTab && activeTab.includes('审核通过');

  // Find the row for 心电图智能辅助诊断
  log('test1', 'Step 2: Find row for 心电图智能辅助诊断');
  const targetRow = page.locator('tr:has-text("心电图智能辅助诊断")').first();
  const rowCount = await targetRow.count();
  log('test1', `Found ${rowCount} row(s) for 心电图智能辅助诊断`);

  if (rowCount === 0) {
    // Try alternative name
    log('test1', 'Trying alternative name 心电图智能辅助诊断系统...');
    const altRow = page.locator('tr:has-text("心电图智能辅助诊断系统")').first();
    const altCount = await altRow.count();
    log('test1', `Found ${altCount} row(s) for 心电图智能辅助诊断系统`);
    if (altCount === 0) {
      throw new Error('No row found for 心电图智能辅助诊断');
    }
  }

  // Check 立即评测 button exists
  const evalBtn = page.locator('button:has-text("立即评测")').first();
  const evalBtnCount = await evalBtn.count();
  log('test1', `Found ${evalBtnCount} 「立即评测」 button(s)`);
  results.test1.assertions.evalButtonVisible = evalBtnCount > 0;

  if (evalBtnCount === 0) {
    // Take screenshot of current state to debug
    await page.screenshot({ path: '/tmp/test1_no_eval_btn.png', fullPage: true });
    throw new Error('「立即评测」 button not visible');
  }

  log('test1', 'Step 3: Click 立即评测 button');
  await evalBtn.click();
  await page.waitForTimeout(2000);

  // Verify URL
  const currentUrl = page.url();
  log('test1', `After click URL: ${currentUrl}`);
  results.test1.assertions.urlAfterClick = currentUrl;

  const expectedUrlContains = [
    '/app/evaluation/tasks/create',
    'agentName=',
    'agentCode=',
  ];
  const urlAssertions = expectedUrlContains.map((part) => ({
    part,
    present: currentUrl.includes(encodeURIComponent(part).replace(/%/g, '')) || currentUrl.includes(part),
  }));
  // More precise check: URL should have agentName=心电图智能辅助诊断 and agentCode=XN-0001 (URL-encoded)
  const expectedAgentName = encodeURIComponent('心电图智能辅助诊断');
  const expectedAgentCode = encodeURIComponent('XN-0001');
  const urlCheck = {
    hasCreateRoute: currentUrl.includes('/app/evaluation/tasks/create'),
    hasAgentName: currentUrl.includes(`agentName=${expectedAgentName}`),
    hasAgentCode: currentUrl.includes(`agentCode=${expectedAgentCode}`),
  };
  log('test1', `URL check: ${JSON.stringify(urlCheck)}`);
  results.test1.assertions.urlCheck = urlCheck;
  results.test1.assertions.correctUrl = urlCheck.hasCreateRoute && urlCheck.hasAgentName && urlCheck.hasAgentCode;

  // Take screenshot of evaluation create page
  await page.screenshot({ path: '/tmp/test1_eval_page.png', fullPage: true });
  log('test1', 'Evaluation create page screenshot: /tmp/test1_eval_page.png');

  // Verify green success Alert
  log('test1', 'Step 4: Verify green success Alert');
  await page.waitForTimeout(1500);
  const successAlert = page.locator('.ant-alert-success').first();
  const successAlertCount = await successAlert.count();
  log('test1', `Found ${successAlertCount} success alert(s)`);
  if (successAlertCount > 0) {
    const alertText = await successAlert.textContent();
    log('test1', `Alert text: ${alertText}`);
    results.test1.assertions.successAlertVisible = true;
    results.test1.assertions.successAlertText = alertText;
    results.test1.assertions.successAlertCorrect = alertText && alertText.includes('心电图智能辅助诊断');
  } else {
    results.test1.assertions.successAlertVisible = false;
    // Check for any alert
    const allAlerts = await page.locator('.ant-alert').allTextContents();
    log('test1', `All alerts: ${JSON.stringify(allAlerts)}`);
    results.test1.assertions.allAlerts = allAlerts;
  }

  // Verify Select dropdown
  log('test1', 'Step 5: Verify 智能体 Select dropdown is auto-selected');
  const selectEl = page.locator('.ant-select-selection-item').first();
  const selectText = await selectEl.textContent().catch(() => '');
  log('test1', `Select dropdown text: ${selectText}`);
  results.test1.assertions.selectText = selectText;
  results.test1.assertions.selectCorrect = selectText && selectText.includes('心电图智能辅助诊断');

  // Verify agent info card
  log('test1', 'Step 6: Verify agent info card is visible (类型/科室/编号/版本)');
  const pageContent = await page.content();
  const hasType = pageContent.includes('类型：');
  const hasDept = pageContent.includes('科室：');
  const hasCode = pageContent.includes('编号：');
  const hasVersion = pageContent.includes('版本：');
  log('test1', `Type:${hasType} Dept:${hasDept} Code:${hasCode} Version:${hasVersion}`);
  results.test1.assertions.infoCardVisible = hasType && hasDept && hasCode && hasVersion;

  // Take final screenshot
  await page.screenshot({ path: '/tmp/test1_final.png', fullPage: true });
  log('test1', 'Final screenshot: /tmp/test1_final.png');

  // Test 1 PASS criteria
  results.test1.pass =
    results.test1.assertions.correctUrl &&
    results.test1.assertions.successAlertCorrect &&
    results.test1.assertions.selectCorrect &&
    results.test1.assertions.infoCardVisible;

  if (consoleErrors.length) {
    log('test1', `Browser errors: ${JSON.stringify(consoleErrors)}`);
    results.test1.errors = consoleErrors;
  }
} catch (err) {
  console.log(`[TEST 1 FATAL] ${err.message}`);
  results.test1.errors.push(err.message);
  try {
    // We may not have page in scope here
  } catch {}
}

// =====================================================================
// TEST 2: 查看台账 flow
// =====================================================================
try {
  console.log('\n========================================');
  console.log('TEST 2: 查看台账 flow');
  console.log('========================================');

  const { page, consoleErrors } = await setupPage(browser);

  log('test2', 'Step 1: Navigate to /app/agent-center?tab=审核通过');
  await page.goto(`${BASE}/app/agent-center?tab=${encodeURIComponent('审核通过')}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: '/tmp/test2_initial.png', fullPage: true });
  log('test2', 'Initial screenshot: /tmp/test2_initial.png');

  // Check the active tab
  const activeTab = await page.locator('.ant-tabs-tab-active').first().textContent();
  log('test2', `Active tab: ${activeTab}`);

  // Find a row and click 查看台账
  log('test2', 'Step 2: Click 查看台账 button on a row');
  const ledgerBtn = page.locator('button:has-text("查看台账")').first();
  const ledgerBtnCount = await ledgerBtn.count();
  log('test2', `Found ${ledgerBtnCount} 「查看台账」 button(s)`);
  results.test2.assertions.ledgerButtonVisible = ledgerBtnCount > 0;

  if (ledgerBtnCount === 0) {
    await page.screenshot({ path: '/tmp/test2_no_btn.png', fullPage: true });
    throw new Error('「查看台账」 button not visible');
  }

  // Get the name of the agent in the row that contains the button (for verification later)
  // Find the parent row of the button
  const btnRow = page.locator('tr:has(button:has-text("查看台账"))').first();
  const rowText = await btnRow.textContent();
  log('test2', `Target row text (first 200 chars): ${rowText?.slice(0, 200)}`);

  await ledgerBtn.click();

  // We need to capture URL right after click, but it auto-navigates
  // Use a tight wait loop
  await page.waitForTimeout(500);
  const initialUrl = page.url();
  log('test2', `URL after 500ms: ${initialUrl}`);
  results.test2.assertions.initialUrl = initialUrl;

  // Wait for navigation
  await page.waitForTimeout(2500);
  const finalUrl = page.url();
  log('test2', `Final URL: ${finalUrl}`);
  results.test2.assertions.finalUrl = finalUrl;

  // Check that we end up at /app/ledger/detail/{id}
  const detailUrlMatch = finalUrl.match(/\/app\/ledger\/detail\/([^?]+)/);
  log('test2', `Detail URL match: ${JSON.stringify(detailUrlMatch)}`);
  results.test2.assertions.detailUrlMatch = detailUrlMatch;
  results.test2.assertions.onDetailPage = !!detailUrlMatch;

  // Check that openDetail was removed
  const openDetailRemoved = !finalUrl.includes('openDetail=1');
  log('test2', `openDetail removed: ${openDetailRemoved}`);
  results.test2.assertions.openDetailRemoved = openDetailRemoved;

  await page.screenshot({ path: '/tmp/test2_final.png', fullPage: true });
  log('test2', 'Final screenshot: /tmp/test2_final.png');

  // Verify the detail page content - should show the agent info
  log('test2', 'Step 3: Verify detail page content');
  const pageContent = await page.content();
  // Check for some ledger detail page elements
  const hasDetailHeader = pageContent.includes('智能体详情') || pageContent.includes('智能体信息') || pageContent.includes('基本信息');
  const hasAgentInfo = pageContent.includes('心电图智能辅助诊断') || pageContent.includes(rowText?.split('\n')[0] || 'X');
  log('test2', `hasDetailHeader:${hasDetailHeader}, hasAgentInfo:${hasAgentInfo}`);
  results.test2.assertions.detailContent = { hasDetailHeader, hasAgentInfo };

  // Test 2 PASS criteria
  results.test2.pass =
    results.test2.assertions.ledgerButtonVisible &&
    results.test2.assertions.onDetailPage &&
    results.test2.assertions.openDetailRemoved;

  if (consoleErrors.length) {
    log('test2', `Browser errors: ${JSON.stringify(consoleErrors)}`);
    results.test2.errors.push(...consoleErrors);
  }
} catch (err) {
  console.log(`[TEST 2 FATAL] ${err.message}`);
  results.test2.errors.push(err.message);
}

// =====================================================================
// TEST 3: 立即评测 with non-matching agent
// =====================================================================
try {
  console.log('\n========================================');
  console.log('TEST 3: 立即评测 with non-matching agent');
  console.log('========================================');

  const { page, consoleErrors } = await setupPage(browser);

  const url = `${BASE}/app/evaluation/tasks/create?agentName=${encodeURIComponent('不存在的智能体')}&agentCode=${encodeURIComponent('XX-9999')}`;
  log('test3', `Step 1: Navigate to: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: '/tmp/test3_initial.png', fullPage: true });
  log('test3', 'Initial screenshot: /tmp/test3_initial.png');

  // Verify blue info Alert
  log('test3', 'Step 2: Verify blue info Alert');
  const infoAlert = page.locator('.ant-alert-info').first();
  const infoAlertCount = await infoAlert.count();
  log('test3', `Found ${infoAlertCount} info alert(s)`);
  if (infoAlertCount > 0) {
    const alertText = await infoAlert.textContent();
    log('test3', `Alert text: ${alertText}`);
    results.test3.assertions.infoAlertVisible = true;
    results.test3.assertions.infoAlertText = alertText;
    results.test3.assertions.infoAlertCorrect =
      alertText &&
      alertText.includes('不存在的智能体') &&
      alertText.includes('请在下方手动选择');
  } else {
    // Check for any alert
    const allAlerts = await page.locator('.ant-alert').allTextContents();
    log('test3', `All alerts: ${JSON.stringify(allAlerts)}`);
    results.test3.assertions.infoAlertVisible = false;
    results.test3.assertions.allAlerts = allAlerts;
  }

  // Verify Select dropdown is NOT auto-selected
  log('test3', 'Step 3: Verify Select dropdown is NOT auto-selected');
  // The Select placeholder should be "请选择智能体" since nothing is selected
  const placeholderEl = page.locator('.ant-select-selection-placeholder').first();
  const placeholderText = await placeholderEl.textContent().catch(() => '');
  log('test3', `Placeholder text: ${placeholderText}`);

  // Check that there's no selection item (selected value would have class .ant-select-selection-item)
  const selectionItem = page.locator('.ant-select-selection-item').first();
  const selectionItemCount = await selectionItem.count();
  log('test3', `Selection item count: ${selectionItemCount}`);

  results.test3.assertions.placeholderText = placeholderText;
  results.test3.assertions.placeholderVisible =
    placeholderText && placeholderText.includes('请选择智能体');
  results.test3.assertions.noSelectionItem = selectionItemCount === 0;

  await page.screenshot({ path: '/tmp/test3_final.png', fullPage: true });
  log('test3', 'Final screenshot: /tmp/test3_final.png');

  // Test 3 PASS criteria
  results.test3.pass =
    results.test3.assertions.infoAlertCorrect &&
    results.test3.assertions.placeholderVisible &&
    results.test3.assertions.noSelectionItem;

  if (consoleErrors.length) {
    log('test3', `Browser errors: ${JSON.stringify(consoleErrors)}`);
    results.test3.errors.push(...consoleErrors);
  }
} catch (err) {
  console.log(`[TEST 3 FATAL] ${err.message}`);
  results.test3.errors.push(err.message);
}

await browser.close();

// =====================================================================
// Final report
// =====================================================================
console.log('\n\n========================================');
console.log('FINAL TEST RESULTS');
console.log('========================================');
console.log(JSON.stringify(results, null, 2));

console.log('\n\n========================================');
console.log('SUMMARY');
console.log('========================================');
console.log(`Test 1 (立即评测 flow):         ${results.test1.pass ? '✓ PASS' : '✗ FAIL'}`);
console.log(`Test 2 (查看台账 flow):         ${results.test2.pass ? '✓ PASS' : '✗ FAIL'}`);
console.log(`Test 3 (非匹配 agent 预填):     ${results.test3.pass ? '✓ PASS' : '✗ FAIL'}`);

process.exit(0);
