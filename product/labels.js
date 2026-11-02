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

function frame(t) {
  requestAnimationFrame(frame);
  const anchors = Array.isArray(window.__labelAnchors) ? window.__labelAnchors : null;
  if (!anchors || !anchors.length) {
    items.forEach((it) => { it.el.style.opacity = 0; it.line.setAttribute('points', ''); it.tick.setAttribute('r', '0'); });
    return;
  }
  if (!zones || t - zonesAt > 500) { zones = keepOut(); zonesAt = t; }

  const seen = new Set();
  const placed = [];
  const leaders = [];
  const placedRows = [];
  // Phone: short leaders only; a label that can't sit unambiguously is dropped (captions carry it).
  const narrow = zones.w < 640; // [[p,q], ...] segments already drawn
  const sorted = anchors
    .filter((a) => a && typeof a.name === 'string' && Number.isFinite(a.x) && Number.isFinite(a.y))
    .slice()
    .sort((a, b) => a.x - b.x);

  // Every planet disc (Saturn incl. rings) is an obstacle labels must not cover.
  const ringed = (n) => n === 'Saturn';
  const discs = sorted.map((a) => {
    const r = Math.max(0, Number(a.r) || 0);
    const g = 1;
    const rx = r * g * (ringed(a.name) ? 2.3 : 1) + 6, ry = r * g + 6;
    return { x0: a.x - rx, x1: a.x + rx, y0: a.y - ry, y1: a.y + ry };
  });

  sorted.forEach((a, i) => {
    const it = getItem(a.name);
    seen.add(a.name);
    measure(it);
    const isSun = a.name === SUN.name;
    const r = Math.max(0, Number(a.r) || 0) * (isSun ? 1.2 : 1); // Sun's glow reads larger than its disc

    // Outward side by orbit number: odd orbits above, even below. Sun: top-left.
    const orbit = PLANETS.findIndex((p) => p.name === a.name) + 1;
    const prefer = isSun ? -1 : orbit % 2 === 1 ? -1 : 1;
    const order = isSun
      ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
      : [[prefer, 1], [prefer, -1], [-prefer, 1], [-prefer, -1], [prefer, 0], [-prefer, 0]];
    // Score every candidate; hard conflicts cost a lot, so the least-bad wins.
    let best = null, prevCand = null;
    order.forEach(([side, hd], oi) => {
      for (const len of (narrow || isSun ? [14, 22, 30, 36] : [16, 24, 32, 40, 54, 68])) {
        const sx = a.x + hd * r * (ringed(a.name) ? 2.2 : 0.7071);
        const sy = hd === 0 ? a.y + side * (r * (ringed(a.name) ? 0.8 : 1) + 2)
                            : a.y + side * r * (ringed(a.name) ? 0.1 : 0.7071);
        const ex = sx + hd * len * 0.7, ey = sy + side * len;
        const hx = ex + (hd || 1) * 10;
        const lx = hd >= 0 ? hx + 4 : hx - 4 - it.w;
        const box = { x0: lx, x1: lx + it.w, y0: ey - it.h / 2, y1: ey + it.h / 2 };
        const lead = { x0: Math.min(sx, hx), x1: Math.max(sx, hx), y0: Math.min(sy, ey), y1: Math.max(sy, ey) };
        const key = `${side}${hd}${len}`;
        let cost = oi * 6 + len * 0.25 + (len > 40 ? 30 : 0) + (it.prev === key ? -4 : 0);
        if (hit(box, zones.mast) || hit(box, zones.facts) || hit(box, zones.sw)) cost += 400;
        if (box.x1 > zones.w - 8 || box.x0 < 8 || box.y0 < 4 || box.y1 > zones.h - 4) cost += 400;
        cost += 300 * placed.filter((p) => hit(box, p)).length;
        cost += 200 * discs.filter((d) => hit(box, d)).length;
        cost += 40 * discs.filter((d, j) => j !== i && hit(lead, d)).length;
        const segs = [[[sx, sy], [ex, ey]], [[ex, ey], [hx, ey]]];
        for (const [p, q] of segs) {
          for (const [u, v] of leaders) if (segX(p, q, u, v)) cost += narrow ? 400 : 300;
          for (const pb of placed) if (segBox(p, q, pb)) cost += 150;
        }
        for (const [u, v] of leaders) if (segBox(u, v, box)) cost += 150;
        // Attribution: the label must sit nearer its own planet than any other.
        const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
        const edge = (q) => Math.hypot(q.x - cx, q.y - cy) - (Number(q.r) || 0) * (ringed(q.name) ? 1.6 : 1);
        const own = edge(a);
        const attr = sorted.some((q) => q !== a && q.name !== SUN.name && edge(q) < own);
        if (attr) cost += 400;
        // Reading order: within a row (above / below), label x-order follows planet x-order.
        for (const pr of placedRows) if (pr.side === side && pr.x0 > box.x0) cost += 120;
        const cand = { cost, attr, key, side, sx, sy, ex, ey, hx, box };
        if (key === it.prev) prevCand = cand;
        if (!best || cost < best.cost) best = cand;
      }
    });
    // Hysteresis: keep the current slot unless it has been blocked for > 300ms.
    if (prevCand && best !== prevCand) {
      const blocked = prevCand.cost >= 100;
      if (!blocked) { best = prevCand; it.blockedAt = 0; }
      else if (!prevCand.attr) { // never hold a slot that reads as another planet's label
        if (!it.blockedAt) it.blockedAt = t;
        if (t - it.blockedAt < 600) best = prevCand; else it.blockedAt = 0;
      }
    } else it.blockedAt = 0;
    it.prev = best.key;
    // Off-stage or nowhere legal to put it: hide rather than drop a label in the copy.
    const off = a.x < -r || a.y < -r || a.x > zones.w + r || a.y > zones.h + r;
    if (off || best.cost >= 400) {
      it.el.style.opacity = 0; it.line.style.opacity = 0; it.tick.setAttribute('r', '0'); it.off = null;
      return;
    }
    placedRows.push({ side: best.side, x0: best.box.x0 });
    // Glide: ease the leader/label offsets (relative to the planet) toward the target.
    const tgt = [best.sx - a.x, best.sy - a.y, best.ex - a.x, best.ey - a.y, best.hx - a.x, best.box.x0 - a.x, best.box.y0 - a.y];
    if (!it.off) it.off = tgt.slice();
    else for (let k = 0; k < 7; k++) it.off[k] += (tgt[k] - it.off[k]) * 0.35;
    const o = it.off;
    best = { ...best, sx: a.x + o[0], sy: a.y + o[1], ex: a.x + o[2], ey: a.y + o[3], hx: a.x + o[4],
      box: { ...best.box, x0: a.x + o[5], y0: a.y + o[6] } };
    leaders.push([[best.sx, best.sy], [best.ex, best.ey]], [[best.ex, best.ey], [best.hx, best.ey]]);
    const b = best.box;
    placed.push({ x0: b.x0 - 8, x1: b.x1 + 8, y0: b.y0 - 4, y1: b.y1 + 4 });

    it.line.setAttribute('points', `${best.sx.toFixed(1)},${best.sy.toFixed(1)} ${best.ex.toFixed(1)},${best.ey.toFixed(1)} ${best.hx.toFixed(1)},${best.ey.toFixed(1)}`);
    it.tick.setAttribute('cx', best.sx.toFixed(1));
    it.tick.setAttribute('cy', best.sy.toFixed(1));
    it.tick.setAttribute('r', '1.2');
    it.el.style.opacity = 1;
    it.line.style.opacity = 1;
    it.el.style.transform = `translate(${best.box.x0.toFixed(1)}px, ${best.box.y0.toFixed(1)}px)`;
  });

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

