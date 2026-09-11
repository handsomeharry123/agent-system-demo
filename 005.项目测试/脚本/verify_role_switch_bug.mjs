// verify_role_switch_bug.mjs — 验证角色切换 bug
import { chromium } from 'playwright';

const URL_BASE = 'http://localhost:3001';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('[browser-error]', msg.text());
  });
  page.on('pageerror', (err) => console.log('[page-error]', err.message));

  try {
    console.log('=== step 1: open /app/resource-center/applies first (BasicLayout carries DemoFloatButton) ===');
    await page.goto(`${URL_BASE}/app/resource-center/applies?tab=pending`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    console.log('url:', page.url());

    // Try to dismiss any "demo mode" or "got it" banners by looking for common antd modal close buttons
    // Then find the demo float button (右下角"演示操作")
    console.log('=== step 2: click demo float button ===');
    // The float button has aria-label or text in tooltip; click by tooltip text near bottom-right
    // Use a force click on the FloatButton root which is an .ant-float-btn element
    const floatBtn = page.locator('.ant-float-btn').first();
    await floatBtn.waitFor({ state: 'visible', timeout: 8000 });
    await floatBtn.click();
    await page.waitForTimeout(800);

    // The Drawer has a Select for "演示角色"
    console.log('=== step 3: select 科室管理员 in demo role Select ===');
    const drawer = page.locator('.ant-drawer-content').first();
    await drawer.waitFor({ state: 'visible', timeout: 5000 });

    // Click on the role Select (it's the first Select inside the drawer, after "演示角色" label)
    const roleSelect = drawer.locator('.ant-select').first();
    await roleSelect.click();
    await page.waitForTimeout(500);

    // Select option "科室管理员（李秀英）"
    const option = page.locator('.ant-select-item-option').filter({ hasText: '科室管理员' }).first();
    await option.waitFor({ state: 'visible', timeout: 5000 });
    await option.click();
    console.log('selected 科室管理员');
    await page.waitForTimeout(1200);

    // Close the drawer (optional but cleaner)
    const closeBtn = drawer.locator('.ant-drawer-close').first();
    if (await closeBtn.count()) {
      await closeBtn.click().catch(() => {});
      await page.waitForTimeout(400);
    }

    console.log('=== step 4: navigate back to /app/resource-center/applies?tab=pending to re-render with new role ===');
    await page.goto(`${URL_BASE}/app/resource-center/applies?tab=pending`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    // Wait for table to render
    await page.waitForSelector('table tbody tr', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2500);

    console.log('=== step 5: read DOM & mock store ===');

    // 1) total cell count, row count
    const tableStats = await page.evaluate(() => {
      const cells = document.querySelectorAll('table tbody tr .ant-table-cell');
      const rows = document.querySelectorAll('table tbody tr');
      // Try to extract each row's action column text. AntD usually puts operation column last.
      // We can detect column count from header and take last cell per row.
      const headers = Array.from(
        document.querySelectorAll('table thead th.ant-table-cell'),
      ).map((th) => (th.textContent || '').trim());
      const lastColIdx = headers.length - 1;

      const rowActionTexts = [];
      rows.forEach((tr, idx) => {
        const tds = tr.querySelectorAll('td.ant-table-cell');
        if (tds.length === 0) return;
        const actionTd = tds[tds.length - 1];
        // include buttons + text in cell
        const text = (actionTd.innerText || actionTd.textContent || '').replace(/\s+/g, ' ').trim();
        rowActionTexts.push({ row: idx + 1, text });
      });

      return {
        cellCount: cells.length,
        rowCount: rows.length,
        headers,
        rowActionTexts,
        currentUrl: location.href,
      };
    });

    console.log('--- table stats ---');
    console.log('url:', tableStats.currentUrl);
    console.log('headers:', JSON.stringify(tableStats.headers, null, 2));
    console.log('rowCount:', tableStats.rowCount);
    console.log('cellCount:', tableStats.cellCount);
    console.log('rowActionTexts:', JSON.stringify(tableStats.rowActionTexts, null, 2));

    // 2) Read the demo role + user displayed in the visible UI:
    //    - Drawer Tag color: orange = 信息科管理员, cyan = 科室管理员
    //    - Drawer Tag text: 当前角色 + 以 X 的身份查看
    //    - FloatButton badge text: 管 / 科
    // Also try to import /src/mock/resource-center.ts dynamically; getDemoRole/getCurrentUser
    // are not exported (they're module-internal closures) but we can probe via the exported
    // useDemoRole/useCurrentUser hooks via React. We'll instead inspect the rendered DOM as
    // ground truth (this is what the user sees).
    const mockProbe = await page.evaluate(async () => {
      const out = { drawerHeader: '', floatBadge: '', headerIdentityTag: '', bannerIdentity: '' };
      // Re-open the drawer if it's closed
      const fb = document.querySelector('.ant-float-btn');
      out.floatBadge = fb ? (fb.textContent || '').replace(/\s+/g, ' ').trim() : '';

      const drawer = document.querySelector('.ant-drawer-content');
      if (drawer) {
        out.drawerHeader = (drawer.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500);
      }

      // Try to import the module and inspect its EXPORTED hooks via React. Since the page is
      // already running, we can't call hooks, but we can confirm the module shape.
      try {
        const mod = await import('/src/mock/resource-center.ts');
        out.moduleExports = Object.keys(mod).filter((k) => /role|user/i.test(k)).sort();
        out.useDemoRoleExists = typeof mod.useDemoRole === 'function';
        out.useCurrentUserExists = typeof mod.useCurrentUser === 'function';
        // The internal getters are NOT exported — confirm that explicitly.
        out.getDemoRoleExported = typeof mod.getDemoRole === 'function';
        out.getCurrentUserExported = typeof mod.getCurrentUser === 'function';
      } catch (e) {
        out.importError = String(e);
      }
      return out;
    });

    // Also re-open the drawer and capture the role Tag + identity Tag + user name from the banner
    const bannerProbe = await page.evaluate(async () => {
      // Click float button to re-open drawer
      const fb = document.querySelector('.ant-float-btn');
      if (fb) fb.click();
      await new Promise((r) => setTimeout(r, 600));
      const drawer = document.querySelector('.ant-drawer-content');
      if (!drawer) return { open: false };
      const tags = Array.from(drawer.querySelectorAll('.ant-tag')).map((t) => (t.textContent || '').trim());
      const selects = Array.from(drawer.querySelectorAll('.ant-select-selection-item')).map((t) => (t.textContent || '').trim());
      const banner = drawer.querySelector('div[style*="f0f5ff"], div[style*="background: rgb(240, 245, 255)"]');
      const bannerText = banner ? (banner.textContent || '').replace(/\s+/g, ' ').trim() : '';
      // close drawer
      const close = drawer.querySelector('.ant-drawer-close');
      if (close) close.click();
      return { open: true, tags, selects, bannerText };
    });

    console.log('--- mock store probe ---');
    console.log(JSON.stringify(mockProbe, null, 2));
    console.log('--- banner probe (drawer re-opened) ---');
    console.log(JSON.stringify(bannerProbe, null, 2));

    // Also screenshot for visual confirmation
    await page.screenshot({ path: '/Users/harry/Desktop/CC_TEST/agent-system/verify_role_switch_bug.png', fullPage: true });
    console.log('screenshot saved to verify_role_switch_bug.png');

    // 3) Read the actual mock store by subscribing to the exported hooks via a tiny
    //    side-channel. Since React hooks can't be called outside a component, we
    //    attach a state-capture by listening to the FloatButton badge mutation
    //    and inspecting the Drawer Tags — the source of truth is `useDemoRole()`
    //    which feeds both. Plus we can read the AntD `notification` static store
    //    indirectly. To make this rock-solid, we also poke the exported setter
    //    `setDemoRole` indirectly through DOM: read what the Select's current
    //    value resolves to via the ant-tag role text "科室管理员" / "信息科管理员".

    // 4) Strongest probe: read the **rendered applies page owner column** if any.
    //    Applies page renders the smart-agent owner / applicant via mock store.
    const applicantProbe = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      const out = [];
      rows.forEach((tr, idx) => {
        const tds = tr.querySelectorAll('td.ant-table-cell');
        out.push({
          row: idx + 1,
          cells: Array.from(tds).map((td) => (td.innerText || td.textContent || '').replace(/\s+/g, ' ').trim()),
        });
      });
      return out;
    });

    console.log('--- applicant probe (full row cells) ---');
    console.log(JSON.stringify(applicantProbe, null, 2));
  } catch (err) {
    console.log('FATAL:', err.message);
    console.log(err.stack);
    await page.screenshot({ path: '/Users/harry/Desktop/CC_TEST/agent-system/verify_role_switch_bug_err.png', fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }
})();