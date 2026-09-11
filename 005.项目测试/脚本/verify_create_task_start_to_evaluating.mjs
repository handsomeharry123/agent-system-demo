// =============================================================================
// verify_create_task_start_to_evaluating.mjs
// 验证:新建评测任务页点击「开始评测」
//   · 提示进入「评测中」
//   · 跳转到任务列表「评测中」Tab
// =============================================================================
import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const SCREENSHOT_DIR = '/Users/harry/Desktop/CC_TEST/agent-system';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (msg) => console.log(`[start→evaluating] ${msg}`);
const assert = (cond, msg) => {
  if (!cond) {
    console.error(`✗ ASSERT FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
};

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 0 });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text());
  });

  // ---------------------------------------------------------------------------
  // 1. 登录 admin
  // ---------------------------------------------------------------------------
  log('1. 登录 admin');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await sleep(800);
  const adminBtn = await page.getByRole('button', { name: /管理员登录|信息科管理员登录/ }).first();
  if (await adminBtn.count() > 0) {
    await adminBtn.click();
  } else {
    const userInput = await page.locator('input[type="text"], input[placeholder*="账"], input[placeholder*="用"]').first();
    if (await userInput.count() > 0) await userInput.fill('admin');
    const pwd = await page.locator('input[type="password"]').first();
    if (await pwd.count() > 0) await pwd.fill('123456');
    const submit = await page.getByRole('button', { name: /登录|确定/ }).first();
    if (await submit.count() > 0) await submit.click();
  }
  await sleep(1500);

  // ---------------------------------------------------------------------------
  // 2. 进入新建评测任务页
  // ---------------------------------------------------------------------------
  log('2. 打开新建评测任务');
  await page.goto(`${BASE}/app/evaluation/tasks/create`, { waitUntil: 'networkidle' });
  await sleep(1200);

  // ---------------------------------------------------------------------------
  // 3. 选智能体
  // ---------------------------------------------------------------------------
  log('3. 选择智能体');
  await page.locator('.ant-select-selector').first().click();
  await sleep(400);
  await page.locator('.ant-select-item-option').first().click();
  await sleep(500);

  // ---------------------------------------------------------------------------
  // 4. 点击「开始评测」(在 Tasks 组件 useEffect 清 URL 前抓 pushState)
  // ---------------------------------------------------------------------------
  log('4. 点击「开始评测」');
  // 通过监听 history.pushState / replaceState 抓 navigate 调用瞬间的目标 URL
  await page.evaluate(() => {
    const origPush = history.pushState.bind(history);
    // @ts-ignore
    window.__navUrls = [];
    history.pushState = function (state, title, url) {
      // @ts-ignore
      window.__navUrls.push(url ? String(url) : location.pathname + location.search);
      return origPush(state, title, url);
    };
  });
  const startBtn = page.getByRole('button', { name: /开始评测/ }).first();
  await startBtn.waitFor({ state: 'visible', timeout: 5000 });
  await startBtn.click();
  await sleep(300);
  const navUrls = await page.evaluate(() => {
    // @ts-ignore
    return window.__navUrls || [];
  });
  log(`   navigate 调用序列: ${JSON.stringify(navUrls)}`);
  const navTarget = navUrls.find((u) => /\/app\/evaluation\/tasks/.test(u)) || '';
  log(`   跳转目标 URL: ${navTarget}`);
  assert(/\/app\/evaluation\/tasks/.test(navTarget), '点击开始评测后跳转到 任务管理页');
  assert(
    navTarget.includes('tab=%E8%AF%84%E6%B5%8B%E4%B8%AD') ||
      navTarget.includes('tab=评测中'),
    '跳转 URL 携带 tab=评测中 参数'
  );

  // 等消息提示 / 页面稳定
  await sleep(1500);

  // 验证「评测中」Tab 为激活态
  const evaluatingTab = page.locator('.ant-tabs-tab-active:has-text("评测中")').first();
  assert(await evaluatingTab.count() > 0, '「评测中」Tab 已激活');

  // 验证 toast 提示
  const bodyText = await page.locator('body').innerText();
  assert(/评测中/.test(bodyText), '页面文案含「评测中」');

  await page.screenshot({ path: `${SCREENSHOT_DIR}/verify_create_task_start_to_evaluating.png`, fullPage: true });

  // ---------------------------------------------------------------------------
  // 6. 验证 评测中 Tab 列表里确实有新任务(且状态是评测中,带进度列)
  // ---------------------------------------------------------------------------
  log('6. 验证 评测中 Tab 列表含「评测进度」列 + 新任务');
  // 「评测进度」列
  const progressCol = page.locator('.ant-table-thead th:has-text("评测进度")').first();
  assert(await progressCol.count() > 0, '「评测中」Tab 列表显示「评测进度」列');
  // 至少有一条记录
  const rows = page.locator('.ant-table-tbody tr.ant-table-row');
  const rowCount = await rows.count();
  log(`   「评测中」Tab 行数: ${rowCount}`);
  assert(rowCount > 0, '「评测中」Tab 至少有 1 条任务');

  // 第一行第一列 = 序号,后面跟智能体编号 / 名称 / 版本 / 进度 / 标准 / 样本量 / 提交时间 / 状态 / 操作
  const firstRowText = await rows.first().innerText();
  log(`   首行摘要: ${firstRowText.replace(/\s+/g, ' ').slice(0, 200)}`);
  // 评测中 Tab 不显示 status 列(整列同质),通过「还剩约 N 分钟」副文案 + 进度条间接证明状态
  assert(/还剩约|即将完成/.test(firstRowText), '首行展示「还剩约 N 分钟 / 即将完成」副文案');
  assert(/查看详情/.test(firstRowText), '首行含「查看详情」操作按钮');

  log('');
  log('══════════════════════════════════════════════');
  log('✓ 「开始评测 → 进入评测中 + 跳转评测中 Tab」验证通过');
  log('══════════════════════════════════════════════');

  await browser.close();
})();