/**
 * PRD §3.2.2 + §3.1.2 — 信息科管理员 / 智能体详情页(360 画像)欢迎语用例
 *
 * 验证要点：
 *   1. 进入 /app/ledger/detail/:id,自动弹出欢迎气泡(由 AgentFloatHost 触发)
 *   2. 气泡 scope 角标 = 全院(管理员)
 *   3. 详情页 Segmented 切换「360 画像视图 ↔ 信息详情页」可见(详情页默认 360)
 *   4. 360 画像视图呈现 4 大区块:实体信息 / 关联资源拓扑 / 准入评测 / 运行监测
 *   5. 关联资源拓扑图:中心智能体 + 周围数据系统(HIS/PACS/LIS/EMR)+ 异常连接醒目提示
 *   6. 关闭气泡后,点击右下角机器人唤起 Agent 对话窗口(ChatPanelV31)
 *   7. 对话窗口欢迎语含关键指标 + 推荐问句(§3.1.2)
 *   8. 点击推荐问句「当前哪些智能体正在告警?」能发送并触发 agent 回复
 *   9. 对话窗口顶部副标题 = 「全院数据权限 · 跨中心聚合」(admin 口径)
 *  10. 对话窗口欢迎消息内含可点击的指标链接(无卡片)
 *
 * 用法：node verify_ledger_welcome_admin_360.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';
const OUT = join(process.cwd(), 'verify_ledger_welcome_admin_360_artefacts');
mkdirSync(OUT, { recursive: true });

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? '  -- ' + detail : ''}`);
}

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
  // --- 准备：信息科管理员 ---
  await setDemoRole(page, '信息科管理员');

  // ==== Case 1: 进入详情页(360 画像)→ 弹气泡欢迎语 ====
  //   详情页欢迎语:AgentFloatHost 触发 StatusBubbleV31,文案与总览同源(全院口径)
  //   详情页真实路径: /app/ledger/detail/:id(idCode / mock 中 id)
  //   选 mock 中真实存在的 id(Detail 用 ledgerAgents.find)
  await page.goto(`${BASE}/app/ledger/detail/AGT-2024-001`, {
    waitUntil: 'networkidle',
    timeout: 30000,
  });
  await page.waitForTimeout(1800);

  const bubbleTitle = await page.$('text=医小管 · 台账速览');
  record('Case1.1 进入详情页弹气泡欢迎语(由 AgentFloatHost 触发)', !!bubbleTitle);

  const bubbleScope = await page.evaluate(() => {
    const fixedDivs = document.querySelectorAll('div[style*="position: fixed"]');
    for (const d of fixedDivs) {
      if ((d.textContent || '').includes('医小管 · 台账速览')) {
        const scopeTags = d.querySelectorAll('span');
        for (const s of scopeTags) {
          const st = (s.textContent || '').trim();
          if (st === '全院' || st === '本科室') return st;
        }
      }
    }
    return null;
  });
  record('Case1.2 详情页气泡 scope 角标 = 全院(管理员)', bubbleScope === '全院', `scope = ${bubbleScope}`);

  // 详情页同样有生成报告 / 订阅速读按钮(同一条统一气泡 PRD §3.1.1)
  const btnGen = await page.$('div[style*="position: fixed"] button:has-text("生成报告")');
  const btnSub = await page.$('div[style*="position: fixed"] button:has-text("订阅速读")');
  record('Case1.3 详情页气泡含【生成报告】按钮', !!btnGen);
  record('Case1.3 详情页气泡含【订阅速读】按钮', !!btnSub);

  await page.screenshot({ path: join(OUT, '01-detail-bubble.png'), fullPage: false });

  // ==== Case 2: 详情页默认展示 360 画像视图 ====
  //   PRD §3.2.2:详情页默认展示本次新增的「360 画像视图」
  //   Segmented 切到「360 画像视图」/「信息详情页」
  const seg360 = await page.$('text=360 画像视图');
  record('Case2.1 详情页含「360 画像视图」视图切换', !!seg360);

  // ==== Case 3: 360 画像视图 4 大区块 ====
  //   ProfileView360 Card title="① 实体信息" / "② 关联资源拓扑" / "③ 准入评测" / "④ 运行监测"
  const entity = await page.$('text=实体信息');
  const topo = await page.$('text=关联资源拓扑');
  const eval_ = await page.$('text=准入评测');
  const monitor = await page.$('text=运行监测');
  record('Case3.1 360 画像含「实体信息」区块', !!entity);
  record('Case3.1 360 画像含「关联资源拓扑」区块', !!topo);
  record('Case3.1 360 画像含「准入评测」区块', !!eval_);
  record('Case3.1 360 画像含「运行监测」区块', !!monitor);

  // 关联资源拓扑图:中心放射式 SVG / 资源名(HIS / PACS / LIS / EMR)
  const resourceInSvg = await page.evaluate(() => {
    // 详情页有 SVG 拓扑图,文字标签是 <text> svg 节点
    const texts = Array.from(document.querySelectorAll('svg text'));
    const labels = texts.map((t) => (t.textContent || '').trim());
    const all = labels.join('|');
    // 应包含至少一个数据系统名(HIS / PACS / LIS / EMR)
    const hasResource =
      all.includes('HIS') ||
      all.includes('PACS') ||
      all.includes('LIS') ||
      all.includes('EMR') ||
      all.includes('院内知识库');
    return { labels: labels.slice(0, 12), hasResource };
  });
  record(
    'Case3.2 关联资源拓扑含数据系统节点(HIS/PACS/LIS/EMR/院内知识库 等)',
    resourceInSvg.hasResource,
    `节点: ${resourceInSvg.labels.join(' | ')}`,
  );

  // ==== Case 4: 关闭气泡后,点击机器人唤起 Agent 对话窗口 ====
  //   AgentFloatHost 机器人 wrapper:aria-label="唤起医小管(台账助手)" + svg
  //   先关闭气泡(避免遮挡机器人)
  const closeBtn = await page.$('div[style*="position: fixed"] button[aria-label="关闭"]');
  if (closeBtn) {
    await closeBtn.click({ force: true });
    await page.waitForTimeout(400);
  }
  const bubbleAfterClose = await page.$('text=医小管 · 台账速览');
  record('Case4.1 关闭按钮可关闭气泡', !bubbleAfterClose);

  // 点击机器人:AgentFloatHost wrapper 拥有 aria-label="唤起医小管(台账助手)"
  const robot = page.locator('[aria-label="唤起医小管(台账助手)"]').first();
  const robotCount = await robot.count();
  if (robotCount > 0) {
    await robot.click({ force: true });
    await page.waitForTimeout(1200);
  } else {
    record('Case4.2 点击机器人唤起对话窗口', false, '未找到机器人 wrapper');
  }

  // ==== Case 5: 对话窗口(CHAT_PANEL_WIDTH=480) 标题与副标题 ====
  //   顶栏:"医小管" + "全院数据权限 · 跨中心聚合"(admin)
  const chatTitle = await page.$('text=医小管');
  const chatSubtitle = await page.$('text=全院数据权限 · 跨中心聚合');
  record('Case5.1 对话窗口显示「医小管」标题', !!chatTitle);
  record('Case5.2 对话窗口副标题 = 全院数据权限 · 跨中心聚合(admin 口径)', !!chatSubtitle);

  // ==== Case 6: 对话窗口欢迎语(PRD §3.1.2) ====
  //   - 一句式问候 + 关键指标 + 推荐问句
  //   - 含「全院智能体 X / 本月新增 / 待评测 / 评测中 / 告警 / 故障 / 恢复」可点击链接
  const welcomeText = await page.$('text=您好!我是');
  record('Case6.1 欢迎消息开头 = 您好!我是...(对话窗口内)', !!welcomeText);

  // 欢迎消息内含「全院智能体」作为可点击分流链接
  const linkAllAgents = await page.evaluate(() => {
    // ChatPanelV31 渲染链接为 div (padding 6px 8px, cursor:pointer, 蓝色边框)
    //   且包含「全院智能体」字样
    const divs = Array.from(document.querySelectorAll('div'));
    for (const d of divs) {
      const cs = window.getComputedStyle(d);
      const t = (d.textContent || '').trim();
      if (t.startsWith('全院智能体') && cs.cursor === 'pointer') {
        return t;
      }
    }
    return null;
  });
  record(
    'Case6.2 欢迎消息内含可点击的「全院智能体 X」分流链接(无卡片)',
    !!linkAllAgents,
    linkAllAgents || '未找到可点击指标',
  );

  // 推荐问句 chip
  const suggestAlerts = await page.$('text=当前哪些智能体正在告警');
  const suggestNew = await page.$('text=本月新增纳管的智能体');
  const suggestReport = await page.$('text=帮我生成全院管理情况报告');
  record('Case6.3 推荐问句含「当前哪些智能体正在告警?」(admin 口径)', !!suggestAlerts);
  record('Case6.3 推荐问句含「本月新增纳管的智能体」', !!suggestNew);
  record('Case6.3 推荐问句含「帮我生成全院管理情况报告」', !!suggestReport);

  await page.screenshot({ path: join(OUT, '02-detail-chat-open.png'), fullPage: false });

  // ==== Case 7: 点击推荐问句 → 触发问答流程 ====
  //   ChatPanelV31 中推荐问句用 antd Tag(蓝色)渲染,点击触发 handleSend
  if (suggestAlerts) {
    await suggestAlerts.click({ force: true });
    // mock 答案延迟 450ms
    await page.waitForTimeout(1200);
    // 用户消息气泡 + agent 回答气泡都会出现
    const userMsg = await page.$('text=当前哪些智能体正在告警');
    const agentReply = await page.evaluate(() => {
      // 限定到对话窗口(CHAT_PANEL_WIDTH=480) 内部查找,避免匹配到导航菜单
      const fixedDivs = document.querySelectorAll('div[style*="position: fixed"]');
      for (const d of fixedDivs) {
        const cs = window.getComputedStyle(d);
        const w = parseFloat(cs.width);
        if (Math.abs(w - 480) < 6) {
          const t = (d.textContent || '').trim();
          // mock 答案 key 1(告警):「根据监控中心最新事件,{scope}当前**有 X 条告警**未关闭...」
          if (t.includes('根据监控中心最新事件') && t.includes('告警')) {
            return t.slice(0, 120);
          }
        }
      }
      return null;
    });
    record('Case7.1 点击推荐问句后用户消息已发出', !!userMsg);
    record(
      'Case7.2 触发 agent 回答(mock 告警答案)',
      !!agentReply,
      agentReply || '未找到回答',
    );

    // 回答内应有「查看告警清单」下钻链接
    const drilldown = await page.$('text=查看告警清单');
    record('Case7.3 agent 回答内含「查看告警清单」下钻链接', !!drilldown);

    await page.screenshot({ path: join(OUT, '03-detail-chat-qa.png'), fullPage: false });
  } else {
    record('Case7.1 点击推荐问句后用户消息已发出', false, '推荐问句缺失');
  }

  // ==== Case 8: 关闭对话窗口 → 回到详情页 ====
  //   顶栏关闭按钮(antd Button with CloseOutlined)
  const chatCloseBtn = page.locator('button[aria-label="关闭"], button:has(.anticon-close)').first();
  // 备选定位:title="收起对话(不清空会话)"
  let chatClosed = false;
  if ((await chatCloseBtn.count()) > 0) {
    await chatCloseBtn.click({ force: true });
    chatClosed = true;
  } else {
    // 退而求其次:用 tooltip 文字定位
    const tipClose = page.locator('[aria-label*="收起"]').first();
    if ((await tipClose.count()) > 0) {
      await tipClose.click({ force: true });
      chatClosed = true;
    }
  }
  await page.waitForTimeout(800);
  // 对话窗口特征:固定右下角 + 480px 宽 + 标题含"医小管"
  const chatStillOpen = await page.evaluate(() => {
    const fixedDivs = document.querySelectorAll('div[style*="position: fixed"]');
    for (const d of fixedDivs) {
      const cs = window.getComputedStyle(d);
      const w = parseFloat(cs.width);
      if (Math.abs(w - 480) < 6 && (d.textContent || '').includes('医小管')) {
        return true;
      }
    }
    return false;
  });
  record('Case8.1 对话窗口可关闭', chatClosed && !chatStillOpen);
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