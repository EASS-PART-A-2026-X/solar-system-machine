// B's scratch diagnostic: which labels are missing and why (not part of the product).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const f = join(ROOT, p.endsWith('/') ? p + 'index.html' : p);
  try { const b = await readFile(f); res.writeHead(200, { 'content-type': T[extname(f)] || 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const sizes = (process.argv[2] || '390x844,723x934,1280x800,1440x1000,1440x1300').split(',');
for (const s of sizes) {
  const [width, height] = s.split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  await page.goto(`${base}/product/`);
  await page.waitForFunction(() => (window.__labelAnchors || []).length >= 9, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(4500);
  for (let i = 0; i < 6; i++) {
    const r = await page.evaluate(() => {
      const st = document.getElementById('stage').getBoundingClientRect();
      const vis = [...document.querySelectorAll('.plabel')].filter((e) => parseFloat(getComputedStyle(e).opacity) > 0.5).map((e) => e.textContent.trim());
      const a = (window.__labelAnchors || []).map((a) => `${a.name}(${Math.round(a.x)},${Math.round(a.y)},${Math.round(a.r)})`).join(' ');
      return { vis, a, dbg: JSON.stringify(window.__labelDebug || {}) };
    });
    const miss = ['Sun','Mercury','Venus','Earth','Mars','Jupiter','Saturn','Uranus','Neptune'].filter((n) => !r.vis.includes(n));
    console.log(`${s} t${i}: ${r.vis.length} missing=[${miss}] | ${r.a}${process.env.DBG ? ' | ' + r.dbg : ''}`);
    await page.waitForTimeout(700);
  }
  await ctx.close();
}
await browser.close(); server.close();
