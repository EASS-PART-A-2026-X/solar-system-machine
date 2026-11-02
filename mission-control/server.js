import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@hocuspocus/server';
import * as Y from 'yjs';
import { chatLines } from './src/chatdoc.js';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

// Sync server for the shared chat. Documents are saved to dataDir so a restart loses nothing.
// Clients that do not send `token` connect read-only, so only the crew, the lead and root can write.
export function createChatServer({ port = 1234, dataDir = here('./.data/'), token, chatLog, debounce = 500 } = {}) {
  mkdirSync(dataDir, { recursive: true });
  const file = (name) => join(dataDir, `${encodeURIComponent(name)}.ydoc`);
  return new Server({
    port,
    quiet: true,
    debounce,
    async onAuthenticate({ token: sent, connectionConfig }) {
      if (token && sent !== token) connectionConfig.readOnly = true;
    },
    async onLoadDocument({ documentName, document }) {
      if (existsSync(file(documentName))) Y.applyUpdate(document, readFileSync(file(documentName)));
      return document;
    },
    async onStoreDocument({ documentName, document }) {
      writeFileSync(file(documentName), Y.encodeStateAsUpdate(document));
    },
    async onChange({ document }) {
      if (chatLog) writeFileSync(chatLog, JSON.stringify(chatLines(document), null, 1));
    },
  });
}

// The write token: CHAT_TOKEN if set, otherwise one generated on first start and kept in .data/token.
export function writeToken(dataDir = here('./.data/')) {
  if (process.env.CHAT_TOKEN) return process.env.CHAT_TOKEN;
  const f = join(dataDir, 'token');
  mkdirSync(dataDir, { recursive: true });
  if (!existsSync(f)) writeFileSync(f, randomBytes(12).toString('hex'));
  return readFileSync(f, 'utf8').trim();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const token = writeToken();
  const server = createChatServer({ port: Number(process.env.PORT || 1234), token, chatLog: here('../logbook/chat.json') });
  await server.listen();
  console.log(`sync server on ws://localhost:${server.configuration.port}`);
  console.log(`mission control: http://localhost:5174/?name=root&token=${token}`);
}
