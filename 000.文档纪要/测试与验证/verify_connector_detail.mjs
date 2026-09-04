// 医小管智能体首页 V1.x · 连接器中间视图(PRD §2.3.1/2.3.2)验证
//
// 新交互:左侧 sidebar 点「连接器」→ 首页中间内容区切到连接器列表,右侧医小管对话区保留
// 字段(PRD §2.3.2):连接器名称(状态圆点+Tag) / 连接器说明 / 操作按钮(按状态分发)
// 列表卡片:一行 2 个(xl=12);主操作 icon 参考图2 → 未使用 「+」 / 已使用 「>」箭头
// 「返回对话」按钮已下线(toggle 模式:再点一次 sidebar 按钮切回 overview)
// 「新建任务」按钮在嵌入视图下必须强制切回对话区,否则注入的问候语 + 输入框用户看不到
// 弹窗:点击列表卡/主操作 icon → 弹 Modal 展示详情
// 反向断言:无独立 label「支持能力/连接状态/操作」,无授权生效时间字段

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

// ─── 1. 点击 sidebar 连接器按钮 → 中间视图切换 ───
{
  const { ctx, page } = await newPage('信息科管理员');

  // 初始状态:中间是医小管对话区,不含 8 张连接器卡片
  check('初始无连接器卡片', await page.locator('[data-testid^="connector-card-"]:not([data-testid*="-action"]):not([data-testid*="-state"])').count() === 0);

  // 点击 sidebar 连接器按钮
  await page.click('[data-testid="home-v1-side-workbench-connector"]');
  await page.waitForTimeout(500);

  // 中间视图切到连接器列表(不跳路由)
  check('URL 保持 overview', /\/app\/home\/overview$/.test(page.url()), page.url());
  check('连接器列表 8 张卡片', await page.locator('[data-testid^="connector-card-"]:not([data-testid*="-action"]):not([data-testid*="-state"])').count() === 8);
  // 左侧导航栏仍存在(不跳路由)
  check('左侧导航栏仍存在', await page.locator('[data-testid="home-v1-side-col"]').count() >= 1);
  // 中间视图标记存在
  check('中间连接器视图标记存在', await page.locator('[data-testid="home-v1-middle-connector"]').count() >= 1);

  // 关键回归断言:连接器视图时,首页外层 Row 内第二个 Col 必须与左侧 sidebar Col 同一 y(避免 Col wrap)
  const colY = await page.evaluate(() => {
    const sideCol = document.querySelector('[data-testid="home-v1-side-col"]');
    const sideY = sideCol ? sideCol.getBoundingClientRect().y : null;
    // 取 home-v1 直接子 Row 中的 Col(排除 ConnectorList 内嵌 Row 的 Col)
    const homeRow = sideCol?.parentElement;
    const cols = homeRow ? Array.from(homeRow.querySelectorAll(':scope > .ant-col')) : [];
    const otherY = cols.filter((c) => c !== sideCol).map((c) => c.getBoundingClientRect().y);
    return { sideY, otherY };
  });
  check(
    '连接器视图:右侧 Col 与 sidebar Col 同一 y(避免 wrap)',
    colY.sideY !== null && colY.otherY.length > 0 && colY.otherY.every((y) => Math.abs(y - colY.sideY) < 2),
    `sideY=${colY.sideY} otherY=${JSON.stringify(colY.otherY)}`,
  );

  // 关键回归断言:1 行 2 个(xl=12,中等屏 lg 也 12)。取第一行两个 Card,确认 x 不同 + y 相同
  const rowInfo = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[data-testid^="connector-card-"]:not([data-testid*="-action"]):not([data-testid*="-state"])'));
    const rects = cards.slice(0, 2).map((c) => {
      const r = c.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width };
    });
    return rects;
  });
  check(
    '列表一行 2 个卡片:第一行两卡同 y 且 x 不同',
    rowInfo.length === 2 && Math.abs(rowInfo[0].y - rowInfo[1].y) < 2 && Math.abs(rowInfo[0].x - rowInfo[1].x) > 10,
    JSON.stringify(rowInfo),
  );

  // 「返回对话」按钮已下线(toggle 模式:再点 sidebar 按钮切回)
  check(
    '嵌入视图不再显示「返回对话」按钮',
    await page.locator('[data-testid="home-v1-middle-connector-back"]').count() === 0,
  );

  await ctx.close();
}

// ─── 2. 已连接(微信)详情弹窗 ───
{
  const { ctx, page } = await newPage('信息科管理员');
  await page.click('[data-testid="home-v1-side-workbench-connector"]');
  await page.waitForTimeout(500);

  await page.click('[data-testid="connector-card-wechat"]');
  await page.waitForTimeout(500);

  const cardText = await page.locator('[data-testid="connector-detail-wechat"]').textContent();
  check('名称「微信」存在', /微信/.test(cardText || ''));
  check('状态圆点存在', await page.locator('span[aria-label="已连接"]').count() >= 1);
  check('状态 Tag「已连接」', /已连接/.test(cardText || ''));

  const desc = await page.locator('[data-testid="connector-detail-desc"]').textContent();
  check('说明含「接入个人微信」', /接入个人微信/.test(desc || ''));

  check('解绑按钮存在', await page.locator('[data-testid="connector-detail-unbind"]').count() >= 1);
  check('去试试按钮存在', await page.locator('[data-testid="connector-detail-try"]').count() >= 1);
  check('连接按钮不存在', await page.locator('[data-testid="connector-detail-connect"]').count() === 0);

  // 反向断言
  check('无独立 label「支持能力」', !/支持能力/.test(cardText || ''));
  check('无独立 label「连接状态」', !/连接状态/.test(cardText || ''));
  check('无独立 label「操作」', !/>操作</.test(cardText || '') && !/操作：/.test(cardText || ''));
  check('无「授权生效时间」字段', !/授权生效时间/.test(cardText || ''));

  await ctx.close();
}

// ─── 3. 未连接(QQ)详情弹窗 ───
{
  const { ctx, page } = await newPage('信息科管理员');
  await page.click('[data-testid="home-v1-side-workbench-connector"]');
  await page.waitForTimeout(500);
  await page.click('[data-testid="connector-card-qq"]');
  await page.waitForTimeout(500);

  const cardText = await page.locator('[data-testid="connector-detail-qq"]').textContent();
  check('未连接:名称「QQ」存在', /QQ/.test(cardText || ''));
  check('未连接:弹窗内无状态圆点', await page.locator('[data-testid="connector-detail-qq"] span[aria-label="已连接"], [data-testid="connector-detail-qq"] span[aria-label="异常"]').count() === 0);
  check('未连接:状态 Tag「未连接」', /未连接/.test(cardText || ''));
  check('未连接:「连接」按钮存在', await page.locator('[data-testid="connector-detail-connect"]').count() >= 1);
  check('未连接:无解绑按钮', await page.locator('[data-testid="connector-detail-unbind"]').count() === 0);

  await ctx.close();
}

// ─── 4. 异常(钉钉)详情弹窗 ───
{
  const { ctx, page } = await newPage('信息科管理员');
  await page.click('[data-testid="home-v1-side-workbench-connector"]');
  await page.waitForTimeout(500);
  await page.click('[data-testid="connector-card-dingtalk"]');
  await page.waitForTimeout(500);

  const cardText = await page.locator('[data-testid="connector-detail-dingtalk"]').textContent();
  check('异常:名称「钉钉」存在', /钉钉/.test(cardText || ''));
  check('异常:状态圆点红色', await page.locator('span[aria-label="异常"]').count() >= 1);
  check('异常:「重新授权」按钮存在', await page.locator('[data-testid="connector-detail-reauth"]').count() >= 1);
  check('异常:「禁用」按钮存在', await page.locator('[data-testid="connector-detail-disable"]').count() >= 1);

  await ctx.close();
}

// ─── 5. sidebar toggle 切回医小管对话区(再点一次连接器按钮) ───
{
  const { ctx, page } = await newPage('信息科管理员');
  await page.click('[data-testid="home-v1-side-workbench-connector"]');
  await page.waitForTimeout(500);
  check('中间连接器视图', await page.locator('[data-testid="home-v1-middle-connector"]').count() >= 1);

  // 再点一次 sidebar 连接器按钮 → toggle 切回 overview
  await page.click('[data-testid="home-v1-side-workbench-connector"]');
  await page.waitForTimeout(500);
  check('toggle 后中间视图标记消失', await page.locator('[data-testid="home-v1-middle-connector"]').count() === 0);
  check('toggle 后无连接器卡片', await page.locator('[data-testid^="connector-card-"]:not([data-testid*="-action"]):not([data-testid*="-state"])').count() === 0);
  check('URL 保持 overview', /\/app\/home\/overview$/.test(page.url()));
  check('对话区输入框仍存在', await page.locator('[data-testid="home-v1-input"]').count() >= 1);

  await ctx.close();
}

// ─── 5b. 嵌入视图下点 sidebar「新建任务」必须切回对话区 ───
{
  const { ctx, page } = await newPage('信息科管理员');
  await page.click('[data-testid="home-v1-side-workbench-connector"]');
  await page.waitForTimeout(500);
  check('中间连接器视图', await page.locator('[data-testid="home-v1-middle-connector"]').count() >= 1);

  // 关键回归:连接器视图下点「新建任务」必须切回对话区,不能停留在连接器
  await page.click('[data-testid="home-v1-side-workbench-new"]');
  await page.waitForTimeout(500);
  check('连接器视图下点新建任务 → 切回对话区', await page.locator('[data-testid="home-v1-middle-connector"]').count() === 0);
  check('对话区输入框仍存在', await page.locator('[data-testid="home-v1-input"]').count() >= 1);

  await ctx.close();
}

// ─── 6. 独立路由 /app/home/connector 仍可用 ───
{
  const { ctx, page } = await newPage('信息科管理员');
  await page.goto(`${BASE}/app/home/connector`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(800);
  check('独立路由 8 张卡片', await page.locator('[data-testid^="connector-card-"]:not([data-testid*="-action"]):not([data-testid*="-state"])').count() === 8);

  await ctx.close();
}

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n══════ 连接器中间视图 verify: ${results.length - failed.length}/${results.length} PASS ══════`);
if (failed.length) {
  console.log('失败项:');
  failed.forEach((r) => console.log(`  - ${r.name}`));
  process.exit(1);
}