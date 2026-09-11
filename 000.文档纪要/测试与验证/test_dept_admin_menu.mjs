// 测试用例 1：科室管理员 (李秀英) 视角下,左侧侧边栏可见
//   - 统一准入评测沙盒（仅显示「评测任务管理」二级子项）
//   - 统一运行监控中心（显示 6 个二级子项）
//   - 不应可见「指标展示」「数据集管理」
// 同步验证演示操作浮层中的树形菜单对应该角色显示正确的灰态
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
    // 忽略 antd 已知弃用警告，与本次修复无关
    if (text.includes('`bodyStyle` is deprecated')) return;
    if (text.includes('`bordered` is deprecated')) return;
    if (text.includes('`destroyOnClose` is deprecated')) return;
    if (text.includes('findDOMNode is deprecated')) return;
    if (text.includes('is deprecated in StrictMode')) return;
    errors.push(`[console.error] ${text}`);
  }
});

const outDir = '/tmp/dept_admin_menu_test';
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
  log('注入 localStorage,设置演示角色 = 科室管理员');
  await page.addInitScript(() => {
    // 演示设置：角色 = 科室管理员,模块全部默认显隐(由 masterMenu.defaultVisible 决定)
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
    };
    localStorage.setItem('demo_settings_v1', JSON.stringify(settings));
  });

  log('直接打开 /app/ledger（避开登录页）');
  // BasicLayout 中 useEffect 会读 currentUser,从 defaultAdmin (admin/信息科管理员) 起
  // 然后 useDemoSettings 的 effect 检测到 demoRole='科室管理员' 不在 currentUser.roles 中,
  // 调用 switchRole('科室管理员') → currentUser.roles = ['科室管理员']  (李秀英会被选中)
  await page.goto('http://localhost:3001/app/ledger', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);

  // 顶部角色指示：科室管理员 + 李秀英
  const headerRoleTag = page.locator('span:has-text("科室管理员")').first();
  await assert(await headerRoleTag.isVisible(), '顶部角色 Tag 显示「科室管理员」');
  const headerNameTag = page.locator('span:has-text("李秀英")').first();
  await assert(await headerNameTag.isVisible(), '顶部用户 Tag 显示「李秀英」');

  log('截取登录后侧边栏');
  await page.screenshot({ path: `${outDir}/01_sidebar.png`, fullPage: false });

  // 1. 验证「统一准入评测沙盒」一级模块在侧边栏中可见
  const evalModule = page.locator('.ant-menu-submenu-title:has-text("统一准入评测沙盒")').first();
  await assert(await evalModule.isVisible(), '侧边栏可见「统一准入评测沙盒」一级模块');

  // 2. 验证「统一运行监控中心」一级模块在侧边栏中可见
  const monModule = page.locator('.ant-menu-submenu-title:has-text("统一运行监控中心")').first();
  await assert(await monModule.isVisible(), '侧边栏可见「统一运行监控中心」一级模块');

  log('展开「统一准入评测沙盒」子菜单');
  await evalModule.click();
  await page.waitForTimeout(500);

  // 3. 评测沙盒下应只有「评测任务管理」子项
  const evalChildTasks = page.locator('.ant-menu-item:has-text("评测任务管理")');
  const evalChildIndicators = page.locator('.ant-menu-item:has-text("指标展示")');
  const evalChildDatasets = page.locator('.ant-menu-item:has-text("数据集管理")');
  await assert((await evalChildTasks.count()) === 1, '评测沙盒下显示「评测任务管理」子项');
  await assert((await evalChildIndicators.count()) === 0, '评测沙盒下「指标展示」不可见（仅管理员）');
  await assert((await evalChildDatasets.count()) === 0, '评测沙盒下「数据集管理」不可见（仅管理员）');

  log('展开「统一运行监控中心」子菜单');
  await monModule.click();
  await page.waitForTimeout(500);

  // 4. 监控中心下应显示全部 6 个子项
  const monChildNames = ['监控总览', '业务监控', '状态监控', '成本监控', '告警管理', '事件处置'];
  for (const name of monChildNames) {
    const item = page.locator(`.ant-menu-item:has-text("${name}")`);
    await assert((await item.count()) === 1, `监控中心下显示「${name}」子项`);
  }

  await page.screenshot({ path: `${outDir}/02_sidebar_expanded.png`, fullPage: false });

  // 5. 验证演示操作浮层
  log('打开演示设置抽屉');
  const demoFab = page.locator('.ant-float-btn').first();
  await demoFab.click();
  await page.waitForTimeout(800);

  const drawerTitle = page.locator('.ant-drawer-title:has-text("演示设置")');
  await assert(await drawerTitle.isVisible(), '演示操作抽屉已打开');

  // 抽屉内角色 Tag = 「科室管理员」
  const drawerRoleTag = page.locator('.ant-drawer .ant-tag:has-text("科室管理员")').first();
  await assert(await drawerRoleTag.isVisible(), '演示抽屉内角色 Tag = 「科室管理员」');

  // 树节点：父「统一准入评测沙盒」可见
  const evalTreeNode = page.locator('.ant-tree-node-content-wrapper:has(.ant-tree-title:has-text("统一准入评测沙盒"))').first();
  await assert(await evalTreeNode.isVisible(), '演示树中可见「统一准入评测沙盒」节点');

  // 演示树使用 defaultExpandAll,初次渲染即全展开;直接读取所有 title 节点
  const allTreeTitles = await page.locator('.ant-tree-treenode .ant-tree-title').allTextContents();
  log('  - 树节点 title 列表: ' + JSON.stringify(allTreeTitles));

  // 验证:子项「指标展示」「数据集管理」展示为「（当前角色不可见）」灰色
  // 「评测任务管理」正常显示
  const indicatorsTitle = allTreeTitles.find((t) => t.includes('指标展示'));
  const datasetsTitle = allTreeTitles.find((t) => t.includes('数据集管理'));
  const tasksTitle = allTreeTitles.find((t) => t === '评测任务管理');
  log(`  - 指标展示 title: "${indicatorsTitle ?? '(未找到)'}"`);
  log(`  - 数据集管理 title: "${datasetsTitle ?? '(未找到)'}"`);
  log(`  - 评测任务管理 title: "${tasksTitle ?? '(未找到)'}"`);
  await assert(
    indicatorsTitle !== undefined && indicatorsTitle.includes('当前角色不可见'),
    '演示树中「指标展示」标记为「当前角色不可见」',
  );
  await assert(
    datasetsTitle !== undefined && datasetsTitle.includes('当前角色不可见'),
    '演示树中「数据集管理」标记为「当前角色不可见」',
  );
  await assert(
    tasksTitle !== undefined,
    '演示树中「评测任务管理」正常显示（无灰态文字）',
  );

  await page.screenshot({ path: `${outDir}/03_demo_drawer.png`, fullPage: false });

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
