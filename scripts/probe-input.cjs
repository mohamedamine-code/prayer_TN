// Real-input test: opens Settings, scroll-wheels it, closes it — all via
// browser-level mouse events (not synthetic JS clicks).
const http = require('node:http');
const PORT = Number(process.env.CDP_PORT ?? 9222);

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
  return { opcode: buf[0] & 0x0f, payload: buf.slice(off, off + len) };
}

async function main() {
  const targets = await jsonGet('/json/list');
  const page = targets.find((t) => t.type === 'page');
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
      buf = f.rest ?? Buffer.alloc(0);
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
    const r = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.result?.exceptionDetails) return { error: r.result.exceptionDetails.text };
    return r.result?.result?.value;
  };

  // 1) Find real viewport coords of the header Settings button (buttons: [refresh, settings, close])
  const rect = await evalJs(
    `(() => { const b = document.querySelectorAll('header button')[1]; const r = b.getBoundingClientRect(); return JSON.stringify({x: r.x + r.width/2, y: r.y + r.height/2}); })()`,
  );
  const { x: sx, y: sy } = JSON.parse(rect);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: sx, y: sy });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: sx, y: sy, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: sx, y: sy, button: 'left', clickCount: 1 });
  await new Promise((r) => setTimeout(r, 500));

  // 2) Wheel-scroll over the settings content
  const srect = await evalJs(
    `(() => { const p = document.querySelector('.absolute.inset-0 .overflow-y-auto'); if (!p) return 'null'; const r = p.getBoundingClientRect(); return JSON.stringify({x: r.x + r.width/2, y: Math.min(r.y + 200, r.bottom - 20), sh: p.scrollHeight, ch: p.clientHeight, st: p.scrollTop}); })()`,
  );
  if (srect === 'null') {
    console.log('FAIL: settings panel did not open with real click');
    process.exit(1);
  }
  const sr = JSON.parse(srect);
  for (let i = 0; i < 8; i++) {
    await send('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      x: sr.x,
      y: sr.y,
      deltaX: 0,
      deltaY: 120,
    });
    await new Promise((r) => setTimeout(r, 60));
  }
  const after = await evalJs(
    `(() => { const p = document.querySelector('.absolute.inset-0 .overflow-y-auto'); return JSON.stringify({st: p.scrollTop, max: p.scrollHeight - p.clientHeight, canScroll: p.scrollHeight > p.clientHeight}); })()`,
  );
  console.log('wheel scroll:', srect, '->', after);

  // 3) Real-click the settings X (first button in the settings header)
  const xrect = await evalJs(
    `(() => { const b = document.querySelector('.absolute.inset-0 header button'); const r = b.getBoundingClientRect(); return JSON.stringify({x: r.x + r.width/2, y: r.y + r.height/2}); })()`,
  );
  const { x: cx, y: cy } = JSON.parse(xrect);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: cy });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 });
  await new Promise((r) => setTimeout(r, 500));
  const panelOpen = await evalJs(`!!document.querySelector('.absolute.inset-0')`);
  console.log('settings X real click -> panel still open?', panelOpen);

  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
