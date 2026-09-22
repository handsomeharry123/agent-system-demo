// 验证 agent-center 在不同角色 + 不同 visibleModules 下的实际表现
import { chromium } from 'playwright';

const URL_HOME = 'http://localhost:3001/app/home/workbench';
const URL_TARGET = 'http://localhost:3001/app/agent-center';

const STORAGE_KEY = 'demo_settings_v1';

const DEFAULT_SETTINGS = {
  demoRole: '信息科管理员',
  visibleModules: {
    home: true,
    workbench: false,
    'agent-center': true,
    ledger: true,
    'resource-center': true,
    evaluation: true,
    orchestration: false,
    monitoring: true,
    security: false,
    'data-asset': true,
    environment: true,
    'user-center': true,
    audit: true,
    dict: true,
  },
  visibleSubPages: {},
};

async function visitWith(browser, settings, label) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  // 先打开根路径,注入 localStorage 后刷新
  await page.goto('http://localhost:3001/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(([key, val]) => {
    localStorage.setItem(key, val);
  }, [STORAGE_KEY, JSON.stringify(settings)]);
  await page.goto(URL_TARGET, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1200);
  const finalUrl = page.url();
  const tableVisible = await page.evaluate(() => {
    return !!document.querySelector('.ant-table-tbody tr');
  });
  const headings = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('h1,h2,h3,.ant-page-header-heading-title'))
      .map((n) => n.textContent?.trim()).filter(Boolean).slice(0, 6);
  });
  const sidebarAgentCenter = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.ant-menu-item a, .ant-menu-title-content'))
      .some((n) => (n.textContent || '').includes('接入中心'));
  });
  console.log(`[${label}] demoRole=${settings.demoRole} agent-center勾选=${settings.visibleModules['agent-center']}`);
  console.log(`  FINAL_URL=${finalUrl}`);
  console.log(`  HEADINGS=${JSON.stringify(headings)}`);
  console.log(`  TABLE_ROWS_VISIBLE=${tableVisible}`);
  console.log(`  SIDEBAR_HAS_AGENT_CENTER=${sidebarAgentCenter}`);
  console.log(`  PASS=${finalUrl === URL_TARGET && tableVisible}`);
  await ctx.close();
  return { finalUrl, tableVisible, sidebarAgentCenter };
}

const browser = await chromium.launch({ headless: true });

// Case A: 信息科管理员 + agent-center 勾选(默认) —— 应该能正常访问
await visitWith(browser, { ...DEFAULT_SETTINGS, demoRole: '信息科管理员', visibleModules: { ...DEFAULT_SETTINGS.visibleModules, 'agent-center': true } }, 'A.信息科管理员+勾选');

// Case B: 信息科管理员 + agent-center 取消勾选 —— 应该被跳走
await visitWith(browser, { ...DEFAULT_SETTINGS, demoRole: '信息科管理员', visibleModules: { ...DEFAULT_SETTINGS.visibleModules, 'agent-center': false } }, 'B.信息科管理员+取消勾选(复现bug)');

// Case C: 科室管理员 + agent-center 勾选 —— 应该能正常访问
await visitWith(browser, { ...DEFAULT_SETTINGS, demoRole: '科室管理员', visibleModules: { ...DEFAULT_SETTINGS.visibleModules, 'agent-center': true } }, 'C.科室管理员+勾选');

// Case D: 科室管理员 + agent-center 取消勾选 —— 应该被跳走
await visitWith(browser, { ...DEFAULT_SETTINGS, demoRole: '科室管理员', visibleModules: { ...DEFAULT_SETTINGS.visibleModules, 'agent-center': false } }, 'D.科室管理员+取消勾选(复现bug)');

await browser.close();