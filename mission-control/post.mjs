// Append one line to the shared chat as `who`: node mission-control/post.mjs <who> <message>
import { HocuspocusProvider } from '@hocuspocus/provider';
import { appendLine, stamp } from './src/chatdoc.js';
import { writeToken } from './server.js';

export async function post(who, msg, { url = process.env.CHAT_URL || 'ws://localhost:1234', room = 'solar-team-chat', token = writeToken(), timeoutMs = 5000 } = {}) {
  const provider = new HocuspocusProvider({ url, name: room, token });
  try {
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`no sync from ${url} within ${timeoutMs}ms`)), timeoutMs);
      provider.on('synced', () => { clearTimeout(t); resolve(); });
    });
    appendLine(provider.document, stamp(who, msg));
    await new Promise((r) => setTimeout(r, 300)); // let the update flush
  } finally {
    provider.destroy();
  }
}

if (process.argv[1]?.endsWith('post.mjs')) {
  const [who, ...rest] = process.argv.slice(2);
  await post(who, rest.join(' '));
}
