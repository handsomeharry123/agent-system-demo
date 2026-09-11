#!/usr/bin/env node
/**
 * 验证 /app/ledger-demo/report 重新生成后的页面（V3.4 精简版）
 *
 * V1.0 验收要点(2026-07-06):
 *   - 信息科管理员默认看到「全院智能体管理情况报告」(与 docx 模板 1:1)
 *   - 切换到本科室后看到「放射科智能体运行情况报告」(与 docx 模板 1:1)
 *   - PRD §3.3 报告详情页只显示【编辑】【导出】两个核心按钮(无外层 Demo Tabs)
 *   - 模板对齐标识(章节模块 / 图表 / 数据表 / KPI)数量级合理
 *   - 编辑模式可触发,段落变 TextArea,完成时自动保存草稿
 *   - 全院报告 5 大模块 + 编制说明 + 全部 KPI / 图表 / 矩阵 / 表格 / 段落
 *   - 科室报告 5 大模块 + 编制说明 + 智能体清单表 + 退回记录表
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';
const cases = [];
function record(name, pass, detail = '') {
  cases.push({ name, pass, detail });
  console.log(`${pass ? '✅ PASS' : '❌ FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

const es = (n) => `\\(${n}\\)`;

async function gotoReport(page) {
  await page.goto(`${BASE}/app/ledger-demo/report`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // ============ A. 信息科管理员(全院) ============
  await page.goto(`${BASE}/app/ledger`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.removeItem('ledger_demo_report_v34_draft::platform_admin');
    localStorage.removeItem('ledger_demo_report_v34_draft::dept_admin');
    if (typeof window.__useAuthSetRole === 'function') {
      window.__useAuthSetRole('信息科管理员', 'admin');
    }
  });
  await gotoReport(page);

  await page.screenshot({
    path: 'verify_ledger_report_v34_1_platform.png',
    fullPage: true,
  });

  // 标题与角色对齐(report cover H1,排除顶部 logo)
  const reportH1 = page.locator('.ant-card h1').first();
  const titlePlatform = await reportH1.textContent();
  record(
    '信息科管理员:报告封面 H1 显示「全院智能体运行管理情况报告」',
    /全院智能体运行管理情况报告/.test(titlePlatform || ''),
    titlePlatform,
  );

  // 5 大模块标题
  const bodyText = await page.locator('body').textContent();
  record('全院 §1 一、全院智能体总体建设情况', /一、全院智能体总体建设情况/.test(bodyText || ''));
  record('全院 §2 二、医院资源管理情况', /二、医院资源管理情况/.test(bodyText || ''));
  record('全院 §3 三、准入评测情况', /三、准入评测情况/.test(bodyText || ''));
  record('全院 §4 四、运行监测情况', /四、运行监测情况/.test(bodyText || ''));
  record('全院 §5 五、报告总结', /五、报告总结/.test(bodyText || ''));
  record('全院 附:编制说明', /附:编制说明/.test(bodyText || ''));

  // 章节模块 = 5（按 PRD 五大模块；subTitle 含 共 5 个模块）
  record(
    '全院 subTitle 含「共 5 个模块」',
    /共\s*5\s*个模块/.test(bodyText || ''),
  );

  // KPI 校验
  record('KPI:纳管智能体总数 42', /纳管智能体总数[\s\S]{0,200}42/.test(bodyText || ''));
  record('KPI:总调用量 126.8', /总调用量[\s\S]{0,200}126\.8/.test(bodyText || ''));
  record('KPI:科室覆盖率 68.4', /科室覆盖率[\s\S]{0,200}68\.4/.test(bodyText || ''));
  record('KPI:正常运行率 95.2', /正常运行率[\s\S]{0,200}95\.2/.test(bodyText || ''));
  record('KPI:使用成本 38.6', /使用成本[\s\S]{0,200}38\.6/.test(bodyText || ''));
  record('KPI:告警次数 68', /告警次数\(次\)[\s\S]{0,200}68/.test(bodyText || ''));
  record('KPI:故障次数 3', /故障次数\(次\)[\s\S]{0,200}3/.test(bodyText || ''));
  record('KPI:故障平均恢复时间 42 分钟', /故障平均恢复时间[\s\S]{0,200}42[\s\S]{0,40}分钟/.test(bodyText || ''));

  // 关键图表标题
  record('图 1-1 全院智能体月度调用量趋势', /图\s*1-1\s*全院智能体月度调用量趋势/.test(bodyText || ''));
  record('图 2-2 智能体×业务系统对接矩阵', /图\s*2-2\s*智能体\s*×\s*业务系统对接矩阵/.test(bodyText || ''));
  record('图 3-1 准入评测进度分布', /图\s*3-1\s*准入评测进度分布/.test(bodyText || ''));
  record('图 4-1 告警次数周度趋势', /图\s*4-1\s*告警次数周度趋势/.test(bodyText || ''));

  // 子章节(一)~(八)
  record('§1(八)高频调用智能体排行 TOP10', new RegExp(es('八') + '高频调用智能体排行').test(bodyText || ''));
  record('§4(三)故障原因统计', new RegExp(es('三') + '故障原因统计').test(bodyText || ''));
  record('§4(四)典型问题及处理方案', new RegExp(es('四') + '典型问题及处理方案').test(bodyText || ''));
  record('§5 25 个科室未接入', /25\s*个科室未接入/.test(bodyText || ''));
  record('§5 覆盖率达到 80%', /科室覆盖率达到\s*80%/.test(bodyText || ''));

  // ============ B. PRD §3.3 操作按钮只有 编辑 / 导出 ============
  const editBtn = page.locator('button:has-text("编辑")').first();
  record('页面右上角「编辑」按钮存在', (await editBtn.count()) > 0);
  const exportBtn = page.locator('button:has-text("导出")').first();
  record('页面右上角「导出」按钮存在', (await exportBtn.count()) > 0);

  // ============ C. PRD §3.3：报告页不应出现 4 个 Demo Tab / 外层 Demo Header ============
  record('PRD:报告页不应出现「§3.1 态势概览与分流」Tab', (await page.locator('text=§3.1 态势概览与分流').count()) === 0);
  record('PRD:报告页不应出现「§3.2.1 台账列表」Tab', (await page.locator('text=§3.2.1 台账列表').count()) === 0);
  record('PRD:报告页不应出现「§3.2.2 360 画像」Tab', (await page.locator('text=§3.2.2 360 画像').count()) === 0);
  record('PRD:报告页不应出现外层 Demo Header', (await page.locator('text=统一台账中心智能化升级 Demo').count()) === 0);
  record('PRD:报告页不应出现外层 ant-tabs', (await page.locator('.ant-tabs').count()) === 0);

  // ============ D. 编辑模式 → 段落变 TextArea → 完成 → 触发自动保存 ============
  await editBtn.click();
  await page.waitForTimeout(800);
  // 编辑模式下应出现 TextArea(段落文本字段,29 个左右)
  const textAreaCount = await page.locator('textarea').count();
  record('编辑模式 → 至少 1 个 TextArea', textAreaCount > 0, `textareas=${textAreaCount}`);
  // 修改第一段(纳管智能体总数)→ 触发 1.2s 自动保存
  await page.locator('textarea').first().fill('截至 2026 年 6 月 30 日,全院累计纳管智能体 43 个,覆盖 54 个科室,科室覆盖率 68.4%;统计周期内总调用量 126.8 万次,正常运行率 95.2%,使用成本合计 38.6 万元。全院智能体应用规模持续扩大,运行总体平稳。');
  await page.waitForTimeout(1800);
  const savedAtText = await page.locator('text=已自动保存 @').count();
  record('编辑后 1.2s 自动保存 → Tag 显示「已自动保存 @ …」', savedAtText > 0);
  // 完成编辑(按钮文字变 "完成")
  await page.locator('button.ant-btn-primary:has-text("完成")').first().click();
  await page.waitForTimeout(400);
  const editBtnCount = await page.locator('button:has-text("编辑")').count();
  record('点击「完成」 → 退出编辑模式(按钮恢复为「编辑」)', editBtnCount > 0);

  // ============ E. 切到科室管理员 → 自动加载科室模板 ============
  // 先清掉科室模板的草稿缓存,确保用 docx 对齐的初始数据
  await page.evaluate(() => {
    localStorage.removeItem('ledger_demo_report_v34_draft::dept_admin');
    if (typeof window.__useAuthSetRole === 'function') {
      window.__useAuthSetRole('科室管理员', '赵敏');
    }
  });
  await page.waitForTimeout(1500);

  await page.screenshot({
    path: 'verify_ledger_report_v34_2_dept.png',
    fullPage: true,
  });

  const titleDept = await page.locator('.ant-card h1').first().textContent();
  record(
    '本科室视角:报告封面 H1 显示「科室智能体运行情况报告」',
    /科室智能体运行情况报告/.test(titleDept || ''),
    titleDept,
  );

  const bodyDept = await page.locator('body').textContent();
  record('科室 §1 一、本科室智能体建设情况', /一、本科室智能体建设情况/.test(bodyDept || ''));
  record('科室 §2 二、对接系统情况', /二、对接系统情况/.test(bodyDept || ''));
  record('科室 §3 三、准入评测情况', /三、准入评测情况/.test(bodyDept || ''));
  record('科室 §4 四、运行监测情况', /四、运行监测情况/.test(bodyDept || ''));
  record('科室 §5 五、报告总结', /五、报告总结/.test(bodyDept || ''));
  record('科室 附:编制说明', /附:编制说明/.test(bodyDept || ''));
  record('科室 影像报告解读助手', /影像报告解读助手/.test(bodyDept || ''));
  record('科室 智能体清单表 8 行', /①[\s\S]{0,80}影像报告解读助手[\s\S]{0,3000}⑧[\s\S]{0,200}影像随访提醒助手/.test(bodyDept || ''));
  record('科室 退回记录明细表', /影像质控助手[\s\S]{0,200}输出安全[\s\S]{0,200}质控规则误判率偏高/.test(bodyDept || ''));
  record('科室 告警 14 次', /告警次数\(次\)[\s\S]{0,200}14/.test(bodyDept || ''));

  await browser.close();

  const failed = cases.filter((c) => !c.pass);
  console.log(`\n${cases.length - failed.length}/${cases.length} passed`);
  if (failed.length > 0) {
    console.log('\nFAILED cases:');
    failed.forEach((c) => console.log(`  - ${c.name}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});