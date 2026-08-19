import { useEffect, useRef, useState } from 'react';
import { api, fmtDate } from '../api.js';
import { Icon } from '../icons.jsx';
import { PageHeader, useToast, Avatar } from '../ui.jsx';

// tiny markdown renderer: headings, bold, bullets, numbered lists, tables
function md(text) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const lines = String(text).split('\n');
  const out = [];
  let list = null, table = null;
  const flush = () => { if (list) { out.push(`</${list}>`); list = null; } if (table) { out.push('</tbody></table>'); table = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bold = (s) => s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/_([^_]+)_/g, '<i>$1</i>');
    if (/^#+ /.test(line)) { flush(); out.push(`<div class="msg-h">${bold(esc(line.replace(/^#+ /, '')))}</div>`); continue; }
    if (/^\|.*\|$/.test(line)) {
      flush();
      if (!table) { table = true; out.push('<table class="msg-table">'); }
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (cells.every(c => /^:?-{2,}:?$/.test(c))) continue;
      out.push(`<tr>${cells.map((c, i) => `<${i === 0 ? 'th' : 'td'}>${bold(esc(c))}</${i === 0 ? 'th' : 'td'}>`).join('')}</tr>`);
      continue;
    }
    if (/^(\d+)\.\s/.test(line)) {
      flush();
      if (list !== 'ol') { list = 'ol'; out.push('<ol class="msg-list">'); }
      out.push(`<li>${bold(esc(line.replace(/^\d+\.\s/, '')))}</li>`);
      continue;
    }
    if (/^[-•]\s/.test(line)) {
      flush();
      if (list !== 'ul') { list = 'ul'; out.push('<ul class="msg-list">'); }
      out.push(`<li>${bold(esc(line.replace(/^[-•]\s/, '')))}</li>`);
      continue;
    }
    flush();
    if (line.trim()) out.push(`<p>${bold(esc(line))}</p>`);
  }
  flush();
  return out.join('');
}

const SUGGESTIONS = [
  'Best offers in SaaS right now',
  'Strategy for NordVPN',
  'How do I get more clicks on my links?',
  'Compare ClickBank vs Amazon Associates',
  "What's trending this week?",
  'Analyze my performance',
  'Best high-ticket finance programs',
  'Which affiliate type fits a beginner?',
];

export function Assistant({ user, onNavigate }) {
  const toast = useToast();
  const [messages, setMessages] = useState(null);
  const [input, setInput] = useState('');
  const [research, setResearch] = useState(true);
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    api('/api/assistant/history').then(setMessages).catch(() => setMessages([]));
  }, []);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking]);

  const send = async (text, viaAction) => {
    const msg = (text || input).trim();
    if (!msg || thinking) return;
    setInput('');
    setMessages(ms => [...(ms || []), { role: 'user', content: msg }]);
    setThinking(true);
    try {
      const r = await api('/api/assistant/chat', { method: 'POST', body: { message: msg, research } });
      setMessages(ms => [...ms, { role: 'assistant', content: r.text, meta: { actions: r.actions, sources: r.sources, engine: r.engine, live: r.live } }]);
    } catch (e) {
      setMessages(ms => [...ms, { role: 'assistant', content: `⚠️ ${e.message}`, meta: {} }]);
    } finally {
      setThinking(false);
    }
  };

  const runAction = (a) => {
    if (a.type === 'navigate') {
      const q = a.payload?.query ? `?query=${encodeURIComponent(a.payload.query)}` : '';
      onNavigate(`#/${a.payload.page}${q}`);
    } else if (a.type === 'prompt') {
      send(a.payload.prompt, true);
    } else if (a.type === 'create_link') {
      const prefill = encodeURIComponent(JSON.stringify(a.payload || {}));
      onNavigate(`#/links?new=1&prefill=${prefill}`);
    } else if (a.type === 'track_program') {
      api('/api/networks', { method: 'POST', body: a.payload })
        .then(() => toast('success', `<b>${a.payload.name}</b> added to your networks`))
        .catch(e => toast('error', e.message));
    }
  };

  const clear = async () => {
    try {
      await api('/api/assistant/history', { method: 'DELETE' });
      setMessages([]);
      toast('success', 'Conversation cleared');
    } catch (e) { toast('error', e.message); }
  };

  return (
    <div className="content" style={{ maxWidth: 860, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)' }}>
      <PageHeader
        title="AI Assistant"
        sub="Your copilot with live web research — ask about offers, rates, strategies and your own data"
        actions={
          <div className="row gap-sm">
            <label className="checkbox" title="Fetch live data from the web (news, trends, search)">
              <input type="checkbox" checked={research} onChange={e => setResearch(e.target.checked)} />
              <Icon name="globe" size={14} /> Live web research
            </label>
            <button className="btn btn-secondary btn-sm" onClick={clear}><Icon name="trash" size={13} /> Clear</button>
          </div>
        }
      />

      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {messages === null ? (
            <div className="small muted">Loading conversation…</div>
          ) : messages.length === 0 ? (
            <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 460, padding: 20 }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--accent-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 12px 30px -8px rgba(16,185,129,0.5)' }}>
                <Icon name="sparkle" size={28} style={{ color: '#04140d' }} />
              </div>
              <h3 style={{ margin: '0 0 6px' }}>Ask me anything about affiliate marketing</h3>
              <p className="small muted" style={{ lineHeight: 1.6 }}>
                I can browse the live web for trends and news, pull program details and growth rates from the market
                database, analyze <b>your</b> dashboard data, and prepare full promotion strategies.
              </p>
              <div className="row wrap gap-sm" style={{ justifyContent: 'center', marginTop: 16 }}>
                {SUGGESTIONS.slice(0, 6).map(s => (
                  <button key={s} className="btn btn-sm btn-secondary" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`row gap-sm ${m.role === 'user' ? '' : ''}`} style={{ alignItems: 'flex-start', maxWidth: '100%' }}>
                {m.role === 'assistant' ? (
                  <span style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--accent-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <Icon name="sparkle" size={15} style={{ color: '#04140d' }} />
                  </span>
                ) : (
                  <Avatar name={user?.name || '?'} size={30} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {m.role === 'user' ? (
                    <div style={{ background: 'var(--accent-soft)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '4px 14px 14px 14px', padding: '10px 14px', fontSize: 13.5, display: 'inline-block', maxWidth: '100%', wordBreak: 'break-word' }}>
                      {m.content}
                    </div>
                  ) : (
                    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '14px 14px 14px 4px', padding: '12px 16px', fontSize: 13, lineHeight: 1.65 }}>
                      <div className="msg-body" dangerouslySetInnerHTML={{ __html: md(m.content) }} />
                      {m.meta?.actions?.length ? (
                        <div className="row wrap gap-sm" style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                          {m.meta.actions.map((a, j) => (
                            <button key={j} className="btn btn-sm btn-primary" style={{ background: 'var(--surface-3)', color: 'var(--text)', boxShadow: 'none', border: '1px solid var(--border-strong)' }} onClick={() => runAction(a)}>
                              {a.label} →
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {m.meta?.sources?.length ? (
                        <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span className="small bold muted" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                            {m.meta?.live ? '🔴 live sources' : 'sources'}
                          </span>
                          {m.meta.sources.map((s, j) => (
                            <a key={j} href={s.url} target="_blank" rel="noreferrer" className="small" style={{ color: 'var(--blue)', display: 'flex', gap: 6, alignItems: 'center' }}>
                              <Icon name="external" size={11} style={{ flex: 'none' }} /> {s.title}
                            </a>
                          ))}
                        </div>
                      ) : null}
                      {m.meta?.engine === 'llm' ? <div className="small muted" style={{ marginTop: 8, fontSize: 10.5 }}>answered via your configured AI provider</div> : null}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {thinking ? (
            <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
              <span style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--accent-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <Icon name="sparkle" size={15} style={{ color: '#04140d' }} />
              </span>
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 16px' }}>
                <div className="row gap-sm" style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                  <span className="live-dot" /> {research ? 'Researching the web…' : 'Thinking…'}
                </div>
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            className="input"
            placeholder={research ? 'Ask anything — I can browse the live web…' : 'Ask anything…'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={() => send()} disabled={thinking || !input.trim()}>
            <Icon name="send" size={15} /> Send
          </button>
        </div>
      </div>
    </div>
  );
}
