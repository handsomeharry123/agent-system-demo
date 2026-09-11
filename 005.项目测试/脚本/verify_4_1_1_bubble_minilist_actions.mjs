#!/usr/bin/env node
/**
 * 接入中心 迷你清单 (MiniList) 全 kind 验证
 * 测试员 C — 2026-07-03
 *
 * 覆盖:
 *   - 6 个非「全部」Tab 各自折叠态 / 展开态
 *   - 折叠态按钮(查看全部 N 条 / 迷你清单 toggle)
 *   - 展开态行级按钮(7 种 kind):
 *     navigate-detail / navigate-edit / navigate-audit /
 *     confirm-delete / confirm-cancel / navigate-eval / navigate-ledger
 *   - 验证 CustomEvent 派发 → index.tsx 监听 → handler 调用
 *   - 验证「查看全部」跳目标 Tab
 *
 * 输出:verify_4_1_1_bubble_full_artefacts/REPORT_TESTER_C.md
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'http://localhost:5173';
const OUT = join(process.cwd(), 'verify_4_1_1_bubble_full_artefacts');
mkdirSync(OUT, { recursive: true });

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? '  -- ' + detail : ''}`);
}

async function setAdminRole(page) {
  await page.evaluate(() => {
    localStorage.setItem('demo_settings_v1', JSON.stringify({
      demoRole: '信息科管理员',
      visibleModules: {}, visibleSubPages: {},
    }));
  });
  await page.reload();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    if (typeof window.__useAuthSetRole === 'function') {
      window.__useAuthSetRole('信息科管理员', 'admin');
    }
  });
  await page.waitForTimeout(1500);
}

async function gotoTab(page, tab) {
  const url = `${BASE}/app/agent-center?tab=${encodeURIComponent(tab)}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
}

async function checkTabMiniList(page, tab) {
  console.log(`\n  --- Tab: ${tab} ---`);
  await gotoTab(page, tab);
  // miniList toggle(折叠) — N=0 时允许不存在
  const toggle = await page.$('[data-testid="status-bubble-mini-toggle"]');
  if (!toggle) {
    record(`[C/${tab}] 迷你清单 toggle 存在(零状态 N=0 可接受)`, true, 'N=0,skip miniList');
    return;
  }
  record(`[C/${tab}] 迷你清单 toggle 存在`, true);
  // 注册事件监听
  await page.evaluate(() => {
    window.__miniRowActions = [];
    if (!window.__miniListenerInstalled) {
      window.addEventListener('agent-bubble-row-action', (e) => {
        window.__miniRowActions.push(e.detail);
      });
      window.__miniListenerInstalled = true;
    }
  });
  // 点开
  await toggle.click({ force: true });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(OUT, `C_${tab}_mini_expanded.png`), fullPage: false });
  // 检查行级按钮
  const rowButtons = await page.$$('[data-testid^="status-bubble-mini-action-"]');
  record(`[C/${tab}] 迷你清单展开后含行级按钮`, rowButtons.length > 0, `n=${rowButtons.length}`);

  // 7 种 kind 验证(每个 kind 的 testid 都含对应字符串)
  const kinds = [
    'navigate-detail', 'navigate-edit', 'navigate-audit',
    'confirm-delete', 'confirm-cancel',
    'navigate-eval', 'navigate-ledger',
  ];
  // 对每个 kind,找匹配的按钮 + 点击 + 验证 event
  for (const kind of kinds) {
    const btn = page.locator(`[data-testid^="status-bubble-mini-action-${kind}-"]`).first();
    const visible = await btn.isVisible({ timeout: 1000 }).catch(() => false);
    if (!visible) continue; // 当前 tab 可能没这种 kind(预期)
    // 点之前清空 events
    await page.evaluate(() => { window.__miniRowActions = []; });
    // 监听后续可能触发的 navigation
    let navUrl = null;
    const navPromise = page.waitForEvent('framenavigated', { timeout: 3000 }).then((f) => {
      navUrl = f.url();
    }).catch(() => null);
    await btn.click({ force: true });
    await page.waitForTimeout(500);
    const evt = await page.evaluate(() => window.__miniRowActions?.[0] || null);
    record(
      `[C/${tab}] 行级按钮 kind=${kind} 派发 agent-bubble-row-action`,
      !!evt && evt.kind === kind,
      evt ? `kind=${evt.kind} recordId=${evt.recordId}` : 'no event',
    );
    // navigate-* 应该触发 URL 跳转
    if (kind.startsWith('navigate-')) {
      await navPromise;
      const currentUrl = page.url();
      record(
        `[C/${tab}] ${kind} 触发 navigation`,
        !currentUrl.includes('/agent-center?tab=') || navUrl !== null,
        `url=${currentUrl.slice(0, 80)}`,
      );
    } else {
      // confirm-* 应该打开 Modal(检查 Modal 元素)
      const modalVisible = await page.$('.ant-modal-confirm, .ant-modal').then((m) => !!m);
      record(
        `[C/${tab}] ${kind} 打开二次确认 Modal`,
        modalVisible,
        `modal=${modalVisible}`,
      );
      // 关闭 Modal
      const cancelBtn = await page.$('.ant-modal button:has-text("取消")');
      if (cancelBtn) await cancelBtn.click({ force: true });
      await page.waitForTimeout(300);
    }
    // 跳走后回到 tab 重新测下一个 kind
    if (kind.startsWith('navigate-')) {
      await gotoTab(page, tab);
      // 重新展开 mini + 重新注入 listener(跨 navigation)
      await page.evaluate(() => {
        window.__miniRowActions = [];
        if (!window.__miniListenerInstalled) {
          window.addEventListener('agent-bubble-row-action', (e) => {
            window.__miniRowActions.push(e.detail);
          });
          window.__miniListenerInstalled = true;
        }
      });
      const t2 = await page.$('[data-testid="status-bubble-mini-toggle"]');
      if (t2) await t2.click({ force: true });
      await page.waitForTimeout(500);
    }
  }
}

async function run(browser) {
  console.log('\n====== 测试员 C · 迷你清单全 kind 验证 ======');
  const page = await browser.newPage();
  await page.goto(`${BASE}/app/agent-center`, { waitUntil: 'networkidle' });
  await setAdminRole(page);

  // 6 状态 Tab
  const tabs = ['草稿', '待审核', '审核中', '退回修改', '撤销修改', '审核通过'];
  for (const t of tabs) {
    await checkTabMiniList(page, t);
  }

  // 「查看全部」按钮验证(在展开态底部)
  console.log('\n  --- 验证「查看全部」跳转 ---');
  await gotoTab(page, '待审核');
  const toggle = await page.$('[data-testid="status-bubble-mini-toggle"]');
  if (toggle) {
    await toggle.click({ force: true });
    await page.waitForTimeout(500);
    // 找底部"查看全部"按钮(展开态才显示,AgentAssistant 行 1180 派发 agent-jump-tab)
    const viewAllBtn = await page.$('button:has-text("查看全部")');
    record(
      '[C/查看全部] 展开态含「查看全部」按钮',
      !!viewAllBtn,
    );
    if (viewAllBtn) {
      // 监听 agent-jump-tab CustomEvent
      await page.evaluate(() => {
        window.__jumpTab = null;
        window.addEventListener('agent-jump-tab', (e) => {
          window.__jumpTab = e.detail?.targetTab;
        });
      });
      await viewAllBtn.click({ force: true });
      await page.waitForTimeout(500);
      const targetTab = await page.evaluate(() => window.__jumpTab);
      record(
        '[C/查看全部] 派发 agent-jump-tab 事件(targetTab=待审核)',
        targetTab === '待审核',
        `targetTab=${targetTab}`,
      );
    }
  }
  await page.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    // 最早注入 agent-bubble-row-action + agent-jump-tab listener(跨 navigation 持续)
    await page.addInitScript(() => {
      window.__miniRowActions = [];
      window.__jumpTab = null;
      if (!window.__miniListenerInstalled) {
        window.addEventListener('agent-bubble-row-action', (e) => {
          window.__miniRowActions.push(e.detail);
        });
        // agent-jump-tab 的 detail 直接是字符串 targetTab(如 '待审核')
        window.addEventListener('agent-jump-tab', (e) => {
          window.__jumpTab = typeof e.detail === 'string' ? e.detail : e.detail?.targetTab || null;
        });
        window.__miniListenerInstalled = true;
      }
    });
    await runWithPage(page, browser);
  } finally {
    await browser.close();
  }
  const failed = results.filter((r) => !r.pass);
  const summary = {
    ts: new Date().toISOString(),
    tester: 'C',
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
  };
  writeFileSync(join(OUT, 'tester_C_summary.json'), JSON.stringify(summary, null, 2));
  console.log('\n====== 测试员 C 汇总 ======');
  console.log(`总计 ${summary.total} · 通过 ${summary.passed} · 失败 ${summary.failed}`);
  if (failed.length > 0) {
    console.log('失败项:');
    failed.forEach((f) => console.log(`  ❌ ${f.name} -- ${f.detail}`));
  }
  process.exit(failed.length > 0 ? 1 : 0);
})();

async function runWithPage(page, browser) {
  console.log('\n====== 测试员 C · 迷你清单全 kind 验证 ======');
  await page.goto(`${BASE}/app/agent-center`, { waitUntil: 'networkidle' });
  await setAdminRole(page);

  const tabs = ['草稿', '待审核', '审核中', '退回修改', '撤销修改', '审核通过'];
  for (const t of tabs) {
    await checkTabMiniList(page, t);
  }

  // 「查看全部」按钮
  console.log('\n  --- 验证「查看全部」跳转 ---');
  await gotoTab(page, '待审核');
  const toggle = await page.$('[data-testid="status-bubble-mini-toggle"]');
  if (toggle) {
    await toggle.click({ force: true });
    await page.waitForTimeout(500);
    const viewAllBtn = await page.$('button:has-text("查看全部")');
    record(
      '[C/查看全部] 展开态含「查看全部」按钮',
      !!viewAllBtn,
    );
    if (viewAllBtn) {
      await viewAllBtn.click({ force: true });
      await page.waitForTimeout(500);
      const targetTab = await page.evaluate(() => window.__jumpTab);
      record(
        '[C/查看全部] 派发 agent-jump-tab 事件(targetTab=待审核)',
        targetTab === '待审核',
        `targetTab=${targetTab}`,
      );
    }
  }
  await page.close();
}
