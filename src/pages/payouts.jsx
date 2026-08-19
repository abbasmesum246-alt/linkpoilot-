import { useEffect, useState } from 'react';
import { api, fmtMoney, fmtDate, timeAgo } from '../api.js';
import { Icon } from '../icons.jsx';
import { Modal, EmptyState, StatusPill, TableSkeleton, Menu, MenuItem, PageHeader, useToast, useConfirm, Seg } from '../ui.jsx';

function PayoutForm({ initial, networks, onSave, onClose, busy }) {
  const [form, setForm] = useState(() => ({
    network_id: initial?.network_id ?? '',
    amount: initial?.amount ?? '',
    status: initial?.status || 'pending',
    method: initial?.method || 'Bank transfer',
    reference: initial?.reference || '',
    notes: initial?.notes || '',
    requested_at: initial?.requested_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
  }));
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="field">
        <label>Network</label>
        <select className="select" value={form.network_id} onChange={set('network_id')} required autoFocus>
          <option value="">— Select network —</option>
          {networks.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
        </select>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Amount (USD)</label>
          <input className="input" type="number" min="0.01" step="any" placeholder="0.00" value={form.amount} onChange={set('amount')} required />
        </div>
        <div className="field">
          <label>Status</label>
          <select className="select" value={form.status} onChange={set('status')}>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Payout method</label>
          <select className="select" value={form.method} onChange={set('method')}>
            <option>Bank transfer</option><option>PayPal</option><option>Direct deposit</option>
            <option>Wire transfer</option><option>Check</option><option>Gift card</option>
          </select>
        </div>
        <div className="field">
          <label>Requested date</label>
          <input className="input" type="date" value={form.requested_at} onChange={set('requested_at')} />
        </div>
      </div>
      <div className="field">
        <label>Reference <span className="hint">(invoice / transaction ID)</span></label>
        <input className="input mono" placeholder="e.g. AMZ-2026-08" value={form.reference} onChange={set('reference')} />
      </div>
      <div className="field">
        <label>Notes</label>
        <textarea className="textarea" rows={2} value={form.notes} onChange={set('notes')} />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : initial ? 'Save changes' : 'Add payout'}</button>
      </div>
    </form>
  );
}

export function Payouts() {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState(null); // { payouts, paid, pending }
  const [networks, setNetworks] = useState([]);
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async (spinner) => {
    if (spinner) setData(null);
    try {
      const [p, n] = await Promise.all([api('/api/payouts'), api('/api/networks')]);
      setData(p); setNetworks(n);
    } catch (e) { toast('error', e.message); }
  };
  useEffect(() => { load(true); }, []);

  const save = async (form) => {
    setSaving(true);
    if (modal?.p) {
      const prev = data.payouts.find(p => p.id === modal.p.id);
      const patch = { ...form, network_name: networks.find(n => n.id === +form.network_id)?.name };
      setData(d => ({ ...d, payouts: d.payouts.map(p => p.id === modal.p.id ? { ...p, ...patch, amount: +form.amount } : p) }));
      setModal(null);
      try {
        await api(`/api/payouts/${modal.p.id}`, { method: 'PUT', body: { ...form, amount: +form.amount } });
        toast('success', form.status === 'paid' && prev.status !== 'paid' ? `Payout marked as paid 💰` : 'Payout updated');
        load(false);
      } catch (e) {
        setData(d => ({ ...d, payouts: d.payouts.map(p => p.id === modal.p.id ? prev : p) }));
        toast('error', e.message);
      }
    } else {
      const tmp = { id: `tmp-${Date.now()}`, ...form, amount: +form.amount, network_name: networks.find(n => n.id === +form.network_id)?.name, network_color: '#6366f1', pending: true };
      setData(d => ({ ...d, payouts: [tmp, ...d.payouts] }));
      setModal(null);
      try {
        const created = await api('/api/payouts', { method: 'POST', body: { ...form, amount: +form.amount } });
        setData(d => ({ ...d, payouts: d.payouts.map(p => p.id === tmp.id ? created : p) }));
        toast('success', 'Payout added');
      } catch (e) {
        setData(d => ({ ...d, payouts: d.payouts.filter(p => p.id !== tmp.id) }));
        toast('error', e.message);
      }
    }
    setSaving(false);
  };

  const markPaid = async (p) => {
    const prev = data;
    setData(d => ({ ...d, payouts: d.payouts.map(x => x.id === p.id ? { ...x, status: 'paid', paid_at: new Date().toISOString() } : x) }));
    try {
      await api(`/api/payouts/${p.id}`, { method: 'PUT', body: { status: 'paid' } });
      toast('success', `Payout of <b>${fmtMoney(p.amount)}</b> marked as paid 💰`);
      load(false);
    } catch (e) { setData(prev); toast('error', e.message); }
  };

  const remove = async (p) => {
    if (!await confirm({ title: 'Delete payout?', text: `The payout record of ${fmtMoney(p.amount)} will be deleted.`, confirmLabel: 'Delete payout' })) return;
    const prev = data;
    setData(d => ({ ...d, payouts: d.payouts.filter(x => x.id !== p.id) }));
    try {
      await api(`/api/payouts/${p.id}`, { method: 'DELETE' });
      toast('success', 'Payout deleted');
    } catch (e) { setData(prev); toast('error', e.message); }
  };

  const shown = data ? data.payouts.filter(p => filter === 'all' || p.status === filter) : [];
  const sum = (arr, f) => arr.filter(f).reduce((s, p) => s + p.amount, 0);

  return (
    <div className="content">
      <PageHeader
        title="Payouts"
        sub="Every commission payment you've requested and received"
        actions={<button className="btn btn-primary btn-sm" onClick={() => setModal({ p: null })}><Icon name="plus" size={14} strokeWidth={2.5} /> Add payout</button>}
      />

      <div className="kpi-grid cols-3">
        <div className="kpi">
          <div className="kpi-top"><span className="kpi-icon" style={{ background: 'var(--accent-soft)' }}><Icon name="check" size={17} /></span></div>
          <div><div className="kpi-label">Paid out (lifetime)</div><div className="kpi-value">{data ? fmtMoney(data.paid) : '…'}</div></div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><span className="kpi-icon" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}><Icon name="clock" size={17} /></span></div>
          <div><div className="kpi-label">Pending / processing</div><div className="kpi-value">{data ? fmtMoney(data.pending) : '…'}</div></div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><span className="kpi-icon" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}><Icon name="wallet" size={17} /></span></div>
          <div><div className="kpi-label">This month received</div><div className="kpi-value">{data ? fmtMoney(sum(data.payouts, p => p.status === 'paid' && new Date(p.paid_at) > new Date(Date.now() - 30 * 86400000))) : '…'}</div></div>
        </div>
      </div>

      <div className="card">
        <div className="card-head" style={{ paddingBottom: 12 }}>
          <Seg options={[
            { value: 'all', label: `All (${data ? data.payouts.length : '…'})` },
            { value: 'pending', label: 'Pending' },
            { value: 'processing', label: 'Processing' },
            { value: 'paid', label: 'Paid' },
          ]} value={filter} onChange={setFilter} />
        </div>
        {data === null ? (
          <TableSkeleton rows={5} cols={6} />
        ) : shown.length === 0 ? (
          <EmptyState icon="wallet" title={filter === 'all' ? 'No payouts recorded' : `No ${filter} payouts`}
            text="Record payouts from your networks and mark them paid as the money lands."
            action={<button className="btn btn-primary" onClick={() => setModal({ p: null })}><Icon name="plus" size={15} /> Add payout</button>} />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Network</th>
                  <th className="num">Amount</th>
                  <th>Status</th>
                  <th className="hide-sm">Method</th>
                  <th className="hide-sm">Requested</th>
                  <th className="hide-sm">Paid on</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {shown.map(p => (
                  <tr key={p.id} style={{ opacity: p.pending ? 0.5 : 1 }}>
                    <td>
                      <div className="row-name">
                        <span style={{ width: 30, height: 30, borderRadius: 9, background: `${p.network_color || '#6366f1'}22`, color: p.network_color || '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flex: 'none' }}>
                          {(p.network_name || '?').slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <div>{p.network_name || '—'}</div>
                          <div className="row-sub mono">{p.reference || 'no reference'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="num bold" style={{ color: p.status === 'paid' ? 'var(--accent)' : 'var(--text)' }}>{fmtMoney(p.amount)}</td>
                    <td><StatusPill status={p.status} /></td>
                    <td className="hide-sm muted">{p.method}</td>
                    <td className="hide-sm muted">{fmtDate(p.requested_at)}</td>
                    <td className="hide-sm muted">{p.paid_at ? `${fmtDate(p.paid_at)} · ${timeAgo(p.paid_at)}` : '—'}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Menu trigger={<button className="btn-icon"><Icon name="moreH" size={16} /></button>}>
                        {p.status !== 'paid' ? <MenuItem icon="check" label="Mark as paid" onClick={() => markPaid(p)} /> : null}
                        <MenuItem icon="edit" label="Edit" onClick={() => setModal({ p })} />
                        <MenuItem icon="trash" label="Delete" danger onClick={() => remove(p)} />
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
        <Modal title={modal.p ? 'Edit payout' : 'Add payout'} subtitle={modal.p ? `${modal.p.network_name || ''} · ${fmtMoney(modal.p.amount)}` : 'Record a commission payment.'} onClose={() => setModal(null)}>
          <PayoutForm initial={modal.p} networks={networks} onSave={save} onClose={() => setModal(null)} busy={saving} />
        </Modal>
      ) : null}
    </div>
  );
}
