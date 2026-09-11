import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const result = { tests: {}, errors: [] };

function log(msg) {
  console.log(`[STEP] ${msg}`);
}

async function newPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'log' || (m.type() === 'error' && !t.includes('Failed to load resource'))) {
      console.log(`[browser-${m.type()}]`, t);
    }
  });
  return { ctx, page };
}

async function login(page) {
  await page.goto(`${BASE}/app/login?role=admin`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
}

const browser = await chromium.launch({ headless: true });

try {
  // =================================================================
  // Test A: 心电图智能辅助诊断 → 心血管辅助诊断系统
  // =================================================================
  log('=== Test A: 心电图智能辅助诊断 direct URL ===');
  {
    const { ctx, page } = await newPage(browser);
    await login(page);

    // The URL uses URL-encoded search param
    const searchName = '心电图智能辅助诊断';
    const url = `${BASE}/app/ledger/list?search=${encodeURIComponent(searchName)}&openDetail=1`;
    log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const finalUrl = page.url();
    log(`Final URL: ${finalUrl}`);

    const onDetailPage = finalUrl.includes('/app/ledger/detail/');
    log(`On detail page: ${onDetailPage}`);

    let pageContent = '';
    if (onDetailPage) {
      pageContent = await page.evaluate(() => document.body.innerText.substring(0, 1500));
    } else {
      pageContent = await page.evaluate(() => document.body.innerText.substring(0, 1500));
    }

    // Check if the detail page shows the agent name (either 心血管辅助诊断系统 or any agent name)
    const hasAgentName = pageContent.includes('心血管辅助诊断系统');
    log(`Has 心血管辅助诊断系统: ${hasAgentName}`);

    await page.screenshot({ path: '/tmp/test_a_heart_detail.png', fullPage: true });

    result.tests.A = {
      finalUrl,
      onDetailPage,
      hasAgentName,
      pageContentStart: pageContent.replace(/\n/g, ' | ').substring(0, 500),
      screenshot: '/tmp/test_a_heart_detail.png',
      pass: onDetailPage && hasAgentName,
    };

    await ctx.close();
  }

  // =================================================================
  // Test B: 肺部 CT 影像分析 → 胸部 CT 影像分析系统
  // =================================================================
  log('=== Test B: 肺部 CT 影像分析 direct URL ===');
  {
    const { ctx, page } = await newPage(browser);
    await login(page);

    const searchName = '肺部 CT 影像分析';
    const url = `${BASE}/app/ledger/list?search=${encodeURIComponent(searchName)}&openDetail=1`;
    log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const finalUrl = page.url();
    log(`Final URL: ${finalUrl}`);

    const onDetailPage = finalUrl.includes('/app/ledger/detail/');
    log(`On detail page: ${onDetailPage}`);

    const pageContent = await page.evaluate(() => document.body.innerText.substring(0, 1500));
    const hasAgentName = pageContent.includes('胸部 CT 影像分析系统');
    log(`Has 胸部 CT 影像分析系统: ${hasAgentName}`);

    await page.screenshot({ path: '/tmp/test_b_lung_detail.png', fullPage: true });

    result.tests.B = {
      finalUrl,
      onDetailPage,
      hasAgentName,
      pageContentStart: pageContent.replace(/\n/g, ' | ').substring(0, 500),
      screenshot: '/tmp/test_b_lung_detail.png',
      pass: onDetailPage && hasAgentName,
    };

    await ctx.close();
  }

  // =================================================================
  // Test C: Full flow from 审核通过 tab
  // =================================================================
  log('=== Test C: Full flow from 审核通过 tab ===');
  {
    const { ctx, page } = await newPage(browser);
    await login(page);

    await page.goto(`${BASE}/app/agent-center?tab=审核通过`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2500);

    // Get first row info
    const firstRow = await page.evaluate(() => {
      const row = document.querySelector('.ant-table-tbody > tr.ant-table-row');
      if (!row) return null;
      const cells = row.querySelectorAll('td');
      const code = cells[1]?.querySelector('button')?.innerText.trim() || cells[1]?.innerText.trim();
      const name = cells[2]?.querySelector('button')?.innerText.trim() || cells[2]?.innerText.trim();
      return { code, name };
    });
    log(`First row: ${JSON.stringify(firstRow)}`);

    await page.screenshot({ path: '/tmp/test_c_agent_center.png', fullPage: true });

    // Click "查看台账" on the first row
    const ledgerBtns = page.locator('button:has-text("查看台账")');
    const btnCount = await ledgerBtns.count();
    log(`Found ${btnCount} 查看台账 buttons`);

    await ledgerBtns.nth(0).click();
    await page.waitForTimeout(3500);

    const finalUrl = page.url();
    log(`Final URL after click: ${finalUrl}`);

    const onDetailPage = finalUrl.includes('/app/ledger/detail/');
    log(`On detail page: ${onDetailPage}`);

    const pageContent = await page.evaluate(() => document.body.innerText.substring(0, 1500));

    await page.screenshot({ path: '/tmp/test_c_after_click.png', fullPage: true });

    // The first row is the heart agent, the detail page should show that or related
    const hasAgentName = pageContent.includes('心血管辅助诊断系统') || pageContent.includes('心电图智能辅助诊断');
    log(`Has agent name: ${hasAgentName}`);

    result.tests.C = {
      firstRow,
      finalUrl,
      onDetailPage,
      hasAgentName,
      pageContentStart: pageContent.replace(/\n/g, ' | ').substring(0, 500),
      screenshots: ['/tmp/test_c_agent_center.png', '/tmp/test_c_after_click.png'],
      pass: onDetailPage,
    };

    await ctx.close();
  }

  // =================================================================
  // Test D: Non-matching case
  // =================================================================
  log('=== Test D: Non-matching case ===');
  {
    const { ctx, page } = await newPage(browser);
    await login(page);

    const searchName = '不存在的智能体';
    const url = `${BASE}/app/ledger/list?search=${encodeURIComponent(searchName)}&openDetail=1`;
    log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3500);

    const finalUrl = page.url();
    log(`Final URL: ${finalUrl}`);

    const stayedOnList = finalUrl.includes('/app/ledger/list');
    const notOnDetail = !finalUrl.includes('/app/ledger/detail/');
    log(`Stayed on list: ${stayedOnList}, Not on detail: ${notOnDetail}`);

    // Check for warning message
    const messages = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.ant-message-notice, .ant-message')).map(m => m.innerText);
    });
    log(`Messages: ${JSON.stringify(messages)}`);

    const hasWarning = messages.some(m => m.includes('未在台账中找到') || m.includes('不存在的智能体'));

    await page.screenshot({ path: '/tmp/test_d_notfound.png', fullPage: true });

    const pageContent = await page.evaluate(() => document.body.innerText.substring(0, 1500));

    result.tests.D = {
      finalUrl,
      stayedOnList,
      notOnDetail,
      hasWarning,
      messages,
      pageContentStart: pageContent.replace(/\n/g, ' | ').substring(0, 500),
      screenshot: '/tmp/test_d_notfound.png',
      pass: stayedOnList && notOnDetail,
    };

    await ctx.close();
  }

} catch (err) {
  console.log(`[FATAL] ${err.message}`);
  console.log(err.stack);
  result.errors.push(err.message);
}

await browser.close();

console.log('\n=== FINAL RESULT ===');
console.log(JSON.stringify(result, null, 2));
process.exit(0);
