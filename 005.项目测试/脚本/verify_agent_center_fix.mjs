// 验证修复：取消勾选时是否有提示，正常访问不受影响
import { chromium } from 'playwright';

const URL_TARGET = 'http://localhost:3001/app/agent-center';
const STORAGE_KEY = 'demo_settings_v1';

const BASE_MODULES = {
  home: true, workbench: false, 'agent-center': true,
  ledger: true, 'resource-center': true, evaluation: true,
  orchestration: false, monitoring: true, security: false,
  'data-asset': true, environment: true, 'user-center': true,
  audit: true, dict: true,
};

async function probe(browser, label, settings, expectJump) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('http://localhost:3001/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(([key, val]) => localStorage.setItem(key, val), [STORAGE_KEY, JSON.stringify(settings)]);
  await page.goto(URL_TARGET, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);

  const finalUrl = page.url();
  const tableVisible = await page.evaluate(() => !!document.querySelector('.ant-table-tbody tr'));
  // antd message 提示
  const msgVisible = await page.evaluate(() => {
    const nodes = document.querySelectorAll('.ant-message-notice-content');
    return Array.from(nodes).map((n) => (n.textContent || '').trim());
  });

  const reachedTarget = finalUrl === URL_TARGET;
  const jumped = !reachedTarget;
  const ok =
    (expectJump ? jumped && msgVisible.length > 0 : reachedTarget && tableVisible);
  console.log(`[${label}] expectJump=${expectJump}`);
  console.log(`  FINAL_URL=${finalUrl}`);
  console.log(`  TABLE=${tableVisible}`);
  console.log(`  MESSAGES=${JSON.stringify(msgVisible)}`);
  console.log(`  RESULT=${ok ? 'PASS' : 'FAIL'}`);
  console.log('---');
  await ctx.close();
  return ok;
}

const browser = await chromium.launch({ headless: true });
const r1 = await probe(browser, 'A.信息科管理员+勾选', { demoRole: '信息科管理员', visibleModules: BASE_MODULES, visibleSubPages: {} }, false);
const r2 = await probe(browser, 'B.信息科管理员+取消勾选(应跳转+提示)', { demoRole: '信息科管理员', visibleModules: { ...BASE_MODULES, 'agent-center': false }, visibleSubPages: {} }, true);
const r3 = await probe(browser, 'C.科室管理员+勾选', { demoRole: '科室管理员', visibleModules: BASE_MODULES, visibleSubPages: {} }, false);
const r4 = await probe(browser, 'D.科室管理员+取消勾选(应跳转+提示)', { demoRole: '科室管理员', visibleModules: { ...BASE_MODULES, 'agent-center': false }, visibleSubPages: {} }, true);
console.log('SUMMARY:', [r1, r2, r3, r4].every(Boolean) ? 'ALL PASS' : 'FAIL');
await browser.close();