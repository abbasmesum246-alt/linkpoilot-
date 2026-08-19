import { useEffect, useState } from 'react';
import { api, fmtMoney, fmtNum, fmtPct, fmtCompact, timeAgo } from '../api.js';
import { Icon } from '../icons.jsx';
import { Kpi, Seg, Skeleton, EmptyState, StatusPill } from '../ui.jsx';
import { AreaChart, Sparkline, Donut, HBars, MiniBars } from '../charts.jsx';

function useDashboardData(days) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      api(`/api/stats/overview?days=${days}`),
      api(`/api/stats/timeseries?days=${days}`),
      api(`/api/stats/network-share?days=${days}`),
      api(`/api/stats/referrers?days=${days}`),
      api(`/api/links`),
      api(`/api/activity?limit=12`),
    ]).then(([overview, series, share, referrers, links, activity]) => {
      if (!alive) return;
      setData({ overview, series, share, referrers, links, activity });
    }).catch(err => console.error(err)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [days]);
  return { data, loading };
}

const deltaPct = (cur, prev) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

export function Dashboard({ onNavigate }) {
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState('revenue');
  const { data, loading } = useDashboardData(days);

  const o = data?.overview;
  const series = data?.series || [];

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const spark = (key) => <Sparkline data={series.map(d => d[key])} width={92} height={30} />;
  const sparkCl = (key) => <Sparkline data={series.map(d => d[key])} color="#8b5cf6" width={92} height={30} />;

  if (loading || !data) {
    return (
      <div className="content">
        <div className="kpi-grid">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={118} style={{ borderRadius: 'var(--radius)' }} />)}
        </div>
        <div className="grid-main">
          <Skeleton h={330} style={{ borderRadius: 'var(--radius)' }} />
          <Skeleton h={330} style={{ borderRadius: 'var(--radius)' }} />
        </div>
        <div className="grid-2">
          <Skeleton h={250} style={{ borderRadius: 'var(--radius)' }} />
          <Skeleton h={250} style={{ borderRadius: 'var(--radius)' }} />
        </div>
      </div>
    );
  }

  const topLinks = [...data.links].sort((a, b) => b.revenue_recent - a.revenue_recent).slice(0, 5);
  const maxRev = Math.max(...topLinks.map(l => l.revenue_recent), 1);
  const donutData = data.share.filter(s => s.revenue > 0).slice(0, 5).map(s => ({ name: s.name, value: s.revenue, color: s.color }));

  return (
    <div className="content">
      {/* greeting */}
      <div className="row-between wrap" style={{ marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{greeting} 👋</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-3)', fontSize: 13 }}>
            {today} · {fmtNum(o.clicks)} clicks in the last {o.days} days
          </p>
        </div>
        <div className="row gap-sm">
          <Seg options={[{ value: 7, label: '7d' }, { value: 30, label: '30d' }, { value: 90, label: '90d' }]} value={days} onChange={setDays} />
          <button className="btn btn-primary btn-sm" onClick={() => onNavigate('#/links?new=1')}>
            <Icon name="plus" size={14} strokeWidth={2.5} /> New link
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="kpi-grid">
        <Kpi label={`Revenue (${days}d)`} value={fmtMoney(o.revenue)} icon="dollar" tint="var(--accent-soft)"
          delta={deltaPct(o.revenue, o.revenuePrev)} deltaLabel={`vs $${fmtCompact(o.revenuePrev)} prev. period`} spark={spark('revenue')} />
        <Kpi label="Clicks" value={fmtNum(o.clicks)} icon="pointer" tint="var(--blue-soft)"
          delta={deltaPct(o.clicks, o.clicksPrev)} deltaLabel={`vs ${fmtNum(o.clicksPrev)} prev. period`} spark={spark('clicks')} />
        <Kpi label="Conversions" value={fmtNum(o.conversions)} icon="cart" tint="var(--violet-soft)"
          delta={deltaPct(o.conversions, o.conversionsPrev)} deltaLabel={`CR ${fmtPct(o.cr)}`} spark={sparkCl('conversions')} />
        <Kpi label="Earnings per click" value={fmtMoney(o.epc)} icon="trendUp" tint="var(--amber-soft)"
          delta={deltaPct(o.epc, o.epcPrev)} deltaLabel={`${o.activeLinks}/${o.totalLinks} links active`} spark={spark('revenue')} />
      </div>

      {/* main chart + network share */}
      <div className="grid-main">
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Performance</div>
              <div className="card-sub">{days}-day trend across all links</div>
            </div>
            <Seg options={[
              { value: 'revenue', label: 'Revenue' },
              { value: 'clicks', label: 'Clicks' },
              { value: 'conversions', label: 'Conversions' },
            ]} value={metric} onChange={setMetric} />
          </div>
          <div className="card-pad">
            <AreaChart
              data={series}
              series={metric === 'revenue'
                ? [{ key: 'revenue', label: 'Revenue', color: '#10b981' }]
                : metric === 'clicks'
                  ? [{ key: 'clicks', label: 'Clicks', color: '#22d3ee' }]
                  : [{ key: 'conversions', label: 'Conversions', color: '#8b5cf6' }]}
              fmt={metric === 'revenue' ? (v) => fmtMoney(v) : (v) => fmtNum(v)}
              height={270}
            />
            <div className="row wrap gap-lg" style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div className="small muted">Total: <b style={{ color: 'var(--text)' }}>
                {metric === 'revenue' ? fmtMoney(o.revenue) : metric === 'clicks' ? fmtNum(o.clicks) : fmtNum(o.conversions)}
              </b></div>
              <div className="small muted">Daily avg: <b style={{ color: 'var(--text)' }}>
                {metric === 'revenue' ? fmtMoney(o.revenue / days) : metric === 'clicks' ? fmtNum(Math.round(o.clicks / days)) : fmtNum(Math.round(o.conversions / days))}
              </b></div>
              <div className="small muted">Best day: <b style={{ color: 'var(--accent)' }}>
                {metric === 'revenue'
                  ? fmtMoney(Math.max(...series.map(d => d.revenue)))
                  : metric === 'clicks' ? fmtNum(Math.max(...series.map(d => d.clicks))) : fmtNum(Math.max(...series.map(d => d.conversions)))}
              </b></div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Revenue by network</div>
              <div className="card-sub">Share of last {days} days</div>
            </div>
          </div>
          <div className="card-pad">
            {donutData.length ? (
              <Donut data={donutData} centerTitle="revenue" centerValue={fmtMoney(o.revenue)} fmt={(v) => fmtMoney(v)} />
            ) : (
              <EmptyState icon="globe" title="No networks yet" text="Connect your first affiliate network to see revenue share." />
            )}
          </div>
        </div>
      </div>

      {/* top links + referrers + activity */}
      <div className="grid-3">
        <div className="card">
          <div className="card-head">
            <div className="card-title">Top links</div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('#/links')}>View all</button>
          </div>
          <div className="card-pad" style={{ paddingTop: 12 }}>
            {topLinks.length === 0 ? (
              <EmptyState icon="link" title="No links yet" text="Create your first tracking link to start earning." />
            ) : topLinks.map((l, i) => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0', borderBottom: i < topLinks.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
                onClick={() => onNavigate(`#/links?open=${l.id}`)}>
                <span style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 700, flex: 'none' }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="bold small truncate" style={{ fontSize: 12.5 }}>{l.name}</div>
                  <div style={{ height: 5, background: 'var(--surface-3)', borderRadius: 99, marginTop: 5, overflow: 'hidden' }}>
                    <div style={{ width: `${(l.revenue_recent / maxRev) * 100}%`, height: '100%', background: 'var(--accent-grad)', borderRadius: 99 }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right', flex: 'none' }}>
                  <div className="bold small">{fmtMoney(l.revenue_recent)}</div>
                  <div className="small muted" style={{ fontSize: 11 }}>{fmtNum(l.clicks_recent)} clicks</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">Top referrers</div>
            <div className="card-sub">Last {days} days</div>
          </div>
          <div className="card-pad" style={{ paddingTop: 10 }}>
            {data.referrers.length === 0 ? (
              <EmptyState icon="chart" title="No traffic yet" text="Share your links to start collecting referral data." />
            ) : <HBars data={data.referrers.slice(0, 8).map(r => ({ name: r.referrer, value: r.clicks }))} />}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Recent activity</div>
              <div className="card-sub">Your automation feed</div>
            </div>
            <span className="row gap-sm"><span className="live-dot" /><span className="small muted">Live</span></span>
          </div>
          <div className="card-pad" style={{ paddingTop: 8 }}>
            {data.activity.length === 0 ? (
              <EmptyState icon="activity" title="No activity yet" text="Actions like new links and payouts will show up here." />
            ) : data.activity.map((a) => (
              <div key={a.id} className="stat-line" style={{ alignItems: 'flex-start', gap: 10 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', flex: 'none', marginTop: 6,
                  background: a.type === 'success' ? 'var(--accent)' : a.type === 'warning' ? 'var(--amber)' : 'var(--blue)',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>{a.message}</div>
                  <div className="small muted" style={{ fontSize: 11 }}>{timeAgo(a.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
