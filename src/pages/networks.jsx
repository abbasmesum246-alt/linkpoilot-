import { useEffect, useState } from 'react';
import { api, fmtMoney, fmtNum, fmtPct } from '../api.js';
import { Icon } from '../icons.jsx';
import { Modal, EmptyState, StatusPill, CardSkeleton, Menu, MenuItem, PageHeader, useToast, useConfirm } from '../ui.jsx';

const PRESETS = [
  { name: 'Amazon Associates', color: '#ff9900', rate: 4 },
  { name: 'ClickBank', color: '#1e5eff', rate: 45 },
  { name: 'ShareASale', color: '#4caf50', rate: 15 },
  { name: 'Impact', color: '#8b5cf6', rate: 20 },
  { name: 'CJ Affiliate', color: '#ef4444', rate: 12 },
  { name: 'Rakuten', color: '#f43f5e', rate: 10 },
  { name: 'PartnerStack', color: '#06b6d4', rate: 25 },
  { name: 'Digistore24', color: '#3b82f6', rate: 30 },
];

function NetworkForm({ initial, onSave, onClose, busy }) {
  const [form, setForm] = useState(() => ({
    name: initial?.name || '',
    color: initial?.color || '#6366f1',
    commission_rate: initial?.commission_rate ?? 15,
    cookie_days: initial?.cookie_days ?? 30,
    status: initial?.status || 'active',
    notes: initial?.notes || '',
  }));
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="field">
        <label>Network / program name</label>
        <input className="input" placeholder="e.g. Amazon Associates" value={form.name} onChange={set('name')} required autoFocus />
        <div className="row wrap gap-sm" style={{ marginTop: 6 }}>
          {PRESETS.map(p => (
            <button key={p.name} type="button" className="btn btn-sm btn-secondary" style={{ padding: '4px 9px', fontSize: 11.5 }}
              onClick={() => setForm(f => ({ ...f, name: p.name, color: p.color, commission_rate: p.rate }))}>
              {p.name}
            </button>
          ))}
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Avg. commission rate (%)</label>
          <input className="input" type="number" min="0" max="100" step="any" value={form.commission_rate} onChange={set('commission_rate')} />
        </div>
        <div className="field">
          <label>Cookie window (days)</label>
          <input className="input" type="number" min="0" step="1" value={form.cookie_days} onChange={set('cookie_days')} />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Status</label>
          <select className="select" value={form.status} onChange={set('status')}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </div>
        <div className="field">
          <label>Brand color</label>
          <input className="input" type="color" value={form.color} onChange={set('color')} style={{ padding: 3, height: 38, cursor: 'pointer' }} />
        </div>
      </div>
      <div className="field">
        <label>Notes <span className="hint">(payout schedule, account ID…)</span></label>
        <textarea className="textarea" rows={2} placeholder="e.g. Pays on the 20th via ACH" value={form.notes} onChange={set('notes')} />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : initial ? 'Save changes' : 'Connect network'}</button>
      </div>
    </form>
  );
}

export function Networks() {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState(null);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async (spinner) => {
    if (spinner) setItems(null);
    try { setItems(await api('/api/networks')); } catch (e) { toast('error', e.message); }
  };
  useEffect(() => { load(true); }, []);

  const save = async (form) => {
    setSaving(true);
    const body = { ...form, commission_rate: +form.commission_rate, cookie_days: +form.cookie_days };
    if (modal?.net) {
      const prev = items.find(n => n.id === modal.net.id);
      setItems(xs => xs.map(n => n.id === modal.net.id ? { ...n, ...body } : n));
      setModal(null);
      try {
        await api(`/api/networks/${modal.net.id}`, { method: 'PUT', body });
        toast('success', `Network <b>${body.name}</b> updated`);
        load(false);
      } catch (e) { setItems(xs => xs.map(n => n.id === modal.net.id ? prev : n)); toast('error', e.message); }
    } else {
      const tmp = { id: `tmp-${Date.now()}`, ...body, pending: true, link_count: 0, clicks_recent: 0, conversions_recent: 0, revenue_recent: 0, lifetime_revenue: 0, paid: 0, pending_balance: 0 };
      setItems(xs => [...(xs || []), tmp]);
      setModal(null);
      try {
        const created = await api('/api/networks', { method: 'POST', body });
        setItems(xs => (xs || []).map(n => n.id === tmp.id ? created : n));
        toast('success', `Network <b>${body.name}</b> connected 🎉`);
      } catch (e) { setItems(xs => (xs || []).filter(n => n.id !== tmp.id)); toast('error', e.message); }
    }
    setSaving(false);
  };

  const remove = async (net) => {
    if (!await confirm({ title: 'Remove network?', text: `"${net.name}" will be removed. Its ${net.link_count} links become unassigned (clicks stay).`, confirmLabel: 'Remove network' })) return;
    const prev = items;
    setItems(xs => xs.filter(n => n.id !== net.id));
    try {
      await api(`/api/networks/${net.id}`, { method: 'DELETE' });
      toast('success', 'Network removed');
    } catch (e) { setItems(prev); toast('error', e.message); }
  };

  return (
    <div className="content">
      <PageHeader
        title="Networks"
        sub="The affiliate programs you partner with — commissions, cookies and balances"
        actions={<button className="btn btn-primary btn-sm" onClick={() => setModal({ net: null })}><Icon name="plus" size={14} strokeWidth={2.5} /> Connect network</button>}
      />
      {items === null ? (
        <div className="grid-2">{Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} h={200} />)}</div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState icon="globe" title="No networks connected"
            text="Connect Amazon Associates, ClickBank, Impact or any other program to organize links, commissions and payouts."
            action={<button className="btn btn-primary" onClick={() => setModal({ net: null })}><Icon name="plus" size={15} /> Connect your first network</button>} />
        </div>
      ) : (
        <div className="grid-2">
          {items.map(n => (
            <div key={n.id} className="card" style={{ overflow: 'hidden', opacity: n.pending ? 0.5 : 1 }}>
              <div className="card-pad">
                <div className="row-between" style={{ marginBottom: 12 }}>
                  <div className="row gap-sm" style={{ minWidth: 0 }}>
                    <span style={{ width: 40, height: 40, borderRadius: 12, background: `${n.color}22`, color: n.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, flex: 'none' }}>
                      {n.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="bold truncate" style={{ fontSize: 14.5 }}>{n.name}</div>
                      <div className="small muted">{fmtPct(n.commission_rate, 0)} avg. commission · {n.cookie_days}d cookie</div>
                    </div>
                  </div>
                  <div className="row gap-sm">
                    <StatusPill status={n.status} />
                    <Menu trigger={<button className="btn-icon"><Icon name="moreH" size={16} /></button>}>
                      <MenuItem icon="edit" label="Edit" onClick={() => setModal({ net: n })} />
                      <MenuItem icon="trash" label="Remove" danger onClick={() => remove(n)} />
                    </Menu>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
                  <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px' }}>
                    <div className="bold" style={{ fontSize: 16 }}>{fmtNum(n.clicks_recent)}</div>
                    <div className="small muted">Clicks (30d)</div>
                  </div>
                  <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px' }}>
                    <div className="bold" style={{ fontSize: 16, color: 'var(--accent)' }}>{fmtMoney(n.revenue_recent)}</div>
                    <div className="small muted">Revenue (30d)</div>
                  </div>
                  <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px' }}>
                    <div className="bold" style={{ fontSize: 16 }}>{n.link_count}</div>
                    <div className="small muted">Links</div>
                  </div>
                </div>
                <div className="row-between small" style={{ padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 10 }}>
                  <span className="muted">Lifetime {fmtMoney(n.lifetime_revenue)}</span>
                  <span className="row gap-sm">
                    <span className="pill paid">paid {fmtMoney(n.paid)}</span>
                    <span className="pill pending">open {fmtMoney(n.pending_balance ?? n.pending)}</span>
                  </span>
                </div>
                {n.notes ? <div className="row gap-sm small muted" style={{ marginTop: 10 }}><Icon name="edit" size={12} />{n.notes}</div> : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal ? (
        <Modal title={modal.net ? 'Edit network' : 'Connect a network'} subtitle={modal.net ? modal.net.name : 'Add an affiliate program you promote for.'} onClose={() => setModal(null)}>
          <NetworkForm initial={modal.net} onSave={save} onClose={() => setModal(null)} busy={saving} />
        </Modal>
      ) : null}
    </div>
  );
}
