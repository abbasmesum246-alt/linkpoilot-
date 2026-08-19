import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DATA_DIR can point at a persistent volume on cloud hosts (Render disk, Railway volume).
// Defaults to ./data (local development). NOTE: Vercel's read-only filesystem is NOT
// supported — use Render/Railway/Fly for this app (see README → Deployment).
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, 'linkpilot.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function ensureColumn(table, col, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some(c => c.name === col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  company TEXT DEFAULT '',
  role TEXT DEFAULT 'owner',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS networks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  commission_rate REAL DEFAULT 10,
  cookie_days INTEGER DEFAULT 30,
  status TEXT DEFAULT 'active',
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  budget REAL DEFAULT 0,
  color TEXT DEFAULT '#6366f1',
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  network_id INTEGER REFERENCES networks(id) ON DELETE SET NULL,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  destination_url TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id INTEGER NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  referrer TEXT DEFAULT 'Direct',
  country TEXT DEFAULT 'Unknown',
  device TEXT DEFAULT 'desktop',
  converted INTEGER DEFAULT 0,
  revenue REAL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clicks_link ON clicks(link_id, created_at);
CREATE INDEX IF NOT EXISTS idx_clicks_user ON clicks(user_id, created_at);
CREATE TABLE IF NOT EXISTS payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  network_id INTEGER REFERENCES networks(id) ON DELETE SET NULL,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  method TEXT DEFAULT 'Bank transfer',
  reference TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  requested_at TEXT NOT NULL,
  paid_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'info',
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity(user_id, id DESC);
CREATE TABLE IF NOT EXISTS settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  webhook_url TEXT DEFAULT '',
  webhook_secret TEXT DEFAULT '',
  webhook_events TEXT DEFAULT 'click,conversion,payout',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS affiliate_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'package',
  tagline TEXT DEFAULT '',
  description TEXT DEFAULT '',
  avg_commission TEXT DEFAULT '',
  best_channels TEXT DEFAULT '',
  features TEXT DEFAULT '[]',
  tips TEXT DEFAULT '[]',
  sort INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type_slug TEXT NOT NULL REFERENCES affiliate_types(slug),
  name TEXT NOT NULL,
  network TEXT DEFAULT '',
  commission_type TEXT DEFAULT 'CPS',
  rate_min REAL DEFAULT 0,
  rate_max REAL DEFAULT 0,
  rate_label TEXT DEFAULT '',
  cookie_days INTEGER DEFAULT 30,
  payout_method TEXT DEFAULT '',
  min_payout REAL DEFAULT 0,
  approval TEXT DEFAULT 'Easy',
  epc REAL DEFAULT 0,
  growth REAL DEFAULT 0,
  popularity INTEGER DEFAULT 50,
  url TEXT DEFAULT '',
  blurb TEXT DEFAULT '',
  promo TEXT DEFAULT '',
  pros TEXT DEFAULT '[]',
  cons TEXT DEFAULT '[]',
  best_for TEXT DEFAULT '[]',
  verified INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS strategies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_id INTEGER,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  meta TEXT DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_user ON chat(user_id, id);
CREATE TABLE IF NOT EXISTS research_cache (
  key TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
`);

// column migrations for databases created before these features existed
// (must run AFTER the CREATE TABLE block so fresh databases work too)
ensureColumn('users', 'is_demo', 'is_demo INTEGER DEFAULT 0');
ensureColumn('settings', 'ai_provider', "ai_provider TEXT DEFAULT ''");
ensureColumn('settings', 'ai_key', "ai_key TEXT DEFAULT ''");
ensureColumn('settings', 'ai_model', "ai_model TEXT DEFAULT 'gpt-4o-mini'");

export const now = () => new Date().toISOString();
export const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
export const todayISO = () => new Date().toISOString().slice(0, 10);

export function slugify(text) {
  return String(text).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'link';
}

export function uniqueSlug(base) {
  let s = slugify(base);
  if (!s) s = 'link';
  let candidate = s, i = 2;
  while (db.prepare('SELECT 1 FROM links WHERE slug = ?').get(candidate)) {
    candidate = `${s}-${i++}`;
  }
  return candidate;
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function logActivity(userId, type, message) {
  db.prepare('INSERT INTO activity (user_id, type, message, created_at) VALUES (?,?,?,?)')
    .run(userId, type, message, now());
}

export function sanitizeLink(row) {
  if (!row) return null;
  const { user_id, ...rest } = row;
  return rest;
}
