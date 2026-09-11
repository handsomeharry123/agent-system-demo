// V1: 验证「全院台账速读订阅」抽屉改造
// 1. 订阅设置 Tab: 无订阅范围 / 无推送通道
// 2. 历史报告 Tab: 无通道 / 多选 Checkbox + 批量导出 / icon 统一蓝
import { chromium } from 'playwright';
import fs from 'fs';

const URL = 'http://localhost:3001/app/ledger/list';
const SHOT_DIR = 'verify_subscription_v1_artefacts';
fs.mkdirSync(SHOT_DIR, { recursive: true });

const failures = [];
const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

page.on('pageerror', (e) => failures.push(`PAGEERROR: ${e.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') failures.push(`CONSOLE.ERROR: ${msg.text()}`);
});

// 设为管理员(platform_admin)
await page.addInitScript(() => {
  window.localStorage.setItem('currentUser', JSON.stringify({
    role: 'platform_admin',
    userName: '孙逸仙',
    department: '信息科',
  }));
});

log('打开台账列表页');
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// 找到速读订阅按钮(铃铛图标 + 「订阅速读」文字)
log('点击「订阅速读」按钮');
const subBtn = page.locator('button:has-text("订阅速读")').first();
await subBtn.click();
await page.waitForTimeout(500);

// ============ 订阅设置 Tab 验证 ============
log('【订阅设置 Tab】截图 1');
await page.screenshot({ path: `${SHOT_DIR}/01-settings-tab.png`, fullPage: false });

// 校验: 无「订阅范围」
const scopeTitle = await page.locator('text=订阅范围').count();
if (scopeTitle > 0) failures.push('【订阅设置】仍存在「订阅范围」区块');
log(`  订阅范围 区块数: ${scopeTitle} (期望 0)`);

// 校验: 无「推送通道」
const channelTitle = await page.locator('text=推送通道').count();
if (channelTitle > 0) failures.push('【订阅设置】仍存在「推送通道」区块');
log(`  推送通道 区块数: ${channelTitle} (期望 0)`);

// 校验: 订阅频率 + 立即开启订阅 仍在
const freqTitle = await page.locator('text=订阅频率').count();
if (freqTitle === 0) failures.push('【订阅设置】缺少「订阅频率」区块');
log(`  订阅频率 区块数: ${freqTitle} (期望 1)`);

const dailyBtn = await page.locator('button:has-text("每日速读")').count();
if (dailyBtn === 0) failures.push('【订阅设置】缺少「每日速读」按钮');
log(`  每日速读 按钮: ${dailyBtn}`);

const submitBtn = await page.locator('button:has-text("立即开启订阅")').count();
if (submitBtn === 0) failures.push('【订阅设置】缺少「立即开启订阅」按钮');
log(`  立即开启订阅 按钮: ${submitBtn}`);

// ============ 切换到历史报告 Tab ============
log('切换到「历史报告」Tab');
await page.locator('div[role="tab"]:has-text("历史报告")').click();
await page.waitForTimeout(500);

log('【历史报告 Tab】截图 2');
await page.screenshot({ path: `${SHOT_DIR}/02-history-tab.png`, fullPage: false });

// 校验: 通道 已删除(无 "通道：" 字样)
const channelLabel = await page.locator('text=通道：').count();
if (channelLabel > 0) failures.push('【历史报告】仍存在「通道：」展示');
log(`  通道: 字样数: ${channelLabel} (期望 0)`);

// 校验: 多选 Checkbox 存在
const checkboxCount = await page.locator('[data-testid="subscription-history"] .ant-checkbox-input').count();
log(`  Checkbox 数: ${checkboxCount} (期望 ${await page.locator('[data-testid="subscription-history"] .ant-list-item').count()})`);
if (checkboxCount === 0) failures.push('【历史报告】缺少 Checkbox 多选');

// 校验: 批量导出按钮存在且未选中时 disabled
const exportBtn = page.locator('button:has-text("批量导出")');
const exportCount = await exportBtn.count();
log(`  批量导出 按钮: ${exportCount}`);
if (exportCount === 0) failures.push('【历史报告】缺少「批量导出」按钮');

const isDisabledInit = await exportBtn.first().isDisabled();
log(`  初始 disabled: ${isDisabledInit} (期望 true)`);
if (!isDisabledInit) failures.push('【历史报告】「批量导出」按钮初始应 disabled');

// ============ 测试多选 + 批量导出 ============
log('勾选前 3 条报告');
const checkboxes = page.locator('[data-testid="subscription-history"] .ant-checkbox-input');
const totalCb = await checkboxes.count();
for (let i = 0; i < Math.min(3, totalCb); i++) {
  await checkboxes.nth(i).click({ force: true });
}
await page.waitForTimeout(300);

const isDisabledAfter = await exportBtn.first().isDisabled();
log(`  勾选 3 条后 disabled: ${isDisabledAfter} (期望 false)`);
if (isDisabledAfter) failures.push('【历史报告】勾选后「批量导出」仍 disabled');

await page.screenshot({ path: `${SHOT_DIR}/03-history-3-selected.png`, fullPage: false });

// 点击批量导出
log('点击「批量导出」');
await exportBtn.first().click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${SHOT_DIR}/04-after-export.png`, fullPage: false });

// 校验: 导出后 message 弹出 + 选中清空(批量导出 disabled 应回到 true)
const isDisabledAfterExport = await exportBtn.first().isDisabled();
log(`  导出后 disabled: ${isDisabledAfterExport} (期望 true 已清空)`);
if (!isDisabledAfterExport) failures.push('【历史报告】导出后选中未清空,批量导出仍可点');

// ============ icon 颜色统一蓝 ============
// 报告名前 FileTextOutlined 颜色都应是 #1677FF
log('校验: 报告名称前 icon 颜色统一 #1677FF');
const iconColors = await page.locator('[data-testid="subscription-history"] .ant-list-item-meta-title .anticon-file-text').evaluateAll(
  (els) => els.map((e) => e.style.color || getComputedStyle(e).color),
);
log(`  icon 颜色列表: ${JSON.stringify(iconColors)}`);
const allBlue = iconColors.every((c) => c === 'rgb(22, 119, 255)' || c === '#1677FF');
if (!allBlue) failures.push(`【历史报告】icon 颜色未统一蓝: ${JSON.stringify(iconColors)}`);

// ============ 报告名称后标签(每日/每周, 已送达/已查看/推送失败) ============
log('校验: 报告名称后标签(每日/每周 + 状态 Tag)保留');
const dailyTag = await page.locator('[data-testid="subscription-history"] .ant-tag:has-text("每日")').count();
const weeklyTag = await page.locator('[data-testid="subscription-history"] .ant-tag:has-text("每周")').count();
const deliveredTag = await page.locator('[data-testid="subscription-history"] .ant-tag:has-text("已送达")').count();
const failedTag = await page.locator('[data-testid="subscription-history"] .ant-tag:has-text("推送失败")').count();
log(`  每日:${dailyTag} 每周:${weeklyTag} 已送达:${deliveredTag} 推送失败:${failedTag}`);
if (dailyTag + weeklyTag === 0) failures.push('【历史报告】报告名后无频率 Tag');
if (deliveredTag + failedTag === 0) failures.push('【历史报告】报告名后无状态 Tag');

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