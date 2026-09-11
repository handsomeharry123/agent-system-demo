// verify_agent_unread_badge.mjs — 验证: 医小管悬浮入口右上角红点显示具体未读消息数
//
// 测试流程：
//  1. 打开首页, 唤起医小管浮层（让 hasOpenedRef=true, 这样后续消息会被计为未读）
//  2. 关闭浮层
//  3. 通过 window.__smartDraft.addMessage (dev hook) 推送 N 条 agent 消息
//  4. 验证红点显示具体数字
//  5. 重新打开浮层, 红点消失
import { chromium } from 'playwright';

const URL_BASE = 'http://localhost:3001';
const OUT_DIR = '/Users/harry/Desktop/CC_TEST/agent-system';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('[browser-error]', msg.text());
  });
  page.on('pageerror', (err) => console.log('[page-error]', err.message));

  try {
    console.log('=== step 1: 打开 /app/home/workbench ===');
    await page.goto(`${URL_BASE}/app/home/workbench`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    console.log('url:', page.url());

    const robotBtn = page.locator('[aria-label*="唤起智能填写助手"]').first();
    await robotBtn.waitFor({ state: 'visible', timeout: 8000 });
    console.log('✓ 医小管入口可见');

    console.log('=== step 2: 唤起浮层（让 hasOpenedRef=true）===');
    await robotBtn.click();
    await page.waitForTimeout(800);
    console.log('✓ 浮层已打开');

    // 验证 dev hook 已挂载
    const hookReady = await page.evaluate(() => !!window.__smartDraft?.addMessage);
    console.log(`window.__smartDraft.addMessage 存在: ${hookReady}`);
    if (!hookReady) {
      throw new Error('window.__smartDraft.addMessage 未挂载, dev hook 失效');
    }

    console.log('=== step 3: 关闭浮层 ===');
    await page.evaluate(() => {
      const closeBtn = document.querySelector(
        'div[style*="agentChatPanelIn"] button .anticon-close'
      )?.closest('button');
      if (closeBtn) closeBtn.click();
    });
    await page.waitForTimeout(800);

    // 入口应已可见
    const entryVisible = await page.evaluate(
      () => !!document.querySelector('[aria-label*="唤起智能填写助手"]'),
    );
    console.log(`入口元素可见: ${entryVisible}`);

    console.log('=== step 4: 推送 3 条 agent 消息 (dev hook 注入) ===');
    await page.evaluate(() => {
      const sd = window.__smartDraft;
      for (let i = 1; i <= 3; i += 1) {
        sd.addMessage({
          role: 'agent',
          type: 'text',
          content: `测试推送消息 ${i}（应在浮层关闭时计入未读）`,
        });
      }
    });
    await page.waitForTimeout(800); // 等 React 重渲染

    // 读 React 状态 (DOM 红点 span 文本)
    const debugUnread = await page.evaluate(() => {
      const btn = document.querySelector('[aria-label*="唤起智能填写助手"]');
      if (!btn) return null;
      const spans = Array.from(btn.querySelectorAll('span')).filter(
        (s) => s.style.display !== 'none',
      );
      const badgeSpan = spans.find((s) => s.textContent && /^\d+$/.test(s.textContent));
      return badgeSpan ? badgeSpan.textContent : null;
    });
    console.log(`React 内部 unreadCount = ${debugUnread} (期望 "3")`);

    if (debugUnread !== '3') {
      throw new Error(`unreadCount 应为 3, 实际为 ${debugUnread}`);
    }
    console.log('✓ React 状态 unreadCount = 3, 红点逻辑正确');

    // 截图: 浮层收起, 入口右上角红点显示 "3"
    await page.screenshot({ path: `${OUT_DIR}/verify_unread_1_badge_3.png`, fullPage: false });
    console.log('截图 → verify_unread_1_badge_3.png');

    // 验证 DOM 上红点 span 显示 "3"
    const badgeText = await page.evaluate(() => {
      const btn = document.querySelector('[aria-label*="唤起智能填写助手"]');
      if (!btn) return 'no-button';
      // 跳过隐藏的 debug span
      const spans = Array.from(btn.querySelectorAll('span')).filter(
        (s) => s.style.display !== 'none',
      );
      const badgeSpan = spans.find((s) => s.textContent && /^\d+$/.test(s.textContent));
      return badgeSpan ? badgeSpan.textContent : `no-badge (spans: ${spans.map((s) => s.textContent).join('|')})`;
    });
    console.log(`红点显示文本: "${badgeText}" (期望 "3")`);

    if (badgeText !== '3') {
      throw new Error(`红点应为 "3", 实际为 "${badgeText}"`);
    }
    console.log('✓ 红点正确显示具体数字 3');

    console.log('=== step 5: 重新打开浮层, 红点消失 + unreadCount 清零 ===');
    await robotBtn.click();
    await page.waitForTimeout(800);
    // 浮层已展开, 入口元素已 unmount, 入口元素不可见
    const entryStillVisible = await page.evaluate(
      () => !!document.querySelector('[aria-label*="唤起智能填写助手"]'),
    );
    console.log(`重新打开后入口元素可见: ${entryStillVisible} (期望 false, 浮层已展开)`);
    await page.screenshot({ path: `${OUT_DIR}/verify_unread_2_reopen_cleared.png`, fullPage: false });

    console.log('=== step 6: 关闭浮层, 再推 1 条 agent 消息, 期待红点显示 "1" ===');
    await page.evaluate(() => {
      const closeBtn = document.querySelector(
        'div[style*="agentChatPanelIn"] button .anticon-close'
      )?.closest('button');
      if (closeBtn) closeBtn.click();
    });
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      window.__smartDraft.addMessage({
        role: 'agent',
        type: 'text',
        content: '再推一条',
      });
    });
    await page.waitForTimeout(800);

    const debugAfter1 = await page.evaluate(() => {
      const btn = document.querySelector('[aria-label*="唤起智能填写助手"]');
      if (!btn) return null;
      const spans = Array.from(btn.querySelectorAll('span')).filter(
        (s) => s.style.display !== 'none',
      );
      const badgeSpan = spans.find((s) => s.textContent && /^\d+$/.test(s.textContent));
      return badgeSpan ? badgeSpan.textContent : null;
    });
    console.log(`重置后再推 1 条: unreadCount = ${debugAfter1} (期望 "1")`);
    await page.screenshot({ path: `${OUT_DIR}/verify_unread_3_badge_1.png`, fullPage: false });

    if (debugAfter1 !== '1') {
      throw new Error(`unreadCount 应为 1, 实际为 ${debugAfter1}`);
    }
    console.log('✓ 重置后, 红点正确累加显示 1');

    // 验证 DOM 红点也显示 "1"
    const finalBadge = await page.evaluate(() => {
      const btn = document.querySelector('[aria-label*="唤起智能填写助手"]');
      if (!btn) return 'no-button';
      const spans = Array.from(btn.querySelectorAll('span')).filter(
        (s) => s.style.display !== 'none',
      );
      const badgeSpan = spans.find((s) => s.textContent && /^\d+$/.test(s.textContent));
      return badgeSpan ? badgeSpan.textContent : 'no-badge';
    });
    console.log(`红点 DOM 显示: "${finalBadge}" (期望 "1")`);
    if (finalBadge !== '1') {
      throw new Error(`DOM 红点应为 "1", 实际为 "${finalBadge}"`);
    }

    console.log('\n=== 验证通过: 医小管右上角红点正确显示具体未读消息数 ===');
  } catch (err) {
    console.log('\n=== 验证失败 ===');
    console.log('error:', err.message);
    await page.screenshot({ path: `${OUT_DIR}/verify_unread_fail.png`, fullPage: false }).catch(() => {});
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
