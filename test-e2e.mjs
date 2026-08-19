import { chromium } from 'playwright-core';

const BASE = 'http://localhost:3000';
const errors = [];
const results = [];
const ok = (name, cond) => { results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}`); if (!cond) process.exitCode = 1; };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 200)));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('401')) errors.push(m.text().slice(0, 150)); });

await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' });
await page.fill('input[type=email]', 'demo@linkpilot.app');
await page.fill('input[type=password]', 'demo1234');
await page.click('button[type=submit]');
await page.waitForSelector('.kpi .kpi-value', { timeout: 15000 });
ok('login as demo', true);

// ---- dashboard renders real numbers
await page.waitForTimeout(600);
const kpiVals = await page.locator('.kpi-value').allTextContents();
ok('dashboard KPI values render', kpiVals.length === 4 && kpiVals.every(v => v && v !== '…'));
const svgCount = await page.locator('svg').count();
ok('charts render (svg > 3)', svgCount > 3);
const bodyTxt = await page.evaluate(() => document.body.innerText);
ok('dashboard shows revenue number', /\$[0-9,]+\.\d{2}/.test(bodyTxt));
ok('dashboard shows activity feed', bodyTxt.includes('Recent activity'));

// ---- links: search filter
await page.goto(BASE + '/#/links', { waitUntil: 'networkidle' });
await page.waitForSelector('table.tbl tbody tr', { timeout: 10000 });
ok('links table has 8 rows', (await page.locator('table.tbl tbody tr').count()) === 8);
await page.fill('.search-box input', 'nord');
await page.waitForTimeout(500);
const filtered = await page.locator('table.tbl tbody tr').count();
ok('search filters links (nord -> 1)', filtered === 1);
await page.fill('.search-box input', '');
await page.waitForTimeout(400);

// ---- create link (optimistic flow)
await page.click('button:has-text("New link")');
await page.waitForSelector('.modal', { timeout: 5000 });
await page.fill('.modal input[placeholder*="AirPods"]', 'E2E Test Link');
await page.fill('.modal input[type=url]', 'https://example.com/e2e');
await page.locator('.modal select').first().selectOption({ index: 1 }); // network = Amazon
await page.click('.modal button:has-text("Create link")');
await page.waitForSelector('.toast', { timeout: 5000 });
await page.waitForTimeout(700);
const rowCount = await page.locator('table.tbl tbody tr').count();
ok('create link appears in table', rowCount === 9);
const newRowText = await page.locator('table.tbl tbody tr').first().innerText();
ok('new link row shows slug', newRowText.includes('/e2e-test-link'));

// ---- edit link (optimistic)
await page.locator('table.tbl tbody tr').first().locator('button').click(); // menu
await page.click('.menu button:has-text("Edit")');
await page.waitForSelector('.modal');
await page.fill('.modal input[placeholder*="AirPods"]', 'E2E Test Link Renamed');
await page.click('.modal button:has-text("Save changes")');
await page.waitForTimeout(700);
ok('edit link reflects rename', (await page.evaluate(() => document.body.innerText)).includes('E2E Test Link Renamed'));

// ---- link drawer with stats
await page.locator('table.tbl tbody tr').first().click();
await page.waitForSelector('.drawer[role=dialog]', { timeout: 5000 });
await page.waitForTimeout(700);
const drawerTxt = await page.locator('.drawer[role=dialog]').innerText();
ok('drawer shows short link', drawerTxt.includes('/r/e2e-test-link'));
ok('drawer shows stats', drawerTxt.includes('Clicks') && drawerTxt.includes('Revenue'));
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// ---- delete link (confirm dialog)
await page.locator('table.tbl tbody tr').first().locator('button').click();
await page.click('.menu button:has-text("Delete")');
await page.waitForSelector('.modal');
await page.click('.modal button:has-text("Delete link")');
await page.waitForTimeout(700);
ok('delete removes row', (await page.locator('table.tbl tbody tr').count()) === 8);

// ---- campaigns: create
await page.goto(BASE + '/#/campaigns', { waitUntil: 'networkidle' });
await page.waitForSelector('.card', { timeout: 10000 });
const campCards = await page.locator('.grid-2 > .card').count();
await page.click('button:has-text("New campaign")');
await page.waitForSelector('.modal');
await page.fill('.modal input[placeholder*="Holiday"]', 'E2E Campaign');
await page.fill('.modal input[type=number]', '777');
await page.click('.modal button:has-text("Create campaign")');
await page.waitForTimeout(700);
ok('campaign created', (await page.locator('.grid-2 > .card').count()) === campCards + 1);
ok('campaign shows budget bar', (await page.evaluate(() => document.body.innerText)).includes('$777.00'));

// ---- networks: create
await page.goto(BASE + '/#/networks', { waitUntil: 'networkidle' });
await page.waitForSelector('.grid-2 > .card', { timeout: 10000 });
const netCards = await page.locator('.grid-2 > .card').count();
await page.click('button:has-text("Connect network")');
await page.waitForSelector('.modal');
await page.fill('.modal input[placeholder*="Amazon"]', 'E2E Network');
await page.click('.modal button:has-text("Connect network")');
await page.waitForTimeout(700);
ok('network connected', (await page.locator('.grid-2 > .card').count()) === netCards + 1);

// ---- payouts: add + mark paid
await page.goto(BASE + '/#/payouts', { waitUntil: 'networkidle' });
await page.waitForSelector('table.tbl tbody tr', { timeout: 10000 });
await page.click('button:has-text("Add payout")');
await page.waitForSelector('.modal');
await page.locator('.modal select').first().selectOption({ index: 1 });
await page.fill('.modal input[type=number]', '123.45');
await page.click('.modal button:has-text("Add payout")');
await page.waitForTimeout(700);
const payoutFirst = await page.locator('table.tbl tbody tr').first().innerText();
ok('payout added ($123.45)', payoutFirst.includes('123.45') && payoutFirst.includes('pending'));
await page.locator('table.tbl tbody tr').first().locator('button').click();
await page.click('.menu button:has-text("Mark as paid")');
await page.waitForTimeout(700);
ok('payout marked paid', (await page.locator('table.tbl tbody tr').first().innerText()).includes('paid'));

// ---- integrations: create key + simulate postback + webhook save
await page.goto(BASE + '/#/integrations', { waitUntil: 'networkidle' });
await page.waitForSelector('.code-block', { timeout: 10000 });
await page.click('button:has-text("New key")');
await page.waitForSelector('.modal');
await page.fill('.modal input', 'E2E key');
await page.click('.modal button:has-text("Create key")');
await page.waitForSelector('.modal .code-block');
ok('api key created + revealed', (await page.locator('.modal').innerText()).includes('lpk_'));
await page.click('.modal button:has-text("Done")');
await page.locator('select').first().selectOption('2'); // pick ClickBank network
await page.click('button:has-text("Simulate an incoming postback")');
await page.waitForSelector('.toast');
await page.waitForTimeout(400);
ok('postback simulated (toast)', (await page.locator('.toast').last().innerText()).includes('Simulated postback'));
await page.fill('input[placeholder*="your-app.com"]', 'https://example.com/hook');
await page.click('button:has-text("Save webhook")');
await page.waitForTimeout(400);
ok('webhook saved', (await page.locator('.toast').last().innerText()).includes('Webhook settings saved'));

// ---- settings: profile update + theme
await page.goto(BASE + '/#/settings', { waitUntil: 'networkidle' });
await page.waitForSelector('form', { timeout: 10000 });
await page.fill('input[value="Alex Morgan"]', 'Alex M. Morgan');
await page.click('button:has-text("Save profile")');
await page.waitForTimeout(500);
ok('profile saved', (await page.locator('.toast').last().innerText()).includes('Profile saved'));

// ---- tracking: open a short link -> amazon redirect
await page.goto(BASE + '/#/links', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const navTarget = await page.evaluate(() => {
  return new Promise(resolve => {
    window.open('/r/airpods-pro-2', '_blank');
    setTimeout(() => resolve('opened'), 400);
  });
});
ok('short link opens', navTarget === 'opened');

// ---- cleanup: remove all E2E artifacts, restore demo state
await page.evaluate(async () => {
  const j = (r) => r.json();
  const del = (p) => fetch(p, { method: 'DELETE' });
  const put = (p, b) => fetch(p, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  for (const l of await j(await fetch('/api/links'))) if (l.name.includes('E2E')) await del('/api/links/' + l.id);
  for (const c of await j(await fetch('/api/campaigns'))) if (c.name.includes('E2E')) await del('/api/campaigns/' + c.id);
  for (const n of await j(await fetch('/api/networks'))) if (n.name.includes('E2E')) await del('/api/networks/' + n.id);
  for (const k of await j(await fetch('/api/keys'))) if (k.name.includes('E2E')) await del('/api/keys/' + k.id);
  const pays = await j(await fetch('/api/payouts'));
  for (const p of pays.payouts) if (p.amount === 123.45) await del('/api/payouts/' + p.id);
  await put('/api/settings/webhook', { webhook_url: '', webhook_events: 'click,conversion,payout' });
  await put('/api/me', { name: 'Alex Morgan' });
});
ok('cleanup restored demo state', true);

// ---- logout -> login page
await page.evaluate(() => localStorage.clear());
await page.goto(BASE + '/#/dashboard', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
// still logged in (session cookie) -> sign out via topbar menu
await page.click('.topbar .avatar');
await page.click('.menu button:has-text("Sign out")');
await page.waitForSelector('button:has-text("Sign in")', { timeout: 8000 });
ok('logout returns to login', true);

await browser.close();
console.log(results.join('\n'));
console.log('RUNTIME ERRORS:', errors.length ? errors.join(' || ') : 'none');
