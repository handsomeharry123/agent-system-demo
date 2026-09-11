// 验证 360 画像-关联资源拓扑地图 V2.9：去标签 + 加大节点距离
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ARTEFACT_DIR = 'verify_ledger_360_topo_artefacts';
const URL_BASE = 'http://localhost:3001';

const fail = (msg) => { console.error('❌ FAIL:', msg); process.exit(1); };
const ok = (msg) => console.log('✅', msg);
const info = (msg) => console.log('  ·', msg);

const setup = async () => {
  fs.mkdirSync(ARTEFACT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.error('CONSOLE ERROR:', m.text());
  });
  return { browser, page };
};

const screenshot = async (page, name) => {
  await page.screenshot({ path: path.join(ARTEFACT_DIR, name), fullPage: false });
  info(`screenshot → ${ARTEFACT_DIR}/${name}`);
};

const step = async (label, fn) => {
  console.log(`\n--- ${label} ---`);
  await fn();
};

const run = async () => {
  const { browser, page } = await setup();

  try {
    await step('访问 /app/ledger/detail/AGT-2024-001 → 360 画像视图', async () => {
      await page.goto(`${URL_BASE}/app/ledger/detail/AGT-2024-001`, { waitUntil: 'networkidle' });
      // 等 360 视图 SVG 渲染完成
      await page.waitForSelector('svg .topo-pulse-ring', { timeout: 15000 });
      await page.waitForTimeout(1500); // 让节点弹入动画完成
      ok('360 画像拓扑地图加载完成');
      await screenshot(page, '01_360_topo.png');
    });

    await step('校验：顶部不再有「业务域 / 系统 / 接口/数据 / 已连接 / 异常」Tag', async () => {
      // V2.9: 5 个 Tag 已删除
      const topoPanel = page.locator('svg').first();
      const tagCount = await topoPanel.locator('xpath=ancestor::div[1]').locator('.ant-tag').count();
      // 直接检查 PageHeader 区(前 30 像素)的 Tag
      const headerTags = await page.locator('text=/业务域 \\d+|系统 \\d+|接口\\/数据 \\d+|已连接 \\d+|异常 \\d+/').count();
      info(`残留 5 类 Tag: ${headerTags}`);
      if (headerTags > 0) fail('仍残留「业务域/系统/接口/数据/已连接/异常」Tag');
      ok('顶部 Tag 已移除');
    });

    await step('校验：节点数量与无遮挡(目测)', async () => {
      // 截图后人工/自动看，主要看 node count
      // 节点卡片通过 foreignObject 渲染，包含 topo-node-pop 动画
      const nodeCards = await page.locator('foreignObject').count();
      info(`拓扑节点数: ${nodeCards}`);
      if (nodeCards < 5) fail(`节点数过少: ${nodeCards}`);
      ok(`渲染了 ${nodeCards} 个节点`);
    });
  } finally {
    await browser.close();
  }
};

run().catch((e) => fail(e.stack || e.message));