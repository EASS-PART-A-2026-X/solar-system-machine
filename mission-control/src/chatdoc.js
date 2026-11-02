import * as Y from 'yjs';

// Plate (slate-yjs) stores the document in the root 'content' XmlText; each paragraph is an
// embedded XmlText carrying the element's props as attributes.
export const content = (doc) => doc.get('content', Y.XmlText);

export function chatLines(doc) {
  return content(doc).toDelta().map((op) => (op.insert instanceof Y.XmlText
    ? op.insert.toDelta().map((d) => (typeof d.insert === 'string' ? d.insert : '')).join('')
    : String(op.insert)));
}

export function appendLine(doc, text) {
  const p = new Y.XmlText();
  p.insert(0, text);
  const root = content(doc);
  root.insertEmbed(root.length, p, { type: 'p' });
}

export const stamp = (who, msg, now = new Date()) => `[${now.toLocaleTimeString('en-US')}] ${who}: ${msg}`;
