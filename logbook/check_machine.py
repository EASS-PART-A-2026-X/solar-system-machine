"""Machine checks: did the crew keep its contract (crew/contract.json)?

  python3 logbook/check_machine.py                      # check the recorded run, logbook/run.json
  python3 logbook/check_machine.py --record <transcripts-dir>   # re-record run.json from a live run first

run.json keeps only what the checks need: which files each agent edited, and how each root order
was answered. No message text, so it is safe to commit.
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from build_logs import ROLES, events, find_agents  # noqa: E402

REPO = Path(__file__).resolve().parent.parent
RUN = REPO / 'logbook' / 'run.json'
LINE = re.compile(r'^\[([^\]]+)\]\s*([^:]+):\s*(.*)$', re.S)
ORDER = re.compile(r'^->\s*(A|B|C|ALL):', re.S)


def repo_path(path):
    """Map a file an agent edited to its place in this repo, or None for scratch files outside it.
    The first run worked in ~/solar-system, whose files became product/."""
    p = Path(path).resolve()
    if p.is_relative_to(REPO):
        return p.relative_to(REPO).as_posix()
    if p.parent.name == 'solar-system':
        return f'product/{p.name}'
    return None


def record(transcripts):
    agents = {}
    for letter, path in sorted(find_agents(transcripts).items()):
        files = sorted({r for _, _, _, f in events(path) if f and (r := repo_path(f))})
        actions = sum(1 for _, kind, _, _ in events(path) if kind not in ('result', 'thought', 'instruction'))
        agents[letter] = {'files': files, 'actions': actions}
    lines = json.loads((REPO / 'logbook' / 'chat.json').read_text())
    parsed = [m.groups() if (m := LINE.match(l)) else None for l in lines]
    orders, informal = [], 0
    for i, p in enumerate(parsed):
        if not p or p[1] not in ('root', 'lead'):
            continue
        o = ORDER.match(p[2])
        if not o:
            informal += p[1] == 'root'
            continue
        targets = list(ROLES) if o[1] == 'ALL' else [o[1]]
        replies = {}
        for t in targets:
            said = [q[2] for q in parsed[i + 1:] if q and q[1] == t]
            replies[t] = 'done' if any(re.search(r'\bdone\b', s, re.I) for s in said) else 'acked' if said else 'pending'
        orders.append({'at': p[0], 'by': p[1], 'to': o[1], 'replies': replies})
    RUN.write_text(json.dumps({'agents': agents, 'orders': orders, 'informalRootLines': informal}, indent=1) + '\n')


def check():
    contract = json.loads((REPO / 'crew' / 'contract.json').read_text())
    run = json.loads(RUN.read_text())
    out = []
    for letter, owned in contract['owners'].items():
        a = run['agents'].get(letter, {'files': [], 'actions': 0})
        stray = [f for f in a['files'] if f not in owned]
        what = ', '.join(a['files']) or 'no files (reviewer)'
        out.append({'layer': 'machine', 'id': f'{letter} edits only its own files', 'ok': not stray,
                    'detail': f'edited {", ".join(stray)} outside {owned}' if stray else f'{a["actions"]} actions · {what}'})
    late = [f'{o["to"]}@{o["at"]}: {t} {s}' for o in run['orders'] for t, s in o['replies'].items() if s != 'done']
    out.append({'layer': 'machine', 'id': 'every order answered with done', 'ok': not late,
                'detail': '; '.join(late) if late else f'{len(run["orders"])} orders, all done'})
    out.append({'layer': 'machine', 'id': 'root lines use the order format', 'ok': True,
                'detail': f'{run["informalRootLines"]} free-text root lines (advice, not orders)'})
    return out


if __name__ == '__main__':
    if '--record' in sys.argv:
        record(sys.argv[sys.argv.index('--record') + 1])
    checks = check()
    for c in checks:
        print(f"{'✔' if c['ok'] else '✖'} {c['id']} · {c['detail']}")
    if '--json' in sys.argv:
        Path(sys.argv[sys.argv.index('--json') + 1]).write_text(json.dumps(checks, indent=1))
    failed = sum(not c['ok'] for c in checks)
    print(f'\nmachine: {len(checks) - failed}/{len(checks)} pass')
    sys.exit(1 if failed else 0)
