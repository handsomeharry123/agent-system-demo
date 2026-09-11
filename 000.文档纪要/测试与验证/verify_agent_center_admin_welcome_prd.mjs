#!/usr/bin/env node
/**
 * PRD 欢迎语走查 - 信息科管理员 / 接入中心
 *
 * 覆盖 3 个典型案例：
 * 1. 注册列表页 · 全部 tab：气泡态势、窗口内新建注册引导、状态分流 + 新建注册按钮
 * 2. 注册列表页 · 退回修改 tab：气泡态势、窗口内退回修改引导、迷你清单编辑按钮
 * 3. 审核注册页：预审气泡、窗口内审核动作说明、审核通过/退回修改/测试验证按钮
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';

const cases = [];

function record(name, pass, detail = '') {
  cases.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
}

async function textCount(page, text) {
  return page.getByText(text, { exact: false }).count();
}

async function openAssistant(page) {
  const bubble = page.getByTestId('status-bubble');
  if (await bubble.count()) {
    await bubble.click();
    await page.waitForTimeout(300);
    return;
  }
  await page.locator('.agent-robot-entry, [class*="agent-robot"]').last().click();
  await page.waitForTimeout(300);
}

async function checkAllTab(page) {
  await page.goto(`${BASE}/app/agent-center`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const bubble = await page.getByTestId('status-bubble-content').textContent();
  record(
    '全部tab 气泡态势为信息科管理员口径',
    !!bubble && /今日待审核 .*准入通过 .*退回修改/.test(bubble),
    bubble || '',
  );
  record('全部tab 气泡有待审核分流', (await page.getByTestId('status-bubble-chip-pending').count()) > 0);
  record('全部tab 气泡有新建注册按钮', (await page.getByTestId('status-bubble-action-new-register').count()) > 0);

  await openAssistant(page);
  record(
    '全部tab 窗口内为新建注册引导',
    (await textCount(page, '点击【新建注册】，把产品说明书 / 技术规格书发给我')) > 0,
  );
  record('全部tab 窗口内也有待审核分流', (await page.getByTestId('chat-welcome-chip-pending').count()) > 0);
  record('全部tab 窗口内也有新建注册按钮', (await page.getByTestId('chat-welcome-action-new-register').count()) > 0);
}

async function checkReturnTab(page) {
  await page.goto(`${BASE}/app/agent-center?tab=${encodeURIComponent('退回修改')}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const bubble = await page.getByTestId('status-bubble-content').textContent();
  record(
    '退回修改tab 气泡仍为管理员态势短句',
    !!bubble && /今日待审核 .*准入通过 .*退回修改/.test(bubble),
    bubble || '',
  );

  await openAssistant(page);
  record(
    '退回修改tab 窗口内为退回修改引导',
    (await textCount(page, '被退回啦，别担心')) > 0,
  );
  record('退回修改tab 窗口内也有去处理退回清单按钮', (await page.getByTestId('chat-welcome-mini-toggle').count()) > 0);
  await page.getByTestId('chat-welcome-mini-toggle').click();
  await page.waitForTimeout(200);
  record(
    '退回修改tab 窗口内清单每条提供编辑',
    (await page.locator('[data-testid^="chat-welcome-mini-action-navigate-edit"]').count()) > 0,
  );

  await page.goto(`${BASE}/app/agent-center?tab=${encodeURIComponent('退回修改')}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  record('退回修改tab 有去处理退回清单按钮', (await page.getByTestId('status-bubble-mini-toggle').count()) > 0);
  await page.getByTestId('status-bubble-mini-toggle').click();
  await page.waitForTimeout(200);
  record(
    '退回修改tab 清单每条提供编辑',
    (await page.locator('[data-testid^="status-bubble-mini-action-navigate-edit"]').count()) > 0,
  );
}

async function checkAuditPage(page) {
  await page.goto(`${BASE}/app/agent-center/audit/acc-004`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const bubble = await page.getByTestId('status-bubble-content').textContent();
  record(
    '审核注册页 气泡为预审结论',
    !!bubble && /我已完成预审：标注了 .*疑似问题.*预审结论为/.test(bubble),
    bubble || '',
  );
  record('审核注册页 气泡有审核通过按钮', (await page.getByTestId('status-bubble-action-audit-pass').count()) > 0);
  record('审核注册页 气泡有退回修改按钮', (await page.getByTestId('status-bubble-action-audit-return').count()) > 0);
  record('审核注册页 气泡有测试验证按钮', (await page.getByTestId('status-bubble-action-test').count()) > 0);

  await openAssistant(page);
  record(
    '审核注册页 窗口内为审核动作说明',
    (await textCount(page, '【审核通过】【退回修改】（附【测试验证】复核连通）')) > 0,
  );
  record('审核注册页 窗口内也有审核通过按钮', (await page.getByTestId('chat-welcome-action-audit-pass').count()) > 0);
  record('审核注册页 窗口内也有退回修改按钮', (await page.getByTestId('chat-welcome-action-audit-return').count()) > 0);
  record('审核注册页 窗口内也有测试验证按钮', (await page.getByTestId('chat-welcome-action-test').count()) > 0);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/app/agent-center`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem(
      'demo_settings_v1',
      JSON.stringify({ demoRole: '信息科管理员', visibleModules: {}, visibleSubPages: {} }),
    );
    if (typeof window.__useAuthSetRole === 'function') {
      window.__useAuthSetRole('信息科管理员', 'admin');
    }
  });
  await checkAllTab(page);
  await checkReturnTab(page);
  await checkAuditPage(page);
  await browser.close();

  const failed = cases.filter((item) => !item.pass);
  console.log(`\n${cases.length - failed.length}/${cases.length} passed`);
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
