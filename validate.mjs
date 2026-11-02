#!/usr/bin/env node
// The validation gate: product, mission-control and machine checks in one run.
//   node validate.mjs            run everything, write logbook/validation.json
//   node validate.mjs --post     also post the verdict to the team chat as "V"
//   node validate.mjs --only product|mission-control|machine
// Exits non-zero when any check fails, so CI and the lead can gate a release on it.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const want = (layer) => !only || only === layer;
const checks = [];

if (want('product')) {
  const { validateProduct } = await import('./product/checks/validate.mjs');
  checks.push(...(await validateProduct()));
}

if (want('mission-control')) {
  let tap;
  try {
    tap = execFileSync(process.execPath, ['--test', '--test-reporter=tap', '--test-timeout=15000', 'checks/mission-control.test.mjs'],
      { cwd: join(ROOT, 'mission-control'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    tap = e.stdout || '';
  }
  for (const m of tap.matchAll(/^(not ok|ok) \d+ - (.+)$/gm)) {
    checks.push({ layer: 'mission-control', id: m[2].trim(), ok: m[1] === 'ok', detail: m[1] === 'ok' ? 'pass' : 'fail (see node --test output)' });
  }
}

if (want('machine')) {
  const out = join(mkdtempSync(join(tmpdir(), 'machine-')), 'machine.json');
  try {
    execFileSync('python3', [join(ROOT, 'logbook/check_machine.py'), '--json', out], { stdio: 'ignore' });
  } catch { /* failures are in the JSON */ }
  checks.push(...JSON.parse(readFileSync(out, 'utf8')));
}

const failed = checks.filter((c) => !c.ok);
const verdict = { at: new Date().toISOString(), passed: checks.length - failed.length, total: checks.length, checks };
writeFileSync(join(ROOT, 'logbook/validation.json'), JSON.stringify(verdict, null, 1));

for (const layer of ['product', 'mission-control', 'machine']) {
  const mine = checks.filter((c) => c.layer === layer);
  if (!mine.length) continue;
  console.log(`\n${layer}: ${mine.filter((c) => c.ok).length}/${mine.length}`);
  for (const c of mine) console.log(`  ${c.ok ? '✔' : '✖'} ${c.id} · ${c.detail}`);
}
const summary = failed.length
  ? `${verdict.passed}/${verdict.total} pass · FAIL ${failed.slice(0, 3).map((c) => `${c.id} (${c.detail})`).join('; ')}`
  : `${verdict.passed}/${verdict.total} pass · gate GREEN`;
console.log(`\nGATE ${failed.length ? 'RED' : 'GREEN'}: ${summary}`);

if (args.includes('--post')) {
  const { post } = await import('./mission-control/post.mjs');
  await post('V', summary).catch((e) => console.log(`(chat not reachable: ${e.message})`));
}
process.exitCode = failed.length ? 1 : 0;
