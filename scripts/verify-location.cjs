/**
 * End-to-end verification of the consent-gated location feature.
 *
 * Boots the BUILT app (packaged-mode: file:// renderer) with remote debugging
 * and exercises the real Electron permission machinery through the renderer:
 *
 *  1. first-run dialog is shown and NO geolocation call is made before consent
 *  2. getCurrentPosition without consent fails with PERMISSION_DENIED (code 1)
 *  3. "Not Now" path stores consent=declined and still denies coordinates
 *  4. "Allow Location" path triggers the REAL Chromium geolocation permission
 *     request, which only then can produce a fix (position provider permitting)
 *
 * Usage: node scripts/verify-location.cjs [path-to-exe]
 *        (default: dev-mode Electron with the built dist/; pass the packaged
 *        "Salati Tunisia.exe" to verify the packaged Windows application.)
 */
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const PORT = 9223;
const ROOT = path.dirname(__dirname);
const APP_EXE = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(fs.realpathSync(ROOT), 'node_modules', 'electron', 'dist', 'electron.exe');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function jsonGet(target) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port: PORT, path: target }, (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => resolve(JSON.parse(b)));
      })
      .on('error', reject);
  });
}

function wsSend(sock, payload) {
  const data = Buffer.from(payload, 'utf8');
  const maskKey = Buffer.from([
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256),
  ]);
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
  sock.write(Buffer.concat([header, maskKey, masked]));
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

/** Evaluate an expression in the main renderer and return its value. */
async function evalInMain(expr) {
  const targets = await jsonGet('/json/list');
  const page = targets.find((t) => t.type === 'page' && /index\.html|localhost:5173/.test(t.url));
  if (!page) throw new Error('main window target not found (targets: ' + targets.map((t) => t.url).join(', ') + ')');
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

  let acc = Buffer.alloc(0);
  const result = await new Promise((resolve, reject) => {
    const onData = (chunk) => {
      acc = Buffer.concat([acc, chunk]);
      for (;;) {
        const f = parseFrame(acc);
        if (!f) return;
        acc = f.rest;
        if (f.opcode === 1) {
          try {
            const msg = JSON.parse(f.payload.toString('utf8'));
            if (msg.id === 1) return resolve(msg.result);
          } catch {
            /* partial frame */
          }
        }
      }
    };
    sock.on('data', onData);
    sock.on('error', reject);
    setTimeout(() => reject(new Error('CDP eval timeout: ' + expr.slice(0, 80))), 20_000);
    wsSend(
      sock,
      JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression: expr, awaitPromise: true, returnByValue: true },
      }),
    );
  });
  sock.destroy();
  if (result?.exceptionDetails) {
    throw new Error('renderer eval failed: ' + JSON.stringify(result.exceptionDetails).slice(0, 400));
  }
  return result?.result?.value;
}

const results = [];
function check(name, ok, extra) {
  results.push({ name, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra !== undefined ? '  -> ' + JSON.stringify(extra) : ''}`);
}

async function main() {
  const exeArgs = process.argv[2] ? [] : ['.'];
  const child = spawn(
    APP_EXE,
    [...exeArgs, `--remote-debugging-port=${PORT}`],
    { cwd: process.argv[2] ? path.dirname(APP_EXE) : ROOT, stdio: 'ignore', windowsHide: true },
  );

  try {
    // Wait for CDP + main window.
    let targets = null;
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      try {
        targets = await jsonGet('/json/list');
        if (targets.some((t) => t.type === 'page' && /index\.html/.test(t.url))) break;
      } catch {
        /* not up yet */
      }
    }
    if (!targets) throw new Error('app did not expose CDP');

    // Give React a moment to mount (driver boots, dialog appears).
    await sleep(3000);

    // Clean slate for the automation run.
    await evalInMain(
      `(async () => {
        await window.salati.saveSettings({ locationEnabled: false });
        await window.salati.setLocationConsent('unset');
        await window.salati.clearLocation();
        return true;
      })()`,
    );
    await sleep(500);

    // 1. First-run dialog is rendered (permission explanation first).
    const dialogShown = await evalInMain(
      `document.body.innerText.includes('Activer la localisation automatique') &&
       document.body.innerText.includes('Autoriser la localisation')`,
    );
    check('first-run permission dialog is displayed', dialogShown === true);

    // 2. No geolocation access before consent.
    const beforeConsent = await evalInMain(
      `new Promise((res) => navigator.geolocation.getCurrentPosition(
          () => res('FIX'),
          (e) => res('ERR:' + e.code),
          { timeout: 8000 }))`,
    );
    check('getCurrentPosition WITHOUT consent is denied (code 1)', beforeConsent === 'ERR:1', beforeConsent);

    const noCoords = await evalInMain(`window.salati.getLocation().then(s => s.lat === null && s.lon === null && s.consent === 'unset')`);
    check('no coordinates were stored silently', noCoords === true);

    // 3. "Not Now" path.
    await evalInMain(`window.salati.setLocationConsent('declined')`);
    await sleep(300);
    const afterNotNow = await evalInMain(
      `new Promise((res) => navigator.geolocation.getCurrentPosition(
          () => res('FIX'),
          (e) => res('ERR:' + e.code),
          { timeout: 8000 }))`,
    );
    check('after "Not Now", geolocation still denied', afterNotNow === 'ERR:1', afterNotNow);
    const notNowStored = await evalInMain(`window.salati.getLocation().then(s => s.consent === 'declined' && s.lat === null)`);
    check('"Not Now" stored without coordinates', notNowStored === true);

    // 4. "Allow Location" path: real permission request goes through Electron.
    await evalInMain(
      `(async () => {
        await window.salati.setLocationConsent('granted');
        await window.salati.saveSettings({ locationEnabled: true });
        return true;
      })()`,
    );
    // Electron's Permissions API does not reflect the permission handlers; the
    // real gate is whether getCurrentPosition succeeds once consent is given.
    const allowed = await evalInMain(
      `new Promise((res) => navigator.geolocation.getCurrentPosition(
          () => res('FIX'),
          (e) => res('ERR:' + e.code),
          { timeout: 15000 }))`,
    );
    check('real geolocation request succeeds after Allow', allowed === 'FIX', allowed);

    // The React driver now calls getCurrentPosition + watchPosition; wait for a fix.
    let stored = null;
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      stored = await evalInMain(`window.salati.getLocation()`);
      if (stored && stored.lat !== null) break;
    }
    check(
      'coordinates retrieved AFTER permission grant',
      stored && stored.lat !== null && stored.lon !== null && stored.updatedAt !== null,
      stored ? { consent: stored.consent, lat: stored.lat, lon: stored.lon, accuracy: stored.accuracyM } : null,
    );

    if (stored && stored.lat !== null) {
      // Reverse geocoding is asynchronous (up to 10 s HTTP timeout).
      let cityStored = null;
      for (let i = 0; i < 12; i++) {
        await sleep(1500);
        cityStored = await evalInMain(`window.salati.getLocation().then(s => s.city)`);
        if (cityStored) break;
      }
      check(
        'reverse-geocoded city label stored',
        cityStored !== null && cityStored.length > 0,
        cityStored,
      );
    }

    // 5. Restore a clean state so the real first-launch experience is intact.
    await evalInMain(
      `(async () => {
        await window.salati.saveSettings({ locationEnabled: false });
        await window.salati.setLocationConsent('unset');
        await window.salati.clearLocation();
        return true;
      })()`,
    );
  } finally {
    child.kill();
    await sleep(500);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(failed.length === 0 ? '\nALL LOCATION E2E CHECKS PASSED' : `\n${failed.length} CHECK(S) FAILED`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('verify-location failed:', e.message);
  process.exit(2);
});
