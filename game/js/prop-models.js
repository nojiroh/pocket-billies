'use strict';
/* ================= VOXEL PROPS (v43) =================
   A prop may carry a voxel recipe (art/scene/vox/<key>.json, made by tools/build-vox-props.py or the Studio's Prop
   builder): layers of shapes (box, cylinder, sphere, cone, barrel) in metres with a colour and a texture, a raw layer
   (voxels imported from a .vox), and picture layers (a 2D sprite set in the model). The recipe is turned into voxels
   at the art's own scale (alpha 0.4: 32 to the metre, one voxel to a pixel), greedy-meshed into as few quads as possible and drawn as a cel-shaded, vertex-coloured solid
   in the scene's light: the sun in three tones, the sky-shaped ambient, the shadow maps, the lamps. It sits in the
   shadow maps too, so its shadow has its real shape. When the Voxel props dial is off, the prop's picture draws as
   before. Picture layers are drawn by the sprite pipeline (gatherFrameItems gives them as extra items). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { gameData, provide, reducedMotion } from './hooks.js';
import { decalPlace, propTurn } from './logic/prop-turn.js';
import { artImg, artURL, hexToRgb, makeCanvas } from './art.js';
import { artImage, walkView } from './walk-view.js';
import { engineSetting } from './engine/settings.js';
import { COMMON_GLSL, LIGHT_GLSL, ensurePrograms, gpuState, imageTexture } from './engine/webgl.js';
import { walkRenderer } from './walk/walk-state.js';
import { ROCK_GLSL } from './walk/walk-shaders.js';
import { useWalkProgram, worldCurveArgs } from './walk/draw-common.js';
import { setPropLookUniforms, windLeanAt } from './walk/prop-look.js';
import { addHitTarget } from './walk/sprites.js';
import { lampLit, modelWindowLight } from './walk/lighting.js';
import { BUILDING_SHADERS, buildingArt, buildingTextureGrid } from './buildings.js';
/* eslint-disable no-func-assign */
expose({
  GLASS_GLSL: [() => GLASS_GLSL],
  LAYER_PROPS: [() => LAYER_PROPS],
  LEAF_CUTS: [() => LEAF_CUTS],
  LOW_POLY_TEXTURE_CELLS: [() => LOW_POLY_TEXTURE_CELLS],
  PROP_MODEL_SHADERS: [() => PROP_MODEL_SHADERS],
  PROP_MODEL_SHAPES: [() => PROP_MODEL_SHAPES],
  PROP_MODEL_TEXTURES: [() => PROP_MODEL_TEXTURES],
  SPIN_GLSL: [() => SPIN_GLSL],
  SWAPPED_RECIPES: [() => SWAPPED_RECIPES],
  VOXEL_KEY_OFFSET: [() => VOXEL_KEY_OFFSET],
  VOXEL_KEY_SPAN: [() => VOXEL_KEY_SPAN],
  VOXEL_TEXTURE_GRAIN: [() => VOXEL_TEXTURE_GRAIN],
  addRawVoxels: [() => addRawVoxels, v => (addRawVoxels = v)],
  decodeRawVoxels: [() => decodeRawVoxels, v => (decodeRawVoxels = v)],
  drawLowPolyModels: [() => drawLowPolyModels, v => (drawLowPolyModels = v)],
  drawPropModelMesh: [() => drawPropModelMesh, v => (drawPropModelMesh = v)],
  drawPropModelShadows: [
    () => drawPropModelShadows,
    v => ((drawPropModelShadows = v), provide({ drawPropModelShadows })),
  ],
  drawPropModels: [() => drawPropModels, v => setDrawPropModels(v)],
  drawSpinningParts: [() => drawSpinningParts, v => (drawSpinningParts = v)],
  flushPropModelMeshes: [
    () => flushPropModelMeshes,
    v => ((flushPropModelMeshes = v), provide({ flushPropModelMeshes })),
  ],
  greedyVoxelMesh: [() => greedyVoxelMesh, v => (greedyVoxelMesh = v)],
  invalidatePropModel: [() => invalidatePropModel, v => (invalidatePropModel = v)],
  layerProp: [() => layerProp, v => (layerProp = v)],
  leafCut: [() => leafCut, v => (leafCut = v)],
  leafOutlineColour: [() => leafOutlineColour, v => (leafOutlineColour = v)],
  limbPoints: [() => limbPoints, v => (limbPoints = v)],
  loadPropModelRecipe: [() => loadPropModelRecipe, v => (loadPropModelRecipe = v)],
  lowPolyFragmentShader: [() => lowPolyFragmentShader, v => (lowPolyFragmentShader = v)],
  lowPolyFromRecipe: [() => lowPolyFromRecipe, v => (lowPolyFromRecipe = v)],
  lowPolyOn: [() => lowPolyOn, v => (lowPolyOn = v)],
  lowPolyVertexShader: [() => lowPolyVertexShader],
  mooredBob: [() => mooredBob, v => (mooredBob = v)],
  propModelArtPaths: [() => propModelArtPaths, v => ((propModelArtPaths = v), provide({ propModelArtPaths }))],
  propModelGuard: [() => propModelGuard, v => (propModelGuard = v)],
  propModelImageItems: [() => propModelImageItems, v => ((propModelImageItems = v), provide({ propModelImageItems }))],
  propModelMesh: [() => propModelMesh, v => (propModelMesh = v)],
  propModelShaders: [() => propModelShaders, v => ((propModelShaders = v), provide({ propModelShaders }))],
  propModelState: [() => propModelState],
  propModelsOn: [() => propModelsOn, v => (propModelsOn = v)],
  setItemSpin: [() => setItemSpin, v => (setItemSpin = v)],
  setPropModelUniforms: [() => setPropModelUniforms, v => (setPropModelUniforms = v)],
  swappedRecipe: [() => swappedRecipe, v => (swappedRecipe = v)],
  tagPropModel: [() => tagPropModel, v => ((tagPropModel = v), provide({ tagPropModel }))],
  uploadLowPolyMesh: [() => uploadLowPolyMesh, v => (uploadLowPolyMesh = v)],
  uploadPrebuiltModel: [() => uploadPrebuiltModel, v => (uploadPrebuiltModel = v)],
  voxelFromKey: [() => voxelFromKey, v => (voxelFromKey = v)],
  voxelHash: [() => voxelHash, v => (voxelHash = v)],
  voxelKey: [() => voxelKey, v => (voxelKey = v)],
  voxelResolution: [() => voxelResolution, v => (voxelResolution = v)],
  voxelise: [() => voxelise, v => (voxelise = v)],
});
/* eslint-enable no-func-assign */
provide({
  drawPropModelShadows,
  drawPropModels,
  flushPropModelMeshes,
  propModelArtPaths,
  propModelImageItems,
  propModelShaders,
  tagPropModel,
});
export function setDrawPropModels(v) {
  drawPropModels = v; // eslint-disable-line no-func-assign
  provide({ drawPropModels });
}
/* to-module: end */
export const propModelState = {
  recipes: new Map(),
  meshes: new Map(),
  fail: '',
  /** props drawn last frame (voxel and low-poly), and of those the low-poly models (the full test's Light lab) */
  drawn: 0,
  lowPoly: 0,
  VPM: 32,
  res: 0,
  fr: -1,
  bt: 0,
};
const VOXEL_TEXTURE_GRAIN = {
  plain: 0,
  grain: 0.1,
  wood: 0.14,
  stone: 0.18,
  metal: 0.05,
  cloth: 0.08,
  hay: 0.22,
  leaves: 0.2,
  rust: 0.16,
  stripes: 0,
  rings: 0,
  bark: 0.16,
  rock: 0.2,
  plaster: 0.06,
  siding: 0.06,
  brick: 0.12,
  battens: 0.06,
  panels: 0.04,
  corrugated: 0.04,
  tilewall: 0.04,
  rooftiles: 0.1,
  shingles: 0.1,
  slate: 0.1,
  solar: 0.04,
};
export const PROP_MODEL_TEXTURES = [
  ['plain', 'Plain'],
  ['grain', 'Grain'],
  ['wood', 'Wood'],
  ['stone', 'Stone'],
  ['metal', 'Metal'],
  ['cloth', 'Cloth'],
  ['hay', 'Hay'],
  ['leaves', 'Leaves'],
  ['rust', 'Rust'],
  ['stripes', 'Stripes'],
  ['rings', 'Rings'],
  ['bark', 'Bark'],
  ['rock', 'Rock'],
  ['plaster', 'Plaster'],
  ['siding', 'Siding'],
  ['brick', 'Brick'],
  ['battens', 'Battens'],
  ['panels', 'Wall panels'],
  ['corrugated', 'Corrugated metal'],
  ['tilewall', 'Wall tiles'],
  ['rooftiles', 'Clay roof tiles'],
  ['shingles', 'Shingles'],
  ['slate', 'Slate'],
  ['solar', 'Solar panels'],
];
const PROP_MODEL_SHAPES = [
  ['box', 'Box'],
  ['cyl', 'Cylinder'],
  ['sphere', 'Sphere'],
  ['cone', 'Cone'],
  ['barrel', 'Barrel'],
  ['limb', 'Limb (from x, y, z to x2, y2, z2)'],
  ['dome', 'Dome'],
];
export function propModelsOn() {
  return typeof engineSetting === 'function' && (engineSetting('world', 'voxelProps') ?? true) && !propModelState.fail;
}
function propModelGuard(fn) {
  if (propModelState.fail) return;
  try {
    return fn();
  } catch (e) {
    propModelState.fail = String((e && e.message) || e);
    console.error('Voxel props off: ' + propModelState.fail);
    if (typeof debugLog !== 'undefined') debugLog.add('webgl', 'Voxel props off: ' + propModelState.fail);
  }
}
/* the recipe of a prop: fetched once (inline in a single-file build), null while it loads */
export function loadPropModelRecipe(path) {
  if (propModelState.recipes.has(path)) return propModelState.recipes.get(path);
  propModelState.recipes.set(path, null);
  const url = typeof artURL === 'function' ? artURL(path) : 'art/' + path;
  /* v46: in the single-page build the recipe is inlined as a data: link; inside the Claude app a fetch of it is refused,
    which left every recipe empty on the phone. It is decoded here directly and is ready at once. */
  if (url.startsWith('data:')) {
    let j = null;
    try {
      const c = url.indexOf(','),
        meta = url.slice(5, c),
        body = url.slice(c + 1);
      const txt = /;base64/.test(meta)
        ? new TextDecoder().decode(Uint8Array.from(atob(body), ch => ch.charCodeAt(0)))
        : decodeURIComponent(body);
      j = JSON.parse(txt);
    } catch (e) {
      propModelState.bad = (propModelState.bad || 0) + 1;
      if (typeof debugLog !== 'undefined') debugLog.add('webgl', 'voxel recipe unreadable: ' + path);
    }
    const rec = j || { layers: [] };
    propModelState.recipes.set(path, rec);
    return rec;
  }
  fetch(url)
    .then(r => (r.ok ? r.json() : null))
    .then(j => {
      if (!j) {
        propModelState.bad = (propModelState.bad || 0) + 1;
        if (typeof debugLog !== 'undefined') debugLog.add('webgl', 'voxel recipe missing: ' + path);
      }
      propModelState.recipes.set(path, j || { layers: [] });
      propModelState.meshes.delete(path);
    })
    .catch(e => {
      propModelState.bad = (propModelState.bad || 0) + 1;
      if (typeof debugLog !== 'undefined')
        debugLog.add('webgl', 'voxel recipe failed to load: ' + path + ' (' + ((e && e.message) || e) + ')');
      propModelState.recipes.set(path, { layers: [] });
    });
  return null;
}
function voxelHash(a, b, c) {
  let h = (a * 374761393 + b * 668265263 + c * 1013904223) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/* alpha 0.4: voxels at the art's own scale: one voxel is one pixel of the art, 32 to the metre (Engine > World >
   "Chunky voxels" builds them at eight to the metre, as before, for slow phones). Only the skin of each shape is kept
   (a voxel with its six neighbours inside its own shape can never be seen), and a face toward a cell inside any shape
   is never made, so a fine model costs what its outside costs. Voxels are kept by number (voxelKey), colours as 0xRRGGBB. */
function voxelResolution() {
  return typeof engineSetting === 'function' && engineSetting('world', 'voxelChunky') ? 8 : propModelState.VPM;
}
const VOXEL_KEY_SPAN = 4096,
  VOXEL_KEY_OFFSET = 2048;
function voxelKey(x, y, z) {
  return ((x + VOXEL_KEY_OFFSET) * VOXEL_KEY_SPAN + (y + VOXEL_KEY_OFFSET)) * VOXEL_KEY_SPAN + (z + VOXEL_KEY_OFFSET);
}
function voxelFromKey(k) {
  const z = k % VOXEL_KEY_SPAN,
    r = (k - z) / VOXEL_KEY_SPAN,
    y = r % VOXEL_KEY_SPAN;
  return [(r - y) / VOXEL_KEY_SPAN - VOXEL_KEY_OFFSET, y - VOXEL_KEY_OFFSET, z - VOXEL_KEY_OFFSET];
}
/* phase 09 batch 1: a limb's points as [x, y, z, radius] in metres (x across, y depth, z up): its own list (pts, for a
   bent trunk or branch), else from (x, y, z) with radius r to (x2, y2, z2) with radius r1. A point may sit a little
   under the ground (a root going in). */
function limbPoints(L) {
  if (Array.isArray(L.pts) && L.pts.length >= 2)
    return L.pts.map(q => [+q[0] || 0, +q[1] || 0, Math.max(-0.3, +q[2] || 0), Math.max(0.002, +q[3] || 0.05)]);
  const r0 = Math.max(L.r || 0.1, 0.002);
  return [
    [L.x || 0, L.y || 0, Math.max(-0.3, L.z || 0), r0],
    [L.x2 ?? (L.x || 0), L.y2 ?? (L.y || 0), Math.max(-0.3, L.z2 ?? (L.z || 0) + 1), Math.max(L.r1 ?? r0 * 0.7, 0.002)],
  ];
}
/* voxels from a recipe at R to the metre: Map key -> colour (x across, y depth, z up); V.ins: the shapes' insides */
function voxelise(rec, R) {
  R = R || voxelResolution();
  const V = new Map(),
    ins = [];
  V.ins = ins;
  const pk = c => (c[0] << 16) | (c[1] << 8) | c[2],
    tone = (c, k) =>
      (Math.min(255, (c[0] * k) | 0) << 16) | (Math.min(255, (c[1] * k) | 0) << 8) | Math.min(255, (c[2] * k) | 0),
    fl = Math.floor;
  (rec.layers || []).forEach((L, li) => {
    if (L.k === 'img' || L.hide) return;
    if (L.k === 'raw') {
      addRawVoxels(V, L, R, rec);
      return;
    }
    const c = hexToRgb(L.col || '#888888'),
      g = VOXEL_TEXTURE_GRAIN[L.tex || 'plain'] || 0,
      t = L.tex,
      x0 = L.x || 0,
      y0 = L.y || 0,
      z0 = L.z || 0,
      rg = (a, b) => {
        const s = fl(a * R),
          e = Math.max(s + 1, Math.round(b * R));
        return [s, e];
      };
    let inside,
      B,
      along = 0;
    if (L.k === 'box') {
      const [xa, xb] = rg(x0 - L.w / 2, x0 + L.w / 2),
        [ya, yb] = rg(y0 - L.d / 2, y0 + L.d / 2),
        [za, zb] = rg(z0, z0 + L.h);
      B = [xa, xb, ya, yb, za, zb];
      inside = (x, y, z) => x >= xa && x < xb && y >= ya && y < yb && z >= za && z < zb;
      along = L.h >= Math.max(L.w, L.d) ? 2 : L.w >= L.d ? 0 : 1;
    } else if (L.k === 'limb') {
      /* a tapered branch: inside where the distance to any of its segments is under the radius there */
      const P = limbPoints(L),
        S = [];
      let mr = 0;
      for (let i = 0; i < P.length - 1; i++) {
        const A = P[i],
          Bq = P[i + 1],
          d = [Bq[0] - A[0], Bq[1] - A[1], Bq[2] - A[2]];
        S.push([
          A,
          d,
          d[0] * d[0] + d[1] * d[1] + d[2] * d[2] || 1e-9,
          Math.max(A[3], 0.5 / R),
          Math.max(Bq[3], 0.5 / R),
        ]);
        mr = Math.max(mr, A[3], Bq[3], 0.5 / R);
      }
      inside = (x, y, z) => {
        const px = (x + 0.5) / R,
          py = (y + 0.5) / R,
          pz = (z + 0.5) / R;
        for (const [A, d, ll, ra, rb] of S) {
          const ax = px - A[0],
            ay = py - A[1],
            az = pz - A[2],
            k = Math.max(0, Math.min(1, (ax * d[0] + ay * d[1] + az * d[2]) / ll)),
            ex = ax - d[0] * k,
            ey = ay - d[1] * k,
            ez = az - d[2] * k,
            rr = ra + (rb - ra) * k;
          if (ex * ex + ey * ey + ez * ez <= rr * rr) return true;
        }
        return false;
      };
      const xs = P.map(q => q[0]),
        ys = P.map(q => q[1]),
        zs = P.map(q => q[2]);
      B = [
        fl((Math.min(...xs) - mr) * R) - 1,
        fl((Math.max(...xs) + mr) * R) + 2,
        fl((Math.min(...ys) - mr) * R) - 1,
        fl((Math.max(...ys) + mr) * R) + 2,
        Math.max(0, fl((Math.min(...zs) - mr) * R) - 1),
        fl((Math.max(...zs) + mr) * R) + 2,
      ];
      const dz = Math.abs(zs[zs.length - 1] - zs[0]),
        dx = Math.abs(xs[xs.length - 1] - xs[0]),
        dy = Math.abs(ys[ys.length - 1] - ys[0]);
      along = dz >= Math.max(dx, dy) ? 2 : dx >= dy ? 0 : 1;
    } else {
      const r = Math.max(L.r || 0.1, 0.5 / R),
        ry = Math.max(L.ry || r, 0.5 / R),
        h = L.h != null ? L.h : 2 * r,
        [za, zb] = rg(z0, z0 + h),
        bu = L.bulge ?? 0.15,
        thin = r < 0.75 / R && ry < 0.75 / R,
        RR = [],
        RY = [];
      let mr = 0;
      for (let z = za; z < zb; z++) {
        const k = ((z + 0.5) / R - z0) / Math.max(h, 1e-6);
        let f = 1;
        if (L.k === 'sphere') f = Math.sqrt(Math.max(0, 1 - (2 * k - 1) * (2 * k - 1)));
        else if (L.k === 'dome') f = Math.sqrt(Math.max(0, 1 - k * k));
        else if (L.k === 'cone') f = 1 - k + (k * (L.r1 || 0)) / r;
        else if (L.k === 'barrel') f = 1 - bu + bu * Math.sin(k * Math.PI) * 2 - bu;
        RR.push(r * f);
        RY.push(ry * f);
        mr = Math.max(mr, r * f, ry * f);
      }
      const cx = x0 * R,
        cy = y0 * R;
      inside = (x, y, z) => {
        if (z < za || z >= zb) return false;
        const rr = RR[z - za],
          rry = RY[z - za];
        if (rr <= 0) return false;
        if (thin) return x <= cx && cx < x + 1 && y <= cy && cy < y + 1;
        const dx = (x + 0.5) / R - x0,
          dy = (y + 0.5) / R - y0;
        return (dx * dx) / (rr * rr) + (dy * dy) / (rry * rry) <= 1;
      };
      B = [fl((x0 - mr) * R) - 1, fl((x0 + mr) * R) + 2, fl((y0 - mr) * R) - 1, fl((y0 + mr) * R) + 2, za, zb];
      along = h > 2 * Math.max(r, ry) ? 2 : 0;
    }
    ins.push({ b: B, f: inside });
    /* the textures at the art's scale: wood, grain and hay in streaks along the shape's length, stone, rust and leaves in
     small blotches, stripes and rings as wide as they always were in metres */
    const [xa, xb, ya, yb, za, zb] = B,
      sl = Math.max(1, Math.round((6 * R) / 32)),
      bl = Math.max(1, Math.round((2 * R) / 32)),
      sw = Math.max(1, (R / 4) | 0),
      rw = Math.max(1, (R / 8) | 0),
      streak = t === 'wood' || t === 'grain' || t === 'hay' || t === 'bark',
      blot = t === 'stone' || t === 'rust' || t === 'leaves' || t === 'rock',
      c0 = pk(c);
    for (let z = Math.max(0, za); z < zb; z++)
      for (let x = xa; x < xb; x++)
        for (let y = ya; y < yb; y++) {
          if (!inside(x, y, z)) continue;
          if (
            inside(x + 1, y, z) &&
            inside(x - 1, y, z) &&
            inside(x, y + 1, z) &&
            inside(x, y - 1, z) &&
            inside(x, y, z + 1) &&
            (z === 0 || inside(x, y, z - 1))
          )
            continue;
          let cc = c0;
          if (t === 'stripes') cc = fl((x + z) / sw) & 1 ? c0 : tone(c, 0.75);
          else if (t === 'rings') cc = fl(Math.hypot(x + 0.5 - x0 * R, y + 0.5 - y0 * R) / rw) & 1 ? tone(c, 0.8) : c0;
          else if (g) {
            let hx = x,
              hy = y,
              hz = z;
            if (streak) {
              if (along === 0) hx = fl(x / sl);
              else if (along === 1) hy = fl(y / sl);
              else hz = fl(z / sl);
            } else if (blot) {
              hx = fl(x / bl);
              hy = fl(y / bl);
              hz = fl(z / bl);
            }
            if (voxelHash(hx + li * 97, hy, hz) < g) cc = tone(c, voxelHash(hz, hx, hy + li) < 0.5 ? 0.82 : 1.14);
          }
          V.set(voxelKey(x, y, z), cc);
        }
  });
  return V;
}
/* a raw layer (voxels imported from a .vox, at L.vpm to the metre, else the recipe's, else eight) into V at R to the
   metre: a finer build makes each voxel a block (its skin only), a coarser one drops the voxels into bigger cells */
function addRawVoxels(V, L, R, rec) {
  const d = decodeRawVoxels(L);
  if (!d.length) return;
  const lv = L.vpm || rec.vpm || 8,
    f = R / lv,
    sx = Math.round((L.x || 0) * R),
    sy = Math.round((L.y || 0) * R),
    sz = Math.round((L.z || 0) * R),
    pk = c => (c[0] << 16) | (c[1] << 8) | c[2];
  if (f <= 1.001) {
    for (const [x, y, z, c] of d)
      V.set(voxelKey(Math.floor(x * f) + sx, Math.floor(y * f) + sy, Math.floor(z * f) + sz), pk(c));
    return;
  }
  const k = Math.round(f),
    S = new Set(d.map(q => voxelKey(q[0], q[1], q[2])));
  let b = [1e9, -1e9, 1e9, -1e9, 1e9, -1e9];
  for (const [x, y, z, c] of d) {
    const cc = pk(c),
      X = x * k + sx,
      Y = y * k + sy,
      Z = z * k + sz;
    b = [
      Math.min(b[0], X),
      Math.max(b[1], X + k),
      Math.min(b[2], Y),
      Math.max(b[3], Y + k),
      Math.min(b[4], Z),
      Math.max(b[5], Z + k),
    ];
    for (const [dx, dy, dz] of [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ]) {
      if (S.has(voxelKey(x + dx, y + dy, z + dz))) continue;
      for (let i = 0; i < k; i++)
        for (let j = 0; j < k; j++) {
          const p = dx ? [dx > 0 ? k - 1 : 0, i, j] : dy ? [i, dy > 0 ? k - 1 : 0, j] : [i, j, dz > 0 ? k - 1 : 0];
          V.set(voxelKey(X + p[0], Y + p[1], Z + p[2]), cc);
        }
    }
  }
  V.ins.push({
    b,
    f: (X, Y, Z) => S.has(voxelKey(Math.floor((X - sx) / k), Math.floor((Y - sy) / k), Math.floor((Z - sz) / k))),
  });
}
/* a raw layer: voxels packed as base64 of (x,y,z,r,g,b) bytes, offset by L.ox/oy/oz (the Studio's .vox import makes these) */
function decodeRawVoxels(L) {
  try {
    const b = atob(L.data || ''),
      out = [];
    for (let i = 0; i + 5 < b.length; i += 6)
      out.push([
        b.charCodeAt(i) + (L.ox || 0),
        b.charCodeAt(i + 1) + (L.oy || 0),
        b.charCodeAt(i + 2) + (L.oz || 0),
        [b.charCodeAt(i + 3), b.charCodeAt(i + 4), b.charCodeAt(i + 5)],
      ]);
    return out;
  } catch (e) {
    return [];
  }
}
/* greedy meshing: every face of a voxel toward an empty cell outside every shape (and above the ground) is put in its
   slice, and each slice's faces are merged into the largest rectangles of one colour; a quad is four corners (position
   in voxels, its normal, its colour; 16 bytes each) and six indices */
function greedyVoxelMesh(V, R) {
  if (!V || !V.size) return null;
  const ins = V.ins || [],
    hidden = (x, y, z) => {
      if (z < 0) return true;
      for (const h of ins) {
        const b = h.b;
        if (x >= b[0] && x < b[1] && y >= b[2] && y < b[3] && z >= b[4] && z < b[5] && h.f(x, y, z)) return true;
      }
      return false;
    };
  const D = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ],
    S = new Map();
  let x0 = 1e9,
    y0 = 1e9,
    z0 = 1e9,
    x1 = -1e9,
    y1 = -1e9,
    z1 = -1e9;
  for (const [k, c] of V) {
    const p = voxelFromKey(k),
      x = p[0],
      y = p[1],
      z = p[2];
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    if (z < z0) z0 = z;
    if (z > z1) z1 = z;
    for (let d = 0; d < 6; d++) {
      const q = D[d],
        nx = x + q[0],
        ny = y + q[1],
        nz = z + q[2];
      if (V.has(voxelKey(nx, ny, nz)) || hidden(nx, ny, nz)) continue;
      const a = d >> 1,
        bk = d * 16384 + p[a] + 8192;
      let L = S.get(bk);
      if (!L) {
        L = [];
        S.set(bk, L);
      }
      L.push(p[(a + 1) % 3], p[(a + 2) % 3], c);
    }
  }
  const P = [],
    N = [],
    C = [],
    I = [];
  let nv = 0;
  for (const [bk, L] of S) {
    const d = Math.floor(bk / 16384),
      sl = (bk % 16384) - 8192,
      a = d >> 1,
      s = d & 1 ? -1 : 1,
      ua = (a + 1) % 3,
      va = (a + 2) % 3;
    let u0 = 1e9,
      v0 = 1e9,
      u1 = -1e9,
      v1 = -1e9;
    for (let i = 0; i < L.length; i += 3) {
      if (L[i] < u0) u0 = L[i];
      if (L[i] > u1) u1 = L[i];
      if (L[i + 1] < v0) v0 = L[i + 1];
      if (L[i + 1] > v1) v1 = L[i + 1];
    }
    const W = u1 - u0 + 1,
      H = v1 - v0 + 1,
      M = new Int32Array(W * H).fill(-1);
    for (let i = 0; i < L.length; i += 3) M[(L[i + 1] - v0) * W + (L[i] - u0)] = L[i + 2];
    const pl = s > 0 ? sl + 1 : sl,
      n = [0, 0, 0];
    n[a] = s;
    for (let b = 0; b < H; b++)
      for (let u = 0; u < W;) {
        const c = M[b * W + u];
        if (c < 0) {
          u++;
          continue;
        }
        let w = 1;
        while (u + w < W && M[b * W + u + w] === c) w++;
        let h = 1;
        grow: while (b + h < H) {
          for (let k = 0; k < w; k++) if (M[(b + h) * W + u + k] !== c) break grow;
          h++;
        }
        for (let l = 0; l < h; l++) M.fill(-1, (b + l) * W + u, (b + l) * W + u + w);
        for (const [du, dv] of [
          [0, 0],
          [w, 0],
          [w, h],
          [0, h],
        ]) {
          const q = [0, 0, 0];
          q[a] = pl;
          q[ua] = u0 + u + du;
          q[va] = v0 + b + dv;
          P.push(q[0], q[2], q[1]);
          N.push(n[0], n[2], n[1]);
          C.push((c >> 16) & 255, (c >> 8) & 255, c & 255);
        }
        if (s > 0) I.push(nv, nv + 1, nv + 2, nv, nv + 2, nv + 3);
        else I.push(nv, nv + 2, nv + 1, nv, nv + 3, nv + 2);
        nv += 4;
        u += w;
      }
  }
  if (!nv) return null;
  const vb = new ArrayBuffer(nv * 16),
    i16 = new Int16Array(vb),
    i8 = new Int8Array(vb),
    u8 = new Uint8Array(vb);
  for (let i = 0; i < nv; i++) {
    i16[i * 8] = P[i * 3];
    i16[i * 8 + 1] = P[i * 3 + 1];
    i16[i * 8 + 2] = P[i * 3 + 2];
    i8[i * 16 + 8] = N[i * 3] * 127;
    i8[i * 16 + 9] = N[i * 3 + 1] * 127;
    i8[i * 16 + 10] = N[i * 3 + 2] * 127;
    u8[i * 16 + 12] = C[i * 3];
    u8[i * 16 + 13] = C[i * 3 + 1];
    u8[i * 16 + 14] = C[i * 3 + 2];
  }
  return {
    vb,
    ib: nv > 65535 ? new Uint32Array(I) : new Uint16Array(I),
    n: I.length,
    quads: nv / 4,
    box: [x0 / R, z0 / R, y0 / R, (x1 + 1) / R, (z1 + 1) / R, (y1 + 1) / R],
  };
}
/* the mesh of a recipe on the card (built once; the Studio asks for a rebuild after an edit) */
function propModelMesh(path, rec) {
  let m = propModelState.meshes.get(path);
  if (m !== undefined) return m;
  if (rec.kind === 'mesh') {
    m = uploadPrebuiltModel(rec);
    propModelState.meshes.set(path, m);
    return m;
  }
  if (lowPolyOn(rec)) {
    const L = rec.layers || [],
      M = lowPolyFromRecipe({ ...rec, layers: L.filter(l => !l.spin) });
    m = M
      ? {
          ...uploadLowPolyMesh(M.vb, M.ib),
          model: 1,
          lowpoly: 1,
          tris: M.tris,
          q: 1 / 256,
          box: M.box,
          spins: [],
          wins: M.wins.length ? M.wins : null,
        }
      : null;
    if (m)
      for (const l of L)
        if (l.spin && !l.hide) {
          const S = lowPolyFromRecipe({ layers: [{ ...l, spin: undefined }] }),
            ax = l.spin.axis,
            a = Array.isArray(ax)
              ? [ax[0] || 0, ax[2] || 0, ax[1] || 0]
              : ax === 'y'
                ? [0, 0, 1]
                : ax === 'z'
                  ? [0, 1, 0]
                  : [1, 0, 0],
            al = Math.hypot(a[0], a[1], a[2]) || 1;
          if (S)
            m.spins.push({
              ...uploadLowPolyMesh(S.vb, S.ib),
              c: [l.spin.x || 0, l.spin.z || 0, l.spin.y || 0],
              a: a.map(v => v / al),
              rps: l.spin.rps ?? 1.5,
              sw: +l.spin.swing || 0,
            });
        }
    propModelState.meshes.set(path, m);
    return m;
  }
  const gl = gpuState.gl,
    R = voxelResolution(),
    L = rec.layers || [],
    still = L.some(l => l.spin) ? { ...rec, layers: L.filter(l => !l.spin) } : rec,
    M = greedyVoxelMesh(voxelise(still, R), R);
  if (!M) {
    propModelState.meshes.set(path, null);
    return null;
  }
  const up = D => {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, D.vb, gl.STATIC_DRAW);
    for (const [loc, n, ty, nm, off] of [
      [0, 3, gl.SHORT, false, 0],
      [1, 3, gl.BYTE, true, 8],
      [2, 3, gl.UNSIGNED_BYTE, true, 12],
    ]) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, n, ty, nm, 16, off);
    }
    const eb = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eb);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, D.ib, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, n: D.n, el: 1, u32: D.ib instanceof Uint32Array, quads: D.quads, bufs: [vb, eb] };
  };
  m = { ...up(M), box: M.box, q: 1 / R, res: R, spins: [] };
  /* alpha 0.4: parts that turn (the airships' propellers): a layer with spin {x, y, z: its pivot in metres; axis: 'x' across, 'y' depth, 'z' up, or [x, y, z] any way at all; rps: turns a second} */
  for (const l of L)
    if (l.spin && !l.hide) {
      const S = greedyVoxelMesh(voxelise({ vpm: rec.vpm, layers: [{ ...l, spin: undefined }] }, R), R),
        ax = l.spin.axis,
        a = Array.isArray(ax)
          ? [ax[0] || 0, ax[2] || 0, ax[1] || 0]
          : ax === 'y'
            ? [0, 0, 1]
            : ax === 'z'
              ? [0, 1, 0]
              : [1, 0, 0],
        al = Math.hypot(a[0], a[1], a[2]) || 1;
      if (S)
        m.spins.push({
          ...up(S),
          c: [l.spin.x || 0, l.spin.z || 0, l.spin.y || 0],
          a: a.map(v => v / al),
          rps: l.spin.rps ?? 1.5,
          sw: +l.spin.swing || 0,
        });
    }
  propModelState.meshes.set(path, m);
  return m;
}
/* the turning parts of a voxel prop, drawn after its still mesh (p: the program, its uniforms set for the item) */
function drawSpinningParts(p, m) {
  if (!m.spins || !m.spins.length) return;
  const gl = gpuState.gl,
    t = (reducedMotion ? 0 : walkView.t || 0) / 1000;
  for (const s of m.spins) {
    /* phase 09 batch 1: a part may swing to and fro instead of turning round (spin.swing: how far, in radians; rps:
       swings a second; a swing on its ropes) */
    const ph = t * s.rps * Math.PI * 2,
      an = s.sw ? Math.sin(ph) * s.sw : ph;
    gl.uniform4f(p.U.uSpin, s.a[0], s.a[1], s.a[2], an);
    gl.uniform3fv(p.U.uSpinC, s.c);
    drawPropModelMesh(s);
  }
  gl.uniform4f(p.U.uSpin, 1, 0, 0, 0);
  gl.uniform3f(p.U.uSpinC, 0, 0, 0);
}
function flushPropModelMeshes() {
  for (const k of [...propModelState.meshes.keys()]) invalidatePropModel(k, true);
}
export function invalidatePropModel(path, keep) {
  const m = propModelState.meshes.get(path);
  if (m && m.vao && typeof gpuState !== 'undefined' && gpuState.gl) {
    const gl = gpuState.gl;
    for (const q of [m, ...(m.more || []), ...(m.spins || [])]) {
      gl.deleteVertexArray(q.vao);
      for (const b of q.bufs || []) gl.deleteBuffer(b);
    }
  }
  propModelState.meshes.delete(path);
  if (!keep && path && !path.startsWith('inline:')) propModelState.recipes.delete(path);
}
/* alpha 0.4: a low-poly model (a recipe of kind "mesh", made by tools/build-airship.py), painted with the buildings'
   32 px textures (the building sheet, scenery.buildArt.detail) in the buildings' look: each part's vertex data as the
   tool packed it (24 bytes a vertex: position in 1/256 m, normal, texture coordinates in 1/64 m, the sheet's cell and
   "flat", the colour; then the triangles), its turning parts ("spins": a pivot c and an axis a, up as y) like the
   voxels' propellers. It stands in for the picture where the voxel props do, and casts its real shadow. */
function uploadLowPolyMesh(vb, ib) {
  const gl = gpuState.gl,
    vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const v = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, v);
  gl.bufferData(gl.ARRAY_BUFFER, vb, gl.STATIC_DRAW);
  for (const [loc, n, ty, nm, off] of [
    [0, 3, gl.SHORT, false, 0],
    [1, 3, gl.BYTE, true, 8],
    [2, 2, gl.SHORT, false, 12],
    [3, 3, gl.UNSIGNED_BYTE, false, 16],
    [4, 3, gl.UNSIGNED_BYTE, true, 20],
  ]) {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, n, ty, nm, 24, off);
  }
  const e = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, e);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ib, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, n: ib.length, el: 1, u32: ib instanceof Uint32Array, bufs: [v, e] };
}
function uploadPrebuiltModel(rec) {
  const gl = gpuState.gl;
  const mk = P => {
    const b = Uint8Array.from(atob(P.data || ''), c => c.charCodeAt(0));
    if (!P.n || b.length < P.n * 24 + P.ni * 2) return null;
    return uploadLowPolyMesh(b.subarray(0, P.n * 24), new Uint16Array(b.buffer, P.n * 24, P.ni));
  };
  const parts = (rec.parts || []).map(mk).filter(Boolean);
  if (!parts.length) return null;
  const ax = a => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  };
  return {
    ...parts[0],
    more: parts.slice(1),
    model: 1,
    q: 1 / 256,
    box: rec.box || [-1, 0, -1, 1, 2, 1],
    spins: (rec.spins || [])
      .map(s => {
        const m = mk(s);
        return m && { ...m, c: s.c || [0, 0, 0], a: ax(s.a || [1, 0, 0]), rps: s.rps ?? 1.5 };
      })
      .filter(Boolean),
  };
}
/* alpha 0.4: a voxel recipe's shapes as a low-poly model instead (Engine > World > "Props as low-poly"), painted with
   the buildings' 32 px textures like the airship and the houses: a box is a box, a cylinder, cone or barrel is turned
   with a few sides, a sphere is a small globe. Each recipe texture has its cell on the building sheet: wood is planks
   (along a board, up a post or a stave), stone is stone blocks (rough plaster on round stones), metal is metal seams,
   cloth is cloth, hay is thatch, leaves are moss, rust is rivets, stripes are stripes, rings are a cut log's rings
   (on the top), bark is bark (fissures along a trunk or branch), rock is rough rock. Recipes with imported voxels stay
   voxels. Phase 09 batch 1: a limb is a tapered branch from one point to another (x, y, z to x2, y2, z2; r at the
   start, r1 at the end), a dome is the top half of a sphere (a mossy roof); any round shape can take sides (how many
   faces round it), rings (a sphere's or dome's bands), lump (how uneven it is, as a leafy globe is) and facet (flat
   faces, for rocks). */
const LOW_POLY_TEXTURE_CELLS = {
  plain: 15,
  wood: 14,
  grain: 0,
  stone: 3,
  metal: 12,
  cloth: 18,
  hay: 11,
  leaves: 16,
  rust: 19,
  stripes: 20,
  rings: 15,
  bark: 22,
  rock: 23,
  /* phase 09: the building sheet's own materials by name (buildings.js BUILDING_TEXTURE_NAMES) */
  plaster: 0,
  siding: 1,
  brick: 2,
  battens: 4,
  panels: 5,
  corrugated: 6,
  tilewall: 7,
  rooftiles: 8,
  shingles: 9,
  slate: 10,
  solar: 17,
};
export function lowPolyFromRecipe(rec) {
  const V = [],
    I = [];
  let nv = 0;
  const T = (t, round) => (t === 'stone' && round ? 0 : (LOW_POLY_TEXTURE_CELLS[t || 'plain'] ?? 15));
  /* a window's glass (a layer's glass number, 1-31): its vertices carry the number, and each window its bounds */
  let gw = 0;
  const GB = {};
  const vert = (p, n, uv, tex, c) => {
      V.push(p, n, uv, tex, c, gw);
      if (gw) {
        const b = GB[gw] || (GB[gw] = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]);
        for (let q = 0; q < 3; q++) {
          b[q] = Math.min(b[q], p[q]);
          b[q + 3] = Math.max(b[q + 3], p[q]);
        }
      }
      return nv++;
    },
    poly = (P, N, UV, tex, c) => {
      const k = P.map((p, j) => vert(p, Array.isArray(N[0]) ? N[j] : N, UV[j], tex, c));
      for (let j = 1; j < k.length - 1; j++) I.push(k[0], k[j], k[j + 1]);
    };
  let li3 = 0;
  for (const L of rec.layers || []) {
    li3 += 31;
    if (L.k === 'img' || L.hide || L.k === 'raw') continue;
    gw = L.glass > 0 ? Math.min(31, L.glass | 0) : 0;
    const c = hexToRgb(L.col || '#888888'),
      t = L.tex || 'plain',
      x0 = L.x || 0,
      y0 = L.y || 0,
      z0 = Math.max(0, L.z || 0);
    if (L.k === 'box') {
      const xa = x0 - L.w / 2,
        xb = x0 + L.w / 2,
        ya = z0,
        yb = (L.z || 0) + L.h,
        za = y0 - L.d / 2,
        zb = y0 + L.d / 2,
        tx = T(t),
        up = (t === 'wood' || t === 'grain') && L.h >= Math.max(L.w, L.d),
        sw = (u, v) => (up ? [v, u] : [u, v]);
      if (yb <= ya) continue;
      poly(
        [
          [xa, ya, zb],
          [xa, ya, za],
          [xa, yb, za],
          [xa, yb, zb],
        ],
        [-1, 0, 0],
        [sw(zb, ya), sw(za, ya), sw(za, yb), sw(zb, yb)],
        tx,
        c
      );
      poly(
        [
          [xb, ya, za],
          [xb, ya, zb],
          [xb, yb, zb],
          [xb, yb, za],
        ],
        [1, 0, 0],
        [sw(za, ya), sw(zb, ya), sw(zb, yb), sw(za, yb)],
        tx,
        c
      );
      poly(
        [
          [xa, yb, za],
          [xa, yb, zb],
          [xb, yb, zb],
          [xb, yb, za],
        ],
        [0, 1, 0],
        [
          [xa, za],
          [xa, zb],
          [xb, zb],
          [xb, za],
        ],
        tx,
        c
      );
      if (ya > 0.01)
        poly(
          [
            [xa, ya, za],
            [xb, ya, za],
            [xb, ya, zb],
            [xa, ya, zb],
          ],
          [0, -1, 0],
          [
            [xa, za],
            [xb, za],
            [xb, zb],
            [xa, zb],
          ],
          tx,
          c
        );
      poly(
        [
          [xa, ya, za],
          [xa, yb, za],
          [xb, yb, za],
          [xb, ya, za],
        ],
        [0, 0, -1],
        [sw(xa, ya), sw(xa, yb), sw(xb, yb), sw(xb, ya)],
        tx,
        c
      );
      poly(
        [
          [xb, ya, zb],
          [xb, yb, zb],
          [xa, yb, zb],
          [xa, ya, zb],
        ],
        [0, 0, 1],
        [sw(xb, ya), sw(xb, yb), sw(xa, yb), sw(xa, ya)],
        tx,
        c
      );
      continue;
    }
    /* phase 09 batch 1: a limb, a tapered branch along a few points (up is the model's y here), with a few sides */
    if (L.k === 'limb') {
      const P = limbPoints(L).map(q => [q[0], q[2], q[1], q[3]]);
      if (P.length < 2) continue;
      const cr = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]],
        nz = v => {
          const l = Math.hypot(v[0], v[1], v[2]) || 1;
          return [v[0] / l, v[1] / l, v[2] / l];
        },
        sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]],
        r0 = Math.max(P[0][3], 0.01),
        n = L.sides
          ? Math.max(3, Math.min(24, L.sides | 0))
          : Math.max(5, Math.min(10, Math.round((2 * Math.PI * r0 * 32) / 6))),
        tx = T(t, 1),
        arc = (2 * Math.PI * r0) / n;
      /* the direction at each point (along the bend), and a frame carried along it so the sides don't twist */
      const D = P.map((q, i) => nz(sub(P[Math.min(P.length - 1, i + 1)], P[Math.max(0, i - 1)]))),
        a0 = D[0];
      let u = nz(cr(a0, Math.abs(a0[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
      const G = [];
      let len = 0;
      for (let i = 0; i < P.length; i++) {
        const a = D[i];
        if (i) {
          len += Math.hypot(...sub(P[i], P[i - 1]));
          const k = u[0] * a[0] + u[1] * a[1] + u[2] * a[2];
          u = nz([u[0] - a[0] * k, u[1] - a[1] * k, u[2] - a[2] * k]);
        }
        const v = cr(a, u),
          rr = Math.max(P[i][3], 0.004),
          row = [];
        for (let j = 0; j <= n; j++) {
          const an = (2 * Math.PI * (j % n)) / n,
            c0 = Math.cos(an),
            sn = Math.sin(an),
            nr = [u[0] * c0 + v[0] * sn, u[1] * c0 + v[1] * sn, u[2] * c0 + v[2] * sn];
          row.push([[P[i][0] + nr[0] * rr, P[i][1] + nr[1] * rr, P[i][2] + nr[2] * rr], nr, len]);
        }
        G.push(row);
      }
      for (let i = 0; i < G.length - 1; i++)
        for (let j = 0; j < n; j++)
          poly(
            [G[i][j][0], G[i + 1][j][0], G[i + 1][j + 1][0], G[i][j + 1][0]],
            [G[i][j][1], G[i + 1][j][1], G[i + 1][j + 1][1], G[i][j + 1][1]],
            [
              [j * arc, G[i][j][2]],
              [j * arc, G[i + 1][j][2]],
              [(j + 1) * arc, G[i + 1][j][2]],
              [(j + 1) * arc, G[i][j][2]],
            ],
            tx,
            c
          );
      /* the end cap (the cut end of a branch shows rings when the texture is bark) */
      const E = P[P.length - 1],
        GE = G[G.length - 1],
        r1 = Math.max(E[3], 0.004);
      for (let j = 0; j < n; j++)
        poly(
          [E.slice(0, 3), GE[j + 1][0], GE[j][0]],
          D[D.length - 1],
          [
            [1, 1],
            [1 + Math.cos((2 * Math.PI * (j + 1)) / n) * r1, 1 + Math.sin((2 * Math.PI * (j + 1)) / n) * r1],
            [1 + Math.cos((2 * Math.PI * j) / n) * r1, 1 + Math.sin((2 * Math.PI * j) / n) * r1],
          ],
          tx,
          c
        );
      continue;
    }
    /* round shapes: rings up the shape, each its radius across (r) and in depth (ry) */
    const r = Math.max(L.r || 0.1, 0.01),
      ry = Math.max(L.ry || r, 0.01),
      h = L.h != null ? L.h : 2 * r,
      bu = L.bulge ?? 0.15,
      R = []; /* [height 0-1, radius 0-1] up the shape */
    if (L.k === 'cyl') R.push([0, 1], [1, 1]);
    else if (L.k === 'cone') R.push([0, 1], [1, (L.r1 || 0) / r]);
    else if (L.k === 'barrel')
      for (let i = 0; i <= 6; i++) {
        const k = i / 6;
        R.push([k, 1 - bu + bu * Math.sin(k * Math.PI) * 2 - bu]);
      }
    else if (L.k === 'dome') {
      const nb = Math.max(2, Math.min(12, L.rings || 5));
      for (let i = 0; i <= nb; i++) {
        const an = ((Math.PI / 2) * i) / nb;
        R.push([Math.sin(an), Math.cos(an)]);
      }
    } else {
      const nb = Math.max(2, Math.min(16, L.rings || 8));
      for (let i = 0; i <= nb; i++) {
        const k = (1 - Math.cos((Math.PI * i) / nb)) / 2;
        R.push([k, Math.sqrt(Math.max(0, 1 - (2 * k - 1) * (2 * k - 1)))]);
      }
    }
    const la = L.lump != null ? +L.lump : t === 'leaves' && L.k === 'sphere' ? 0.22 : 0,
      lumpy = la > 0,
      n = L.sides
        ? Math.max(3, Math.min(32, L.sides | 0))
        : Math.max(6, Math.min(lumpy ? 16 : 20, Math.round((2 * Math.PI * Math.max(r, ry) * 32) / 5))),
      tx = T(t, 1),
      stave = t === 'wood' || t === 'grain',
      NR = R.length;
    /* the grid of points: ring i, step j round it; leafy globes (bushes in their pots) get lumps, so they read as leaves, not balls */
    const G = [];
    for (let i = 0; i < NR; i++) {
      const [k, f] = R[i],
        y = Math.max(0, (L.z || 0) + k * h),
        row = [];
      for (let j = 0; j <= n; j++) {
        const a = (2 * Math.PI * (j % n)) / n + (+L.rot || 0),
          lu =
            lumpy && i > 0 && i < NR - 1
              ? 1 + la * (voxelHash(i * 7 + li3, j % n, 13) - 0.5) + la * 0.545 * Math.sin(a * 3 + i)
              : 1;
        /* phase 09: a cone may narrow differently in depth (ry1: its depth radius at the top), so a 4-sided cone
           turned by rot (pi/4) is a hip roof with a ridge */
        const fy = L.k === 'cone' && L.ry1 != null ? 1 - k + (k * L.ry1) / ry : f;
        row.push([x0 + Math.cos(a) * r * f * lu, y, y0 + Math.sin(a) * ry * fy * lu]);
      }
      G.push(row);
    }
    /* normals: the faces round each point, facing out from the shape's axis */
    const NM = G.map(row => row.map(() => [0, 0, 0])),
      addN = (i, j, v) => {
        const q = NM[i][j];
        q[0] += v[0];
        q[1] += v[1];
        q[2] += v[2];
      };
    for (let i = 0; i < NR - 1; i++)
      for (let j = 0; j < n; j++) {
        const a = G[i][j],
          b = G[i + 1][j],
          c = G[i + 1][j + 1],
          d = G[i][j + 1],
          u = [c[0] - a[0], c[1] - a[1], c[2] - a[2]],
          v = [d[0] - b[0], d[1] - b[1], d[2] - b[2]];
        let w = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const mx = (a[0] + c[0]) / 2 - x0,
          mz = (a[2] + c[2]) / 2 - y0,
          my = (a[1] + c[1]) / 2 - (G[i][0][1] + G[i + 1][0][1]) / 2;
        if (w[0] * mx + w[2] * mz + w[1] * my * 0.3 < 0) w = [-w[0], -w[1], -w[2]];
        addN(i, j, w);
        addN(i + 1, j, w);
        addN(i + 1, j + 1, w);
        addN(i, j + 1, w);
      }
    for (let i = 0; i < NR; i++) {
      const s0 = NM[i][0],
        s1 = NM[i][n];
      for (let q = 0; q < 3; q++) {
        s0[q] += s1[q];
        s1[q] = s0[q];
      }
    }
    for (let i = 0; i < NR; i++)
      for (let j = 0; j <= n; j++) {
        const q = NM[i][j];
        if (Math.hypot(q[0], q[1], q[2]) < 1e-9) {
          const p = G[i][j];
          q[0] = p[0] - x0;
          q[2] = p[2] - y0;
          q[1] = i === 0 ? -1 : i === NR - 1 ? 1 : 0;
        }
      }
    const arc = (2 * Math.PI * Math.max(r, ry)) / n;
    for (let i = 0; i < NR - 1; i++) {
      if (G[i + 1][0][1] <= 0) continue;
      const y0r = G[i][0][1],
        y1r = G[i + 1][0][1];
      for (let j = 0; j < n; j++) {
        const uv = (jj, yy) =>
          stave
            ? [yy, jj * arc]
            : [jj * arc, yy]; /* round by the angle: stripes run out from the middle, staves stay straight */
        const Q = [G[i][j], G[i + 1][j], G[i + 1][j + 1], G[i][j + 1]];
        let FN = null;
        if (L.facet) {
          /* flat faces (rocks): each quad lit by its own normal, pointing away from the shape's middle */
          const e1 = [Q[2][0] - Q[0][0], Q[2][1] - Q[0][1], Q[2][2] - Q[0][2]],
            e2 = [Q[3][0] - Q[1][0], Q[3][1] - Q[1][1], Q[3][2] - Q[1][2]];
          FN = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
          const mx = (Q[0][0] + Q[2][0]) / 2 - x0,
            my = (Q[0][1] + Q[2][1]) / 2 - ((L.z || 0) + h / 2),
            mz = (Q[0][2] + Q[2][2]) / 2 - y0;
          if (FN[0] * mx + FN[1] * my + FN[2] * mz < 0) FN = [-FN[0], -FN[1], -FN[2]];
        }
        poly(
          Q,
          FN || [NM[i][j], NM[i + 1][j], NM[i + 1][j + 1], NM[i][j + 1]],
          [uv(j, y0r), uv(j, y1r), uv(j + 1, y1r), uv(j + 1, y0r)],
          tx,
          c
        );
      }
    }
    const top = NR - 1,
      ft = R[top][1];
    if (ft > 0.02) {
      const ct = [x0, G[top][0][1], y0],
        tt = t === 'rings' ? 21 : tx;
      for (let j = 0; j < n; j++) {
        const a = G[top][j],
          b = G[top][j + 1];
        poly(
          [ct, b, a],
          [0, 1, 0],
          [
            [1, 1],
            [b[0] - x0 + 1, b[2] - y0 + 1],
            [a[0] - x0 + 1, a[2] - y0 + 1],
          ],
          tt,
          c
        );
      }
    }
    if (G[0][0][1] > 0.01 && R[0][1] > 0.02) {
      const cb = [x0, G[0][0][1], y0];
      for (let j = 0; j < n; j++) {
        const a = G[0][j],
          b = G[0][j + 1];
        poly(
          [cb, a, b],
          [0, -1, 0],
          [
            [1, 1],
            [a[0] - x0 + 1, a[2] - y0 + 1],
            [b[0] - x0 + 1, b[2] - y0 + 1],
          ],
          tx,
          c
        );
      }
    }
  }
  if (!nv) return null;
  /* packed as the models are (24 bytes a vertex) */
  const vb = new ArrayBuffer(nv * 24),
    i16 = new Int16Array(vb),
    i8 = new Int8Array(vb),
    u8 = new Uint8Array(vb);
  let x0 = 1e9,
    y0 = 1e9,
    z0 = 1e9,
    x1 = -1e9,
    y1 = -1e9,
    z1 = -1e9;
  for (let i = 0; i < nv; i++) {
    const p = V[i * 6],
      nn = V[i * 6 + 1],
      uv = V[i * 6 + 2],
      tx = V[i * 6 + 3],
      c = V[i * 6 + 4],
      g = V[i * 6 + 5],
      o = i * 24,
      l = Math.hypot(nn[0], nn[1], nn[2]) || 1;
    i16[o / 2] = Math.round(p[0] * 256);
    i16[o / 2 + 1] = Math.round(p[1] * 256);
    i16[o / 2 + 2] = Math.round(p[2] * 256);
    x0 = Math.min(x0, p[0]);
    x1 = Math.max(x1, p[0]);
    y0 = Math.min(y0, p[1]);
    y1 = Math.max(y1, p[1]);
    z0 = Math.min(z0, p[2]);
    z1 = Math.max(z1, p[2]);
    i8[o + 8] = Math.round((nn[0] / l) * 127);
    i8[o + 9] = Math.round((nn[1] / l) * 127);
    i8[o + 10] = Math.round((nn[2] / l) * 127);
    i16[o / 2 + 6] = Math.round(uv[0] * 64);
    i16[o / 2 + 7] = Math.round(uv[1] * 64);
    u8[o + 16] = tx % 8;
    u8[o + 17] = (tx / 8) | 0;
    /* 0 the building ramp, 1 its flat colour (a building's own mesh), 2-32 window glass 1-31 */
    u8[o + 18] = g ? g + 1 : 0;
    u8[o + 20] = c[0];
    u8[o + 21] = c[1];
    u8[o + 22] = c[2];
    u8[o + 23] = 255;
  }
  /* each window: its number, its middle and which way it looks out (x, up, depth: along its thin side, away from the
     model's middle) */
  const mx = (x0 + x1) / 2,
    mz = (z0 + z1) / 2,
    wins = Object.entries(GB).map(([id, b]) => {
      const c = [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2],
        side = b[3] - b[0] < b[5] - b[2];
      return {
        id: +id,
        p: c,
        n: side ? [Math.sign(c[0] - mx) || 1, 0, 0] : [0, 0, Math.sign(c[2] - mz) || -1],
      };
    });
  return {
    vb,
    ib: nv > 65535 ? new Uint32Array(I) : new Uint16Array(I),
    n: I.length,
    tris: I.length / 3,
    box: [x0, y0, z0, x1, y1, z1],
    wins,
  };
}
function lowPolyOn(rec) {
  return (
    typeof engineSetting === 'function' &&
    !!engineSetting('world', 'voxelLowPoly') &&
    !(rec.layers || []).some(l => l.k === 'raw' && !l.hide)
  );
}
function drawPropModelMesh(m) {
  const gl = gpuState.gl;
  gl.bindVertexArray(m.vao);
  if (m.el) gl.drawElements(gl.TRIANGLES, m.n, m.u32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
  else gl.drawArrays(gl.TRIANGLES, 0, m.n);
}
/* the model's program: its own vertex shader (placed, scaled, turned and spun like a voxel prop), the buildings' look */
const lowPolyVertexShader = () => `#version 300 es
precision highp float;layout(location=0) in vec3 mPos;layout(location=1) in vec3 mNrm;layout(location=2) in vec2 mUV;layout(location=3) in vec3 mTex;layout(location=4) in vec3 mCol;
uniform mat4 uVP;uniform vec3 uBase,uSpinC;uniform vec4 uSpin;uniform float uS,uRot,uFlip;out vec3 vW;out vec3 vN;out vec2 vUV;out vec3 vTex;out vec3 vCol;${COMMON_GLSL}${SPIN_GLSL}
void main(){float cr=cos(uRot),sr=sin(uRot);vec3 q0=voxSpin(mPos/256.-uSpinC)+uSpinC,n0=voxSpin(mNrm);vec3 p=vec3(q0.x*uFlip,q0.y,q0.z)*uS;p=vec3(p.x*cr-p.z*sr,p.y,p.x*sr+p.z*cr);vec3 n=vec3(n0.x*uFlip,n0.y,n0.z);n=vec3(n.x*cr-n.z*sr,n.y,n.x*sr+n.z*cr);
 vec3 w=uBase+p;w.y+=curveY(uBase.xz);vW=w;vN=n;vUV=mUV/64.;vTex=mTex;vCol=mCol;gl_Position=uVP*vec4(w,1.);}`;
/* a window's glass (vTex.z 2-32: window 1-31): by day the sky in it, more of it at a grazing look, and a glint of the
   sun; lit from its room when its bit of uWinOn is set, as strongly as uWinK says (1 after dark), a warm lamp, a cooler
   kitchen or now and then a TV's blue, each window its own (uWinSeed: the building's), rolled off softly so it glows
   and blooms the window's own shape */
const GLASS_GLSL = `uniform int uWinOn;uniform float uWinK,uWinSeed;
vec3 glassLit(vec3 lit,vec3 n,vec3 v,float sh){float id=floor(vTex.z+.5)-1.;if(id<.5)return lit;
 float ct=abs(dot(n,v)),fr=.15+.5*pow(1.-ct,3.);
 vec3 g=mix(lit,uAmbTop*(.6+.4*sh),fr)+uSunCol*pow(max(dot(reflect(-v,n),uSunDir),0.),80.)*sh;
 if(uWinK<.001||((uWinOn>>int(id))&1)==0)return g;
 float h=fract(id*.6180339+uWinSeed);vec3 lc=h<.18?vec3(.62,.78,1.25)*(.85+.25*sin(uTime*.009+id)):h<.45?vec3(1.15,1.05,.85):vec3(1.25,1.,.7);
 vec3 e=lc*(.62+.6*fract(h*7.31))*uWinK;e=(1.-exp(-e*1.15))*1.6;
 return g*(1.-.75*min(uWinK,1.))+e*mix(.55,1.,ct);}`;
/* the model's light: the buildings' look and textures, with the props' cel shading (three tones of sun, as the voxel
   props and the painted props have) as much as the model asks (uCel; a recipe's "cel", else .75) */
function lowPolyFragmentShader() {
  const f = BUILDING_SHADERS.bld[1],
    a = 'shade(c,n,vW,sh,ao,vec4(.1,30.,0.,.3),0.)';
  if (!f.includes(a)) return f;
  /* terrain TR-3: a model between the camera and you (a tree's trunk on a mountain's shelf) thins out like the rock */
  return f
    .replace(a, 'glassLit(shade(c,n,vW,sh,ao,vec4(.06,20.,0.,.22),uCel),n,v,sh)')
    .replace('uniform vec3 uBP;', 'uniform vec3 uBP;uniform float uCel;' + ROCK_GLSL + GLASS_GLSL)
    .replace('void main(){', 'void main(){if(rockHides(vW))discard;');
}
/* the models among the items, drawn after the voxel props: L is [item, mesh] */
/* alpha 0.4: the props' shaders with the low-poly model's, for compiling ahead when the 3D view starts (walk-view-gl.js ensureWalkGl) */
export function propModelShaders() {
  if (!PROP_MODEL_SHADERS.mdl && typeof BUILDING_SHADERS !== 'undefined')
    PROP_MODEL_SHADERS.mdl = [lowPolyVertexShader(), lowPolyFragmentShader()];
  return PROP_MODEL_SHADERS;
}
function drawLowPolyModels(C, X, L) {
  if (!L.length || typeof BUILDING_SHADERS === 'undefined' || typeof buildingArt !== 'function') return;
  const gl = gpuState.gl;
  propModelShaders();
  ensurePrograms(PROP_MODEL_SHADERS);
  const A = buildingArt(),
    det = imageTexture(artImage(A.detail), { noNormal: true });
  if (!det) return;
  const p = useWalkProgram('mdl', C, X);
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  gl.disable(gl.CULL_FACE);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, det.t);
  gl.uniform1i(p.U.uDet, 0);
  gl.uniform2fv(p.U.uAtl, buildingTextureGrid(A));
  if (p.U.uScroll) gl.uniform2f(p.U.uScroll, 0, 0);
  for (const [it, m] of L) {
    gl.uniform1f(p.U.uFade, it.fade ?? 1);
    gl.uniform1f(p.U.uBaseY, it.y);
    if (p.U.uCel) gl.uniform1f(p.U.uCel, it.vox && it.vox.cel != null ? it.vox.cel : 0.75);
    if (typeof setPropLookUniforms === 'function') setPropLookUniforms(p.U, it.lk, [it.x, it.y, it.z]);
    setPropModelUniforms(p, it);
    setItemSpin(p, it);
    if (p.U.uWinK) {
      const W = it.wins ? it.winL || (it.winL = modelWindowLight(it, walkRenderer.dark || 0)) : null;
      gl.uniform1f(p.U.uWinK, W ? W.k : 0);
      gl.uniform1i(p.U.uWinOn, W ? W.on : 0);
      gl.uniform1f(p.U.uWinSeed, W ? (Math.abs(Math.sin(it.x * 12.9898 + it.z * 78.233)) * 43.7585) % 1 : 0);
    }
    drawPropModelMesh(m);
    for (const q of m.more || []) drawPropModelMesh(q);
    drawSpinningParts(p, m);
    propModelState.drawn++;
    propModelState.lowPoly++;
  }
  gl.bindVertexArray(null);
}
/* alpha 0.4: a part that turns (a propeller): its own mesh, turned uSpin.w radians about the axis uSpin.xyz (a unit
   vector, up as y) through its pivot uSpinC (the model's metres, up as y) */
const SPIN_GLSL = `vec3 voxSpin(vec3 d){float a=uSpin.w;if(a==0.)return d;vec3 k=uSpin.xyz;float c=cos(a),s=sin(a);return d*c+cross(k,d)*s+k*dot(k,d)*(1.-c);}`;
const PROP_MODEL_SHADERS = {
  vox: [
    `#version 300 es
precision highp float;layout(location=0) in vec3 qPos;layout(location=1) in vec3 qNrm;layout(location=2) in vec3 qCol;uniform mat4 uVP;uniform vec3 uBase,uSpinC;uniform vec4 uSpin;uniform float uS,uRot,uFlip,uQ;${COMMON_GLSL}out vec3 vW;out vec3 vN;out vec3 vC;${SPIN_GLSL}
void main(){float cr=cos(uRot),sr=sin(uRot);vec3 q0=voxSpin(qPos*uQ-uSpinC)+uSpinC,n0=voxSpin(qNrm);vec3 p=vec3(q0.x*uFlip,q0.y,q0.z)*uS;p=vec3(p.x*cr-p.z*sr,p.y,p.x*sr+p.z*cr);vec3 n=vec3(n0.x*uFlip,n0.y,n0.z);n=vec3(n.x*cr-n.z*sr,n.y,n.x*sr+n.z*cr);
 vec3 w=uBase+p;w.y+=curveY(uBase.xz);vW=w;vN=n;vC=qCol;gl_Position=uVP*vec4(w,1.);}`,
    `#version 300 es
precision highp float;in vec3 vW;in vec3 vN;in vec3 vC;out vec4 o;uniform vec3 uBaseP;uniform float uFade,uEmit;${LIGHT_GLSL}${ROCK_GLSL}
float bay(vec2 p){ivec2 i=ivec2(mod(p,4.));int b[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);return (float(b[i.y*4+i.x])+.5)/16.;}
void main(){if(uFade<.99&&bay(gl_FragCoord.xy)>uFade)discard;if(rockHides(vW))discard;vec3 n=normalize(vN);vec3 c=vC;float hy=vW.y-uBaseP.y;
 float sh=shadowAtN(vW+n*.05,n,.0015),ao=mix(contactAO(vW),1.,clamp(hy*2.,0.,1.)),occ=min(sh,ao);
 /* cel shading: the sun in three tones, a hard terminator, like the painted props */
 vec3 v=normalize(uEye-vW);float rim=pow(1.-max(dot(n,v),0.),3.)*.1;
 o=vec4(fogit(shade(c,n,vW,sh,ao,vec4(.04,16.,0.,.2),.75)+c*rim*uSunCol*sh+c*uEmit,vW),1.);}`,
  ],
  voxS: [
    `#version 300 es
precision highp float;layout(location=0) in vec3 qPos;layout(location=1) in vec3 qNrm;layout(location=2) in vec3 qCol;uniform mat4 uVP;uniform vec3 uBase,uSpinC;uniform vec4 uSpin;uniform float uS,uRot,uFlip,uQ;${COMMON_GLSL}${SPIN_GLSL}
void main(){float cr=cos(uRot),sr=sin(uRot);vec3 q0=voxSpin(qPos*uQ-uSpinC)+uSpinC;vec3 p=vec3(q0.x*uFlip,q0.y,q0.z)*uS;p=vec3(p.x*cr-p.z*sr,p.y,p.x*sr+p.z*cr);vec3 w=uBase+p;w.y+=curveY(uBase.xz);gl_Position=uVP*vec4(w,1.);}`,
    `#version 300 es
precision highp float;out vec4 o;void main(){o=vec4(1.);}`,
  ],
};
/* phase 09 batch 1: a recipe with some colours and pictures swapped (swap: {"#old": "#new", "old/path.png": "new/path.png"}),
   made once per variant: a palette swap for the solid parts, a picture swap for the picture layers */
const SWAPPED_RECIPES = new Map();
function swappedRecipe(path, rec, swap) {
  const c = SWAPPED_RECIPES.get(path);
  if (c && c.src === rec) return c.rec;
  const up = v => (typeof v === 'string' ? v.toUpperCase() : v),
    S = new Map(Object.entries(swap || {}).map(([a, b]) => [up(a), b])),
    rf = swap && swap['@roof'],
    out = {
      ...rec,
      layers: (rec.layers || []).map(L => {
        const n = { ...L };
        if (n.col && S.has(up(n.col))) n.col = S.get(up(n.col));
        if (n.img && S.has(up(n.img))) n.img = S.get(up(n.img));
        /* phase 09: a roof style (the walk view's propWithVariant) on the model's roof parts */
        if (n.roof && rf) {
          n.col = rf.col;
          n.tex = rf.tex;
        }
        return n;
      }),
    };
  SWAPPED_RECIPES.set(path, { src: rec, rec: out });
  return out;
}
/* tag an item that draws as voxels (gatherFrameItems calls this): the sprite and the solid-prop body stand aside */
function tagPropModel(it) {
  if (
    !propModelsOn() ||
    it.k !== 'prop' ||
    it.far ||
    it.layer ||
    !it.M ||
    !it.M.model ||
    (it.p && it.p.model === 'card')
  )
    return;
  const spec = it.M.model;
  let rec, path;
  if (typeof spec === 'object') {
    rec = spec;
    path = 'inline:' + it.p.k + '#' + (it.M.voxV || 0);
  } else {
    rec = loadPropModelRecipe(spec);
    path = spec;
  }
  /* phase 09 batch 1: a variant that swaps colours or pictures (an autumn oak: the same trunk, other leaves) */
  if (rec && it.M.swap) {
    path += '#' + (it.M._vk ?? JSON.stringify(it.M.swap));
    rec = swappedRecipe(path, rec, it.M.swap);
  }
  const R = voxelResolution() + (engineSetting('world', 'voxelLowPoly') ? 1000 : 0);
  if (propModelState.res !== R) {
    if (propModelState.res) flushPropModelMeshes();
    propModelState.res = R;
  }
  /* a few new meshes a frame (about 12 ms): the rest draw as their pictures a frame or two longer */
  if (rec && !propModelState.meshes.has(path)) {
    const fr = typeof walkRenderer !== 'undefined' ? walkRenderer.frames : 0;
    if (propModelState.fr !== fr) {
      propModelState.fr = fr;
      propModelState.bt = 0;
    }
    if (propModelState.bt > 12) return;
    const t0 = performance.now();
    propModelGuard(() => propModelMesh(path, rec));
    propModelState.bt += performance.now() - t0;
  }
  /* only a recipe that makes a solid stands in for the picture: while it loads, or if it is empty or failed, the picture draws */
  if (!rec) return;
  if (rec.kind === 'mesh' || lowPolyOn(rec)) {
    const A = typeof buildingArt === 'function' ? buildingArt() : null,
      im = A && typeof artImage === 'function' ? artImage(A.detail) : null;
    if (!im || !(im.naturalWidth || im.width)) return;
  }
  const m = propModelGuard(() => propModelMesh(path, rec));
  if (!m) return;
  it.vox = rec;
  it.voxPath = path;
  /* a low-poly building's window glass (walk/lighting.js modelWindowLight lights it; its picture's window glows stay off) */
  if (m.wins) it.wins = m.wins;
}
/* picture layers of a voxel prop as sprite items of their own (set in the model, metres from its base). Phase 09
   batch 1, for trees with a modelled trunk and drawn leaf clumps: a layer may say shadow (1: it casts its cut-out
   shadow), recv (0: it takes no shadows from the shadow map, for a crown that would shade its own clumps in stripes),
   sway (how much the wind moves it, times the prop's sway; the model itself stays still), glow (it lights up
   when the lamps come on, a lantern's glass), yaw (with face fixed: which way it faces, radians, pi/2 the right side,
   pi the back; batch 8, a tower's windows on every face), and the recipe its art's scale (ppm: pixels to the metre; else the scenery's) */
function propModelImageItems(it, out) {
  const rec = it.vox;
  if (!rec) return;
  /* HB-1: on the model as its shaders draw it (logic/prop-turn.js decalPlace): its size with the look's wobble, its
     turn (phase 09 batch 9: the placement's too), its mirror (lettering never mirrored) and its bob */
  const m = {
    s: (it.p.s || 1) * (it.lk ? it.lk.size : 1),
    f: it.flip || 1,
    turn: propTurn(it),
    bob: mooredBob(it),
  };
  for (const L of rec.layers || []) {
    if (L.k !== 'img' || L.hide) continue;
    const im0 = typeof artImage === 'function' ? artImage(L.img) : null;
    if (!im0 || !(im0.naturalWidth || im0.width)) {
      if (typeof artImg === 'function' && L.img) artImg(L.img);
      continue;
    }
    const im = L.clip || L.shade ? leafCut(im0, L) : im0;
    if (!im) continue;
    const d = decalPlace(it, L, m),
      s = d.s,
      w = im.naturalWidth || im.width,
      h = im.naturalHeight || im.height,
      mpp =
        (L.s || 1) / (rec.ppm || (typeof gameData !== 'undefined' && gameData.scenery && gameData.scenery.ppu) || 34);
    out.push({
      k: 'prop',
      p: it.p,
      M: layerProp(it.M),
      im,
      x: d.x,
      z: d.z,
      y: d.y,
      mpp: mpp * s,
      ox: -(w / 2),
      oy: -(h - 1),
      w,
      h,
      flip: d.flip,
      shear: (it.shear || 0) * (L.sway ?? 1),
      sh: L.shadow ? (it.M && it.M.shadow ? it.M.shadow : 1) * s : 0,
      glow: L.glow ? L.glow * (typeof lampLit === 'function' ? lampLit(it.x, it.z, 0) : 1) : 0,
      noRecv: L.recv === 0,
      /* phase 09 batch 10: metres toward the eye (along the camera's line of sight), so a conifer's tiers, centred on
         its modelled mast, stay in front of it from every side (walk/sprites.js uDZ) */
      eyeward: L.front && L.face !== 'fixed' ? L.front * s : 0,
      fixed: L.face === 'fixed',
      plane: L.face === 'fixed',
      yaw: d.yaw /* phase 09 batch 9: a decal turns with its model */,
      mat: it.mat,
      layer: L,
      still: it.still,
      voxImg: 1,
    });
  }
}
/* phase 09 batch 1: a tree's leaves are one picture, its crown as drawn (paint it in the Studio like any prop picture).
   Each clump is cut from it at run time: clip [x, y, r] is a circle in that picture's pixels; the cut is a square
   2r across with the circle's bottom at its base (where the clump stands), and the lower rim of the cut gets the
   picture's darkest colour as an outline, as a drawn clump has. shade darkens the whole picture (the crown's core,
   behind the clumps). Cuts are kept per picture and made again when the picture changes (the Studio's _ver). */
const LEAF_CUTS = new WeakMap();
function leafOutlineColour(d) {
  const n = new Map();
  for (let i = 0; i < d.length; i += 4)
    if (d[i + 3] > 127) {
      const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      n.set(k, (n.get(k) || 0) + 1);
    }
  let best = 0,
    bl = 1e9;
  for (const [k, c] of n)
    if (c > 15) {
      const l = 0.299 * (k >> 16) + 0.587 * ((k >> 8) & 255) + 0.114 * (k & 255);
      if (l < bl) {
        bl = l;
        best = k;
      }
    }
  return [best >> 16, (best >> 8) & 255, best & 255];
}
function leafCut(im, L) {
  const ver = im._ver || 0;
  let C = LEAF_CUTS.get(im);
  if (!C || C.ver !== ver) {
    const W = im.naturalWidth || im.width,
      H = im.naturalHeight || im.height,
      src = makeCanvas(W, H),
      x = src.getContext('2d');
    x.drawImage(im, 0, 0);
    const data = x.getImageData(0, 0, W, H).data;
    C = { ver, W, H, data, outline: leafOutlineColour(data), cuts: new Map() };
    LEAF_CUTS.set(im, C);
  }
  const key = (L.clip || []).join(',') + '|' + (L.shade || 1);
  let out = C.cuts.get(key);
  if (out) return out;
  const { W, H, data } = C,
    sh = L.shade || 1;
  if (!L.clip) {
    out = makeCanvas(W, H);
    const X = out.getContext('2d'),
      o = X.createImageData(W, H);
    for (let i = 0; i < data.length; i += 4) {
      o.data[i] = data[i] * sh;
      o.data[i + 1] = data[i + 1] * sh;
      o.data[i + 2] = data[i + 2] * sh;
      o.data[i + 3] = data[i + 3];
    }
    X.putImageData(o, 0, 0);
  } else if (L.clip.length >= 4) {
    /* phase 09 batch 10: a box [left, top, right, bottom] (picture pixels, right and bottom excluded), a pine's tier:
       a wide, short band with its own drawn hem, so no outline is added; the layer stands on the box's bottom middle
       as a circle's clump stands on its circle's */
    const [x0, y0, x1, y1] = L.clip.map(Math.round),
      w = Math.max(1, x1 - x0),
      h = Math.max(1, y1 - y0);
    out = makeCanvas(w, h);
    const X = out.getContext('2d'),
      o = X.createImageData(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const px = x0 + x,
          py = y0 + y;
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        const i = (py * W + px) * 4,
          j = (y * w + x) * 4;
        if (data[i + 3] <= 127) continue;
        o.data[j] = data[i] * sh;
        o.data[j + 1] = data[i + 1] * sh;
        o.data[j + 2] = data[i + 2] * sh;
        o.data[j + 3] = 255;
      }
    X.putImageData(o, 0, 0);
  } else {
    const [cx, cy, r] = L.clip,
      R = Math.max(1, Math.ceil(r)),
      S = 2 * R,
      x0 = Math.round(cx) - R,
      y0 = Math.round(cy) - R,
      inC = (px, py) => (px + 0.5 - cx) ** 2 + (py + 0.5 - cy) ** 2 <= r * r,
      op = (px, py) => px >= 0 && py >= 0 && px < W && py < H && data[(py * W + px) * 4 + 3] > 127;
    out = makeCanvas(S, S);
    const X = out.getContext('2d'),
      o = X.createImageData(S, S);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const px = x0 + x,
          py = y0 + y;
        if (!op(px, py) || !inC(px, py)) continue;
        const i = (py * W + px) * 4,
          j = (y * S + x) * 4,
          rim =
            py > cy - r * 0.25 &&
            [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ].some(([a, b]) => op(px + a, py + b) && !inC(px + a, py + b));
        const c = rim ? C.outline : [data[i], data[i + 1], data[i + 2]];
        o.data[j] = c[0] * sh;
        o.data[j + 1] = c[1] * sh;
        o.data[j + 2] = c[2] * sh;
        o.data[j + 3] = 255;
      }
    X.putImageData(o, 0, 0);
  }
  C.cuts.set(key, out);
  return out;
}
/* phase 09 batch 1: a picture layer of a model with a footprint (a cottage's door and windows) is a plain picture: the
   footprint (box) would draw it as a building front pushed back through the house, inside its own walls */
const LAYER_PROPS = new WeakMap();
function layerProp(M) {
  if (!M || !M.box) return M;
  let o = LAYER_PROPS.get(M);
  if (!o) {
    o = { ...M };
    delete o.box;
    LAYER_PROPS.set(M, o);
  }
  return o;
}
/* alpha 0.4.1: a moored airship (catalogue bob: metres) rides the air: it rises and settles, a little more in a stronger
   wind, and swings a few degrees round its mast (it turns about its base point, the mast's foot) */
function mooredBob(it) {
  const b = it.M && it.M.bob;
  if (!b || (typeof reducedMotion !== 'undefined' && reducedMotion)) return null;
  const t = (walkView.t || 0) / 1000,
    ph = it.x * 0.37 + it.z * 0.21,
    w =
      typeof windLeanAt === 'function' && walkView.sc
        ? Math.min(2, Math.abs(windLeanAt(it.x, it.z, walkView.t || 0, walkView.sc)) * 8)
        : 0;
  return [
    (Math.sin(t * 1.25 + ph) + Math.sin(t * 0.47 + ph * 2) * 0.4) * b * (1 + w * 0.5),
    Math.sin(t * 0.29 + ph) * 0.03 * (1 + w * 0.4),
  ];
}
/* RF-2: a whole model turned about any axis (a thrown pyramid tumbling, rocking on a base edge): it.spin {a: a unit
   axis, up as y; an: radians; c: the pivot in the model's metres, up as y}; else not turned */
function setItemSpin(p, it) {
  const gl = gpuState.gl,
    S = it.spin;
  if (S) {
    gl.uniform4f(p.U.uSpin, S.a[0], S.a[1], S.a[2], S.an);
    gl.uniform3fv(p.U.uSpinC, S.c);
  } else {
    gl.uniform4f(p.U.uSpin, 1, 0, 0, 0);
    gl.uniform3f(p.U.uSpinC, 0, 0, 0);
  }
}
function setPropModelUniforms(p, it) {
  const gl = gpuState.gl,
    U = p.U,
    s = (it.p.s || 1) * (it.lk ? it.lk.size : 1),
    bo = mooredBob(it);
  gl.uniform3f(U.uBase, it.x, it.y + (bo ? bo[0] : 0), it.z);
  gl.uniform1f(U.uS, s);
  gl.uniform1f(U.uRot, propTurn(it) + (bo ? bo[1] : 0)); /* phase 09 batch 9: and the placement's turn */
  gl.uniform1f(U.uFlip, it.flip || 1);
}
export function drawPropModels(C, items, X, hits, labels, PPU) {
  propModelState.drawn = 0;
  propModelState.lowPoly = 0;
  if (!propModelsOn()) return;
  propModelGuard(() => {
    const gl = gpuState.gl;
    ensurePrograms(PROP_MODEL_SHADERS);
    let p = null;
    const ML = [];
    for (const it of items) {
      if (!it.vox || it.vis === false) continue;
      const m = propModelMesh(it.voxPath, it.vox);
      if (!m) continue;
      if (m.model) {
        ML.push([it, m]);
        continue;
      }
      if (!p) {
        p = useWalkProgram('vox', C, X);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.disable(gl.CULL_FACE);
      }
      gl.uniform3f(p.U.uBaseP, it.x, it.y, it.z);
      gl.uniform1f(p.U.uFade, it.fade ?? 1);
      gl.uniform1f(p.U.uEmit, it.glow ? it.glow : 0);
      setPropModelUniforms(p, it);
      gl.uniform1f(p.U.uQ, m.q || 1);
      setItemSpin(p, it);
      drawPropModelMesh(m);
      drawSpinningParts(p, m);
      propModelState.drawn++;
      if (hits && !it.far) addHitTarget(it, C, hits, labels, PPU);
    }
    gl.bindVertexArray(null);
    drawLowPolyModels(C, X, ML);
    if (hits) for (const [it] of ML) if (!it.far) addHitTarget(it, C, hits, labels, PPU);
  });
}
function drawPropModelShadows(SH, items) {
  if (!propModelsOn()) return;
  propModelGuard(() => {
    const gl = gpuState.gl;
    ensurePrograms(PROP_MODEL_SHADERS);
    let p = null;
    const ca = typeof worldCurveArgs === 'function' ? worldCurveArgs() : [0, 0, 0, 1e9];
    for (const it of items) {
      if (!it.vox) continue;
      const m = propModelMesh(it.voxPath, it.vox);
      if (!m) continue;
      if (!p) {
        p = gpuState.P.voxS;
        gl.useProgram(p.p);
        gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
        gl.uniform3f(p.U.uCurve, ca[0], ca[1], ca[2]);
        gl.uniform1f(p.U.uCurveD0, ca[3]);
      }
      setPropModelUniforms(p, it);
      gl.uniform1f(p.U.uQ, m.q || 1);
      setItemSpin(p, it);
      drawPropModelMesh(m);
      for (const q of m.more || []) drawPropModelMesh(q);
      drawSpinningParts(p, m);
    }
    gl.bindVertexArray(null);
  });
}
/* art the scene needs for its voxel props' picture layers (mapArtPaths asks) */
function propModelArtPaths(sc, C) {
  const L = [];
  let any = false;
  for (const p of sc.props || (sc._lite && sc._lite.props) || []) {
    const M = C.props[p.k];
    if (!M || !M.model) continue;
    any = true;
    const rec = propModelState.recipes.get(M.model);
    if (rec) for (const l of rec.layers || []) if (l.k === 'img' && l.img) L.push(l.img);
    /* phase 09 batch 1: a variant's own model and swapped pictures (the autumn oak's leaves) load with the place too */
    const V = p.v && M.variants ? M.variants[p.v - 1] : null;
    if (V && V.swap) for (const v of Object.values(V.swap)) if (/\.png$/i.test(v)) L.push(v);
    if (V && typeof V.model === 'string') {
      const r2 = propModelState.recipes.get(V.model);
      if (r2) for (const l of r2.layers || []) if (l.k === 'img' && l.img) L.push(l.img);
    }
  }
  /* alpha 0.4: the low-poly props and models are painted from the building sheet */
  if (any) L.push((C.buildArt && C.buildArt.detail) || 'scene/build/detail.png');
  return L;
}
