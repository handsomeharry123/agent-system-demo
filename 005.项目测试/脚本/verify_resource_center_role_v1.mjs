// 验证：医院资源管理中心 → 「资源管理」子菜单对科室管理员隐藏
//
// 预期结果（科室管理员 李秀英 视角）：
//   1. 侧边栏「医院资源管理中心」父菜单展开后只显示「申请管理」子项，无「资源管理」
//   2. 直接访问 /app/resource-center → 跳到 /app/resource-center/applies（无回退闪烁）
//   3. 直接访问 /app/resource-center/resources → BasicLayout 兜底回退到 /app/home/workbench
//   4. 演示操作抽屉树中「资源管理」标注「当前角色不可见」灰色、不可勾选
//   5. 信息科管理员 admin 视角下侧边栏两个子项都可见
import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
});
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') {
    const text = m.text();
    if (text.includes('`bodyStyle` is deprecated')) return;
    if (text.includes('`bordered` is deprecated')) return;
    if (text.includes('`destroyOnClose` is deprecated')) return;
    if (text.includes('findDOMNode is deprecated')) return;
    if (text.includes('is deprecated in StrictMode')) return;
    if (text.includes('destroyOnHidden')) return;
    if (text.includes('overlayInnerStyle')) return;
    errors.push(`[console.error] ${text}`);
  }
});

const outDir = '/tmp/resource_center_role_v1';
fs.mkdirSync(outDir, { recursive: true });

let exitCode = 0;
const log = (...args) => console.log('▶', ...args);
const pass = (msg) => console.log('✓ PASS:', msg);
const fail = (msg) => {
  console.error('✗ FAIL:', msg);
  exitCode = 1;
};
const assert = (cond, msg) => (cond ? pass(msg) : fail(msg));

try {
  // ───────────────────────────────────────────────────────────
  // 第 1 部分：科室管理员（李秀英）视角
  // ───────────────────────────────────────────────────────────
  log('=== Part 1: 科室管理员（李秀英）视角 ===');

  await page.addInitScript(() => {
    const settings = {
      demoRole: '科室管理员',
      visibleModules: {
        home: true,
        workbench: true,
        'agent-center': true,
        ledger: true,
        'resource-center': true,
        evaluation: true,
        orchestration: false,
        monitoring: true,
        security: true,
        'data-asset': true,
        'user-center': true,
        audit: true,
        dict: true,
        environment: true,
      },
      visibleSubPages: {
        'ledger:overview': true,
        'ledger:list': true,
        'resource-center:resources': true, // 显式 true 也没用,角色基线优先
        'resource-center:applies': true,
        'evaluation:tasks': true,
        'evaluation:indicators': true,
        'evaluation:datasets': true,
        'monitoring:overview': true,
        'monitoring:business': true,
        'monitoring:status': true,
        'monitoring:cost': true,
        'monitoring:alert-rules': true,
        'monitoring:alert-events': true,
        'security:overview': true,
        'security:events': true,
        'security:rules': true,
        'data-asset:datasets': true,
        'data-asset:collection': true,
        'user-center:list': true,
        'user-center:roles': true,
        'user-center:function': true,
        'user-center:data': true,
        'environment:sandbox': true,
        'environment:production': true,
      },
    };
    localStorage.setItem('demo_settings_v1', JSON.stringify(settings));
  });

  log('打开 /app/ledger,等待角色切换到「科室管理员」');
  await page.goto('http://localhost:3001/app/ledger', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);

  // 顶部角色
  const headerRoleTag = page.locator('span:has-text("科室管理员")').first();
  await assert(await headerRoleTag.isVisible(), '顶部角色 Tag = 「科室管理员」');
  const headerNameTag = page.locator('span:has-text("李秀英")').first();
  await assert(await headerNameTag.isVisible(), '顶部用户 Tag = 「李秀英」');

  // 展开「医院资源管理中心」
  const rcModule = page.locator('.ant-menu-submenu-title:has-text("医院资源管理中心")').first();
  await assert(await rcModule.isVisible(), '侧边栏可见「医院资源管理中心」一级模块');
  await rcModule.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}/01_dept_sidebar_resource_center.png`, fullPage: false });

  // 关键断言:「资源管理」对科室管理员不可见
  const resourcesItem = page.locator('.ant-menu-item:has-text("资源管理")');
  const appliesItem = page.locator('.ant-menu-item:has-text("申请管理")');
  const resourcesCount = await resourcesItem.count();
  const appliesCount = await appliesItem.count();
  log(`  - 资源管理 出现次数: ${resourcesCount}`);
  log(`  - 申请管理 出现次数: ${appliesCount}`);
  await assert(resourcesCount === 0, '侧边栏「资源管理」子菜单对科室管理员不可见');
  await assert(appliesCount === 1, '侧边栏「申请管理」子菜单对科室管理员可见');

  // 访问 /app/resource-center 父路径 → 应直接落到 /app/resource-center/applies
  log('直接访问 /app/resource-center,验证默认落地');
  await page.goto('http://localhost:3001/app/resource-center', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  const urlAfterParent = page.url();
  log(`  - 落地后 URL: ${urlAfterParent}`);
  await assert(
    urlAfterParent.endsWith('/app/resource-center/applies'),
    '科室管理员访问父路径 /app/resource-center → 落地到 /app/resource-center/applies',
  );

  // 直接访问 /app/resource-center/resources → 应被 BasicLayout 兜底跳到 /app/home/workbench
  log('直接访问 /app/resource-center/resources,验证 BasicLayout 兜底');
  await page.goto('http://localhost:3001/app/resource-center/resources', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  const urlAfterResources = page.url();
  log(`  - 落地后 URL: ${urlAfterResources}`);
  await assert(
    urlAfterResources.endsWith('/app/home/workbench'),
    '直接访问 /app/resource-center/resources → 被兜底跳到 /app/home/workbench',
  );

  // 演示操作抽屉
  log('打开演示操作抽屉,验证「资源管理」节点灰态');
  await page.goto('http://localhost:3001/app/ledger', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  const demoFab = page.locator('.ant-float-btn').first();
  await demoFab.click();
  await page.waitForTimeout(800);

  const allTreeTitles = await page.locator('.ant-tree-treenode .ant-tree-title').allTextContents();
  log('  - 树节点 title 列表: ' + JSON.stringify(allTreeTitles));

  // 「资源管理」节点 title 应包含「当前角色不可见」
  // 注意:用精确匹配,不要用 includes('资源管理') — 父节点「医院资源管理中心」会误命中
  const resourcesTitle = allTreeTitles.find((t) => t === '资源管理' || t.startsWith('资源管理（'));
  const appliesTitle = allTreeTitles.find((t) => t === '申请管理');
  log(`  - 资源管理 title: "${resourcesTitle ?? '(未找到)'}"`);
  log(`  - 申请管理 title: "${appliesTitle ?? '(未找到)'}"`);
  await assert(
    resourcesTitle !== undefined && resourcesTitle.includes('当前角色不可见'),
    '演示树中「资源管理」标记为「当前角色不可见」',
  );
  await assert(
    appliesTitle !== undefined,
    '演示树中「申请管理」正常显示（无灰态文字）',
  );

  await page.screenshot({ path: `${outDir}/02_dept_demo_drawer.png`, fullPage: false });

  // ───────────────────────────────────────────────────────────
  // 第 2 部分：信息科管理员（admin）视角
  // ───────────────────────────────────────────────────────────
  log('=== Part 2: 信息科管理员（admin）视角 ===');

  // 清掉 localStorage,使用默认 admin
  await page.addInitScript(() => {
    localStorage.removeItem('demo_settings_v1');
  });
  await page.goto('http://localhost:3001/app/ledger', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);

  const adminRoleTag = page.locator('span:has-text("信息科管理员")').first();
  await assert(await adminRoleTag.isVisible(), '顶部角色 Tag = 「信息科管理员」');

  // 展开「医院资源管理中心」
  const rcModuleAdmin = page.locator('.ant-menu-submenu-title:has-text("医院资源管理中心")').first();
  await assert(await rcModuleAdmin.isVisible(), '管理员侧边栏可见「医院资源管理中心」一级模块');
  await rcModuleAdmin.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}/03_admin_sidebar_resource_center.png`, fullPage: false });

  // 两个子项都应可见
  const resourcesCountAdmin = await page.locator('.ant-menu-item:has-text("资源管理")').count();
  const appliesCountAdmin = await page.locator('.ant-menu-item:has-text("申请管理")').count();
  log(`  - 资源管理 出现次数: ${resourcesCountAdmin}`);
  log(`  - 申请管理 出现次数: ${appliesCountAdmin}`);
  await assert(resourcesCountAdmin === 1, '管理员侧边栏「资源管理」子菜单可见');
  await assert(appliesCountAdmin === 1, '管理员侧边栏「申请管理」子菜单可见');

  // 演示树
  const demoFabAdmin = page.locator('.ant-float-btn').first();
  await demoFabAdmin.click();
  await page.waitForTimeout(800);
  const allTreeTitlesAdmin = await page.locator('.ant-tree-treenode .ant-tree-title').allTextContents();
  const resourcesTitleAdmin = allTreeTitlesAdmin.find((t) => t === '资源管理');
  const appliesTitleAdmin = allTreeTitlesAdmin.find((t) => t === '申请管理');
  log(`  - 资源管理 title: "${resourcesTitleAdmin ?? '(未找到)'}"`);
  log(`  - 申请管理 title: "${appliesTitleAdmin ?? '(未找到)'}"`);
  await assert(
    resourcesTitleAdmin !== undefined,
    '管理员演示树中「资源管理」正常显示',
  );
  await assert(
    appliesTitleAdmin !== undefined,
    '管理员演示树中「申请管理」正常显示',
  );

  await page.screenshot({ path: `${outDir}/04_admin_demo_drawer.png`, fullPage: false });

  if (errors.length > 0) {
    console.error('--- console / page errors ---');
    errors.forEach((e) => console.error(e));
    exitCode = 1;
  }
} catch (err) {
  console.error('✗ EXCEPTION:', err.stack || err.message);
  exitCode = 1;
} finally {
  await browser.close();
  console.log(exitCode === 0 ? '\n✅ ALL PASSED' : '\n❌ TEST FAILED');
  process.exit(exitCode);
}
