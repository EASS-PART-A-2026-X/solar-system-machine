"""Rebuild logbook/index.html (chat, ledger, agent logs) and status.json for the control panel.

Usage: python3 logbook/build_logs.py <transcripts-dir> [--once]
<transcripts-dir> holds the crew's agent-*.jsonl transcripts (Claude Code writes them under
~/.claude/projects/<project>/<session>/subagents/). Agents are matched by "You are Agent X" in
their first prompt. Without --once it rebuilds every 5s.
"""
import html
import json
import sys
import time
from pathlib import Path

ROLES = {'A': 'A (3D scene)', 'B': 'B (editorial)', 'C': 'C (art director)'}
OUT = Path(__file__).parent
FILE_TOOLS = {'Write', 'Edit', 'MultiEdit'}


def find_agents(sub):
    """Map role letter -> newest transcript whose first prompt says 'You are Agent X'."""
    found = {}
    for path in sorted(Path(sub).glob('agent-*.jsonl'), key=lambda p: p.stat().st_mtime):
        with path.open() as f:
            first = f.readline()
        for letter in ROLES:
            if f'You are Agent {letter} ' in first:
                found[letter] = path
    return found


def events(path):
    """Yield (time, kind, text, file) for one agent's transcript."""
    for line in path.read_text().splitlines():
        try:
            d = json.loads(line)
        except json.JSONDecodeError:
            continue
        ts = (d.get('timestamp') or '')[11:19]
        msg = d.get('message') or {}
        content = msg.get('content')
        if d.get('type') == 'user' and isinstance(content, str) and not content.startswith('<'):
            yield ts, 'instruction', content, None
        if not isinstance(content, list):
            continue
        for c in content:
            t = c.get('type')
            if t == 'text' and d.get('type') == 'assistant' and c['text'].strip():
                yield ts, 'thought', c['text'], None
            elif t == 'tool_use':
                inp = c.get('input') or {}
                name = c.get('name', '').replace('mcp__Claude_Browser__', 'browser.')
                f = inp.get('file_path') if c.get('name') in FILE_TOOLS else None
                detail = inp.get('text') or inp.get('command') or inp.get('url') or inp.get('action') or f or ''
                yield ts, name, str(detail), f
            elif t == 'tool_result':
                body = c.get('content')
                if isinstance(body, list):
                    body = ' '.join(x.get('text', '') for x in body if isinstance(x, dict))
                yield ts, 'result', str(body), None


def build(sub):
    esc = html.escape
    chat_path = OUT / 'chat.json'
    chat = json.loads(chat_path.read_text()) if chat_path.exists() else ['(chat dump appears after the next chat edit)']
    ledger, panes, status = [], [], {}
    for letter, path in sorted(find_agents(sub).items()):
        label, rows = ROLES[letter], []
        status[letter] = {'label': label, 'idleSec': round(time.time() - path.stat().st_mtime), 'actions': 0, 'files': [], 'last': ''}
        for ts, kind, text, f in events(path):
            if kind not in ('result', 'thought', 'instruction'):
                status[letter]['actions'] += 1
                status[letter]['last'] = f'{ts} {kind}'
            if f and f not in status[letter]['files']:
                status[letter]['files'].append(f)
            short = text if len(text) < 1500 else text[:1500] + ' …'
            rows.append(f'<tr class="{esc(kind.split(".")[0])}"><td>{ts}</td><td>{esc(kind)}</td><td><pre>{esc(short)}</pre></td></tr>')
            if kind not in ('result', 'thought'):
                ledger.append((ts, label, kind, f or text.replace('\n', ' ')[:140]))
        panes.append(f'<details open><summary>{esc(label)} · {len(rows)} entries</summary><table>{"".join(rows[-400:])}</table></details>')
    ledger.sort()
    ledger_rows = ''.join(f'<tr><td>{t}</td><td>{esc(a)}</td><td>{esc(k)}</td><td>{esc(x)}</td></tr>' for t, a, k, x in ledger)
    chat_rows = ''.join(f'<li class="{"root" if "] root:" in l else ""}">{esc(l)}</li>' for l in chat)
    page = f'''<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="15">
<title>Team Logs</title><style>
body{{font:13px/1.45 -apple-system,system-ui,sans-serif;margin:0;background:#fafafa;color:#222}}
nav{{position:sticky;top:0;background:#111;color:#eee;padding:8px 16px}} nav a{{color:#ffd43b;margin-right:16px}}
section{{padding:8px 16px}} h2{{margin:16px 0 6px}} table{{border-collapse:collapse;width:100%}}
td{{border-bottom:1px solid #e5e5e5;padding:3px 6px;vertical-align:top}} td:first-child{{white-space:nowrap;color:#888}}
pre{{margin:0;white-space:pre-wrap;word-break:break-word;font:12px ui-monospace,monospace}}
tr.result pre{{color:#777}} tr.thought pre{{color:#1971c2}} tr.instruction pre{{color:#7048e8}}
ol li{{margin:3px 0}} li.root{{font-weight:700}} summary{{font-weight:700;cursor:pointer;margin:8px 0}}
</style><nav><b>Team logs</b> · updated {time.strftime("%H:%M:%S")} (auto-refresh 15s) ·
<a href="#chat">Chat</a><a href="#ledger">Ledger</a><a href="#agents">Agent logs</a></nav>
<section id="chat"><h2>Chat history ({len(chat)} lines)</h2><ol>{chat_rows}</ol></section>
<section id="ledger"><h2>Ledger ({len(ledger)} actions, UTC)</h2><table><tr><th>time</th><th>agent</th><th>action</th><th>target</th></tr>{ledger_rows}</table></section>
<section id="agents"><h2>Agent logs</h2>{"".join(panes)}</section>'''
    (OUT / 'index.html').write_text(page)
    (OUT / 'status.json').write_text(json.dumps(status))


if __name__ == '__main__':
    if len(sys.argv) < 2 or sys.argv[1].startswith('--'):
        sys.exit(__doc__)
    while True:
        build(sys.argv[1])
        if '--once' in sys.argv:
            break
        time.sleep(5)
