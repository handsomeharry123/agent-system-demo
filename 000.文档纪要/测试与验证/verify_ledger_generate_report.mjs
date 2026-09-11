#!/usr/bin/env node
/**
 * 信息科管理员 → 台账中心 → 医小管气泡 → 「生成报告」→ 报告详情页
 *
 * 报告页内容完全对齐 docx 模板:
 *   - 5 大模块标题(全院智能体总体建设情况 / 医院资源管理情况 / 准入评测情况 / 运行监测情况 / 报告总结)
 *   - §1 含 8 个 (一)~(八) 子章节
 *   - §2 含 3 个 (一)~(三) 子章节 + 对接矩阵热力图
 *   - §3 含 3 个 (一)~(三) 子章节
 *   - §4 含 4 个 (一)~(四) 子章节,告警 KPI 68/3/42
 *   - §5 含 (一)存在的问题 + (二)下一步工作建议
 *   - 附:编制说明
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';
const cases = [];
function record(name, pass, detail = '') {
  cases.push({ name, pass, detail });
  console.log(`${pass ? '✅ PASS' : '❌ FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

// 半角括号 - regex 中需转义为 \( \)
const es = (n) => `\\(${n}\\)`;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${BASE}/app/ledger`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    // 清除报告草稿缓存,确保用最新的 docx 对齐草稿
    localStorage.removeItem('ledger_report_draft_v1::platform_admin');
    localStorage.removeItem('ledger_report_draft_v1::dept_admin');
    localStorage.setItem(
      'demo_settings_v1',
      JSON.stringify({ demoRole: '信息科管理员', visibleModules: {}, visibleSubPages: {} }),
    );
    if (typeof window.__useAuthSetRole === 'function') {
      window.__useAuthSetRole('信息科管理员', 'admin');
    }
  });

  await page.goto(`${BASE}/app/ledger`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  await page.screenshot({ path: 'verify_ledger_generate_report_1_bubble.png', fullPage: false });

  const generateBtn = page.locator('button:has-text("生成报告")').first();
  record('admin 气泡显示「生成报告」按钮', (await generateBtn.count()) > 0);

  await generateBtn.click();
  await page.waitForTimeout(1500);
  const url = page.url();
  record('点击「生成报告」跳转报告页', /\/app\/ledger-demo\/report/.test(url), url);

  await page.waitForTimeout(800);
  const bodyText = await page.locator('body').textContent();

  // ===== 5 大模块标题(对齐 docx)=====
  record('报告包含「一、全院智能体总体建设情况」', /一、全院智能体总体建设情况/.test(bodyText || ''));
  record('报告包含「二、医院资源管理情况」', /二、医院资源管理情况/.test(bodyText || ''));
  record('报告包含「三、准入评测情况」', /三、准入评测情况/.test(bodyText || ''));
  record('报告包含「四、运行监测情况」', /四、运行监测情况/.test(bodyText || ''));
  record('报告包含「五、报告总结」', /五、报告总结/.test(bodyText || ''));
  record('报告包含「附:编制说明」', /附:编制说明/.test(bodyText || ''));

  // ===== §1 全院智能体总体建设情况 - 8 个子章节 =====
  record('§1(一)总体规模与关键指标', new RegExp(es('一') + '总体规模与关键指标').test(bodyText || ''));
  record('§1(二)调用量趋势', new RegExp(es('二') + '调用量趋势').test(bodyText || ''));
  record('§1(三)纳管智能体数量趋势', new RegExp(es('三') + '纳管智能体数量趋势').test(bodyText || ''));
  record('§1(四)科室分布情况', new RegExp(es('四') + '科室分布情况').test(bodyText || ''));
  record('§1(五)诊疗环节分布情况', new RegExp(es('五') + '诊疗环节分布情况').test(bodyText || ''));
  record('§1(六)来源分布情况', new RegExp(es('六') + '来源分布情况').test(bodyText || ''));
  record('§1(七)风险分级情况', new RegExp(es('七') + '风险分级情况').test(bodyText || ''));
  record('§1(八)高频调用智能体排行 TOP10', new RegExp(es('八') + '高频调用智能体排行').test(bodyText || ''));

  // ===== §1 KPI(对齐 docx 5 项)=====
  record('KPI:纳管智能体总数 42 个', /纳管智能体总数[\s\S]*?42/.test(bodyText || ''));
  record('KPI:总调用量 126.8 万', /总调用量[\s\S]*?126\.8/.test(bodyText || ''));
  record('KPI:科室覆盖率 68.4%', /科室覆盖率[\s\S]*?68\.4/.test(bodyText || ''));
  record('KPI:正常运行率 95.2%', /正常运行率[\s\S]*?95\.2/.test(bodyText || ''));
  record('KPI:使用成本 38.6 万元', /使用成本[\s\S]*?38\.6/.test(bodyText || ''));

  // ===== §1 图编号对齐 docx(图 1-1 ~ 图 1-7)=====
  record('图 1-1 全院智能体月度调用量趋势', /图\s*1-1\s*全院智能体月度调用量趋势/.test(bodyText || ''));
  record('图 1-2 每月新增纳管智能体数量', /图\s*1-2\s*每月新增纳管智能体数量/.test(bodyText || ''));
  record('图 1-3 智能体科室分布', /图\s*1-3\s*智能体科室分布/.test(bodyText || ''));
  record('图 1-4 智能体诊疗环节分布', /图\s*1-4\s*智能体诊疗环节分布/.test(bodyText || ''));
  record('图 1-5 智能体来源分布', /图\s*1-5\s*智能体来源分布/.test(bodyText || ''));
  record('图 1-6 智能体风险分级分布', /图\s*1-6\s*智能体风险分级分布/.test(bodyText || ''));

  // ===== §2 医院资源管理情况 - 3 个子章节 + 矩阵 =====
  record('§2(一)对接业务系统总量', new RegExp(es('一') + '对接业务系统总量').test(bodyText || ''));
  record('§2(二)各智能体对接系统数量排行', new RegExp(es('二') + '各智能体对接系统数量排行').test(bodyText || ''));
  record('§2(三)各智能体对接系统具体情况', new RegExp(es('三') + '各智能体对接系统具体情况').test(bodyText || ''));
  record('§2 对接业务系统数量 12 个', /医院资源管理中心对接业务系统数量[\s\S]*?12/.test(bodyText || ''));
  record('§2 图 2-1 各智能体对接业务系统数量排行', /图\s*2-1\s*各智能体对接业务系统数量排行/.test(bodyText || ''));
  record('§2 图 2-2 智能体×业务系统对接矩阵', /图\s*2-2\s*智能体\s*×\s*业务系统对接矩阵/.test(bodyText || ''));

  // ===== §3 准入评测情况 - 3 个子章节 + 图 3-1/3-2/3-3 =====
  record('§3(一)评测进度', new RegExp(es('一') + '评测进度').test(bodyText || ''));
  record('§3(二)评测结果', new RegExp(es('二') + '评测结果').test(bodyText || ''));
  record('§3(三)退回原因分析', new RegExp(es('三') + '退回原因分析').test(bodyText || ''));
  record('§3 累计发起准入评测 42 项', /累计发起准入评测\s*42\s*项/.test(bodyText || ''));
  record('§3 完成率 71.4%', /完成率\s*71\.4%/.test(bodyText || ''));
  record('§3 准入通过 24 项(80%)', /准入通过\s*24\s*项\(80%\)/.test(bodyText || ''));
  record('§3 图 3-1 准入评测进度分布', /图\s*3-1\s*准入评测进度分布/.test(bodyText || ''));
  record('§3 图 3-2 评测结果占比', /图\s*3-2\s*评测结果占比/.test(bodyText || ''));
  record('§3 图 3-3 退回原因五维安全分布', /图\s*3-3\s*退回原因五维安全分布/.test(bodyText || ''));

  // ===== §4 运行监测情况 - 4 个子章节 + 68/3/42 KPI =====
  record('§4(一)告警情况', new RegExp(es('一') + '告警情况').test(bodyText || ''));
  record('§4(二)异常智能体情况说明', new RegExp(es('二') + '异常智能体情况说明').test(bodyText || ''));
  record('§4(三)故障原因统计', new RegExp(es('三') + '故障原因统计').test(bodyText || ''));
  record('§4(四)典型问题及处理方案', new RegExp(es('四') + '典型问题及处理方案').test(bodyText || ''));
  record('KPI:告警次数 68', /告警次数\(次\)[\s\S]*?68/.test(bodyText || ''));
  record('KPI:故障次数 3', /故障次数\(次\)[\s\S]*?3/.test(bodyText || ''));
  record('KPI:故障平均恢复时间 42 分钟', /故障平均恢复时间[\s\S]*?42[\s\S]*?分钟/.test(bodyText || ''));
  record('§4 图 4-1 告警次数周度趋势', /图\s*4-1\s*告警次数周度趋势/.test(bodyText || ''));
  record('§4 故障原因统计表 4 维度', /业务监控[\s\S]*?状态监控[\s\S]*?成本监控[\s\S]*?安全监控/.test(bodyText || ''));

  // ===== §5 报告总结 - 4+4 段 =====
  record('§5(一)存在的问题', new RegExp(es('一') + '存在的问题').test(bodyText || ''));
  record('§5(二)下一步工作建议', new RegExp(es('二') + '下一步工作建议').test(bodyText || ''));
  record('§5 25 个科室未接入', /25\s*个科室未接入/.test(bodyText || ''));
  record('§5 退回率达 20%', /退回率达\s*20%/.test(bodyText || ''));
  record('§5 覆盖率达到 80%', /科室覆盖率达到\s*80%/.test(bodyText || ''));

  // ===== 封面信息 =====
  record('报告 subTitle 含统计周期 2026-01-01', /2026-01-01/.test(bodyText || ''));
  record('报告 subTitle 含统计范围 全院', /全院/.test(bodyText || ''));
  record('报告 subTitle 含编制单位 信息科', /编制单位[\s\S]*?信息科/.test(bodyText || ''));

  await page.screenshot({ path: 'verify_ledger_generate_report_2_report.png', fullPage: true });

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