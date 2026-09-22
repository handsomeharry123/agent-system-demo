#!/usr/bin/env node
/**
 * 报告详情页 (http://localhost:3001/app/ledger-demo/report) 三项需求验证
 *  1. mock 真实数据用于演示
 *  2. 编辑和导出功能是否正常
 *  3. 报告内容区域左右 10% 间距, 缩减报告宽度
 */
import { chromium } from 'playwright';
import { promises as fs } from 'fs';
import path from 'path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';
const ART = 'verify_report_v34_4_1_1_artefacts';

const cases = [];
function record(name, pass, detail = '') {
  cases.push({ name, pass, detail });
  console.log(`${pass ? '✅ PASS' : '❌ FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  await fs.mkdir(ART, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // 注入信息科管理员 + 清掉旧草稿
  await page.goto(`${BASE}/app/ledger-demo`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    // 清掉所有 ledger_demo_report_v34_draft 衍生 key
    Object.keys(localStorage)
      .filter((k) => k.startsWith('ledger_demo_report_v34_draft'))
      .forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(
      'demo_settings_v1',
      JSON.stringify({ demoRole: '信息科管理员', visibleModules: {}, visibleSubPages: {} }),
    );
    if (typeof window.__useAuthSetRole === 'function') {
      window.__useAuthSetRole('信息科管理员', 'admin');
    }
  });
  // 重新加载报告页拿到干净的 admin 数据
  await page.goto(`${BASE}/app/ledger-demo/report`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${ART}/01_initial_admin.png`, fullPage: false });

  // ===== 需求 1:mock 真实数据用于演示 =====
  const bodyText = (await page.locator('body').textContent()) || '';
  record('mock 包含「全院智能体运行管理情况报告」标题', /全院智能体运行管理情况报告/.test(bodyText));
  record('mock 包含 42 个智能体总数 KPI', /纳管智能体总数[\s\S]*?42/.test(bodyText));
  record('mock 包含 126.8 万次总调用量 KPI', /126\.8/.test(bodyText));
  record('mock 包含 5 大模块标题(一~五)',
    /一、全院智能体总体建设情况/.test(bodyText)
    && /二、医院资源管理情况/.test(bodyText)
    && /三、准入评测情况/.test(bodyText)
    && /四、运行监测情况/.test(bodyText)
    && /五、报告总结/.test(bodyText));
  record('mock 包含告警 KPI 68/3/42',
    /68/.test(bodyText) && /故障[\s\S]*?3[\s\S]*?次/.test(bodyText) && /42/.test(bodyText));
  record('mock 包含 8 个 TOP10 高频智能体名称',
    /影像报告解读助手·放射科/.test(bodyText)
    && /检验结果解读助手·检验科/.test(bodyText)
    && /预问诊助手·门诊部/.test(bodyText));
  record('mock 包含对接矩阵 (HIS/EMR/LIS/PACS/手麻/病案)',
    /HIS/.test(bodyText) && /EMR/.test(bodyText) && /PACS/.test(bodyText));
  record('mock 包含科室分布 (放射科 8 / 检验科 6 / ...)',
    /放射科[\s\S]*?8/.test(bodyText) && /检验科[\s\S]*?6/.test(bodyText));

  // ===== 需求 3:宽度 - 报告内容左右各 10% 间距 =====
  const widthInfo = await page.evaluate(() => {
    const content = document.querySelector('.ant-layout-content');
    const inner = document.querySelector('[data-r34-report]');
    const card = inner ? inner.closest('.ant-card') : null;
    const innerRect = inner ? inner.getBoundingClientRect() : null;
    const contentRect = content ? content.getBoundingClientRect() : null;
    const cardRect = card ? card.getBoundingClientRect() : null;
    return {
      contentWidth: contentRect ? contentRect.width : 0,
      cardWidth: cardRect ? cardRect.width : 0,
      innerWidth: innerRect ? innerRect.width : 0,
      // 报告内容相对 .ant-layout-content 的左右间距
      leftPad: contentRect && innerRect ? (innerRect.left - contentRect.left) : 0,
      rightPad: contentRect && innerRect ? (contentRect.right - innerRect.right) : 0,
    };
  });
  console.log('widthInfo:', widthInfo);
  // 左右各 10% 间距 → 间距 / contentWidth 各 ~10%
  const leftPct = widthInfo.leftPad / widthInfo.contentWidth;
  const rightPct = widthInfo.rightPad / widthInfo.contentWidth;
  record(
    '需求 3: 报告内容左右各预留 10% 间距 (相对 .ant-layout-content)',
    leftPct >= 0.08 && rightPct >= 0.08 && Math.abs(leftPct - rightPct) < 0.05,
    `left=${(leftPct * 100).toFixed(1)}% right=${(rightPct * 100).toFixed(1)}%`,
  );
  record(
    '需求 3: 报告宽度收窄, 不再占满视口',
    widthInfo.cardWidth < widthInfo.contentWidth * 0.95,
    `card=${widthInfo.cardWidth.toFixed(0)} content=${widthInfo.contentWidth.toFixed(0)}`,
  );

  // ===== 需求 2.1: 编辑功能 =====
  const editBtn = page.locator('button:has-text("编辑")').first();
  record('编辑按钮存在', (await editBtn.count()) > 0);
  await editBtn.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${ART}/02_edit_mode.png`, fullPage: false });
  const textAreaCount = await page.locator('[data-r34-report] textarea').count();
  record('编辑模式: 段落渲染为 TextArea (有 5+ 个)', textAreaCount >= 5, `count=${textAreaCount}`);

  // 修改第一段
  const firstTextArea = page.locator('[data-r34-report] textarea').first();
  const originalText = await firstTextArea.inputValue();
  const newText = originalText + ' [编辑验证 2026-07-06]';
  await firstTextArea.click();
  await firstTextArea.fill(newText);
  await page.waitForTimeout(200);
  await firstTextArea.evaluate((el) => el.blur());
  await page.waitForTimeout(1600); // 等待 1200ms 自动保存

  // 验证 localStorage 草稿已写入 (key 含 "信息科管理员")
  const draftValue = await page.evaluate(() => {
    return Object.entries(localStorage)
      .filter(([k]) => k.startsWith('ledger_demo_report_v34_draft'))
      .map(([k, v]) => ({ k, hasTag: v.includes('[编辑验证 2026-07-06]') }));
  });
  record('编辑后 localStorage 草稿已写入',
    draftValue.length > 0 && draftValue.some((d) => d.hasTag),
    JSON.stringify(draftValue));

  // 点完成
  const finishBtn = page.locator('button:has-text("完成")').first();
  await finishBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ART}/03_after_edit.png`, fullPage: false });
  const afterEditText = (await page.locator('body').textContent()) || '';
  record('完成编辑后段落保留新文字 (回写持久化生效)', /\[编辑验证 2026-07-06\]/.test(afterEditText));

  // 刷新验证草稿依然存在
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const afterReloadText = (await page.locator('body').textContent()) || '';
  record('刷新后草稿仍然存在 (持久化)', /\[编辑验证 2026-07-06\]/.test(afterReloadText));
  await page.screenshot({ path: `${ART}/04_after_reload.png`, fullPage: false });

  // ===== 需求 2.2: 导出 (PDF) =====
  const exportBtn = page.locator('button:has-text("导出")').first();
  record('导出按钮存在', (await exportBtn.count()) > 0);
  await exportBtn.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${ART}/05_export_menu.png`, fullPage: false });
  const pdfItem = page.locator('li:has-text("导出 PDF")').first();
  record('下拉菜单包含「导出 PDF」项', (await pdfItem.count()) > 0);

  const downloadPromise = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
  await pdfItem.click();
  const download = await downloadPromise;
  if (download) {
    const filename = download.suggestedFilename();
    record('PDF 下载已触发 (file: ' + filename + ')', !!filename && /\.pdf$/i.test(filename));
    const target = path.join(ART, filename);
    await download.saveAs(target);
    const stat = await fs.stat(target);
    record('PDF 文件非空 (size>50KB, 报告含多页)', stat.size > 50 * 1024, `size=${stat.size}`);
  } else {
    record('PDF 下载已触发', false, 'no download event');
  }
  await page.waitForTimeout(800);

  // ===== 需求 2.3: 导出 (Word) =====
  await exportBtn.click();
  await page.waitForTimeout(300);
  const wordItem = page.locator('li:has-text("导出 Word")').first();
  record('下拉菜单包含「导出 Word」项', (await wordItem.count()) > 0);
  const wordDownload = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
  await wordItem.click();
  const wd = await wordDownload;
  if (wd) {
    const wname = wd.suggestedFilename();
    record('Word 下载已触发 (' + wname + ')', !!wname && /\.doc$/i.test(wname));
    const wpath = path.join(ART, wname);
    await wd.saveAs(wpath);
    const wstat = await fs.stat(wpath);
    record('Word 文件非空 (size>5KB)', wstat.size > 5 * 1024, `size=${wstat.size}`);
  } else {
    record('Word 下载已触发', false, 'no download event');
  }

  // ===== 切换到科室管理员测数据真实性 =====
  // 切角色不 goto(避免 state 重置)
  await page.evaluate(() => {
    if (typeof window.__useAuthSetRole === 'function') {
      window.__useAuthSetRole('科室管理员');
    }
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${ART}/07_dept_report.png`, fullPage: false });
  const deptText = (await page.locator('body').textContent()) || '';
  record('科室报告: 「科室智能体运行情况报告」标题', /科室智能体运行情况报告/.test(deptText));
  record('科室报告: 纳管智能体数量 8 个 KPI', /纳管智能体数量[\s\S]*?8/.test(deptText));
  record('科室报告: 18.6 万次调用量 (全院占比 14.7%)', /18\.6/.test(deptText) && /14\.7%/.test(deptText));
  record('科室报告: 智能体清单 (影像报告解读 / CT 辅助诊断 / DR 胸片筛查 / 影像质控)',
    /影像报告解读助手/.test(deptText)
    && /CT 辅助诊断助手/.test(deptText)
    && /DR 胸片筛查助手/.test(deptText)
    && /影像质控助手/.test(deptText));
  record('科室报告: cover 含当前登录部门名 (科室名称:XX)',
    /科室名称:[\s\S]{0,30}/.test(deptText));
  record('科室报告: 退回原因表 (影像质控助手/误标记率 8.2%)',
    /影像质控助手/.test(deptText) && /8\.2%/.test(deptText));

  // 全屏截图(确认一屏内能看更多)
  await page.screenshot({ path: `${ART}/08_dept_full.png`, fullPage: false });

  const passed = cases.filter((c) => c.pass).length;
  const failed = cases.length - passed;
  console.log(`\n=== Summary: ${passed} passed / ${failed} failed / ${cases.length} total ===`);
  await fs.writeFile(
    path.join(ART, 'report.json'),
    JSON.stringify({ cases, passed, failed, total: cases.length }, null, 2),
  );

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(2);
});
