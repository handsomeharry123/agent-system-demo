import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = '/Users/harry/Desktop/CC_TEST/agent-system/verify_agt_2024_001_access_artefacts';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

// 场景 1：admin 直接访问 AGT-2024-001 应正常
console.log('=== 场景 1：admin 直接访问 AGT-2024-001 ===');
await page.goto('http://localhost:3001/app/ledger/detail/AGT-2024-001', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500);
const adminBody = await page.locator('body').innerText();
const adminOk = adminBody.includes('基本信息') && adminBody.includes('互联网医院智能问诊助手');
console.log('admin 正常显示:', adminOk);
console.log('admin pageerrors:', errors.length);
errors.length = 0;
await page.screenshot({ path: `${OUT}/after_admin.png`, fullPage: false });

// 场景 2：admin 访问 AGT-2024-004 (另一个智能体)
console.log('\n=== 场景 2：admin 访问 AGT-2024-004 ===');
await page.goto('http://localhost:3001/app/ledger/detail/AGT-2024-004', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500);
const adminBody2 = await page.locator('body').innerText();
const adminOk2 = !adminBody2.includes('智能体不存在') && !adminBody2.includes('无权访问');
console.log('admin 正常显示:', adminOk2);
console.log('admin pageerrors:', errors.length);
errors.length = 0;

// 场景 3：admin 访问 AGT-XXX-999 (不存在的 ID) 应显示 404
console.log('\n=== 场景 3：admin 访问不存在的 ID ===');
await page.goto('http://localhost:3001/app/ledger/detail/AGT-9999-999', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
const body3 = await page.locator('body').innerText();
const has404 = body3.includes('智能体不存在');
console.log('404 显示:', has404);
console.log('pageerrors:', errors.length);
errors.length = 0;
await page.screenshot({ path: `${OUT}/after_404.png`, fullPage: false });

// 场景 4：admin 访问 ledger list 应正常
console.log('\n=== 场景 4：admin 访问 ledger list ===');
await page.goto('http://localhost:3001/app/ledger/list', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
const body4 = await page.locator('body').innerText();
const listOk = body4.includes('台账') && !body4.includes('无权访问');
console.log('list 正常:', listOk);
console.log('pageerrors:', errors.length);
errors.length = 0;

// 场景 5：admin 访问 ledger/risk/AGT-2024-001
console.log('\n=== 场景 5：admin 访问 ledger/risk ===');
await page.goto('http://localhost:3001/app/ledger/risk/AGT-2024-001', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
const body5 = await page.locator('body').innerText();
const riskOk = !body5.includes('无权访问') && !body5.includes('Something went wrong');
console.log('risk 正常:', riskOk);
console.log('pageerrors:', errors.length);

await browser.close();
console.log('\n=== DONE ===');