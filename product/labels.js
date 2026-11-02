// B: editorial layer. Planet labels with hairline leader lines (driven by
// window.__labelAnchors from scene.js) and fact captions built from data.js.
import { SUN, PLANETS } from './data.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const stage = document.getElementById('stage');
const layer = document.getElementById('labels');

/* ---------------- Fact captions ---------------- */
const nf = new Intl.NumberFormat('en-US');
const fmtYear = (d) => (d < 1000 ? `${nf.format(d)} days` : `${(d / 365.25).toFixed(1)} years`);

function buildFacts() {
  const list = document.getElementById('facts');
  if (!list) return;
  list.innerHTML = '';
  PLANETS.forEach((p, i) => {
    const li = document.createElement('li');
    li.className = 'fact';
    li.dataset.name = p.name;
    li.innerHTML = `
      <h3><span class="n">${String(i + 1).padStart(2, '0')}</span>${p.name}</h3>
      <dl>
        <dt>diameter</dt><dd>${nf.format(p.radiusKm * 2)} km</dd>
        <dt>distance</dt><dd>${p.au.toFixed(2)} AU</dd>
        <dt>year</dt><dd>${fmtYear(p.periodDays)}</dd>
        <dt>moons</dt><dd>${p.moons}</dd>
      </dl>`;
    li.tabIndex = 0;
    li.style.setProperty('--i', i);
    li.addEventListener('pointerenter', () => setFocus(p.name));
    li.addEventListener('pointerleave', () => setFocus(null));
// Touch has no hover: a tap focuses briefly, then the spread returns to neutral.
let tapTimer = 0;
addEventListener('pointerup', (e) => {
  if (e.pointerType === 'mouse') return;
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => setFocus(null), 2500);
});
addEventListener('pointercancel', () => setFocus(null));
    li.addEventListener('focus', () => setFocus(p.name));
    li.addEventListener('blur', () => setFocus(null));
    list.appendChild(li);
  });
}

/* ---------------- Labels ---------------- */
const svg = document.createElementNS(SVG_NS, 'svg');
layer.appendChild(svg);
const items = new Map(); // name -> { el, line, tick, w, h }

function getItem(name) {
  let it = items.get(name);
  if (it) return it;
  const el = document.createElement('div');
  el.className = 'plabel' + (name === SUN.name ? ' sun' : '');
  el.innerHTML = `<b>${name}</b>`;
  layer.appendChild(el);
  const line = document.createElementNS(SVG_NS, 'polyline');
  const tick = document.createElementNS(SVG_NS, 'circle');
  tick.setAttribute('class', 'tick');
  tick.setAttribute('r', '1.2');
  svg.appendChild(line);
  svg.appendChild(tick);
  it = { el, line, tick, w: 0, h: 0 };
  items.set(name, it);
  return it;
}

function measure(it) {
  if (!it.w) {
    const r = it.el.getBoundingClientRect();
    it.w = r.width; it.h = r.height;
  }
}

// Keep-out zones in #stage coordinates: masthead (top) and captions (bottom).
function keepOut() {
  const s = (stage || layer).getBoundingClientRect();
  const rect = (sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x0: r.left - s.left, y0: r.top - s.top, x1: r.right - s.left, y1: r.bottom - s.top };
  };
  const sw = rect('.themes');
  if (sw) { sw.x0 -= 16; sw.y0 -= 16; sw.x1 += 16; sw.y1 += 16; }
  const z = { mast: rect('.masthead'), facts: rect('.facts'), sw, w: s.width, h: s.height };
  window.__copyRects = { masthead: z.mast, facts: z.facts }; // stage px; the scene may frame around these
  return z;
}

const ccw = (a, b, c) => (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
const segX = (p1, p2, p3, p4) => ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
const segBox = (p, q, b) => {
  const c = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]];
  return c.some((v, k) => segX(p, q, v, c[(k + 1) % 4]));
};
const hit = (a, b) => a && b && a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

let zones = null;
let focus = null;          // planet name under the pointer / caption hover
let pointer = null;        // {x,y} in stage coords
window.__focusPlanet = null; // exposed so the scene may react (optional)

function setFocus(name) {
  if (focus === name) return;
  focus = name;
  window.__focusPlanet = name;
  document.body.classList.toggle('has-focus', !!name);
  document.querySelectorAll('.fact').forEach((f) => f.classList.toggle('on', f.dataset.name === name));
  items.forEach((it, n) => {
    it.el.classList.toggle('on', n === name);
    it.line.classList.toggle('on', n === name);
    it.tick.classList.toggle('on', n === name);
  });
}

addEventListener('pointermove', (e) => {
  const s = (stage || layer).getBoundingClientRect();
  pointer = { x: e.clientX - s.left, y: e.clientY - s.top };
  if (e.target.closest && e.target.closest('.fact')) return;
  const anchors = Array.isArray(window.__labelAnchors) ? window.__labelAnchors : [];
  let hitName = null, bestD = Infinity;
  for (const a of anchors) {
    if (!a || a.name === SUN.name) continue;
    const d = Math.hypot(a.x - pointer.x, a.y - pointer.y);
    const reach = Math.max(14, (Number(a.r) || 0) * (a.name === 'Saturn' ? 2.2 : 1.15));
    if (d < reach && d < bestD) { bestD = d; hitName = a.name; }
  }
  // Labels themselves are hover targets too.
  if (!hitName) items.forEach((it, n) => {
    const r = it.el.getBoundingClientRect();
    if (e.clientX >= r.left - 4 && e.clientX <= r.right + 4 && e.clientY >= r.top - 4 && e.clientY <= r.bottom + 4) hitName = n;
  });
  setFocus(hitName && hitName !== SUN.name ? hitName : null);
  document.body.style.cursor = hitName ? 'pointer' : '';
});
addEventListener('pointerleave', () => setFocus(null));
// Touch has no hover: a tap focuses briefly, then the spread returns to neutral.
let tapTimer = 0;
addEventListener('pointerup', (e) => {
  if (e.pointerType === 'mouse') return;
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => setFocus(null), 2500);
});
addEventListener('pointercancel', () => setFocus(null));
let zonesAt = 0;

// Placement. Every frame each label picks a slot around its planet: a leader leaving the disc
// at one of 16 angles, a short horizontal tail, then the label. Hard rules (a slot is never used
// if it breaks one): stay on stage, off the copy and switcher, off every disc, off every other
// label. Soft costs pick the nicest legal slot: short leaders, a label that reads as its own
// planet's, no crossing leaders, and stickiness so labels don't hop between frames.
const DIRS = Array.from({ length: 16 }, (_, k) => (k * Math.PI) / 8);
const LENS_WIDE = [6, 10, 15, 20, 26];
const LENS_NARROW = [5, 9, 14, 19, 25];
const MAX_GAP = 36;   // px from disc edge to label box (validator allows 40; the art director prefers a dropped label to a long one)
const DISC_PAD = 4;   // px of air between a label and any disc
const LABEL_PAD = 4;  // px of air between two labels
const EDGE = 15;      // px inside the stage: clears the 12px Nat Geo frame

const rectCircle = (b, c, pad) => {
  const dx = c.x - Math.max(b.x0, Math.min(c.x, b.x1));
  const dy = c.y - Math.max(b.y0, Math.min(c.y, b.y1));
  return Math.hypot(dx, dy) < c.r + pad;
};
const segCircle = (p, q, c) => {
  const vx = q[0] - p[0], vy = q[1] - p[1];
  const L2 = vx * vx + vy * vy || 1;
  const u = Math.max(0, Math.min(1, ((c.x - p[0]) * vx + (c.y - p[1]) * vy) / L2));
  return Math.hypot(p[0] + u * vx - c.x, p[1] + u * vy - c.y) < c.r;
};
// Saturn's rings as a tilted ellipse. Uses anchor.ring {rx, ry, angle} when the scene publishes
// it; otherwise the hero camera's look (measured: 2.5r by 1.1r, tilted about -32 degrees).
const onRing = (b, d) => {
  const ring = d.ring || { rx: d.r * 2.5, ry: d.r * 1.1, angle: -0.56 };
  const rx = ring.rx + DISC_PAD, ry = ring.ry + DISC_PAD;
  const co = Math.cos(-ring.angle), si = Math.sin(-ring.angle);
  const xs = [0, 0.25, 0.5, 0.75, 1].map((f) => b.x0 + (b.x1 - b.x0) * f), ys = [b.y0, (b.y0 + b.y1) / 2, b.y1];
  for (const x of xs) for (const y of ys) {
    const u = (x - d.x) * co - (y - d.y) * si, v = (x - d.x) * si + (y - d.y) * co;
    if ((u * u) / (rx * rx) + (v * v) / (ry * ry) < 1) return true;
  }
  return false;
};
const grow = (b, d) => ({ x0: b.x0 - d, y0: b.y0 - d, x1: b.x1 + d, y1: b.y1 + d });

function candidates(a, it, narrow) {
  const r = Math.max(0, Number(a.r) || 0);
  const out = [];
  for (let k = 0; k < DIRS.length; k++) {
    const th = DIRS[k], c = Math.cos(th), s = Math.sin(th);
    const sides = Math.abs(c) < 0.25 ? [1, -1] : [Math.sign(c)];
    for (const len of narrow ? LENS_NARROW : LENS_WIDE) {
      const sx = a.x + c * (r + 1), sy = a.y + s * (r + 1);
      const ex = sx + c * len, ey = sy + s * len;
      for (const hd of sides) {
        const hx = ex + hd * 8;
        const lx = hd > 0 ? hx + 3 : hx - 3 - it.w;
        out.push({ key: `${k}:${len}:${hd}`, k, len, sx, sy, ex, ey, hx,
          box: { x0: lx, x1: lx + it.w, y0: ey - it.h / 2, y1: ey + it.h / 2 } });
      }
    }
  }
  return out;
}

function frame(t) {
  requestAnimationFrame(frame);
  const anchors = Array.isArray(window.__labelAnchors) ? window.__labelAnchors : null;
  if (!anchors || !anchors.length) {
    items.forEach((it) => { it.el.style.opacity = 0; it.line.setAttribute('points', ''); it.tick.setAttribute('r', '0'); });
    return;
  }
  if (!zones || t - zonesAt > 500) { zones = keepOut(); zonesAt = t; }
  const narrow = zones.w < 640;

  const bodies = anchors.filter((a) => a && typeof a.name === 'string' && Number.isFinite(a.x) && Number.isFinite(a.y));
  const discs = bodies.map((a) => ({ name: a.name, x: a.x, y: a.y, r: Math.max(0, Number(a.r) || 0), ring: a.ring }));
  const ringed = (n) => n === 'Saturn';
  const keepOuts = [zones.mast, zones.facts, zones.sw].filter(Boolean);

  // Legal against the fixed scene (stage, copy, discs); labels are checked as they are placed.
  const staticOk = (box) =>
    box.x0 >= EDGE && box.y0 >= EDGE && box.x1 <= zones.w - EDGE && box.y1 <= zones.h - EDGE &&
    !keepOuts.some((z) => hit(box, z)) &&
    !discs.some((d) => rectCircle(box, d, DISC_PAD)) &&
    !discs.some((d) => ringed(d.name) && onRing(box, d));

  const plans = bodies.map((a) => {
    const it = getItem(a.name);
    measure(it);
    const r = Math.max(0, Number(a.r) || 0);
    const gapOk = (b) => Math.hypot(a.x - Math.max(b.x0, Math.min(a.x, b.x1)), a.y - Math.max(b.y0, Math.min(a.y, b.y1))) - r <= MAX_GAP;
    const cands = candidates(a, it, narrow).filter((c) => gapOk(c.box) && staticOk(c.box));
    return { a, it, cands };
  });
  // Most constrained first, so crowded bodies get a slot before roomy ones take it.
  plans.sort((p, q) => p.cands.length - q.cands.length || p.a.x - q.a.x);

  const seen = new Set();
  const placed = [];   // label boxes already used
  const leaders = [];  // leader segments already drawn
  for (const { a, it, cands } of plans) {
    seen.add(a.name);
    const own = discs.find((d) => d.name === a.name);
    const others = discs.filter((d) => d.name !== a.name);
    let best = null, prev = null;
    for (const c of cands) {
      if (placed.some((p) => hit(c.box, grow(p, LABEL_PAD)))) continue;
      const segs = [[[c.sx, c.sy], [c.ex, c.ey]], [[c.ex, c.ey], [c.hx, c.ey]]];
      if (segs.some(([p, q]) => placed.some((b) => segBox(p, q, b)))) continue; // never draw through a label
      let cost = c.len * 0.5;
      // Gentle preference for the upper-right quadrant, the magazine default.
      cost += 6 * (1 - Math.cos(DIRS[c.k] + Math.PI / 4));
      // Reads as its own planet's label: nearest disc edge to the label centre is its own.
      const cx = (c.box.x0 + c.box.x1) / 2, cy = (c.box.y0 + c.box.y1) / 2;
      const edge = (d) => Math.hypot(d.x - cx, d.y - cy) - d.r * (ringed(d.name) ? 1.8 : 1);
      const mine = edge(own);
      if (others.some((d) => d.name !== SUN.name && edge(d) < mine)) cost += 90;
      for (const [p, q] of segs) {
        for (const [u, v] of leaders) if (segX(p, q, u, v)) cost += 70;
        for (const d of others) if (segCircle(p, q, d)) cost += 45;
      }
      // Avoid stacking labels in a tight column (reads as one block).
      for (const p of placed) if (c.box.x0 < p.x1 && c.box.x1 > p.x0 && Math.abs((c.box.y0 + c.box.y1) - (p.y0 + p.y1)) / 2 < it.h * 2.2) cost += 30;
      const cand = { ...c, cost };
      if (c.key === it.prev) prev = cand;
      if (!best || cost < best.cost) best = cand;
    }
    // Stickiness: keep last frame's slot while it is still legal and not much worse.
    if (prev && best && prev !== best && prev.cost <= best.cost + 25) best = prev;
    const off = a.x < -own.r || a.y < -own.r || a.x > zones.w + own.r || a.y > zones.h + own.r;
    if (!best || off) {
      it.prev = null;
      it.el.style.opacity = 0; it.line.style.opacity = 0; it.tick.setAttribute('r', '0');
      continue;
    }
    it.prev = best.key;
    placed.push(best.box);
    leaders.push([[best.sx, best.sy], [best.ex, best.ey]], [[best.ex, best.ey], [best.hx, best.ey]]);
    it.line.setAttribute('points', `${best.sx.toFixed(1)},${best.sy.toFixed(1)} ${best.ex.toFixed(1)},${best.ey.toFixed(1)} ${best.hx.toFixed(1)},${best.ey.toFixed(1)}`);
    it.tick.setAttribute('cx', best.sx.toFixed(1));
    it.tick.setAttribute('cy', best.sy.toFixed(1));
    it.tick.setAttribute('r', '1.2');
    it.el.style.opacity = 1;
    it.line.style.opacity = 1;
    it.el.style.transform = `translate(${best.box.x0.toFixed(1)}px, ${best.box.y0.toFixed(1)}px)`;
  }

  items.forEach((it, name) => {
    if (!seen.has(name)) { it.el.style.opacity = 0; it.line.setAttribute('points', ''); it.tick.setAttribute('r', '0'); }
  });
}

addEventListener('resize', () => { zones = null; items.forEach((it) => { it.w = 0; }); });
document.fonts?.ready.then(() => items.forEach((it) => { it.w = 0; }));
requestAnimationFrame(frame);
buildFacts();

/* ---------------- Themes ---------------- */
// <html data-theme="night|print|natgeo">; scene listens to window 'themechange'.
const THEMES = ['night', 'print', 'natgeo'];
function applyTheme(theme, persist) {
  if (!THEMES.includes(theme)) theme = 'night';
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll('.themes button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.theme === theme)));
  if (persist) { try { localStorage.setItem('solar-theme', theme); } catch (e) { /* storage unavailable */ } }
  zones = null;
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}
let initialTheme = null;
try { initialTheme = localStorage.getItem('solar-theme'); } catch (e) { /* storage unavailable */ }
if (!initialTheme) initialTheme = matchMedia('(prefers-color-scheme: light)').matches ? 'print' : 'night';
applyTheme(initialTheme, false);
document.querySelectorAll('.themes button').forEach((b) => b.addEventListener('click', () => applyTheme(b.dataset.theme, true)));

