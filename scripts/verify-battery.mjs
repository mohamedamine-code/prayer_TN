// Full verification battery for the animated edge-docked widget.
// Real input: Win32 cursor drags (drag-helper.ps1) between edges; chevron
// clicks + state reads via CDP Input.dispatchMouseEvent (trusted input).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const PORT = Number(process.env.CDP_PORT ?? '9263');
const TITLE = process.env.CDP_TARGET_TITLE ?? 'Salati Widget';
const CYCLES = Number(process.env.CYCLES ?? '5');
/* Real work area from the OS (dpr=1 on this machine): must match the Electron
   workArea the app uses, so hardcoding invites off-by-taskbar drift. */
const waRaw = execFileSync('powershell', ['-NoProfile', '-Command',
  'Add-Type -AssemblyName System.Windows.Forms; $w=[System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea; "$($w.X),$($w.Y),$($w.Width),$($w.Height)"'], { encoding: 'utf8' }).trim();
const [wax, way, waw, wah] = waRaw.split(',').map(Number);
const WA = { x: wax, y: way, w: waw, h: wah };
const CONFIG = path.join(os.homedir(), 'AppData', 'Roaming', 'Salati Tunisia', 'config.json');
const ICON_W = 40;
const ICON_H = 56;

let failures = 0;
let passes = 0;
function ok(name, cond, info = '') {
  if (cond) { passes++; console.log(`  PASS ${name}`); }
  else { failures++; console.log(`  FAIL ${name}  ${info}`); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
}

function jsonGet(path_) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: PORT, path: path_ }, (r) => {
      let b = '';
      r.on('data', (c) => (b += c));
      r.on('end', () => res(JSON.parse(b)));
    }).on('error', rej);
  });
}

// --- minimal CDP client (proven framing) ---
function maskKey(data) {
  const masked = Buffer.from(data);
  const key = Buffer.from([123, 45, 67, 89]);
  for (let i = 0; i < masked.length; i++) masked[i] ^= key[i % 4];
  return masked;
}
function frame(payload) {
  const data = Buffer.from(payload, 'utf8');
  const key = Buffer.from([123, 45, 67, 89]);
  let header;
  if (data.length < 126) header = Buffer.from([0x81, 0x80 | data.length]);
  else if (data.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(data.length, 2);
  }
  return Buffer.concat([header, key, maskKey(data)]);
}
function parseFrames(buf) {
  const frames = [];
  let off = 0;
  while (buf.length - off >= 2) {
    if ((buf[off] & 0x0f) !== 1) break;
    let len = buf[off + 1] & 0x7f;
    let hdr = 2;
    if (len === 126) { len = buf.readUInt16BE(off + 2); hdr = 4; }
    frames.push(buf.slice(off + hdr, off + hdr + len).toString('utf8'));
    off += hdr + len;
  }
  return { frames, rest: buf.slice(off) };
}

async function connect() {
  const targets = await jsonGet('/json/list');
  const page = targets.find((t) => t.type === 'page' && t.title.includes(TITLE));
  if (!page) throw new Error('widget target not found');
  const ws = new URL(page.webSocketDebuggerUrl);
  const sock = await new Promise((resolve, reject) => {
    const req = http.request({
      host: ws.hostname, port: ws.port || PORT, path: ws.pathname + ws.search,
      headers: {
        Host: ws.host, Upgrade: 'websocket', Connection: 'Upgrade',
        'Sec-WebSocket-Key': Buffer.from('0123456789abcdef12').toString('base64'),
        'Sec-WebSocket-Version': '13',
      },
    });
    req.on('upgrade', (_r, s) => resolve(s));
    req.on('error', reject);
    req.end();
  });
  const state = { buf: Buffer.alloc(0), pending: new Map(), nextId: 1 };
  sock.on('data', (chunk) => {
    state.buf = Buffer.concat([state.buf, chunk]);
    const { frames, rest } = parseFrames(state.buf);
    state.buf = rest;
    for (const f of frames) {
      const msg = JSON.parse(f);
      if (msg.id && state.pending.has(msg.id)) {
        state.pending.get(msg.id)(msg);
        state.pending.delete(msg.id);
      }
    }
  });
  state.send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = state.nextId++;
      state.pending.set(id, resolve);
      sock.write(frame(JSON.stringify({ id, method, params })));
    });
  state.close = () => sock.end();
  return state;
}

async function evalJs(cdp, expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 200));
  return r.result?.result?.value;
}

async function windowState(cdp) {
  return JSON.parse(await evalJs(cdp, `JSON.stringify({
    sx: window.screenX, sy: window.screenY, w: innerWidth, h: innerHeight,
    mainCls: document.querySelector('.mini-main')?.className ?? null,
    mainVis: document.querySelector('.mini-main') ? getComputedStyle(document.querySelector('.mini-main')).visibility : null,
    mainOp: document.querySelector('.mini-main') ? getComputedStyle(document.querySelector('.mini-main')).opacity : null,
    tabRect: (() => { const b = document.querySelector('.dock-tab'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: window.screenX + r.x, y: window.screenY + r.y }; })(),
  })`));
}

async function chevClick(cdp) {
  const { x, y } = JSON.parse(await evalJs(cdp, `(() => { const b = document.querySelector('.dock-chev'); const r = b.getBoundingClientRect(); return JSON.stringify({x: r.x + r.width/2, y: r.y + r.height/2}); })()`));
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await sleep(60);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await sleep(60);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

/** Expect the widget to be expanded and fully visible; window rect per edge. */
function assertExpanded(slot, edge, st, cfg) {
  const sizeExp = edge === 'left' || edge === 'right' ? { w: 360, h: 160 } : { w: 320, h: 216 };
  ok(`${slot} window size ${st.w}x${st.h}`, st.w === sizeExp.w && st.h === sizeExp.h, JSON.stringify(st));
  ok(`${slot} panel visible`, st.mainVis === 'visible' && st.mainOp === '1', `vis=${st.mainVis} op=${st.mainOp} cls=${st.mainCls}`);
  ok(`${slot} panel free of anim class`, st.mainCls === 'mini-main', st.mainCls);
  ok(`${slot} config expanded=true`, cfg.miniDock.expanded === true && cfg.miniDock.edge === edge, JSON.stringify(cfg.miniDock));
  const wantX = edge === 'right'
    ? st.sx + st.w - ICON_W / 2
    : edge === 'left' ? st.sx + ICON_W / 2 : cfg.miniDock.along;
  const wantY = edge === 'bottom'
    ? st.sy + st.h - ICON_H / 2
    : edge === 'top' ? st.sy + ICON_H / 2 : cfg.miniDock.along;
  ok(`${slot} tab at docked-edge spot`, st.tabRect && Math.abs(st.tabRect.x + 20 - wantX) <= 1 && Math.abs(st.tabRect.y + 28 - wantY) <= 1,
    `got ${st.tabRect && `${Math.round(st.tabRect.x)},${Math.round(st.tabRect.y)}`} want ${Math.round(wantX)},${Math.round(wantY)}`);
}

function assertCollapsed(slot, edge, st, cfg) {
  ok(`${slot} window size ${st.w}x${st.h}`, st.w === ICON_W && st.h === ICON_H, JSON.stringify(st));
  ok(`${slot} panel hidden`, st.mainVis === 'hidden', `vis=${st.mainVis} cls=${st.mainCls}`);
  ok(`${slot} config expanded=false`, cfg.miniDock.expanded === false && cfg.miniDock.edge === edge, JSON.stringify(cfg.miniDock));
  const wantX = edge === 'right'
    ? st.sx + st.w - ICON_W / 2
    : edge === 'left' ? st.sx + ICON_W / 2 : cfg.miniDock.along;
  const wantY = edge === 'bottom'
    ? st.sy + st.h - ICON_H / 2
    : edge === 'top' ? st.sy + ICON_H / 2 : cfg.miniDock.along;
  ok(`${slot} tab at docked-edge spot`, st.tabRect && Math.abs(st.tabRect.x + 20 - wantX) <= 1 && Math.abs(st.tabRect.y + 28 - wantY) <= 1,
    `got ${st.tabRect && `${Math.round(st.tabRect.x)},${Math.round(st.tabRect.y)}`} want ${Math.round(wantX)},${Math.round(wantY)}`);
}

/* Screen-space flush position of the collapsed tab on `edge` (dpr=1: CSS px). */
function dockRectFor(edge, along) {
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  if (edge === 'right') {
    const a = clamp(along, WA.y + ICON_H / 2 + 2, WA.y + WA.h - ICON_H / 2 - 2);
    return { x: WA.x + WA.w - ICON_W, y: a - ICON_H / 2 };
  }
  if (edge === 'left') {
    const a = clamp(along, WA.y + ICON_H / 2 + 2, WA.y + WA.h - ICON_H / 2 - 2);
    return { x: WA.x, y: a - ICON_H / 2 };
  }
  if (edge === 'top') {
    const a = clamp(along, WA.x + ICON_W / 2 + 2, WA.x + WA.w - ICON_W / 2 - 2);
    return { x: a - ICON_W / 2, y: WA.y };
  }
  const a = clamp(along, WA.x + ICON_W / 2 + 2, WA.x + WA.w - ICON_W / 2 - 2);
  return { x: a - ICON_W / 2, y: WA.y + WA.h - ICON_H };
}

function moPoint(rect) {
  return { x: rect.x + ICON_W / 2, y: rect.y + 13 };
}

function partnerPid() {
  const out = execFileSync('powershell', ['-NoProfile', '-Command',
    'Get-Process | Where-Object { $_.Name -like "*Salati*" } | ForEach-Object { $_.Id }'], { encoding: 'utf8' });
  return out;
}

async function dragToEdge(cdp, tabTopLeft, targetEdge) {
  const t = {
    left: { x: WA.x + ICON_W / 2, y: WA.h * 0.45 },
    right: { x: WA.x + WA.w - ICON_W / 2, y: WA.h * 0.55 },
    top: { x: WA.w * 0.4, y: WA.y + ICON_H / 2 },
    bottom: { x: WA.w * 0.6, y: WA.y + WA.h - ICON_H / 2 },
  }[targetEdge];
  const pidList = partnerPid().split(/\r?\n/).filter(Boolean).map(Number);
  let dragged = false;
  for (const pid of pidList) {
    try {
      const r = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass',
        '-File', 'scripts/drag-helper.ps1', '-Action', 'drag',
        '-PID_OF_APP', String(pid), '-X', String(Math.round(tabTopLeft.x)), '-Y', String(Math.round(tabTopLeft.y)),
        '-Dx', String(Math.round(t.x - tabTopLeft.x - ICON_W / 2)), '-Dy', String(Math.round(t.y - tabTopLeft.y - 13)),
        '-CssW', String(ICON_W), '-CssH', String(ICON_H)], { encoding: 'utf8' });
      if (!r.includes('NOTFOUND')) { dragged = true; break; }
    } catch {
      // wrong pid (renderer/gpu child) or window not found there; try next
    }
  }
  if (!dragged) throw new Error('drag helper could not find widget window');
  await sleep(1200); // settle timer 220ms + tween
}

async function edgeBattery(cdp, edge, cycles) {
  const stStart = await windowState(cdp);
  const cfgStart = readConfig();
  if (cfgStart.miniDock.expanded) {
    await chevClick(cdp);
    await sleep(950);
  }
  const stPre = await windowState(cdp);
  const cfgPre = readConfig();
  if (!cfgStart.miniDock.expanded && cfgPre.miniDock.expanded) throw new Error('could not reach collapsed state');
  assertCollapsed('pre-state', cfgPre.miniDock.edge, stPre, cfgPre);

  if (cfgPre.miniDock.edge !== edge) {
    await dragToEdge(cdp, { x: stPre.tabRect.x, y: stPre.tabRect.y }, edge);
    const cfg1 = readConfig();
    ok(`${edge}: dragged to edge`, cfg1.miniDock.edge === edge, JSON.stringify(cfg1.miniDock));
    const st1 = await windowState(cdp);
    const exp = dockRectFor(edge, cfg1.miniDock.along);
    ok(`${edge}: snapped flush`, Math.abs(st1.sx - exp.x) <= 1 && Math.abs(st1.sy - exp.y) <= 1, `got ${st1.sx},${st1.sy} want ${exp.x},${exp.y}`);
    assertCollapsed(`${edge} after drag`, edge, st1, cfg1);
  }

  for (let i = 1; i <= cycles; i++) {
    await chevClick(cdp);
    await sleep(800);
    const stEx = await windowState(cdp);
    let cfgEx = readConfig();
    assertExpanded(`${edge} cycle${i} expand`, edge, stEx, cfgEx);

    await chevClick(cdp);
    await sleep(900);
    const stCo = await windowState(cdp);
    cfgEx = readConfig();
    assertCollapsed(`${edge} cycle${i} collapse`, edge, stCo, cfgEx);
  }

  // Burst: 6 rapid clicks ~120ms apart -> must end consistent (panel vs window).
  for (let i = 0; i < 6; i++) { await chevClick(cdp); await sleep(120); }
  await sleep(1000);
  const stB = await windowState(cdp);
  const cfgB = readConfig();
  const expanded = cfgB.miniDock.expanded === true;
  const consistent = expanded ? (stB.w > 40 && stB.mainVis === 'visible' && stB.mainOp === '1') : (stB.w === ICON_W && stB.mainVis === 'hidden');
  ok(`${edge} burst consistent (6 clicks)`, consistent, `expanded=${expanded} ${JSON.stringify(stB)}`);
  if (expanded) {
    // restore to collapsed for the next edge group
    await chevClick(cdp);
    await sleep(900);
    const stRe = await windowState(cdp);
    assertCollapsed(`${edge} after burst restore`, edge, stRe, readConfig());
  }
}

async function main() {
  const cdp = await connect();
  const cfg = readConfig();
  if (!cfg.settings.showFloatingWidget) throw new Error('showFloatingWidget=false, refusing to run');

  for (const edge of ['left', 'top', 'bottom', 'right']) {
    console.log(`\n== EDGE ${edge} (${CYCLES} cycles) ==`);
    await edgeBattery(cdp, edge, CYCLES);
  }

  await cdp.close();
  console.log(`\nRESULT passes=${passes} failures=${failures}`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1); });

