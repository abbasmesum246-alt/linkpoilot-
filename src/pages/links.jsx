import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, fmtMoney, fmtNum, fmtPct, fmtDate, copyText } from '../api.js';
import { Icon } from '../icons.jsx';
import { Modal, Drawer, EmptyState, StatusPill, TableSkeleton, CopyBtn, Menu, MenuItem, PageHeader, useToast, useConfirm } from '../ui.jsx';
import { AreaChart, HBars, MiniBars } from '../charts.jsx';

const shortUrl = (slug) => `${window.location.origin}/r/${slug}`;

function LinkForm({ initial, prefill, networks, campaigns, onSave, onClose, busy }) {
  const pf = prefill || {};
  const [form, setForm] = useState(() => ({
    name: initial?.name || pf.name || '',
    destination_url: initial?.destination_url || pf.destination_url || '',
    slug: initial?.slug || '',
    network_id: initial?.network_id ?? (networks.find(n => n.name?.toLowerCase() === String(pf.network || '').toLowerCase())?.id ?? ''),
    campaign_id: initial?.campaign_id ?? '',
    status: initial?.status || 'active',
    note: initial?.note || '',
  }));
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const suggested = useMemo(() => (form.name ? form.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : ''), [form.name]);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="field">
        <label>Link name</label>
        <input className="input" placeholder="e.g. AirPods Pro 2 (Amazon)" value={form.name} onChange={set('name')} required autoFocus />
      </div>
      <div className="field">
        <label>Destination URL</label>
        <input className="input" type="url" placeholder="https://www.amazon.com/dp/…" value={form.destination_url} onChange={set('destination_url')} required />
        <span className="hint">Where visitors land. Append your affiliate ID (e.g. ?tag=you-20).</span>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Custom slug <span className="hint">(optional)</span></label>
          <input className="input mono" placeholder={suggested || 'auto-generated'} value={form.slug} onChange={set('slug')} />
          {form.slug || suggested ? (
            <span className="hint">Short link: <b className="mono" style={{ color: 'var(--accent)' }}>{window.location.origin}/r/{form.slug || suggested}</b></span>
          ) : null}
        </div>
        <div className="field">
          <label>Status</label>
          <select className="select" value={form.status} onChange={set('status')}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Network</label>
          <select className="select" value={form.network_id} onChange={set('network_id')}>
            <option value="">— No network —</option>
            {networks.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Campaign</label>
          <select className="select" value={form.campaign_id} onChange={set('campaign_id')}>
            <option value="">— No campaign —</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label>Note <span className="hint">(optional)</span></label>
        <textarea className="textarea" placeholder="Where is this link placed?" value={form.note} onChange={set('note')} rows={2} />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : initial ? 'Save changes' : 'Create link'}
        </button>
      </div>
    </form>
  );
}

function LinkDrawer({ link, onClose, onEdit, onDelete, onTest, onChanged, isDemo }) {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState(null);
  const [testing, setTesting] = useState(false);
  const toast = useToast();
  const load = useCallback(async () => {
    try { setStats(await api(`/api/links/${link.id}/stats?days=${days}`)); } catch { /* ignore */ }
  }, [link.id, days]);
  useEffect(() => { load(); }, [load]);

  const test = async () => {
    setTesting(true);
    try {
      await api(`/api/links/${link.id}/test-click`, { method: 'POST' });
      toast('success', `Test click recorded on <b>${link.name}</b>`);
      await load();
      onChanged?.();
    } catch (e) { toast('error', e.message); }
    finally { setTesting(false); }
  };

  const t = stats?.totals;
  const devTotal = stats ? stats.devices.reduce((s, d) => s + d.clicks, 0) || 1 : 1;

  return (
    <Drawer
      title={link.name}
      subtitle={<StatusPill status={link.status} />}
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-sm btn-secondary" onClick={test} disabled={testing}>
            <Icon name={testing ? 'refresh' : 'zap'} size={13} /> Test click
          </button>
          <button className="btn btn-sm btn-secondary" onClick={onEdit}><Icon name="edit" size={13} /> Edit</button>
          <button className="btn btn-sm btn-danger" onClick={onDelete}><Icon name="trash" size={13} /> Delete</button>
        </>
      }
    >
      {/* short link */}
      <div className="code-block" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shortUrl(link.slug)}</span>
        <CopyBtn text={shortUrl(link.slug)} label="Copy" />
        <a className="btn btn-sm btn-primary" href={`/r/${link.slug}`} target="_blank" rel="noreferrer">
          <Icon name="external" size={13} /> Open
        </a>
      </div>
      {isDemo ? (
        <div className="small" style={{ background: 'var(--amber-soft)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '10px 12px', marginBottom: 16, lineHeight: 1.6 }}>
          <b style={{ color: 'var(--amber)' }}>Demo mode:</b> opening this link simulates the visit instead of redirecting
          to the merchant — clicks are still logged for practice. Real accounts redirect visitors to the actual store.
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          ['Clicks', fmtNum(t?.clicks || 0), 'pointer', 'var(--blue-soft)', 'var(--blue)'],
          ['Conversions', fmtNum(t?.conversions || 0), 'cart', 'var(--violet-soft)', 'var(--violet)'],
          ['Conv. rate', fmtPct(t && t.clicks ? (t.conversions / t.clicks) * 100 : 0), 'percent', 'var(--amber-soft)', 'var(--amber)'],
          ['Revenue', fmtMoney(t?.revenue || 0), 'dollar', 'var(--accent-soft)', 'var(--accent)'],
        ].map(([label, val, icon, bg, color]) => (
          <div key={label} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Icon name={icon} size={14} />
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>{val}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div className="card-title">Clicks over time</div>
          <div className="seg">
            {[7, 30, 90].map(d => (
              <button key={d} className={days === d ? 'active' : ''} onClick={() => setDays(d)}>{d}d</button>
            ))}
          </div>
        </div>
        <div className="card-pad">
          {stats ? (
            <AreaChart data={stats.series} series={[{ key: 'clicks', label: 'Clicks', color: '#22d3ee' }, { key: 'revenue', label: 'Revenue', color: '#10b981' }]}
              height={210} fmt={(v) => v > 50 ? fmtMoney(v) : fmtNum(v)} />
          ) : <div style={{ height: 210 }}><TableSkeleton rows={3} cols={3} /></div>}
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 14 }}>
        <div className="card">
          <div className="card-head"><div className="card-title">Top referrers</div></div>
          <div className="card-pad" style={{ paddingTop: 10 }}>
            {stats ? (stats.referrers.length ? <HBars data={stats.referrers.map(r => ({ name: r.name, value: r.clicks }))} /> : <EmptyState icon="chart" title="No traffic yet" text="Share this link to see where clicks come from." />) : null}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title">Countries</div></div>
          <div className="card-pad" style={{ paddingTop: 10 }}>
            {stats ? (stats.countries.length ? <HBars data={stats.countries.map(r => ({ name: r.name, value: r.clicks }))} color="linear-gradient(90deg,#8b5cf6,#ec4899)" /> : <EmptyState icon="globe" title="No geo data" text="Clicks will be geo-tagged automatically." />) : null}
          </div>
        </div>
      </div>

      {stats ? (
        <div className="card card-pad">
          <div className="card-title" style={{ marginBottom: 10 }}>Devices</div>
          <div className="row wrap gap-lg">
            {stats.devices.map(d => (
              <div key={d.name} style={{ flex: 1, minWidth: 90 }}>
                <div className="row-between small">
                  <span className="muted" style={{ textTransform: 'capitalize' }}>{d.name}</span>
                  <span className="bold">{Math.round((d.clicks / devTotal) * 100)}%</span>
                </div>
                <div className="progress" style={{ marginTop: 6 }}><div className="bar" style={{ width: `${(d.clicks / devTotal) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16, fontSize: 12.5 }}>
        <div className="row gap-sm small"><Icon name="external" size={13} style={{ color: 'var(--text-3)' }} /><span className="muted">Destination:</span><span className="truncate" style={{ flex: 1 }}>{link.destination_url}</span></div>
        <div className="row gap-sm small"><Icon name="globe" size={13} style={{ color: 'var(--text-3)' }} /><span className="muted">Network:</span>{link.network_name || '—'}</div>
        <div className="row gap-sm small"><Icon name="target" size={13} style={{ color: 'var(--text-3)' }} /><span className="muted">Campaign:</span>{link.campaign_name || '—'}</div>
        <div className="row gap-sm small"><Icon name="calendar" size={13} style={{ color: 'var(--text-3)' }} /><span className="muted">Created:</span>{fmtDate(link.created_at)}</div>
        {link.note ? <div className="row gap-sm small"><Icon name="edit" size={13} style={{ color: 'var(--text-3)' }} /><span className="muted">Note:</span>{link.note}</div> : null}
      </div>
    </Drawer>
  );
}

export function Links({ query, onNavigate, isDemo }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [links, setLinks] = useState(null);
  const [networks, setNetworks] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [filters, setFilters] = useState({ q: '', network: 'all', campaign: 'all', status: 'all' });
  const [modal, setModal] = useState(null); // null | { mode: 'new' } | { mode: 'edit', link }
  const [drawerId, setDrawerId] = useState(query.open ? +query.open : null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (showSpinner) => {
    if (showSpinner) setLinks(null);
    try {
      const qs = new URLSearchParams();
      if (filters.q) qs.set('q', filters.q);
      if (filters.network !== 'all') qs.set('network', filters.network);
      if (filters.campaign !== 'all') qs.set('campaign', filters.campaign);
      if (filters.status !== 'all') qs.set('status', filters.status);
      const [l, n, c] = await Promise.all([
        api(`/api/links${qs.toString() ? `?${qs}` : ''}`),
        api('/api/networks'), api('/api/campaigns'),
      ]);
      setLinks(l); setNetworks(n); setCampaigns(c);
    } catch (e) { toast('error', e.message); }
  }, [filters]);

  useEffect(() => {
    if (query.new) {
      let prefill = {};
      try { prefill = query.prefill ? JSON.parse(decodeURIComponent(query.prefill)) : {}; } catch { /* ignore */ }
      setModal({ mode: 'new', prefill });
    }
  }, [query.new, query.prefill]);
  useEffect(() => {
    if (query.open) setDrawerId(+query.open);
  }, [query.open]);

  useEffect(() => {
    const t = setTimeout(() => load(true), filters.q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load]);

  const refresh = () => load(false);

  const save = async (form) => {
    setSaving(true);
    if (modal?.mode === 'edit') {
      const prev = links.find(l => l.id === modal.link.id);
      // optimistic update
      setLinks(ls => ls.map(l => l.id === modal.link.id ? { ...l, ...form, network_name: networks.find(n => n.id === +form.network_id)?.name, campaign_name: campaigns.find(c => c.id === +form.campaign_id)?.name } : l));
      setModal(null);
      try {
        await api(`/api/links/${modal.link.id}`, { method: 'PUT', body: form });
        toast('success', `Link <b>${form.name}</b> updated`);
        refresh();
      } catch (e) {
        setLinks(ls => ls.map(l => l.id === modal.link.id ? prev : l));
        toast('error', e.message);
      }
    } else {
      const tmp = { id: `tmp-${Date.now()}`, name: form.name, slug: 'pending…', destination_url: form.destination_url, status: form.status, clicks_recent: 0, conversions_recent: 0, revenue_recent: 0, clicks_total: 0, pending: true };
      setLinks(ls => [tmp, ...(ls || [])]);
      setModal(null);
      try {
        const created = await api('/api/links', { method: 'POST', body: form });
        setLinks(ls => (ls || []).map(l => l.id === tmp.id ? created : l));
        toast('success', `Link <b>${form.name}</b> created 🎉`);
      } catch (e) {
        setLinks(ls => (ls || []).filter(l => l.id !== tmp.id));
        toast('error', e.message);
      }
    }
    setSaving(false);
  };

  const remove = async (link) => {
    const ok = await confirm({
      title: 'Delete link?',
      text: `"${link.name}" and its ${fmtNum(link.clicks_total)} tracked clicks will be permanently deleted.`,
      confirmLabel: 'Delete link',
    });
    if (!ok) return;
    const prev = links;
    setLinks(ls => ls.filter(l => l.id !== link.id));
    try {
      await api(`/api/links/${link.id}`, { method: 'DELETE' });
      toast('success', `Link deleted`);
      if (drawerId === link.id) setDrawerId(null);
    } catch (e) {
      setLinks(prev);
      toast('error', e.message);
    }
  };

  const openLink = async (link) => {
    const ok = await copyText(shortUrl(link.slug));
    toast('success', ok ? `Short link copied — now open it in a new tab to see tracking in action` : 'Copied link');
    window.open(`/r/${link.slug}`, '_blank');
  };

  const drawerLink = links?.find(l => l.id === drawerId);

  return (
    <div className="content">
      <PageHeader
        title="Affiliate Links"
        sub={`${links ? links.length : '…'} links · ${fmtMoney(links ? links.reduce((s, l) => s + l.revenue_recent, 0) : 0)} revenue (30d)`}
        actions={
          <>
            <a className="btn btn-secondary btn-sm" href="/api/links/export"><Icon name="download" size={14} /> Export CSV</a>
            <button className="btn btn-primary btn-sm" onClick={() => setModal({ mode: 'new' })}><Icon name="plus" size={14} strokeWidth={2.5} /> New link</button>
          </>
        }
      />

      {/* filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row wrap gap-sm" style={{ padding: 12 }}>
          <div className="search-box" style={{ flex: '1 1 200px', maxWidth: 'none' }}>
            <Icon name="search" />
            <input placeholder="Search links, slugs or destinations…" value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} />
          </div>
          <select className="select" style={{ width: 'auto', minWidth: 130 }} value={filters.network} onChange={e => setFilters(f => ({ ...f, network: e.target.value }))}>
            <option value="all">All networks</option>
            {networks.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
          <select className="select" style={{ width: 'auto', minWidth: 130 }} value={filters.campaign} onChange={e => setFilters(f => ({ ...f, campaign: e.target.value }))}>
            <option value="all">All campaigns</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="select" style={{ width: 'auto', minWidth: 120 }} value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </div>
      </div>

      <div className="card">
        {links === null ? (
          <TableSkeleton rows={6} cols={6} />
        ) : links.length === 0 ? (
          <EmptyState
            icon="link"
            title={filters.q || filters.network !== 'all' || filters.campaign !== 'all' || filters.status !== 'all' ? 'No links match your filters' : 'Create your first affiliate link'}
            text={filters.q || filters.network !== 'all' || filters.campaign !== 'all' || filters.status !== 'all' ? 'Try clearing the search or choosing different filters.' : 'Paste any product or offer URL, get a short tracking link, and watch clicks roll in.'}
            action={<button className="btn btn-primary" onClick={() => setModal({ mode: 'new' })}><Icon name="plus" size={15} /> Create link</button>}
          />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Link</th>
                  <th className="hide-sm">Network</th>
                  <th className="hide-sm">Campaign</th>
                  <th className="num">Clicks (30d)</th>
                  <th className="num hide-sm">Conv.</th>
                  <th className="num">Revenue (30d)</th>
                  <th>Status</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {links.map(l => (
                  <tr key={l.id} style={{ cursor: 'pointer', opacity: l.pending ? 0.5 : 1 }} onClick={() => onNavigate(`#/links?open=${l.id}`)}>
                    <td>
                      <div className="row-name">
                        <span style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                          <Icon name="link" size={15} />
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div className="truncate">{l.name}</div>
                          <div className="row-sub mono truncate">{l.pending ? 'creating…' : `/${l.slug}`}</div>
                        </div>
                      </div>
                    </td>
                    <td className="hide-sm">
                      {l.network_name ? (
                        <span className="pill" style={{ background: `${l.network_color}1f`, color: l.network_color }}>
                          <span className="dot" />{l.network_name}
                        </span>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td className="hide-sm">{l.campaign_name ? <span className="pill violet"><span className="dot" />{l.campaign_name}</span> : <span className="muted">—</span>}</td>
                    <td className="num bold">{fmtNum(l.clicks_recent)}</td>
                    <td className="num hide-sm">{l.clicks_recent ? fmtPct((l.conversions_recent / l.clicks_recent) * 100) : '—'}</td>
                    <td className="num bold" style={{ color: 'var(--accent)' }}>{fmtMoney(l.revenue_recent)}</td>
                    <td><StatusPill status={l.status} /></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Menu trigger={<button className="btn-icon"><Icon name="moreH" size={16} /></button>}>
                        <MenuItem icon="copy" label="Copy short link" onClick={() => { copyText(shortUrl(l.slug)); toast('success', 'Short link copied'); }} />
                        <MenuItem icon="external" label="Open link" onClick={() => openLink(l)} />
                        <MenuItem icon="zap" label="Test click" onClick={async () => {
                          try { await api(`/api/links/${l.id}/test-click`, { method: 'POST' }); toast('success', `Test click recorded on "${l.name}"`); refresh(); }
                          catch (e) { toast('error', e.message); }
                        }} />
                        <div className="menu-sep" />
                        <MenuItem icon="edit" label="Edit" onClick={() => setModal({ mode: 'edit', link: l })} />
                        <MenuItem icon="trash" label="Delete" danger onClick={() => remove(l)} />
                      </Menu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal ? (
        <Modal
          title={modal.mode === 'edit' ? 'Edit link' : 'Create a new link'}
          subtitle={modal.mode === 'edit' ? `/${modal.link.slug}` : 'Paste a destination, get a trackable short link.'}
          onClose={() => setModal(null)}
        >
          <LinkForm
            initial={modal.mode === 'edit' ? modal.link : null}
            prefill={modal.prefill && Object.keys(modal.prefill).length ? modal.prefill : null}
            networks={networks} campaigns={campaigns}
            onSave={save} onClose={() => setModal(null)} busy={saving}
          />
        </Modal>
      ) : null}

      {drawerLink ? (
        <LinkDrawer
          link={drawerLink}
          isDemo={isDemo}
          onClose={() => onNavigate('#/links')}
          onEdit={() => { setModal({ mode: 'edit', link: drawerLink }); }}
          onDelete={() => remove(drawerLink)}
          onChanged={refresh}
        />
      ) : null}
    </div>
  );
}
