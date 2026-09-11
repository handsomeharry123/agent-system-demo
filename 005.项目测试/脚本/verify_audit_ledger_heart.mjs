import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto(`${BASE}/app/login?role=admin`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.goto(`${BASE}/app/agent-center?tab=审核通过`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

// Find the row with '心电图智能辅助诊断' and click its 查看台账 button
const rowInfo = await page.evaluate(() => {
  const trs = Array.from(document.querySelectorAll('.ant-table-tbody > tr.ant-table-row'));
  return trs.map((row, idx) => {
    const cells = row.querySelectorAll('td');
    const code = cells[1]?.querySelector('button')?.innerText.trim() || cells[1]?.innerText.trim();
    const name = cells[2]?.querySelector('button')?.innerText.trim() || cells[2]?.innerText.trim();
    return { idx, code, name };
  });
});
console.log('Rows:', JSON.stringify(rowInfo, null, 2));

// Find row with '心电图'
const heartRow = rowInfo.find(r => r.name && r.name.includes('心电图'));
console.log('Heart row:', heartRow);

// Click the 查看台账 in the heart row
const allBtns = await page.locator('button:has-text("查看台账")').all();
console.log('Total 查看台账 buttons:', allBtns.length);

if (heartRow) {
  await allBtns[heartRow.idx].click();
  await page.waitForTimeout(3500);
  console.log('Final URL:', page.url());
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 800));
  console.log('Body text:', bodyText.replace(/\n/g, ' | ').substring(0, 600));
  await page.screenshot({ path: '/tmp/test_c2_heart_click.png', fullPage: true });
}

await browser.close();
