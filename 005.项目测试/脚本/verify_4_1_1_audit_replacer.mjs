#!/usr/bin/env node
/**
 * 接入中心 审核注册页 X/XX 占位符替换验证
 * 测试员 B — 2026-07-03
 *
 * 覆盖:
 *   - 进入审核页, pushWelcomeGreeting('agent-center-audit', 'admin') 触发
 *   - 文案 "标注了 X 个疑似问题... 预审结论为「XX」" 中:
 *     1. X 必须被实际数字(疑似问题数)替换
 *     2. XX 必须被实际 verdict label(建议通过 / 建议退回 / 待定)替换
 *   - X/XX 字面量不残留
 *   - 操作按钮"审核通过"/"退回修改"可点击且触发 window event
 *   - 多次进入审核页, X/XX 持续被替换(无缓存泄漏)
 *
 * 输出:verify_4_1_1_bubble_full_artefacts/REPORT_TESTER_B.md
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'http://localhost:5173';
const OUT = join(process.cwd(), 'verify_4_1_1_bubble_full_artefacts');
mkdirSync(OUT, { recursive: true });

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? '  -- ' + detail : ''}`);
}

async function setAdminRole(page) {
  await page.evaluate(() => {
    localStorage.setItem('demo_settings_v1', JSON.stringify({
      demoRole: '信息科管理员',
      visibleModules: {}, visibleSubPages: {},
    }));
  });
  await page.reload();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    if (typeof window.__useAuthSetRole === 'function') {
      window.__useAuthSetRole('信息科管理员', 'admin');
    }
  });
  await page.waitForTimeout(1500);
}

async function gotoAuditPage(page, recordId = 'lung-ai-001') {
  const url = `${BASE}/app/agent-center/audit/${recordId}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  return url;
}

async function run(browser) {
  console.log('\n====== 测试员 B · 审核页 X/XX 占位符替换验证 ======');
  const page = await browser.newPage();
  await page.goto(`${BASE}/app/agent-center`, { waitUntil: 'networkidle' });
  await setAdminRole(page);

  // 场景 1:进入审核页, 气泡出现, 文案无 X/XX 字面
  const url1 = await gotoAuditPage(page);
  record(
    '[B1] 审核页能进入(URL=/app/agent-center/audit/:id)',
    page.url().includes('/audit/'),
    page.url(),
  );
  await page.screenshot({ path: join(OUT, 'B1-audit-bubble.png'), fullPage: false });

  const bubble = await page.$('[data-testid="status-bubble"]');
  record('[B2] 机器人旁气泡出现', !!bubble);

  if (bubble) {
    const text = (await page.textContent('[data-testid="status-bubble-content"]')) || '';
    record('[B3] 气泡文案预览', text.length > 0, text.slice(0, 100));

    // X 必须被实际数字替换(不是字面 X)
    // 句子: "我已完成预审：标注了 X 个疑似问题并跑了连通测试，预审结论为「XX」"
    const xMatch = text.match(/标注了\s*(\S+?)\s*个疑似问题/);
    const literalX = /标注了 X 个/.test(text);
    record(
      '[B4] X 被实际数字替换(非字面 X)',
      !!xMatch && !literalX,
      xMatch ? `x=[${xMatch[1]}]` : literalX ? '字面 X 残留' : 'no match',
    );

    const verdictMatch = text.match(/预审结论为「(.+?)」/);
    const literalXX = /「XX」/.test(text);
    record(
      '[B5] XX 被实际 verdict 替换(非字面 XX)',
      !!verdictMatch && !literalXX,
      verdictMatch ? `verdict=[${verdictMatch[1]}]` : literalXX ? '字面 XX 残留' : 'no match',
    );

    // 校验数字合规
    if (xMatch) {
      const xNum = parseInt(xMatch[1], 10);
      record(
        '[B6] X 替换为合法数字',
        !isNaN(xNum) && xNum >= 0,
        `x=${xNum}`,
      );
    } else {
      record('[B6] X 替换为合法数字', false, 'no x match');
    }
    // 校验 verdict 文字合规
    if (verdictMatch) {
      const v = verdictMatch[1];
      const validV = ['建议通过', '建议退回', '待定', 'pass', 'reject'];
      record(
        '[B7] verdict 替换为合法值',
        validV.some((x) => v.includes(x)) || v.length <= 8,
        `verdict=[${v}]`,
      );
    } else {
      record('[B7] verdict 替换为合法值', false, 'no verdict match');
    }
  } else {
    record('[B3] 气泡文案预览', false, 'no bubble');
  }

  // 场景 2:操作按钮"审核通过"+"退回修改"可点击 + 触发 window event
  if (bubble) {
    const opButtons = await page.$$('[data-testid^="status-bubble-action-"]');
    record('[B8] 至少 1 个操作按钮', opButtons.length >= 1, `n=${opButtons.length}`);

    // 重新在当前 page 上注册 listener(覆盖跨 navigation 清空)
    await page.evaluate(() => {
      if (!window.__auditEvents) window.__auditEvents = [];
      window.__auditEvents.length = 0;
      window.addEventListener('agent-audit-verdict-pass', () => window.__auditEvents.push('pass'));
      window.addEventListener('agent-audit-verdict-return', () => window.__auditEvents.push('return'));
      // 调试:确认 listener 已注册
      console.log('[verify] audit listeners installed, events=', JSON.stringify(window.__auditEvents));
    });

    // 点「审核通过」按钮
    const passBtn = page.locator('[data-testid="status-bubble-action-audit-pass"]');
    if (await passBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await passBtn.click({ force: true });
      console.log('  → 已点击「审核通过」');
      await page.waitForTimeout(500);
    }
    const hasPass = await page.evaluate(() => window.__auditEvents?.includes('pass') === true);
    record('[B9] 「审核通过」按钮触发 agent-audit-verdict-pass 事件', hasPass);

    // 重新注册(因为 dispatchEvent 触发后,第一个 listener 已被 push 到 events 数组)
    //   实际不需要,只要 page.evaluate 还能读到 __auditEvents 即可
    // 点「退回修改」按钮
    //   - 第 1 次 click 已 consumeWelcome,气泡消失
    //   - 重新 pushWelcomeGreeting 需 re-mount(简化为 reload + 重新点)
    await page.evaluate(() => {
      // 重置 events 数组准备接受 return 事件
      window.__auditEvents = window.__auditEvents.filter((e) => e === 'pass');
    });
    await page.reload();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2500);
    // 重新挂 listener(reload 后 page.evaluate 状态被清)
    await page.evaluate(() => {
      if (!window.__auditEvents) window.__auditEvents = [];
      window.addEventListener('agent-audit-verdict-return', () => window.__auditEvents.push('return'));
    });
    const returnBtn = page.locator('[data-testid="status-bubble-action-audit-return"]');
    if (await returnBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await returnBtn.click({ force: true });
      console.log('  → 已点击「退回修改」');
      await page.waitForTimeout(500);
    }
    const hasReturn = await page.evaluate(() => window.__auditEvents?.includes('return') === true);
    record('[B10] 「退回修改」按钮触发 agent-audit-verdict-return 事件', hasReturn);
  }

  // 场景 3:不同 record 多次进入,X/XX 持续被替换(无缓存泄漏)
  console.log('\n  --- 场景 3:多次进入不同审核页, 验证持续替换 ---');
  const ids = ['lung-ai-001', 'ct-ai-001', 'ecg-ai'];
  let passAll = true;
  for (const id of ids) {
    await gotoAuditPage(page, id);
    await page.waitForTimeout(1500);
    const t = (await page.textContent('[data-testid="status-bubble-content"]')) || '';
    const okX = /标注了\s*\d+\s*个/.test(t) && !/标注了 X 个/.test(t);
    const okV = /「\S+?」/.test(t) && !/「XX」/.test(t);
    if (!okX || !okV) passAll = false;
    console.log(`    ${id}: X ok=${okX}, verdict ok=${okV}, text=${t.slice(0, 60)}`);
  }
  record('[B11] 不同 recordId 多次进入,X/XX 持续被替换', passAll);

  await page.screenshot({ path: join(OUT, 'B11-multi-audit.png'), fullPage: false });
  await page.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    // 最早注入监听器(在任何 script 之前)
    await page.addInitScript(() => {
      if (!window.__auditEvents) {
        window.__auditEvents = [];
        window.addEventListener('agent-audit-verdict-pass', () => window.__auditEvents.push('pass'));
        window.addEventListener('agent-audit-verdict-return', () => window.__auditEvents.push('return'));
      }
    });
    await run(browser);
  } finally {
    await browser.close();
  }
  const failed = results.filter((r) => !r.pass);
  const summary = {
    ts: new Date().toISOString(),
    tester: 'B',
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
  };
  writeFileSync(join(OUT, 'tester_B_summary.json'), JSON.stringify(summary, null, 2));
  console.log('\n====== 测试员 B 汇总 ======');
  console.log(`总计 ${summary.total} · 通过 ${summary.passed} · 失败 ${summary.failed}`);
  if (failed.length > 0) {
    console.log('失败项:');
    failed.forEach((f) => console.log(`  ❌ ${f.name} -- ${f.detail}`));
  }
  process.exit(failed.length > 0 ? 1 : 0);
})();
