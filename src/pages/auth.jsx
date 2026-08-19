import { useState } from 'react';
import { Icon } from '../icons.jsx';
import { api } from '../api.js';
import { useToast } from '../ui.jsx';

function BrandMark() {
  return (
    <div className="brand" style={{ padding: 0, marginBottom: 40 }}>
      <div className="logo">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M6.5 12c1.6-4.2 3.2-6.7 4.8-6.7S14.5 7.8 16.1 12s-3.2 6.7-4.8 6.7S8.1 16.2 6.5 12z" fill="#04140d" transform="rotate(45 11.3 12)" />
          <circle cx="12" cy="12" r="2.4" fill="#04140d" opacity=".85" />
        </svg>
      </div>
      <div>
        <div className="brand-name">Link<span>Pilot</span></div>
        <div className="brand-sub">Affiliate OS</div>
      </div>
    </div>
  );
}

function AuthShell({ children }) {
  return (
    <div className="auth-page">
      <div className="auth-left">
        <BrandMark />
        <div className="auth-quote">
          <div className="q-mark">“</div>
          <p>I stopped juggling spreadsheets and nine dashboards. LinkPilot tracks every click, conversion and payout in one place — my affiliate income grew 40% the first quarter.</p>
          <div className="who">
            <div className="avatar" style={{ background: 'linear-gradient(135deg,#8b5cf6,#ec4899)', width: 34, height: 34, fontSize: 13 }}>SM</div>
            <div>
              <div className="bold">Sarah Malik</div>
              <div className="muted small">Tech content creator · 180k subscribers</div>
            </div>
          </div>
        </div>
        <div className="auth-stats">
          <div className="auth-stat"><div className="v">$1.2M+</div><div className="l">Tracked revenue</div></div>
          <div className="auth-stat"><div className="v">8.4M</div><div className="l">Clicks processed</div></div>
          <div className="auth-stat"><div className="v">99.99%</div><div className="l">Uptime</div></div>
        </div>
      </div>
      <div className="auth-right">{children}</div>
    </div>
  );
}

export function Login({ onLogin, goRegister }) {
  const toast = useToast();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { user } = await api('/api/auth/login', { method: 'POST', body: form });
      toast('success', `Welcome back, <b>${user.name.split(' ')[0]}</b>!`);
      onLogin(user);
    } catch (err) {
      toast('error', err.message);
    } finally { setBusy(false); }
  };

  const demo = async () => {
    setDemoBusy(true);
    try {
      const { user } = await api('/api/auth/guest', { method: 'POST' });
      toast('success', 'Entered the <b>guest demo workspace</b> — everything works with virtual data for practice.');
      onLogin(user);
    } catch (err) {
      toast('error', err.message);
    } finally { setDemoBusy(false); }
  };

  return (
    <AuthShell>
      <div className="auth-card">
        <h1>Welcome back 👋</h1>
        <p className="sub">Sign in to your professional affiliate command center.</p>
        <form onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input className="input" type="email" placeholder="you@example.com" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" placeholder="••••••••" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          </div>
          <button type="submit" className="btn btn-primary btn-block" style={{ padding: '11px' }} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in to account'}
          </button>
        </form>
        <hr className="divider" />
        <div className="row-between" style={{ marginBottom: 8 }}>
          <span className="small bold muted">No account yet?</span>
          <a className="small" onClick={goRegister} style={{ color: 'var(--accent)', fontWeight: 600 }}>Create free account</a>
        </div>
        <button className="btn btn-secondary btn-block auth-demo-btn" onClick={demo} disabled={demoBusy}>
          <Icon name="sparkle" size={15} /> {demoBusy ? 'Loading…' : 'Continue as guest (demo workspace)'}
        </button>
        <div className="small muted" style={{ marginTop: 10, lineHeight: 1.6 }}>
          Guest mode is fully functional but uses <b>virtual data &amp; connections</b> — clicks are simulated
          instead of redirecting to real merchants. Perfect for learning and practice.
        </div>
      </div>
    </AuthShell>
  );
}

export function Register({ onLogin, goLogin }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', company: '', password: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { user } = await api('/api/auth/register', { method: 'POST', body: form });
      toast('success', `Account created — welcome aboard, <b>${user.name.split(' ')[0]}</b>! 🎉`);
      onLogin(user);
    } catch (err) {
      toast('error', err.message);
    } finally { setBusy(false); }
  };

  return (
    <AuthShell>
      <div className="auth-card">
        <h1>Create your account</h1>
        <p className="sub">Free to start — track your first link in 60 seconds.</p>
        <form onSubmit={submit}>
          <div className="field">
            <label>Full name</label>
            <input className="input" placeholder="Alex Morgan" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="field">
            <label>Email</label>
            <input className="input" type="email" placeholder="you@example.com" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div className="field">
            <label>Company / channel name <span className="hint">(optional)</span></label>
            <input className="input" placeholder="e.g. Morgan Media" value={form.company}
              onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" placeholder="At least 6 characters" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} minLength={6} required />
          </div>
          <button type="submit" className="btn btn-primary btn-block" style={{ padding: '11px' }} disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <div className="auth-switch">
          Already have an account? <a onClick={goLogin}>Sign in</a>
        </div>
      </div>
    </AuthShell>
  );
}
