/**
 * PRD welcome copy walkthrough - 科室管理员 / 台账中心 4 个页面口径
 *
 * 3 cases:
 *   1. 本科室台账总览首页: 气泡提示 + 窗口内欢迎语 + 指标/报告/速读/提问动作
 *   2. 本科室台账列表页: 气泡提示 + 窗口内欢迎语 + 检索/筛选/详情/提问动作
 *   3. 智能体详情页 + 台账全部页面: 360 专属动作 + 全局同步态势/聚合作答下钻动作
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173';
const OUT = join(process.cwd(), 'verify_ledger_dept_prd_welcome_artefacts');
mkdirSync(OUT, { recursive: true });

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' -- ' + detail : ''}`);
}

async function setDemoRole(page) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const cur = JSON.parse(localStorage.getItem('demo_settings_v1') || '{}');
    localStorage.setItem(
      'demo_settings_v1',
      JSON.stringify({
        demoRole: '科室管理员',
        visibleModules: cur.visibleModules || {},
        visibleSubPages: cur.visibleSubPages || {},
      }),
    );
  });
}

async function fixedText(page, marker) {
  return page.evaluate((m) => {
    const fixedDivs = Array.from(document.querySelectorAll('div[style*="position: fixed"]'));
    const target = fixedDivs.find((d) => (d.textContent || '').includes(m));
    return target ? (target.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }, marker);
}

async function closeBubble(page) {
  const btn = page.locator('div[style*="position: fixed"] button[aria-label="关闭"]').first();
  if ((await btn.count()) > 0) {
    await btn.click({ force: true });
    await page.waitForTimeout(300);
  }
}

async function openChat(page) {
  await closeBubble(page);
  await page.locator('[aria-label="唤起医小管(台账助手)"]').first().click({ force: true });
  await page.waitForTimeout(900);
  return fixedText(page, '本科室数据权限');
}

async function closeChat(page) {
  const chatClose = page.locator('button:has(.anticon-close)').first();
  if ((await chatClose.count()) > 0) {
    await chatClose.click({ force: true });
    await page.waitForTimeout(500);
  }
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

try {
  await setDemoRole(page);

  // Case 1 - 本科室台账总览首页
  await page.goto(`${BASE}/app/ledger`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1400);
  const overviewBubble = await fixedText(page, '医小管 · 台账速览');
  record('Case1 气泡: 总览页显示本科室今日使用速览', overviewBubble.includes('这是本科室智能体今日使用速览'));
  record('Case1 气泡: 含本科室指标', /本科室智能体.*本月新增.*本月调用量.*正常运行率/.test(overviewBubble), overviewBubble);
  record('Case1 气泡: 含风险与评测中', /今日.*告警.*故障.*已恢复.*评测中/.test(overviewBubble));
  record('Case1 气泡: 科室动作仅唤起对话,无报告/订阅按钮', overviewBubble.includes('直接向我提问') && !overviewBubble.includes('生成报告') && !overviewBubble.includes('订阅速读'));
  await page.screenshot({ path: join(OUT, 'case1-overview-bubble.png'), fullPage: false });

  const overviewChat = await openChat(page);
  record('Case1 窗口: 标题权限为本科室', overviewChat.includes('本科室数据权限'));
  record('Case1 窗口: 欢迎语为 PRD 科室口径', overviewChat.includes('顶部是本科室今日使用速览') && overviewChat.includes('作答限于本科室授权范围'));
  record('Case1 窗口: 推荐问句齐全', overviewChat.includes('哪个智能体本月用得最多') && overviewChat.includes('我科室哪个智能体现在不能用') && overviewChat.includes('查看【某智能体】的 360 画像'));
  record('Case1 窗口: 附带总览引导动作', overviewChat.includes('查看本科室告警') && overviewChat.includes('生成报告') && overviewChat.includes('订阅速读') && overviewChat.includes('唤起对话提问'));
  await page.screenshot({ path: join(OUT, 'case1-overview-chat.png'), fullPage: false });

  // Case 2 - 本科室台账列表页
  await page.goto(`${BASE}/app/ledger/list`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1400);
  const listBubble = await fixedText(page, '医小管 · 台账速览');
  record('Case2 气泡: 列表页同样显示本科室使用速览', listBubble.includes('这是本科室智能体今日使用速览'));
  record('Case2 气泡: 列表页不出现待评测/全院口径', !listBubble.includes('待评测') && !listBubble.includes('全院智能体'));
  record('Case2 页面: 列表具备检索/筛选/详情入口', (await page.locator('text=检索').count()) > 0 || (await page.locator('text=详情').count()) > 0);
  await page.screenshot({ path: join(OUT, 'case2-list-bubble.png'), fullPage: false });

  const listChat = await openChat(page);
  record('Case2 窗口: 列表页欢迎语仍为科室口径', listChat.includes('科室台账直接问我') && listChat.includes('作答限于本科室授权范围'));
  record('Case2 窗口: 有同步态势指标可下钻', listChat.includes('本月调用量') && listChat.includes('正常运行率') && listChat.includes('点击查看告警清单'));
  record('Case2 窗口: 附带列表引导动作', listChat.includes('检索智能体') && listChat.includes('筛选 / 排序') && listChat.includes('进入 360 画像') && listChat.includes('本科室台账问答'));
  await page.screenshot({ path: join(OUT, 'case2-list-chat.png'), fullPage: false });
  await closeChat(page);

  // Case 3 - 智能体详情页(360 画像视图)
  await page.goto(`${BASE}/app/ledger/detail/AGT-2025-002`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1400);
  const detailBubble = await fixedText(page, '医小管 · 360 画像');
  record('Case3 气泡: 详情页显示 360 画像专属文案', detailBubble.includes('心血管辅助诊断系统') && detailBubble.includes('360 画像'));
  record('Case3 气泡: 含可用状态/本科室调用/告警/故障', detailBubble.includes('当前可用状态') && detailBubble.includes('本月本科室调用') && detailBubble.includes('当前告警') && detailBubble.includes('故障'));
  record('Case3 气泡: 含下钻/切换/问答按钮', detailBubble.includes('下钻明细') && detailBubble.includes('360 / 信息详情') && detailBubble.includes('唤起对话'));
  await page.screenshot({ path: join(OUT, 'case3-detail-bubble.png'), fullPage: false });

  const detailChat = await openChat(page);
  record('Case3 窗口: 详情页欢迎语为 360 画像专属', detailChat.includes('心血管辅助诊断系统') && detailChat.includes('360 画像') && detailChat.includes('需要我带你下钻查看吗'));
  record('Case3 窗口: 详情页推荐问句齐全', detailChat.includes('它最近的使用效果怎么样') && detailChat.includes('本科室谁用它用得最多') && detailChat.includes('最近有没有告警或故障记录'));
  record('Case3 窗口: 附带详情引导动作', detailChat.includes('下钻明细') && detailChat.includes('360 / 信息详情') && detailChat.includes('唤起问答'));
  await page.screenshot({ path: join(OUT, 'case3-detail-chat.png'), fullPage: false });

  await closeChat(page);

  // Case 3b - 台账全部页面(非总览/列表/详情，例如风险分级页)
  await page.goto(`${BASE}/app/ledger/risk/AGT-2025-002`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(900);
  const globalChat = await openChat(page);
  record('Case3b 全部页面窗口: 显示本科室同步态势欢迎语', globalChat.includes('这是本科室智能体今日使用速览') && globalChat.includes('建议优先关注影响使用的告警与故障'));
  record('Case3b 全部页面窗口: 附带同步态势/聚合作答下钻动作', globalChat.includes('同步态势分流') && globalChat.includes('聚合作答下钻') && globalChat.includes('本科室智能体'));
  await page.screenshot({ path: join(OUT, 'case3b-global-chat.png'), fullPage: false });
} catch (err) {
  console.log('[FATAL]', err.message);
  console.log(err.stack);
  results.push({ name: 'FATAL', pass: false, detail: err.message });
} finally {
  await browser.close();
}

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass).length;
console.log(`\nSummary: PASS ${passed} / ${results.length}; FAIL ${failed}`);
console.log(`Artefacts: ${OUT}`);
process.exit(failed > 0 ? 1 : 0);
