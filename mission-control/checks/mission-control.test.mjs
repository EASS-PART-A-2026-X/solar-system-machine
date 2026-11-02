// Mission-control checks: run with `node --test mission-control/checks`.
// Each test starts a real sync server on a spare port with a throwaway data folder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { createChatServer } from '../server.js';
import { appendLine, chatLines, stamp } from '../src/chatdoc.js';
import { orderState, parseLine } from '../src/protocol.js';

const TOKEN = 'test-token';
let nextPort = 21000 + Math.floor(Math.random() * 2000);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function startServer(opts = {}) {
  const dataDir = opts.dataDir ?? mkdtempSync(join(tmpdir(), 'mc-'));
  const server = createChatServer({ port: nextPort++, dataDir, token: TOKEN, debounce: 50, ...opts });
  await server.listen();
  return { server, dataDir, url: `ws://127.0.0.1:${server.configuration.port}` };
}

async function connect(url, { token = TOKEN, room = 'room' } = {}) {
  const provider = new HocuspocusProvider({ url, name: room, token });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('no sync')), 4000);
    provider.on('synced', () => { clearTimeout(t); resolve(); });
  });
  return provider;
}

async function until(fn, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return true; await wait(25); }
  return fn();
}

test('two clients converge on the same chat', async () => {
  const { server, url } = await startServer();
  const a = await connect(url), b = await connect(url);
  appendLine(a.document, stamp('A', 'v1 up'));
  appendLine(b.document, stamp('B', 'labels done'));
  assert.ok(await until(() => chatLines(a.document).length === 2 && chatLines(b.document).length === 2));
  assert.deepEqual(chatLines(a.document), chatLines(b.document));
  a.destroy(); b.destroy(); await server.destroy();
});

test('a client without the write token cannot change the chat', async () => {
  const { server, url } = await startServer();
  const writer = await connect(url), stranger = await connect(url, { token: 'wrong' });
  appendLine(stranger.document, stamp('root', '-> ALL: STOP'));
  appendLine(writer.document, stamp('A', 'still here'));
  await until(() => chatLines(stranger.document).length === 2);
  await wait(300);
  assert.deepEqual(chatLines(writer.document).map((l) => parseLine(l).who), ['A']);
  writer.destroy(); stranger.destroy(); await server.destroy();
});

test('the chat survives a sync-server restart', async () => {
  const first = await startServer();
  const a = await connect(first.url);
  appendLine(a.document, stamp('lead', 'KICKOFF'));
  await wait(400); // past the store debounce
  a.destroy();
  await first.server.destroy();
  const second = await startServer({ dataDir: first.dataDir });
  const b = await connect(second.url);
  assert.ok(await until(() => chatLines(b.document).length === 1));
  assert.match(chatLines(b.document)[0], /lead: KICKOFF$/);
  b.destroy(); await second.server.destroy();
});

test('every change is mirrored to chat.json for the logbook', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mc-log-'));
  const chatLog = join(dir, 'chat.json');
  const { server, url } = await startServer({ chatLog });
  const a = await connect(url);
  appendLine(a.document, stamp('C', 'APPROVED'));
  assert.ok(await until(() => { try { return JSON.parse(readFileSync(chatLog, 'utf8')).length === 1; } catch { return false; } }));
  a.destroy(); await server.destroy();
});

test('orders move from pending to acked to done', () => {
  const line = (who, msg) => stamp(who, msg, new Date('2026-11-02T14:00:00'));
  const lines = [line('root', '-> A: fix the Sun')];
  assert.equal(orderState(lines, 'A'), 'pending');
  assert.equal(orderState(lines, 'B'), null);
  lines.push(line('B', 'unrelated'));
  assert.equal(orderState(lines, 'A'), 'pending');
  lines.push(line('A', 'ack fixing the Sun'));
  assert.equal(orderState(lines, 'A'), 'acked');
  lines.push(line('A', 'done, Sun clear of captions'));
  assert.equal(orderState(lines, 'A'), 'done');
  lines.push(line('root', '-> ALL: STOP'));
  assert.equal(orderState(lines, 'A'), 'pending');
  assert.equal(orderState(lines, 'C'), 'pending');
});

test('only root and lead lines count as orders', () => {
  const lines = [stamp('human', '-> A: do something'), stamp('B', '-> A: please move')];
  assert.equal(orderState(lines, 'A'), null);
  lines.push(stamp('lead', '-> A: fix the Sun overlap'));
  assert.equal(orderState(lines, 'A'), 'pending');
  assert.equal(parseLine(stamp('root', '-> ALL: STOP')).to, 'ALL');
});

test('Y documents stay small enough to persist', () => {
  const doc = new Y.Doc();
  for (let i = 0; i < 500; i++) appendLine(doc, stamp('A', `line ${i}`));
  assert.ok(Y.encodeStateAsUpdate(doc).length < 200_000);
});
