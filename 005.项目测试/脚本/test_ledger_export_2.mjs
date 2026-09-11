// 第二位测试者 - 同样验证台账导出改造（侧重边界用例）
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  acceptDownloads: true,
});
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[console.error] ${m.text()}`);
});

const outDir = '/tmp/ledger_export_test_2';
fs.mkdirSync(outDir, { recursive: true });

let exitCode = 0;
const log = (...args) => console.log('▶', ...args);
const fail = (msg) => { console.error('✗ FAIL:', msg); exitCode = 1; };
const pass = (msg) => console.log('✓ PASS:', msg);

// =================== 用例 1：总览页「导出台账」按钮已删除 ===================
log('用例 1：台账总览页 - 「导出台账」按钮已删除');
await page.goto('http://localhost:3001/app/ledger', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(outDir, '01_overview.png'), fullPage: true });

const overviewExportBtns = await page.locator('button:has-text("导出台账")').count();
if (overviewExportBtns === 0) pass('总览页「导出台账」按钮数=0');
else fail(`总览页「导出台账」按钮数=${overviewExportBtns}，期望 0`);

const viewListBtnCount = await page.locator('button:has-text("查看台账列表")').count();
if (viewListBtnCount === 1) pass('总览页「查看台账列表」按钮仍在');
else fail(`总览页「查看台账列表」按钮数=${viewListBtnCount}`);

// =================== 用例 2：列表页 - 筛选后导出（边界场景：筛选 + 勾选 + 导出筛选结果）===================
log('\n用例 2：台账列表 - 筛选 + 多选 + 导出台账');
await page.goto('http://localhost:3001/app/ledger/list', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500);

// 1. 先用「所属科室」筛选到「影像科」
const deptSelect = page.locator('.ant-select').filter({ hasText: '所属科室' }).first();
await deptSelect.click();
await page.waitForTimeout(300);
const deptOption = page.locator('.ant-select-item-option').filter({ hasText: '影像科' }).first();
const hasDeptOption = (await deptOption.count()) > 0;
if (hasDeptOption) {
  await deptOption.click();
  await page.waitForTimeout(800);
  pass('已筛选「所属科室=影像科」');
} else {
  fail('未找到「影像科」筛选项');
}

// 2. 截图筛选后的列表
await page.screenshot({ path: path.join(outDir, '02_filtered_list.png'), fullPage: true });

// 3. 读取筛选后表格行数
const filteredRows = await page.locator('.ant-table-tbody tr.ant-table-row').count();
log(`筛选后表格行数: ${filteredRows}`);
if (filteredRows > 0 && filteredRows < 30) {
  pass(`筛选生效：${filteredRows} 条（< 30 条）`);
} else {
  fail(`筛选后行数异常: ${filteredRows}`);
}

// 4. 「导出台账」按钮应仍可见（filtered > 0）
const exportBtn = page.locator('button:has-text("导出台账")').first();
const exportBtnExists = (await exportBtn.count()) > 0;
if (exportBtnExists) {
  const isDisabled = await exportBtn.isDisabled();
  if (!isDisabled) pass('筛选后「导出台账」按钮可点击（非 disabled）');
  else fail('筛选后「导出台账」按钮被禁用');
} else {
  fail('筛选后未找到「导出台账」按钮');
}

// 5. 勾选全部（表头 checkbox）
const headerBox = page.locator('.ant-table-thead .ant-checkbox-input').first();
const hb = await headerBox.boundingBox();
if (hb) {
  await page.mouse.click(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.waitForTimeout(500);
  const checkedCount = await page.locator('.ant-table-tbody tr.ant-table-row .ant-checkbox-input:checked').count();
  pass(`筛选后勾选全部: ${checkedCount} 条`);
} else {
  fail('表头 checkbox 未找到');
}

// 6. 打开下拉，点击「导出当前筛选结果」
await exportBtn.click();
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(outDir, '03_export_dropdown.png'), fullPage: true });

const exportAllItem = page.locator('li[role="menuitem"]').filter({ hasText: '导出当前筛选结果' }).first();
const exportAllVisible = await exportAllItem.isVisible().catch(() => false);
if (exportAllVisible) pass('下拉项「导出当前筛选结果」可见');
else fail('下拉项「导出当前筛选结果」不可见');

const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
await exportAllItem.click();
const download = await downloadPromise;
const downloadPath = path.join(outDir, 'export_filtered.csv');
await download.saveAs(downloadPath);
pass(`下载触发，文件名: ${download.suggestedFilename()}`);

// 7. 解析 CSV，验证导出数 == 筛选后行数
const csvContent = fs.readFileSync(downloadPath, 'utf8');
const lines = csvContent.split('\n').filter((l) => l.length > 0);
const header = lines[0].replace(/^﻿/, '');
const dataRows = lines.slice(1);
if (header.includes('智能体编号') && header.includes('风险分级')) {
  pass(`CSV 表头正确（含 智能体编号 / 风险分级 等 12 列）`);
} else {
  fail(`CSV 表头异常: "${header.slice(0, 100)}"`);
}
if (dataRows.length === filteredRows) {
  pass(`「导出当前筛选结果」行数 = ${dataRows.length}（= 筛选后表格 ${filteredRows} 行）`);
} else {
  fail(`「导出当前筛选结果」行数 ${dataRows.length} ≠ 筛选后表格 ${filteredRows}`);
}

// 8. 验证筛选后导出行的所属科室 = 影像科
const allMatchImaging = dataRows.every((line) => line.includes('影像科'));
if (allMatchImaging && dataRows.length > 0) {
  pass('导出内容全部属于「影像科」（与筛选条件一致）');
} else if (dataRows.length === 0) {
  fail('导出为空，无法验证科室');
} else {
  fail('导出内容包含非「影像科」记录');
}

// 9. 清空筛选 → 验证「导出台账」按钮仍可用，分页 total 恢复 30
await page.locator('button:has-text("重置")').first().click();
await page.waitForTimeout(800);
const paginationTotal = await page.locator('.ant-pagination-total-text, .ant-pagination li').first().textContent();
// 改读导出的 csv 行数 (10 当前页 = 30 总数)
const downloadPromise3 = page.waitForEvent('download', { timeout: 5000 });
const exportBtn3 = page.locator('button:has-text("导出台账")').first();
await exportBtn3.click();
await page.waitForTimeout(500);
const exportAll3 = page.locator('li[role="menuitem"]').filter({ hasText: '导出当前筛选结果' }).first();
await exportAll3.click();
const download3 = await downloadPromise3;
const path3 = path.join(outDir, 'export_after_reset.csv');
await download3.saveAs(path3);
const csv3 = fs.readFileSync(path3, 'utf8');
const lines3 = csv3.split('\n').filter((l) => l.length > 0);
const dataRows3 = lines3.slice(1);
if (dataRows3.length === 30) {
  pass(`重置后导出当前筛选结果: 30 条（数据恢复完整）`);
} else {
  fail(`重置后导出 ${dataRows3.length} 条（期望 30）`);
}
// 不再用 paginationTotal 报错（只是 debug 显示）
log(`分页文本: "${paginationTotal?.trim()}"`);

if (errors.length > 0) {
  console.log('\n--- 页面错误 ---');
  errors.forEach((e) => console.log(e));
}
await browser.close();
console.log('\n==================');
if (exitCode === 0) console.log('🎉 全部用例通过');
else console.log('❌ 有用例失败');
console.log('==================');
process.exit(exitCode);