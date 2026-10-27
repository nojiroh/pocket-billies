'use strict';
/* ================= WALK GROUND DRAW =================
   Phase 20 (stage B): drawing the ground and the grass (trails, pushers, flowers), moved from walk-view-gl.js as they
   were. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { paintGroundRect, provide, reducedMotion, waitForPaintWorker, worldBillies } from '../hooks.js';
import { clamp } from '../util.js';
import { hexToRgb } from '../art.js';
import {
  GROUND_BORDER_M,
  PAINT_WORKER_WAIT,
  artImage,
  bigTilesOn,
  groundKey,
  paintGroundSteps,
  walkData,
  walkView,
} from '../walk-view.js';
import { engineColor, engineContext, engineSetting } from '../engine/settings.js';
import { gpuState, imageTexture } from '../engine/webgl.js';
import { environment } from '../environment.js';
import { walkRenderer } from './walk-state.js';
import { WALL_COLORS, biomeCliff, defaultWallMaterial, standingHeightAt, wallAtlasRows } from './heights.js';
import { useWalkProgram, worldCurveDrop } from './draw-common.js';
import { setShoreUniforms } from './water-data.js';
import { buildGroundMeshSteps } from './ground-mesh.js';
import { freeMapCacheEntry, setNearRingUniforms } from './map-cache.js';
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
  ROOM_FLOORS_KEPT: [() => ROOM_FLOORS_KEPT],
  ROOM_PICTURES: [() => ROOM_PICTURES],
  ROOM_PICTURES_PENDING: [() => ROOM_PICTURES_PENDING],
  drawGrass: [() => drawGrass, v => setDrawGrass(v)],
  drawGround: [() => drawGround, v => setDrawGround(v)],
  drawGroundDepth: [() => drawGroundDepth, v => ((drawGroundDepth = v), provide({ drawGroundDepth }))],
  grassPushers: [() => grassPushers, v => (grassPushers = v)],
  grassTrail: [() => grassTrail, v => (grassTrail = v)],
  mapFlowers: [() => mapFlowers, v => (mapFlowers = v)],
  paintRoomFloor: [() => paintRoomFloor, v => (paintRoomFloor = v)],
  roomFloorOf: [() => roomFloorOf, v => ((roomFloorOf = v), provide({ roomFloorOf }))],
  roomFloorReady: [() => roomFloorReady, v => (roomFloorReady = v)],
  roomHole: [() => roomHole, v => ((roomHole = v), provide({ roomHole }))],
  setTerrainLookUniforms: [() => setTerrainLookUniforms, v => (setTerrainLookUniforms = v)],
});
/* eslint-enable no-func-assign */
provide({ drawGroundDepth, roomFloorOf, roomHole });
export function setDrawGrass(v) {
  drawGrass = v; // eslint-disable-line no-func-assign
  provide({ drawGrass });
}
export function setDrawGround(v) {
  drawGround = v; // eslint-disable-line no-func-assign
  provide({ drawGround });
}
/* to-module: end */
/* terrain TR-4: the biome's cliff faces and strata (world.cliffFaces: uFaceB = band, strata on, steep land as rock face,
   its material; uStrata the three colours) and its snow line (world.snowLine: uSnowL = line, ragged depth, on), from
   the biome's cliff block K (biomes.json; null for a hand-made map) */
function setTerrainLookUniforms(gl, U, sc, K) {
  const faces = !!K && !!engineSetting('world', 'cliffFaces'),
    snow = !!K && K.snowLine != null && !!engineSetting('world', 'snowLine');
  gl.uniform4f(U.uFaceB, K ? K.band : 1, faces ? 1 : 0, faces ? 1 : 0, faces ? K.mat : 1);
  if (faces) {
    if (!walkRenderer.strataF) walkRenderer.strataF = new Float32Array(9);
    for (let i = 0; i < 3; i++)
      walkRenderer.strataF.set(
        hexToRgb(K.strata[i]).map(v => v / 255),
        i * 3
      );
    gl.uniform3fv(U.uStrata, walkRenderer.strataF);
  }
  gl.uniform4f(U.uSnowL, snow ? K.snowLine : 0, 1.5, snow ? 1 : 0, 0);
}
export function drawGround(C, X) {
  const gl = gpuState.gl,
    sc = walkView.sc,
    p = useWalkProgram('ground', C, X),
    U = p.U,
    P = GROUND_BORDER_M;
  const wim = artImage(walkData().sc.wallArt || 'scene/build/walls.png'),
    wa = imageTexture(wim, { noNormal: true });
  /* terrain TR-4: the atlas has 3 rows of cells (12 materials) or 4 (16): read from the picture's shape */
  gl.uniform1f(U.uWallRows, wallAtlasRows(wim));
  gl.activeTexture(gl.TEXTURE4);
  gl.bindTexture(gl.TEXTURE_2D, wa ? wa.t : gpuState.white);
  gl.uniform1i(U.uWallA, 4);
  if (!walkRenderer.wallColF) {
    walkRenderer.wallColF = new Float32Array(48);
  }
  const WC = sc.wallCol || [];
  for (let i = 0; i < 16; i++) {
    const c = WC[i] ? hexToRgb(WC[i]).map(v => v / 255) : WALL_COLORS[i];
    walkRenderer.wallColF.set(c, i * 3);
  }
  gl.uniform3fv(U.uWallCol, walkRenderer.wallColF);
  gl.uniform1f(U.uWallDef, defaultWallMaterial(sc));
  setTerrainLookUniforms(gl, U, sc, biomeCliff(sc));
  /* your spot on screen (uPlC: walls and, since terrain TR-3, rock between the camera and you thin out round it)
    is set with the program (draw-common.js setRockUniforms) */
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
    if (U.uGAOSky) gl.uniform1f(U.uGAOSky, engineSetting('shadows', 'groundAOSky') ? 1 : 0);
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
    /* IS-5: the box is in the room's own metres; a turned room's frame turns the place's into them */
    const F = B && sc.roomFrame,
      r = F ? (F.q * Math.PI) / 2 : 0;
    if (U.uRoomT)
      gl.uniform4f(
        U.uRoomT,
        F ? F.p[0] : 0,
        F ? F.p[1] : 0,
        F ? Math.round(Math.cos(r)) : 1,
        F ? Math.round(Math.sin(r)) : 0
      );
    if (U.uRoomY) gl.uniform1f(U.uRoomY, B ? standingHeightAt(sc.w / 2, 1.5) : 0);
  }
  gl.uniform3fv(U.uFarTint, sc.farTint ? hexToRgb(sc.farTint).map(v => v / 200) : [1, 1, 1]);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.BLEND);
  if (U.uOrg) gl.uniform3f(U.uOrg, 0, 0, 0);
  if (U.uHole) gl.uniform4fv(U.uHole, roomHole(sc));
  gl.bindVertexArray(walkRenderer.mesh.vao);
  gl.drawElements(gl.TRIANGLES, walkRenderer.mesh.n, gl.UNSIGNED_INT, 0);
  /* phase 08b: the room's own floor and walls where the place left its hole: the room's picture, no near ring, no
     shore, no shade from the place's ground */
  const RT = roomFloorOf(sc);
  if (RT) {
    const R = sc.roomRect;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, RT.gtex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, RT.ftex);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, RT.ctex);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, RT.gntex || gpuState.flatN);
    gl.uniform4f(U.uGRect, R[0], R[1] + R[3], 1 / R[2], 1 / R[3]);
    if (U.uCanvas) gl.uniform3f(U.uCanvas, 1, 1, 0);
    if (U.uShoreR) gl.uniform3f(U.uShoreR, 0, 0, 0);
    if (U.uGAOR) gl.uniform3f(U.uGAOR, 0, 0, 0);
    if (U.uOrg) gl.uniform3f(U.uOrg, R[0], sc.roomFloor || 0, R[1]);
    if (U.uHole) gl.uniform4f(U.uHole, 0, 0, 0, 0);
    gl.bindVertexArray(RT.mesh.vao);
    gl.drawElements(gl.TRIANGLES, RT.mesh.n, gl.UNSIGNED_INT, 0);
  }
  gl.bindVertexArray(null);
}
/* phase 08b: a room over its place (seamless-world.js seamlessRoomMap). The place's ground stays as it is (its picture,
   its mesh and its near ring are the place's own, nothing is made again); where the room stands it leaves a hole
   (roomHole: ground, grass, water, their shadows), and the room's floor and walls, a small ground of their own built
   from the room alone (sc.roomScene, in the room's own metres), are drawn there at the floor's height */
function roomHole(sc) {
  const R = sc && sc.roomScene && sc.roomRect;
  return R ? [R[0], R[1], R[0] + R[2], R[1] + R[3]] : [0, 0, 0, 0];
}
function roomFloorOf(sc) {
  const RS = sc && sc.roomScene,
    T = RS && walkRenderer.roomFloors && walkRenderer.roomFloors.get(RS.id);
  return T && T.mesh ? T : null;
}
/* the ground and its walls into a depth map (the shadowG program in use): the place's with its hole, then the room's */
function drawGroundDepth(p, sc) {
  const gl = gpuState.gl;
  if (p.U.uOrg) gl.uniform3f(p.U.uOrg, 0, 0, 0);
  if (p.U.uHole) gl.uniform4fv(p.U.uHole, roomHole(sc));
  gl.bindVertexArray(walkRenderer.mesh.vao);
  gl.drawElements(gl.TRIANGLES, walkRenderer.mesh.n, gl.UNSIGNED_INT, 0);
  const RT = roomFloorOf(sc);
  if (RT) {
    const R = sc.roomRect;
    if (p.U.uOrg) gl.uniform3f(p.U.uOrg, R[0], sc.roomFloor || 0, R[1]);
    if (p.U.uHole) gl.uniform4f(p.U.uHole, 0, 0, 0, 0);
    gl.bindVertexArray(RT.mesh.vao);
    gl.drawElements(gl.TRIANGLES, RT.mesh.n, gl.UNSIGNED_INT, 0);
  }
  gl.bindVertexArray(null);
}
/* is the room's floor ready to show? If not, get it ready: its picture painted (at the near ring's size: it is seen up
   close), then its mesh built on the card (a room is small: at once). Rooms you were in lately are kept (three) */
const ROOM_FLOORS_KEPT = 3;
export function roomFloorReady(RS, pr = -5, now = false) {
  if (!RS || !walkRenderer.on || !gpuState.gl) return false;
  const M = walkRenderer.roomFloors || (walkRenderer.roomFloors = new Map());
  if (M.has(RS.id)) return true;
  const TP = bigTilesOn() ? 32 : 16,
    key = groundKey(RS) + '|' + TP,
    P = GROUND_BORDER_M;
  let G = ROOM_PICTURES.get(key);
  if (!G && now) {
    /* you've stood at the door a while (the helper is busy): painted here, now (a room is small) */
    const it = paintGroundSteps(RS, { TP, rect: [P, P, RS.w, RS.h], margin: 0 });
    let r = it.next();
    while (!r.done) r = it.next();
    G = { width: r.value.w, height: r.value.h, _px: new Uint8Array(r.value.px.buffer), _nrm: r.value.nrm };
    ROOM_PICTURES.set(key, G);
  }
  if (!G) {
    if (!ROOM_PICTURES_PENDING.has(key)) {
      const p = paintRoomFloor(RS, TP, pr)
        .then(g => {
          ROOM_PICTURES.set(key, g);
          while (ROOM_PICTURES.size > ROOM_FLOORS_KEPT) ROOM_PICTURES.delete(ROOM_PICTURES.keys().next().value);
        })
        .catch(e => {
          if (typeof debugLog !== 'undefined') debugLog.add('webgl', 'room floor: ' + ((e && e.message) || e));
        })
        .finally(() => ROOM_PICTURES_PENDING.delete(key));
      ROOM_PICTURES_PENDING.set(key, p);
    }
    return false;
  }
  const T = {},
    it = buildGroundMeshSteps(RS, G, T, true);
  let r = it.next();
  while (!r.done) r = it.next();
  M.set(RS.id, T);
  while (M.size > ROOM_FLOORS_KEPT) {
    const k0 = M.keys().next().value;
    freeMapCacheEntry(M.get(k0));
    M.delete(k0);
  }
  return true;
}
const ROOM_PICTURES = new Map(),
  ROOM_PICTURES_PENDING = new Map();
async function paintRoomFloor(RS, TP, pr) {
  const P = GROUND_BORDER_M,
    it =
      typeof paintGroundRect === 'function'
        ? paintGroundRect(RS, { TP, rect: [P, P, RS.w, RS.h], margin: 0, pr })
        : paintGroundSteps(RS, { TP, rect: [P, P, RS.w, RS.h], margin: 0 });
  let r,
    t0 = performance.now();
  for (;;) {
    r = it.next();
    if (r.done) break;
    if (r.value === PAINT_WORKER_WAIT) {
      await waitForPaintWorker();
      t0 = performance.now();
      continue;
    }
    if (performance.now() - t0 > 8) {
      await new Promise(res => setTimeout(res, 0));
      t0 = performance.now();
    }
  }
  const g = { width: r.value.w, height: r.value.h, _px: new Uint8Array(r.value.px.buffer) };
  g._nrm = r.value.nrm;
  return g;
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
  if (U.uHole) gl.uniform4fv(U.uHole, roomHole(sc));
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
  /* 0.1.0 alpha: a blade takes the colour of the ground at its root: the ground's picture and the near ring */
  if (U.uGround) {
    const B = GROUND_BORDER_M;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, walkRenderer.gtex || gpuState.white);
    gl.uniform1i(U.uGround, 0);
    gl.uniform4f(U.uGRect, -B, sc.h + B, 1 / (sc.w + 2 * B), 1 / (sc.h + 2 * B));
  }
  setNearRingUniforms(U, sc);
  gl.disable(gl.CULL_FACE);
  const G = walkRenderer.grass;
  gl.bindVertexArray(G.vao);
  if (!G.chunks || !(engineSetting('quality', 'cull') ?? true)) {
    gl.bindBuffer(gl.ARRAY_BUFFER, G.ib);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, G.n);
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
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, c.n);
      drawn += c.n;
    }
    walkRenderer.grassDrawn = drawn;
  }
  gl.bindVertexArray(null);
}
