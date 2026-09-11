// V4: 验证气泡「订阅速读」点击 → 跳台账中心并打开抽屉
import { chromium } from 'playwright';
import fs from 'fs';

const SHOT_DIR = 'verify_subscribe_route_artefacts';
fs.mkdirSync(SHOT_DIR, { recursive: true });

const failures = [];
const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

page.on('pageerror', (e) => failures.push(`PAGEERROR: ${e.message}`));

await page.addInitScript(() => {
  window.localStorage.setItem('currentUser', JSON.stringify({
    role: 'platform_admin',
    userName: '孙逸仙',
    department: '信息科',
  }));
});

// ============ 直接测试 URL 参数入口 ============
log('直接访问 /app/ledger?openSubscribe=1');
await page.goto('http://localhost:3001/app/ledger?openSubscribe=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// 校验:URL 应已被清理成 /app/ledger(无 query)
const cleanedUrl = page.url();
log(`  清理后 URL: ${cleanedUrl}`);
if (cleanedUrl.includes('openSubscribe')) {
  failures.push(`【URL】未清理 openSubscribe query: ${cleanedUrl}`);
}

// 校验:抽屉存在并打开
const drawerTitle = await page.locator('text=全院台账速读订阅').count();
log(`  抽屉标题「全院台账速读订阅」: ${drawerTitle} (期望 >=1)`);
if (drawerTitle === 0) failures.push('【抽屉】未打开(总览页)');

// 校验:抽屉内显示「订阅设置」Tab 默认内容
const freqTitle = await page.locator('.ant-drawer-body').locator('text=订阅频率').count();
log(`  「订阅频率」区块: ${freqTitle} (期望 1)`);
if (freqTitle === 0) failures.push('【抽屉】订阅设置 Tab 未默认打开');

await page.screenshot({ path: `${SHOT_DIR}/01-overview-open-subscribe.png`, fullPage: false });

// 关闭抽屉
log('关闭抽屉');
await page.locator('.ant-drawer-close').first().click();
await page.waitForTimeout(400);

// 校验:抽屉已关
const drawerClosed = await page.locator('.ant-drawer-mask').count();
log(`  关闭后 mask: ${drawerClosed} (期望 0)`);

// ============ 通过气泡点击入口 ============
log('再次打开总览页(无 query)');
await page.goto('http://localhost:3001/app/ledger', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// 等医小管气泡(欢迎气泡)显示
log('等待医小管气泡出现');
await page.waitForSelector('[data-testid="ledger-bubble-subscribe"]', { timeout: 8000 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${SHOT_DIR}/02-overview-with-bubble.png`, fullPage: false });

// 直接点击气泡里的「订阅速读」按钮(data-testid)
log('点击气泡里的「订阅速读」');
await page.locator('[data-testid="ledger-bubble-subscribe"]').first().click();
await page.waitForTimeout(1000);

// 校验:URL 跳到 /app/ledger(query 应已被清理)
const newUrl = page.url();
log(`  跳转后 URL: ${newUrl}`);
if (!newUrl.includes('/app/ledger')) {
  failures.push(`【路由】未跳到 /app/ledger: ${newUrl}`);
}
if (newUrl.includes('openSubscribe')) {
  failures.push(`【路由】openSubscribe 未清理: ${newUrl}`);
}

// 校验:抽屉打开
const drawerOpen = await page.locator('text=全院台账速读订阅').count();
log(`  抽屉标题「全院台账速读订阅」: ${drawerOpen} (期望 >=1)`);
if (drawerOpen === 0) failures.push('【抽屉】气泡点击后未打开');

// 校验:抽屉内是订阅设置 Tab
const freqTitleBubble = await page.locator('.ant-drawer-body').locator('text=订阅频率').count();
log(`  订阅设置 Tab「订阅频率」区块: ${freqTitleBubble} (期望 1)`);
if (freqTitleBubble === 0) failures.push('【抽屉】订阅设置 Tab 未默认打开');

await page.screenshot({ path: `${SHOT_DIR}/03-after-bubble-click.png`, fullPage: false });

// ============ 总结 ============
log('\n========== 验证总结 ==========');
if (failures.length === 0) {
  log('✅ 全部 PASS');
} else {
  log(`❌ ${failures.length} 处失败:`);
  failures.forEach((f) => log(`   - ${f}`));
}

await browser.close();
process.exit(failures.length > 0 ? 1 : 0);