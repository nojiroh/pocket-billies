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
import { joinMeshes, spinGroups } from './logic/spin-merge.js';
import { limbPoints, lowPolyMeshData, voxelHash } from './logic/low-poly.js';
import { leafCutKey, leafCutPixels, leafOutlineColour } from './logic/pixel-facts.js';
import { gpuTag } from './engine/gpu-counters.js';
import { solidFragment } from './engine/shader-precision.js';
import { artImg, artURL, hexToRgb, makeCanvas } from './art.js';
import { artImage, walkView } from './walk-view.js';
import { engineSetting } from './engine/settings.js';
import {
  COMMON_GLSL,
  LIGHT_GLSL,
  ensurePrograms,
  gpuBuffer,
  gpuFree,
  gpuState,
  gpuVao,
  imageTexture,
} from './engine/webgl.js';
import {
  MODEL_INSTANCE_ATTRIBS,
  MODEL_INSTANCE_BYTES,
  buildModelBatches,
  modelInstanceStore,
  modelInstanceValues,
  modelInstanceVao,
  pointModelInstances,
  reserveModelInstances,
  writeModelInstance,
} from './engine/model-instances.js';
import { walkRenderer } from './walk/walk-state.js';
import { ROCK_GLSL } from './walk/walk-shaders.js';
import { rockCircleOn, useWalkProgram, worldCurveArgs } from './walk/draw-common.js';
import { frameBudgetLeft } from './walk/quality-cull.js';
import { setPropLookUniforms, windLeanAt } from './walk/prop-look.js';
import { addHitTarget } from './walk/sprites.js';
import { lampLit, modelWindowLight } from './walk/lighting.js';
import { BUILDING_SHADERS, bindBuildingNormals, buildingArt, buildingTextureGrid } from './buildings.js';
import { propMeshAhead, propMeshGet } from './prop-meshes.js';
/* eslint-disable no-func-assign */
expose({
  GLASS_GLSL: [() => GLASS_GLSL],
  GLOW_RGB_GLSL: [() => GLOW_RGB_GLSL],
  INSTANCE_IN_GLSL: [() => INSTANCE_IN_GLSL],
  INSTANCE_PLACE_GLSL: [() => INSTANCE_PLACE_GLSL],
  LAYER_PROPS: [() => LAYER_PROPS],
  LEAF_CUTS: [() => LEAF_CUTS],
  LEAF_ITEMS: [() => LEAF_ITEMS],
  LEAF_ITEM_CLEAR: [() => LEAF_ITEM_CLEAR],
  MDL_ATTRIBS: [() => MDL_ATTRIBS],
  MDL_FLAT: [() => MDL_FLAT],
  MDL_SOLID_EDITS: [() => MDL_SOLID_EDITS],
  MODEL_INSTANCES: [() => MODEL_INSTANCES],
  MODEL_SHADOW_INSTANCES: [() => MODEL_SHADOW_INSTANCES],
  MODEL_SHADOW_SHADERS: [() => MODEL_SHADOW_SHADERS],
  MODEL_VALUES: [() => MODEL_VALUES],
  NEUTRAL_MODEL_LOOK: [() => NEUTRAL_MODEL_LOOK],
  OWN_UNIT: [() => OWN_UNIT],
  PROP_MODEL_PROGRAMS: [() => PROP_MODEL_PROGRAMS],
  PROP_MODEL_SHADERS: [() => PROP_MODEL_SHADERS],
  PROP_MODEL_SHAPES: [() => PROP_MODEL_SHAPES],
  PROP_MODEL_TEXTURES: [() => PROP_MODEL_TEXTURES],
  SMEAR_GLSL: [() => SMEAR_GLSL],
  SPIN_BY_GLSL: [() => SPIN_BY_GLSL],
  SPIN_GLSL: [() => SPIN_GLSL],
  SWAPPED_RECIPES: [() => SWAPPED_RECIPES],
  VOXEL_KEY_OFFSET: [() => VOXEL_KEY_OFFSET],
  VOXEL_KEY_SPAN: [() => VOXEL_KEY_SPAN],
  VOXEL_TEXTURE_GRAIN: [() => VOXEL_TEXTURE_GRAIN],
  VOX_ATTRIBS: [() => VOX_ATTRIBS],
  VOX_FLAT: [() => VOX_FLAT],
  VOX_SOLID_EDITS: [() => VOX_SOLID_EDITS],
  addRawVoxels: [() => addRawVoxels, v => (addRawVoxels = v)],
  asFlatInputs: [() => asFlatInputs, v => (asFlatInputs = v)],
  bindOwnTexture: [() => bindOwnTexture, v => (bindOwnTexture = v)],
  decodeRawVoxels: [() => decodeRawVoxels, v => (decodeRawVoxels = v)],
  drawLowPolyItems: [() => drawLowPolyItems, v => (drawLowPolyItems = v)],
  drawLowPolyModels: [() => drawLowPolyModels, v => (drawLowPolyModels = v)],
  drawModelInstances: [() => drawModelInstances, v => (drawModelInstances = v)],
  drawModelPart: [() => drawModelPart, v => (drawModelPart = v)],
  drawModelShadowPart: [() => drawModelShadowPart, v => (drawModelShadowPart = v)],
  drawPropModelMesh: [() => drawPropModelMesh, v => (drawPropModelMesh = v)],
  drawPropModelShadows: [
    () => drawPropModelShadows,
    v => ((drawPropModelShadows = v), provide({ drawPropModelShadows })),
  ],
  drawPropModelShadowsInstanced: [() => drawPropModelShadowsInstanced, v => (drawPropModelShadowsInstanced = v)],
  drawPropModels: [() => drawPropModels, v => setDrawPropModels(v)],
  drawSpinningParts: [() => drawSpinningParts, v => (drawSpinningParts = v)],
  drawVoxItems: [() => drawVoxItems, v => (drawVoxItems = v)],
  flushPropModelMeshes: [
    () => flushPropModelMeshes,
    v => ((flushPropModelMeshes = v), provide({ flushPropModelMeshes })),
  ],
  greedyVoxelMesh: [() => greedyVoxelMesh, v => (greedyVoxelMesh = v)],
  invalidatePropModel: [() => invalidatePropModel, v => (invalidatePropModel = v)],
  layerProp: [() => layerProp, v => (layerProp = v)],
  leafCut: [() => leafCut, v => (leafCut = v)],
  leafItem: [() => leafItem, v => (leafItem = v)],
  loadPropModelRecipe: [() => loadPropModelRecipe, v => (loadPropModelRecipe = v)],
  lowPolyFragmentShader: [() => lowPolyFragmentShader, v => (lowPolyFragmentShader = v)],
  lowPolyInstancedShaders: [() => lowPolyInstancedShaders, v => (lowPolyInstancedShaders = v)],
  lowPolyOn: [() => lowPolyOn, v => (lowPolyOn = v)],
  lowPolyVertexShader: [() => lowPolyVertexShader],
  meshAttribs: [() => meshAttribs, v => (meshAttribs = v)],
  modelShadowInstancesReady: [() => modelShadowInstancesReady, v => (modelShadowInstancesReady = v)],
  modelShadowState: [() => modelShadowState],
  modelSolidDefs: [() => modelSolidDefs, v => (modelSolidDefs = v)],
  modelSolidItem: [() => modelSolidItem, v => (modelSolidItem = v)],
  modelsNearestFirst: [() => modelsNearestFirst, v => (modelsNearestFirst = v)],
  mooredBob: [() => mooredBob, v => ((mooredBob = v), provide({ mooredBob }))],
  propModelArtPaths: [() => propModelArtPaths, v => ((propModelArtPaths = v), provide({ propModelArtPaths }))],
  propModelGuard: [() => propModelGuard, v => (propModelGuard = v)],
  propModelImageItems: [() => propModelImageItems, v => ((propModelImageItems = v), provide({ propModelImageItems }))],
  propModelInstanceValues: [() => propModelInstanceValues, v => (propModelInstanceValues = v)],
  propModelMesh: [() => propModelMesh, v => ((propModelMesh = v), provide({ propModelMesh }))],
  propModelRecipe: [() => propModelRecipe, v => (propModelRecipe = v)],
  propModelShaders: [() => propModelShaders, v => ((propModelShaders = v), provide({ propModelShaders }))],
  propModelSolidShaders: [
    () => propModelSolidShaders,
    v => ((propModelSolidShaders = v), provide({ propModelSolidShaders })),
  ],
  propModelState: [() => propModelState],
  propModelWarm: [() => propModelWarm, v => (propModelWarm = v)],
  propModelsOn: [() => propModelsOn, v => (propModelsOn = v)],
  setItemSmear: [() => setItemSmear, v => (setItemSmear = v)],
  setItemSpin: [() => setItemSpin, v => (setItemSpin = v)],
  setPropModelUniforms: [() => setPropModelUniforms, v => (setPropModelUniforms = v)],
  spinPartAngle: [() => spinPartAngle, v => (spinPartAngle = v)],
  splitSmeared: [() => splitSmeared, v => (splitSmeared = v)],
  swappedRecipe: [() => swappedRecipe, v => (swappedRecipe = v)],
  tagPropModel: [() => tagPropModel, v => ((tagPropModel = v), provide({ tagPropModel }))],
  uploadLowPolyMesh: [() => uploadLowPolyMesh, v => (uploadLowPolyMesh = v)],
  uploadPrebuiltModel: [() => uploadPrebuiltModel, v => (uploadPrebuiltModel = v)],
  voxInstancedShaders: [() => voxInstancedShaders, v => (voxInstancedShaders = v)],
  voxelFromKey: [() => voxelFromKey, v => (voxelFromKey = v)],
  voxelKey: [() => voxelKey, v => (voxelKey = v)],
  voxelResolution: [() => voxelResolution, v => (voxelResolution = v)],
  voxelise: [() => voxelise, v => (voxelise = v)],
});
/* eslint-enable no-func-assign */
provide({
  drawPropModelShadows,
  drawPropModels,
  flushPropModelMeshes,
  mooredBob,
  propModelArtPaths,
  propModelImageItems,
  propModelMesh,
  propModelShaders,
  propModelSolidShaders,
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
provide({ propModelState }); /* to-module */
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
  /* BD-1 */
  ['prism', 'Prism (a profile drawn out)'],
  ['lathe', 'Lathe (a profile turned round)'],
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
  /* v46: in the single-page build the recipe is inlined as a data: link; inside some apps' web views a fetch of it is refused,
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
/* phase 20 R2: a mesh's vertex layout, one row per attribute [location, size, type, normalised, offset] with its
   stride: a voxel mesh (position in voxels, normal, colour) and a low-poly part (position in 1/256 m, normal, texture
   coordinates, the sheet's cell, colour). The instanced draws (engine/model-instances.js) lay the same out again */
const VOX_ATTRIBS = {
    stride: 16,
    rows: [
      [0, 3, 'SHORT', false, 0],
      [1, 3, 'BYTE', true, 8],
      [2, 3, 'UNSIGNED_BYTE', true, 12],
    ],
  },
  MDL_ATTRIBS = {
    stride: 24,
    rows: [
      [0, 3, 'SHORT', false, 0],
      [1, 3, 'BYTE', true, 8],
      [2, 2, 'SHORT', false, 12],
      /* BD-1: four each, the glow colour's two bytes in the fourths (19 and 23) */
      [3, 4, 'UNSIGNED_BYTE', false, 16],
      [4, 4, 'UNSIGNED_BYTE', true, 20],
    ],
  };
/* a mesh's own attributes, into the vertex array and the buffer bound now */
function meshAttribs(gl, A) {
  for (const [loc, n, ty, nm, off] of A.rows) {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, n, gl[ty], nm, A.stride, off);
  }
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
    /* FL-4b (quality.meshWorker): built on the helper thread (prop-meshes.js); until it is in, nothing is kept here
       and the picture stands in */
    const D = engineSetting('quality', 'meshWorker') ? propMeshGet(path, rec) : lowPolyMeshData(rec);
    if (D === undefined) return null;
    m = D
      ? {
          ...uploadLowPolyMesh(D.vb, D.ib),
          model: 1,
          lowpoly: 1,
          tris: D.tris,
          q: 1 / 256,
          box: D.box,
          spins: [],
          wins: D.wins.length ? D.wins : null,
          glow: D.glow,
        }
      : null;
    /* FL-2b: the layers that turn together (logic/spin-merge.js) in one mesh, one draw (logic/low-poly.js
       lowPolyMeshData) */
    if (m) for (const S of D.spins) m.spins.push({ ...uploadLowPolyMesh(S.vb, S.ib), ...S.spin, c: S.c, n: S.n });
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
    const vao = gpuVao('meshes');
    gl.bindVertexArray(vao);
    const vb = gpuBuffer('meshes', D.vb.byteLength);
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, D.vb, gl.STATIC_DRAW);
    meshAttribs(gl, VOX_ATTRIBS);
    const eb = gpuBuffer('meshes', D.ib.byteLength);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eb);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, D.ib, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, n: D.n, el: 1, u32: D.ib instanceof Uint32Array, quads: D.quads, bufs: [vb, eb] };
  };
  m = { ...up(M), box: M.box, q: 1 / R, res: R, spins: [] };
  /* alpha 0.4: parts that turn (the airships' propellers): a layer with spin {x, y, z: its pivot in metres; axis: 'x' across, 'y' depth, 'z' up, or [x, y, z] any way at all; rps: turns a second}.
     FL-2b: the layers that turn together in one mesh (logic/spin-merge.js), each voxelised on its own as before */
  for (const g of spinGroups(L)) {
    const S = joinMeshes(
      g.layers.map(l => greedyVoxelMesh(voxelise({ vpm: rec.vpm, layers: [{ ...l, spin: undefined }] }, R), R)),
      VOX_ATTRIBS.stride
    );
    if (S) m.spins.push({ ...up({ vb: S.vb, ib: S.ib, n: S.n, quads: S.verts / 4 }), ...g.spin });
  }
  propModelState.meshes.set(path, m);
  return m;
}
/* a turning part's angle at t seconds. Phase 09 batch 1: a part may swing to and fro instead of turning round
   (spin.swing: how far, in radians; rps: swings a second; a swing on its ropes) */
function spinPartAngle(s, t) {
  const ph = t * s.rps * Math.PI * 2;
  return s.sw ? Math.sin(ph) * s.sw : ph;
}
/* a mesh's turning parts (the one-at-a-time path, VFX-3's stretched items): each turned by its own angle now */
function drawSpinningParts(p, m) {
  if (!m.spins || !m.spins.length) return;
  const gl = gpuState.gl,
    t = (reducedMotion ? 0 : walkView.t || 0) / 1000;
  for (const s of m.spins) {
    gl.uniform4f(p.U.uSpin, s.a[0], s.a[1], s.a[2], spinPartAngle(s, t));
    gl.uniform3fv(p.U.uSpinC, s.c);
    drawPropModelMesh(s);
  }
  gl.uniform4f(p.U.uSpin, 1, 0, 0, 0);
  gl.uniform3f(p.U.uSpinC, 0, 0, 0);
}
function flushPropModelMeshes() {
  for (const k of [...propModelState.meshes.keys()]) invalidatePropModel(k, true);
  /* phase 20 R2: the instanced models' record buffer too (a restored context may hand back the same context object) */
  for (const S of [MODEL_INSTANCES, MODEL_SHADOW_INSTANCES]) {
    gpuFree(S.buf);
    S.buf = null;
    S.gl = null;
  }
}
export function invalidatePropModel(path, keep) {
  const m = propModelState.meshes.get(path);
  if (m && m.vao && typeof gpuState !== 'undefined' && gpuState.gl) {
    for (const q of [m, ...(m.more || []), ...(m.spins || [])]) {
      gpuFree(q.vao);
      gpuFree(q.ivao);
      gpuFree(q.sivao);
      for (const b of q.bufs || []) gpuFree(b);
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
    vao = gpuVao('meshes');
  gl.bindVertexArray(vao);
  const v = gpuBuffer('meshes', vb.byteLength);
  gl.bindBuffer(gl.ARRAY_BUFFER, v);
  gl.bufferData(gl.ARRAY_BUFFER, vb, gl.STATIC_DRAW);
  meshAttribs(gl, MDL_ATTRIBS);
  const e = gpuBuffer('meshes', ib.byteLength);
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
  /* studio track ST-7: a v2 part that spins (logic/model-mesh.js) is drawn as v1's spins are, about its pivot */
  const v2 = rec.v === 2,
    still = v2 ? (rec.parts || []).filter(P => !(P.spin && P.spin.rps)) : rec.parts || [],
    turning = v2
      ? (rec.parts || [])
          .filter(P => P.spin && P.spin.rps)
          .map(P => ({ ...P, c: P.pivot, a: P.spin.a, rps: P.spin.rps }))
      : [];
  const parts = still.map(mk).filter(Boolean);
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
    /* ST-7: the model's own texture (art path; null: the building sheet only) and whether it repeats */
    own: v2 && rec.tex ? rec.tex : null,
    wrap: !!rec.wrap,
    spins: [...(rec.spins || []), ...turning]
      .map(s => {
        const m = mk(s);
        return m && { ...m, c: s.c || [0, 0, 0], a: ax(s.a || [1, 0, 0]), rps: s.rps ?? 1.5 };
      })
      .filter(Boolean),
  };
}
function lowPolyOn(rec) {
  return (
    typeof engineSetting === 'function' &&
    !!engineSetting('world', 'voxelLowPoly') &&
    !(rec.layers || []).some(l => l.k === 'raw' && !l.hide)
  );
}
/* one mesh part drawn once (the one-at-a-time path) */
function drawPropModelMesh(m) {
  const gl = gpuState.gl;
  gl.bindVertexArray(m.vao);
  if (m.el) gl.drawElements(gl.TRIANGLES, m.n, m.u32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
  else gl.drawArrays(gl.TRIANGLES, 0, m.n);
}
/* BD-1: a glowing layer's colour from its two spare bytes (5-6-5 bits; logic/low-poly.js lowPolyFromRecipe packs it) */
const GLOW_RGB_GLSL = `vec3 glowRgb(float hi,float lo){float g=hi*256.+floor(lo*255.+.5);return vec3(floor(g/2048.),mod(floor(g/32.),64.),mod(g,32.))/vec3(31.,63.,31.);}`;
/* the model's program: its own vertex shader (placed, scaled, turned and spun like a voxel prop), the buildings' look */
const lowPolyVertexShader = () => `#version 300 es
precision highp float;layout(location=0) in vec3 mPos;layout(location=1) in vec3 mNrm;layout(location=2) in vec2 mUV;layout(location=3) in vec4 mTex;layout(location=4) in vec4 mCol;
uniform mat4 uVP;uniform vec3 uBase,uSpinC;uniform vec4 uSpin;uniform float uS,uRot,uFlip;out vec3 vGl;${GLOW_RGB_GLSL}out vec3 vW;out vec3 vN;out vec2 vUV;out vec3 vTex;out vec3 vCol;${COMMON_GLSL}${SPIN_GLSL}${SMEAR_GLSL}
void main(){float cr=cos(uRot),sr=sin(uRot);vec3 q0=voxSpin(mPos/256.-uSpinC)+uSpinC,n0=voxSpin(mNrm);vec3 p=vec3(q0.x*uFlip,q0.y,q0.z)*uS;p=vec3(p.x*cr-p.z*sr,p.y,p.x*sr+p.z*cr);p=squashY(smearDrag(p,cr,sr,mPos));vec3 n=vec3(n0.x*uFlip,n0.y,n0.z);n=vec3(n.x*cr-n.z*sr,n.y,n.x*sr+n.z*cr);
 vec3 w=uBase+p;w.y+=curveY(uBase.xz);vW=w;vN=n;vUV=mUV/64.;vTex=mTex.xyz;vCol=mCol.rgb;vGl=glowRgb(mTex.w,mCol.a);gl_Position=uVP*vec4(w,1.);}`;
/* a window's glass (vTex.z 2-32: window 1-31): by day the sky in it, more of it at a grazing look, and a glint of the
   sun; lit from its room when its bit of uWinOn is set, as strongly as uWinK says (1 after dark), a warm lamp, a cooler
   kitchen or now and then a TV's blue, each window its own (uWinSeed: the building's), rolled off softly so it glows
   and blooms the window's own shape. AS-1: a moving model's seed comes 2 higher (walk/lighting.js modelWindowLight;
   fract drops it from the colour): its sun glint is a soft sheen, not a sharp flash that strobes as it turns */
/* BD-1: a glowing layer (vTex.z 33: at night, 34: by day too; its colour vGl) shines as the windows do after dark
   (uWinK: 1 after dark, the daytime dial by day, none from inside a room): its own colour over the lit one, and
   brighter than white where it is strong, so bloom takes it and it keeps its hue */
const GLASS_GLSL = `uniform int uWinOn;uniform float uWinK,uWinSeed;in vec3 vGl;
vec3 glassLit(vec3 lit,vec3 n,vec3 v,float sh){if(vTex.z>32.5){float k=vTex.z>33.5?max(uWinK,1.):uWinK;if(k<.001)return lit;
 return mix(lit,vGl*1.2,.85*min(k,1.))+vGl*.3*k;}
 float id=floor(vTex.z+.5)-1.;if(id<.5)return lit;
 float ct=abs(dot(n,v)),fr=.15+.5*pow(1.-ct,3.);
 float gd=max(dot(reflect(-v,n),uSunDir),0.);vec3 g=mix(lit,uAmbTop*(.6+.4*sh),fr)+uSunCol*(uWinSeed>1.5?pow(gd,10.)*.18:pow(gd,80.))*sh;
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
  /* terrain TR-3: a model between the camera and you (a tree's trunk on a mountain's shelf) thins out like the rock
     (the buildings' shader has ROCK_GLSL since player visibility) */
  /* studio track ST-7: a v2 model's vertex marks its own texture (vTex.x 255; logic/model-mesh.js): the picture's
     colour times the vertex colour in place of a building-sheet cell, cut out where it is clear, no sheet bumps */
  const ownC = 'vec3 c=vTex.z>.5?vCol:rampC(vCol,floor(lv+.5));',
    bump = 'n=bldBump(n,g);';
  return f
    .replace(a, 'glassLit(shade(c,n,vW,sh,ao,vec4(.06,20.,0.,.22),uCel),n,v,sh)')
    .replace(
      ownC,
      ownC + 'bool own=vTex.x>254.5;if(own&&vTex.z<.5){vec4 tx=texture(uOwn,vUV/64.);if(tx.a<.5)discard;c=tx.rgb*vCol;}'
    )
    .replace(bump, 'if(!own)' + bump)
    .replace('uniform vec3 uBP;', 'uniform vec3 uBP;uniform float uCel;uniform sampler2D uOwn;' + GLASS_GLSL);
}
/* the models among the items, drawn after the voxel props: L is [item, mesh] */
/* alpha 0.4: the props' programs, for compiling ahead when the 3D view starts (walk-view-gl.js ensureWalkGl). Phase 20
   R4: the instanced pair (made from the plain vox and mdl texts, which are no longer compiled themselves); the shadows'
   voxSI is MODEL_SHADOW_SHADERS */
const PROP_MODEL_PROGRAMS = {};
export function propModelShaders() {
  if (!PROP_MODEL_SHADERS.mdl && typeof BUILDING_SHADERS !== 'undefined')
    PROP_MODEL_SHADERS.mdl = [lowPolyVertexShader(), lowPolyFragmentShader()];
  const P = PROP_MODEL_PROGRAMS;
  if (!P.voxI) P.voxI = voxInstancedShaders();
  if (!P.mdlI && PROP_MODEL_SHADERS.mdl) P.mdlI = lowPolyInstancedShaders();
  return P;
}
/* VFX-3: inst false for the stretched models (it.smear), drawn one at a time with the plain program, compiled on the
   first stretch */
function drawLowPolyModels(C, X, L, inst = true, solid = false) {
  if (!L.length || typeof BUILDING_SHADERS === 'undefined' || typeof buildingArt !== 'function') return;
  const gl = gpuState.gl;
  ensurePrograms(propModelShaders());
  if (!inst) ensurePrograms({ mdl: PROP_MODEL_SHADERS.mdl });
  const A = buildingArt(),
    det = imageTexture(artImage(A.detail), { noNormal: true });
  if (!det) return;
  const p = useWalkProgram(inst ? (solid ? 'mdlIS' : 'mdlI') : 'mdl', C, X);
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  gl.disable(gl.CULL_FACE);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, det.t);
  gl.uniform1i(p.U.uDet, 0);
  gl.uniform2fv(p.U.uAtl, buildingTextureGrid(A));
  if (p.U.uScroll) gl.uniform2f(p.U.uScroll, 0, 0);
  /* Building bumpiness: the models wear the buildings' sheet, and bump from its normal sheet as the buildings do */
  bindBuildingNormals(p, A);
  if (!inst) drawLowPolyItems(p, L);
  else if (solid) drawModelInstances(p, 'mdl', L);
  else {
    /* VFX-3: as the voxel props: a stretched one one at a time, with the plain program and the same textures */
    /* ST-7: a model with its own texture is drawn on its own (the batches share the building sheet) */
    const own = L.filter(e => e[1].own),
      [one, many] = splitSmeared(own.length ? L.filter(e => !e[1].own) : L);
    if (own.length) one.push(...own);
    if (many.length) drawModelInstances(p, 'mdl', many);
    if (one.length) drawLowPolyModels(C, X, one, false);
  }
}
/* FL-5a: an item the discard-free programs draw as the programs with cuts would: whole (no fade's dither), not stretched
   (drawn one at a time), not a model with its own texture (cut where it is clear), its program made */
function modelSolidItem(it, m, SD) {
  if ((it.fade ?? 1) < 0.99 || it.smear) return false;
  return m.model ? !m.own && !!SD.mdlIS : !!SD.voxIS;
}
/* FL-5a: a list of [item, mesh] nearest the eye first (a tile GPU's early depth then rejects what is behind), so the
   instanced batches (engine/model-instances.js buildModelBatches, in order of first use) come nearest first too */
function modelsNearestFirst(L, C) {
  const e = C && C.eye;
  if (!e || L.length < 2) return L;
  /* the pairs are made for this frame (drawPropModels): the distance rides along as a third entry */
  for (const x of L) {
    const it = x[0];
    x[2] = (it.x - e[0]) ** 2 + (it.y - e[1]) ** 2 + (it.z - e[2]) ** 2;
  }
  return L.sort((a, b) => a[2] - b[2]);
}
/* [the stretched (it.smear), the rest] of a list of [item, mesh] */
function splitSmeared(L) {
  const one = [],
    many = [];
  for (const e of L) (e[0].smear ? one : many).push(e);
  return [one, many];
}
/* the models one at a time: each item's own uniforms, then its mesh, its extra parts and its turning parts */
function drawLowPolyItems(p, L) {
  const gl = gpuState.gl;
  for (const [it, m] of L) {
    gl.uniform1f(p.U.uFade, it.fade ?? 1);
    gl.uniform1f(p.U.uBaseY, it.y);
    setItemSmear(p, it);
    if (p.U.uCel) gl.uniform1f(p.U.uCel, it.vox && it.vox.cel != null ? it.vox.cel : 0.75);
    if (typeof setPropLookUniforms === 'function') setPropLookUniforms(p.U, it.lk, [it.x, it.y, it.z]);
    setPropModelUniforms(p, it);
    setItemSpin(p, it);
    if (p.U.uWinK) {
      const W = it.wins || it.glows ? it.winL || (it.winL = modelWindowLight(it, walkRenderer.dark || 0)) : null;
      gl.uniform1f(p.U.uWinK, W ? W.k : 0);
      gl.uniform1i(p.U.uWinOn, W ? W.on : 0);
      gl.uniform1f(p.U.uWinSeed, W ? W.seed : 0);
    }
    if (m.own && !bindOwnTexture(p, m)) continue;
    drawPropModelMesh(m);
    for (const q of m.more || []) drawPropModelMesh(q);
    drawSpinningParts(p, m);
    propModelState.drawn++;
    propModelState.lowPoly++;
  }
  gl.bindVertexArray(null);
}
/* studio track ST-7: a v2 model's own texture on unit 5 (uOwn): its picture as the game loads it (the Studio's: the
   canvas being painted). False while it loads: the model waits a frame, its picture stands in */
const OWN_UNIT = 5;
function bindOwnTexture(p, m) {
  if (!p.U.uOwn) return false;
  const im =
      (typeof artImage === 'function' && artImage(m.own)) || (typeof artImg === 'function' ? artImg(m.own) : null),
    t =
      im &&
      imageTexture(im, {
        noNormal: true,
        repeat: true,
      }); /* nearest texels, no mip levels: a pixel-art texture stays itself, and a palette's swatches or a baked texture's empty margins never blend in */
  if (!t) return false;
  const gl = gpuState.gl;
  gl.activeTexture(gl.TEXTURE0 + OWN_UNIT);
  gl.bindTexture(gl.TEXTURE_2D, t.t);
  gl.uniform1i(p.U.uOwn, OWN_UNIT);
  gl.activeTexture(gl.TEXTURE0);
  return true;
}
/* alpha 0.4: a part that turns (a propeller): its own mesh, turned uSpin.w radians about the axis uSpin.xyz (a unit
   vector, up as y) through its pivot uSpinC (the model's metres, up as y) */
const SPIN_GLSL = `vec3 voxSpin(vec3 d){float a=uSpin.w;if(a==0.)return d;vec3 k=uSpin.xyz;float c=cos(a),s=sin(a);return d*c+cross(k,d)*s+k*dot(k,d)*(1.-c);}`;
/* VFX-3: a thrown pyramid's stretch on its fastest frames (logic/smear.js smearStretch, it.smear): a vertex on the
   side facing away from the motion (from the spin's pivot, placed, scaled and turned as p is) is dragged back by up to
   uSmear.xyz (the scene's metres), the more the further round it is, broken up by noise on its own model place m
   (uSmear.w: the cell's seed); 0 for every other model. After voxSpin and the turn (cr, sr), before the base */
const SMEAR_GLSL = `uniform vec4 uSmear;vec3 smearDrag(vec3 p,float cr,float sr,vec3 m){if(dot(uSmear.xyz,uSmear.xyz)<1e-8)return p;vec3 c=vec3(uSpinC.x*uFlip,uSpinC.y,uSpinC.z)*uS;vec3 r=p-vec3(c.x*cr-c.z*sr,c.y,c.x*sr+c.z*cr);float l=length(r);if(l<1e-4)return p;float f=clamp(dot(r/l,normalize(uSmear.xyz)),0.,1.),h=fract(sin(dot(m,vec3(12.9898,78.233,37.719))+uSmear.w*61.7)*43758.5453);return p+uSmear.xyz*f*(.7+.3*h);}
uniform float uSquash;vec3 squashY(vec3 p){return uSquash==0.?p:vec3(p.x*(1.+uSquash*.5),p.y*(1.-uSquash),p.z*(1.+uSquash*.5));}`;
const PROP_MODEL_SHADERS = {
  vox: [
    `#version 300 es
precision highp float;layout(location=0) in vec3 qPos;layout(location=1) in vec3 qNrm;layout(location=2) in vec3 qCol;uniform mat4 uVP;uniform vec3 uBase,uSpinC;uniform vec4 uSpin;uniform float uS,uRot,uFlip,uQ;${COMMON_GLSL}out vec3 vW;out vec3 vN;out vec3 vC;${SPIN_GLSL}${SMEAR_GLSL}
void main(){float cr=cos(uRot),sr=sin(uRot);vec3 q0=voxSpin(qPos*uQ-uSpinC)+uSpinC,n0=voxSpin(qNrm);vec3 p=vec3(q0.x*uFlip,q0.y,q0.z)*uS;p=vec3(p.x*cr-p.z*sr,p.y,p.x*sr+p.z*cr);p=squashY(smearDrag(p,cr,sr,qPos));vec3 n=vec3(n0.x*uFlip,n0.y,n0.z);n=vec3(n.x*cr-n.z*sr,n.y,n.x*sr+n.z*cr);
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
        /* phase 09: a roof style (the walk view's propWithVariant) on the model's roof parts; HB-5: roof 2 is dressing
           that fits only the model's own roof (a cottage's moss tufts and roof flowers), gone under another style */
        if (n.roof === 2 && rf) n.hide = 1;
        else if (n.roof && rf) {
          n.col = rf.col;
          n.tex = rf.tex;
        }
        return n;
      }),
    };
  SWAPPED_RECIPES.set(path, { src: rec, rec: out });
  return out;
}
/* a placed prop's model recipe and the path its mesh is kept by: [rec (null while it loads), path] */
function propModelRecipe(p, M) {
  const spec = M.model;
  let rec, path;
  if (typeof spec === 'object') {
    rec = spec;
    path = 'inline:' + p.k + '#' + (M.voxV || 0);
  } else {
    rec = loadPropModelRecipe(spec);
    path = spec;
  }
  /* phase 09 batch 1: a variant that swaps colours or pictures (an autumn oak: the same trunk, other leaves) */
  if (rec && M.swap) {
    path += '#' + (M._vk ?? JSON.stringify(M.swap));
    rec = swappedRecipe(path, rec, M.swap);
  }
  return [rec, path];
}
/** FL-4b (quality.placeWarm): a prop of the next place has its low-poly mesh asked for ahead on the helper thread
 * (quality.meshWorker; prop-meshes.js keeps it until the prop is drawn). False: nothing to do, or its recipe still
 * loading (asked for now; try again later: null) */
export function propModelWarm(p, M) {
  if (!propModelsOn() || !M || !M.model || (p && p.model === 'card') || !engineSetting('quality', 'meshWorker'))
    return false;
  const [rec, path] = propModelRecipe(p, M);
  if (!rec) return null;
  if (rec.kind === 'mesh' || !lowPolyOn(rec) || propModelState.meshes.has(path)) return false;
  return propMeshAhead(path, rec);
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
  const [rec, path] = propModelRecipe(it.p, it.M);
  const R = voxelResolution() + (engineSetting('world', 'voxelLowPoly') ? 1000 : 0);
  if (propModelState.res !== R) {
    if (propModelState.res) flushPropModelMeshes();
    propModelState.res = R;
  }
  /* a few new meshes a frame: the first always, the rest while the frame's one-off budget lasts (LD-5: it was 12 ms
     of their own); the rest draw as their pictures a frame or two longer */
  if (rec && !propModelState.meshes.has(path)) {
    const fr = typeof walkRenderer !== 'undefined' ? walkRenderer.frames : 0;
    if (propModelState.fr !== fr) {
      propModelState.fr = fr;
      propModelState.bt = 0;
    }
    if (propModelState.bt > 0 && typeof frameBudgetLeft === 'function' && !frameBudgetLeft()) return;
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
  /* BD-1: a model with glowing layers takes the windows' light by the hour too (glassLit), glass or none */
  if (m.glow) it.glows = 1;
}
/* picture layers of a voxel prop as sprite items of their own (set in the model, metres from its base). Phase 09
   batch 1, for trees with a modelled trunk and drawn leaf clumps: a layer may say shadow (1: it casts its cut-out
   shadow), recv (0: it takes no shadows from the shadow map, for a crown that would shade its own clumps in stripes),
   sway (how much the wind moves it, times the prop's sway; the model itself stays still), glow (it lights up
   when the lamps come on, a lantern's glass), yaw (with face fixed: which way it faces, radians, pi/2 the right side,
   pi the back; batch 8, a tower's windows on every face), and the recipe its art's scale (ppm: pixels to the metre; else the scenery's) */
/* FL-2b: a placement's leaf items (prop-models.js propModelImageItems), reused each frame so a frame leaves ~650 fewer
   objects for the garbage collector. Each is filled from v with every key, and what other passes write on an item
   (quality-cull.js vis and fade, frame-items.js cut, prop-look.js slope and tilt, lighting.js winL, the sprite sort's
   texKey, modelsNearestFirst's d) is cleared, so it starts each frame as a new one would. Keyed by placement (a WeakMap),
   so a place left lets them go */
const LEAF_ITEMS = new WeakMap(),
  LEAF_ITEM_CLEAR = ['vis', 'fade', 'cut', 'slope', 'tilt', 'winL', 'texKey', 'd'];
function leafItem(list, i) {
  let o = list[i];
  if (!o)
    return (list[i] = {
      k: undefined,
      p: undefined,
      M: undefined,
      im: undefined,
      x: undefined,
      z: undefined,
      y: undefined,
      mpp: undefined,
      ox: undefined,
      oy: undefined,
      w: undefined,
      h: undefined,
      flip: undefined,
      shear: undefined,
      rest: undefined,
      sh: undefined,
      glow: undefined,
      noRecv: undefined,
      eyeward: undefined,
      fixed: undefined,
      plane: undefined,
      yaw: undefined,
      mat: undefined,
      layer: undefined,
      still: undefined,
      voxImg: undefined,
    });
  for (const k of LEAF_ITEM_CLEAR) if (k in o) o[k] = undefined;
  return o;
}
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
    /* AS-1: a tipped model's layers tip with it (a climbing train's headlamp and name boards) */
    spin: it.spin || null,
  };
  const F = typeof gameData !== 'undefined' && gameData.pixelFacts;
  /* FL-2b: this placement's leaf items, kept from frame to frame (one per picture layer) and filled in again */
  let pool = LEAF_ITEMS.get(it.p);
  if (!pool || pool.rec !== rec) LEAF_ITEMS.set(it.p, (pool = { rec, list: [] }));
  let li = -1;
  for (const L of rec.layers || []) {
    li++;
    if (L.k !== 'img' || L.hide) continue;
    const im0 = typeof artImage === 'function' ? artImage(L.img) : null;
    /* LD-1: a leaf clump's baked cut (tools/bake-pixel-facts.mjs), so its crown picture is never read (or even
       loaded) in the page; the Studio painting the crown (_ver) or moving the clump (a key with no bake) cuts it here */
    const baked = F && (L.clip || L.shade) && !(im0 && im0._ver) ? F.cuts[leafCutKey(L.img, L)] : null;
    if (baked) {
      const b = artImage(baked);
      if (!b || !(b.naturalWidth || b.width)) {
        artImg(baked);
        continue;
      }
    }
    if (!baked && (!im0 || !(im0.naturalWidth || im0.width))) {
      if (typeof artImg === 'function' && L.img) artImg(L.img);
      continue;
    }
    const im = baked ? artImage(baked) : L.clip || L.shade ? leafCut(im0, L) : im0;
    if (!im) continue;
    const d = decalPlace(it, L, m),
      s = d.s,
      w = im.naturalWidth || im.width,
      h = im.naturalHeight || im.height,
      mpp =
        (L.s || 1) / (rec.ppm || (typeof gameData !== 'undefined' && gameData.scenery && gameData.scenery.ppu) || 34);
    const o = leafItem(pool.list, li);
    o.k = 'prop';
    o.p = it.p;
    o.M = layerProp(it.M);
    o.im = im;
    o.x = d.x;
    o.z = d.z;
    o.y = d.y;
    o.mpp = mpp * s;
    o.ox = -(w / 2);
    o.oy = -(h - 1);
    o.w = w;
    o.h = h;
    o.flip = d.flip;
    o.shear = (it.shear || 0) * (L.sway ?? 1);
    /* phase 20 R3: at rest (no wind) when the model itself stands still (walk/shadows.js, "Far shadows hold still") */
    o.rest = it.rest !== undefined && !(it.M && it.M.bob) ? it.rest * (L.sway ?? 1) : undefined;
    o.sh = L.shadow ? (it.M && it.M.shadow ? it.M.shadow : 1) * s : 0;
    /* a layer's day: how much it glows by day too (1: lit at every hour, the sky portal's layers) */
    o.glow = L.glow
      ? L.glow * (typeof lampLit === 'function' ? lampLit(it.x, it.z, 0) * (1 - (L.day || 0)) + (L.day || 0) : 1)
      : 0;
    o.noRecv = L.recv === 0;
    /* phase 09 batch 10: metres toward the eye (along the camera's line of sight), so a conifer's tiers, centred on
       its modelled mast, stay in front of it from every side (walk/sprites.js uDZ) */
    o.eyeward = L.front && L.face !== 'fixed' ? L.front * s : 0;
    o.fixed = L.face === 'fixed';
    o.plane = L.face === 'fixed';
    o.yaw = d.yaw; /* phase 09 batch 9: a decal turns with its model */
    o.mat = it.mat;
    o.layer = L;
    o.still = it.still;
    o.voxImg = 1;
    out.push(o);
  }
}
/* phase 09 batch 1: a tree's leaves are one picture, its crown as drawn (paint it in the Studio like any prop picture).
   Each clump is cut from it at run time: clip [x, y, r] is a circle in that picture's pixels; the cut is a square
   2r across with the circle's bottom at its base (where the clump stands), and the lower rim of the cut gets the
   picture's darkest colour as an outline, as a drawn clump has. shade darkens the whole picture (the crown's core,
   behind the clumps). Cuts are kept per picture and made again when the picture changes (the Studio's _ver). */
const LEAF_CUTS = new WeakMap();
function leafCut(im, L) {
  const ver = im._ver || 0;
  let C = LEAF_CUTS.get(im);
  if (!C || C.ver !== ver) {
    const W = im.naturalWidth || im.width,
      H = im.naturalHeight || im.height,
      src = makeCanvas(W, H),
      x = src.getContext('2d', { willReadFrequently: true });
    x.drawImage(im, 0, 0);
    const data = x.getImageData(0, 0, W, H).data;
    C = { ver, W, H, data, outline: leafOutlineColour(data), cuts: new Map() };
    LEAF_CUTS.set(im, C);
  }
  const key = (L.clip || []).join(',') + '|' + (L.shade || 1);
  let out = C.cuts.get(key);
  if (out) return out;
  /* LD-1: the cut's maths in logic/pixel-facts.js, shared with the bake (tools/bake-pixel-facts.mjs) */
  const P = leafCutPixels(C.W, C.H, C.data, C.outline, L);
  out = makeCanvas(P.w, P.h);
  const X = out.getContext('2d'),
    o = X.createImageData(P.w, P.h);
  o.data.set(P.data);
  X.putImageData(o, 0, 0);
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
/* VFX-3: its stretch, it.smear {d: the drag in the scene's metres; seed: 0..1} (SMEAR_GLSL), else none */
function setItemSmear(p, it) {
  const S = it.smear;
  if (p.U.uSmear) gpuState.gl.uniform4f(p.U.uSmear, S ? S.d[0] : 0, S ? S.d[1] : 0, S ? S.d[2] : 0, S ? S.seed : 0);
  /* VFX-16: a landed pyramid's squash on a catch's wobble (it.squash: flatter and wider about its base), else none */
  if (p.U.uSquash) gpuState.gl.uniform1f(p.U.uSquash, it.squash || 0);
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
/* the voxel props one at a time (L is [item, mesh]): each item's own uniforms, then its mesh and its turning parts */
function drawVoxItems(p, L) {
  const gl = gpuState.gl;
  for (const [it, m] of L) {
    gl.uniform3f(p.U.uBaseP, it.x, it.y, it.z);
    gl.uniform1f(p.U.uFade, it.fade ?? 1);
    gl.uniform1f(p.U.uEmit, it.glow ? it.glow : 0);
    setItemSmear(p, it);
    setPropModelUniforms(p, it);
    gl.uniform1f(p.U.uQ, m.q || 1);
    setItemSpin(p, it);
    drawPropModelMesh(m);
    drawSpinningParts(p, m);
    propModelState.drawn++;
  }
}
/* FL-5a (quality.drawOrder): part 'solid' draws only the items the discard-free programs can draw (modelSolidItem),
   nearest first; part 'cut' draws the rest, as before. No part: every item, as before */
export function drawPropModels(C, items, X, hits, labels, PPU, part) {
  if (part !== 'cut') {
    propModelState.drawn = 0;
    propModelState.lowPoly = 0;
  }
  if (!propModelsOn()) return;
  /* R1 measure: every draw a model makes counted apart, in whichever pass draws it (engine/gpu-counters.js) */
  gpuTag('model');
  propModelGuard(() => {
    const gl = gpuState.gl;
    ensurePrograms(propModelShaders());
    const SD = part ? propModelSolidShaders() : null;
    if (SD) ensurePrograms(SD);
    const solidOn = !!SD && !rockCircleOn(C);
    let VL = [],
      ML = [];
    for (const it of items) {
      if (!it.vox || it.vis === false) continue;
      const m = propModelMesh(it.voxPath, it.vox);
      if (!m) continue;
      if (part && (solidOn && modelSolidItem(it, m, SD)) !== (part === 'solid')) continue;
      (m.model ? ML : VL).push([it, m]);
    }
    if (part === 'solid') {
      VL = modelsNearestFirst(VL, C);
      ML = modelsNearestFirst(ML, C);
      if (VL.length) {
        const p = useWalkProgram('voxIS', C, X);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.disable(gl.CULL_FACE);
        drawModelInstances(p, 'vox', VL);
      }
      gl.bindVertexArray(null);
      drawLowPolyModels(C, X, ML, true, true);
      walkRenderer.solidModels = VL.length + ML.length;
      return;
    }
    if (VL.length) {
      const p = useWalkProgram('voxI', C, X);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      /* VFX-3: a stretched item has no place in the instance record: drawn one at a time, with the plain program
         (compiled on the first stretch) */
      const [one, many] = splitSmeared(VL);
      if (many.length) drawModelInstances(p, 'vox', many);
      if (one.length) {
        ensurePrograms({ vox: PROP_MODEL_SHADERS.vox });
        drawVoxItems(useWalkProgram('vox', C, X), one);
      }
    }
    gl.bindVertexArray(null);
    if (hits) for (const [it] of VL) if (!it.far) addHitTarget(it, C, hits, labels, PPU);
    drawLowPolyModels(C, X, ML);
    if (hits) for (const [it] of ML) if (!it.far) addHitTarget(it, C, hits, labels, PPU);
  });
  gpuTag(0);
}
/* ---------- phase 20 R2: the models instanced (the only path since R4) ----------
   One draw per mesh part for every item with that mesh (engine/model-instances.js): each item's values, the ones the
   plain vox and mdl programs took as uniforms, are one record in a buffer uploaded once a pass; extra parts draw over
   the same records, turning parts too (their turn, the same for every item, replacing the item's own: uPart). The
   one-at-a-time loops live on in tools/test/model-loops-ref.mjs as the tests' reference. */
/* a voxel prop's or a low-poly model's values (kind 'vox' or 'mdl') into v (engine/model-instances.js
   modelInstanceValues), exactly as the old one-at-a-time loops set them (tools/test/model-loops-ref.mjs). RF-2: a whole
   model turned about any axis (a thrown pyramid tumbling, rocking on a base edge): it.spin {a: a unit axis, up as y;
   an: radians; c: the pivot in the model's metres, up as y}; else not turned */
const NEUTRAL_MODEL_LOOK = { wear: [0, 0, 0, 0], hsv: [0, 0, 0, 0], tint: [1, 1, 1, 0], mask: [0, 0] };
function propModelInstanceValues(it, kind, v) {
  const bo = mooredBob(it),
    S = it.spin;
  v.pos[0] = it.x;
  v.pos[1] = it.y + (bo ? bo[0] : 0);
  v.pos[2] = it.z;
  v.s = (it.p.s || 1) * (it.lk ? it.lk.size : 1);
  v.rot = propTurn(it) + (bo ? bo[1] : 0);
  v.flip = it.flip || 1;
  v.fade = it.fade ?? 1;
  v.base[0] = it.x;
  v.base[1] = it.y;
  v.base[2] = it.z;
  for (let j = 0; j < 3; j++) {
    v.spin[j] = S ? S.a[j] : j ? 0 : 1;
    v.spinC[j] = S ? S.c[j] : 0;
  }
  v.spin[3] = S ? S.an : 0;
  const W =
      kind === 'mdl' && (it.wins || it.glows)
        ? it.winL || (it.winL = modelWindowLight(it, walkRenderer.dark || 0))
        : null,
    L = (kind === 'mdl' && it.lk) || NEUTRAL_MODEL_LOOK;
  v.k = kind === 'vox' ? (it.glow ? it.glow : 0) : it.vox && it.vox.cel != null ? it.vox.cel : 0.75;
  v.winK = W ? W.k : 0;
  v.winOn = W ? W.on : 0;
  v.seed = W ? W.seed : 0;
  for (let j = 0; j < 4; j++) {
    v.wear[j] = L.wear[j];
    v.hsv[j] = L.hsv[j];
    v.tint[j] = L.tint[j];
  }
  v.mask[0] = L.mask[0];
  v.mask[1] = L.mask[1];
}
const MODEL_INSTANCES = modelInstanceStore(),
  MODEL_VALUES = modelInstanceValues();
/* L: [item, mesh] of one kind, drawn with p (voxI or mdlI, its frame's uniforms and textures set) */
function drawModelInstances(p, kind, L) {
  const gl = gpuState.gl,
    S = MODEL_INSTANCES,
    I = MODEL_INSTANCE_ATTRIBS[kind],
    A = kind === 'vox' ? VOX_ATTRIBS : MDL_ATTRIBS,
    B = buildModelBatches(L),
    t = (reducedMotion ? 0 : walkView.t || 0) / 1000;
  reserveModelInstances(S, L.length);
  let i = 0;
  for (const b of B)
    for (const [it] of b.list) {
      propModelInstanceValues(it, kind, MODEL_VALUES);
      writeModelInstance(S, i++, MODEL_VALUES);
    }
  if (!S.buf || S.gl !== gl || S.gen !== gpuState.gen) {
    S.buf = gpuBuffer('instances');
    S.gl = gl;
    S.gen = gpuState.gen;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, S.buf);
  gl.bufferData(gl.ARRAY_BUFFER, S.B.subarray(0, i * MODEL_INSTANCE_BYTES), gl.STREAM_DRAW);
  gl.uniform1f(p.U.uPart, 0);
  for (const b of B) {
    const m = b.mesh,
      n = b.list.length;
    if (kind === 'vox') gl.uniform1f(p.U.uQ, m.q || 1);
    drawModelPart(m, A, I, S.buf, b.at, n);
    for (const q of m.more || []) drawModelPart(q, A, I, S.buf, b.at, n);
    if (m.spins && m.spins.length) {
      gl.uniform1f(p.U.uPart, 1);
      for (const s of m.spins) {
        gl.uniform4f(p.U.uSpin, s.a[0], s.a[1], s.a[2], spinPartAngle(s, t));
        gl.uniform3fv(p.U.uSpinC, s.c);
        drawModelPart(s, A, I, S.buf, b.at, n);
      }
      gl.uniform1f(p.U.uPart, 0);
    }
    propModelState.drawn += n;
    if (kind === 'mdl') propModelState.lowPoly += n;
  }
  gl.bindVertexArray(null);
}
/* one mesh part for n items from record `at` */
function drawModelPart(q, A, I, buf, at, n) {
  const gl = gpuState.gl;
  gl.bindVertexArray(modelInstanceVao(gl, q, A, I));
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  pointModelInstances(gl, I, at);
  if (q.el) gl.drawElementsInstanced(gl.TRIANGLES, q.n, q.u32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0, n);
  else gl.drawArraysInstanced(gl.TRIANGLES, 0, q.n, n);
}
/* the instanced programs: the same vertex work as vox and mdl with the placement from the instance's record (a
   turning part's turn from uSpin while uPart is 1), and the same fragment shaders with the per-item uniforms read as
   flat values the vertex shader passes on under the same names */
const SPIN_BY_GLSL = `vec3 spinBy(vec3 d,vec4 S){float a=S.w;if(a==0.)return d;vec3 k=S.xyz;float c=cos(a),s=sin(a);return d*c+cross(k,d)*s+k*dot(k,d)*(1.-c);}`;
const INSTANCE_IN_GLSL = `layout(location=5) in vec4 iPos;layout(location=6) in vec4 iTf;layout(location=7) in vec4 iBase;layout(location=8) in vec4 iSpin;layout(location=9) in vec3 iSpinC;uniform vec3 uSpinC;uniform vec4 uSpin;uniform float uPart;`;
/* placed, scaled, turned and spun as the plain programs do: P the mesh position in metres, N its normal */
const INSTANCE_PLACE_GLSL = `vec4 S=uPart>.5?uSpin:iSpin;vec3 SC=uPart>.5?uSpinC:iSpinC;float cr=cos(iTf.x),sr=sin(iTf.x),fl=iTf.y;vec3 q0=spinBy(P-SC,S)+SC,n0=spinBy(N,S);vec3 p=vec3(q0.x*fl,q0.y,q0.z)*iPos.w;p=vec3(p.x*cr-p.z*sr,p.y,p.x*sr+p.z*cr);vec3 n=vec3(n0.x*fl,n0.y,n0.z);n=vec3(n.x*cr-n.z*sr,n.y,n.x*sr+n.z*cr);
 vec3 w=iPos.xyz+p;w.y+=curveY(iPos.xz);`;
/* a fragment shader's uniform declarations as flat inputs (each must be there exactly once) */
function asFlatInputs(f, decls) {
  for (const [a, b] of decls) {
    if (f.split(a).length !== 2) throw new Error('instanced models: no single "' + a + '"');
    f = f.replace(a, b);
  }
  return f;
}
const VOX_FLAT = [['uniform vec3 uBaseP;uniform float uFade,uEmit;', 'flat in vec3 uBaseP;flat in float uFade,uEmit;']],
  MDL_FLAT = [
    ['uniform float uFade,uBaseY;', 'flat in float uFade,uBaseY;'],
    ['uniform vec4 uWear,uHsv,uLkTint;uniform vec2 uMaskH;', 'flat in vec4 uWear,uHsv,uLkTint;flat in vec2 uMaskH;'],
    ['uniform vec3 uBP;uniform float uCel;', 'flat in vec3 uBP;flat in float uCel;'],
    ['uniform int uWinOn;uniform float uWinK,uWinSeed;', 'flat in int uWinOn;flat in float uWinK,uWinSeed;'],
  ];
function voxInstancedShaders() {
  return [
    `#version 300 es
precision highp float;layout(location=0) in vec3 qPos;layout(location=1) in vec3 qNrm;layout(location=2) in vec3 qCol;${INSTANCE_IN_GLSL}uniform mat4 uVP;uniform float uQ;${COMMON_GLSL}out vec3 vW;out vec3 vN;out vec3 vC;flat out vec3 uBaseP;flat out float uFade,uEmit;${SPIN_BY_GLSL}
void main(){vec3 P=qPos*uQ,N=qNrm;${INSTANCE_PLACE_GLSL}vW=w;vN=n;vC=qCol;gl_Position=uVP*vec4(w,1.);uBaseP=iBase.xyz;uFade=iTf.z;uEmit=iTf.w;}`,
    asFlatInputs(PROP_MODEL_SHADERS.vox[1], VOX_FLAT),
  ];
}
/* FL-5a (quality.drawOrder): the instanced pair without their cuts (engine/shader-precision.js solidFragment), for an
   item that is whole (no fade), not stretched, without its own texture, on a frame with no rock circle; drawn first,
   nearest first. {} when an edit no longer fits (everything keeps the programs with cuts) */
const VOX_SOLID_EDITS = [['if(uFade<.99&&bay(gl_FragCoord.xy)>uFade)discard;if(rockHides(vW))discard;', '']],
  MDL_SOLID_EDITS = [
    ['if(uFade<.99&&bayer4(gl_FragCoord.xy)>uFade)discard;if(rockHides(vW))discard;', ''],
    ['if(tx.a<.5)discard;', ''],
  ];
let modelSolidDefs = null;
function propModelSolidShaders() {
  if (modelSolidDefs) return modelSolidDefs;
  const P = propModelShaders(),
    D = {};
  if (P.voxI) {
    const f = solidFragment(P.voxI[1], VOX_SOLID_EDITS);
    if (f) D.voxIS = [P.voxI[0], f];
  }
  if (P.mdlI) {
    const f = solidFragment(P.mdlI[1], MDL_SOLID_EDITS);
    if (f) D.mdlIS = [P.mdlI[0], f];
  }
  /* the low-poly pair needs the buildings' shaders; kept once both are made */
  if (P.mdlI) modelSolidDefs = D;
  return D;
}
function lowPolyInstancedShaders() {
  return [
    `#version 300 es
precision highp float;layout(location=0) in vec3 mPos;layout(location=1) in vec3 mNrm;layout(location=2) in vec2 mUV;layout(location=3) in vec4 mTex;layout(location=4) in vec4 mCol;${INSTANCE_IN_GLSL}
layout(location=10) in vec4 iWear;layout(location=11) in vec4 iHsv;layout(location=12) in vec4 iTint;layout(location=13) in vec4 iMask;layout(location=14) in uint iWin;
uniform mat4 uVP;out vec3 vGl;${GLOW_RGB_GLSL}out vec3 vW;out vec3 vN;out vec2 vUV;out vec3 vTex;out vec3 vCol;flat out float uFade,uBaseY,uCel,uWinK,uWinSeed;flat out vec4 uWear,uHsv,uLkTint;flat out vec2 uMaskH;flat out vec3 uBP;flat out int uWinOn;${COMMON_GLSL}${SPIN_BY_GLSL}
void main(){vec3 P=mPos/256.,N=mNrm;${INSTANCE_PLACE_GLSL}vW=w;vN=n;vUV=mUV/64.;vTex=mTex.xyz;vCol=mCol.rgb;vGl=glowRgb(mTex.w,mCol.a);gl_Position=uVP*vec4(w,1.);
 uFade=iTf.z;uCel=iTf.w;uBP=iBase.xyz;uBaseY=iBase.y;uWinSeed=iBase.w;uWear=iWear;uHsv=iHsv;uLkTint=iTint;uMaskH=iMask.xy;uWinK=iMask.z;uWinOn=int(iWin);}`,
    asFlatInputs(PROP_MODEL_SHADERS.mdl[1], MDL_FLAT),
  ];
}
/* part (FL-2b, the far map's cache): 0 every part, 1 no turning parts (the cached copy), 2 the turning parts alone */
function drawPropModelShadows(SH, items, part = 0) {
  if (!propModelsOn()) return;
  gpuTag('model');
  propModelGuard(() => {
    if (modelShadowInstancesReady()) drawPropModelShadowsInstanced(SH, items, part);
  });
  gpuTag(0);
}
/* ---------- phase 20 R3: the shadow maps' models instanced (the only path since R4) ----------
   One draw per mesh part for every item with that mesh, as the main pass's "Models in batches" does: each item's
   record (the same values: its place with the bob, scale, turn, flip, its own spin) in a buffer of the shadows' own,
   drawn by voxSI (voxI's placing, depth only). Voxel props and low-poly models alike, each with its own mesh layout,
   as the old voxS loop drew them (tools/test/shadow-loops-ref.mjs); extra parts and turning parts over the same
   records. If voxSI does not build the maps draw no model shadows (the debug log says so). */
const MODEL_SHADOW_SHADERS = {
  voxSI: [
    `#version 300 es
precision highp float;layout(location=0) in vec3 qPos;${INSTANCE_IN_GLSL}uniform mat4 uVP;uniform float uQ;${COMMON_GLSL}${SPIN_BY_GLSL}
void main(){vec3 P=qPos*uQ,N=vec3(0.,1.,0.);${INSTANCE_PLACE_GLSL}gl_Position=uVP*vec4(w,1.);}`,
    PROP_MODEL_SHADERS.voxS[1],
  ],
};
provide({ MODEL_SHADOW_SHADERS }); /* to-module */
const modelShadowState = { bad: null, list: [] },
  MODEL_SHADOW_INSTANCES = modelInstanceStore();
function modelShadowInstancesReady() {
  const gl = gpuState.gl;
  if (modelShadowState.bad === gl) return false;
  if (!gpuState.P.voxSI)
    try {
      ensurePrograms(MODEL_SHADOW_SHADERS);
    } catch (e) {
      modelShadowState.bad = gl;
      console.error(e);
      if (typeof debugLog !== 'undefined') debugLog.add('webgl', 'model shadows off: ' + e.message);
      return false;
    }
  return true;
}
function drawPropModelShadowsInstanced(SH, items, part = 0) {
  const gl = gpuState.gl,
    L = modelShadowState.list,
    S = MODEL_SHADOW_INSTANCES,
    I = MODEL_INSTANCE_ATTRIBS.vox,
    t = (reducedMotion ? 0 : walkView.t || 0) / 1000;
  L.length = 0;
  for (const it of items) {
    if (!it.vox || it.ghost) continue;
    const m = propModelMesh(it.voxPath, it.vox);
    if (m) L.push([it, m]);
  }
  if (!L.length) return;
  const B = buildModelBatches(L);
  reserveModelInstances(S, L.length);
  let i = 0;
  for (const b of B)
    for (const [it] of b.list) {
      propModelInstanceValues(it, 'vox', MODEL_VALUES);
      writeModelInstance(S, i++, MODEL_VALUES);
    }
  if (!S.buf || S.gl !== gl || S.gen !== gpuState.gen) {
    S.buf = gpuBuffer('instances');
    S.gl = gl;
    S.gen = gpuState.gen;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, S.buf);
  gl.bufferData(gl.ARRAY_BUFFER, S.B.subarray(0, i * MODEL_INSTANCE_BYTES), gl.STREAM_DRAW);
  const p = gpuState.P.voxSI,
    ca = typeof worldCurveArgs === 'function' ? worldCurveArgs() : [0, 0, 0, 1e9];
  gl.useProgram(p.p);
  gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
  gl.uniform3f(p.U.uCurve, ca[0], ca[1], ca[2]);
  gl.uniform1f(p.U.uCurveD0, ca[3]);
  gl.uniform1f(p.U.uPart, 0);
  for (const b of B) {
    const m = b.mesh,
      A = m.model ? MDL_ATTRIBS : VOX_ATTRIBS,
      n = b.list.length;
    gl.uniform1f(p.U.uQ, m.q || 1);
    if (part !== 2) {
      drawModelShadowPart(m, A, I, S.buf, b.at, n);
      for (const q of m.more || []) drawModelShadowPart(q, A, I, S.buf, b.at, n);
    }
    if (part !== 1 && m.spins && m.spins.length) {
      gl.uniform1f(p.U.uPart, 1);
      for (const s of m.spins) {
        gl.uniform4f(p.U.uSpin, s.a[0], s.a[1], s.a[2], spinPartAngle(s, t));
        gl.uniform3fv(p.U.uSpinC, s.c);
        drawModelShadowPart(s, A, I, S.buf, b.at, n);
      }
      gl.uniform1f(p.U.uPart, 0);
    }
  }
  gl.bindVertexArray(null);
}
/* one mesh part for n items from record `at`, in the part's shadow vertex array (its own: five instance attributes) */
function drawModelShadowPart(q, A, I, buf, at, n) {
  const gl = gpuState.gl;
  gl.bindVertexArray(modelInstanceVao(gl, q, A, I, 'sivao'));
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  pointModelInstances(gl, I, at);
  if (q.el) gl.drawElementsInstanced(gl.TRIANGLES, q.n, q.u32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0, n);
  else gl.drawArraysInstanced(gl.TRIANGLES, 0, q.n, n);
}
/* art the scene needs for its voxel props' picture layers (mapArtPaths asks) */
function propModelArtPaths(sc, C) {
  const L = [],
    F = typeof gameData !== 'undefined' && gameData.pixelFacts,
    /* LD-1: a leaf clump comes as its baked cut (propModelImageItems), not its crown */
    art = l => (F && (l.clip || l.shade) && F.cuts[leafCutKey(l.img, l)]) || l.img;
  let any = false;
  for (const p of sc.props || (sc._lite && sc._lite.props) || []) {
    const M = C.props[p.k];
    if (!M || !M.model) continue;
    any = true;
    const rec = propModelState.recipes.get(M.model);
    if (rec) for (const l of rec.layers || []) if (l.k === 'img' && l.img) L.push(art(l));
    /* phase 09 batch 1: a variant's own model and swapped pictures (the autumn oak's leaves) load with the place too */
    const V = p.v && M.variants ? M.variants[p.v - 1] : null;
    if (V && V.swap) for (const v of Object.values(V.swap)) if (/\.png$/i.test(v)) L.push(v);
    if (V && typeof V.model === 'string') {
      const r2 = propModelState.recipes.get(V.model);
      if (r2) for (const l of r2.layers || []) if (l.k === 'img' && l.img) L.push(art(l));
    }
  }
  /* alpha 0.4: the low-poly props and models are painted from the building sheet */
  if (any) L.push((C.buildArt && C.buildArt.detail) || 'scene/build/detail.png');
  if (any && C.buildArt && C.buildArt.normal) L.push(C.buildArt.normal);
  return L;
}
