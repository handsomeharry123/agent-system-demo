/**
 * 台账中心智能化升级 PRD — 信息科管理员欢迎语 3 案例走查
 *
 * 覆盖：
 *   1. 台账总览首页：气泡提示 + 窗口内欢迎语 + 生成报告/订阅速读/推荐问句
 *   2. 智能体详情页(360 画像)：专属气泡提示 + 窗口内欢迎语 + 下钻/切换/唤起对话
 *   3. 台账其他页面：不弹气泡；点击机器人后窗口内展示台账速览与动作入口
 *
 * 用法：
 *   BASE_URL=http://127.0.0.1:3001 node verify_ledger_admin_welcome_prd.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';
const OUT = join(process.cwd(), 'verify_ledger_admin_welcome_prd_artefacts');
mkdirSync(OUT, { recursive: true });

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` -- ${detail}` : ''}`);
}

async function setDemoRole(page) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const cur = JSON.parse(localStorage.getItem('demo_settings_v1') || '{}');
    localStorage.setItem(
      'demo_settings_v1',
      JSON.stringify({
        demoRole: '信息科管理员',
        visibleModules: cur.visibleModules || {},
        visibleSubPages: cur.visibleSubPages || {},
      }),
    );
    sessionStorage.clear();
  });
}

async function expectBodyIncludes(page, name, text) {
  const bodyText = await page.locator('body').innerText({ timeout: 5000 });
  record(name, bodyText.includes(text), text);
}

async function expectBodyMatches(page, name, pattern) {
  const bodyText = await page.locator('body').innerText({ timeout: 5000 });
  record(name, pattern.test(bodyText), pattern.toString());
}

async function expectTestIdVisible(page, name, testId) {
  const locator = page.getByTestId(testId);
  const visible = await locator.first().isVisible({ timeout: 5000 }).catch(() => false);
  record(name, visible, testId);
}

async function newAdminPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await setDemoRole(page);
  return { ctx, page };
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

try {
  // Case 1: 台账总览首页
  {
    const { ctx, page } = await newAdminPage(browser);
    await page.goto(`${BASE}/app/ledger`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.getByTestId('ledger-status-bubble').waitFor({ timeout: 8000 });

    await expectBodyIncludes(page, 'Case1.1 总览页气泡标题为台账速览', '医小管 · 台账速览');
    await expectBodyIncludes(page, 'Case1.2 总览页气泡使用 PRD 问候', '你好，我是医小管！这是今日全院智能体台账速览');
    await expectBodyIncludes(page, 'Case1.3 总览页气泡含全院智能体指标', '全院智能体');
    await expectBodyIncludes(page, 'Case1.4 总览页气泡含本月新增纳管', '本月新增纳管');
    await expectBodyIncludes(page, 'Case1.5 总览页气泡含评测与风险指标', '待评测');
    await expectBodyIncludes(page, 'Case1.6 总览页气泡含报告动作', '生成报告');
    await expectBodyIncludes(page, 'Case1.7 总览页气泡含订阅动作', '订阅速读');

    await page.getByTestId('ledger-bubble-open-chat').click({ force: true });
    await page.getByTestId('ledger-chat-panel').waitFor({ timeout: 8000 });
    await expectBodyIncludes(page, 'Case1.8 窗口内欢迎语为台账问答入口', '台账相关问题都可以直接问我');
    await expectBodyIncludes(page, 'Case1.9 窗口内展示推荐问题说明', '推荐问题（欢迎语下方展示，点击即问）');
    await expectBodyIncludes(page, 'Case1.10 推荐问题：当前告警', '当前哪些智能体正在告警？');
    await expectBodyIncludes(page, 'Case1.11 推荐问题：科室不可用', '我科室哪个智能体现在不能用？');
    await expectBodyIncludes(page, 'Case1.12 推荐问题：查看 360 画像', '我想要查看【某智能体】的 360 画像');
    await expectBodyIncludes(page, 'Case1.13 推荐问题：今日报告', '请帮我生成今日全院智能体管理报告');
    await expectTestIdVisible(page, 'Case1.14 窗口内附带【生成报告】按钮', 'ledger-chat-guide-action-report');
    await expectTestIdVisible(page, 'Case1.15 窗口内附带【订阅速读】按钮', 'ledger-chat-guide-action-subscribe');
    await expectTestIdVisible(page, 'Case1.16 窗口内附带【查看告警】按钮', 'ledger-chat-guide-action-alerts');
    await expectTestIdVisible(page, 'Case1.17 窗口内附带【当前告警问答】按钮', 'ledger-chat-guide-action-ask-alerts');
    await page.getByTestId('ledger-chat-guide-action-ask-alerts').click({ force: true });
    await page.waitForTimeout(900);
    await expectBodyIncludes(page, 'Case1.18 点击窗口内问答按钮后触发聚合作答', '根据监控中心最新事件');
    await page.screenshot({ path: join(OUT, '01-overview-chat.png'), fullPage: false });

    await ctx.close();
  }

  // Case 1b: 台账列表页与总览同款窗口内动作
  {
    const { ctx, page } = await newAdminPage(browser);
    await page.goto(`${BASE}/app/ledger/list`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.getByTestId('ledger-status-bubble').waitFor({ timeout: 8000 });
    await page.getByTestId('ledger-bubble-open-chat').click({ force: true });
    await page.getByTestId('ledger-chat-panel').waitFor({ timeout: 8000 });
    await expectBodyIncludes(page, 'Case1b.1 列表页窗口内欢迎语为台账问答入口', '台账相关问题都可以直接问我');
    await expectTestIdVisible(page, 'Case1b.2 列表页窗口内附带【生成报告】按钮', 'ledger-chat-guide-action-report');
    await expectTestIdVisible(page, 'Case1b.3 列表页窗口内附带【订阅速读】按钮', 'ledger-chat-guide-action-subscribe');
    await expectTestIdVisible(page, 'Case1b.4 列表页窗口内附带【查看告警】按钮', 'ledger-chat-guide-action-alerts');
    await page.screenshot({ path: join(OUT, '01b-list-chat.png'), fullPage: false });
    await ctx.close();
  }

  // Case 2: 智能体详情页(360 画像)
  {
    const { ctx, page } = await newAdminPage(browser);
    await page.goto(`${BASE}/app/ledger/detail/AGT-2024-001`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    await page.getByTestId('ledger-status-bubble').waitFor({ timeout: 8000 });

    await expectBodyIncludes(page, 'Case2.1 详情页气泡标题为 360 画像', '医小管 · 360 画像');
    await expectBodyIncludes(page, 'Case2.2 详情页气泡含智能体名称', '【互联网医院智能问诊助手】');
    await expectBodyIncludes(page, 'Case2.3 详情页气泡含聚合范围', '基本信息、关联资源拓扑、准入评测与运行监测');
    await expectBodyIncludes(page, 'Case2.4 详情页气泡含异常对接数', '异常对接');
    await expectBodyIncludes(page, 'Case2.5 详情页气泡含下钻动作', '下钻明细');
    await expectBodyIncludes(page, 'Case2.6 详情页气泡含视图切换动作', '360 / 信息详情');
    await expectBodyIncludes(page, 'Case2.7 详情页气泡含唤起对话动作', '唤起对话');

    await page.getByTestId('ledger-bubble-action-chat').click({ force: true });
    await page.getByTestId('ledger-chat-panel').waitFor({ timeout: 8000 });
    await expectBodyIncludes(page, 'Case2.8 详情页窗口内欢迎语含 360 画像', '这是【互联网医院智能问诊助手】的 360 画像');
    await expectBodyIncludes(page, 'Case2.9 详情页窗口内欢迎语含运行监测信息', '运行监测信息');
    await expectBodyIncludes(page, 'Case2.10 详情页窗口内推荐问题：使用效果', '它最近的使用效果怎么样？');
    await expectBodyIncludes(page, 'Case2.11 详情页窗口内推荐问题：谁用得最多', '本科室谁用它用得最多？');
    await expectBodyIncludes(page, 'Case2.12 详情页窗口内推荐问题：适合场景', '它适合处理哪些场景？');
    await expectBodyIncludes(page, 'Case2.13 详情页窗口内推荐问题：告警故障', '最近有没有告警或故障记录？');
    await expectTestIdVisible(page, 'Case2.14 详情页窗口内附带【下钻明细】按钮', 'ledger-chat-guide-action-drill');
    await expectTestIdVisible(page, 'Case2.15 详情页窗口内附带【360 / 信息详情】按钮', 'ledger-chat-guide-action-switch-view');
    await expectTestIdVisible(page, 'Case2.16 详情页窗口内附带【唤起问答】按钮', 'ledger-chat-guide-action-ask-detail');
    await page.getByTestId('ledger-chat-guide-action-ask-detail').click({ force: true });
    await page.waitForTimeout(900);
    await expectBodyIncludes(page, 'Case2.17 点击详情页窗口内问答按钮后触发告警故障回答', '根据监控中心最新事件');
    await page.screenshot({ path: join(OUT, '02-detail-chat.png'), fullPage: false });
    await ctx.close();
  }

  // Case 3: 台账其他页面(风险分级页作为“台账全部页面”代表)
  {
    const { ctx, page } = await newAdminPage(browser);
    await page.goto(`${BASE}/app/ledger/risk/AGT-2024-001`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    await page.waitForTimeout(1200);
    const bubbleCount = await page.getByTestId('ledger-status-bubble').count();
    record('Case3.1 台账其他页面不主动弹气泡', bubbleCount === 0, `bubbleCount=${bubbleCount}`);

    await page.locator('[aria-label="唤起医小管(台账助手)"]').click({ force: true });
    await page.getByTestId('ledger-chat-panel').waitFor({ timeout: 8000 });
    await expectBodyIncludes(page, 'Case3.2 其他页面窗口内展示台账速览', '这是今日全院智能体台账速览');
    await expectBodyIncludes(page, 'Case3.3 其他页面窗口内含新增纳管', '本月新增纳管');
    await expectBodyMatches(page, 'Case3.4 其他页面窗口内含告警/故障/恢复', /今日告警\s*12\s*次.*故障\s*3\s*次.*已恢复\s*7\s*次/s);
    await expectBodyIncludes(page, 'Case3.5 其他页面窗口内含生成报告入口', '生成报告');
    await expectBodyIncludes(page, 'Case3.6 其他页面窗口内含订阅速读入口', '订阅速读');
    await expectTestIdVisible(page, 'Case3.7 其他页面窗口内附带【生成报告】按钮', 'ledger-chat-guide-action-report');
    await expectTestIdVisible(page, 'Case3.8 其他页面窗口内附带【订阅速读】按钮', 'ledger-chat-guide-action-subscribe');
    await expectTestIdVisible(page, 'Case3.9 其他页面窗口内附带【查看告警】按钮', 'ledger-chat-guide-action-alerts');
    await page.screenshot({ path: join(OUT, '03-global-chat.png'), fullPage: false });
    await ctx.close();
  }
} finally {
  await browser.close();
}

const failed = results.filter((item) => !item.pass);
console.log(JSON.stringify({ total: results.length, failed: failed.length, results }, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
