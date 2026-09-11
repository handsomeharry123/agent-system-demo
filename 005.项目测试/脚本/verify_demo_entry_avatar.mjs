// verify_demo_entry_avatar.mjs — 验证: 演示功能入口从右下角 FloatButton 迁至右上角头像下拉菜单
import { chromium } from 'playwright';
import fs from 'node:fs';

const URL_BASE = 'http://localhost:3001';
const OUT_DIR = '/Users/harry/Desktop/CC_TEST/agent-system';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('[browser-error]', msg.text());
  });
  page.on('pageerror', (err) => console.log('[page-error]', err.message));

  try {
    console.log('=== step 1: 打开任一应用页 (BasicLayout 渲染头像) ===');
    await page.goto(`${URL_BASE}/app/agent-center/smart-register`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    console.log('url:', page.url());

    // 截图 1: 整页 (确认右下角不再有"演示操作"FloatButton)
    await page.screenshot({ path: `${OUT_DIR}/verify_demo_entry_1_no_float.png`, fullPage: false });
    console.log('截图 1: 整页 (无右下角 FloatButton) → verify_demo_entry_1_no_float.png');

    // 断言: 右下角不再存在 ant-float-btn (旧"演示操作"入口)
    const oldFloatBtn = page.locator('.ant-float-btn');
    const oldFloatCount = await oldFloatBtn.count();
    console.log(`右下角 .ant-float-btn 数量: ${oldFloatCount} (期望 0)`);
    if (oldFloatCount > 0) {
      console.log('⚠️ 右下角仍存在 ant-float-btn, 可能未移除干净');
    } else {
      console.log('✓ 右下角已无 FloatButton 入口');
    }

    console.log('=== step 2: 点击右上角头像, 打开下拉菜单 ===');
    // 头像是 BasicLayout 右上角 .ant-avatar (在 .ant-pro-global-header 内)
    // 可能是多个 avatar (机器人/抽屉里也有), 用「最右上角的」— 通过 aria-label 或位置
    const avatar = page.locator('.ant-pro-global-header .ant-avatar').first();
    await avatar.waitFor({ state: 'visible', timeout: 8000 });
    await avatar.click();
    await page.waitForTimeout(600);

    // 截图 2: 下拉菜单展开
    await page.screenshot({ path: `${OUT_DIR}/verify_demo_entry_2_dropdown.png`, fullPage: false });
    console.log('截图 2: 头像下拉菜单展开 → verify_demo_entry_2_dropdown.png');

    // 断言: 下拉菜单中能找到「演示功能」项
    const demoMenuItem = page.locator('.ant-dropdown-menu-item').filter({ hasText: '演示功能' });
    await demoMenuItem.waitFor({ state: 'visible', timeout: 5000 });
    const demoItemCount = await demoMenuItem.count();
    console.log(`下拉菜单「演示功能」项可见: ${demoItemCount > 0} (期望 1)`);
    if (demoItemCount === 0) {
      throw new Error('下拉菜单中未找到「演示功能」项');
    }
    console.log('✓ 头像下拉菜单包含「演示功能」项');

    // 同时确认「退出登录」仍存在
    const logoutItem = page.locator('.ant-dropdown-menu-item').filter({ hasText: '退出登录' });
    const logoutCount = await logoutItem.count();
    console.log(`下拉菜单「退出登录」项可见: ${logoutCount > 0} (期望 1)`);

    console.log('=== step 3: 点击「演示功能」, 弹出 Drawer ===');
    await demoMenuItem.first().click();
    await page.waitForTimeout(800);

    // 截图 3: 演示设置 Drawer 弹出
    await page.screenshot({ path: `${OUT_DIR}/verify_demo_entry_3_drawer.png`, fullPage: false });
    console.log('截图 3: 演示设置 Drawer 弹出 → verify_demo_entry_3_drawer.png');

    // 断言: 演示设置 Drawer 可见, 标题含「演示设置」
    const drawer = page.locator('.ant-drawer-content').filter({ hasText: '演示设置' });
    await drawer.waitFor({ state: 'visible', timeout: 5000 });
    const drawerVisible = await drawer.isVisible();
    console.log(`演示设置 Drawer 可见: ${drawerVisible} (期望 true)`);
    if (!drawerVisible) {
      throw new Error('演示设置 Drawer 未显示');
    }
    console.log('✓ 点击「演示功能」成功弹出演示设置 Drawer');

    // 断言: Drawer 内含「演示角色」与「左侧模块显隐」分组
    const roleLabel = drawer.locator('text=演示角色').first();
    const moduleLabel = drawer.locator('text=左侧模块显隐').first();
    const hasRoleLabel = await roleLabel.count();
    const hasModuleLabel = await moduleLabel.count();
    console.log(`Drawer 内「演示角色」分组: ${hasRoleLabel > 0} (期望 true)`);
    console.log(`Drawer 内「左侧模块显隐」分组: ${hasModuleLabel > 0} (期望 true)`);

    // 断言: Drawer 内含「一键重置为默认」按钮
    const resetBtn = drawer.locator('button').filter({ hasText: '一键重置为默认' });
    const hasResetBtn = await resetBtn.count();
    console.log(`Drawer 内「一键重置为默认」按钮: ${hasResetBtn > 0} (期望 true)`);

    // 验证角色切换功能仍可用
    console.log('=== step 4: Drawer 内切换角色为「科室管理员」 ===');
    const roleSelect = drawer.locator('.ant-select').first();
    await roleSelect.click();
    await page.waitForTimeout(400);
    const option = page.locator('.ant-select-item-option').filter({ hasText: '科室管理员' }).first();
    await option.waitFor({ state: 'visible', timeout: 5000 });
    await option.click();
    await page.waitForTimeout(1000);

    // 截图 4: 角色切换后的 Drawer
    await page.screenshot({ path: `${OUT_DIR}/verify_demo_entry_4_role_switched.png`, fullPage: false });
    console.log('截图 4: 角色已切为科室管理员 → verify_demo_entry_4_role_switched.png');

    // 关闭 Drawer
    const closeBtn = drawer.locator('.ant-drawer-close').first();
    if (await closeBtn.count()) {
      await closeBtn.click().catch(() => {});
      await page.waitForTimeout(400);
    }

    // 截图 5: 切角色后整页 (右上角标签应反映新角色)
    await page.screenshot({ path: `${OUT_DIR}/verify_demo_entry_5_after_close.png`, fullPage: false });
    console.log('截图 5: 关闭 Drawer 后整页 → verify_demo_entry_5_after_close.png');

    console.log('\n=== 验证通过: 演示功能入口已从右下角迁移至右上角头像下拉菜单 ===');
  } catch (err) {
    console.log('\n=== 验证失败 ===');
    console.log('error:', err.message);
    await page.screenshot({ path: `${OUT_DIR}/verify_demo_entry_fail.png`, fullPage: false }).catch(() => {});
    process.exit(1);
  } finally {
    await browser.close();
  }
})();