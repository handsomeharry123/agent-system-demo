/**
 * 业务监控 KPI 卡片视觉修复验证
 * 验证目标：响应时间 / 响应超时率 / 医生采纳率 3 张卡片
 *   1. 不超出区域外框
 *   2. 趋势图左右填充满
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE = 'http://localhost:3001';
const SHOTS = '/tmp/business-kpi-fix-shots';
mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name, fullPage = false) {
  const f = join(SHOTS, `${name}.png`);
  await page.screenshot({ path: f, fullPage });
  return f;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1200 },
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('  [console.error]', msg.text());
  });

  // 1. 直接登录（admin 默认种子）
  await page.goto(BASE + '/app/monitoring/business', { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);
  await shot(page, '1-business-fullpage', true);

  // 2. 滚动到底部，截响应时间/超时率/采纳率这一行
  await page.evaluate(() => {
    // 找包含「平均响应时间」的 Card 标题
    const titles = Array.from(document.querySelectorAll('.ant-card-head-title'));
    const t = titles.find((el) => el.textContent.includes('平均响应时间'));
    if (t) t.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await sleep(1500);
  await shot(page, '2-response-row');

  // 3. 单独截「响应时间」卡片
  await page.evaluate(() => {
    const titles = Array.from(document.querySelectorAll('.ant-card-head-title'));
    const t = titles.find((el) => el.textContent.includes('平均响应时间'));
    if (t) {
      const card = t.closest('.ant-card');
      if (card) card.scrollIntoView({ behavior: 'instant', block: 'center' });
    }
  });
  await sleep(800);
  const respCard = await page.locator('.ant-card').filter({ hasText: '平均响应时间' }).first();
  await respCard.screenshot({ path: join(SHOTS, '3-response-card.png') });

  // 4. 单独截「响应超时率」卡片
  const timeoutCard = await page.locator('.ant-card').filter({ hasText: '响应超时率' }).first();
  await timeoutCard.screenshot({ path: join(SHOTS, '4-timeout-card.png') });

  // 5. 单独截「医生采纳率」卡片
  const adoptionCard = await page.locator('.ant-card').filter({ hasText: '医生采纳率' }).first();
  await adoptionCard.screenshot({ path: join(SHOTS, '5-adoption-card.png') });

  // 6. 检查卡片 SVG 内容尺寸是否充满
  const measure = await page.evaluate(() => {
    const titles = Array.from(document.querySelectorAll('.ant-card-head-title'));
    const out = {};
    ['平均响应时间', '响应超时率', '医生采纳率'].forEach((label) => {
      const title = titles.find((el) => el.textContent.includes(label));
      if (!title) return;
      const card = title.closest('.ant-card');
      if (!card) return;
      const body = card.querySelector('.ant-card-body');
      const chart = card.querySelector('div[style*="height: 180px"]');
      const svg = card.querySelector('svg');
      out[label] = {
        cardW: card.getBoundingClientRect().width,
        cardH: card.getBoundingClientRect().height,
        bodyW: body ? body.getBoundingClientRect().width : 0,
        bodyH: body ? body.getBoundingClientRect().height : 0,
        bodyScrollH: body ? body.scrollHeight : 0,
        chartBoxW: chart ? chart.getBoundingClientRect().width : 0,
        chartBoxH: chart ? chart.getBoundingClientRect().height : 0,
        svgW: svg ? svg.getBoundingClientRect().width : 0,
        svgH: svg ? svg.getBoundingClientRect().height : 0,
        bodyOverflowed: body ? body.scrollHeight > body.clientHeight : false,
      };
    });
    return out;
  });
  console.log('=== KPI 卡片尺寸度量 ===');
  console.log(JSON.stringify(measure, null, 2));

  await browser.close();
}

run().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
