// @ts-check
'use strict';
/* ================= HUB ISLAND EDITOR (island track IS-6a) =================
   The logic of the Studio's Hub island section (studio/js/hub-island.js): the hub is an island, never a run node; it
   is shaped by hand (and by dials, IS-6b), then its ground is locked (logic/island.js islandGroundHash).
     - the orbit view: a free camera (logic/free-camera.js) that looks at the island's middle, framed to hold the whole
       island, turned round it by a drag, auto-orbit or a snap to a side
     - the coast's and the zones' points: move, insert on the nearest edge, remove (never under three)
     - the lock: lock and unlock the ground, and the words a ground tool says when it is refused
     - the dials (IS-6b): where they start (the map's own islandGen), why the island can't be made again, "Use this
       island" (the generator's ground onto the map, its props, people and look kept), the walking checks on a draft
   Positions are the scene's metres: x across, z depth (z grows northward, from the near south edge). Yaw 0 looks
   along +z, so the camera stands south of what it looks at. Logic only: no DOM, runs in Node
   (tools/test/hub-island.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { mapgenReach, mapgenReached, mapgenTraps } from './mapgen.js';
import { islandPointIn } from './island.js';
import { FREE_CAM } from './free-camera.js';
/* eslint-disable no-func-assign */
expose({
  HUB_GEN_GROUND: [() => HUB_GEN_GROUND],
  HUB_SIDES: [() => HUB_SIDES],
  HUB_VIEW: [() => HUB_VIEW],
  // @ts-expect-error -- replaced on purpose
  groundLockRefusal: [() => groundLockRefusal, v => (groundLockRefusal = v)],
  // @ts-expect-error -- replaced on purpose
  hubCoastLap: [() => hubCoastLap, v => (hubCoastLap = v)],
  hubCopy: [() => hubCopy],
  // @ts-expect-error -- replaced on purpose
  hubDefaultMap: [() => hubDefaultMap, v => (hubDefaultMap = v)],
  // @ts-expect-error -- replaced on purpose
  hubEdgeDistance: [() => hubEdgeDistance, v => (hubEdgeDistance = v)],
  // @ts-expect-error -- replaced on purpose
  hubGenRefusal: [() => hubGenRefusal, v => (hubGenRefusal = v)],
  // @ts-expect-error -- replaced on purpose
  hubGenStart: [() => hubGenStart, v => (hubGenStart = v)],
  // @ts-expect-error -- replaced on purpose
  hubGenStats: [() => hubGenStats, v => (hubGenStats = v)],
  // @ts-expect-error -- replaced on purpose
  hubGenWalkProblems: [() => hubGenWalkProblems, v => (hubGenWalkProblems = v)],
  hubGroundLocked: [() => hubGroundLocked],
  // @ts-expect-error -- replaced on purpose
  hubInsertPoint: [() => hubInsertPoint, v => (hubInsertPoint = v)],
  // @ts-expect-error -- replaced on purpose
  hubIslandCentre: [() => hubIslandCentre, v => (hubIslandCentre = v)],
  // @ts-expect-error -- replaced on purpose
  hubIslandMaps: [() => hubIslandMaps, v => (hubIslandMaps = v)],
  // @ts-expect-error -- replaced on purpose
  hubIslandRadius: [() => hubIslandRadius, v => (hubIslandRadius = v)],
  // @ts-expect-error -- replaced on purpose
  hubLockGround: [() => hubLockGround, v => (hubLockGround = v)],
  // @ts-expect-error -- replaced on purpose
  hubMovePoint: [() => hubMovePoint, v => (hubMovePoint = v)],
  // @ts-expect-error -- replaced on purpose
  hubNearestPoint: [() => hubNearestPoint, v => (hubNearestPoint = v)],
  // @ts-expect-error -- replaced on purpose
  hubRemovePoint: [() => hubRemovePoint, v => (hubRemovePoint = v)],
  // @ts-expect-error -- replaced on purpose
  hubSideOf: [() => hubSideOf, v => (hubSideOf = v)],
  // @ts-expect-error -- replaced on purpose
  hubUnlockGround: [() => hubUnlockGround, v => (hubUnlockGround = v)],
  // @ts-expect-error -- replaced on purpose
  hubUseIsland: [() => hubUseIsland, v => (hubUseIsland = v)],
  // @ts-expect-error -- replaced on purpose
  hubViewDrag: [() => hubViewDrag, v => (hubViewDrag = v)],
  // @ts-expect-error -- replaced on purpose
  hubViewFrame: [() => hubViewFrame, v => (hubViewFrame = v)],
  // @ts-expect-error -- replaced on purpose
  hubViewOnlyReason: [() => hubViewOnlyReason, v => (hubViewOnlyReason = v)],
  // @ts-expect-error -- replaced on purpose
  hubYawNear: [() => hubYawNear, v => (hubYawNear = v)],
  // @ts-expect-error -- replaced on purpose
  hubZoneSquare: [() => hubZoneSquare, v => (hubZoneSquare = v)],
  toCm: [() => toCm],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @typedef {[number, number]} XZ */
/** @typedef {{ tgt: [number, number, number], yaw: number, pitch: number, dist: number }} FreeCam */

/** the orbit view's side buttons: the yaw that puts the camera on that side, looking across the island */
export const HUB_SIDES = { S: 0, W: Math.PI / 2, N: Math.PI, E: -Math.PI / 2 };
/** the orbit view: its tilt (degrees), how much past the island's radius it frames, auto-orbit (radians a second),
 * a drag's turn and tilt per pixel (FREE_CAM's field of view and limits apply) */
export const HUB_VIEW = { pitch: 38, margin: 1.15, spin: 0.25, turnPx: 0.006, tiltPx: 0.25 };

export const toCm = (/** @type {number} */ v) => Math.round(v * 100) / 100;

/** the island's middle: island.c, else the orbit's pivot, else the scene's middle
 * @param {any} sc @returns {XZ} */
export function hubIslandCentre(sc) {
  const c = (sc.island && sc.island.c) || (sc.cam && sc.cam.orbit && sc.cam.orbit.c);
  return Array.isArray(c) ? [c[0], c[1]] : [sc.w / 2, sc.h / 2];
}

/** how far the island reaches from its middle: the furthest coast point, else half the scene's diagonal
 * @param {any} sc @returns {number} */
export function hubIslandRadius(sc) {
  const [cx, cz] = hubIslandCentre(sc),
    L = sc.island && Array.isArray(sc.island.coast) ? sc.island.coast : null;
  if (!L || !L.length) return Math.hypot(sc.w, sc.h) / 2;
  return Math.max(...L.map((/** @type {XZ} */ p) => Math.hypot(p[0] - cx, p[1] - cz)));
}

/** the orbit view's first camera: the island's middle, from the south, far enough to hold the whole island
 * @param {any} sc @param {number} [y] the ground's height at the middle @param {number} [distMax]
 * @returns {FreeCam} */
export function hubViewFrame(sc, y = 0, distMax = FREE_CAM.distMax) {
  const [cx, cz] = hubIslandCentre(sc),
    half = (FREE_CAM.fov * Math.PI) / 360,
    dist = Math.min(distMax, (hubIslandRadius(sc) * HUB_VIEW.margin) / Math.tan(half));
  return { tgt: [cx, y, cz], yaw: HUB_SIDES.S, pitch: HUB_VIEW.pitch, dist: toCm(Math.max(10, dist)) };
}

/** a yaw the short way round from `from` (so a snap or a glide never spins a full turn)
 * @param {number} from @param {number} to */
export function hubYawNear(from, to) {
  let d = to - from;
  d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
  return from + d;
}

/** which side the camera is on, for the side buttons: 'S', 'W', 'N' or 'E' @param {number} yaw */
export function hubSideOf(yaw) {
  const a = (((yaw / (Math.PI / 2)) % 4) + 4) % 4;
  return /** @type {'S' | 'W' | 'N' | 'E'} */ (['S', 'W', 'N', 'E'][Math.round(a) % 4]);
}

/** a drag on the orbit view: turns round the middle, or tilts with Shift @param {FreeCam} s @param {number} dx
 * @param {number} dy pixels @param {boolean} tilt @param {{ pitchMin: number, pitchMax: number }} lim */
export function hubViewDrag(s, dx, dy, tilt, lim) {
  if (tilt) s.pitch = Math.min(lim.pitchMax, Math.max(lim.pitchMin, s.pitch + dy * HUB_VIEW.tiltPx));
  else s.yaw -= dx * HUB_VIEW.turnPx;
  return s;
}

/** the nearest point within `maxD` metres, or -1 @param {XZ[]} poly @param {number} x @param {number} z
 * @param {number} maxD */
export function hubNearestPoint(poly, x, z, maxD) {
  let n = -1,
    best = maxD;
  (poly || []).forEach((p, k) => {
    const d = Math.hypot(p[0] - x, p[1] - z);
    if (d <= best) {
      best = d;
      n = k;
    }
  });
  return n;
}

/** how far (x, z) is from the closed polygon's edge k (from point k to the next) @param {XZ[]} poly
 * @param {number} k @param {number} x @param {number} z */
export function hubEdgeDistance(poly, k, x, z) {
  const a = poly[k],
    b = poly[(k + 1) % poly.length],
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = dx * dx + dz * dz || 1,
    t = Math.min(1, Math.max(0, ((x - a[0]) * dx + (z - a[1]) * dz) / L));
  return Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z);
}

/** puts a new point on the closed polygon's nearest edge when it is within `maxD` metres; its index, or -1
 * @param {XZ[]} poly @param {number} x @param {number} z @param {number} maxD */
export function hubInsertPoint(poly, x, z, maxD) {
  let k0 = -1,
    best = maxD;
  for (let k = 0; k < poly.length; k++) {
    const d = hubEdgeDistance(poly, k, x, z);
    if (d <= best) {
      best = d;
      k0 = k;
    }
  }
  if (k0 < 0) return -1;
  poly.splice(k0 + 1, 0, [toCm(x), toCm(z)]);
  return k0 + 1;
}

/** takes a point away; a polygon keeps at least three @param {XZ[]} poly @param {number} n @returns {boolean} */
export function hubRemovePoint(poly, n) {
  if (poly.length <= 3 || n < 0 || n >= poly.length) return false;
  poly.splice(n, 1);
  return true;
}

/** moves a point, kept on the scene and rounded to centimetres @param {XZ[]} poly @param {number} n
 * @param {number} x @param {number} z @param {{ w: number, h: number }} sc */
export function hubMovePoint(poly, n, x, z, sc) {
  poly[n] = [toCm(Math.min(sc.w, Math.max(0, x))), toCm(Math.min(sc.h, Math.max(0, z)))];
  return poly[n];
}

/** a new zone's outline: a square `size` metres across round (x, z), kept on the scene
 * @param {number} x @param {number} z @param {number} size @param {{ w: number, h: number }} sc @returns {XZ[]} */
export function hubZoneSquare(x, z, size, sc) {
  const h = size / 2,
    cx = Math.min(sc.w - h, Math.max(h, x)),
    cz = Math.min(sc.h - h, Math.max(h, z));
  return [
    [toCm(cx - h), toCm(cz - h)],
    [toCm(cx + h), toCm(cz - h)],
    [toCm(cx + h), toCm(cz + h)],
    [toCm(cx - h), toCm(cz + h)],
  ];
}

/** whether the map's ground is locked @param {any} sc */
export const hubGroundLocked = sc => !!(sc && sc.islandGen && sc.islandGen.lock);

/** locks the ground: islandGen.lock and the hash of the ground as it is (an islandGen is made when there is none)
 * @param {any} sc @param {(sc: any) => string} groundHash logic/island.js islandGroundHash */
export function hubLockGround(sc, groundHash) {
  const G = sc.islandGen || (sc.islandGen = { v: 0, seed: '' });
  G.lock = true;
  G.hash = groundHash(sc);
  return G.hash;
}

/** unlocks it: the lock and the hash go (the generator's version, seed and dials stay) @param {any} sc */
export function hubUnlockGround(sc) {
  if (!sc.islandGen) return;
  delete sc.islandGen.lock;
  delete sc.islandGen.hash;
}

/** why a ground tool can't change this map, in words, or '' (the Hub island editor's and Walk scenes' ground tools,
 * Resize and Flatten all ask) @param {any} sc */
export function groundLockRefusal(sc) {
  return hubGroundLocked(sc)
    ? "This island's ground is locked: unlock it in the Studio's Hub island section first. Props stay free."
    : '';
}

/** why the Hub island editor only shows a map, or '': a map with no island (no coast) yet (Copperleaf is one since
 * IS-5) @param {any} sc */
export function hubViewOnlyReason(sc) {
  return sc && sc.island && Array.isArray(sc.island.coast)
    ? ''
    : 'Not an island yet (no coast): shown here, not edited.';
}

/** the maps the editor lists: the hub (copperleaf) first, then every map with an island, by id
 * @param {Record<string, any>} maps @returns {string[]} */
export function hubIslandMaps(maps) {
  const L = Object.keys(maps || {})
    .filter(k => k !== 'copperleaf' && maps[k] && maps[k].island)
    .sort();
  return (maps && maps.copperleaf ? ['copperleaf'] : []).concat(L);
}

/** the map it opens on: the first one that can be edited, else the first @param {Record<string, any>} maps */
export function hubDefaultMap(maps) {
  const L = hubIslandMaps(maps);
  return L.find(k => !hubViewOnlyReason(maps[k])) || L[0] || null;
}

/** "Walk the coast": a lap round the island `inset` metres in from its coast, from the southernmost point (where the
 * town is and the camera first looks) round and back to it; [] with no coast
 * @param {any} sc @param {number} [inset] @returns {XZ[]} */
export function hubCoastLap(sc, inset = 6) {
  const L = sc.island && Array.isArray(sc.island.coast) ? sc.island.coast : [];
  if (L.length < 3) return [];
  const [cx, cz] = hubIslandCentre(sc),
    P = L.map((/** @type {XZ} */ p) => {
      const d = Math.hypot(p[0] - cx, p[1] - cz) || 1,
        k = Math.max(0, d - inset) / d;
      return /** @type {XZ} */ ([toCm(cx + (p[0] - cx) * k), toCm(cz + (p[1] - cz) * k)]);
    });
  let s = 0;
  P.forEach((p, k) => {
    if (p[1] < P[s][1]) s = k;
  });
  const lap = P.slice(s).concat(P.slice(0, s));
  lap.push(lap[0].slice());
  return lap;
}

/* ================= the generator's dials (IS-6b) ================= */
/** the fields "Use this island" takes from the generator: the ground and the island's contract. Everything else on
 * the map stays: props, people, life, exits, the look, the in-game checks. The orbit's pivot follows the new
 * mountain; its dead zone, lag and turn stay as tuned. */
export const HUB_GEN_GROUND = [
  'w',
  'h',
  'edge',
  'waterKind',
  'far',
  'farH',
  'flatFar',
  'island',
  'zones',
  'islandGen',
  'hub',
  'tiles',
  'heights',
  'plots',
  'streams',
  'bridges',
  'spots',
  'steps',
  'stepm',
];

/** a copy of map data (JSON) @param {any} v */
export const hubCopy = v => JSON.parse(JSON.stringify(v));

/** the dials and seed the editor starts from: the map's own (so the island it was made with comes back), else the
 * generator's defaults and the map's id as the seed @param {any} sc @param {string} id */
export function hubGenStart(sc, id) {
  const G = (sc && sc.islandGen) || {};
  return {
    dials: G.dials && typeof G.dials === 'object' ? hubCopy(G.dials) : {},
    seed: G.seed ? String(G.seed) : String(id || 'island'),
  };
}

/** why the island can't be made again from the dials, or '': a map with no coast yet, or a locked ground
 * @param {any} sc */
export function hubGenRefusal(sc) {
  if (hubViewOnlyReason(sc)) return hubViewOnlyReason(sc);
  return hubGroundLocked(sc)
    ? 'The ground is locked: unlock it (Ground lock) to make the island again. The dials only show how it was made.'
    : '';
}

/** "Use this island": the generator's ground onto the map (HUB_GEN_GROUND, copied), its locked zones as the
 * generator kept them. Throws when hubGenRefusal says no. Returns the props now out at sea (past the new coast), left
 * where they are. @param {any} sc @param {any} scene islandGenerate's scene, made with sc as prev */
export function hubUseIsland(sc, scene) {
  const why = hubGenRefusal(sc);
  if (why) throw new Error(why);
  for (const k of HUB_GEN_GROUND)
    if (scene[k] !== undefined) sc[k] = hubCopy(scene[k]);
    else delete sc[k];
  const O = scene.cam && scene.cam.orbit;
  if (O) {
    sc.cam = sc.cam || {};
    sc.cam.orbit = sc.cam.orbit ? { ...sc.cam.orbit, c: O.c.slice() } : hubCopy(O);
  }
  const coast = sc.island.coast;
  return {
    wet: (Array.isArray(sc.props) ? sc.props : []).filter(
      (/** @type {any} */ p) => p && typeof p.x === 'number' && !islandPointIn(coast, p.x, p.z)
    ),
  };
}

/** the walking checks on a draft (IS-2: a rerun under a new seed can meet a kept town at another place): from the
 * hub, every zone, the summit, the dock and every plot's front (not the well's, a plot you stand round) can be
 * walked to, and nowhere you can walk to leaves you stuck. Problems in words, [] when it walks.
 * @param {any} sc @param {any} scenery { terrains, props } */
export function hubGenWalkProblems(sc, scenery) {
  if (!sc.hub || !Array.isArray(sc.tiles)) return ['no hub to walk from'];
  const out = [],
    R = mapgenReach(sc, scenery, sc.hub, { slope: true });
  for (const Z of Array.isArray(sc.zones) ? sc.zones : []) {
    if (!Array.isArray(Z.poly)) continue;
    let ok = false;
    for (let j = 0; j < R.gh && !ok; j++)
      for (let i = 0; i < R.gw && !ok; i++)
        ok = !!R.seen[j * R.gw + i] && islandPointIn(Z.poly, (i + 0.5) / R.N, (j + 0.5) / R.N);
    if (!ok) out.push(`the ${Z.k} zone can't be walked to`);
  }
  for (const S of Array.isArray(sc.spots) ? sc.spots : [])
    if ((S.kind === 'summit' || S.kind === 'dock') && !mapgenReached(R, S.x, S.z))
      out.push(`the ${S.kind} can't be walked to`);
  for (const L of Array.isArray(sc.plots) ? sc.plots : []) {
    const a = (L.a * Math.PI) / 180;
    if (L.k !== 'well' && !mapgenReached(R, L.x + Math.cos(a) * (L.d / 2 + 0.9), L.z + Math.sin(a) * (L.d / 2 + 0.9)))
      out.push(`the ${L.k} plot at (${L.x}, ${L.z}) can't be walked to`);
  }
  const T = mapgenTraps(sc, scenery);
  if (T.n) out.push(`${T.n} spots you can walk to but not back from, first (${T.at[0]})`);
  return out;
}

/** a draft's figures for the dials card: its size, the land's, the coast walk's length and time, the plots
 * @param {any} sc */
export function hubGenStats(sc) {
  const C = (sc.island && sc.island.coast) || [];
  let x0 = Infinity,
    x1 = -Infinity,
    z0 = Infinity,
    z1 = -Infinity;
  for (const [x, z] of C) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
  }
  const lap = hubCoastLap(sc);
  let m = 0;
  for (let k = 1; k < lap.length; k++) m += Math.hypot(lap[k][0] - lap[k - 1][0], lap[k][1] - lap[k - 1][1]);
  const plots = /** @type {Record<string, number>} */ ({});
  for (const L of Array.isArray(sc.plots) ? sc.plots : []) plots[L.k] = (plots[L.k] || 0) + 1;
  return {
    w: sc.w,
    h: sc.h,
    land: C.length ? [Math.round(x1 - x0), Math.round(z1 - z0)] : [0, 0],
    lap: Math.round(m),
    /* walk-view.js's walking speed, 3.4 m/s */
    lapS: Math.round(m / 3.4),
    plots,
  };
}
