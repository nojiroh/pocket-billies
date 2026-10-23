// Studio track ST-3: a PNG as RGBA bytes in Node (no browser, no packages), for the tests that compare pictures.
// Reads 8-bit, non-interlaced PNGs: grey, grey + alpha, RGB, RGBA and palette (with tRNS), which is what Pillow and
// the Studio write. Studio plan Phase 5: writes RGBA PNGs too (tools/bake-kit-billies.mjs).
import { readFileSync } from 'node:fs';
import { crc32, deflateSync, inflateSync } from 'node:zlib';

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** the PNG at `path` as { width, height, data } (RGBA bytes) */
export function readPng(path) {
  const b = readFileSync(path);
  let pos = 8,
    width = 0,
    height = 0,
    depth = 0,
    type = 0,
    laced = 0,
    palette = null,
    trns = null;
  const idat = [];
  while (pos < b.length) {
    const len = b.readUInt32BE(pos),
      kind = b.toString('latin1', pos + 4, pos + 8),
      body = b.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      type = body[9];
      laced = body[12];
    } else if (kind === 'PLTE') palette = body;
    else if (kind === 'tRNS') trns = body;
    else if (kind === 'IDAT') idat.push(body);
    else if (kind === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || laced || !(type in CHANNELS))
    throw new Error(`${path}: only 8-bit, non-interlaced PNGs are read here`);
  const ch = CHANNELS[type],
    stride = width * ch,
    raw = inflateSync(Buffer.concat(idat)),
    px = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)],
      row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)),
      o = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[o + x - ch] : 0,
        up = y ? px[o - stride + x] : 0,
        c = y && x >= ch ? px[o - stride + x - ch] : 0;
      let v = row[x];
      if (f === 1) v += a;
      else if (f === 2) v += up;
      else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) {
        const p = a + up - c,
          pa = Math.abs(p - a),
          pb = Math.abs(p - up),
          pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      }
      px[o + x] = v & 255;
    }
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const s = i * ch;
    if (type === 6) data.set(px.subarray(s, s + 4), i * 4);
    else if (type === 2) data.set([px[s], px[s + 1], px[s + 2], 255], i * 4);
    else if (type === 0) data.set([px[s], px[s], px[s], 255], i * 4);
    else if (type === 4) data.set([px[s], px[s], px[s], px[s + 1]], i * 4);
    else {
      const k = px[s];
      data.set(
        [palette[k * 3], palette[k * 3 + 1], palette[k * 3 + 2], trns && k < trns.length ? trns[k] : 255],
        i * 4
      );
    }
  }
  return { width, height, data };
}

/** an RGBA picture ({ width, height, data }) as PNG bytes: 8-bit RGBA, each row with the filter that packs it best
 * (the smallest sum of bytes as signed values, as libpng picks), deflated at level 9 */
export function encodePng({ width, height, data }) {
  const stride = width * 4,
    raw = Buffer.alloc((stride + 1) * height),
    px = Buffer.from(data.buffer, data.byteOffset, data.byteLength),
    row = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const o = y * stride;
    let bestSum = Infinity;
    for (let f = 0; f < 5; f++) {
      let sum = 0;
      for (let x = 0; x < stride; x++) {
        const a = x >= 4 ? px[o + x - 4] : 0,
          up = y ? px[o - stride + x] : 0,
          c = y && x >= 4 ? px[o - stride + x - 4] : 0;
        let p = 0;
        if (f === 1) p = a;
        else if (f === 2) p = up;
        else if (f === 3) p = (a + up) >> 1;
        else if (f === 4) {
          const q = a + up - c,
            pa = Math.abs(q - a),
            pb = Math.abs(q - up),
            pc = Math.abs(q - c);
          p = pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
        }
        const v = (px[o + x] - p) & 255;
        row[x] = v;
        sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) {
        bestSum = sum;
        raw[y * (stride + 1)] = f;
        row.copy(raw, y * (stride + 1) + 1);
      }
    }
  }
  const chunk = (kind, body) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(kind, 4, 'latin1');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])) >>> 0, 0);
    return Buffer.concat([head, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
