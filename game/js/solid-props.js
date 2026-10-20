'use strict';
/* ================= SOLID PROPS (v19): the props' pictures with real depth behind them =================
   Each prop keeps its hand-drawn picture as its front, and gets a body made from that same picture:
   - "slab":  the outline cut out of a thin board (signs, fences, poles, traffic lights), with edges in the colour of the
              pixels along the outline, so a turned camera sees thickness instead of a paper edge;
   - "block": the outline pushed back through the prop's depth (crates, benches, bins, cars, vending machines);
   - "puff":  the picture bulged into a rounded body, thickest where the shape is widest (rocks, barrels, cacti,
              stumps, lamps, fountains), lit by its own curved surface.
   The front and back show the picture; everything is built once per picture from its pixels, lit by the sun, sits in
   the shadow map (so its shadow has the real shape) and receives shadows. A prop's "vol" in the scenery catalog
   ("slab"|"block"|"puff"|"lathe"|"card") and "volDepth" (metres) override the automatic choice below; "card" keeps the
   flat picture. "lathe" turns the outline round, like a pot on a potter's wheel. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide, reducedMotion } from './hooks.js';
import { clamp } from './util.js';
import { placedTurn } from './logic/prop-turn.js';
import { makeCanvas } from './art.js';
import { artImage, hash2d, walkView, worldToScreen } from './walk-view.js';
import { engineSetting } from './engine/settings.js';
import {
  COMMON_GLSL,
  LIGHT_GLSL,
  LOOK_GLSL,
  SURFACE_MATERIALS,
  ensurePrograms,
  gpuState,
  imageTexture,
} from './engine/webgl.js';
import { walkRenderer } from './walk/walk-state.js';
import { useWalkProgram, worldCurveArgs } from './walk/draw-common.js';
import { frameBudgetLeft } from './walk/quality-cull.js';
import { foliageAmount, setPropLookUniforms } from './walk/prop-look.js';
import { addHitTarget, drawRotatingBlades } from './walk/sprites.js';
/* eslint-disable no-func-assign */
expose({
  SOLID_PROP_BODIES: [() => SOLID_PROP_BODIES],
  SOLID_PROP_KINDS: [() => SOLID_PROP_KINDS],
  SOLID_PROP_MATERIAL_IDS: [() => SOLID_PROP_MATERIAL_IDS],
  SOLID_PROP_PARTS: [() => SOLID_PROP_PARTS],
  SOLID_PROP_SHADERS: [() => SOLID_PROP_SHADERS],
  SOLID_PROP_VERTEX_GLSL: [() => SOLID_PROP_VERTEX_GLSL],
  buildSolidProp: [() => buildSolidProp, v => setBuildSolidProp(v)],
  buildSolidTree: [() => buildSolidTree, v => setBuildSolidTree(v)],
  drawSolidPropShadows: [
    () => drawSolidPropShadows,
    v => ((drawSolidPropShadows = v), provide({ drawSolidPropShadows })),
  ],
  drawSolidProps: [() => drawSolidProps, v => setDrawSolidProps(v)],
  flushSolidPropMeshes: [
    () => flushSolidPropMeshes,
    v => ((flushSolidPropMeshes = v), provide({ flushSolidPropMeshes })),
  ],
  setSolidPropUniforms: [() => setSolidPropUniforms, v => (setSolidPropUniforms = v)],
  solidPropGuard: [() => solidPropGuard, v => (solidPropGuard = v)],
  solidPropKind: [() => solidPropKind, v => (solidPropKind = v)],
  solidPropLevelOfDetail: [
    () => solidPropLevelOfDetail,
    v => ((solidPropLevelOfDetail = v), provide({ solidPropLevelOfDetail })),
  ],
  solidPropMesh: [() => solidPropMesh, v => (solidPropMesh = v)],
  solidPropSpec: [() => solidPropSpec, v => (solidPropSpec = v)],
  solidPropState: [() => solidPropState],
  solidPropTexture: [() => solidPropTexture, v => (solidPropTexture = v)],
  solidPropsOn: [() => solidPropsOn, v => (solidPropsOn = v)],
  solidTreeKind: [() => solidTreeKind, v => (solidTreeKind = v)],
  tagSolidProp: [() => tagSolidProp, v => ((tagSolidProp = v), provide({ tagSolidProp }))],
  uploadSolidPropMesh: [() => uploadSolidPropMesh, v => (uploadSolidPropMesh = v)],
});
/* eslint-enable no-func-assign */
provide({ drawSolidPropShadows, drawSolidProps, flushSolidPropMeshes, solidPropLevelOfDetail, tagSolidProp });
export function setBuildSolidProp(v) {
  buildSolidProp = v; // eslint-disable-line no-func-assign
  provide({ buildSolidProp });
}
export function setBuildSolidTree(v) {
  buildSolidTree = v; // eslint-disable-line no-func-assign
  provide({ buildSolidTree });
}
export function setDrawSolidProps(v) {
  drawSolidProps = v; // eslint-disable-line no-func-assign
  provide({ drawSolidProps });
}
/* to-module: end */
export const solidPropState = { meshes: new WeakMap(), live: new Map(), fail: '', drawn: 0 };
/* by prop group (or key): the kind of body and its depth at scale 1, in metres */
export const SOLID_PROP_BODIES = {
  crate: ['block', 0.9],
  crates: ['block', 1],
  bin: ['block', 1],
  vending: ['block', 0.8],
  newsstand: ['block', 1.2],
  phone_booth: ['block', 1],
  food_truck: ['block', 1.6],
  market_cart: ['block', 1],
  car: ['block', 1.4],
  bench: ['block', 0.5],
  bench_metal: ['block', 0.5],
  bench_wood: ['block', 0.5],
  picnic: ['block', 0.9],
  firewood: ['block', 0.6],
  mailbox: ['block', 0.5],
  mailbox_blue: ['block', 0.45],
  mailbox_red: ['block', 0.45],
  birdhouse: ['block', 0.3],
  wheelbarrow: ['block', 0.5],
  scrap: ['block', 0.8],
  cart: ['block', 0.9],
  cartS: ['block', 0.55],
  planter: ['block', 0.7],
  planter_box: ['block', 0.5],
  signpost: ['slab', 0.1],
  sign_shop: ['slab', 0.12],
  sign_clinic: ['slab', 0.12],
  salesign: ['slab', 0.22],
  billboard: ['slab', 0.15],
  fence: ['slab', 0.08],
  fence_wood: ['slab', 0.08],
  picket_fence: ['slab', 0.07],
  traffic_light: ['slab', 0.22],
  banner_pole: ['slab', 0.1],
  flag_pole: ['slab', 0.08],
  flag: ['slab', 0.05],
  bike_rack: ['slab', 0.4],
  scarecrow: ['slab', 0.15],
  derrick: ['slab', 0.35],
  statue_coin: ['slab', 0.35],
  bus_shelter: ['slab', 0.25],
  sack: ['puff', 0.5],
  pipe: ['puff', 0.5],
  statue: ['puff', 0.7],
  lamp: ['puff', 0.14],
  lantern: ['puff', 0.16],
  cactus: ['puff', 0.5],
  crystal: ['puff', 0.6],
  boulder: ['puff', 1.4],
  rock: ['puff', 0.9],
  rocks: ['puff', 0.4],
  rock_flat: ['puff', 0.45],
  haybale: ['puff', 1],
  beehive: ['block', 0.5],
  garden_gnome: ['puff', 0.25],
  mushroom: ['puff', 0.25],
  log: ['puff', 0.6],
  rowboat: ['puff', 0.9],
  windmill_tower: ['puff', 1.4],
  mesa: ['puff', 3],
  /* v24 */ rocks_basalt: ['puff', 0.4],
  boulder_basalt: ['puff', 1.3],
  basalt_columns: ['puff', 1.2],
  obsidian: ['puff', 0.6],
  lava_rock: ['puff', 0.8],
  steam_vent: ['puff', 0.5],
  deck_chair: ['block', 0.6],
  sailboat: ['block', 1.1],
  ski_sign: ['slab', 0.1],
  ash_sign: ['slab', 0.08],
  shell_pile: ['puff', 0.3],
  barrel: ['lathe', 0],
  barrel_wood: ['lathe', 0],
  trash: ['lathe', 0],
  trash_city: ['lathe', 0],
  hydrant: ['lathe', 0],
  bollard: ['lathe', 0],
  dock_post: ['lathe', 0],
  planter_round: ['lathe', 0],
  flowerpot: ['lathe', 0],
  streetlamp: ['lathe', 0],
  streetlamp_b: ['puff', 0.14],
  stump: ['lathe', 0],
  tires: ['lathe', 0],
  stalagmite: ['lathe', 0],
  stalagmite_b: ['lathe', 0],
  /* v32 audit: the small mushroom pictures are clusters, which a lathe turned into a dark tangle; they stay rounded */
  mushroom_brown: ['puff', 0.25],
  mushroom_blue: ['puff', 0.25],
  mushroom_giant: ['lathe', 0],
  cafe_table: ['lathe', 0],
  table: ['lathe', 0],
  snowman: ['lathe', 0],
  buoy: ['lathe', 0],
  lighthouse: ['lathe', 0],
  lava_vent: ['lathe', 0],
};
const SOLID_PROP_MATERIAL_IDS = {
  plain: 0,
  foliage: 1,
  wood: 2,
  stone: 3,
  metal: 4,
  building: 5,
  cloth: 6,
  crystal: 7,
};
export const SOLID_PROP_KINDS = [
  ['', 'Automatic'],
  ['card', 'Flat picture'],
  ['slab', 'Thin slab'],
  ['block', 'Solid block'],
  ['puff', 'Rounded'],
  ['lathe', 'Round (turned)'],
];
function solidPropsOn() {
  return typeof engineSetting === 'function' && engineSetting('world', 'solidProps') !== false && !solidPropState.fail;
}
/* v20: a prop can be built from parts: rectangles of its picture, each with its own shape. "flat" lays a band of the
   picture down as a horizontal surface (a basin's water, a table top drawn in three-quarter view); pixels outside every
   part stay a flat picture. parts: [{r:[x0,y0,x1,y1] in picture pixels, k:'lathe'|'flat'|'slab'|'block'|'puff'|'card',
   d: depth in metres (flat: front-to-back size, default as wide as the band), y: the row a flat part lies at (default
   its bottom row), open: a turned part without a lid}] */
export const SOLID_PROP_PARTS = {
  fountain: [
    { r: [52, 0, 66, 26], k: 'lathe' },
    { r: [34, 31, 85, 41], k: 'lathe', open: 1 },
    { r: [36, 25, 82, 33], k: 'flat', y: 31, disc: 1 },
    { r: [50, 38, 68, 70], k: 'lathe' },
    { r: [1, 57, 118, 69], k: 'flat', y: 68, disc: 1 },
    { r: [0, 66, 118, 88], k: 'lathe', open: 1 },
  ],
  fountain_big: [
    { r: [60, 0, 100, 13], k: 'lathe' },
    { r: [72, 12, 88, 31], k: 'lathe' },
    { r: [46, 30, 114, 41], k: 'flat', y: 40, disc: 1 },
    { r: [46, 39, 114, 48], k: 'lathe', open: 1 },
    { r: [70, 47, 90, 82], k: 'lathe' },
    { r: [0, 65, 160, 84], k: 'flat', y: 84, disc: 1 },
    { r: [0, 82, 160, 101], k: 'lathe', open: 1 },
  ],
  well: [
    { r: [0, 0, 80, 34], k: 'slab', d: 1.9 },
    { r: [12, 33, 19, 63], k: 'slab', d: 0.16 },
    { r: [61, 33, 72, 63], k: 'slab', d: 0.16 },
    { r: [10, 62, 71, 74], k: 'flat', y: 73, disc: 1 },
    { r: [10, 72, 71, 100], k: 'lathe', open: 1 },
  ],
};
provide({ SOLID_PROP_PARTS }); /* to-module */
/* what body a prop gets: {key, parts (depths in picture pixels at scale 1)} or null for a flat picture */
function solidPropSpec(k, M, PPU) {
  if (!M) return null;
  const parts = M.parts || SOLID_PROP_PARTS[k],
    tk = engineSetting('world', 'solidTrees') !== false && !M.vol && !M.parts ? solidTreeKind(k, M) : null;
  if (tk === 'pine') return { key: 'lathe|0', parts: [{ r: null, k: 'lathe', d: 0 }], tree: 'pine', rot: 0, vary: 1 };
  if (tk) return { key: 'tree|' + tk, tree: tk, rot: 1, vary: 1, wind: 1 };
  if (parts && parts.length && !(M.vol === 'card')) {
    const P = parts.map(q => ({
      r: q.r,
      k: q.k,
      d: q.d != null ? q.d * PPU : null,
      y: q.y,
      open: q.open,
      disc: q.disc,
    }));
    return { key: 'parts|' + JSON.stringify(P), parts: P };
  }
  const K = solidPropKind(k, M);
  if (!K) return null;
  const nat = /rock|boulder|cactus|stalag|crystal|stump|mushroom|log|hay/.test((M.group || '') + ' ' + k);
  let d = K[1] * PPU;
  /* v32 audit: a wide boulder or rock pile got the same depth as a narrow one and looked like a thin wedge from the side; rounded stones are now at least half as deep as they are wide */
  if (
    K[0] === 'puff' &&
    /rock|boulder|obsidian|lava_rock/.test((M.group || '') + ' ' + k) &&
    !(Array.isArray(M.vol) && M.vol[1]) &&
    !M.volDepth
  ) {
    const im = typeof artImage === 'function' ? artImage(M.img) : null,
      iw = im && (im.naturalWidth || im.width);
    if (iw) d = Math.max(d, iw * 0.5);
  }
  return { key: K[0] + '|' + Math.round(d), parts: [{ r: null, k: K[0], d }], rot: nat ? 1 : 0, vary: nat ? 1 : 0 };
}
function solidPropKind(k, M) {
  if (!M) return null;
  const v = Array.isArray(M.vol) ? M.vol : M.vol ? [M.vol, M.volDepth] : null,
    auto = SOLID_PROP_BODIES[k] || SOLID_PROP_BODIES[M.group || k];
  if (v) {
    if (v[0] === 'card') return null;
    if (['slab', 'block', 'puff', 'lathe'].includes(v[0]))
      return [v[0], +v[1] || (auto && auto[0] === v[0] ? auto[1] : 0) || 0.3];
  }
  if (M.flat || M.layers || M.build || (M.sway || 0) > 0.55) return null;
  return auto || null;
}
/* the body for one picture, built from its pixels; cached per picture and spec */
function solidPropMesh(im, spec) {
  if (!im || !(im.naturalWidth || im.width)) return null;
  /* v44: not loaded yet: nothing is cached, the picture draws meanwhile */ let per = solidPropState.meshes.get(im);
  if (!per) {
    per = new Map();
    solidPropState.meshes.set(im, per);
  }
  if (per.has(spec.key)) return per.get(spec.key);
  let M = null;
  try {
    M = spec.tree && spec.tree !== 'pine' ? buildSolidTree(im, spec.tree) : buildSolidProp(im, spec.parts);
  } catch (e) {
    M = null;
    console.warn('solid prop', e);
  }
  per.set(spec.key, M);
  return M;
}
export function buildSolidProp(im, parts) {
  const TOPS = typeof engineSetting !== 'function' || engineSetting('world', 'texDetail') !== 0;
  const w = im.naturalWidth || im.width,
    h = im.naturalHeight || im.height;
  if (!w || !h) return null;
  const c = makeCanvas(w, h),
    x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(im, 0, 0);
  const px = x.getImageData(0, 0, w, h).data;
  const A = new Uint8Array(w * h);
  let n = 0;
  for (let i = 0; i < w * h; i++)
    if (px[i * 4 + 3] > 127) {
      A[i] = 1;
      n++;
    }
  if (n < 4) return null;
  const V = [];
  const vert = (X, Y, Z, nx, ny, nz, u, v, f, id = 0) => V.push(X, Y, Z, nx, ny, nz, u, v, f, id);
  const quad = (a, b, c2, d) => {
    for (const q of [a, b, c2, a, c2, d]) vert(...q);
  };
  const used = new Uint8Array(w * h),
    e = 0.02;
  for (const part of parts) {
    const R = part.r || [0, 0, w, h],
      x0 = clamp(R[0], 0, w),
      y0 = clamp(R[1], 0, h),
      x1 = clamp(R[2], x0, w),
      y1 = clamp(R[3], y0, h),
      D = part.d ?? 0,
      kind = part.k;
    const on = (X, Y) => X >= x0 && Y >= y0 && X < x1 && Y < y1 && A[Y * w + X] === 1;
    for (let y = y0; y < y1; y++) for (let X = x0; X < x1; X++) if (A[y * w + X]) used[y * w + X] = 1;
    if (kind === 'card') {
      for (let y = y0; y < y1; y++) {
        let a = -1;
        for (let X = x0; X <= x1; X++) {
          const o = X < x1 && on(X, y);
          if (o && a < 0) a = X;
          if (!o && a >= 0) {
            quad(
              [a, y, 0, 0, 0, -1, (a + e) / w, (y + e) / h, 1],
              [X, y, 0, 0, 0, -1, (X - e) / w, (y + e) / h, 1],
              [X, y + 1, 0, 0, 0, -1, (X - e) / w, (y + 1 - e) / h, 1],
              [a, y + 1, 0, 0, 0, -1, (a + e) / w, (y + 1 - e) / h, 1]
            );
            a = -1;
          }
        }
      }
    } else if (kind === 'flat') {
      /* a band laid down flat: its bottom row in front, its top row at the back */
      let wmax = 0;
      for (let y = y0; y < y1; y++) {
        let a = -1,
          b = -1;
        for (let X = x0; X < x1; X++)
          if (on(X, y)) {
            if (a < 0) a = X;
            b = X;
          }
        if (a >= 0) wmax = Math.max(wmax, b + 1 - a);
      }
      const d = D || wmax,
        Y = part.y ?? y1;
      /* v31: a round basin lies down as an ellipse, so the band's square ends don't show as a slab's corners */
      if (part.disc) {
        const cxp = (x0 + x1) / 2,
          hw = (x1 - x0) / 2,
          ym = (y0 + y1) / 2,
          hh = (y1 - y0) / 2,
          N = 36,
          P = a => [
            cxp + Math.cos(a) * hw,
            Y,
            (Math.sin(a) * d) / 2,
            0,
            -1,
            0,
            (cxp + Math.cos(a) * (hw - e)) / w,
            (ym - Math.sin(a) * (hh - e)) / h,
            0,
          ];
        for (let k = 0; k < N; k++) {
          const a0 = (k / N) * Math.PI * 2,
            a1 = ((k + 1) / N) * Math.PI * 2;
          for (const q of [[cxp, Y, 0, 0, -1, 0, cxp / w, ym / h, 0], P(a0), P(a1)]) vert(...q);
        }
        continue;
      }
      quad(
        [x0, Y, -d / 2, 0, -1, 0, (x0 + e) / w, (y1 - e) / h, 0],
        [x1, Y, -d / 2, 0, -1, 0, (x1 - e) / w, (y1 - e) / h, 0],
        [x1, Y, d / 2, 0, -1, 0, (x1 - e) / w, (y0 + e) / h, 0],
        [x0, Y, d / 2, 0, -1, 0, (x0 + e) / w, (y0 + e) / h, 0]
      );
    } else if (kind === 'lathe') {
      /* turned on a lathe: each row of the part becomes a ring as wide as the shape is at that row (the
    run of pixels around the part's middle, so a stream of water beside a basin doesn't widen it), round from every
    side; seen from the front the rings show the picture exactly */
      let sx = 0,
        sn = 0;
      for (let y = y0; y < y1; y++) {
        let a = -1,
          b = -1;
        for (let X = x0; X < x1; X++)
          if (on(X, y)) {
            if (a < 0) a = X;
            b = X;
          }
        if (a >= 0) {
          sx += (a + b + 1) / 2;
          sn++;
        }
      }
      if (!sn) continue;
      const cx0 = sx / sn;
      const span = new Float32Array(h).fill(0);
      let cs = 0,
        cn = 0;
      const runs = [];
      for (let y = y0; y < y1; y++) {
        let best = null,
          bd = 1e9,
          a = -1;
        for (let X = x0; X <= x1; X++) {
          const o = X < x1 && on(X, y);
          if (o && a < 0) a = X;
          if (!o && a >= 0) {
            const m = (a + X) / 2,
              dd = m < cx0 ? Math.max(0, a - cx0) : Math.max(0, cx0 - X);
            const d2 = a <= cx0 && X >= cx0 ? 0 : Math.min(Math.abs(a - cx0), Math.abs(X - cx0));
            if (d2 < bd) {
              bd = d2;
              best = [a, X];
            }
            a = -1;
          }
        }
        runs[y] = best;
        if (best) {
          cs += (best[0] + best[1]) / 2;
          cn++;
        }
      }
      const cx = cn ? cs / cn : cx0;
      for (let y = y0; y < y1; y++) {
        const b2 = runs[y];
        span[y] = b2 ? Math.max(cx - b2[0], b2[1] - cx) : 0;
      }
      const Rr = y => (y >= y0 && y < y1 ? span[y] : 0),
        seg = 18,
        ang = k => -Math.PI + (2 * Math.PI * k) / seg;
      const ringP = (r, Y, k, ny, v) => {
        const t = ang(k),
          si = Math.sin(t),
          co = Math.cos(t),
          rr = Math.max(0, r - 0.5);
        return [cx + r * si, Y, -r * co, ny ? 0 : si, ny, ny ? 0 : -co, (cx + rr * si) / w, v, 0];
      };
      let y = y0;
      while (y < y1) {
        const r = Rr(y);
        let ye = y + 1;
        while (ye < y1 && Math.abs(Rr(ye) - r) < 0.01) ye++;
        if (r > 0) {
          for (let k = 0; k < seg; k++)
            quad(
              ringP(r, y, k, 0, (y + 0.02) / h),
              ringP(r, y, k + 1, 0, (y + 0.02) / h),
              ringP(r, ye, k + 1, 0, (ye - 0.02) / h),
              ringP(r, ye, k, 0, (ye - 0.02) / h)
            );
          const above = Rr(y - 1);
          if (r > above + 0.01 && !(part.open && above <= 0)) {
            const v = (y + 0.5) / h;
            for (let k = 0; k < seg; k++)
              quad(
                ringP(above, y, k, -1, v),
                ringP(above, y, k + 1, -1, v),
                ringP(r, y, k + 1, -1, v),
                ringP(r, y, k, -1, v)
              );
          }
          const below = Rr(ye);
          if (r > below + 0.01) {
            const v = (ye - 0.5) / h;
            for (let k = 0; k < seg; k++)
              quad(
                ringP(below, ye, k, 1, v),
                ringP(below, ye, k + 1, 1, v),
                ringP(r, ye, k + 1, 1, v),
                ringP(r, ye, k, 1, v)
              );
          }
        }
        y = ye;
      }
    } else if (kind === 'puff') {
      /* distance to the outline (3-4 chamfer), then a rounded height: thickest where the shape is widest */
      const pw = x1 - x0,
        ph = y1 - y0;
      if (pw < 1 || ph < 1) continue;
      const dist = new Float32Array(pw * ph);
      for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) dist[j * pw + i] = on(x0 + i, y0 + j) ? 1e6 : 0;
      const pass = (i, j, o) => {
        if (i < 0 || j < 0 || i >= pw || j >= ph) return 0;
        return dist[j * pw + i] + o;
      };
      for (let j = 0; j < ph; j++)
        for (let i = 0; i < pw; i++) {
          const q = j * pw + i;
          if (!dist[q]) continue;
          dist[q] = Math.min(
            dist[q],
            pass(i - 1, j, 3),
            pass(i, j - 1, 3),
            pass(i - 1, j - 1, 4),
            pass(i + 1, j - 1, 4)
          );
        }
      for (let j = ph - 1; j >= 0; j--)
        for (let i = pw - 1; i >= 0; i--) {
          const q = j * pw + i;
          if (!dist[q]) continue;
          dist[q] = Math.min(
            dist[q],
            pass(i + 1, j, 3),
            pass(i, j + 1, 3),
            pass(i + 1, j + 1, 4),
            pass(i - 1, j + 1, 4)
          );
        }
      let dm = 1;
      for (let i = 0; i < pw * ph; i++) dm = Math.max(dm, dist[i]);
      const g = Math.max(1, Math.round(Math.max(pw, ph) / 56)),
        gw = Math.ceil(pw / g),
        gh = Math.ceil(ph / g);
      const H = (X, Y) => {
        X = clamp(Math.round(X), 0, pw - 1);
        Y = clamp(Math.round(Y), 0, ph - 1);
        let s2 = 0,
          k = 0;
        for (const [a, b] of [
          [0, 0],
          [-1, 0],
          [0, -1],
          [-1, -1],
        ]) {
          const xx = X + a,
            yy = Y + b;
          if (xx < 0 || yy < 0) continue;
          const q = yy * pw + xx;
          s2 += dist[q] ? Math.sqrt(dist[q] / dm) : 0;
          k++;
        }
        return k ? (s2 / k) * D * 0.5 : 0;
      };
      const hv = new Float32Array((gw + 1) * (gh + 1));
      for (let j = 0; j <= gh; j++) for (let i = 0; i <= gw; i++) hv[j * (gw + 1) + i] = H(i * g, j * g);
      const hAt = (i, j) => hv[clamp(j, 0, gh) * (gw + 1) + clamp(i, 0, gw)];
      const cellOn = (i, j) => {
        for (let y = j * g; y < Math.min(ph, (j + 1) * g); y++)
          for (let X = i * g; X < Math.min(pw, (i + 1) * g); X++) if (dist[y * pw + X]) return true;
        return false;
      };
      for (const side of [-1, 1]) {
        /* front (toward the camera, -z) and back */
        const P = (i, j) => {
          const hx = (hAt(i + 1, j) - hAt(i - 1, j)) / (2 * g),
            hy = (hAt(i, j + 1) - hAt(i, j - 1)) / (2 * g),
            l = Math.hypot(hx, hy, 1) || 1;
          const X = x0 + Math.min(pw, i * g),
            Y = y0 + Math.min(ph, j * g);
          return [X, Y, side * hAt(i, j), -hx / l, -hy / l, side / l, X / w, Y / h, side < 0 ? 1 : 2];
        };
        for (let j = 0; j < gh; j++)
          for (let i = 0; i < gw; i++) {
            if (!cellOn(i, j)) continue;
            quad(P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1));
          }
      }
    } else {
      /* a board or a block: front and back pictures, and an edge face along every run of outline pixels */
      const z0 = kind === 'slab' ? -D / 2 : 0,
        z1 = kind === 'slab' ? D / 2 : D;
      quad(
        [x0, y0, z0, 0, 0, -1, x0 / w, y0 / h, 1],
        [x1, y0, z0, 0, 0, -1, x1 / w, y0 / h, 1],
        [x1, y1, z0, 0, 0, -1, x1 / w, y1 / h, 1],
        [x0, y1, z0, 0, 0, -1, x0 / w, y1 / h, 1]
      );
      quad(
        [x0, y0, z1, 0, 0, 1, x0 / w, y0 / h, 2],
        [x1, y0, z1, 0, 0, 1, x1 / w, y0 / h, 2],
        [x1, y1, z1, 0, 0, 1, x1 / w, y1 / h, 2],
        [x0, y1, z1, 0, 0, 1, x0 / w, y1 / h, 2]
      );
      /* the edge faces take the colour one pixel in from the outline (the art's dark 1-pixel outline would make every edge
      black); where the shape is only a pixel thick they take the outline pixel itself */
      for (let y = y0; y < y1; y++)
        for (const [dy, ny] of [
          [-1, -1],
          [1, 1],
        ]) {
          let xa = -1,
            r0 = -1;
          for (let X = x0; X <= x1; X++) {
            const edge = X < x1 && on(X, y) && !on(X, y + dy),
              r = edge ? (on(X, y - dy) ? y - dy : y) : -1;
            if (xa >= 0 && (!edge || r !== r0)) {
              const Y = dy < 0 ? y : y + 1,
                v = (r0 + 0.5) / h,
                u0 = (xa + e) / w,
                u1 = (X - e) / w;
              /* v32: a top runs back over the rows just inside the outline (where 3/4-view art draws a top), instead of one pixel row smeared from front to back */
              /* each column runs as deep as the shape lets it (columns with the same depth share one face) */
              if (dy < 0 && TOPS) {
                const kmax = Math.min(12, Math.floor(Math.abs(z1 - z0) * 0.6)),
                  kc = c => {
                    let n2 = 0;
                    while (n2 <= kmax && on(c, r0 + n2)) n2++;
                    return Math.max(0, n2 - 1);
                  };
                let ca = xa,
                  ka = kc(xa);
                for (let c = xa + 1; c <= X; c++) {
                  const kk = c < X ? kc(c) : -1;
                  if (kk !== ka) {
                    const U0 = (ca + e) / w,
                      U1 = (c - e) / w,
                      vf = (r0 + 0.5 + ka) / h;
                    quad(
                      [ca, Y, z0, 0, ny, 0, U0, vf, 0],
                      [c, Y, z0, 0, ny, 0, U1, vf, 0],
                      [c, Y, z1, 0, ny, 0, U1, v, 0],
                      [ca, Y, z1, 0, ny, 0, U0, v, 0]
                    );
                    ca = c;
                    ka = kk;
                  }
                }
              } else
                quad(
                  [xa, Y, z0, 0, ny, 0, u0, v, 0],
                  [X, Y, z0, 0, ny, 0, u1, v, 0],
                  [X, Y, z1, 0, ny, 0, u1, v, 0],
                  [xa, Y, z1, 0, ny, 0, u0, v, 0]
                );
              xa = -1;
            }
            if (edge && xa < 0) {
              xa = X;
              r0 = r;
            }
          }
        }
      for (let X = x0; X < x1; X++)
        for (const [dx, nx] of [
          [-1, -1],
          [1, 1],
        ]) {
          let ya = -1,
            c0 = -1;
          for (let y = y0; y <= y1; y++) {
            const edge = y < y1 && on(X, y) && !on(X + dx, y),
              c2 = edge ? (on(X - dx, y) ? X - dx : X) : -1;
            if (ya >= 0 && (!edge || c2 !== c0)) {
              const XX = dx < 0 ? X : X + 1,
                u = (c0 + 0.5) / w,
                v0 = (ya + e) / h,
                v1 = (y - e) / h;
              /* v32: likewise a side runs over the columns just inside the outline */
              let k = 0;
              if (TOPS) {
                const kmax = Math.min(6, Math.floor(Math.abs(z1 - z0) * 0.4));
                k = kmax;
                for (let q2 = ya; q2 < y && k > 0; q2++) {
                  let n2 = 0;
                  while (n2 <= k && on(c0 - dx * n2, q2)) n2++;
                  k = Math.min(k, n2 - 1);
                }
              }
              const ub = (c0 - dx * k + 0.5) / w;
              quad(
                [XX, ya, z0, nx, 0, 0, u, v0, 0],
                [XX, y, z0, nx, 0, 0, u, v1, 0],
                [XX, y, z1, nx, 0, 0, ub, v1, 0],
                [XX, ya, z1, nx, 0, 0, ub, v0, 0]
              );
              ya = -1;
            }
            if (edge && ya < 0) {
              ya = y;
              c0 = c2;
            }
          }
        }
    }
  }
  /* with parts, whatever no part covers stays a flat picture (streams of water, sparkles, ropes) */
  if (parts.length && parts[0].r) {
    for (let y = 0; y < h; y++) {
      let a = -1;
      for (let X = 0; X <= w; X++) {
        const o = X < w && A[y * w + X] && !used[y * w + X];
        if (o && a < 0) a = X;
        if (!o && a >= 0) {
          quad(
            [a, y, 0, 0, 0, -1, (a + e) / w, (y + e) / h, 1],
            [X, y, 0, 0, 0, -1, (X - e) / w, (y + e) / h, 1],
            [X, y + 1, 0, 0, 0, -1, (X - e) / w, (y + 1 - e) / h, 1],
            [a, y + 1, 0, 0, 0, -1, (a + e) / w, (y + 1 - e) / h, 1]
          );
          a = -1;
        }
      }
    }
  }
  return uploadSolidPropMesh(V);
}
function uploadSolidPropMesh(V, extra) {
  if (!V.length) return null;
  const gl = gpuState.gl,
    vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(V), gl.STATIC_DRAW);
  for (const [l, k, o] of [
    [0, 3, 0],
    [1, 3, 3],
    [2, 2, 6],
    [3, 1, 8],
    [4, 1, 9],
  ]) {
    gl.enableVertexAttribArray(l);
    gl.vertexAttribPointer(l, k, gl.FLOAT, false, 40, o * 4);
    gl.vertexAttribDivisor(l, 0);
  }
  gl.bindVertexArray(null);
  const m = Object.assign({ vao, vb, n: V.length / 10 }, extra || {});
  solidPropState.live.set(m, gl);
  return m;
}
/* drops every body built so far and frees its buffers (a rebuild from the settings builds them again; dropping the
   cache alone left each rebuild's buffers on the graphics chip) */
function flushSolidPropMeshes() {
  const gl = typeof gpuState !== 'undefined' && gpuState.gl;
  /* (only those of the context in use: a lost one's are gone already) */
  for (const [m, g] of solidPropState.live)
    if (g === gl) {
      gl.deleteVertexArray(m.vao);
      gl.deleteBuffer(m.vb);
    }
  solidPropState.live.clear();
  solidPropState.meshes = new WeakMap();
}
/* ---------- v21: trees and bushes ----------
   A tree keeps its picture, cut into pieces: the trunk (the narrow part at the bottom) is turned round, and continues up
   inside the crown; the crown is split into 5 to 14 clumps (groups of nearby leaf pixels), each a small rounded piece
   placed at its own depth on an egg-shaped crown, with a copy behind and a darker core in the middle, so a turned
   camera sees a full crown. Each clump sways on its own in the wind. Seen from the front the pieces show the picture
   exactly. A copy of the picture carries each pixel's piece in its alpha (128 + piece), so a clump never shows its
   neighbours' pixels. Pines are turned whole: their tiers become a cone. */
export function solidTreeKind(k, M) {
  const g = M.group || k;
  if (/^tree_pine/.test(g)) return 'pine';
  if (/^(tree|tree_oak|tree_birch|tree_blossom|tree_fruit|tree_maple|tree_street|tree_willow)$/.test(g)) return 'tree';
  if (/^(bush|bush_round|bush_berry|bush_flower|dry_bush)$/.test(g)) return 'bush';
  return null;
}
export function buildSolidTree(im, kind) {
  const w = im.naturalWidth || im.width,
    h = im.naturalHeight || im.height;
  if (!w || !h) return null;
  const c = makeCanvas(w, h),
    x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(im, 0, 0);
  const D = x.getImageData(0, 0, w, h),
    px = D.data;
  const A = new Uint8Array(w * h),
    cnt = new Int16Array(h);
  let maxC = 0;
  for (let y = 0; y < h; y++) {
    for (let X = 0; X < w; X++)
      if (px[(y * w + X) * 4 + 3] > 127) {
        A[y * w + X] = 1;
        cnt[y]++;
      }
    maxC = Math.max(maxC, cnt[y]);
  }
  if (maxC < 2) return null;
  const id = new Int16Array(w * h).fill(-1);
  /* the trunk: rows at the bottom much narrower than the crown */
  let yc = h;
  if (kind === 'tree') {
    let y = h - 1;
    while (y > 0 && (cnt[y] === 0 || cnt[y] < maxC * 0.28)) y--;
    yc = y + 1;
    if (h - yc < 3) yc = h;
  }
  let tcx = w / 2,
    tn = 0,
    ts = 0;
  for (let y = yc; y < h; y++) {
    let best = null,
      a = -1;
    for (let X = 0; X <= w; X++) {
      const o = X < w && A[y * w + X];
      if (o && a < 0) a = X;
      if (!o && a >= 0) {
        if (!best || X - a > best[1] - best[0]) best = [a, X];
        a = -1;
      }
    }
    if (best) {
      ts += (best[0] + best[1]) / 2;
      tn++;
    }
  }
  if (tn) tcx = ts / tn;
  const trunkRun = [];
  for (let y = yc; y < h; y++) {
    let best = null,
      bd = 1e9,
      a = -1;
    for (let X = 0; X <= w; X++) {
      const o = X < w && A[y * w + X];
      if (o && a < 0) a = X;
      if (!o && a >= 0) {
        const d = a <= tcx && X >= tcx ? 0 : Math.min(Math.abs(a - tcx), Math.abs(X - tcx));
        if (d < bd) {
          bd = d;
          best = [a, X];
        }
        a = -1;
      }
    }
    trunkRun[y] = best;
    if (best) for (let X = best[0]; X < best[1]; X++) id[y * w + X] = 0;
  }
  /* the crown: everything else, in clumps (k-means on position) */
  const cx = [],
    cy = [];
  for (let y = 0; y < h; y++)
    for (let X = 0; X < w; X++)
      if (A[y * w + X] && id[y * w + X] < 0) {
        cx.push(X);
        cy.push(y);
      }
  const n = cx.length;
  let K = kind === 'bush' ? clamp(Math.round(n / 260), 3, 7) : clamp(Math.round(n / 420), 5, 14);
  if (n < K * 6) K = Math.max(1, Math.floor(n / 6));
  const ord = [...Array(n).keys()].sort((a, b) => {
    const ra = Math.floor(cy[a] / 12),
      rb = Math.floor(cy[b] / 12);
    return ra !== rb ? ra - rb : ra % 2 ? cx[b] - cx[a] : cx[a] - cx[b];
  });
  const mx = [],
    my = [];
  for (let k = 0; k < K; k++) {
    const q = ord[Math.floor(((k + 0.5) * n) / K)];
    mx.push(cx[q]);
    my.push(cy[q]);
  }
  const lab = new Int16Array(n);
  for (let it = 0; it < 8; it++) {
    const sx = new Float64Array(K),
      sy = new Float64Array(K),
      sn = new Float64Array(K);
    for (let i = 0; i < n; i++) {
      let b = 0,
        bd = 1e18;
      for (let k = 0; k < K; k++) {
        const dx = cx[i] - mx[k],
          dy = (cy[i] - my[k]) * 1.15,
          d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          b = k;
        }
      }
      lab[i] = b;
      sx[b] += cx[i];
      sy[b] += cy[i];
      sn[b]++;
    }
    for (let k = 0; k < K; k++)
      if (sn[k]) {
        mx[k] = sx[k] / sn[k];
        my[k] = sy[k] / sn[k];
      }
  }
  for (let i = 0; i < n; i++) id[cy[i] * w + cx[i]] = lab[i] + 1;
  /* the picture with each pixel's piece in its alpha */
  const tc = makeCanvas(w, h),
    tx = tc.getContext('2d'),
    img = tx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    if (!A[i]) continue;
    img.data[i * 4] = px[i * 4];
    img.data[i * 4 + 1] = px[i * 4 + 1];
    img.data[i * 4 + 2] = px[i * 4 + 2];
    img.data[i * 4 + 3] = 128 + id[i];
  }
  tx.putImageData(img, 0, 0);
  const V = [];
  const vert = (...a) => V.push(...a);
  const quad = (a, b, c2, d) => {
    for (const q of [a, b, c2, a, c2, d]) vert(...q);
  };
  /* crown size */
  let x0 = w,
    x1 = 0,
    y0 = h,
    y1 = 0;
  for (let i = 0; i < n; i++) {
    x0 = Math.min(x0, cx[i]);
    x1 = Math.max(x1, cx[i]);
    y0 = Math.min(y0, cy[i]);
    y1 = Math.max(y1, cy[i]);
  }
  const ccx = (x0 + x1 + 1) / 2,
    ccy = (y0 + y1 + 1) / 2,
    R = Math.max(4, (x1 + 1 - x0) / 2),
    Ry = Math.max(4, (y1 + 1 - y0) / 2);
  /* trunk, turned, and on up inside the crown */
  if (yc < h) {
    const seg = 10,
      ang = k => -Math.PI + (2 * Math.PI * k) / seg,
      rad = y => {
        const r = trunkRun[y];
        return r ? Math.max(tcx - r[0], r[1] - tcx) : 0;
      };
    const ring = (r, Y, k, v) => {
      const t = ang(k),
        si = Math.sin(t),
        co = Math.cos(t),
        rr = Math.max(0, r - 0.5);
      return [tcx + r * si, Y, -r * co, si, 0, -co, (tcx + rr * si) / w, v, 0, 0];
    };
    let y = yc;
    while (y < h) {
      const r = rad(y);
      let ye = y + 1;
      while (ye < h && Math.abs(rad(ye) - r) < 0.01) ye++;
      if (r > 0)
        for (let k = 0; k < seg; k++)
          quad(
            ring(r, y, k, (y + 0.02) / h),
            ring(r, y, k + 1, (y + 0.02) / h),
            ring(r, ye, k + 1, (ye - 0.02) / h),
            ring(r, ye, k, (ye - 0.02) / h)
          );
      y = ye;
    }
    const rt = Math.max(1, rad(Math.min(h - 1, yc + 1)) * 0.8),
      ytop = Math.max(0, yc - (yc - y0) * 0.5),
      v = (yc + 1.5) / h;
    for (let k = 0; k < seg; k++)
      quad(ring(rt, ytop, k, v), ring(rt, ytop, k + 1, v), ring(rt, yc, k + 1, v), ring(rt, yc, k, v));
  }
  /* the dark core: the crown's own picture, flat in the middle */
  const e = 0.02;
  for (let y = y0; y <= y1; y++) {
    let a = -1;
    for (let X = x0; X <= x1 + 1; X++) {
      const o = X <= x1 && id[y * w + X] > 0;
      if (o && a < 0) a = X;
      if (!o && a >= 0) {
        quad(
          [a, y, 0, 0, 0, -1, (a + e) / w, (y + e) / h, 3, -1],
          [X, y, 0, 0, 0, -1, (X - e) / w, (y + e) / h, 3, -1],
          [X, y + 1, 0, 0, 0, -1, (X - e) / w, (y + 1 - e) / h, 3, -1],
          [a, y + 1, 0, 0, 0, -1, (a + e) / w, (y + 1 - e) / h, 3, -1]
        );
        a = -1;
      }
    }
  }
  /* the clumps, each rounded, at the front and again at the back */
  for (let k = 1; k <= K; k++) {
    let bx0 = w,
      bx1 = -1,
      by0 = h,
      by1 = -1;
    for (let y = y0; y <= y1; y++)
      for (let X = x0; X <= x1; X++)
        if (id[y * w + X] === k) {
          bx0 = Math.min(bx0, X);
          bx1 = Math.max(bx1, X);
          by0 = Math.min(by0, y);
          by1 = Math.max(by1, y);
        }
    if (bx1 < 0) continue;
    const bw = bx1 + 1 - bx0,
      bh = by1 + 1 - by0,
      dist = new Float32Array(bw * bh);
    for (let j = 0; j < bh; j++)
      for (let i = 0; i < bw; i++) dist[j * bw + i] = id[(by0 + j) * w + bx0 + i] === k ? 1e6 : 0;
    const pass = (i, j, o) => (i < 0 || j < 0 || i >= bw || j >= bh ? 0 : dist[j * bw + i] + o);
    for (let j = 0; j < bh; j++)
      for (let i = 0; i < bw; i++) {
        const q = j * bw + i;
        if (!dist[q]) continue;
        dist[q] = Math.min(dist[q], pass(i - 1, j, 3), pass(i, j - 1, 3), pass(i - 1, j - 1, 4), pass(i + 1, j - 1, 4));
      }
    for (let j = bh - 1; j >= 0; j--)
      for (let i = bw - 1; i >= 0; i--) {
        const q = j * bw + i;
        if (!dist[q]) continue;
        dist[q] = Math.min(dist[q], pass(i + 1, j, 3), pass(i, j + 1, 3), pass(i + 1, j + 1, 4), pass(i - 1, j + 1, 4));
      }
    let dm = 1;
    for (const d of dist) dm = Math.max(dm, d);
    const g = Math.max(1, Math.ceil(Math.max(bw, bh) / 7)),
      gw = Math.ceil(bw / g),
      gh = Math.ceil(bh / g),
      bulge = Math.min(bw, bh) * 0.5;
    const H = (X, Y) => {
      X = clamp(Math.round(X), 0, bw - 1);
      Y = clamp(Math.round(Y), 0, bh - 1);
      let s2 = 0,
        c2 = 0;
      for (const [a, b] of [
        [0, 0],
        [-1, 0],
        [0, -1],
        [-1, -1],
      ]) {
        const xx = X + a,
          yy = Y + b;
        if (xx < 0 || yy < 0) continue;
        const q = yy * bw + xx;
        s2 += dist[q] ? Math.sqrt(dist[q] / dm) : 0;
        c2++;
      }
      return c2 ? (s2 / c2) * bulge : 0;
    };
    const hv = new Float32Array((gw + 1) * (gh + 1));
    for (let j = 0; j <= gh; j++) for (let i = 0; i <= gw; i++) hv[j * (gw + 1) + i] = H(i * g, j * g);
    const hAt = (i, j) => hv[clamp(j, 0, gh) * (gw + 1) + clamp(i, 0, gw)];
    const cellOn = (i, j) => {
      for (let y = j * g; y < Math.min(bh, (j + 1) * g); y++)
        for (let X = i * g; X < Math.min(bw, (i + 1) * g); X++) if (dist[y * bw + X]) return true;
      return false;
    };
    let sx = 0,
      sy = 0,
      sn = 0;
    for (let j = 0; j < bh; j++)
      for (let i = 0; i < bw; i++)
        if (dist[j * bw + i]) {
          sx += bx0 + i;
          sy += by0 + j;
          sn++;
        }
    const nx = (sx / sn - ccx) / R,
      ny = (sy / sn - ccy) / Ry,
      zc = Math.sqrt(Math.max(0.06, 1 - nx * nx - 0.35 * ny * ny)) * R * (kind === 'bush' ? 0.42 : 0.5);
    for (const side of [-1, 1]) {
      const P = (i, j) => {
        const hx = (hAt(i + 1, j) - hAt(i - 1, j)) / (2 * g),
          hy = (hAt(i, j + 1) - hAt(i, j - 1)) / (2 * g),
          l = Math.hypot(hx, hy, 1) || 1,
          X = bx0 + Math.min(bw, i * g),
          Y = by0 + Math.min(bh, j * g);
        /* lit mostly as one big crown (an egg around the crown's middle), a little as its own clump, so the crown reads
       as one mass of leaves rather than scales */
        const Z = side * (zc + hAt(i, j)),
          ex = (X - ccx) / R,
          ey = (Y - ccy) / Ry,
          ez = Z / (R * 0.6),
          el = Math.hypot(ex, ey, ez) || 1,
          bx = (ex / el) * 0.72 - (hx / l) * 0.28,
          by = (ey / el) * 0.72 - (hy / l) * 0.28,
          bz = (ez / el) * 0.72 + (side / l) * 0.28,
          bl = Math.hypot(bx, by, bz) || 1;
        return [X, Y, Z, bx / bl, by / bl, bz / bl, X / w, Y / h, side < 0 ? 1 : 2, k];
      };
      for (let j = 0; j < gh; j++)
        for (let i = 0; i < gw; i++) {
          if (cellOn(i, j)) quad(P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1));
        }
    }
  }
  return uploadSolidPropMesh(V, { tex: tc, clumps: K });
}
const SOLID_PROP_VERTEX_GLSL = `layout(location=0) in vec3 qPos;layout(location=1) in vec3 qNrm;layout(location=2) in vec2 qUV;layout(location=3) in float qFace;layout(location=4) in float qId;
uniform mat4 uVP;uniform vec3 uBase;uniform vec2 uOff,uTilt;uniform float uS,uFlip,uShear,uT,uWob,uRot;
vec3 p3dPos(out vec3 nOut){float h=-(uOff.y+qPos.y)*uS;vec2 lp=vec2((uOff.x+qPos.x)*uS*uFlip+uShear*h,qPos.z*uS);
 /* alpha 0.4: a tree's clumps bend with the place's one wind (windBend, as the grass), each with a little sway of its own */
 if(qId>.5&&uWob>0.){float hm=max(.5,-uOff.y*uS),k=clamp(h/hm,0.,1.),ph=uT*.0016+qId*1.9,wb=windBend(uBase.xz,uT,1.)*4.6;lp+=vec2(wb+sin(ph)*.22,cos(ph*.8+qId)*.1+wb*.18)*uWob*k;}
 float cr=cos(uRot),sr=sin(uRot);lp=vec2(lp.x*cr-lp.y*sr,lp.x*sr+lp.y*cr);vec3 n=vec3(qNrm.x*uFlip,-qNrm.y,qNrm.z);nOut=vec3(n.x*cr-n.z*sr,n.y,n.x*sr+n.z*cr);
 vec3 p=uBase+vec3(lp.x,h+dot(lp,uTilt),lp.y);p.y+=curveY(uBase.xz);return p;}`;
export const SOLID_PROP_SHADERS = {
  p3d: [
    `#version 300 es
precision highp float;${COMMON_GLSL}${SOLID_PROP_VERTEX_GLSL}out vec3 vW;out vec3 vN;out vec2 vUV;out float vFace;out float vId;
void main(){vec3 n;vec3 p=p3dPos(n);vW=p;vN=n;vUV=qUV;vFace=qFace;vId=qId;gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec3 vW;in vec3 vN;in vec2 vUV;in float vFace;in float vId;out vec4 o;uniform sampler2D uTex,uNrm;uniform float uFade,uFlip,uEmit,uRim,uClump,uRot;uniform vec4 uMat;uniform vec3 uBaseP,uVar;uniform vec4 uDet;${LIGHT_GLSL}${LOOK_GLSL}
float bay(vec2 p){ivec2 i=ivec2(mod(p,4.));int b[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);return (float(b[i.y*4+i.x])+.5)/16.;}
void main(){vec4 c=(vFace>.5&&uClump<.5)?texture(uTex,vUV):textureLod(uTex,vUV,0.);if(c.a<.5)discard;
 if(uClump>.5){float id=floor(c.a*255.+.5)-128.;if(vId<-.5){if(id<.5)discard;}else if(abs(id-vId)>.5)discard;}
 if(uFade<.99&&bay(gl_FragCoord.xy)>uFade)discard;c.rgb*=uVar;
 vec3 n=normalize(vN);if(vFace>.5){vec3 nn=texture(uNrm,vUV).xyz*2.-1.;float sx=vFace>1.5&&vFace<2.5?-1.:1.;vec3 t=vec3(nn.x*uFlip*sx,-nn.y,0.);t.xz=vec2(t.x*cos(uRot)-t.z*sin(uRot),t.x*sin(uRot)+t.z*cos(uRot));n=normalize(n*max(nn.z,.35)+t*.7);}
 float hy=vW.y-uBaseP.y;c.rgb=lookOn(c.rgb,floor(vUV*vec2(textureSize(uTex,0))),clamp(hy/2.5,0.,1.),uBaseP);
 /* v32: surface detail by material, in the picture's own pixel size. The sides, tops and backs a solid prop grows
    (one pixel's colour drawn out) get grain, grit and rings so they read as wood, stone or metal; the drawn front
    only gets a light touch so the art stays as drawn */
 if(uDet.y>0.){vec3 q=floor((vW-uBaseP)*uDet.z+.001);float hq=fract(sin(dot(q,vec3(12.9898,78.233,37.719)))*43758.5),side=vFace<.5?1.:.3,m=uDet.x,d=0.;
  if(m>1.5&&m<2.5){if(vFace<.5&&abs(n.y)>.7){float rr=length(vW.xz-uBaseP.xz)*uDet.z;d=(step(.55,fract(rr*.19))-.5)*.2+(hq-.5)*.05;}
   else{vec2 g=abs(n.x)>abs(n.z)?q.zy:q.xy;d=(lnoise(vec2(g.x*.06,g.y*.55))-.5)*.3+(hq-.5)*.06;}}
  else if(m>2.5&&m<3.5)d=(hq-.5)*.16-step(.94,hq)*.14+(lnoise(q.xz*.15+q.y*.11)-.5)*.12;
  else if(m>3.5&&m<4.5)d=(hq-.5)*.05+(lnoise(vec2(q.y*.4,(q.x+q.z)*.03))-.5)*.1;
  else if(m>.5&&m<1.5)d=(hq-.5)*.14;
  else if(m>4.5&&m<5.5)d=(hq-.5)*.06-step(.96,hq)*.08;
  else d=(hq-.5)*.06;
  c.rgb*=1.+d*side*uDet.y;}
 c.rgb=snowOn(seasonal(c.rgb,uBaseP),vW,n.y);float sh=shadowAtN(vW+n*.04,n,.0012),ao=mix(contactAO(vW),1.,clamp(hy*2.,0.,1.)),occ=min(sh,ao);if(vFace>2.5)occ*=.7;
 vec3 v=normalize(uEye-vW);float nl=dot(n,uSunDir),wr=(nl+uMat.w)/(1.+uMat.w);float spc=pow(max(dot(n,normalize(uSunDir+v)),0.),uMat.y)*uMat.x*occ,rim=pow(1.-max(dot(n,v),0.),3.)*uRim;
 float trn=uMat.z*(pow(max(dot(-v,uSunDir),0.),2.)*.8+max(-nl,0.)*.35)*sh;
 vec3 lit=shade(c.rgb,n,vW,sh,ao,vec4(uMat.x,uMat.y,0.,uMat.w),0.)+c.rgb*rim*uSunCol*sh;o=vec4(fogit(lit+c.rgb*uSunCol*trn+c.rgb*uEmit,vW),1.);}`,
  ],
  p3dS: [
    `#version 300 es
precision highp float;${COMMON_GLSL}${SOLID_PROP_VERTEX_GLSL}out vec2 vUV;out float vId;
void main(){vec3 n;vec3 p=p3dPos(n);vUV=qUV;vId=qId;gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec2 vUV;in float vId;uniform sampler2D uTex;uniform float uClump;out vec4 o;void main(){vec4 c=textureLod(uTex,vUV,0.);if(c.a<.5)discard;if(uClump>.5){float id=floor(c.a*255.+.5)-128.;if(vId<-.5){if(id<.5)discard;}else if(abs(id-vId)>.5)discard;}o=vec4(1.);}`,
  ],
};
provide({ SOLID_PROP_SHADERS }); /* to-module */
function solidPropGuard(fn) {
  if (solidPropState.fail) return;
  try {
    fn();
  } catch (e) {
    solidPropState.fail = String((e && e.message) || e);
    console.error('Solid props off: ' + solidPropState.fail);
    if (typeof debugLog !== 'undefined') debugLog.add('webgl', 'Solid props off: ' + solidPropState.fail);
  }
}
/* which items get a body this frame (filled in by gatherFrameItems) */
function tagSolidProp(it, PPU) {
  if (
    !solidPropsOn() ||
    it.k !== 'prop' ||
    it.far ||
    it.layer ||
    it.flat ||
    it.bld3 ||
    it.glow ||
    it.vox ||
    it.voxImg ||
    (it.p && (it.p.vol === 'card' || it.p._nosolid)) ||
    !it.im ||
    !(it.im.naturalWidth || it.im.width)
  )
    return;
  if (it.M.face === 'billboard') return;
  if (it.mat === 'building' && it.M.box && !it.M.parts) return;
  const sp = solidPropSpec(it.p.k, it.M, PPU);
  if (sp) it.vol = sp;
}
/* level of detail: solid trees near the camera's focus only (the nearest few dozen within about 20 m), solid props
   within about 32 m; the rest stay pictures, which from that far look the same */
function solidPropLevelOfDetail(items, C) {
  const P = walkView.pl,
    bc =
      walkRenderer.bt &&
      (walkRenderer.bt.center || (walkRenderer.bt.look && [walkRenderer.bt.look.tgt[0], walkRenderer.bt.look.tgt[2]])),
    fx = bc ? bc[0] : P.x,
    fz = bc ? bc[1] : P.z,
    tr = engineSetting('world', 'treeDetail') ?? 20,
    cap = Math.round(engineSetting('world', 'treeCount') ?? 40),
    T = [];
  for (const it of items) {
    if (!it.vol) continue;
    const d = Math.hypot(it.x - fx, (it.z - fz) * 0.8);
    if (it.vol.tree) {
      if (d > tr) it.vol = null;
      else T.push([d, it]);
    } else if (d > 32) it.vol = null;
  }
  if (T.length > cap) {
    T.sort((a, b) => a[0] - b[0]);
    for (let i = cap; i < T.length; i++) T[i][1].vol = null;
  }
  /* v32: a body not yet built is built within this frame's time budget; past it the prop stays a picture for now */
  let built = 0;
  for (const it of items) {
    if (!it.vol) continue;
    const per = solidPropState.meshes.get(it.im);
    if (per && per.has(it.vol.key)) continue;
    if (built && typeof frameBudgetLeft === 'function' && !frameBudgetLeft()) {
      it.vol = null;
      continue;
    }
    /* v44: at least one body a frame, however slow the frame */ solidPropMesh(it.im, it.vol);
    built++;
  }
}
/* per prop: where it stands, plus (trees, rocks) a turn of up to 12 degrees, a slight lean and a shade of its own */
function setSolidPropUniforms(p, it, M) {
  const gl = gpuState.gl,
    U = p.U,
    V = it.vol,
    h1 = hash2d(Math.round(it.x * 13), Math.round(it.z * 17)),
    h2 = hash2d(Math.round(it.z * 11) + 7, Math.round(it.x * 5) + 3),
    h3 = hash2d(Math.round(it.x * 7) + 1, Math.round(it.z * 3) + 9);
  gl.uniform3f(U.uBase, it.x, it.y, it.z);
  gl.uniform2f(U.uOff, it.ox, it.oy);
  gl.uniform1f(U.uS, it.mpp);
  gl.uniform1f(U.uFlip, it.flip || 1);
  gl.uniform1f(U.uShear, (it.shear || 0) + (V.rot ? (h2 - 0.5) * 0.07 : 0));
  if (it.lk && U.uWear) setPropLookUniforms(U, it.lk);
  if (U.uTilt) gl.uniform2f(U.uTilt, it.tilt ? it.tilt[0] : 0, it.tilt ? it.tilt[1] : 0);
  gl.uniform1f(U.uT, reducedMotion ? 0 : walkView.t);
  gl.uniform1f(
    U.uWob,
    V.wind ? (it.M.sway || 0.3) * 0.14 * ((walkView.sc && walkView.sc.wind) || 1) * engineSetting('grass', 'wind') : 0
  );
  gl.uniform1f(
    U.uRot,
    (V.rot ? (h1 - 0.5) * 0.42 : 0) + (it.lk ? it.lk.rot : 0) + placedTurn(it.p)
  ); /* phase 09 batch 9 */
  gl.uniform1f(U.uClump, M && M.tex ? 1 : 0);
  if (U.uFol) {
    const f = foliageAmount(it);
    gl.uniform2f(U.uFol, f[0], f[1]);
  }
  if (U.uVar)
    gl.uniform3f(
      U.uVar,
      V.vary ? 1 + (h3 - 0.5) * 0.1 : 1,
      V.vary ? 1 + (h1 - 0.5) * 0.09 : 1,
      V.vary ? 1 + (h2 - 0.5) * 0.12 : 1
    );
}
function solidPropTexture(it, M) {
  return imageTexture(M && M.tex ? M.tex : it.im);
}
export function drawSolidProps(C, items, X, hits, labels, PPU) {
  solidPropState.drawn = 0;
  if (!solidPropsOn()) return;
  solidPropGuard(() => {
    const gl = gpuState.gl;
    ensurePrograms(SOLID_PROP_SHADERS);
    let p = null;
    const P = walkView.pl,
      me = worldToScreen(C, P.x, 0.9, P.z);
    for (const it of items) {
      if (!it.vol || it.vis === false) continue;
      const M = solidPropMesh(it.im, it.vol);
      if (!M) {
        it.vol = null;
        if (it.p) it.p._nosolid = 1;
        /* v44: no solid could be made: the picture draws from the next frame on */ continue;
      }
      const T = solidPropTexture(it, M);
      if (!T) continue;
      if (!p) {
        p = useWalkProgram('p3d', C, X);
        gl.uniform1i(p.U.uTex, 0);
        gl.uniform1i(p.U.uNrm, 1);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.disable(gl.CULL_FACE);
      }
      const s = it.mpp,
        hM = -it.oy * s;
      let fade = it.fade ?? 1;
      if (me && !walkRenderer.bt && hM > 1.6) {
        const q = worldToScreen(C, it.x, 0, it.z);
        if (q && q.d < me.d - 0.3) {
          const half = it.w * s * 0.5 * q.s,
            top = q.y - hM * q.s;
          if (me.x > q.x - half && me.x < q.x + half && me.y > top && me.y < q.y) fade = 0.4;
        }
      }
      const mt = SURFACE_MATERIALS[it.mat] || SURFACE_MATERIALS.plain;
      gl.uniform4f(p.U.uMat, mt.spec, mt.shin, mt.transl, mt.wrap);
      if (p.U.uDet)
        gl.uniform4f(
          p.U.uDet,
          SOLID_PROP_MATERIAL_IDS[it.mat] || 0,
          engineSetting('world', 'texDetail') ?? 1,
          1 / Math.max(1e-4, it.mpp),
          0
        );
      gl.uniform1f(p.U.uFade, fade);
      gl.uniform1f(p.U.uEmit, 0);
      gl.uniform1f(p.U.uRim, 0.1);
      gl.uniform3f(p.U.uBaseP, it.x, it.y, it.z);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, T.t);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, T.n);
      setSolidPropUniforms(p, it, M);
      gl.bindVertexArray(M.vao);
      gl.drawArrays(gl.TRIANGLES, 0, M.n);
      gl.bindVertexArray(null);
      solidPropState.drawn++;
      if (it.M && it.M.blades) {
        const b = it.M.blades,
          BT = imageTexture(artImage(b.img));
        if (BT)
          drawRotatingBlades(
            p,
            it,
            b,
            BT,
            (reducedMotion ? 0 : walkView.t / 1100) * (walkView.sc.wind || 1) * engineSetting('grass', 'wind'),
            C,
            X
          );
      }
      addHitTarget(it, C, hits, labels, PPU);
    }
  });
}
function drawSolidPropShadows(SH, items) {
  if (!solidPropsOn()) return;
  solidPropGuard(() => {
    const gl = gpuState.gl;
    ensurePrograms(SOLID_PROP_SHADERS);
    const p = gpuState.P.p3dS;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
    const ca = worldCurveArgs();
    gl.uniform3f(p.U.uCurve, ca[0], ca[1], ca[2]);
    gl.uniform1f(p.U.uCurveD0, ca[3]);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(p.U.uTex, 0);
    gl.disable(gl.CULL_FACE);
    for (const it of items) {
      if (!it.vol) continue;
      const M = solidPropMesh(it.im, it.vol);
      if (!M) continue;
      const T = solidPropTexture(it, M);
      if (!T) continue;
      gl.bindTexture(gl.TEXTURE_2D, T.t);
      setSolidPropUniforms(p, it, M);
      gl.bindVertexArray(M.vao);
      gl.drawArrays(gl.TRIANGLES, 0, M.n);
    }
    gl.bindVertexArray(null);
  });
}
