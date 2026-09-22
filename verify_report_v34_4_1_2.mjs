#!/usr/bin/env node
/**
 * 报告详情页 4.1.2 两项需求验证
 *  1. 报告正文全文都支持编辑(标题 / KPI / 图表标题 / 表格 / 矩阵 等)
 *  2. 报告内容区域左右 20% 间距, 缩减报告宽度
 */
import { chromium } from 'playwright';
import { promises as fs } from 'fs';
import path from 'path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';
const ART = 'verify_report_v34_4_1_2_artefacts';

const cases = [];
function record(name, pass, detail = '') {
  cases.push({ name, pass, detail });
  console.log(`${pass ? '✅ PASS' : '❌ FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  await fs.mkdir(ART, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // 清草稿 + 注入信息科管理员
  await page.goto(`${BASE}/app/ledger-demo`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
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
  await page.goto(`${BASE}/app/ledger-demo/report`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${ART}/01_initial.png`, fullPage: false });

  // ===== 需求 2:宽度 - 左右 20% 间距 =====
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
      leftPad: contentRect && innerRect ? (innerRect.left - contentRect.left) : 0,
      rightPad: contentRect && innerRect ? (contentRect.right - innerRect.right) : 0,
    };
  });
  console.log('widthInfo:', widthInfo);
  const leftPct = widthInfo.leftPad / widthInfo.contentWidth;
  const rightPct = widthInfo.rightPad / widthInfo.contentWidth;
  record(
    '需求 2: 左右各预留 20% 间距 (相对 .ant-layout-content)',
    leftPct >= 0.18 && rightPct >= 0.18 && Math.abs(leftPct - rightPct) < 0.05,
    `left=${(leftPct * 100).toFixed(1)}% right=${(rightPct * 100).toFixed(1)}%`,
  );
  record(
    '需求 2: 报告宽度大幅收窄 (card < 70% content)',
    widthInfo.cardWidth < widthInfo.contentWidth * 0.7,
    `card=${widthInfo.cardWidth.toFixed(0)} content=${widthInfo.contentWidth.toFixed(0)}`,
  );

  // ===== 需求 1:进入编辑模式后,各类节点都应可编辑 =====
  const editBtn = page.locator('button:has-text("编辑")').first();
  await editBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${ART}/02_edit_mode_top.png`, fullPage: false });

  // 全屏截图以便看 KPI / 表格 / 矩阵的编辑状态
  await page.screenshot({ path: `${ART}/02_edit_mode_full.png`, fullPage: true });

  // 输入框总量:覆盖段落(28+) + h2(5) + h3(20+) + KPI 单元 (5+5+5+1 = 16) + chart title (8+) + table title (3+) + table cells (5+6+3 = 14) + matrix (1+5+6+30+1 = 43+) + cover(6) + toc(6) + colophon(2)
  // 用 [data-r34-report] 内所有 input+textarea 统计
  const inputCount = await page.evaluate(() => {
    const root = document.querySelector('[data-r34-report]');
    if (!root) return { inputs: 0, textareas: 0 };
    return {
      inputs: root.querySelectorAll('input').length,
      textareas: root.querySelectorAll('textarea').length,
    };
  });
  console.log('inputCount:', inputCount);
  record(
    '需求 1: 编辑模式启用大量 Input (>=80, 覆盖 KPI/表格/矩阵/标题等)',
    inputCount.inputs >= 80,
    `inputs=${inputCount.inputs} textareas=${inputCount.textareas}`,
  );
  record(
    '需求 1: 编辑模式启用 TextArea (>=28, 段落)',
    inputCount.textareas >= 28,
    `textareas=${inputCount.textareas}`,
  );

  // 验证 KPI 可编辑
  const kpiInput = page.locator('[data-r34-report] input').nth(0); // 第一个 KPI 的 label
  const kpiInputCount = await page.locator('[data-r34-report] input').count();
  record('需求 1: KPI / chart / table 节点渲染为 Input', kpiInputCount > 30, `count=${kpiInputCount}`);

  // 改 KPI:找到 42 这个值的 input
  // KPI 值 input 第二个 (label, value, unit 一组);直接定位 value=42
  const kpiValueInput = page.locator('[data-r34-report] input[value="42"]').first();
  const kpiValCount = await kpiValueInput.count();
  record('需求 1: 找到 KPI 数值 input (value=42)', kpiValCount > 0, `count=${kpiValCount}`);
  if (kpiValCount > 0) {
    await kpiValueInput.click();
    await kpiValueInput.fill('99');
    await kpiValueInput.evaluate((el) => el.blur());
    await page.waitForTimeout(1500);
    // 在编辑模式校验:实际渲染的 input 是否更新到 99
    const newKpiVal = await page.locator('[data-r34-report] input[value="99"]').count();
    record('需求 1: KPI 数值 42→99 修改后页面 (编辑模式) 渲染 99', newKpiVal > 0, `count=${newKpiVal}`);
  }

  // 改 h2:第一个 h2 input
  const h2Input = page.locator('[data-r34-report] input').first(); // 第一个 input
  // 通过 value 找: "一、全院智能体总体建设情况"
  const h2ValInput = page.locator('[data-r34-report] input[value="一、全院智能体总体建设情况"]').first();
  if ((await h2ValInput.count()) > 0) {
    await h2ValInput.click();
    await h2ValInput.fill('一、全院智能体总体建设情况(已编辑)');
    await h2ValInput.evaluate((el) => el.blur());
    await page.waitForTimeout(1500);
  }
  const draftAfterH2 = await page.evaluate(() => {
    return Object.entries(localStorage)
      .filter(([k]) => k.startsWith('ledger_demo_report_v34_draft'))
      .map(([k, v]) => ({ k, hasH2Edit: v.includes('(已编辑)') }));
  });
  record('需求 1: 改 h2 标题后 localStorage 草稿已落盘',
    draftAfterH2.length > 0 && draftAfterH2.some((d) => d.hasH2Edit),
    JSON.stringify(draftAfterH2));

  // 改 table 表头:用 nth 而非 [value=...] 锁定第 113 号 input
  const thInput = page.locator('[data-r34-report] input').nth(113);
  const thCount = await thInput.count();
  record('需求 1: 找到 表 4-1 表头 input (监控维度)', thCount > 0, `count=${thCount}`);
  if (thCount > 0) {
    await thInput.click();
    await thInput.fill('维度(已编辑)');
    await thInput.evaluate((el) => el.blur());
    await page.waitForTimeout(1500);
  }
  // 改矩阵:行名 — idx=57 对应矩阵的"影像报告解读助手"行
  const matrixRowInput = page.locator('[data-r34-report] input').nth(57);
  const matrixRowCount = await matrixRowInput.count();
  record('需求 1: 找到 矩阵行名 input', matrixRowCount > 0, `count=${matrixRowCount}`);
  if (matrixRowCount > 0) {
    const origVal = await matrixRowInput.inputValue();
    record('需求 1: 矩阵行名原值是"影像报告解读助手"或其他智能体名', /助手|智能体/.test(origVal), `value=${origVal}`);
    await matrixRowInput.click();
    await matrixRowInput.fill('影像报告解读助手(改)');
    await matrixRowInput.evaluate((el) => el.blur());
    await page.waitForTimeout(1500);
  }
  const draftAfterMatrix = await page.evaluate(() => {
    return Object.entries(localStorage)
      .filter(([k]) => k.startsWith('ledger_demo_report_v34_draft'))
      .map(([k, v]) => ({
        k,
        hasH2: v.includes('(已编辑)'),
        hasKpi: v.includes('"value":"99"'),
        hasMatrix: v.includes('(改)'),
        hasTh: v.includes('维度(已编辑)'),
      }));
  });
  console.log('draftAfterMatrix:', JSON.stringify(draftAfterMatrix, null, 2));
  record('需求 1: 改矩阵行名后 localStorage 落盘',
    draftAfterMatrix.length > 0 && draftAfterMatrix.some((d) => d.hasMatrix));
  record('需求 1: 改 KPI 数值后 localStorage 落盘',
    draftAfterMatrix.length > 0 && draftAfterMatrix.some((d) => d.hasKpi));
  record('需求 1: 改表头后 localStorage 落盘',
    draftAfterMatrix.length > 0 && draftAfterMatrix.some((d) => d.hasTh));

  // 退出编辑,确认显示新文字
  await page.locator('button:has-text("完成")').first().click();
  await page.waitForTimeout(500);
  const afterExit = (await page.locator('body').textContent()) || '';
  record('完成编辑后 KPI 新值 99 仍渲染', /99/.test(afterExit));
  record('完成编辑后 h2 新标题仍渲染', /一、全院智能体总体建设情况\(已编辑\)/.test(afterExit));
  record('完成编辑后 表头新文字仍渲染', /维度\(已编辑\)/.test(afterExit));
  record('完成编辑后 矩阵新行名仍渲染', /影像报告解读助手\(改\)/.test(afterExit));
  await page.screenshot({ path: `${ART}/03_after_edit.png`, fullPage: false });

  // ===== 验证 PDF/Word 导出仍可用 =====
  const exportBtn = page.locator('button:has-text("导出")').first();
  await exportBtn.click();
  await page.waitForTimeout(300);
  const pdfItem = page.locator('li:has-text("导出 PDF")').first();
  record('导出下拉含 PDF 项', (await pdfItem.count()) > 0);
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
  await pdfItem.click();
  const dl = await downloadPromise;
  if (dl) {
    const fname = dl.suggestedFilename();
    record('PDF 导出文件名后缀 .pdf', /\.pdf$/i.test(fname), fname);
    const target = path.join(ART, fname);
    await dl.saveAs(target);
    const stat = await fs.stat(target);
    record('PDF 文件 size > 50KB', stat.size > 50 * 1024, `size=${stat.size}`);
  } else {
    record('PDF 导出触发', false, 'no event');
  }

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
