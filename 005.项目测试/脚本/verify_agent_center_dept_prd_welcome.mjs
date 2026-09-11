#!/usr/bin/env node
/**
 * 科室管理员 · 接入中心 PRD 欢迎语 3 案例走查
 *
 * 覆盖：
 * 1. 全部 tab：气泡态势口径 + 新建注册按钮 + 窗口内建单欢迎语
 * 2. 6 个状态 tab：气泡态势口径 + PRD 对应窗口内文案 + 迷你清单按钮
 * 3. 新建注册页 / 详情页：单页气泡态势口径 + 单页直接操作按钮 + 窗口内文案
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const OUT = join(process.cwd(), 'verify_agent_center_dept_prd_welcome_artefacts');
mkdirSync(OUT, { recursive: true });

const results = [];
const storageValue = JSON.stringify({
  demoRole: '科室管理员',
  visibleModules: { 'agent-center': true, evaluation: true, ledger: true },
  visibleSubPages: {},
});

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ` -- ${detail}` : ''}`);
}

async function setupDept(page) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((value) => {
    localStorage.setItem('demo_settings_v1', value);
    localStorage.removeItem('agent_assistant_pos_v1');
    sessionStorage.clear();
  }, storageValue);
}

async function gotoFresh(page, path) {
  await page.evaluate(() => sessionStorage.clear()).catch(() => {});
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1600);
}

async function bubbleText(page) {
  await page.waitForSelector('[data-testid="status-bubble"]', { timeout: 8000 });
  return ((await page.textContent('[data-testid="status-bubble-content"]')) || '').trim();
}

async function assertDeptBubble(page, label) {
  const text = await bubbleText(page);
  const pass =
    text.includes('今日审核中') &&
    text.includes('准入通过') &&
    text.includes('退回修改') &&
    text.includes('在气泡里点对应状态即可直接进入处理') &&
    !text.includes('今日待办') &&
    !text.includes('今日待审核');
  record(`${label} 气泡提示为科室管理员 PRD 口径`, pass, text);
}

async function openBubbleAndAssertWindow(page, label, expected) {
  await page.click('[data-testid="status-bubble-content"]');
  await page.waitForTimeout(500);
  const body = await page.locator('body').innerText();
  const pass = expected.every((word) => body.includes(word));
  record(`${label} 窗口内文案`, pass, expected.join(' / '));
}

async function assertChatAction(page, label, key, text) {
  const visible = await page.locator(`[data-testid="chat-welcome-action-${key}"]`).evaluateAll(
    (els, expected) =>
      els.some((el) => {
        const normalized = (el.textContent || '').replace(/\s+/g, '');
        const normalizedExpected = String(expected).replace(/\s+/g, '');
        const isVisible = !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
        return isVisible && normalized.includes(normalizedExpected);
      }),
    text,
  ).catch(() => false);
  record(`${label} 窗口内引导按钮【${text}】`, visible);
}

async function assertChatChip(page, label, key, text) {
  const visible = await page
    .locator(`[data-testid="chat-welcome-chip-${key}"]`)
    .getByText(text)
    .last()
    .isVisible()
    .catch(() => false);
  record(`${label} 窗口内状态入口【${text}】`, visible);
}

async function assertChatMini(page, label, cfg) {
  const toggle = page.locator('[data-testid="chat-welcome-mini-toggle"]').last();
  const toggleVisible = await toggle.isVisible().catch(() => false);
  if (!toggleVisible) {
    const emptyOrNoRows =
      (await page.locator('.ant-empty').count()) > 0 ||
      (await page.getByText('暂无数据').count()) > 0;
    record(`${label} 窗口内迷你清单按钮`, emptyOrNoRows, '无可操作记录时允许不展示迷你清单');
    return;
  }
  const toggleText = (await toggle.innerText()).trim();
  record(`${label} 窗口内迷你清单按钮文案`, toggleText.includes(cfg.toggle), toggleText);
  await toggle.click();
  await page.waitForTimeout(300);
  const miniText = await page.locator('[data-testid="chat-welcome-mini"]').last().innerText();
  for (const action of cfg.rowActions) {
    record(`${label} 窗口内行按钮【${action}】`, miniText.includes(action), miniText.replace(/\s+/g, ' ').slice(0, 160));
  }
}

async function caseAllTab(page) {
  await gotoFresh(page, '/app/agent-center');
  await assertDeptBubble(page, '案例1 全部tab');
  const hasReviewingChip = (await page.locator('[data-testid="status-bubble-chip-reviewing"]').count()) > 0;
  const hasNewRegister = await page.locator('[data-testid="status-bubble-action-new-register"]').getByText('新建注册').isVisible().catch(() => false);
  record('案例1 全部tab 气泡操作按钮含【新建注册】', hasNewRegister);
  record('案例1 全部tab 状态分流含【审核中】chip', hasReviewingChip);
  await openBubbleAndAssertWindow(page, '案例1 全部tab', ['你好！我是医小管', '点击【新建注册】', '自动识别并填表']);
  await assertChatAction(page, '案例1 全部tab', 'new-register', '新建注册');
  await assertChatChip(page, '案例1 全部tab', 'reviewing', '审核中');
  await page.screenshot({ path: join(OUT, 'case1-all-tab.png'), fullPage: false });
}

async function caseStatusTabs(page) {
  const tabs = [
    { tab: '草稿', win: ['未完成的草稿', '继续补全'], toggle: '去补全', rowActions: ['编辑'] },
    { tab: '待审核', win: ['正在等待审核', '盯进度'], toggle: '查看这', rowActions: ['查看详情', '撤销'] },
    { tab: '审核中', win: ['已在审核中', '审核结果第一时间提醒'], toggle: '查看这', rowActions: ['查看详情', '撤销'] },
    { tab: '退回修改', win: ['被退回啦', '退回意见和问题点'], toggle: '去处理', rowActions: ['编辑'] },
    { tab: '撤销修改', win: ['撤销的注册', '重新提交'], toggle: '查看', rowActions: ['编辑', '删除'] },
    { tab: '审核通过', win: ['已通过接入', '准入评测结果'], toggle: '已通过', rowActions: ['查看详情', '完善台账', '查看准入评测结果'] },
  ];
  for (const cfg of tabs) {
    await gotoFresh(page, `/app/agent-center?tab=${encodeURIComponent(cfg.tab)}`);
    await assertDeptBubble(page, `案例2 ${cfg.tab}tab`);
    await openBubbleAndAssertWindow(page, `案例2 ${cfg.tab}tab`, cfg.win);
    await assertChatMini(page, `案例2 ${cfg.tab}tab`, cfg);
    await gotoFresh(page, `/app/agent-center?tab=${encodeURIComponent(cfg.tab)}`);
    const toggle = page.locator('[data-testid="status-bubble-mini-toggle"]');
    const toggleVisible = await toggle.isVisible().catch(() => false);
    const emptyOrNoRows =
      (await page.locator('.ant-empty').count()) > 0 ||
      (await page.getByText('暂无数据').count()) > 0;
    if (!toggleVisible) {
      record(`案例2 ${cfg.tab}tab 迷你清单按钮`, emptyOrNoRows, '无可操作记录时允许不展示迷你清单');
      continue;
    }
    const toggleText = (await toggle.innerText()).trim();
    record(`案例2 ${cfg.tab}tab 迷你清单按钮文案`, toggleText.includes(cfg.toggle), toggleText);
    await toggle.click();
    await page.waitForTimeout(300);
    const bubbleAll = await page.locator('[data-testid="status-bubble"]').innerText();
    for (const action of cfg.rowActions) {
      record(`案例2 ${cfg.tab}tab 行按钮【${action}】`, bubbleAll.includes(action), bubbleAll.replace(/\s+/g, ' ').slice(0, 160));
    }
  }
  await page.screenshot({ path: join(OUT, 'case2-status-tabs.png'), fullPage: false });
}

async function caseSinglePages(page) {
  await gotoFresh(page, '/app/agent-center/smart-register');
  await assertDeptBubble(page, '案例3 新建注册页');
  const upload = await page.locator('[data-testid="status-bubble-action-upload"]').getByText('上传').isVisible().catch(() => false);
  const voice = await page.locator('[data-testid="status-bubble-action-voice"]').getByText('语音描述').isVisible().catch(() => false);
  record('案例3 新建注册页 气泡操作含【上传】+【语音描述】', upload && voice);
  await openBubbleAndAssertWindow(page, '案例3 新建注册页', ['你好！我是医小管', '支持 PDF', '自动识别并填表']);
  await assertChatAction(page, '案例3 新建注册页', 'upload', '上传');
  await assertChatAction(page, '案例3 新建注册页', 'voice', '语音描述');

  await gotoFresh(page, '/app/agent-center');
  const firstDetailButton = page.locator('.ant-table-tbody tr button.ant-btn-link').first();
  await firstDetailButton.click();
  await page.waitForURL(/\/app\/agent-center\/detail\//, { timeout: 8000 });
  await page.waitForTimeout(1200);
  await assertDeptBubble(page, '案例3 注册信息详情页');
  const back = await page.locator('[data-testid="status-bubble-action-back"]').getByText('返回').isVisible().catch(() => false);
  const attachment = await page.locator('[data-testid="status-bubble-action-attachments"]').getByText('附件预览 / 下载').isVisible().catch(() => false);
  record('案例3 注册信息详情页 气泡操作含【返回】+【附件预览 / 下载】', back && attachment);
  await openBubbleAndAssertWindow(page, '案例3 注册信息详情页', ['注册详情', '解读某个字段', '历史填写版本']);
  await assertChatAction(page, '案例3 注册信息详情页', 'back', '返回');
  await assertChatAction(page, '案例3 注册信息详情页', 'attachments', '附件预览 / 下载');
  await page.screenshot({ path: join(OUT, 'case3-single-pages.png'), fullPage: false });
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await setupDept(page);
  await caseAllTab(page);
  await caseStatusTabs(page);
  await caseSinglePages(page);
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
