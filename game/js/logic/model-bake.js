// @ts-check
'use strict';
/* ================= MODEL BAKE (studio track ST-7: Model mode import) =================
   Pictures from a mesh model of format v2 (logic/model-mesh.js), worked out in plain numbers:
   - modelBakePicture: the prop's picture (the stand-in with 3D props off, and the far view), drawn as RP-1's
     tools/build-props-island.py bake draws a recipe: seen from the front and a little above (depth shows as half its
     height), three tones of light from the upper left, an ink outline, 32 px to the metre, the base point at -ox, -oy.
   - modelBakeTexture: "Bake to 32 px/m" for a model coloured from a palette texture (KayKit, Kenney): every face gets
     its own place on a new texture at 32 px to the metre (faces grouped into charts by the way they face: six
     directions, joined where they share an edge, each laid flat on its plane), filled with the face's colour snapped
     to the game's palette and drawn with the building sheet's texture for its material (planks, stone, metal seams,
     moss...) through the buildings' five-tone ramp (buildings.js rampC), so the model looks like the airship.
   Logic only: no DOM, runs in Node (tools/test/model-import.test.mjs). */
/** @import { Pixels } from './model-mesh.js' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { base64Decode } from './model-gltf.js';
import { MODEL_OWN_CELL, MODEL_PPM, MODEL_UV_Q, modelAtlas, modelPackPart } from './model-mesh.js';
/* eslint-disable no-func-assign */
expose({
  BAKE_LIGHT: [() => BAKE_LIGHT],
  MODEL_BAKE_CELLS: [() => MODEL_BAKE_CELLS],
  MODEL_BAKE_TILT: [() => MODEL_BAKE_TILT],
  MODEL_INK: [() => MODEL_INK],
  // @ts-expect-error -- replaced on purpose
  modelBakeMaterial: [() => modelBakeMaterial, v => (modelBakeMaterial = v)],
  // @ts-expect-error -- replaced on purpose
  modelBakePicture: [() => modelBakePicture, v => (modelBakePicture = v)],
  // @ts-expect-error -- replaced on purpose
  modelBakeTexture: [() => modelBakeTexture, v => (modelBakeTexture = v)],
  // @ts-expect-error -- replaced on purpose
  modelRamp: [() => modelRamp, v => (modelRamp = v)],
  // @ts-expect-error -- replaced on purpose
  modelSnapColour: [() => modelSnapColour, v => (modelSnapColour = v)],
  // @ts-expect-error -- replaced on purpose
  modelVertices: [() => modelVertices, v => (modelVertices = v)],
  // @ts-expect-error -- replaced on purpose
  texAt: [() => texAt, v => (texAt = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the outline's colour (build-props-island.py INK) */
export const MODEL_INK = [42, 30, 52];
/** how much of the depth shows as height in a baked picture (build-props-island.py TILT: about 30 degrees down) */
export const MODEL_BAKE_TILT = 0.5;
/** the bake's light, up as y, the front at -z (build-props-island.py LIGHT, turned to the game's axes) */
export const BAKE_LIGHT = (() => {
  const v = [-0.45, 0.7, -0.55],
    l = Math.hypot(v[0], v[1], v[2]);
  return v.map(q => q / l);
})();

/**
 * A model's parts back as vertex rows ([x, y, z, nx, ny, nz, u, v, flat, r, g, b], as model-mesh.js builds them) and
 * triangles; each part's other fields kept.
 * @param {any} rec
 */
export function modelVertices(rec) {
  return (rec.parts || []).map((/** @type {any} */ P) => {
    const b = base64Decode(P.data || ''),
      d = new DataView(b.buffer, b.byteOffset, b.byteLength),
      V = [],
      I = [];
    for (let i = 0; i < P.n; i++) {
      const o = i * 24;
      V.push([
        d.getInt16(o, true) / 256,
        d.getInt16(o + 2, true) / 256,
        d.getInt16(o + 4, true) / 256,
        d.getInt8(o + 8) / 127,
        d.getInt8(o + 9) / 127,
        d.getInt8(o + 10) / 127,
        d.getInt16(o + 12, true) / MODEL_UV_Q,
        d.getInt16(o + 14, true) / MODEL_UV_Q,
        b[o + 16] === MODEL_OWN_CELL ? b[o + 18] : 1,
        b[o + 20],
        b[o + 21],
        b[o + 22],
      ]);
    }
    for (let t = 0; t < P.ni; t++) I.push(d.getUint16(P.n * 24 + t * 2, true));
    const { data: _d, n: _n, ni: _ni, ...meta } = P;
    return { meta, V, I };
  });
}
/** a texture's colour at u, v (0-1, repeating), nearest texel */
export function texAt(P, u, v) {
  const x = Math.min(P.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * P.width))),
    y = Math.min(P.height - 1, Math.max(0, Math.floor((v - Math.floor(v)) * P.height))),
    o = (y * P.width + x) * 4;
  return [P.data[o], P.data[o + 1], P.data[o + 2], P.data[o + 3]];
}

/**
 * The prop's picture: { pixels, ox, oy } (the base point, x 0 and the ground, at pixel -ox, -oy).
 * With o.yaw (radians) the model is turned first (Model mode's pick view); with o.pick, `uv` holds each pixel's
 * texture coordinates (NaN where nothing textured is drawn), for finding a texel by clicking the model.
 * @param {any} rec
 * @param {Pixels | null} tex
 * @param {number} [ppm]
 * @param {{ yaw?: number, pick?: boolean }} [o]
 */
export function modelBakePicture(rec, tex, ppm = MODEL_PPM, o = {}) {
  const tris = [],
    cy = Math.cos(o.yaw || 0),
    sy0 = Math.sin(o.yaw || 0),
    turn = (/** @type {number[]} */ v) =>
      o.yaw ? [v[0] * cy + v[2] * sy0, v[1], -v[0] * sy0 + v[2] * cy, ...v.slice(3)] : v;
  for (const q of modelVertices(rec))
    for (let t = 0; t < q.I.length; t += 3)
      tris.push([turn(q.V[q.I[t]]), turn(q.V[q.I[t + 1]]), turn(q.V[q.I[t + 2]])]);
  const sx = (/** @type {number[]} */ v) => v[0],
    sy = (/** @type {number[]} */ v) => v[1] + v[2] * MODEL_BAKE_TILT;
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (const T of tris)
    for (const v of T) {
      x0 = Math.min(x0, sx(v));
      x1 = Math.max(x1, sx(v));
      y0 = Math.min(y0, sy(v));
      y1 = Math.max(y1, sy(v));
    }
  if (!tris.length) return { pixels: { width: 1, height: 1, data: new Uint8ClampedArray(4) }, ox: 0, oy: 0, uv: null };
  const W = Math.ceil((x1 - x0) * ppm) + 4,
    H = Math.ceil((y1 - y0) * ppm) + 4,
    col = new Uint8ClampedArray(W * H * 4),
    dep = new Float32Array(W * H).fill(Infinity),
    uvAt = o.pick ? new Float32Array(W * H * 2).fill(NaN) : null;
  for (const T of tris) {
    const X = T.map(v => (sx(v) - x0) * ppm + 2),
      Y = T.map(v => (y1 - sy(v)) * ppm + 2),
      a = T[0],
      b = T[1],
      c = T[2],
      u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
      w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const ln = Math.hypot(n[0], n[1], n[2]);
    if (ln < 1e-9) continue;
    n = n.map(q => q / ln);
    /* the side that faces the viewer (two-sided, as the recipes' bake) */
    if (n[1] * MODEL_BAKE_TILT - n[2] < 0) n = n.map(q => -q);
    const lit = n[0] * BAKE_LIGHT[0] + n[1] * BAKE_LIGHT[1] + n[2] * BAKE_LIGHT[2],
      tone = lit > 0.55 ? 1.12 : lit > 0.1 ? 0.92 : 0.7;
    const d = (Y[1] - Y[2]) * (X[0] - X[2]) + (X[2] - X[1]) * (Y[0] - Y[2]);
    if (Math.abs(d) < 1e-9) continue;
    const bx0 = Math.max(0, Math.floor(Math.min(...X))),
      bx1 = Math.min(W - 1, Math.ceil(Math.max(...X))),
      by0 = Math.max(0, Math.floor(Math.min(...Y))),
      by1 = Math.min(H - 1, Math.ceil(Math.max(...Y)));
    for (let py = by0; py <= by1; py++)
      for (let px = bx0; px <= bx1; px++) {
        const gx = px + 0.5,
          gy = py + 0.5,
          w0 = ((Y[1] - Y[2]) * (gx - X[2]) + (X[2] - X[1]) * (gy - Y[2])) / d,
          w1 = ((Y[2] - Y[0]) * (gx - X[2]) + (X[0] - X[2]) * (gy - Y[2])) / d,
          w2 = 1 - w0 - w1;
        if (w0 < -0.01 || w1 < -0.01 || w2 < -0.01) continue;
        const z = w0 * a[2] + w1 * b[2] + w2 * c[2],
          i = py * W + px;
        if (z >= dep[i]) continue;
        let rgb = [a[9], a[10], a[11]];
        const tu = w0 * a[6] + w1 * b[6] + w2 * c[6],
          tv = w0 * a[7] + w1 * b[7] + w2 * c[7];
        if (tex && !a[8]) {
          const t = texAt(tex, tu, tv);
          if (t[3] < 128) continue;
          rgb = [(t[0] * a[9]) / 255, (t[1] * a[10]) / 255, (t[2] * a[11]) / 255];
        }
        dep[i] = z;
        if (uvAt) {
          uvAt[i * 2] = a[8] ? NaN : tu;
          uvAt[i * 2 + 1] = a[8] ? NaN : tv;
        }
        col.set([rgb[0] * tone, rgb[1] * tone, rgb[2] * tone, 255], i * 4);
      }
  }
  /* the ink outline: an empty pixel beside a drawn one */
  const out = new Uint8ClampedArray(col),
    drawn = (/** @type {number} */ x, /** @type {number} */ y) =>
      x >= 0 && y >= 0 && x < W && y < H && col[(y * W + x) * 4 + 3] > 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (!drawn(x, y) && (drawn(x - 1, y) || drawn(x + 1, y) || drawn(x, y - 1) || drawn(x, y + 1)))
        out.set([...MODEL_INK, 255], (y * W + x) * 4);
  return {
    pixels: { width: W, height: H, data: out },
    ox: -Math.round((0 - x0) * ppm + 2),
    oy: -Math.round((y1 - 0) * ppm + 2),
    uv: uvAt,
  };
}

/* ---------------------------------------------------------------- Bake to 32 px/m */
/** the building sheet's cells by material (prop-models.js LOW_POLY_TEXTURE_CELLS, the ones a bake picks) */
export const MODEL_BAKE_CELLS = { plain: 15, wood: 14, stone: 3, metal: 12, hay: 11, leaves: 16, rock: 23 };
/** buildings.js rampC: a colour at shade level t (0-4; 2 is the colour itself), 0-255 */
export function modelRamp(rgb, t) {
  const b = rgb.map(v => v / 255),
    mix = (/** @type {number[]} */ x, /** @type {number[]} */ y, /** @type {number} */ k) =>
      x.map((v, i) => v + (y[i] - v) * k);
  const c =
    t < 0.5
      ? mix(
          b.map(v => v * 0.55),
          [0.235, 0.165, 0.439],
          0.3
        )
      : t < 1.5
        ? mix(
            b.map(v => v * 0.79),
            [0.376, 0.29, 0.596],
            0.17
          )
        : t < 2.5
          ? b
          : t < 3.5
            ? mix(b, [1, 0.957, 0.769], 0.3)
            : mix(b, [1, 0.988, 0.918], 0.6);
  return c.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255));
}
/** a colour's material for the bake, by hue, saturation and lightness (greys are stone or metal, browns wood, greens leaves) */
export function modelBakeMaterial(rgb) {
  const [r, g, b] = rgb.map(v => v / 255),
    mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    l = (mx + mn) / 2,
    s = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1)),
    h =
      mx === mn
        ? 0
        : mx === r
          ? (60 * ((g - b) / (mx - mn)) + 360) % 360
          : mx === g
            ? 60 * ((b - r) / (mx - mn)) + 120
            : 60 * ((r - g) / (mx - mn)) + 240;
  if (s < 0.18) return l < 0.33 ? 'metal' : 'stone';
  if (h >= 15 && h < 48 && l < 0.62) return 'wood';
  if (h >= 45 && h < 65 && l >= 0.62) return 'hay';
  if (h >= 70 && h < 165) return 'leaves';
  return 'plain';
}
/** the nearest colour of a palette (hex strings), by distance weighted as the eye sees it */
export function modelSnapColour(rgb, palette) {
  let best = rgb,
    bd = Infinity;
  for (const hx of palette) {
    const p = [1, 3, 5].map(i => parseInt(hx.slice(i, i + 2), 16)),
      rm = (p[0] + rgb[0]) / 2,
      dr = p[0] - rgb[0],
      dg = p[1] - rgb[1],
      db = p[2] - rgb[2],
      dd = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
    if (dd < bd) {
      bd = dd;
      best = p;
    }
  }
  return best;
}

/**
 * Bake to 32 px/m: the model with a texture of its own at MODEL_PPM. tex: its texture now (the palette); palette: the
 * game's colours (hex); sheet: the building sheet's pixels (its red channel the shade level, cells `cell` px for 2 m,
 * `cols` across). Returns the model with new texture coordinates (colours white: the texture carries them) and the
 * texture's pixels.
 * @param {any} rec
 * @param {Pixels | null} tex
 * @param {{ palette: string[], sheet?: Pixels | null, cols?: number, cell?: number, maxSize?: number }} o
 */
export function modelBakeTexture(rec, tex, o) {
  const parts = modelVertices(rec),
    cell = o.cell || 64,
    cols = o.cols || 8,
    maxSize = o.maxSize || 2048;
  /* every triangle with its corners, colour and direction (the axis its normal leans along most, and the sign) */
  /** @type {{ q: number, t: number, P: number[][], dir: number, rgb: number[] }[]} */
  const tris = [];
  parts.forEach((q, qi) => {
    for (let t = 0; t < q.I.length; t += 3) {
      const C = [q.V[q.I[t]], q.V[q.I[t + 1]], q.V[q.I[t + 2]]],
        P = C.map(v => v.slice(0, 3)),
        u = [0, 1, 2].map(k => P[1][k] - P[0][k]),
        w = [0, 1, 2].map(k => P[2][k] - P[0][k]),
        n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]],
        ax = [0, 1, 2].reduce((m, k) => (Math.abs(n[k]) > Math.abs(n[m]) ? k : m), 0);
      /* the face's colour: its texture at its centre times its vertex colour (a palette texture is one colour a face) */
      let rgb = [C[0][9], C[0][10], C[0][11]];
      if (tex && !C[0][8]) {
        const s = texAt(tex, (C[0][6] + C[1][6] + C[2][6]) / 3, (C[0][7] + C[1][7] + C[2][7]) / 3);
        rgb = [(s[0] * C[0][9]) / 255, (s[1] * C[0][10]) / 255, (s[2] * C[0][11]) / 255].map(Math.round);
      }
      tris.push({ q: qi, t, P, dir: ax * 2 + (n[ax] < 0 ? 1 : 0), rgb });
    }
  });
  /* charts: triangles of one part and one direction joined where they share an edge */
  const parent = tris.map((_, i) => i),
    find = (/** @type {number} */ i) => {
      while (parent[i] !== i) i = parent[i] = parent[parent[i]];
      return i;
    },
    key = (/** @type {number[]} */ p) => p.map(v => Math.round(v * 256)).join(','),
    edges = new Map();
  tris.forEach((T, i) => {
    for (let j = 0; j < 3; j++) {
      const a = key(T.P[j]),
        b = key(T.P[(j + 1) % 3]),
        e = `${T.q}|${T.dir}|${a < b ? a + '|' + b : b + '|' + a}`;
      if (edges.has(e)) parent[find(i)] = find(edges.get(e));
      else edges.set(e, i);
    }
  });
  /** @type {Map<number, number[]>} */
  const charts = new Map();
  tris.forEach((_, i) => {
    const r = find(i);
    if (!charts.has(r)) charts.set(r, []);
    /** @type {number[]} */ (charts.get(r)).push(i);
  });
  /* each chart laid flat on its plane (metres), its size in pixels */
  const planeOf = (/** @type {number} */ dir) =>
      [
        [2, 1],
        [0, 2],
        [0, 1],
      ][dir >> 1],
    list = [...charts.values()].map(ids => {
      const [ua, va] = planeOf(tris[ids[0]].dir);
      let u0 = Infinity,
        v0 = Infinity,
        u1 = -Infinity,
        v1 = -Infinity;
      for (const i of ids)
        for (const p of tris[i].P) {
          u0 = Math.min(u0, p[ua]);
          u1 = Math.max(u1, p[ua]);
          v0 = Math.min(v0, p[va]);
          v1 = Math.max(v1, p[va]);
        }
      return {
        ids,
        ua,
        va,
        u0,
        v0,
        w: Math.max(1, Math.ceil((u1 - u0) * MODEL_PPM)) + 2,
        h: Math.max(1, Math.ceil((v1 - v0) * MODEL_PPM)) + 2,
      };
    });
  const A = modelAtlas(list.map(c => [c.w, c.h]));
  if (A.w > maxSize || A.h > maxSize)
    throw new Error(
      `The baked texture would be ${A.w} × ${A.h} px (over ${maxSize}): the model is too big to bake at ${MODEL_PPM} px/m.`
    );
  const px = new Uint8ClampedArray(A.w * A.h * 4),
    level = (/** @type {number} */ mat, /** @type {number} */ x, /** @type {number} */ y) => {
      if (!o.sheet) return 2;
      const cx = mat % cols,
        cy = Math.floor(mat / cols),
        sx = cx * cell + (((Math.floor(x) % cell) + cell) % cell),
        sy = cy * cell + (((Math.floor(y) % cell) + cell) % cell);
      if (sx >= o.sheet.width || sy >= o.sheet.height) return 2;
      return Math.round((o.sheet.data[(sy * o.sheet.width + sx) * 4] / 255) * 4);
    };
  /* new vertices: each triangle's corners at their chart's place */
  const out = parts.map(q => ({ ...q.meta, V: /** @type {number[][]} */ ([]), I: /** @type {number[]} */ ([]) }));
  list.forEach((c, ci) => {
    const s = /** @type {import('./model-mesh.js').AtlasSlot} */ (A.slots.find(z => z.image === ci));
    for (const i of c.ids) {
      const T = tris[i],
        base = modelSnapColour(T.rgb, o.palette),
        mat = MODEL_BAKE_CELLS[/** @type {keyof typeof MODEL_BAKE_CELLS} */ (modelBakeMaterial(base))],
        q = parts[T.q],
        /* pixel coordinates in the atlas: v runs down the picture, the chart's plane up */
        UV = T.P.map(p => [s.x + 1 + (p[c.ua] - c.u0) * MODEL_PPM, s.y + s.h - 1 - (p[c.va] - c.v0) * MODEL_PPM]);
      /* fill the triangle (and a pixel round it, so no seam shows between charts) */
      const xs = UV.map(z => z[0]),
        ys = UV.map(z => z[1]),
        d = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2]);
      for (
        let y = Math.max(s.y, Math.floor(Math.min(...ys)) - 1);
        y <= Math.min(s.y + s.h - 1, Math.ceil(Math.max(...ys)));
        y++
      )
        for (
          let x = Math.max(s.x, Math.floor(Math.min(...xs)) - 1);
          x <= Math.min(s.x + s.w - 1, Math.ceil(Math.max(...xs)));
          x++
        ) {
          const o2 = (y * A.w + x) * 4;
          /* inside: always this face's; within a pixel and a half round it: only where nothing is drawn yet */
          let inside = false;
          if (Math.abs(d) > 1e-9) {
            const gx = x + 0.5,
              gy = y + 0.5,
              w0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / d,
              w1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / d,
              w2 = 1 - w0 - w1,
              e = 1.5 / Math.max(1, Math.sqrt(Math.abs(d)));
            if (w0 < -e || w1 < -e || w2 < -e) continue;
            inside = w0 >= 0 && w1 >= 0 && w2 >= 0;
          }
          if (!inside && px[o2 + 3]) continue;
          px.set([...modelRamp(base, level(mat, x - s.x, s.y + s.h - 1 - y)), 255], o2);
        }
      const V0 = q.I.slice(T.t, T.t + 3).map(k => q.V[k]),
        dst = out[T.q];
      V0.forEach((v, j) => {
        dst.I.push(dst.V.length);
        dst.V.push([v[0], v[1], v[2], v[3], v[4], v[5], UV[j][0] / A.w, UV[j][1] / A.h, 0, 255, 255, 255]);
      });
    }
  });
  const R = { ...rec, parts: out.flatMap(q => modelPackPart(q)) };
  delete R.wrap;
  return { rec: R, pixels: { width: A.w, height: A.h, data: px } };
}
