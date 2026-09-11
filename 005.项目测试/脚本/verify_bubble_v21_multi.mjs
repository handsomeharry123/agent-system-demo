// verify_bubble_v21_multi.mjs — 多 Tab / 多角色下气泡尺寸回归
import { chromium } from 'playwright';
import fs from 'node:fs';

const cases = [
  { name: 'pending', tab: '待审核', desc: '短文案 + miniList 折叠' },
  { name: 'return', tab: '退回修改', desc: '短文案 + miniList 折叠' },
  { name: 'all', tab: '全部', desc: '管理员视角 4 chip + 1 action' },
  { name: 'draft', tab: '草稿', desc: '短文案 + miniList 折叠' },
];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (err) => console.log('  [pageerror]', err.message));

  for (const c of cases) {
    console.log(`\n--- ${c.name} (${c.tab}) ---`);
    await page.goto(`http://localhost:3001/app/agent-center?tab=${encodeURIComponent(c.tab)}&_t=${Date.now()}`, { waitUntil: 'networkidle' });
    try {
      await page.waitForSelector('[data-testid="status-bubble"]', { timeout: 5000 });
      await page.waitForTimeout(800);
      const box = await page.$eval('[data-testid="status-bubble"]', (el) => {
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height, x: r.x, y: r.y };
      });
      console.log(`  bubble box: ${JSON.stringify(box)}`);
      const crop = { x: Math.max(0, box.x - 30), y: Math.max(0, box.y - 30), width: Math.min(1440 - box.x + 30, box.w + 60), height: Math.min(900 - box.y + 30, box.h + 60) };
      fs.writeFileSync(`/Users/harry/Desktop/CC_TEST/agent-system/verify_bubble_v21_${c.name}.png`, await page.screenshot({ clip: crop }));
      console.log(`  ✓ saved verify_bubble_v21_${c.name}.png`);
    } catch (e) {
      console.log(`  ! bubble 未出现: ${e.message}`);
    }
  }
  await browser.close();
})();