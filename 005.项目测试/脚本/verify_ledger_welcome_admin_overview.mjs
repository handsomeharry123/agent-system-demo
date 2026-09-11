/**
 * PRD §3.1.1 — 信息科管理员 / 台账总览首页 欢迎语用例
 *
 * 验证要点：
 *   1. 进入 /app/ledger，自动弹出「医小管 · 台账速览」非打断气泡
 *   2. 气泡文案覆盖：全院智能体 X / 本月新增纳管 X / 待评测 X / 评测中 X / 告警 X / 故障 X / 已恢复 X
 *   3. 含【生成报告】【订阅速读】两个汇报引导按钮（PRD §3.1.1 + §3.3.1）
 *   4. 含「直接向我提问」对话引导 + 推荐问句入口
 *   5. 关键指标名称加粗可点击分流（点击全院智能体→/app/ledger/list）
 *   6. 点击【生成报告】→ 跳转 /app/ledger-demo/report
 *   7. 点击【订阅速读】→ 跳转 /app/ledger-demo/report?openSubscribe=1
 *   8. 详情/报告页不重复弹气泡（避免遮挡编辑）
 *
 * 用法：node verify_ledger_welcome_admin_overview.mjs
 * 输出：JSON 到 stdout + exit code 0=PASS / 1=FAIL
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';
const OUT = join(process.cwd(), 'verify_ledger_welcome_admin_overview_artefacts');
mkdirSync(OUT, { recursive: true });

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? '  -- ' + detail : ''}`);
}

/**
 * 切演示角色（信息科管理员 / 科室管理员）
 * - 写入 localStorage[demo_settings_v1].demoRole
 * - reload 后 useDemoSettings / AgentFloatHost 同步更新
 */
async function setDemoRole(page, role) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((r) => {
    const cur = JSON.parse(localStorage.getItem('demo_settings_v1') || '{}');
    const next = {
      demoRole: r,
      visibleModules: cur.visibleModules || {},
      visibleSubPages: cur.visibleSubPages || {},
    };
    localStorage.setItem('demo_settings_v1', JSON.stringify(next));
  }, role);
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

try {
  // --- 准备：设为信息科管理员 ---
  await setDemoRole(page, '信息科管理员');

  // ==== Case 1: 进入总览首页 → 弹出气泡欢迎语 ====
  await page.goto(`${BASE}/app/ledger`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  // PRD §3.1.1:气泡由 StatusBubbleV31 渲染,头部标题「医小管 · 台账速览」
  //   注意:此处只会在 StatusBubbleV31 自身标题里出现"医小管 · 台账速览",
  //   而非 AgentFloatHost 内的 robot hover tip("医小管 · 台账助手"),所以必须包含「速览」字样
  const bubbleTitle = await page.$('text=医小管 · 台账速览');
  record('Case1.1 进入总览首页弹气泡（含「医小管 · 台账速览」）', !!bubbleTitle);

  // scope tag 全院(信息科管理员 = 全院数据)
  const scopeTag = await page.$('text=全院');
  record('Case1.2 气泡 scope 角标 = 全院', !!scopeTag);

  // 问候开场
  const greeting = await page.$('text=您好,这是今日');
  const tailAdmin = await page.$('text=台账速览');
  record('Case1.3 气泡问候开场', !!greeting);
  record('Case1.3 气泡使用「台账速览」话术(管理员口径)', !!tailAdmin);

  // 整体概况:全院智能体 X 个 + 本月新增纳管 X 个
  const totalAllAgents = await page.$('strong:has-text("全院智能体")');
  const monthNewText = await page.$('text=本月新增纳管');
  record('Case1.4 气泡含「全院智能体」指标(管理员口径)', !!totalAllAgents);
  record('Case1.4 气泡含「本月新增纳管」指标', !!monthNewText);

  // 评测进度:待评测 X + 评测中 X(管理员才显示「待评测」)
  const pendingEval = await page.$('text=待评测');
  const evaluating = await page.$('text=评测中');
  record('Case1.5 气泡含「待评测」指标(管理员专属)', !!pendingEval);
  record('Case1.5 气泡含「评测中」指标', !!evaluating);

  // 运行风险:今日告警 X 次 + 故障 X 次 + 已恢复 X 次
  const alarm = await page.$('text=今日告警');
  const fault = await page.$('text=故障');
  const recovered = await page.$('text=已恢复');
  record('Case1.6 气泡含「今日告警」指标', !!alarm);
  record('Case1.6 气泡含「故障」指标', !!fault);
  record('Case1.6 气泡含「已恢复」指标', !!recovered);

  // 重点提示:建议优先处理告警与故障
  const hint = await page.$('text=建议优先处理告警与故障');
  record('Case1.7 气泡含「建议优先处理告警与故障」提示', !!hint);

  // 汇报引导按钮:生成报告 + 订阅速读
  const btnGen = await page.$('button:has-text("生成报告")');
  const btnSub = await page.$('button:has-text("订阅速读")');
  record('Case1.8 气泡含【生成报告】按钮', !!btnGen);
  record('Case1.8 气泡含【订阅速读】按钮', !!btnSub);

  // 对话引导
  const chatAsk = await page.$('text=直接向我提问');
  const chatSample = await page.$('text=当前哪些智能体正在告警');
  record('Case1.9 气泡含「直接向我提问」链接', !!chatAsk);
  record('Case1.9 气泡示例问句 = 当前哪些智能体正在告警?(管理员口径)', !!chatSample);

  // 取一次截图存档
  await page.screenshot({ path: join(OUT, '01-overview-bubble.png'), fullPage: false });

  // ==== Case 2: 指标名称加粗可点击分流 ====
  //   整体概况中「全院智能体 X」是 MetricLink span,点击应 navigate 到 /app/ledger/list
  if (totalAllAgents) {
    // MetricLink 渲染为 <span style="cursor:pointer">全院智能体<strong>X</strong></span>
    // page.$('strong:has-text("全院智能体")') 匹配的是 <strong> 全院智能体 </strong> 内部文本
    // 但 strong 自身没有 onClick,需要点外层可点击 span。
    // 改为 evaluate 直接定位 cursor:pointer 的 span 触发 .click()
    const clicked = await page.evaluate(() => {
      const all = Array.from(
        document.querySelectorAll('div[style*="position: fixed"] span'),
      );
      for (const el of all) {
        const t = (el.textContent || '').trim();
        const cs = window.getComputedStyle(el);
        if (t.startsWith('全院智能体') && cs.cursor === 'pointer') {
          el.click();
          return true;
        }
      }
      return false;
    });
    if (!clicked) {
      record('Case2.1 点击「全院智能体」分流到 /app/ledger/list', false, '未找到可点击的指标 span');
    } else {
      await page.waitForTimeout(1500);
      const url = page.url();
      record(
        'Case2.1 点击「全院智能体」分流到 /app/ledger/list',
        url.includes('/app/ledger/list'),
        `URL = ${url}`,
      );
    }
  } else {
    record('Case2.1 点击「全院智能体」分流到 /app/ledger/list', false, '未找到指标节点');
  }

  // ==== Case 3: 列表页同样展示汇报引导按钮 ====
  await page.goto(`${BASE}/app/ledger/list`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  const listBubble = await page.$('text=医小管 · 台账速览');
  const listGen = await page.$('button:has-text("生成报告")');
  const listSub = await page.$('button:has-text("订阅速读")');
  record('Case3.1 台账列表页也弹出统一欢迎气泡', !!listBubble);
  record('Case3.2 列表页气泡含【生成报告】按钮', !!listGen);
  record('Case3.2 列表页气泡含【订阅速读】按钮', !!listSub);
  await page.screenshot({ path: join(OUT, '03-list-bubble.png'), fullPage: false });

  // ==== Case 4: 点击【生成报告】→ /app/ledger-demo/report ====
  if (listGen) {
    await listGen.click({ force: true });
    await page.waitForTimeout(1500);
    const url = page.url();
    record(
      'Case4.1 点击【生成报告】跳转 /app/ledger-demo/report',
      url.includes('/app/ledger-demo/report'),
      `URL = ${url}`,
    );
  } else {
    record('Case4.1 点击【生成报告】跳转 /app/ledger-demo/report', false);
  }

  // 报告编辑页不应该重复弹态势汇报气泡(避免遮挡编辑)
  await page.waitForTimeout(800);
  const reportBubble = await page.$('text=医小管 · 台账速览');
  record('Case4.2 报告编辑页不再弹态势汇报气泡(避免遮挡)', !reportBubble);
  await page.screenshot({ path: join(OUT, '04-report-no-bubble.png'), fullPage: false });

  // ==== Case 5: 回到列表页,点击【订阅速读】→ /app/ledger-demo/report?openSubscribe=1 ====
  //   用全新 page + hard reload 确保 AgentFloatHost 重新挂载、气泡重新弹
  await page.goto(`${BASE}/app/ledger/list`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: join(OUT, '05-list-bubble-before-sub.png'), fullPage: false });
  // 重新打开气泡(per-page dismiss 后刷新或重新进入会再弹)
  // 用 .locator(...).first() 避免选中侧栏/导航里同名词,只用气泡内的
  const subBtn = page.locator('div[style*="position: fixed"] button:has-text("订阅速读")').first();
  const subBtnCount = await subBtn.count();
  if (subBtnCount > 0) {
    await subBtn.click({ force: true });
    // 等待 navigate + ReportV33 useSearchParams 消费 openSubscribe=1 完成
    await page.waitForTimeout(2500);
    const url = page.url();
    // URL 可能短暂含 openSubscribe=1,但 ReportV33 立刻把它消费掉并 setSearchParams(next, { replace: true })
    //   PRD §3.3:订阅入口联动 Drawer,URL 仅为内部触发器,落地后 URL 应是 /report
    record(
      'Case5.1 点击【订阅速读】导航到 /app/ledger-demo/report(URL 已被 ReportV33 消费)',
      url.includes('/app/ledger-demo/report'),
      `URL = ${url}`,
    );
    // 顺手验证 ReportV33 收到了 openSubscribe=1 触发了速读订阅 Drawer
    //   - Drawer 标题包含「台账速读订阅」(admin 视角 = 全院台账速读订阅)
    const subscribeDrawer = await page.$('text=台账速读订阅');
    record('Case5.2 进入报告页后自动打开速读订阅 Drawer', !!subscribeDrawer);
  } else {
    record('Case5.1 点击【订阅速读】跳转 /app/ledger-demo/report', false, '未找到按钮');
  }

  // ==== Case 6: 关闭按钮可工作 ====
  await page.goto(`${BASE}/app/ledger`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  const bubbleBefore = await page.$('text=医小管 · 台账速览');
  const closeBtn = await page.$('button[aria-label="关闭"]');
  if (closeBtn && bubbleBefore) {
    await closeBtn.click({ force: true });
    await page.waitForTimeout(500);
    const bubbleAfter = await page.$('text=医小管 · 台账速览');
    record('Case6.1 点击关闭按钮可关闭气泡', !bubbleAfter);
  } else {
    record('Case6.1 点击关闭按钮可关闭气泡', false, '缺少关闭按钮或气泡');
  }
} catch (err) {
  console.log('[FATAL]', err.message);
  console.log(err.stack);
  results.push({ name: 'FATAL', pass: false, detail: err.message });
} finally {
  await browser.close();
}

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass).length;
console.log(`\n====== Summary ======`);
console.log(`PASS ${passed} / ${results.length} ;FAIL ${failed}`);
console.log(`Artefacts at: ${OUT}`);
process.exit(failed > 0 ? 1 : 0);