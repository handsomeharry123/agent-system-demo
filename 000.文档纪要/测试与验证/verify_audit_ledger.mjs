import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1200 } });
const page = await ctx.newPage();

const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

// 用例 1：登录信息科管理员 → 访问「审核通过」tab → 右上角应该看到「新建注册」+「台账总览」两个按钮
// 用例 2：登录普通用户 → 访问「审核通过」tab → 右上角也应该看到两个按钮（台账总览所有角色可见）

const ROLE = process.argv[2] || 'admin';
console.log(`\n=== 用例：审核通过 tab 右上角双按钮可见性测试 — 角色：${ROLE} ===`);

await page.goto(`http://localhost:3001/app/login?role=${ROLE}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
// 兼容不同角色入口
const url = page.url();
console.log(`登录后 URL：${url}`);

// 直接跳到接入中心「审核通过」tab
await page.goto('http://localhost:3001/app/agent-center?tab=审核通过', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

await page.screenshot({ path: `/tmp/audit_ledger_${ROLE}.png`, fullPage: true });

// 检查右上角按钮
const headerInfo = await page.evaluate(() => {
  const header = document.querySelector('.ant-page-header, .page-header, header');
  const headerText = header ? header.innerText : '';
  const buttons = Array.from(document.querySelectorAll('button, .ant-btn')).map(b => b.innerText.trim()).filter(t => t);
  return { headerText, buttons };
});

console.log('--- 页面按钮文本 ---');
console.log(headerInfo.buttons.join(' | '));

const hasNewCreate = headerInfo.buttons.includes('新建注册');
const hasLedgerOverview = headerInfo.buttons.includes('台账总览');

console.log(`\n[结果]`);
console.log(`  ✓ 「新建注册」按钮：${hasNewCreate ? '可见' : '❌ 不可见'}`);
console.log(`  ✓ 「台账总览」按钮：${hasLedgerOverview ? '可见' : '❌ 不可见'}`);

// 点击「台账总览」按钮验证跳转
if (hasLedgerOverview) {
  await page.click('button:has-text("台账总览")');
  await page.waitForTimeout(1500);
  const navUrl = page.url();
  const ok = navUrl.includes('/app/ledger');
  console.log(`  ✓ 点击「台账总览」后跳转：${ok ? `成功 → ${navUrl}` : `❌ 失败 → ${navUrl}`}`);
  await page.screenshot({ path: `/tmp/audit_ledger_after_${ROLE}.png`, fullPage: true });
}

// 同时验证其他 tab 不显示「台账总览」
console.log(`\n--- 反向校验：其他 Tab 不应出现「台账总览」 ---`);
for (const tab of ['全部', '草稿', '待审核', '审核中', '撤销修改', '退回修改']) {
  await page.goto(`http://localhost:3001/app/agent-center?tab=${encodeURIComponent(tab)}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const buttons = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button, .ant-btn')).map(b => b.innerText.trim()).filter(t => t)
  );
  const leaked = buttons.includes('台账总览');
  console.log(`  Tab「${tab}」：「台账总览」${leaked ? '❌ 误显示' : '✓ 未显示'}`);
}

if (logs.length) {
  console.log('\n--- 浏览器 console 日志 ---');
  logs.forEach(l => console.log(l));
}

await browser.close();
console.log(`\n截图：/tmp/audit_ledger_${ROLE}.png`);