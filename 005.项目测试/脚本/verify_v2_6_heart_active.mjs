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
    if (m.type() === 'error' && !t.includes('Failed to load resource')) {
      console.log(`[browser-error]`, t);
    }
  });
  return { ctx, page };
}

async function login(page) {
  await page.goto(`${BASE}/app/login?role=admin`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
}

async function extractAgentId(url) {
  const m = url.match(/\/app\/ledger\/detail\/([^?\/]+)/);
  return m ? m[1] : null;
}

async function extractAgentName(page) {
  return page.evaluate(() => {
    const labels = document.querySelectorAll('.ant-descriptions-item-label');
    for (const label of labels) {
      if (label.textContent.includes('智能体名称')) {
        const valueEl = label.nextElementSibling;
        if (valueEl) return valueEl.textContent.trim();
      }
    }
    return null;
  });
}

async function extractLifecycleStatus(page) {
  return page.evaluate(() => {
    const labels = document.querySelectorAll('.ant-descriptions-item-label');
    for (const label of labels) {
      if (label.textContent.includes('生命周期')) {
        const valueEl = label.nextElementSibling;
        if (valueEl) return valueEl.textContent.trim();
      }
    }
    return null;
  });
}

const browser = await chromium.launch({ headless: true });

try {
  // =================================================================
  // Test 1: Heart agent (心电图智能辅助诊断) → AGT-2025-002 (active)
  // =================================================================
  log('=== Test 1: Heart agent should resolve to ACTIVE record ===');
  {
    const { ctx, page } = await newPage(browser);
    await login(page);

    const searchName = '心电图智能辅助诊断';
    const url = `${BASE}/app/ledger/list?search=${encodeURIComponent(searchName)}&openDetail=1`;
    log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(4000);

    const finalUrl = page.url();
    const agentId = await extractAgentId(finalUrl);
    const agentName = await extractAgentName(page);
    const lifecycle = await extractLifecycleStatus(page);
    const pageContent = await page.evaluate(() => document.body.innerText);
    const hasActive = pageContent.includes('心血管辅助诊断系统');
    const hasDisabledV0 = pageContent.includes('心电辅助诊断 V0');

    log(`Final URL: ${finalUrl}`);
    log(`Agent ID: ${agentId}`);
    log(`Agent Name: ${agentName}`);
    log(`Lifecycle: ${lifecycle}`);
    log(`Has 心血管辅助诊断系统: ${hasActive}`);
    log(`Has 心电辅助诊断 V0: ${hasDisabledV0}`);

    await page.screenshot({ path: '/tmp/v2_6_test1_heart.png', fullPage: true });

    const idIs2025_002 = agentId === 'AGT-2025-002';
    const idIsNot2022_011 = agentId !== 'AGT-2022-011';
    const pass = idIs2025_002 && idIsNot2022_011 && hasActive && !hasDisabledV0;

    result.tests.test1_heart = {
      finalUrl,
      agentId,
      agentName,
      lifecycle,
      hasActive,
      hasDisabledV0,
      expectedId: 'AGT-2025-002',
      notExpectedId: 'AGT-2022-011',
      pass,
      screenshot: '/tmp/v2_6_test1_heart.png',
    };
    log(`Test 1 result: ${pass ? 'PASS' : 'FAIL'}`);

    await ctx.close();
  }

  // =================================================================
  // Test 2: Lung agent (肺部 CT 影像分析) → AGT-2025-005
  // =================================================================
  log('\n=== Test 2: Lung agent should resolve to AGT-2025-005 ===');
  {
    const { ctx, page } = await newPage(browser);
    await login(page);

    const searchName = '肺部 CT 影像分析';
    const url = `${BASE}/app/ledger/list?search=${encodeURIComponent(searchName)}&openDetail=1`;
    log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(4000);

    const finalUrl = page.url();
    const agentId = await extractAgentId(finalUrl);
    const agentName = await extractAgentName(page);
    const lifecycle = await extractLifecycleStatus(page);
    const pageContent = await page.evaluate(() => document.body.innerText);
    const hasLung = pageContent.includes('胸部 CT 影像分析系统');

    log(`Final URL: ${finalUrl}`);
    log(`Agent ID: ${agentId}`);
    log(`Agent Name: ${agentName}`);
    log(`Lifecycle: ${lifecycle}`);
    log(`Has 胸部 CT 影像分析系统: ${hasLung}`);

    await page.screenshot({ path: '/tmp/v2_6_test2_lung.png', fullPage: true });

    const idIs2025_005 = agentId === 'AGT-2025-005';
    const pass = idIs2025_005 && hasLung;

    result.tests.test2_lung = {
      finalUrl,
      agentId,
      agentName,
      lifecycle,
      hasLung,
      expectedId: 'AGT-2025-005',
      pass,
      screenshot: '/tmp/v2_6_test2_lung.png',
    };
    log(`Test 2 result: ${pass ? 'PASS' : 'FAIL'}`);

    await ctx.close();
  }

  // =================================================================
  // Test 3: Nonsense name should NOT auto-open + show warning toast
  // =================================================================
  log('\n=== Test 3: Nonsense name should NOT auto-open ===');
  {
    const { ctx, page } = await newPage(browser);
    await login(page);

    const searchName = '不存在的智能体';
    const url = `${BASE}/app/ledger/list?search=${encodeURIComponent(searchName)}&openDetail=1`;
    log(`Navigating to: ${url}`);

    // Set up message listener BEFORE navigation
    const messagePromise = page.waitForSelector('.ant-message-notice-content', { timeout: 8000 }).catch(() => null);

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    // Try to capture message text
    let messageText = null;
    const messageEl = await messagePromise;
    if (messageEl) {
      messageText = await messageEl.textContent();
      log(`Toast message captured: ${messageText}`);
    } else {
      // Try other selectors
      const allMessages = await page.evaluate(() => {
        const selectors = [
          '.ant-message-notice',
          '.ant-message-notice-content',
          '.ant-message-custom-content',
        ];
        const found = [];
        for (const sel of selectors) {
          const els = document.querySelectorAll(sel);
          for (const el of els) {
            const txt = (el.textContent || '').trim();
            if (txt) found.push({ selector: sel, text: txt });
          }
        }
        return found;
      });
      log(`Found messages: ${JSON.stringify(allMessages)}`);
      if (allMessages.length > 0) {
        messageText = allMessages[0].text;
      }
    }

    const finalUrl = page.url();
    const stayedOnList = finalUrl.includes('/app/ledger/list') && !finalUrl.includes('/app/ledger/detail/');
    const hasWarning = messageText && messageText.includes('不存在的智能体');

    log(`Final URL: ${finalUrl}`);
    log(`Stayed on list (not detail): ${stayedOnList}`);
    log(`Has warning with 智能体 name: ${hasWarning}`);

    await page.screenshot({ path: '/tmp/v2_6_test3_nonsense.png', fullPage: true });

    const pass = stayedOnList && hasWarning;

    result.tests.test3_nonsense = {
      finalUrl,
      stayedOnList,
      messageText,
      hasWarning,
      pass,
      screenshot: '/tmp/v2_6_test3_nonsense.png',
    };
    log(`Test 3 result: ${pass ? 'PASS' : 'FAIL'}`);

    await ctx.close();
  }

  // =================================================================
  // Test 4: Full flow from 审核通过 tab - click 查看台账 on each of 3 rows
  // =================================================================
  log('\n=== Test 4: Full flow from 审核通过 tab ===');
  {
    const { ctx, page } = await newPage(browser);
    await login(page);

    await page.goto(`${BASE}/app/agent-center?tab=审核通过`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2500);

    // Get info about rows in the 审核通过 tab
    const rowsInfo = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.ant-table-tbody > tr.ant-table-row'));
      return rows.map((row, idx) => {
        const txt = row.innerText.replace(/\s+/g, ' ').trim();
        return { idx, text: txt.substring(0, 200) };
      });
    });
    log(`审核通过 tab has ${rowsInfo.length} rows:`);
    rowsInfo.forEach(r => log(`  Row ${r.idx}: ${r.text}`));

    await page.screenshot({ path: '/tmp/v2_6_test4_audit_passed_tab.png', fullPage: true });

    const flowResults = [];

    // Get all 查看台账 buttons (one per row, max 3)
    const ledgerButtons = await page.locator('tr.ant-table-row button:has-text("查看台账")').all();
    log(`Total 查看台账 buttons: ${ledgerButtons.length}`);

    const rowsToTest = Math.min(3, ledgerButtons.length);
    log(`Testing ${rowsToTest} rows`);

    for (let i = 0; i < rowsToTest; i++) {
      // Re-navigate back to the tab
      await page.goto(`${BASE}/app/agent-center?tab=审核通过`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Re-fetch buttons (DOM is fresh)
      const btns = await page.locator('tr.ant-table-row button:has-text("查看台账")').all();
      if (i >= btns.length) {
        log(`Button ${i} not found, skipping`);
        flowResults.push({ idx: i, pass: false, error: 'button not found' });
        continue;
      }

      const rowText = await btns[i].evaluate((el) => {
        const tr = el.closest('tr');
        return tr ? tr.innerText.replace(/\s+/g, ' ').trim().substring(0, 150) : '';
      });
      log(`\n  Clicking row ${i}: ${rowText}`);

      await btns[i].click();
      await page.waitForTimeout(3500);

      const finalUrl = page.url();
      const onDetail = finalUrl.includes('/app/ledger/detail/');
      const agentId = await extractAgentId(finalUrl);
      const agentName = await extractAgentName(page);

      log(`    Final URL: ${finalUrl}`);
      log(`    Agent ID: ${agentId}`);
      log(`    Agent Name: ${agentName}`);
      log(`    On detail page: ${onDetail}`);

      await page.screenshot({ path: `/tmp/v2_6_test4_row${i}.png`, fullPage: true });

      flowResults.push({
        idx: i,
        rowText,
        finalUrl,
        onDetail,
        agentId,
        agentName,
        pass: onDetail && !!agentId,
        screenshot: `/tmp/v2_6_test4_row${i}.png`,
      });
    }

    const allPass = flowResults.every(r => r.pass);
    result.tests.test4_full_flow = {
      rowCount: rowsInfo.length,
      rows: rowsInfo,
      flowResults,
      pass: allPass && flowResults.length > 0,
    };
    log(`Test 4 result: ${result.tests.test4_full_flow.pass ? 'PASS' : 'FAIL'}`);

    await ctx.close();
  }

} catch (err) {
  console.log(`[FATAL] ${err.message}`);
  console.log(err.stack);
  result.errors.push(err.message);
}

await browser.close();

console.log('\n========================================');
console.log('=== FINAL RESULT ===');
console.log('========================================');
console.log(JSON.stringify(result, null, 2));
process.exit(0);
