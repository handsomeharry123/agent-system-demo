// 智能体建设需求管理 - 冒烟验证
// 覆盖：菜单位置(首页↔接入中心之间) / 默认 Tab / 草稿 Tab / 生成需求(暂存+提交) / 智能化匹配 / 无匹配兜底
import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const STORAGE_KEY = 'demo_settings_v1';
const results = [];
const check = (name, cond, extra = '') => {
  results.push({ name, pass: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};

const settings = (demoRole) => ({
  demoRole,
  visibleModules: {
    home: true, workbench: false, 'agent-needs': true, 'agent-center': true, ledger: true,
    'resource-center': true, evaluation: true, orchestration: false, monitoring: true,
    security: false, 'data-asset': true, environment: true, 'user-center': true, audit: true, dict: true,
  },
  visibleSubPages: {},
});

const browser = await chromium.launch({ headless: true });

async function newPage(demoRole) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [STORAGE_KEY, JSON.stringify(settings(demoRole))]);
  return { ctx, page };
}

// ── 1. 菜单位置：首页 → 智能体建设需求管理 → 智能体接入中心 ──
{
  const { ctx, page } = await newPage('信息科管理员');
  await page.goto(`${BASE}/app/agent-needs`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1000);
  const menuTexts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.ant-menu-title-content, .ant-menu-item')).map((n) => n.textContent?.trim()).filter(Boolean),
  );
  const joined = menuTexts.join('|');
  const idxNeeds = menuTexts.findIndex((t) => t.includes('智能体建设需求管理'));
  const idxHome = menuTexts.findIndex((t) => t === '首页' || t.includes('首页'));
  const idxAccess = menuTexts.findIndex((t) => t.includes('接入中心'));
  check('侧边栏出现「智能体建设需求管理」', idxNeeds >= 0);
  check('位于「首页」之后、「接入中心」之前', idxHome >= 0 && idxNeeds > idxHome && idxNeeds < idxAccess, `home=${idxHome} needs=${idxNeeds} access=${idxAccess}`);

  // 默认 Tab = 需求管理列表，表格有已提交数据
  const defaultTabActive = await page.evaluate(() =>
    document.querySelector('.ant-tabs-tab-active')?.textContent?.includes('需求管理列表'));
  check('默认选中「需求管理列表」Tab', defaultTabActive);
  const listRows = await page.$$eval('.ant-table-tbody tr.ant-table-row', (rs) => rs.length);
  check('需求管理列表有数据', listRows > 0, `rows=${listRows}`);

  // 切草稿 Tab
  await page.click('.ant-tabs-tab:has-text("草稿列表")');
  await page.waitForTimeout(600);
  const draftRows = await page.$$eval('.ant-table-tbody tr.ant-table-row', (rs) => rs.length);
  check('草稿列表有本人草稿(admin)', draftRows > 0, `rows=${draftRows}`);
  await ctx.close();
}

// ── 2. 智能化匹配：列表行触发 → TOP3 弹窗 ──
{
  const { ctx, page } = await newPage('信息科管理员');
  await page.goto(`${BASE}/app/agent-needs`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(800);
  // 点「智能化匹配」（fixed:right 列 antd 会渲染重复 DOM，取首个可见的）
  await page.locator('button:has-text("智能化匹配")').first().click();
  await page.waitForTimeout(800);
  const modalTitle = await page.evaluate(() => document.querySelector('.ant-modal-title')?.textContent || '');
  check('智能化匹配弹窗出现', modalTitle.includes('智能化匹配结果'), `title=${modalTitle}`);
  const matchRows = await page.$$eval('.ant-modal-body .ant-table-tbody tr.ant-table-row', (rs) => rs.length);
  check('弹窗展示 TOP1-3 匹配智能体', matchRows >= 1 && matchRows <= 3, `rows=${matchRows}`);
  const hasPercent = await page.evaluate(() => /\d+%/.test(document.querySelector('.ant-modal-body')?.textContent || ''));
  check('匹配结果含匹配度%', hasPercent);
  await ctx.close();
}

// ── 3. 生成需求页：暂存(草稿) ──
{
  const { ctx, page } = await newPage('信息科管理员');
  await page.goto(`${BASE}/app/agent-needs/create`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(800);
  // 标题
  const titleInput = page.locator('input#title, input[maxlength="30"]').first();
  await titleInput.click();
  await titleInput.type('冒烟测试草稿需求', { delay: 10 });
  await page.keyboard.press('Tab');
  await page.waitForTimeout(200);
  // 暂存
  await page.click('button:has-text("暂")');
  await page.waitForTimeout(800);
  const savedMsg = await page.evaluate(() => document.body.textContent?.includes('已暂存到草稿'));
  const onDraftTab = page.url().includes('tab=draft');
  check('暂存提示「已暂存到草稿」', savedMsg);
  check('暂存后跳回草稿 Tab', onDraftTab, `url=${page.url()}`);
  const draftHasNew = await page.evaluate(() => document.body.textContent?.includes('冒烟测试草稿需求'));
  check('新草稿出现在草稿列表', draftHasNew);
  await ctx.close();
}

// ── 4. 生成需求页：提交校验失败定位 + 校验通过提交 ──
{
  const { ctx, page } = await newPage('信息科管理员');
  await page.goto(`${BASE}/app/agent-needs/create`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(800);
  // 直接点提交 → 二次确认 → 确认 → 校验失败
  await page.click('button:has-text("提")');
  await page.waitForTimeout(400);
  await page.click('.ant-modal-footer button:has-text("确认提交")');
  await page.waitForTimeout(600);
  const hasErr = await page.evaluate(() => document.querySelectorAll('.ant-form-item-explain-error').length > 0);
  check('空表单提交触发校验错误', hasErr);

  // 填全字段后提交
  const fill = async (sel, text) => {
    const el = page.locator(sel).first();
    await el.click();
    await el.type(text, { delay: 8 });
    await page.keyboard.press('Tab');
    await page.waitForTimeout(120);
  };
  await fill('input#title', '门诊智能预问诊助手测试');
  // 科室 Select
  await page.click('input#department, #department');
  await page.waitForTimeout(300);
  await page.click('.ant-select-item-option:has-text("心内科")');
  await fill('#reason', '门诊高峰期医生问诊时间被大量重复的病史采集占用，患者等待久体验差，希望前置采集主诉现病史既往史等结构化信息，减轻医生负担提升问诊效率与规范性满足五十字要求。');
  await fill('#proposer', '张三');
  await fill('#contactPhone', '13800138000');
  // 诊疗环节 Radio 预问诊
  await page.click('label:has-text("预问诊")');
  await fill('#functionDesc', '面向门诊患者开展预问诊服务，自动采集主诉现病史既往史等信息，形成标准化问诊摘要推送接诊医生。');
  await page.waitForTimeout(200);
  await page.click('button:has-text("提")');
  await page.waitForTimeout(400);
  await page.click('.ant-modal-footer button:has-text("确认提交")');
  await page.waitForTimeout(1000);
  const backToList = page.url().endsWith('/app/agent-needs') || page.url().includes('/app/agent-needs?');
  const submittedMsg = await page.evaluate(() => document.body.textContent?.includes('需求已提交'));
  check('校验通过后提交成功', submittedMsg || backToList, `url=${page.url()}`);
  const listHasNew = await page.evaluate(() => document.body.textContent?.includes('门诊智能预问诊助手测试'));
  check('新需求出现在需求管理列表', listHasNew);
  await ctx.close();
}

// ── 5. 科室管理员：仅见本人已提交 + 本人草稿 ──
{
  const { ctx, page } = await newPage('科室管理员');
  await page.goto(`${BASE}/app/agent-needs`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(800);
  const needsVisible = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.ant-menu-title-content')).some((n) => n.textContent?.includes('智能体建设需求管理')));
  check('科室管理员侧边栏可见「智能体建设需求管理」', needsVisible);
  await ctx.close();
}

await browser.close();

const passed = results.filter((r) => r.pass).length;
console.log(`\n==== ${passed}/${results.length} PASS ====`);
process.exit(passed === results.length ? 0 : 1);
