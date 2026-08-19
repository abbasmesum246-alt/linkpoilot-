import { createRoot } from 'react-dom/client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { Icon } from './icons.jsx';
import { ToastCtx, ToastHost, ConfirmCtx, Modal } from './ui.jsx';
import { Shell } from './layout.jsx';
import { Login, Register } from './pages/auth.jsx';
import { Dashboard } from './pages/dashboard.jsx';
import { Links } from './pages/links.jsx';
import { Campaigns } from './pages/campaigns.jsx';
import { Networks } from './pages/networks.jsx';
import { Payouts } from './pages/payouts.jsx';
import { Integrations } from './pages/integrations.jsx';
import { Settings } from './pages/settings.jsx';
import { Opportunities } from './pages/opportunities.jsx';
import { Strategies } from './pages/strategies.jsx';
import { Assistant } from './pages/assistant.jsx';

function parseHash() {
  const raw = window.location.hash.replace(/^#/, '') || '/dashboard';
  const [pathPart, queryPart] = raw.split('?');
  const path = pathPart.replace(/^\/+|\/+$/g, '') || 'dashboard';
  const query = Object.fromEntries(new URLSearchParams(queryPart || ''));
  return { path, query };
}

function useRoute() {
  const [route, setRoute] = useState(parseHash());
  useEffect(() => {
    const h = () => setRoute(parseHash());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  const navigate = useCallback((hash) => {
    if (window.location.hash === hash) {
      setRoute(parseHash());
    } else {
      window.location.hash = hash;
    }
  }, []);
  return { route, navigate };
}

function App() {
  const { route, navigate } = useRoute();
  const [user, setUser] = useState(undefined); // undefined = loading
  const [theme, setThemeState] = useState(() => localStorage.getItem('lp_theme') || 'dark');
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);
  const [confirmState, setConfirmState] = useState(null);
  const confirmResolve = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('lp_theme', theme);
  }, [theme]);

  const toast = useCallback((kind, msg) => {
    const id = ++toastId.current;
    setToasts(ts => [...ts, { id, kind, msg }]);
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 4600);
  }, []);

  const dismissToast = useCallback((id) => setToasts(ts => ts.filter(t => t.id !== id)), []);

  const confirm = useCallback((opts) => {
    setConfirmState(opts);
    return new Promise(resolve => { confirmResolve.current = resolve; });
  }, []);

  const resolveConfirm = (val) => {
    setConfirmState(null);
    confirmResolve.current?.(val);
    confirmResolve.current = null;
  };

  const logout = useCallback(async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    setUser(null);
    navigate('#/login');
  }, [navigate]);

  // boot: restore session
  useEffect(() => {
    api('/api/auth/me')
      .then(({ user: u }) => setUser(u))
      .catch(() => setUser(null));
  }, []);

  // global 401 → back to login
  useEffect(() => {
    const h = () => { setUser(null); navigate('#/login'); };
    window.addEventListener('lp:unauthorized', h);
    return () => window.removeEventListener('lp:unauthorized', h);
  }, [navigate]);

  const pages = {
    dashboard: <Dashboard onNavigate={navigate} />,
    opportunities: <Opportunities query={route.query} onNavigate={navigate} />,
    assistant: <Assistant user={user} onNavigate={navigate} />,
    links: <Links query={route.query} onNavigate={navigate} isDemo={!!user?.is_demo} />,
    campaigns: <Campaigns />,
    networks: <Networks />,
    payouts: <Payouts />,
    strategies: <Strategies onNavigate={navigate} />,
    integrations: <Integrations isDemo={!!user?.is_demo} />,
    settings: <Settings user={user} setUser={setUser} theme={theme} setTheme={setThemeState} onLogout={logout} />,
  };

  let content;
  if (user === undefined) {
    content = (
      <div className="content">
        <div className="kpi-grid">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 118, borderRadius: 'var(--radius)' }} />)}
        </div>
      </div>
    );
  } else if (!user) {
    if (route.path === 'register') content = <Register onLogin={setUser} goLogin={() => navigate('#/login')} />;
    else content = <Login onLogin={setUser} goRegister={() => navigate('#/register')} />;
  } else {
    if (route.path === 'login' || route.path === 'register') {
      navigate('#/dashboard');
      content = pages.dashboard;
    } else {
      content = (
        <Shell route={route.path} user={user} onNavigate={navigate} onLogout={logout} theme={theme} setTheme={setThemeState}>
          {pages[route.path] || (
            <div className="content">
              <div className="card" style={{ padding: 60, textAlign: 'center' }}>
                <h2>Page not found</h2>
                <button className="btn btn-primary" onClick={() => navigate('#/dashboard')}>Go to dashboard</button>
              </div>
            </div>
          )}
        </Shell>
      );
    }
  }

  return (
    <ToastCtx.Provider value={toast}>
      <ConfirmCtx.Provider value={confirm}>
        {content}
        <ToastHost toasts={toasts} dismiss={dismissToast} />
        {confirmState ? (
          <Modal
            title={confirmState.title}
            subtitle={confirmState.text}
            onClose={() => resolveConfirm(false)}
            footer={
              <>
                <button className="btn btn-secondary" onClick={() => resolveConfirm(false)}>Cancel</button>
                <button className="btn btn-danger-solid" onClick={() => resolveConfirm(true)}>{confirmState.confirmLabel || 'Confirm'}</button>
              </>
            }
          >
            <div />
          </Modal>
        ) : null}
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}

createRoot(document.getElementById('root')).render(<App />);
