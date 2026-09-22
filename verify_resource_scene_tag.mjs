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
await page.goto(`${BASE}/app/home/overview`, { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(1000);

// 1) 4 个场景标签全部存在且可见
for (const k of ['register-requirement', 'access-apply', 'ledger-query', 'resource-apply']) {
  const el = page.locator(`[data-testid="home-v1-scene-${k}"]`);
  const visible = await el.isVisible().catch(() => false);
  check(`场景标签 ${k} 存在且可见`, visible);
}

// 2) 顺序:台账查询 后面就是 资源申请
const order = await page.evaluate(() => {
  const list = Array.from(document.querySelectorAll('[data-testid^="home-v1-scene-"]'));
  return list.map((n) => n.getAttribute('data-testid'));
});
console.log('  顺序 = ' + JSON.stringify(order));
check(
  '资源申请标签 排在台账查询 后面',
  !!order && order.indexOf('home-v1-scene-resource-apply') > order.indexOf('home-v1-scene-ledger-query'),
);

// 截图:展示新标签已就位
await page.screenshot({ path: 'verify_resource_scene_tag_before_click.png' });

// 3) 点击「资源申请」标签
await page.locator('[data-testid="home-v1-scene-resource-apply"]').click();
await page.waitForTimeout(500);

// 4) 验证开场气泡包含「资源申请」module 标签
const moduleTagCount = await page.locator('.ant-tag:has-text("资源申请")').count();
check('对话气泡含「资源申请」module Tag', moduleTagCount >= 1);

// 5) 验证开场气泡内容
const bubbleText = await page.locator('[data-testid="home-v1"]').innerText();
check('开场气泡引导用户描述算力 / 存储 / 接口', bubbleText.includes('算力') && bubbleText.includes('存储'));
check('开场气泡提示提交至资源中心', bubbleText.includes('资源管理中心'));

// 6) 验证 quickAction 出现
check('quickAction 含「申请 GPU 算力」', bubbleText.includes('申请 GPU 算力'));
check('quickAction 含「申请对象存储扩容」', bubbleText.includes('申请对象存储扩容'));
check('quickAction 含「申请调用 LLM 接口的额度」', bubbleText.includes('申请调用 LLM 接口的额度'));

await page.screenshot({ path: 'verify_resource_scene_tag.png' });
await ctx.close();
await browser.close();

const passed = results.filter(r => r.pass).length;
console.log(`\n${passed}/${results.length} PASS`);
process.exit(passed === results.length ? 0 : 1);
