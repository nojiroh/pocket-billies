// @ts-check
'use strict';
/* ================= ISLAND GENERATOR (island track IS-2) =================
   A whole island's ground from dials and a seed, in the game's scene format, with the island contract's fields
   (logic/island.js: island, zones, cam.orbit, islandGen). Built reusable (the owner, question 10): nothing in it is
   Copperleaf's; the town, barn and pasture are zones placed by dials, and the Studio's Hub island editor (IS-6b) calls
   it with its dials. Logic only: no DOM, no Math.random, runs in Node (tools/build-island.mjs, tools/test).
   - The same dials and seed give the same island. Each stage draws from its own stream (rngFrom(seed, stage)) and
     noise salt, so a stage can be rerolled alone (dials.seeds[stage]).
   - The stages, in order: coast (a radius with noise, pushed out round the zones, the cove cut in), heights (beaches,
     hills, foot hills, cliffs, the zones flat), mountain (a quarter smooth land, the rest step-grid shelves as TR-2's
     mountains), water (the sea, the pond at the mountain's foot, the stream to the cove with a small fall, the cove's
     deep channel to the dock), paths (one loop round the coast, spokes to the zones, the mountain and the dock;
     bridges where they cross water), trail (TR-2b's switchback search and carving, to a summit lookout), ground (the
     terrain kinds by height, slope, wetness, arc and zone), zones (town, barn and pasture flat, empty and locked;
     mountain, forest, cove, beaches).
   - A locked ground is never made again: islandGenerate throws when prev.islandGen.lock is set. With a previous map,
     its locked zones keep their polygons, ground letters, heights and steps exactly (and the scene its size and middle).
   - mapgen's helpers are used read-only (its working state, the trail search and carving, the stream painter, the
     road flattening, the water lowering); logic/mapgen.js is not changed.
   Coordinates are the game's: metres, x east, z north from the near (south) edge. Angles in degrees: 0 east, 90 north,
   180 west, 270 south (the town's side: the camera first looks north at it). */
/** @import { Biome } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { hashString, rngFrom } from './rng.js';
import {
  mapgenBetween,
  mapgenCarveTrail,
  mapgenCellAt,
  mapgenDecodeBase64,
  mapgenEncodeBase64,
  mapgenFbm,
  mapgenFlattenRoads,
  mapgenLowerWater,
  mapgenMergeDefaults,
  mapgenNewWork,
  mapgenNoise,
  mapgenPaintStream,
  mapgenResample,
  mapgenRidged,
  mapgenRockEdges,
  mapgenRound2,
  mapgenSmooth,
  mapgenSteepAt,
  mapgenTrailSearch,
} from './mapgen.js';
import { islandPointIn } from './island.js';
/* eslint-disable no-func-assign */
expose({
  ISLAND_BIOME: [() => ISLAND_BIOME],
  ISLAND_GEN_BUILT: [() => ISLAND_GEN_BUILT],
  ISLAND_GEN_DEFAULTS: [() => ISLAND_GEN_DEFAULTS],
  ISLAND_GEN_STAGES: [() => ISLAND_GEN_STAGES],
  ISLAND_GEN_VERSION: [() => ISLAND_GEN_VERSION],
  ISLAND_RAD: [() => ISLAND_RAD],
  islandAngle: [() => islandAngle],
  islandAngleDiff: [() => islandAngleDiff],
  // @ts-expect-error -- replaced on purpose
  islandArcWeight: [() => islandArcWeight, v => (islandArcWeight = v)],
  // @ts-expect-error -- replaced on purpose
  islandDecodeGround: [() => islandDecodeGround, v => (islandDecodeGround = v)],
  // @ts-expect-error -- replaced on purpose
  islandGenDials: [() => islandGenDials, v => (islandGenDials = v)],
  // @ts-expect-error -- replaced on purpose
  islandGenerate: [() => islandGenerate, v => (islandGenerate = v)],
  // @ts-expect-error -- replaced on purpose
  islandPolyDense: [() => islandPolyDense, v => (islandPolyDense = v)],
  // @ts-expect-error -- replaced on purpose
  islandPolyDist: [() => islandPolyDist, v => (islandPolyDist = v)],
  islandRound2pt: [() => islandRound2pt],
  // @ts-expect-error -- replaced on purpose
  islandZoneRect: [() => islandZoneRect, v => (islandZoneRect = v)],
  // @ts-expect-error -- replaced on purpose
  islandZoneShape: [() => islandZoneShape, v => (islandZoneShape = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* 1: IS-2's first island; 2: a natural layout (the owner: more natural and dynamic): rounded zones, headlands and
   bays, a ridged massif with a shoulder, wandering shelves, curved paths, groves, outcrops and wet ground */
export const ISLAND_GEN_VERSION = 2;
export const ISLAND_GEN_STAGES = ['coast', 'heights', 'mountain', 'water', 'paths', 'trail', 'ground'];
/* the zones a dial places as a rectangle (flat, empty and locked: the town and the barn are built there by hand) */
export const ISLAND_GEN_BUILT = ['town', 'barn', 'pasture'];

/** the dials (IS-6b shows them): sizes in metres, angles in degrees (0 east, 90 north, 270 south) */
export const ISLAND_GEN_DEFAULTS = {
  /* the land's radius round the middle (the coast is pushed out further round the zones), how much the coast wobbles
     (0-1), the open sea between the coast and the scene's edge, how long the island is (0-1: up to 1.3 times its
     width), its big lobes and a peninsula (0-1) */
  size: { r: 68, wobble: 0.35, sea: 10, stretch: 0.3, lobes: 0.6 },
  /* how natural every shape is (0-1): 0 is plain geometry (round coast, rectangles, a cone, straight spokes); up from
     there headlands and bays, rounded uneven zones, a warped massif, wandering shelves and paths, ragged ground */
  organic: 0.7,
  /* the mountain in the middle: the radius of its foot, its peak, how tall its shelves are (0-1: 0.8-2 m, the cliffs),
     how long it runs along its ridge (0-1: up to 1.45 times its width), a shoulder peak along the ridge (0-1 of the
     peak's height, times 0.6), a range of lower peaks and ridges round it (0-1: 2 to 6 of them, a third to a half of
     its height), kept away from the biggest zone and the cove */
  mountain: { r: 22, peak: 22, cliffs: 0.5, stretch: 0.5, shoulder: 0.6, range: 0.6 },
  /* rolling land (0-1: up to 1.6 m) and the foot hills round the mountain */
  hills: 0.4,
  /* the cove: cut into the coast; its middle's angle, its width in degrees, its depth, the deep channel from the dock
     out to the open sea (0 for none), its inner beach's width, its shape ('bay' wide and rounded, 'cove' a horseshoe
     with steep sides) */
  cove: { on: 1, a: 0, span: 70, depth: 22, channel: 6, beach: 7, shape: 'bay' },
  /* the beach's width where no beach arc is (the narrow shore) and the long beaches (an angle, a width in degrees) */
  shore: 3,
  beaches: [{ a: 180, span: 80, w: 11 }],
  /* cliffs along the coast: angle, width in degrees, height */
  cliffs: [
    { a: 33, span: 20, h: 5 },
    { a: 330, span: 16, h: 4 },
  ],
  /* dunes behind the sand and heath inland: angle, width in degrees */
  dunes: { a: 312, span: 34 },
  heath: { a: 300, span: 56 },
  /* the forest belt round the mountain's foot: angle, width in degrees, how deep it runs from the foot, density 0-1 */
  forest: { a: 95, span: 156, deep: 26, density: 0.75 },
  /* the stream from a pond at the mountain's foot down to the cove (a small fall where it leaves the pond) */
  stream: { on: 1, pond: 4, fall: 0.8 },
  /* the paths: the loop round the coast and its spokes; how far inland from the beach the loop runs at least, how
     freely it wanders (0-1: inland by up to 14 m, across headlands rather than round them) */
  paths: { width: 2.2, inland: 3, wander: 0.6 },
  /* the flat zones: kind, angle and distance of the middle from the island's middle, width (across) and depth (toward
     the middle), the height they lie at */
  zones: [
    { k: 'town', a: 270, d: 47, w: 64, h: 40 },
    { k: 'barn', a: 212, d: 56, w: 18, h: 16 },
    { k: 'pasture', a: 182, d: 60, w: 26, h: 22 },
  ],
  level: 1.2,
  /* a stage's own seed (rerolls that stage alone), by stage name */
  seeds: {},
};

/* the island's own ground for mapgen's working state (the stream's bank, the rock at a shelf's top) */
/** @type {any} */
export const ISLAND_BIOME = {
  name: 'Island',
  ground: { base: 'G', patches: {}, verge: 'u', floor: 'y', bank: 'P', rock: 'r', tall: 't' },
};

/* ---------- small helpers ---------- */
export const ISLAND_RAD = Math.PI / 180;
/** an angle in degrees in [0, 360) */
export const islandAngle = a => ((a % 360) + 360) % 360;
/** the signed difference b - a in degrees, in (-180, 180] */
export const islandAngleDiff = (a, b) => {
  const d = islandAngle(b - a);
  return d > 180 ? d - 360 : d;
};
/** how much angle t lies in an arc (its middle a, its width span): 1 in the middle, easing to 0 over its outer quarter */
export function islandArcWeight(t, a, span) {
  const d = Math.abs(islandAngleDiff(a, t)),
    half = span / 2,
    soft = Math.max(1, span * 0.25);
  if (d >= half) return 0;
  if (d <= half - soft) return 1;
  return mapgenSmooth((half - d) / soft);
}
/* the distance from a point to a closed polygon's sides (0 inside) */
export function islandPolyDist(poly, x, z, cut = Infinity) {
  if (cut < Infinity) {
    let x0 = 1e9,
      z0 = 1e9,
      x1 = -1e9,
      z1 = -1e9;
    const bb =
      poly.bb ||
      (poly.bb = poly.reduce(
        (b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])],
        [x0, z0, x1, z1]
      ));
    if (x < bb[0] - cut || z < bb[1] - cut || x > bb[2] + cut || z > bb[3] + cut) return cut;
  }
  if (islandPointIn(poly, x, z)) return 0;
  let best = 1e9;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j],
      [bx, bz] = poly[i],
      dx = bx - ax,
      dz = bz - az,
      L2 = dx * dx + dz * dz || 1e-9,
      t = mapgenBetween(((x - ax) * dx + (z - az) * dz) / L2, 0, 1);
    best = Math.min(best, Math.hypot(ax + dx * t - x, az + dz * t - z));
  }
  return best;
}
/* a polygon's points every metre along its sides */
export function islandPolyDense(poly) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}
export const islandRound2pt = p => [mapgenRound2(p[0]), mapgenRound2(p[1])];

/** the dials filled in from the defaults and kept in range (a copy) */
export function islandGenDials(d) {
  const D = mapgenMergeDefaults(ISLAND_GEN_DEFAULTS, d || {}),
    num = (v, lo, hi, def) => (typeof v === 'number' && Number.isFinite(v) ? mapgenBetween(v, lo, hi) : def);
  D.size.r = num(D.size.r, 20, 120, 68);
  D.size.wobble = num(D.size.wobble, 0, 1, 0.35);
  D.size.sea = num(D.size.sea, 4, 40, 10);
  D.size.stretch = num(D.size.stretch, 0, 1, 0.3);
  D.size.lobes = num(D.size.lobes, 0, 1, 0.6);
  D.mountain.r = num(D.mountain.r, 0, D.size.r * 0.6, 22);
  D.mountain.peak = num(D.mountain.peak, 0, 40, 22);
  D.mountain.cliffs = num(D.mountain.cliffs, 0, 1, 0.5);
  D.mountain.stretch = num(D.mountain.stretch, 0, 1, 0.5);
  D.mountain.shoulder = num(D.mountain.shoulder, 0, 1, 0.6);
  D.mountain.range = num(D.mountain.range, 0, 1, 0.6);
  D.organic = num(D.organic, 0, 1, 0.7);
  D.hills = num(D.hills, 0, 1, 0.4);
  D.cove.on = D.cove.on ? 1 : 0;
  D.cove.a = islandAngle(num(D.cove.a, -720, 720, 0));
  D.cove.span = num(D.cove.span, 10, 90, 40);
  D.cove.depth = num(D.cove.depth, 4, D.size.r * 0.5, 18);
  D.cove.channel = num(D.cove.channel, 0, 12, 6);
  D.cove.beach = num(D.cove.beach, 0, 16, 7);
  if (D.cove.shape !== 'cove') D.cove.shape = 'bay';
  D.shore = num(D.shore, 1, 10, 3);
  const arcs = (L, w) =>
    (Array.isArray(L) ? L : [])
      .filter(b => b && typeof b === 'object')
      .map(b => ({
        a: islandAngle(num(b.a, -720, 720, 0)),
        span: num(b.span, 4, 180, 30),
        ...(w ? { [w]: num(b[w], 0, w === 'h' ? 20 : 30, w === 'h' ? 4 : 10) } : {}),
      }));
  D.beaches = arcs(D.beaches, 'w');
  D.cliffs = arcs(D.cliffs, 'h');
  for (const k of ['dunes', 'heath', 'forest']) {
    D[k].a = islandAngle(num(D[k].a, -720, 720, 0));
    D[k].span = num(D[k].span, 0, 360, 40);
  }
  D.forest.deep = num(D.forest.deep, 0, 60, 26);
  D.forest.density = num(D.forest.density, 0, 1, 0.75);
  D.stream.on = D.stream.on ? 1 : 0;
  D.stream.pond = num(D.stream.pond, 0, 12, 4);
  D.stream.fall = num(D.stream.fall, 0, 2, 0.8);
  D.paths.width = num(D.paths.width, 1.2, 5, 2.2);
  D.paths.inland = num(D.paths.inland, 0, 12, 3);
  D.paths.wander = num(D.paths.wander, 0, 1, 0.6);
  D.zones = (Array.isArray(D.zones) ? D.zones : [])
    .filter(Z => Z && ISLAND_GEN_BUILT.includes(Z.k))
    .map(Z => ({
      k: Z.k,
      a: islandAngle(num(Z.a, -720, 720, 270)),
      d: num(Z.d, 0, 200, 40),
      w: num(Z.w, 4, 120, 20),
      h: num(Z.h, 4, 120, 20),
    }));
  D.level = num(D.level, 0.3, 6, 1.2);
  if (!D.seeds || typeof D.seeds !== 'object' || Array.isArray(D.seeds)) D.seeds = {};
  for (const k of Object.keys(D.seeds)) if (!ISLAND_GEN_STAGES.includes(k)) delete D.seeds[k];
  return D;
}

/** a flat zone's rectangle from its dial: its middle d metres out at angle a, w across, h deep (toward the middle) */
export function islandZoneRect(c, Z) {
  const ux = Math.cos(Z.a * ISLAND_RAD),
    uz = Math.sin(Z.a * ISLAND_RAD),
    vx = -uz,
    vz = ux,
    mx = c[0] + ux * Z.d,
    mz = c[1] + uz * Z.d,
    hw = Z.w / 2,
    hh = Z.h / 2;
  return [
    [mx - ux * hh - vx * hw, mz - uz * hh - vz * hw],
    [mx - ux * hh + vx * hw, mz - uz * hh + vz * hw],
    [mx + ux * hh + vx * hw, mz + uz * hh + vz * hw],
    [mx + ux * hh - vx * hw, mz + uz * hh - vz * hw],
  ].map(islandRound2pt);
}

/**
 * a flat zone's outline: with organic 0 its rectangle; above that a rounded shape (a superellipse round the rectangle,
 * so the rectangle the dial asks for always fits inside) whose edge bulges out by up to 4 m with noise, turned a few
 * degrees. s: a noise salt
 */
export function islandZoneShape(c, Z, organic, s) {
  if (organic <= 0) return islandZoneRect(c, Z);
  const a = (Z.a + (mapgenNoise(Z.a / 37 + 1.7, 3.1, s) - 0.5) * 14 * organic) * ISLAND_RAD,
    ux = Math.cos(a),
    uz = Math.sin(a),
    vx = -uz,
    vz = ux,
    mx = c[0] + Math.cos(Z.a * ISLAND_RAD) * Z.d,
    mz = c[1] + Math.sin(Z.a * ISLAND_RAD) * Z.d,
    /* a superellipse |x/A|^6 + |y/B|^6 = 1 holds the w x h rectangle when A = w/2 * 2^(1/6) */
    k = Math.pow(2, 1 / 6),
    n = 40,
    out = [];
  for (let m = 0; m < n; m++) {
    const f = (m / n) * Math.PI * 2,
      cf = Math.cos(f),
      sf = Math.sin(f),
      pad = 0.6 + organic * 4 * mapgenFbm(Math.cos(f) * 1.6 + 5, Math.sin(f) * 1.6 + 5, s + 11),
      A = (Z.w / 2) * k + pad,
      B = (Z.h / 2) * k + pad,
      x = A * Math.sign(cf) * Math.pow(Math.abs(cf), 1 / 3),
      y = B * Math.sign(sf) * Math.pow(Math.abs(sf), 1 / 3);
    /* x across (v), y toward the sea (u) */
    out.push([mx + vx * x + ux * y, mz + vz * x + uz * y]);
  }
  return out.map(islandRound2pt);
}

/* a previous map's ground, decoded: tiles (near row first), corner heights, step raise and flags */
export function islandDecodeGround(sc) {
  const { w, h } = sc,
    T = [],
    H = new Float32Array((w + 1) * (h + 1));
  for (let j = 0; j < h; j++) {
    const row = sc.tiles[h - 1 - j] || '';
    for (let i = 0; i < w; i++) T.push(row[i] || sc.edge);
  }
  for (let j = 0; j <= h; j++) {
    const row = (sc.heights || [])[h - j] || [];
    for (let i = 0; i <= w; i++) H[j * (w + 1) + i] = +row[i] || 0;
  }
  let S = /** @type {Int16Array | null} */ (null),
    M = /** @type {Uint8Array | null} */ (null);
  if (sc.steps) {
    const u = mapgenDecodeBase64(sc.steps);
    S = new Int16Array(u.buffer, 0, u.length >> 1);
    if (S.length !== 4 * w * h) S = null;
  }
  if (sc.stepm) {
    M = mapgenDecodeBase64(sc.stepm);
    if (M.length !== 4 * w * h) M = null;
  }
  return { w, h, T, H, S, M };
}

/**
 * an island from its dials and a seed: { scene, notes, paths } (paths: the loop and the spokes as lines, by name). ctx: { scenery } (the game's scenery: terrains, props).
 * prev: the map made before (optional): its locked zones are kept exactly, with its size and middle. Throws when prev's
 * ground is locked (islandGen.lock): a locked ground is never made again.
 * @param {any} dials
 * @param {string | number} seed
 * @param {any} ctx
 * @param {any} prev
 */
export function islandGenerate(dials, seed = 'island', ctx = {}, prev = null) {
  if (prev && prev.islandGen && prev.islandGen.lock)
    throw new Error("the island's ground is locked (unlock it in the Studio's Hub island editor first)");
  const D = islandGenDials(dials),
    SEED = String(seed),
    seedOf = st => (D.seeds[st] != null ? String(D.seeds[st]) : SEED),
    rng = st => rngFrom(seedOf(st), 'island|' + st),
    salt = (st, sub = '') => hashString(`${seedOf(st)}|island|${st}${sub}|noise`) % 100000,
    notes = /** @type {string[]} */ ([]),
    kept = (prev && Array.isArray(prev.zones) ? prev.zones : []).filter(Z => Z && Z.lock && Z.poly);
  const R0 = D.size.r,
    Rf = D.mountain.r;

  /* ---------- the zones' rectangles, round a provisional middle (0, 0); kept zones are placed later ---------- */
  const keptKinds = new Set(kept.map(Z => Z.k));
  const sZone = salt('coast', 'zones'),
    built = D.zones
      .filter(Z => !keptKinds.has(Z.k))
      .map((Z, k) => ({
        k: Z.k,
        Z: { ...Z },
        s: sZone + 97 * k,
        poly: islandZoneShape([0, 0], Z, D.organic, sZone + 97 * k),
      }));
  /* zones whose outlines meet are turned apart round the island, a degree at a time: the biggest (the town) stays,
     any other pair both move, so a zone between two others doesn't bounce back and forth */
  const meets = (A, B) =>
      islandPolyDense(A).some(p => islandPointIn(B, p[0], p[1])) ||
      islandPolyDense(B).some(p => islandPointIn(A, p[0], p[1])),
    sizeOf = B => B.Z.w * B.Z.h,
    biggest = built.reduce((m, B) => (!m || sizeOf(B) > sizeOf(m) ? B : m), /** @type {any} */ (null));
  for (let it = 0; it < 120; it++) {
    let moved = false;
    for (let a = 0; a < built.length; a++)
      for (let b = a + 1; b < built.length; b++) {
        if (!meets(built[a].poly, built[b].poly)) continue;
        const away = islandAngleDiff(built[a].Z.a, built[b].Z.a) >= 0 ? 1 : -1;
        for (const [B, dir] of [
          [built[a], -away],
          [built[b], away],
        ]) {
          if (B === biggest) continue;
          B.Z.a = islandAngle(B.Z.a + dir * (built[a] === biggest || built[b] === biggest ? 2 : 1));
          B.poly = islandZoneShape([0, 0], B.Z, D.organic, B.s);
        }
        moved = true;
      }
    if (!moved) break;
  }

  /* ---------- coast: a radius per degree (the noise round a circle, so it joins), the cove, pushed round the zones ---------- */
  const sCoast = salt('coast'),
    coastR = new Float64Array(360),
    beachW = new Float64Array(360),
    cliffW = new Float64Array(360),
    cliffH = new Float64Array(360);
  const coveAt = t => {
    if (!D.cove.on) return 0;
    const u = Math.abs(islandAngleDiff(D.cove.a, t)) / (D.cove.span / 2);
    if (u >= 1) return 0;
    /* a bay: one wide, rounded sweep; a cove: steep sides and a flat back */
    return D.cove.shape === 'bay'
      ? Math.pow((Math.cos(Math.PI * u) + 1) / 2, 0.8)
      : mapgenSmooth(mapgenBetween((1 - u) / 0.45, 0, 1));
  };
  /* headlands and bays: a few bumps out and dents in along the coast, none in the cove */
  const rC = rng('coast'),
    O = D.organic,
    capes = [];
  for (let k = 0, n = Math.round(3 + 4 * O); k < n; k++) {
    const a = rC.range(0, 360),
      span = rC.range(7, 24),
      amp = (rC.chance(0.55) ? 1 : -0.8) * rC.range(5, 13) * O;
    if (D.cove.on && Math.abs(islandAngleDiff(D.cove.a, a)) < D.cove.span / 2 + span / 2 + 6) continue;
    capes.push({ a, span, amp });
  }
  /* a bay has arms: a headland either side of its mouth, so it reads as a bay and not a bend in the coast */
  if (D.cove.on && D.cove.shape === 'bay')
    for (const side of [-1, 1])
      capes.push({ a: D.cove.a + side * (D.cove.span / 2 + 7), span: 20, amp: D.cove.depth * 0.4 });
  /* big lobes and a peninsula (the lobes dial), none across the cove */
  const Lb = D.size.lobes;
  for (let k = 0, n = Math.round(1 + 2 * Lb); k < n; k++) {
    const a = rC.range(0, 360),
      span = rC.range(40, 75),
      amp = (rC.chance(0.6) ? 1 : -0.7) * rC.range(10, 22) * Lb;
    if (D.cove.on && Math.abs(islandAngleDiff(D.cove.a, a)) < D.cove.span / 2 + span / 2 + 18) continue;
    capes.push({ a, span, amp });
  }
  if (rC.chance(0.4 + 0.5 * Lb)) {
    const a = rC.range(0, 360);
    if (!D.cove.on || Math.abs(islandAngleDiff(D.cove.a, a)) > D.cove.span / 2 + 20)
      capes.push({ a, span: rC.range(12, 18), amp: rC.range(16, 28) * Lb });
  }
  /* a longer island: stretched along a line (an ellipse's radius at each angle) */
  const elA = rC.range(0, 180),
    elX = 1 + 0.3 * D.size.stretch,
    elZ = 1 / (1 + 0.12 * D.size.stretch),
    ellipse = t => {
      const u = Math.cos((t - elA) * ISLAND_RAD) / elX,
        v = Math.sin((t - elA) * ISLAND_RAD) / elZ;
      return 1 / Math.hypot(u, v);
    };
  for (let t = 0; t < 360; t++) {
    /* the noise is read a little off round the circle (an angular warp), so the wobble isn't even */
    const tw =
        (t +
          (mapgenFbm(Math.cos(t * ISLAND_RAD) * 1.3 + 2, Math.sin(t * ISLAND_RAD) * 1.3 + 2, sCoast + 21) - 0.5) *
            30 *
            O) *
        ISLAND_RAD,
      cx = Math.cos(tw),
      cz = Math.sin(tw),
      n = mapgenFbm(cx * 1.7 + 7, cz * 1.7 + 7, sCoast) - 0.5,
      n2 = mapgenNoise(cx * 5 + 3, cz * 5 + 3, sCoast + 9) - 0.5,
      n3 = mapgenNoise(cx * 11 + 4, cz * 11 + 4, sCoast + 13) - 0.5;
    let cape = 0;
    for (const C of capes) {
      const u = Math.abs(islandAngleDiff(C.a, t)) / (C.span / 2);
      if (u < 1) cape += C.amp * mapgenSmooth(1 - u);
    }
    coastR[t] =
      R0 * ellipse(t) * (1 + D.size.wobble * (0.32 * n + 0.08 * n2 + 0.05 * O * n3)) + cape - D.cove.depth * coveAt(t);
    let cw = 0,
      ch = 0;
    for (const C of D.cliffs) {
      const k = islandArcWeight(t, C.a, C.span);
      if (k > cw) {
        cw = k;
        ch = C.h * k;
      }
    }
    cliffW[t] = cw;
    cliffH[t] = ch;
    let bw = D.shore;
    for (const B of D.beaches) bw = Math.max(bw, D.shore + (B.w - D.shore) * islandArcWeight(t, B.a, B.span));
    if (D.cove.on) bw = Math.max(bw, D.shore + (D.cove.beach - D.shore) * coveAt(t));
    beachW[t] = bw * (1 - cw);
  }
  /* round the zones: the coast at least a beach, the loop path and a margin past their far side */
  const zonePolysAt0 = built.map(Z => Z.poly);
  const need = new Float64Array(360);
  const pushOut = (polys, cx, cz) => {
    for (const poly of polys)
      for (const p of islandPolyDense(poly)) {
        const dx = p[0] - cx,
          dz = p[1] - cz,
          d = Math.hypot(dx, dz),
          a = Math.atan2(dz, dx) / ISLAND_RAD,
          spread = Math.max(2, Math.ceil((Math.atan2(4, Math.max(d, 1)) / ISLAND_RAD) * 1.5));
        for (let k = -spread; k <= spread; k++) {
          const t = Math.round(islandAngle(a + k));
          const m = d + beachW[t % 360] + D.paths.inland + D.paths.width + 2.5;
          need[t % 360] = Math.max(need[t % 360], m);
        }
      }
  };
  /* kept zones are in the previous map's coordinates: placed once the middle is known (below) */
  pushOut(zonePolysAt0, 0, 0);

  /* ---------- the scene: its size from the coast, the middle where prev had it ---------- */
  let c = /** @type {number[]} */ ([0, 0]),
    w = 0,
    h = 0;
  const finishCoast = () => {
    for (let t = 0; t < 360; t++) coastR[t] = Math.max(coastR[t], need[t]);
    /* smoothed a little, never inside what the zones need */
    const sm = Float64Array.from(coastR, (_, t) => {
      let s = 0;
      for (let k = -1; k <= 1; k++) s += coastR[(t + k + 360) % 360];
      return Math.max(s / 3, need[t]);
    });
    coastR.set(sm);
  };
  if (prev && prev.island && Array.isArray(prev.island.c)) {
    c = prev.island.c.slice(0, 2);
    pushOut(
      kept.map(Z => Z.poly),
      c[0],
      c[1]
    );
    finishCoast();
    let need2 = [0, 0];
    for (let t = 0; t < 360; t++) {
      const x = c[0] + Math.cos(t * ISLAND_RAD) * coastR[t],
        z = c[1] + Math.sin(t * ISLAND_RAD) * coastR[t];
      if (x < D.size.sea || z < D.size.sea)
        throw new Error('the island no longer fits round the previous map’s middle (a smaller size, or start afresh)');
      need2 = [Math.max(need2[0], x), Math.max(need2[1], z)];
    }
    w = Math.max(prev.w, Math.ceil(need2[0] + D.size.sea));
    h = Math.max(prev.h, Math.ceil(need2[1] + D.size.sea));
  } else {
    if (kept.length) notes.push('the previous map has no island middle: its locked zones are not kept');
    kept.length = 0;
    finishCoast();
    let x0 = 1e9,
      z0 = 1e9,
      x1 = -1e9,
      z1 = -1e9;
    for (let t = 0; t < 360; t++) {
      const x = Math.cos(t * ISLAND_RAD) * coastR[t],
        z = Math.sin(t * ISLAND_RAD) * coastR[t];
      x0 = Math.min(x0, x);
      z0 = Math.min(z0, z);
      x1 = Math.max(x1, x);
      z1 = Math.max(z1, z);
    }
    c = [Math.ceil(D.size.sea - x0), Math.ceil(D.size.sea - z0)];
    w = Math.ceil(c[0] + x1 + D.size.sea);
    h = Math.ceil(c[1] + z1 + D.size.sea);
  }
  if (w > 260 || h > 260) throw new Error(`the island needs a ${w} x ${h} m scene: 260 m at most`);
  /* two flat zones on top of each other can't both be built on */
  const allBuilt = [...built.map(Z => Z.poly.map(p => [p[0] + c[0], p[1] + c[1]])), ...kept.map(Z => Z.poly)],
    allKinds = [...built.map(Z => Z.k), ...kept.map(Z => Z.k)];
  for (let a = 0; a < allBuilt.length; a++)
    for (let b = a + 1; b < allBuilt.length; b++)
      if (
        islandPolyDense(allBuilt[a]).some(p => islandPointIn(allBuilt[b], p[0], p[1])) ||
        islandPolyDense(allBuilt[b]).some(p => islandPointIn(allBuilt[a], p[0], p[1]))
      )
        notes.push(`the ${allKinds[a]} and ${allKinds[b]} zones overlap`);
  const zones = [
    ...built.map(Z => ({ k: Z.k, poly: Z.poly.map(p => islandRound2pt([p[0] + c[0], p[1] + c[1]])), lock: true })),
    ...kept.map(Z => ({ k: Z.k, poly: Z.poly.map(p => p.slice(0, 2)), lock: true })),
  ];
  const coastAt = t => {
      const a = islandAngle(t),
        i = Math.floor(a),
        f = a - i;
      return coastR[i % 360] * (1 - f) + coastR[(i + 1) % 360] * f;
    },
    arrAt = (A, t) => A[Math.round(islandAngle(t)) % 360],
    polar = (x, z) => [Math.hypot(x - c[0], z - c[1]), islandAngle(Math.atan2(z - c[1], x - c[0]) / ISLAND_RAD)],
    at = (r, t) => [c[0] + Math.cos(t * ISLAND_RAD) * r, c[1] + Math.sin(t * ISLAND_RAD) * r],
    at0 = (r, t) => [Math.cos(t * ISLAND_RAD) * r, Math.sin(t * ISLAND_RAD) * r];
  const coast = [];
  for (let t = 0; t < 360; t += 1.5) coast.push(islandRound2pt(at(coastAt(t), t)));

  /* ---------- mapgen's working state (its trail, stream, road and water helpers read it) ---------- */
  const P = {
    w,
    h,
    seed: hashString(SEED) % 2147483647,
    seeds: {},
    biome: 'island',
    kind: 'route',
    land: {},
    road: { surface: 'dirt', width: D.paths.width, exits: [] },
    pin: '',
  };
  /** @type {any} */
  const G = mapgenNewWork(P, { biomes: { island: /** @type {Biome} */ (ISLAND_BIOME) }, scenery: ctx.scenery });
  G.hub = [c[0], c[1]];
  const W1 = w + 1,
    W2 = w * 2;
  const inLand = (x, z) => islandPointIn(coast, x, z);

  /* ---------- heights: beaches, hills, cliffs, the zones flat ---------- */
  const sH = salt('heights'),
    hillAmp = D.hills * 1.6,
    rH = rng('heights'),
    O2 = D.organic;
  /* a few knolls out in the lowland (not near the mountain), each a gentle rise */
  const knolls = [];
  for (let k = 0, n = Math.round(D.hills * O2 * 8); k < n; k++) {
    const t = rH.range(0, 360),
      r = rH.range(Rf + 14, R0 - 12);
    knolls.push({ p: at0(r, t), r: rH.range(6, 11), h: rH.range(1, 2.6) * D.hills * 2 });
  }
  const zoneLevel = zones.map(Z => {
    if (!Z.lock || !kept.some(K => K.k === Z.k) || !prev || !prev.heights) return D.level;
    /* a kept zone lies at the level it had */
    let s = 0,
      n = 0;
    const PG = islandDecodeGround(prev);
    for (let j = 0; j <= PG.h; j++)
      for (let i = 0; i <= PG.w; i++)
        if (islandPointIn(Z.poly, i, j)) {
          s += PG.H[j * (PG.w + 1) + i];
          n++;
        }
    return n ? s / n : D.level;
  });
  for (let j = 0; j <= h; j++)
    for (let i = 0; i <= w; i++) {
      const [d, t] = polar(i, j),
        s = coastAt(t) - d,
        bw = arrAt(beachW, t);
      let H = 0;
      if (s > 0) {
        const inl = mapgenSmooth(mapgenBetween((s - bw) / 12, 0, 1)),
          rise = s < bw ? 0.1 + (0.6 * s) / Math.max(bw, 0.5) : 0.7;
        /* rolling land on warped ground, so the hills run in uneven lines rather than blobs */
        const wx = i + (mapgenFbm(i / 30, j / 30, sH + 5) - 0.5) * 22 * O2,
          wz = j + (mapgenFbm(i / 30, j / 30, sH + 7) - 0.5) * 22 * O2;
        let knoll = 0;
        for (const K of knolls) {
          const dk = Math.hypot(i - c[0] - K.p[0], j - c[1] - K.p[1]) / K.r;
          if (dk < 1) knoll += K.h * mapgenSmooth(1 - dk);
        }
        H =
          rise +
          inl *
            (0.3 +
              hillAmp * (mapgenFbm(wx / 24, wz / 24, sH) - 0.4) +
              0.4 * O2 * (mapgenNoise(wx / 7, wz / 7, sH + 3) - 0.5) +
              knoll);
        /* the foot hills round the mountain */
        if (Rf > 0) H += D.hills * 3 * Math.pow(mapgenBetween(1 - (d - Rf) / 22, 0, 1), 2) * inl;
        /* cliffs: a face 2.2 m deep, a top 10 m wide, then down to the land over 18 m */
        const ch = arrAt(cliffH, t) * (1 + 0.5 * O2 * (mapgenNoise(i / 6, j / 6, sH + 9) - 0.5));
        if (ch > 0.2) {
          const top =
            ch * mapgenSmooth(mapgenBetween(s / 2.2, 0, 1)) * (1 - mapgenSmooth(mapgenBetween((s - 12) / 18, 0, 1)));
          H = Math.max(H, top);
        }
      }
      /* the flat zones and their 7 m round */
      zones.forEach((Z, k) => {
        const dz = islandPolyDist(Z.poly, i, j, 12),
          bl = 5 + 6 * O2 * mapgenNoise(i / 9, j / 9, sH + 11);
        if (dz < bl) {
          const f = dz <= 0 ? 1 : 1 - mapgenSmooth(dz / bl);
          H = H * (1 - f) + zoneLevel[k] * f;
        }
      });
      G.H[j * W1 + i] = s > 0 ? H : 0;
    }

  /* ---------- the sea: every cell whose middle is past the coast ---------- */
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++)
      if (!inLand(i + 0.5, j + 0.5)) {
        const q = j * w + i,
          [d, t] = polar(i + 0.5, j + 0.5);
        G.T[q] = d - coastAt(t) < 4 || coveAt(t) > 0.3 ? 'w' : 'd';
        G.F[q] |= 4;
      }

  /* ---------- the mountain: a quarter smooth land, the rest step-grid shelves (as TR-2's mapgenMountains) ---------- */
  /* a massif, not a cone: stretched along a ridge that runs across the island (square to the biggest flat zone, so it
     leans away from the town), its peak a little off the middle, a shoulder peak along the ridge, its outline and
     slopes warped by noise; a flat top 3.5 m round (the summit lookout) where the trail ends */
  const sM = salt('mountain'),
    rM = rng('mountain'),
    E = new Float32Array(W1 * (h + 1)),
    footR = new Float64Array(360),
    O3 = D.organic,
    area = poly =>
      Math.abs(
        poly.reduce((a, p, k) => a + p[0] * poly[(k + 1) % poly.length][1] - poly[(k + 1) % poly.length][0] * p[1], 0)
      ) / 2,
    big = zones.slice().sort((a, b) => area(b.poly) - area(a.poly))[0],
    bigA = big
      ? polar(...big.poly.reduce((m, p) => [m[0] + p[0] / big.poly.length, m[1] + p[1] / big.poly.length], [0, 0]))[1]
      : 270,
    /* the ridge's line: the one furthest (either end) from the biggest zone and the cove, a little off by noise */
    awayFrom = [bigA, ...(D.cove.on ? [D.cove.a] : [])],
    lineGap = (l, a) => Math.min(Math.abs(islandAngleDiff(l, a)), Math.abs(islandAngleDiff(l + 180, a))),
    bestLine = [...Array(36).keys()]
      .map(k => k * 5)
      .reduce(
        (b, l) =>
          Math.min(...awayFrom.map(a => lineGap(l, a))) > Math.min(...awayFrom.map(a => lineGap(b, a))) ? l : b,
        0
      ),
    ridgeA = (bestLine + rM.range(-15, 15) * O3) * ISLAND_RAD,
    st = 1 + 0.45 * D.mountain.stretch * Math.min(1, O3 * 1.5),
    lean = rM.range(0, 360) * ISLAND_RAD,
    off = rM.range(0, 2.5) * O3,
    peakP = [c[0] + Math.cos(lean) * off, c[1] + Math.sin(lean) * off],
    shSide = rM.chance(0.5) ? 1 : -1,
    shP = [
      peakP[0] + Math.cos(ridgeA) * Rf * 0.62 * st * shSide,
      peakP[1] + Math.sin(ridgeA) * Rf * 0.62 * st * shSide,
    ],
    shH = D.mountain.shoulder * 0.6 * Math.min(1, O3 * 1.5),
    topF = Math.max(0.05, 3.5 / Math.max(Rf, 4)),
    /* the range: spurs running out from the mountain, ridges that fall away from it (not toward the biggest zone or
       the cove) */
    range = /** @type {{ a: number[], b: number[], r: number, h0: number, h1: number }[]} */ ([]);
  for (let k = 0, n = Math.round(2 + 4 * D.mountain.range); k < n && D.mountain.range > 0; k++) {
    const t0 = rM.range(0, 360);
    if (awayFrom.some(b => Math.abs(islandAngleDiff(t0, b)) < 40)) continue;
    const bend = rM.range(-25, 25),
      d0 = Rf * rM.range(0.35, 0.6),
      d1 = Rf * rM.range(1.2, 1.75),
      a = t0 * ISLAND_RAD,
      b = (t0 + bend) * ISLAND_RAD,
      top = D.mountain.peak * rM.range(0.35, 0.55) * (0.6 + 0.4 * D.mountain.range);
    range.push({
      a: [peakP[0] + Math.cos(a) * d0, peakP[1] + Math.sin(a) * d0],
      b: [peakP[0] + Math.cos(b) * d1, peakP[1] + Math.sin(b) * d1],
      r: Rf * rM.range(0.32, 0.5),
      h0: top,
      h1: top * rM.range(0.25, 0.5),
    });
  }
  if (Rf > 0 && D.mountain.peak > 0)
    for (let j = 0; j <= h; j++)
      for (let i = 0; i <= w; i++) {
        /* warped ground, then turned onto the ridge and squeezed across it */
        const wx = i - peakP[0] + (mapgenFbm(i / 18, j / 18, sM + 3) - 0.5) * 12 * O3,
          wz = j - peakP[1] + (mapgenFbm(i / 18, j / 18, sM + 5) - 0.5) * 12 * O3,
          along = wx * Math.cos(ridgeA) + wz * Math.sin(ridgeA),
          across = -wx * Math.sin(ridgeA) + wz * Math.cos(ridgeA),
          rag = 1 + 0.36 * O3 * (mapgenFbm(i / 13, j / 13, sM + 7) - 0.5),
          dn = (Math.hypot(along / st, across * Math.sqrt(st)) / Rf) * rag;
        let e = 0;
        if (dn < 1) {
          const f = Math.min(1, (1 - dn) / (1 - topF)),
            r = mapgenRidged(i / 16, j / 16, sM + 41);
          e = D.mountain.peak * Math.pow(f, 1.1) * (0.8 + 0.2 * r * (1 - 0.6 * f));
        }
        if (shH > 0) {
          const ds = (Math.hypot(i - shP[0], j - shP[1]) / (Rf * 0.55)) * rag;
          if (ds < 1) e = Math.max(e, D.mountain.peak * shH * Math.pow(1 - ds, 1.3));
        }
        for (const F of range) {
          /* the distance to the spur's line, and how far along it (its height falls away from the mountain) */
          const px = wx + peakP[0],
            pz = wz + peakP[1],
            vx = F.b[0] - F.a[0],
            vz = F.b[1] - F.a[1],
            u = mapgenBetween(((px - F.a[0]) * vx + (pz - F.a[1]) * vz) / (vx * vx + vz * vz), 0, 1),
            ds = (Math.hypot(px - F.a[0] - vx * u, pz - F.a[1] - vz * u) / (F.r * (1 - 0.35 * u))) * rag;
          if (ds < 1)
            e = Math.max(
              e,
              (F.h0 + (F.h1 - F.h0) * u) * Math.pow(1 - ds, 1.2) * (0.7 + 0.3 * mapgenRidged(i / 11, j / 11, sM + 61))
            );
        }
        if (e <= 0) continue;
        let keep = 1;
        for (const Z of zones) keep *= mapgenSmooth(mapgenBetween((islandPolyDist(Z.poly, i, j, 12) - 5) / 6, 0, 1));
        E[j * W1 + i] = e * keep * (inLand(i, j) ? 1 : 0);
      }
  /* the mountain's foot round the middle: the last of it along each line out */
  for (let t = 0; t < 360; t++) {
    let last = 0;
    for (let r = 0; r < Math.max(w, h); r += 0.5) {
      const [x, z] = at(r, t);
      if (x < 0 || z < 0 || x > w || z > h) break;
      if (E[mapgenBetween(Math.round(z), 0, h) * W1 + mapgenBetween(Math.round(x), 0, w)] > 0.05) last = r;
    }
    footR[t] = Math.max(last, 1);
  }
  const footAt = t => arrAt(footR, t);
  const SMOOTH = 0.25,
    band = Math.round((0.8 + D.mountain.cliffs * 1.2) * 20) / 20;
  G.S0 = Float32Array.from(G.S);
  for (let q = 0; q < E.length; q++) G.H[q] += E[q] * SMOOTH;
  const Eat = (x, z) => {
    const i0 = mapgenBetween(Math.floor(x), 0, w - 1),
      j0 = mapgenBetween(Math.floor(z), 0, h - 1),
      fx = x - i0,
      fz = z - j0,
      e = (i, j) => E[j * W1 + i];
    return (
      e(i0, j0) * (1 - fx) * (1 - fz) +
      e(i0 + 1, j0) * fx * (1 - fz) +
      e(i0, j0 + 1) * (1 - fx) * fz +
      e(i0 + 1, j0 + 1) * fx * fz
    );
  };
  let shelves = 0;
  for (let j = 0; j < h * 2; j++)
    for (let i = 0; i < W2; i++) {
      const x = (i + 0.5) / 2,
        z = (j + 0.5) / 2,
        e = Eat(x, z),
        /* the shelves' edges wander (not rings): an offset by noise, none on the flat top */
        wob =
          e > 0.3
            ? band *
              0.7 *
              O3 *
              (mapgenFbm(x / 7, z / 7, sM + 17) - 0.5) *
              mapgenBetween(1.2 - e / D.mountain.peak, 0, 1)
            : 0,
        n = Math.floor((e * (1 - SMOOTH) + wob) / band);
      if (n > 0) {
        G.S[j * W2 + i] += n * band;
        shelves++;
      }
    }
  G.mtnE = E;
  if (shelves) {
    G.relief = true;
    G.stepsUsed = true;
  }

  /* ---------- water: the pond at the mountain's foot, the stream down to the cove with a small fall ---------- */
  const spots = /** @type {{ kind: string, x: number, z: number, y: number }[]} */ ([]);
  const rW = rng('water'),
    wetPts = /** @type {number[][]} */ ([]);
  /* the stream comes into one side of the cove's back, the dock stands on the other */
  const side = rW.chance(0.5) ? 1 : -1,
    streamA = D.cove.a + side * D.cove.span * 0.2,
    dockA = D.cove.a - side * D.cove.span * 0.2;
  if (D.stream.on && D.cove.on) {
    const ta = streamA + rW.range(-6, 6),
      pr = Math.max(D.stream.pond, 1.5),
      pd = footAt(ta) + pr + 3;
    const [px, pz] = at(pd, ta),
      back = coastAt(streamA);
    if (back - pd < pr + 10) notes.push('no room for the stream between the mountain and the cove (a shallower cove)');
    else {
      const lvl = G.H[Math.round(pz) * W1 + Math.round(px)];
      spots.push({ kind: 'pond', x: mapgenRound2(px), z: mapgenRound2(pz), y: mapgenRound2(lvl) });
      /* the pond: level, its bank pebbles */
      for (let j = Math.floor(pz - pr - 3); j <= Math.ceil(pz + pr + 3); j++)
        for (let i = Math.floor(px - pr - 3); i <= Math.ceil(px + pr + 3); i++) {
          if (i < 0 || j < 0 || i > w || j > h) continue;
          const dd = Math.hypot(i - px, j - pz);
          if (dd <= pr + 1.5) G.H[j * W1 + i] = lvl;
          else if (dd <= pr + 3) {
            const f = 1 - mapgenSmooth((dd - pr - 1.5) / 1.5);
            G.H[j * W1 + i] = G.H[j * W1 + i] * (1 - f) + lvl * f;
          }
          if (i < w && j < h) {
            const q = j * w + i,
              dc = Math.hypot(i + 0.5 - px, j + 0.5 - pz);
            if (dc <= pr) {
              G.T[q] = dc < pr - 2 ? 'd' : 'w';
              G.F[q] = (G.F[q] & ~(2 | 32 | 64)) | 4;
            } else if (dc <= pr + 1.2 && !(G.F[q] & 4)) {
              G.T[q] = 'P';
              G.F[q] |= 64;
            }
          }
        }
      /* the stream: from the pond's edge to past the cove's back, wobbling, its bed falling all the way */
      const [mx, mz] = at(back + 3, streamA + rW.range(-3, 3)),
        ns = salt('water', 'stream'),
        L = Math.hypot(mx - px, mz - pz),
        dx = (mx - px) / L,
        dz = (mz - pz) / L,
        raw = [];
      for (let k = 0; k <= 30; k++) {
        const f = k / 30,
          off = (mapgenNoise(f * 3, 2.1, ns) - 0.5) * 6 * Math.sin(Math.PI * f);
        raw.push([
          px + dx * (pr - 0.5 + (L - pr + 0.5) * f) - dz * off,
          pz + dz * (pr - 0.5 + (L - pr + 0.5) * f) + dx * off,
        ]);
      }
      const pts = mapgenResample(raw, 0.5),
        n = pts.length,
        fall = Math.min(D.stream.fall, Math.max(0, lvl - 0.4)),
        start = lvl - fall;
      /* the bed: the pond's level, a drop of `fall` over the first metre (the small fall), then down to the sea */
      for (let k = 0; k < n; k++) {
        const f = k / (n - 1),
          y = k < 2 ? lvl - (fall * k) / 2 : Math.max(0, start * (1 - mapgenSmooth(f)) + 0.05);
        const [x, z] = pts[k];
        for (let j = Math.floor(z - 3); j <= Math.ceil(z + 3); j++)
          for (let i = Math.floor(x - 3); i <= Math.ceil(x + 3); i++) {
            if (i < 0 || j < 0 || i > w || j > h) continue;
            const dd = Math.hypot(i - x, j - z),
              c0 = j * W1 + i;
            if (dd <= 1.6) G.H[c0] = Math.min(G.H[c0], y);
            else if (dd <= 3) {
              const g = 1 - mapgenSmooth((dd - 1.6) / 1.4);
              G.H[c0] = Math.min(G.H[c0], G.H[c0] * (1 - g) + y * g);
            }
          }
      }
      mapgenPaintStream(G, pts, 1.8, 'water');
      wetPts.push(...pts.filter((_, k) => k % 4 === 0));
      for (let k = 0; k < 12; k++) wetPts.push(at0(pr, k * 30).map((v, m) => v + (m ? pz : px)));
      spots.push({ kind: 'fall', x: mapgenRound2(pts[1][0]), z: mapgenRound2(pts[1][1]), y: mapgenRound2(start) });
    }
  }

  /* ---------- paths: the loop round the coast, spokes to the zones, the mountain and the dock ---------- */
  const zoneAvoid = (x, z) => zones.some(Z => islandPolyDist(Z.poly, x, z) < D.paths.width / 2 + 1.2);
  const loop = [];
  for (let k = 0; k <= 360; k++) {
    const t = 180 + k;
    /* it wanders a little in and out (never onto the beach) */
    let r =
      coastAt(t) -
      arrAt(beachW, t) -
      D.paths.inland -
      D.paths.width / 2 -
      Math.max(
        0,
        (mapgenFbm(Math.cos(t * ISLAND_RAD) * 3 + 9, Math.sin(t * ISLAND_RAD) * 3 + 9, salt('paths')) - 0.35) *
          7 *
          D.organic
      );
    if (arrAt(cliffW, t) > 0.3) r = Math.min(r, coastAt(t) - 5);
    /* across a headland rather than round it (the lowest of the line's radius nearby), inland now and then, clear
       of the mountains' feet where there's room */
    const Wn = Math.round(4 + 14 * D.paths.wander);
    let cut = r;
    for (let m = -Wn; m <= Wn; m += 2)
      cut = Math.min(
        cut,
        coastAt(t + m) - arrAt(beachW, t + m) - D.paths.inland - D.paths.width / 2 + Math.abs(m) * 0.25
      );
    const room = Math.max(0, cut - footAt(t) - 6);
    r =
      cut -
      Math.min(
        room,
        Math.max(
          0,
          mapgenFbm(Math.cos(t * ISLAND_RAD) * 1.6 + 4, Math.sin(t * ISLAND_RAD) * 1.6 + 4, salt('paths', 'wander')) -
            0.42
        ) *
          30 *
          D.paths.wander
      );
    let p = at(r, t);
    for (let push = 0; push < 30 && zoneAvoid(p[0], p[1]) && r < coastAt(t) - 1.5; push++) p = at((r += 0.5), t);
    loop.push(p);
  }
  /* smoothed (twice, a window of 7 points), its two ends one point */
  let lp = loop;
  for (let pass = 0; pass < 2; pass++)
    lp = lp.map((_, k) => {
      let sx = 0,
        sz = 0;
      for (let m = -3; m <= 3; m++) {
        const q = lp[(((k + m) % 360) + 360) % 360];
        sx += q[0];
        sz += q[1];
      }
      return [sx / 7, sz / 7];
    });
  lp[360] = lp[0];
  const roads = [{ pts: mapgenResample(lp, 0.5), width: D.paths.width, main: true, name: 'loop' }];
  const nearLoop = (x, z) => {
    let best = roads[0].pts[0],
      bd = 1e9;
    for (const p of roads[0].pts) {
      const d = Math.hypot(p[0] - x, p[1] - z);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  };
  /* a spoke bends a little (a curve with its middle pushed aside by noise), straight at both ends */
  const sP = salt('paths', 'spokes');
  const spoke = (a, b, name) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1) return;
    const bend = (mapgenNoise(a[0] / 11 + 3, a[1] / 11 + 3, sP) - 0.5) * 2 * 0.22 * L * D.organic,
      nx = -(b[1] - a[1]) / L,
      nz = (b[0] - a[0]) / L,
      m = [(a[0] + b[0]) / 2 + nx * bend, (a[1] + b[1]) / 2 + nz * bend],
      raw = [];
    for (let k = 0; k <= 16; k++) {
      const f = k / 16,
        u = 1 - f;
      raw.push([u * u * a[0] + 2 * u * f * m[0] + f * f * b[0], u * u * a[1] + 2 * u * f * m[1] + f * f * b[1]]);
    }
    roads.push({ pts: mapgenResample(raw, 0.5), width: Math.max(1.6, D.paths.width * 0.9), main: false, name });
  };
  /* each flat zone: from the middle of its side facing the sea to the loop, and the town's side facing the mountain
     to the mountain's foot */
  let footSpoke = /** @type {number[] | null} */ (null);
  for (const Z of zones) {
    if (!ISLAND_GEN_BUILT.includes(Z.k)) continue;
    let mx = 0,
      mz = 0;
    for (const p of Z.poly) {
      mx += p[0] / Z.poly.length;
      mz += p[1] / Z.poly.length;
    }
    const [, t] = polar(mx, mz);
    /* the side's middle: walk out from the middle until outside, then a metre more */
    const edge = dir => {
      let r = 0,
        p = [mx, mz];
      while (r < 200 && islandPointIn(Z.poly, p[0], p[1])) {
        r += 0.5;
        p = [mx + Math.cos(t * ISLAND_RAD) * r * dir, mz + Math.sin(t * ISLAND_RAD) * r * dir];
      }
      const m = D.paths.width / 2 + 0.6;
      return [p[0] + Math.cos(t * ISLAND_RAD) * dir * m, p[1] + Math.sin(t * ISLAND_RAD) * dir * m];
    };
    const out = edge(1);
    spoke(out, nearLoop(out[0], out[1]), Z.k + ' to the coast');
    if (Z.k === 'town' && Rf > 0) {
      const inn = edge(-1);
      /* out from the mountain's middle along this line until no mountain is left, then 1.5 m more */
      let r = 0;
      while (r < 120 && Eat(...at(r, t)) > 0.05) r += 0.5;
      let foot = at(r + 1.5, t);
      /* the mountain's foot right by the town: the spoke still runs 3 m up toward it */
      if (Math.hypot(foot[0] - inn[0], foot[1] - inn[1]) < 3) {
        const L = Math.hypot(c[0] - inn[0], c[1] - inn[1]) || 1;
        foot = [inn[0] + ((c[0] - inn[0]) / L) * 3, inn[1] + ((c[1] - inn[1]) / L) * 3];
      }
      footSpoke = foot;
      spoke(inn, foot, 'town to the mountain');
    }
  }
  /* the dock: on the cove's inner beach at the waterline, a spoke from the loop */
  let dock = /** @type {number[] | null} */ (null);
  if (D.cove.on) {
    const t = dockA,
      back = coastAt(t);
    /* the dock's landing: the last dry metre of the inner beach, the dock itself (IS-4) runs out from it */
    dock = at(back - 0.8, t);
    spoke(nearLoop(dock[0], dock[1]), dock, 'the dock');
    /* the channel: deep water from the dock straight out past the cove's mouth */
    if (D.cove.channel > 0) {
      const outR = Math.max(...[-D.cove.span / 2, D.cove.span / 2].map(o => coastAt(t + o))) + 8;
      for (let r = back + 1.5; r < outR; r += 0.5)
        for (let o = -D.cove.channel / 2; o <= D.cove.channel / 2; o += 0.5) {
          const [x, z] = at(r, t),
            px = x - Math.sin(t * ISLAND_RAD) * o,
            pz = z + Math.cos(t * ISLAND_RAD) * o,
            q = mapgenCellAt(G, px, pz);
          if (G.F[q] & 4 && !inLand(Math.floor(px) + 0.5, Math.floor(pz) + 0.5)) G.T[q] = 'd';
        }
    }
  }
  /* the distance field and the paint (mapgenStageRoad's), then mapgen's flattening */
  G.road = roads.map(r => ({ pts: r.pts, width: r.width, main: r.main }));
  let along = 0;
  G.road.forEach((Rd, k) => {
    for (let i = 0; i < Rd.pts.length; i++) {
      if (i) along += Math.hypot(Rd.pts[i][0] - Rd.pts[i - 1][0], Rd.pts[i][1] - Rd.pts[i - 1][1]);
      G.roadPts.push({ x: Rd.pts[i][0], z: Rd.pts[i][1], r: Rd.width / 2, s: along, k });
    }
  });
  G.roadPts.forEach((p, n) => {
    for (let j = Math.max(0, Math.floor(p.z - 8)); j < Math.min(h, Math.ceil(p.z + 8)); j++)
      for (let i = Math.max(0, Math.floor(p.x - 8)); i < Math.min(w, Math.ceil(p.x + 8)); i++) {
        const d = Math.hypot(i + 0.5 - p.x, j + 0.5 - p.z),
          q = j * w + i;
        if (d - p.r < G.dist[q] - (G.near[q] >= 0 ? G.roadPts[G.near[q]].r : 0)) {
          G.dist[q] = d;
          G.near[q] = n;
        }
      }
  });
  for (let q = 0; q < w * h; q++) {
    if (G.near[q] < 0 || G.F[q] & 4) continue;
    if (G.dist[q] - G.roadPts[G.near[q]].r <= 0) {
      G.T[q] = 'p';
      G.F[q] = (G.F[q] & ~(32 | 64)) | 1 | 16;
    }
  }
  mapgenFlattenRoads(G, D.paths.width / 2);
  /* a path over the mountain's shelves would be cut by them: the shelves stop where a path runs */
  for (let j = 0; j < h * 2; j++)
    for (let i = 0; i < W2; i++)
      if (G.F[mapgenCellAt(G, (i + 0.5) / 2, (j + 0.5) / 2)] & 1) G.S[j * W2 + i] = G.S0[j * W2 + i];
  /* bridges: where a path runs over water, from the dry sample before to the dry one after */
  const bridges = [];
  for (const Rd of roads) {
    const wet = Rd.pts.map(p => !!(G.F[mapgenCellAt(G, p[0], p[1])] & 4));
    for (let k = 0; k < wet.length; k++) {
      if (!wet[k]) continue;
      let e = k;
      while (e + 1 < wet.length && wet[e + 1]) e++;
      const a = Rd.pts[Math.max(0, k - 2)],
        b = Rd.pts[Math.min(wet.length - 1, e + 2)],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L > 14) notes.push(`${Rd.name} runs ${Math.round(L)} m over water: no bridge`);
      else
        bridges.push({
          a: islandRound2pt(a),
          b: islandRound2pt(b),
          w: mapgenRound2(Math.min(2, Rd.width)),
          kind: 'wood',
        });
      k = e;
    }
  }
  for (const B of bridges) {
    const L = Math.hypot(B.b[0] - B.a[0], B.b[1] - B.a[1]) || 1;
    for (let s = 0; s <= L; s += 0.25) {
      const x = B.a[0] + ((B.b[0] - B.a[0]) * s) / L,
        z = B.a[1] + ((B.b[1] - B.a[1]) * s) / L;
      G.F[mapgenCellAt(G, x, z)] |= 8;
    }
  }

  /* ---------- the trail: from the town's spoke at the mountain's foot up to a summit lookout (TR-2b) ---------- */
  if (shelves) {
    const goalOf = () => {
      /* the highest corner within 5 m of the peak whose ground round it is gentle */
      let best = -1,
        bh = -1e9;
      for (let j = Math.round(peakP[1]) - 5; j <= Math.round(peakP[1]) + 5; j++)
        for (let i = Math.round(peakP[0]) - 5; i <= Math.round(peakP[0]) + 5; i++) {
          if (Math.hypot(i - peakP[0], j - peakP[1]) > 5) continue;
          let steep = false;
          for (let dj = -2; dj <= 2 && !steep; dj++)
            for (let di = -2; di <= 2 && !steep; di++) steep = mapgenSteepAt(G, (j + dj) * W1 + i + di);
          if (!steep && E[j * W1 + i] > bh) {
            bh = E[j * W1 + i];
            best = j * W1 + i;
          }
        }
      return best;
    };
    const goal = goalOf(),
      roadAt = new Uint8Array(W1 * (h + 1)),
      footOnly = new Uint8Array(W1 * (h + 1));
    for (let j = 0; j <= h; j++)
      for (let i = 0; i <= w; i++) {
        const q = mapgenCellAt(G, i, j);
        if (G.F[q] & 1 && !(G.F[q] & 8) && !E[j * W1 + i]) {
          roadAt[j * W1 + i] = 1;
          if (footSpoke && Math.hypot(i - footSpoke[0], j - footSpoke[1]) < 4) footOnly[j * W1 + i] = 1;
        }
      }
    const sT = salt('trail');
    let path = goal >= 0 ? mapgenTrailSearch(G, goal, k => !!footOnly[k], sT) : null;
    if (!path && goal >= 0) path = mapgenTrailSearch(G, goal, k => !!roadAt[k], sT + 1);
    if (path && path.length >= 4) mapgenCarveTrail(G, path, 'v');
    else notes.push('no way up the mountain was found: no trail');
  }

  /* ---------- the built zones flat again (the paths' flattening blends a few metres into them): level, no steps,
     no path ---------- */
  zones.forEach((Z, k) => {
    if (!ISLAND_GEN_BUILT.includes(Z.k)) return;
    for (let j = 0; j <= h; j++)
      for (let i = 0; i <= w; i++) if (islandPointIn(Z.poly, i, j)) G.H[j * W1 + i] = zoneLevel[k];
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++)
        if (islandPointIn(Z.poly, i + 0.5, j + 0.5)) {
          G.F[j * w + i] = 0;
          for (const q of [0, 1, W2, W2 + 1]) {
            G.S[j * 2 * W2 + i * 2 + q] = 0;
            G.M[j * 2 * W2 + i * 2 + q] = 0;
          }
        }
  });

  /* ---------- ground: the terrain kinds ---------- */
  const sG = salt('ground'),
    O4 = D.organic,
    nz = (i, j, sc, k) => mapgenFbm(i / sc, j / sc, sG + k);
  /* how far each cell is from the pond and the stream (up to 6 m): the ground is lusher there */
  const wetD = new Float32Array(w * h).fill(99);
  for (const [px, pz] of wetPts)
    for (let j = Math.max(0, Math.floor(pz - 6)); j < Math.min(h, Math.ceil(pz + 6)); j++)
      for (let i = Math.max(0, Math.floor(px - 6)); i < Math.min(w, Math.ceil(px + 6)); i++)
        wetD[j * w + i] = Math.min(wetD[j * w + i], Math.hypot(i + 0.5 - px, j + 0.5 - pz));
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const q = j * w + i;
      if (G.F[q] & (1 | 4 | 64)) continue;
      const x = i + 0.5,
        z = j + 0.5,
        [d, t] = polar(x, z),
        s = coastAt(t) - d,
        bw = arrAt(beachW, t),
        cw = arrAt(cliffW, t),
        e = D.mountain.peak > 0 ? Eat(x, z) / D.mountain.peak : 0,
        zk = zones.find(Z => ISLAND_GEN_BUILT.includes(Z.k) && islandPointIn(Z.poly, x, z)),
        /* the arcs (forest, dunes, heath) read at a warped angle, so their ends are ragged, not straight lines out */
        tw = t + (nz(i, j, 14, 30) - 0.5) * 40 * O4,
        /* every edge a little ragged */
        jit = (nz(i, j, 2.2, 31) - 0.5) * 2 * O4;
      let ch;
      if (zk)
        ch =
          zk.k === 'pasture'
            ? nz(i, j, 3, 32) > 0.7 - 0.1 * O4
              ? 'C'
              : 'l'
            : nz(i, j, 4, 41) > 0.7 - 0.06 * O4
              ? 'G'
              : 'g';
      else if (e > 0.02) {
        if (e > 0.55) ch = nz(i, j, 5, 1) > 0.58 ? 'r' : nz(i, j, 4, 33) > 0.62 ? 'H' : 'C';
        else if (e > 0.14) ch = nz(i, j, 4, 2) > 0.5 ? 'r' : nz(i, j, 6, 3) > 0.55 ? 'C' : 'P';
        else ch = nz(i, j, 3, 4) > 0.45 + jit * 0.1 ? 'P' : 'G';
      } else if (cw > 0.3 && s < 2.6 + jit) ch = s < 1 ? '3' : 'j';
      else if (s < 1.4 + 0.8 * nz(i, j, 3, 5) + jit * 0.5) {
        if (bw - D.shore * 0.5 < 1.2 && cw < 0.3) ch = 'S';
        else if (bw < 1.6) ch = nz(i, j, 2.5, 6) > 0.55 ? '2' : '3';
        else ch = 'S';
      } else if (s < bw + jit * 1.5)
        ch =
          islandArcWeight(tw, D.dunes.a, D.dunes.span) > 0.4 && nz(i, j, 3, 7) > 0.6
            ? 'B'
            : nz(i, j, 2, 34) > 0.8
              ? 'P'
              : 's';
      else {
        const fd = d - footAt(t),
          /* the belt thins out with noise toward its far edge instead of stopping on a line */
          deep = D.forest.deep * (0.75 + 0.5 * nz(i, j, 12, 35)),
          fw =
            islandArcWeight(tw, D.forest.a, D.forest.span) *
            (1 - mapgenSmooth(mapgenBetween((fd - deep + 6) / 12, 0, 1))) *
            (s > bw + 4 ? 1 : 0),
          /* groves out in the open, clearings in the forest */
          grove = s > bw + 6 && nz(i, j, 6, 36) > 0.74 - 0.06 * O4,
          clearing = nz(i, j, 7, 37) > 0.78,
          dunes = islandArcWeight(tw, D.dunes.a, D.dunes.span),
          heath = islandArcWeight(tw, D.heath.a, D.heath.span),
          wet = wetD[q];
        if (wet < 2.5 + jit) ch = nz(i, j, 2, 38) > 0.5 ? 'M' : 'C';
        else if (((fw > 0 && nz(i, j, 9, 8) * fw > 1 - D.forest.density * 0.9) || grove) && !clearing) {
          if (fd < 7 + jit * 2) ch = nz(i, j, 4, 9) > 0.45 ? 'F' : 'y';
          else {
            const v = nz(i, j, 4, 10);
            ch = v > 0.62 ? 'L' : v < 0.38 ? 'M' : 'y';
          }
        } else if (dunes > 0.4 && s < bw + 7 + jit * 2) ch = nz(i, j, 3, 11) > 0.45 ? 'B' : 's';
        else if (heath > 0.3 && nz(i, j, 8, 12) * heath > 0.35) ch = nz(i, j, 3, 13) > 0.6 ? 'B' : 'H';
        else if (s > bw + 6 && nz(i, j, 3.5, 20) > 0.8 - 0.04 * O4) ch = nz(i, j, 1.5, 21) > 0.5 ? 'r' : 'P';
        else if (wet < 5) ch = nz(i, j, 3, 39) > 0.5 ? 'E' : 'G';
        else {
          const v = nz(i, j, 7, 14),
            v2 = nz(i, j, 3, 40);
          ch = v > 0.64 ? 'E' : v < 0.36 ? (v2 > 0.62 ? 'C' : 'g') : v2 > 0.72 ? 'f' : 'G';
        }
      }
      G.T[q] = ch;
    }
  /* the rock at a shelf's top (mapgen's), after the trail is in */
  if (shelves) mapgenRockEdges(G);

  /* ---------- the kept zones: their ground exactly as it was ---------- */
  if (kept.length && prev) {
    const PG = islandDecodeGround(prev);
    for (const Z of kept) {
      for (let j = 0; j < Math.min(h, PG.h); j++)
        for (let i = 0; i < Math.min(w, PG.w); i++) {
          if (!islandPointIn(Z.poly, i + 0.5, j + 0.5)) continue;
          const q = j * w + i,
            ch = PG.T[j * PG.w + i];
          G.T[q] = ch;
          G.F[q] = 'wd'.includes(ch) ? 4 : 0;
          for (const [ci, cj] of [
            [i, j],
            [i + 1, j],
            [i, j + 1],
            [i + 1, j + 1],
          ])
            G.H[cj * W1 + ci] = PG.H[cj * (PG.w + 1) + ci];
        }
      for (let j = 0; j < Math.min(h, PG.h) * 2; j++)
        for (let i = 0; i < Math.min(w, PG.w) * 2; i++) {
          if (!islandPointIn(Z.poly, Math.floor(i / 2) + 0.5, Math.floor(j / 2) + 0.5)) continue;
          const pq = j * PG.w * 2 + i;
          G.S[j * W2 + i] = PG.S ? PG.S[pq] / 20 : 0;
          G.M[j * W2 + i] = PG.M ? PG.M[pq] : 0;
          if (G.S[j * W2 + i]) G.stepsUsed = true;
        }
    }
  }

  /* ---------- water sits under its banks (mapgen's; the stream follows the land, the sea is level) ---------- */
  mapgenLowerWater(G);

  /* ---------- the zones ---------- */
  const ring = (rOf, n, a0 = 0, a1 = 360) => {
    const out = [],
      step = (a1 - a0) / (a1 - a0 >= 360 ? n : n - 1);
    for (let k = 0; k < n; k++) out.push(islandRound2pt(at(rOf(a0 + k * step), a0 + k * step)));
    return out;
  };
  if (Rf > 0) zones.push({ k: 'mountain', poly: ring(footAt, 36), lock: false });
  if (D.forest.span > 0 && D.forest.deep > 0) {
    const a0 = D.forest.a - D.forest.span / 2,
      a1 = D.forest.a + D.forest.span / 2,
      n = Math.max(4, Math.round(D.forest.span / 4));
    const sF = salt('ground', 'forest'),
      outer = ring(
        t =>
          Math.min(
            footAt(t) + D.forest.deep * (0.8 + 0.4 * D.organic * mapgenNoise(t / 15, 1.3, sF)),
            coastAt(t) - arrAt(beachW, t) - 4
          ),
        n,
        a0,
        a1
      ),
      inner = ring(t => footAt(t) + 1, n, a0, a1).reverse();
    zones.push({ k: 'forest', poly: [...outer, ...inner], lock: false });
  }
  if (D.cove.on) {
    const half = D.cove.span / 2,
      n = Math.max(6, Math.round(D.cove.span / 3));
    /* the water between the shore and an arc out at sea past the mouth (never crossing itself, however wide) */
    let out = 0;
    for (let t = D.cove.a - half; t <= D.cove.a + half; t++) out = Math.max(out, coastAt(t));
    zones.push({
      k: 'cove',
      poly: [
        ...ring(coastAt, n, D.cove.a - half, D.cove.a + half),
        ...ring(() => out + 3, n, D.cove.a - half, D.cove.a + half).reverse(),
      ],
      lock: false,
    });
  }
  for (const B of D.beaches) {
    const n = Math.max(4, Math.round(B.span / 5)),
      a0 = B.a - B.span / 2,
      a1 = B.a + B.span / 2;
    zones.push({
      k: 'beach',
      poly: [...ring(t => coastAt(t) + 1, n, a0, a1), ...ring(t => coastAt(t) - arrAt(beachW, t), n, a0, a1).reverse()],
      lock: false,
    });
  }
  /* a zone of the scene's: on it, never crossing itself (islandProblems checks the rest) */
  for (const Z of zones) Z.poly = Z.poly.map(p => [mapgenBetween(p[0], 0, w), mapgenBetween(p[1], 0, h)]);

  /* ---------- the scene ---------- */
  const tiles = [];
  for (let j = h - 1; j >= 0; j--) tiles.push(G.T.slice(j * w, (j + 1) * w).join(''));
  const heights = [];
  for (let j = h; j >= 0; j--) heights.push(Array.from(G.H.subarray(j * W1, (j + 1) * W1), v => mapgenRound2(v) || 0));
  const town = zones.find(Z => Z.k === 'town') || zones.find(Z => ISLAND_GEN_BUILT.includes(Z.k));
  let hub = [c[0], c[1] - Rf - 8];
  if (town) {
    hub = [0, 0];
    for (const p of town.poly) hub = [hub[0] + p[0] / town.poly.length, hub[1] + p[1] / town.poly.length];
  }
  const summit = G.spots.find(S => S.kind === 'summit');
  if (dock)
    spots.push({
      kind: 'dock',
      x: mapgenRound2(dock[0]),
      z: mapgenRound2(dock[1]),
      y: mapgenRound2(G.H[mapgenBetween(Math.round(dock[1]), 0, h) * W1 + mapgenBetween(Math.round(dock[0]), 0, w)]),
    });
  /** @type {any} */
  const sc = {
    name: 'Island (generated)',
    kind: 'test',
    test: 1,
    w,
    h,
    edge: 'w',
    waterKind: 'sea',
    far: 'sea',
    farH: 5,
    flatFar: 1,
    cam: {
      pitch: 34,
      h: 9,
      fov: 1,
      orbit: { c: islandRound2pt(summit ? [summit.x, summit.z] : c), dead: 3, lag: 0.6, turn: 30 },
    },
    island: { c: islandRound2pt(c), coast },
    zones: zones.map(Z => ({ k: Z.k, poly: Z.poly.map(islandRound2pt), ...(Z.lock ? { lock: true } : {}) })),
    islandGen: { v: ISLAND_GEN_VERSION, seed: SEED, dials: D },
    hub: islandRound2pt(hub),
    exits: [],
    tiles,
    heights,
    props: [],
  };
  if (G.streams.length) sc.streams = G.streams;
  if (bridges.length) sc.bridges = bridges;
  const allSpots = [...G.spots, ...spots];
  if (allSpots.length) sc.spots = allSpots;
  if (G.stepsUsed) {
    const raw = new Int16Array(G.S.length);
    let any = false;
    for (let i = 0; i < raw.length; i++) if ((raw[i] = Math.round(G.S[i] * 20))) any = true;
    if (any) {
      sc.steps = mapgenEncodeBase64(new Uint8Array(raw.buffer));
      sc.stepm = mapgenEncodeBase64(G.M);
    }
  }
  /* the paths as lines (not stored in the scene, whose ground shows them): the tool's lap and the tests read them */
  const paths = roads.map(r => ({ name: r.name, pts: r.pts.map(islandRound2pt) }));
  return { scene: sc, notes, paths };
}
