// Temporary diagnostic: evaluate JS inside the Salati renderer over CDP.
// Usage: node scripts/probe-cdp.cjs "<expression>"
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

function wsSend(sock, payload) {
  const data = Buffer.from(payload, 'utf8');
  const maskKey = [
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256),
  ];
  const masked = Buffer.from(data);
  for (let i = 0; i < masked.length; i++) masked[i] ^= maskKey[i % 4];
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
  sock.write(Buffer.concat([header, Buffer.from(maskKey), masked]));
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
  const expr = process.argv[2] ?? '1+1';
  const targets = await jsonGet('/json/list');
  const want = process.env.CDP_TARGET_TITLE;
  const page = want ? targets.find((t) => t.type === 'page' && t.title.includes(want)) : targets.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target');
  const wsUrl = new URL(page.webSocketDebuggerUrl);
  const key = Buffer.from('0123456789abcdef12').toString('base64');
  const res = await new Promise((resolve, reject) => {
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
    req.on('upgrade', (r, sock) => resolve(sock));
    req.on('response', (r) => reject(new Error('no upgrade: ' + r.statusCode)));
    req.on('error', reject);
    req.end();
  });

  let acc = Buffer.alloc(0);
  let done;
  const p = new Promise((r) => (done = r));
  res.on('data', (chunk) => {
    acc = Buffer.concat([acc, chunk]);
    const f = parseFrame(acc);
    if (f && f.opcode === 1) {
      done(true);
    }
  });
  wsSend(
    res,
    JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: { expression: expr, awaitPromise: true, returnByValue: true },
    }),
  );
  await p;
  const f = parseFrame(acc);
  const msg = JSON.parse(f.payload.toString('utf8'));
  const r = msg.result?.result;
  console.log(JSON.stringify(msg.result, null, 2).slice(0, 3000));
  res.destroy();
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
