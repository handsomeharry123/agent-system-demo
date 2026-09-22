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
  // Test 1: 心电图智能辅助诊断 → 心血管辅助诊断系统 (UI click)
  // =================================================================
  log('=== Test 1: heart agent UI click ===');
  {
    const { ctx, page } = await newPage(browser);
    await login(page);

    await page.goto(`${BASE}/app/agent-center?tab=审核通过`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2500);

    // Find the row with XN-0001 (心电图智能辅助诊断)
    const rowInfo = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.ant-table-tbody > tr.ant-table-row'));
      for (const row of rows) {
        const txt = row.innerText;
        if (txt.includes('心电图智能辅助诊断') || txt.includes('XN-0001')) {
          const cells = row.querySelectorAll('td');
          return {
            found: true,
            text: txt.replace(/\s+/g, ' ').trim().substring(0, 200),
            cellCount: cells.length,
          };
        }
      }
      return { found: false };
    });
    log(`Heart row: ${JSON.stringify(rowInfo)}`);

    await page.screenshot({ path: '/tmp/test1_agent_center.png', fullPage: false });

    // Locate the 查看台账 button in the heart agent row
    const heartRow = page.locator('tr.ant-table-row', { hasText: '心电图智能辅助诊断' });
    const ledgerBtn = heartRow.locator('button:has-text("查看台账")');
    const btnCount = await ledgerBtn.count();
    log(`Found ${btnCount} 查看台账 buttons in heart row`);

    if (btnCount === 0) {
      // Try alternative: by code XN-0001
      const heartRowByCode = page.locator('tr.ant-table-row', { hasText: 'XN-0001' });
      const altBtn = heartRowByCode.locator('button:has-text("查看台账")');
      const altCount = await altBtn.count();
      log(`Found ${altCount} 查看台账 buttons in XN-0001 row`);
      if (altCount > 0) {
        await altBtn.first().click();
      } else {
        throw new Error('No 查看台账 button found for heart agent');
      }
    } else {
      await ledgerBtn.first().click();
    }

    await page.waitForTimeout(3500);
    const finalUrl = page.url();
    log(`Final URL: ${finalUrl}`);

    const onDetailPage = finalUrl.includes('/app/ledger/detail/');
    log(`On detail page: ${onDetailPage}`);

    const pageContent = await page.evaluate(() => document.body.innerText);
    const hasAgentName = pageContent.includes('心血管辅助诊断系统');
    log(`Has 心血管辅助诊断系统: ${hasAgentName}`);

    await page.screenshot({ path: '/tmp/test1_after_click.png', fullPage: true });

    result.tests.test1_heart = {
      rowFound: rowInfo.found,
      finalUrl,
      onDetailPage,
      hasAgentName,
      pageContentStart: pageContent.replace(/\n/g, ' | ').substring(0, 400),
      screenshots: ['/tmp/test1_agent_center.png', '/tmp/test1_after_click.png'],
      pass: onDetailPage && hasAgentName,
    };

    await ctx.close();
  }

  // =================================================================
  // Test 2: 肺部 CT 影像分析 → 胸部 CT 影像分析系统 (UI click)
  // =================================================================
  log('=== Test 2: lung agent UI click ===');
  {
    const { ctx, page } = await newPage(browser);
    await login(page);

    await page.goto(`${BASE}/app/agent-center?tab=审核通过`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2500);

    // Find the row with YX-0001 (肺部 CT 影像分析)
    const rowInfo = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.ant-table-tbody > tr.ant-table-row'));
      for (const row of rows) {
        const txt = row.innerText;
        if (txt.includes('肺部 CT 影像分析') || txt.includes('YX-0001')) {
          return { found: true, text: txt.replace(/\s+/g, ' ').trim().substring(0, 200) };
        }
      }
      return { found: false };
    });
    log(`Lung row: ${JSON.stringify(rowInfo)}`);

    // Try by name first
    let lungRow = page.locator('tr.ant-table-row', { hasText: '肺部 CT 影像分析' });
    let ledgerBtn = lungRow.locator('button:has-text("查看台账")');
    let btnCount = await ledgerBtn.count();
    log(`Found ${btnCount} 查看台账 buttons in lung row (by name)`);

    if (btnCount === 0) {
      lungRow = page.locator('tr.ant-table-row', { hasText: 'YX-0001' });
      ledgerBtn = lungRow.locator('button:has-text("查看台账")');
      btnCount = await ledgerBtn.count();
      log(`Found ${btnCount} 查看台账 buttons in YX-0001 row`);
    }

    if (btnCount === 0) {
      throw new Error('No 查看台账 button found for lung agent');
    }

    await ledgerBtn.first().click();
    await page.waitForTimeout(3500);

    const finalUrl = page.url();
    log(`Final URL: ${finalUrl}`);

    const onDetailPage = finalUrl.includes('/app/ledger/detail/');
    log(`On detail page: ${onDetailPage}`);

    const pageContent = await page.evaluate(() => document.body.innerText);
    const hasAgentName = pageContent.includes('胸部 CT 影像分析系统');
    log(`Has 胸部 CT 影像分析系统: ${hasAgentName}`);

    await page.screenshot({ path: '/tmp/test2_after_click.png', fullPage: true });

    result.tests.test2_lung = {
      rowFound: rowInfo.found,
      finalUrl,
      onDetailPage,
      hasAgentName,
      pageContentStart: pageContent.replace(/\n/g, ' | ').substring(0, 400),
      screenshots: ['/tmp/test2_after_click.png'],
      pass: onDetailPage && hasAgentName,
    };

    await ctx.close();
  }

  // =================================================================
  // Test 3: Direct URL test for nonsense name should NOT auto-open
  // =================================================================
  log('=== Test 3: nonsense name direct URL ===');
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

    // Check for warning message in DOM
    const messages = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.ant-message-notice, .ant-message-notice-content, .ant-message')).map(m => m.innerText);
    });
    log(`Messages: ${JSON.stringify(messages)}`);

    const hasWarning = messages.some(m => m.includes('未在台账中找到') && m.includes('不存在的智能体'));

    await page.screenshot({ path: '/tmp/test3_notfound.png', fullPage: true });

    const pageContent = await page.evaluate(() => document.body.innerText);
    const hasSearchInUrl = finalUrl.includes(encodeURIComponent('不存在的智能体')) || finalUrl.includes('不存在的智能体');

    result.tests.test3_nonsense = {
      finalUrl,
      stayedOnList,
      notOnDetail,
      hasWarning,
      hasSearchInUrl,
      messages,
      pageContentStart: pageContent.replace(/\n/g, ' | ').substring(0, 400),
      screenshot: '/tmp/test3_notfound.png',
      pass: stayedOnList && notOnDetail && hasWarning,
    };

    await ctx.close();
  }

  // =================================================================
  // Test 4: Direct URL test for exact match should auto-navigate
  // =================================================================
  log('=== Test 4: exact match direct URL ===');
  {
    const { ctx, page } = await newPage(browser);
    await login(page);

    const searchName = '胸部 CT 影像分析系统';
    const url = `${BASE}/app/ledger/list?search=${encodeURIComponent(searchName)}&openDetail=1`;
    log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3500);

    const finalUrl = page.url();
    log(`Final URL: ${finalUrl}`);

    const onDetailPage = finalUrl.includes('/app/ledger/detail/');
    log(`On detail page: ${onDetailPage}`);

    const pageContent = await page.evaluate(() => document.body.innerText);
    const hasAgentName = pageContent.includes('胸部 CT 影像分析系统');
    log(`Has 胸部 CT 影像分析系统: ${hasAgentName}`);

    await page.screenshot({ path: '/tmp/test4_exact.png', fullPage: true });

    result.tests.test4_exact = {
      finalUrl,
      onDetailPage,
      hasAgentName,
      pageContentStart: pageContent.replace(/\n/g, ' | ').substring(0, 400),
      screenshot: '/tmp/test4_exact.png',
      pass: onDetailPage && hasAgentName,
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
