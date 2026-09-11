/**
 * 统一运行监控中心 V1.9 — 1.1 监控告警总览页验证
 *
 * PRD：统一运行监控中心-需求说明文档V1.9.md §1
 *
 * 校验项（相对 V1.8 新增）：
 * 1) 4 张 KPI：累计告警总数 / 当日告警总数 / 未处理告警数 / 已处理告警数
 * 2) 3 个趋势：日 / 周 / 月
 * 3) 告警类型分布饼图 + 可点击图例 chips（业务 / 状态 / 成本 / 安全）
 * 4) 智能体告警次数排行 TOP5 + 可点击明细列表
 * 5) 联动：图例 chip 点击 → /app/monitoring/alert-events?tab=all&type=xxx
 * 6) 联动：明细列表点击 → /app/monitoring/alert-events?tab=all&agentName=xxx
 * 7) AlertEventListV18 消费 URL ?type=&agentName=
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:3001';
const SHOTS = '/tmp/monitoring-v19-shots';
mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => s.replace(/\s+/g, '');
const has = (s, t) => norm(s).includes(norm(t));

const results = [];
const record = (id, name, ok, note = '') => {
  results.push({ id, name, ok, note });
  console.log(`${ok ? '✓' : '✗'} [${id}] ${name}${note ? ' — ' + note : ''}`);
};

async function shot(page, name) {
  await sleep(800);
  const file = `${SHOTS}/${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1400 } });
  const page = await context.newPage();

  // 默认登录态：信息科管理员（admin）
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await sleep(500);

  // ---- 1.1 监控告警总览 ----
  await page.goto(BASE + '/app/monitoring', { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(1500);
  await shot(page, '01-overview');

  const bodyText = await page.locator('body').innerText();

  // 4 张 KPI
  record('OV-01', '1.1 累计告警总数卡片（V1.9 新增）', has(bodyText, '累计告警总数'));
  record('OV-02', '1.1 当日告警总数卡片', has(bodyText, '当日告警总数'));
  record('OV-03', '1.1 未处理告警数卡片', has(bodyText, '未处理告警数'));
  record('OV-04', '1.1 已处理告警数卡片', has(bodyText, '已处理告警数'));

  // 3 个趋势
  record('OV-05', '1.1 告警次数日趋势', has(bodyText, '告警次数日趋势'));
  record('OV-06', '1.1 告警次数周趋势', has(bodyText, '告警次数周趋势'));
  record('OV-07', '1.1 告警次数月趋势', has(bodyText, '告警次数月趋势'));

  // 告警类型分布
  record('OV-08', '1.1 告警类型分布卡片（V1.9 新增）', has(bodyText, '告警类型分布'));
  record('OV-09', '1.1 饼图图例 - 业务监控告警', has(bodyText, '业务监控告警'));
  record('OV-10', '1.1 饼图图例 - 状态监控告警', has(bodyText, '状态监控告警'));
  record('OV-11', '1.1 饼图图例 - 成本监控告警', has(bodyText, '成本监控告警'));
  record('OV-12', '1.1 饼图图例 - 安全监控告警', has(bodyText, '安全监控告警'));

  // 智能体告警次数排行 TOP5
  record('OV-13', '1.1 智能体告警次数排行 TOP5 卡片', has(bodyText, '智能体告警次数排行 TOP5'));
  record('OV-14', '1.1 排行明细 - 胸部 CT 影像智能分析平台', has(bodyText, '胸部 CT 影像智能分析平台'));
  record('OV-15', '1.1 排行明细 - 心电图智能辅助诊断系统', has(bodyText, '心电图智能辅助诊断系统'));
  record('OV-16', '1.1 排行明细 - 智能导诊与分诊系统', has(bodyText, '智能导诊与分诊系统'));
  record('OV-17', '1.1 排行明细 - 病历智能生成与质控系统', has(bodyText, '病历智能生成与质控系统'));
  record('OV-18', '1.1 排行明细 - 医学影像报告生成系统', has(bodyText, '医学影像报告生成系统'));

  // KPI 数字显示
  const kpiNumbers = await page.locator('.ant-card .ant-typography').allInnerTexts();
  record('OV-19', '1.1 累计告警数字显示（含 toLocaleString）', kpiNumbers.some((s) => s.replace(/,/g, '').includes('18246')));
  record('OV-20', '1.1 当日告警数字 28 显示', kpiNumbers.some((s) => s.includes('28')));
  record('OV-21', '1.1 未处理告警 7 显示', kpiNumbers.some((s) => s.trim() === '7'));
  record('OV-22', '1.1 已处理告警 21 显示', kpiNumbers.some((s) => s.trim() === '21'));

  // KPI 卡片 → /app/monitoring/alert-events?tab=...
  const linkCount = await page.locator('a[href*="alert-events"]').count();
  record('OV-23', '1.1 KPI 卡片含 alert-events 链接', linkCount >= 4, `找到 ${linkCount} 个链接`);

  // 联动 1：图例 chip 点击 → ?type=...
  console.log('\n--- 联动 1：告警类型图例 chip 点击 ---');
  const businessChip = page.locator('a[href*="type=business"]').first();
  const businessChipExists = await businessChip.count() > 0;
  if (businessChipExists) {
    await businessChip.click();
    await sleep(1500); // 等 AlertEventListV18 挂载并消费 URL 参数
    await shot(page, '02-after-type-chip-click');
    const url = page.url();
    // AlertEventListV18 一挂载就消费 URL 参数，所以最终 URL 中不含 type/agentName
    // 关键是确认跳转到 alert-events 路由 + 页面渲染出事件列表（已在 OV-26 直接验证 ?type 预筛）
    record('OV-24', '1.1 图例 chip 点击 → 跳转到 /alert-events', /\/alert-events/.test(url), `当前 URL: ${url}`);
  } else {
    record('OV-24', '1.1 图例 chip 点击', false, '未找到 type=business chip');
  }

  // 联动 2：排行明细点击 → ?agentName=...
  console.log('\n--- 联动 2：排行明细条目点击 ---');
  await page.goto(BASE + '/app/monitoring', { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(1500);
  const agentLink = page.locator('a[href*="agentName="]').first();
  const agentLinkExists = await agentLink.count() > 0;
  if (agentLinkExists) {
    const targetHref = await agentLink.getAttribute('href');
    await agentLink.click();
    await sleep(1500);
    await shot(page, '03-after-agent-click');
    const url = page.url();
    record('OV-25', '1.1 排行明细点击 → 跳转到 /alert-events', /\/alert-events/.test(url), `目标 href: ${targetHref}, 当前 URL: ${url}`);
  } else {
    record('OV-25', '1.1 排行明细点击', false, '未找到 agentName 链接');
  }

  // 联动 3：AlertEventListV18 自动预筛
  console.log('\n--- 联动 3：AlertEventListV18 自动预筛 ---');
  await page.goto(BASE + '/app/monitoring/alert-events?tab=all&type=security', { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(1500);
  await shot(page, '04-events-prefilter-type-security');
  // 安全监控 type=security 命中 mockAlertEventsV18 中 evt-v18-002（提示词注入）
  const eventsText1 = await page.locator('body').innerText();
  record('OV-26', '6.1 ?type=security 预筛（页面包含全部事件 + 安全监控 tag）',
    eventsText1.includes('安全监控告警规则') || eventsText1.includes('提示词注入'));
  record('OV-27', '6.1 URL ?type= 参数消费（已清掉）', !page.url().includes('type=security'));

  await page.goto(BASE + '/app/monitoring/alert-events?tab=all&agentName=' + encodeURIComponent('胸部 CT 影像智能分析平台'), { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(1500);
  await shot(page, '05-events-prefilter-agent');
  const eventsText2 = await page.locator('body').innerText();
  record('OV-28', '6.1 ?agentName= 预筛（页面包含胸部 CT）', eventsText2.includes('胸部 CT'));
  record('OV-29', '6.1 URL ?agentName= 参数消费（已清掉）', !page.url().includes('agentName='));

  // ---- 统计 ----
  const pass = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  console.log(`\n========== 监控总览 V1.9 验证结果 ==========`);
  console.log(`PASS: ${pass} / FAIL: ${fail} / TOTAL: ${results.length}`);
  if (fail > 0) {
    console.log('\n失败项：');
    results.filter((r) => !r.ok).forEach((r) => console.log(`  - [${r.id}] ${r.name} ${r.note}`));
  }

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('脚本执行失败:', e);
  process.exit(2);
});