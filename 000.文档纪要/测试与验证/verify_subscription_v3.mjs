// V3: 验证「历史报告精简 + 全选 + 订阅设置按钮宽度」
import { chromium } from 'playwright';
import fs from 'fs';

const URL = 'http://localhost:3001/app/ledger/list';
const SHOT_DIR = 'verify_subscription_v3_artefacts';
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

log('打开台账列表页');
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

log('点击「订阅速读」按钮');
await page.locator('button:has-text("订阅速读")').first().click();
await page.waitForTimeout(500);

// ============ 订阅设置 Tab:按钮宽度验证 ============
log('【订阅设置】截图 - 验证按钮宽度');
await page.screenshot({ path: `${SHOT_DIR}/01-settings-width.png`, fullPage: false });

const submitBtn = page.locator('button:has-text("立即开启订阅")');
const submitBox = await submitBtn.first().boundingBox();
log(`  立即开启订阅 box: ${JSON.stringify(submitBox)}`);

// 抽屉宽度 680,内 padding 24,按钮可用宽度约 632
// 期望按钮宽度 > 600(占满)
if (!submitBox || submitBox.width < 600) {
  failures.push(`【订阅设置】按钮宽度应 >=600, 实际 ${submitBox?.width}`);
}

// 同时校验按钮左边距 ≈ 抽屉左边距(容器内左对齐占满)
const drawerBox = await page.locator('.ant-drawer-body').first().boundingBox();
log(`  drawer body box: ${JSON.stringify(drawerBox)}`);
if (drawerBox && submitBox) {
  // 按钮左边距应接近 drawer 左边距(允许 30px 内边距)
  const gap = submitBox.x - drawerBox.x;
  log(`  按钮左边距 vs drawer: ${gap} (期望 16-32)`);
  if (gap < 12 || gap > 40) {
    failures.push(`【订阅设置】按钮未贴近 drawer 左边(差 ${gap}px)`);
  }
}

// ============ 切换到历史报告 Tab ============
log('切换到「历史报告」Tab');
await page.locator('div[role="tab"]:has-text("历史报告")').click();
await page.waitForTimeout(500);

await page.screenshot({ path: `${SHOT_DIR}/02-history-simplified.png`, fullPage: false });

// ============ 校验:不再有 Tag(每日/每周/已送达/已查看/推送失败) ============
log('校验:报告名后 Tag 已删除');
const dailyTag = await page.locator('[data-testid="subscription-history"] .ant-tag:has-text("每日")').count();
const weeklyTag = await page.locator('[data-testid="subscription-history"] .ant-tag:has-text("每周")').count();
const deliveredTag = await page.locator('[data-testid="subscription-history"] .ant-tag:has-text("已送达")').count();
const viewedTag = await page.locator('[data-testid="subscription-history"] .ant-tag:has-text("已查看")').count();
const failedTag = await page.locator('[data-testid="subscription-history"] .ant-tag:has-text("推送失败")').count();
log(`  每日:${dailyTag} 每周:${weeklyTag} 已送达:${deliveredTag} 已查看:${viewedTag} 推送失败:${failedTag} (期望全 0)`);
if (dailyTag + weeklyTag + deliveredTag + viewedTag + failedTag > 0) {
  failures.push('【历史报告】仍存在频率/状态 Tag');
}

// ============ 校验:description 已删除 ============
log('校验:description(生成时间/送达时间/高亮列表)已删除');
// 只在 list-item 的 meta 区域查找,排除 actions 区(包含 .ant-list-item-action)
const metaScope = '[data-testid="subscription-history"] .ant-list-item .ant-list-item-meta';
const clockIcon = await page.locator(`${metaScope} .anticon-clock-circle`).count();
const generatedAt = await page.locator(`${metaScope}`).filter({ hasText: '生成 ' }).count();
const highlightsUl = await page.locator(`${metaScope} ul`).count();
const listItemMetaDescription = await page.locator(`${metaScope} .ant-list-item-meta-description`).count();
log(`  clock-circle icon: ${clockIcon}  生成字样: ${generatedAt}  ul: ${highlightsUl}  meta-description: ${listItemMetaDescription} (期望全 0)`);
if (clockIcon + generatedAt + highlightsUl + listItemMetaDescription > 0) {
  failures.push('【历史报告】仍存在 description 内容');
}

// ============ 校验:全选 Checkbox 存在 ============
log('校验:顶部「全选」Checkbox 存在');
const selectAll = page.locator('[data-testid="subscription-history"] label:has-text("全选")').first();
const selectAllExists = (await selectAll.count()) > 0;
log(`  全选 Checkbox 存在: ${selectAllExists}`);
if (!selectAllExists) failures.push('【历史报告】缺少顶部「全选」Checkbox');

// 初始:全选未勾、indeterminate=false
const initialChecked = await selectAll.locator('input').first().isChecked();
log(`  全选 初始勾选: ${initialChecked} (期望 false)`);
if (initialChecked) failures.push('【历史报告】初始全选不应已勾');

// ============ 测试全选/全不选 ============
log('点击全选');
// 点击全选 Checkbox 的 input(input 在 antd Checkbox 内部)
await selectAll.locator('input').first().click();
await page.waitForTimeout(300);

// 校验:所有报告 Checkbox 都被勾上
const itemCheckboxes = page.locator('[data-testid="subscription-history"] .ant-list-item .ant-checkbox-input');
const itemTotal = await itemCheckboxes.count();
log(`  List 项数: ${itemTotal}`);
let allChecked = true;
for (let i = 0; i < itemTotal; i++) {
  if (!(await itemCheckboxes.nth(i).isChecked())) {
    allChecked = false;
    break;
  }
}
log(`  全选后所有项勾选: ${allChecked} (期望 true)`);
if (!allChecked) failures.push('【历史报告】点击全选后未全选');

// 顶部「全选」checkbox 应为 checked 状态
const checkedAfterAll = await selectAll.locator('input').first().isChecked();
log(`  全选 checkbox 自身: ${checkedAfterAll} (期望 true)`);
if (!checkedAfterAll) failures.push('【历史报告】全选后顶部 Checkbox 未变 checked');

await page.screenshot({ path: `${SHOT_DIR}/03-history-all-selected.png`, fullPage: false });

// 批量导出按钮应启用
const exportBtn = page.locator('[data-testid="subscription-history"] button:has-text("批量导出")');
const exportEnabled = !(await exportBtn.first().isDisabled());
log(`  批量导出 启用: ${exportEnabled}`);
if (!exportEnabled) failures.push('【历史报告】全选后批量导出应启用');

// ============ 取消勾选一项 → 顶部 indeterminate ============
log('取消第一项 → 顶部应 indeterminate');
await itemCheckboxes.first().click({ force: true });
await page.waitForTimeout(300);

const indeterminateClass = await selectAll.locator('.ant-checkbox').first().getAttribute('class');
log(`  顶部 checkbox class: ${indeterminateClass}`);
if (!indeterminateClass.includes('ant-checkbox-indeterminate')) {
  failures.push('【历史报告】部分选中时顶部应 indeterminate');
}

// ============ 再次点击全选 → 从 indeterminate 转全选 ============
log('再次点击全选 → indeterminate 应转为全选(6/6)');
await selectAll.locator('input').first().click();
await page.waitForTimeout(300);

let allRechecked = true;
for (let i = 0; i < itemTotal; i++) {
  if (!(await itemCheckboxes.nth(i).isChecked())) {
    allRechecked = false;
    break;
  }
}
log(`  indeterminate→全选 后所有项勾选: ${allRechecked} (期望 true)`);
if (!allRechecked) failures.push('【历史报告】indeterminate 时点全选应转为全选');

const topAfterRecheck = await selectAll.locator('input').first().isChecked();
log(`  全选 checkbox: ${topAfterRecheck} (期望 true)`);
if (!topAfterRecheck) failures.push('【历史报告】全选后顶部 Checkbox 应 checked');

// 此时已是「全选」状态,再点一次 → 全部取消(这才走 toggle 反向)
log('再次(第三次)点全选 → 应全不选(因为已是全选)');
await selectAll.locator('input').first().click();
await page.waitForTimeout(300);

let noneChecked = true;
for (let i = 0; i < itemTotal; i++) {
  if (await itemCheckboxes.nth(i).isChecked()) {
    noneChecked = false;
    break;
  }
}
log(`  第三次点后全部取消: ${noneChecked} (期望 true)`);
if (!noneChecked) failures.push('【历史报告】已全选状态再点应全不选');

const checkedAfterAllNone = await selectAll.locator('input').first().isChecked();
log(`  顶部 checkbox: ${checkedAfterAllNone} (期望 false)`);
if (checkedAfterAllNone) failures.push('【历史报告】全不选后顶部 Checkbox 应 unchecked');

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