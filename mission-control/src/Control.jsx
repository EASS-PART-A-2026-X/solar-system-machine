import { useEffect, useState } from 'react';

const AGENTS = [
  { id: 'A', name: 'A · 3D scene', color: '#e03131' },
  { id: 'B', name: 'B · editorial', color: '#1971c2' },
  { id: 'C', name: 'C · art director', color: '#2f9e44' },
];
const QUICK = [
  ['ALL', 'Status report: one line each, what you are doing and what is next.'],
  ['ALL', 'Freeze features. Polish only: no new effects.'],
  ['C', 'Review now and post your top 3 issues.'],
  ['A', 'Ship your current state now and post "v-next up".'],
  ['B', 'Tighten copy: shorter dek, fewer words everywhere.'],
];

const lastLineOf = (lines, id) =>
  [...lines].reverse().find((l) => l.includes(`] ${id}:`))?.replace(/^\[[^\]]+\]\s*\w+:\s*(\w+:\s*)?/, '') ?? '—';

export function Control({ post, lines }) {
  const [status, setStatus] = useState({});
  const [target, setTarget] = useState('ALL');
  const [text, setText] = useState('');

  useEffect(() => {
    const load = () => fetch('/logbook/status.json', { cache: 'no-store' }).then((r) => r.json()).then(setStatus).catch(() => {});
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  const order = (to, msg) => post(`-> ${to}: ${msg}`);
  const acked = (id) => {
    const lastOrder = lines.findLastIndex((l) => /\] root: -> /.test(l) && (l.includes(`-> ${id}:`) || l.includes('-> ALL:')));
    if (lastOrder < 0) return null;
    return lines.slice(lastOrder + 1).some((l) => l.includes(`] ${id}:`));
  };

  return (
    <div className="control">
      <div className="cards">
        {AGENTS.map((a) => {
          const s = status[a.id] || {};
          const live = s.idleSec != null && s.idleSec < 120;
          const ack = acked(a.id);
          return (
            <div key={a.id} className="card" style={{ borderTopColor: a.color }}>
              <div className="row">
                <b style={{ color: a.color }}>{a.name}</b>
                <span className={`dot ${live ? 'on' : 'off'}`}>{live ? `working · ${s.idleSec}s ago` : 'idle / stopped'}</span>
              </div>
              <div className="said">“{lastLineOf(lines, a.id).slice(0, 140)}”</div>
              <div className="meta">
                {s.actions ?? 0} actions · {(s.files || []).map((f) => f.split('/').pop()).join(', ') || 'no files'}
                {ack === false && <span className="pending"> · order pending</span>}
                {ack === true && <span className="ok"> · order acked</span>}
              </div>
              <button onClick={() => setTarget(a.id)}>Order {a.id}</button>
            </div>
          );
        })}
        <button className="stop" onClick={() => confirm('Stop all agents?') && order('ALL', 'STOP')}>STOP ALL</button>
      </div>

      <form
        className="order"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) order(target, text.trim());
          setText('');
        }}
      >
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          {['ALL', 'A', 'B', 'C'].map((t) => <option key={t}>{t}</option>)}
        </select>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Order to ${target}… (Enter)`} />
        <button>Send</button>
      </form>
      <div className="quick">
        {QUICK.map(([to, msg]) => (
          <button key={msg} onClick={() => order(to, msg)} title={msg}>→ {to}: {msg.split(':')[0].split('.')[0]}</button>
        ))}
      </div>

      <div className="preview">
        <div className="row"><b>Live page</b> <a href="http://localhost:8790/product/" target="_blank">open</a></div>
        <iframe src="http://localhost:8790/product/" title="page" />
      </div>
    </div>
  );
}
