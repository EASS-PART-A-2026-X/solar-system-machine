// Product checks: renders the product in headless Chrome and checks geometry, facts, errors and contrast.
// Usage: node product/checks/validate.mjs [--json out.json] [--only 1440x1000]
// Reads the page's own hand-offs: window.__labelAnchors (planet discs) and window.__copyRects (text blocks).
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';
import { PLANETS, SUN } from '../data.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const AXE = await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

// Where the spread has to hold up: phone, tablet, laptop, the size that broke, and a tall desktop.
export const VIEWPORTS = [
  { id: '390x844', width: 390, height: 844, minLabels: 6 },
  { id: '723x934', width: 723, height: 934, minLabels: 8 },
  { id: '1280x800', width: 1280, height: 800, minLabels: 9 },
  { id: '1440x1000', width: 1440, height: 1000, minLabels: 9 },
  { id: '1440x1300', width: 1440, height: 1300, minLabels: 9 },
];
export const THEMES = ['night', 'print', 'natgeo'];
const SAMPLES = 6;       // the planets orbit, so geometry is sampled over a few seconds
const SETTLE_MS = 4500;  // camera auto-fit settles quickly after load
const TOL = 2;           // px of anti-aliasing slack

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };

function serve() {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const file = join(ROOT, path.endsWith('/') ? `${path}index.html` : path);
    let body;
    try { body = await readFile(file); } catch { return res.writeHead(404).end(); }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

const nf = new Intl.NumberFormat('en-US');
export const expectedFacts = (p) => [
  `${nf.format(p.radiusKm * 2)} km`,
  `${p.au.toFixed(2)} AU`,
  p.periodDays < 1000 ? `${nf.format(p.periodDays)} days` : `${(p.periodDays / 365.25).toFixed(1)} years`,
  String(p.moons),
];

// How far a disc reaches into a rectangle, in px (0 when clear, within tolerance).
const overlap = (c, r) => {
  if (!r) return 0;
  const dx = c.x - Math.max(r.x0, Math.min(c.x, r.x1)), dy = c.y - Math.max(r.y0, Math.min(c.y, r.y1));
  return Math.max(0, Math.round(c.r - Math.hypot(dx, dy) - TOL));
};
const circleHitsRect = (c, r) => overlap(c, r) > 0;
const rectsHit = (a, b) => a.x0 < b.x1 - TOL && a.x1 > b.x0 + TOL && a.y0 < b.y1 - TOL && a.y1 > b.y0 + TOL;

async function sample(page) {
  return page.evaluate(() => {
    const stage = document.getElementById('stage').getBoundingClientRect();
    const labels = [...document.querySelectorAll('.plabel')]
      .filter((el) => parseFloat(getComputedStyle(el).opacity) > 0.5)
      .map((el) => { const r = el.getBoundingClientRect(); return { name: el.textContent.trim(), x0: r.left - stage.left, y0: r.top - stage.top, x1: r.right - stage.left, y1: r.bottom - stage.top }; });
    return { w: stage.width, h: stage.height, anchors: structuredClone(window.__labelAnchors || []), copy: structuredClone(window.__copyRects || {}), labels };
  });
}

function geometryChecks(vp, samples) {
  const out = [];
  const names = [SUN.name, ...PLANETS.map((p) => p.name)];
  const bad = { contract: [], frame: [], copy: [], labelsOnDiscs: [], labelsOverlap: [], fewLabels: [] };
  samples.forEach((s, i) => {
    const at = `t${i}`;
    const got = s.anchors.map((a) => a.name);
    const shapeOk = names.every((n) => got.includes(n)) && s.anchors.every((a) => [a.x, a.y, a.r].every(Number.isFinite) && a.r > 0);
    if (!shapeOk) bad.contract.push(`${at}: got [${got.join(',')}]`);
    for (const a of s.anchors) {
      const disc = { x: a.x, y: a.y, r: a.r };
      // Planets must be fully in frame; the Sun is allowed to bleed off the left edge by design.
      const out = Math.round(Math.max(-(a.x - a.r), a.x + a.r - s.w, -(a.y - a.r), a.y + a.r - s.h));
      if (a.name !== SUN.name && out > TOL) bad.frame.push(`${a.name} ${out}px off-screen`);
      if (a.name === SUN.name && (a.x + a.r < 0 || a.y + a.r < 0 || a.y - a.r > s.h)) bad.frame.push(`Sun off-screen@${at}`);
      for (const [block, rect] of Object.entries(s.copy)) if (circleHitsRect(disc, rect)) bad.copy.push(`${a.name} ${overlap(disc, rect)}px into ${block}`);
      for (const l of s.labels) if (l.name.toLowerCase() !== a.name.toLowerCase() && circleHitsRect(disc, l)) bad.labelsOnDiscs.push(`${l.name} label on ${a.name}@${at}`);
    }
    s.labels.forEach((l, j) => s.labels.slice(j + 1).forEach((m) => { if (rectsHit(l, m)) bad.labelsOverlap.push(`${l.name}/${m.name}@${at}`); }));
    if (s.labels.length < vp.minLabels) bad.fewLabels.push(`${s.labels.length}@${at}`);
  });
  // Worst case first, so the detail line says how bad it gets.
  const px = (x) => Number(/(\d+)px/.exec(x)?.[1] ?? 0);
  const uniq = (xs) => [...new Set(xs)].sort((a, b) => px(b) - px(a)).slice(0, 4).join(', ');
  const add = (id, list, okText) => out.push({ layer: 'product', id: `${id} @${vp.id}`, ok: list.length === 0, detail: list.length ? uniq(list) : okText });
  add('label-anchors contract', bad.contract, '9 bodies with finite x, y, r');
  add('planets in frame', bad.frame, 'every planet fully on screen');
  add('discs clear of text', bad.copy, 'no body overlaps the headline or captions');
  add('labels clear of other discs', bad.labelsOnDiscs, 'no label covers another body');
  add('labels do not overlap', bad.labelsOverlap, 'no two labels collide');
  add(`at least ${vp.minLabels} labels`, bad.fewLabels, `min ${Math.min(...samples.map((s) => s.labels.length))} visible`);
  return out;
}

async function load(browser, base, vp, theme) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  await context.addInitScript((t) => { try { localStorage.setItem('solar-theme', t); } catch {} }, theme);
  const page = await context.newPage();
  const errors = [];
  // Chrome asks every page for /favicon.ico; that 404 is not the product's.
  page.on('console', (m) => m.type() === 'error' && !/favicon/.test(m.location().url) && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/product/`, { waitUntil: 'load' });
  await page.waitForFunction(() => (window.__labelAnchors || []).length >= 9, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(SETTLE_MS);
  return { context, page, errors };
}

export async function validateProduct({ only } = {}) {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const checks = [];
  try {
    for (const vp of VIEWPORTS.filter((v) => !only || v.id === only)) {
      const { context, page, errors } = await load(browser, base, vp, 'night');
      const samples = [];
      for (let i = 0; i < SAMPLES; i++) { samples.push(await sample(page)); await page.waitForTimeout(700); }
      checks.push(...geometryChecks(vp, samples));
      checks.push({ layer: 'product', id: `no console errors @${vp.id}`, ok: errors.length === 0, detail: errors.length ? errors.slice(0, 2).join(' | ') : 'clean' });
      await context.close();
    }

    // Themes change rendering, not layout: check each one once for errors, a drawn scene, facts and contrast.
    for (const theme of THEMES) {
      const vp = VIEWPORTS.find((v) => v.id === '1440x1300');
      const { context, page, errors } = await load(browser, base, vp, theme);
      const shot = await page.locator('#stage').screenshot();
      checks.push({ layer: 'product', id: `scene renders [${theme}]`, ok: shot.length > 40_000, detail: `${Math.round(shot.length / 1024)} KB stage capture` });
      checks.push({ layer: 'product', id: `no console errors [${theme}]`, ok: errors.length === 0, detail: errors.length ? errors.slice(0, 2).join(' | ') : 'clean' });
      const facts = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#facts .fact')].map((li) => [li.dataset.name, li.innerText])));
      const wrong = PLANETS.flatMap((p) => expectedFacts(p).filter((v) => !(facts[p.name] || '').includes(v)).map((v) => `${p.name}: ${v}`));
      checks.push({ layer: 'product', id: `captions match data.js [${theme}]`, ok: wrong.length === 0 && Object.keys(facts).length === PLANETS.length, detail: wrong.length ? wrong.slice(0, 4).join(', ') : `${PLANETS.length * 4} values match` });
      await page.addScriptTag({ content: AXE });
      const axe = await page.evaluate(() => window.axe.run(document.getElementById('copy'), { runOnly: ['color-contrast'] }));
      const low = axe.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ')));
      checks.push({ layer: 'product', id: `text contrast [${theme}]`, ok: low.length === 0, detail: low.length ? `${low.length} low-contrast: ${low.slice(0, 3).join(', ')}` : 'WCAG AA contrast passes' });
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  return checks;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
  const checks = await validateProduct({ only: arg('--only') });
  for (const c of checks) console.log(`${c.ok ? '✔' : '✖'} ${c.id} · ${c.detail}`);
  if (arg('--json')) await writeFile(arg('--json'), JSON.stringify(checks, null, 1));
  const failed = checks.filter((c) => !c.ok).length;
  console.log(`\nproduct: ${checks.length - failed}/${checks.length} pass`);
  process.exitCode = failed ? 1 : 0;
}
