import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { db, now, daysAgo, uniqueSlug, randomToken, logActivity, slugify } from './lib/db.js';
import { seedDemoUser } from './lib/seed.js';
import { seedMarket } from './lib/market.js';
import { assistantReply } from './lib/assistant.js';
import { marketPulse, webSearch, hnTrending } from './lib/research.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

seedDemoUser();
seedMarket();

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ------------------------------------------------------------------ helpers
const SESSION_COOKIE = 'lp_session';

function setSession(res, userId) {
  const token = randomToken(32);
  db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)')
    .run(token, userId, now(), daysAgo(-30));
  res.setHeader('Set-Cookie',
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}`);
  return token;
}

function auth(req, res, next) {
  const raw = req.headers.cookie || '';
  const m = raw.split(';').map(c => c.trim()).find(c => c.startsWith(`${SESSION_COOKIE}=`));
  if (!m) return res.status(401).json({ error: 'Not authenticated' });
  const token = m.slice(SESSION_COOKIE.length + 1);
  const sess = db.prepare(`SELECT s.*, u.id AS uid FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`).get(token);
  if (!sess || new Date(sess.expires_at) < new Date()) {
    return res.status(401).json({ error: 'Session expired' });
  }
  req.user = { id: sess.uid };
  req.session = sess;
  next();
}

const wrap = (fn) => (req, res) => {
  Promise.resolve()
    .then(() => fn(req, res))
    .catch((e) => {
      console.error('[error]', req.method, req.path, e.message);
      if (!res.headersSent) res.status(500).json({ error: e.message || 'Server error' });
    });
};

function bodyUser(req) {
  return db.prepare('SELECT id, name, email, company, role, is_demo, created_at FROM users WHERE id = ?').get(req.user.id);
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

function logClick(link, req, extra = {}) {
  const ref = extra.referrer || (req.headers.referer ? new URL(req.headers.referer).hostname : (req.query.utm_source || 'Direct'));
  db.prepare(`INSERT INTO clicks (link_id, user_id, referrer, country, device, converted, revenue, created_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(link.id, link.user_id, String(ref).slice(0, 120), extra.country || parseCountry(req),
      extra.device || parseDevice(req.headers['user-agent']), extra.converted ? 1 : 0,
      extra.revenue || 0, extra.created_at || now());
}

// ------------------------------------------------------------------ auth
app.get('/api/health', wrap((req, res) => res.json({
  ok: true, service: 'linkpilot', time: now(),
  uptime: Math.round(process.uptime()),
})));

// guest mode: enter the shared demo workspace (virtual data & connections)
app.post('/api/auth/guest', wrap((req, res) => {
  seedDemoUser();
  db.prepare("UPDATE users SET is_demo = 1 WHERE email = 'demo@linkpilot.app'").run();
  const u = db.prepare("SELECT * FROM users WHERE email = 'demo@linkpilot.app'").get();
  setSession(res, u.id);
  res.json({ user: { id: u.id, name: u.name, email: u.email, company: u.company, role: u.role, is_demo: 1, created_at: u.created_at } });
}));

app.post('/api/auth/register', wrap((req, res) => {
  const { name, email, password, company } = req.body || {};
  if (!clean(name) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean(email))) {
    return res.status(400).json({ error: 'Please provide a valid name and email.' });
  }
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(clean(email).toLowerCase());
  if (exists) return res.status(409).json({ error: 'An account with this email already exists.' });
  const hash = bcrypt.hashSync(password, 10);
  const r = db.prepare(`INSERT INTO users (name, email, password_hash, company, created_at) VALUES (?,?,?,?,?)`)
    .run(clean(name), clean(email).toLowerCase(), hash, clean(company), now());
  db.prepare('INSERT INTO settings (user_id, webhook_url, webhook_secret, webhook_events, created_at) VALUES (?,?,?,?,?)')
    .run(r.lastInsertRowid, '', '', 'click,conversion,payout', now());
  logActivity(r.lastInsertRowid, 'info', `Welcome to LinkPilot, ${clean(name).split(' ')[0]}! Create your first affiliate link to start tracking.`);
  setSession(res, r.lastInsertRowid);
  res.json({ user: bodyUser({ user: { id: r.lastInsertRowid } }) });
}));

app.post('/api/auth/login', wrap((req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(clean(email).toLowerCase());
  if (!u || !bcrypt.compareSync(password || '', u.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  setSession(res, u.id);
  res.json({ user: { id: u.id, name: u.name, email: u.email, company: u.company, role: u.role, is_demo: !!u.is_demo, created_at: u.created_at } });
}));

app.post('/api/auth/logout', wrap((req, res) => {
  const raw = req.headers.cookie || '';
  const m = raw.split(';').map(c => c.trim()).find(c => c.startsWith(`${SESSION_COOKIE}=`));
  if (m) db.prepare('DELETE FROM sessions WHERE token = ?').run(m.slice(SESSION_COOKIE.length + 1));
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; Max-Age=0`);
  res.json({ ok: true });
}));

app.get('/api/auth/me', auth, wrap((req, res) => res.json({ user: bodyUser(req) })));

// ------------------------------------------------------------------ stats
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

function linksWithStats(userId, days = 30, extraWhere = '', params = []) {
  const since = daysAgo(days);
  return db.prepare(`${LINK_STATS_BASE} WHERE l.user_id = ? ${extraWhere} GROUP BY l.id ORDER BY l.updated_at DESC`)
    .all(since, since, since, userId, ...params)
    .map(l => ({ ...l, clicks_recent: +l.clicks_recent, conversions_recent: +l.conversions_recent, revenue_recent: Math.round(+l.revenue_recent * 100) / 100, clicks_total: +l.clicks_total }));
}

app.get('/api/stats/overview', auth, wrap((req, res) => {
  const days = Math.min(365, Math.max(7, parseInt(req.query.days) || 30));
  const since = daysAgo(days), prevSince = daysAgo(days * 2);
  const uid = req.user.id;
  const agg = (from) => db.prepare(`
    SELECT COUNT(*) clicks, COALESCE(SUM(converted),0) conversions, COALESCE(SUM(revenue),0) revenue
    FROM clicks WHERE user_id = ? AND created_at >= ? AND created_at < ?`).get(uid, from, from === since ? now() : since);
  const cur = agg(since), prev = agg(prevSince);
  const activeLinks = db.prepare(`SELECT COUNT(*) n FROM links WHERE user_id = ? AND status = 'active'`).get(uid).n;
  const totalLinks = db.prepare(`SELECT COUNT(*) n FROM links WHERE user_id = ?`).get(uid).n;
  const pendingPayouts = db.prepare(`SELECT COUNT(*) n FROM payouts WHERE user_id = ? AND status != 'paid'`).get(uid).n;
  const networks = db.prepare(`SELECT COUNT(*) n FROM networks WHERE user_id = ?`).get(uid).n;
  const epc = cur.clicks ? cur.revenue / cur.clicks : 0;
  res.json({
    revenue: Math.round(cur.revenue * 100) / 100,
    revenuePrev: Math.round(prev.revenue * 100) / 100,
    clicks: cur.clicks, clicksPrev: prev.clicks,
    conversions: cur.conversions, conversionsPrev: prev.conversions,
    cr: cur.clicks ? (cur.conversions / cur.clicks) * 100 : 0,
    crPrev: prev.clicks ? (prev.conversions / prev.clicks) * 100 : 0,
    epc, epcPrev: prev.clicks ? prev.revenue / prev.clicks : 0,
    activeLinks, totalLinks, pendingPayouts, networks, days,
  });
}));

app.get('/api/stats/timeseries', auth, wrap((req, res) => {
  const days = Math.min(365, Math.max(7, parseInt(req.query.days) || 30));
  const since = daysAgo(days);
  const rows = db.prepare(`
    SELECT strftime('%Y-%m-%d', created_at) d,
      COUNT(*) clicks, COALESCE(SUM(converted),0) conversions, COALESCE(SUM(revenue),0) revenue
    FROM clicks WHERE user_id = ? AND created_at >= ?
    GROUP BY d ORDER BY d`).all(req.user.id, since);
  // fill gaps
  const map = Object.fromEntries(rows.map(r => [r.d, r]));
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const r = map[d];
    out.push({ date: d, clicks: r ? +r.clicks : 0, conversions: r ? +r.conversions : 0, revenue: r ? Math.round(+r.revenue * 100) / 100 : 0 });
  }
  res.json(out);
}));

app.get('/api/stats/referrers', auth, wrap((req, res) => {
  const days = Math.min(90, Math.max(7, parseInt(req.query.days) || 30));
  const rows = db.prepare(`
    SELECT referrer, COUNT(*) clicks, COALESCE(SUM(converted),0) conversions, COALESCE(SUM(revenue),0) revenue
    FROM clicks WHERE user_id = ? AND created_at >= ? GROUP BY referrer ORDER BY clicks DESC LIMIT 12`)
    .all(req.user.id, daysAgo(days));
  res.json(rows.map(r => ({ ...r, clicks: +r.clicks, conversions: +r.conversions, revenue: Math.round(+r.revenue * 100) / 100 })));
}));

app.get('/api/stats/network-share', auth, wrap((req, res) => {
  const days = Math.min(90, Math.max(7, parseInt(req.query.days) || 30));
  const rows = db.prepare(`
    SELECT COALESCE(n.name, 'No network') name, COALESCE(n.color, '#64748b') color,
      COUNT(k.id) clicks, COALESCE(SUM(k.converted),0) conversions, COALESCE(SUM(k.revenue),0) revenue
    FROM clicks k LEFT JOIN links l ON l.id = k.link_id LEFT JOIN networks n ON n.id = l.network_id
    WHERE k.user_id = ? AND k.created_at >= ?
    GROUP BY COALESCE(n.name,'No network') ORDER BY revenue DESC`)
    .all(req.user.id, daysAgo(days));
  res.json(rows.map(r => ({ ...r, clicks: +r.clicks, conversions: +r.conversions, revenue: Math.round(+r.revenue * 100) / 100 })));
}));

app.get('/api/activity', auth, wrap((req, res) => {
  const rows = db.prepare('SELECT * FROM activity WHERE user_id = ? ORDER BY id DESC LIMIT ?')
    .all(req.user.id, Math.min(100, parseInt(req.query.limit) || 25));
  res.json(rows);
}));

// ------------------------------------------------------------------ links
app.get('/api/links', auth, wrap((req, res) => {
  const { q, network, campaign, status } = req.query;
  let where = '', params = [];
  if (q) { where += ` AND (l.name LIKE ? OR l.slug LIKE ? OR l.destination_url LIKE ?)`; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (network) { where += ` AND l.network_id = ?`; params.push(+network); }
  if (campaign) { where += ` AND l.campaign_id = ?`; params.push(+campaign); }
  if (status && status !== 'all') { where += ` AND l.status = ?`; params.push(status); }
  res.json(linksWithStats(req.user.id, 30, where, params));
}));

app.get('/api/links/export', auth, wrap((req, res) => {
  const rows = linksWithStats(req.user.id, 30);
  const head = ['Name', 'Slug', 'Destination URL', 'Network', 'Campaign', 'Status', 'Clicks (30d)', 'Conversions (30d)', 'Revenue (30d)'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [head.join(',')].concat(rows.map(r => [r.name, r.slug, r.destination_url, r.network_name || '', r.campaign_name || '', r.status, r.clicks_recent, r.conversions_recent, r.revenue_recent.toFixed(2)].map(esc).join(','))).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="linkpilot-links.csv"');
  res.send('\uFEFF' + csv);
}));

function validateLinkPayload(body) {
  const { name, destination_url, slug, network_id, campaign_id, status, note } = body || {};
  if (!clean(name)) return { error: 'Link name is required.' };
  let url = clean(destination_url);
  if (!/^https?:\/\/.+\..+/.test(url)) return { error: 'Destination URL must be a full URL starting with http(s)://' };
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  if (slug && !/^[a-z0-9][a-z0-9-_]*$/i.test(clean(slug))) return { error: 'Slug may only contain letters, numbers, dashes and underscores.' };
  if (slug && db.prepare('SELECT 1 FROM links WHERE slug = ?').get(clean(slug).toLowerCase())) return { error: 'That custom slug is already taken.' };
  return { data: { name: clean(name), destination_url: url, slug: clean(slug).toLowerCase(), network_id: network_id ? +network_id : null, campaign_id: campaign_id ? +campaign_id : null, status: status || 'active', note: clean(note) } };
}

app.post('/api/links', auth, wrap((req, res) => {
  const v = validateLinkPayload(req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  const d = v.data;
  const slug = d.slug || uniqueSlug(d.name);
  const r = db.prepare(`INSERT INTO links (user_id, network_id, campaign_id, name, slug, destination_url, status, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(req.user.id, d.network_id, d.campaign_id, d.name, slug, d.destination_url, d.status, d.note, now(), now());
  logActivity(req.user.id, 'link', `New link "${d.name}" created`);
  const full = linksWithStats(req.user.id, 30, ' AND l.id = ?', [r.lastInsertRowid])[0];
  res.json(full);
}));

app.put('/api/links/:id', auth, wrap((req, res) => {
  const link = db.prepare('SELECT * FROM links WHERE id = ? AND user_id = ?').get(+req.params.id, req.user.id);
  if (!link) return res.status(404).json({ error: 'Link not found' });
  // merge partial update with existing values before validating
  const merged = {
    name: req.body.name !== undefined ? req.body.name : link.name,
    destination_url: req.body.destination_url !== undefined ? req.body.destination_url : link.destination_url,
    slug: null,
    network_id: req.body.network_id !== undefined ? req.body.network_id : link.network_id,
    campaign_id: req.body.campaign_id !== undefined ? req.body.campaign_id : link.campaign_id,
    status: req.body.status || link.status,
    note: req.body.note !== undefined ? req.body.note : link.note,
  };
  const v = validateLinkPayload(merged);
  if (v.error) return res.status(400).json({ error: v.error });
  const d = v.data;
  const network_id = req.body.network_id === '' ? null : (d.network_id != null ? d.network_id : link.network_id);
  const campaign_id = req.body.campaign_id === '' ? null : (d.campaign_id != null ? d.campaign_id : link.campaign_id);
  db.prepare(`UPDATE links SET name=?, destination_url=?, network_id=?, campaign_id=?, status=?, note=?, updated_at=? WHERE id=?`)
    .run(d.name, d.destination_url, network_id, campaign_id, d.status, d.note, now(), link.id);
  logActivity(req.user.id, 'link', `Link "${d.name}" updated`);
  res.json(linksWithStats(req.user.id, 30, ' AND l.id = ?', [link.id])[0]);
}));

app.delete('/api/links/:id', auth, wrap((req, res) => {
  const link = db.prepare('SELECT * FROM links WHERE id = ? AND user_id = ?').get(+req.params.id, req.user.id);
  if (!link) return res.status(404).json({ error: 'Link not found' });
  db.prepare('DELETE FROM clicks WHERE link_id = ?').run(link.id);
  db.prepare('DELETE FROM links WHERE id = ?').run(link.id);
  logActivity(req.user.id, 'link', `Link "${link.name}" deleted`);
  res.json({ ok: true });
}));

app.get('/api/links/:id/stats', auth, wrap((req, res) => {
  const days = Math.min(180, Math.max(7, parseInt(req.query.days) || 30));
  const link = db.prepare('SELECT * FROM links WHERE id = ? AND user_id = ?').get(+req.params.id, req.user.id);
  if (!link) return res.status(404).json({ error: 'Link not found' });
  const since = daysAgo(days);
  const series = db.prepare(`
    SELECT strftime('%Y-%m-%d', created_at) d, COUNT(*) clicks, COALESCE(SUM(converted),0) conversions, COALESCE(SUM(revenue),0) revenue
    FROM clicks WHERE link_id = ? AND created_at >= ? GROUP BY d ORDER BY d`).all(link.id, since);
  const refs = db.prepare(`SELECT referrer, COUNT(*) clicks FROM clicks WHERE link_id = ? AND created_at >= ? GROUP BY referrer ORDER BY clicks DESC LIMIT 8`).all(link.id, since);
  const countries = db.prepare(`SELECT country, COUNT(*) clicks FROM clicks WHERE link_id = ? AND created_at >= ? GROUP BY country ORDER BY clicks DESC LIMIT 8`).all(link.id, since);
  const devices = db.prepare(`SELECT device, COUNT(*) clicks FROM clicks WHERE link_id = ? AND created_at >= ? GROUP BY device ORDER BY clicks DESC`).all(link.id, since);
  const totals = db.prepare(`SELECT COUNT(*) clicks, COALESCE(SUM(converted),0) conversions, COALESCE(SUM(revenue),0) revenue FROM clicks WHERE link_id = ? AND created_at >= ?`).get(link.id, since);
  res.json({
    series: series.map(r => ({ date: r.d, clicks: +r.clicks, conversions: +r.conversions, revenue: Math.round(+r.revenue * 100) / 100 })),
    referrers: refs.map(r => ({ name: r.referrer, clicks: +r.clicks })),
    countries: countries.map(r => ({ name: r.country, clicks: +r.clicks })),
    devices: devices.map(r => ({ name: r.device, clicks: +r.clicks })),
    totals: { clicks: +totals.clicks, conversions: +totals.conversions, revenue: Math.round(+totals.revenue * 100) / 100, days },
  });
}));

// test click (does not redirect)
app.post('/api/links/:id/test-click', auth, wrap((req, res) => {
  const link = db.prepare('SELECT * FROM links WHERE id = ? AND user_id = ?').get(+req.params.id, req.user.id);
  if (!link) return res.status(404).json({ error: 'Link not found' });
  logClick(link, req, { referrer: 'Manual test', country: 'Unknown', device: 'desktop' });
  res.json({ ok: true });
}));

// ------------------------------------------------------------------ campaigns
function campaignWithStats(row, userId) {
  const stats = db.prepare(`
    SELECT COUNT(DISTINCT l.id) link_count,
      COALESCE(SUM(CASE WHEN k.created_at >= ? THEN 1 ELSE 0 END),0) clicks,
      COALESCE(SUM(CASE WHEN k.created_at >= ? AND k.converted=1 THEN 1 ELSE 0 END),0) conversions,
      COALESCE(SUM(CASE WHEN k.created_at >= ? THEN k.revenue ELSE 0 END),0) revenue
    FROM links l LEFT JOIN clicks k ON k.link_id = l.id
    WHERE l.campaign_id = ?`).get(daysAgo(30), daysAgo(30), daysAgo(30), row.id);
  const link_ids = db.prepare('SELECT id FROM links WHERE campaign_id = ?').all(row.id).map(r => r.id);
  return { ...row, link_ids, link_count: +stats.link_count, clicks_recent: +stats.clicks, conversions_recent: +stats.conversions, revenue_recent: Math.round(+stats.revenue * 100) / 100 };
}

app.get('/api/campaigns', auth, wrap((req, res) => {
  const rows = db.prepare('SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(rows.map(r => campaignWithStats(r, req.user.id)));
}));

app.post('/api/campaigns', auth, wrap((req, res) => {
  const { name, description, status, budget, color, starts_at, ends_at, link_ids } = req.body || {};
  if (!clean(name)) return res.status(400).json({ error: 'Campaign name is required.' });
  const r = db.prepare(`INSERT INTO campaigns (user_id, name, description, status, budget, color, starts_at, ends_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(req.user.id, clean(name), clean(description), status || 'active', +budget || 0, color || '#6366f1', clean(starts_at) || null, clean(ends_at) || null, now());
  if (Array.isArray(link_ids) && link_ids.length) {
    const upd = db.prepare('UPDATE links SET campaign_id = ?, updated_at = ? WHERE id = ? AND user_id = ?');
    db.transaction(() => link_ids.forEach(id => upd.run(r.lastInsertRowid, now(), +id, req.user.id)))();
  }
  logActivity(req.user.id, 'campaign', `Campaign "${clean(name)}" created`);
  res.json(campaignWithStats(db.prepare('SELECT * FROM campaigns WHERE id = ?').get(r.lastInsertRowid), req.user.id));
}));

app.put('/api/campaigns/:id', auth, wrap((req, res) => {
  const camp = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(+req.params.id, req.user.id);
  if (!camp) return res.status(404).json({ error: 'Campaign not found' });
  const d = req.body || {};
  db.prepare(`UPDATE campaigns SET name=?, description=?, status=?, budget=?, color=?, starts_at=?, ends_at=? WHERE id=?`)
    .run(clean(d.name) || camp.name, clean(d.description) || camp.description, d.status || camp.status,
      d.budget != null ? +d.budget : camp.budget, d.color || camp.color,
      d.starts_at !== undefined ? clean(d.starts_at) || null : camp.starts_at,
      d.ends_at !== undefined ? clean(d.ends_at) || null : camp.ends_at, camp.id);
  if (Array.isArray(d.link_ids)) {
    db.prepare('UPDATE links SET campaign_id = NULL, updated_at = ? WHERE campaign_id = ? AND user_id = ?').run(now(), camp.id, req.user.id);
    const upd = db.prepare('UPDATE links SET campaign_id = ?, updated_at = ? WHERE id = ? AND user_id = ?');
    db.transaction(() => d.link_ids.forEach(id => upd.run(camp.id, now(), +id, req.user.id)))();
  }
  logActivity(req.user.id, 'campaign', `Campaign "${camp.name}" updated`);
  res.json(campaignWithStats(db.prepare('SELECT * FROM campaigns WHERE id = ?').get(camp.id), req.user.id));
}));

app.delete('/api/campaigns/:id', auth, wrap((req, res) => {
  const camp = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(+req.params.id, req.user.id);
  if (!camp) return res.status(404).json({ error: 'Campaign not found' });
  db.prepare('UPDATE links SET campaign_id = NULL WHERE campaign_id = ?').run(camp.id);
  db.prepare('DELETE FROM campaigns WHERE id = ?').run(camp.id);
  logActivity(req.user.id, 'campaign', `Campaign "${camp.name}" deleted`);
  res.json({ ok: true });
}));

// ------------------------------------------------------------------ networks
function networkWithStats(row, userId) {
  const s = db.prepare(`
    SELECT COUNT(DISTINCT l.id) link_count,
      COALESCE(SUM(CASE WHEN k.created_at >= ? THEN 1 ELSE 0 END),0) clicks,
      COALESCE(SUM(CASE WHEN k.created_at >= ? AND k.converted=1 THEN 1 ELSE 0 END),0) conversions,
      COALESCE(SUM(CASE WHEN k.created_at >= ? THEN k.revenue ELSE 0 END),0) revenue
    FROM links l LEFT JOIN clicks k ON k.link_id = l.id WHERE l.network_id = ?`).get(daysAgo(30), daysAgo(30), daysAgo(30), row.id);
  const paid = db.prepare(`SELECT COALESCE(SUM(amount),0) paid FROM payouts WHERE network_id = ? AND status = 'paid'`).get(row.id).paid;
  const pending = db.prepare(`SELECT COALESCE(SUM(amount),0) pending FROM payouts WHERE network_id = ? AND status != 'paid'`).get(row.id).pending;
  const lifetime = db.prepare(`
    SELECT COALESCE(SUM(k.revenue),0) revenue FROM clicks k JOIN links l ON l.id = k.link_id WHERE l.network_id = ?`).get(row.id).revenue;
  return {
    ...row, link_count: +s.link_count, clicks_recent: +s.clicks, conversions_recent: +s.conversions,
    revenue_recent: Math.round(+s.revenue * 100) / 100, paid: Math.round(+paid * 100) / 100,
    pending: Math.round(+pending * 100) / 100, lifetime_revenue: Math.round(+lifetime * 100) / 100,
  };
}

app.get('/api/networks', auth, wrap((req, res) => {
  const rows = db.prepare('SELECT * FROM networks WHERE user_id = ? ORDER BY created_at ASC').all(req.user.id);
  res.json(rows.map(r => networkWithStats(r, req.user.id)));
}));

app.post('/api/networks', auth, wrap((req, res) => {
  const { name, color, commission_rate, cookie_days, status, notes } = req.body || {};
  if (!clean(name)) return res.status(400).json({ error: 'Network name is required.' });
  const r = db.prepare(`INSERT INTO networks (user_id, name, color, commission_rate, cookie_days, status, notes, created_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(req.user.id, clean(name), color || '#6366f1', +commission_rate || 0, +cookie_days || 30, status || 'active', clean(notes), now());
  logActivity(req.user.id, 'network', `Network "${clean(name)}" connected`);
  res.json(networkWithStats(db.prepare('SELECT * FROM networks WHERE id = ?').get(r.lastInsertRowid), req.user.id));
}));

app.put('/api/networks/:id', auth, wrap((req, res) => {
  const n = db.prepare('SELECT * FROM networks WHERE id = ? AND user_id = ?').get(+req.params.id, req.user.id);
  if (!n) return res.status(404).json({ error: 'Network not found' });
  const d = req.body || {};
  db.prepare(`UPDATE networks SET name=?, color=?, commission_rate=?, cookie_days=?, status=?, notes=? WHERE id=?`)
    .run(clean(d.name) || n.name, d.color || n.color, d.commission_rate != null ? +d.commission_rate : n.commission_rate,
      d.cookie_days != null ? +d.cookie_days : n.cookie_days, d.status || n.status, d.notes !== undefined ? clean(d.notes) : n.notes, n.id);
  logActivity(req.user.id, 'network', `Network "${n.name}" updated`);
  res.json(networkWithStats(db.prepare('SELECT * FROM networks WHERE id = ?').get(n.id), req.user.id));
}));

app.delete('/api/networks/:id', auth, wrap((req, res) => {
  const n = db.prepare('SELECT * FROM networks WHERE id = ? AND user_id = ?').get(+req.params.id, req.user.id);
  if (!n) return res.status(404).json({ error: 'Network not found' });
  db.prepare('UPDATE links SET network_id = NULL WHERE network_id = ?').run(n.id);
  db.prepare('DELETE FROM networks WHERE id = ?').run(n.id);
  logActivity(req.user.id, 'network', `Network "${n.name}" removed`);
  res.json({ ok: true });
}));

// ------------------------------------------------------------------ payouts
app.get('/api/payouts', auth, wrap((req, res) => {
  const { status } = req.query;
  let where = 'WHERE p.user_id = ?', params = [req.user.id];
  if (status && status !== 'all') { where += ' AND p.status = ?'; params.push(status); }
  const rows = db.prepare(`
    SELECT p.*, n.name network_name, n.color network_color FROM payouts p
    LEFT JOIN networks n ON n.id = p.network_id ${where} ORDER BY p.requested_at DESC`).all(...params);
  const summary = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),0) paid,
      COALESCE(SUM(CASE WHEN status!='paid' THEN amount ELSE 0 END),0) pending
    FROM payouts WHERE user_id = ?`).get(req.user.id);
  res.json({ payouts: rows, paid: Math.round(+summary.paid * 100) / 100, pending: Math.round(+summary.pending * 100) / 100 });
}));

app.post('/api/payouts', auth, wrap((req, res) => {
  const { network_id, amount, method, status, reference, notes, requested_at } = req.body || {};
  if (!network_id) return res.status(400).json({ error: 'Select a network for this payout.' });
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'Enter a valid payout amount.' });
  const st = status || 'pending';
  const r = db.prepare(`INSERT INTO payouts (user_id, network_id, amount, status, method, reference, notes, requested_at, paid_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(req.user.id, +network_id, Math.round(amt * 100) / 100, st, clean(method) || 'Bank transfer', clean(reference), clean(notes),
      clean(requested_at) || now(), st === 'paid' ? now() : null, now());
  logActivity(req.user.id, 'payout', `Payout of $${amt.toFixed(2)} requested`);
  const row = db.prepare(`SELECT p.*, n.name network_name, n.color network_color FROM payouts p LEFT JOIN networks n ON n.id = p.network_id WHERE p.id = ?`).get(r.lastInsertRowid);
  res.json(row);
}));

app.put('/api/payouts/:id', auth, wrap((req, res) => {
  const p = db.prepare('SELECT * FROM payouts WHERE id = ? AND user_id = ?').get(+req.params.id, req.user.id);
  if (!p) return res.status(404).json({ error: 'Payout not found' });
  const d = req.body || {};
  const status = d.status || p.status;
  const paid_at = status === 'paid' ? (p.paid_at || now()) : null;
  db.prepare(`UPDATE payouts SET network_id=?, amount=?, status=?, method=?, reference=?, notes=?, requested_at=?, paid_at=? WHERE id=?`)
    .run(d.network_id ? +d.network_id : p.network_id, d.amount != null ? Math.round(+d.amount * 100) / 100 : p.amount,
      status, clean(d.method) || p.method, d.reference !== undefined ? clean(d.reference) : p.reference,
      d.notes !== undefined ? clean(d.notes) : p.notes, clean(d.requested_at) || p.requested_at, paid_at, p.id);
  if (status === 'paid' && p.status !== 'paid') {
    logActivity(req.user.id, 'success', `Payout of $${(+p.amount).toFixed(2)} marked as paid`);
  } else if (status !== 'paid' && p.status === 'paid') {
    logActivity(req.user.id, 'warning', `Payout of $${(+p.amount).toFixed(2)} reopened`);
  } else {
    logActivity(req.user.id, 'payout', `Payout updated (${status})`);
  }
  res.json(db.prepare(`SELECT p.*, n.name network_name, n.color network_color FROM payouts p LEFT JOIN networks n ON n.id = p.network_id WHERE p.id = ?`).get(p.id));
}));

app.delete('/api/payouts/:id', auth, wrap((req, res) => {
  const p = db.prepare('SELECT * FROM payouts WHERE id = ? AND user_id = ?').get(+req.params.id, req.user.id);
  if (!p) return res.status(404).json({ error: 'Payout not found' });
  db.prepare('DELETE FROM payouts WHERE id = ?').run(p.id);
  logActivity(req.user.id, 'payout', `Payout of $${(+p.amount).toFixed(2)} deleted`);
  res.json({ ok: true });
}));

// ------------------------------------------------------------------ api keys
app.get('/api/keys', auth, wrap((req, res) => {
  res.json(db.prepare('SELECT id, name, key, created_at, last_used_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id));
}));

app.post('/api/keys', auth, wrap((req, res) => {
  const name = clean((req.body || {}).name) || 'Untitled key';
  const key = 'lpk_' + randomToken(20);
  const r = db.prepare('INSERT INTO api_keys (user_id, name, key, created_at) VALUES (?,?,?,?)').run(req.user.id, name, key, now());
  logActivity(req.user.id, 'key', `API key "${name}" created`);
  res.json(db.prepare('SELECT id, name, key, created_at, last_used_at FROM api_keys WHERE id = ?').get(r.lastInsertRowid));
}));

app.delete('/api/keys/:id', auth, wrap((req, res) => {
  const k = db.prepare('SELECT * FROM api_keys WHERE id = ? AND user_id = ?').get(+req.params.id, req.user.id);
  if (!k) return res.status(404).json({ error: 'Key not found' });
  db.prepare('DELETE FROM api_keys WHERE id = ?').run(k.id);
  logActivity(req.user.id, 'key', `API key "${k.name}" revoked`);
  res.json({ ok: true });
}));

// ------------------------------------------------------------------ webhook settings
app.get('/api/settings/webhook', auth, wrap((req, res) => {
  const s = db.prepare('SELECT webhook_url, webhook_events FROM settings WHERE user_id = ?').get(req.user.id) || { webhook_url: '', webhook_events: 'click,conversion,payout' };
  res.json(s);
}));

app.put('/api/settings/webhook', auth, wrap((req, res) => {
  const { webhook_url, webhook_events } = req.body || {};
  db.prepare(`INSERT INTO settings (user_id, webhook_url, webhook_events, created_at) VALUES (?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET webhook_url = excluded.webhook_url, webhook_events = excluded.webhook_events`)
    .run(req.user.id, clean(webhook_url), clean(webhook_events) || 'click,conversion,payout', now());
  logActivity(req.user.id, 'info', 'Webhook settings updated');
  res.json({ ok: true });
}));

app.post('/api/settings/webhook/test', auth, wrap(async (req, res) => {
  const s = db.prepare('SELECT webhook_url FROM settings WHERE user_id = ?').get(req.user.id);
  if (!s || !s.webhook_url) return res.status(400).json({ error: 'No webhook URL configured.' });
  const payload = {
    event: 'test', message: 'Webhook test from LinkPilot', user_id: req.user.id, timestamp: now(),
    sample: { link: 'airpods-pro-2', click_id: randomToken(6), revenue: 9.96 },
  };
  // Guest (demo) mode: the delivery is simulated — no real outbound call is made.
  const user = db.prepare('SELECT is_demo FROM users WHERE id = ?').get(req.user.id);
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

// simulate an incoming network postback (demo of a real integration)
app.post('/api/integrations/simulate', auth, wrap((req, res) => {
  const { network_id, link_id, amount } = req.body || {};
  let link;
  if (link_id) link = db.prepare('SELECT * FROM links WHERE id = ? AND user_id = ?').get(+link_id, req.user.id);
  if (!link && network_id) link = db.prepare('SELECT * FROM links WHERE network_id = ? AND user_id = ? ORDER BY id LIMIT 1').get(+network_id, req.user.id);
  if (!link) return res.status(404).json({ error: 'No link found for that network. Create one first.' });
  const rev = amount ? +amount : +(Math.random() * 20 + 8).toFixed(2);
  db.prepare(`INSERT INTO clicks (link_id, user_id, referrer, country, device, converted, revenue, created_at) VALUES (?,?,?,?,?,1,?,?)`)
    .run(link.id, req.user.id, 'Network postback', 'Unknown', 'desktop', rev, now());
  const n = link.network_id ? db.prepare('SELECT name FROM networks WHERE id = ?').get(link.network_id) : null;
  logActivity(req.user.id, 'success', `Postback received${n ? ' from ' + n.name : ''} — "${link.name}" (+$${rev.toFixed(2)})`);
  res.json({ ok: true, link: link.name, revenue: rev });
}));

// ------------------------------------------------------------------ public tracking (no auth)
app.get('/r/:slug', wrap((req, res) => {
  const link = db.prepare('SELECT * FROM links WHERE slug = ?').get(req.params.slug.toLowerCase());
  if (!link) return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
  if (link.status !== 'active') {
    logClick(link, req);
    return res.status(410).sendFile(path.join(__dirname, 'public', 'inactive.html'));
  }
  logClick(link, req);
  // Demo (guest) workspace: clicks are logged but the visit is simulated —
  // real accounts get the actual merchant redirect.
  const owner = db.prepare('SELECT is_demo FROM users WHERE id = ?').get(link.user_id);
  if (owner?.is_demo) {
    return res.status(200).sendFile(path.join(__dirname, 'public', 'demo-visit.html'));
  }
  res.redirect(302, link.destination_url);
}));

// JSON tracking endpoint for external integrations (requires API key)
app.post('/api/v1/track', wrap((req, res) => {
  const key = (req.headers['x-api-key'] || req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.query.key || '').trim();
  const k = key ? db.prepare('SELECT * FROM api_keys WHERE key = ?').get(key) : null;
  if (!k) return res.status(401).json({ error: 'Invalid or missing API key (X-API-Key header or ?key= param).' });
  db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(now(), k.id);
  const { link, slug, click_id, referrer, country, device, converted, amount } = req.body || {};
  const l = db.prepare('SELECT * FROM links WHERE user_id = ? AND (slug = ? OR slug = ?)').get(k.user_id, String(slug || '').toLowerCase(), String(link || '').toLowerCase());
  if (!l) return res.status(404).json({ error: 'Link not found for this account.' });
  logClick(l, req, {
    referrer: referrer || 'API integration', country: country || 'Unknown', device: device || 'desktop',
    converted: converted || amount ? 1 : 0, revenue: amount ? +amount : 0,
  });
  res.json({ ok: true, redirect: l.destination_url, click_id: click_id || null });
}));

// network postback endpoint — paste this into ClickBank / Impact / etc.
app.get('/api/v1/postback/:network', wrap((req, res) => {
  const key = (req.headers['x-api-key'] || req.query.key || '').trim();
  const k = key ? db.prepare('SELECT * FROM api_keys WHERE key = ?').get(key) : null;
  if (!k) return res.status(401).json({ error: 'Invalid or missing API key.' });
  db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(now(), k.id);
  const networkSlug = req.params.network.toLowerCase();
  const net = db.prepare("SELECT * FROM networks WHERE user_id = ? AND lower(replace(name,' ','')) = ?").get(k.user_id, networkSlug)
    || db.prepare('SELECT * FROM networks WHERE user_id = ? AND lower(name) LIKE ?').get(k.user_id, `%${networkSlug}%`);
  if (!net) return res.status(404).json({ error: `No network matching "${networkSlug}" found.` });
  const amount = parseFloat(req.query.amount || req.query.revenue || 0);
  const link = db.prepare('SELECT * FROM links WHERE user_id = ? AND network_id = ? ORDER BY id LIMIT 1').get(k.user_id, net.id);
  if (!link) return res.status(404).json({ error: 'No links attached to this network yet.' });
  db.prepare(`INSERT INTO clicks (link_id, user_id, referrer, country, device, converted, revenue, created_at) VALUES (?,?,?,?,?,1,?,?)`)
    .run(link.id, k.user_id, `${net.name} postback`, 'Unknown', 'desktop', amount || 10, now());
  logActivity(k.user_id, 'success', `Postback received from ${net.name} — "${link.name}" (+$${(amount || 10).toFixed(2)})`);
  res.json({ ok: true });
}));

app.post('/api/v1/postback/:network', wrap((req, res) => {
  // same as GET but body-based — networks commonly POST form-encoded
  const key = (req.headers['x-api-key'] || req.query.key || req.body?.key || '').trim();
  const k = key ? db.prepare('SELECT * FROM api_keys WHERE key = ?').get(key) : null;
  if (!k) return res.status(401).json({ error: 'Invalid or missing API key.' });
  db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(now(), k.id);
  const networkSlug = req.params.network.toLowerCase();
  const net = db.prepare("SELECT * FROM networks WHERE user_id = ? AND lower(replace(name,' ','')) = ?").get(k.user_id, networkSlug)
    || db.prepare('SELECT * FROM networks WHERE user_id = ? AND lower(name) LIKE ?').get(k.user_id, `%${networkSlug}%`);
  if (!net) return res.status(404).json({ error: `No network matching "${networkSlug}" found.` });
  const amount = parseFloat(req.body?.amount || req.query.amount || req.body?.revenue || 0);
  const link = db.prepare('SELECT * FROM links WHERE user_id = ? AND network_id = ? ORDER BY id LIMIT 1').get(k.user_id, net.id);
  if (!link) return res.status(404).json({ error: 'No links attached to this network yet.' });
  db.prepare(`INSERT INTO clicks (link_id, user_id, referrer, country, device, converted, revenue, created_at) VALUES (?,?,?,?,?,1,?,?)`)
    .run(link.id, k.user_id, `${net.name} postback`, 'Unknown', 'desktop', amount || 10, now());
  logActivity(k.user_id, 'success', `Postback received from ${net.name} — "${link.name}" (+$${(amount || 10).toFixed(2)})`);
  res.json({ ok: true });
}));

// ------------------------------------------------------------------ profile
app.put('/api/me', auth, wrap((req, res) => {
  const { name, company } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  db.prepare('UPDATE users SET name = ?, company = ? WHERE id = ?')
    .run(clean(name) || u.name, company !== undefined ? clean(company) : u.company, u.id);
  logActivity(req.user.id, 'info', 'Profile updated');
  res.json({ user: bodyUser(req) });
}));

app.put('/api/me/password', auth, wrap((req, res) => {
  const { current, next } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current || '', u.password_hash)) return res.status(400).json({ error: 'Current password is incorrect.' });
  if (!next || next.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(next, 10), u.id);
  logActivity(req.user.id, 'info', 'Password changed');
  res.json({ ok: true });
}));

app.delete('/api/me', auth, wrap((req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; Max-Age=0`);
  res.json({ ok: true });
}));

// ------------------------------------------------------------------ market: types & programs
app.get('/api/types', auth, wrap((req, res) => {
  const types = db.prepare(`
    SELECT t.*, COUNT(p.id) AS program_count
    FROM affiliate_types t LEFT JOIN programs p ON p.type_slug = t.slug
    GROUP BY t.id ORDER BY t.sort`).all();
  res.json(types.map(t => ({
    ...t,
    program_count: +t.program_count,
    features: JSON.parse(t.features || '[]'),
    tips: JSON.parse(t.tips || '[]'),
  })));
}));

app.get('/api/programs', auth, wrap((req, res) => {
  const { type, q, sort } = req.query;
  let where = 'WHERE 1=1', params = [];
  if (type) { where += ' AND p.type_slug = ?'; params.push(type); }
  if (q) { where += ' AND (p.name LIKE ? OR p.network LIKE ? OR p.blurb LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const order = sort === 'epc' ? 'p.epc DESC' : sort === 'growth' ? 'p.growth DESC' : sort === 'name' ? 'p.name ASC' : '(p.epc*0.5 + p.growth*0.3 + p.popularity*0.2) DESC';
  const rows = db.prepare(`
    SELECT p.*, t.name AS type_name, t.icon AS type_icon
    FROM programs p JOIN affiliate_types t ON t.slug = p.type_slug
    ${where} ORDER BY ${order}`).all(...params);
  res.json(rows.map(p => ({ ...p, pros: JSON.parse(p.pros || '[]'), cons: JSON.parse(p.cons || '[]'), best_for: JSON.parse(p.best_for || '[]') })));
}));

app.get('/api/programs/:id', auth, wrap((req, res) => {
  const p = db.prepare(`SELECT p.*, t.name AS type_name, t.icon AS type_icon, t.avg_commission AS type_avg FROM programs p JOIN affiliate_types t ON t.slug = p.type_slug WHERE p.id = ?`).get(+req.params.id);
  if (!p) return res.status(404).json({ error: 'Program not found' });
  res.json({ ...p, pros: JSON.parse(p.pros || '[]'), cons: JSON.parse(p.cons || '[]'), best_for: JSON.parse(p.best_for || '[]') });
}));

// ------------------------------------------------------------------ strategies
app.get('/api/strategies', auth, wrap((req, res) => {
  const rows = db.prepare('SELECT * FROM strategies WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  res.json(rows.map(r => ({ ...r, content: JSON.parse(r.content) })));
}));

app.get('/api/programs/:id/strategy', auth, async (req, res) => {
  try {
    const p = db.prepare(`SELECT p.*, t.name AS type_name FROM programs p JOIN affiliate_types t ON t.slug = p.type_slug WHERE p.id = ?`).get(+req.params.id);
    if (!p) return res.status(404).json({ error: 'Program not found' });
    await assistantReply(req.user.id, `strategy for ${p.name}`, { research: false });
    const row = db.prepare('SELECT * FROM strategies WHERE user_id = ? AND program_id = ? ORDER BY id DESC LIMIT 1').get(req.user.id, p.id);
    res.json({ strategy: JSON.parse(row.content), program: p });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/strategies/:id', auth, wrap((req, res) => {
  const s = db.prepare('SELECT * FROM strategies WHERE id = ? AND user_id = ?').get(+req.params.id, req.user.id);
  if (!s) return res.status(404).json({ error: 'Strategy not found' });
  db.prepare('DELETE FROM strategies WHERE id = ?').run(s.id);
  res.json({ ok: true });
}));

// ------------------------------------------------------------------ live research
app.get('/api/research/pulse', auth, wrap(async (req, res) => {
  const pulse = await marketPulse();
  const hot = db.prepare('SELECT p.*, t.name type_name FROM programs p JOIN affiliate_types t ON t.slug = p.type_slug ORDER BY growth DESC LIMIT 4').all();
  res.json({ ...pulse, hot_programs: hot.map(p => ({ ...p, pros: undefined, cons: undefined, best_for: undefined })) });
}));

app.get('/api/research/search', auth, wrap(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Missing ?q=' });
  const results = await webSearch(q, 6);
  res.json(results);
}));

// ------------------------------------------------------------------ AI assistant
app.get('/api/assistant/history', auth, wrap((req, res) => {
  const rows = db.prepare('SELECT role, content, meta, created_at FROM chat WHERE user_id = ? ORDER BY id DESC LIMIT 60').all(req.user.id);
  res.json(rows.reverse().map(r => ({ role: r.role, content: r.content, meta: JSON.parse(r.meta || '{}'), created_at: r.created_at })));
}));

app.delete('/api/assistant/history', auth, wrap((req, res) => {
  db.prepare('DELETE FROM chat WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
}));

app.post('/api/assistant/chat', auth, wrap(async (req, res) => {
  const message = String((req.body || {}).message || '').trim();
  if (!message) return res.status(400).json({ error: 'Empty message' });
  const research = (req.body || {}).research !== false;
  db.prepare('INSERT INTO chat (user_id, role, content, created_at) VALUES (?,?,?,?)').run(req.user.id, 'user', message, now());
  const t0 = Date.now();
  const reply = await assistantReply(req.user.id, message, { research });
  db.prepare('INSERT INTO chat (user_id, role, content, meta, created_at) VALUES (?,?,?,?,?)')
    .run(req.user.id, 'assistant', reply.text, JSON.stringify({ actions: reply.actions, sources: reply.sources, engine: reply.engine }), now());
  logActivity(req.user.id, 'assistant', `Copilot: "${message.slice(0, 60)}${message.length > 60 ? '…' : ''}"`);
  res.json({ ...reply, ms: Date.now() - t0 });
}));

// AI provider settings (optional LLM upgrade — built-in engine is default)
app.get('/api/settings/ai', auth, wrap((req, res) => {
  const s = db.prepare('SELECT ai_provider, ai_model, ai_key FROM settings WHERE user_id = ?').get(req.user.id) || { ai_provider: '', ai_model: 'gpt-4o-mini', ai_key: '' };
  res.json({ provider: s.ai_provider, model: s.ai_model, has_key: !!s.ai_key });
}));

app.put('/api/settings/ai', auth, wrap((req, res) => {
  const { provider, model, api_key } = req.body || {};
  db.prepare(`INSERT INTO settings (user_id, webhook_url, webhook_events, ai_provider, ai_model, ai_key, created_at) VALUES (?, '','click,conversion,payout',?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET ai_provider=excluded.ai_provider, ai_model=excluded.ai_model, ai_key=excluded.ai_key`)
    .run(req.user.id, String(provider || '').trim(), String(model || 'gpt-4o-mini').trim(), String(api_key || '').trim(), now());
  logActivity(req.user.id, 'info', 'AI provider settings updated');
  res.json({ ok: true });
}));

// ------------------------------------------------------------------ static + 404 page
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/r/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[linkpilot] server listening on http://0.0.0.0:${PORT}`);
});
