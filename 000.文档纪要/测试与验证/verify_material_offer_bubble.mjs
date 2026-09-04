// 验证 备案材料生成气泡 V1: 与欢迎气泡样式统一 + 减少下方留白
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const results = [];
const check = (name, cond, extra = '') => {
  results.push({ name, pass: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

page.on('pageerror', (err) => console.log('[PAGE ERROR]', err.message));

await page.goto(`${BASE}/`);
await page.evaluate(() => {
  localStorage.setItem('demo_settings_v1', JSON.stringify({
    demoRole: '信息科管理员',
    visibleModules: ['home', 'agent-needs', 'agent-center', 'ledger', 'resource-center', 'evaluation', 'monitoring'],
  }));
});

await page.goto(`${BASE}/app/agent-center/smart-register`);
await page.waitForTimeout(2500);

// 通过 window.__smartDraft.setMaterialOffer 触发
const triggered = await page.evaluate(() => {
  const sd = window.__smartDraft;
  if (!sd || typeof sd.setMaterialOffer !== 'function') {
    return 'no setMaterialOffer';
  }
  sd.setMaterialOffer({ missingCategories: ['product', 'tech'] });
  return 'ok';
});
console.log('trigger:', triggered);

await page.waitForTimeout(1000);

const bubbleCount = await page.locator('[data-testid="material-offer-bubble"]').count();
check('material-offer-bubble 出现', bubbleCount === 1);

if (bubbleCount === 1) {
  // 对比气泡样式
  const styles = await page.locator('[data-testid="material-offer-bubble"]').evaluate((el) => {
    const cs = window.getComputedStyle(el);
    return {
      bg: cs.backgroundColor,
      radius: cs.borderRadius,
      padding: cs.padding,
      fontSize: cs.fontSize,
      lineHeight: cs.lineHeight,
      borderColor: cs.borderColor,
      borderWidth: cs.borderWidth,
      w: el.offsetWidth,
      h: el.offsetHeight,
    };
  });
  console.log('样式:', JSON.stringify(styles, null, 2));

  check('白底 rgb(255,255,255)', styles.bg === 'rgb(255, 255, 255)');
  check('圆角 12px', styles.radius === '12px');
  check('字号 12px (与 welcome 一致)', styles.fontSize === '12px');
  check('行高 18px (=12*1.5)', styles.lineHeight === '18px');
  check('宽度 360px', styles.w === 360);

  // 检查按钮可见
  const genBtn = await page.locator('[data-testid="side-bubble-generate-product-doc-btn"]').isVisible();
  const techBtn = await page.locator('[data-testid="side-bubble-generate-tech-doc-btn"]').isVisible();
  const dismissBtn = await page.locator('[data-testid="side-bubble-dismiss-material-generation-btn"]').isVisible();
  check('生成产品说明书按钮可见', genBtn);
  check('生成技术说明书按钮可见', techBtn);
  check('暂不生成按钮可见', dismissBtn);

  // 检查高度合理 (140-260 范围, 避免大块留白 — 应紧贴内容)
  const heightOk = styles.h >= 140 && styles.h <= 260;
  check(`气泡高度合理 (${styles.h}px, 140-260)`, heightOk);

  // 截图
  await page.screenshot({ path: 'verify_material_offer_v1.png', fullPage: false });
  console.log('已截图: verify_material_offer_v1.png');

  // 测试 dismiss
  await page.locator('[data-testid="side-bubble-dismiss-material-generation-btn"]').click();
  await page.waitForTimeout(500);
  const afterDismiss = await page.locator('[data-testid="material-offer-bubble"]').count();
  check('dismiss 后气泡消失', afterDismiss === 0);
}

await browser.close();

const passed = results.filter(r => r.pass).length;
const failed = results.length - passed;
console.log(`\n=== ${passed}/${results.length} PASS, ${failed} FAIL ===`);
process.exit(failed > 0 ? 1 : 0);