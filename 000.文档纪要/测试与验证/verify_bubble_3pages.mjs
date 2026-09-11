import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

// 关键：每个新会话都从干净状态开始(不 dismiss 过)
const checks = [
  { url: 'http://localhost:5173/app/ledger', label: '总览' },
  { url: 'http://localhost:5173/app/ledger/list', label: '列表' },
  { url: 'http://localhost:5173/app/ledger/detail/lung-ai-001', label: '详情' },
];

for (const c of checks) {
  // 清空 sessionStorage 模拟新用户
  await page.goto('http://localhost:5173/');
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(c.url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const hasBubble = await page.evaluate(() => {
    const fixedDivs = document.querySelectorAll('div[style*="position: fixed"]');
    for (const d of fixedDivs) {
      if (d.textContent && d.textContent.includes('医小管 · 台账速览') && d.offsetWidth > 200) {
        return true;
      }
    }
    return false;
  });
  console.log(`[${c.label}] 气泡: ${hasBubble ? '✅ 显示' : '❌ 未显示'}`);
  await page.screenshot({ path: `/tmp/bubble_${c.label}.png`, fullPage: false });
}
await browser.close();
