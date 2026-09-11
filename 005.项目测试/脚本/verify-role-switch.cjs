const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const consoleMessages = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  try {
    // a. open homepage
    console.log('=== Step a: open homepage ===');
    await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    console.log('URL after load:', page.url());

    // b. click "演示操作" floating button
    console.log('=== Step b: click 演示操作 floating button ===');
    // The floating button is typically an ant-floating-shape or fixed-position button
    // Try multiple selectors
    const floatBtn = await page.locator('text=演示操作').first();
    const floatCount = await page.locator('text=演示操作').count();
    console.log('Number of "演示操作" elements found:', floatCount);

    if (floatCount > 0) {
      await floatBtn.click();
      console.log('Clicked 演示操作');
      await page.waitForTimeout(1500);
    } else {
      console.log('ERROR: 演示操作 not found');
    }

    // c. select 科室管理员 in drawer
    console.log('=== Step c: select 科室管理员 ===');
    await page.screenshot({ path: '/tmp/screenshot-after-click-demo.png' });

    // Try radio buttons
    const radioCount = await page.locator('input[type="radio"]').count();
    console.log('Number of radio inputs:', radioCount);

    // Try clicking 科室管理员 text
    const deptAdminOptions = await page.locator('text=科室管理员').count();
    console.log('Number of 科室管理员 text matches:', deptAdminOptions);

    if (deptAdminOptions > 0) {
      // Click the one inside the drawer
      await page.locator('.ant-drawer-body >> text=科室管理员').first().click();
      console.log('Clicked 科室管理员');
    }

    // d. wait 1.5s
    await page.waitForTimeout(1500);

    // Look for confirm/save button in drawer
    const confirmBtn = await page.locator('button:has-text("确定"), button:has-text("确认"), button:has-text("切换"), button:has-text("保存")').count();
    console.log('Confirm/save buttons available:', confirmBtn);
    if (confirmBtn > 0) {
      await page.locator('button:has-text("确定"), button:has-text("确认"), button:has-text("切换"), button:has-text("保存")').first().click();
      console.log('Clicked confirm button');
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: '/tmp/screenshot-after-role-switch.png' });

    // e. navigate to resource-center pending tab
    console.log('=== Step e: navigate to /app/resource-center/applies?tab=pending ===');
    await page.goto('http://localhost:3001/app/resource-center/applies?tab=pending', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    console.log('URL after navigation:', page.url());

    // f. wait for table to render
    console.log('=== Step f: wait for table ===');
    try {
      await page.waitForSelector('table tbody tr.ant-table-row', { timeout: 10000 });
    } catch (e) {
      console.log('Table rows selector timeout:', e.message);
    }
    await page.waitForTimeout(2000);

    // g. read table data
    console.log('=== Step g: read table data ===');
    const tableInfo = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr.ant-table-row');
      const rowData = [];
      rows.forEach((row, idx) => {
        const cells = row.querySelectorAll('td');
        const cellTexts = [];
        cells.forEach((cell) => {
          cellTexts.push(cell.innerText.trim().replace(/\s+/g, ' '));
        });
        rowData.push({
          index: idx,
          totalCells: cells.length,
          first3Cols: cellTexts.slice(0, 3),
          lastCol: cellTexts[cellTexts.length - 1],
          allCols: cellTexts,
        });
      });
      return {
        rowCount: rows.length,
        rowData,
      };
    });
    console.log('Row count:', tableInfo.rowCount);
    console.log('Row data:');
    tableInfo.rowData.forEach((row) => {
      console.log(`  Row ${row.index}:`);
      console.log(`    First 3 cols:`, JSON.stringify(row.first3Cols));
      console.log(`    Last col (actions):`, JSON.stringify(row.lastCol));
    });

    // h. screenshot
    console.log('=== Step h: screenshot ===');
    await page.screenshot({ path: '/tmp/screenshot-pending-tab.png', fullPage: true });

    // i. report
    console.log('=== Step i: console messages ===');
    console.log('Total console messages:', consoleMessages.length);
    consoleMessages.slice(0, 50).forEach((m) => console.log('  ', m));
    console.log('Total page errors:', pageErrors.length);
    pageErrors.slice(0, 20).forEach((e) => console.log('  ', e));

    // Summary
    console.log('=== SUMMARY ===');
    const hasAuditButton = tableInfo.rowData.some((r) => r.lastCol.includes('审核') && !r.lastCol.includes('查看详情 撤销'));
    const allHaveReviewActions = tableInfo.rowData.every((r) => r.lastCol.includes('审核'));
    console.log('Row count:', tableInfo.rowCount);
    console.log('Has rows with 审核 button (excluding "查看详情 撤销" pattern):', hasAuditButton);
    console.log('All rows have 审核:', allHaveReviewActions);

  } catch (err) {
    console.error('FATAL ERROR:', err.message);
    console.error(err.stack);
  } finally {
    await browser.close();
  }
})();