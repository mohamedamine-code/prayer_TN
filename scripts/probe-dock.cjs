// Real-input dock test: chevron click/expand/collapse + bounds reporting via CDP.
const http = require('node:http');
const PORT = Number(process.env.CDP_PORT ?? 9222);
const TITLE = process.env.CDP_TARGET_TITLE ?? 'Salati Widget';
const ACTION = process.env.DOCK_ACTION ?? 'peek'; // peek | expand | collapse

async function jsonGet(path) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port: PORT, path }, (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => resolve(JSON.parse(b)));
      })
      .on('error', reject);
  });
}

function maskPayload(data, key) {
  const masked = Buffer.from(data);
  for (let i = 0; i < masked.length; i++) masked[i] ^= key[i % 4];
  return masked;
}

function frameFrame(payload) {
  const data = Buffer.from(payload, 'utf8');
  const key = Buffer.from([123, 45, 67, 89]);
  let header;
  if (data.length < 126) header = Buffer.from([0x81, 0x80 | data.length]);
  else if (data.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(data.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(data.length), 2);
  }
  return Buffer.concat([header, key, maskPayload(data, key)]);
}

function parseFrame(buf) {
  if (buf.length < 2) return null;
  const len0 = buf[1] & 0x7f;
  let off = 2;
  let len = len0;
  if (len0 === 126) {
    len = buf.readUInt16BE(2);
    off = 4;
  } else if (len0 === 127) {
    len = Number(buf.readBigUInt64BE(2));
    off = 10;
  }
  return { opcode: buf[0] & 0x0f, payload: buf.slice(off, off + len), rest: buf.slice(off + len) };
}

async function main() {
  const targets = await jsonGet('/json/list');
  const page = targets.find((t) => t.type === 'page' && t.title.includes(TITLE));
  if (!page) {
    console.log(JSON.stringify({ error: 'target not found: ' + TITLE }));
    process.exit(1);
  }
  const wsUrl = new URL(page.webSocketDebuggerUrl);
  const key = Buffer.from('0123456789abcdef12').toString('base64');
  const sock = await new Promise((resolve, reject) => {
    const req = http.request({
      host: wsUrl.hostname,
      port: wsUrl.port || PORT,
      path: wsUrl.pathname + wsUrl.search,
      headers: {
        Host: wsUrl.host,
        Upgrade: 'websocket',
        Connection: 'Upgrade',
        'Sec-WebSocket-Key': key,
        'Sec-WebSocket-Version': '13',
      },
    });
    req.on('upgrade', (_r, s) => resolve(s));
    req.on('response', (r) => reject(new Error('no upgrade: ' + r.statusCode)));
    req.on('error', reject);
    req.end();
  });

  let buf = Buffer.alloc(0);
  const pending = new Map();
  let nextId = 1;
  sock.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    let f;
    while ((f = parseFrame(buf))) {
      buf = f.rest;
      if (f.opcode === 1) {
        const msg = JSON.parse(f.payload.toString('utf8'));
        if (msg.id && pending.has(msg.id)) {
          pending.get(msg.id)(msg);
          pending.delete(msg.id);
        }
      }
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      sock.write(frameFrame(JSON.stringify({ id, method, params })));
    });
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) return { error: r.result.exceptionDetails.text };
    return r.result?.result?.value;
  };
  const realClick = async (sel) => {
    const rect = await evalJs(
      `(() => { const b = document.querySelector('${sel}'); if (!b) return null; const r = b.getBoundingClientRect(); return JSON.stringify({x: r.x + r.width/2, y: r.y + r.height/2}); })()`,
    );
    if (!rect) return 'no-such-element';
    const { x, y } = JSON.parse(rect);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await new Promise((r) => setTimeout(r, 80));
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await new Promise((r) => setTimeout(r, 70));
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    return 'clicked';
  };

  if (ACTION === 'expand' || ACTION === 'collapse') {
    const res = await realClick('.dock-chev');
    await new Promise((r) => setTimeout(r, ACTION === 'expand' ? 800 : 1100));
  }

  const bounds = await evalJs(
    `(() => {
      const tab = document.querySelector('.dock-tab');
      const main = document.querySelector('.mini-main');
      const chev = document.querySelector('.dock-chev');
      const root = document.querySelector('.dock-root');
      const info = (e) => e ? ({cx: e.getBoundingClientRect().x, cy: e.getBoundingClientRect().y, w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height}) : null;
      return JSON.stringify({
        screenX: window.screenX, screenY: window.screenY,
        innerW: window.innerWidth, innerH: window.innerHeight,
        rootCls: root?.className, tabCls: tab?.className, tab: info(tab), main: info(main), chev: info(chev),
        visMain: main ? getComputedStyle(main).display : null,
        moon: !!document.querySelector('.dock-moon'),
      });
    })()`,
  );
  console.log(JSON.stringify(bounds, null, 1));

  if (ACTION === 'expand' || ACTION === 'collapse') {
    // second bounds read after settle
    await new Promise((r) => setTimeout(r, 300));
    const b2 = await evalJs(`JSON.stringify({x: window.screenX, y: window.screenY, w: window.innerWidth, h: window.innerHeight})`);
    console.log('after settle:', b2);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
