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
  const bg = [30, 58, 138]; // #1e3a8a blue
  const white = [255, 255, 255];
  const radius = Math.round(size * 0.22); // rounded corners

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

      // Rounded corners — pixels outside get dark background
      let inRounded = true;
      const r = radius;
      const checks = [[r, r], [size - r - 1, r], [r, size - r - 1], [size - r - 1, size - r - 1]];
      for (const [cx, cy] of checks) {
        if (x <= cx && y <= cy && (x < cx - r || y < cy - r)) {
          const dx = x - cx, dy = y - cy;
          if (dx * dx + dy * dy > r * r) { inRounded = false; break; }
        }
      }

      if (!inRounded) {
        raw.push(3, 7, 18);
        continue;
      }

      // Truck icon:
      // Body (cargo box): left 15%–67%, top 35%–68%
      const inBody = nx >= 0.15 && nx <= 0.67 && ny >= 0.34 && ny <= 0.68;

      // Cab: right 67%–88%, top 34%–68% with slanted front
      // slant: top goes from (0.67, 0.34) to (0.88, 0.46), bottom flat at 0.68
      const cabSlant = 0.34 + ((nx - 0.67) / (0.88 - 0.67)) * (0.46 - 0.34);
      const inCab = nx >= 0.67 && nx <= 0.88 && ny >= cabSlant && ny <= 0.68;

      // Cab window: inside cab, top portion
      const winSlant = 0.36 + ((nx - 0.685) / (0.84 - 0.685)) * (0.455 - 0.36);
      const inWindow = nx >= 0.685 && nx <= 0.84 && ny >= winSlant && ny <= 0.56;

      // Rear wheels: two circles
      const rw = size * 0.09;
      const ry = size * 0.73;
      const rx1 = size * 0.28;
      const rx2 = size * 0.54;
      const d1 = (x - rx1) ** 2 + (y - ry) ** 2;
      const d2 = (x - rx2) ** 2 + (y - ry) ** 2;
      const inWheel = d1 <= rw * rw || d2 <= rw * rw;

      // Wheel hubs (inner circles, dark)
      const hw = size * 0.04;
      const inHub = (x - rx1) ** 2 + (y - ry) ** 2 <= hw * hw ||
                    (x - rx2) ** 2 + (y - ry) ** 2 <= hw * hw;

      // "P" letter on body: left bar + arc
      const pLeft = nx >= 0.22 && nx <= 0.32 && ny >= 0.38 && ny <= 0.64;
      const pArcCx = 0.38, pArcCy = 0.47, pArcRx = 0.09, pArcRy = 0.10;
      const pArcOuter = ((nx - pArcCx) / pArcRx) ** 2 + ((ny - pArcCy) / pArcRy) ** 2 <= 1;
      const pArcInner = ((nx - pArcCx) / (pArcRx * 0.45)) ** 2 + ((ny - pArcCy) / (pArcRy * 0.45)) ** 2 <= 1;
      const pArc = pArcOuter && !pArcInner && ny >= 0.38 && ny <= 0.56 && nx >= 0.28;

      if (inHub) {
        raw.push(...bg);
      } else if (inWheel) {
        raw.push(15, 23, 42); // dark wheel
      } else if (inWindow) {
        raw.push(147, 197, 253); // light blue window
      } else if (inBody || inCab) {
        if (pLeft || pArc) {
          raw.push(255, 255, 255); // white P
        } else {
          raw.push(...white);
        }
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
