// Kappi the Wise (people/kappi.json creature): paints the capybara's drawing sheet (game/art/next/placeholders/kappi.png)
// into the cells of its body-plan form (bodyPlans.json form `kappi`, quad, no tail, a talking face), then bakes it
// (tools/bake-placeholders.mjs) into game/art/next/billionaires/kappi.png and its rig in rigs-next.js.
//   node tools/paint-kappi.mjs                 paint, store and bake
//   node tools/paint-kappi.mjs --preview=dir   also write preview.png there: both views at rest and the three faces, x4
// The cells are drawn as they show on screen: the front view faces left, the back view faces right (no face).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { ROOT } from './data-files.mjs';
import { encodePng, readPng } from './test/png.mjs';
import { placeholderBones, placeholderCellSpecs, placeholderSheet } from '../game/js/logic/placeholder-art.js';
import { bakePlaceholders, placeholderData } from './bake-placeholders.mjs';

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/* warm browns, darker from behind */
const C = {
  ink: hex('#3b2414'),
  dark: hex('#6b4529'),
  fur: hex('#8c5e3b'),
  light: hex('#a8774c'),
  hi: hex('#c4925f'),
  belly: hex('#b08356'),
  nose: hex('#4a2c1a'),
  eye: hex('#1a100b'),
  glint: hex('#fff3e0'),
  inEar: hex('#5a3822'),
  mouth: hex('#3a1a12'),
  tongue: hex('#c4685a'),
  toe: hex('#4f3220'),
};
const shade = (c, k) => c.map(v => Math.max(0, Math.min(255, Math.round(v * k))));

function blank(w, h) {
  return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
}
function put(p, x, y, c) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= p.width || y >= p.height) return;
  const i = (y * p.width + x) * 4;
  p.data[i] = c[0];
  p.data[i + 1] = c[1];
  p.data[i + 2] = c[2];
  p.data[i + 3] = 255;
}
const filled = (p, x, y) => x >= 0 && y >= 0 && x < p.width && y < p.height && p.data[(y * p.width + x) * 4 + 3] > 0;

/** a shape inside the bone's box (x0, y0, w, h): fill(u, v) says whether a point (0..1 across, 0..1 down) is inside
 * and colour(u, v) its colour; then an outline round it */
function shape(p, x0, y0, w, h, inside, colour, ink = C.ink) {
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = inside((x + 0.5) / w, (y + 0.5) / h) ? 1 : 0;
  const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!m[y * w + x]) continue;
      const edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
      put(p, x0 + x, y0 + y, edge ? ink : colour((x + 0.5) / w, (y + 0.5) / h, x, y));
    }
}
/** fur: lit from the top left, darker underneath, short darker strokes scattered by a hash (no grid) */
const speck = (x, y, n) => ((x * 73856093) ^ (y * 19349663)) % n === 0;
const fur =
  (back, base = C.fur) =>
  (u, v, x, y) => {
    const lit = v < 0.3 && u < 0.75 ? C.light : v > 0.8 ? C.dark : base;
    const c =
      speck(x, y, 23) || speck(x + 1, y, 23) ? (v < 0.3 ? C.fur : C.dark) : speck(x, y, 41) && v < 0.5 ? C.hi : lit;
    return back ? shade(c, 0.85) : c;
  };

/* ---------- the parts: each paints into its cell, in its bone's box (bx, by, bw, bh) ---------- */
function body(p, bx, by, bw, bh, back) {
  /* a barrel, the rump higher than the shoulders (a capybara's back slopes down to the front) */
  shape(
    p,
    bx - 1,
    by - 2,
    bw + 2,
    bh + 3,
    (u, v) => {
      const top = 0.1 + 0.14 * (1 - u) - 0.06 * Math.sin(u * Math.PI),
        bot = 0.94 - 0.05 * Math.abs(u - 0.5);
      const ru = Math.min(u, 1 - u);
      return v > top + (ru < 0.12 ? (0.12 - ru) * 2.2 : 0) && v < bot - (ru < 0.1 ? (0.1 - ru) * 2.5 : 0);
    },
    fur(back)
  );
}
function leg(p, bx, by, bw, bh, back, far) {
  /* short and stubby: the upper part hides under the body; a dark foot with toes */
  const top = Math.round(bh * 0.35);
  shape(
    p,
    bx,
    by + top,
    bw,
    bh - top,
    (u, v) => Math.abs(u - 0.5) < 0.46 - (v > 0.85 ? 0.04 : 0),
    (u, v) => {
      const c = v > 0.82 ? C.toe : u < 0.35 ? C.fur : C.dark;
      return far || back ? shade(c, 0.78) : c;
    }
  );
  if (!back) for (const tx of [0.3, 0.62]) put(p, bx + Math.round(bw * tx), by + bh - 1, C.ink);
}
function head(p, bx, by, bw, bh, back, face) {
  /* a big blunt box of a head: the snout to the front (left), flat on top, the jaw deep; small eyes high up */
  shape(
    p,
    bx - 1,
    by + 1,
    bw + 2,
    bh - 1,
    (u, v) => {
      const r = 0.2,
        cu = Math.max(0, Math.max(r - u, u - (1 - r))) / r,
        cv = Math.max(0, Math.max(r - v, v - (1 - r))) / r;
      if (cu * cu + cv * cv > 1) return false;
      /* the snout's front slopes back a little at the top */
      if (u < 0.12 * (1 - v)) return false;
      return true;
    },
    (u, v, x, y) => {
      if (back) return fur(true)(u, v, x, y);
      if ((u - 0.12) ** 2 / 0.04 + (v - 0.55) ** 2 / 0.05 < 1) return C.light; /* the muzzle */
      if (v > 0.8) return C.dark;
      return fur(false)(u, v, x, y);
    }
  );
  if (back) return;
  const X = u => bx + Math.round(u * bw),
    Y = v => by + Math.round(v * bh);
  /* the nostril, and the line of the mouth under the snout */
  put(p, X(0.08), Y(0.42), C.nose);
  put(p, X(0.13), Y(0.42), C.nose);
  put(p, X(0.08), Y(0.46), C.nose);
  /* the eye: small, high and toward the back, with a heavy brow above it */
  const ex = X(0.58),
    ey = Y(0.3);
  for (let d = -1; d <= 2; d++) put(p, ex + d, ey - 2, C.dark);
  if (face === 'blink') for (let d = -1; d <= 1; d++) put(p, ex + d, ey, C.eye);
  else {
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) put(p, ex + dx, ey + dy, C.eye);
    put(p, ex, ey, C.glint);
  }
  const my = Y(0.7);
  if (face === 'talk') {
    for (let x = X(0.06); x <= X(0.28); x++) put(p, x, my, C.ink);
    for (let x = X(0.08); x <= X(0.26); x++) {
      put(p, x, my + 1, C.mouth);
      put(p, x, my + 2, x > X(0.14) ? C.tongue : C.mouth);
    }
    for (let x = X(0.08); x <= X(0.26); x++) put(p, x, my + 3, C.ink);
  } else for (let x = X(0.06); x <= X(0.24); x++) put(p, x, my, C.ink);
  /* the cheek: a soft lighter patch under the eye */
  put(p, X(0.5), Y(0.55), C.hi);
  put(p, X(0.54), Y(0.58), C.hi);
}
function ear(p, bx, by, bw, bh, back) {
  shape(
    p,
    bx,
    by,
    bw,
    bh,
    (u, v) => (u - 0.5) ** 2 / 0.25 + (v - 0.55) ** 2 / 0.2 < 1,
    (u, v) => (back ? shade(C.dark, 0.85) : u > 0.3 && u < 0.7 && v > 0.4 ? C.inEar : C.dark)
  );
}

/** every cell of the form, both views */
export function paintKappi(P, form) {
  const bones = Object.fromEntries(placeholderBones(P, form).map(b => [b.n, b])),
    cells = { front: {}, back: {} };
  for (const view of ['front', 'back'])
    for (const c of placeholderCellSpecs(P, form)) {
      if (view === 'back' && c.frame !== 'main') continue;
      const b = bones[c.bone],
        back = view === 'back',
        p = blank(c.w, c.h),
        [bw, bh] = b.size;
      /* the bone's box sits where the placeholder painter puts it: its pivot on the cell's pivot */
      const px = back ? c.pxb : c.px,
        bx = Math.round(px - (back ? 1 - b.pv[0] : b.pv[0]) * bw),
        by = Math.round(c.py - b.pv[1] * bh);
      /* the back cells are painted facing left too, then mirrored (they show facing right) */
      const q = back ? blank(c.w, c.h) : p,
        qx = back ? c.w - bx - bw : bx;
      if (b.n === 'body') body(q, qx, by, bw, bh, back);
      else if (b.n.startsWith('leg')) leg(q, qx, by, bw, bh, back, b.n.endsWith('F') && b.n.startsWith('legB'));
      else if (b.n === 'head') head(q, qx, by, bw, bh, back, c.frame);
      else if (b.n.startsWith('ear')) ear(q, qx, by, bw, bh, back);
      /* a capybara's tail is a stub: a nub on the rump, where the bone joins */
      else if (b.n === 'tail') ear(q, qx, by, Math.max(4, Math.round(bw / 2)), bh, back);
      if (back)
        for (let y = 0; y < c.h; y++)
          for (let x = 0; x < c.w; x++) {
            const i = (y * c.w + x) * 4,
              j = (y * c.w + (c.w - 1 - x)) * 4;
            p.data.set(q.data.subarray(i, i + 4), j);
          }
      cells[view][c.key] = p;
    }
  return cells;
}

/** both views at rest and the three faces, from the baked sheet and rig, scaled up (a check by eye) */
function preview(rig, sheet, k = 4) {
  const W = 128 * 2 + 3 * 40,
    H = 128,
    out = blank(W, H);
  for (let i = 0; i < out.data.length; i += 4) out.data.set([62, 58, 70, 255], i);
  const draw = (img, sx, sy, sw, sh, dx, dy, flip) => {
    for (let y = 0; y < sh; y++)
      for (let x = 0; x < sw; x++) {
        const s = ((sy + y) * sheet.width + sx + x) * 4;
        if (!sheet.data[s + 3]) continue;
        const X = flip ? dx - x - 1 : dx + x;
        put(out, X, dy + y, [sheet.data[s], sheet.data[s + 1], sheet.data[s + 2]]);
      }
  };
  ['front', 'back'].forEach((v, vi) => {
    const R = rig[v],
      pos = { root: [R.cx, R.base] };
    const list = [];
    for (const b of R.bones) {
      const pp = pos[b.par || 'root'];
      pos[b.n] = [pp[0] + b.at[0] * (v === 'back' ? -1 : 1), pp[1] + b.at[1]];
      if (b.i >= 0) list.push([v === 'back' ? b.zb : b.z, b]);
    }
    list.sort((a, b) => a[0] - b[0]);
    for (const [, b] of list) {
      const im = R.imgs[b.i],
        f = im.f.idle || im.f.main || Object.values(im.f)[0],
        [x, y] = pos[b.n];
      if (v === 'back') draw(null, f[0], f[1], f[2], f[3], vi * 128 + x - im.ox, y + im.oy, true);
      else draw(null, f[0], f[1], f[2], f[3], vi * 128 + x + im.ox, y + im.oy, false);
    }
  });
  const hb = rig.front.bones.find(b => b.n === 'head'),
    hi = rig.front.imgs[hb.i];
  ['idle', 'blink', 'talk'].forEach((fn, i) => {
    const f = hi.f[fn];
    if (f) draw(null, f[0], f[1], f[2], f[3], 256 + i * 40 + 4, 40, false);
  });
  const big = blank(W * k, H * k);
  for (let y = 0; y < H * k; y++)
    for (let x = 0; x < W * k; x++) {
      const s = (Math.floor(y / k) * W + Math.floor(x / k)) * 4;
      big.data.set(out.data.subarray(s, s + 4), (y * W * k + x) * 4);
    }
  return big;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { P } = placeholderData(),
    form = P.forms.find(f => f.name === 'kappi');
  if (!form) throw new Error('no form kappi in bodyPlans.json');
  const cells = paintKappi(P, form),
    dir = join(ROOT, 'game', 'art', 'next', 'placeholders');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'kappi.png'), encodePng(placeholderSheet(P, [form], { kappi: cells })));
  bakePlaceholders({ only: ['kappi'] });
  const pv = process.argv.find(a => a.startsWith('--preview='));
  if (pv) {
    const box = { window: {} };
    vm.runInNewContext(readFileSync(join(ROOT, 'game', 'art', 'next', 'rigs-next.js'), 'utf8'), box);
    const sheet = readPng(join(ROOT, 'game', 'art', 'next', 'billionaires', 'kappi.png')),
      out = pv.slice(10);
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'preview.png'), encodePng(preview(box.window.RIGS_NEXT.kappi, sheet)));
    console.log(`wrote ${join(out, 'preview.png')}`);
  }
}
