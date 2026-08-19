import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Icon } from './icons.jsx';

// ------------------------------------------------------------------ toasts
export const ToastCtx = createContext(() => {});
export function useToast() { return useContext(ToastCtx); }

export function ToastHost({ toasts, dismiss }) {
  const safe = (msg) => String(msg).replace(/</g, '&lt;').replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>');
  return (
    <div className="toast-host">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <div className="t-icon">
            <Icon name={t.kind === 'success' ? 'check' : t.kind === 'error' ? 'alert' : 'zap'} size={11} strokeWidth={3} />
          </div>
          <div className="t-msg" dangerouslySetInnerHTML={{ __html: safe(t.msg) }} />
          <button className="t-close" onClick={() => dismiss(t.id)}><Icon name="x" size={13} /></button>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ confirm
export const ConfirmCtx = createContext(() => Promise.resolve(true));
export function useConfirm() { return useContext(ConfirmCtx); }

// ------------------------------------------------------------------ modal / drawer
export function Overlay({ children, onClose, drawer }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className={`overlay ${drawer ? 'drawer' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      {children}
    </div>
  );
}

export function Modal({ title, subtitle, onClose, children, footer, wide }) {
  return (
    <Overlay onClose={onClose}>
      <div className="modal" style={wide ? { maxWidth: 640 } : null} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </Overlay>
  );
}

export function Drawer({ title, subtitle, onClose, children, actions }) {
  return (
    <Overlay onClose={onClose} drawer>
      <div className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-head">
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 700 }} className="truncate">{title}</h3>
              {subtitle}
            </div>
          </div>
          <div className="row">
            {actions}
            <button className="btn-icon" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
          </div>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </Overlay>
  );
}

// ------------------------------------------------------------------ empty state
export function EmptyState({ icon = 'inbox', tint = 'rgba(16,185,129,0.12)', title, text, action }) {
  return (
    <div className="empty">
      <div className="empty-art" style={{ background: tint, color: 'var(--accent)' }}>
        <Icon name={icon} size={52} strokeWidth={1.6} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

// ------------------------------------------------------------------ status pill
const PILL_KIND = { active: 'active', paused: 'paused', pending: 'pending', processing: 'processing', paid: 'paid', draft: 'draft' };
export function StatusPill({ status }) {
  return <span className={`pill ${PILL_KIND[status] || 'draft'}`}><span className="dot" />{status}</span>;
}

// ------------------------------------------------------------------ skeleton
export function Skeleton({ h = 14, w = '100%', style }) {
  return <div className="skeleton" style={{ height: h, width: w, ...style }} />;
}

export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div style={{ padding: 6 }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 22, padding: '15px 14px', borderBottom: '1px solid var(--border)' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} h={13} w={c === 0 ? '70%' : '100%'} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ h = 120 }) {
  return <Skeleton h={h} style={{ borderRadius: 'var(--radius)' }} />;
}

// ------------------------------------------------------------------ copy button
export function CopyBtn({ text, label = 'Copy', iconOnly }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const onClick = async (e) => {
    e.stopPropagation();
    const ok = await import('./api.js').then(m => m.copyText(text));
    if (ok) {
      setCopied(true);
      toast('success', 'Copied to clipboard');
      setTimeout(() => setCopied(false), 1600);
    } else toast('error', 'Copy failed');
  };
  return iconOnly ? (
    <button className="btn-icon" onClick={onClick} title={label} style={{ color: copied ? 'var(--accent)' : undefined }}>
      <Icon name={copied ? 'check' : 'copy'} size={14} />
    </button>
  ) : (
    <button className="btn btn-sm btn-secondary" onClick={onClick}>
      <Icon name={copied ? 'check' : 'copy'} size={13} /> {copied ? 'Copied' : label}
    </button>
  );
}

// ------------------------------------------------------------------ dropdown menu
export function Menu({ trigger, children, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="menu-wrap" ref={ref} onClick={(e) => e.stopPropagation()}>
      <div onClick={() => setOpen(o => !o)}>{trigger}</div>
      {open ? <div className="menu" style={align === 'left' ? { right: 'auto', left: 0 } : null}>{children}</div> : null}
    </div>
  );
}

export function MenuItem({ icon, label, danger, onClick }) {
  return (
    <button onClick={() => onClick()}>
      <Icon name={icon} size={15} /> {label}
    </button>
  );
}

// ------------------------------------------------------------------ avatar
const AV_COLORS = [
  'linear-gradient(135deg,#10b981,#22d3ee)', 'linear-gradient(135deg,#8b5cf6,#ec4899)',
  'linear-gradient(135deg,#f59e0b,#f43f5e)', 'linear-gradient(135deg,#3b82f6,#06b6d4)',
  'linear-gradient(135deg,#84cc16,#10b981)',
];
export function Avatar({ name, size = 34 }) {
  const initials = (name || '?').split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
  let hash = 0;
  for (const ch of (name || '')) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  const bg = AV_COLORS[hash % AV_COLORS.length];
  return (
    <div className="avatar" style={{ width: size, height: size, background: bg, fontSize: size * 0.38 }}>
      {initials}
    </div>
  );
}

// ------------------------------------------------------------------ page header
export function PageHeader({ title, sub, actions }) {
  return (
    <div className="row-between wrap" style={{ marginBottom: 18 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</h1>
        {sub ? <p style={{ margin: '4px 0 0', color: 'var(--text-3)', fontSize: 13 }}>{sub}</p> : null}
      </div>
      {actions ? <div className="row wrap gap-sm">{actions}</div> : null}
    </div>
  );
}

// ------------------------------------------------------------------ stat tile for dashboard
export function Kpi({ label, value, sub, icon, tint, delta, deltaLabel, spark }) {
  const up = delta >= 0;
  return (
    <div className="kpi">
      <div className="kpi-top">
        <span className="kpi-icon" style={{ background: tint || 'var(--accent-soft)', color: 'var(--accent)' }}>
          <Icon name={icon} size={17} />
        </span>
        {delta !== undefined && delta !== null ? (
          <span className={`delta ${up ? 'up' : 'down'}`}>
            <Icon name={up ? 'arrowUp' : 'arrowDown'} size={11} strokeWidth={2.6} />
            {Math.abs(delta).toFixed(delta < 100 ? 1 : 0)}%
          </span>
        ) : null}
      </div>
      <div>
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
      </div>
      <div className="kpi-foot">
        {deltaLabel ? <span className="small muted">{deltaLabel}</span> : sub ? <span className="small muted">{sub}</span> : null}
        {spark ? <span className="kpi-spark">{spark}</span> : null}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ segmented control
export function Seg({ options, value, onChange }) {
  return (
    <div className="seg">
      {options.map(o => (
        <button key={o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
