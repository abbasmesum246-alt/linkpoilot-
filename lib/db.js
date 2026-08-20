import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

// ============================================================
// Storage adapter — two engines, one async interface:
//  · Turso (libSQL over HTTP)  when TURSO_DATABASE_URL is set  → used on Vercel
//  · local SQLite file          otherwise                       → used in development
// The SQL dialect is identical (Turso is SQLite-compatible), so
// the whole app runs unchanged on both.
// ============================================================
export const useTurso = !!(process.env.TURSO_DATABASE_URL || '');

let sqlite = null;     // better-sqlite3 Database (lazy)
let libsqlClient = null; // @libsql/client (lazy)
let initialized = false;

async function getLibsql() {
  if (!libsqlClient) {
    const { createClient } = await import('@libsql/client');
    libsqlClient = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    });
  }
  return libsqlClient;
}

async function getSqlite() {
  if (!sqlite) {
    const { default: Database } = await import('better-sqlite3');
    fs.mkdirSync(DATA_DIR, { recursive: true });
    sqlite = new Database(path.join(DATA_DIR, 'linkpilot.db'));
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
  }
  return sqlite;
}

const cleanParams = (params) => params.map(p => (p === undefined ? null : p));

export const q = {
  async all(sql, ...params) {
    if (useTurso) {
      const c = await getLibsql();
      const res = await c.execute({ sql, args: cleanParams(params) });
      return res.rows;
    }
    const db = await getSqlite();
    return db.prepare(sql).all(...cleanParams(params));
  },
  async get(sql, ...params) {
    const rows = await q.all(sql, ...params);
    return rows[0];
  },
  async run(sql, ...params) {
    if (useTurso) {
      const c = await getLibsql();
      const res = await c.execute({ sql, args: cleanParams(params) });
      return {
        changes: Number(res.rowsAffected || 0),
        lastInsertRowid: res.lastInsertRowid != null ? Number(res.lastInsertRowid) : null,
      };
    }
    const db = await getSqlite();
    const info = db.prepare(sql).run(...cleanParams(params));
    return { changes: info.changes, lastInsertRowid: Number(info.lastInsertRowid) || null };
  },
};

// Batched multi-row insert — used by the seeder. Same SQL on both engines.
export async function insertMany(table, cols, rows) {
  if (!rows.length) return;
  const CHUNK = 50;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const placeholders = chunk.map(() => `(${cols.map(() => '?').join(',')})`).join(',');
    await q.run(`INSERT INTO ${table} (${cols.join(',')}) VALUES ${placeholders}`, ...chunk.flat());
  }
}

// ------------------------------------------------------------ schema
const DDL = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    company TEXT DEFAULT '',
    role TEXT DEFAULT 'owner',
    is_demo INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS networks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    commission_rate REAL DEFAULT 10,
    cookie_days INTEGER DEFAULT 30,
    status TEXT DEFAULT 'active',
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    budget REAL DEFAULT 0,
    color TEXT DEFAULT '#6366f1',
    starts_at TEXT,
    ends_at TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    network_id INTEGER,
    campaign_id INTEGER,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    destination_url TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    note TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS clicks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    referrer TEXT DEFAULT 'Direct',
    country TEXT DEFAULT 'Unknown',
    device TEXT DEFAULT 'desktop',
    converted INTEGER DEFAULT 0,
    revenue REAL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_clicks_link ON clicks(link_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_clicks_user ON clicks(user_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS payouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    network_id INTEGER,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    method TEXT DEFAULT 'Bank transfer',
    reference TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    requested_at TEXT NOT NULL,
    paid_at TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    key TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    last_used_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT DEFAULT 'info',
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_activity_user ON activity(user_id, id)`,
  `CREATE TABLE IF NOT EXISTS settings (
    user_id INTEGER PRIMARY KEY,
    webhook_url TEXT DEFAULT '',
    webhook_secret TEXT DEFAULT '',
    webhook_events TEXT DEFAULT 'click,conversion,payout',
    ai_provider TEXT DEFAULT '',
    ai_key TEXT DEFAULT '',
    ai_model TEXT DEFAULT 'gpt-4o-mini',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS affiliate_types (
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
  )`,
  `CREATE TABLE IF NOT EXISTS programs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type_slug TEXT NOT NULL,
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
  )`,
  `CREATE TABLE IF NOT EXISTS strategies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    program_id INTEGER,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS chat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    meta TEXT DEFAULT '{}',
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_chat_user ON chat(user_id, id)`,
  `CREATE TABLE IF NOT EXISTS research_cache (
    key TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    fetched_at TEXT NOT NULL
  )`,
];

export async function initDb() {
  if (initialized) return;
  initialized = true;
  if (useTurso) {
    for (const ddl of DDL) await q.run(ddl);
    console.log('[store] using Turso (libSQL) —', (process.env.TURSO_DATABASE_URL || '').split('@').pop());
  } else {
    // SQLite: schema + column migrations for pre-existing databases
    const db = await getSqlite();
    db.exec(DDL.join(';\n'));
    const ensureColumn = (table, col, ddl) => {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all();
      if (!cols.some(c => c.name === col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    };
    ensureColumn('users', 'is_demo', 'is_demo INTEGER DEFAULT 0');
    ensureColumn('settings', 'ai_provider', "ai_provider TEXT DEFAULT ''");
    ensureColumn('settings', 'ai_key', "ai_key TEXT DEFAULT ''");
    ensureColumn('settings', 'ai_model', "ai_model TEXT DEFAULT 'gpt-4o-mini'");
    console.log('[store] using local SQLite —', path.join(DATA_DIR, 'linkpilot.db'));
  }
}

// ------------------------------------------------------------ helpers
export const now = () => new Date().toISOString();
export const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
export const todayISO = () => new Date().toISOString().slice(0, 10);

export function slugify(text) {
  return String(text).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'link';
}

export async function uniqueSlug(base) {
  let s = slugify(base);
  if (!s) s = 'link';
  let candidate = s, i = 2;
  while (await q.get('SELECT 1 FROM links WHERE slug = ?', candidate)) {
    candidate = `${s}-${i++}`;
  }
  return candidate;
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export async function logActivity(userId, type, message) {
  await q.run('INSERT INTO activity (user_id, type, message, created_at) VALUES (?,?,?,?)',
    userId, type, message, now());
}
