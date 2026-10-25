// Script: generates app icons (crescent on emerald) as PNGs without any
// image dependency — pure Node + zlib.
//
// Usage: node scripts/make-icons.js

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: none
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/** Crescent on a deep-navy rounded square with an emerald gradient moon. */
function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const rOuter = size * 0.375;
  const rInner = size * 0.315;
  const innerCx = size * 0.575;
  const innerCy = size * 0.44;

  const bgTop = [12, 26, 48];
  const bgBottom = [6, 13, 26];
  const moonA = [52, 211, 153];
  const moonB = [45, 212, 191];
  const star = [251, 191, 36];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Rounded-corner mask (radius = 18% of size, centered square body).
      const r = size * 0.22;
      const dx = Math.max(r - x, x - (size - r), 0);
      const dy = Math.max(r - y, y - (size - r), 0);
      const cornerDist = Math.sqrt(dx * dx + dy * dy);
      const inRounded = cornerDist <= r;

      let rgb = null;
      if (inRounded) {
        // Background gradient
        const gk = y / size;
        rgb = [
          Math.round(bgTop[0] + (bgBottom[0] - bgTop[0]) * gk),
          Math.round(bgTop[1] + (bgBottom[1] - bgTop[1]) * gk),
          Math.round(bgTop[2] + (bgBottom[2] - bgTop[2]) * gk),
        ];

        const dOuter = Math.hypot(x - c, y - c);
        const dInner = Math.hypot(x - innerCx, y - innerCy);
        if (dOuter <= rOuter && dInner >= rInner) {
          // Moon with slight gradient
          const mk = dOuter / rOuter;
          rgb = [
            Math.round(moonA[0] + (moonB[0] - moonA[0]) * mk),
            Math.round(moonA[1] + (moonB[1] - moonA[1]) * mk),
            Math.round(moonA[2] + (moonB[2] - moonA[2]) * mk),
          ];
        }
        // Two small stars (right of the crescent)
        const s1 = Math.hypot(x - size * 0.72, y - size * 0.28);
        const s2 = Math.hypot(x - size * 0.80, y - size * 0.40);
        if (s1 <= size * 0.045 || s2 <= size * 0.03) {
          rgb = star;
        }
      }

      if (rgb) {
        rgba[i] = rgb[0];
        rgba[i + 1] = rgb[1];
        rgba[i + 2] = rgb[2];
        rgba[i + 3] = 255;
      }
    }
  }
  return encodePng(size, size, rgba);
}

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'build');
fs.mkdirSync(outDir, { recursive: true });

for (const size of [64, 256, 512]) {
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), drawIcon(size));
}

// electron-builder icon + tray-friendly file
fs.writeFileSync(path.join(outDir, 'icon.png'), drawIcon(256));
console.log('Icons written to build/');
