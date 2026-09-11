import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const URL = 'http://localhost:3001/app/ledger/detail/AGT-2024-001';
const OUT = '/Users/harry/Desktop/CC_TEST/agent-system/verify_360_monitor_flex_artefacts';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
// 等 360 视图出现
await page.waitForSelector('text=基本信息', { timeout: 30000 });
await page.waitForTimeout(800);

// 截全屏一张 + 仅监控 Panel 一张（按文字定位）
await page.screenshot({ path: `${OUT}/fullscreen.png`, fullPage: false });

// 定位「运行监控」 title 所在的 section
const monitorBox = await page.evaluate(() => {
  const headers = Array.from(document.querySelectorAll('span'));
  const span = headers.find((n) => n.textContent && n.textContent.trim() === '运行监控');
  if (!span) return null;
  let el = span;
  while (el && el.parentElement && !el.parentElement.className?.toString().includes('ant-flex')) el = el.parentElement;
  const section = span.closest('section') || el.closest('section');
  return section ? section.getBoundingClientRect().toJSON() : null;
});

if (monitorBox) {
  await page.screenshot({ path: `${OUT}/monitor_section.png`, clip: monitorBox });
}

// 截下方趋势图区
const trendBox = await page.evaluate(() => {
  const spans = Array.from(document.querySelectorAll('span'));
  const title = spans.find((s) => s.textContent && s.textContent.trim() === '告警次数趋势');
  if (!title) return null;
  const section = title.closest('section');
  const svg1 = section?.querySelector('svg');
  const svg2 = section?.querySelectorAll('svg')?.[1];
  const rect = (el) => el ? el.getBoundingClientRect().toJSON() : null;
  return { first: rect(svg1), second: rect(svg2), section: rect(section) };
});
console.log('monitor header box:', JSON.stringify(monitorBox));
console.log('trend boxes:', JSON.stringify(trendBox));
console.log('logs:', logs.slice(-15).join('\n'));

writeFileSync(`${OUT}/diag.json`, JSON.stringify({ monitorBox, trendBox, logs: logs.slice(-20) }, null, 2));
await browser.close();
