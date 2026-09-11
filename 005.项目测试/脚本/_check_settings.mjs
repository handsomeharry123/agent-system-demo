import { chromium } from 'playwright';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

await page.goto('http://localhost:3001/app/home/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

const settings = await page.evaluate(() => localStorage.getItem('demo_settings_v1'));
console.log('=== localStorage demo_settings_v1 ===');
console.log(settings);

const sidebarItems = await page.evaluate(() => {
  const items = Array.from(document.querySelectorAll('.ant-menu-title-content'));
  return items.map(el => el.textContent?.trim());
});
console.log('\n=== 当前侧边栏菜单项 ===');
console.log(sidebarItems);

await browser.close();