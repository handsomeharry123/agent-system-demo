import { chromium } from 'playwright';

const errors = [];
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();

page.on('pageerror', (e) => { console.log('[pageerror]', e.message); errors.push(e.message); });
page.on('console', (m) => {
  if (m.type() === 'error') {
    console.log('[console.error]', m.text());
    errors.push(m.text());
  }
});
page.on('response', (r) => {
  if (r.status() >= 400) {
    console.log('[HTTP', r.status(), ']', r.url());
    errors.push(`HTTP ${r.status()} ${r.url()}`);
  }
});

// 1. Visit the indicators page (admin can see the IT-admin-only menu item)
console.log('=== Navigating to /app/evaluation/indicators ===');
await page.goto('http://localhost:3001/app/evaluation/indicators', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500);

// 2. Check PageHeader title
await page.waitForSelector('h4.ant-typography', { timeout: 15000 });
const pageHeaderTitle = await page.locator('h4.ant-typography').first().textContent();
console.log('PageHeader title:', pageHeaderTitle);

// 3. Check sidebar — should be 指标列表, not 指标展示
const oldMenu = await page.locator('.ant-menu-item:has-text("指标展示")').count();
const newMenu = await page.locator('.ant-menu-item:has-text("指标列表")').count();
console.log('Sidebar "指标展示" count (expect 0):', oldMenu);
console.log('Sidebar "指标列表" count (expect ≥1):', newMenu);

// 4. Find the 指标列表 table card and inspect headers
const tableCard = page.locator('.ant-card:has-text("指标列表")').last();
await tableCard.scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
const headerCells = await tableCard.locator('thead th').allTextContents();
console.log('Table headers:', headerCells);

// 5. Count data rows
const rowCount = await tableCard.locator('tbody tr.ant-table-row').count();
console.log('Table data row count (expect 5):', rowCount);

// 6. Each row should have 3 risk tags (高/中/低)
const firstRow = tableCard.locator('tbody tr.ant-table-row').first();
const riskTags = await firstRow.locator('.ant-tag').allTextContents();
console.log('First row tag texts (expect 4: 1 dimension + 3 risk):', riskTags);

// 7. Hover the high-risk tag and check tooltip
const highTag = firstRow.locator('.ant-tag', { hasText: 'ASR ≥ 10%' });
const highTagExists = await highTag.count();
console.log('First row 高风险 ASR ≥ 10% tag count:', highTagExists);
if (highTagExists > 0) {
  await highTag.first().hover();
  await page.waitForTimeout(800);
  const tooltipText = await page.locator('.ant-tooltip-inner').first().textContent().catch(() => null);
  console.log('Tooltip text:', tooltipText);
  await page.screenshot({ path: '/tmp/indicators_tooltip.png' });
}

// 8. Screenshot main page
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/indicators_v2_main.png', fullPage: false });

// 9. Screenshot the table card
await tableCard.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await tableCard.screenshot({ path: '/tmp/indicators_v2_table.png' });

// 10. Check each row's 3 risk tags (高/中/低)
const allRows = await tableCard.locator('tbody tr.ant-table-row').all();
for (let i = 0; i < allRows.length; i++) {
  const tags = await allRows[i].locator('.ant-tag').allTextContents();
  console.log(`Row ${i + 1} tags:`, tags);
}

// 11. Sidebar crop
const sidebar = page.locator('.ant-layout-sider').first();
await sidebar.screenshot({ path: '/tmp/indicators_v2_sidebar.png' });

console.log('\n=== Errors collected ===');
console.log(JSON.stringify(errors, null, 2));

await browser.close();
console.log('\ndone');
