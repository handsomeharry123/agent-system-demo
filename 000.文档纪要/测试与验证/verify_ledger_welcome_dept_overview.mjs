/**
 * PRD §4.1.1 — 科室管理员 / 本科室台账总览首页 欢迎语用例
 *
 * 验证要点（科室用户口径 vs 管理员口径的差异点）：
 *   1. 进入 /app/ledger，自动弹出「医小管 · 台账速览」非打断气泡
 *   2. 气泡文案覆盖：本科室智能体 X / 本月新增 X / 本月调用量 X / 正常运行率 X% /
 *      评测中 X / 告警 X / 故障 X / 已恢复 X(不含「待评测」— §4.1.1 科室端无该指标)
 *   3. 重点提示话术：「建议优先关注影响使用的告警与故障」(本科室视角)
 *   4. 示例问句 = 「我科室哪个智能体现在不能用?」(本科室口径)
 *   5. scope 角标 = 本科室(非全院)
 *   6. 含【生成报告】【订阅速读】按钮 → 跳转 report 页(标题应为本科室应用成效小结)
 *   7. 列表页同样弹出本科室口径气泡(§3.1.1 + §4.1.1 同一条气泡)
 *
 * 用法：node verify_ledger_welcome_dept_overview.mjs
 * 输出：JSON 到 stdout + exit code 0=PASS / 1=FAIL
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';
const OUT = join(process.cwd(), 'verify_ledger_welcome_dept_overview_artefacts');
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
  // --- 准备：切换到科室管理员 ---
  await setDemoRole(page, '科室管理员');

  // ==== Case 1: 进入总览首页 → 弹出气泡欢迎语 ====
  await page.goto(`${BASE}/app/ledger`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1800);

  // 气泡头部标题
  const bubbleTitle = await page.$('text=医小管 · 台账速览');
  record('Case1.1 进入总览首页弹气泡(含「医小管 · 台账速览」)', !!bubbleTitle);

  // scope tag 本科室(科室用户 = 本科室数据)
  const scopeTag = await page.$('text=本科室');
  const fullHospTag = await page.$('div[style*="position: fixed"] >> text=全院');
  record('Case1.2 气泡 scope 角标 = 本科室', !!scopeTag);
  //   - 气泡内不应再出现 scope=全院 角标(同一时刻只有本科室)
  //   - 页面其他位置可能有"全院"字样,但气泡内部的 scope tag 应只有"本科室"
  const bubbleScopeIsLocal = await page.evaluate(() => {
    const fixedDivs = document.querySelectorAll('div[style*="position: fixed"]');
    for (const d of fixedDivs) {
      const t = (d.textContent || '').trim();
      if (t.includes('医小管 · 台账速览')) {
        // 找气泡内的 scope tag(浅蓝底色,字号 11,内含「本科室」/「全院」)
        const scopeTags = d.querySelectorAll('span');
        for (const s of scopeTags) {
          const st = (s.textContent || '').trim();
          if (st === '全院' || st === '本科室') return st;
        }
      }
    }
    return null;
  });
  record(
    'Case1.2b 气泡 scope 角标文字 = 本科室(无 全院 字样)',
    bubbleScopeIsLocal === '本科室',
    `气泡 scope tag = ${bubbleScopeIsLocal}`,
  );

  // 问候开场(本科室话术 = 使用速览)
  const greeting = await page.$('text=您好,这是今日');
  const tailDept = await page.$('text=使用速览');
  record('Case1.3 气泡问候开场', !!greeting);
  record('Case1.3 气泡使用「使用速览」话术(科室口径)', !!tailDept);

  // ==== Case 2: 关键指标口径差异(本科室 vs 全院) ====
  // 整体概况:本科室智能体 X + 本月新增 X(注意:不加「纳管」字)
  const deptAgent = await page.$('strong:has-text("本科室智能体")');
  const monthNewText = await page.$('text=本月新增');
  // 全院/纳管的"全院智能体"不应出现
  const fullHospAgentInBubble = await page.evaluate(() => {
    const fixedDivs = document.querySelectorAll('div[style*="position: fixed"]');
    for (const d of fixedDivs) {
      if ((d.textContent || '').includes('医小管 · 台账速览')) {
        return d.textContent.includes('全院智能体');
      }
    }
    return false;
  });
  record('Case2.1 气泡含「本科室智能体」指标(科室口径)', !!deptAgent);
  record('Case2.1 气泡含「本月新增」指标', !!monthNewText);
  record('Case2.1 气泡不含「全院智能体」(区分管理员)', !fullHospAgentInBubble);

  // ==== Case 3: 科室用户专有指标 — 本月调用量 + 正常运行率 ====
  //   走蓝底高亮 block,文案：「使用情况 · 本月调用量 X · 正常运行率 X%」
  const usageBlock = await page.evaluate(() => {
    const fixedDivs = document.querySelectorAll('div[style*="position: fixed"]');
    for (const d of fixedDivs) {
      if ((d.textContent || '').includes('医小管 · 台账速览')) {
        const t = d.textContent || '';
        if (t.includes('使用情况') && t.includes('本月调用量') && t.includes('正常运行率')) {
          return true;
        }
      }
    }
    return false;
  });
  record('Case3.1 气泡含「使用情况 · 本月调用量 + 正常运行率」专有 block(科室专属)', usageBlock);

  // ==== Case 4: 风险提示话术 — 科室用户使用影响导向 ====
  //   - 管理员：「建议优先处理告警与故障」
  //   - 科室用户：「建议优先关注影响使用的告警与故障」
  const hintAdmin = await page.$('text=建议优先处理告警与故障');
  const hintDept = await page.$('text=建议优先关注影响本科室使用的告警与故障');
  record('Case4.1 气泡使用「建议优先关注影响本科室使用的告警与故障」话术(科室口径)', !!hintDept);
  // 严格意义上 admin 话术不应该出现,但允许页面其他元素(顶部 nav "统一台账中心")出现"全院"等
  //   - 我们检查的是「气泡内部」不出现 admin 话术
  const hintAdminInBubble = await page.evaluate(() => {
    const fixedDivs = document.querySelectorAll('div[style*="position: fixed"]');
    for (const d of fixedDivs) {
      if ((d.textContent || '').includes('医小管 · 台账速览')) {
        return d.textContent.includes('建议优先处理告警与故障');
      }
    }
    return false;
  });
  record(
    'Case4.1b 气泡内部不含管理员口径话术(无「建议优先处理告警与故障」)',
    !hintAdminInBubble,
    `气泡内 admin 话术存在=${hintAdminInBubble}`,
  );

  // ==== Case 5: 评测进度 — 科室用户没有「待评测」 ====
  //   - 科室用户「待评测」口径无意义,buildDeptAdminMetrics pendingEval=0 且 isDept 走 null 分支
  //   - 气泡内不应出现「待评测」指标项
  const pendingEvalInBubble = await page.evaluate(() => {
    const fixedDivs = document.querySelectorAll('div[style*="position: fixed"]');
    for (const d of fixedDivs) {
      if ((d.textContent || '').includes('医小管 · 台账速览')) {
        return d.textContent.includes('待评测');
      }
    }
    return false;
  });
  const evaluatingInBubble = await page.evaluate(() => {
    const fixedDivs = document.querySelectorAll('div[style*="position: fixed"]');
    for (const d of fixedDivs) {
      if ((d.textContent || '').includes('医小管 · 台账速览')) {
        return d.textContent.includes('评测中');
      }
    }
    return false;
  });
  record('Case5.1 气泡不含「待评测」指标(科室端无该指标)', !pendingEvalInBubble);
  record('Case5.1 气泡含「评测中」指标(本科室)', evaluatingInBubble);

  // ==== Case 6: 汇报引导按钮 + 对话引导 ====
  const btnGen = await page.$('div[style*="position: fixed"] button:has-text("生成报告")');
  const btnSub = await page.$('div[style*="position: fixed"] button:has-text("订阅速读")');
  record('Case6.1 气泡含【生成报告】按钮', !!btnGen);
  record('Case6.1 气泡含【订阅速读】按钮', !!btnSub);

  // 对话引导 + 科室口径示例问句
  const chatAsk = await page.$('text=直接向我提问');
  const chatSample = await page.$('text=我科室哪个智能体现在不能用');
  record('Case6.2 气泡含「直接向我提问」链接', !!chatAsk);
  record('Case6.2 气泡示例问句 = 我科室哪个智能体现在不能用?(科室口径)', !!chatSample);

  await page.screenshot({ path: join(OUT, '01-dept-overview-bubble.png'), fullPage: false });

  // ==== Case 7: 列表页同样弹出本科室口径气泡 ====
  await page.goto(`${BASE}/app/ledger/list`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1800);
  const listBubble = await page.$('text=医小管 · 台账速览');
  const listScope = await page.evaluate(() => {
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
  record('Case7.1 台账列表页也弹出统一欢迎气泡', !!listBubble);
  record('Case7.2 列表页气泡 scope 角标 = 本科室', listScope === '本科室', `气泡 scope = ${listScope}`);
  await page.screenshot({ path: join(OUT, '02-dept-list-bubble.png'), fullPage: false });

  // ==== Case 8: 点击【生成报告】→ /app/ledger-demo/report ====
  const listGen = page.locator('div[style*="position: fixed"] button:has-text("生成报告")').first();
  const listGenCount = await listGen.count();
  if (listGenCount > 0) {
    await listGen.click({ force: true });
    await page.waitForTimeout(2500);
    const url = page.url();
    record(
      'Case8.1 科室用户点击【生成报告】跳转 /app/ledger-demo/report',
      url.includes('/app/ledger-demo/report'),
      `URL = ${url}`,
    );
    await page.screenshot({ path: join(OUT, '03-dept-report-page.png'), fullPage: false });
  } else {
    record('Case8.1 科室用户点击【生成报告】跳转 /app/ledger-demo/report', false, '未找到按钮');
  }

  // ==== Case 9: 报告页 Segmented 切换到「本科室」 ====
  //   - PRD §4.3 报告页默认展示全院报告,内含 Segmented 可切换到「本科室小结」
  //   - 切到本科室后应见「本科室智能体应用成效小结」标题 + 4 大模块(在用清单/使用情况/可用性概况/需关注事项与建议)
  const segDept = page.locator('text=本科室 (§4.3)').first();
  if ((await segDept.count()) > 0) {
    await segDept.click({ force: true });
    await page.waitForTimeout(800);
    const deptTitle = await page.$('text=心内科智能体应用成效小结');
    const m1 = await page.$('text=一、在用智能体清单与分布');
    const m2 = await page.$('text=二、使用情况');
    const m3 = await page.$('text=三、可用性概况');
    const m4 = await page.$('text=四、需关注事项与建议');
    record('Case9.1 切换 Segmented 后显示「心内科智能体应用成效小结」标题(科室口径)', !!deptTitle);
    record('Case9.2 本科室小结含「在用智能体清单与分布」模块', !!m1);
    record('Case9.2 本科室小结含「使用情况」模块', !!m2);
    record('Case9.2 本科室小结含「可用性概况」模块', !!m3);
    record('Case9.2 本科室小结含「需关注事项与建议」模块', !!m4);
    await page.screenshot({ path: join(OUT, '04-dept-report-sections.png'), fullPage: true });
  } else {
    record('Case9.1 切换 Segmented 后显示「本科室智能体应用成效小结」标题', false, '未找到 Segmented 选项');
    record('Case9.2 本科室小结 4 大模块齐全', false, 'Segmented 选项缺失');
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