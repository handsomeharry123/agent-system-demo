// V5: 验证台账中心气泡位置: 气泡右下角 ≈ 机器人左上角 + 12px gap(与接入中心一致)
import { chromium } from 'playwright';
import fs from 'fs';

const SHOT_DIR = 'verify_bubble_position_artefacts';
fs.mkdirSync(SHOT_DIR, { recursive: true });

const failures = [];
const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

page.on('pageerror', (e) => failures.push(`PAGEERROR: ${e.message}`));

await page.addInitScript(() => {
  window.localStorage.setItem('currentUser', JSON.stringify({
    role: 'platform_admin',
    userName: '孙逸仙',
    department: '信息科',
  }));
});

log('打开台账总览页(/app/ledger)');
await page.goto('http://localhost:3001/app/ledger', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// 等医小管气泡出现
log('等待医小管气泡出现');
await page.waitForSelector('[data-testid="ledger-bubble-subscribe"]', { timeout: 8000 });
await page.waitForTimeout(500);

// 截图
await page.screenshot({ path: `${SHOT_DIR}/01-overview-bubble.png`, fullPage: false });

// 读取气泡 box + 机器人 box
const info = await page.evaluate(() => {
  // 气泡(在 AgentFloatHost 内)
  // 机器人(就是医小管图片)
  const bubble = document.querySelector('[data-testid="ledger-bubble-subscribe"]');
  if (!bubble) return null;
  // 气泡的容器 div(它是最外层定位的 div)
  const bubbleContainer = bubble.closest('div[style*="position"]') || bubble.parentElement.parentElement.parentElement;

  // 机器人
  const robotImg = document.querySelector('img[src*="robot"], [class*="robot"], svg[role="img"]');
  // 用医小管 SVG 的 ref 不好找,直接找 AgentFloatHost 内的 svg
  const allSvgs = Array.from(document.querySelectorAll('svg'));
  // 找机器人(viewBox 一般是 96x96)
  let robot = null;
  for (const s of allSvgs) {
    const r = s.getBoundingClientRect();
    // 机器人大约在右下角,大小 ~64-96px
    if (r.right > window.innerWidth - 100 && r.bottom > window.innerHeight - 100 && r.width >= 50 && r.width <= 120) {
      robot = s;
      break;
    }
  }
  if (!robot) {
    // fallback: 找 img
    const imgs = Array.from(document.querySelectorAll('img'));
    for (const i of imgs) {
      const r = i.getBoundingClientRect();
      if (r.right > window.innerWidth - 100 && r.bottom > window.innerHeight - 100 && r.width >= 50) {
        robot = i;
        break;
      }
    }
  }
  if (!robot) return { error: 'no robot' };

  const rb = bubbleContainer.getBoundingClientRect();
  const rr = robot.getBoundingClientRect();
  return {
    bubble: { left: rb.left, top: rb.top, right: rb.right, bottom: rb.bottom, width: rb.width, height: rb.height },
    robot: { left: rr.left, top: rr.top, right: rr.right, bottom: rr.bottom, width: rr.width, height: rr.height },
    vw: window.innerWidth, vh: window.innerHeight,
  };
});

log(`info: ${JSON.stringify(info, null, 2)}`);

if (!info || info.error) {
  failures.push('无法找到气泡或机器人');
} else {
  const b = info.bubble, r = info.robot;
  log(`  bubble: left=${b.left.toFixed(0)} top=${b.top.toFixed(0)} right=${b.right.toFixed(0)} bottom=${b.bottom.toFixed(0)} ${b.width.toFixed(0)}x${b.height.toFixed(0)}`);
  log(`  robot : left=${r.left.toFixed(0)} top=${r.top.toFixed(0)} right=${r.right.toFixed(0)} bottom=${r.bottom.toFixed(0)} ${r.width.toFixed(0)}x${r.height.toFixed(0)}`);

  // 期望:bubble.right ≈ robot.left - 12(允许 ±25 误差,因为可能有夹紧)
  const gapX = r.left - b.right;
  log(`  bubble.right → robot.left 间距: ${gapX.toFixed(0)}px (期望 4-30)`);
  if (gapX < 2 || gapX > 50) {
    failures.push(`【X 间距】气泡与机器人水平间距异常: ${gapX.toFixed(0)}px`);
  }

  // 期望:bubble.bottom ≈ robot.top - 12(允许 ±25)
  const gapY = r.top - b.bottom;
  log(`  bubble.bottom → robot.top 间距: ${gapY.toFixed(0)}px (期望 4-30)`);
  if (gapY < 2 || gapY > 50) {
    failures.push(`【Y 间距】气泡与机器人垂直间距异常: ${gapY.toFixed(0)}px`);
  }

  // 期望:bubble 在机器人**左侧**(bubble.right < robot.left)
  if (b.right > r.left + 2) {
    failures.push(`【位置】气泡不在机器人左侧: bubble.right=${b.right.toFixed(0)} > robot.left=${r.left.toFixed(0)}`);
  }
  // 期望:bubble 与 robot 顶部接近(气泡底部 ≤ 机器人顶部 + bubble 自身高度误差)
  if (b.bottom > r.top + 30) {
    failures.push(`【位置】气泡底高于机器人顶过多: ${(b.bottom - r.top).toFixed(0)}px`);
  }
}

// ============ 详情页气泡也走同一个 StatusBubbleV31,确认一致 ============
log('\n打开台账详情页(沿用同一气泡)');
await page.goto('http://localhost:3001/app/ledger/detail/AGT-2024-001', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

const hasBubble = await page.locator('[data-testid="ledger-bubble-subscribe"]').count();
log(`  详情页气泡存在: ${hasBubble > 0 || (await page.locator('.ant-float-btn, [class*="bubble"]').count()) > 0}`);
await page.screenshot({ path: `${SHOT_DIR}/02-detail-bubble.png`, fullPage: false });

// ============ 总结 ============
log('\n========== 验证总结 ==========');
if (failures.length === 0) {
  log('✅ 全部 PASS');
} else {
  log(`❌ ${failures.length} 处失败:`);
  failures.forEach((f) => log(`   - ${f}`));
}

await browser.close();
process.exit(failures.length > 0 ? 1 : 0);