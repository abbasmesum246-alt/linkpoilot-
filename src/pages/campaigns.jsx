import { useEffect, useState } from 'react';
import { api, fmtMoney, fmtNum, fmtDate } from '../api.js';
import { Icon } from '../icons.jsx';
import { Modal, EmptyState, StatusPill, CardSkeleton, Menu, MenuItem, PageHeader, useToast, useConfirm } from '../ui.jsx';

function CampaignForm({ initial, links, onSave, onClose, busy }) {
  const [form, setForm] = useState(() => ({
    name: initial?.name || '',
    description: initial?.description || '',
    status: initial?.status || 'active',
    budget: initial?.budget || '',
    color: initial?.color || '#6366f1',
    starts_at: initial?.starts_at?.slice(0, 10) || '',
    ends_at: initial?.ends_at?.slice(0, 10) || '',
    link_ids: initial?.link_ids || [],
  }));
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const toggleLink = (id) => setForm(f => ({ ...f, link_ids: f.link_ids.includes(id) ? f.link_ids.filter(x => x !== id) : [...f.link_ids, id] }));
  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#84cc16'];

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="field">
        <label>Campaign name</label>
        <input className="input" placeholder="e.g. Holiday Gift Guide 2026" value={form.name} onChange={set('name')} required autoFocus />
      </div>
      <div className="field">
        <label>Description <span className="hint">(optional)</span></label>
        <textarea className="textarea" placeholder="What is this campaign about and where do you promote it?" value={form.description} onChange={set('description')} rows={2} />
      </div>
      <div className="field-row">
        <div className="field">
          <label>Budget (USD)</label>
          <input className="input" type="number" min="0" step="any" placeholder="e.g. 1500" value={form.budget} onChange={set('budget')} />
        </div>
        <div className="field">
          <label>Status</label>
          <select className="select" value={form.status} onChange={set('status')}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Start date</label>
          <input className="input" type="date" value={form.starts_at} onChange={set('starts_at')} />
        </div>
        <div className="field">
          <label>End date</label>
          <input className="input" type="date" value={form.ends_at} onChange={set('ends_at')} />
        </div>
      </div>
      <div className="field">
        <label>Color</label>
        <div className="row wrap gap-sm">
          {colors.map(c => (
            <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
              style={{ width: 26, height: 26, borderRadius: 8, background: c, border: form.color === c ? '2px solid var(--text)' : '2px solid transparent', cursor: 'pointer', outline: form.color === c ? `2px solid ${c}55` : 'none' }} />
          ))}
        </div>
      </div>
      {links.length > 0 ? (
        <div className="field">
          <label>Assign links ({form.link_ids.length} selected)</label>
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, maxHeight: 160, overflowY: 'auto', background: 'var(--surface-2)', padding: 6 }}>
            {links.map(l => (
              <label className="checkbox" key={l.id} style={{ padding: '6px 8px', borderRadius: 8 }}>
                <input type="checkbox" checked={form.link_ids.includes(l.id)} onChange={() => toggleLink(l.id)} />
                <span className="truncate" style={{ flex: 1 }}>{l.name}</span>
                <span className="muted small">{fmtNum(l.clicks_recent)} clicks</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
      <div className="row" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : initial ? 'Save changes' : 'Create campaign'}</button>
      </div>
    </form>
  );
}

export function Campaigns() {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState(null);
  const [links, setLinks] = useState([]);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async (spinner) => {
    if (spinner) setItems(null);
    try {
      const [c, l] = await Promise.all([api('/api/campaigns'), api('/api/links')]);
      setItems(c); setLinks(l);
    } catch (e) { toast('error', e.message); }
  };
  useEffect(() => { load(true); }, []);

  const save = async (form) => {
    setSaving(true);
    if (modal?.camp) {
      const prev = items.find(c => c.id === modal.camp.id);
      const patch = { ...form, budget: +form.budget || 0 };
      setItems(xs => xs.map(c => c.id === modal.camp.id ? { ...c, ...patch } : c));
      setModal(null);
      try {
        await api(`/api/campaigns/${modal.camp.id}`, { method: 'PUT', body: patch });
        toast('success', `Campaign <b>${form.name}</b> updated`);
        load(false);
      } catch (e) {
        setItems(xs => xs.map(c => c.id === modal.camp.id ? prev : c));
        toast('error', e.message);
      }
    } else {
      const tmp = { id: `tmp-${Date.now()}`, ...form, pending: true, link_count: 0, clicks_recent: 0, conversions_recent: 0, revenue_recent: 0 };
      setItems(xs => [tmp, ...(xs || [])]);
      setModal(null);
      try {
        const created = await api('/api/campaigns', { method: 'POST', body: form });
        setItems(xs => (xs || []).map(c => c.id === tmp.id ? created : c));
        toast('success', `Campaign <b>${form.name}</b> created 🎉`);
      } catch (e) {
        setItems(xs => (xs || []).filter(c => c.id !== tmp.id));
        toast('error', e.message);
      }
    }
    setSaving(false);
  };

  const remove = async (camp) => {
    if (!await confirm({ title: 'Delete campaign?', text: `"${camp.name}" will be removed. Its links stay and become unassigned.`, confirmLabel: 'Delete campaign' })) return;
    const prev = items;
    setItems(xs => xs.filter(c => c.id !== camp.id));
    try {
      await api(`/api/campaigns/${camp.id}`, { method: 'DELETE' });
      toast('success', 'Campaign deleted');
    } catch (e) { setItems(prev); toast('error', e.message); }
  };

  return (
    <div className="content">
      <PageHeader
        title="Campaigns"
        sub={`${items ? items.length : '…'} campaigns · organize links by promotion channel`}
        actions={<button className="btn btn-primary btn-sm" onClick={() => setModal({ camp: null })}><Icon name="plus" size={14} strokeWidth={2.5} /> New campaign</button>}
      />
      {items === null ? (
        <div className="grid-2">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} h={190} />)}
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState icon="target" title="No campaigns yet"
            text="Group your links into campaigns — e.g. YouTube videos, newsletters or seasonal promos — and track each channel's ROI."
            action={<button className="btn btn-primary" onClick={() => setModal({ camp: null })}><Icon name="plus" size={15} /> Create campaign</button>} />
        </div>
      ) : (
        <div className="grid-2">
          {items.map(c => {
            const spendRatio = c.budget > 0 ? Math.min(1, c.revenue_recent / c.budget) : 0;
            return (
              <div key={c.id} className="card" style={{ overflow: 'hidden', opacity: c.pending ? 0.5 : 1, position: 'relative' }}>
                <div style={{ height: 4, background: c.color }} />
                <div className="card-pad">
                  <div className="row-between" style={{ marginBottom: 8 }}>
                    <div className="row gap-sm" style={{ minWidth: 0 }}>
                      <span style={{ width: 34, height: 34, borderRadius: 10, background: `${c.color}1f`, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                        <Icon name="target" size={16} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className="bold truncate">{c.name}</div>
                        {c.description ? <div className="small muted truncate">{c.description}</div> : null}
                      </div>
                    </div>
                    <div className="row gap-sm">
                      <StatusPill status={c.status} />
                      <Menu trigger={<button className="btn-icon"><Icon name="moreH" size={16} /></button>}>
                        <MenuItem icon="edit" label="Edit" onClick={() => setModal({ camp: c })} />
                        <MenuItem icon="trash" label="Delete" danger onClick={() => remove(c)} />
                      </Menu>
                    </div>
                  </div>
                  <div className="row wrap gap-lg small" style={{ color: 'var(--text-2)', marginBottom: 12 }}>
                    <span className="row gap-sm"><Icon name="link" size={13} /> {c.link_count} links</span>
                    <span className="row gap-sm"><Icon name="pointer" size={13} /> {fmtNum(c.clicks_recent)} clicks</span>
                    <span className="row gap-sm"><Icon name="cart" size={13} /> {fmtNum(c.conversions_recent)} conv.</span>
                    <span className="row gap-sm" style={{ color: 'var(--accent)', fontWeight: 700 }}><Icon name="dollar" size={13} /> {fmtMoney(c.revenue_recent)}</span>
                  </div>
                  {c.budget > 0 ? (
                    <>
                      <div className="row-between small" style={{ marginBottom: 6 }}>
                        <span className="muted">Budget usage (revenue)</span>
                        <span className="bold">{fmtMoney(c.revenue_recent)} / {fmtMoney(c.budget)}</span>
                      </div>
                      <div className="progress"><div className={`bar ${spendRatio > 0.85 ? 'warn' : ''}`} style={{ width: `${spendRatio * 100}%`, background: c.color }} /></div>
                    </>
                  ) : null}
                  {(c.starts_at || c.ends_at) ? (
                    <div className="row gap-sm small muted" style={{ marginTop: 10 }}>
                      <Icon name="calendar" size={13} />
                      {fmtDate(c.starts_at, { year: undefined }) || '—'} → {fmtDate(c.ends_at, { year: undefined }) || 'ongoing'}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal ? (
        <Modal title={modal.camp ? 'Edit campaign' : 'New campaign'} subtitle={modal.camp ? modal.camp.name : 'Track a promotion channel end to end.'} onClose={() => setModal(null)}>
          <CampaignForm initial={modal.camp} links={links} onSave={save} onClose={() => setModal(null)} busy={saving} />
        </Modal>
      ) : null}
    </div>
  );
}
