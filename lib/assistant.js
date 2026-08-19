import { db, now, daysAgo } from './db.js';
import { hnTrending, webSearch, wikiSummary, marketingNews, programIntel, peekUrl } from './research.js';

// ============================================================
// LinkPilot Assistant — intent-driven engine that composes
// answers from: live web research, the market knowledge base,
// and the user's own real-time data. Optional LLM passthrough
// if the user configures an OpenAI-compatible API key.
// ============================================================

const progByName = (name) => {
  const clean = name.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const all = db.prepare('SELECT p.*, t.name AS type_name, t.icon AS type_icon FROM programs p JOIN affiliate_types t ON t.slug = p.type_slug').all();
  let best = null, bestScore = 0;
  for (const p of all) {
    const pc = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (pc === clean) return p;
    if (pc.includes(clean) || clean.includes(pc)) {
      const score = Math.min(pc.length, clean.length) / Math.max(pc.length, clean.length);
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (pc.split('').filter((c, i) => c === clean[i]).length >= 4 && scoreCheck(pc, clean) > bestScore) {
      bestScore = scoreCheck(pc, clean); best = p;
    }
  }
  return bestScore > 0.55 ? best : null;
};
const scoreCheck = (a, b) => {
  let s = 0; for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] === b[i]) s++;
  return s / Math.max(a.length, b.length);
};

const typeByName = (name) => {
  const t = db.prepare('SELECT * FROM affiliate_types WHERE lower(name) LIKE ? OR lower(tagline) LIKE ?').get(`%${name.toLowerCase()}%`, `%${name.toLowerCase()}%`);
  return t || null;
};

const TYPE_KEYWORDS = {
  retail: ['physical', 'retail', 'product', 'amazon', 'ecommerce store', 'marketplace', 'shopping'],
  saas: ['saas', 'software', 'tool', 'app subscription', 'b2b'],
  digital: ['digital', 'ebook', 'e-book', 'course', 'info', 'clickbank', 'digistore', 'membership'],
  finance: ['finance', 'credit card', 'banking', 'trading', 'invest', 'crypto', 'loan', 'fintech'],
  travel: ['travel', 'hotel', 'flight', 'booking', 'trip', 'tour'],
  fashion: ['fashion', 'beauty', 'clothing', 'makeup', 'apparel', 'skincare'],
  hosting: ['hosting', 'domain', 'web host', 'bluehost', 'hostinger', 'vps', 'website builder'],
  vpn: ['vpn', 'privacy', 'cybersecurity', 'security tool'],
  education: ['education', 'learning', 'course platform', 'language', 'elearning', 'e-learning', 'skill'],
  health: ['health', 'fitness', 'supplement', 'meal kit', 'wellness', 'diet'],
  creator: ['creator', 'freelance', 'fiverr', 'upwork', 'side hustle', 'design tool'],
  gaming: ['gaming', 'games', 'twitch', 'stream', 'esports', 'fortnite'],
};

function detectType(text) {
  const t = text.toLowerCase();
  for (const [slug, kws] of Object.entries(TYPE_KEYWORDS)) {
    if (kws.some(k => t.includes(k))) return slug;
  }
  return null;
}

// ------------------------------------------------------------ strategy generator
function strategyFor(program, userData) {
  const type = db.prepare('SELECT * FROM affiliate_types WHERE slug = ?').get(program.type_slug);
  const bestFor = JSON.parse(program.best_for || '[]');
  const pros = JSON.parse(program.pros || '[]');
  const channels = type.best_channels.split('·').map(s => s.trim()).filter(Boolean);
  const rev = program.commission_type === 'CPA' || program.commission_type.includes('CPA')
    ? `$${program.rate_min}–$${program.rate_max} per action`
    : `${program.rate_label}`;

  const angles = bestFor.map(b => `"${b} — ${program.name}" content series`);

  const content = {
    goal: `Promote ${program.name} (${program.network}) — ${rev}, ${program.cookie_days}-day cookie, typical EPC $${program.epc.toFixed(2)}.`,
    positioning: `Position ${program.name} for audiences researching ${(bestFor[0] || 'this topic').toLowerCase()} with intent to act. Lead with the outcome ("what they'll get"), then handle objections (price, alternatives, trust).`,
    channels: channels.map((c, i) => ({ channel: c, priority: i + 1, why: channelWhy(c, program) })),
    content_ideas: [
      `The honest ${program.name} review (2026) — with real test screenshots/results`,
      `${program.name} vs ${competitorOf(program)}: which is actually better?`,
      `How to get started with ${program.name} in 15 minutes (tutorial)`,
      ...angles.slice(0, 3),
      `Is ${program.name} worth it? Pricing breakdown + hidden costs`,
    ],
    click_tactics: clickTactics(program, type),
    funnel: [
      'Awareness: searchable guide or short video targeting an intent keyword',
      'Consideration: comparison/FAQ content with the affiliate link placed above the fold',
      'Click: short link with UTM (utm_source=content-type) to measure placement',
      'Convert: land them on a page with the exclusive promo/discount visible',
      'Follow-up: retarget via email list or remarketing to recover abandoned clicks',
    ],
    kpis: {
      ctr_target: '1.5–3% from content to link click',
      cr_target: `1–${Math.max(2, Math.round(program.epc / (program.rate_max || 20) * 100))}% click-to-conversion (typical for this program type)`,
      revenue_estimate: `At 1,000 clicks/mo × EPC $${program.epc.toFixed(2)} ≈ $${(program.epc * 1000).toFixed(0)}/mo`,
    },
    timeline: [
      'Week 1: publish review + tutorial, insert short links with UTM tags',
      'Week 2: publish comparison content; share clips on social/YouTube Shorts',
      'Week 3: launch email sequence to list; test 2 headlines per article',
      'Week 4: review dashboard — double down on the top-3 referrers, kill losers',
    ],
    risks: [
      `Rates/cookies may change — re-check ${program.network} terms monthly`,
      program.approval === 'Hard' ? 'Approval is competitive — build 3+ relevant posts before applying' : `Approval is ${program.approval.toLowerCase()} — a focused niche site is enough`,
    ],
  };
  const userTop = (userData?.topLinks || []).slice(0, 3);
  if (userTop.length) {
    content.click_tactics.push(`Apply what already works for you: your top link "${userTop[0].name}" (${userTop[0].clicks_recent} clicks/30d) is getting traffic — give ${program.name} the same placement.`);
  }
  return content;
}

function competitorOf(program) {
  const peers = db.prepare('SELECT name FROM programs WHERE type_slug = ? AND name != ? ORDER BY popularity DESC LIMIT 1').get(program.type_slug, program.name);
  return peers ? peers.name : 'the top alternative';
}

function channelWhy(channel, program) {
  const map = {
    'SEO': `Evergreen intent keywords for ${program.name} ("best X for Y") compound for years and match its ${program.cookie_days}-day cookie`,
    'YouTube': `Tutorials & reviews convert at 2–4× text rates — ideal for a ${program.commission_type} program with $${program.epc.toFixed(2)} EPC`,
    'Email': 'Your list already trusts you — product launches to engaged subscribers beat cold traffic 10:1',
    'Communities': 'Reddit/Discord answers bypass ad blindness; genuine recommendations drive the highest CR',
    'Newsletters': `Newsletter sponsorships in your niche put ${program.name} in front of pre-qualified buyers`,
    'Podcasts': 'Long-form trust building; host-read ads feel like personal recommendations',
    'TikTok/Reels': 'Short demo clips reach cold audiences cheaply — pair with bio link or comments pin',
    'Pinterest': 'Evergreen visual pins keep generating clicks for months with zero upkeep',
  };
  for (const [k, v] of Object.entries(map)) if (channel.toLowerCase().includes(k.toLowerCase())) return v;
  return `High-intent audience fit for ${program.name}'s category`;
}

function clickTactics(program, type) {
  const base = [
    `Place the short link above the fold — links in the first 300 words get ~3× more clicks`,
    `Use UTM params per placement (utm_source=youtube, utm_medium=description) to know exactly what works`,
    `Add a contextual call-to-action: "Check current ${program.name} pricing →" outperforms bare links`,
    `Pin the link in video comments / bio — mobile viewers rarely open descriptions`,
    `Refresh content when ${program.name} changes pricing or promo — stale pages lose CTR`,
  ];
  const typed = {
    retail: ['Use seasonal hooks: "Prime Day picks", "Black Friday gift guide" in titles', 'Swap in items on sale — discounts in the title raise CTR ~30%'],
    saas: ['Offer the free trial before the link: "Try X free →" converts tire-kickers', 'Screenshot the dashboard in reviews — proof raises trial signups'],
    digital: ['Pre-sell the outcome: "learn X in 30 days" headlines beat product names', 'Build an email sequence — digital offers need 5–7 touches'],
    finance: ['Use comparison tables (fees, bonuses) — they win featured snippets and clicks', 'Disclose affiliation clearly — trust is the whole game in finance'],
    travel: ['Add "book early" urgency near seasonal dates', 'Embed a map/itinerary widget — visual context raises booking clicks'],
    fashion: ['Tag products within 24h of posting for algorithm boost', 'Create shoppable lookbooks; one page per outfit = multiple links per visit'],
    hosting: ['Show a live demo site hosted on your recommendation', 'Target "how to start a blog" — highest-intent hosting keyword in existence'],
    vpn: ['Use your exclusive discount in the link text: "70% off →" lifts CTR sharply', 'Run a real speed test video — proof content converts better than claims'],
    education: ['Bundle free resources + paid course link in one guide', 'Time content to January and September enrollment spikes'],
    health: ['Use first-box discounts as email lead magnets', 'Realistic results only — compliance protects commissions long-term'],
    creator: ['Show real gig earnings screenshots — social proof converts freelancers', 'Create tool-comparison matrices your audience can bookmark'],
    gaming: ['Add the link to stream overlays and !commands', 'Time setup videos around hardware/game launches'],
  };
  return [...base, ...(typed[program.type_slug] || [])];
}

// ------------------------------------------------------------ compare
function comparePrograms(a, b) {
  const lines = [];
  const row = (label, fa, fb, fmt = (x) => x) => lines.push(`| ${label} | ${fmt(fa)} | ${fmt(fb)} |`);
  lines.push('| Aspect | ' + a.name + ' | ' + b.name + ' |');
  lines.push('|---|---|---|');
  row('Type', a.type_name, b.type_name);
  row('Commission', a.rate_label, b.rate_label);
  row('Cookie', `${a.cookie_days} days`, `${b.cookie_days} days`);
  row('Typical EPC', `$${a.epc.toFixed(2)}`, `$${b.epc.toFixed(2)}`);
  row('Approval', a.approval, b.approval);
  row('Payout min', `$${a.min_payout}`, `$${b.min_payout}`);
  row('Trend', `${a.growth > 0 ? '+' : ''}${a.growth}%/yr`, `${b.growth > 0 ? '+' : ''}${b.growth}%/yr`);
  const verdict = a.epc >= b.epc ? a : b;
  lines.push('');
  lines.push(`**Verdict:** ${verdict.name} wins on raw earning potential (EPC $${verdict.epc.toFixed(2)}). ${a === b ? '' : (a.cookie_days > b.cookie_days ? `${a.name} has the longer cookie — better for content that converts late.` : `${b.name} has the longer cookie — better for content that converts late.`)} Best play: run both — ${a.name} for ${a.type_name.toLowerCase()} intent, ${b.name} for ${b.type_name.toLowerCase()} intent.`);
  return lines.join('\n');
}

// ------------------------------------------------------------ top programs
function topPrograms(slug, sort = 'opportunity', limit = 6) {
  const where = slug ? 'WHERE type_slug = ?' : '';
  const params = slug ? [slug] : [];
  const order = sort === 'epc' ? 'epc DESC' : sort === 'growth' ? 'growth DESC' : '(epc * 0.5 + growth * 0.3 + popularity * 0.2) DESC';
  const rows = db.prepare(`SELECT p.*, t.name AS type_name FROM programs p JOIN affiliate_types t ON t.slug = p.type_slug ${where} ORDER BY ${order} LIMIT ?`).all(...params, limit);
  return rows;
}

// ------------------------------------------------------------ main engine
export async function assistantReply(userId, message, opts = {}) {
  const msg = String(message || '').trim();
  const live = opts.research !== false; // default: use live web

  const user = db.prepare('SELECT id, name, is_demo FROM users WHERE id = ?').get(userId);
  const userData = getUserContext(userId);
  const reply = { text: '', actions: [], sources: [], engine: 'builtin', live: false };

  const say = (t) => { reply.text = t; };
  const addSource = (title, url) => { if (reply.sources.length < 6) reply.sources.push({ title: String(title).slice(0, 120), url }); };

  // ----- try LLM passthrough if configured
  const llm = await tryLlm(userId, msg, userData);
  if (llm) { reply.text = llm; reply.engine = 'llm'; return reply; }

  const m = msg.toLowerCase();

  // ----- greetings / help
  if (/^(hi|hello|hey|yo|salam|assalam|good (morning|evening|afternoon))\b/.test(m) && m.length < 40) {
    say(`Hey ${user.name.split(' ')[0]}! 👋 I'm your LinkPilot copilot with live web access.\n\nI can help you with things like:\n- **"Best offers in SaaS right now"** — ranked programs with rates\n- **"Make me a strategy for NordVPN"** — full promotion plan\n- **"How do I get more clicks on my links?"** — traffic tactics\n- **"Compare ClickBank vs Amazon Associates"**\n- **"What's trending in tech this week?"** — live web data\n- **"Analyze my performance"** — your real dashboard numbers\n\nWhat are we working on?`);
    return reply;
  }

  // ----- strategy requests
  const stratMatch = m.match(/(strategy|plan|game ?plan|roadmap|how (?:do|should) i (?:promote|market|sell|start with))\s+(?:for\s+)?(.+)/i);
  if (stratMatch) {
    const target = (stratMatch[2] || '').replace(/[?.!]+$/, '').trim();
    const prog = progByName(target) || progByName(target.replace(/\b(the|a|an)\b/g, '').trim());
    if (prog) {
      const s = strategyFor(prog, userData);
      const type = db.prepare('SELECT * FROM affiliate_types WHERE slug = ?').get(prog.type_slug);
      const parts = [];
      parts.push(`# Promotion strategy: ${prog.name}\n`);
      parts.push(`**The opportunity** — ${s.goal}\n`);
      parts.push(`**Positioning** — ${s.positioning}\n`);
      parts.push(`**Channels (prioritized)**\n${s.channels.map(c => `- ${c.priority}. **${c.channel}** — ${c.why}`).join('\n')}\n`);
      parts.push(`**Content ideas**\n${s.content_ideas.map(c => `- ${c}`).join('\n')}\n`);
      parts.push(`**Click-boosting tactics**\n${s.click_tactics.map(c => `- ${c}`).join('\n')}\n`);
      parts.push(`**Funnel**\n${s.funnel.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n`);
      parts.push(`**KPIs**\n- CTR target: ${s.kpis.ctr_target}\n- Conversion target: ${s.kpis.cr_target}\n- Revenue potential: ${s.kpis.revenue_estimate}\n`);
      parts.push(`**30-day timeline**\n${s.timeline.map(t => `- ${t}`).join('\n')}\n`);
      parts.push(`**Watch out**\n${s.risks.map(r => `- ${r}`).join('\n')}`);
      say(parts.join('\n'));
      reply.actions = [
        { label: `Track ${prog.name} as a network`, type: 'track_program', payload: { name: prog.name, color: '#6366f1', commission_rate: prog.rate_max, cookie_days: prog.cookie_days } },
        { label: `Create a link for ${prog.name}`, type: 'create_link', payload: { name: prog.name, destination_url: prog.url, network: prog.network } },
        { label: 'Open Opportunities hub', type: 'navigate', payload: { page: 'opportunities' } },
      ];
      // persist strategy
      db.prepare('INSERT INTO strategies (user_id, program_id, title, content, created_at) VALUES (?,?,?,?,?)')
        .run(userId, prog.id, `${prog.name} — promotion strategy`, JSON.stringify(s), now());
      if (live) {
        try {
          const intel = await programIntel(prog.name);
          if (intel.wiki) {
            parts.push('');
            reply.text += `\n\n**Live web intel (${prog.name}):** ${intel.wiki.extract.slice(0, 380)}…`;
            addSource(intel.wiki.title, intel.wiki.url);
            reply.live = true;
          }
        } catch { /* ignore */ }
      }
      return reply;
    }
    const typeSlug = detectType(target);
    if (typeSlug) {
      const type = db.prepare('SELECT * FROM affiliate_types WHERE slug = ?').get(typeSlug);
      const tops = topPrograms(typeSlug, 'opportunity', 3);
      const parts = [`# Strategy for ${type.name} offers\n\n**The play:** ${type.description}\n\n**Average commissions:** ${type.avg_commission} · **Best channels:** ${type.best_channels}\n\n**Top 3 programs to start with:**\n${tops.map((p, i) => `${i + 1}. **${p.name}** — ${p.rate_label}, ${p.cookie_days}d cookie, EPC $${p.epc.toFixed(2)}`).join('\n')}\n\nAsk me for a full strategy on any of these — e.g. "strategy for ${tops[0].name}".`];
      say(parts.join('\n'));
      reply.actions = tops.slice(0, 2).map(p => ({ label: `Full strategy for ${p.name}`, type: 'prompt', payload: { prompt: `Create a strategy for ${p.name}` } }));
      return reply;
    }
  }

  // ----- compare
  const cmp = m.match(/(compare|vs\.?|versus|or)\s+(.+)\s+(and|vs\.?|versus|or)\s+(.+)/i);
  if (cmp) {
    const a = progByName(cmp[2].trim()), b = progByName(cmp[4].trim());
    if (a && b) {
      say(comparePrograms(a, b));
      reply.actions = [
        { label: `Strategy for ${a.name}`, type: 'prompt', payload: { prompt: `Create a strategy for ${a.name}` } },
        { label: `Strategy for ${b.name}`, type: 'prompt', payload: { prompt: `Create a strategy for ${b.name}` } },
      ];
      return reply;
    }
    if (a) say(`I know **${a.name}** but couldn't find the other program. Try naming it differently, or ask for "best offers in ${a.type_name.toLowerCase()}".`);
    else say('I couldn\'t match both programs. Name them precisely — e.g. "compare NordVPN and Surfshark".');
    return reply;
  }

  // ----- more clicks / traffic
  if (/(more|increase|boost|grow|improve).*(clicks|traffic|ctr|visitors)|(clicks|traffic).*(more|increase|boost)/.test(m)) {
    const parts = ['# How to increase clicks on your affiliate links\n'];
    parts.push('Here\'s a prioritized playbook — mix and match for your niche:\n');
    parts.push('**1. Placement (highest leverage)**\n- Move links above the fold — first 300 words get ~3× the clicks\n- Use contextual CTAs: "Check today\'s price →" instead of bare URLs\n- Pin links in video comments/bios — most mobile viewers never open descriptions\n');
    parts.push('**2. Intent targeting**\n- Create "best X for Y" and "X vs Y" content — comparison searchers click 2× more\n- Answer the exact question in the H2 where the link sits\n');
    parts.push('**3. Distribution**\n- Cut each article into 3–5 short videos (TikTok/Reels/Shorts) linking back\n- Post answers in communities (Reddit/Discord) where your audience asks questions\n- Reshare evergreen content monthly with a fresh angle\n');
    parts.push('**4. Conversion psychology**\n- Use the exclusive discount in the anchor text ("70% off →")\n- Add urgency near real deadlines (sales, seasons, stock)\n- Add social proof next to links ("what 4,000 readers chose")\n');
    parts.push('**5. Measure & iterate**\n- UTM-tag every placement to find the 20% that performs\n- Double down on the top 2 referrers; cut the bottom 2\n- A/B test headlines — the #1 lever in content marketing\n');
    if (userData.topLinks?.length) {
      const top = userData.topLinks[0];
      parts.push(`**Your data:** your best link is **${top.name}** (${top.clicks_recent} clicks/30d from mostly ${userData.topReferrers?.[0]?.referrer || 'mixed sources'}). Clone its placement pattern for your other links.`);
    }
    say(parts.join('\n'));
    reply.actions = [
      { label: 'Show my top links', type: 'navigate', payload: { page: 'links' } },
      { label: 'Get a strategy for an offer', type: 'navigate', payload: { page: 'opportunities' } },
    ];
    return reply;
  }

  // ----- my performance
  if (/(my|our).*(stats|performance|numbers|data|dashboard|revenue|report|analysis|how am i doing|analyze)/.test(m) || /analy[sz]e (my|the)/.test(m)) {
    const o = userData.overview;
    if (!o || o.clicks === 0) {
      say('Your workspace doesn\'t have tracked data yet — everything is at zero. **Create your first link** and share it, then come back for a real analysis! 📈');
      reply.actions = [{ label: 'Create your first link', type: 'create_link', payload: {} }];
      return reply;
    }
    const parts = [];
    parts.push('# Your performance analysis 📊\n');
    parts.push(`**Last 30 days:** $${o.revenue.toFixed(2)} revenue · ${o.clicks.toLocaleString()} clicks · ${o.conversions} conversions · CR ${o.cr.toFixed(1)}% · EPC $${o.epc.toFixed(2)}\n`);
    const delta = ((o.revenue - o.revenuePrev) / (o.revenuePrev || 1)) * 100;
    parts.push(`**Momentum:** revenue is ${delta >= 0 ? 'up' : 'down'} ${Math.abs(delta).toFixed(0)}% vs the previous period. ${delta >= 0 ? 'Keep scaling what works.' : 'Focus on refreshing top content and re-testing headlines.'}\n`);
    if (userData.topLinks?.length) {
      parts.push('**Your top links:**\n' + userData.topLinks.slice(0, 5).map((l, i) => `${i + 1}. **${l.name}** — ${l.clicks_recent} clicks · $${l.revenue_recent.toFixed(2)} (${l.network_name || 'no network'})`).join('\n'));
      const best = userData.topLinks[0];
      parts.push(`\n**Insight:** ${best.name} is your engine. Strategy: build 2–3 more pieces around its exact topic, add a comparison article, and cross-link them.`);
    }
    if (userData.topReferrers?.length) {
      parts.push(`\n**Traffic sources:** ${userData.topReferrers.slice(0, 3).map(r => `${r.referrer} (${r.clicks})`).join(' · ')}. ${userData.topReferrers[0]?.clicks > o.clicks * 0.4 ? 'You\'re over-reliant on one source — diversify to reduce risk.' : 'Nice channel mix — now double the best one.'}`);
    }
    if (userData.pendingPayouts) {
      parts.push(`\n**Money watch:** $${userData.pendingPayouts.toFixed(2)} in pending payouts across networks — chase anything older than 2 weeks.`);
    }
    say(parts.join('\n'));
    reply.actions = [
      { label: 'Open dashboard', type: 'navigate', payload: { page: 'dashboard' } },
      { label: 'Review payouts', type: 'navigate', payload: { page: 'payouts' } },
    ];
    return reply;
  }

  // ----- trending / news / live
  if (/(trend|news|happening|latest|live|pulse|this week|today)/.test(m) || /what.?s (hot|new|popular)/.test(m)) {
    if (!live) { say('Live research is off. Re-enable the "live web research" toggle in the chat header and I\'ll fetch fresh data.'); return reply; }
    const hn = await hnTrending(6);
    const news = await marketingNews(5);
    const parts = ['# Live market pulse 🔴\n'];
    if (hn.items.length) {
      parts.push('**Trending in tech/product land (Hacker News, live):**\n' + hn.items.map(s => `- ${s.title} _(+${s.score})_`).join('\n'));
      hn.items.slice(0, 3).forEach(s => addSource(s.title, s.url));
      reply.live = true;
    }
    if (news.items.length) {
      parts.push('\n**Marketing & affiliate news (RSS, live):**\n' + news.items.map(s => `- ${s.title} _(${s.source})_`).join('\n'));
      news.items.slice(0, 3).forEach(s => addSource(s.title, s.url));
      reply.live = true;
    }
    if (!hn.items.length && !news.items.length) {
      parts.push('Live sources are unreachable right now. Meanwhile, the highest-growth programs in our market database are:\n' + topPrograms(null, 'growth', 5).map(p => `- **${p.name}** (${p.type_name}) — ${p.rate_label}, +${p.growth}%/yr trend`).join('\n'));
    } else {
      parts.push('\n**Highest-growth programs right now (market DB):**\n' + topPrograms(null, 'growth', 5).map(p => `- **${p.name}** (${p.type_name}) — ${p.rate_label}, +${p.growth}%/yr`).join('\n'));
    }
    say(parts.join('\n'));
    reply.actions = [{ label: 'Explore opportunities', type: 'navigate', payload: { page: 'opportunities' } }];
    return reply;
  }

  // ----- research a URL
  const urlMatch = m.match(/(https?:\/\/[^\s]+)/);
  if (urlMatch && /(research|check|look at|analy[sz]e|summarize|what is this|fetch)/.test(m)) {
    const url = urlMatch[1];
    say(`Let me fetch that page…\n`);
    const peek = await peekUrl(url);
    if (peek.error) { say(`⚠️ I couldn't fetch ${url} — the site may block bots (${peek.error}). Try describing the page instead.`); return reply; }
    reply.live = true;
    addSource(peek.title || url, url);
    say(`# ${peek.title || 'Fetched page'}\n${peek.description ? `**Summary:** ${peek.description}\n\n` : ''}${peek.text.slice(0, 700)}${peek.text.length > 700 ? '…' : ''}`);
    return reply;
  }

  // ----- best offers / opportunities
  if (/(best|top|offer|opportunit|program|earn|money|niche|high paying|highest)/.test(m)) {
    const typeSlug = detectType(m);
    const sort = /(growth|fastest|trending|rising)/.test(m) ? 'growth' : /(epc|earn)/.test(m) ? 'epc' : 'opportunity';
    const tops = topPrograms(typeSlug, sort, 6);
    if (!tops.length) { say('I couldn\'t find matching offers — try naming a niche like "saas", "vpn" or "finance".'); return reply; }
    const type = typeSlug ? db.prepare('SELECT * FROM affiliate_types WHERE slug = ?').get(typeSlug) : null;
    const sortLabel = sort === 'growth' ? 'fastest-growing' : sort === 'epc' ? 'highest-EPC' : 'best overall';
    const parts = [];
    parts.push(`# ${sortLabel[0].toUpperCase() + sortLabel.slice(1)} affiliate offers${type ? ` in ${type.name}` : ''} 🎯\n`);
    tops.forEach((p, i) => {
      parts.push(`${i + 1}. **${p.name}** — ${p.rate_label} (${p.commission_type}) · ${p.cookie_days}d cookie · EPC $${p.epc.toFixed(2)} · ${p.growth >= 0 ? '+' : ''}${p.growth}%/yr · ${p.network}\n   _${p.blurb.slice(0, 110)}${p.blurb.length > 110 ? '…' : ''}_\n   Current promo: ${p.promo}`);
    });
    parts.push('\nAsk me **"strategy for <name>"** and I\'ll build a full promotion plan for any of these.');
    say(parts.join('\n'));
    reply.actions = tops.slice(0, 3).map(p => ({ label: `Strategy for ${p.name}`, type: 'prompt', payload: { prompt: `Create a strategy for ${p.name}` } }));
    if (type) reply.actions.push({ label: `Browse all ${type.name} offers`, type: 'navigate', payload: { page: 'opportunities', query: type.slug } });
    return reply;
  }

  // ----- rates for specific program / what is X
  const knownProg = progByName(m.replace(/^(what is|tell me about|info on|details (about|of|on)|rate(s)? (for|of)|commission (for|of)|how much does|is)\s+/i, ''));
  if (knownProg) {
    const p = knownProg;
    const parts = [];
    parts.push(`# ${p.name}\n`);
    parts.push(`**Commission:** ${p.rate_label} (${p.commission_type}) via ${p.network}\n`);
    parts.push(`**Cookie:** ${p.cookie_days} days · **Payout:** ${p.payout_method} (min $${p.min_payout}) · **Approval:** ${p.approval}\n`);
    parts.push(`**Performance:** typical EPC $${p.epc.toFixed(2)} · trending ${p.growth >= 0 ? '+' : ''}${p.growth}%/yr · popularity ${p.popularity}/100\n`);
    parts.push(`**Current promo:** ${p.promo}\n`);
    parts.push(`**What it is:** ${p.blurb}\n`);
    parts.push(`**Pros:** ${(JSON.parse(p.pros)).join(' · ')}\n`);
    parts.push(`**Cons:** ${(JSON.parse(p.cons)).join(' · ')}\n`);
    parts.push(`**Best for:** ${(JSON.parse(p.best_for)).join(' · ')}\n`);
    if (live) {
      const intel = await programIntel(p.name);
      if (intel.wiki) { reply.live = true; parts.push(`**Live web intel:** ${intel.wiki.extract.slice(0, 300)}…`); addSource(intel.wiki.title, intel.wiki.url); }
      for (const s of (intel.search?.slice(0, 2) || [])) addSource(s.title, s.url);
    }
    say(parts.join('\n'));
    reply.actions = [
      { label: `Strategy for ${p.name}`, type: 'prompt', payload: { prompt: `Create a strategy for ${p.name}` } },
      { label: `Track ${p.name}`, type: 'track_program', payload: { name: p.name, color: '#6366f1', commission_rate: p.rate_max, cookie_days: p.cookie_days } },
      { label: `Create link → ${p.name}`, type: 'create_link', payload: { name: p.name, destination_url: p.url, network: p.network } },
    ];
    return reply;
  }

  // ----- affiliate types overview
  if (/(types|categories|groups|kinds)/.test(m) && /affiliate|offer|program|niche/.test(m)) {
    const types = db.prepare('SELECT * FROM affiliate_types ORDER BY sort').all();
    say('# Affiliate types — grouped by model\n\n' + types.map(t => `**${t.icon && false ? '' : ''}${t.name}** — ${t.avg_commission}\n_${t.tagline}_`).join('\n\n') + '\n\nAsk me about any type, e.g. **"best offers in SaaS"** or **"strategy for travel"**.');
    reply.actions = types.slice(0, 4).map(t => ({ label: `Best ${t.name} offers`, type: 'prompt', payload: { prompt: `Best offers in ${t.name.toLowerCase()}` } }));
    return reply;
  }

  // ----- generic knowledge: try live search, then wiki
  if (live) {
    const search = await webSearch(msg, 5);
    const wiki = await wikiSummary(msg.replace(/\?+/g, '').slice(0, 60));
    if (wiki || search.items.length) {
      reply.live = true;
      const parts = [];
      if (wiki) {
        parts.push(`**${wiki.title}** — ${wiki.extract}\n`);
        addSource(wiki.title, wiki.url);
      }
      if (search.items.length) {
        parts.push('What the live web says:\n' + search.items.map(s => `- ${s.title} — ${s.url}`).join('\n'));
        search.items.forEach(s => addSource(s.title, s.url));
      }
      parts.push('\n_Note: live snippets are fetched in real time; rates and terms can change — verify on the program\'s official page._');
      say(parts.join('\n'));
      return reply;
    }
  }

  // ----- fallback
  say(`I'm not sure I understood that one. Here's what I'm great at:\n- **"Best offers in [niche]"** — SaaS, VPN, hosting, finance, travel…\n- **"Strategy for [program]"** — full promotion plans\n- **"How do I get more clicks?"**\n- **"What's trending this week?"** — live web data\n- **"Analyze my performance"**\n- **"Compare X and Y"**\n\nOr paste a URL and I'll research it.`);
  reply.actions = [
    { label: 'What\'s trending?', type: 'prompt', payload: { prompt: 'What\'s trending this week?' } },
    { label: 'Best offers in SaaS', type: 'prompt', payload: { prompt: 'Best offers in SaaS' } },
    { label: 'More clicks?', type: 'prompt', payload: { prompt: 'How do I get more clicks on my links?' } },
  ];
  return reply;
}

// ------------------------------------------------------------ user context
function getUserContext(userId) {
  const since = daysAgo(30);
  const overview = db.prepare(`SELECT COUNT(*) clicks, COALESCE(SUM(converted),0) conversions, COALESCE(SUM(revenue),0) revenue FROM clicks WHERE user_id = ? AND created_at >= ?`).get(userId, since);
  const prev = db.prepare(`SELECT COALESCE(SUM(revenue),0) revenue FROM clicks WHERE user_id = ? AND created_at >= ? AND created_at < ?`).get(userId, daysAgo(60), since);
  const cr = overview.clicks ? (overview.conversions / overview.clicks) * 100 : 0;
  const topLinks = db.prepare(`
    SELECT l.id, l.name, COALESCE(n.name,'') AS network_name,
      COUNT(k.id) clicks_recent,
      COALESCE(SUM(CASE WHEN k.converted=1 THEN 1 ELSE 0 END),0) conversions_recent,
      COALESCE(SUM(k.revenue),0) revenue_recent
    FROM links l LEFT JOIN networks n ON n.id = l.network_id LEFT JOIN clicks k ON k.link_id = l.id AND k.created_at >= ?
    WHERE l.user_id = ? GROUP BY l.id ORDER BY clicks_recent DESC LIMIT 5`).all(since, userId);
  const topReferrers = db.prepare(`SELECT referrer, COUNT(*) clicks FROM clicks WHERE user_id = ? AND created_at >= ? GROUP BY referrer ORDER BY clicks DESC LIMIT 3`).all(userId, since);
  const pendingPayouts = db.prepare(`SELECT COALESCE(SUM(amount),0) s FROM payouts WHERE user_id = ? AND status != 'paid'`).get(userId).s;
  return {
    overview: {
      clicks: +overview.clicks, conversions: +overview.conversions, revenue: +overview.revenue,
      revenuePrev: +prev.revenue, cr, epc: overview.clicks ? +overview.revenue / overview.clicks : 0,
    },
    topLinks: topLinks.map(l => ({ ...l, clicks_recent: +l.clicks_recent, revenue_recent: Math.round(+l.revenue_recent * 100) / 100 })),
    topReferrers: topReferrers.map(r => ({ ...r, clicks: +r.clicks })),
    pendingPayouts: +pendingPayouts,
  };
}

// ------------------------------------------------------------ optional LLM passthrough
async function tryLlm(userId, message, userData) {
  try {
    const s = db.prepare('SELECT ai_key, ai_model, ai_provider FROM settings WHERE user_id = ?').get(userId);
    if (!s || !s.ai_key) return null;
    const base = (s.ai_provider || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const ctx = [
      'You are the LinkPilot AI copilot for affiliate marketers. Answer concisely with markdown.',
      `User's live data (30d): revenue $${userData.overview.revenue.toFixed(2)}, clicks ${userData.overview.clicks}, EPC $${userData.overview.epc.toFixed(2)}.`,
      `Top links: ${userData.topLinks.map(l => `${l.name} (${l.clicks_recent} clicks)`).join(', ') || 'none'}.`,
    ].join('\n');
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.ai_key}` },
      body: JSON.stringify({ model: s.ai_model || 'gpt-4o-mini', messages: [{ role: 'system', content: ctx }, { role: 'user', content: message }], max_tokens: 800 }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const text = j.choices?.[0]?.message?.content;
    return typeof text === 'string' && text.trim() ? text : null;
  } catch {
    return null; // fall back to built-in engine
  }
}
