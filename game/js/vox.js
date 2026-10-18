'use strict';
/* ================= VOXEL PROPS (v43) =================
   A prop may carry a voxel recipe (art/scene/vox/<key>.json, made by tools/build-vox-props.py or the Studio's Prop
   builder): layers of shapes (box, cylinder, sphere, cone, barrel) in metres with a colour and a texture, a raw layer
   (voxels imported from a .vox), and picture layers (a 2D sprite set in the model). The recipe is turned into voxels
   at the art's own scale (alpha 0.4: 32 to the metre, one voxel to a pixel), greedy-meshed into as few quads as possible and drawn as a cel-shaded, vertex-coloured solid
   in the scene's light: the sun in three tones, the sky-shaped ambient, the shadow maps, the lamps. It sits in the
   shadow maps too, so its shadow has its real shape. When the Voxel props dial is off, the prop's picture draws as
   before. Picture layers are drawn by the sprite pipeline (dglItems gives them as extra items). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { GD, RM, provide } from './hooks.js';
import { artImg, artURL, hexA } from './art.js';
import { DIO, dioImg } from './diorama.js';
import { eng } from './engine/settings.js';
import { EGL, EGL_GLSL_COMMON, EGL_GLSL_LIGHT, eglImg, eglPrograms } from './engine/core.js';
import { DGL, dglCurveArgs, dglHit, dglLookU, dglUse, dglWindAt } from './diorama-gl.js';
import { BLD_SH, bldArt, bldAtlas } from './buildings.js';
/* eslint-disable no-func-assign */
expose({
  VOX: [() => VOX],
  VOX_GLSL_SPIN: [() => VOX_GLSL_SPIN],
  VOX_K: [() => VOX_K],
  VOX_LP_TEX: [() => VOX_LP_TEX],
  VOX_MDL_VS: [() => VOX_MDL_VS],
  VOX_O: [() => VOX_O],
  VOX_SH: [() => VOX_SH],
  VOX_SHAPES: [() => VOX_SHAPES],
  VOX_TEX: [() => VOX_TEX],
  VOX_TEXTURES: [() => VOX_TEXTURES],
  voxBob: [() => voxBob, v => (voxBob = v)],
  voxDraw: [() => voxDraw, v => ((voxDraw = v), provide({ voxDraw }))],
  voxEl: [() => voxEl, v => (voxEl = v)],
  voxFlush: [() => voxFlush, v => ((voxFlush = v), provide({ voxFlush }))],
  voxGuard: [() => voxGuard, v => (voxGuard = v)],
  voxHash: [() => voxHash, v => (voxHash = v)],
  voxImageItems: [() => voxImageItems, v => ((voxImageItems = v), provide({ voxImageItems }))],
  voxInvalidate: [() => voxInvalidate, v => (voxInvalidate = v)],
  voxKey: [() => voxKey, v => (voxKey = v)],
  voxLowPoly: [() => voxLowPoly, v => (voxLowPoly = v)],
  voxLowPolyOn: [() => voxLowPolyOn, v => (voxLowPolyOn = v)],
  voxMdlFS: [() => voxMdlFS, v => (voxMdlFS = v)],
  voxMesh: [() => voxMesh, v => (voxMesh = v)],
  voxMeshFor: [() => voxMeshFor, v => (voxMeshFor = v)],
  voxModelMesh: [() => voxModelMesh, v => (voxModelMesh = v)],
  voxModels: [() => voxModels, v => (voxModels = v)],
  voxOn: [() => voxOn, v => (voxOn = v)],
  voxPaths: [() => voxPaths, v => ((voxPaths = v), provide({ voxPaths }))],
  voxRawDecode: [() => voxRawDecode, v => (voxRawDecode = v)],
  voxRawInto: [() => voxRawInto, v => (voxRawInto = v)],
  voxRecipe: [() => voxRecipe, v => (voxRecipe = v)],
  voxRes: [() => voxRes, v => (voxRes = v)],
  voxShaders: [() => voxShaders, v => ((voxShaders = v), provide({ voxShaders }))],
  voxShadow: [() => voxShadow, v => ((voxShadow = v), provide({ voxShadow }))],
  voxSpins: [() => voxSpins, v => (voxSpins = v)],
  voxTag: [() => voxTag, v => ((voxTag = v), provide({ voxTag }))],
  voxU: [() => voxU, v => (voxU = v)],
  voxUnkey: [() => voxUnkey, v => (voxUnkey = v)],
  voxUpModel: [() => voxUpModel, v => (voxUpModel = v)],
  voxelise: [() => voxelise, v => (voxelise = v)],
});
/* eslint-enable no-func-assign */
provide({ voxDraw, voxFlush, voxImageItems, voxPaths, voxShaders, voxShadow, voxTag });
/* to-module: end */
export const VOX = { recipes: new Map(), meshes: new Map(), fail: '', drawn: 0, VPM: 32, res: 0, fr: -1, bt: 0 };
const VOX_TEX = {
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
};
export const VOX_TEXTURES = [
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
];
const VOX_SHAPES = [
  ['box', 'Box'],
  ['cyl', 'Cylinder'],
  ['sphere', 'Sphere'],
  ['cone', 'Cone'],
  ['barrel', 'Barrel'],
];
function voxOn() {
  return typeof eng === 'function' && (eng('world', 'voxelProps') ?? true) && !VOX.fail;
}
function voxGuard(fn) {
  if (VOX.fail) return;
  try {
    return fn();
  } catch (e) {
    VOX.fail = String((e && e.message) || e);
    console.error('Voxel props off: ' + VOX.fail);
    if (typeof NWLOG !== 'undefined') NWLOG.add('webgl', 'Voxel props off: ' + VOX.fail);
  }
}
/* the recipe of a prop: fetched once (inline in a single-file build), null while it loads */
export function voxRecipe(path) {
  if (VOX.recipes.has(path)) return VOX.recipes.get(path);
  VOX.recipes.set(path, null);
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
      VOX.bad = (VOX.bad || 0) + 1;
      if (typeof NWLOG !== 'undefined') NWLOG.add('webgl', 'voxel recipe unreadable: ' + path);
    }
    const rec = j || { layers: [] };
    VOX.recipes.set(path, rec);
    return rec;
  }
  fetch(url)
    .then(r => (r.ok ? r.json() : null))
    .then(j => {
      if (!j) {
        VOX.bad = (VOX.bad || 0) + 1;
        if (typeof NWLOG !== 'undefined') NWLOG.add('webgl', 'voxel recipe missing: ' + path);
      }
      VOX.recipes.set(path, j || { layers: [] });
      VOX.meshes.delete(path);
    })
    .catch(e => {
      VOX.bad = (VOX.bad || 0) + 1;
      if (typeof NWLOG !== 'undefined')
        NWLOG.add('webgl', 'voxel recipe failed to load: ' + path + ' (' + ((e && e.message) || e) + ')');
      VOX.recipes.set(path, { layers: [] });
    });
  return null;
}
function voxHash(a, b, c) {
  let h = (a * 374761393 + b * 668265263 + c * 1013904223) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/* alpha 0.4: voxels at the art's own scale: one voxel is one pixel of the art, 32 to the metre (Engine > World >
   "Chunky voxels" builds them at eight to the metre, as before, for slow phones). Only the skin of each shape is kept
   (a voxel with its six neighbours inside its own shape can never be seen), and a face toward a cell inside any shape
   is never made, so a fine model costs what its outside costs. Voxels are kept by number (voxKey), colours as 0xRRGGBB. */
function voxRes() {
  return typeof eng === 'function' && eng('world', 'voxelChunky') ? 8 : VOX.VPM;
}
const VOX_K = 4096,
  VOX_O = 2048;
function voxKey(x, y, z) {
  return ((x + VOX_O) * VOX_K + (y + VOX_O)) * VOX_K + (z + VOX_O);
}
function voxUnkey(k) {
  const z = k % VOX_K,
    r = (k - z) / VOX_K,
    y = r % VOX_K;
  return [(r - y) / VOX_K - VOX_O, y - VOX_O, z - VOX_O];
}
/* voxels from a recipe at R to the metre: Map key -> colour (x across, y depth, z up); V.ins: the shapes' insides */
function voxelise(rec, R) {
  R = R || voxRes();
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
      voxRawInto(V, L, R, rec);
      return;
    }
    const c = hexA(L.col || '#888888'),
      g = VOX_TEX[L.tex || 'plain'] || 0,
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
      streak = t === 'wood' || t === 'grain' || t === 'hay',
      blot = t === 'stone' || t === 'rust' || t === 'leaves',
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
            if (voxHash(hx + li * 97, hy, hz) < g) cc = tone(c, voxHash(hz, hx, hy + li) < 0.5 ? 0.82 : 1.14);
          }
          V.set(voxKey(x, y, z), cc);
        }
  });
  return V;
}
/* a raw layer (voxels imported from a .vox, at L.vpm to the metre, else the recipe's, else eight) into V at R to the
   metre: a finer build makes each voxel a block (its skin only), a coarser one drops the voxels into bigger cells */
function voxRawInto(V, L, R, rec) {
  const d = voxRawDecode(L);
  if (!d.length) return;
  const lv = L.vpm || rec.vpm || 8,
    f = R / lv,
    sx = Math.round((L.x || 0) * R),
    sy = Math.round((L.y || 0) * R),
    sz = Math.round((L.z || 0) * R),
    pk = c => (c[0] << 16) | (c[1] << 8) | c[2];
  if (f <= 1.001) {
    for (const [x, y, z, c] of d)
      V.set(voxKey(Math.floor(x * f) + sx, Math.floor(y * f) + sy, Math.floor(z * f) + sz), pk(c));
    return;
  }
  const k = Math.round(f),
    S = new Set(d.map(q => voxKey(q[0], q[1], q[2])));
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
      if (S.has(voxKey(x + dx, y + dy, z + dz))) continue;
      for (let i = 0; i < k; i++)
        for (let j = 0; j < k; j++) {
          const p = dx ? [dx > 0 ? k - 1 : 0, i, j] : dy ? [i, dy > 0 ? k - 1 : 0, j] : [i, j, dz > 0 ? k - 1 : 0];
          V.set(voxKey(X + p[0], Y + p[1], Z + p[2]), cc);
        }
    }
  }
  V.ins.push({
    b,
    f: (X, Y, Z) => S.has(voxKey(Math.floor((X - sx) / k), Math.floor((Y - sy) / k), Math.floor((Z - sz) / k))),
  });
}
/* a raw layer: voxels packed as base64 of (x,y,z,r,g,b) bytes, offset by L.ox/oy/oz (the Studio's .vox import makes these) */
function voxRawDecode(L) {
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
function voxMesh(V, R) {
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
    const p = voxUnkey(k),
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
      if (V.has(voxKey(nx, ny, nz)) || hidden(nx, ny, nz)) continue;
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
function voxMeshFor(path, rec) {
  let m = VOX.meshes.get(path);
  if (m !== undefined) return m;
  if (rec.kind === 'mesh') {
    m = voxModelMesh(rec);
    VOX.meshes.set(path, m);
    return m;
  }
  if (voxLowPolyOn(rec)) {
    const L = rec.layers || [],
      M = voxLowPoly({ ...rec, layers: L.filter(l => !l.spin) });
    m = M ? { ...voxUpModel(M.vb, M.ib), model: 1, lowpoly: 1, tris: M.tris, q: 1 / 256, box: M.box, spins: [] } : null;
    if (m)
      for (const l of L)
        if (l.spin && !l.hide) {
          const S = voxLowPoly({ layers: [{ ...l, spin: undefined }] }),
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
              ...voxUpModel(S.vb, S.ib),
              c: [l.spin.x || 0, l.spin.z || 0, l.spin.y || 0],
              a: a.map(v => v / al),
              rps: l.spin.rps ?? 1.5,
            });
        }
    VOX.meshes.set(path, m);
    return m;
  }
  const gl = EGL.gl,
    R = voxRes(),
    L = rec.layers || [],
    still = L.some(l => l.spin) ? { ...rec, layers: L.filter(l => !l.spin) } : rec,
    M = voxMesh(voxelise(still, R), R);
  if (!M) {
    VOX.meshes.set(path, null);
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
      const S = voxMesh(voxelise({ vpm: rec.vpm, layers: [{ ...l, spin: undefined }] }, R), R),
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
        });
    }
  VOX.meshes.set(path, m);
  return m;
}
/* the turning parts of a voxel prop, drawn after its still mesh (p: the program, its uniforms set for the item) */
function voxSpins(p, m) {
  if (!m.spins || !m.spins.length) return;
  const gl = EGL.gl,
    t = (RM ? 0 : DIO.t || 0) / 1000;
  for (const s of m.spins) {
    gl.uniform4f(p.U.uSpin, s.a[0], s.a[1], s.a[2], t * s.rps * Math.PI * 2);
    gl.uniform3fv(p.U.uSpinC, s.c);
    voxEl(s);
  }
  gl.uniform4f(p.U.uSpin, 1, 0, 0, 0);
  gl.uniform3f(p.U.uSpinC, 0, 0, 0);
}
function voxFlush() {
  for (const k of [...VOX.meshes.keys()]) voxInvalidate(k, true);
}
export function voxInvalidate(path, keep) {
  const m = VOX.meshes.get(path);
  if (m && m.vao && typeof EGL !== 'undefined' && EGL.gl) {
    const gl = EGL.gl;
    for (const q of [m, ...(m.more || []), ...(m.spins || [])]) {
      gl.deleteVertexArray(q.vao);
      for (const b of q.bufs || []) gl.deleteBuffer(b);
    }
  }
  VOX.meshes.delete(path);
  if (!keep && path && !path.startsWith('inline:')) VOX.recipes.delete(path);
}
/* alpha 0.4: a low-poly model (a recipe of kind "mesh", made by tools/build-airship.py), painted with the buildings'
   32 px textures (the building sheet, scenery.buildArt.detail) in the buildings' look: each part's vertex data as the
   tool packed it (24 bytes a vertex: position in 1/256 m, normal, texture coordinates in 1/64 m, the sheet's cell and
   "flat", the colour; then the triangles), its turning parts ("spins": a pivot c and an axis a, up as y) like the
   voxels' propellers. It stands in for the picture where the voxel props do, and casts its real shadow. */
function voxUpModel(vb, ib) {
  const gl = EGL.gl,
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
function voxModelMesh(rec) {
  const gl = EGL.gl;
  const mk = P => {
    const b = Uint8Array.from(atob(P.data || ''), c => c.charCodeAt(0));
    if (!P.n || b.length < P.n * 24 + P.ni * 2) return null;
    return voxUpModel(b.subarray(0, P.n * 24), new Uint16Array(b.buffer, P.n * 24, P.ni));
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
   (on the top). Recipes with imported voxels stay voxels. */
const VOX_LP_TEX = {
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
};
function voxLowPoly(rec) {
  const V = [],
    I = [];
  let nv = 0;
  const T = (t, round) => (t === 'stone' && round ? 0 : (VOX_LP_TEX[t || 'plain'] ?? 15));
  const vert = (p, n, uv, tex, c) => {
      V.push(p, n, uv, tex, c);
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
    const c = hexA(L.col || '#888888'),
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
    else
      for (let i = 0; i <= 8; i++) {
        const k = (1 - Math.cos((Math.PI * i) / 8)) / 2;
        R.push([k, Math.sqrt(Math.max(0, 1 - (2 * k - 1) * (2 * k - 1)))]);
      }
    const lumpy = t === 'leaves' && L.k === 'sphere',
      n = Math.max(6, Math.min(lumpy ? 16 : 20, Math.round((2 * Math.PI * Math.max(r, ry) * 32) / 5))),
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
        const a = (2 * Math.PI * (j % n)) / n,
          lu =
            lumpy && i > 0 && i < NR - 1
              ? 1 + 0.22 * (voxHash(i * 7 + li3, j % n, 13) - 0.5) + 0.12 * Math.sin(a * 3 + i)
              : 1;
        row.push([x0 + Math.cos(a) * r * f * lu, y, y0 + Math.sin(a) * ry * f * lu]);
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
        poly(
          [G[i][j], G[i + 1][j], G[i + 1][j + 1], G[i][j + 1]],
          [NM[i][j], NM[i + 1][j], NM[i + 1][j + 1], NM[i][j + 1]],
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
    const p = V[i * 5],
      nn = V[i * 5 + 1],
      uv = V[i * 5 + 2],
      tx = V[i * 5 + 3],
      c = V[i * 5 + 4],
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
    u8[o + 18] = 0;
    u8[o + 20] = c[0];
    u8[o + 21] = c[1];
    u8[o + 22] = c[2];
    u8[o + 23] = 255;
  }
  return {
    vb,
    ib: nv > 65535 ? new Uint32Array(I) : new Uint16Array(I),
    n: I.length,
    tris: I.length / 3,
    box: [x0, y0, z0, x1, y1, z1],
  };
}
function voxLowPolyOn(rec) {
  return (
    typeof eng === 'function' &&
    !!eng('world', 'voxelLowPoly') &&
    !(rec.layers || []).some(l => l.k === 'raw' && !l.hide)
  );
}
function voxEl(m) {
  const gl = EGL.gl;
  gl.bindVertexArray(m.vao);
  if (m.el) gl.drawElements(gl.TRIANGLES, m.n, m.u32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
  else gl.drawArrays(gl.TRIANGLES, 0, m.n);
}
/* the model's program: its own vertex shader (placed, scaled, turned and spun like a voxel prop), the buildings' look */
const VOX_MDL_VS = () => `#version 300 es
precision highp float;layout(location=0) in vec3 mPos;layout(location=1) in vec3 mNrm;layout(location=2) in vec2 mUV;layout(location=3) in vec3 mTex;layout(location=4) in vec3 mCol;
uniform mat4 uVP;uniform vec3 uBase,uSpinC;uniform vec4 uSpin;uniform float uS,uRot,uFlip;out vec3 vW;out vec3 vN;out vec2 vUV;out vec3 vTex;out vec3 vCol;${EGL_GLSL_COMMON}${VOX_GLSL_SPIN}
void main(){float cr=cos(uRot),sr=sin(uRot);vec3 q0=voxSpin(mPos/256.-uSpinC)+uSpinC,n0=voxSpin(mNrm);vec3 p=vec3(q0.x*uFlip,q0.y,q0.z)*uS;p=vec3(p.x*cr-p.z*sr,p.y,p.x*sr+p.z*cr);vec3 n=vec3(n0.x*uFlip,n0.y,n0.z);n=vec3(n.x*cr-n.z*sr,n.y,n.x*sr+n.z*cr);
 vec3 w=uBase+p;w.y+=curveY(uBase.xz);vW=w;vN=n;vUV=mUV/64.;vTex=mTex;vCol=mCol;gl_Position=uVP*vec4(w,1.);}`;
/* the model's light: the buildings' look and textures, with the props' cel shading (three tones of sun, as the voxel
   props and the painted props have) as much as the model asks (uCel; a recipe's "cel", else .75) */
function voxMdlFS() {
  const f = BLD_SH.bld[1],
    a = 'shade(c,n,vW,sh,ao,vec4(.1,30.,0.,.3),0.)';
  if (!f.includes(a)) return f;
  return f
    .replace(a, 'shade(c,n,vW,sh,ao,vec4(.06,20.,0.,.22),uCel)')
    .replace('uniform vec3 uBP;', 'uniform vec3 uBP;uniform float uCel;');
}
/* the models among the items, drawn after the voxel props: L is [item, mesh] */
/* alpha 0.4: the props' shaders with the low-poly model's, for compiling ahead when the 3D view starts (diorama-gl.js dglGL) */
function voxShaders() {
  if (!VOX_SH.mdl && typeof BLD_SH !== 'undefined') VOX_SH.mdl = [VOX_MDL_VS(), voxMdlFS()];
  return VOX_SH;
}
function voxModels(C, X, L) {
  if (!L.length || typeof BLD_SH === 'undefined' || typeof bldArt !== 'function') return;
  const gl = EGL.gl;
  voxShaders();
  eglPrograms(VOX_SH);
  const A = bldArt(),
    det = eglImg(dioImg(A.detail), { noNormal: true });
  if (!det) return;
  const p = dglUse('mdl', C, X);
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  gl.disable(gl.CULL_FACE);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, det.t);
  gl.uniform1i(p.U.uDet, 0);
  gl.uniform2fv(p.U.uAtl, bldAtlas(A));
  if (p.U.uScroll) gl.uniform2f(p.U.uScroll, 0, 0);
  for (const [it, m] of L) {
    gl.uniform1f(p.U.uFade, it.fade ?? 1);
    gl.uniform1f(p.U.uBaseY, it.y);
    if (p.U.uCel) gl.uniform1f(p.U.uCel, it.vox && it.vox.cel != null ? it.vox.cel : 0.75);
    if (typeof dglLookU === 'function') dglLookU(p.U, it.lk, [it.x, it.y, it.z]);
    voxU(p, it);
    gl.uniform4f(p.U.uSpin, 1, 0, 0, 0);
    gl.uniform3f(p.U.uSpinC, 0, 0, 0);
    voxEl(m);
    for (const q of m.more || []) voxEl(q);
    voxSpins(p, m);
    VOX.drawn++;
  }
  gl.bindVertexArray(null);
}
/* alpha 0.4: a part that turns (a propeller): its own mesh, turned uSpin.w radians about the axis uSpin.xyz (a unit
   vector, up as y) through its pivot uSpinC (the model's metres, up as y) */
const VOX_GLSL_SPIN = `vec3 voxSpin(vec3 d){float a=uSpin.w;if(a==0.)return d;vec3 k=uSpin.xyz;float c=cos(a),s=sin(a);return d*c+cross(k,d)*s+k*dot(k,d)*(1.-c);}`;
const VOX_SH = {
  vox: [
    `#version 300 es
precision highp float;layout(location=0) in vec3 qPos;layout(location=1) in vec3 qNrm;layout(location=2) in vec3 qCol;uniform mat4 uVP;uniform vec3 uBase,uSpinC;uniform vec4 uSpin;uniform float uS,uRot,uFlip,uQ;${EGL_GLSL_COMMON}out vec3 vW;out vec3 vN;out vec3 vC;${VOX_GLSL_SPIN}
void main(){float cr=cos(uRot),sr=sin(uRot);vec3 q0=voxSpin(qPos*uQ-uSpinC)+uSpinC,n0=voxSpin(qNrm);vec3 p=vec3(q0.x*uFlip,q0.y,q0.z)*uS;p=vec3(p.x*cr-p.z*sr,p.y,p.x*sr+p.z*cr);vec3 n=vec3(n0.x*uFlip,n0.y,n0.z);n=vec3(n.x*cr-n.z*sr,n.y,n.x*sr+n.z*cr);
 vec3 w=uBase+p;w.y+=curveY(uBase.xz);vW=w;vN=n;vC=qCol;gl_Position=uVP*vec4(w,1.);}`,
    `#version 300 es
precision highp float;in vec3 vW;in vec3 vN;in vec3 vC;out vec4 o;uniform vec3 uBaseP;uniform float uFade,uEmit;${EGL_GLSL_LIGHT}
float bay(vec2 p){ivec2 i=ivec2(mod(p,4.));int b[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);return (float(b[i.y*4+i.x])+.5)/16.;}
void main(){if(uFade<.99&&bay(gl_FragCoord.xy)>uFade)discard;vec3 n=normalize(vN);vec3 c=vC;float hy=vW.y-uBaseP.y;
 float sh=shadowAtN(vW+n*.05,n,.0015),ao=mix(contactAO(vW),1.,clamp(hy*2.,0.,1.)),occ=min(sh,ao);
 /* cel shading: the sun in three tones, a hard terminator, like the painted props */
 vec3 v=normalize(uEye-vW);float rim=pow(1.-max(dot(n,v),0.),3.)*.1;
 o=vec4(fogit(shade(c,n,vW,sh,ao,vec4(.04,16.,0.,.2),.75)+c*rim*uSunCol*sh+c*uEmit,vW),1.);}`,
  ],
  voxS: [
    `#version 300 es
precision highp float;layout(location=0) in vec3 qPos;layout(location=1) in vec3 qNrm;layout(location=2) in vec3 qCol;uniform mat4 uVP;uniform vec3 uBase,uSpinC;uniform vec4 uSpin;uniform float uS,uRot,uFlip,uQ;${EGL_GLSL_COMMON}${VOX_GLSL_SPIN}
void main(){float cr=cos(uRot),sr=sin(uRot);vec3 q0=voxSpin(qPos*uQ-uSpinC)+uSpinC;vec3 p=vec3(q0.x*uFlip,q0.y,q0.z)*uS;p=vec3(p.x*cr-p.z*sr,p.y,p.x*sr+p.z*cr);vec3 w=uBase+p;w.y+=curveY(uBase.xz);gl_Position=uVP*vec4(w,1.);}`,
    `#version 300 es
precision highp float;out vec4 o;void main(){o=vec4(1.);}`,
  ],
};
/* tag an item that draws as voxels (dglItems calls this): the sprite and the solid-prop body stand aside */
function voxTag(it) {
  if (!voxOn() || it.k !== 'prop' || it.far || it.layer || !it.M || !it.M.vox || (it.p && it.p.vox === 'card')) return;
  const spec = it.M.vox;
  let rec, path;
  if (typeof spec === 'object') {
    rec = spec;
    path = 'inline:' + it.p.k + '#' + (it.M.voxV || 0);
  } else {
    rec = voxRecipe(spec);
    path = spec;
  }
  const R = voxRes() + (eng('world', 'voxelLowPoly') ? 1000 : 0);
  if (VOX.res !== R) {
    if (VOX.res) voxFlush();
    VOX.res = R;
  }
  /* a few new meshes a frame (about 12 ms): the rest draw as their pictures a frame or two longer */
  if (rec && !VOX.meshes.has(path)) {
    const fr = typeof DGL !== 'undefined' ? DGL.frames : 0;
    if (VOX.fr !== fr) {
      VOX.fr = fr;
      VOX.bt = 0;
    }
    if (VOX.bt > 12) return;
    const t0 = performance.now();
    voxGuard(() => voxMeshFor(path, rec));
    VOX.bt += performance.now() - t0;
  }
  /* only a recipe that makes a solid stands in for the picture: while it loads, or if it is empty or failed, the picture draws */
  if (!rec) return;
  if (rec.kind === 'mesh' || voxLowPolyOn(rec)) {
    const A = typeof bldArt === 'function' ? bldArt() : null,
      im = A && typeof dioImg === 'function' ? dioImg(A.detail) : null;
    if (!im || !(im.naturalWidth || im.width)) return;
  }
  if (!voxGuard(() => voxMeshFor(path, rec))) return;
  it.vox = rec;
  it.voxPath = path;
}
/* picture layers of a voxel prop as sprite items of their own (set in the model, metres from its base) */
function voxImageItems(it, out) {
  const rec = it.vox;
  if (!rec) return;
  const s = it.p.s || 1,
    f = it.flip || 1,
    ro = it.lk && it.lk.rot ? it.lk.rot * 0.6 : 0,
    cr = Math.cos(ro),
    sr = Math.sin(ro);
  for (const L of rec.layers || []) {
    if (L.k !== 'img' || L.hide) continue;
    const im = typeof dioImg === 'function' ? dioImg(L.img) : null;
    if (!im || !(im.naturalWidth || im.width)) {
      if (typeof artImg === 'function' && L.img) artImg(L.img);
      continue;
    }
    const lx = (L.x || 0) * s * f,
      lz = (L.y || 0) * s,
      w = im.naturalWidth || im.width,
      h = im.naturalHeight || im.height,
      mpp = (L.s || 1) / ((typeof GD !== 'undefined' && GD.scenery && GD.scenery.ppu) || 34);
    out.push({
      k: 'prop',
      p: it.p,
      M: it.M,
      im,
      x: it.x + lx * cr - lz * sr,
      z: it.z + lx * sr + lz * cr,
      y: it.y + (L.z || 0) * s,
      mpp: mpp * s,
      ox: -(w / 2),
      oy: -(h - 1),
      w,
      h,
      flip: L.flip ? -f : f,
      shear: it.shear || 0,
      sh: 0,
      fixed: L.face === 'fixed',
      plane: L.face === 'fixed',
      mat: it.mat,
      layer: L,
      still: it.still,
      voxImg: 1,
    });
  }
}
/* alpha 0.4.1: a moored airship (catalogue bob: metres) rides the air: it rises and settles, a little more in a stronger
   wind, and swings a few degrees round its mast (it turns about its base point, the mast's foot) */
function voxBob(it) {
  const b = it.M && it.M.bob;
  if (!b || (typeof RM !== 'undefined' && RM)) return null;
  const t = (DIO.t || 0) / 1000,
    ph = it.x * 0.37 + it.z * 0.21,
    w =
      typeof dglWindAt === 'function' && DIO.sc
        ? Math.min(2, Math.abs(dglWindAt(it.x, it.z, DIO.t || 0, DIO.sc)) * 8)
        : 0;
  return [
    (Math.sin(t * 1.25 + ph) + Math.sin(t * 0.47 + ph * 2) * 0.4) * b * (1 + w * 0.5),
    Math.sin(t * 0.29 + ph) * 0.03 * (1 + w * 0.4),
  ];
}
function voxU(p, it) {
  const gl = EGL.gl,
    U = p.U,
    s = (it.p.s || 1) * (it.lk ? it.lk.size : 1),
    bo = voxBob(it);
  gl.uniform3f(U.uBase, it.x, it.y + (bo ? bo[0] : 0), it.z);
  gl.uniform1f(U.uS, s);
  gl.uniform1f(U.uRot, (it.lk && it.lk.rot ? it.lk.rot * 0.6 : 0) + (bo ? bo[1] : 0));
  gl.uniform1f(U.uFlip, it.flip || 1);
}
function voxDraw(C, items, X, hits, labels, PPU) {
  VOX.drawn = 0;
  if (!voxOn()) return;
  voxGuard(() => {
    const gl = EGL.gl;
    eglPrograms(VOX_SH);
    let p = null;
    const ML = [];
    for (const it of items) {
      if (!it.vox || it.vis === false) continue;
      const m = voxMeshFor(it.voxPath, it.vox);
      if (!m) continue;
      if (m.model) {
        ML.push([it, m]);
        continue;
      }
      if (!p) {
        p = dglUse('vox', C, X);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.disable(gl.CULL_FACE);
      }
      gl.uniform3f(p.U.uBaseP, it.x, it.y, it.z);
      gl.uniform1f(p.U.uFade, it.fade ?? 1);
      gl.uniform1f(p.U.uEmit, it.glow ? it.glow : 0);
      voxU(p, it);
      gl.uniform1f(p.U.uQ, m.q || 1);
      gl.uniform4f(p.U.uSpin, 1, 0, 0, 0);
      gl.uniform3f(p.U.uSpinC, 0, 0, 0);
      voxEl(m);
      voxSpins(p, m);
      VOX.drawn++;
      if (hits && !it.far) dglHit(it, C, hits, labels, PPU);
    }
    gl.bindVertexArray(null);
    voxModels(C, X, ML);
    if (hits) for (const [it] of ML) if (!it.far) dglHit(it, C, hits, labels, PPU);
  });
}
function voxShadow(SH, items) {
  if (!voxOn()) return;
  voxGuard(() => {
    const gl = EGL.gl;
    eglPrograms(VOX_SH);
    let p = null;
    const ca = typeof dglCurveArgs === 'function' ? dglCurveArgs() : [0, 0, 0, 1e9];
    for (const it of items) {
      if (!it.vox) continue;
      const m = voxMeshFor(it.voxPath, it.vox);
      if (!m) continue;
      if (!p) {
        p = EGL.P.voxS;
        gl.useProgram(p.p);
        gl.uniformMatrix4fv(p.U.uVP, false, SH.vp);
        gl.uniform3f(p.U.uCurve, ca[0], ca[1], ca[2]);
        gl.uniform1f(p.U.uCurveD0, ca[3]);
      }
      voxU(p, it);
      gl.uniform1f(p.U.uQ, m.q || 1);
      gl.uniform4f(p.U.uSpin, 1, 0, 0, 0);
      gl.uniform3f(p.U.uSpinC, 0, 0, 0);
      voxEl(m);
      for (const q of m.more || []) voxEl(q);
      voxSpins(p, m);
    }
    gl.bindVertexArray(null);
  });
}
/* art the scene needs for its voxel props' picture layers (dioPaths asks) */
function voxPaths(sc, C) {
  const L = [];
  let any = false;
  for (const p of sc.props || (sc._lite && sc._lite.props) || []) {
    const M = C.props[p.k];
    if (!M || !M.vox) continue;
    any = true;
    const rec = VOX.recipes.get(M.vox);
    if (rec) for (const l of rec.layers || []) if (l.k === 'img' && l.img) L.push(l.img);
  }
  /* alpha 0.4: the low-poly props and models are painted from the building sheet */
  if (any) L.push((C.buildArt && C.buildArt.detail) || 'scene/build/detail.png');
  return L;
}
