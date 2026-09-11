import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto(`${BASE}/app/login?role=admin`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
// 详情页路由 —— 按截图所示 URL
await page.goto(`${BASE}/app/agent-center/detail/acc-006`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

console.log('=== URL ===', page.url());

// 1) 校验附件 row 渲染
const attachments = await page.evaluate(() => {
  const card = document.querySelector('[data-testid="detail-attachments-card"]');
  if (!card) return { found: false };
  const rows = Array.from(card.querySelectorAll('.ant-row'));
  return {
    found: true,
    rowCount: rows.length,
    rowTexts: rows.map((r) => r.innerText.replace(/\s+/g, ' ').trim()),
  };
});
console.log('=== attachments ===', JSON.stringify(attachments, null, 2));

// 2) 点「在线预览」第一个附件 → 应弹出 Modal
const previewBtn = page.locator('button:has-text("在线预览")').first();
await previewBtn.click();
await page.waitForTimeout(800);
const previewModal = await page.evaluate(() => {
  const mask = document.querySelector('.ant-modal-mask');
  const wrap = document.querySelector('.ant-modal-wrap:not([style*="display: none"])');
  const titleEl = document.querySelector('.ant-modal-title');
  const bodyEl = document.querySelector('.ant-modal-body');
  return {
    maskVisible: !!mask,
    wrapVisible: !!wrap,
    title: titleEl?.innerText?.trim() ?? null,
    bodyText: bodyEl?.innerText?.replace(/\s+/g, ' ').trim() ?? null,
  };
});
console.log('=== preview modal ===', JSON.stringify(previewModal, null, 2));
await page.screenshot({ path: '/tmp/test_attachment_preview.png', fullPage: false });

// 关闭 Modal —— Modal.info 的「知道了」按钮
const okBtn = page.locator('.ant-modal button:has-text("知道了")').first();
if (await okBtn.count()) {
  await okBtn.click();
  await page.waitForTimeout(500);
} else {
  // 兜底：ESC 关闭
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

// 3) 点「下载」第一个附件 → 应弹 message.success 提示
const downloadBtn = page.locator('button:has-text("下载")').first();
await downloadBtn.click();
await page.waitForTimeout(800);
const downloadMsg = await page.evaluate(() => {
  const msg = document.querySelector('.ant-message-notice-content');
  return msg?.innerText?.trim() ?? null;
});
console.log('=== download toast ===', JSON.stringify(downloadMsg));
await page.screenshot({ path: '/tmp/test_attachment_download.png', fullPage: false });

// 4) 校验图标：下载按钮的 svg class 应含 download（非 upload）
const downloadIconClass = await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.trim() === '下载');
  return btn?.querySelector('span.anticon')?.className ?? null;
});
console.log('=== download icon class ===', downloadIconClass);

const ok =
  attachments.found &&
  attachments.rowCount >= 1 &&
  previewModal.maskVisible &&
  previewModal.title?.startsWith('预览：') &&
  previewModal.bodyText?.includes('演示文件仅展示元信息') &&
  downloadMsg?.includes('已下载') &&
  downloadIconClass?.includes('download');

console.log('=== RESULT ===', ok ? 'PASS' : 'FAIL');

await browser.close();
process.exit(ok ? 0 : 1);