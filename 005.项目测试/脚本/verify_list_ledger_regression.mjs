// =============================================================================
// V2.7 回归验证：接入中心 → 台账列表 autoOpenEffect
//   1) 访问 /app/ledger/list?search=心电图智能辅助诊断&openDetail=1
//   2) 验证 autoOpenEffect 命中并跳转 detail 页
// =============================================================================
import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const TARGET_URL = `${BASE}/app/ledger/list?search=${encodeURIComponent('心电图智能辅助诊断')}&openDetail=1`;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

console.log(`[1/3] Navigating to ${TARGET_URL}`);
await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });

console.log(`[2/3] Waiting for navigation to detail page...`);
await page.waitForURL(/\/app\/ledger\/detail\//, { timeout: 10000 });

const finalUrl = page.url();
console.log(`[3/3] Final URL: ${finalUrl}`);
if (/\/app\/ledger\/detail\/.+/.test(finalUrl) && finalUrl.includes('XN-0001') === false) {
  // openDetail 已清掉,search 保留;命中即跳转
  console.log(`✅ PASS: 命中并跳转到 detail 页`);
} else if (/\/app\/ledger\/detail\//.test(finalUrl)) {
  console.log(`✅ PASS: 命中并跳转到 detail 页`);
} else {
  console.log(`❌ FAIL: 未跳转到 detail 页,Final URL: ${finalUrl}`);
  process.exitCode = 1;
}

if (errors.length > 0) {
  console.log(`⚠️ Console errors:`);
  errors.forEach((e) => console.log(`   - ${e}`));
}

await browser.close();
console.log(process.exitCode ? `\n❌ FAILED` : `\n✅ PASSED`);