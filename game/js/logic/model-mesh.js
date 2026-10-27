// @ts-check
'use strict';
/* ================= MODEL MESH (studio track ST-7: Model mode import) =================
   A model read by model-gltf.js or model-obj.js made into the game's mesh, format v2 (game/art/scene/models/<key>.json
   beside its texture <key>.png; prop-models.js uploadPrebuiltModel draws it):
     { kind: 'mesh', v: 2, ppm: 32, name, about, src, tex: 'scene/models/<key>.png', wrap, box, tris,
       parts: [{ name, n, ni, data, parent, pivot, spin?: { a, rps }, joint?: { a, min, max } }] }
   A vertex is 24 bytes, as in v1 (tools/build-airship.py pack), so the game's vertex layout stays: position in 1/256 m
   (int16 x, y, z; y up, the front at -z), the normal (int8), the texture coordinates on the model's own texture in
   1/4096 (int16 u, v: 0-1 across the picture, up to 8 for a repeating one), byte 16 = 255 (the model's own texture,
   not a building-sheet cell), byte 18 = 1 for a face with no texture (its colour alone), the colour (uint8 RGB: the
   material's colour times the vertex colour; a textured face is the texture times it). The triangles are uint16, so
   a part over 65,535 vertices is cut in pieces.
   Parts: one per node of the source (its triangles already placed); parent, pivot (the node's origin), and what a
   Blender round trip keeps in the node's extras.pb (ST-8 writes it): spin { axis, rps } (the part turns all the time,
   as the airship's propellers do) and joint { axis, min, max } (degrees; drawn at rest, kept for posing). Axes are
   the model's, up as y.
   The checks: texel density (pixels to the metre on each face, worked out from its texture area and its area in the
   world; the area-weighted median and how much of the surface is more than a quarter off 32 px/m), faces that sample
   a single texel (a palette texture, as KayKit and Kenney models have: the density means nothing there), and the
   triangle count (a warning over 2,000).
   Logic only: no DOM, runs in Node (tools/test/model-import.test.mjs). */
/** @import { ModelSource } from './model-gltf.js' */
/** @typedef {{ width: number, height: number, data: Uint8ClampedArray | Uint8Array }} Pixels */
/** @typedef {{ height?: number, scale?: number, yaw?: number, upZ?: boolean, ground?: boolean, centre?: boolean, name?: string, key?: string, about?: string, src?: string }} ModelBuildOptions height: metres tall (wins over scale); scale: source units to metres; yaw: degrees about up */
/** @typedef {{ image: number, x: number, y: number, w: number, h: number }} AtlasSlot */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { base64Decode, base64Encode } from './model-gltf.js';
/* eslint-disable no-func-assign */
expose({
  MODEL_DENSITY_BINS: [() => MODEL_DENSITY_BINS],
  MODEL_DENSITY_OFF: [() => MODEL_DENSITY_OFF],
  MODEL_FLAT_RANGE: [() => MODEL_FLAT_RANGE],
  MODEL_OWN_CELL: [() => MODEL_OWN_CELL],
  MODEL_PPM: [() => MODEL_PPM],
  MODEL_TRI_WARN: [() => MODEL_TRI_WARN],
  MODEL_UV_Q: [() => MODEL_UV_Q],
  // @ts-expect-error -- replaced on purpose
  linearToSrgb: [() => linearToSrgb, v => (linearToSrgb = v)],
  // @ts-expect-error -- replaced on purpose
  modelAtlas: [() => modelAtlas, v => (modelAtlas = v)],
  // @ts-expect-error -- replaced on purpose
  modelAtlasPixels: [() => modelAtlasPixels, v => (modelAtlasPixels = v)],
  // @ts-expect-error -- replaced on purpose
  modelAxisMap: [() => modelAxisMap, v => (modelAxisMap = v)],
  // @ts-expect-error -- replaced on purpose
  modelBuild: [() => modelBuild, v => (modelBuild = v)],
  // @ts-expect-error -- replaced on purpose
  modelCheckLines: [() => modelCheckLines, v => (modelCheckLines = v)],
  // @ts-expect-error -- replaced on purpose
  modelDensity: [() => modelDensity, v => (modelDensity = v)],
  // @ts-expect-error -- replaced on purpose
  modelFaceFlat: [() => modelFaceFlat, v => (modelFaceFlat = v)],
  // @ts-expect-error -- replaced on purpose
  modelFaces: [() => modelFaces, v => (modelFaces = v)],
  // @ts-expect-error -- replaced on purpose
  modelPackPart: [() => modelPackPart, v => (modelPackPart = v)],
  // @ts-expect-error -- replaced on purpose
  modelResample: [() => modelResample, v => (modelResample = v)],
  // @ts-expect-error -- replaced on purpose
  modelResampleFactor: [() => modelResampleFactor, v => (modelResampleFactor = v)],
  modelRound3: [() => modelRound3],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the art's pixels to the metre (VISION: terrain and the airship, 32 px/m) */
export const MODEL_PPM = 32;
/** a warning above this many triangles (ST decisions) */
export const MODEL_TRI_WARN = 2000;
/** a face more than this far off MODEL_PPM (as a fraction) counts as off */
export const MODEL_DENSITY_OFF = 0.25;
/** the texture coordinates' step in the vertex data (int16): 0-1 is 0-4096 */
export const MODEL_UV_Q = 4096;
/** byte 16 of a vertex: the model's own texture */
export const MODEL_OWN_CELL = 255;
/** the density histogram's bins, in px/m (the last is open) */
export const MODEL_DENSITY_BINS = [0, 4, 8, 16, 24, 28, 36, 48, 64, 128];

/** linear 0-1 to sRGB 0-255 (glTF colours are linear; the game's are as drawn) */
export function linearToSrgb(v) {
  const c = Math.min(1, Math.max(0, v));
  return Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
}

/**
 * Shelf-pack pictures into one texture (each kept whole, 1 px apart). sizes[i] = [w, h] or null (unused).
 * @param {(number[] | null)[]} sizes
 * @returns {{ w: number, h: number, slots: AtlasSlot[] }}
 */
export function modelAtlas(sizes) {
  const list = sizes.map((s, image) => (s ? { image, w: s[0], h: s[1] } : null)).filter(x => !!x);
  list.sort((a, b) => b.h - a.h || b.w - a.w);
  const area = list.reduce((s, q) => s + (q.w + 1) * (q.h + 1), 0),
    widest = list.reduce((s, q) => Math.max(s, q.w), 1);
  let W = 1;
  while (W < Math.max(widest, Math.sqrt(area))) W *= 2;
  /** @type {AtlasSlot[]} */
  const slots = [];
  let x = 0,
    y = 0,
    rowH = 0;
  for (const q of list) {
    if (x > 0 && x + q.w > W) {
      x = 0;
      y += rowH + 1;
      rowH = 0;
    }
    slots.push({ image: q.image, x, y, w: q.w, h: q.h });
    x += q.w + 1;
    rowH = Math.max(rowH, q.h);
  }
  let H = 1;
  while (H < y + rowH) H *= 2;
  return { w: W, h: H, slots };
}
/** the atlas's pixels from the pictures (pixels[i] for slot image i) */
export function modelAtlasPixels(atlas, pixels) {
  const out = new Uint8ClampedArray(atlas.w * atlas.h * 4);
  for (const s of atlas.slots) {
    const P = pixels[s.image];
    if (!P) continue;
    for (let y = 0; y < s.h; y++)
      out.set(P.data.subarray(y * P.width * 4, y * P.width * 4 + s.w * 4), ((s.y + y) * atlas.w + s.x) * 4);
  }
  return { width: atlas.w, height: atlas.h, data: out };
}

/** a direction from the source's axes to the game's: z up turned to y up first, then glTF's front (+z) to the game's (-z) */
export function modelAxisMap(upZ) {
  return upZ ? (/** @type {number[]} */ p) => [p[0], p[2], p[1]] : (/** @type {number[]} */ p) => [p[0], p[1], -p[2]];
}

/**
 * The game's model from a source. images: each source picture's size [w, h] (null if it couldn't be read).
 * Returns the recipe (no texture yet: the atlas says how to make it), the triangles for the checks and painting,
 * and the warnings.
 * @param {ModelSource} src
 * @param {(number[] | null)[]} imageSizes
 * @param {ModelBuildOptions} [o]
 */
export function modelBuild(src, imageSizes, o = {}) {
  const warnings = [...src.warnings],
    map = modelAxisMap(!!o.upZ),
    yaw = ((o.yaw || 0) * Math.PI) / 180,
    cy = Math.cos(yaw),
    sy = Math.sin(yaw),
    turn = (/** @type {number[]} */ p) => [p[0] * cy + p[2] * sy, p[1], -p[0] * sy + p[2] * cy],
    dir = (/** @type {number[]} */ p) => turn(map(p)),
    linear = src.format !== 'obj';
  /* the textures in use, packed into one */
  const used = imageSizes.map(() => false);
  for (const n of src.nodes)
    for (const p of n.prims) {
      const m = src.materials[p.mat];
      if (m && m.image >= 0 && p.uv && imageSizes[m.image]) used[m.image] = true;
    }
  const nUsed = used.filter(Boolean).length,
    atlas = nUsed ? modelAtlas(imageSizes.map((s, i) => (used[i] ? s : null))) : null,
    slotOf = (/** @type {number} */ im) => (atlas ? atlas.slots.find(s => s.image === im) || null : null);
  /* the box, in the game's axes, before scaling */
  let lo = [Infinity, Infinity, Infinity],
    hi = [-Infinity, -Infinity, -Infinity];
  for (const n of src.nodes)
    for (const p of n.prims)
      for (let v = 0; v < p.pos.length; v += 3) {
        const q = dir([p.pos[v], p.pos[v + 1], p.pos[v + 2]]);
        for (let k = 0; k < 3; k++) {
          lo[k] = Math.min(lo[k], q[k]);
          hi[k] = Math.max(hi[k], q[k]);
        }
      }
  const tall = hi[1] - lo[1] || 1,
    s = o.height ? o.height / tall : o.scale || 1,
    off = [
      o.centre === false ? 0 : -(lo[0] + hi[0]) / 2,
      o.ground === false ? 0 : -lo[1],
      o.centre === false ? 0 : -(lo[2] + hi[2]) / 2,
    ],
    place = (/** @type {number[]} */ p) => {
      const q = dir(p);
      return [(q[0] + off[0]) * s, (q[1] + off[1]) * s, (q[2] + off[2]) * s];
    };
  let wrapped = false,
    spanWarn = false,
    tris = 0;
  /** @type {{ name: string, parent: number, pivot: number[], spin: any, joint: any, V: number[][], I: number[] }[]} */
  const parts = [];
  /** @type {{ p: number[][], uv: number[][] | null, part: number }[]} */
  const faces = [];
  /** @type {Map<number, number>} the source node -> its part */
  const partOf = new Map();
  src.nodes.forEach((n, ni) => {
    /** @type {Map<string, number>} */
    const seen = new Map(),
      V = [],
      I = [];
    for (const p of n.prims) {
      const m = src.materials[p.mat] || null,
        slot = m && m.image >= 0 && p.uv ? slotOf(m.image) : null,
        base = m ? m.color : [1, 1, 1, 1];
      for (let t = 0; t < p.idx.length; t += 3) {
        const ix = [p.idx[t], p.idx[t + 1], p.idx[t + 2]],
          P = ix.map(i => place([p.pos[i * 3], p.pos[i * 3 + 1], p.pos[i * 3 + 2]]));
        /* the face's own normal, for a source without normals */
        const e1 = [0, 1, 2].map(k => P[1][k] - P[0][k]),
          e2 = [0, 1, 2].map(k => P[2][k] - P[0][k]),
          fx = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]],
          fl = Math.hypot(fx[0], fx[1], fx[2]);
        if (fl < 1e-12) continue;
        /* the game's faces wind the other way round (its z is glTF's -z, a mirror): the normal is -fx */
        const fN = fx.map(v => -v / fl);
        /** @type {number[][] | null} */
        let UV = null;
        if (slot && atlas && p.uv) {
          const raw = ix.map(i => [p.uv ? p.uv[i * 2] : 0, p.uv ? p.uv[i * 2 + 1] : 0]);
          /* a repeating texture: the face moved by whole repeats so its coordinates start in 0-1 */
          const fu = Math.floor(Math.min(...raw.map(q => q[0])) + 1e-6),
            fv = Math.floor(Math.min(...raw.map(q => q[1])) + 1e-6);
          const r2 = raw.map(q => [q[0] - fu, q[1] - fv]);
          if (r2.some(q => q[0] > 1 + 1e-6 || q[1] > 1 + 1e-6)) wrapped = true;
          if (r2.some(q => q[0] > 7.99 || q[1] > 7.99)) spanWarn = true;
          UV =
            nUsed > 1
              ? r2.map(q => [
                  (slot.x + Math.min(Math.max(q[0], 0), 1) * slot.w) / atlas.w,
                  (slot.y + Math.min(Math.max(q[1], 0), 1) * slot.h) / atlas.h,
                ])
              : r2.map(q => [Math.min(q[0], 7.99), Math.min(q[1], 7.99)]);
        }
        faces.push({ p: P, uv: UV, part: parts.length });
        for (let j = 0; j < 3; j++) {
          const i = ix[j],
            nn = p.nrm ? dir([p.nrm[i * 3], p.nrm[i * 3 + 1], p.nrm[i * 3 + 2]]) : fN,
            vc = p.col ? [p.col[i * 4], p.col[i * 4 + 1], p.col[i * 4 + 2]] : [1, 1, 1],
            c = [0, 1, 2].map(k =>
              linear ? linearToSrgb(base[k] * vc[k]) : Math.round(255 * Math.min(1, Math.max(0, base[k] * vc[k])))
            ),
            uv = UV ? UV[j] : [0, 0],
            key = [
              ...P[j].map(v => Math.round(v * 256)),
              ...nn.map(v => Math.round(v * 127)),
              ...uv.map(v => Math.round(v * MODEL_UV_Q)),
              UV ? 0 : 1,
              ...c,
            ].join(',');
          let at = seen.get(key);
          if (at === undefined) {
            at = V.length;
            seen.set(key, at);
            V.push([...P[j], ...nn, ...uv, UV ? 0 : 1, ...c]);
          }
          I.push(at);
        }
        tris++;
      }
    }
    const pb = n.extras && typeof n.extras.pb === 'object' ? n.extras.pb : {},
      ax = (/** @type {any} */ a) => {
        const v = Array.isArray(a) && a.length === 3 ? dir(a.map(Number)) : [0, 1, 0],
          l = Math.hypot(v[0], v[1], v[2]) || 1;
        return v.map(q => modelRound3(q / l));
      };
    const parent = n.parent >= 0 && partOf.has(n.parent) ? /** @type {number} */ (partOf.get(n.parent)) : -1;
    const part = {
      name: n.name,
      parent,
      pivot: place(n.pivot).map(modelRound3),
      spin: pb.spin ? { a: ax(pb.spin.axis), rps: +pb.spin.rps || 0 } : null,
      joint: pb.joint ? { a: ax(pb.joint.axis), min: +pb.joint.min || 0, max: +pb.joint.max || 0 } : null,
      V,
      I,
    };
    if (I.length) {
      partOf.set(ni, parts.length);
      parts.push(part);
    } else if (parent >= 0) partOf.set(ni, parent);
  });
  if (wrapped && nUsed > 1)
    warnings.push(
      'A texture repeats across a face, but the model has several textures packed into one: the repeats are clamped. Export it with one texture to keep them.'
    );
  if (spanWarn) warnings.push('A face repeats its texture more than 8 times: clamped at 8.');
  if (tris > MODEL_TRI_WARN)
    warnings.push(
      `${tris} triangles: over the ${MODEL_TRI_WARN} a model should have (one draw, but every triangle costs on a phone). Simplify it in Blender (Decimate) and import again.`
    );
  const B = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const f of faces)
    for (const p of f.p)
      for (let k = 0; k < 3; k++) {
        B[k] = Math.min(B[k], p[k]);
        B[k + 3] = Math.max(B[k + 3], p[k]);
      }
  if (B.some(v => Math.abs(v) > 127))
    throw new Error(
      `The model is ${modelRound3(Math.max(B[3] - B[0], B[4] - B[1], B[5] - B[2]))} m across: over the 127 m a mesh can hold. Set its height or scale.`
    );
  const rec = {
    kind: 'mesh',
    v: 2,
    ppm: MODEL_PPM,
    name: o.name || src.nodes[0].name,
    about: o.about || `Imported in the Studio's Model mode from ${o.src || 'a ' + src.format + ' file'}`,
    src: o.src || '',
    tex: atlas && o.key ? `scene/models/${o.key}.png` : undefined,
    wrap: wrapped && nUsed === 1 ? 1 : undefined,
    box: B.map(modelRound3),
    tris,
    parts: parts.flatMap(q => modelPackPart(q)),
  };
  if (!rec.tex) delete rec.tex;
  if (!rec.wrap) delete rec.wrap;
  return { rec, atlas, faces, warnings, scale: s };
}
export const modelRound3 = (/** @type {number} */ v) => Math.round(v * 1000) / 1000 || 0;

/** a part's vertices and triangles as the format's entries (cut at 65,535 vertices) */
export function modelPackPart(q) {
  const out = [];
  for (let t0 = 0; t0 < q.I.length;) {
    /** @type {Map<number, number>} */
    const remap = new Map(),
      V = [],
      I = [];
    let t = t0;
    for (; t < q.I.length; t += 3) {
      const need = [q.I[t], q.I[t + 1], q.I[t + 2]].filter(i => !remap.has(i)).length;
      if (V.length + need > 65535) break;
      for (let j = 0; j < 3; j++) {
        const i = q.I[t + j];
        if (!remap.has(i)) {
          remap.set(i, V.length);
          V.push(q.V[i]);
        }
        I.push(/** @type {number} */ (remap.get(i)));
      }
    }
    const b = new Uint8Array(V.length * 24 + I.length * 2),
      d = new DataView(b.buffer);
    V.forEach((v, i) => {
      const o = i * 24;
      for (let k = 0; k < 3; k++) d.setInt16(o + k * 2, Math.round(v[k] * 256), true);
      for (let k = 0; k < 3; k++) d.setInt8(o + 8 + k, Math.round(Math.max(-1, Math.min(1, v[3 + k])) * 127));
      d.setInt16(o + 12, Math.round(v[6] * MODEL_UV_Q), true);
      d.setInt16(o + 14, Math.round(v[7] * MODEL_UV_Q), true);
      b[o + 16] = MODEL_OWN_CELL;
      b[o + 18] = v[8];
      b[o + 20] = v[9];
      b[o + 21] = v[10];
      b[o + 22] = v[11];
      b[o + 23] = 255;
    });
    I.forEach((v, i) => d.setUint16(V.length * 24 + i * 2, v, true));
    /** @type {any} */
    const e = {
      name: out.length ? `${q.name} (${out.length + 1})` : q.name,
      n: V.length,
      ni: I.length,
      data: base64Encode(b),
    };
    if (q.parent >= 0) e.parent = q.parent;
    e.pivot = q.pivot;
    if (q.spin) e.spin = q.spin;
    if (q.joint) e.joint = q.joint;
    out.push(e);
    t0 = t;
  }
  return out;
}

/**
 * A v2 (or v1) model's faces back from its vertex data: positions (metres), texture coordinates (0-1 on its own
 * texture; null for a face with no texture or a v1 sheet face), the part each is in.
 * @param {any} rec
 */
export function modelFaces(rec) {
  /** @type {{ p: number[][], uv: number[][] | null, part: number }[]} */
  const out = [];
  (rec.parts || []).forEach((/** @type {any} */ P, /** @type {number} */ pi) => {
    const b = base64Decode(P.data || ''),
      d = new DataView(b.buffer, b.byteOffset, b.byteLength);
    if (b.length < P.n * 24 + P.ni * 2) throw new Error(`Part ${P.name || pi}: its data is short.`);
    const vert = (/** @type {number} */ i) => {
      const o = i * 24;
      return {
        p: [0, 2, 4].map(k => d.getInt16(o + k, true) / 256),
        uv:
          b[o + 16] === MODEL_OWN_CELL && !b[o + 18]
            ? [d.getInt16(o + 12, true) / MODEL_UV_Q, d.getInt16(o + 14, true) / MODEL_UV_Q]
            : null,
      };
    };
    for (let t = 0; t < P.ni; t += 3) {
      const v = [0, 1, 2].map(j => vert(d.getUint16(P.n * 24 + (t + j) * 2, true)));
      if (v.some(q => q.p.some(x => !Number.isFinite(x)))) continue;
      out.push({
        p: v.map(q => q.p),
        uv: v.every(q => q.uv) ? v.map(q => /** @type {number[]} */ (q.uv)) : null,
        part: pi,
      });
    }
  });
  return out;
}

/**
 * Texel density: pixels to the metre on each textured face (its texture area in pixels against its area in metres),
 * the area-weighted median and mean, how much of the textured surface is more than MODEL_DENSITY_OFF off MODEL_PPM,
 * a histogram of the surface by density, and the surface whose faces sample under a texel (a palette texture).
 * With the texture's pixels, a face whose texels are all about one colour counts as a palette face too (a swatch:
 * KayKit's 1024 px palette gives a face a few texels of one colour).
 * @param {{ p: number[][], uv: number[][] | null }[]} faces
 * @param {number} texW
 * @param {number} texH
 * @param {Pixels | null} [pixels]
 */
export function modelDensity(faces, texW, texH, pixels = null) {
  const rows = [];
  let palette = 0,
    textured = 0,
    plain = 0;
  for (const f of faces) {
    const [a, b, c] = f.p,
      u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
      v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]],
      area = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
    if (area < 1e-9) continue;
    if (!f.uv) {
      plain += area;
      continue;
    }
    const [p, q, r] = f.uv.map(t => [t[0] * texW, t[1] * texH]),
      px = Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (r[0] - p[0]) * (q[1] - p[1])) / 2;
    textured += area;
    /* under one texel for a face bigger than a hand: a palette swatch */
    if ((px < 1 && area > 0.0025) || (pixels && modelFaceFlat(f.uv, pixels))) {
      palette += area;
      continue;
    }
    rows.push({ d: Math.sqrt(px / area), area });
  }
  rows.sort((x, y) => x.d - y.d);
  const measured = rows.reduce((s, r) => s + r.area, 0);
  let acc = 0,
    median = 0;
  for (const r of rows) {
    acc += r.area;
    if (acc >= measured / 2) {
      median = r.d;
      break;
    }
  }
  const mean = measured ? rows.reduce((s, r) => s + r.d * r.area, 0) / measured : 0,
    off = measured
      ? rows.filter(r => Math.abs(r.d / MODEL_PPM - 1) > MODEL_DENSITY_OFF).reduce((s, r) => s + r.area, 0) / measured
      : 0,
    hist = MODEL_DENSITY_BINS.map(() => 0);
  for (const r of rows) {
    let k = MODEL_DENSITY_BINS.length - 1;
    while (k > 0 && r.d < MODEL_DENSITY_BINS[k]) k--;
    hist[k] += measured ? r.area / measured : 0;
  }
  const paletteShare = textured ? palette / textured : 0;
  return {
    median: modelRound3(median),
    mean: modelRound3(mean),
    off: modelRound3(off),
    hist: hist.map(modelRound3),
    palette: modelRound3(paletteShare),
    isPalette: paletteShare > 0.5,
    textured: modelRound3(textured),
    plain: modelRound3(plain),
    /** the texture's scale that brings the median to MODEL_PPM (1: nothing to do) */
    fix:
      median > 0 && paletteShare <= 0.5 && Math.abs(median / MODEL_PPM - 1) > MODEL_DENSITY_OFF
        ? modelResampleFactor(median)
        : 1,
  };
}
/** the colour range a face's texels may have and still count as one colour (a swatch) */
export const MODEL_FLAT_RANGE = 24;
/** whether the texels under a face are all about one colour (sampled on a grid inside it) */
export function modelFaceFlat(uv, P) {
  let lo = [255, 255, 255],
    hi = [0, 0, 0];
  const N = 6;
  for (let i = 0; i <= N; i++)
    for (let j = 0; i + j <= N; j++) {
      const a = i / N,
        b = j / N,
        c = 1 - a - b,
        u = uv[0][0] * c + uv[1][0] * a + uv[2][0] * b,
        v = uv[0][1] * c + uv[1][1] * a + uv[2][1] * b,
        x = Math.min(P.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * P.width))),
        y = Math.min(P.height - 1, Math.max(0, Math.floor((v - Math.floor(v)) * P.height))),
        o = (y * P.width + x) * 4;
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], P.data[o + k]);
        hi[k] = Math.max(hi[k], P.data[o + k]);
      }
      if (hi.some((h, k) => h - lo[k] > MODEL_FLAT_RANGE)) return false;
    }
  return true;
}
/** the scale that brings a density to MODEL_PPM, kept to a texture of sensible size (1/8 to 8) */
export function modelResampleFactor(density) {
  return density > 0 ? Math.min(8, Math.max(1 / 8, MODEL_PPM / density)) : 1;
}
/** a texture scaled by f, nearest pixel (pixel art stays pixel art): at least 1 x 1 */
export function modelResample(P, f) {
  const w = Math.max(1, Math.round(P.width * f)),
    h = Math.max(1, Math.round(P.height * f)),
    out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(P.height - 1, Math.floor(((y + 0.5) * P.height) / h));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(P.width - 1, Math.floor(((x + 0.5) * P.width) / w));
      out.set(P.data.subarray((sy * P.width + sx) * 4, (sy * P.width + sx) * 4 + 4), (y * w + x) * 4);
    }
  }
  return { width: w, height: h, data: out };
}
/**
 * What the checks say about a built model, as lines for the Studio and the data check.
 * @param {any} rec
 * @param {ReturnType<typeof modelDensity> | null} D
 */
export function modelCheckLines(rec, D) {
  const out = [];
  if ((rec.tris || 0) > MODEL_TRI_WARN)
    out.push({ level: 'warn', text: `${rec.tris} triangles (over ${MODEL_TRI_WARN}).` });
  if (D && D.isPalette)
    out.push({
      level: 'note',
      text: `Palette texture: ${Math.round(D.palette * 100)}% of the textured surface takes one colour a face, so its density isn't checked. "Bake to 32 px/m" makes a texture of our own for it.`,
    });
  else if (D && D.median)
    out.push(
      D.off > 0.2 || Math.abs(D.median / MODEL_PPM - 1) > MODEL_DENSITY_OFF
        ? {
            level: 'warn',
            text: `Texel density ${D.median} px/m (the art is ${MODEL_PPM}); ${Math.round(D.off * 100)}% of the surface is more than a quarter off.${D.fix !== 1 ? ` "Resample" scales the texture ×${modelRound3(D.fix)}.` : ''}`,
          }
        : { level: 'ok', text: `Texel density ${D.median} px/m (the art is ${MODEL_PPM}).` }
    );
  return out;
}
