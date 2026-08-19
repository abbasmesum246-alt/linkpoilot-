import { useEffect, useState } from 'react';
import { api, fmtDate } from '../api.js';
import { Icon } from '../icons.jsx';
import { Drawer, EmptyState, PageHeader, Skeleton, Menu, MenuItem, useToast, useConfirm } from '../ui.jsx';

export function Strategies({ onNavigate }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState(null);
  const [openId, setOpenId] = useState(null);

  const load = () => api('/api/strategies').then(setItems).catch(e => toast('error', e.message));
  useEffect(() => { load(); }, []);

  const remove = async (s) => {
    if (!await confirm({ title: 'Delete strategy?', text: `"${s.title}" will be removed from your library.`, confirmLabel: 'Delete strategy' })) return;
    const prev = items;
    setItems(xs => xs.filter(x => x.id !== s.id));
    try {
      await api(`/api/strategies/${s.id}`, { method: 'DELETE' });
      toast('success', 'Strategy deleted');
    } catch (e) { setItems(prev); toast('error', e.message); }
  };

  const open = items?.find(s => s.id === openId);

  return (
    <div className="content">
      <PageHeader
        title="Strategies"
        sub="Prepared promotion plans for offers — saved from Opportunities or the AI copilot"
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => onNavigate('#/opportunities')}>
            <Icon name="rocket" size={14} /> Find an opportunity
          </button>
        }
      />
      {items === null ? (
        <div className="grid-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={160} style={{ borderRadius: 'var(--radius)' }} />)}</div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="flag"
            title="No strategies yet"
            text="Generate a full promotion plan for any affiliate offer — channels, content ideas, click tactics, KPIs and timeline."
            action={
              <div className="row gap-sm">
                <button className="btn btn-primary" onClick={() => onNavigate('#/opportunities')}><Icon name="rocket" size={15} /> Browse opportunities</button>
                <button className="btn btn-secondary" onClick={() => onNavigate('#/assistant')}><Icon name="sparkle" size={15} /> Ask the AI copilot</button>
              </div>
            }
          />
        </div>
      ) : (
        <div className="grid-2">
          {items.map(s => {
            const c = s.content;
            return (
              <div key={s.id} className="card card-pad" style={{ cursor: 'pointer', position: 'relative' }} onClick={() => setOpenId(s.id)}>
                <div className="row-between" style={{ marginBottom: 8 }}>
                  <div className="row gap-sm" style={{ minWidth: 0 }}>
                    <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--violet-soft)', color: 'var(--violet)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                      <Icon name="flag" size={16} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="bold truncate">{s.title}</div>
                      <div className="small muted">{fmtDate(s.created_at)}</div>
                    </div>
                  </div>
                  <Menu trigger={<span onClick={(e) => e.stopPropagation()}><button className="btn-icon"><Icon name="moreH" size={16} /></button></span>}>
                    <MenuItem icon="eye" label="Open" onClick={() => setOpenId(s.id)} />
                    <MenuItem icon="trash" label="Delete" danger onClick={() => remove(s)} />
                  </Menu>
                </div>
                <div className="small muted" style={{ lineHeight: 1.6, marginBottom: 10 }}>{c.goal}</div>
                <div className="row wrap gap-sm">
                  {c.channels.slice(0, 3).map((ch, i) => (
                    <span key={i} className="pill violet">{i + 1}. {ch.channel}</span>
                  ))}
                </div>
                <div className="row-between small muted" style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  <span>{c.content_ideas.length} content ideas</span>
                  <span>{c.click_tactics.length} click tactics</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{c.kpis.revenue_estimate.split('≈ ')[1]}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open ? (
        <Drawer
          title={open.title}
          subtitle={<span className="small muted">prepared {fmtDate(open.created_at)}</span>}
          onClose={() => setOpenId(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--accent-soft)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 12, padding: 14 }}>
              <div className="small bold" style={{ color: 'var(--accent)', marginBottom: 4 }}>🎯 THE OPPORTUNITY</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>{open.content.goal}</div>
            </div>
            <div>
              <div className="small bold muted" style={{ marginBottom: 6 }}>POSITIONING</div>
              <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6 }}>{open.content.positioning}</div>
            </div>
            <div>
              <div className="small bold muted" style={{ marginBottom: 8 }}>CHANNELS</div>
              {open.content.channels.map(c => (
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
              <div className="small bold muted" style={{ marginBottom: 8 }}>CONTENT IDEAS</div>
              {open.content.content_ideas.map((c, i) => (
                <div key={i} className="row gap-sm" style={{ padding: '5px 0', fontSize: 12.5 }}>
                  <Icon name="check" size={13} style={{ color: 'var(--accent)', flex: 'none' }} /> {c}
                </div>
              ))}
            </div>
            <div>
              <div className="small bold muted" style={{ marginBottom: 8 }}>CLICK-BOOSTING TACTICS</div>
              {open.content.click_tactics.map((c, i) => (
                <div key={i} className="row gap-sm" style={{ padding: '5px 0', fontSize: 12.5 }}>
                  <Icon name="zap" size={13} style={{ color: 'var(--amber)', flex: 'none' }} /> {c}
                </div>
              ))}
            </div>
            <div>
              <div className="small bold muted" style={{ marginBottom: 8 }}>30-DAY TIMELINE</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {open.content.timeline.map((t, i) => (
                  <div key={i} className="row gap-sm" style={{ fontSize: 12.5 }}><span className="mono small muted">{i + 1}.</span> {t}</div>
                ))}
              </div>
            </div>
            <div className="grid-2" style={{ marginBottom: 0 }}>
              <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 12 }}>
                <div className="small bold muted" style={{ marginBottom: 6 }}>KPIs</div>
                <div className="small" style={{ lineHeight: 1.8 }}>{open.content.kpis.ctr_target}<br />{open.content.kpis.cr_target}<br />{open.content.kpis.revenue_estimate}</div>
              </div>
              <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 12 }}>
                <div className="small bold muted" style={{ marginBottom: 6 }}>RISKS & NOTES</div>
                <div className="small" style={{ lineHeight: 1.8 }}>{open.content.risks.map(r => `• ${r}`).join('\n')}</div>
              </div>
            </div>
          </div>
        </Drawer>
      ) : null}
    </div>
  );
}
