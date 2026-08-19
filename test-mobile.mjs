import { chromium } from 'playwright-core';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 150)));
await page.goto('http://localhost:3000/#/login', { waitUntil: 'networkidle' });
await page.fill('input[type=email]', 'demo@linkpilot.app');
await page.fill('input[type=password]', 'demo1234');
await page.click('button[type=submit]');
await page.waitForSelector('.kpi .kpi-value', { timeout: 15000 });
// hamburger visible on mobile
const burger = page.locator('.topbar .show-sm');
console.log('hamburger visible:', await burger.isVisible());
await burger.click();
await page.waitForTimeout(400);
console.log('sidebar has open class:', await page.locator('.sidebar').evaluate(el => el.classList.contains('open')));
await page.locator('.sidebar .nav-item', { hasText: 'Campaigns' }).click();
await page.waitForTimeout(700);
console.log('navigated to campaigns:', await page.evaluate(() => location.hash));
console.log('sidebar closed after nav:', await page.locator('.sidebar').evaluate(el => !el.classList.contains('open')));
// theme toggle via Settings (hidden from topbar on mobile by design)
await page.goto('http://localhost:3000/#/settings', { waitUntil: 'networkidle' });
await page.waitForSelector('.seg', { timeout: 10000 });
await page.locator('.seg button', { hasText: 'Light' }).click();
await page.waitForTimeout(300);
console.log('theme:', await page.evaluate(() => document.documentElement.dataset.theme));
await browser.close();
console.log('ERRORS:', errs.length ? errs.join(' || ') : 'none');
