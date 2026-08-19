import { useEffect, useState } from 'react';
import { api, fmtDate } from '../api.js';
import { Icon } from '../icons.jsx';
import { PageHeader, useToast, useConfirm, Avatar } from '../ui.jsx';

export function Settings({ user, setUser, theme, setTheme, onLogout }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [profile, setProfile] = useState({ name: user?.name || '', company: user?.company || '' });
  const [pwd, setPwd] = useState({ current: '', next: '' });
  const [busy, setBusy] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { user: u } = await api('/api/me', { method: 'PUT', body: profile });
      setUser(u);
      toast('success', 'Profile saved');
    } catch (err) { toast('error', err.message); }
    finally { setBusy(false); }
  };

  const savePwd = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/me/password', { method: 'PUT', body: pwd });
      setPwd({ current: '', next: '' });
      toast('success', 'Password changed');
    } catch (err) { toast('error', err.message); }
    finally { setBusy(false); }
  };

  const deleteAccount = async () => {
    const ok = await confirm({
      title: 'Delete account?',
      text: 'This permanently deletes your profile, links, campaigns, networks, payouts and all tracked clicks. There is no undo.',
      confirmLabel: 'Delete everything',
    });
    if (!ok) return;
    try {
      await api('/api/me', { method: 'DELETE' });
      onLogout();
    } catch (err) { toast('error', err.message); }
  };

  return (
    <div className="content" style={{ maxWidth: 760 }}>
      <PageHeader title="Settings" sub="Your profile, security and workspace preferences" />

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="row gap-sm" style={{ marginBottom: 16 }}>
          <Avatar name={user?.name} size={46} />
          <div>
            <div className="bold" style={{ fontSize: 15 }}>{user?.name}</div>
            <div className="small muted">{user?.email} · member since {fmtDate(user?.created_at)}</div>
          </div>
        </div>
        <form onSubmit={saveProfile}>
          <div className="field-row">
            <div className="field">
              <label>Full name</label>
              <input className="input" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} required />
            </div>
            <div className="field">
              <label>Company / channel</label>
              <input className="input" placeholder="e.g. Morgan Media" value={profile.company} onChange={e => setProfile(p => ({ ...p, company: e.target.value }))} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>Save profile</button>
        </form>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="row-between">
          <div>
            <div className="bold" style={{ fontSize: 13.5 }}>Theme</div>
            <div className="small muted">Dark or light workspace</div>
          </div>
          <div className="seg">
            <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}><Icon name="moon" size={13} /> Dark</button>
            <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}><Icon name="sun" size={13} /> Light</button>
          </div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="row gap-sm" style={{ marginBottom: 14 }}>
          <span style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--amber-soft)', color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={user?.is_demo ? 'book' : 'shield'} size={15} />
          </span>
          <div>
            <div className="card-title">{user?.is_demo ? 'Account mode: Guest (demo)' : 'Account mode: Professional'}</div>
            <div className="small muted" style={{ lineHeight: 1.6, maxWidth: 480 }}>
              {user?.is_demo
                ? 'Every feature works, but your data and connections are virtual for learning and practice: link visits are simulated (no real redirects to merchants) and webhook deliveries are not actually sent.'
                : 'Your account uses real tracking: visitors are redirected to merchants, webhooks fire for real, and API keys work with live external systems.'}
            </div>
          </div>
        </div>
        {user?.is_demo ? (
          <a className="btn btn-primary" href="#/register">Create a real account →</a>
        ) : null}
      </div>

      <AISettingsCard />

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 14 }}>Change password</div>
        <form onSubmit={savePwd}>
          <div className="field-row">
            <div className="field">
              <label>Current password</label>
              <input className="input" type="password" value={pwd.current} onChange={e => setPwd(p => ({ ...p, current: e.target.value }))} required />
            </div>
            <div className="field">
              <label>New password</label>
              <input className="input" type="password" minLength={6} value={pwd.next} onChange={e => setPwd(p => ({ ...p, next: e.target.value }))} required />
            </div>
          </div>
          <button type="submit" className="btn btn-secondary" disabled={busy}>Update password</button>
        </form>
      </div>

      <div className="card card-pad" style={{ borderColor: 'rgba(244,63,94,0.3)' }}>
        <div className="row-between wrap gap-lg">
          <div>
            <div className="card-title" style={{ color: 'var(--rose)' }}>Danger zone</div>
            <div className="small muted" style={{ marginTop: 4 }}>Permanently delete your account and all tracked data.</div>
          </div>
          <button className="btn btn-danger" onClick={deleteAccount}><Icon name="trash" size={14} /> Delete account</button>
        </div>
      </div>
    </div>
  );
}

function AISettingsCard() {
  const toast = useToast();
  const [ai, setAi] = useState({ provider: '', model: 'gpt-4o-mini', has_key: false });
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api('/api/settings/ai').then(s => { setAi(s); if (s.has_key) setApiKey(''); }).catch(() => {});
  }, []);
  const save = async () => {
    setSaving(true);
    try {
      await api('/api/settings/ai', {
        method: 'PUT',
        body: { provider: ai.provider, model: ai.model, api_key: apiKey },
      });
      setAi(a => ({ ...a, has_key: !!(apiKey || a.has_key) }));
      if (apiKey) setApiKey('');
      toast('success', 'AI provider settings saved');
    } catch (e) { toast('error', e.message); }
    finally { setSaving(false); }
  };
  return (
    <div className="card card-pad" style={{ marginBottom: 16 }}>
      <div className="row gap-sm" style={{ marginBottom: 4 }}>
        <span style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--violet-soft)', color: 'var(--violet)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sparkle" size={15} />
        </span>
        <div>
          <div className="card-title">AI copilot provider <span className="pill" style={{ fontSize: 10, background: 'var(--surface-3)', color: 'var(--text-3)', marginLeft: 6 }}>optional</span></div>
          <div className="small muted" style={{ lineHeight: 1.6 }}>
            The built-in research engine needs no key — it uses live web sources, the market database and your own stats.
            Add an OpenAI-compatible key to upgrade answers to a full LLM. If the LLM call fails, answers fall back automatically.
          </div>
        </div>
      </div>
      <div className="field-row" style={{ marginTop: 14 }}>
        <div className="field">
          <label>API base URL <span className="hint">(optional)</span></label>
          <input className="input mono" placeholder="https://api.openai.com/v1" value={ai.provider} onChange={e => setAi(a => ({ ...a, provider: e.target.value }))} />
        </div>
        <div className="field">
          <label>Model</label>
          <input className="input mono" placeholder="gpt-4o-mini" value={ai.model} onChange={e => setAi(a => ({ ...a, model: e.target.value }))} />
        </div>
      </div>
      <div className="field">
        <label>API key {ai.has_key ? <span className="hint">(configured — leave blank to keep it)</span> : null}</label>
        <input className="input mono" type="password" placeholder={ai.has_key ? 'configured' : 'sk-…'} value={apiKey} onChange={e => setApiKey(e.target.value)} />
      </div>
      <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save AI settings'}</button>
    </div>
  );
}
