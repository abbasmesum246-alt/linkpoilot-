import express from 'express';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { q, initDb, now, daysAgo, uniqueSlug, randomToken, logActivity, storage } from './lib/db.js';
import { seedDemoUser } from './lib/seed.js';
import { seedMarket } from './lib/market.js';
import { assistantReply } from './lib/assistant.js';
import { marketPulse, webSearch } from './lib/research.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const ON_VERCEL = !!process.env.VERCEL;

// inline pages (serverless-safe: no filesystem reads at runtime)
const INDEX_HTML = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LinkPilot — Affiliate Business Automation</title>
  <meta name="description" content="LinkPilot: track, automate and grow your affiliate business. Smart links, campaigns, networks and payouts in one dashboard." />
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%2310b981'/%3E%3Cstop offset='1' stop-color='%2322d3ee'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='64' height='64' rx='16' fill='url(%23g)'/%3E%3Cpath d='M20 32c4-10 8-16 12-16s8 6 12 16-8 16-12 16-8-6-12-16z' fill='%23052e22' opacity='.9' transform='rotate(45 32 32)'/%3E%3Ccircle cx='32' cy='32' r='6' fill='white'/%3E%3C/svg%3E" />
  <link rel="stylesheet" href="/app.css" />
</head>
<body>
  <div id="root"></div>
  <script src="/app.js"></script>
</body>
</html>`;

const NOTFOUND_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Link not found — LinkPilot</title><link rel="stylesheet" href="/app.css"><style>body{display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.box{text-align:center;max-width:400px;padding:40px}.box .code{font-size:72px;font-weight:800;background:linear-gradient(135deg,#10b981,#22d3ee);-webkit-background-clip:text;background-clip:text;color:transparent}.box h1{margin:8px 0;font-size:20px}.box p{color:var(--text-3);font-size:14px;line-height:1.6}</style></head>
<body><div class="box"><div class="code">404</div><h1>This tracking link doesn't exist</h1><p>The short link you clicked was removed or never existed. If you're the owner, check the Links page in your LinkPilot dashboard.</p></div></body></html>`;

const INACTIVE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Link paused — LinkPilot</title><link rel="stylesheet" href="/app.css"><style>body{display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.box{text-align:center;max-width:400px;padding:40px}.box .emoji{font-size:56px}.box h1{margin:10px 0 8px;font-size:20px}.box p{color:var(--text-3);font-size:14px;line-height:1.6}</style></head>
<body><div class="box"><div class="emoji">⏸️</div><h1>This link is paused</h1><p>The owner of this affiliate link has temporarily paused it. Please try again later.</p></div></body></html>`;

const DEMOVISIT_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Simulated click — LinkPilot Demo</title>
  <link rel="stylesheet" href="/app.css">
  <style>
    body { display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: var(--bg); }
    .box { max-width: 520px; padding: 40px 28px; text-align: center; }
    .badge { display: inline-flex; align-items: center; gap: 6px; background: var(--amber-soft); color: var(--amber); font-size: 11px; font-weight: 800; letter-spacing: 0.1em; padding: 4px 12px; border-radius: 99px; }
    .icon { width: 84px; height: 84px; border-radius: 50%; background: var(--accent-soft); display: flex; align-items: center; justify-content: center; margin: 22px auto; }
    .icon svg { width: 40px; height: 40px; color: var(--accent); }
    h1 { font-size: 21px; margin: 0 0 8px; letter-spacing: -0.02em; }
    p { color: var(--text-2); font-size: 14px; line-height: 1.65; margin: 0 0 14px; }
    .row { display: flex; gap: 10px; justify-content: center; margin-top: 22px; flex-wrap: wrap; }
    .meta { font-size: 11.5px; color: var(--text-3); font-family: ui-monospace, Menlo, monospace; margin-top: 22px; }
  </style>
</head>
<body>
  <div class="box">
    <div class="badge">DEMO WORKSPACE · SIMULATED VISIT</div>
    <div class="icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
    </div>
    <h1>Your click was tracked ✓</h1>
    <p>
      In a <b>real account</b>, this visitor would now be redirected to the merchant site
      (Amazon, ClickBank, etc.) and the affiliate cookie would be set.
    </p>
    <p>
      You're in the <b>guest demo workspace</b>, so the visit is simulated for practice —
      but it was still logged with referrer, country and device. Open the dashboard to see it.
    </p>
    <div class="row">
      <a class="btn btn-primary" href="/#/dashboard">Open dashboard</a>
      <a class="btn btn-secondary" href="/#/register">Create a real account</a>
    </div>
    <div class="meta">linkpilot demo tracking · click recorded</div>
  </div>
</body>
</html>`;

const SETUP_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Storage setup required — LinkPilot</title>
  <style>
    body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:#0a0d14; color:#e9edf6; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; }
    .card { max-width:560px; padding:40px 32px; background:#121828; border:1px solid rgba(148,163,197,.15); border-radius:18px; }
    h1 { font-size:20px; margin:0 0 6px; }
    .badge { display:inline-block; background:rgba(245,158,11,.15); color:#f59e0b; font-size:11px; font-weight:700; letter-spacing:.1em; padding:3px 10px; border-radius:99px; margin-bottom:14px; }
    p, li { color:#a6afc3; font-size:14px; line-height:1.7; }
    ol { padding-left:20px; }
    code { background:#1d253b; padding:2px 7px; border-radius:6px; color:#a5f3d0; font-size:13px; }
    .note { margin-top:18px; padding:12px 14px; border-radius:10px; background:rgba(59,130,246,.1); border:1px solid rgba(59,130,246,.25); font-size:13px; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">SETUP REQUIRED</span>
    <h1>LinkPilot needs cloud storage on Vercel</h1>
    <p>Vercel's filesystem is read-only, so LinkPilot uses <b>Turso</b> (free cloud SQLite) as its database.
    It looks like the database isn't connected yet.</p>
    <ol>
      <li>Open your project in the <b>Vercel dashboard → Integrations → Turso → Add</b></li>
      <li><b>Create database</b> (name it <code>linkpilot</code>) — Vercel injects the credentials automatically</li>
      <li>Or add them manually in <b>Settings → Environment Variables</b>:
        <ul>
          <li><code>TURSO_DATABASE_URL</code> — e.g. <code>libsql://linkpilot-&lt;you&gt;.turso.io</code></li>
          <li><code>TURSO_AUTH_TOKEN</code> — the database token</li>
        </ul>
      </li>
      <li><b>Redeploy</b> and refresh this page.</li>
    </ol>
    <div class="note">Full instructions are in the project README → <b>Deployment on Vercel</b>.
    This page is shown only because <code>TURSO_DATABASE_URL</code> is missing.</div>
  </div>
</body>
</html>`;
export function createApp() {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // lazy boot: open storage + seed (first request on serverless pays the seed cost once).
  // Concurrent cold starts (Vercel) are safe — both seeders tolerate races.
  const ready = initDb()
    .then(() => Promise.all([seedDemoUser(), seedMarket()]))
    .catch((e) => console.error('[boot]', e.message));

  app.use(async (req, res, next) => {
    // storage not configured (e.g. Vercel without Turso) → show a clear setup page, not a 500
    if (storage.error) {
      if (req.path === '/api/health') {
        return res.status(503).json({
          ok: false, service: 'linkpilot', setup_required: true,
          hint: 'Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (Turso) in your Vercel environment variables.',
          error: storage.error,
        });
      }
      if (!req.path.startsWith('/api')) {
        res.status(503).setHeader('Content-Type', 'text/html');
        return res.send(SETUP_HTML);
      }
      return res.status(503).json({ error: 'Storage unavailable. Set TURSO_DATABASE_URL / TURSO_AUTH_TOKEN (see README → Deployment on Vercel).' });
    }
    try { await ready; next(); } catch (e) { next(e); }
  });

  // helpers
  const SESSION_COOKIE = 'lp_session';

  async function setSession(res, userId) {
    const token = randomToken(32);
    await q.run('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)',
      token, userId, now(), daysAgo(-30));
    const secure = ON_VERCEL ? '; Secure' : '';
    res.setHeader('Set-Cookie',
      `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${30 * 86400}`);
    return token;
  }

  async function auth(req, res, next) {
    try {
      const raw = req.headers.cookie || '';
      const m = raw.split(';').map(c => c.trim()).find(c => c.startsWith(`${SESSION_COOKIE}=`));
      if (!m) return res.status(401).json({ error: 'Not authenticated' });
      const token = m.slice(SESSION_COOKIE.length + 1);
      const sess = await q.get('SELECT * FROM sessions WHERE token = ?', token);
      if (!sess || new Date(sess.expires_at) < new Date()) {
        return res.status(401).json({ error: 'Session expired' });
      }
      req.user = { id: sess.user_id };
      next();
    } catch (e) { next(e); }
  }

  const wrap = (fn) => (req, res) => {
    Promise.resolve()
      .then(() => fn(req, res))
      .catch((e) => {
        console.error('[error]', req.method, req.path, e.message);
        if (!res.headersSent) res.status(500).json({ error: e.message || 'Server error' });
      });
  };

  async function bodyUser(req) {
    return await q.get('SELECT id, name, email, company, role, is_demo, created_at FROM users WHERE id = ?', req.user.id);
  }

  function clean(s) { return (s == null ? '' : String(s).trim()); }

  function parseDevice(ua = '') {
    if (/Mobi|Android|iPhone|iPad/i.test(ua)) return 'mobile';
    if (/Tablet|iPad/i.test(ua)) return 'tablet';
    return 'desktop';
  }

  function parseCountry(req) {
    const al = req.headers['accept-language'] || '';
    const m = al.match(/[a-zA-Z-]+$/);
    if (m) {
      const map = {
        us: 'United States', gb: 'United Kingdom', uk: 'United Kingdom', de: 'Germany',
        ca: 'Canada', au: 'Australia', in: 'India', pk: 'Pakistan', br: 'Brazil',
        fr: 'France', nl: 'Netherlands', es: 'Spain', sg: 'Singapore', ae: 'UAE',
        it: 'Italy', jp: 'Japan', pl: 'Poland', se: 'Sweden', mx: 'Mexico', tr: 'Türkiye',
      };
      const c = m[0].toLowerCase();
      if (map[c]) return map[c];
    }
    return 'Unknown';
  }

  async function logClick(link, req, extra = {}) {
    const ref = extra.referrer || (req.headers.referer ? new URL(req.headers.referer).hostname : (req.query.utm_source || 'Direct'));
    await q.run(`INSERT INTO clicks (link_id, user_id, referrer, country, device, converted, revenue, created_at) VALUES (?,?,?,?,?,?,?,?)`,
      link.id, link.user_id, String(ref).slice(0, 120), extra.country || parseCountry(req),
      extra.device || parseDevice(req.headers['user-agent']), extra.converted ? 1 : 0,
      extra.revenue || 0, extra.created_at || now());
  }

  // auth
  app.get('/api/health', wrap(async (req, res) => {
    res.json({ ok: true, service: 'linkpilot', time: now(), uptime: Math.round(process.uptime()), storage: storage.mode, storage_url: storage.url });
  }));

  app.post('/api/auth/guest', wrap(async (req, res) => {
    await seedDemoUser();
    await q.run("UPDATE users SET is_demo = 1 WHERE email = 'demo@linkpilot.app'");
    const u = await q.get("SELECT * FROM users WHERE email = 'demo@linkpilot.app'");
    await setSession(res, u.id);
    res.json({ user: { id: u.id, name: u.name, email: u.email, company: u.company, role: u.role, is_demo: 1, created_at: u.created_at } });
  }));

  app.post('/api/auth/register', wrap(async (req, res) => {
    const { name, email, password, company } = req.body || {};
    if (!clean(name) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean(email))) {
      return res.status(400).json({ error: 'Please provide a valid name and email.' });
    }
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const exists = await q.get('SELECT id FROM users WHERE email = ?', clean(email).toLowerCase());
    if (exists) return res.status(409).json({ error: 'An account with this email already exists.' });
    const hash = bcrypt.hashSync(password, 10);
    const r = await q.run(`INSERT INTO users (name, email, password_hash, company, created_at) VALUES (?,?,?,?,?)`,
      clean(name), clean(email).toLowerCase(), hash, clean(company), now());
    await q.run('INSERT INTO settings (user_id, webhook_url, webhook_secret, webhook_events, created_at) VALUES (?,?,?,?,?)',
      r.lastInsertRowid, '', '', 'click,conversion,payout', now());
    await logActivity(r.lastInsertRowid, 'info', `Welcome to LinkPilot, ${clean(name).split(' ')[0]}! Create your first affiliate link to start tracking.`);
    await setSession(res, r.lastInsertRowid);
    res.json({ user: await q.get('SELECT id, name, email, company, role, is_demo, created_at FROM users WHERE id = ?', r.lastInsertRowid) });
  }));

  app.post('/api/auth/login', wrap(async (req, res) => {
    const { email, password } = req.body || {};
    const u = await q.get('SELECT * FROM users WHERE email = ?', clean(email).toLowerCase());
    if (!u || !bcrypt.compareSync(password || '', u.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    await setSession(res, u.id);
    res.json({ user: { id: u.id, name: u.name, email: u.email, company: u.company, role: u.role, is_demo: !!u.is_demo, created_at: u.created_at } });
  }));

  app.post('/api/auth/logout', wrap(async (req, res) => {
    const raw = req.headers.cookie || '';
    const m = raw.split(';').map(c => c.trim()).find(c => c.startsWith(`${SESSION_COOKIE}=`));
    if (m) await q.run('DELETE FROM sessions WHERE token = ?', m.slice(SESSION_COOKIE.length + 1));
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; Max-Age=0`);
    res.json({ ok: true });
  }));

  app.get('/api/auth/me', auth, wrap(async (req, res) => res.json({ user: await bodyUser(req) })));

  // stats
  const LINK_STATS_BASE = `
    SELECT l.*, n.name AS network_name, n.color AS network_color, c.name AS campaign_name,
      COALESCE(SUM(CASE WHEN k.created_at >= ? THEN 1 ELSE 0 END), 0) AS clicks_recent,
      COALESCE(SUM(CASE WHEN k.created_at >= ? AND k.converted = 1 THEN 1 ELSE 0 END), 0) AS conversions_recent,
      COALESCE(SUM(CASE WHEN k.created_at >= ? THEN k.revenue ELSE 0 END), 0) AS revenue_recent,
      (SELECT COUNT(*) FROM clicks k2 WHERE k2.link_id = l.id) AS clicks_total
    FROM links l
    LEFT JOIN networks n ON n.id = l.network_id
    LEFT JOIN campaigns c ON c.id = l.campaign_id
    LEFT JOIN clicks k ON k.link_id = l.id`;

  async function linksWithStats(userId, days = 30, extraWhere = '', params = []) {
    const since = daysAgo(days);
    const rows = await q.all(`${LINK_STATS_BASE} WHERE l.user_id = ? ${extraWhere} GROUP BY l.id ORDER BY l.updated_at DESC`,
      since, since, since, userId, ...params);
    return rows.map(l => ({ ...l, clicks_recent: +l.clicks_recent, conversions_recent: +l.conversions_recent, revenue_recent: Math.round(+l.revenue_recent * 100) / 100, clicks_total: +l.clicks_total }));
  }

  app.get('/api/stats/overview', auth, wrap(async (req, res) => {
    const days = Math.min(365, Math.max(7, parseInt(req.query.days) || 30));
    const since = daysAgo(days), prevSince = daysAgo(days * 2);
    const uid = req.user.id;
    const agg = async (from) => await q.get(`
      SELECT COUNT(*) clicks, COALESCE(SUM(converted),0) conversions, COALESCE(SUM(revenue),0) revenue
      FROM clicks WHERE user_id = ? AND created_at >= ? AND created_at < ?`, uid, from, from === since ? now() : since);
    const cur = await agg(since), prev = await agg(prevSince);
    const activeLinks = +((await q.get(`SELECT COUNT(*) n FROM links WHERE user_id = ? AND status = 'active'`, uid))?.n || 0);
    const totalLinks = +((await q.get(`SELECT COUNT(*) n FROM links WHERE user_id = ?`, uid))?.n || 0);
    const pendingPayouts = +((await q.get(`SELECT COUNT(*) n FROM payouts WHERE user_id = ? AND status != 'paid'`, uid))?.n || 0);
    const networks = +((await q.get(`SELECT COUNT(*) n FROM networks WHERE user_id = ?`, uid))?.n || 0);
    const epc = cur.clicks ? cur.revenue / cur.clicks : 0;
    res.json({
      revenue: Math.round(cur.revenue * 100) / 100,
      revenuePrev: Math.round(prev.revenue * 100) / 100,
      clicks: +cur.clicks, clicksPrev: +prev.clicks,
      conversions: +cur.conversions, conversionsPrev: +prev.conversions,
      cr: cur.clicks ? (cur.conversions / cur.clicks) * 100 : 0,
      crPrev: prev.clicks ? (prev.conversions / prev.clicks) * 100 : 0,
      epc, epcPrev: prev.clicks ? prev.revenue / prev.clicks : 0,
      activeLinks, totalLinks, pendingPayouts, networks, days,
    });
  }));

  app.get('/api/stats/timeseries', auth, wrap(async (req, res) => {
    const days = Math.min(365, Math.max(7, parseInt(req.query.days) || 30));
    const since = daysAgo(days);
    const rows = await q.all(`
      SELECT substr(created_at, 1, 10) d,
        COUNT(*) clicks, COALESCE(SUM(converted),0) conversions, COALESCE(SUM(revenue),0) revenue
      FROM clicks WHERE user_id = ? AND created_at >= ?
      GROUP BY d ORDER BY d`, req.user.id, since);
    const map = Object.fromEntries(rows.map(r => [r.d, r]));
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const r = map[d];
      out.push({ date: d, clicks: r ? +r.clicks : 0, conversions: r ? +r.conversions : 0, revenue: r ? Math.round(+r.revenue * 100) / 100 : 0 });
    }
    res.json(out);
  }));

  app.get('/api/stats/referrers', auth, wrap(async (req, res) => {
    const days = Math.min(90, Math.max(7, parseInt(req.query.days) || 30));
    const rows = await q.all(`
      SELECT referrer, COUNT(*) clicks, COALESCE(SUM(converted),0) conversions, COALESCE(SUM(revenue),0) revenue
      FROM clicks WHERE user_id = ? AND created_at >= ? GROUP BY referrer ORDER BY clicks DESC LIMIT 12`,
      req.user.id, daysAgo(days));
    res.json(rows.map(r => ({ ...r, clicks: +r.clicks, conversions: +r.conversions, revenue: Math.round(+r.revenue * 100) / 100 })));
  }));

  app.get('/api/stats/network-share', auth, wrap(async (req, res) => {
    const days = Math.min(90, Math.max(7, parseInt(req.query.days) || 30));
    const rows = await q.all(`
      SELECT COALESCE(n.name, 'No network') name, COALESCE(n.color, '#64748b') color,
        COUNT(k.id) clicks, COALESCE(SUM(k.converted),0) conversions, COALESCE(SUM(k.revenue),0) revenue
      FROM clicks k LEFT JOIN links l ON l.id = k.link_id LEFT JOIN networks n ON n.id = l.network_id
      WHERE k.user_id = ? AND k.created_at >= ?
      GROUP BY COALESCE(n.name,'No network') ORDER BY revenue DESC`, req.user.id, daysAgo(days));
    res.json(rows.map(r => ({ ...r, clicks: +r.clicks, conversions: +r.conversions, revenue: Math.round(+r.revenue * 100) / 100 })));
  }));

  app.get('/api/activity', auth, wrap(async (req, res) => {
    const rows = await q.all('SELECT * FROM activity WHERE user_id = ? ORDER BY id DESC LIMIT ?',
      req.user.id, Math.min(100, parseInt(req.query.limit) || 25));
    res.json(rows);
  }));

  // links
  app.get('/api/links', auth, wrap(async (req, res) => {
    const { q: search, network, campaign, status } = req.query;
    let where = '', params = [];
    if (search) { where += ` AND (l.name LIKE ? OR l.slug LIKE ? OR l.destination_url LIKE ?)`; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (network) { where += ` AND l.network_id = ?`; params.push(+network); }
    if (campaign) { where += ` AND l.campaign_id = ?`; params.push(+campaign); }
    if (status && status !== 'all') { where += ` AND l.status = ?`; params.push(status); }
    res.json(await linksWithStats(req.user.id, 30, where, params));
  }));

  app.get('/api/links/export', auth, wrap(async (req, res) => {
    const rows = await linksWithStats(req.user.id, 30);
    const head = ['Name', 'Slug', 'Destination URL', 'Network', 'Campaign', 'Status', 'Clicks (30d)', 'Conversions (30d)', 'Revenue (30d)'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [head.join(',')].concat(rows.map(r => [r.name, r.slug, r.destination_url, r.network_name || '', r.campaign_name || '', r.status, r.clicks_recent, r.conversions_recent, r.revenue_recent.toFixed(2)].map(esc).join(','))).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="linkpilot-links.csv"');
    res.send('\uFEFF' + csv);
  }));

  async function validateLinkPayload(body) {
    const { name, destination_url, slug, network_id, campaign_id, status, note } = body || {};
    if (!clean(name)) return { error: 'Link name is required.' };
    let url = clean(destination_url);
    if (!/^https?:\/\/.+\..+/.test(url)) return { error: 'Destination URL must be a full URL starting with http(s)://' };
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    if (slug && !/^[a-z0-9][a-z0-9-_]*$/i.test(clean(slug))) return { error: 'Slug may only contain letters, numbers, dashes and underscores.' };
    if (slug && await q.get('SELECT 1 FROM links WHERE slug = ?', clean(slug).toLowerCase())) return { error: 'That custom slug is already taken.' };
    return { data: { name: clean(name), destination_url: url, slug: clean(slug).toLowerCase(), network_id: network_id ? +network_id : null, campaign_id: campaign_id ? +campaign_id : null, status: status || 'active', note: clean(note) } };
  }

  app.post('/api/links', auth, wrap(async (req, res) => {
    const v = await validateLinkPayload(req.body);
    if (v.error) return res.status(400).json({ error: v.error });
    const d = v.data;
    const slug = d.slug || await uniqueSlug(d.name);
    const r = await q.run(`INSERT INTO links (user_id, network_id, campaign_id, name, slug, destination_url, status, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      req.user.id, d.network_id, d.campaign_id, d.name, slug, d.destination_url, d.status, d.note, now(), now());
    await logActivity(req.user.id, 'link', `New link "${d.name}" created`);
    res.json((await linksWithStats(req.user.id, 30, ' AND l.id = ?', [r.lastInsertRowid]))[0]);
  }));

  app.put('/api/links/:id', auth, wrap(async (req, res) => {
    const link = await q.get('SELECT * FROM links WHERE id = ? AND user_id = ?', +req.params.id, req.user.id);
    if (!link) return res.status(404).json({ error: 'Link not found' });
    const merged = {
      name: req.body.name !== undefined ? req.body.name : link.name,
      destination_url: req.body.destination_url !== undefined ? req.body.destination_url : link.destination_url,
      slug: null,
      network_id: req.body.network_id !== undefined ? req.body.network_id : link.network_id,
      campaign_id: req.body.campaign_id !== undefined ? req.body.campaign_id : link.campaign_id,
      status: req.body.status || link.status,
      note: req.body.note !== undefined ? req.body.note : link.note,
    };
    const v = await validateLinkPayload(merged);
    if (v.error) return res.status(400).json({ error: v.error });
    const d = v.data;
    const network_id = req.body.network_id === '' ? null : (d.network_id != null ? d.network_id : link.network_id);
    const campaign_id = req.body.campaign_id === '' ? null : (d.campaign_id != null ? d.campaign_id : link.campaign_id);
    await q.run(`UPDATE links SET name=?, destination_url=?, network_id=?, campaign_id=?, status=?, note=?, updated_at=? WHERE id=?`,
      d.name, d.destination_url, network_id, campaign_id, d.status, d.note, now(), link.id);
    await logActivity(req.user.id, 'link', `Link "${d.name}" updated`);
    res.json((await linksWithStats(req.user.id, 30, ' AND l.id = ?', [link.id]))[0]);
  }));

  app.delete('/api/links/:id', auth, wrap(async (req, res) => {
    const link = await q.get('SELECT * FROM links WHERE id = ? AND user_id = ?', +req.params.id, req.user.id);
    if (!link) return res.status(404).json({ error: 'Link not found' });
    await q.run('DELETE FROM clicks WHERE link_id = ?', link.id);
    await q.run('DELETE FROM links WHERE id = ?', link.id);
    await logActivity(req.user.id, 'link', `Link "${link.name}" deleted`);
    res.json({ ok: true });
  }));

  app.get('/api/links/:id/stats', auth, wrap(async (req, res) => {
    const days = Math.min(180, Math.max(7, parseInt(req.query.days) || 30));
    const link = await q.get('SELECT * FROM links WHERE id = ? AND user_id = ?', +req.params.id, req.user.id);
    if (!link) return res.status(404).json({ error: 'Link not found' });
    const since = daysAgo(days);
    const series = await q.all(`
      SELECT substr(created_at, 1, 10) d, COUNT(*) clicks, COALESCE(SUM(converted),0) conversions, COALESCE(SUM(revenue),0) revenue
      FROM clicks WHERE link_id = ? AND created_at >= ? GROUP BY d ORDER BY d`, link.id, since);
    const refs = await q.all(`SELECT referrer, COUNT(*) clicks FROM clicks WHERE link_id = ? AND created_at >= ? GROUP BY referrer ORDER BY clicks DESC LIMIT 8`, link.id, since);
    const countries = await q.all(`SELECT country, COUNT(*) clicks FROM clicks WHERE link_id = ? AND created_at >= ? GROUP BY country ORDER BY clicks DESC LIMIT 8`, link.id, since);
    const devices = await q.all(`SELECT device, COUNT(*) clicks FROM clicks WHERE link_id = ? AND created_at >= ? GROUP BY device ORDER BY clicks DESC`, link.id, since);
    const totals = await q.get(`SELECT COUNT(*) clicks, COALESCE(SUM(converted),0) conversions, COALESCE(SUM(revenue),0) revenue FROM clicks WHERE link_id = ? AND created_at >= ?`, link.id, since);
    res.json({
      series: series.map(r => ({ date: r.d, clicks: +r.clicks, conversions: +r.conversions, revenue: Math.round(+r.revenue * 100) / 100 })),
      referrers: refs.map(r => ({ name: r.referrer, clicks: +r.clicks })),
      countries: countries.map(r => ({ name: r.country, clicks: +r.clicks })),
      devices: devices.map(r => ({ name: r.device, clicks: +r.clicks })),
      totals: { clicks: +totals.clicks, conversions: +totals.conversions, revenue: Math.round(+totals.revenue * 100) / 100, days },
    });
  }));

  app.post('/api/links/:id/test-click', auth, wrap(async (req, res) => {
    const link = await q.get('SELECT * FROM links WHERE id = ? AND user_id = ?', +req.params.id, req.user.id);
    if (!link) return res.status(404).json({ error: 'Link not found' });
    await logClick(link, req, { referrer: 'Manual test', country: 'Unknown', device: 'desktop' });
    res.json({ ok: true });
  }));

  // campaigns
  async function campaignWithStats(row) {
    const stats = await q.get(`
      SELECT COUNT(DISTINCT l.id) link_count,
        COALESCE(SUM(CASE WHEN k.created_at >= ? THEN 1 ELSE 0 END),0) clicks,
        COALESCE(SUM(CASE WHEN k.created_at >= ? AND k.converted=1 THEN 1 ELSE 0 END),0) conversions,
        COALESCE(SUM(CASE WHEN k.created_at >= ? THEN k.revenue ELSE 0 END),0) revenue
      FROM links l LEFT JOIN clicks k ON k.link_id = l.id
      WHERE l.campaign_id = ?`, daysAgo(30), daysAgo(30), daysAgo(30), row.id);
    const link_ids = (await q.all('SELECT id FROM links WHERE campaign_id = ?', row.id)).map(r => r.id);
    return { ...row, link_ids, link_count: +stats.link_count, clicks_recent: +stats.clicks, conversions_recent: +stats.conversions, revenue_recent: Math.round(+stats.revenue * 100) / 100 };
  }

  app.get('/api/campaigns', auth, wrap(async (req, res) => {
    const rows = await q.all('SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC', req.user.id);
    res.json(await Promise.all(rows.map(r => campaignWithStats(r))));
  }));

  app.post('/api/campaigns', auth, wrap(async (req, res) => {
    const { name, description, status, budget, color, starts_at, ends_at, link_ids } = req.body || {};
    if (!clean(name)) return res.status(400).json({ error: 'Campaign name is required.' });
    const r = await q.run(`INSERT INTO campaigns (user_id, name, description, status, budget, color, starts_at, ends_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
      req.user.id, clean(name), clean(description), status || 'active', +budget || 0, color || '#6366f1', clean(starts_at) || null, clean(ends_at) || null, now());
    if (Array.isArray(link_ids) && link_ids.length) {
      for (const id of link_ids) await q.run('UPDATE links SET campaign_id = ?, updated_at = ? WHERE id = ? AND user_id = ?', r.lastInsertRowid, now(), +id, req.user.id);
    }
    await logActivity(req.user.id, 'campaign', `Campaign "${clean(name)}" created`);
    res.json(await campaignWithStats(await q.get('SELECT * FROM campaigns WHERE id = ?', r.lastInsertRowid)));
  }));

  app.put('/api/campaigns/:id', auth, wrap(async (req, res) => {
    const camp = await q.get('SELECT * FROM campaigns WHERE id = ? AND user_id = ?', +req.params.id, req.user.id);
    if (!camp) return res.status(404).json({ error: 'Campaign not found' });
    const d = req.body || {};
    await q.run(`UPDATE campaigns SET name=?, description=?, status=?, budget=?, color=?, starts_at=?, ends_at=? WHERE id=?`,
      clean(d.name) || camp.name, clean(d.description) || camp.description, d.status || camp.status,
      d.budget != null ? +d.budget : camp.budget, d.color || camp.color,
      d.starts_at !== undefined ? clean(d.starts_at) || null : camp.starts_at,
      d.ends_at !== undefined ? clean(d.ends_at) || null : camp.ends_at, camp.id);
    if (Array.isArray(d.link_ids)) {
      await q.run('UPDATE links SET campaign_id = NULL, updated_at = ? WHERE campaign_id = ? AND user_id = ?', now(), camp.id, req.user.id);
      for (const id of d.link_ids) await q.run('UPDATE links SET campaign_id = ?, updated_at = ? WHERE id = ? AND user_id = ?', camp.id, now(), +id, req.user.id);
    }
    await logActivity(req.user.id, 'campaign', `Campaign "${camp.name}" updated`);
    res.json(await campaignWithStats(await q.get('SELECT * FROM campaigns WHERE id = ?', camp.id)));
  }));

  app.delete('/api/campaigns/:id', auth, wrap(async (req, res) => {
    const camp = await q.get('SELECT * FROM campaigns WHERE id = ? AND user_id = ?', +req.params.id, req.user.id);
    if (!camp) return res.status(404).json({ error: 'Campaign not found' });
    await q.run('UPDATE links SET campaign_id = NULL WHERE campaign_id = ?', camp.id);
    await q.run('DELETE FROM campaigns WHERE id = ?', camp.id);
    await logActivity(req.user.id, 'campaign', `Campaign "${camp.name}" deleted`);
    res.json({ ok: true });
  }));

  // networks
  async function networkWithStats(row) {
    const s = await q.get(`
      SELECT COUNT(DISTINCT l.id) link_count,
        COALESCE(SUM(CASE WHEN k.created_at >= ? THEN 1 ELSE 0 END),0) clicks,
        COALESCE(SUM(CASE WHEN k.created_at >= ? AND k.converted=1 THEN 1 ELSE 0 END),0) conversions,
        COALESCE(SUM(CASE WHEN k.created_at >= ? THEN k.revenue ELSE 0 END),0) revenue
      FROM links l LEFT JOIN clicks k ON k.link_id = l.id WHERE l.network_id = ?`, daysAgo(30), daysAgo(30), daysAgo(30), row.id);
    const paid = +(await q.get(`SELECT COALESCE(SUM(amount),0) s FROM payouts WHERE network_id = ? AND status = 'paid'`, row.id)).s;
    const pending = +(await q.get(`SELECT COALESCE(SUM(amount),0) s FROM payouts WHERE network_id = ? AND status != 'paid'`, row.id)).s;
    const lifetime = +(await q.get(`
      SELECT COALESCE(SUM(k.revenue),0) s FROM clicks k JOIN links l ON l.id = k.link_id WHERE l.network_id = ?`, row.id)).s;
    return {
      ...row, link_count: +s.link_count, clicks_recent: +s.clicks, conversions_recent: +s.conversions,
      revenue_recent: Math.round(+s.revenue * 100) / 100, paid: Math.round(paid * 100) / 100,
      pending: Math.round(pending * 100) / 100, lifetime_revenue: Math.round(lifetime * 100) / 100,
    };
  }

  app.get('/api/networks', auth, wrap(async (req, res) => {
    const rows = await q.all('SELECT * FROM networks WHERE user_id = ? ORDER BY created_at ASC', req.user.id);
    res.json(await Promise.all(rows.map(r => networkWithStats(r))));
  }));

  app.post('/api/networks', auth, wrap(async (req, res) => {
    const { name, color, commission_rate, cookie_days, status, notes } = req.body || {};
    if (!clean(name)) return res.status(400).json({ error: 'Network name is required.' });
    const r = await q.run(`INSERT INTO networks (user_id, name, color, commission_rate, cookie_days, status, notes, created_at) VALUES (?,?,?,?,?,?,?,?)`,
      req.user.id, clean(name), color || '#6366f1', +commission_rate || 0, +cookie_days || 30, status || 'active', clean(notes), now());
    await logActivity(req.user.id, 'network', `Network "${clean(name)}" connected`);
    res.json(await networkWithStats(await q.get('SELECT * FROM networks WHERE id = ?', r.lastInsertRowid)));
  }));

  app.put('/api/networks/:id', auth, wrap(async (req, res) => {
    const n = await q.get('SELECT * FROM networks WHERE id = ? AND user_id = ?', +req.params.id, req.user.id);
    if (!n) return res.status(404).json({ error: 'Network not found' });
    const d = req.body || {};
    await q.run(`UPDATE networks SET name=?, color=?, commission_rate=?, cookie_days=?, status=?, notes=? WHERE id=?`,
      clean(d.name) || n.name, d.color || n.color, d.commission_rate != null ? +d.commission_rate : n.commission_rate,
      d.cookie_days != null ? +d.cookie_days : n.cookie_days, d.status || n.status, d.notes !== undefined ? clean(d.notes) : n.notes, n.id);
    await logActivity(req.user.id, 'network', `Network "${n.name}" updated`);
    res.json(await networkWithStats(await q.get('SELECT * FROM networks WHERE id = ?', n.id)));
  }));

  app.delete('/api/networks/:id', auth, wrap(async (req, res) => {
    const n = await q.get('SELECT * FROM networks WHERE id = ? AND user_id = ?', +req.params.id, req.user.id);
    if (!n) return res.status(404).json({ error: 'Network not found' });
    await q.run('UPDATE links SET network_id = NULL WHERE network_id = ?', n.id);
    await q.run('DELETE FROM networks WHERE id = ?', n.id);
    await logActivity(req.user.id, 'network', `Network "${n.name}" removed`);
    res.json({ ok: true });
  }));

  // payouts
  app.get('/api/payouts', auth, wrap(async (req, res) => {
    const { status } = req.query;
    let where = 'WHERE p.user_id = ?', params = [req.user.id];
    if (status && status !== 'all') { where += ' AND p.status = ?'; params.push(status); }
    const rows = await q.all(`
      SELECT p.*, n.name network_name, n.color network_color FROM payouts p
      LEFT JOIN networks n ON n.id = p.network_id ${where} ORDER BY p.requested_at DESC`, ...params);
    const summary = await q.get(`
      SELECT COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),0) paid,
        COALESCE(SUM(CASE WHEN status!='paid' THEN amount ELSE 0 END),0) pending
      FROM payouts WHERE user_id = ?`, req.user.id);
    res.json({ payouts: rows, paid: Math.round(+summary.paid * 100) / 100, pending: Math.round(+summary.pending * 100) / 100 });
  }));

  app.post('/api/payouts', auth, wrap(async (req, res) => {
    const { network_id, amount, method, status, reference, notes, requested_at } = req.body || {};
    if (!network_id) return res.status(400).json({ error: 'Select a network for this payout.' });
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: 'Enter a valid payout amount.' });
    const st = status || 'pending';
    const r = await q.run(`INSERT INTO payouts (user_id, network_id, amount, status, method, reference, notes, requested_at, paid_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      req.user.id, +network_id, Math.round(amt * 100) / 100, st, clean(method) || 'Bank transfer', clean(reference), clean(notes),
      clean(requested_at) || now(), st === 'paid' ? now() : null, now());
    await logActivity(req.user.id, 'payout', `Payout of $${amt.toFixed(2)} requested`);
    res.json(await q.get(`SELECT p.*, n.name network_name, n.color network_color FROM payouts p LEFT JOIN networks n ON n.id = p.network_id WHERE p.id = ?`, r.lastInsertRowid));
  }));

  app.put('/api/payouts/:id', auth, wrap(async (req, res) => {
    const p = await q.get('SELECT * FROM payouts WHERE id = ? AND user_id = ?', +req.params.id, req.user.id);
    if (!p) return res.status(404).json({ error: 'Payout not found' });
    const d = req.body || {};
    const status = d.status || p.status;
    const paid_at = status === 'paid' ? (p.paid_at || now()) : null;
    await q.run(`UPDATE payouts SET network_id=?, amount=?, status=?, method=?, reference=?, notes=?, requested_at=?, paid_at=? WHERE id=?`,
      d.network_id ? +d.network_id : p.network_id, d.amount != null ? Math.round(+d.amount * 100) / 100 : p.amount,
      status, clean(d.method) || p.method, d.reference !== undefined ? clean(d.reference) : p.reference,
      d.notes !== undefined ? clean(d.notes) : p.notes, clean(d.requested_at) || p.requested_at, paid_at, p.id);
    if (status === 'paid' && p.status !== 'paid') {
      await logActivity(req.user.id, 'success', `Payout of $${(+p.amount).toFixed(2)} marked as paid`);
    } else if (status !== 'paid' && p.status === 'paid') {
      await logActivity(req.user.id, 'warning', `Payout of $${(+p.amount).toFixed(2)} reopened`);
    } else {
      await logActivity(req.user.id, 'payout', `Payout updated (${status})`);
    }
    res.json(await q.get(`SELECT p.*, n.name network_name, n.color network_color FROM payouts p LEFT JOIN networks n ON n.id = p.network_id WHERE p.id = ?`, p.id));
  }));

  app.delete('/api/payouts/:id', auth, wrap(async (req, res) => {
    const p = await q.get('SELECT * FROM payouts WHERE id = ? AND user_id = ?', +req.params.id, req.user.id);
    if (!p) return res.status(404).json({ error: 'Payout not found' });
    await q.run('DELETE FROM payouts WHERE id = ?', p.id);
    await logActivity(req.user.id, 'payout', `Payout of $${(+p.amount).toFixed(2)} deleted`);
    res.json({ ok: true });
  }));

  // api keys
  app.get('/api/keys', auth, wrap(async (req, res) => {
    res.json(await q.all('SELECT id, name, key, created_at, last_used_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC', req.user.id));
  }));

  app.post('/api/keys', auth, wrap(async (req, res) => {
    const name = clean((req.body || {}).name) || 'Untitled key';
    const key = 'lpk_' + randomToken(20);
    const r = await q.run('INSERT INTO api_keys (user_id, name, key, created_at) VALUES (?,?,?,?)', req.user.id, name, key, now());
    await logActivity(req.user.id, 'key', `API key "${name}" created`);
    res.json(await q.get('SELECT id, name, key, created_at, last_used_at FROM api_keys WHERE id = ?', r.lastInsertRowid));
  }));

  app.delete('/api/keys/:id', auth, wrap(async (req, res) => {
    const k = await q.get('SELECT * FROM api_keys WHERE id = ? AND user_id = ?', +req.params.id, req.user.id);
    if (!k) return res.status(404).json({ error: 'Key not found' });
    await q.run('DELETE FROM api_keys WHERE id = ?', k.id);
    await logActivity(req.user.id, 'key', `API key "${k.name}" revoked`);
    res.json({ ok: true });
  }));

  // webhooks
  app.get('/api/settings/webhook', auth, wrap(async (req, res) => {
    const s = await q.get('SELECT webhook_url, webhook_events FROM settings WHERE user_id = ?', req.user.id) || { webhook_url: '', webhook_events: 'click,conversion,payout' };
    res.json(s);
  }));

  app.put('/api/settings/webhook', auth, wrap(async (req, res) => {
    const { webhook_url, webhook_events } = req.body || {};
    await q.run(`INSERT INTO settings (user_id, webhook_url, webhook_events, created_at) VALUES (?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET webhook_url = excluded.webhook_url, webhook_events = excluded.webhook_events`,
      req.user.id, clean(webhook_url), clean(webhook_events) || 'click,conversion,payout', now());
    await logActivity(req.user.id, 'info', 'Webhook settings updated');
    res.json({ ok: true });
  }));

  app.post('/api/settings/webhook/test', auth, wrap(async (req, res) => {
    const s = await q.get('SELECT webhook_url FROM settings WHERE user_id = ?', req.user.id);
    if (!s || !s.webhook_url) return res.status(400).json({ error: 'No webhook URL configured.' });
    const payload = {
      event: 'test', message: 'Webhook test from LinkPilot', user_id: req.user.id, timestamp: now(),
      sample: { link: 'airpods-pro-2', click_id: randomToken(6), revenue: 9.96 },
    };
    const user = await q.get('SELECT is_demo FROM users WHERE id = ?', req.user.id);
    if (user?.is_demo) {
      return res.json({ ok: true, status: 200, simulated: true });
    }
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(s.webhook_url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ctrl.signal });
      clearTimeout(t);
      res.json({ ok: r.ok, status: r.status });
    } catch (e) {
      res.json({ ok: false, status: 0, error: e.message });
    }
  }));

  app.post('/api/integrations/simulate', auth, wrap(async (req, res) => {
    const { network_id, link_id, amount } = req.body || {};
    let link;
    if (link_id) link = await q.get('SELECT * FROM links WHERE id = ? AND user_id = ?', +link_id, req.user.id);
    if (!link && network_id) link = await q.get('SELECT * FROM links WHERE network_id = ? AND user_id = ? ORDER BY id LIMIT 1', +network_id, req.user.id);
    if (!link) return res.status(404).json({ error: 'No link found for that network. Create one first.' });
    const rev = amount ? +amount : +(Math.random() * 20 + 8).toFixed(2);
    await q.run(`INSERT INTO clicks (link_id, user_id, referrer, country, device, converted, revenue, created_at) VALUES (?,?,?,?,?,1,?,?)`,
      link.id, req.user.id, 'Network postback', 'Unknown', 'desktop', rev, now());
    const n = link.network_id ? await q.get('SELECT name FROM networks WHERE id = ?', link.network_id) : null;
    await logActivity(req.user.id, 'success', `Postback received${n ? ' from ' + n.name : ''} — "${link.name}" (+$${rev.toFixed(2)})`);
    res.json({ ok: true, link: link.name, revenue: rev });
  }));

  // market
  app.get('/api/types', auth, wrap(async (req, res) => {
    const types = await q.all(`
      SELECT t.*, COUNT(p.id) AS program_count
      FROM affiliate_types t LEFT JOIN programs p ON p.type_slug = t.slug
      GROUP BY t.id ORDER BY t.sort`);
    res.json(types.map(t => ({
      ...t,
      program_count: +t.program_count,
      features: JSON.parse(t.features || '[]'),
      tips: JSON.parse(t.tips || '[]'),
    })));
  }));

  app.get('/api/programs', auth, wrap(async (req, res) => {
    const { type, q: search, sort } = req.query;
    let where = 'WHERE 1=1', params = [];
    if (type) { where += ' AND p.type_slug = ?'; params.push(type); }
    if (search) { where += ' AND (p.name LIKE ? OR p.network LIKE ? OR p.blurb LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    const order = sort === 'epc' ? 'p.epc DESC' : sort === 'growth' ? 'p.growth DESC' : sort === 'name' ? 'p.name ASC' : '(p.epc*0.5 + p.growth*0.3 + p.popularity*0.2) DESC';
    const rows = await q.all(`
      SELECT p.*, t.name AS type_name, t.icon AS type_icon
      FROM programs p JOIN affiliate_types t ON t.slug = p.type_slug
      ${where} ORDER BY ${order}`, ...params);
    res.json(rows.map(p => ({ ...p, pros: JSON.parse(p.pros || '[]'), cons: JSON.parse(p.cons || '[]'), best_for: JSON.parse(p.best_for || '[]') })));
  }));

  app.get('/api/programs/:id', auth, wrap(async (req, res) => {
    const p = await q.get(`SELECT p.*, t.name AS type_name, t.icon AS type_icon, t.avg_commission AS type_avg FROM programs p JOIN affiliate_types t ON t.slug = p.type_slug WHERE p.id = ?`, +req.params.id);
    if (!p) return res.status(404).json({ error: 'Program not found' });
    res.json({ ...p, pros: JSON.parse(p.pros || '[]'), cons: JSON.parse(p.cons || '[]'), best_for: JSON.parse(p.best_for || '[]') });
  }));

  // strategies
  app.get('/api/strategies', auth, wrap(async (req, res) => {
    const rows = await q.all('SELECT * FROM strategies WHERE user_id = ? ORDER BY id DESC', req.user.id);
    res.json(rows.map(r => ({ ...r, content: JSON.parse(r.content) })));
  }));

  app.get('/api/programs/:id/strategy', auth, wrap(async (req, res) => {
    const p = await q.get(`SELECT p.*, t.name AS type_name FROM programs p JOIN affiliate_types t ON t.slug = p.type_slug WHERE p.id = ?`, +req.params.id);
    if (!p) return res.status(404).json({ error: 'Program not found' });
    await assistantReply(req.user.id, `strategy for ${p.name}`, { research: false });
    const row = await q.get('SELECT * FROM strategies WHERE user_id = ? AND program_id = ? ORDER BY id DESC LIMIT 1', req.user.id, p.id);
    res.json({ strategy: JSON.parse(row.content), program: p });
  }));

  app.delete('/api/strategies/:id', auth, wrap(async (req, res) => {
    const s = await q.get('SELECT * FROM strategies WHERE id = ? AND user_id = ?', +req.params.id, req.user.id);
    if (!s) return res.status(404).json({ error: 'Strategy not found' });
    await q.run('DELETE FROM strategies WHERE id = ?', s.id);
    res.json({ ok: true });
  }));

  // live research
  app.get('/api/research/pulse', auth, wrap(async (req, res) => {
    const pulse = await marketPulse();
    const hot = await q.all('SELECT p.*, t.name type_name FROM programs p JOIN affiliate_types t ON t.slug = p.type_slug ORDER BY growth DESC LIMIT 4');
    res.json({ ...pulse, hot_programs: hot.map(p => ({ ...p, pros: undefined, cons: undefined, best_for: undefined })) });
  }));

  app.get('/api/research/search', auth, wrap(async (req, res) => {
    const qs = String(req.query.q || '').trim();
    if (!qs) return res.status(400).json({ error: 'Missing ?q=' });
    res.json(await webSearch(qs, 6));
  }));

  // AI assistant
  app.get('/api/assistant/history', auth, wrap(async (req, res) => {
    const rows = await q.all('SELECT role, content, meta, created_at FROM chat WHERE user_id = ? ORDER BY id DESC LIMIT 60', req.user.id);
    res.json(rows.reverse().map(r => ({ role: r.role, content: r.content, meta: JSON.parse(r.meta || '{}'), created_at: r.created_at })));
  }));

  app.delete('/api/assistant/history', auth, wrap(async (req, res) => {
    await q.run('DELETE FROM chat WHERE user_id = ?', req.user.id);
    res.json({ ok: true });
  }));

  app.post('/api/assistant/chat', auth, wrap(async (req, res) => {
    const message = String((req.body || {}).message || '').trim();
    if (!message) return res.status(400).json({ error: 'Empty message' });
    const research = (req.body || {}).research !== false;
    await q.run('INSERT INTO chat (user_id, role, content, created_at) VALUES (?,?,?,?)', req.user.id, 'user', message, now());
    const t0 = Date.now();
    const reply = await assistantReply(req.user.id, message, { research });
    await q.run('INSERT INTO chat (user_id, role, content, meta, created_at) VALUES (?,?,?,?,?)',
      req.user.id, 'assistant', reply.text, JSON.stringify({ actions: reply.actions, sources: reply.sources, engine: reply.engine }), now());
    await logActivity(req.user.id, 'assistant', `Copilot: "${message.slice(0, 60)}${message.length > 60 ? '…' : ''}"`);
    res.json({ ...reply, ms: Date.now() - t0 });
  }));

  app.get('/api/settings/ai', auth, wrap(async (req, res) => {
    const s = await q.get('SELECT ai_provider, ai_model, ai_key FROM settings WHERE user_id = ?', req.user.id) || { ai_provider: '', ai_model: 'gpt-4o-mini', ai_key: '' };
    res.json({ provider: s.ai_provider, model: s.ai_model, has_key: !!s.ai_key });
  }));

  app.put('/api/settings/ai', auth, wrap(async (req, res) => {
    const { provider, model, api_key } = req.body || {};
    await q.run(`INSERT INTO settings (user_id, webhook_url, webhook_events, ai_provider, ai_model, ai_key, created_at) VALUES (?, '','click,conversion,payout',?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET ai_provider=excluded.ai_provider, ai_model=excluded.ai_model, ai_key=excluded.ai_key`,
      req.user.id, String(provider || '').trim(), String(model || 'gpt-4o-mini').trim(), String(api_key || '').trim(), now());
    await logActivity(req.user.id, 'info', 'AI provider settings updated');
    res.json({ ok: true });
  }));

  // profile
  app.put('/api/me', auth, wrap(async (req, res) => {
    const { name, company } = req.body || {};
    const u = await q.get('SELECT * FROM users WHERE id = ?', req.user.id);
    await q.run('UPDATE users SET name = ?, company = ? WHERE id = ?',
      clean(name) || u.name, company !== undefined ? clean(company) : u.company, u.id);
    await logActivity(req.user.id, 'info', 'Profile updated');
    res.json({ user: await bodyUser(req) });
  }));

  app.put('/api/me/password', auth, wrap(async (req, res) => {
    const { current, next } = req.body || {};
    const u = await q.get('SELECT * FROM users WHERE id = ?', req.user.id);
    if (!bcrypt.compareSync(current || '', u.password_hash)) return res.status(400).json({ error: 'Current password is incorrect.' });
    if (!next || next.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    await q.run('UPDATE users SET password_hash = ? WHERE id = ?', bcrypt.hashSync(next, 10), u.id);
    await logActivity(req.user.id, 'info', 'Password changed');
    res.json({ ok: true });
  }));

  app.delete('/api/me', auth, wrap(async (req, res) => {
    const uid = req.user.id;
    for (const t of ['clicks', 'links', 'networks', 'campaigns', 'payouts', 'api_keys', 'activity', 'chat', 'strategies', 'settings', 'sessions']) {
      await q.run(`DELETE FROM ${t} WHERE user_id = ?`, uid);
    }
    await q.run('DELETE FROM users WHERE id = ?', uid);
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; Max-Age=0`);
    res.json({ ok: true });
  }));

  // public tracking (no auth)
  app.get('/r/:slug', wrap(async (req, res) => {
    const link = await q.get('SELECT * FROM links WHERE slug = ?', req.params.slug.toLowerCase());
    if (!link) return res.status(404).send(NOTFOUND_HTML);
    if (link.status !== 'active') {
      await logClick(link, req);
      return res.status(410).send(INACTIVE_HTML);
    }
    await logClick(link, req);
    const owner = await q.get('SELECT is_demo FROM users WHERE id = ?', link.user_id);
    if (owner?.is_demo) {
      return res.status(200).send(DEMOVISIT_HTML);
    }
    res.redirect(302, link.destination_url);
  }));

  // REST tracking (API key)
  app.post('/api/v1/track', wrap(async (req, res) => {
    const key = (req.headers['x-api-key'] || req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.query.key || '').trim();
    const k = key ? await q.get('SELECT * FROM api_keys WHERE key = ?', key) : null;
    if (!k) return res.status(401).json({ error: 'Invalid or missing API key (X-API-Key header or ?key= param).' });
    await q.run('UPDATE api_keys SET last_used_at = ? WHERE id = ?', now(), k.id);
    const { link, slug, referrer, country, device, converted, amount } = req.body || {};
    const l = await q.get('SELECT * FROM links WHERE user_id = ? AND (slug = ? OR slug = ?)', k.user_id, String(slug || '').toLowerCase(), String(link || '').toLowerCase());
    if (!l) return res.status(404).json({ error: 'Link not found for this account.' });
    await logClick(l, req, {
      referrer: referrer || 'API integration', country: country || 'Unknown', device: device || 'desktop',
      converted: converted || amount ? 1 : 0, revenue: amount ? +amount : 0,
    });
    res.json({ ok: true, redirect: l.destination_url, click_id: req.body?.click_id || null });
  }));

  async function handlePostback(req, res) {
    const key = (req.headers['x-api-key'] || req.query.key || req.body?.key || '').trim();
    const k = key ? await q.get('SELECT * FROM api_keys WHERE key = ?', key) : null;
    if (!k) return res.status(401).json({ error: 'Invalid or missing API key.' });
    await q.run('UPDATE api_keys SET last_used_at = ? WHERE id = ?', now(), k.id);
    const networkSlug = req.params.network.toLowerCase();
    const net = await q.get("SELECT * FROM networks WHERE user_id = ? AND lower(replace(name,' ','')) = ?", k.user_id, networkSlug)
      || await q.get('SELECT * FROM networks WHERE user_id = ? AND lower(name) LIKE ?', k.user_id, `%${networkSlug}%`);
    if (!net) return res.status(404).json({ error: `No network matching "${networkSlug}" found.` });
    const amount = parseFloat(req.body?.amount || req.query.amount || req.body?.revenue || 0);
    const link = await q.get('SELECT * FROM links WHERE user_id = ? AND network_id = ? ORDER BY id LIMIT 1', k.user_id, net.id);
    if (!link) return res.status(404).json({ error: 'No links attached to this network yet.' });
    await q.run(`INSERT INTO clicks (link_id, user_id, referrer, country, device, converted, revenue, created_at) VALUES (?,?,?,?,?,1,?,?)`,
      link.id, k.user_id, `${net.name} postback`, 'Unknown', 'desktop', amount || 10, now());
    await logActivity(k.user_id, 'success', `Postback received from ${net.name} — "${link.name}" (+$${(amount || 10).toFixed(2)})`);
    res.json({ ok: true });
  }

  app.get('/api/v1/postback/:network', wrap(handlePostback));
  app.post('/api/v1/postback/:network', wrap(handlePostback));

  // static + catch-all
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    res.setHeader('Content-Type', 'text/html');
    res.send(INDEX_HTML);
  });

  app.use((err, req, res, next) => {
    console.error('[error]', req.method, req.path, err?.message || err);
    if (!res.headersSent) res.status(500).json({ error: err?.message || 'Server error' });
  });

  return app;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const app = createApp();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[linkpilot] server listening on http://0.0.0.0:${PORT}`);
  });
}
