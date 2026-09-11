// Verify Demo 3.2-3.4 in 接入中心 (smart fill / review / connectivity test / insight)
//
// 步骤:
//   1. 启动 chromium, 注入 localStorage 作为「信息科管理员」
//   2. 打开智能体接入中心主页（验证 GlobalInsightBar 显示）
//   3. 进入「新建注册」页, 截图智能审查面板
//   4. 截「技术信息」区连通测试
//   5. 截详情页 AutoInsightPanel
//   6. 截管理员审核页预审标注 + 通过后引导（先进入待审核 tab 点审一条）
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.env.SMART_BASE || 'http://localhost:3001';
const OUT = '/tmp/smart_demo_v32';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

// 注入信息科管理员角色
await ctx.addInitScript(() => {
  const user = {
    id: 'u1',
    name: '陈志远',
    department: '信息科',
    roles: ['信息科管理员'],
    isPlatformAdmin: true,
  };
  localStorage.setItem('hospital_user_v1', JSON.stringify(user));
});

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') {
    const t = m.text();
    if (t.includes('`bodyStyle` is deprecated')) return;
    if (t.includes('`bordered` is deprecated')) return;
    errors.push(`[console.error] ${t}`);
  }
});

let exitCode = 0;
const log = (...a) => console.log('▶', ...a);
const pass = (m) => console.log('✓ PASS:', m);
const fail = (m) => { console.error('✗ FAIL:', m); exitCode = 1; };
const assert = (c, m) => (c ? pass(m) : fail(m));

try {
  log('Step 1: 打开智能体接入中心主页');
  await page.goto(`${BASE}/app/agent-center`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/01-insight-bubble.png`, fullPage: false });
  // §3.4.1.1 / §4.1.1 态势由机器人旁气泡承担（含可点击 chips + 一键直达）
  const bubble = page.locator('.agent-welcome-bubble');
  assert((await bubble.count()) > 0, 'AgentAssistant 旁 page-level 态势气泡已渲染（含 chips + actions）');

  log('Step 2: 切到「待审核」Tab 看审核首页');
  // 直接读 URL ?tab= 待审核
  await page.goto(`${BASE}/app/agent-center?tab=待审核`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/02-pending-list.png`, fullPage: false });

  log('Step 3: 进入新建注册页（智能填入演示）');
  await page.goto(`${BASE}/app/agent-center/smart-register`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500); // 等 runReview 1.2s 自动触发 + 渲染
  await page.screenshot({ path: `${OUT}/03-register-review.png`, fullPage: false });
  // §3.2.1 实时定位问题已收回到 Agent 聊天气泡（pre-audit-summary / pre-audit-issue），
  //   不再渲染独立「智能审查 · 实时定位问题」面板
  assert(
    (await page.locator('[data-testid="review-panel"]').count()) === 0,
    '独立 ReviewPanel 卡片已下线（PRD §3.2.1 不在新建注册页新增独立面板/状态条卡片）',
  );
  // 唤起对话窗口, 验证审查结果已落入聊天气泡
  const robotEntry = page.locator('[aria-label="唤起智能填写助手（医小管）"]');
  if (await robotEntry.count() > 0) {
    await robotEntry.click();
    await page.waitForTimeout(600);
    const summary = page.locator('[data-testid="pre-audit-summary-msg"]').first();
    assert(await summary.isVisible(), 'Agent 对话窗口已展示 pre-audit-summary 实时审查汇总气泡');
    await page.screenshot({ path: `${OUT}/03b-register-review-bubble.png`, fullPage: false });
  } else {
    fail('未找到医小管悬浮入口');
  }

  log('Step 4: 输入 apiKey 包含 "504-FAIL"，准备触发连通失败演示');
  // 滚到技术信息区，先保证 accessMode = API（默认）
  await page.evaluate(() => {
    const el = document.querySelector('[name="apiEndpoint"]');
    if (el) {
      const ev = new Event('input', { bubbles: true });
      el.value = 'http://10.10.10.20:8080/chat';
      el.dispatchEvent(ev);
    }
  });
  // 直接通过 form helper 设置值
  const apiKeyInput = page.locator('input[type="password"]').nth(0);
  if (await apiKeyInput.count() > 0) {
    await apiKeyInput.fill('ak-504-FAIL-1234');
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/04-tech-section.png`, fullPage: false });

  // 点击测试验证
  const testBtn = page.locator('button:has-text("测试验证")').first();
  if (await testBtn.count() > 0) {
    await testBtn.click();
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: `${OUT}/05-connectivity-running.png`, fullPage: false });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/06-connectivity-diagnostics.png`, fullPage: false });

  log('Step 5: 返回详情页（找一条「审核通过」记录）验证 AutoInsightPanel');
  await page.goto(`${BASE}/app/agent-center?tab=审核通过`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/07-passed-list.png`, fullPage: false });
  // 取第一条「查看详情」链接点开
  const detailBtn = page.locator('a:has-text("查看详情"), button:has-text("查看详情")').first();
  if (await detailBtn.count() > 0) {
    await detailBtn.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/08-detail-insight.png`, fullPage: false });
  }

  log('Step 6: 管理员审核页（预审 + 通过后引导）');
  await page.goto(`${BASE}/app/agent-center?tab=待审核`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const auditBtn = page.locator('button:has-text("审核"), a:has-text("审核")').first();
  if (await auditBtn.count() > 0) {
    await auditBtn.click();
    await page.waitForTimeout(2500); // 等预审 + 连通测试完成
    await page.screenshot({ path: `${OUT}/09-audit-preaudit.png`, fullPage: false });
    assert(
      await page.locator('[data-testid="pre-audit-card"]').first().isVisible(),
      '预审标注卡已渲染',
    );
    // 选「审核通过」+ 确认
    const passOpt = page.locator('label:has-text("审核通过")').first();
    if (await passOpt.count() > 0) {
      await passOpt.click();
      await page.waitForTimeout(400);
    }
    const confirm = page.locator('button:has-text("确认审核通过")').first();
    if (await confirm.count() > 0) {
      await confirm.click();
      await page.waitForTimeout(800);
      // 二次确认
      const modalOk = page.locator('.ant-modal').locator('button:has-text("确认通过")').last();
      if (await modalOk.count() > 0) await modalOk.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/10-audit-pass-guide.png`, fullPage: false });
      assert(
        await page.locator('[data-testid="audit-pass-guide"]').first().isVisible(),
        '审核通过后引导气泡已渲染',
      );
    }
  }

  if (errors.length > 0) {
    console.error('--- errors ---');
    errors.forEach((e) => console.error(e));
    exitCode = 1;
  } else {
    pass('无 console.error / pageerror');
  }
} catch (e) {
  console.error('执行异常：', e);
  await page.screenshot({ path: `${OUT}/EXCEPTION.png` });
  exitCode = 1;
} finally {
  await browser.close();
  process.exit(exitCode);
}
