import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';

async function newPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  return { ctx, page };
}

async function login(page) {
  await page.goto(`${BASE}/app/login?role=admin`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
}

const browser = await chromium.launch({ headless: true });

// =================================================================
// Recheck Test 1 with manual bigram match computation
// =================================================================
console.log('=== Recheck Test 1: heart agent with URL analysis ===');
{
  const { ctx, page } = await newPage(browser);
  await login(page);

  // Use direct URL approach (this is exactly what the click does internally)
  const searchName = '心电图智能辅助诊断';
  const url = `${BASE}/app/ledger/list?search=${encodeURIComponent(searchName)}&openDetail=1`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(4000);

  const finalUrl = page.url();
  console.log('Final URL:', finalUrl);

  // Extract the agent ID from the URL
  const match = finalUrl.match(/\/app\/ledger\/detail\/([^?]+)/);
  const agentId = match ? match[1] : null;
  console.log('Agent ID:', agentId);

  // Get page content to find what agent is displayed
  const pageContent = await page.evaluate(() => document.body.innerText);
  const hasNew = pageContent.includes('心血管辅助诊断系统');
  const hasOld = pageContent.includes('心电辅助诊断 V0');
  console.log('Has 心血管辅助诊断系统 (new):', hasNew);
  console.log('Has 心电辅助诊断 V0 (old/disabled):', hasOld);

  // Get agent name from page (try to extract from "智能体名称" label)
  const agentName = await page.evaluate(() => {
    const labels = document.querySelectorAll('.ant-descriptions-item-label');
    for (const label of labels) {
      if (label.textContent.includes('智能体名称')) {
        const valueEl = label.nextElementSibling;
        if (valueEl) return valueEl.textContent.trim();
      }
    }
    return null;
  });
  console.log('Agent name on page:', agentName);

  await page.screenshot({ path: '/tmp/recheck_test1.png', fullPage: true });

  await ctx.close();
}

// =================================================================
// Recheck Test 3: capture message warning (with timing)
// =================================================================
console.log('\n=== Recheck Test 3: nonsense name with message capture ===');
{
  const { ctx, page } = await newPage(browser);
  await login(page);

  // Setup message listener BEFORE navigation
  const messagePromise = page.waitForSelector('.ant-message-notice-content', { timeout: 10000 }).catch(() => null);

  const searchName = '不存在的智能体';
  const url = `${BASE}/app/ledger/list?search=${encodeURIComponent(searchName)}&openDetail=1`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000); // wait for message to appear

  const messageEl = await messagePromise;
  if (messageEl) {
    const msgText = await messageEl.textContent();
    console.log('Message text:', msgText);
  } else {
    console.log('No message element appeared');

    // Try a few more selectors
    const allMessages = await page.evaluate(() => {
      const selectors = [
        '.ant-message-notice',
        '.ant-message-notice-content',
        '.ant-message-custom-content',
        '.ant-message',
        '[class*="message"]',
      ];
      const found = [];
      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          const txt = (el.textContent || '').trim();
          if (txt && txt.length < 200) {
            found.push({ selector: sel, text: txt });
          }
        }
      }
      return found;
    });
    console.log('Found messages:', JSON.stringify(allMessages, null, 2));
  }

  await page.screenshot({ path: '/tmp/recheck_test3.png', fullPage: true });

  // Wait a bit more and check again
  await page.waitForTimeout(2000);
  const finalUrl = page.url();
  console.log('Final URL:', finalUrl);

  const stayedOnList = finalUrl.includes('/app/ledger/list') && !finalUrl.includes('/app/ledger/detail/');
  console.log('Stayed on list page:', stayedOnList);

  await ctx.close();
}

await browser.close();
console.log('Done');
