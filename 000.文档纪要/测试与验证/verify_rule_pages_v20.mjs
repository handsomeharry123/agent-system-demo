// 验证监控中心告警规则管理 V2.0 三页：RuleManage / RuleForm / RuleDetail
// 端口 3001（vite dev），登录态沿用 useAuth → 选 「信息科管理员」 自动进入 admin
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SHOTS = '/Users/harry/Desktop/CC_TEST/agent-system';
const BASE = 'http://localhost:3001';

const log = (...a) => console.log('[v20]', ...a);

const main = async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();

  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console.err]', m.text()); });

  // 1) 登录页 → 信息科管理员
  log('open login');
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(800);
  // 点击「信息科管理员」卡（以文本匹配）
  const adminCard = page.getByText('信息科管理员', { exact: true }).first();
  if (await adminCard.count()) {
    await adminCard.click();
    await page.waitForTimeout(400);
  } else {
    log('admin card not found — 直接进入目标页');
  }

  // 2) 告警规则管理列表
  log('open /app/monitoring/alert-rules');
  await page.goto(`${BASE}/app/monitoring/alert-rules`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOTS, 'verify_v20_rule_list.png'), fullPage: true });
  log('snap: list');

  // 3) 切换 Tab 到「业务监控告警规则」
  const bizTab = page.getByRole('tab').filter({ hasText: '业务监控告警规则' }).first();
  if (await bizTab.count()) {
    await bizTab.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, 'verify_v20_rule_list_biz.png'), fullPage: true });
    log('snap: list-biz');
  }

  // 4) 切回「全部规则」+ 输入关键词
  const allTab = page.getByRole('tab').filter({ hasText: '全部规则' }).first();
  if (await allTab.count()) {
    await allTab.click();
    await page.waitForTimeout(300);
  }
  const search = page.locator('input[placeholder*="模糊搜索"]').first();
  if (await search.count()) {
    await search.fill('CPU');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, 'verify_v20_rule_list_search.png'), fullPage: true });
    log('snap: list-search');
    await search.fill('');
  }

  // 5) 新建规则
  log('open /app/monitoring/alert-rules/create');
  await page.goto(`${BASE}/app/monitoring/alert-rules/create`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOTS, 'verify_v20_rule_form.png'), fullPage: true });
  log('snap: form');

  // 6) 打开「选择模板」抽屉
  const tplBtn = page.getByRole('button', { name: /选择模板/ }).first();
  if (await tplBtn.count()) {
    await tplBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS, 'verify_v20_rule_form_drawer.png'), fullPage: true });
    log('snap: form-drawer');

    // 选中第一项
    const firstItem = page.locator('.ant-drawer .ant-list-item').first();
    if (await firstItem.count()) {
      await firstItem.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SHOTS, 'verify_v20_rule_form_drawer_pick.png'), fullPage: true });
      log('snap: form-drawer-pick');
    }

    // 点击「确认带入」
    const confirmBtn = page.getByRole('button', { name: /确认带入/ }).first();
    if (await confirmBtn.count()) {
      await confirmBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(SHOTS, 'verify_v20_rule_form_filled.png'), fullPage: true });
      log('snap: form-filled');
    }
  }

  // 7) 规则详情
  log('open /app/monitoring/alert-rules/rule-v18-001');
  await page.goto(`${BASE}/app/monitoring/alert-rules/rule-v18-001`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOTS, 'verify_v20_rule_detail.png'), fullPage: true });
  log('snap: detail');

  await browser.close();
  log('done');
};

main().catch((e) => { console.error(e); process.exit(1); });
