// 验证评测任务管理页 9 个 Tab 操作列按钮样式一致性
// 基准：接入中心所有 Tab 操作列按钮统一 type="link" + size="small"
// 评测任务管理页之前 待审核/审核中 Tab 的「审核」按钮用了 type="primary"(主按钮)
// 应改为与其他 Tab 一致的 type="link" 样式保证视觉统一

import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const SHOT = '/tmp';

function line() { console.log('─'.repeat(78)); }

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();
page.on('pageerror', e => console.log(`[PAGE-ERR] ${e.message}`));

console.log('\n[1] Login as 信息科管理员');
await page.goto(`${BASE}/app/login?role=admin`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

console.log('\n[2] Navigate to 评测任务管理');
await page.goto(`${BASE}/app/evaluation/tasks`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// 9 个 Tab key (V1.7)
const TABS = ['全部任务', '草稿', '评测中', '撤销', '评测完成', '待审核', '审核中', '审核通过', '退回修改'];

// 收集每个 Tab 操作列按钮的样式信息
const results = {};
for (const tabLabel of TABS) {
  // 点击对应 Tab
  await page.locator(`.ant-tabs-tab:has-text("${tabLabel}")`).first().click();
  await page.waitForTimeout(800);

  // 取第一个有按钮的行
  const rowInfo = await page.evaluate(() => {
    const trs = Array.from(document.querySelectorAll('.ant-table-tbody > tr.ant-table-row'));
    if (!trs.length) return null;

    // 优先找包含按钮的行
    let row = trs.find(r => r.querySelectorAll('td:last-child button').length > 0);
    if (!row) row = trs[0];

    const cells = row.querySelectorAll('td');
    const lastCell = cells[cells.length - 1];
    const buttons = lastCell ? Array.from(lastCell.querySelectorAll('button')) : [];

    return {
      btnTexts: buttons.map(b => b.innerText.trim()).filter(Boolean),
      btnTypes: buttons.map(b => {
        const cls = b.className;
        if (cls.includes('ant-btn-primary')) return 'primary';
        if (cls.includes('ant-btn-default')) return 'default';
        if (cls.includes('ant-btn-link')) return 'link';
        if (cls.includes('ant-btn-text')) return 'text';
        if (cls.includes('ant-btn-dangerous')) return 'danger';
        return 'unknown';
      }),
      dangerFlags: buttons.map(b => b.classList.contains('ant-btn-dangerous')),
    };
  });

  results[tabLabel] = rowInfo;
  console.log(`\n  [${tabLabel}] ${rowInfo ? `buttons: [${rowInfo.btnTexts.join(', ')}]  types: [${rowInfo.btnTypes.join(', ')}]` : 'no rows'}`);
}

// 检查一致性：所有按钮应该是 type="link"
line();
console.log('\n[3] Style consistency check across all tabs');
line();

let allLink = true;
for (const tabLabel of TABS) {
  const r = results[tabLabel];
  if (!r) {
    console.log(`  ${tabLabel.padEnd(8)}: no rows`);
    continue;
  }
  // 排除 primary(应该没有)以及危险(danger 可以是 link+ danger)
  const nonLinkIdx = r.btnTypes.findIndex((t, i) => t !== 'link' && !r.dangerFlags[i]);
  if (nonLinkIdx !== -1) {
    console.log(`  ✗ ${tabLabel.padEnd(8)}: button "${r.btnTexts[nonLinkIdx]}" is "${r.btnTypes[nonLinkIdx]}"(should be link)`);
    allLink = false;
  } else {
    console.log(`  ✓ ${tabLabel.padEnd(8)}: all ${r.btnTexts.length} button(s) are type="link"`);
  }
}

await page.screenshot({ path: `${SHOT}/eval_actions_after.png`, fullPage: true });

console.log('\n=== SUMMARY ===');
console.log(`  ${allLink ? '✓' : '✗'} 所有 9 个 Tab 操作列按钮均统一 type="link"`);

// 待审核 / 审核中 tab 重点验证
const dsh = results['待审核'];
const shz = results['审核中'];
const dshAuditOk = dsh?.btnTypes.every(t => t === 'link') ?? false;
const shzAuditOk = shz?.btnTypes.every(t => t === 'link') ?? false;

console.log(`  ${dshAuditOk ? '✓' : '✗'} 待审核 Tab 按钮全 link: ${dsh?.btnTexts.join(',')}`);
console.log(`  ${shzAuditOk ? '✓' : '✗'} 审核中 Tab 按钮全 link: ${shz?.btnTexts.join(',')}`);

const allOk = allLink && dshAuditOk && shzAuditOk;
console.log(`\n  Overall: ${allOk ? 'ALL PASS' : 'FAILED'}`);

await browser.close();
process.exit(allOk ? 0 : 1);