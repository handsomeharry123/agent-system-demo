import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const result = {
  steps: [],
  errors: [],
  urlAssertion: null,
  tabAssertion: null,
  screenshot: null,
  actualUrl: null,
  activeTab: null,
  pendingRecordFound: null,
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

  log('Navigating to /app/agent-center...');
  await page.goto(`${BASE}/app/agent-center`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  log('Checking login state...');
  // If not logged in, log in
  const onLogin = await page.locator('input[placeholder*="账号"], input[placeholder*="用户名"], input#username').count();
  if (onLogin > 0) {
    log('On login page, logging in as admin...');
    await page.locator('input[placeholder*="账号"], input[placeholder*="用户名"], input#username').first().fill('admin');
    await page.locator('input[type="password"]').first().fill('信息科管理员');
    await page.locator('button[type="submit"], button:has-text("登录")').first().click();
    await page.waitForTimeout(2000);
    // Navigate to agent-center after login
    await page.goto(`${BASE}/app/agent-center`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
  } else {
    log('Already on agent-center (or session active)');
  }

  log('Looking for 「待审核」 Tab...');
  // Tabs in antd: .ant-tabs-tab
  const tabs = await page.locator('.ant-tabs-tab').allTextContents();
  console.log(`[TABS] Found tabs: ${JSON.stringify(tabs)}`);

  const pendingTab = page.locator('.ant-tabs-tab', { hasText: '待审核' }).first();
  const pendingTabCount = await pendingTab.count();
  if (pendingTabCount === 0) {
    result.errors.push('「待审核」 Tab not found');
    result.pendingRecordFound = false;
    throw new Error('「待审核」 Tab not found');
  }
  await pendingTab.click();
  await page.waitForTimeout(1000);

  log('Looking for 「审核」 link button...');
  // 操作 column has 「审核」 link
  const reviewBtn = page.locator('a:has-text("审核"), button:has-text("审核")').first();
  const reviewBtnCount = await reviewBtn.count();
  if (reviewBtnCount === 0) {
    result.errors.push('No 「审核」 button found in 待审核 Tab');
    result.pendingRecordFound = false;
    await page.screenshot({ path: '/tmp/audit_return_verify.png', fullPage: true });
    result.screenshot = '/tmp/audit_return_verify.png';
    throw new Error('No 「审核」 button found in 待审核 Tab - Tab may be empty');
  }

  result.pendingRecordFound = true;
  log('Clicking 「审核」 button...');
  await reviewBtn.click();
  await page.waitForTimeout(2000);

  log('Waiting for audit page to load...');
  await page.waitForSelector('text=审核注册', { timeout: 5000 }).catch(() => {
    log('Audit page header not seen, continuing anyway...');
  });
  await page.waitForTimeout(1000);

  log('Clicking 「退回修改」 Radio...');
  // Radio labels
  const returnRadio = page.locator('label:has-text("退回修改")').first();
  await returnRadio.click();
  await page.waitForTimeout(500);

  log('Filling 「退回说明」 TextArea...');
  // The TextArea - find by label or placeholder
  const reasonArea = page.locator('textarea').first();
  await reasonArea.fill('测试验证：字段需补全');
  await page.waitForTimeout(500);

  log('Clicking 「确认退回修改」 button...');
  const confirmReturnBtn = page.locator('button:has-text("确认退回修改")').first();
  await confirmReturnBtn.click();
  await page.waitForTimeout(1000);

  log('Clicking 「确认退回」 inside Modal...');
  const modalConfirmBtn = page.locator('.ant-modal button:has-text("确认退回")').first();
  const modalCount = await page.locator('.ant-modal').count();
  console.log(`[MODAL] Modal count: ${modalCount}`);
  if (modalCount > 0) {
    await modalConfirmBtn.click();
  } else {
    result.errors.push('Confirm modal not found');
  }

  log('Waiting 1.5s for navigation...');
  await page.waitForTimeout(1500);

  // Assertions
  const finalUrl = page.url();
  result.actualUrl = finalUrl;
  console.log(`[FINAL-URL] ${finalUrl}`);

  // URL assertion: ends with ?tab=退回修改 or URL-encoded form
  const urlOk = finalUrl.endsWith('?tab=退回修改') || finalUrl.endsWith('?tab=%E6%92%A4%E5%9B%9E%E4%BF%AE%E6%94%B9');
  result.urlAssertion = urlOk;
  console.log(`[URL-ASSERTION] ${urlOk ? 'PASS' : 'FAIL'}`);

  // Active tab assertion
  await page.waitForTimeout(500);
  const activeTabs = await page.locator('.ant-tabs-tab-active').allTextContents();
  console.log(`[ACTIVE-TABS] ${JSON.stringify(activeTabs)}`);
  result.activeTab = activeTabs.join(' | ');
  const tabOk = activeTabs.some((t) => t.includes('退回修改'));
  result.tabAssertion = tabOk;
  console.log(`[TAB-ASSERTION] ${tabOk ? 'PASS' : 'FAIL'}`);

  log('Taking full-page screenshot...');
  await page.screenshot({ path: '/tmp/audit_return_verify.png', fullPage: true });
  result.screenshot = '/tmp/audit_return_verify.png';

  await browser.close();
  console.log('=== DONE ===');
} catch (err) {
  console.log(`[FATAL] ${err.message}`);
  result.errors.push(err.message);
  try {
    await page.screenshot({ path: '/tmp/audit_return_verify.png', fullPage: true });
    result.screenshot = '/tmp/audit_return_verify.png';
  } catch (_) {}
}

console.log('\n=== FINAL RESULT ===');
console.log(JSON.stringify(result, null, 2));
process.exit(0);
