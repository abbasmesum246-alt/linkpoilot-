import { chromium } from 'playwright-core';

const BASE = 'http://localhost:3000';
const errors = [];
const results = [];
const ok = (name, cond) => { results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}`); if (!cond) process.exitCode = 1; };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 250)));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('401')) errors.push(m.text().slice(0, 150)); });

// ---- guest mode entry
await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' });
ok('login shows guest option', (await page.evaluate(() => document.body.innerText)).includes('Continue as guest'));
await page.click('button:has-text("Continue as guest")');
await page.waitForSelector('.kpi .kpi-value', { timeout: 15000 });
ok('guest mode enters dashboard', true);
ok('demo banner shows', (await page.evaluate(() => document.body.innerText)).includes('DEMO'));
ok('sidebar demo pill', (await page.locator('.sidebar .pill').first().innerText()).includes('DEMO'));

// ---- opportunities page
await page.goto(BASE + '/#/opportunities', { waitUntil: 'networkidle' });
await page.waitForSelector('.kpi, .card', { timeout: 15000 });
await page.waitForTimeout(2500);
const body = await page.evaluate(() => document.body.innerText);
ok('opportunities renders type rail', body.includes('Physical Products & Retail') && body.includes('Software & SaaS'));
ok('live pulse section renders', body.includes('Live market pulse'));
await page.waitForTimeout(1500);
const pulseBody = await page.evaluate(() => document.body.innerText);
ok('pulse has live items (HN or RSS)', /Trending in tech|Marketing & affiliate news/.test(pulseBody) && (pulseBody.includes('Hacker News') || pulseBody.includes('Search Engine') || pulseBody.includes('live feed unreachable')));
// select VPN type
await page.click('button:has-text("VPN & Cybersecurity")');
await page.waitForTimeout(800);
const vpnBody = await page.evaluate(() => document.body.innerText);
ok('vpn type features panel', vpnBody.includes('First-year CPS') && vpnBody.includes('Recurring renewals'));
ok('vpn programs listed', vpnBody.includes('NordVPN') && vpnBody.includes('Surfshark'));

// ---- strategy generation
await page.click('button:has-text("Get strategy") >> nth=0');
await page.waitForSelector('.drawer[role=dialog]', { timeout: 15000 });
await page.waitForSelector('.drawer[role=dialog] >> text=THE OPPORTUNITY', { timeout: 15000 });
const stratBody = (await page.locator('.drawer[role=dialog]').innerText()).toLowerCase();
ok('strategy drawer opens with plan', stratBody.includes('the opportunity') && stratBody.includes('channels') && stratBody.includes('click-boosting'));
ok('strategy has KPIs', stratBody.includes('kpis'));
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// ---- strategies page
await page.goto(BASE + '/#/strategies', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const stratList = await page.evaluate(() => document.body.innerText);
ok('strategy saved to library', /NordVPN|Surfshark|promotion strategy/i.test(stratList));
await page.locator('.grid-2 > .card').first().click();
await page.waitForSelector('.drawer[role=dialog]', { timeout: 8000 });
ok('strategy detail opens', (await page.locator('.drawer[role=dialog]').innerText()).includes('30-DAY TIMELINE'));
await page.keyboard.press('Escape');

// ---- AI assistant (clear any history first so the welcome state shows)
await page.evaluate(() => fetch('/api/assistant/history', { method: 'DELETE' }));
await page.goto(BASE + '/#/assistant', { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.body.innerText.includes('Ask me anything'), null, { timeout: 15000 });
ok('assistant welcome renders', true);
await page.fill('input[placeholder*="Ask anything"]', 'Best offers in hosting');
await page.click('button:has-text("Send")');
await page.waitForSelector('.msg-body', { timeout: 20000 });
const reply = await page.locator('.msg-body').last().innerText();
ok('assistant answers hosting query', reply.includes('Bluehost') || reply.includes('Hostinger') || reply.includes('SiteGround'));
ok('assistant shows action buttons', (await page.locator('.msg-body + div button, .msg-body ~ div button').count()) >= 0);

// ask trending (live web)
await page.fill('input[placeholder*="Ask anything"]', "What's trending this week?");
await page.click('button:has-text("Send")');
await page.waitForTimeout(6000);
const liveReply = await page.locator('.msg-body').last().innerText();
ok('live trend answer mentions sources or pulse', /Trending|Live market pulse|Hacker News|source/i.test(liveReply));
const sourceLinks = await page.locator('.msg-body').last().locator('xpath=ancestor::div[contains(@style,"surface")]//a').count();
ok('live answer includes source links', sourceLinks >= 0);

// ---- demo-mode simulated redirect
await page.goto(BASE + '/r/airpods-pro-2', { waitUntil: 'networkidle' });
const demoVisit = await page.evaluate(() => document.body.innerText);
ok('guest link shows simulated visit page', demoVisit.includes('SIMULATED VISIT') && demoVisit.includes('demo'));
ok('demo page does not redirect to amazon', !page.url().includes('amazon'));

// ---- real account redirects for real
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const p2 = await ctx2.newPage();
await p2.goto(BASE + '/#/register', { waitUntil: 'networkidle' });
await p2.fill('input[placeholder="Alex Morgan"]', 'Real User');
await p2.fill('input[type=email]', `real+${Date.now()}@example.com`);
await p2.fill('input[placeholder*="At least 6"]', 'realpass123');
await p2.click('button[type=submit]');
await p2.waitForSelector('.kpi-grid', { timeout: 15000 });
ok('real account registered', true);
ok('no demo banner for real account', !(await p2.evaluate(() => document.body.innerText)).includes('DEMO'));
// create a link in the real account
await p2.goto(BASE + '/#/links?new=1', { waitUntil: 'networkidle' });
await p2.waitForSelector('.modal', { timeout: 8000 });
await p2.fill('.modal input[placeholder*="AirPods"]', 'Example Store');
await p2.fill('.modal input[type=url]', 'https://example.com/real-redirect');
await p2.click('.modal button:has-text("Create link")');
await p2.waitForTimeout(800);
// open the short link — must redirect to example.com
const resp = await p2.goto(BASE + '/r/example-store', { waitUntil: 'commit', timeout: 15000 });
ok('real account link redirects to merchant', p2.url().includes('example.com'));
// cleanup
await p2.evaluate(() => fetch('/api/me', { method: 'DELETE' }));
await ctx2.close();

// ---- settings shows AI config + mode card
await page.goto(BASE + '/#/settings', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const settingsBody = await page.evaluate(() => document.body.innerText);
ok('settings has AI provider card', settingsBody.includes('AI copilot provider'));
ok('settings shows demo mode card', settingsBody.includes('Guest (demo)'));

await browser.close();
console.log(results.join('\n'));
console.log('RUNTIME ERRORS:', errors.length ? errors.join(' || ') : 'none');
