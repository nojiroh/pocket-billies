// Studio track ST-3: a PNG as RGBA bytes in Node (no browser, no packages), for the tests that compare pictures.
// Reads 8-bit, non-interlaced PNGs: grey, grey + alpha, RGB, RGBA and palette (with tRNS), which is what Pillow and
// the Studio write.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

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
