import { db, now } from './db.js';

// ============================================================
// Live web research layer — fetches real data from public
// endpoints (no API keys required), cached in SQLite.
// ============================================================

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 LinkPilotBot/2.0 (+research)';

async function fetchText(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return text;
  } finally {
    clearTimeout(t);
  }
}

async function fetchJson(url, timeoutMs = 8000) {
  const text = await fetchText(url, timeoutMs);
  return JSON.parse(text);
}

function cacheGet(key) {
  const row = db.prepare('SELECT data, fetched_at FROM research_cache WHERE key = ?').get(key);
  if (!row) return null;
  if (Date.now() - new Date(row.fetched_at).getTime() > 15 * 60 * 1000) return null; // 15 min TTL
  try { return JSON.parse(row.data); } catch { return null; }
}

function cacheSet(key, data) {
  db.prepare('INSERT INTO research_cache (key, data, fetched_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data, fetched_at=excluded.fetched_at')
    .run(key, JSON.stringify(data), now());
}

function stripHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}

// ---------------- HN: trending tech/product stories ----------------
const HN_STOPWORDS = /(show hn|ask hn|who is hiring|layoff|lawsuit|dead|death|died|security breach|breach|hacked|vulnerability|rce|malware)/i;

export async function hnTrending(limit = 12) {
  const key = 'hn_trending';
  const cached = cacheGet(key);
  if (cached) return cached;
  try {
    const ids = (await fetchJson('https://hacker-news.firebaseio.com/v0/topstories.json', 6000)).slice(0, 40);
    const stories = [];
    for (const id of ids) {
      try {
        const s = await fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, 4000);
        if (s && s.title && s.type === 'story' && !HN_STOPWORDS.test(s.title)) {
          stories.push({ title: s.title, url: s.url || `https://news.ycombinator.com/item?id=${s.id}`, score: s.score, time: s.time, source: 'Hacker News' });
          if (stories.length >= limit) break;
        }
      } catch { /* skip item */ }
    }
    const out = { fetched_at: now(), items: stories };
    cacheSet(key, out);
    return out;
  } catch {
    return { fetched_at: now(), items: [], error: 'HN unavailable' };
  }
}

// ---------------- web search: DuckDuckGo Lite + HN Algolia ----------------
export async function webSearch(query, max = 6) {
  const key = `search:${query.toLowerCase().slice(0, 120)}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const results = [];
  // 1) DuckDuckGo lite (HTML, no key)
  try {
    const html = await fetchText(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, 9000);
    const linkRe = /<a[^>]+href="([^"]+)"[^>]*class="result-link"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = linkRe.exec(html)) && results.length < max) {
      let href = m[1];
      if (href.startsWith('//')) href = 'https:' + href;
      if (href.startsWith('/')) continue;
      if (/duckduckgo|localhost/.test(href)) continue;
      const title = stripHtml(m[2]).slice(0, 140);
      const snippet = '';
      results.push({ title, url: href, snippet, source: 'web' });
    }
  } catch { /* DDG blocked — fall through */ }

  // 2) HN Algolia (product/tech discussions)
  try {
    const alg = await fetchJson(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&hitsPerPage=3`, 6000);
    for (const h of alg.hits || []) {
      if (!h.title) continue;
      results.push({ title: String(h.title).slice(0, 140), url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, snippet: `HN discussion · ${h.points || 0} points`, source: 'Hacker News' });
    }
  } catch { /* offline */ }

  const out = { fetched_at: now(), query, items: results.slice(0, max) };
  cacheSet(key, out);
  return out;
}

// ---------------- Wikipedia summary ----------------
export async function wikiSummary(term, maxChars = 900) {
  const key = `wiki:${term.toLowerCase().slice(0, 80)}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  try {
    const j = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`, 7000);
    if (!j || !j.extract) throw new Error('no extract');
    const out = { fetched_at: now(), title: j.title, extract: j.extract.slice(0, maxChars), url: j.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(j.title)}` };
    cacheSet(key, out);
    return out;
  } catch {
    return null;
  }
}

// ---------------- marketing/affiliate news RSS ----------------
const FEEDS = [
  { name: 'Search Engine Journal', url: 'https://www.searchenginejournal.com/feed/', tag: 'SEO & marketing' },
  { name: 'Search Engine Land', url: 'https://searchengineland.com/feed', tag: 'SEO & marketing' },
  { name: 'Moz Blog', url: 'https://moz.com/blog/feed', tag: 'SEO' },
  { name: 'Ahrefs Blog', url: 'https://ahrefs.com/blog/feed/', tag: 'SEO' },
  { name: 'Martech Zone', url: 'https://martech.zone/feed/', tag: 'Marketing' },
];

function parseRss(xml, feedName, tag, max = 5) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) && items.length < max) {
    const block = m[1];
    const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
    const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
    const pub = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
    if (title && link) items.push({ title: stripHtml(title).slice(0, 160), url: stripHtml(link), source: feedName, tag, time: pub ? new Date(pub).toISOString() : null });
  }
  return items;
}

export async function marketingNews(max = 8) {
  const key = 'marketing_news';
  const cached = cacheGet(key);
  if (cached) return cached;
  const items = [];
  for (const feed of FEEDS) {
    try {
      const xml = await fetchText(feed.url, 7000);
      items.push(...parseRss(xml, feed.name, feed.tag));
      if (items.length >= max) break;
    } catch { /* feed down — skip */ }
  }
  const out = { fetched_at: now(), items: items.slice(0, max) };
  cacheSet(key, out);
  return out;
}

// ---------------- live program lookups: Wikipedia + search ----------------
export async function programIntel(programName) {
  // try Wikipedia first, then web search snippets
  const wiki = await wikiSummary(programName.replace(/\s+\(.*?\)/, '').trim());
  let search = null;
  try {
    search = await webSearch(`${programName} affiliate program commission`, 4);
  } catch { /* ignore */ }
  return { wiki, search: search?.items || [], fetched_at: now() };
}

// ---------------- page fetch (assistant "research this URL") ----------------
export async function peekUrl(url, maxChars = 1200) {
  const key = `peek:${url.slice(0, 140)}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  try {
    const html = await fetchText(url, 8000);
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
    const desc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i) || [])[1] || '';
    const text = stripHtml(html).slice(0, maxChars);
    const out = { fetched_at: now(), url, title: stripHtml(title).slice(0, 200), description: desc.slice(0, 300), text };
    cacheSet(key, out);
    return out;
  } catch (e) {
    return { fetched_at: now(), url, error: `Could not fetch ${url} (${e.message})` };
  }
}

// ---------------- live market pulse (for Opportunities header) ----------------
export async function marketPulse() {
  const [hn, news] = await Promise.all([hnTrending(5), marketingNews(6)]);
  return { fetched_at: now(), tech: hn.items, marketing: news.items };
}
