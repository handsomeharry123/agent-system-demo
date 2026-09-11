#!/usr/bin/env node
/**
 * §3.1.1 V3.1 fix verify:
 * 新建注册页 (smart-register) bubble 文案里 "X" 占位符必须被替换为真实计数。
 * 复现路径：admin → 智能体接入中心 → 新建注册
 * 预期：气泡显示「今日审核中 X 个、准入通过 X 个、退回修改 X 个」, X 被替换为数字(或「暂无」)。
 *
 * V3.1 拆分前已修过 Registration.tsx (V2.6) 漏 replacer,
 * V3.1 拆出 SmartRegistrationForm 后遗漏了 replacer,导致 bubble 文案保留字面 X。
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

  // 1. 进入 smart-register 之前先在接入中心主页注入 admin 角色 + 灌几条历史数据
  await page.goto(`${BASE}/app/agent-center`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await switchRole(page, 'admin');

  // 2. 跳到 smart-register
  await page.goto(`${BASE}/app/agent-center/smart-register`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // 3. 等气泡出现（页面 mount 后 100ms 内主动推欢迎语）
  const bubble = await page.locator('[data-testid="status-bubble-content"]').first();
  await bubble.waitFor({ state: 'visible', timeout: 5000 });
  const text = (await bubble.textContent()) || '';

  console.log(`\n[bubble text]: ${text}\n`);

  // 4. 断言: 出现「今日审核中」「准入通过」「退回修改」三个固定文案
  record('气泡含态势 3 段', /今日审核中/.test(text) && /准入通过/.test(text) && /退回修改/.test(text), text);

  // 5. 断言: 不再保留字面 X（被替换为数字或「暂无」）
  const literalX = /\bX\b/.test(text);
  record('气泡不含字面 X 占位符', !literalX, literalX ? '仍有 X 字面值' : '');

  // 6. 断言: 数字部分合规（[0-9]+ 或 暂无）
  const passNumber = /今日审核中\s*(暂无|\d+)\s*个/.test(text)
    && /准入通过\s*(暂无|\d+)\s*个/.test(text)
    && /退回修改\s*(暂无|\d+)\s*个/.test(text);
  record('气泡三处均替换为数字/暂无', passNumber, text);

  // 7. 截图留证
  await page.screenshot({ path: 'verify_smart_register_bubble_replacer_artefacts/admin_after_fix.png', fullPage: false });

  // 8. 切换到 dept 角色,确保另一角色同样没 X
  await page.goto(`${BASE}/app/agent-center`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await switchRole(page, 'dept');
  await page.goto(`${BASE}/app/agent-center/smart-register`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const text2 = (await page.locator('[data-testid="status-bubble-content"]').first().textContent()) || '';
  console.log(`\n[dept bubble text]: ${text2}\n`);
  record('dept 角色气泡不含字面 X', !/\bX\b/.test(text2), text2);
  record(
    'dept 角色气泡三处均替换为数字/暂无',
    /今日审核中\s*(暂无|\d+)\s*个/.test(text2)
      && /准入通过\s*(暂无|\d+)\s*个/.test(text2)
      && /退回修改\s*(暂无|\d+)\s*个/.test(text2),
    text2,
  );
  await page.screenshot({ path: 'verify_smart_register_bubble_replacer_artefacts/dept_after_fix.png', fullPage: false });

  await browser.close();

  const passed = cases.filter((c) => c.pass).length;
  const failed = cases.length - passed;
  console.log(`\nTotal ${cases.length}: ${passed} PASS / ${failed} FAIL`);
  if (failed > 0) process.exit(1);
})();