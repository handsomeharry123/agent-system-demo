import { chromium } from 'playwright';
import fs from 'fs';

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

// 1. Visit the indicators page
console.log('=== Navigating to /app/evaluation/indicators ===');
await page.goto('http://localhost:3001/app/evaluation/indicators', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500);

// 2. Check URL
const currentUrl = page.url();
console.log('Current URL:', currentUrl);

// 3. Check PageHeader title (custom PageHeader uses Typography Title level=4)
await page.waitForSelector('h4.ant-typography', { timeout: 15000 });
const pageHeaderTitle = await page.locator('h4.ant-typography').first().textContent();
console.log('PageHeader title:', pageHeaderTitle);
// The subTitle is the SECOND ant-typography-secondary (first is the role badge in topbar)
const subTitleEls = await page.locator('span.ant-typography.ant-typography-secondary').allTextContents();
console.log('PageHeader subTitle candidates:', subTitleEls);
const pageHeaderSub = subTitleEls.find(s => s.includes('智能体安全评测规范')) || subTitleEls[1] || null;
console.log('PageHeader subTitle selected:', pageHeaderSub);

// 4. Check sidebar menu text
const sidebarMenuItem = page.locator('.ant-menu-item:has-text("指标展示")');
const sidebarMenuText = await sidebarMenuItem.first().textContent().catch(() => null);
console.log('Sidebar menu text:', sidebarMenuText);

const sidebarListMenu = page.locator('.ant-menu-item:has-text("指标列表")');
const sidebarListCount = await sidebarListMenu.count();
console.log('Sidebar has "指标列表" count (expect 0):', sidebarListCount);

// 5. Verify top-right buttons
const ruleBtn = await page.locator('button:has-text("查看评分规则")').count();
const tasksBtn = await page.locator('button:has-text("前往任务管理")').count();
console.log('查看评分规则 buttons:', ruleBtn, '前往任务管理 buttons:', tasksBtn);

// 6. Verify the rule summary Card key text
const summaryCard = await page.locator('.ant-card:has-text("评分规则概要")').first();
const summaryExists = await summaryCard.count();
console.log('Summary card count:', summaryExists);
const lowRisk = await summaryCard.locator('text=低风险').count();
const midRisk = await summaryCard.locator('text=中等风险').count();
const highRisk = await summaryCard.locator('text=高风险').count();
const redLine = await summaryCard.locator('text=评测红线').count();
const woodBarrel = await summaryCard.locator('text=木桶原理').count();
const viewFullRule = await page.locator('button:has-text("查看完整评分规则")').count();
console.log('Summary text: 低风险=', lowRisk, '中等风险=', midRisk, '高风险=', highRisk, '评测红线=', redLine, '木桶原理=', woodBarrel, '查看完整评分规则=', viewFullRule);

// 7. Take main screenshot
await page.screenshot({ path: '/tmp/indicators_main.png', fullPage: false });

// 7b. Click 「查看评分规则」button (top-right extra) and capture Modal
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
await page.locator('button:has-text("查看评分规则")').first().click();
await page.waitForSelector('.ant-modal-content', { timeout: 5000 });
await page.waitForTimeout(500);
const modalTitleText = await page.locator('.ant-modal-title').first().textContent();
console.log('Modal title:', modalTitleText);
const modalBodyText = await page.locator('.ant-modal-body').first().textContent();
console.log('Modal body length:', modalBodyText ? modalBodyText.length : 0);
await page.screenshot({ path: '/tmp/indicators_modal.png', fullPage: false });
// close modal
await page.locator('.ant-modal-close').first().click();
await page.waitForTimeout(500);

// 7c. Click 「前往任务管理」button (top-right extra) and capture navigation
await page.locator('button:has-text("前往任务管理")').first().click();
await page.waitForURL(/\/app\/evaluation\/tasks/, { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(1500);
const tasksPageUrl = page.url();
console.log('After 「前往任务管理」button click, URL:', tasksPageUrl);
await page.screenshot({ path: '/tmp/indicators_tasks_nav.png', fullPage: false });
// go back to indicators
await page.goto('http://localhost:3001/app/evaluation/indicators', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// 8. Scroll down to see all 5 rows
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/indicators_scrolled.png', fullPage: true });

// 9. Take sidebar crop
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
const sidebar = page.locator('.ant-layout-sider').first();
await sidebar.screenshot({ path: '/tmp/indicators_sidebar.png' });

// 10. Check table dimensions count
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);
// Click the "指标列表" Card title to scroll into view
const tableCard = page.locator('.ant-card:has-text("指标列表")').last();
await tableCard.scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
const dimTags = await page.locator('.ant-card:has-text("指标列表") tbody .ant-tag').allTextContents();
console.log('Table dimension tags (unique):', [...new Set(dimTags)]);

// 11. Test tab switching - try clicking on a sidebar item that navigates away
// Click on 评测任务管理 menu item
const taskMgmt = page.locator('.ant-menu-item:has-text("评测任务管理")').first();
const taskMgmtExists = await taskMgmt.count();
console.log('评测任务管理 menu item count:', taskMgmtExists);
if (taskMgmtExists > 0) {
  await taskMgmt.click();
  await page.waitForTimeout(2000);
  const urlAfter = page.url();
  console.log('After clicking 评测任务管理, URL:', urlAfter);
  await page.screenshot({ path: '/tmp/indicators_after_tab.png' });
  // Go back to indicators
  await page.goto('http://localhost:3001/app/evaluation/indicators', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
}

// 12. Check data collection management tab
const dataColl = page.locator('.ant-menu-item:has-text("数据采集管理")').first();
const dataCollExists = await dataColl.count();
console.log('数据采集管理 menu item count:', dataCollExists);
if (dataCollExists > 0) {
  await dataColl.click();
  await page.waitForTimeout(2000);
  const urlAfter2 = page.url();
  console.log('After clicking 数据采集管理, URL:', urlAfter2);
  await page.screenshot({ path: '/tmp/indicators_after_data_tab.png' });
}

console.log('\n=== Errors collected ===');
console.log(JSON.stringify(errors, null, 2));

await browser.close();
console.log('\ndone');
