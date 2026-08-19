import { useEffect, useRef, useState } from 'react';
import { fmtNum, fmtMoney, fmtCompact } from './api.js';

// ---------- geometry helpers ----------
function smoothPath(pts) {
  if (pts.length === 0) return '';
  if (pts.length === 1) {
    const [x, y] = pts[0];
    return `M${x},${y} L${x + 0.5},${y}`;
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const mx = (x0 + x1) / 2;
    d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
  }
  return d;
}

function niceMax(v) {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return m * pow;
}

// ---------- sparkline ----------
export function Sparkline({ data, color = 'var(--accent)', width = 96, height = 32, fill = true }) {
  if (!data || data.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * (width - 4) + 2,
    height - 4 - ((v - min) / range) * (height - 10),
  ]);
  const line = smoothPath(pts);
  const area = `${line} L${pts[pts.length - 1][0]},${height - 2} L${pts[0][0]},${height - 2} Z`;
  const gid = `sg${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg width={width} height={height}>
      {fill ? (
        <>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gid})`} />
        </>
      ) : null}
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// ---------- area chart with tooltip ----------
export function AreaChart({ data, series = [{ key: 'revenue', label: 'Revenue', color: '#10b981' }], height = 240, fmt = (v) => fmtMoney(v), dateFmt = (d) => d }) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(600);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (typeof ResizeObserver === 'undefined') { setW(el.clientWidth || 600); return; }
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  if (!data || data.length === 0) {
    return (
      <div ref={wrapRef} style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 12.5, flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 22, opacity: 0.6 }}>📈</span>
        No data for this period yet
      </div>
    );
  }

  const padL = 46, padR = 12, padT = 14, padB = 26;
  const iw = Math.max(80, w - padL - padR);
  const ih = height - padT - padB;
  const maxV = niceMax(Math.max(...data.flatMap(d => series.map(s => d[s.key] || 0))));
  const x = (i) => (data.length < 2 ? padL + iw / 2 : padL + (i / (data.length - 1)) * iw);
  const y = (v) => padT + ih - (v / maxV) * ih;

  const lines = series.map(s => ({
    ...s,
    path: smoothPath(data.map((d, i) => [x(i), y(d[s.key] || 0)])),
    area: smoothPath(data.map((d, i) => [x(i), y(d[s.key] || 0)])) + ` L${x(data.length - 1)},${padT + ih} L${x(0)},${padT + ih} Z`,
    gid: `ag${Math.random().toString(36).slice(2, 7)}`,
  }));

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map(f => maxV * f);
  const labelIdx = new Set([0, Math.floor((data.length - 1) / 2), data.length - 1]);

  const onMove = (e) => {
    const rect = wrapRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.round(((px - padL) / iw) * (data.length - 1));
    if (i >= 0 && i < data.length) setHover(i);
  };

  return (
    <div ref={wrapRef} className="pos-rel" style={{ width: '100%' }}>
      <svg width={w} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {gridVals.map((gv, gi) => (
          <g key={gi}>
            <line x1={padL} x2={w - padR} y1={y(gv)} y2={y(gv)} stroke="var(--chart-grid)" strokeWidth="1" strokeDasharray={gi === 0 ? '0' : '3 4'} />
            <text x={padL - 8} y={y(gv) + 3.5} textAnchor="end" fontSize="10" fill="var(--text-3)">{fmtCompact(gv)}</text>
          </g>
        ))}
        {data.map((d, i) =>
          labelIdx.has(i) ? (
            <text key={i} x={x(i)} y={height - 8} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} fontSize="10" fill="var(--text-3)">
              {dateFmt(d.date)}
            </text>
          ) : null
        )}
        {lines.map(l => (
          <g key={l.key}>
            <defs>
              <linearGradient id={l.gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={l.color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={l.color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={l.area} fill={`url(#${l.gid})`} />
            <path d={l.path} fill="none" stroke={l.color} strokeWidth="2.2" strokeLinecap="round" />
          </g>
        ))}
        {hover !== null ? (
          <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + ih} stroke="var(--border-strong)" strokeDasharray="3 3" />
        ) : null}
        {hover !== null ? (
          series.map(s => (
            <circle key={s.key} cx={x(hover)} cy={y(data[hover][s.key] || 0)} r="4" fill={s.color} stroke="var(--surface)" strokeWidth="2" />
          ))
        ) : null}
      </svg>
      {hover !== null ? (
        <div className="chart-tip" style={{ left: x(hover), top: y(Math.min(...series.map(s => data[hover][s.key] || 0))) }}>
          <div className="t-date">{new Date(data[hover].date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
          {series.map(s => (
            <div className="t-row" key={s.key} style={{ color: s.color }}>
              <span className="t-dot" style={{ background: s.color }} />{s.label}: {fmt(data[hover][s.key] || 0)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---------- horizontal bars ----------
export function HBars({ data, fmt = (v) => fmtNum(v), color = 'var(--accent-grad)', labelKey = 'name', valueKey = 'value' }) {
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <div>
      {data.map((d, i) => (
        <div className="hbar-row" key={i}>
          <span className="hb-name" title={d[labelKey]}>{d[labelKey]}</span>
          <div className="hb-track">
            <div className="hb-fill" style={{ width: `${Math.max(3, ((d[valueKey] || 0) / max) * 100)}%`, background: color }} />
          </div>
          <span className="hb-val">{fmt(d[valueKey])}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- donut ----------
export function Donut({ data, size = 168, thickness = 20, centerTitle, centerValue, fmt = (v) => fmtCompact(v) }) {
  const total = Math.max(data.reduce((s, d) => s + (d.value || 0), 0), 1);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="row wrap gap-lg" style={{ justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={thickness} />
          {data.map((d, i) => {
            const frac = (d.value || 0) / total;
            const dash = frac * c;
            const el = (
              <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={d.color} strokeWidth={thickness} strokeLinecap="round"
                strokeDasharray={`${Math.max(dash - 2, 0.5)} ${c - Math.max(dash - 2, 0.5)}`}
                strokeDashoffset={-acc * c}
                style={{ transition: 'stroke-dasharray 0.6s ease' }} />
            );
            acc += frac;
            return el;
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em' }}>{centerValue ?? fmt(total)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{centerTitle || 'total'}</div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 150 }}>
        {data.map((d, i) => (
          <div className="stat-line" key={i}>
            <span className="sl-left">
              <span style={{ width: 9, height: 9, borderRadius: 3, background: d.color, flex: 'none' }} />
              <span className="sl-name">{d.name}</span>
            </span>
            <span className="sl-val">{fmt(d.value)} <span className="sl-sub">{((d.value || 0) / total * 100).toFixed(0)}%</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- mini bar chart (per-day clicks) ----------
export function MiniBars({ data, color = 'var(--accent)', height = 40 }) {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height }}>
      {data.map((v, i) => (
        <div key={i} style={{
          flex: 1, height: `${(v / max) * 100}%`, minHeight: v > 0 ? 2 : 1,
          background: color, borderRadius: 2, opacity: 0.85,
        }} />
      ))}
    </div>
  );
}
