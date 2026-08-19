import bcrypt from 'bcryptjs';
import { db, now, daysAgo } from './db.js';

// Deterministic RNG so the demo data is stable per seed run
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const REFERRERS = [
  ['Google', 26], ['YouTube', 18], ['Instagram', 13], ['TikTok', 9],
  ['X / Twitter', 7], ['Direct', 8], ['Newsletter', 6], ['Pinterest', 5],
  ['Facebook', 5], ['Reddit', 3],
];
const COUNTRIES = [
  ['United States', 34], ['United Kingdom', 11], ['Germany', 9], ['Canada', 8],
  ['Australia', 6], ['India', 7], ['Pakistan', 4], ['Brazil', 5], ['France', 4],
  ['Netherlands', 4], ['Spain', 3], ['Singapore', 2], ['UAE', 2], ['Other', 1],
];
const DEVICES = [['desktop', 52], ['mobile', 42], ['tablet', 6]];

function weightedPick(rng, table) {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [v, w] of table) { r -= w; if (r <= 0) return v; }
  return table[0][0];
}

function pickLink(rng) {
  const user = db.prepare('SELECT id FROM users ORDER BY id LIMIT 1').get();
  const links = db.prepare('SELECT id, name FROM links WHERE user_id = ?').all(user.id);
  return links[Math.floor(rng() * links.length)];
}

export function seedDemoUser() {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@linkpilot.app');
  if (existing) {
    // ensure the demo workspace is flagged as guest/virtual mode
    db.prepare('UPDATE users SET is_demo = 1 WHERE id = ?').run(existing.id);
    return existing;
  }

  const passwordHash = bcrypt.hashSync('demo1234', 10);
  const userRes = db.prepare(
    `INSERT INTO users (name, email, password_hash, company, is_demo, created_at) VALUES (?,?,?,?,1,?)`
  ).run('Alex Morgan', 'demo@linkpilot.app', passwordHash, 'Morgan Media', daysAgo(240));
  const uid = userRes.lastInsertRowid;

  // ---------- Networks ----------
  const networkDefs = [
    ['Amazon Associates', '#ff9900', 4, 60, 'active', 'Home & tech products. Payouts via Amazon Pay or gift card.'],
    ['ClickBank', '#1e5eff', 45, 60, 'active', 'Digital products, e-books, supplements. High commission marketplace.'],
    ['ShareASale', '#4caf50', 15, 45, 'active', '500+ merchants. Reliable payouts on the 20th.'],
    ['Impact', '#8b5cf6', 20, 30, 'active', 'SaaS & software brands — NordVPN, Hostinger, Canva.'],
    ['PartnerStack', '#06b6d4', 25, 90, 'active', 'B2B SaaS partner programs with recurring commissions.'],
    ['Digistore24', '#3b82f6', 30, 180, 'paused', 'European marketplace. Currently paused — payout terms changed.'],
  ];
  const netIds = {};
  const insNet = db.prepare(
    `INSERT INTO networks (user_id, name, color, commission_rate, cookie_days, status, notes, created_at) VALUES (?,?,?,?,?,?,?,?)`
  );
  networkDefs.forEach(([name, color, rate, cookie, status, notes], i) => {
    netIds[name] = insNet.run(uid, name, color, rate, cookie, status, notes, daysAgo(200 - i * 9)).lastInsertRowid;
  });

  // ---------- Campaigns ----------
  const campaignDefs = [
    ['Holiday Gift Guide 2026', 'Seasonal push across blog + email with curated product picks.', 'active', 2500, '#f59e0b', daysAgo(120), daysAgo(-45)],
    ['YouTube Tech Reviews', 'Video descriptions and pinned comments on tech review channel.', 'active', 1500, '#ef4444', daysAgo(150), daysAgo(-90)],
    ['Weekly Newsletter', 'Sunday digest with deal roundups to 24k subscribers.', 'active', 800, '#10b981', daysAgo(180), null],
    ['Instagram Reels Push', 'Short-form UGC reels with bio-link strategy.', 'paused', 1200, '#ec4899', daysAgo(90), daysAgo(10)],
  ];
  const campIds = {};
  const insCamp = db.prepare(
    `INSERT INTO campaigns (user_id, name, description, status, budget, color, starts_at, ends_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)`
  );
  campaignDefs.forEach(([name, desc, status, budget, color, start, end]) => {
    campIds[name] = insCamp.run(uid, name, desc, status, budget, color, start, end, daysAgo(100)).lastInsertRowid;
  });

  // ---------- Links ----------
  const linkDefs = [
    // name, slug, destination, network, campaign, price, cr, base clicks/day, growth
    ['AirPods Pro 2 (Amazon)', 'airpods-pro-2', 'https://www.amazon.com/dp/B0BDHWDR12', 'Amazon Associates', 'Holiday Gift Guide 2026', 249, 0.045, 42, 0.55],
    ['Sony WH-1000XM5', 'sony-xm5', 'https://www.amazon.com/dp/B09XS7JWHH', 'Amazon Associates', 'YouTube Tech Reviews', 398, 0.028, 26, 0.4],
    ['Kindle Paperwhite', 'kindle-paperwhite', 'https://www.amazon.com/dp/B08KTZ8249', 'Amazon Associates', 'Holiday Gift Guide 2026', 149, 0.05, 30, 0.3],
    ['Hostinger Web Hosting', 'hostinger-deal', 'https://www.hostinger.com/web-hosting', 'Impact', 'Weekly Newsletter', 78, 0.062, 24, 0.5],
    ['NordVPN 2-Year Plan', 'nordvpn-deal', 'https://nordvpn.com/pricing/', 'Impact', 'YouTube Tech Reviews', 89, 0.07, 34, 0.65],
    ['Grammarly Premium', 'grammarly', 'https://www.grammarly.com/plans', 'ShareASale', 'Weekly Newsletter', 144, 0.035, 18, 0.35],
    ['Lean Belly Formula (ClickBank)', 'cb-leanbelly', 'https://www.clickbank.com/marketplace/', 'ClickBank', 'Instagram Reels Push', 47, 0.022, 38, -0.2],
    ['Notion Plus', 'notion-plus', 'https://www.notion.so/pricing', 'PartnerStack', 'Weekly Newsletter', 120, 0.04, 15, 0.45],
  ];
  const linkIds = {};
  const insLink = db.prepare(
    `INSERT INTO links (user_id, network_id, campaign_id, name, slug, destination_url, status, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`
  );
  linkDefs.forEach(([name, slug, dest, net, camp, price, cr, base, growth], i) => {
    linkIds[slug] = insLink.run(
      uid, netIds[net], campIds[camp], name, slug, dest, 'active',
      i === 0 ? 'Best performer. Pinned in all gift-guide posts.' : '',
      daysAgo(90 - i * 6), daysAgo(Math.floor(Math.random() * 5) + 1)
    ).lastInsertRowid;
  });

  // ---------- Clicks (90 days of history) ----------
  const rng = mulberry32(20260819);
  const insClick = db.prepare(
    `INSERT INTO clicks (link_id, user_id, referrer, country, device, converted, revenue, created_at) VALUES (?,?,?,?,?,?,?,?)`
  );
  const DAYS = 92;
  const linkMeta = {};
  linkDefs.forEach(([name, slug, dest, net, camp, price, cr, base, growth]) => {
    linkMeta[slug] = { price, cr, base, growth };
  });

  const insertMany = db.transaction((rows) => {
    for (const r of rows) insClick.run(...r);
  });

  for (let d = DAYS; d >= 0; d--) {
    const day = new Date(Date.now() - d * 86400000);
    const dow = day.getUTCDay(); // 0 Sun .. 6 Sat
    const weekend = dow === 0 || dow === 6;
    const rows = [];
    for (const [name, slug, , , , , , ,] of linkDefs) {
      const { price, cr, base, growth } = linkMeta[slug];
      // volume = base * (1 + growth * (1 - d/DAYS)) — growth compounds backward
      const growthFactor = 1 + growth * (1 - d / DAYS);
      let vol = base * growthFactor;
      if (weekend) vol *= dow === 0 ? 0.68 : 0.82;
      vol *= 0.75 + rng() * 0.55; // daily noise
      const count = Math.max(0, Math.round(vol));
      for (let c = 0; c < count; c++) {
        const hour = Math.floor(rng() * 24);
        const minute = Math.floor(rng() * 60);
        const ts = new Date(day.getTime() + hour * 3600000 + minute * 60000);
        if (ts > new Date()) continue;
        const converted = rng() < cr ? 1 : 0;
        const netRow = linkDefs.find(l => l[1] === slug);
        const net = netRow[3];
        const rate = { 'Amazon Associates': 0.04, 'ClickBank': 0.45, 'ShareASale': 0.15, 'Impact': 0.20, 'PartnerStack': 0.25, 'Digistore24': 0.30 }[net];
        const qty = rng() < 0.09 ? 2 : 1;
        const revenue = converted ? +(price * rate * qty).toFixed(2) : 0;
        rows.push([linkIds[slug], uid, weightedPick(rng, REFERRERS), weightedPick(rng, COUNTRIES), weightedPick(rng, DEVICES), converted, revenue, ts.toISOString()]);
      }
    }
    insertMany(rows);
  }

  // ---------- Payouts ----------
  const insPayout = db.prepare(
    `INSERT INTO payouts (user_id, network_id, amount, status, method, reference, notes, requested_at, paid_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`
  );
  const payoutDefs = [
    ['Amazon Associates', 1284.5, 'paid', 'Direct deposit', 'AMZ-2026-06', 'June earnings', 38, 30],
    ['ClickBank', 3412.2, 'paid', 'Wire transfer', 'CB-84412', 'Bi-weekly payout', 45, 37],
    ['Impact', 1180.75, 'paid', 'PayPal', 'IMP-2201', '', 52, 44],
    ['ShareASale', 640.4, 'pending', 'Direct deposit', '', 'Awaiting approval', 12, null],
    ['PartnerStack', 456.8, 'processing', 'PayPal', '', '', 6, null],
    ['Amazon Associates', 1104.9, 'pending', 'Direct deposit', '', 'July earnings', 4, null],
  ];
  payoutDefs.forEach(([net, amount, status, method, ref, notes, req, paid]) => {
    insPayout.run(uid, netIds[net], amount, status, method, ref, notes, daysAgo(req), paid ? daysAgo(paid) : null, daysAgo(req));
  });

  // ---------- API key ----------
  db.prepare(
    `INSERT INTO api_keys (user_id, name, key, created_at, last_used_at) VALUES (?,?,?,?,?)`
  ).run(uid, 'Production key', `lpk_${Array.from({ length: 32 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('')}`, daysAgo(60), daysAgo(1));

  // ---------- Activity ----------
  const insAct = db.prepare(`INSERT INTO activity (user_id, type, message, created_at) VALUES (?,?,?,?)`);
  const activityDefs = [
    ['success', 'Payout of $3,412.20 from ClickBank marked as paid', 37],
    ['info', 'New link "NordVPN 2-Year Plan" created', 33],
    ['info', 'Campaign "Holiday Gift Guide 2026" launched', 21],
    ['success', 'Conversion recorded — NordVPN 2-Year Plan ($17.80)', 20],
    ['info', 'Webhook endpoint configured', 15],
    ['success', 'Payout of $1,180.75 from Impact marked as paid', 44],
    ['info', 'New link "Grammarly Premium" created', 18],
    ['warning', 'Campaign "Instagram Reels Push" paused — CTR below 1%', 9],
    ['success', 'Payout of $1,284.50 from Amazon Associates marked as paid', 30],
    ['info', 'API key "Production key" created', 60],
    ['info', 'New network "PartnerStack" connected', 72],
    ['success', 'Conversion spike: 14 conversions from YouTube yesterday', 2],
    ['info', 'Welcome to LinkPilot — connect your first network to get started', 240],
  ];
  activityDefs.forEach(([type, msg, days]) => insAct.run(uid, type, msg, daysAgo(days)));

  // ---------- Settings row ----------
  db.prepare(`INSERT INTO settings (user_id, webhook_url, webhook_secret, webhook_events, created_at) VALUES (?,?,?,?,?)`)
    .run(uid, '', '', 'click,conversion,payout', daysAgo(240));

  console.log(`[seed] demo user created with ${DAYS} days of click history`);
  return { id: uid };
}
