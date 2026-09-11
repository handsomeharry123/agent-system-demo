// 需求详情页「编辑需求」流程验证
import { chromium } from 'playwright';
const BASE = 'http://localhost:3001';
const K = 'demo_settings_v1';
const s = { demoRole: '信息科管理员', visibleModules: { home: true, workbench: false, 'agent-needs': true, 'agent-center': true, ledger: true, 'resource-center': true, evaluation: true, orchestration: false, monitoring: true, security: false, 'data-asset': true, environment: true, 'user-center': true, audit: true, dict: true }, visibleSubPages: {} };
const results = [];
const check = (n, c, e = '') => { results.push(!!c); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${e ? '  ' + e : ''}`); };

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await p.evaluate(([k, v]) => localStorage.setItem(k, v), [K, JSON.stringify(s)]);

// 1. 详情页出现「编辑需求」按钮
await p.goto(`${BASE}/app/agent-needs/detail/need-001`, { waitUntil: 'networkidle', timeout: 20000 });
await p.waitForTimeout(800);
const hasEditBtn = await p.evaluate(() => Array.from(document.querySelectorAll('button')).some((x) => x.textContent?.replace(/\s/g, '').includes('编辑需求')));
check('详情页出现「编辑需求」按钮', hasEditBtn);

// 2. 点编辑 → 进入编辑页，带入原字段
await p.locator('button:has-text("编辑需求")').first().click();
await p.waitForTimeout(1000);
check('跳转到 edit 路由', p.url().includes('/app/agent-needs/edit/need-001'), p.url());
const titleVal = await p.inputValue('input#title').catch(() => '');
check('表单带入原标题', titleVal.includes('门诊智能预问诊助手'), `title="${titleVal}"`);
const btns = await p.$$eval('button', (bs) => bs.map((x) => x.textContent?.replace(/\s/g, '')).filter(Boolean));
check('已提交编辑态：按钮显示「保存修改」', btns.includes('保存修改'), JSON.stringify(btns.filter(t=>/保存|暂存|提交/.test(t))));
check('已提交编辑态：不显示「暂存」', !btns.includes('暂存'));

// 3. 修改标题 → 保存修改 → 回详情页并更新
const title = p.locator('input#title').first();
await title.click();
// 清空后重输
await p.keyboard.press('Control+A');
await p.keyboard.press('Meta+A');
await title.fill('');
await title.type('门诊智能预问诊助手V2', { delay: 10 });
await p.keyboard.press('Tab');
await p.waitForTimeout(200);
await p.locator('button:has-text("保存修改")').first().click();
await p.waitForTimeout(400);
await p.click('.ant-modal-footer button:has-text("确认保存")');
await p.waitForTimeout(1000);
check('保存后回到详情页', p.url().includes('/app/agent-needs/detail/need-001'), p.url());
const updated = await p.evaluate(() => document.body.textContent?.includes('门诊智能预问诊助手V2'));
check('详情页展示更新后的标题', updated);

// 4. 列表页也应更新（且仍在已提交列表，不落草稿）
//    用 SPA 软导航（点侧边栏菜单），避免 page.goto 硬刷新重置内存 store
await p.locator('.ant-menu-title-content:has-text("智能体建设需求管理")').first().click();
await p.waitForTimeout(1000);
const inList = await p.evaluate(() => document.body.textContent?.includes('门诊智能预问诊助手V2'));
check('已提交列表展示更新后的需求（未降级为草稿）', inList, p.url());
await p.click('.ant-tabs-tab:has-text("草稿列表")');
await p.waitForTimeout(500);
const notInDraft = await p.evaluate(() => !document.body.textContent?.includes('门诊智能预问诊助手V2'));
check('该需求未出现在草稿列表', notInDraft);

await b.close();
const passed = results.filter(Boolean).length;
console.log(`\n==== ${passed}/${results.length} PASS ====`);
process.exit(passed === results.length ? 0 : 1);
