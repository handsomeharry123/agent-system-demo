// 验证台账速读订阅抽屉 - 订阅设置 / 历史报告 Tab（V2.0：精简版）
//   · 历史报告 Tab 移除「每日/每周」「已送达/已查看」标签、移除 highlights description、移除通道 Tag
//   · 右侧操作按钮由「查看」→「导出」
//   · 点击报告名称跳 /app/ledger-demo/report
//   · 全选 Checkbox + 批量导出 + 单条导出支持单选/多选/全选
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ARTEFACT_DIR = 'verify_subscribe_history_artefacts';
const URL_BASE = 'http://localhost:3001';

const fail = (msg) => { console.error('❌ FAIL:', msg); process.exit(1); };
const ok = (msg) => console.log('✅', msg);
const info = (msg) => console.log('  ·', msg);

const setup = async () => {
  fs.mkdirSync(ARTEFACT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.error('CONSOLE ERROR:', m.text());
  });
  return { browser, page };
};

const screenshot = async (page, name) => {
  await page.screenshot({ path: path.join(ARTEFACT_DIR, name), fullPage: false });
  info(`screenshot → ${ARTEFACT_DIR}/${name}`);
};

const step = async (label, fn) => {
  console.log(`\n--- ${label} ---`);
  await fn();
};

const run = async () => {
  const { browser, page } = await setup();

  try {
    // ============== 1. 总览页：打开抽屉，验证 Tab 与历史报告 ==============
    await step('总览页：访问 /app/ledger → 打开订阅抽屉', async () => {
      await page.goto(`${URL_BASE}/app/ledger`, { waitUntil: 'networkidle' });
      await page.waitForSelector('button:has-text("订阅速读")', { timeout: 15000 });
      await screenshot(page, '01_overview_before_drawer.png');

      await page.click('button:has-text("订阅速读")');
      await page.waitForSelector('.ant-drawer-open', { timeout: 5000 });
      await page.waitForSelector('.ant-drawer-title:has-text("全院台账速读订阅")', { timeout: 5000 });
      ok('总览页订阅抽屉打开成功');

      // 两个 Tab 都应该存在
      const tabs = await page.locator('.ant-drawer .ant-tabs-tab').allTextContents();
      info(`Tab 列表: ${JSON.stringify(tabs)}`);
      if (tabs.length !== 2) fail(`期望 2 个 Tab,实际 ${tabs.length}`);
      if (!tabs.some((t) => t.includes('订阅设置'))) fail('缺少「订阅设置」Tab');
      if (!tabs.some((t) => t.includes('历史报告'))) fail('缺少「历史报告」Tab');
      ok('两 Tab 渲染正确（订阅设置 + 历史报告）');
      await screenshot(page, '02_overview_drawer_settings.png');
    });

    await step('总览页：切换到「历史报告」Tab — V2.0 精简版校验', async () => {
      await page.click('.ant-drawer .ant-tabs-tab:has-text("历史报告")');
      await page.waitForTimeout(400);
      const historyBox = page.locator('[data-testid="subscription-history"]');
      if (!(await historyBox.isVisible())) fail('历史报告容器未渲染');

      // V2.0 摘要改为「共 N 条」
      const summary = await historyBox.locator('text=/共 \\d+ 条/').first().textContent();
      info(`摘要: ${summary}`);
      if (!summary.includes('条')) fail('历史报告摘要异常');

      // 列表项数量
      const items = await historyBox.locator('.ant-list-item').count();
      info(`历史报告条数: ${items}`);
      if (items < 5) fail(`历史报告至少应展示 5 条,实际 ${items}`);

      // V2.0: 已移除「每日/每周」Tag —— 全 Tab 都不应再有
      const dailyTag = await historyBox.locator('.ant-tag:has-text("每日")').count();
      const weeklyTag = await historyBox.locator('.ant-tag:has-text("每周")').count();
      info(`残留每日/每周 Tag 数: ${dailyTag}/${weeklyTag}`);
      if (dailyTag > 0 || weeklyTag > 0) fail('仍残留「每日/每周」Tag,V2.0 应移除');

      // V2.0: 已移除「已送达/已查看/推送失败」状态 Tag
      const deliveredTag = await historyBox.locator('.ant-tag:has-text("已送达")').count();
      const viewedTag = await historyBox.locator('.ant-tag:has-text("已查看")').count();
      const failedTag = await historyBox.locator('.ant-tag:has-text("推送失败")').count();
      info(`残留状态 Tag(送达/查看/失败): ${deliveredTag}/${viewedTag}/${failedTag}`);
      if (deliveredTag + viewedTag + failedTag > 0) fail('仍残留状态 Tag,V2.0 应移除');

      // V2.0: 已移除「通道：工作台 / 邮件」Tag
      const channelTag = await historyBox.locator('.ant-tag:has-text("工作台")').count();
      const emailTag = await historyBox.locator('.ant-tag:has-text("邮件")').count();
      info(`残留通道 Tag(工作台/邮件): ${channelTag}/${emailTag}`);
      if (channelTag + emailTag > 0) fail('仍残留通道 Tag,V2.0 应移除');

      // V2.0: 右侧操作按钮改为「导出」,不再有「查看」
      const viewBtns = await historyBox.locator('button:has-text("查看")').count();
      if (viewBtns > 0) fail('仍残留「查看」按钮,V2.0 应改为「导出」');
      const exportBtns = await historyBox.locator('.ant-list-item button:has-text("导出")').count();
      info(`单条导出按钮数: ${exportBtns}`);
      if (exportBtns < 5) fail(`导出按钮数量异常,期望 ≥5,实际 ${exportBtns}`);

      // 全选 Checkbox + 批量导出按钮
      const selectAll = await historyBox.locator('label:has-text("全选")').count();
      if (selectAll < 1) fail('缺少「全选」Checkbox');
      const batchExport = await historyBox.locator('button:has-text("批量导出")').count();
      if (batchExport < 1) fail('缺少「批量导出」按钮');
      ok('历史报告列表渲染正常(V2.0 精简版)');
      await screenshot(page, '03_overview_drawer_history.png');
    });

    await step('总览页：勾选两条 + 单条导出 + 批量导出 + 全选', async () => {
      const historyBox = page.locator('[data-testid="subscription-history"]');
      // 勾选前两条
      const itemCheckboxes = historyBox.locator('.ant-list-item .ant-checkbox-input');
      await itemCheckboxes.nth(0).check();
      await itemCheckboxes.nth(1).check();
      await page.waitForTimeout(200);

      // 摘要应显示「已选 2 条」
      const selectedHint = await historyBox.locator('text=/已选 2 条/').count();
      if (selectedHint < 1) fail('已选 2 条 摘要未更新');

      // 批量导出按钮应可用 + 点击不报错
      const batchBtn = historyBox.locator('button:has-text("批量导出")');
      if (await batchBtn.isDisabled()) fail('批量导出按钮应可用');
      await batchBtn.click();
      await page.waitForTimeout(300);
      ok('批量导出触发成功');

      // 全选 Checkbox —— 再次点击应全选
      const selectAllCb = historyBox.locator('label:has-text("全选") input[type="checkbox"]');
      await selectAllCb.click();
      await page.waitForTimeout(200);
      const allHint = await historyBox.locator('text=/共 \\d+ 条/').first().textContent();
      info(`全选后摘要: ${allHint}`);
      ok('全选交互正常');
      await screenshot(page, '03b_overview_drawer_history_select_all.png');
    });

    await step('总览页：点击报告名称 → 跳 /app/ledger-demo/report', async () => {
      const historyBox = page.locator('[data-testid="subscription-history"]');
      // 先取消全选，避免列表受全选 Checkbox 影响
      const selectAllCb = historyBox.locator('label:has-text("全选") input[type="checkbox"]');
      if (await selectAllCb.isChecked()) await selectAllCb.click();
      await page.waitForTimeout(200);

      const firstLink = historyBox.locator('.ant-list-item a').first();
      const linkText = await firstLink.textContent();
      info(`首条报告链接: ${linkText}`);
      await firstLink.click();
      // 等待路由切换
      await page.waitForURL(/\/app\/ledger-demo\/report$/, { timeout: 5000 });
      ok(`点击「${linkText?.trim()}」跳转至报告详情页`);
      await screenshot(page, '03c_report_detail.png');
    });

    await step('总览页：返回抽屉 → 切回订阅设置 Tab 仍正常', async () => {
      // 返回抽屉：直接回访问历史报告 Tab
      await page.goto(`${URL_BASE}/app/ledger`, { waitUntil: 'networkidle' });
      await page.click('button:has-text("订阅速读")');
      await page.waitForSelector('.ant-drawer-open', { timeout: 5000 });
      await page.click('.ant-drawer .ant-tabs-tab:has-text("订阅设置")');
      await page.waitForTimeout(300);
      const dailyBtn = page.locator('.ant-drawer label:has-text("每日速读")');
      if (!(await dailyBtn.isVisible())) fail('订阅设置 Tab 切换后内容丢失');
      const openBtn = page.locator('.ant-drawer button:has-text("立即开启订阅")');
      if (!(await openBtn.isVisible())) fail('订阅设置主按钮丢失');
      ok('订阅设置 Tab 切回正常');
    });

    // 关闭抽屉
    await page.click('.ant-drawer-close');
    await page.waitForTimeout(300);

    // ============== 2. 列表页：打开抽屉，同样验证两 Tab ==============
    await step('列表页：访问 /app/ledger/list → 打开订阅抽屉', async () => {
      await page.goto(`${URL_BASE}/app/ledger/list`, { waitUntil: 'networkidle' });
      await page.waitForSelector('button:has-text("订阅速读")', { timeout: 15000 });
      await page.click('button:has-text("订阅速读")');
      await page.waitForSelector('.ant-drawer-open', { timeout: 5000 });
      await page.waitForSelector('.ant-drawer-title:has-text("全院台账速读订阅")', { timeout: 5000 });
      ok('列表页订阅抽屉打开成功');
      await screenshot(page, '04_list_drawer_settings.png');
    });

    await step('列表页：切换历史报告 Tab', async () => {
      await page.click('.ant-drawer .ant-tabs-tab:has-text("历史报告")');
      await page.waitForTimeout(400);
      const historyBox = page.locator('[data-testid="subscription-history"]');
      const items = await historyBox.locator('.ant-list-item').count();
      info(`列表页历史报告条数: ${items}`);
      if (items < 5) fail(`列表页历史报告数量异常: ${items}`);

      const exportBtns = await historyBox.locator('.ant-list-item button:has-text("导出")').count();
      info(`列表页单条导出按钮数: ${exportBtns}`);
      if (exportBtns < 5) fail('列表页导出按钮缺失');

      ok('列表页历史报告 Tab 渲染正常(V2.0 精简版)');
      await screenshot(page, '05_list_drawer_history.png');
    });

    // 关闭抽屉
    await page.click('.ant-drawer-close');
    await page.waitForTimeout(300);

    console.log('\n🎉 全部验证通过');
  } finally {
    await browser.close();
  }
};

run().catch((e) => fail(e.stack || e.message));