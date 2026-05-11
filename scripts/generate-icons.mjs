import zlib from "zlib";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

function makePNG(size) {
  const bg   = [29, 78, 216];   // #1d4ed8 bright blue
  const dark = [3, 7, 18];      // near-black outside corners
  const white = [255, 255, 255];
  const radius = Math.round(size * 0.22);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;

  const raw = [];

  for (let y = 0; y < size; y++) {
    raw.push(0);
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;

      // Rounded corners
      let inRounded = true;
      const r = radius;
      const corners = [[r, r], [size-r-1, r], [r, size-r-1], [size-r-1, size-r-1]];
      for (const [cx, cy] of corners) {
        if (x <= cx && y <= cy && (x < cx - r || y < cy - r)) {
          const dx = x - cx, dy = y - cy;
          if (dx*dx + dy*dy > r*r) { inRounded = false; break; }
        }
      }

      if (!inRounded) { raw.push(...dark); continue; }

      // ── "P" letter ──────────────────────────────────────
      // Vertical bar
      const inBar = nx >= 0.27 && nx <= 0.42 && ny >= 0.13 && ny <= 0.76;

      // Bump: outer ellipse minus inner ellipse, right of bar, upper half
      const bCx = 0.42, bCy = 0.36;
      const dOuter = ((nx - bCx) / 0.25) ** 2 + ((ny - bCy) / 0.23) ** 2;
      const dInner = ((nx - bCx) / 0.12) ** 2 + ((ny - bCy) / 0.11) ** 2;
      const inBump = dOuter <= 1 && dInner > 1
                  && nx >= 0.42 && ny >= 0.13 && ny <= 0.59;

      // ── Truck + trailer (bottom strip) ──────────────────
      // Trailer (long box, left)
      const inTrailer = nx >= 0.09 && nx <= 0.54 && ny >= 0.81 && ny <= 0.91;

      // Cab body (shorter, right)
      const inCab = nx >= 0.57 && nx <= 0.87 && ny >= 0.81 && ny <= 0.91;

      // Cab slanted roof
      const roofTop = 0.81 - ((nx - 0.57) / (0.87 - 0.57)) * 0.11;
      const inRoof = nx >= 0.57 && nx <= 0.87 && ny >= roofTop && ny <= 0.81;

      // Wheels (3 circles)
      const wr = size * 0.048;
      const wy = size * 0.945;
      const inWheel =
        (x - size*0.21)**2 + (y - wy)**2 <= wr*wr ||
        (x - size*0.43)**2 + (y - wy)**2 <= wr*wr ||
        (x - size*0.72)**2 + (y - wy)**2 <= wr*wr;

      // Hitch between trailer and cab
      const inHitch = nx >= 0.54 && nx <= 0.57 && ny >= 0.85 && ny <= 0.89;

      if (inBar || inBump || inTrailer || inCab || inRoof || inWheel || inHitch) {
        raw.push(...white);
      } else {
        raw.push(...bg);
      }
    }
  }

  const idat = zlib.deflateSync(Buffer.from(raw), { level: 6 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const androidRes = path.join(__dirname, "../android/app/src/main/res");

const sizes = {
  "mipmap-mdpi":    48,
  "mipmap-hdpi":    72,
  "mipmap-xhdpi":   96,
  "mipmap-xxhdpi":  144,
  "mipmap-xxxhdpi": 192,
};

for (const [dir, size] of Object.entries(sizes)) {
  const png = makePNG(size);
  const p = path.join(androidRes, dir);
  fs.mkdirSync(p, { recursive: true });
  fs.writeFileSync(path.join(p, "ic_launcher.png"), png);
  fs.writeFileSync(path.join(p, "ic_launcher_round.png"), png);
  fs.writeFileSync(path.join(p, "ic_launcher_foreground.png"), png);
  console.log(`✅ ${dir} (${size}x${size})`);
}

console.log("\nDone! All Android icons replaced.");
