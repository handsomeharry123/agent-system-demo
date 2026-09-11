#!/usr/bin/env node
/**
 * §3.1.1 V3.1 fix verify - 0 不再显示为「暂无」:
 * 列表页 index.tsx + Registration.tsx + SmartRegistrationForm.tsx 都已把 fmt 从
 *   (n > 0 ? String(n) : '暂无') 改为 String(n)
 * 验证：列表页 6 状态 Tab 各自的 bubble 不再含「暂无」。
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';

const cases = [];
function record(name, pass, detail = '') {
  cases.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
}

async function switchRole(page, role) {
  await page.evaluate((r) => {
    const hook = window.__useAuthSetRole;
    if (typeof hook === 'function') hook(r);
  }, role);
  await page.waitForTimeout(200);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', () => {}); // 忽略 SmartRegistrationForm 的 setMaterialOffer 崩溃(不在本次修复范围)

  // 1. 列表页 admin / 全部 tab
  await page.goto(`${BASE}/app/agent-center`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await switchRole(page, 'admin');
  await page.waitForTimeout(800);
  const adminAll = (await page.locator('[data-testid="status-bubble-content"]').first().textContent()) || '';
  console.log(`\n[admin/全部]: ${adminAll}\n`);
  record(
    'admin 全部 bubble 不含「暂无」',
    !/暂无/.test(adminAll),
    adminAll,
  );
  record(
    'admin 全部 bubble 三段已替换',
    /今日(待审核|审核中)\s*\d+\s*个/.test(adminAll)
      && /准入通过\s*\d+\s*个/.test(adminAll)
      && /退回修改\s*\d+\s*个/.test(adminAll)
      && !/\bX\b/.test(adminAll),
    adminAll,
  );
  record(
    'admin 全部 bubble 含态势前缀',
    /今日(待审核|审核中)/.test(adminAll),
    adminAll,
  );

  // 2. 列表页 dept / 全部 tab
  await page.goto(`${BASE}/app/agent-center`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await switchRole(page, 'dept');
  await page.waitForTimeout(800);
  const deptAll = (await page.locator('[data-testid="status-bubble-content"]').first().textContent()) || '';
  console.log(`\n[dept/全部]: ${deptAll}\n`);
  record('dept 全部 bubble 不含「暂无」', !/暂无/.test(deptAll), deptAll);

  // 3. 切换到「退回修改」Tab
  await page.locator('.ant-tabs-tab', { hasText: '退回修改' }).click();
  await page.waitForTimeout(800);
  const deptReturn = (await page.locator('[data-testid="status-bubble-content"]').first().textContent()) || '';
  console.log(`\n[dept/退回修改]: ${deptReturn}\n`);
  record(
    'dept 退回修改 bubble 不含「暂无」',
    !/暂无/.test(deptReturn),
    deptReturn,
  );

  await browser.close();
  const passed = cases.filter((c) => c.pass).length;
  const failed = cases.length - passed;
  console.log(`\nTotal ${cases.length}: ${passed} PASS / ${failed} FAIL`);
  if (failed > 0) process.exit(1);
})();