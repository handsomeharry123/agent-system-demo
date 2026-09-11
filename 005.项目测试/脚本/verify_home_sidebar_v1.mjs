// 医小管智能体首页 V1.x · 第二层(首页内左侧管理栏)验证
//
// 第二层合并版式:顶部一行 = 「工作台」标题 + 收起/搜索按钮;下方工作台区 + 滚动区(任务+会话) + 账户区
// (品牌区已合并到工作台行,不再独立渲染)
//
// 文案规避黑名单:1.3 用「新建任务」/1.4 用「自动化任务记录」/1.5 用「历史会话」。

import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const STORAGE_KEY = 'demo_settings_v1';
const results = [];
const check = (name, cond, extra = '') => {
  results.push({ name, pass: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};

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
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ([k, v]) => localStorage.setItem(k, v),
    [STORAGE_KEY, JSON.stringify(settings(demoRole))],
  );
  await page.goto(`${BASE}/app/home/overview`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  return { ctx, page };
}

// ─── 1. 第二层根 + 4 大区存在(品牌区已合并到工作台行) ───
{
  const { ctx, page } = await newPage('信息科管理员');
  await page.goto(`${BASE}/app/home/overview`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(800);

  check('第二层根容器 home-v1-side-col 存在', await page.locator('[data-testid="home-v1-side-col"]').count() >= 1);

  for (const k of ['tools', 'workbench', 'tasks', 'sessions']) {
    check(`1.x 区 home-v1-side-${k} 存在`, await page.locator(`[data-testid="home-v1-side-${k}"]`).count() >= 1);
  }

  // 工具行含「工作台」标题 + 收起/搜索按钮
  const toolsText = await page.evaluate(() =>
    document.querySelector('[data-testid="home-v1-side-tools"]')?.textContent || ''
  );
  check('工具行含「工作台」标题', /工作台/.test(toolsText));
  check('工具行收起按钮存在', await page.locator('[data-testid="home-v1-side-tools-collapse"]').count() >= 1);
  check('工具行搜索按钮存在', await page.locator('[data-testid="home-v1-side-tools-search"]').count() >= 1);

  // 整列文案与黑名单
  const sideText = await page.evaluate(() =>
    document.querySelector('[data-testid="home-v1-side-col"]')?.textContent || ''
  );
  check('1.4 区文案含「自动化任务记录」', /自动化任务记录/.test(sideText));
  check('1.5 区文案含「历史会话」', /历史会话/.test(sideText));
  check('未含黑名单「新建对话」', !/新建对话/.test(sideText));
  check('未含黑名单「自动化任务执行」', !/自动化任务执行/.test(sideText));
  check('未含黑名单「最近对话」', !/最近对话/.test(sideText));

  await ctx.close();
}

// ─── 2. 1.3 工作台三入口 + 抽屉 ───
{
  const { ctx, page } = await newPage('信息科管理员');
  await page.goto(`${BASE}/app/home/overview`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(800);

  check('工作台-新建任务按钮存在', await page.locator('[data-testid="home-v1-side-workbench-new"]').count() >= 1);
  check('工作台-连接器按钮存在', await page.locator('[data-testid="home-v1-side-workbench-connector"]').count() >= 1);
  check('工作台-自动化任务按钮存在', await page.locator('[data-testid="home-v1-side-workbench-auto"]').count() >= 1);

  // 点击连接器 → 右侧对话区嵌入 connector 视图(不跳路由)
  await page.click('[data-testid="home-v1-side-workbench-connector"]');
  await page.waitForTimeout(800);
  const connectorEmbedded = await page.locator('[data-testid="home-v1-middle-connector"]').count();
  check('连接器:右侧对话区嵌入视图打开', connectorEmbedded >= 1);
  // 8 张卡片可见
  const cardCount = await page.locator('[data-testid^="connector-card-"]:not([data-testid*="-action"]):not([data-testid*="-state"])').count();
  check('连接器列表 8 张卡片', cardCount === 8);
  // 嵌入视图不再渲染「返回对话」按钮 — 改为再点一次 sidebar「连接器」切回 overview
  check(
    '连接器:嵌入视图不显示「返回对话」按钮',
    (await page.locator('[data-testid="home-v1-middle-connector-back"]').count()) === 0,
  );
  await page.click('[data-testid="home-v1-side-workbench-connector"]');
  await page.waitForTimeout(400);
  check(
    '连接器:再点 sidebar「连接器」切回 overview',
    (await page.locator('[data-testid="home-v1-middle-connector"]').count()) === 0,
  );

  // 点击自动化任务 → 在右侧对话区嵌入 AutoTaskList 视图(不跳路由)
  await page.click('[data-testid="home-v1-side-workbench-auto"]');
  await page.waitForTimeout(500);
  const embeddedView = await page.locator('[data-testid="home-v1-middle-auto-tasks"]').count();
  check('自动化任务:右侧对话区嵌入视图打开', embeddedView >= 1);
  const tabScheduled = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="home-v1-middle-auto-tasks"]');
    return /定时任务/.test(root?.textContent || '') && /运行记录/.test(root?.textContent || '');
  });
  check('自动化任务:嵌入视图含「定时任务/运行记录」Tab', tabScheduled);
  // 嵌入视图不显示「返回对话」按钮 — 改为再点一次 sidebar「自动化任务」切回 overview
  check(
    '自动化任务:嵌入视图不显示「返回对话」按钮',
    (await page.locator('[data-testid="home-v1-middle-auto-tasks-back"]').count()) === 0,
  );

  // 嵌入视图中点「添加自动化」 → 下钻到 /app/home/auto-tasks/new
  await page.click('[data-testid="auto-tasks-add"]');
  await page.waitForURL(/\/app\/home\/auto-tasks\/new$/, { timeout: 5000 });
  await page.waitForTimeout(500);
  const formExists = await page.locator('[data-testid="auto-task-form-card"]').count();
  check('自动化任务表单页打开', formExists >= 1);

  // PRD §3.3.1 全字段:任务名称 + 提示词 + 周期-每天 + 时间 09:00
  // 一级任务用 data-testid="home-v1-side-task-<id>"(不含 -run- 后缀)
  const taskNodeRe = /^home-v1-side-task-(?!run-)/;
  const beforeCount = await page.evaluate((reSrc) => {
    const re = new RegExp(reSrc);
    return Array.from(document.querySelectorAll('[data-testid]')).filter((el) =>
      re.test(el.getAttribute('data-testid') || ''),
    ).length;
  }, taskNodeRe.source);
  // 任务名称
  await page.fill('input[placeholder*="今日全院"]', '每月合规审查报告');
  // 提示词(多行 textarea,placeholder 含"汇总今日")
  await page.fill('textarea[placeholder*="汇总今日"]', '汇总本院智能体调用与告警情况,生成简报');
  // 周期(默认)→ 时间 TimePicker:点击 placeholder 09:00 后输入 0900
  const cycleTimeInputs = await page.locator('input[placeholder="09:00"]').all();
  if (cycleTimeInputs.length > 0) {
    await cycleTimeInputs[0].click();
    await cycleTimeInputs[0].press('Control+a');
    await cycleTimeInputs[0].type('09:00', { delay: 10 });
    await page.keyboard.press('Tab');
  }
  await page.waitForTimeout(200);
  // 点创建按钮(下钻页面底栏的「创建」)
  await page.click('[data-testid="auto-task-submit"]');
  // 等 navigate 回首页 + chat 气泡推入
  await page.waitForURL(/\/app\/home\/overview$/, { timeout: 5000 });
  await page.waitForTimeout(800);

  // 验证:聊天区收到「任务创建成功」气泡(包含新建任务的命名)
  const chatText = await page.evaluate(() =>
    document.querySelector('[data-testid="home-v1"]')?.textContent || ''
  );
  check('提交后聊天区出现「已为您创建自动化任务」气泡', /已为您创建自动化任务/.test(chatText));
  check(
    '提交后气泡含新建任务名「每月合规审查报告」',
    /每月合规审查报告/.test(chatText),
  );

  await ctx.close();
}

// ─── 3. 1.5 历史会话点击 → 第三层 messages 重置为该会话 mock ───
{
  const { ctx, page } = await newPage('信息科管理员');
  await page.goto(`${BASE}/app/home/overview`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(800);

  await page.click('[data-testid="home-v1-side-session-s1"]');
  await page.waitForTimeout(400);

  const chatText = await page.evaluate(() =>
    document.querySelector('[data-testid="home-v1"]')?.textContent || ''
  );
  check('点击历史会话 s1 后,右侧出现「审批影像科接入申请」', /审批影像科接入申请/.test(chatText));

  await ctx.close();
}

// ─── 4. 1.3 新建任务 → 第三层 messages 重置为新问候语 ───
{
  const { ctx, page } = await newPage('科室管理员');
  await page.goto(`${BASE}/app/home/overview`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(800);

  await page.click('[data-testid="home-v1-input"]');
  await page.keyboard.type('测试一下', { delay: 10 });
  await page.click('[data-testid="home-v1-send"]');
  await page.waitForTimeout(1500);

  await page.click('[data-v1-side-workbench-new],[data-testid="home-v1-side-workbench-new"]');
  await page.waitForTimeout(400);

  const chatText = await page.evaluate(() =>
    document.querySelector('[data-testid="home-v1"]')?.textContent || ''
  );
  check('新建任务后,问候语含「本科室」', /本科室/.test(chatText));
  check('新建任务后,旧消息「测试一下」被清除', !/测试一下/.test(chatText));

  await ctx.close();
}

// ─── 5. 1.1 工具区:点击搜索 → 搜索弹窗(图2 风格 Modal) ───
{
  const { ctx, page } = await newPage('信息科管理员');
  await page.goto(`${BASE}/app/home/overview`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(800);

  await page.click('[data-testid="home-v1-side-tools-search"]');
  await page.waitForTimeout(400);
  // Modal 风格:居中浮层 + 搜索框 + 关闭按钮
  const searchInput = await page.locator('[data-testid="home-v1-search-input"]').count();
  check('搜索弹窗 input 存在', searchInput >= 1);
  const closeBtn = await page.locator('[data-testid="home-v1-search-close"]').count();
  check('搜索弹窗关闭按钮存在', closeBtn >= 1);
  // 「最近任务」分组文案
  const dialogText = await page.evaluate(() => {
    const input = document.querySelector('[data-testid="home-v1-search-input"]');
    return input ? input.closest('div')?.parentElement?.parentElement?.textContent || '' : '';
  });
  check('搜索弹窗显示「最近任务」分组', /最近任务/.test(dialogText));
  // 列表渲染出 s1
  const itemS1 = await page.locator('[data-testid="home-v1-search-item-s1"]').count();
  check('搜索弹窗列出 s1 任务', itemS1 >= 1);
  // 关闭
  await page.click('[data-testid="home-v1-search-close"]');
  await page.waitForTimeout(200);
  const afterClose = await page.locator('[data-testid="home-v1-search-input"]').count();
  check('点击关闭按钮后弹窗消失', afterClose === 0);

  await ctx.close();
}

// ─── 6. 1.1 工具区:点击收起 → 联动 ProLayout 折叠 ───
{
  const { ctx, page } = await newPage('信息科管理员');
  await page.goto(`${BASE}/app/home/overview`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(800);

  // 收起前:ProLayout 侧边栏展开(检查 sider 宽度或 logo 区存在)
  const beforeCollapse = await page.evaluate(() => {
    const sider = document.querySelector('.ant-pro-sider');
    return sider ? getComputedStyle(sider).width : '';
  });
  check('收起前 ProLayout sider 展开', beforeCollapse === '240px', `width=${beforeCollapse}`);

  // 点击收起按钮
  await page.click('[data-testid="home-v1-side-tools-collapse"]');
  await page.waitForTimeout(500);

  const afterCollapse = await page.evaluate(() => {
    const sider = document.querySelector('.ant-pro-sider');
    return sider ? getComputedStyle(sider).width : '';
  });
  check('收起后 ProLayout sider 折叠', afterCollapse !== '240px', `width=${afterCollapse}`);

  // 再点击 → 展开
  await page.click('[data-testid="home-v1-side-tools-collapse"]');
  await page.waitForTimeout(500);
  const reExpand = await page.evaluate(() => {
    const sider = document.querySelector('.ant-pro-sider');
    return sider ? getComputedStyle(sider).width : '';
  });
  check('再点击收起 → ProLayout sider 重新展开', reExpand === '240px', `width=${reExpand}`);

  await ctx.close();
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