import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const STORAGE_KEY = 'demo_settings_v1';

const settings = (demoRole) => ({
  demoRole,
  visibleModules: {
    home: true, workbench: false, 'agent-needs': true, 'agent-center': true, ledger: true,
    'resource-center': true, evaluation: true, orchestration: false, monitoring: true,
    security: false, 'data-asset': false, 'environment': false, 'user-center': false, audit: false, dict: false,
  },
  visibleSubPages: {},
});

const results = [];
const check = (name, cond, extra = '') => {
  results.push({ name, pass: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};

const browser = await chromium.launch({ headless: true });

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(
  ([k, v]) => localStorage.setItem(k, v),
  [STORAGE_KEY, JSON.stringify(settings('信息科管理员'))],
);
await page.goto(`${BASE}/app/home/auto-tasks/new`, { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(1000);

// 1) Form Card 宽度
const formCard = await page.locator('[data-testid="auto-task-form-card"]').boundingBox();
const col18 = await page.locator('[data-testid="home-v1-side-col"]').boundingBox();
check('表单 Card 存在', !!formCard);
console.log(`  formCard width = ${formCard?.width?.toFixed(1)}px`);
check('表单 Card 宽度 >= 500px', formCard && formCard.width >= 500);

// 2) Input 宽度:定位内部 antd input 元素
const nameInputInner = page.locator('[data-testid="auto-task-name"] input').first();
const promptInner = page.locator('[data-testid="auto-task-prompt"]').first();
const nameBox = await nameInputInner.boundingBox().catch(() => null);
const promptBox = await promptInner.boundingBox().catch(() => null);
if (nameBox) {
  console.log(`  nameInput width = ${nameBox.width.toFixed(1)}px`);
  check('任务名称 input 宽度 >= 400px', nameBox.width >= 400);
}
if (promptBox) {
  console.log(`  prompt textarea width = ${promptBox.width.toFixed(1)}px`);
  check('提示词 textarea 宽度 >= 400px', promptBox.width >= 400);
}

// 3) 执行频率 Select (周期:每天/每周/每月)
const cycleSel = page.locator('.ant-tabs-tabpane-active .ant-select').first();
const cycleBox = await cycleSel.boundingBox().catch(() => null);
if (cycleBox) {
  console.log(`  cyclePeriod Select width = ${cycleBox.width.toFixed(1)}px`);
}

// 4) 保存按钮可见
const saveBtn = await page.locator('[data-testid="auto-task-submit"]').boundingBox();
check('保存按钮可见', !!saveBtn);

await page.screenshot({ path: 'verify_auto_task_form_width.png', fullPage: false });
await ctx.close();
await browser.close();

const passed = results.filter(r => r.pass).length;
console.log(`\n${passed}/${results.length} PASS`);
process.exit(passed === results.length ? 0 : 1);
