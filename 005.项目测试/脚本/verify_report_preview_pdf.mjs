import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:3001';
const out = { steps: [], errors: [], artifacts: {} };
const log = (m) => { console.log(`[STEP] ${m}`); out.steps.push(m); };

const downloadDir = path.join(process.cwd(), '.verify-downloads');
if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });
for (const f of fs.readdirSync(downloadDir)) fs.unlinkSync(path.join(downloadDir, f));

try {
  log('launch chromium');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') {
      const txt = m.text();
      // 过滤已知的 Vite HMR / favicon 噪声
      if (!/favicon|HMR/.test(txt)) out.errors.push(`[console] ${txt}`);
    }
  });
  page.on('pageerror', (e) => out.errors.push(`[pageerror] ${e.message}`));

  // ===========================================================================
  // Case 1: task-001 = 审核通过（有 report）→ 两个按钮应可点
  // ===========================================================================
  log('=== Case 1: task-001 (审核通过, 有 report) ===');
  await page.goto(`${BASE}/app/evaluation/tasks/task-001/report?fromTab=all`, {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(800);

  await page.screenshot({ path: 'verify_report_preview_top.png', fullPage: false });

  // 1.1 验证两个按钮都存在且可点击
  const previewBtn = page.getByRole('button', { name: '评测结果报告查看' });
  const downloadBtn = page.getByRole('button', { name: '评测结果报告下载' });
  if (!(await previewBtn.isVisible())) out.errors.push('[case1] 评测结果报告查看 按钮不可见');
  if (!(await downloadBtn.isVisible())) out.errors.push('[case1] 评测结果报告下载 按钮不可见');
  const previewDisabled = await previewBtn.isDisabled();
  const downloadDisabled = await downloadBtn.isDisabled();
  out.case1 = { previewDisabled, downloadDisabled };
  if (previewDisabled) out.errors.push('[case1] 查看按钮 disabled（预期可点）');
  if (downloadDisabled) out.errors.push('[case1] 下载按钮 disabled（预期可点）');

  // 1.2 点击「查看」→ 应弹出 Modal，HTML 报告渲染
  log('click 评测结果报告查看');
  await previewBtn.click();
  // 等待 Modal 出现 + HTML 注入完成
  await page.waitForSelector('[data-testid="report-preview-html"]', { timeout: 10000 });
  await page.waitForTimeout(500);

  // 校验 Modal 内确实有报告内容（5 个维度页 / 封面 / 总结 / 准入结论）
  const previewInfo = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="report-preview-html"]');
    if (!root) return { hasContent: false };
    return {
      hasContent: true,
      hasCover: !!root.querySelector('.cover'),
      hasDimOverview: !!root.querySelector('.dim-tag'),
      hasScore: root.textContent?.includes('92.5') ?? false,
      hasConclusion: root.textContent?.includes('准入') ?? false,
      pageCount: root.querySelectorAll('.report-page').length,
    };
  });
  out.case1.previewInfo = previewInfo;
  if (!previewInfo.hasContent) out.errors.push('[case1] 预览 HTML 容器未渲染');
  if (!previewInfo.hasCover) out.errors.push('[case1] 缺少封面');
  if (!previewInfo.hasDimOverview) out.errors.push('[case1] 缺少维度 Tag');
  if (!previewInfo.hasScore) out.errors.push('[case1] 缺少得分数字 92.5');
  if (!previewInfo.hasConclusion) out.errors.push('[case1] 缺少「准入」结论');
  if (previewInfo.pageCount < 7) out.errors.push(`[case1] 报告页数过少 (${previewInfo.pageCount})，预期 ≥ 7`);

  await page.screenshot({ path: 'verify_report_preview_modal.png', fullPage: false });
  out.artifacts.previewModal = 'verify_report_preview_modal.png';

  // 1.3 关闭 Modal
  log('close preview modal (press ESC)');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const modalGone = (await page.locator('[data-testid="report-preview-html"]').count()) === 0;
  if (!modalGone) out.errors.push('[case1] Modal 关闭后 HTML 容器应消失');

  // 1.4 点击「下载」→ 应下载一个 .pdf 文件
  log('click 评测结果报告下载');
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    downloadBtn.click(),
  ]);
  const suggested = download.suggestedFilename();
  out.case1.downloadFilename = suggested;
  if (!suggested.endsWith('.pdf')) {
    out.errors.push(`[case1] 下载文件名应以 .pdf 结尾，实际: ${suggested}`);
  }
  const saved = path.join(downloadDir, suggested);
  await download.saveAs(saved);
  const stat = fs.statSync(saved);
  out.case1.downloadBytes = stat.size;
  if (stat.size < 50_000) {
    out.errors.push(`[case1] PDF 文件过小 (${stat.size} bytes)，可能不是真实 PDF`);
  }
  // 检查 PDF magic bytes
  const head = fs.readFileSync(saved, { encoding: null }).slice(0, 5).toString('ascii');
  if (head !== '%PDF-') {
    out.errors.push(`[case1] 文件头不是 %PDF-，实际: ${head}`);
  }
  out.artifacts.downloadedPdf = saved;
  log(`downloaded ${suggested} (${(stat.size / 1024).toFixed(1)} KB), header=${head}`);

  // ===========================================================================
  // Case 2: task-010 = 草稿（无 report）→ 两个按钮应 disabled
  // ===========================================================================
  log('=== Case 2: task-010 (草稿, 无 report) ===');
  await page.goto(`${BASE}/app/evaluation/tasks/task-010/report`, {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(800);

  const previewBtn2 = page.getByRole('button', { name: '评测结果报告查看' });
  const downloadBtn2 = page.getByRole('button', { name: '评测结果报告下载' });
  const disabled2 = {
    preview: await previewBtn2.isDisabled(),
    download: await downloadBtn2.isDisabled(),
  };
  out.case2 = disabled2;
  if (!disabled2.preview) out.errors.push('[case2] 查看按钮 应 disabled（草稿无报告）');
  if (!disabled2.download) out.errors.push('[case2] 下载按钮 应 disabled（草稿无报告）');

  // hover 触发 tooltip
  await previewBtn2.hover({ force: true });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'verify_report_preview_disabled.png', fullPage: false });
  out.artifacts.disabledTooltip = 'verify_report_preview_disabled.png';

  // ===========================================================================
  // Case 3: 回归 — 报告页能正常接收 fromTab 并在返回时构造正确 URL
  // ===========================================================================
  log('=== Case 3: fromTab 透传回归（task-005 / returned） ===');
  // 拦截 navigate 验证返回 URL 是否携带 tab=returned
  await page.goto(`${BASE}/app/evaluation/tasks/task-005/report?fromTab=returned`, {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(500);

  // 拦截 window.location.href 在点击返回那一刻的值
  // 用 evaluateHandle 跟踪 history push
  const backClicked = await page.evaluate(() => {
    // 找到 Report 页的 返回 button
    const btn = document.querySelector('button.ant-btn-text');
    if (btn && /返回/.test(btn.textContent || '')) {
      btn.click();
      return true;
    }
    return false;
  });
  out.case3 = { backClicked };
  await page.waitForURL(/\/app\/evaluation\/tasks/, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
  // 抓取 navigation 后的 URL（注意 Tasks.tsx 会消费 tab 参数并清掉 query，URL 短暂是 /tasks?tab=returned）
  out.case3.urlAfterBack = page.url();
  log(`after back click, url = ${page.url()}`);

  await browser.close();
} catch (e) {
  out.errors.push(`[exception] ${e?.message || e}\n${e?.stack || ''}`);
  try {
    // best-effort 截图
    if (typeof page !== 'undefined') {
      await page.screenshot({ path: 'verify_report_preview_error.png', fullPage: false });
    }
  } catch {}
}

console.log(JSON.stringify(out, null, 2));
process.exit(out.errors.length === 0 ? 0 : 1);
