#!/usr/bin/env node
/**
 * 新建注册页气泡指标对齐列表页
 *
 * 修复点 (2026-07-05):
 *   - 之前: SmartRegistrationForm 的 pushWelcomeGreeting replacer 用 ownRecords 过滤 loginName,
 *           管理员账号自己名下记录为 0,气泡出现「今日审核中 0 个、准入通过 0 个、退回修改 0 个」。
 *   - 修复: 与列表页 (index.tsx) counts 同源 — 草稿仅本人,其余 6 状态 admin 全量 / dept 仅本人。
 *   - 期望:
 *     - admin → 列表页 待审核 tab 气泡是「今日待审核 3 个、准入通过 3 个、退回修改 2 个」
 *              smart-register 气泡也要一致 (3/3/2),不是 0/0/0。
 *     - dept → 列表页 退回修改 tab 气泡是 dept 口径 (审核中 X、准入通过 X、退回修改 X,自己名下)
 *              smart-register 气泡同口径。
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';

const cases = [];
function record(name, pass, detail = '') {
  cases.push({ name, pass, detail });
  console.log(`${pass ? '✅ PASS' : '❌ FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function readBubbleText(page) {
  const loc = page.getByTestId('status-bubble-content');
  if ((await loc.count()) === 0) return null;
  return (await loc.first().textContent()) || '';
}

async function setRole(page, roleName, roleKey) {
  await page.evaluate(
    ({ roleName, roleKey }) => {
      localStorage.setItem(
        'demo_settings_v1',
        JSON.stringify({ demoRole: roleName, visibleModules: {}, visibleSubPages: {} }),
      );
      if (typeof window.__useAuthSetRole === 'function') {
        window.__useAuthSetRole(roleName, roleKey);
      }
    },
    { roleName, roleKey },
  );
}

async function checkAdmin(page) {
  await page.goto(`${BASE}/app/agent-center?tab=${encodeURIComponent('待审核')}`, {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(800);
  const listBubble = await readBubbleText(page);
  console.log(`  list-page 气泡: ${listBubble}`);

  await page.goto(`${BASE}/app/agent-center/smart-register`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const regBubble = await readBubbleText(page);
  console.log(`  smart-register 气泡: ${regBubble}`);

  record(
    'admin 列表页气泡非 0',
    !!listBubble && /今日待审核\s*[1-9]\d*\s*个.*准入通过\s*[1-9]\d*\s*个.*退回修改\s*[1-9]\d*\s*个/.test(listBubble),
    listBubble || '(empty)',
  );
  record(
    'admin smart-register 气泡不为全 0',
    !!regBubble && !/今日审核中\s*0\s*个.*准入通过\s*0\s*个.*退回修改\s*0\s*个/.test(regBubble),
    regBubble || '(empty)',
  );
  // 关键断言:smart-register 气泡的数字必须与列表页一致(同一数据源 counts)
  const listNums = (listBubble || '').match(/(\d+)\s*个/g) || [];
  const regNums = (regBubble || '').match(/(\d+)\s*个/g) || [];
  record(
    'admin smart-register 与列表页气泡数字一致(同源 counts)',
    listNums.length === 3 && regNums.length === 3 && listNums.join(',') === regNums.join(','),
    `list=[${listNums.join(',')}]  reg=[${regNums.join(',')}]`,
  );

  // 截图保留
  await page.screenshot({ path: 'verify_smart_register_bubble_counts_admin.png', fullPage: false });
}

async function checkDept(page) {
  await setRole(page, '科室管理员', 'dept');
  await page.goto(`${BASE}/app/agent-center?tab=${encodeURIComponent('退回修改')}`, {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(800);
  const listBubble = await readBubbleText(page);
  console.log(`  list-page (dept) 气泡: ${listBubble}`);

  await page.goto(`${BASE}/app/agent-center/smart-register`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const regBubble = await readBubbleText(page);
  console.log(`  smart-register (dept) 气泡: ${regBubble}`);

  record(
    'dept 列表页气泡口径 = dept 口径(审核中/准入通过/退回修改)',
    !!listBubble && /今日审核中.*准入通过.*退回修改/.test(listBubble),
    listBubble || '(empty)',
  );
  record(
    'dept smart-register 气泡口径 = dept 口径(审核中/准入通过/退回修改)',
    !!regBubble && /今日审核中.*准入通过.*退回修改/.test(regBubble),
    regBubble || '(empty)',
  );

  await page.screenshot({ path: 'verify_smart_register_bubble_counts_dept.png', fullPage: false });
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // 先访问一次,确保 localStorage 已生效
  await page.goto(`${BASE}/app/agent-center`, { waitUntil: 'networkidle' });
  await setRole(page, '信息科管理员', 'admin');

  console.log('\n=== admin 角色 ===');
  await checkAdmin(page);

  console.log('\n=== dept 角色 ===');
  await checkDept(page);

  await browser.close();

  const failed = cases.filter((c) => !c.pass);
  console.log(`\n${cases.length - failed.length}/${cases.length} passed`);
  if (failed.length > 0) {
    console.log('\nFAILED cases:');
    failed.forEach((c) => console.log(`  - ${c.name}: ${c.detail}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});