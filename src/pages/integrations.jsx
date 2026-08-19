import { useEffect, useState } from 'react';
import { api, fmtDate, copyText } from '../api.js';
import { Icon } from '../icons.jsx';
import { Modal, EmptyState, PageHeader, CopyBtn, useToast, useConfirm, TableSkeleton } from '../ui.jsx';

const ORIGIN = () => window.location.origin;

function CodeBlock({ code, onCopy, live }) {
  return (
    <div className="code-block">
      {onCopy ? <span className="copy-top"><CopyBtn text={code} iconOnly /></span> : null}
      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', paddingRight: 30 }}>{code}</div>
    </div>
  );
}

function Guide({ icon, color, title, children, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="guide-item">
      <div className="guide-head" onClick={() => setOpen(o => !o)}>
        <span style={{ width: 34, height: 34, borderRadius: 10, background: `${color}22`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <Icon name={icon} size={16} />
        </span>
        <div className="grow"><div className="bold" style={{ fontSize: 13.5 }}>{title}</div></div>
        <Icon name="chevronDown" size={16} style={{ color: 'var(--text-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </div>
      {open ? <div className="guide-body">{children}</div> : null}
    </div>
  );
}

export function Integrations({ isDemo }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [keys, setKeys] = useState(null);
  const [networks, setNetworks] = useState([]);
  const [webhook, setWebhook] = useState({ webhook_url: '', webhook_events: 'click,conversion,payout' });
  const [webhookStatus, setWebhookStatus] = useState(null);
  const [keyModal, setKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState(null);
  const [postbackNet, setPostbackNet] = useState('');
  const [simBusy, setSimBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);

  useEffect(() => {
    Promise.all([api('/api/keys'), api('/api/networks'), api('/api/settings/webhook')])
      .then(([k, n, w]) => { setKeys(k); setNetworks(n); setWebhook(w); })
      .catch(e => toast('error', e.message));
  }, []);

  const createKey = async () => {
    try {
      const k = await api('/api/keys', { method: 'POST', body: { name: newKeyName } });
      setKeys(xs => [k, ...(xs || [])]);
      setCreatedKey(k.key);
      setNewKeyName('');
      toast('success', 'API key created — copy it now');
    } catch (e) { toast('error', e.message); }
  };

  const revokeKey = async (k) => {
    if (!await confirm({ title: 'Revoke API key?', text: `"${k.name}" will stop working immediately for any external integration using it.`, confirmLabel: 'Revoke key' })) return;
    const prev = keys;
    setKeys(xs => xs.filter(x => x.id !== k.id));
    try {
      await api(`/api/keys/${k.id}`, { method: 'DELETE' });
      toast('success', 'API key revoked');
    } catch (e) { setKeys(prev); toast('error', e.message); }
  };

  const saveWebhook = async () => {
    try {
      await api('/api/settings/webhook', { method: 'PUT', body: webhook });
      toast('success', 'Webhook settings saved');
    } catch (e) { toast('error', e.message); }
  };

  const testWebhook = async () => {
    setTestBusy(true); setWebhookStatus(null);
    try {
      const r = await api('/api/settings/webhook/test', { method: 'POST' });
      setWebhookStatus(r);
      if (r.ok && r.simulated) toast('success', `Delivery simulated (demo mode) — real accounts send the actual HTTP request`);
      else if (r.ok) toast('success', `Webhook delivered — HTTP ${r.status}`);
      else toast('error', `Webhook failed (HTTP ${r.status || 'network error'})`);
    } catch (e) { setWebhookStatus({ ok: false, status: 0 }); toast('error', e.message); }
    finally { setTestBusy(false); }
  };

  const simulatePostback = async () => {
    if (!postbackNet) return toast('error', 'Pick a network first.');
    setSimBusy(true);
    try {
      const r = await api('/api/integrations/simulate', { method: 'POST', body: { network_id: +postbackNet } });
      toast('success', `Simulated postback → <b>${r.link}</b> +${r.revenue.toFixed(2)} USD 🎉`);
    } catch (e) { toast('error', e.message); }
    finally { setSimBusy(false); }
  };

  const firstKey = keys && keys[0];
  const trackExample = `curl -X POST "${ORIGIN()}/api/v1/track" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${firstKey?.key || 'YOUR_API_KEY'}" \\
  -d '{"slug": "airpods-pro-2", "click_id": "abc123", "referrer": "youtube.com"}'`;

  const postbackUrl = (net) => `${ORIGIN()}/api/v1/postback/${(net?.name || 'network').toLowerCase().replace(/[^a-z0-9]+/g, '')}?key=${firstKey?.key || 'YOUR_API_KEY'}&amount=24.99`;
  const postbackExample = `# Paste this into your network's postback / IPN settings
# ClickBank IPN URL, Impact conversion pixel, ShareASale tracking, etc.
${postbackUrl(networks.find(n => n.id === +postbackNet))}`;

  return (
    <div className="content">
      <PageHeader title="Integrations" sub="Wire LinkPilot into real platforms — tracking APIs, webhooks and postbacks" />

      {isDemo ? (
        <div style={{ background: 'var(--amber-soft)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, lineHeight: 1.6 }}>
          <b style={{ color: 'var(--amber)' }}>Demo mode:</b> all integration features are active for learning, but outbound
          connections are virtual — webhook tests are simulated and tracking endpoints log to your virtual workspace only.
          Create a real account for live merchant redirects and real webhook delivery.
        </div>
      ) : null}

      <div className="grid-main" style={{ marginBottom: 18 }}>
        {/* tracking endpoints */}
        <div className="card card-pad">
          <div className="row gap-sm" style={{ marginBottom: 4 }}>
            <span className="kpi-icon" style={{ width: 32, height: 32, background: 'var(--accent-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9 }}>
              <Icon name="zap" size={15} />
            </span>
            <div>
              <div className="card-title">Click-tracking endpoint</div>
              <div className="card-sub">Any visit to a short link is logged with referrer, country &amp; device</div>
            </div>
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label>Short link format</label>
            <CodeBlock code={`${ORIGIN()}/r/{slug}\n\nExample:  ${ORIGIN()}/r/airpods-pro-2`} onCopy />
          </div>
          <div className="field">
            <label>Server-to-server tracking (REST API)</label>
            <CodeBlock code={trackExample} onCopy />
          </div>
          <div className="small muted row gap-sm">
            <Icon name="help" size={14} /> UTM params (<span className="mono">utm_source</span>, <span className="mono">utm_campaign</span>…) are captured automatically on short-link visits.
          </div>
        </div>

        {/* postbacks */}
        <div className="card card-pad">
          <div className="row gap-sm" style={{ marginBottom: 4 }}>
            <span className="kpi-icon" style={{ width: 32, height: 32, background: 'var(--violet-soft)', color: 'var(--violet)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9 }}>
              <Icon name="send" size={15} />
            </span>
            <div>
              <div className="card-title">Network postbacks (IPN)</div>
              <div className="card-sub">Receive conversion notifications from real affiliate networks</div>
            </div>
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label>Choose a network</label>
            <select className="select" value={postbackNet} onChange={e => setPostbackNet(e.target.value)}>
              <option value="">— Select network —</option>
              {networks.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
          </div>
          {postbackNet ? (
            <div className="field">
              <label>Postback / IPN URL</label>
              <CodeBlock code={postbackExample} onCopy />
            </div>
          ) : null}
          <button className="btn btn-secondary" onClick={simulatePostback} disabled={simBusy || !postbackNet}>
            <Icon name="send" size={14} /> {simBusy ? 'Sending…' : 'Simulate an incoming postback'}
          </button>
          <div className="small muted" style={{ marginTop: 10 }}>
            Supported formats: query-string GET (Impact, ShareASale) and form-encoded POST (ClickBank IPN). Matches the network by name and credits the first link attached to it.
          </div>
        </div>
      </div>

      {/* API keys + webhooks */}
      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">API keys</div>
              <div className="card-sub">Authenticate external apps &amp; scripts</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => { setCreatedKey(null); setKeyModal(true); }}><Icon name="plus" size={14} /> New key</button>
          </div>
          <div className="card-pad" style={{ paddingTop: 10 }}>
            {keys === null ? <TableSkeleton rows={2} cols={3} /> : keys.length === 0 ? (
              <EmptyState icon="key" title="No API keys" text="Create a key to track clicks from your own scripts or accept postbacks." />
            ) : (
              keys.map(k => (
                <div key={k.id} className="stat-line">
                  <span className="sl-left">
                    <Icon name="key" size={15} style={{ color: 'var(--text-3)' }} />
                    <span className="sl-name">{k.name}</span>
                  </span>
                  <span className="row gap-sm">
                    <code className="mono small muted">{k.key.slice(0, 10)}…{k.key.slice(-4)}</code>
                    <CopyBtn text={k.key} iconOnly />
                    <button className="btn-icon danger" title="Revoke" onClick={() => revokeKey(k)}><Icon name="trash" size={14} /></button>
                  </span>
                </div>
              ))
            )}
            {keys && keys.length > 0 ? (
              <div className="small muted" style={{ marginTop: 8 }}>
                Last used: {keys[0].last_used_at ? fmtDate(keys[0].last_used_at) : 'never'}
              </div>
            ) : null}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Webhooks</div>
              <div className="card-sub">Get notified about clicks, conversions &amp; payouts</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={testWebhook} disabled={testBusy || !webhook.webhook_url}>
              <Icon name="send" size={13} /> {testBusy ? 'Testing…' : 'Send test'}
            </button>
          </div>
          <div className="card-pad" style={{ paddingTop: 12 }}>
            <div className="field">
              <label>Endpoint URL</label>
              <input className="input mono" placeholder="https://your-app.com/hooks/linkpilot" value={webhook.webhook_url}
                onChange={e => setWebhook(w => ({ ...w, webhook_url: e.target.value }))} />
            </div>
            <div className="field">
              <label>Events</label>
              <div className="row wrap gap-lg">
                {['click', 'conversion', 'payout'].map(ev => (
                  <label className="checkbox" key={ev} style={{ textTransform: 'capitalize' }}>
                    <input type="checkbox" checked={webhook.webhook_events.includes(ev)}
                      onChange={() => setWebhook(w => ({
                        ...w,
                        webhook_events: w.webhook_events.includes(ev)
                          ? w.webhook_events.split(',').filter(x => x !== ev).join(',')
                          : [...w.webhook_events.split(',').filter(Boolean), ev].join(','),
                      }))} />
                    {ev}
                  </label>
                ))}
              </div>
            </div>
            <button className="btn btn-primary" onClick={saveWebhook}>Save webhook</button>
            {webhookStatus ? (
              <div className="small" style={{ marginTop: 10, color: webhookStatus.ok ? 'var(--accent)' : 'var(--rose)' }}>
                {webhookStatus.ok
                  ? (webhookStatus.simulated ? '✓ Delivery simulated — demo mode does not make real outbound calls. A real account would deliver the actual POST request.' : `✓ Test delivered (HTTP ${webhookStatus.status})`)
                  : `✗ Delivery failed (HTTP ${webhookStatus.status || 'no response'}) — endpoint must be reachable from the server`}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* platform guides */}
      <div className="card card-pad">
        <div className="card-title" style={{ marginBottom: 4 }}>Connect real platforms</div>
        <div className="card-sub" style={{ marginBottom: 14 }}>Step-by-step wiring for the networks and tools you already use</div>
        <Guide icon="cart" color="#ff9900" title="Amazon Associates" defaultOpen>
          <ol>
            <li>Join the <b>Amazon Associates</b> program and grab your store ID (e.g. <span className="mono">yourname-20</span>).</li>
            <li>Create a link in LinkPilot with the full product URL plus your tag: <CodeBlock code={`https://www.amazon.com/dp/B0BDHWDR12?tag=yourname-20`} onCopy /></li>
            <li>Use the short link everywhere. Earnings sync: add a payout manually each month (Amazon reports on the 1st), or forward Amazon's payment emails to your webhook.</li>
            <li><b>Pro tip:</b> add <span className="mono">?tag=</span> to the destination — the tag survives redirects automatically.</li>
          </ol>
        </Guide>
        <Guide icon="zap" color="#1e5eff" title="ClickBank (Instant Notification)">
          <ol>
            <li>In ClickBank, open <b>Settings → My Site → Advanced Tools</b> and edit the Instant Notification URL.</li>
            <li>Paste your postback URL: <CodeBlock code={postbackUrl(networks.find(n => /clickbank/i.test(n.name))) || `${ORIGIN()}/api/v1/postback/clickbank?key=YOUR_API_KEY&amount=24.99`} onCopy /></li>
            <li>Set version to <b>6.0</b> and request method to <b>POST</b>. ClickBank sends <span className="mono">amount</span> on every sale.</li>
            <li>Sales now appear in your Dashboard activity feed as conversions instantly.</li>
          </ol>
        </Guide>
        <Guide icon="globe" color="#4caf50" title="Shopify (storefront links)">
          <ol>
            <li>Create a LinkPilot link per collection or product you promote (destination = your Shopify store URL).</li>
            <li>Embed the short link in emails, TikTok bios and Pinterest pins — UTM params pass through automatically.</li>
            <li>Use the <b>REST tracking API</b> from your Shopify checkout webhook to log conversions server-side:</li>
          </ol>
          <CodeBlock code={`curl -X POST "${ORIGIN()}/api/v1/track" -H "X-API-Key: ${firstKey?.key || 'YOUR_API_KEY'}" -H "Content-Type: application/json" -d '{"slug":"your-link","converted":true,"amount":49.99}'`} onCopy />
        </Guide>
        <Guide icon="code" color="#8b5cf6" title="WordPress / custom websites">
          <ol>
            <li>Drop this snippet anywhere on your site to turn a normal link into a tracked smart link:</li>
          </ol>
          <CodeBlock code={`<a href="${ORIGIN()}/r/your-slug">Recommended product</a>
<!-- that's it — clicks, referrers and countries are tracked automatically -->`} onCopy />
        </Guide>
        <Guide icon="chart" color="#f59e0b" title="Google Analytics & dashboards">
          <ol>
            <li>Export your link performance anytime: <a href="/api/links/export" style={{ color: 'var(--accent)' }}>Download CSV</a> (opens in Sheets / Excel).</li>
            <li>For live dashboards, point your webhook at Zapier / Make / n8n and forward <span className="mono">click</span> and <span className="mono">conversion</span> events into Google Sheets or your BI tool.</li>
            <li>Every event payload includes <span className="mono">link slug, referrer, country, device, revenue, timestamp</span>.</li>
          </ol>
        </Guide>
      </div>

      {keyModal ? (
        <Modal title="Create API key" subtitle="Use it in scripts, servers and postback URLs." onClose={() => setKeyModal(false)}
          footer={
            createdKey ? (
              <button className="btn btn-primary" onClick={() => setKeyModal(false)}>Done</button>
            ) : (
              <>
                <button className="btn btn-secondary" onClick={() => setKeyModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={createKey} disabled={!newKeyName.trim()}>Create key</button>
              </>
            )
          }>
          {createdKey ? (
            <div>
              <p className="small muted" style={{ marginTop: 0 }}>Copy your key now — it can't be shown again.</p>
              <CodeBlock code={createdKey} onCopy />
            </div>
          ) : (
            <div className="field">
              <label>Key name</label>
              <input className="input" placeholder="e.g. Production key" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} autoFocus />
            </div>
          )}
        </Modal>
      ) : null}
    </div>
  );
}
