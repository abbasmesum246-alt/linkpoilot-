import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:3000';
const OUT = '/home/user/affiliate-os/shots';
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 300)); });
page.on('pageerror', e => errors.push('[pageerror] ' + String(e).slice(0, 300)));

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });

// login page
await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' });
await shot('01-login');

// login as demo
await page.fill('input[type=email]', 'demo@linkpilot.app');
await page.fill('input[type=password]', 'demo1234');
await page.click('button[type=submit]');
await page.waitForSelector('.kpi-grid', { timeout: 15000 });
await page.waitForTimeout(800);
await shot('02-dashboard');

// links
await page.goto(BASE + '/#/links', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await shot('03-links');

// open link drawer
await page.click('table tbody tr');
await page.waitForTimeout(900);
await shot('04-link-drawer');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// new link modal
await page.goto(BASE + '/#/links?new=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await shot('05-link-modal');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// campaigns
await page.goto(BASE + '/#/campaigns', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await shot('06-campaigns');

// networks
await page.goto(BASE + '/#/networks', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await shot('07-networks');

// payouts
await page.goto(BASE + '/#/payouts', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await shot('08-payouts');

// integrations
await page.goto(BASE + '/#/integrations', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await shot('09-integrations');

// settings
await page.goto(BASE + '/#/settings', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await shot('10-settings');

// opportunities (live market data)
await page.goto(BASE + '/#/opportunities', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await shot('10b-opportunities');

// assistant
await page.evaluate(() => fetch('/api/assistant/history', { method: 'DELETE' }));
await page.goto(BASE + '/#/assistant', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await shot('10c-assistant');

// strategies
await page.goto(BASE + '/#/strategies', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await shot('10d-strategies');

// mobile view
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(BASE + '/#/dashboard', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await shot('11-mobile-dashboard');
await page.goto(BASE + '/#/links', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await shot('12-mobile-links');

// light theme
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(BASE + '/#/settings', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.click('.seg button:has-text("Light")');
await page.waitForTimeout(400);
await page.goto(BASE + '/#/dashboard', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await shot('13-dashboard-light');
// back to dark
await page.evaluate(() => { localStorage.setItem('lp_theme', 'dark'); });

// empty state check: register a fresh account (fresh context = fresh boot)
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page2 = await ctx2.newPage();
page2.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 300)); });
page2.on('pageerror', e => errors.push('[pageerror] ' + String(e).slice(0, 300)));
await page2.goto(BASE + '/#/register', { waitUntil: 'networkidle' });
const shot2 = (name) => page2.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
await page2.fill('input[placeholder="Alex Morgan"]', 'Zara Khan');
await page2.fill('input[type=email]', `zara+${Date.now()}@example.com`);
await page2.fill('input[placeholder*="At least 6"]', 'zara1234');
await page2.click('button[type=submit]');
await page2.waitForSelector('.kpi-grid', { timeout: 15000 });
await page2.waitForTimeout(1200);
await shot2('14-empty-dashboard');
await page2.goto(BASE + '/#/links', { waitUntil: 'networkidle' });
await page2.waitForTimeout(600);
await shot2('15-empty-links');

// cleanup: delete the throwaway account
await page2.evaluate(() => fetch('/api/me', { method: 'DELETE' }));
await ctx2.close();

await browser.close();
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
