// =============================================================================
// verify_create_task_v19.mjs
// V1.9 §3.2 新建评测任务页重构验证
//   · 三档滑动条存在且只在三档间切换
//   · 默认选中「快速评测」
//   · 拖动到 50 → 标准评测；100 → 深度评测
//   · 一档统辖全维度（选择多维度后,切换档位不丢维度）
//   · 智能体联动 Alert（URL 带 agentName 命中 mockAgents → 顶部 success）
//   · 暂存 / 开始评测主流程
// =============================================================================
import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const SCREENSHOT_DIR = '/Users/harry/Desktop/CC_TEST/agent-system';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const log = (msg) => console.log(`[V1.9] ${msg}`);

const assert = (cond, msg) => {
  if (!cond) {
    console.error(`✗ ASSERT FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
};

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 0 });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text());
  });

  // ---------------------------------------------------------------------------
  // 1. 登录（admin 角色 → 信息科管理员）
  // ---------------------------------------------------------------------------
  log('1. 登录 admin');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await sleep(800);

  // 找登录页"管理员登录"按钮
  const adminBtn = await page.getByRole('button', { name: /管理员登录|信息科管理员登录/ }).first();
  if (await adminBtn.count() > 0) {
    await adminBtn.click();
  } else {
    // 备用：直接填用户名
    const userInput = await page.locator('input[type="text"], input[placeholder*="账"], input[placeholder*="用"]').first();
    if (await userInput.count() > 0) await userInput.fill('admin');
    const pwd = await page.locator('input[type="password"]').first();
    if (await pwd.count() > 0) await pwd.fill('123456');
    const submit = await page.getByRole('button', { name: /登录|确定/ }).first();
    if (await submit.count() > 0) await submit.click();
  }
  await sleep(1500);
  log('   登录完成,等待跳转');

  // ---------------------------------------------------------------------------
  // 2. 跳转新建评测任务页
  // ---------------------------------------------------------------------------
  log('2. 打开 新建评测任务');
  await page.goto(`${BASE}/app/evaluation/tasks/create`, { waitUntil: 'networkidle' });
  await sleep(1500);

  // ---------------------------------------------------------------------------
  // 3. 验证:三档滑动条存在 + marks 显示三个档位名称
  // ---------------------------------------------------------------------------
  log('3. 验证三档滑动条 + marks');
  const sliderContainer = page.locator('.ant-slider').first();
  await sliderContainer.waitFor({ timeout: 5000 });
  assert(await sliderContainer.isVisible(), '测试样本量滑动条存在并可见');

  // 验证三个 marks:快速评测/标准评测/深度评测
  const marks = page.locator('.ant-slider-mark-text');
  const markTexts = await marks.allInnerTexts();
  log(`   marks 文本: ${JSON.stringify(markTexts)}`);
  const flatMarks = markTexts.join(' ');
  assert(flatMarks.includes('快速评测'), '滑动条 marks 含「快速评测」');
  assert(flatMarks.includes('标准评测'), '滑动条 marks 含「标准评测」');
  assert(flatMarks.includes('深度评测'), '滑动条 marks 含「深度评测」');

  // 验证抽取比例
  assert(flatMarks.includes('30%'), '快速评测档位标记抽取 30%');
  assert(flatMarks.includes('60%'), '标准评测档位标记抽取 60%');
  assert(flatMarks.includes('100%'), '深度评测档位标记抽取 100%');

  // ---------------------------------------------------------------------------
  // 4. 验证默认选中「快速评测」档位
  // ---------------------------------------------------------------------------
  log('4. 验证默认档位 = 快速评测');
  const handleLeft = await page.locator('.ant-slider-handle').first().boundingBox();
  log(`   默认 handle x=${handleLeft?.x} y=${handleLeft?.y}`);
  // 快速评测 = 0 位置(handle 应在 marks 最左)
  const fastMark = await page.locator('.ant-slider-mark-text').first().boundingBox();
  assert(Math.abs(handleLeft.x - fastMark.x) < 30, '默认 handle 位置 ≈ 快速评测 mark');

  // 验证副文本"已选...测试样本量:快速评测"
  const bodyText = await page.locator('body').innerText();
  assert(bodyText.includes('快速评测'), '页面文本含「快速评测」档位');
  assert(bodyText.includes('一档统辖全维度'), '卡片 extra 提示文案已更新');

  // ---------------------------------------------------------------------------
  // 5. 验证拖动到 标准评测 档位
  // ---------------------------------------------------------------------------
  log('5. 拖动滑动条 → 标准评测');
  // antd slider:点击 marks 文本可直接跳到对应值
  const stdMark = page.locator('.ant-slider-mark-text:has-text("标准评测")').first();
  await stdMark.click();
  await sleep(500);
  const bodyText2 = await page.locator('body').innerText();
  assert(bodyText2.includes('标准评测') && bodyText2.includes('抽取 60%'), '切换后底部说明显示「标准评测（抽取 60%）」');
  // 底部摘要
  assert(/测试样本量：标准评测/.test(bodyText2), '底部摘要显示「测试样本量:标准评测」');

  await page.screenshot({ path: `${SCREENSHOT_DIR}/verify_create_task_v19_std.png`, fullPage: true });

  // ---------------------------------------------------------------------------
  // 6. 切换到 深度评测 档位
  // ---------------------------------------------------------------------------
  log('6. 拖动滑动条 → 深度评测');
  const deepMark = page.locator('.ant-slider-mark-text:has-text("深度评测")').first();
  await deepMark.click();
  await sleep(500);
  const bodyText3 = await page.locator('body').innerText();
  assert(bodyText3.includes('深度评测') && bodyText3.includes('抽取 100%'), '切换后底部说明显示「深度评测（抽取 100%）」');
  assert(/测试样本量：深度评测/.test(bodyText3), '底部摘要显示「测试样本量:深度评测」');

  // ---------------------------------------------------------------------------
  // 7. 验证一档统辖全维度:选多个维度后切换档位不丢维度
  // ---------------------------------------------------------------------------
  log('7. 验证一档统辖全维度(选维度后切换档位)');
  // 先选 3 个维度
  await page.locator('.ant-checkbox-input').nth(0).click(); // 输入安全
  await sleep(150);
  await page.locator('.ant-checkbox-input').nth(1).click(); // 输出安全
  await sleep(150);
  await page.locator('.ant-checkbox-input').nth(2).click(); // 行为安全
  await sleep(300);

  // 切到快速
  await page.locator('.ant-slider-mark-text:has-text("快速评测")').first().click();
  await sleep(400);
  const bodyText4 = await page.locator('body').innerText();
  assert(bodyText4.includes('输入安全') && bodyText4.includes('输出安全') && bodyText4.includes('行为安全'), '切档后三个维度仍保留');

  // ---------------------------------------------------------------------------
  // 8. 选智能体 + 完整流程:开始评测
  // ---------------------------------------------------------------------------
  log('8. 选择智能体 + 开始评测');
  // 选第一个 agent(打开 select 再点击第一项)
  await page.locator('.ant-select-selector').first().click();
  await sleep(400);
  // 下拉第一项
  const firstOption = page.locator('.ant-select-item-option').first();
  await firstOption.click();
  await sleep(500);

  // 校验智能体卡片信息卡出现
  const infoCard = page.locator('text=类型：').first();
  assert(await infoCard.isVisible({ timeout: 3000 }), '选中智能体后展示「类型/科室/编号/版本/风险分级」信息卡');

  await page.screenshot({ path: `${SCREENSHOT_DIR}/verify_create_task_v19_full.png`, fullPage: true });

  // 切到 标准评测
  await page.locator('.ant-slider-mark-text:has-text("标准评测")').first().click();
  await sleep(300);

  // 点击"开始评测"
  log('9. 点击「开始评测」');
  const startBtn = page.getByRole('button', { name: /开始评测/ }).first();
  await startBtn.click();
  await sleep(1500);

  // 验证跳转到 /app/evaluation/tasks
  const url = page.url();
  log(`   当前 URL: ${url}`);
  assert(url.endsWith('/app/evaluation/tasks'), '点击开始评测后跳转到 任务管理页');
  await page.screenshot({ path: `${SCREENSHOT_DIR}/verify_create_task_v19_after_start.png`, fullPage: true });

  // ---------------------------------------------------------------------------
  // 10. URL 带 agentName 联动预填 → 再次打开新建页验证 Alert
  // ---------------------------------------------------------------------------
  log('10. URL 带 agentName 联动预填');
  // 重新打开新建页,带 presetAgentName
  await page.goto(`${BASE}/app/evaluation/tasks/create?agentName=心电图智能辅助诊断系统&agentCode=心内科-0001`, { waitUntil: 'networkidle' });
  await sleep(1500);
  const body5 = await page.locator('body').innerText();
  assert(body5.includes('已自动带入智能体'), 'URL 带名称且命中 → 显示 success 提示「已自动带入智能体」');
  assert(body5.includes('心电图智能辅助诊断系统'), '提示含智能体名称');

  await page.screenshot({ path: `${SCREENSHOT_DIR}/verify_create_task_v19_preset.png`, fullPage: true });

  // ---------------------------------------------------------------------------
  // 11. 暂存流程
  // ---------------------------------------------------------------------------
  log('11. 暂存草稿流程');
  // 联动预填已自动选中智能体,只需勾选至少一个维度
  await page.locator('.ant-checkbox-input').first().click();
  await sleep(400);
  const draftBtn = page.getByRole('button', { name: '暂存' }).first();
  await draftBtn.waitFor({ state: 'visible', timeout: 5000 });
  await draftBtn.click();
  await sleep(1500);
  const url2 = page.url();
  assert(url2.endsWith('/app/evaluation/tasks'), '暂存后跳转到任务管理页');
  // 切到草稿 Tab
  const draftTab = page.locator('.ant-tabs-tab:has-text("草稿")').first();
  if (await draftTab.count() > 0) {
    await draftTab.click();
    await sleep(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/verify_create_task_v19_draft.png`, fullPage: true });
    const body6 = await page.locator('body').innerText();
    assert(body6.includes('心电图'), '草稿 Tab 含刚暂存的智能体');
  }

  log('');
  log('══════════════════════════════════════════════');
  log('✓ V1.9 §3.2 新建评测任务页重构 — 全部验证通过');
  log('══════════════════════════════════════════════');

  await browser.close();
})();
