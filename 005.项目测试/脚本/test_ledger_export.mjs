// 验证台账导出改造：
//   1. 台账总览页：确认「导出台账」按钮已删除
//   2. 台账列表页：确认「导出台账」按钮存在 + 多选勾选 + 批量导出
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

const outDir = '/tmp/ledger_export_test';
fs.mkdirSync(outDir, { recursive: true });

let exitCode = 0;
const log = (...args) => console.log('▶', ...args);
const fail = (msg) => {
  console.error('✗ FAIL:', msg);
  exitCode = 1;
};
const pass = (msg) => console.log('✓ PASS:', msg);

// =================== 用例 1：台账总览 - 「导出台账」按钮已删除 ===================
log('用例 1：台账总览页 - 确认「导出台账」按钮已删除');
await page.goto('http://localhost:3001/app/ledger', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

// 截图总览页
await page.screenshot({ path: path.join(outDir, '01_overview.png'), fullPage: true });

// 统计「导出台账」按钮数（必须=0）
const overviewExportBtns = await page.getByRole('button', { name: /导出台账/ }).count();
if (overviewExportBtns === 0) {
  pass(`总览页「导出台账」按钮数=0（已删除）`);
} else {
  fail(`总览页仍存在「导出台账」按钮，共 ${overviewExportBtns} 个`);
}

// 确认「查看台账列表」按钮仍在（不应被误删）
const viewListBtn = await page.getByRole('button', { name: /查看台账列表/ }).count();
if (viewListBtn === 1) {
  pass(`总览页「查看台账列表」按钮仍在`);
} else {
  fail(`总览页「查看台账列表」按钮数=${viewListBtn}，期望 1`);
}

// =================== 用例 2：台账列表 - 「导出台账」按钮 + 多选批量导出 ===================
log('\n用例 2：台账列表页 - 「导出台账」按钮存在 + 多选 + 批量导出');
await page.goto('http://localhost:3001/app/ledger/list', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

// 截图列表页（含多选列 + 导出台账按钮）
await page.screenshot({ path: path.join(outDir, '02_list_with_export.png'), fullPage: true });

// 1. 「导出台账」按钮存在（可能在 disabled 态）
const listExportBtn = page.locator('button:has-text("导出台账")');
const listExportBtnCount = await listExportBtn.count();
if (listExportBtnCount >= 1) {
  pass(`列表页「导出台账」按钮存在（${listExportBtnCount} 个）`);
} else {
  fail(`列表页未找到「导出台账」按钮`);
  await browser.close();
  process.exit(exitCode);
}

// 2. Table 有 rowSelection 复选框（找表头 checkbox）
const headerCheckbox = page.locator('.ant-table-thead .ant-checkbox-input').first();
const headerCheckboxExists = (await headerCheckbox.count()) > 0;
if (headerCheckboxExists) {
  pass('表格已渲染多选列（表头 checkbox 存在）');
} else {
  fail('表格未渲染多选列');
}

// 3. 勾选若干行 —— 点击表头 checkbox 全选当前页（10 条），然后逐个反选直到剩 3 条
const headerBox = await headerCheckbox.boundingBox();
if (headerBox) {
  await page.mouse.click(headerBox.x + headerBox.width / 2, headerBox.y + headerBox.height / 2);
  await page.waitForTimeout(500);
  // 全选后逐个反选，每步核对 tbody 实际 checked 数，达到 3 停止
  let attempts = 0;
  while (attempts < 15) {
    const checkedNow = await page.locator('.ant-table-tbody tr.ant-table-row .ant-checkbox-input:checked').count();
    if (checkedNow <= 3) break;
    const checkedBoxes = page.locator('.ant-table-tbody tr.ant-table-row .ant-checkbox-input:checked');
    const b = await checkedBoxes.first().boundingBox();
    if (b) {
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await page.waitForTimeout(250);
    }
    attempts += 1;
  }
  const actuallyChecked = await page.locator('.ant-table-tbody tr.ant-table-row .ant-checkbox-input:checked').count();
  pass(`全选→逐个反选 → 留 ${actuallyChecked} 条`);
} else {
  fail('未找到表头 checkbox 位置');
}

// 截图勾选后状态
await page.screenshot({ path: path.join(outDir, '03_after_select.png'), fullPage: true });

// 4. 验证"已选 N 条"提示（实际数 == DOM checked 数）—— 只数 tbody 中已勾选
const expectedSelected = await page.locator('.ant-table-tbody tr.ant-table-row .ant-checkbox-input:checked').count();
const selectedText = await page.locator('text=/已选\\s*\\d+\\s*条/').first().textContent();
const selectedTextNum = selectedText ? Number(selectedText.match(/(\d+)/)?.[1]) : -1;
if (selectedTextNum === expectedSelected && expectedSelected > 0) {
  pass(`已选数提示: "${selectedText.trim()}"（与 DOM tbody checked=${expectedSelected} 一致）`);
} else {
  fail(`已选数提示不一致: "${selectedText}" / DOM tbody=${expectedSelected}`);
}

// 5. 打开下拉，验证有「导出已选」和「导出当前筛选」两条
await listExportBtn.first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(outDir, '04_dropdown.png'), fullPage: true });

const exportSelectedItem = page.locator('li[role="menuitem"]').filter({ hasText: '导出已选' }).first();
const exportAllItem = page.locator('li[role="menuitem"]').filter({ hasText: '导出当前筛选结果' }).first();
const exportSelectedVisible = await exportSelectedItem.isVisible().catch(() => false);
const exportAllVisible = await exportAllItem.isVisible().catch(() => false);
if (exportSelectedVisible) pass('下拉项「导出已选」可见');
else fail('下拉项「导出已选」不可见');
if (exportAllVisible) pass('下拉项「导出当前筛选结果」可见');
else fail('下拉项「导出当前筛选结果」不可见');

// 6. 点击「导出已选」→ 验证触发下载 + CSV 头部 + 行数 == 勾选数
const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
await exportSelectedItem.click();
const download = await downloadPromise;
const downloadPath = path.join(outDir, 'export_selected.csv');
await download.saveAs(downloadPath);
pass(`下载触发，文件名: ${download.suggestedFilename()}`);

// 解析 CSV 内容
const csvContent = fs.readFileSync(downloadPath, 'utf8');
const lines = csvContent.split('\n').filter((l) => l.length > 0);
const header = lines[0].replace(/^﻿/, '');
const dataRows = lines.slice(1);

if (header.includes('序号') && header.includes('智能体编号') && header.includes('智能体名称')) {
  pass(`CSV 表头正确: "${header.slice(0, 80)}..."`);
} else {
  fail(`CSV 表头不正确: "${header}"`);
}

if (dataRows.length === expectedSelected) {
  pass(`已选导出 ${dataRows.length} 行（与勾选数 ${expectedSelected} 一致）`);
} else {
  fail(`已选导出 ${dataRows.length} 行，期望 ${expectedSelected}`);
}

// 7. 清空选择 → 验证「导出已选」回到 disabled
await page.waitForTimeout(500);
await page.getByRole('button', { name: /清空选择/ }).click();
await page.waitForTimeout(300);
await listExportBtn.first().click();
await page.waitForTimeout(300);
const exportSelectedDisabled = await page.locator('li[role="menuitem"]:has-text("导出已选")').first().getAttribute('aria-disabled');
if (exportSelectedDisabled === 'true') {
  pass('清空选择后「导出已选」已禁用');
} else {
  fail(`清空选择后「导出已选」未禁用，aria-disabled=${exportSelectedDisabled}`);
}

// 8. 点击「导出当前筛选结果」→ 应下载全部数据
const downloadPromise2 = page.waitForEvent('download', { timeout: 5000 });
await page.locator('li[role="menuitem"]:has-text("导出当前筛选结果")').first().click();
const download2 = await downloadPromise2;
const downloadPath2 = path.join(outDir, 'export_all.csv');
await download2.saveAs(downloadPath2);
pass(`「导出当前筛选结果」下载触发，文件名: ${download2.suggestedFilename()}`);

const csvContent2 = fs.readFileSync(downloadPath2, 'utf8');
const lines2 = csvContent2.split('\n').filter((l) => l.length > 0);
const dataRows2 = lines2.slice(1);
if (dataRows2.length === 30) {
  pass(`导出当前筛选结果：30 条（与表格总数一致）`);
} else {
  fail(`导出当前筛选结果：${dataRows2.length} 条，期望 30`);
}

// 9. 验证 UTF-8 中文字段不乱码
const firstRow = dataRows2[0] || '';
if (/[一-龥]/.test(firstRow)) {
  pass(`CSV 含中文字段，未乱码`);
} else {
  fail(`CSV 中文字段缺失: "${firstRow.slice(0, 100)}"`);
}

// =================== 收尾 ===================
if (errors.length > 0) {
  console.log('\n--- 页面错误 ---');
  errors.forEach((e) => console.log(e));
}
await browser.close();

console.log('\n==================');
if (exitCode === 0) {
  console.log('🎉 全部用例通过');
} else {
  console.log('❌ 有用例失败');
}
console.log('==================');
process.exit(exitCode);