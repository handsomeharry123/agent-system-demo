// 测试用例 2：信息科管理员 (admin) 视角下 2 个模块都显示完整子项；
// 科室管理员 (李秀英) 直接访问仅管理员的子页（如 /app/evaluation/indicators）会被强制回退到工作台
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
    errors.push(`[console.error] ${text}`);
  }
});

const outDir = '/tmp/admin_all_subpages_test';
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
  // ============ Part A: 信息科管理员视角 ============
  log('=== Part A: 信息科管理员 (admin) 视角 ===');
  // 先开一个 page 注入 localStorage = 信息科管理员
  const pageA = await ctx.newPage();
  pageA.on('pageerror', (e) => errors.push(`[A pageerror] ${e.message}`));
  pageA.on('console', (m) => {
    if (m.type() === 'error') {
      const text = m.text();
      // 忽略 antd 已知弃用警告，与本次修复无关
      if (text.includes('`bodyStyle` is deprecated')) return;
      if (text.includes('`bordered` is deprecated')) return;
      if (text.includes('`destroyOnClose` is deprecated')) return;
      if (text.includes('findDOMNode is deprecated')) return;
      if (text.includes('is deprecated in StrictMode')) return;
      errors.push(`[A console.error] ${text}`);
    }
  });
  await pageA.addInitScript(() => {
    localStorage.setItem(
      'demo_settings_v1',
      JSON.stringify({
        demoRole: '信息科管理员',
        visibleModules: {
          home: true,
          workbench: true,
          'agent-center': true,
          ledger: true,
          'resource-center': true,
          evaluation: true,
          orchestration: true,
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
          'resource-center:resources': true,
          'resource-center:applies': true,
          'evaluation:tasks': true,
          'evaluation:indicators': true,
          'evaluation:datasets': true,
          'monitoring:overview': true,
          'monitoring:business': true,
          'monitoring:status': true,
          'monitoring:cost': true,
          'monitoring:alerts': true,
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
      }),
    );
  });

  await pageA.goto('http://localhost:3001/app/ledger', { waitUntil: 'networkidle', timeout: 30000 });
  await pageA.waitForTimeout(2500);

  const headerRoleTag = pageA.locator('span:has-text("信息科管理员")').first();
  await assert(await headerRoleTag.isVisible(), '顶部角色 Tag = 「信息科管理员」');

  // 评测沙盒全部 3 个子项
  await pageA.locator('.ant-menu-submenu-title:has-text("统一准入评测沙盒")').first().click();
  await pageA.waitForTimeout(400);
  for (const name of ['评测任务管理', '指标展示', '数据集管理']) {
    const item = pageA.locator(`.ant-menu-item:has-text("${name}")`);
    await assert((await item.count()) === 1, `[信息科管理员] 评测沙盒下显示「${name}」子项`);
  }

  // 监控中心全部 6 个子项
  await pageA.locator('.ant-menu-submenu-title:has-text("统一运行监控中心")').first().click();
  await pageA.waitForTimeout(400);
  for (const name of ['监控总览', '业务监控', '状态监控', '成本监控', '告警管理', '事件处置']) {
    const item = pageA.locator(`.ant-menu-item:has-text("${name}")`);
    await assert((await item.count()) === 1, `[信息科管理员] 监控中心下显示「${name}」子项`);
  }

  await pageA.screenshot({ path: `${outDir}/01_admin_sidebar.png`, fullPage: false });

  // 直接访问 /app/evaluation/indicators 应能正常展示
  await pageA.goto('http://localhost:3001/app/evaluation/indicators', { waitUntil: 'networkidle', timeout: 30000 });
  await pageA.waitForTimeout(2000);
  await assert(
    pageA.url().includes('/app/evaluation/indicators'),
    `[信息科管理员] 直接访问 /app/evaluation/indicators 不被回退,URL = ${pageA.url()}`,
  );

  // ============ Part B: 科室管理员视角 ============
  log('=== Part B: 科室管理员 (李秀英) 视角 ===');
  // 开第二个 page,共享 localStorage 状态 = 科室管理员
  const pageB = await ctx.newPage();
  pageB.on('pageerror', (e) => errors.push(`[B pageerror] ${e.message}`));
  pageB.on('console', (m) => {
    if (m.type() === 'error') {
      const text = m.text();
      // 忽略 antd 已知弃用警告，与本次修复无关
      if (text.includes('`bodyStyle` is deprecated')) return;
      if (text.includes('`bordered` is deprecated')) return;
      if (text.includes('`destroyOnClose` is deprecated')) return;
      if (text.includes('findDOMNode is deprecated')) return;
      if (text.includes('is deprecated in StrictMode')) return;
      errors.push(`[B console.error] ${text}`);
    }
  });
  await pageB.addInitScript(() => {
    localStorage.setItem(
      'demo_settings_v1',
      JSON.stringify({
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
          security: false,
          'data-asset': false,
          'user-center': false,
          audit: true,
          dict: false,
          environment: false,
        },
        visibleSubPages: {
          'ledger:overview': true,
          'ledger:list': true,
          'resource-center:resources': true,
          'resource-center:applies': true,
          'evaluation:tasks': true,
          'evaluation:indicators': true,
          'evaluation:datasets': true,
          'monitoring:overview': true,
          'monitoring:business': true,
          'monitoring:status': true,
          'monitoring:cost': true,
          'monitoring:alerts': true,
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
      }),
    );
  });

  // 直接以科室管理员身份访问 /app/ledger
  await pageB.goto('http://localhost:3001/app/ledger', { waitUntil: 'networkidle', timeout: 30000 });
  await pageB.waitForTimeout(2500);

  const deptRoleTag = pageB.locator('span:has-text("科室管理员")').first();
  await assert(await deptRoleTag.isVisible(), '切换后顶部角色 Tag = 「科室管理员」');
  const liNameTag = pageB.locator('span:has-text("李秀英")').first();
  await assert(await liNameTag.isVisible(), '切换后顶部用户 Tag = 「李秀英」');

  // 1. 评测任务管理可访问
  await pageB.goto('http://localhost:3001/app/evaluation/tasks', { waitUntil: 'networkidle', timeout: 30000 });
  await pageB.waitForTimeout(2000);
  await assert(
    pageB.url().includes('/app/evaluation/tasks'),
    `[科室管理员] 访问 /app/evaluation/tasks 不被回退,URL = ${pageB.url()}`,
  );

  // 2. /app/evaluation/indicators 应被强制回退到 /app/home/workbench (科室管理员 safeFallback)
  await pageB.goto('http://localhost:3001/app/evaluation/indicators', { waitUntil: 'networkidle', timeout: 30000 });
  await pageB.waitForTimeout(2500);
  log(`  - 回退后 URL = ${pageB.url()}`);
  await assert(
    pageB.url().endsWith('/app/home/workbench'),
    `[科室管理员] 访问 /app/evaluation/indicators 应被回退到 /app/home/workbench,实际 URL = ${pageB.url()}`,
  );

  // 3. /app/evaluation/datasets 也应被回退
  await pageB.goto('http://localhost:3001/app/evaluation/datasets', { waitUntil: 'networkidle', timeout: 30000 });
  await pageB.waitForTimeout(2500);
  log(`  - 回退后 URL = ${pageB.url()}`);
  await assert(
    pageB.url().endsWith('/app/home/workbench'),
    `[科室管理员] 访问 /app/evaluation/datasets 应被回退到 /app/home/workbench,实际 URL = ${pageB.url()}`,
  );

  // 4. /app/evaluation/datasets/import（嵌套路由）也应被回退
  await pageB.goto('http://localhost:3001/app/evaluation/datasets/import', { waitUntil: 'networkidle', timeout: 30000 });
  await pageB.waitForTimeout(2500);
  log(`  - 回退后 URL = ${pageB.url()}`);
  await assert(
    pageB.url().endsWith('/app/home/workbench'),
    `[科室管理员] 访问 /app/evaluation/datasets/import 应被回退到 /app/home/workbench,实际 URL = ${pageB.url()}`,
  );

  // 5. /app/monitoring/* 监控中心子页都应可访问
  await pageB.goto('http://localhost:3001/app/monitoring/alerts', { waitUntil: 'networkidle', timeout: 30000 });
  await pageB.waitForTimeout(2000);
  log(`  - /app/monitoring/alerts URL = ${pageB.url()}`);
  await assert(
    pageB.url().endsWith('/app/monitoring/alerts'),
    `[科室管理员] 访问 /app/monitoring/alerts 不被回退,URL = ${pageB.url()}`,
  );

  await pageB.screenshot({ path: `${outDir}/02_dept_final.png`, fullPage: false });

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
