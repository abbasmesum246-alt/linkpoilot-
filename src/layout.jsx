import { useState } from 'react';
import { Icon } from './icons.jsx';
import { Avatar, Menu, MenuItem } from './ui.jsx';

export const NAV = [
  { section: 'Overview', items: [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid', path: '#/dashboard' },
    { id: 'opportunities', label: 'Opportunities', icon: 'rocket', path: '#/opportunities' },
    { id: 'assistant', label: 'AI Assistant', icon: 'sparkle', path: '#/assistant' },
  ]},
  { section: 'Manage', items: [
    { id: 'links', label: 'Affiliate Links', icon: 'link', path: '#/links' },
    { id: 'campaigns', label: 'Campaigns', icon: 'target', path: '#/campaigns' },
    { id: 'networks', label: 'Networks', icon: 'globe', path: '#/networks' },
    { id: 'payouts', label: 'Payouts', icon: 'wallet', path: '#/payouts' },
    { id: 'strategies', label: 'Strategies', icon: 'flag', path: '#/strategies' },
  ]},
  { section: 'System', items: [
    { id: 'integrations', label: 'Integrations', icon: 'plug', path: '#/integrations' },
    { id: 'settings', label: 'Settings', icon: 'settings', path: '#/settings' },
  ]},
];

export function Sidebar({ route, collapsed, open, onToggle, onNavigate, user }) {
  return (
    <>
      {open ? <div className="sidebar-backdrop" onClick={onToggle} /> : null}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="logo">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M6.5 12c1.6-4.2 3.2-6.7 4.8-6.7S14.5 7.8 16.1 12s-3.2 6.7-4.8 6.7S8.1 16.2 6.5 12z" fill="#04140d" transform="rotate(45 11.3 12)" />
              <circle cx="12" cy="12" r="2.4" fill="#04140d" opacity=".85" />
            </svg>
          </div>
          <div>
            <div className="brand-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Link<span>Pilot</span>
              {user?.is_demo ? <span className="pill rose" style={{ fontSize: 9, padding: '1px 6px', letterSpacing: '0.08em' }}>DEMO</span> : null}
            </div>
            <div className="brand-sub">{user?.is_demo ? 'Virtual practice mode' : 'Affiliate OS'}</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map(group => (
            <div key={group.section}>
              <div className="nav-section-label">{group.section}</div>
              {group.items.map(item => (
                <a key={item.id}
                  className={`nav-item ${route === item.id ? 'active' : ''}`}
                  href={item.path}
                  onClick={(e) => { e.preventDefault(); onNavigate(item.path); }}
                  title={item.label}
                >
                  <Icon name={item.icon} size={18} strokeWidth={2} />
                  <span className="nav-label">{item.label}</span>
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="upgrade-card">
            {user?.is_demo ? (
              <>
                <h4>🎓 You're in demo mode</h4>
                <p>All data &amp; connections are virtual for learning. Create a free account for real tracking, redirects and webhooks.</p>
                <button className="btn btn-sm btn-primary btn-block" onClick={() => onNavigate('#/register')}>
                  Create a real account
                </button>
              </>
            ) : (
              <>
                <h4>🚀 Scale your earnings</h4>
                <p>Ask the AI copilot for live offers, strategies and growth tactics.</p>
                <button className="btn btn-sm btn-primary btn-block" onClick={() => onNavigate('#/assistant')}>
                  Ask the copilot
                </button>
              </>
            )}
          </div>
          <a className="nav-item" href="#/settings" onClick={(e) => { e.preventDefault(); onNavigate('#/settings'); }}>
            <Avatar name={user?.name || '?'} size={26} />
            <span className="nav-label">
              <span className="sflabel bold" style={{ display: 'block', fontSize: 13 }}>{user?.name}</span>
              <span className="sflabel small muted">{user?.email}</span>
            </span>
          </a>
        </div>
      </aside>
    </>
  );
}

const TITLES = {
  dashboard: ['Dashboard', 'Your affiliate business at a glance'],
  opportunities: ['Opportunities', 'Live offers, rates and growth across affiliate types'],
  assistant: ['AI Assistant', 'Your copilot with live web research'],
  links: ['Affiliate Links', 'Create, track and manage your smart links'],
  campaigns: ['Campaigns', 'Organize links into campaigns and track spend'],
  networks: ['Networks', 'The affiliate programs you partner with'],
  payouts: ['Payouts', 'Track commissions paid out by each network'],
  strategies: ['Strategies', 'Prepared promotion plans for offers and opportunities'],
  integrations: ['Integrations', 'Connect real platforms, APIs and webhooks'],
  settings: ['Settings', 'Profile, security and preferences'],
};

export function Topbar({ route, onMenu, user, onNavigate, onLogout, theme, setTheme }) {
  const title = TITLES[route] || ['LinkPilot', ''];
  return (
    <header className="topbar">
      <button className="btn-icon show-sm" onClick={onMenu} aria-label="Open menu"><Icon name="menu" size={18} /></button>
      <div className="page-title">
        {title[0]}
        <small>{title[1]}</small>
      </div>
      <div className="grow" />
      <button
        className="btn-icon hide-md" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
      </button>
      <button className="btn btn-primary btn-sm hide-sm" onClick={() => onNavigate('#/links?new=1')}>
        <Icon name="plus" size={14} strokeWidth={2.5} /> New link
      </button>
      <Menu
        trigger={<Avatar name={user?.name || '?'} size={34} />}
      >
        <div style={{ padding: '8px 10px 6px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
          <div className="bold" style={{ fontSize: 13 }}>{user?.name}</div>
          <div className="small muted">{user?.email}</div>
        </div>
        <MenuItem icon="settings" label="Settings" onClick={() => onNavigate('#/settings')} />
        <MenuItem icon="plug" label="Integrations" onClick={() => onNavigate('#/integrations')} />
        <div className="menu-sep" />
        <MenuItem icon="logout" label="Sign out" danger onClick={onLogout} />
      </Menu>
    </header>
  );
}

export function Shell({ children, route, user, onNavigate, onLogout, theme, setTheme }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('lp_sidebar') === '1');
  const toggleCollapse = () => {
    setCollapsed(c => { localStorage.setItem('lp_sidebar', c ? '0' : '1'); return !c; });
  };
  return (
    <div className="app-shell">
      <Sidebar
        route={route} collapsed={collapsed} open={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        onNavigate={(p) => { setSidebarOpen(false); onNavigate(p); }}
        user={user}
      />
      <div className={`main ${collapsed ? 'collapsed' : ''}`}>
        <Topbar
          route={route} onMenu={() => setSidebarOpen(o => !o)} user={user}
          onNavigate={onNavigate} onLogout={onLogout} theme={theme} setTheme={setTheme}
        />
        {user?.is_demo ? (
          <div style={{
            background: 'linear-gradient(90deg, rgba(245,158,11,0.13), rgba(244,63,94,0.08))',
            borderBottom: '1px solid rgba(245,158,11,0.25)', padding: '7px 26px',
            fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          }}>
            <span className="pill rose" style={{ fontSize: 9.5, letterSpacing: '0.08em' }}>DEMO</span>
            <span style={{ flex: 1 }}>Guest mode — all features work, but data and connections are <b>virtual for learning</b>. Clicks are simulated instead of redirecting to merchants.</span>
            <a href="#/register" onClick={(e) => { e.preventDefault(); onNavigate('#/register'); }} style={{ color: 'var(--amber)', fontWeight: 700 }}>Create a real account →</a>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
