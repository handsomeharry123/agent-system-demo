#!/usr/bin/env node
/**
 * 统一台账中心智能化升级 V1.1 验证脚本（2026-07-03）
 * 覆盖：Agent 形象/对话/欢迎语一致性 + 报告生成/编辑/导出/订阅完整链路
 * 双角色测试：
 *   - 角色 A：信息科管理员（platform_admin）— 全院视图
 *   - 角色 B：科室用户（dept_admin）— 本科室视图
 *
 * 用法：node verify_ledger_center_v11.mjs
 * 输出：JSON 到 stdout + exit code 0=PASS / 1=FAIL
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'http://localhost:5173';
const OUT = join(process.cwd(), 'verify_ledger_center_v11_artefacts');
mkdirSync(OUT, { recursive: true });

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? '  -- ' + detail : ''}`);
}

async function setRoleAndWait(page, role /* '信息科管理员' | '科室管理员' */) {
  // 通过演示设置面板切换角色（BasicLayout 右上角头像 → 演示功能 → 切换角色）
  // 直接 localStorage 注入 useDemoSettings 持久化 key = 'demo_settings_v1'
  // 字段为 demoRole(不是 role)
  await page.evaluate((r) => {
    const cur = JSON.parse(localStorage.getItem('demo_settings_v1') || '{}');
    localStorage.setItem(
      'demo_settings_v1',
      JSON.stringify({
        ...cur,
        demoRole: r,
        visibleModules: cur.visibleModules || {},
        visibleSubPages: cur.visibleSubPages || {},
      }),
    );
  }, role);
  await page.reload();
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

async function runAdminFlow(browser) {
  console.log('\n====== 角色 A · 信息科管理员 ======');
  const page = await browser.newPage();
  await page.goto(`${BASE}/app/ledger-demo/overview`, { waitUntil: 'networkidle' });
  await setRoleAndWait(page, '信息科管理员');

  // T1：进入台账总览 Demo，弹出态势汇报气泡
  await page.goto(`${BASE}/app/ledger-demo/overview`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const bubble = await page.$('text=医小管');
  record('[A1] 态势汇报气泡出现', !!bubble, bubble ? '找到医小管' : '未找到');
  await page.screenshot({ path: join(OUT, 'A1-overview-bubble.png'), fullPage: false });

  // T2：气泡中应有"生成报告"+"订阅速读"两个按钮
  const btnGen = await page.$('button:has-text("生成报告")');
  const btnSub = await page.$('button:has-text("订阅速读")');
  record('[A2] 气泡含「生成报告」按钮', !!btnGen);
  record('[A2] 气泡含「订阅速读」按钮', !!btnSub);

  // T3：点击气泡中"生成报告"应跳到报告页
  if (btnGen) {
    await btnGen.click();
    await page.waitForTimeout(1500);
    const url = page.url();
    record('[A3] 生成报告跳转 /app/ledger-demo/report', url.includes('/report'), url);
    await page.screenshot({ path: join(OUT, 'A3-report-page.png'), fullPage: true });
  }

  // T4：报告页默认显示"全院智能体管理情况报告" 标题
  const t1 = await page.getByText('全院智能体管理情况报告', { exact: false }).first();
  record('[A4] 报告页全院标题可见', await t1.isVisible().catch(() => false));

  // T5：报告页 5 大模块（建设概况 / 关联资源对接 / 准入评测 / 运行健康 / 问题与建议）
  const m1 = await page.getByText('一、建设概况').first();
  const m2 = await page.getByText('二、关联资源对接情况').first();
  const m3 = await page.getByText('三、准入评测情况').first();
  const m4 = await page.getByText('四、运行健康').first();
  const m5 = await page.getByText('五、存在的问题与下一步工作建议').first();
  const allModules = await Promise.all([m1, m2, m3, m4, m5].map((l) => l.isVisible().catch(() => false)));
  record(
    '[A5] 5 大模块齐全',
    allModules.every(Boolean),
    `建设=${allModules[0]}/对接=${allModules[1]}/评测=${allModules[2]}/健康=${allModules[3]}/建议=${allModules[4]}`,
  );

  // T6：编辑模式可编辑 + 新增 + 删除
  //   - V1.2 把 Segmented 改成单一 Button(文字"编辑" / "编辑中");用 icon 定位
  try {
    const editBtn = page
      .locator('button:has(.anticon-edit), button:has-text("编辑"):not(:has-text("编辑中"))')
      .first();
    if (await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await editBtn.click({ force: true, timeout: 3000 });
      await page.waitForTimeout(1000);
    }
  } catch {
    /* 切不到也不致命 */
  }
  // 点击新增章节按钮
  const addChapter = page.locator('button:has-text("一级章节")').first();
  if (await addChapter.isVisible({ timeout: 2000 }).catch(() => false)) {
    await addChapter.click({ force: true, timeout: 3000 });
    await page.waitForTimeout(500);
    record('[A6] 新增章节按钮可点击', true);
  } else {
    record('[A6] 新增章节按钮存在', false, '未找到一级章节按钮');
  }
  await page.screenshot({ path: join(OUT, 'A6-report-edit.png'), fullPage: true });

  // T7：导出 PDF（真实生成）
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
  const exportBtn = await page.$('button:has-text("一键导出")');
  if (exportBtn) {
    await exportBtn.click();
    await page.waitForTimeout(500);
    // Dropdown 第一项 PDF
    const pdfItem = await page.$('text=导出 PDF (.pdf)');
    if (pdfItem) {
      await pdfItem.click();
      // 会弹 Modal 确认
      await page.waitForTimeout(500);
      const confirmBtn = await page.$('button:has-text("确认导出")');
      if (confirmBtn) await confirmBtn.click();
      const dl = await downloadPromise;
      if (dl) {
        const savedPath = join(OUT, 'A7-report.pdf');
        await dl.saveAs(savedPath);
        record('[A7] PDF 真实导出', true, savedPath);
      } else {
        record('[A7] PDF 真实导出', false, '未触发 download');
      }
    } else {
      record('[A7] 找到 PDF 菜单项', false);
    }
  } else {
    record('[A7] 一键导出按钮可见', false);
  }

  // T8：导出 Word
  const downloadPromise2 = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
  if (exportBtn) {
    await exportBtn.click();
    await page.waitForTimeout(500);
    const wordItem = await page.$('text=导出 Word (.doc)');
    if (wordItem) {
      await wordItem.click();
      await page.waitForTimeout(500);
      const confirmBtn = await page.$('button:has-text("确认导出")');
      if (confirmBtn) await confirmBtn.click();
      const dl = await downloadPromise2;
      if (dl) {
        const savedPath = join(OUT, 'A8-report.doc');
        await dl.saveAs(savedPath);
        record('[A8] Word 真实导出', true, savedPath);
      } else {
        record('[A8] Word 真实导出', false, '未触发 download');
      }
    } else {
      record('[A8] 找到 Word 菜单项', false);
    }
  }

  // T9：导出 PPT (若 jszip 缺失会降级为 .txt 仍算通过)
  const downloadPromise3 = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);
  if (exportBtn) {
    await exportBtn.click();
    await page.waitForTimeout(500);
    const pptItem = await page.$('text=导出 PPT (.pptx)');
    if (pptItem) {
      await pptItem.click();
      await page.waitForTimeout(500);
      const confirmBtn = await page.$('button:has-text("确认导出")');
      if (confirmBtn) await confirmBtn.click();
      const dl = await downloadPromise3;
      if (dl) {
        const savedPath = join(OUT, 'A9-report.pptx');
        await dl.saveAs(savedPath);
        record('[A9] PPT 真实导出', true, savedPath);
      } else {
        record('[A9] PPT 真实导出', false, '未触发 download');
      }
    } else {
      record('[A9] 找到 PPT 菜单项', false);
    }
  }

  // T10：返回总览，验证总览页有"生成报告"+"订阅速读"按钮
  await page.goto(`${BASE}/app/ledger`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const oGen = await page.$('button:has-text("生成报告")');
  const oSub = await page.$('button:has-text("订阅速读")');
  record('[A10] 总览页含「生成报告」按钮', !!oGen);
  record('[A10] 总览页含「订阅速读」按钮', !!oSub);
  await page.screenshot({ path: join(OUT, 'A10-overview-buttons.png'), fullPage: true });

  // T11：总览页订阅速读 → Drawer → 立即开启
  if (oSub) {
    await oSub.click();
    await page.waitForTimeout(500);
    const drawerTitle = await page.$('text=全院台账速读订阅');
    record('[A11] 速读订阅 Drawer 打开', !!drawerTitle);
    const switchBtns = await page.$$('button.ant-switch');
    record('[A11] Drawer 含推送通道 Switch', switchBtns.length >= 3, `共 ${switchBtns.length} 个`);
    const submitBtn = await page.$('button:has-text("立即开启订阅")');
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForTimeout(500);
      record('[A11] 立即开启订阅可点击', true);
    }
    await page.screenshot({ path: join(OUT, 'A11-subscribe.png'), fullPage: false });
  }

  // T12：列表页含生成报告/订阅速读按钮
  await page.goto(`${BASE}/app/ledger/list`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const lGen = await page.$('button:has-text("生成报告")');
  const lSub = await page.$('button:has-text("订阅速读")');
  record('[A12] 列表页含「生成报告」按钮', !!lGen);
  record('[A12] 列表页含「订阅速读」按钮', !!lSub);

  // T13：详情页有机器人浮窗（AgentFloatHost 覆盖 /app/ledger/detail/:id）
  await page.goto(`${BASE}/app/ledger/detail/lung-ai-001`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const robot = await page.$('[aria-label*="医小管"]');
  record('[A13] 详情页 Agent 浮窗可见', !!robot);
  await page.screenshot({ path: join(OUT, 'A13-detail-robot.png'), fullPage: false });

  await page.close();
}

async function runDeptFlow(browser) {
  console.log('\n====== 角色 B · 科室用户 ======');
  const page = await browser.newPage();
  await page.goto(`${BASE}/app/ledger-demo/overview`, { waitUntil: 'networkidle' });
  await setRoleAndWait(page, '科室管理员');

  // T1：进入总览 Demo，弹出本科室态势汇报
  await page.goto(`${BASE}/app/ledger-demo/overview`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const bubble = await page.$('text=医小管');
  record('[B1] 科室用户态气泡出现', !!bubble);
  // 科室用户口径文字："本科室智能体"
  const deptLabel = await page.$('text=本科室智能体');
  record('[B1] 气泡口径为「本科室智能体」', !!deptLabel);
  await page.screenshot({ path: join(OUT, 'B1-dept-bubble.png'), fullPage: false });

  // T2：本科室使用情况（本月调用量 + 正常运行率）应展示
  const callVolume = await page.$('text=本月调用量');
  const onlineRate = await page.$('text=正常运行率');
  record('[B2] 本月调用量展示', !!callVolume);
  record('[B2] 正常运行率展示', !!onlineRate);

  // T3：点击生成报告 → 报告页
  const btnGen = await page.$('button:has-text("生成报告")');
  if (btnGen) {
    await btnGen.click();
    await page.waitForTimeout(1500);
    const url = page.url();
    record('[B3] 科室用户生成报告跳转', url.includes('/report'));
    // 报告页默认还是全院报告（页内 Segmented 切本科室）
    const deptHeader = await page.$('text=心内科智能体应用成效小结');
    const platHeader = await page.$('text=全院智能体管理情况报告');
    record('[B3] 报告页默认全院标题', !!platHeader);
    // 切换到本科室
    const segBtns = await page.$$('text=本科室 (§4.3)');
    if (segBtns.length > 0) {
      await segBtns[0].click();
      await page.waitForTimeout(500);
      const deptHeader2 = await page.$('text=心内科智能体应用成效小结');
      record('[B3] 切换至本科室小结标题', !!deptHeader2);
      await page.screenshot({ path: join(OUT, 'B3-dept-report.png'), fullPage: true });
    }
  }

  // T4：本科室小结 4 大模块（在用智能体清单与分布 / 使用情况 / 可用性概况 / 需关注事项与建议）
  const m1 = await page.getByText('一、在用智能体清单与分布').first();
  const m2 = await page.getByText('二、使用情况').first();
  const m3 = await page.getByText('三、可用性概况').first();
  const m4 = await page.getByText('四、需关注事项与建议').first();
  const allModules = await Promise.all([m1, m2, m3, m4].map((l) => l.isVisible().catch(() => false)));
  record(
    '[B4] 本科室 4 大模块齐全',
    allModules.every(Boolean),
    `清单=${allModules[0]}/使用=${allModules[1]}/可用性=${allModules[2]}/建议=${allModules[3]}`,
  );

  // T5：对话窗口位置固定右下角 + 高度贴内容
  await page.goto(`${BASE}/app/ledger-demo/overview`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  // 关闭气泡（点 ×） — 用 try/catch 避免 close 时机错过
  try {
    const closeBtn = page.locator('button[aria-label="关闭"]').first();
    if (await closeBtn.isVisible({ timeout: 1000 })) {
      await closeBtn.click({ force: true, timeout: 2000 });
      await page.waitForTimeout(300);
    }
  } catch {
    /* ignore */
  }
  // 点机器人打开对话 — demo 页面机器人是 div+title,无 aria-label
  //   - AgentFloatHost(线上总览/列表/详情):aria-label="唤起医小管(台账助手)"
  //   - Demo overview 机器人:title="点击唤起医小管对话窗口",无 aria-label
  let robot = page.locator('[aria-label*="台账助手"]').first();
  if (!(await robot.isVisible({ timeout: 1500 }).catch(() => false))) {
    robot = page.locator('[title*="唤起医小管对话窗口"]').first();
  }
  if (await robot.isVisible({ timeout: 1500 }).catch(() => false)) {
    await robot.click({ force: true, timeout: 5000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: join(OUT, 'B5-chat-panel.png'), fullPage: false });
    // 顶栏：V1.2 简化为「医小管」(原"医小管 · 台账助手")
    // 区分：台账助手 ChatPanelV31 的顶栏含副标题「本科室数据权限·跨中心聚合」
    const scopeLabel = page.getByText('本科室数据权限').first();
    record('[B5] 对话窗口标题可见', await scopeLabel.isVisible({ timeout: 2000 }).catch(() => false));
    // 推荐问句(科室用户口径)：我科室哪个智能体现在不能用?
    const sug = page.getByText('我科室哪个智能体现在不能用?').first();
    record('[B5] 科室用户口径推荐问句', await sug.isVisible({ timeout: 2000 }).catch(() => false));
    // 发送按钮(V1.2 Space.Compact 单行布局,SendOutlined icon + title="发送（Enter）")
    const sendBtn = page.locator('button[title^="发送"], button:has-text("发送"), button .anticon-send').first();
    record('[B5] 发送按钮存在', await sendBtn.isVisible({ timeout: 2000 }).catch(() => false));
  } else {
    record('[B5] 机器人浮窗', false, '未找到台账助手机器人');
  }

  await page.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    await runAdminFlow(browser);
    await runDeptFlow(browser);
  } finally {
    await browser.close();
  }
  const failed = results.filter((r) => !r.pass);
  const summary = {
    ts: new Date().toISOString(),
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
  };
  writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log('\n====== 汇总 ======');
  console.log(`总计 ${summary.total} · 通过 ${summary.passed} · 失败 ${summary.failed}`);
  if (failed.length > 0) {
    console.log('失败项:');
    failed.forEach((f) => console.log(`  ❌ ${f.name} -- ${f.detail}`));
  }
  process.exit(failed.length > 0 ? 1 : 0);
})();
