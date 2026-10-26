'use strict';
/* ================= FOG GRID ON THE GRAPHICS CARD (air track AIR-2) =================
   The low fog's density round the player (logic/fog-grid.js) kept as an R8 3D texture for the light-in-air march to
   read (AIR-3; nothing reads it yet, so the look doesn't change). 48 x 12 x 48 cells of 1 m, 32 x 8 x 32 on phones.
   - A ring in x and z: a step across a cell refills and uploads one slab (texSubImage3D), never the whole grid. The
     texture is meant to be read with repeat in x and z at world / (n * cell), clamp in y from the grid's floor oy.
   - The grid's floor follows the ground under you (FOG_GRID_BELOW cells below it); moving it 2 cells or more refills
     the grid at once (the columns' heights are kept, only the density is worked out again).
   - When the weather, the mist or the water moves, every row is refilled over a few frames (FOG_ROWS_PER_FRAME); with
     nothing to do, one row is refreshed every FOG_TRICKLE frames so the noise drifts with the wind.
   - Not built indoors (its texture is freed), not in battles (it keeps what it had).
   - Debug menu > Tests and performance > "Show the fog grid": the cells as see-through blocks (drawFogGridBlocks).
   - The debug log's report has fogGrid: the uploads and their time (the CPU's side of the calls; the graphics card's
     copy is in the frame's GPU time), the fills and theirs. */
/* the rows refilled a frame after the weather moves (a quarter of the grid), and how often a row is refreshed with
   nothing else to do (frames) */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import {
  FOG_GRID_BELOW,
  FOG_GRID_SIZES,
  fogAmount,
  fogGridBuild,
  fogGridFill,
  fogGridMake,
  fogGridOrigin,
  fogGridRoll,
  ringIndex,
} from '../logic/fog-grid.js';
import { ENGINE_DEFAULTS, engineContext, engineSetting } from '../engine/settings.js';
import {
  ensurePrograms,
  gpuBuffer,
  gpuFree,
  gpuOnRestore,
  gpuSized,
  gpuState,
  gpuTexture,
  gpuVao,
} from '../engine/webgl.js';
import { environment } from '../environment.js';
import { walkRenderer } from './walk-state.js';
import { groundHeightAt } from './heights.js';
import { useWalkProgram, worldCurveDrop } from './draw-common.js';
/* eslint-disable no-func-assign */
expose({
  FOG_BLOCK_MIN: [() => FOG_BLOCK_MIN],
  FOG_BLOCK_MOST: [() => FOG_BLOCK_MOST],
  FOG_BLOCK_SHADERS: [() => FOG_BLOCK_SHADERS],
  FOG_DRIFT: [() => FOG_DRIFT],
  FOG_ROWS_PER_FRAME: [() => FOG_ROWS_PER_FRAME],
  FOG_TRICKLE: [() => FOG_TRICKLE],
  FOG_WEATHER_STEP: [() => FOG_WEATHER_STEP],
  drawFogGridBlocks: [() => drawFogGridBlocks, v => (drawFogGridBlocks = v)],
  fogBlockCube: [() => fogBlockCube, v => (fogBlockCube = v)],
  fogFilled: [() => fogFilled, v => (fogFilled = v)],
  fogFreeTexture: [() => fogFreeTexture, v => (fogFreeTexture = v)],
  fogGrid: [() => fogGrid],
  fogGridFrame: [() => fogGridFrame, v => (fogGridFrame = v)],
  fogGridReport: [() => fogGridReport, v => (fogGridReport = v)],
  fogGridState: [() => fogGridState, v => (fogGridState = v)],
  fogInputs: [() => fogInputs, v => (fogInputs = v)],
  fogMarchNote: [() => fogMarchNote, v => (fogMarchNote = v)],
  fogRefillRow: [() => fogRefillRow, v => (fogRefillRow = v)],
  fogScratch: [() => fogScratch],
  fogUpload: [() => fogUpload, v => (fogUpload = v)],
  fogUploadAll: [() => fogUploadAll, v => (fogUploadAll = v)],
  fogUploadRow: [() => fogUploadRow, v => (fogUploadRow = v)],
  fogUploadSlabX: [() => fogUploadSlabX, v => (fogUploadSlabX = v)],
  fogWeatherKey: [() => fogWeatherKey, v => (fogWeatherKey = v)],
  fogWeatherMoved: [() => fogWeatherMoved, v => (fogWeatherMoved = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const FOG_ROWS_PER_FRAME = 12;
const FOG_TRICKLE = 4;
/* how much the weather must move before the grid is refilled */
const FOG_WEATHER_STEP = 0.02;
/* the noise's drift with the wind (m/s, along x and z) */
const FOG_DRIFT = [0.22, 0.09];
const fogGrid = {
  G: null,
  tex: null,
  gen: 0,
  sc: null,
  /* the weather the grid was filled with: amount, fog, valley, water, mist height */
  key: null,
  /* rows (ring z indices) still to refill, and the trickle's next row */
  rows: [],
  next: 0,
  frame: 0,
  t0: performance.now(),
  /* bumped on every upload, so the debug blocks know to rebuild */
  ver: 0,
  stats: { builds: 0, refills: 0, slabs: 0, rows: 0, uploads: 0, bytes: 0, upMs: 0, upMax: 0, fillMs: 0, fillMax: 0 },
  blocks: null,
  /* AIR-3: the light-in-air march's use of the grid (fogMarchNote) */
  march: { on: false, why: 'none yet', steps: 0, frames: 0, changes: 0 },
};
const fogScratch = { a: new Uint8Array(0) };
/* what the fog is made of now (logic/fog-grid.js FogInputs), from the scene, the weather and the Air dials */
function fogInputs(sc) {
  const E = engineContext.env && !sc.indoor ? environment : null,
    vm = engineSetting('air', 'valleyMist'),
    V = walkRenderer.valley,
    t = (performance.now() - fogGrid.t0) / 1000,
    w = 1 + (E ? E.storm * 1.2 : 0);
  return {
    heightAt: groundHeightAt,
    water: walkRenderer.water ? walkRenderer.wlevel || 0 : null,
    mistH: engineSetting('air', 'mistHeight'),
    /* as walk/lighting.js: a place's own mist scaled by the dial, else the dial */
    mist:
      sc.mist != null
        ? Math.min(1, sc.mist * (engineSetting('air', 'mist') / (ENGINE_DEFAULTS.air.mist || 0.12)))
        : engineSetting('air', 'mist'),
    fog: E ? E.fog : 0,
    valley: V && vm > 0 ? [V[0], V[1] * vm] : null,
    indoor: !!(sc.indoor || sc.room),
    drift: [FOG_DRIFT[0] * t * w, FOG_DRIFT[1] * t * w],
  };
}
function fogWeatherKey(F) {
  return [fogAmount(F), F.fog, F.valley ? F.valley[1] : 0, F.water ?? -99, F.mistH];
}
function fogWeatherMoved(a, b) {
  if (!a || !b) return true;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > FOG_WEATHER_STEP) return true;
  return false;
}
function fogFreeTexture() {
  if (fogGrid.tex) gpuFree(fogGrid.tex);
  fogGrid.tex = null;
  fogGrid.G = null;
  fogGrid.rows = [];
  fogGrid.ver++;
}
gpuOnRestore('fogGrid', () => {
  fogGrid.tex = null;
  fogGrid.G = null;
  fogGrid.blocks = null;
});
/* time the uploads (the CPU's side) and count what went up */
function fogUpload(fn, bytes) {
  const gl = gpuState.gl,
    S = fogGrid.stats,
    t0 = performance.now();
  gl.bindTexture(gl.TEXTURE_3D, fogGrid.tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  fn(gl);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.bindTexture(gl.TEXTURE_3D, null);
  const ms = performance.now() - t0;
  S.uploads++;
  S.bytes += bytes;
  S.upMs += ms;
  if (ms > S.upMax) S.upMax = ms;
  fogGrid.ver++;
}
function fogFilled(t0) {
  const S = fogGrid.stats,
    ms = performance.now() - t0;
  S.fillMs += ms;
  if (ms > S.fillMax) S.fillMax = ms;
}
/* the whole grid up (a new texture when there is none) */
function fogUploadAll() {
  const G = fogGrid.G,
    gl = gpuState.gl;
  if (!fogGrid.tex) {
    fogGrid.tex = gpuTexture('other', G.data.length);
    fogGrid.gen = gpuState.gen;
    gl.bindTexture(gl.TEXTURE_3D, fogGrid.tex);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, G.nx, G.ny, G.nz, 0, gl.RED, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.REPEAT);
  }
  fogUpload(
    gl => gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0, G.nx, G.ny, G.nz, gl.RED, gl.UNSIGNED_BYTE, G.data),
    G.data.length
  );
}
/* one row of constant z (ring index tz): contiguous in the grid's data */
function fogUploadRow(tz) {
  const G = fogGrid.G,
    n = G.nx * G.ny;
  fogUpload(
    gl =>
      gl.texSubImage3D(
        gl.TEXTURE_3D,
        0,
        0,
        0,
        tz,
        G.nx,
        G.ny,
        1,
        gl.RED,
        gl.UNSIGNED_BYTE,
        G.data.subarray(tz * n, tz * n + n)
      ),
    n
  );
}
/* one slab of constant x (ring index tx): gathered into a scratch array first */
function fogUploadSlabX(tx) {
  const G = fogGrid.G,
    n = G.ny * G.nz;
  if (fogScratch.a.length < n) fogScratch.a = new Uint8Array(n);
  const a = fogScratch.a;
  for (let tz = 0; tz < G.nz; tz++)
    for (let iy = 0; iy < G.ny; iy++) a[iy + G.ny * tz] = G.data[tx + G.nx * (iy + G.ny * tz)];
  fogUpload(
    gl => gl.texSubImage3D(gl.TEXTURE_3D, 0, tx, 0, 0, 1, G.ny, G.nz, gl.RED, gl.UNSIGNED_BYTE, a.subarray(0, n)),
    n
  );
}
/* refill one row (ring index tz) where it lies now, and upload it */
function fogRefillRow(F, tz) {
  const G = fogGrid.G,
    iz = G.oz + ringIndex(tz - G.oz, G.nz),
    t0 = performance.now();
  fogGridFill(G, F, G.ox, G.ox + G.nx, iz, iz + 1);
  fogFilled(t0);
  fogUploadRow(tz);
  fogGrid.stats.rows++;
}
/* once a walk frame, before the frame's effects: keep the grid round the player (P), and up to date */
export function fogGridFrame(sc, P, BT, phone) {
  const gl = gpuState.gl;
  if (!gl || gpuState.lost || BT || !sc || !P) return;
  if (fogGrid.tex && fogGrid.gen !== gpuState.gen) {
    fogGrid.tex = null;
    fogGrid.G = null;
  }
  if (sc.indoor || sc.room) {
    if (fogGrid.tex || fogGrid.G) fogFreeTexture();
    fogGrid.sc = sc;
    return;
  }
  fogGrid.frame++;
  const F = fogInputs(sc),
    [nx, ny, nz] = FOG_GRID_SIZES[phone ? 'phone' : 'full'],
    below = FOG_GRID_BELOW[phone ? 'phone' : 'full'],
    S = fogGrid.stats;
  let G = fogGrid.G;
  const o = G ? fogGridOrigin(G, P.x, P.z, groundHeightAt(P.x, P.z), below) : null;
  /* a new place, a new size or a lost grid: built at once */
  if (!G || fogGrid.sc !== sc || G.nx !== nx || G.ny !== ny) {
    if (fogGrid.tex && G && (G.nx !== nx || G.ny !== ny)) fogFreeTexture();
    G = fogGrid.G = fogGridMake(nx, ny, nz);
    fogGrid.sc = sc;
    const t0 = performance.now();
    fogGridBuild(G, F, fogGridOrigin(G, P.x, P.z, groundHeightAt(P.x, P.z), below));
    fogFilled(t0);
    fogGrid.key = fogWeatherKey(F);
    fogGrid.rows = [];
    fogUploadAll();
    S.builds++;
    return;
  }
  /* the floor follows the ground under you: 2 cells off, every row again at once (the columns are kept) */
  if (Math.abs(o[1] - G.oy) >= 2) {
    G.oy = o[1];
    const t0 = performance.now();
    fogGridFill(G, F, G.ox, G.ox + G.nx, G.oz, G.oz + G.nz);
    fogFilled(t0);
    fogGrid.key = fogWeatherKey(F);
    fogGrid.rows = [];
    fogUploadAll();
    S.refills++;
    return;
  }
  /* a step across a cell: the slabs that came in */
  if (o[0] !== G.ox || o[2] !== G.oz) {
    const t0 = performance.now(),
      slabs = fogGridRoll(G, F, o[0], o[2]);
    if (!slabs) {
      fogGridBuild(G, F, [o[0], G.oy, o[2]]);
      fogFilled(t0);
      fogGrid.rows = [];
      fogUploadAll();
      S.builds++;
      return;
    }
    fogFilled(t0);
    for (const [ax, i] of slabs)
      if (ax === 'x') fogUploadSlabX(ringIndex(i, G.nx));
      else fogUploadRow(ringIndex(i, G.nz));
    S.slabs += slabs.length;
  }
  /* the weather moved: every row again, a few a frame */
  const key = fogWeatherKey(F);
  if (fogWeatherMoved(key, fogGrid.key)) {
    fogGrid.key = key;
    fogGrid.rows = Array.from({ length: G.nz }, (_, i) => i);
  }
  if (fogGrid.rows.length) {
    for (const tz of fogGrid.rows.splice(0, FOG_ROWS_PER_FRAME)) fogRefillRow(F, tz);
  } else if (fogAmount(F) > 0 && fogGrid.frame % FOG_TRICKLE === 0) {
    fogRefillRow(F, fogGrid.next);
    fogGrid.next = (fogGrid.next + 1) % G.nz;
  }
}
/* AIR-3: what the light-in-air march reads (tex, G), or null: indoors, before the first build, after a lost context */
export function fogGridState() {
  return fogGrid.tex && fogGrid.G && fogGrid.gen === gpuState.gen ? fogGrid : null;
}
/* the march's last state for the debug log: on, or why not; its steps; the frames it ran and how often it changed */
export function fogMarchNote(on, why, steps) {
  const M = fogGrid.march;
  if (M.on !== on || M.why !== why || M.steps !== steps) M.changes++;
  M.on = on;
  M.why = why;
  M.steps = steps;
  if (on) M.frames++;
}
/* the debug log's numbers: sizes, counts and the time per upload and per fill (ms) */
export function fogGridReport() {
  const G = fogGrid.G,
    S = fogGrid.stats,
    r = v => Math.round(v * 1000) / 1000,
    fills = S.builds + S.refills + S.rows + (S.slabs ? 1 : 0);
  return {
    on: !!fogGrid.tex,
    size: G ? [G.nx, G.ny, G.nz] : null,
    cell: G ? G.cell : null,
    heights: G ? G.reads : 0,
    builds: S.builds,
    refills: S.refills,
    slabs: S.slabs,
    rows: S.rows,
    uploads: S.uploads,
    kb: Math.round(S.bytes / 1024),
    uploadMs: S.uploads ? r(S.upMs / S.uploads) : 0,
    uploadMaxMs: r(S.upMax),
    fillMs: r(S.fillMs),
    fillMaxMs: r(S.fillMax),
    fills,
    march: { ...fogGrid.march },
  };
}
/* ---------- the debug view: the cells as see-through blocks (debug menu only) ---------- */
const FOG_BLOCK_SHADERS = {
  fogBlocks: [
    `#version 300 es
precision highp float;layout(location=0) in vec3 aP;layout(location=1) in vec4 iC;uniform mat4 uVP;uniform float uCell;out float vD;out float vY;
void main(){vD=iC.w;vY=aP.y;gl_Position=uVP*vec4(iC.xyz+aP*uCell*.92,1.);}`,
    `#version 300 es
precision highp float;in float vD;in float vY;out vec4 o;
void main(){vec3 c=mix(vec3(.45,.65,1.),vec3(1.),vD)*(.8+.4*vY);float a=.12+.5*vD;o=vec4(c*a,a);}`,
  ],
};
/* the cells over this density are drawn, at most this many */
const FOG_BLOCK_MIN = 24;
const FOG_BLOCK_MOST = 16000;
function fogBlockCube() {
  /* six faces of two triangles, the unit cube round 0 (drawn without culling, so the winding doesn't matter) */
  const c = [],
    tri = [
      [-0.5, -0.5],
      [0.5, -0.5],
      [0.5, 0.5],
      [-0.5, -0.5],
      [0.5, 0.5],
      [-0.5, 0.5],
    ];
  for (const ax of ['x', 'y', 'z'])
    for (const s of [-0.5, 0.5])
      for (const [u, v] of tri) c.push(...(ax === 'x' ? [s, u, v] : ax === 'y' ? [u, s, v] : [u, v, s]));
  return new Float32Array(c);
}
export function drawFogGridBlocks(C) {
  const G = fogGrid.G,
    gl = gpuState.gl;
  if (!G || !fogGrid.tex || !C) return;
  ensurePrograms(FOG_BLOCK_SHADERS);
  const p = useWalkProgram('fogBlocks', C, null);
  if (!p.fb) {
    const vao = gpuVao('other'),
      cube = gpuBuffer('other', 36 * 12),
      inst = gpuBuffer('other');
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, cube);
    gl.bufferData(gl.ARRAY_BUFFER, fogBlockCube(), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, inst);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 16, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);
    p.fb = { vao, inst, ver: -1, n: 0 };
  }
  if (p.fb.ver !== fogGrid.ver) {
    const d = new Float32Array(FOG_BLOCK_MOST * 4),
      c = G.cell;
    let n = 0;
    for (let iz = G.oz; iz < G.oz + G.nz && n < FOG_BLOCK_MOST; iz++)
      for (let ix = G.ox; ix < G.ox + G.nx && n < FOG_BLOCK_MOST; ix++) {
        const x = (ix + 0.5) * c,
          z = (iz + 0.5) * c,
          drop = worldCurveDrop(x, z);
        for (let iy = 0; iy < G.ny && n < FOG_BLOCK_MOST; iy++) {
          const v = G.data[ringIndex(ix, G.nx) + G.nx * (iy + G.ny * ringIndex(iz, G.nz))];
          if (v < FOG_BLOCK_MIN) continue;
          d[n * 4] = x;
          d[n * 4 + 1] = (G.oy + iy + 0.5) * c + drop;
          d[n * 4 + 2] = z;
          d[n * 4 + 3] = v / 255;
          n++;
        }
      }
    gl.bindBuffer(gl.ARRAY_BUFFER, p.fb.inst);
    gl.bufferData(gl.ARRAY_BUFFER, d.subarray(0, n * 4), gl.DYNAMIC_DRAW);
    gpuSized(p.fb.inst, n * 16);
    p.fb.ver = fogGrid.ver;
    p.fb.n = n;
  }
  if (!p.fb.n) return;
  gl.uniform1f(p.U.uCell, G.cell);
  const blend = gl.isEnabled(gl.BLEND),
    cull = gl.isEnabled(gl.CULL_FACE);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.CULL_FACE);
  gl.depthMask(false);
  gl.bindVertexArray(p.fb.vao);
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, p.fb.n);
  gl.bindVertexArray(null);
  gl.depthMask(true);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  if (!blend) gl.disable(gl.BLEND);
  if (cull) gl.enable(gl.CULL_FACE);
}
