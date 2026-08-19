import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, fmtMoney, fmtNum, timeAgo } from '../api.js';
import { Icon } from '../icons.jsx';
import { Drawer, EmptyState, PageHeader, Skeleton, useToast, Seg } from '../ui.jsx';
import { Sparkline } from '../charts.jsx';

const TYPE_ICON_BG = {
  retail: ['#f59e0b', 'rgba(245,158,11,0.14)'], saas: ['#22d3ee', 'rgba(34,211,238,0.13)'],
  digital: ['#a78bfa', 'rgba(167,139,250,0.14)'], finance: ['#10b981', 'rgba(16,185,129,0.13)'],
  travel: ['#3b82f6', 'rgba(59,130,246,0.13)'], fashion: ['#ec4899', 'rgba(236,72,153,0.13)'],
  hosting: ['#8b5cf6', 'rgba(139,92,246,0.13)'], vpn: ['#06b6d4', 'rgba(6,182,212,0.13)'],
  education: ['#f97316', 'rgba(249,115,22,0.13)'], health: ['#84cc16', 'rgba(132,204,22,0.13)'],
  creator: ['#eab308', 'rgba(234,179,8,0.13)'], gaming: ['#f43f5e', 'rgba(244,63,94,0.13)'],
};

function StrategyDrawer({ program, onClose, onTrack, onCreateLink }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const toast = useToast();
  useEffect(() => {
    let alive = true;
    setBusy(true); setData(null);
    api(`/api/programs/${program.id}/strategy`)
      .then(d => alive && setData(d))
      .catch(e => { if (alive) toast('error', e.message); })
      .finally(() => alive && setBusy(false));
    return () => { alive = false; };
  }, [program.id]);

  const s = data?.strategy;
  return (
    <Drawer
      title={`Strategy: ${program.name}`}
      subtitle={<span className="pill violet"><span className="dot" />{program.type_name}</span>}
      onClose={onClose}
      actions={<button className="btn btn-sm btn-primary" onClick={onCreateLink}><Icon name="link" size={13} /> Create link</button>}
    >
      {busy || !s ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Skeleton h={18} w="80%" /><Skeleton h={60} /><Skeleton h={120} /><Skeleton h={90} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--accent-soft)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 12, padding: 14 }}>
            <div className="small bold" style={{ color: 'var(--accent)', marginBottom: 4 }}>🎯 THE OPPORTUNITY</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>{s.goal}</div>
          </div>

          <div>
            <div className="small bold muted" style={{ marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Positioning</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6 }}>{s.positioning}</div>
          </div>

          <div>
            <div className="small bold muted" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Channels (prioritized)</div>
            {s.channels.map(c => (
              <div key={c.channel} className="row gap-sm" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
                <span style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--violet-soft)', color: 'var(--violet)', fontSize: 11.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{c.priority}</span>
                <div style={{ fontSize: 12.5 }}>
                  <b>{c.channel}</b>
                  <div className="muted" style={{ fontSize: 12 }}>{c.why}</div>
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className="small bold muted" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Content ideas</div>
            {s.content_ideas.map((c, i) => (
              <div key={i} className="row gap-sm" style={{ padding: '5px 0', fontSize: 12.5 }}>
                <Icon name="check" size={13} style={{ color: 'var(--accent)', flex: 'none' }} /> {c}
              </div>
            ))}
          </div>

          <div>
            <div className="small bold muted" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Click-boosting tactics</div>
            {s.click_tactics.map((c, i) => (
              <div key={i} className="row gap-sm" style={{ padding: '5px 0', fontSize: 12.5 }}>
                <Icon name="zap" size={13} style={{ color: 'var(--amber)', flex: 'none' }} /> {c}
              </div>
            ))}
          </div>

          <div>
            <div className="small bold muted" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Funnel</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {s.funnel.map((f, i) => (
                <div key={i} className="row gap-sm" style={{ fontSize: 12.5 }}>
                  <span className="mono small muted">{i + 1}.</span> {f}
                </div>
              ))}
            </div>
          </div>

          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 12 }}>
              <div className="small bold muted" style={{ marginBottom: 6 }}>KPIs</div>
              <div className="small" style={{ lineHeight: 1.8 }}>{s.kpis.ctr_target}<br />{s.kpis.cr_target}<br />{s.kpis.revenue_estimate}</div>
            </div>
            <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 12 }}>
              <div className="small bold muted" style={{ marginBottom: 6 }}>Watch out</div>
              <div className="small" style={{ lineHeight: 1.8 }}>{s.risks.map(r => `• ${r}`).join('\n')}</div>
            </div>
          </div>

          <div className="row wrap gap-sm" style={{ marginTop: 4 }}>
            <button className="btn btn-primary" onClick={onCreateLink}><Icon name="link" size={14} /> Create link for {program.name}</button>
            <button className="btn btn-secondary" onClick={onTrack}><Icon name="globe" size={14} /> Track as network</button>
          </div>
          <div className="small muted">Saved to your <a href="#/strategies" style={{ color: 'var(--accent)' }}>Strategies</a> library.</div>
        </div>
      )}
    </Drawer>
  );
}

export function Opportunities({ query, onNavigate }) {
  const toast = useToast();
  const [types, setTypes] = useState(null);
  const [programs, setPrograms] = useState(null);
  const [pulse, setPulse] = useState(null);
  const [activeType, setActiveType] = useState(query?.query || 'all');
  const [sort, setSort] = useState('opportunity');
  const [q, setQ] = useState('');
  const [strategyFor, setStrategyFor] = useState(null);

  const load = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([api('/api/types'), api(`/api/programs?sort=${sort}`)]);
      setTypes(t); setPrograms(p);
    } catch (e) { toast('error', e.message); }
  }, [sort, toast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api('/api/research/pulse').then(setPulse).catch(() => {});
  }, []);
  useEffect(() => { if (query?.query) setActiveType(query.query); }, [query?.query]);

  const filtered = useMemo(() => {
    if (!programs) return [];
    return programs.filter(p =>
      (activeType === 'all' || p.type_slug === activeType) &&
      (!q || (p.name + ' ' + p.network + ' ' + p.blurb).toLowerCase().includes(q.toLowerCase()))
    );
  }, [programs, activeType, q]);

  const activeTypeObj = types?.find(t => t.slug === activeType);

  const trackProgram = async (p) => {
    try {
      const body = { name: p.name, color: '#6366f1', commission_rate: p.rate_max || 10, cookie_days: p.cookie_days, status: 'active', notes: `From market database · ${p.network}` };
      const exists = await api('/api/networks').then(ns => ns.some(n => n.name.toLowerCase() === p.name.toLowerCase()));
      if (exists) { toast('info', `<b>${p.name}</b> is already in your networks`); return; }
      await api('/api/networks', { method: 'POST', body });
      toast('success', `<b>${p.name}</b> added to your networks`);
    } catch (e) { toast('error', e.message); }
  };

  const createLink = (p) => {
    onNavigate(`#/links?new=1&prefill=${encodeURIComponent(JSON.stringify({ name: p.name, destination_url: p.url, network: p.network }))}`);
  };

  return (
    <div className="content">
      <PageHeader
        title="Opportunities"
        sub="Affiliate programs grouped by type — live offers, rates, EPC and growth trends"
        actions={
          <div className="row gap-sm">
            <div className="search-box"><Icon name="search" />
              <input placeholder="Search programs…" value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <select className="select" style={{ width: 'auto' }} value={sort} onChange={e => setSort(e.target.value)}>
              <option value="opportunity">Best opportunities</option>
              <option value="epc">Highest EPC</option>
              <option value="growth">Fastest growing</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>
        }
      />

      {/* live market pulse */}
      {pulse ? (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="row-between" style={{ marginBottom: 8 }}>
            <div className="row gap-sm">
              <span className="live-dot" />
              <span className="card-title">Live market pulse</span>
              <span className="small muted">fetched {timeAgo(pulse.fetched_at)}</span>
            </div>
            <a href="#/assistant" className="small" style={{ color: 'var(--accent)', fontWeight: 600 }}>Ask the copilot →</a>
          </div>
          <div className="grid-2" style={{ marginBottom: 0, gap: 10 }}>
            <div>
              <div className="small bold muted" style={{ marginBottom: 4 }}>Trending in tech &amp; products (live)</div>
              {pulse.tech?.length ? pulse.tech.slice(0, 3).map((t, i) => (
                <div key={i} className="row gap-sm" style={{ padding: '3px 0', fontSize: 12 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flex: 'none' }} />
                  <span className="truncate">{t.title}</span>
                </div>
              )) : <div className="small muted">Live feed unreachable — showing market DB data.</div>}
            </div>
            <div>
              <div className="small bold muted" style={{ marginBottom: 4 }}>Marketing &amp; affiliate news (live)</div>
              {pulse.marketing?.length ? pulse.marketing.slice(0, 3).map((t, i) => (
                <div key={i} className="row gap-sm" style={{ padding: '3px 0', fontSize: 12 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--violet)', flex: 'none' }} />
                  <span className="truncate">{t.title} <span className="muted">({t.source})</span></span>
                </div>
              )) : <div className="small muted">Live feed unreachable — showing market DB data.</div>}
            </div>
          </div>
        </div>
      ) : null}

      {/* type rail */}
      {types === null ? (
        <Skeleton h={44} style={{ marginBottom: 16, borderRadius: 12 }} />
      ) : (
        <div className="row wrap gap-sm" style={{ marginBottom: 16 }}>
          <button className={`btn btn-sm ${activeType === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveType('all')}>
            <Icon name="layers" size={13} /> All types ({types.reduce((s, t) => s + t.program_count, 0)})
          </button>
          {types.map(t => {
            const [color, bg] = TYPE_ICON_BG[t.slug] || ['#6366f1', 'rgba(99,102,241,0.14)'];
            return (
              <button key={t.slug} className={`btn btn-sm ${activeType === t.slug ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveType(t.slug)} style={activeType === t.slug ? null : { color } }>
                <Icon name={t.icon} size={13} /> {t.name} ({t.program_count})
              </button>
            );
          })}
        </div>
      )}

      {/* type info panel — all features for the type */}
      {activeTypeObj ? (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="row gap-lg wrap" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div className="row gap-sm">
                <span style={{ width: 36, height: 36, borderRadius: 10, background: (TYPE_ICON_BG[activeTypeObj.slug] || ['#6366f1', ''])[1], color: (TYPE_ICON_BG[activeTypeObj.slug] || ['#6366f1', ''])[0], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={activeTypeObj.icon} size={17} />
                </span>
                <div>
                  <div className="card-title">{activeTypeObj.name}</div>
                  <div className="card-sub">{activeTypeObj.tagline}</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: '10px 0 0' }}>{activeTypeObj.description}</p>
              <div className="row wrap gap-sm" style={{ marginTop: 10 }}>
                <span className="pill active">avg. {activeTypeObj.avg_commission}</span>
                <span className="pill violet">{activeTypeObj.best_channels}</span>
              </div>
            </div>
            <div style={{ flex: 1.2, minWidth: 260, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
              {activeTypeObj.features.map((f, i) => (
                <div key={i} style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px' }}>
                  <div className="small bold" style={{ marginBottom: 3 }}>{f.label}</div>
                  <div className="small muted" style={{ lineHeight: 1.5 }}>{f.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* program grid */}
      {programs === null ? (
        <div className="grid-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={210} style={{ borderRadius: 'var(--radius)' }} />)}</div>
      ) : filtered.length === 0 ? (
        <div className="card"><EmptyState icon="rocket" title="No matching programs" text="Try another type, search term, or clear filters." /></div>
      ) : (
        <div className="grid-2">
          {filtered.map(p => {
            const [color, bg] = TYPE_ICON_BG[p.type_slug] || ['#6366f1', 'rgba(99,102,241,0.14)'];
            const opportunity = Math.round(p.epc * 0.5 + p.growth * 0.3 + p.popularity * 0.2);
            return (
              <div key={p.id} className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div className="card-pad" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="row-between">
                    <div className="row gap-sm" style={{ minWidth: 0 }}>
                      <span style={{ width: 38, height: 38, borderRadius: 11, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                        <Icon name={p.type_icon} size={18} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className="bold truncate" style={{ fontSize: 14.5 }}>{p.name}</div>
                        <div className="small muted">{p.network} · <span className="pill" style={{ fontSize: 10, padding: '1px 7px', background: bg, color }}>{p.type_name}</span></div>
                      </div>
                    </div>
                    <span className="pill violet" style={{ flex: 'none' }}>score {opportunity}</span>
                  </div>

                  <div className="row wrap gap-sm">
                    <span className="pill active" style={{ fontSize: 12 }}>{p.rate_label}</span>
                    <span className="pill" style={{ background: 'var(--blue-soft)', color: 'var(--blue)', fontSize: 12 }}>{p.cookie_days}d cookie</span>
                    <span className="pill" style={{ background: 'var(--surface-3)', color: 'var(--text-2)', fontSize: 12 }}>EPC ${p.epc.toFixed(2)}</span>
                    <span className={`pill ${p.growth >= 0 ? 'active' : 'rose'}`} style={{ fontSize: 12 }}>
                      {p.growth >= 0 ? '↗' : '↘'} {Math.abs(p.growth)}%/yr
                    </span>
                  </div>

                  <div className="small muted" style={{ flex: 1, lineHeight: 1.55 }}>{p.blurb}</div>

                  <div style={{ background: 'var(--surface-2)', borderRadius: 9, padding: '8px 11px', fontSize: 12 }}>
                    <span className="bold" style={{ color: 'var(--accent)' }}>Current promo: </span>
                    <span className="muted">{p.promo}</span>
                  </div>

                  <div className="row-between small muted">
                    <span>{p.approval} approval · min payout ${p.min_payout}</span>
                    <span>{p.payout_method}</span>
                  </div>

                  <div className="row gap-sm" style={{ marginTop: 'auto' }}>
                    <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => setStrategyFor(p)}>
                      <Icon name="flag" size={13} /> Get strategy
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => trackProgram(p)} title="Add to your networks">
                      <Icon name="globe" size={13} /> Track
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => createLink(p)} title="Create an affiliate link">
                      <Icon name="link" size={13} /> Link
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {strategyFor ? (
        <StrategyDrawer
          program={strategyFor}
          onClose={() => setStrategyFor(null)}
          onTrack={() => trackProgram(strategyFor)}
          onCreateLink={() => createLink(strategyFor)}
        />
      ) : null}
    </div>
  );
}
