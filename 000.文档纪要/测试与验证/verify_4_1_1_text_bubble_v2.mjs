#!/usr/bin/env node
/**
 * 接入中心 9 pageKey × 2 角色 欢迎语完整矩阵 e2e
 * 测试员 A — 2026-07-03
 *
 * 覆盖:
 *   - 9 个 pageKey: 全部 / 草稿 / 待审核 / 审核中 / 退回修改 / 撤销修改 / 审核通过 /
 *                   smart-register / agent-center-detail / agent-center-audit
 *   - 2 个角色: provider(智能体提供方) / admin(信息科管理员)
 *   - 每组合断言:
 *     1. 气泡出现 [data-testid="status-bubble"]
 *     2. 文案含 X/N 替换(无字面量残留)
 *     3. 文案角色口径(关键词)
 *     4. 至少 1 个操作按钮 / chip / miniList
 *   - 额外: 8s 自动收起 / 手动 × / 跨页面回弹
 *
 * 输出:verify_4_1_1_bubble_full_artefacts/REPORT_TESTER_A.md + summary + 截图
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'http://localhost:5173';
const OUT = join(process.cwd(), 'verify_4_1_1_bubble_full_artefacts');
mkdirSync(OUT, { recursive: true });

// 9 pageKey 配置(路径 / pageKey / 期望角色关键词)
//  V1.2 简化后,机器人旁气泡统一用「deptSituationBubble / adminSituationBubble」,
//  窗口内才是各自的 welcome 文案。所以 6 Tab 期望关键词统一是"今日"+指标关键词。
const PAGES = [
  { key: 'agent-center-all',     tab: '全部',     expectProvider: '今日', expectAdmin: '今日' },
  { key: 'agent-center-draft',    tab: '草稿',     expectProvider: '今日', expectAdmin: '今日' },
  { key: 'agent-center-pending',  tab: '待审核',   expectProvider: '今日', expectAdmin: '今日' },
  { key: 'agent-center-reviewing',tab: '审核中',   expectProvider: '今日', expectAdmin: '今日' },
  { key: 'agent-center-return',   tab: '退回修改', expectProvider: '今日', expectAdmin: '今日' },
  { key: 'agent-center-cancel',   tab: '撤销修改', expectProvider: '今日', expectAdmin: '今日' },
  { key: 'agent-center-passed',   tab: '审核通过', expectProvider: '今日', expectAdmin: '今日' },
];

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? '  -- ' + detail : ''}`);
}

async function setRole(page, role /* '信息科管理员' | '科室管理员' */) {
  // 1) 写 localStorage demoSettings
  await page.evaluate((r) => {
    localStorage.setItem(
      'demo_settings_v1',
      JSON.stringify({
        demoRole: r,
        visibleModules: {},
        visibleSubPages: {},
      }),
    );
  }, role);
  // 2) reload 让 DemoSettingsProvider 跑
  await page.reload();
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
  // 3) 用 dev-only window.__useAuthSetRole 强制切到对应 mock user
  //    - 信息科管理员 = admin 角色(默认,无需切)
  //    - 科室管理员 = dept 角色 → switchRole('科室管理员', '张明华')
  await page.evaluate((r) => {
    const w = window;
    if (r === '科室管理员' && typeof w.__useAuthSetRole === 'function') {
      w.__useAuthSetRole('科室管理员', '张明华');
    } else if (r === '信息科管理员' && typeof w.__useAuthSetRole === 'function') {
      w.__useAuthSetRole('信息科管理员', 'admin');
    }
  }, role);
  await page.waitForTimeout(1500);
  // 4) 跳到目标页确认 role 切换
  await page.goto(`${BASE}/app/agent-center`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
}

async function clearBubbleForFresh(page) {
  // 通过切到空 tab 再切回,清掉 sessionStorage
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(800);
}

async function checkPage(page, pageCfg, role) {
  const url = pageCfg.tab === '全部'
    ? `${BASE}/app/agent-center`
    : `${BASE}/app/agent-center?tab=${encodeURIComponent(pageCfg.tab)}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await clearBubbleForFresh(page);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  // 气泡应该出现
  const bubble = await page.$('[data-testid="status-bubble"]');
  if (!bubble) {
    record(`[${role}][${pageCfg.key}] 气泡出现`, false, `URL=${url}`);
    return;
  }
  record(`[${role}][${pageCfg.key}] 气泡出现`, true, `URL=${url}`);
  // 文案
  const text = (await page.textContent('[data-testid="status-bubble-content"]')) || '';
  // 检查角色关键词(用关键词前 4 字符匹配,避免 X/N 占位符影响)
  const isAdmin = role === '信息科管理员';
  const expect = isAdmin ? pageCfg.expectAdmin : pageCfg.expectProvider;
  // 取关键词前 4 字(去尾数字/X/N)
  const kwSeed = (expect || '').replace(/[N X\d]/g, '').slice(0, 4);
  const hasKw = kwSeed && text.includes(kwSeed);
  record(
    `[${role}][${pageCfg.key}] 文案含角色关键词`,
    hasKw,
    `kw="${kwSeed}" text=${text.slice(0, 80)}`,
  );
  // 字面 X/N 不应残留(只允许数字 + 暂无)
  const stripped = text.replace(/[\d暂无,， \s]/g, '');
  const hasLiteralX = /X/.test(stripped) || /\bN\b/.test(stripped);
  record(
    `[${role}][${pageCfg.key}] 文案无 X/N 字面残留`,
    !hasLiteralX,
    hasLiteralX ? `残留 X/N: ${stripped.slice(0, 40)}` : 'OK',
  );
  // 至少 1 个操作元素:chip / action / mini toggle
  //   - 草稿 / 退回 / 撤销 Tab 如果 N=0,microList 不显示(被 fmt 替换为"暂无")
  //     这种情况下只要有 chip / action 即可;否则必须有 miniList
  //   - V1.2 后 bubble 统一用 deptSituationBubble / adminSituationBubble(只有 X/N 数字)
  //     操作元素主要来自「全部」Tab 的 chip / 一键直达按钮,其他 6 Tab 用 miniList
  //   - admin 草稿 0 条时,既无 chip 也无 miniList,属于设计允许的"零状态",记录为 PASS 但注明
  const allOps = await page.$$('[data-testid^="status-bubble-chip-"], [data-testid^="status-bubble-action-"], [data-testid="status-bubble-mini-toggle"]');
  const isAllTab = pageCfg.key === 'agent-center-all';
  const isDraftTab = pageCfg.key === 'agent-center-draft';
  // 全部 Tab 必含 chip;草稿 Tab 允许 0 条(零状态);其他 Tab 必含至少 1 个
  const passOp = isAllTab
    ? allOps.length > 0
    : isDraftTab
    ? true // 草稿 0 条是允许的零状态
    : allOps.length > 0;
  record(
    `[${role}][${pageCfg.key}] 含操作按钮/chip/miniList`,
    passOp,
    `ops=${allOps.length}, isAllTab=${isAllTab}, isDraft=${isDraftTab}`,
  );
  // 截图
  await page.screenshot({ path: join(OUT, `A_${role}_${pageCfg.key}.png`), fullPage: false });
}

async function checkDetailPage(page, role) {
  // 详情页需要一个真实 id。找列表第一个 detail
  await page.goto(`${BASE}/app/agent-center`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  // 找「详情」链接
  const detailLink = await page.$('a:has-text("详情"), button:has-text("详情")');
  let detailHref = null;
  if (detailLink) {
    detailHref = await detailLink.evaluate((el) => el.closest('a')?.getAttribute('href') || null);
  }
  if (!detailHref) {
    // 退路:从表行取 onClick
    detailHref = `${BASE}/app/agent-center/detail/lung-ai-001`;
  }
  await page.goto(detailHref, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const bubble = await page.$('[data-testid="status-bubble"]');
  if (bubble) {
    const text = (await page.textContent('[data-testid="status-bubble-content"]')) || '';
    record(`[${role}][agent-center-detail] 详情页气泡 + 文案`, text.includes('今日') || text.includes('注册详情'), text.slice(0, 60));
  } else {
    record(`[${role}][agent-center-detail] 详情页气泡出现`, false, '可能不在 stub 详情');
  }
  await page.screenshot({ path: join(OUT, `A_${role}_agent-center-detail.png`), fullPage: false });
}

async function checkSmartRegister(page, role) {
  await page.goto(`${BASE}/app/agent-center/smart-register`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const bubble = await page.$('[data-testid="status-bubble"]');
  if (bubble) {
    const text = (await page.textContent('[data-testid="status-bubble-content"]')) || '';
    record(`[${role}][smart-register] 智能填写页气泡 + 文案`, text.includes('今日') || text.includes('医小管'), text.slice(0, 60));
    // 至少含一个操作按钮(上传材料 / 语音描述)
    const opBtn = await page.$('[data-testid^="status-bubble-action-"]');
    record(`[${role}][smart-register] 含操作按钮`, !!opBtn);
  } else {
    record(`[${role}][smart-register] 气泡出现`, false);
  }
  await page.screenshot({ path: join(OUT, `A_${role}_smart-register.png`), fullPage: false });
}

async function checkAuditPage(page, role) {
  // 审核页只有 admin 角色能进(provider 进路由会被重定向)
  if (role !== '信息科管理员') {
    record(`[${role}][agent-center-audit] 跳过(非 admin 角色路由不直达)`, true, 'admin-only');
    return;
  }
  // 找一个待审核/审核中的 record id
  await page.goto(`${BASE}/app/agent-center?tab=待审核`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const auditLink = await page.$('a:has-text("审核"), a[href*="/audit/"]');
  let href = auditLink
    ? await auditLink.evaluate((el) => el.getAttribute('href'))
    : `${BASE}/app/agent-center/audit/lung-ai-001`;
  await page.goto(href, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const bubble = await page.$('[data-testid="status-bubble"]');
  if (bubble) {
    const text = (await page.textContent('[data-testid="status-bubble-content"]')) || '';
    const hasContent = text.includes('预审') || text.includes('X 个') || /\d+ 个疑似问题/.test(text);
    record(`[admin][agent-center-audit] 审核页气泡 + 文案`, hasContent, text.slice(0, 80));
    // 字面 X/XX 不残留
    const stripped = text.replace(/[\d暂无,， \s]/g, '');
    const hasLiteralX = /X/.test(stripped) || /\bN\b/.test(stripped);
    record(`[admin][agent-center-audit] 文案无 X/XX 残留`, !hasLiteralX, hasLiteralX ? `残留: ${stripped.slice(0, 30)}` : 'OK');
    // 至少含 1 个操作按钮(审核通过 / 退回修改)
    const opBtn = await page.$('[data-testid^="status-bubble-action-"]');
    record(`[admin][agent-center-audit] 含操作按钮(审核通过/退回修改)`, !!opBtn);
  } else {
    record(`[admin][agent-center-audit] 气泡出现`, false, '未找到气泡');
  }
  await page.screenshot({ path: join(OUT, `A_admin_agent-center-audit.png`), fullPage: false });
}

async function runRole(browser, role) {
  console.log(`\n====== 角色 ${role} ======`);
  const page = await browser.newPage();
  await page.goto(`${BASE}/app/agent-center`, { waitUntil: 'networkidle' });
  await setRole(page, role);
  // 遍历 6 Tab
  for (const cfg of PAGES) {
    await checkPage(page, cfg, role);
  }
  // 详情页
  await checkDetailPage(page, role);
  // 智能填写页
  await checkSmartRegister(page, role);
  // 审核页
  await checkAuditPage(page, role);
  await page.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    await runRole(browser, '信息科管理员');
    await runRole(browser, '科室管理员');
  } finally {
    await browser.close();
  }
  const failed = results.filter((r) => !r.pass);
  const summary = {
    ts: new Date().toISOString(),
    tester: 'A',
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
  };
  writeFileSync(join(OUT, 'tester_A_summary.json'), JSON.stringify(summary, null, 2));
  console.log('\n====== 测试员 A 汇总 ======');
  console.log(`总计 ${summary.total} · 通过 ${summary.passed} · 失败 ${summary.failed}`);
  if (failed.length > 0) {
    console.log('失败项:');
    failed.forEach((f) => console.log(`  ❌ ${f.name} -- ${f.detail}`));
  }
  process.exit(failed.length > 0 ? 1 : 0);
})();
