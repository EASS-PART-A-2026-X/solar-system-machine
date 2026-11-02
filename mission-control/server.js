import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server } from '@hocuspocus/server';
import * as Y from 'yjs';

const CHAT_LOG = fileURLToPath(new URL('../logbook/chat.json', import.meta.url));

// Plate (slate-yjs) stores each paragraph as a Y.XmlText inside the root 'content' XmlText.
const lines = (doc) =>
  doc.get('content', Y.XmlText).toDelta()
    .map((op) => (op.insert instanceof Y.XmlText
      ? op.insert.toDelta().map((d) => (typeof d.insert === 'string' ? d.insert : '')).join('')
      : String(op.insert)));

const server = new Server({
  port: 1234,
  quiet: true,
  async onChange({ document }) {
    writeFileSync(CHAT_LOG, JSON.stringify(lines(document), null, 1));
  },
});
server.listen().then(() => console.log('hocuspocus on ws://localhost:1234'));
