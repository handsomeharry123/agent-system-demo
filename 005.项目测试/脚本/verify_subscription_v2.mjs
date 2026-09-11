// V2: 验证「订阅频率」多选 + 周几选择器
import { chromium } from 'playwright';
import fs from 'fs';

const URL = 'http://localhost:3001/app/ledger/list';
const SHOT_DIR = 'verify_subscription_v2_artefacts';
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

// ============ 初始状态:仅「每日速读」选中 ============
log('【订阅设置 Tab - 初始状态】截图');
await page.screenshot({ path: `${SHOT_DIR}/01-init-only-daily.png`, fullPage: false });

// 校验: 出现「每日速读」「每周速读」两个 Checkbox
const dailyCheckbox = await page.locator('label:has-text("每日速读") input[type="checkbox"]').count();
const weeklyCheckbox = await page.locator('label:has-text("每周速读") input[type="checkbox"]').count();
log(`  每日速读 Checkbox: ${dailyCheckbox} 每周速读 Checkbox: ${weeklyCheckbox}`);
if (dailyCheckbox === 0) failures.push('缺少「每日速读」Checkbox');
if (weeklyCheckbox === 0) failures.push('缺少「每周速读」Checkbox');

// 默认每日选中
const dailyChecked = await page.locator('label:has-text("每日速读") input[type="checkbox"]').first().isChecked();
const weeklyCheckedInit = await page.locator('label:has-text("每周速读") input[type="checkbox"]').first().isChecked();
log(`  默认 每日:${dailyChecked} 每周:${weeklyCheckedInit}`);
if (!dailyChecked) failures.push('默认「每日速读」应已选中');
if (weeklyCheckedInit) failures.push('默认「每周速读」应未选中');

// 未勾选每周时,不显示「每周推送日」
const weeklyDayPickerInit = await page.locator('[data-testid="weekly-day-picker"]').count();
log(`  每周推送日 区块(未勾每周): ${weeklyDayPickerInit} (期望 0)`);
if (weeklyDayPickerInit !== 0) failures.push('未勾「每周速读」时不应显示周几选择器');

// ============ 勾选「每周速读」 ============
log('勾选「每周速读」');
await page.locator('label:has-text("每周速读")').first().click();
await page.waitForTimeout(300);

await page.screenshot({ path: `${SHOT_DIR}/02-weekly-checked.png`, fullPage: false });

// 校验: 周几选择器出现
const weeklyDayPicker = await page.locator('[data-testid="weekly-day-picker"]').count();
log(`  每周推送日 区块: ${weeklyDayPicker} (期望 1)`);
if (weeklyDayPicker === 0) failures.push('勾选「每周速读」后未显示周几选择器');

// 校验: 周一~周日 7 个 Checkbox
const weekDayChecks = await page.locator('[data-testid="weekly-day-picker"] .ant-checkbox-wrapper').count();
log(`  周几 Checkbox 数: ${weekDayChecks} (期望 7)`);
if (weekDayChecks !== 7) failures.push(`周几 Checkbox 数应为 7, 实际 ${weekDayChecks}`);

// 默认周一选中
const monChecked = await page.locator('[data-testid="weekly-day-picker"] label:has-text("周一") input').first().isChecked();
log(`  周一 默认选中: ${monChecked}`);
if (!monChecked) failures.push('默认周一应已选中');

// ============ 测试同时配置每日 + 每周 + 多选周几 ============
log('勾选周三、周五、周日');
await page.locator('[data-testid="weekly-day-picker"] label:has-text("周三")').first().click();
await page.locator('[data-testid="weekly-day-picker"] label:has-text("周五")').first().click();
await page.locator('[data-testid="weekly-day-picker"] label:has-text("周日")').first().click();
await page.waitForTimeout(300);

await page.screenshot({ path: `${SHOT_DIR}/03-both-freq-and-days.png`, fullPage: false });

// 校验: 4 个周几选中(一/三/五/日)
const monC = await page.locator('[data-testid="weekly-day-picker"] label:has-text("周一") input').first().isChecked();
const tueC = await page.locator('[data-testid="weekly-day-picker"] label:has-text("周二") input').first().isChecked();
const wedC = await page.locator('[data-testid="weekly-day-picker"] label:has-text("周三") input').first().isChecked();
const friC = await page.locator('[data-testid="weekly-day-picker"] label:has-text("周五") input').first().isChecked();
const sunC = await page.locator('[data-testid="weekly-day-picker"] label:has-text("周日") input').first().isChecked();
log(`  周一:${monC} 周二:${tueC} 周三:${wedC} 周五:${friC} 周日:${sunC}`);
if (!monC || tueC || !wedC || !friC || !sunC) {
  failures.push(`周几勾选状态不对: 一${monC}/二${tueC}/三${wedC}/五${friC}/日${sunC}`);
}

// 校验: 每日速读 + 每周速读 同时为选中
const dailyC2 = await page.locator('label:has-text("每日速读") input').first().isChecked();
const weeklyC2 = await page.locator('label:has-text("每周速读") input').first().isChecked();
log(`  每日:${dailyC2} 每周:${weeklyC2} (期望都 true)`);
if (!dailyC2 || !weeklyC2) failures.push('每日 + 每周 应同时选中');

// 校验: 立即开启订阅按钮启用
const submitBtn = page.locator('button:has-text("立即开启订阅")');
const submitEnabled = !(await submitBtn.first().isDisabled());
log(`  立即开启订阅 启用: ${submitEnabled}`);
if (!submitEnabled) failures.push('配置完整后按钮应启用');

// ============ 点击开启 ============
log('点击「立即开启订阅」');
await submitBtn.first().click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${SHOT_DIR}/04-after-submit.png`, fullPage: false });

// 校验: message 包含「每日 + 每周一/周三/周五/周日」
const successText = await page.locator('.ant-message-notice-content').first().textContent().catch(() => '');
log(`  成功提示: ${successText}`);
if (!successText.includes('每日')) failures.push('成功提示缺少「每日」');
if (!successText.includes('每周')) failures.push('成功提示缺少「每周」');
if (!successText.includes('周一') || !successText.includes('周三') || !successText.includes('周五') || !successText.includes('周日')) {
  failures.push(`成功提示缺少周几: ${successText}`);
}

// ============ 边界:取消「每周速读」→ 周几选择器消失 ============
log('再次打开抽屉,取消「每周速读」,校验周几选择器隐藏');
await page.locator('button:has-text("订阅速读")').first().click();
await page.waitForTimeout(500);

await page.locator('label:has-text("每周速读")').first().click();
await page.waitForTimeout(200);

const pickerAfterUncheck = await page.locator('[data-testid="weekly-day-picker"]').count();
log(`  取消每周后 周几选择器: ${pickerAfterUncheck} (期望 0)`);
if (pickerAfterUncheck !== 0) failures.push('取消每周速读后周几选择器未隐藏');

// ============ 边界:取消「每日速读」→ 按钮禁用 ============
log('再勾回每周,再取消每日,校验按钮 disabled');
await page.locator('label:has-text("每周速读")').first().click();
await page.waitForTimeout(200);

await page.locator('label:has-text("每日速读")').first().click();
await page.waitForTimeout(200);

const submitDisabled = await submitBtn.first().isDisabled();
log(`  只剩每周时按钮 disabled: ${submitDisabled} (期望 false,因每周有周一)`);
if (submitDisabled) failures.push('只剩每周(有周几)时按钮不应 disabled');

// 再取消所有周几
log('清空周几,按钮应 disabled');
// 取消所有勾选的周几(默认周一 + 上面可能勾了三五周日等)
// 这里我们点一遍"周一"看效果(简单测试)
const weekDayInputs = page.locator('[data-testid="weekly-day-picker"] input[type="checkbox"]');
const wdTotal = await weekDayInputs.count();
for (let i = 0; i < wdTotal; i++) {
  const checked = await weekDayInputs.nth(i).isChecked();
  if (checked) await weekDayInputs.nth(i).click({ force: true });
}
await page.waitForTimeout(200);
const submitDisabledNoDay = await submitBtn.first().isDisabled();
log(`  清空周几后按钮 disabled: ${submitDisabledNoDay} (期望 true)`);
if (!submitDisabledNoDay) failures.push('每周速读未选周几时按钮应 disabled');

await page.screenshot({ path: `${SHOT_DIR}/05-edge-no-day.png`, fullPage: false });

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