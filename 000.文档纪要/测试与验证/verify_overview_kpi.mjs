/**
 * 截 Overview 当前样式，与用户图2 对比
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE = 'http://localhost:3001';
const SHOTS = '/tmp/overview-kpi-shots';
mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1200 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));

  // 1. Overview 当前样式
  await page.goto(BASE + '/app/monitoring', { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);
  await page.screenshot({ path: join(SHOTS, '1-overview-current.png'), fullPage: false });

  // 2. 仅截 4 张 KPI 卡所在行
  await page.evaluate(() => {
    const titles = Array.from(document.querySelectorAll('.ant-card-head-title'));
    const t = titles.find((el) => el.textContent.includes('累计告警总数'));
    if (t) t.closest('.ant-card').scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await sleep(1000);
  await page.screenshot({ path: join(SHOTS, '2-overview-kpi-row.png'), clip: { x: 230, y: 100, width: 1660, height: 300 } });

  // 3. 测量 KPI 卡实际尺寸
  const measure = await page.evaluate(() => {
    const titles = Array.from(document.querySelectorAll('.ant-card-head-title'));
    const out = {};
    ['累计告警总数', '当日告警总数', '未处理告警数', '已处理告警数'].forEach((label) => {
      const title = titles.find((el) => el.textContent.includes(label));
      if (!title) return;
      const card = title.closest('.ant-card');
      const body = card.querySelector('.ant-card-body');
      out[label] = {
        cardW: card.getBoundingClientRect().width,
        cardH: card.getBoundingClientRect().height,
        bodyW: body ? body.getBoundingClientRect().width : 0,
        bodyH: body ? body.getBoundingClientRect().height : 0,
        bg: getComputedStyle(card).backgroundColor,
        padding: body ? getComputedStyle(body).padding : '',
      };
    });
    return out;
  });
  console.log('=== Overview KPI 卡尺寸度量 ===');
  console.log(JSON.stringify(measure, null, 2));

  await browser.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
