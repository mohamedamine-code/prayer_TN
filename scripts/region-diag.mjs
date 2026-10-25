import http from 'node:http';
const PORT = Number(process.env.CDP_PORT ?? 9250);
const j = await new Promise((res, rej) =>
  http.get({ host: '127.0.0.1', port: PORT, path: '/json/list' }, (r) => {
    let b = '';
    r.on('data', (c) => (b += c));
    r.on('end', () => res(JSON.parse(b)));
  }).on('error', rej),
);
const page = j.find((t) => t.type === 'page' && t.title.includes(process.env.CDP_TARGET_TITLE ?? 'Salati Widget'));
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
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  return r.result?.result?.value;
};

const info = await ev(`(() => {
  const b = document.querySelector('.dock-chev');
  const r = b.getBoundingClientRect();
  const cx = r.x + r.width/2, cy = r.y + r.height/2;
  const chain = document.elementsFromPoint(cx, cy).map((e) => e.tagName + '.' + (e.className?.toString?.().slice(0, 30) ?? ''));
  const appRegion = (e) => e ? getComputedStyle(e).webkitAppRegion ?? getComputedStyle(e).appRegion ?? 'unset' : 'n/e';
  return JSON.stringify({ point: [Math.round(cx), Math.round(cy)], chain, regionChain: chain.map((c) => c.split('.')[0] + ':' + appRegion(document.querySelector('.' + c.split('.')[1]))).slice(0, 5) });
})()`);
console.log(info);
process.exit(0);
