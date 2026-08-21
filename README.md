# LinkPilot — Affiliate Business Automation Suite

A full-stack, production-style workspace for affiliate marketers & influencers: smart tracking links,
campaigns, networks, payouts, a **live opportunities hub grouped by affiliate type**, a **strategy engine**
that prepares promotion plans, and an **AI copilot with real web access** — in two modes:
**Account** (real tracking & connections) and **Guest/Demo** (fully functional, virtual data for practice).

**Stack:** Node.js + Express · SQLite (better-sqlite3) · React 18 (esbuild bundle) · no external services required.

---

## Quick start

```bash
./start.sh            # installs deps if needed, builds the UI, starts the server
# → http://localhost:3000
```

Manual equivalent:

```bash
npm install
npm run build         # bundles src/*.jsx → public/app.js (esbuild)
npm start             # node server.js
```

> Data persists in `data/linkpilot.db` (SQLite). Delete that file to reset the demo seed.

---

## Two modes

| | 🎓 Guest / Demo | ✅ Account |
|---|---|---|
| Entry | “Continue as guest” on the login page | Register or sign in |
| Data | Seeded with 92 days of realistic data — **virtual, for learning** | Your real data |
| Link clicks | Logged, but the visit is **simulated** (no redirect to merchants) | Real 302 redirects to the merchant |
| Webhooks | Test delivery is simulated | Real HTTP delivery |
| API keys / postbacks | Work against your virtual workspace | Work with live systems |
| Everything else | Identical — full features | Identical — full features |

The demo workspace is shared (one guest account), so your practice clicks and notes persist while you learn.

---

## What's inside

### 📊 Dashboard
Revenue/clicks/conversions/EPC KPIs with deltas & sparklines, interactive area chart (7/30/90d, metric toggle),
network revenue donut, top links, referrer bars, live activity feed.

### 🚀 Opportunities — offers grouped by affiliate type
- **12 affiliate types**, each with its own feature set: Physical Products & Retail, Software & SaaS, Digital
  Products & Courses, Finance & High-Ticket, Travel, Fashion & Beauty, Web Hosting & Domains, VPN & Cybersecurity,
  Education, Health & Fitness, Creator & Freelance Tools, Gaming & Entertainment.
- **51 real programs** (Amazon, Shopify, NordVPN, ClickBank, Chase, Booking.com…) with commission rates & types,
  cookie windows, EPC, payout terms, approval difficulty, pros/cons and current promos.
- **Live market pulse** — real-time Hacker News tech trends + marketing/affiliate news from RSS
  (Search Engine Journal, Moz, Ahrefs, SE Land…), fetched and cached on the server.
- Search, sort by opportunity score / EPC / growth, per-type feature panels.

### 🎯 Strategies
One click on any offer generates a complete promotion plan — positioning, prioritized channels with reasoning,
content ideas, click-boosting tactics, funnel, KPIs, 30-day timeline and risks — saved to your Strategies library.
The AI copilot can generate strategies for any program too.

### ✨ AI Assistant (copilot with web access)
- **Live web research**: searches the web (DuckDuckGo Lite + Hacker News Algolia), reads Wikipedia summaries,
  pulls RSS news, and can fetch any URL you paste.
- **Knows your data**: "Analyze my performance" reads your real dashboard numbers (revenue, CR, EPC, top links,
  traffic sources, pending payouts).
- **Knows the market**: rates, cookies, EPC, growth for 51 programs across 12 types; comparisons ("Compare
  ClickBank vs Amazon Associates"); type guidance for beginners.
- **Acts for you**: buttons that create links, add networks, open pages, or run follow-up prompts.
- Sources are shown under every live answer.
- Optional **LLM upgrade**: add an OpenAI-compatible API key in Settings → AI copilot provider; answers fall back
  to the built-in engine automatically if the LLM call fails.

### 🔗 Links, Campaigns, Networks, Payouts, Integrations, Settings
Everything from v1: full CRUD with optimistic updates, per-link analytics drawer (time series, referrers,
countries, devices), CSV export, real redirects at `/r/{slug}`, webhooks with test-sender, REST tracking API
(`POST /api/v1/track`), network postback/IPN endpoints (`/api/v1/postback/:network`), API-key management,
profile & security settings, dark/light themes, responsive layout with mobile drawer.

---

## The "web access" layer — how it works

The server fetches live data from public endpoints (no keys needed), cached for 15 minutes in SQLite:

| Source | Used for |
|---|---|
| Hacker News API + Algolia | trending tech/products, discussion search |
| DuckDuckGo Lite | web search snippets |
| Wikipedia REST API | program/term summaries |
| Marketing RSS (SEJ, Moz, Ahrefs, SE Land, Martech Zone) | live marketing & affiliate news |
| Any URL | “research this URL” page fetching |

All fetches are timeout-bounded and degrade gracefully — if a source is unreachable, the copilot says so and
answers from the market database + your data instead.

---

## API surface (new in v2)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/guest` | enter the shared demo workspace |
| GET | `/api/types` | affiliate types with per-type features |
| GET | `/api/programs?type=&q=&sort=` | market programs |
| GET | `/api/programs/:id` | program detail |
| GET | `/api/programs/:id/strategy` | generates & persists a strategy |
| GET / DELETE | `/api/strategies` / `/api/strategies/:id` | strategy library |
| GET | `/api/research/pulse` | live market pulse (HN + RSS) |
| GET | `/api/research/search?q=` | live web search |
| GET / DELETE | `/api/assistant/history` | chat history |
| POST | `/api/assistant/chat` | `{ message, research }` → `{ text, actions, sources, engine, live }` |
| GET / PUT | `/api/settings/ai` | optional OpenAI-compatible LLM config |

Plus all v1 endpoints (auth, stats, links, campaigns, networks, payouts, keys, webhooks, tracking).

---

## Project layout

```
server.js            Express app: REST API + tracking engine + assistant routes
lib/db.js            SQLite schema & helpers
lib/seed.js          92-day demo dataset (guest workspace)
lib/market.js        12 affiliate types + 51 programs (knowledge base)
lib/research.js      live web layer (search, HN, Wikipedia, RSS, caching)
lib/assistant.js     AI engine: intents, strategies, comparisons, analysis, LLM passthrough
src/main.jsx         boot, hash router, toasts, confirm dialogs
src/layout.jsx       sidebar + topbar + demo banner
src/ui.jsx           design-system primitives
src/charts.jsx       hand-rolled SVG charts
src/pages/*.jsx      dashboard, opportunities, assistant, links, campaigns, networks,
                     payouts, strategies, integrations, settings, auth
public/              static shell, demo-visit page, fonts, built app.js
data/linkpilot.db    persistent SQLite database
shots/               page screenshots from the QA run
test-*.mjs           Playwright QA suites (50 assertions across 3 files)
```

## Running the QA suite (optional)

```bash
npm i -D playwright-core && npx playwright-core install chromium
node test-e2e.mjs      # 25 core assertions
node test-new.mjs      # 25 v2 assertions (guest mode, opportunities, assistant, strategies)
node test-visual.mjs   # regenerates shots/*.png
node test-mobile.mjs   # responsive sidebar + theme
```

## Deployment on Vercel (free tier, full functionality)

> **Why the earlier 500 happened:** Vercel runs serverless functions on a read-only filesystem,
> so the app can't keep a local SQLite file there. LinkPilot now ships with a storage adapter:
> **local SQLite for development** and **Turso (cloud SQLite, free tier)** when
> `TURSO_DATABASE_URL` is set. The SQL is identical on both, so every feature — tracking
> redirects, webhooks, the AI copilot with live research, both account modes — works on Vercel.

### Step 1 — Push this repo to GitHub (if not already done)

```bash
git remote add origin <your-repo-url> && git push -u origin main
```

### Step 2 — Create the Turso database (2 min)

Easiest path — via the Vercel dashboard (no CLI needed):

1. Open your project in Vercel → **Integrations** → search **Turso** → **Add**
2. Sign in with GitHub → **Create database** → name it `linkpilot`, pick a region near you
3. Vercel auto-injects `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` into your project

Alternative — via the Turso CLI:

```bash
curl -sSfL https://get.tur.so/install.sh | bash
turso auth signup          # or: turso auth login
turso db create linkpilot
turso db show linkpilot --url            # → TURSO_DATABASE_URL
turso db tokens create linkpilot         # → TURSO_AUTH_TOKEN
```

### Step 3 — Deploy on Vercel (2 min)

1. **vercel.com → Add New → Project →** import the repository
2. Framework preset: **Other** (it's a plain Node app; `vercel.json` is included)
3. Set the two environment variables:
   - `TURSO_DATABASE_URL`  — e.g. `libsql://linkpilot-<you>.turso.io`
   - `TURSO_AUTH_TOKEN`    — the token from step 2
4. Click **Deploy** — Vercel runs `npm install && npm run build` automatically
   (build command is set in `vercel.json`)

That's it. The app self-seeds the demo workspace on first request, and all data
(clicks, links, chat history, strategies…) lives in Turso and survives redeploys.
Local development keeps using a plain SQLite file with zero configuration.

### Troubleshooting

**"This serverless function has crashed" / 500 errors**
- The single most common cause: the app is running on Vercel **without the Turso environment
  variables**. The app now detects this and shows a clear **"Storage setup required"** page with
  instructions instead of crashing. Add `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` and redeploy.
- Check **Project → Functions → Logs** for the actual error and the health endpoint
  (`your-app.vercel.app/api/health`) — it reports the storage mode.

**Deployment fails at the build step**
- LinkPilot has **no native modules** (the data layer is pure-JS libSQL), so Vercel's bundler
  cannot fail on native compilation. If the build still fails, check the build log for
  `npm install` errors — usually a network hiccup; retry the deploy.

**First request is slow**
- The very first request seeds the demo workspace (≈23k demo clicks) into Turso. Subsequent
  requests are fast. If two cold starts race, both seeders detect the race and continue safely.

### Architecture notes

| Layer | Vercel | Local |
|---|---|---|
| Storage | Turso (libSQL over HTTP) | SQLite file in `data/` |
| Server | `api/app.js` — the whole Express app as one serverless function | `node server.js` |
| Static UI | `public/` via `vercel.json` rewrites | `express.static` |
| Session cookies | httpOnly + Secure | httpOnly |

- Function timeout is 60s (`vercel.json`) — enough for live web research in the copilot.
- The redirect engine (`/r/:slug`) logs referrer, country (via `Accept-Language`) and device
  from the proxied request headers, exactly like local mode.
- If you'd rather host elsewhere, `render.yaml` (Render) and `railway.json` (Railway) are
  still included; any VPS works with `npm install && npm run build && npm start`.

## Project layout

```
server.js            Express app: REST API + tracking engine + assistant routes
lib/db.js            SQLite schema & helpers
lib/seed.js          92-day demo dataset (guest workspace)
lib/market.js        12 affiliate types + 51 programs (knowledge base)
lib/research.js      live web layer (search, HN, Wikipedia, RSS, caching)
lib/assistant.js     AI engine: intents, strategies, comparisons, analysis, LLM passthrough
src/main.jsx         boot, hash router, toasts, confirm dialogs
src/layout.jsx       sidebar + topbar + demo banner
src/ui.jsx           design-system primitives
src/charts.jsx       hand-rolled SVG charts
src/pages/*.jsx      dashboard, opportunities, assistant, links, campaigns, networks,
                     payouts, strategies, integrations, settings, auth
public/              static shell, demo-visit page, fonts, built app.js
data/linkpilot.db    persistent SQLite database
shots/               page screenshots from the QA run
test-*.mjs           Playwright QA suites (50 assertions across 3 files)
```

## Running the QA suite (optional)

```bash
npm i -D playwright-core && npx playwright-core install chromium
node test-e2e.mjs      # 25 core assertions
node test-new.mjs      # 25 v2 assertions (guest mode, opportunities, assistant, strategies)
node test-visual.mjs   # regenerates shots/*.png
node test-mobile.mjs   # responsive sidebar + theme
```

## Deployment (cloud hosting)

> ⚠️ **Vercel will crash with a 500 error** — its serverless functions run on a read-only
> filesystem, so the app cannot create its SQLite database or run as a long-lived server.
> Use Render or Railway instead.

### Render (easiest — one click)

1. Push this repo to GitHub.
2. Go to **render.com → New → Blueprint** and select the repository — `render.yaml` is included,
   so the web service, build command and a **persistent disk** (mounted at `/var/data`, used via
   `DATA_DIR=/var/data`) are configured automatically.
3. Open the app URL. Done — your data survives restarts and redeploys.

Manual (if not using the blueprint): new **Web Service** → build `npm install && npm run build`,
start `node server.js`, add env var `DATA_DIR=/var/data`, and attach a **disk** at `/var/data`.

### Railway

1. **railway.com → New Project → Deploy from GitHub repo** — `railway.json` handles the build/start.
2. In the service: **Settings → Volumes → Add volume** (mount path `/data`), then add env var
   `DATA_DIR=/data`.
3. Generate a domain in the **Networking** tab.

### Any VPS (DigitalOcean, Hetzner, AWS…)

```bash
git clone <your-repo-url> && cd <repo>
npm install && npm run build
npm start                # or: nohup npm start &
# → http://your-server:3000 (reverse-proxy with nginx/caddy if you want port 80/443)
```

The database lives in `data/linkpilot.db` (override with the `DATA_DIR` env var).
The demo workspace seeds itself on first boot.

### What about Vercel?

If you must stay on Vercel, the app would need its storage migrated from SQLite to
Postgres/Neon (Vercel's file system is read-only). That's a data-layer migration — ask if you
want it, but Render/Railway/VPS run LinkPilot as-is with zero changes.
