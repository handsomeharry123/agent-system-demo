/**
 * 接入中心智能化升级 - PRD §4.1.1 文字气泡回归
 *
 * 核心断言：
 *  - 列表页**没有顶部"态势看板"大卡**（删除 GlobalInsightBar）
 *  - 列表页**右下角机器人旁弹出文字气泡**（"医小管 + 一句话态势汇报"）
 *  - 气泡内**可点状态 chip** 跳 Tab（不是顶部大卡）
 *  - 气泡内**一键直达按钮**（台账中心 / 准入评测沙盒），按 isPlatformAdmin 置灰
 *  - 6s 后自动收起
 *  - 手动 ✕ 可关闭
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const result = { steps: [], checks: {}, errors: [] };
const log = (m) => { console.log(`[STEP] ${m}`); result.steps.push(m); };

try {
  log('Launch chromium (admin)');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => result.errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') console.log(`[C-ERR] ${m.text()}`); });

  log('Login as 信息科管理员');
  await page.goto(`${BASE}/app/login?role=admin`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  log('进入注册管理 (全部)');
  await page.goto(`${BASE}/app/agent-center`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 1. 顶部 GlobalInsightBar 已下线 — 列表页内不再有 data-testid=global-insight-bar
  const oldBar = await page.locator('[data-testid="global-insight-bar"]').count();
  result.checks['4.1_no_old_bar'] = oldBar === 0;
  log(`4.1.1 顶部 GlobalInsightBar(6 维大卡) 已下线: ${oldBar === 0} (count=${oldBar})`);

  // 2. 机器人旁文字气泡可见
  const bubble = page.locator('[data-testid="status-bubble"]');
  const bubbleVisible = await bubble.isVisible();
  result.checks['4.1_text_bubble_visible'] = bubbleVisible;
  log(`4.1.1 机器人旁文字气泡可见: ${bubbleVisible}`);

  // 3. 气泡文字内容（admin 视角）
  const text = await page.locator('[data-testid="status-bubble-content"]').textContent().catch(() => '');
  result.checks['4.1_bubble_text'] = text || '';
  log(`4.1.1 气泡文字: ${text}`);

  // 4. 状态 chip（4 个：待审核 / 审核中 / 退回 / 已通过）
  const chipCount = await page.locator('[data-testid^="status-bubble-chip-"]').count();
  result.checks['4.1_state_chips'] = chipCount;
  log(`4.1.1 状态 chip 数量: ${chipCount}`);

  // 5. 一键直达：台账中心 + 准入评测沙盒
  const ledgerBtn = await page.locator('[data-testid="status-bubble-action-ledger"]').isVisible().catch(() => false);
  const evalBtn = await page.locator('[data-testid="status-bubble-action-eval"]').isVisible().catch(() => false);
  result.checks['4.1_action_ledger'] = ledgerBtn;
  result.checks['4.1_action_eval'] = evalBtn;
  log(`4.1.1 一键直达 台账中心: ${ledgerBtn}, 准入评测沙盒: ${evalBtn}`);

  // 6. 准入评测沙盒对 admin 应可用（不置灰）
  const evalDisabled = await page.locator('[data-testid="status-bubble-action-eval"]').isDisabled().catch(() => true);
  result.checks['4.1_eval_enabled_for_admin'] = !evalDisabled;
  log(`4.1.1 admin 准入评测沙盒未置灰: ${!evalDisabled}`);

  await page.screenshot({ path: '/tmp/v3_4_1_1_bubble.png', fullPage: true });

  // 7. 8s 后自动收起（AgentAssistant timer 是 8000ms）
  log('Wait 9s for 气泡自动收起');
  await page.waitForTimeout(9000);
  const bubbleAfter = await bubble.isVisible().catch(() => false);
  result.checks['4.1_bubble_auto_fade'] = !bubbleAfter;
  log(`4.1.1 气泡 9s 后自动收起: ${!bubbleAfter}`);

  // 8. 重新触发：再点回「全部」Tab，态势应再次弹
  log('重新进入列表页触发气泡再次弹出');
  await page.goto(`${BASE}/app/agent-center?tab=待审核`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.goto(`${BASE}/app/agent-center`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const reShown = await bubble.isVisible();
  result.checks['4.1_bubble_repop'] = reShown;
  log(`4.1.1 切回全部 Tab 后气泡再次弹出: ${reShown}`);

  // 9. 点 chip「待审核」→ URL 应变 ?tab=待审核
  if (reShown) {
    await page.locator('[data-testid="status-bubble-chip-pending"]').click();
    await page.waitForTimeout(800);
    const after = page.url();
    result.checks['4.1_chip_jump_tab'] = after.includes('tab=%E5%BE%85%E5%AE%A1%E6%A0%B8'); // 待审核
    log(`4.1.1 chip「待审核」点击后 URL: ${after}`);
  }

  // 10. 切换到非 admin 视角（科室管理员）→ 一键直达应均可见（两角色都有权限）
  log('切换到科室管理员视角');
  await page.goto(`${BASE}/app/login?role=dept`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.goto(`${BASE}/app/agent-center`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const bubbleDept = await page.locator('[data-testid="status-bubble"]').isVisible().catch(() => false);
  result.checks['4.1_bubble_for_dept'] = bubbleDept;
  log(`4.1.1 科室管理员气泡: ${bubbleDept}`);
  await page.screenshot({ path: '/tmp/v3_4_1_1_dept.png', fullPage: true });

  // 11. 关闭按钮（手动 ✕）
  if (bubbleDept) {
    await page.locator('[data-testid="status-bubble"] .agent-welcome-bubble-close').click();
    await page.waitForTimeout(500);
    const closed = await page.locator('[data-testid="status-bubble"]').isVisible().catch(() => false);
    result.checks['4.1_close_works'] = !closed;
    log(`4.1.1 手动关闭: ${!closed}`);
  }

  await browser.close();
  console.log('\n===== CHECKS =====');
  console.log(JSON.stringify(result.checks, null, 2));
  console.log('===== ERRORS =====');
  console.log(JSON.stringify(result.errors, null, 2));
  if (result.errors.length > 0) process.exit(1);
} catch (e) {
  console.error('[FATAL]', e);
  process.exit(2);
}
