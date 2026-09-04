// 医小管智能体首页 V1.0 - PRD 落地验证(新方向)
//
// 改造范围:仅首页内容区。
//   左侧 7 模块菜单由 BasicLayout(ProLayout)渲染,保持原样:
//     首页、智能体建设需求管理、智能体接入中心、统一台账中心、
//     医院资源管理中心、统一准入评测沙盒、统一运行监控
//   首页内容区 = 医小管智能体落地页(V1.1 去顶部三卡,V1.2 起 2.2 改为「场景标签」):
//     问候区 + 场景标签区 + 指令输入区
//
// 覆盖:
//   1. 左侧 7 菜单存在
//   2. 医小管对话区(问候/场景标签/输入框)
//   3. 角色感知(信息科管理员/科室管理员 问候语差异)
//   4. 场景标签可点击触发对话
//   5. 手动输入命中 5 大模块 + 兜底策略
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const STORAGE_KEY = 'demo_settings_v1';
const results = [];
const check = (name, cond, extra = '') => {
  results.push({ name, pass: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};

// 完整 7 个固定可见模块 + 其他默认不可见
const settings = (demoRole) => ({
  demoRole,
  visibleModules: {
    home: true, workbench: false, 'agent-needs': true, 'agent-center': true, ledger: true,
    'resource-center': true, evaluation: true, orchestration: false, monitoring: true,
    security: false, 'data-asset': false, environment: false, 'user-center': false, audit: false, dict: false,
  },
  visibleSubPages: {},
});

const browser = await chromium.launch({ headless: true });

async function newPage(demoRole) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  // 第一次访问写 localStorage
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ([k, v]) => localStorage.setItem(k, v),
    [STORAGE_KEY, JSON.stringify(settings(demoRole))],
  );
  // 强制刷新让 DemoSettingsProvider 重新初始化(读 localStorage)
  await page.goto(`${BASE}/app/home/overview`, { waitUntil: 'networkidle', timeout: 20000 });
  // 等 useDemoSettings 的启动 useEffect 校正 currentUser
  await page.waitForTimeout(500);
  // 再 reload 一次保证 role 切换到最新 localStorage
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  return { ctx, page };
}

// ─── 1. 左侧 ProLayout 7 菜单 ───
{
  const { ctx, page } = await newPage('信息科管理员');
  await page.goto(`${BASE}/app/home/overview`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(800);
  // ProLayout 侧栏 class 为 .ant-pro-sider(不是 .ant-pro-layout-sider)
  const menuAll = await page.evaluate(() => {
    const sider = document.querySelector('.ant-pro-sider, .ant-layout-sider');
    if (!sider) return { text: '', titles: [], contents: [] };
    return {
      text: sider.textContent || '',
      titles: Array.from(sider.querySelectorAll('[title]')).map((n) => n.getAttribute('title') || ''),
      contents: Array.from(sider.querySelectorAll('.ant-menu-title-content, .ant-menu-item')).map((n) => n.textContent?.trim() || ''),
    };
  });
  const allMenuStr = menuAll.text + ' ' + menuAll.titles.join(' ') + ' ' + menuAll.contents.join(' ');
  // 用户要求左侧固定 7 个菜单
  const expected = [
    '首页',
    '智能体建设需求管理',
    '智能体接入中心',
    '统一台账中心',
    '医院资源管理中心',
    '统一准入评测沙盒',
    '统一运行监控', // masterMenu 实际叫"统一运行监控中心",用前缀匹配
  ];
  for (const m of expected) {
    check(`左侧菜单含「${m}」`, allMenuStr.includes(m));
  }
  await ctx.close();
}

// ─── 2. 医小管对话区(信息科管理员) ───
{
  const { ctx, page } = await newPage('信息科管理员');
  await page.goto(`${BASE}/app/home/overview`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(800);

  const hasShell = await page.locator('[data-testid="home-v1"]').count();
  check('V1.0 首页根容器存在', hasShell >= 1);

  // 医小管对话主区
  const pageText = await page.evaluate(() => document.querySelector('[data-testid="home-v1"]')?.textContent || '');
  check('2.1 问候区(医小管+问候语)', /医小管/.test(pageText) && /您好.*我是医小管/.test(pageText));
  check('2.1 能力说明', /接入.*台账.*资源.*评测.*监控/.test(pageText));
  check('2.2 场景标签区(登记需求)', await page.locator('[data-testid="home-v1-scene-register-requirement"]').count() === 1);
  check('2.3 指令输入区(输入框)', await page.locator('[data-testid="home-v1-input"]').count() >= 1);
  check('2.3 发送按钮', await page.locator('[data-testid="home-v1-send"]').count() >= 1);

  // 顶部三卡已下线(V1.1)
  check('V1.1:顶部无三卡-工作台', !/新建对话/.test(pageText));
  check('V1.1:顶部无三卡-自动化任务执行', !/自动化任务执行/.test(pageText));
  check('V1.1:顶部无三卡-最近对话', !/最近对话/.test(pageText));

  // 推荐问句区已下线(V1.2 起改为场景标签)
  check('V1.2:无「推荐问句」标题', !/推荐问句/.test(pageText));
  check('V1.2:无旧 recommend-r1 testid', await page.locator('[data-testid="home-v1-recommend-r1"]').count() === 0);

  // 场景标签「登记需求」点击 → 触发对话
  await page.click('[data-testid="home-v1-scene-register-requirement"]');
  await page.waitForTimeout(1800);
  const sceneTriggered = await page.evaluate(() => {
    const main = document.querySelector('[data-testid="home-v1"]');
    return /等级保护定级|定级建议/.test(main?.textContent || '');
  });
  check('场景标签「登记需求」点击触发对话', sceneTriggered);
  await ctx.close();
}

// ─── 3. 角色感知:科室管理员 ───
{
  const { ctx, page } = await newPage('科室管理员');
  await page.goto(`${BASE}/app/home/overview`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(800);

  // 角色切换后问候语应含「本科室」
  const greeting = await page.evaluate(() => /本科室/.test(document.querySelector('[data-testid="home-v1"]')?.textContent || ''));
  check('科室管理员问候语含「本科室」', greeting);

  // 场景标签全员可见(不区分角色)
  const sceneCount = await page.locator('[data-testid="home-v1-scene-register-requirement"]').count();
  check('科室管理员场景标签=1', sceneCount === 1);

  // ─── V1.x:切换到历史会话后场景标签应隐藏(只展示在「新建任务」视图) ───
  await page.locator('[data-testid="home-v1-side-session-s1"]').click();
  await page.waitForTimeout(600);
  const sceneAfterSession = await page.locator('[data-testid="home-v1-scene-register-requirement"]').count();
  check('历史会话视图:场景标签=0(隐藏)', sceneAfterSession === 0);

  // ─── V1.x:点「新建任务」后场景标签应重新出现 ───
  await page.locator('[data-testid="home-v1-side-workbench-new"]').click();
  await page.waitForTimeout(600);
  const sceneAfterNew = await page.locator('[data-testid="home-v1-scene-register-requirement"]').count();
  check('新建任务视图:场景标签=1(恢复)', sceneAfterNew === 1);

  // ─── V1.x:场景标签应紧贴输入框上方(图2 布局) ───
  const sceneAboveInput = await page.evaluate(() => {
    const tag = document.querySelector('[data-testid="home-v1-scene-register-requirement"]');
    const input = document.querySelector('[data-testid="home-v1-input"]');
    if (!tag || !input) return false;
    const tagRect = tag.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();
    return tagRect.bottom <= inputRect.top + 24 && tagRect.bottom >= inputRect.top - 40;
  });
  check('场景标签位于输入框上方', sceneAboveInput);

  // ─── V1.x:点击自动化执行记录二级任务后场景标签应隐藏 ───
  await page.locator('[data-testid="home-v1-side-task-run-t1-r1"]').click();
  await page.waitForTimeout(600);
  const sceneAfterRun = await page.locator('[data-testid="home-v1-scene-register-requirement"]').count();
  check('自动化执行记录视图:场景标签=0(隐藏)', sceneAfterRun === 0);

  await ctx.close();
}

// ─── 4. 手动输入触发 mock 回复 + 兜底 ───
{
  const { ctx, page } = await newPage('信息科管理员');
  await page.goto(`${BASE}/app/home/overview`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(800);

  // 命中 5 大模块(按 Enter 触发发送,避免 antd Button 被浮层遮挡时 force click 失灵)
  await page.locator('[data-testid="home-v1-input"]').click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('本月准入评测的通过率', { delay: 10 });
  await page.keyboard.press('Tab');
  await page.waitForTimeout(150);
  await page.locator('[data-testid="home-v1-input"]').press('Enter');
  await page.waitForTimeout(1800);
  const hit = await page.evaluate(() => {
    const main = document.querySelector('[data-testid="home-v1"]');
    // 必须在消息流文本里看到关键词(排除输入框 placeholder/底栏文案)
    const bubbles = Array.from(document.querySelectorAll('[data-testid="home-v1"] *'));
    return bubbles.some((n) => /准入评测沙盒/.test(n.textContent || ''));
  });
  check('手动输入「评测通过率」命中准入评测沙盒', hit);

  // 兜底
  await page.locator('[data-testid="home-v1-input"]').click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('随便说点无意义内容abc', { delay: 10 });
  await page.keyboard.press('Tab');
  await page.waitForTimeout(150);
  await page.locator('[data-testid="home-v1-input"]').press('Enter');
  await page.waitForTimeout(1800);
  const fallback = await page.evaluate(() => /暂未理解|换种表述/.test(document.querySelector('[data-testid="home-v1"]')?.textContent || ''));
  check('未命中关键词走兜底策略', fallback);
  await ctx.close();
}

// ─── 5. 5 大模块链接跳转(手动输入触发) ───
{
  const tests = [
    { text: '待审批的接入申请', to: '/app/agent-center' },
    { text: '建设需求', to: '/app/agent-needs' },
    { text: '已上线数量', to: '/app/ledger' },
    { text: '准入评测通过率', to: '/app/evaluation/tasks' },
    { text: '24小时失败最多', to: '/app/monitoring/business' },
    { text: '高优先级告警', to: '/app/monitoring/alert-events' },
    { text: '本月运行管理情况报告', to: '/app/ledger-demo/report' },
  ];
  for (const t of tests) {
    const { ctx, page } = await newPage('信息科管理员');
    await page.goto(`${BASE}/app/home/overview`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(600);
    await page.locator('[data-testid="home-v1-input"]').click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type(t.text, { delay: 10 });
    await page.keyboard.press('Tab');
    await page.waitForTimeout(150);
    await page.locator('[data-testid="home-v1-input"]').press('Enter');
    await page.waitForTimeout(1800);
    const linkCount = await page.locator('[data-testid="home-v1-link"]').count();
    check(`手动问句「${t.text}」触发 mock 链接按钮`, linkCount >= 1);
    if (linkCount > 0) {
      await page.click(`[data-testid="home-v1-link"]`);
      await page.waitForTimeout(800);
      const url = page.url();
      check(`手动问句「${t.text}」链接跳转 ${t.to}`, url.includes(t.to), `→ ${url}`);
    }
    await ctx.close();
  }
}

// ─── 总结 ───
const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log('\n' + '─'.repeat(50));
console.log(`总计 ${results.length} 项 · 通过 ${passed} · 失败 ${failed.length}`);
if (failed.length) {
  console.log('失败项:');
  failed.forEach((f) => console.log(`  - ${f.name}  ${f.extra}`));
}
process.exit(failed.length ? 1 : 0);
