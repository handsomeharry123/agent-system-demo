import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1200 } });
const page = await ctx.newPage();

const errors = [];
const warnings = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
  if (m.type() === 'warning') warnings.push(m.text());
});

await page.goto('http://localhost:3001/app/ledger', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(5500);

// 3 个目标饼图 Card
const phaseCard = page.locator('.ant-card:has-text("智能体诊疗环节分布情况")').first();
const sourceCard = page.locator('.ant-card:has-text("智能体来源分布情况")').first();
const riskCard = page.locator('.ant-card:has-text("智能体风险分级情况")').first();

await phaseCard.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await phaseCard.screenshot({ path: '/tmp/v30_phase.png' });

await sourceCard.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await sourceCard.screenshot({ path: '/tmp/v30_source.png' });

await riskCard.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await riskCard.screenshot({ path: '/tmp/v30_risk.png' });

// 验证引导线元素存在
const lineCounts = await page.evaluate(() => {
  const cards = document.querySelectorAll('.ant-card');
  const result = {};
  cards.forEach((c) => {
    const title = c.querySelector('.ant-card-head-title')?.textContent || '';
    if (title.includes('诊疗环节') || title.includes('来源分布') || title.includes('风险分级')) {
      const lines = c.querySelectorAll('svg line');
      const texts = c.querySelectorAll('svg text');
      const svgs = c.querySelectorAll('svg');
      result[title] = {
        svgCount: svgs.length,
        lineCount: lines.length,
        textCount: texts.length,
        // 抽样检查一根 line 的属性
        sampleLine: lines[0]
          ? {
              x1: lines[0].getAttribute('x1'),
              y1: lines[0].getAttribute('y1'),
              x2: lines[0].getAttribute('x2'),
              y2: lines[0].getAttribute('y2'),
              stroke: lines[0].getAttribute('stroke'),
            }
          : null,
        // 检查 SVG 容器 overflow
        sampleSvgOverflow: svgs[0] ? getComputedStyle(svgs[0]).overflow : null,
      };
    }
  });
  return result;
});

await page.screenshot({ path: '/tmp/v30_full.png', fullPage: true });
await browser.close();

console.log('--- LINE/TEXT COUNTS ---');
console.log(JSON.stringify(lineCounts, null, 2));
console.log('--- ERRORS ---');
console.log(errors.length === 0 ? 'none' : errors.join('\n'));
console.log('--- WARNINGS ---');
console.log(warnings.length === 0 ? 'none' : warnings.join('\n'));
console.log('done');