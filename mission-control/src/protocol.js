// The order protocol, shared by the control panel and the checks.
// Chat lines look like "[4:31:22 PM] A: message". Orders are "-> A|B|C|ALL: <order>" lines from root
// (the human) or from the lead relaying for the human;
// the target answers "X: ack <gist>" and later "X: done <gist>".

export const AGENTS = ['A', 'B', 'C'];
export const COMMANDERS = ['root', 'lead'];

export function parseLine(line) {
  const m = /^\[([^\]]+)\]\s*([^:]+):\s*(.*)$/s.exec(line);
  if (!m) return null;
  const order = /^->\s*(A|B|C|ALL):\s*(.*)$/s.exec(m[3]);
  return { time: m[1], who: m[2], text: m[3], to: order?.[1] ?? null, order: order?.[2] ?? null };
}

// State of the newest order that reaches `id`: null (no order), 'pending', 'acked' or 'done'.
export function orderState(lines, id) {
  const parsed = lines.map(parseLine);
  const last = parsed.findLastIndex((p) => p && COMMANDERS.includes(p.who) && (p.to === id || p.to === 'ALL'));
  if (last < 0) return null;
  const replies = parsed.slice(last + 1).filter((p) => p && p.who === id);
  if (replies.some((p) => /\bdone\b/i.test(p.text))) return 'done';
  return replies.length ? 'acked' : 'pending';
}
