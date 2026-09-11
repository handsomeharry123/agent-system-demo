import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.addInitScript(() => {
  window.__auditEvents = [];
  window.addEventListener('agent-audit-verdict-pass', () => window.__auditEvents.push('pass'));
  window.addEventListener('agent-audit-verdict-return', () => window.__auditEvents.push('return'));
  window.console.log('init: listeners added', !!window.__auditEvents);
});
await page.goto('http://localhost:5173/app/agent-center', { waitUntil: 'networkidle' });
await page.evaluate(() => {
  localStorage.setItem('demo_settings_v1', JSON.stringify({
    demoRole: '信息科管理员',
    visibleModules: {}, visibleSubPages: {},
  }));
});
await page.reload();
await page.waitForTimeout(2000);
await page.evaluate(() => {
  if (typeof window.__useAuthSetRole === 'function') {
    window.__useAuthSetRole('信息科管理员', 'admin');
  }
});
await page.waitForTimeout(2000);
await page.goto('http://localhost:5173/app/agent-center/audit/lung-ai-001', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const hasBtn = await page.$('[data-testid="status-bubble-action-audit-pass"]');
console.log('pass btn exists?', !!hasBtn);
const evts1 = await page.evaluate(() => window.__auditEvents);
console.log('events before click:', JSON.stringify(evts1));
if (hasBtn) {
  await page.click('[data-testid="status-bubble-action-audit-pass"]', { force: true });
  await page.waitForTimeout(1000);
}
const evts2 = await page.evaluate(() => window.__auditEvents);
console.log('events after click:', JSON.stringify(evts2));
await browser.close();
