'use strict';
/* ================= WALK GROUND DRAW =================
   Phase 20 (stage B): drawing the ground and the grass (trails, pushers, flowers), moved from walk-view-gl.js as they
   were. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide, reducedMotion, worldBillies } from '../hooks.js';
import { clamp } from '../util.js';
import { hexToRgb } from '../art.js';
import { GROUND_BORDER_M, artImage, walkData, walkView } from '../walk-view.js';
import { engineColor, engineContext, engineSetting } from '../engine/settings.js';
import { gpuState, imageTexture } from '../engine/webgl.js';
import { environment } from '../environment.js';
import { walkRenderer } from './walk-state.js';
import { WALL_COLORS, defaultWallMaterial, standingHeightAt } from './heights.js';
import { useWalkProgram, worldCurveDrop } from './draw-common.js';
import { setShoreUniforms } from './water-data.js';
import { setNearRingUniforms } from './map-cache.js';
import { computeFrustum, inFrustum } from './quality-cull.js';
import { skyColors } from './sky.js';
import { roomBoxOf } from './rooms.js';
/* eslint-disable no-func-assign */
expose({
  FLOWER_COLORS: [() => FLOWER_COLORS],
  FLOWER_PACKED: [() => FLOWER_PACKED],
  FLOWER_SET_BY_LOCATION: [() => FLOWER_SET_BY_LOCATION],
  GRASS_NO_TRAIL: [() => GRASS_NO_TRAIL],
  GRASS_PUSHER_BUFFER: [() => GRASS_PUSHER_BUFFER],
  GRASS_TRAIL_BUFFER: [() => GRASS_TRAIL_BUFFER],
  drawGrass: [() => drawGrass, v => setDrawGrass(v)],
  drawGround: [() => drawGround, v => setDrawGround(v)],
  grassPushers: [() => grassPushers, v => (grassPushers = v)],
  grassTrail: [() => grassTrail, v => (grassTrail = v)],
  mapFlowers: [() => mapFlowers, v => (mapFlowers = v)],
});
/* eslint-enable no-func-assign */
export function setDrawGrass(v) {
  drawGrass = v; // eslint-disable-line no-func-assign
  provide({ drawGrass });
}
export function setDrawGround(v) {
  drawGround = v; // eslint-disable-line no-func-assign
  provide({ drawGround });
}
/* to-module: end */
export function drawGround(C, X) {
  const gl = gpuState.gl,
    sc = walkView.sc,
    p = useWalkProgram('ground', C, X),
    U = p.U,
    P = GROUND_BORDER_M;
  const wa = imageTexture(artImage(walkData().sc.wallArt || 'scene/build/walls.png'), { noNormal: true });
  gl.activeTexture(gl.TEXTURE4);
  gl.bindTexture(gl.TEXTURE_2D, wa ? wa.t : gpuState.white);
  gl.uniform1i(U.uWallA, 4);
  if (!walkRenderer.wallColF) {
    walkRenderer.wallColF = new Float32Array(36);
  }
  const WC = sc.wallCol || [];
  for (let i = 0; i < 12; i++) {
    const c = WC[i] ? hexToRgb(WC[i]).map(v => v / 255) : WALL_COLORS[i];
    walkRenderer.wallColF.set(c, i * 3);
  }
  gl.uniform3fv(U.uWallCol, walkRenderer.wallColF);
  gl.uniform1f(U.uWallDef, defaultWallMaterial(sc));
  const Pq = walkRenderer.bt
    ? null
    : (() => {
        const P = walkView.pl,
          y = (P.yv ?? standingHeightAt(P.x, P.z)) + 0.9 + worldCurveDrop(P.x, P.z),
          m = C.vp,
          cx = m[0] * P.x + m[4] * y + m[8] * P.z + m[12],
          cy = m[1] * P.x + m[5] * y + m[9] * P.z + m[13],
          w = m[3] * P.x + m[7] * y + m[11] * P.z + m[15];
        return w > 0.2 ? [cx / w, cy / w, w] : null;
      })();
  gl.uniform3fv(U.uPlC, Pq || [9, 9, -1]);
  gl.uniform1f(U.uAspect, C.rw / C.rh);
  if (U.uFol) gl.uniform2f(U.uFol, 0.6, sc.indoor ? 0 : 1);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, walkRenderer.gtex);
  gl.uniform1i(U.uGround, 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, walkRenderer.ftex);
  gl.uniform1i(U.uFar, 1);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, walkRenderer.ctex);
  gl.uniform1i(U.uCliff, 2);
  gl.activeTexture(gl.TEXTURE3);
  gl.bindTexture(gl.TEXTURE_2D, walkRenderer.gntex || gpuState.flatN);
  gl.uniform1i(U.uGNrm, 3);
  gl.uniform1f(U.uGStr, engineSetting('world', 'groundBumps'));
  gl.uniform1f(U.uGShine, engineSetting('world', 'groundShine'));
  gl.uniform4f(U.uGRect, -P, sc.h + P, 1 / (sc.w + 2 * P), 1 / (sc.h + 2 * P));
  setShoreUniforms(U, sc);
  setNearRingUniforms(U, sc);
  if (U.uBed) gl.uniform3fv(U.uBed, engineColor('water', 'bed', '#74654A'));
  if (U.uGAO) {
    gl.activeTexture(gl.TEXTURE8);
    gl.bindTexture(gl.TEXTURE_2D, walkRenderer.gaoTex || gpuState.white);
    gl.bindSampler(8, null);
    gl.uniform1i(U.uGAO, 8);
    gl.uniform3f(U.uGAOR, 1 / sc.w, 1 / sc.h, walkRenderer.gaoTex ? (engineSetting('shadows', 'groundAO') ?? 1) : 0);
  }
  if (U.uWet) {
    const E = typeof environment !== 'undefined' && engineContext.env && !sc.indoor ? environment : null,
      sk = skyColors(sc);
    gl.uniform1f(U.uWet, E ? clamp((E.wet || 0) * (engineSetting('air', 'wetGround') ?? 1), 0, 1) : 0);
    gl.uniform1f(U.uRainK, E ? Math.min(1, E.rain || 0) : 0);
    gl.uniform3fv(U.uSkyW, sk[1]);
    gl.uniform1f(U.uCausW, engineSetting('water', 'wallLight') ?? 1);
  }
  if (U.uRoom) {
    const B = sc.room && (engineSetting('lights', 'roomLight') ?? true) !== false ? roomBoxOf(sc) : null;
    gl.uniform4f(U.uRoom, B ? B[0] : 0, B ? B[1] : 0, B ? B[2] : 0, B ? 1 : 0);
    if (U.uRoomY) gl.uniform1f(U.uRoomY, B ? standingHeightAt(sc.w / 2, 1.5) : 0);
  }
  gl.uniform3fv(U.uFarTint, sc.farTint ? hexToRgb(sc.farTint).map(v => v / 200) : [1, 1, 1]);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.BLEND);
  gl.bindVertexArray(walkRenderer.mesh.vao);
  gl.drawElements(gl.TRIANGLES, walkRenderer.mesh.n, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}
/* where you walked through the grass lately (16 spots, the blades spring back over four seconds) */
function grassTrail() {
  const P = walkView.pl,
    t = walkView.t,
    T = walkRenderer.trail || (walkRenderer.trail = []);
  if (walkRenderer.trailId !== walkView.id) {
    T.length = 0;
    walkRenderer.trailId = walkView.id;
  }
  const last = T[T.length - 1];
  if (P.walk && (!last || Math.hypot(last.x - P.x, last.z - P.z) > 0.3)) {
    T.push({ x: P.x, z: P.z, t });
    if (T.length > 16) T.shift();
  }
  /* phase 20 C2: written into one kept buffer: the last steps of the trail, then up to 4 wild ones */
  const a = GRASS_TRAIL_BUFFER,
    E = walkRenderer.encPos || [],
    ne = Math.min(4, E.length),
    t0 = Math.max(0, T.length - (16 - ne));
  a.fill(0);
  let j = 0;
  for (let i = t0; i < T.length; i++, j += 3) {
    const q = T[i];
    a[j] = q.x;
    a[j + 1] = q.z;
    a[j + 2] = Math.max(0, 1 - (t - q.t) / 4000);
  }
  for (let k = 0; k < ne; k++, j += 3) {
    a[j] = E[k][0];
    a[j + 1] = E[k][1];
    a[j + 2] = 0.85;
  }
  return a;
}
/* who else parts the grass this frame (up to 8, nearest the player first): the buddy, the wild ones hiding in it, folk,
   and in a battle on the 3D stage the billionaires themselves */
const GRASS_PUSHER_BUFFER = new Float32Array(24),
  GRASS_TRAIL_BUFFER = new Float32Array(48),
  GRASS_NO_TRAIL = new Float32Array(48);
function grassPushers() {
  const A = GRASS_PUSHER_BUFFER,
    P = walkView.pl,
    L = [];
  A.fill(0);
  if (walkRenderer.bt && walkRenderer.bt.items) {
    for (const it of walkRenderer.bt.items)
      if (it.k === 'rig') L.push([it.x, it.z, Math.max(0.45, (it.aoR || 0.4) * 1.3)]);
  } else {
    if (typeof worldBillies !== 'undefined' && worldBillies.bud) L.push([worldBillies.bud.x, worldBillies.bud.z, 0.6]);
    if (walkRenderer.encPos) for (const e of walkRenderer.encPos) L.push([e[0], e[1], 0.75]);
    for (const f of walkView.folk || []) if (Math.hypot(f.x - P.x, f.z - P.z) < 14) L.push([f.x, f.z, 0.5]);
  }
  L.sort((a, b) => Math.hypot(a[0] - P.x, a[1] - P.z) - Math.hypot(b[0] - P.x, b[1] - P.z));
  for (let i = 0; i < Math.min(8, L.length); i++) {
    A[i * 3] = L[i][0];
    A[i * 3 + 1] = L[i][1];
    A[i * 3 + 2] = L[i][2];
  }
  return A;
}
/* alpha 0.4: the flowers in a place's grass, by its character: daisies and clover by the towns, poppies and cornflowers
   in the meadows, heather on the hills, teal and pink in the Meadowlands, glowing caps in the Spore Forest */
const FLOWER_COLORS = {
  town: ['#F6F2E8', '#F8E27A', '#F2C4DA', '#FFFFFF'],
  meadow: ['#E8483C', '#5A7AE8', '#F6F2E8', '#F8D040'],
  hill: ['#B87AC8', '#9A5AB8', '#E2C8EE', '#F6F2E8'],
  pastel: ['#4FC8C0', '#F07AB0', '#7ADCD2', '#F6A8CC'],
  spore: ['#7AF0E0', '#C890F8', '#9AF4B0', '#F0A0F8'],
  warm: ['#F8D040', '#F08A3C', '#F6F2E8', '#E8483C'],
  cool: ['#8AB8F0', '#E8F0F8', '#B8A0E8', '#F6F2E8'],
};
const FLOWER_SET_BY_LOCATION = {
  twinpetal: 'pastel',
  fanfare_fields: 'pastel',
  petalfall: 'pastel',
  puffcap: 'spore',
  capshade: 'spore',
  hedgerow: 'meadow',
  tallgrass_meadow: 'meadow',
  old_fairway: 'meadow',
  kitewind: 'hill',
  hornpass: 'hill',
  frostcrown: 'cool',
  mirrormere: 'cool',
  grapevine_hills: 'warm',
  goldvine: 'warm',
  badlands: 'warm',
  saltpan_flats: 'warm',
  russetwood: 'warm',
  stepstone_canyon: 'warm',
  clovercrest: 'meadow',
};
/* phase 20 C2: each flower set's colours worked out once, packed for uFlw (they were remade every frame) */
const FLOWER_PACKED = new Map();
function mapFlowers(sc) {
  const id = (sc && (sc.locationId || sc.baseId)) || '',
    k = FLOWER_SET_BY_LOCATION[id] || (sc && sc.kind === 'town' ? 'town' : 'meadow');
  let F = FLOWER_PACKED.get(k);
  if (!F) {
    const c = FLOWER_COLORS[k].map(h => hexToRgb(h).map(v => v / 255));
    F = { c, packed: new Float32Array(c.flat()), glow: k === 'spore' ? 0.55 : 0 };
    FLOWER_PACKED.set(k, F);
  }
  return F;
}
export function drawGrass(C, X) {
  const gl = gpuState.gl,
    p = useWalkProgram('grass', C, X),
    U = p.U,
    sc = walkView.sc,
    P = walkView.pl;
  if (U['uFlw[0]'] || U.uFlw) {
    const F = mapFlowers(sc),
      loc = U.uFlw || U['uFlw[0]'];
    gl.uniform3fv(loc, F.packed);
    gl.uniform1f(U.uFlwGlow, F.glow);
  }
  if (U.uTrail) gl.uniform3fv(U.uTrail, walkRenderer.bt ? GRASS_NO_TRAIL : grassTrail());
  if (U.uPush) gl.uniform3fv(U.uPush, grassPushers());
  gl.uniform3fv(U.uRight, C.right);
  gl.uniform3f(U.uPl, P.x, 0, P.z);
  gl.uniform1f(U.uT, reducedMotion ? 0 : walkView.t);
  gl.uniform1f(U.uWind, (sc.wind ?? 1) * engineSetting('grass', 'wind'));
  gl.uniform1f(U.uGust, engineSetting('grass', 'gusts'));
  gl.uniform1f(U.uBend, engineSetting('grass', 'bend'));
  gl.uniform1f(U.uHK, engineSetting('grass', 'height'));
  gl.uniform3f(U.uCut, C.eye[0], C.eye[2], walkRenderer.bt ? (walkRenderer.bt.cut ?? 3.2) : 0);
  const g = sc.grassCol || [engineSetting('grass', 'low'), engineSetting('grass', 'high')];
  gl.uniform3fv(
    U.uGlo,
    hexToRgb(g[0]).map(v => v / 255)
  );
  gl.uniform3fv(
    U.uGhi,
    hexToRgb(g[1]).map(v => v / 255)
  );
  if (U.uFol) gl.uniform2f(U.uFol, 0.75, 1);
  gl.disable(gl.CULL_FACE);
  const G = walkRenderer.grass;
  gl.bindVertexArray(G.vao);
  if (!G.chunks || !(engineSetting('quality', 'cull') ?? true)) {
    gl.bindBuffer(gl.ARRAY_BUFFER, G.ib);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, G.n);
  } else {
    const F = computeFrustum(C.vp),
      far = (walkRenderer.q || 0) >= 3 ? 38 : 1e9,
      Pp = walkView.pl;
    gl.bindBuffer(gl.ARRAY_BUFFER, G.ib);
    let drawn = 0;
    for (const c of G.chunks) {
      if (!inFrustum(F, c.x, c.y + worldCurveDrop(c.x, c.z), c.z, c.r)) continue;
      if (far < 1e9 && Math.hypot(c.x - Pp.x, c.z - Pp.z) > far) continue;
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, c.off * 32);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, c.off * 32 + 16);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, c.n);
      drawn += c.n;
    }
    walkRenderer.grassDrawn = drawn;
  }
  gl.bindVertexArray(null);
}
