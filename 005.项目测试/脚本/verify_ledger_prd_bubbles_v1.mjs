#!/usr/bin/env node
/**
 * 台账中心智能化升级 PRD 欢迎语气泡 3 案例走查
 *
 * 覆盖：
 * 1. 信息科管理员 · 台账总览首页：全院台账速览 + 生成报告/订阅速读/提问
 * 2. 科室管理员 · 台账列表页：本科室使用速览 + 无「待评测」+ 报告/订阅/提问
 * 3. 信息科管理员 · 智能体详情页：360 画像欢迎语 + 下钻/切换/对话
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';
const OUT = join(process.cwd(), 'verify_ledger_prd_bubbles_v1_artefacts');
mkdirSync(OUT, { recursive: true });

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ` -- ${detail}` : ''}`);
}

async function setRole(page, role) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((r) => {
    const cur = JSON.parse(localStorage.getItem('demo_settings_v1') || '{}');
    localStorage.setItem(
      'demo_settings_v1',
      JSON.stringify({
        ...cur,
        demoRole: r,
        visibleModules: { ...(cur.visibleModules || {}), ledger: true },
        visibleSubPages: cur.visibleSubPages || {},
      }),
    );
    sessionStorage.clear();
  }, role);
}

async function gotoBubble(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1600);
  await page.waitForSelector('[data-testid="ledger-status-bubble"]', { timeout: 8000 });
}

async function bubbleText(page) {
  return ((await page.locator('[data-testid="ledger-status-bubble"]').innerText()) || '').replace(/\s+/g, ' ').trim();
}

async function assertIncludes(label, text, words) {
  for (const word of words) {
    record(`${label} 包含「${word}」`, text.includes(word), text);
  }
}

async function assertButton(page, label, testId, text) {
  const visible = await page
    .locator(`[data-testid="${testId}"]`)
    .evaluateAll((els, expected) =>
      els.some((el) => {
        const normalized = (el.textContent || '').replace(/\s+/g, '');
        const normalizedExpected = String(expected).replace(/\s+/g, '');
        const isVisible = !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
        return isVisible && normalized.includes(normalizedExpected);
      }), text)
    .catch(() => false);
  record(`${label} 按钮【${text}】`, visible);
}

async function caseAdminOverview(page) {
  await setRole(page, '信息科管理员');
  await gotoBubble(page, '/app/ledger');
  const text = await bubbleText(page);
  await assertIncludes('案例1 信息科管理员总览气泡', text, [
    '医小管 · 台账速览',
    '全院',
    '你好，我是医小管！这是今日全院智能体台账速览',
    '全院智能体',
    '本月新增纳管',
    '待评测',
    '评测中',
    '告警',
    '故障',
    '已恢复',
    '建议优先处理告警与故障',
    '全院智能体管理情况报告',
    '台账速读（日 / 周）',
  ]);
  record('案例1 信息科管理员总览气泡不含旧口径 86 个', !text.includes('86 个'), text);
  await assertButton(page, '案例1 信息科管理员总览气泡', 'ledger-bubble-generate-report', '生成报告');
  await assertButton(page, '案例1 信息科管理员总览气泡', 'ledger-bubble-subscribe', '订阅速读');
  const ask = await page.locator('[data-testid="ledger-bubble-open-chat"]').isVisible().catch(() => false);
  record('案例1 信息科管理员总览气泡含「直接向我提问」', ask, text);
  await page.screenshot({ path: join(OUT, 'case1-admin-overview.png'), fullPage: false });
}

async function caseDeptList(page) {
  await setRole(page, '科室管理员');
  await gotoBubble(page, '/app/ledger/list');
  const text = await bubbleText(page);
  await assertIncludes('案例2 科室管理员列表气泡', text, [
    '医小管 · 台账速览',
    '本科室',
    '你好，我是医小管！这是本科室智能体今日使用速览',
    '本科室智能体',
    '本月新增',
    '本月调用量',
    '正常运行率',
    '告警',
    '故障',
    '已恢复',
    '评测中',
    '建议优先关注影响使用的告警与故障',
  ]);
  record('案例2 科室管理员列表气泡不含「待评测」', !text.includes('待评测'), text);
  record('案例2 科室管理员列表气泡不含「全院智能体台账速览」', !text.includes('全院智能体台账速览'), text);
  await assertButton(page, '案例2 科室管理员列表气泡', 'ledger-bubble-generate-report', '生成报告');
  await assertButton(page, '案例2 科室管理员列表气泡', 'ledger-bubble-subscribe', '订阅速读');
  const ask = await page.locator('[data-testid="ledger-bubble-open-chat"]').isVisible().catch(() => false);
  record('案例2 科室管理员列表气泡含「直接向我提问」', ask, text);
  await page.screenshot({ path: join(OUT, 'case2-dept-list.png'), fullPage: false });
}

async function caseAdminDetail(page) {
  await setRole(page, '信息科管理员');
  await gotoBubble(page, '/app/ledger/detail/AGT-2024-001');
  const text = await bubbleText(page);
  await assertIncludes('案例3 信息科管理员详情气泡', text, [
    '医小管 · 360 画像',
    '全院',
    '你好，我是医小管！这是',
    '360 画像',
    '我已为你聚合基本信息、关联资源拓扑、准入评测与运行监测',
    '当前告警',
    '故障',
    '异常对接',
    '需要我带你下钻查看吗',
  ]);
  await assertButton(page, '案例3 信息科管理员详情气泡', 'ledger-bubble-action-drill', '下钻明细');
  await assertButton(page, '案例3 信息科管理员详情气泡', 'ledger-bubble-action-switch', '360 / 信息详情');
  await assertButton(page, '案例3 信息科管理员详情气泡', 'ledger-bubble-action-chat', '唤起对话');
  await page.screenshot({ path: join(OUT, 'case3-admin-detail.png'), fullPage: false });
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await caseAdminOverview(page);
  await caseDeptList(page);
  await caseAdminDetail(page);
  await page.close();
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
const summary = {
  ts: new Date().toISOString(),
  total: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
};
writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(`\n汇总：${summary.passed}/${summary.total} 通过`);
if (failed.length > 0) {
  failed.forEach((f) => console.log(`失败：${f.name} -- ${f.detail}`));
}
process.exit(failed.length > 0 ? 1 : 0);
