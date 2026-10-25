// CDP websocket test using undici WebSocket (Node 22 global).
import http from 'node:http';
const PORT = Number(process.env.CDP_PORT ?? 9250);
const envTitle = process.env.CDP_TARGET_TITLE ?? 'Salati Widget';

const j = await new Promise((res, rej) =>
  http.get({ host: '127.0.0.1', port: PORT, path: '/json/list' }, (r) => {
    let b = '';
    r.on('data', (c) => (b += c));
    r.on('end', () => res(JSON.parse(b)));
  }).on('error', rej),
);
const page = j.find((t) => t.type === 'page' && t.title.includes(envTitle));
if (!page) {
  console.log('no target', envTitle);
  process.exit(1);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 1;
const waiting = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && waiting.has(m.id)) {
    waiting.get(m.id)(m);
    waiting.delete(m.id);
  }
};
const send = (method, params = {}) =>
  new Promise((res) => {
    const i = id++;
    waiting.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value ?? JSON.stringify(r);
};
await send('Runtime.enable');

const realClick = async (sel) => {
  const p = JSON.parse(await ev(
    `(() => { const r = document.querySelector('${sel}').getBoundingClientRect(); return JSON.stringify({x: r.x + r.width/2, y: r.y + r.height/2}); })()`,
  ));
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
  await new Promise((r) => setTimeout(r, 60));
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  await new Promise((r) => setTimeout(r, 60));
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
};
await send('Runtime.enable');
// Track events to see whether Chromium dispatches them to the DOM.
await ev(
  `window.__evts = []; ['mousedown','mouseup','click'].forEach(t => document.addEventListener(t, (e) => {
     const cr = e.target.closest ? (e.target.closest('.dock-chev') ? 'chev' : (e.target.closest('.mini-close') ? 'close' : e.target.tagName)) : e.target.tagName;
     window.__evts.push(t + ':' + cr);
   }, true));`,
);

console.log('step 1: real click on .mini-close (expanded widget, no-drag area)');
await realClick('.mini-close');
await new Promise((r) => setTimeout(r, 900));
console.log('events:', await ev('JSON.stringify(window.__evts)'));
console.log(
  'main display:',
  await ev(`getComputedStyle(document.querySelector('.mini-main')).display`),
);
console.log('step 2: real click on .dock-chev');
await realClick('.dock-chev');
await new Promise((r) => setTimeout(r, 900));
console.log('events:', await ev('JSON.stringify(window.__evts)'));
console.log('bounds:', await ev('JSON.stringify({w: window.innerWidth, h: window.innerHeight})'));
process.exit(0);
