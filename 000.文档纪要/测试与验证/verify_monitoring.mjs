import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();

const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') {
    const t = m.text();
    if (t.includes('Fragment') || t.includes('Something went wrong')) {
      console.log('[console error]', t);
    }
  }
});

// 1) Login
await page.goto('http://localhost:3001/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('input[placeholder*="工号"]', { timeout: 60000 });
await page.waitForTimeout(1500);

// Fill account/password (account login is default tab)
const accountInput = page.locator('input[placeholder*="工号"]').first();
const passwordInput = page.locator('input[placeholder*="密码"]').first();
await accountInput.fill('admin');
await passwordInput.fill('admin');
await page.locator('button:has-text("录")').first().click();

try {
  await page.waitForURL(/\/app/, { timeout: 15000 });
} catch (e) {
  // Maybe still on /login or redirected to home; continue
  console.log('[login] not redirected to /app, current url:', page.url());
}
await page.waitForTimeout(2000);

const targets = [
  { name: 'business', url: 'http://localhost:3001/app/monitoring/business' },
  { name: 'status',   url: 'http://localhost:3001/app/monitoring/status' },
  { name: 'cost',     url: 'http://localhost:3001/app/monitoring/cost' },
  { name: 'alerts',   url: 'http://localhost:3001/app/monitoring/alerts' },
];

const results = [];

for (const t of targets) {
  const errsBefore = pageErrors.length;
  await page.goto(t.url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);

  const bodyText = await page.locator('body').innerText();
  const hasFragmentErr = bodyText.includes('Fragment is not defined');
  const hasSomethingWrong = bodyText.includes('Something went wrong');

  // Try to find a heading
  let heading = '';
  const h1 = await page.locator('h1, .ant-page-header-heading-title, .ant-typography h1').first();
  try {
    heading = (await h1.innerText({ timeout: 1500 })).trim();
  } catch {}
  if (!heading) {
    // try page-header-title
    const ph = await page.locator('.ant-page-header-heading-title').first();
    try { heading = (await ph.innerText({ timeout: 1500 })).trim(); } catch {}
  }
  if (!heading) {
    // try first visible h2/h3 or any title
    const h2 = await page.locator('h2, h3').first();
    try { heading = (await h2.innerText({ timeout: 1500 })).trim(); } catch {}
  }
  if (!heading) {
    heading = (bodyText.split('\n').map(s => s.trim()).filter(Boolean)[0] || '').slice(0, 80);
  }

  const shotPath = `/tmp/monitoring-verify-${t.name}.png`;
  await page.screenshot({ path: shotPath, fullPage: false });

  const verdict = (hasFragmentErr || hasSomethingWrong) ? 'FAIL' : 'PASS';
  const reason = hasFragmentErr
    ? '"Fragment is not defined" error visible'
    : hasSomethingWrong
      ? '"Something went wrong" error visible'
      : `heading="${heading.slice(0, 60)}"`;

  results.push({ name: t.name, url: t.url, verdict, reason, shotPath, errs: pageErrors.length - errsBefore });
  console.log(`[${t.name}] ${verdict} - ${reason}`);
}

await browser.close();
console.log('\n=== SUMMARY ===');
for (const r of results) {
  console.log(`${r.verdict}  ${r.name.padEnd(10)}  ${r.reason}  (${r.shotPath})`);
}
