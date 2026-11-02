import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Plate, PlateContent, usePlateEditor } from 'platejs/react';
import { YjsPlugin } from '@platejs/yjs/react';
import { Control } from './Control.jsx';

const ROOM = 'solar-team-chat';
const params = new URLSearchParams(location.search);
const NAME = params.get('name') || 'human';
const TOKEN = params.get('token') || undefined; // without the write token the chat is read-only
const COLORS = { A: '#e03131', B: '#1971c2', C: '#2f9e44', lead: '#7048e8', root: '#000000' };

function App() {
  const [status, setStatus] = useState('connecting');
  const [lines, setLines] = useState([]);
  const editor = usePlateEditor({
    plugins: [
      YjsPlugin.configure({
        options: {
          cursors: { data: { name: NAME, color: COLORS[NAME] || '#888' } },
          providers: [{ type: 'hocuspocus', options: { name: ROOM, url: 'ws://localhost:1234', token: TOKEN } }],
          onConnect: () => setStatus('connected'),
          onDisconnect: () => setStatus('disconnected'),
        },
      }),
    ],
    skipInitialization: true,
  });

  useEffect(() => {
    editor.getApi(YjsPlugin).yjs.init({
      id: ROOM,
      autoSelect: 'end',
      value: [{ type: 'p', children: [{ text: 'TEAM CHAT - Solar System project' }] }],
    });
    // Agent helpers: __post("msg") appends a line, __log() returns all lines.
    window.editor = editor;
    window.__post = (msg) =>
      editor.tf.insertNodes(
        { type: 'p', children: [{ text: `[${new Date().toLocaleTimeString()}] ${NAME}: ${msg}` }] },
        { at: [editor.children.length] },
      );
    window.__log = () => editor.children.map((n) => n.children.map((c) => c.text).join(''));
    const tick = setInterval(() => setLines(window.__log()), 1500);
    return () => {
      clearInterval(tick);
      editor.getApi(YjsPlugin).yjs.destroy();
    };
  }, [editor]);

  return (
    <>
      <header>
        <b>Plate team chat</b> · room <code>{ROOM}</code> · you are <b style={{ color: COLORS[NAME] }}>{NAME}</b> · {status}
        {!TOKEN && <span className="ro"> · read-only (open with &amp;token=…)</span>}
      </header>
      {NAME === 'root' && <Control post={(m) => window.__post(m)} lines={lines} />}
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.msg;
          if (input.value.trim()) window.__post(input.value.trim());
          input.value = '';
        }}
      >
        <input name="msg" placeholder={`Message as ${NAME}, press Enter`} autoComplete="off" />
      </form>
      <Plate editor={editor}>
        <PlateContent className="editor" placeholder="Type..." />
      </Plate>
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
