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
  ISLAND_BRIDGES: [() => ISLAND_BRIDGES],
  ISLAND_BRIDGE_GAP: [() => ISLAND_BRIDGE_GAP],
  ISLAND_CRAG: [() => ISLAND_CRAG],
  ISLAND_DETOUR: [() => ISLAND_DETOUR],
  ISLAND_GEN_BUILT: [() => ISLAND_GEN_BUILT],
  ISLAND_GEN_DEFAULTS: [() => ISLAND_GEN_DEFAULTS],
  ISLAND_GEN_STAGES: [() => ISLAND_GEN_STAGES],
  ISLAND_GEN_VERSION: [() => ISLAND_GEN_VERSION],
  ISLAND_MOUTH_W: [() => ISLAND_MOUTH_W],
  ISLAND_POND_TURN: [() => ISLAND_POND_TURN],
  ISLAND_RAD: [() => ISLAND_RAD],
  ISLAND_RIVER_W: [() => ISLAND_RIVER_W],
  ISLAND_SEA_BED: [() => ISLAND_SEA_BED],
  ISLAND_TOWN_EXTRA: [() => ISLAND_TOWN_EXTRA],
  ISLAND_VALLEY: [() => ISLAND_VALLEY],
  SKY_RAIL: [() => SKY_RAIL],
  STATION_PLOT: [() => STATION_PLOT],
  STATION_TURN: [() => STATION_TURN],
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
  // @ts-expect-error -- replaced on purpose
  stationLandmarks: [() => stationLandmarks, v => (stationLandmarks = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* 1: IS-2's first island; 2: a natural layout (the owner: more natural and dynamic): rounded zones, headlands and
   bays, a ridged massif with a shoulder, wandering shelves, curved paths, groves, outcrops and wet ground; 3: IS-5's
   wild grass; 4: the look pass (the owner): the sea up to the sand, the river into the bay's head down a valley,
   wider at its mouth, at most two bridges, the run maps' ridged mountain, ragged shelves, forest up its foot */
export const ISLAND_GEN_VERSION = 4;
export const ISLAND_GEN_STAGES = ['coast', 'heights', 'mountain', 'water', 'paths', 'trail', 'ground', 'wild'];
/* the look pass (the owner): the river's width upstream and at its mouth, and how far out its valley's sides run, in
   metres; the open sea's bed, so its water lies a little under the sand at the waterline (it sat ~1.8 m down) */
export const ISLAND_RIVER_W = 3;
export const ISLAND_MOUTH_W = 7;
export const ISLAND_VALLEY = 10;
/* how far round the mountain's foot from the bay's head the pond lies, in degrees (the river's length) */
/* the most bridges over the river, how far apart (metres), and the longest way (metres along the river) a path is led
   along the bank to a bridge instead of crossing where it did */
export const ISLAND_BRIDGES = 2;
export const ISLAND_BRIDGE_GAP = 25;
export const ISLAND_DETOUR = 40;
export const ISLAND_POND_TURN = 60;
export const ISLAND_SEA_BED = -0.1;
/* how deep the mountain's crags cut into its smooth shape (0-1, the run maps' ridged recipe) */
export const ISLAND_CRAG = 0.45;
/* the zones a dial places as a rectangle (flat, empty and locked: the town and the barn are built there by hand) */
export const ISLAND_GEN_BUILT = ['town', 'barn', 'pasture'];

/** HB-4a: the town's other buildings (town.extra): plot sizes [width, width, depth, depth] */
/** HB-4b: the station's plot (w across its front, d deep), metres */
export const STATION_PLOT = [14, 8];
/** cutscenes track A: the station faces out (its front, the platform side, to the sea), where the hub's orbit camera
    stands looking in at it, so you see it from the front; its track runs along behind it (radians, from facing out) */
export const STATION_TURN = 0;
/** cutscenes track A: the track (tools/build-station-trains.py), from the station's right-hand end: `from`, the track's
    start from the station plot's middle in metres [toward its right-hand end, behind it] (train_station stands in the
    middle of its plot, 6.6 m deep, its track 6.1 m behind its front and its right-hand end 6.3 m out); `piece` metres a
    piece, one piece per look of sky_rail (the last, `end`, has the buffer stop), all of it `height` over the station's
    ground; `back` how far the track runs back past the start (the station's own, to its left-hand end); then
    sky_portal, floating on its own: `tear` [metres along from the start, metres out in front of the track, its middle's
    height over the station's ground] */
export const SKY_RAIL = {
  from: [6.3, 2.8],
  piece: 12,
  looks: ['end'],
  back: 12.6,
  height: 0.13,
  tear: [-2, 30, 20],
};
/** cutscenes track A: the station's landmarks from its plot (x, z its middle, a its front's angle in radians, y its
    level): `rail`, the track every 2 m from its left-hand end to the buffer stop [x, z, height], and `portal`, the
    portal's middle [x, z, height]
    @param {{ x: number, z: number, a: number, y: number }} L @returns {{ rail: number[][], portal: number[] }} */
export function stationLandmarks(L) {
  const fx = Math.cos(L.a),
    fz = Math.sin(L.a),
    /* u metres toward the right-hand end from the plot's middle, w metres behind it */
    at = (/** @type {number} */ u, /** @type {number} */ w, /** @type {number} */ h) => [
      mapgenRound2(L.x - fz * u - fx * w),
      mapgenRound2(L.z + fx * u - fz * w),
      mapgenRound2(L.y + h),
    ],
    end = SKY_RAIL.piece * SKY_RAIL.looks.length,
    ss = [];
  for (let u = -SKY_RAIL.back; u < end; u += 2) ss.push(u);
  ss.push(end);
  return {
    rail: ss.map(u => at(SKY_RAIL.from[0] + u, SKY_RAIL.from[1], SKY_RAIL.height)),
    portal: at(SKY_RAIL.from[0] + SKY_RAIL.tear[0], SKY_RAIL.from[1] - SKY_RAIL.tear[1], SKY_RAIL.tear[2]),
  };
}
export const ISLAND_TOWN_EXTRA = {
  inn: [10, 12, 8, 9],
  workshop: [9, 10, 7, 8],
  genebank: [9, 10, 8, 9],
  library: [10, 11, 8, 9],
};
/** the dials (IS-6b shows them): sizes in metres, angles in degrees (0 east, 90 north, 270 south) */
export const ISLAND_GEN_DEFAULTS = {
  /* the land's radius round the middle (the coast is pushed out further round the zones), how much the coast wobbles
     (0-1), the open sea between the coast and the scene's edge, how long the island is (0-1: up to 1.3 times its
     width), its big lobes and a peninsula (0-1) */
  size: { r: 66, wobble: 0.35, sea: 10, stretch: 0.5, lobes: 0.8 },
  /* how natural every shape is (0-1): 0 is plain geometry (round coast, rectangles, a cone, straight spokes); up from
     there headlands and bays, rounded uneven zones, a warped massif, wandering shelves and paths, ragged ground */
  organic: 0.7,
  /* the mountain in the middle: the radius of its foot, its peak, how tall its shelves are (0-1: 0.8-2 m, the cliffs),
     how long it runs along its ridge (0-1: up to 1.45 times its width), a shoulder peak along the ridge (0-1 of the
     peak's height, times 0.6), a range of lower peaks and ridges round it (0-1: 2 to 6 of them, a third to a half of
     its height), kept away from the biggest zone and the cove */
  mountain: { r: 22, peak: 24, cliffs: 0.5, stretch: 0.6, shoulder: 0.6, range: 0.9 },
  /* rolling land (0-1: up to 1.6 m) and the foot hills round the mountain */
  hills: 0.4,
  /* the cove: cut into the coast; its middle's angle, its width in degrees, its depth, the deep channel from the dock
     out to the open sea (0 for none), its inner beach's width, its shape ('bay' wide and rounded, 'cove' a horseshoe
     with steep sides) */
  cove: { on: 1, a: 300, span: 60, depth: 18, channel: 6, beach: 7, shape: 'bay' },
  /* the beach's width where no beach arc is (the narrow shore) and the long beaches (an angle, a width in degrees) */
  shore: 3,
  beaches: [{ a: 185, span: 60, w: 10 }],
  /* cliffs along the coast: angle, width in degrees, height */
  cliffs: [
    { a: 60, span: 26, h: 7 },
    { a: 245, span: 16, h: 5 },
  ],
  /* dunes behind the sand and heath inland: angle, width in degrees */
  dunes: { a: 250, span: 26 },
  heath: { a: 20, span: 40 },
  /* the forest belt round the mountain's foot: angle, width in degrees, how deep it runs from the foot, density 0-1 */
  forest: { a: 110, span: 180, deep: 22, density: 0.8 },
  /* the stream from a pond at the mountain's foot down to the cove (a small fall where it leaves the pond) */
  stream: { on: 1, pond: 4, fall: 0.8 },
  /* the paths: the loop round the coast and its spokes; how far inland from the beach the loop runs at least, how
     freely it wanders (0-1: inland by up to 14 m, across headlands rather than round them) */
  paths: { width: 2.2, inland: 3, wander: 0.6 },
  /* the flat zones: kind, angle and distance of the middle from the island's middle, width (across) and depth (toward
     the middle), the height they lie at */
  zones: [
    { k: 'barn', a: 215, d: 42, w: 18, h: 16 },
    { k: 'pasture', a: 195, d: 48, w: 26, h: 20 },
  ],
  /* the town (the owner, after the sketches: a market town on the river, a harbour quarter on the bay): it stands
     where the stream comes down into the bay; its streets, square, bridges and plots are laid out on the land as it
     is, with a level pad under each plot only. houses: how many house plots it aims for; lanes: side lanes. A town
     zone in the zones above makes the old flat town instead. face (HB-4a): 'street' puts plots on both sides of a
     street; 'out' keeps only a side whose front lies within tol degrees of facing out from the orbit's pivot (the
     summit), so the orbit camera sees the doors. quarter (HB-4a, 0-1): 1 turns every building's plot to the quarter turn
     (0, 90, 180, 270) nearest to facing out from the pivot, so its room stays square with its walls. second (HB-4a): a
     second built-up street, off metres beside one of the town's streets (along: 'quay', 'cross' or 'main', or 'arc':
     a line round the pivot through the square, span degrees long, its middle turned at degrees round the pivot from
     the square, so the street runs round the mountain), on its side toward the pivot ('in') or away from it ('out';
     on the main street 'out' is away from the river), joined to that street at both ends; houses line it as they
     line the others. scale (HB-4a): the house plots' size, times (0.6-1.2; smaller makes a denser town). extra
     (HB-4a): the town's other buildings, from ISLAND_TOWN_EXTRA, on its streets nearest the square. square (HB-4b):
     the square's radius r (metres), off: metres further from the main street (room for a row of plots between them,
     facing the square), and how many plots stand round it (front: the town's other buildings first, then houses),
     those facing into it first, turned to face out from the pivot (quarter) */
  town: {
    on: 1,
    houses: 7,
    lanes: 2,
    face: 'street',
    tol: 50,
    quarter: 0,
    second: { on: 0, along: 'quay', side: 'in', off: 15, span: 70, at: 0 },
    scale: 1,
    extra: [],
    square: { r: 7.5, off: 0, front: 0 },
  },
  /* HB-4a: the landmarks round the town, for the hub track (on 0: none). station: the train station on the headland by
     the town that stands out furthest (a: its angle round the middle, -1 to pick; len and rise, the sky rail's length
     and climb, unused since the rail follows HB-7's pieces: SKY_RAIL); lighthouse: on an arm of the cove (arm 1 or -1; 0 the one
     further from the station); windmill: beside the farm (0 none); shore: how far every landmark keeps from the water
     (metres), room for the water track's tide and wading shallows (docs/phases/water-track.md WA-4, WA-6a) */
  landmarks: { on: 0, station: { a: -1, len: 70, rise: 45 }, lighthouse: { arm: 0 }, windmill: 1, shore: 3 },
  /* a hamlet: a few houses round a green under the mountains, joined to the coast road (off since the look pass: the
     owner, a smaller island) */
  hamlet: { on: 0, houses: 4 },
  /* IS-5: where wild Billies wait: n patches of tall grass (15-70 m² each, as a run's) out on the meadow and heath by
     the forest, never in the town, the hamlet, the barn's or the pasture's zones, on the beach, a path or a slope */
  wild: { n: 4 },
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
  D.town.on = D.town.on ? 1 : 0;
  D.town.houses = Math.round(num(D.town.houses, 0, 40, 14));
  D.town.lanes = Math.round(num(D.town.lanes, 0, 6, 3));
  if (D.town.face !== 'out') D.town.face = 'street';
  D.town.tol = num(D.town.tol, 10, 90, 50);
  D.town.quarter = D.town.quarter ? 1 : 0;
  D.town.scale = num(D.town.scale, 0.6, 1.2, 1);
  D.town.extra = (Array.isArray(D.town.extra) ? D.town.extra : []).filter(k => ISLAND_TOWN_EXTRA[k]);
  if (!D.town.square || typeof D.town.square !== 'object') D.town.square = {};
  D.town.square.r = num(D.town.square.r, 5, 20, 7.5);
  D.town.square.off = num(D.town.square.off, 0, 20, 0);
  D.town.square.front = Math.round(num(D.town.square.front, 0, 8, 0));
  const LM = D.landmarks;
  LM.on = LM.on ? 1 : 0;
  LM.station.a = LM.station.a < 0 ? -1 : islandAngle(num(LM.station.a, -720, 720, 0));
  LM.station.len = num(LM.station.len, 10, 200, 70);
  LM.station.rise = num(LM.station.rise, 0, 120, 45);
  LM.lighthouse.arm = Math.sign(num(LM.lighthouse.arm, -1, 1, 0));
  LM.windmill = LM.windmill ? 1 : 0;
  LM.shore = num(LM.shore, 0, 10, 3);
  if (!D.town.second || typeof D.town.second !== 'object') D.town.second = { on: 0 };
  D.town.second.on = D.town.second.on ? 1 : 0;
  if (!['quay', 'cross', 'main', 'arc'].includes(D.town.second.along)) D.town.second.along = 'quay';
  D.town.second.span = num(D.town.second.span, 20, 140, 70);
  D.town.second.at = num(D.town.second.at, -120, 120, 0);
  if (D.town.second.side !== 'out') D.town.second.side = 'in';
  D.town.second.off = num(D.town.second.off, 9, 30, 15);
  D.hamlet.on = D.hamlet.on ? 1 : 0;
  D.hamlet.houses = Math.round(num(D.hamlet.houses, 0, 10, 4));
  D.wild.n = Math.round(num(D.wild.n, 0, 12, 5));
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
    kept = (prev && Array.isArray(prev.zones) ? prev.zones : []).filter(Z => Z && Z.lock && Z.poly),
    /* a flat zone: the barn, the pasture; a town only when the dials ask for the old flat one */
    flatKind = k => ISLAND_GEN_BUILT.includes(k) && (k !== 'town' || D.zones.some(Z => Z.k === 'town'));
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
    /* the kept flat zones need their room again; a kept town or hamlet was laid on land the coast already had */
    pushOut(
      kept.filter(Z => flatKind(Z.k)).map(Z => Z.poly),
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
    /* too big for a scene (260 m at most): the whole coast drawn in to fit */
    const fit = (260 - 2 * D.size.sea - 2) / Math.max(x1 - x0, z1 - z0);
    if (fit < 1) {
      for (let t = 0; t < 360; t++) coastR[t] = Math.max(coastR[t] * fit, need[t]);
      x0 *= fit;
      z0 *= fit;
      x1 *= fit;
      z1 *= fit;
      notes.push(`the island was drawn in to ${Math.round(fit * 100)}% to fit a 260 m scene`);
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
  /* a flat zone shapes the land round it from the start; a kept town or hamlet joins the list at the end, as a new one does (so a run that keeps them makes the rest
     as a fresh run would) */
  const keptPlaces = kept
      .filter(Z => !flatKind(Z.k))
      .map(Z => ({ k: Z.k, poly: Z.poly.map(p => p.slice(0, 2)), lock: true })),
    zones = [
      ...built.map(Z => ({ k: Z.k, poly: Z.poly.map(p => islandRound2pt([p[0] + c[0], p[1] + c[1]])), lock: true })),
      ...kept.filter(Z => flatKind(Z.k)).map(Z => ({ k: Z.k, poly: Z.poly.map(p => p.slice(0, 2)), lock: true })),
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

  /* the stream comes into the bay's head (the owner, look pass: at a logical point, the bay's innermost end) and the
     town stands on both banks round its mouth, the dock to one side (chosen here, before the mountain, whose spurs keep
     clear of the town) */
  const side = rng('town').chance(0.5) ? 1 : -1,
    streamA = D.cove.a,
    dockA = streamA - side * Math.min(14, D.cove.span * 0.24);
  /* ---------- the mountain: a quarter smooth land, the rest step-grid shelves (as TR-2's mapgenMountains) ---------- */
  /* a massif, not a cone: stretched along a ridge that runs across the island (square to the biggest flat zone, so it
     leans away from the town), its peak a little off the middle, a shoulder peak along the ridge, its outline and
     slopes warped by noise; a flat top 3.5 m round (the summit lookout) where the trail ends */
  const sM = salt('mountain'),
    rM = rng('mountain'),
    E = new Float32Array(W1 * (h + 1)),
    /* the smooth shape under the craggy one: the walkable quarter of the height (the trail climbs it) */
    E0 = new Float32Array(W1 * (h + 1)),
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
    awayFrom = [bigA, ...(D.cove.on ? [D.cove.a] : []), ...(D.cove.on && D.stream.on && D.town.on ? [streamA] : [])],
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
    /* away from the town (so the stream has its length), else a little off the middle at random */
    away = D.cove.on && D.stream.on && D.town.on ? Rf * 0.8 : 0,
    peakP = [
      c[0] + Math.cos(lean) * off - Math.cos(streamA * ISLAND_RAD) * away,
      c[1] + Math.sin(lean) * off - Math.sin(streamA * ISLAND_RAD) * away,
    ],
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
        let e = 0,
          e0 = 0;
        /* the look pass: the run maps' mountain recipe (mapgen.js mapgenMountainField, copied, not shared): ridged noise
           on ground warped by noise, so the ridges bend and the slopes are craggy; full height on the flat top */
        const rx = i + (mapgenFbm(i / 30, j / 30, sM + 11) - 0.5) * 24 * O3,
          rz = j + (mapgenFbm(i / 30, j / 30, sM + 13) - 0.5) * 24 * O3,
          rr = mapgenRidged(rx / 22, rz / 22, sM + 41);
        /* the crags cut down from the smooth shape (never above it), most on the lower and middle slopes, none on the
           top, so the trail (which climbs the smooth shape) meets the summit at its own height */
        const crag = f => 1 - ISLAND_CRAG * (1 - rr) * (1 - mapgenSmooth(mapgenBetween((f - 0.55) / 0.4, 0, 1)));
        if (dn < 1) {
          const f = Math.min(1, (1 - dn) / (1 - topF));
          e0 = D.mountain.peak * Math.pow(f, 1.1) * (0.8 + 0.2 * mapgenRidged(i / 16, j / 16, sM + 41) * (1 - 0.6 * f));
          e = e0 * crag(f);
        }
        if (shH > 0) {
          const ds = (Math.hypot(i - shP[0], j - shP[1]) / (Rf * 0.55)) * rag;
          if (ds < 1) {
            const v = D.mountain.peak * shH * Math.pow(1 - ds, 1.3);
            e = Math.max(e, v * crag(0));
            e0 = Math.max(e0, v);
          }
        }
        for (const F of range) {
          /* the distance to the spur's line, and how far along it (its height falls away from the mountain) */
          const px = wx + peakP[0],
            pz = wz + peakP[1],
            vx = F.b[0] - F.a[0],
            vz = F.b[1] - F.a[1],
            u = mapgenBetween(((px - F.a[0]) * vx + (pz - F.a[1]) * vz) / (vx * vx + vz * vz), 0, 1),
            ds = (Math.hypot(px - F.a[0] - vx * u, pz - F.a[1] - vz * u) / (F.r * (1 - 0.35 * u))) * rag;
          if (ds < 1) {
            const v = (F.h0 + (F.h1 - F.h0) * u) * Math.pow(1 - ds, 1.2);
            e = Math.max(e, v * crag(0));
            e0 = Math.max(e0, v);
          }
        }
        if (e <= 0 && e0 <= 0) continue;
        let keep = 1;
        for (const Z of zones) keep *= mapgenSmooth(mapgenBetween((islandPolyDist(Z.poly, i, j, 12) - 5) / 6, 0, 1));
        E[j * W1 + i] = e * keep * (inLand(i, j) ? 1 : 0);
        E0[j * W1 + i] = e0 * keep * (inLand(i, j) ? 1 : 0);
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
  for (let q = 0; q < E.length; q++) G.H[q] += E0[q] * SMOOTH;
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
        /* the shelves' edges wander (not rings): an offset by noise at two sizes, none on the flat top (the look
           pass: raggeder, so they read as rock bands, not contour lines) */
        wob =
          e > 0.3
            ? band *
              1.3 *
              O3 *
              (mapgenFbm(x / 5, z / 5, sM + 17) - 0.5 + 0.8 * (mapgenFbm(x / 14, z / 14, sM + 19) - 0.5)) *
              mapgenBetween(1.2 - e / D.mountain.peak, 0, 1)
            : 0,
        n = Math.floor((e * (1 - SMOOTH) + wob) / band);
      if (n > 0) {
        G.S[j * W2 + i] += n * band;
        shelves++;
      }
    }
  /* mapgen's trail search and carving read the mountain's level from G.mtnE: the smooth shape, so the trail climbs
     past the crags (cut into them where they stand in its way) */
  G.mtnE = E0;
  if (shelves) {
    G.relief = true;
    G.stepsUsed = true;
  }

  /* ---------- water: the pond at the mountain's foot, the stream down to the cove with a small fall ---------- */
  const spots = /** @type {{ kind: string, x: number, z: number, y: number }[]} */ ([]);
  const rW = rng('water'),
    wetPts = /** @type {number[][]} */ ([]);
  let river = /** @type {number[][] | null} */ (null);
  if (D.stream.on && D.cove.on) {
    /* the look pass: the pond sits round the mountain's foot from the bay's head (away from the dock's side), so the
       river comes down a longer, curving valley */
    const ta = streamA + side * ISLAND_POND_TURN + rW.range(-6, 6),
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
      /* a curve from the pond to past the bay's head: bent round the mountain's foot (its middle a third of the way
         from the bay's head toward the pond, at the middle radius), wobbling a little */
      const [mx, mz] = at(back + 3, streamA + rW.range(-2, 2)),
        [cx, cz] = at((pd + back) / 2 + 4, streamA + side * ISLAND_POND_TURN * 0.3),
        ns = salt('water', 'stream'),
        bez = f => [
          (1 - f) * (1 - f) * px + 2 * (1 - f) * f * cx + f * f * mx,
          (1 - f) * (1 - f) * pz + 2 * (1 - f) * f * cz + f * f * mz,
        ],
        raw = [];
      for (let k = 0; k <= 60; k++) {
        const f = k / 60,
          [x, z] = bez(f),
          [x1, z1] = bez(Math.min(1, f + 0.01)),
          [x0, z0] = bez(Math.max(0, f - 0.01)),
          tl = Math.hypot(x1 - x0, z1 - z0) || 1,
          off = (mapgenNoise(f * 3, 2.1, ns) - 0.5) * 6 * Math.sin(Math.PI * f);
        if (Math.hypot(x - px, z - pz) < pr - 0.5) continue;
        raw.push([x - ((z1 - z0) / tl) * off, z + ((x1 - x0) / tl) * off]);
      }
      const pts = mapgenResample(raw, 0.5),
        n = pts.length,
        fall = Math.min(D.stream.fall, Math.max(0, lvl - 0.4)),
        start = lvl - fall;
      /* the bed: the pond's level, a drop of `fall` over the first metre (the small fall), then down to the sea. The
         look pass: the river runs in a small valley (a gentle rise either side, ISLAND_VALLEY metres out) and widens
         toward its mouth (ISLAND_RIVER_W to ISLAND_MOUTH_W over the last third) */
      const halfW = k => {
        const f = k / (n - 1);
        return (
          (ISLAND_RIVER_W + (ISLAND_MOUTH_W - ISLAND_RIVER_W) * mapgenSmooth(mapgenBetween((f - 0.66) / 0.34, 0, 1))) /
          2
        );
      };
      for (let k = 0; k < n; k++) {
        const f = k / (n - 1),
          y = k < 2 ? lvl - (fall * k) / 2 : Math.max(0, start * (1 - mapgenSmooth(f)) + 0.05),
          hw = halfW(k),
          V = k < 2 ? 3 : ISLAND_VALLEY * (0.6 + 0.4 * Math.min(1, f * 3));
        const [x, z] = pts[k];
        for (let j = Math.floor(z - hw - V); j <= Math.ceil(z + hw + V); j++)
          for (let i = Math.floor(x - hw - V); i <= Math.ceil(x + hw + V); i++) {
            if (i < 0 || j < 0 || i > w || j > h) continue;
            const dd = Math.hypot(i - x, j - z),
              c0 = j * W1 + i;
            if (dd <= hw + 0.6) G.H[c0] = Math.min(G.H[c0], y);
            else if (dd <= hw + V) {
              /* the valley's sides: up from the bank to the land round it */
              const g = mapgenSmooth((dd - hw - 0.6) / (V - 0.6));
              G.H[c0] = Math.min(G.H[c0], y + 0.25 + g * Math.max(0, G.H[c0] - y - 0.25));
            }
          }
      }
      mapgenPaintStream(G, pts, ISLAND_RIVER_W, 'water');
      /* the mouth: wider water over the last third, a wet sand bar along its banks */
      for (let k = Math.floor(n * 0.6); k < n; k++) {
        const hw = halfW(k),
          [x, z] = pts[k];
        for (let j = Math.floor(z - hw - 2); j <= Math.ceil(z + hw + 2); j++)
          for (let i = Math.floor(x - hw - 2); i <= Math.ceil(x + hw + 2); i++) {
            if (i < 0 || j < 0 || i >= w || j >= h) continue;
            const q = j * w + i,
              dc = Math.hypot(i + 0.5 - x, j + 0.5 - z);
            if (dc <= hw) {
              G.T[q] = dc < hw - 1.4 ? 'd' : 'w';
              G.F[q] = (G.F[q] & ~(2 | 32 | 64)) | 4;
            } else if (dc <= hw + 1.6 && !(G.F[q] & (1 | 4))) {
              G.T[q] = 'S';
              G.F[q] |= 64;
            }
          }
      }
      river = pts;
      wetPts.push(...pts.filter((_, k) => k % 4 === 0));
      for (let k = 0; k < 12; k++) wetPts.push(at0(pr, k * 30).map((v, m) => v + (m ? pz : px)));
      spots.push({ kind: 'fall', x: mapgenRound2(pts[1][0]), z: mapgenRound2(pts[1][1]), y: mapgenRound2(start) });
    }
  }

  /* ---------- paths: the loop round the coast, spokes to the zones, the mountain and the dock ---------- */
  /* the coast road keeps out of the flat zones; it runs through a town or a hamlet (it did when they were made) */
  const zoneAvoid = (x, z) =>
    zones.some(
      Z => ISLAND_GEN_BUILT.includes(Z.k) && Z.k !== 'town' && islandPolyDist(Z.poly, x, z) < D.paths.width / 2 + 1.2
    );
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
  /* smoothing can pull a corner of it into a zone: pushed back out toward the sea */
  lp = lp.map((p, k) => {
    const t = 180 + k;
    let q = p,
      r = polar(p[0], p[1])[0];
    for (let push = 0; push < 30 && zoneAvoid(q[0], q[1]) && r < coastAt(t) - 1.5; push++) q = at((r += 0.5), t);
    return q;
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
  /* ---------- the town's streets (the owner: a market town on the river, a harbour quarter on the bay) ---------- */
  const keptTown = kept.some(Z => Z.k === 'town'),
    keptHamlet = kept.some(Z => Z.k === 'hamlet'),
    rT = rng('town'),
    townStreets = /** @type {{ pts: number[][], width: number, main: boolean, name: string }[]} */ ([]),
    builtZones = zones.filter(Z => ISLAND_GEN_BUILT.includes(Z.k));
  /* a point a street or a plot may take: on the land, dry, off the mountain, not on the beach's edge, on the scene */
  const okAt = (x, z, m = 2) => {
    if (x < 3 || z < 3 || x > w - 3 || z > h - 3 || !inLand(x, z)) return false;
    if (G.F[mapgenCellAt(G, x, z)] & 4 || Eat(x, z) > 0.6) return false;
    if (builtZones.some(Z => islandPointIn(Z.poly, x, z))) return false;
    const [d, t] = polar(x, z);
    return coastAt(t) - d > m;
  };
  /* the longest unbroken stretch of a line whose points are all fine (or wet where `wetOk` says), holding index k */
  const stretch = (pts, k = -1, wetOk = (_p, _i) => false) => {
    const ok = pts.map((p, i) => okAt(p[0], p[1]) || wetOk(p, i));
    let best = [0, -1],
      a = 0;
    for (let i = 0; i <= pts.length; i++)
      if (i === pts.length || !ok[i]) {
        if ((k < 0 && i - a > best[1] - best[0] + 1) || (k >= a && k < i)) best = [a, i - 1];
        if (k >= a && k < i) break;
        a = i + 1;
      }
    return pts.slice(best[0], best[1] + 1);
  };
  /* a line beside another, `off` metres to its left */
  const beside = (L, off) =>
    L.slice(1, -1).map((p, i) => {
      const dx = L[i + 2][0] - L[i][0],
        dz = L[i + 2][1] - L[i][1],
        n = Math.hypot(dx, dz) || 1;
      return [p[0] - (dz / n) * off, p[1] + (dx / n) * off];
    });
  /* a curve from a to b bent `bend` metres aside in the middle, with a slow wobble */
  const bendTo = (a, b, bend, n = 24) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1,
      nx = -(b[1] - a[1]) / L,
      nz = (b[0] - a[0]) / L,
      ph = rT.range(0, 6);
    return [...Array(n + 1).keys()].map(k => {
      const f = k / n,
        o = Math.sin(Math.PI * f) * bend + Math.sin(f * 7 + ph) * 1.2 * Math.sin(Math.PI * f);
      return [a[0] + (b[0] - a[0]) * f + nx * o, a[1] + (b[1] - a[1]) * f + nz * o];
    });
  };
  const street = (pts, width, name) => {
    if (pts.length < 6) return null;
    const r = { pts: mapgenResample(pts, 0.5), width, main: true, name };
    roads.push(r);
    townStreets.push(r);
    return r.pts;
  };
  const tieToLoop = (p, name) => {
    const q = nearLoop(p[0], p[1]),
      d = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (d > 1.5 && d < 40) spoke(p, q, name);
  };
  let square = /** @type {number[] | null} */ (null),
    mainSt = /** @type {number[][] | null} */ (null),
    quaySt = /** @type {number[][] | null} */ (null);
  const sideBank = rT.chance(0.5) ? 1 : -1;
  if (D.town.on && !keptTown && river && !D.zones.some(Z => Z.k === 'town')) {
    const R = mapgenResample(river, 1),
      n = R.length;
    /* the main street along one bank, from the mountain's foot down to the bay */
    mainSt = street(
      stretch(beside(R, 7.5 * sideBank).slice(Math.floor(n * 0.03), Math.ceil(n * 0.97))),
      3.6,
      'town main street'
    );
    if (!mainSt) notes.push('no room for the town along the stream');
    else {
      /* the square beside the main street two thirds of the way down (the look pass: was half way; room for the
         second bridge up the river), away from the river; the cross street over a bridge there */
      const mid = mainSt[Math.floor(mainSt.length * 0.68)];
      let k0 = 0;
      for (let k = 0; k < n; k++)
        if (Math.hypot(R[k][0] - mid[0], R[k][1] - mid[1]) < Math.hypot(R[k0][0] - mid[0], R[k0][1] - mid[1])) k0 = k;
      const dx = R[Math.min(n - 1, k0 + 1)][0] - R[Math.max(0, k0 - 1)][0],
        dz = R[Math.min(n - 1, k0 + 1)][1] - R[Math.max(0, k0 - 1)][1],
        L = Math.hypot(dx, dz) || 1,
        nx = (-dz / L) * sideBank,
        nz = (dx / L) * sideBank,
        sqR = D.town.square.r;
      square = [mid[0] + nx * (sqR + 2.2 + D.town.square.off), mid[1] + nz * (sqR + 2.2 + D.town.square.off), sqR];
      const far = [square[0] + nx * rT.range(28, 40), square[1] + nz * rT.range(28, 40)],
        over = [R[k0][0] - nx * rT.range(26, 36), R[k0][1] - nz * rT.range(26, 36)],
        cross = [
          ...bendTo(far, square, rT.range(-5, 5)),
          ...bendTo([R[k0][0] + nx * 4, R[k0][1] + nz * 4], over, rT.range(-6, 6)),
        ],
        k1 = 24;
      /* the river may be crossed (a bridge goes in) */
      const nearRiver = p => R.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 4);
      const crossSt = street(
        stretch(cross, k1, p => nearRiver(p)),
        3.4,
        'town cross street'
      );
      /* the east bank: a lane along the river from the bridge down (the look pass: no second bridge near the bay) */
      street(stretch(beside(R.slice(k0, Math.ceil(n * 0.95)), -7.5 * sideBank)), 3, 'town east bank');
      /* the quay: along the bay's shore from the river's mouth past the dock */
      const qa = Math.min(streamA, dockA) - 8,
        qb = Math.max(streamA, dockA) + 8,
        q = [];
      for (let t = qa; t <= qb; t += 1) q.push(at(coastAt(t) - 5.5, t));
      quaySt = street(
        stretch(q, Math.floor(q.length / 2), p => nearRiver(p)),
        3.4,
        'town quay'
      );
      /* side lanes off the cross street and the main street, away from the river */
      for (let k = 0; k < D.town.lanes; k++) {
        const base = k % 2 && crossSt ? crossSt : mainSt,
          i = Math.floor(base.length * rT.range(0.2, 0.8)),
          p = base[i],
          qn = base[Math.min(base.length - 1, i + 1)],
          ddx = qn[0] - p[0],
          ddz = qn[1] - p[1],
          LL = Math.hypot(ddx, ddz) || 1,
          s0 = base === mainSt ? 1 : rT.chance(0.5) ? 1 : -1,
          lx = (-ddz / LL) * (base === mainSt ? sideBank : s0),
          lz = (ddx / LL) * (base === mainSt ? sideBank : s0),
          len = rT.range(16, 24),
          lane = stretch(bendTo(p, [p[0] + lx * len, p[1] + lz * len], rT.range(-4, 4), 12), 0);
        /* a lane keeps 9 m clear of every other road past its first 5 m (room for a plot each side) */
        const clear = lane.every(
          (q, i) =>
            Math.hypot(q[0] - p[0], q[1] - p[1]) < 5 ||
            roads.every(r => r.pts.every((o, m) => m % 2 || Math.hypot(o[0] - q[0], o[1] - q[1]) > 9))
        );
        if (clear) street(lane, 2.6, `town lane ${k + 1}`);
      }
      /* HB-4a: the second street beside one of them, joined to it at both ends */
      const S2 = D.town.second,
        sqPolar = Math.atan2(square[1] - peakP[1], square[0] - peakP[0]),
        sqDist = Math.hypot(square[0] - peakP[0], square[1] - peakP[1]),
        /* 'arc': a street round the pivot through the square (the line the others are beside), span degrees long */
        arcSt = [...Array(Math.ceil((sqDist * S2.span * ISLAND_RAD) / 0.5) + 1).keys()].map(k => {
          const f = sqPolar + S2.at * ISLAND_RAD + (k * 0.5) / sqDist - (S2.span * ISLAND_RAD) / 2;
          return [peakP[0] + Math.cos(f) * sqDist, peakP[1] + Math.sin(f) * sqDist];
        }),
        base2 = S2.on && { quay: quaySt, cross: crossSt, main: mainSt, arc: arcSt }[S2.along];
      if (S2.on && !base2) notes.push(`no ${S2.along} street for the second street`);
      if (base2) {
        const [plus, minus] = [1, -1].map(sg => beside(base2, S2.off * sg)),
          toPivot = L => L.reduce((m, p) => m + Math.hypot(p[0] - peakP[0], p[1] - peakP[1]), 0) / (L.length || 1),
          inSide = toPivot(plus) < toPivot(minus) ? plus : minus,
          pick =
            S2.side === 'in'
              ? inSide
              : S2.along === 'main'
                ? beside(base2, S2.off * sideBank)
                : inSide === plus
                  ? minus
                  : plus,
          /* stretches on fine land 7 m or more from every other road (room for a plot between): the longest, or for an
             arc every one 16 m long or more (the streets it crosses split it; each piece is joined at both ends) */
          clear = pick.map(
            q =>
              okAt(q[0], q[1]) &&
              roads.every(r => r.pts.every((o, m) => m % 2 || Math.hypot(o[0] - q[0], o[1] - q[1]) > 7))
          ),
          runs = [];
        for (let i = 0, a = 0; i <= pick.length; i++)
          if (i === pick.length || !clear[i]) {
            if (i - a >= 32) runs.push([a, i - 1]);
            a = i + 1;
          }
        runs.sort((u, v) => v[1] - v[0] - (u[1] - u[0]));
        const pieces = /** @type {number[][][]} */ (
          (S2.along === 'arc' ? runs : runs.slice(0, 1))
            .map((r, n) => street(pick.slice(r[0], r[1] + 1), 3, `town second street${n ? ' ' + (n + 1) : ''}`))
            .filter(Boolean)
        );
        if (!pieces.length) notes.push('no room for the second street');
        for (const L2 of pieces)
          /* joined at both ends: to the street it is beside, or (an arc) to the nearest other road */
          for (const end of [L2[0], L2[L2.length - 1]]) {
            const to = S2.along === 'arc' ? roads.filter(r => r.pts !== L2).flatMap(r => r.pts) : base2;
            let b = to[0];
            for (const q of to)
              if (Math.hypot(q[0] - end[0], q[1] - end[1]) < Math.hypot(b[0] - end[0], b[1] - end[1])) b = q;
            spoke(end, b, 'town second street, a join');
          }
      }
      /* the town meets the coast road at its ends */
      if (crossSt) {
        tieToLoop(crossSt[0], 'town to the coast road');
        tieToLoop(crossSt[crossSt.length - 1], 'town to the coast road, east');
      }
      tieToLoop(mainSt[mainSt.length - 1], 'town to the coast road, south');
    }
  }
  /* the trail starts at the top of the main street, by the pond at the mountain's foot (a kept town: where it did) */
  if (mainSt) footSpoke = mainSt[0];
  else if (keptTown) {
    const th = (prev.spots || []).find(S => S.kind === 'trailhead');
    if (th) footSpoke = [th.x, th.z];
  }
  if (footSpoke && (mainSt || keptTown))
    spots.push({ kind: 'trailhead', x: mapgenRound2(footSpoke[0]), z: mapgenRound2(footSpoke[1]), y: 0 });
  /* ---------- the hamlet: a few houses round a green under the mountains, joined to the coast road ---------- */
  let hamletAt = /** @type {{ c: number[], rx: number, rz: number, a: number } | null} */ (null);
  if (D.hamlet.on && !keptHamlet) {
    const zoneA = builtZones.map(
        Z => polar(...Z.poly.reduce((m, p) => [m[0] + p[0] / Z.poly.length, m[1] + p[1] / Z.poly.length], [0, 0]))[1]
      ),
      cands = [];
    for (let t = 0; t < 360; t += 5) {
      if (
        Math.abs(islandAngleDiff(t, streamA)) < 55 ||
        (D.cove.on && Math.abs(islandAngleDiff(t, D.cove.a)) < D.cove.span / 2 + 12)
      )
        continue;
      if (zoneA.some(a => Math.abs(islandAngleDiff(t, a)) < 30)) continue;
      cands.push([coastAt(t) - arrAt(beachW, t) - footAt(t), t]);
    }
    cands.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    for (const [room, t] of cands.slice(0, 12)) {
      if (room < 34) break;
      const cc = at(footAt(t) + Math.min(18, room * 0.45), t),
        ring = [...Array(25).keys()].map(k => {
          const f = (k / 24) * Math.PI * 2;
          return [
            cc[0] + Math.cos(f) * 11 * Math.cos(t * ISLAND_RAD) - Math.sin(f) * 9 * Math.sin(t * ISLAND_RAD),
            cc[1] + Math.cos(f) * 11 * Math.sin(t * ISLAND_RAD) + Math.sin(f) * 9 * Math.cos(t * ISLAND_RAD),
          ];
        });
      if (!ring.every(p => okAt(p[0], p[1], 4))) continue;
      /* a hamlet is its own place: 70 m at least from the town's square (a kept town's well) */
      const sq0 = square || (keptTown && (prev.plots || []).find(L => L.k === 'well'));
      if (sq0 && Math.hypot(cc[0] - (sq0.x ?? sq0[0]), cc[1] - (sq0.z ?? sq0[1])) < 70) continue;
      street(ring, 2.6, 'hamlet lane');
      townStreets.pop(); /* the hamlet's lane is not the town's */
      tieToLoop(ring[0], 'hamlet to the coast road');
      hamletAt = { c: cc, rx: 11, rz: 9, a: t };
      break;
    }
    if (!hamletAt) notes.push('no room for the hamlet under the mountains');
  }
  /* ---------- the look pass (the owner: two bridges at most, not close to one another): the town square's crossing
     and one upstream, ISLAND_BRIDGE_GAP metres or more from it; every other path that crossed the river runs along
     its bank to the nearer kept bridge instead, or stops at the bank when that way is long ---------- */
  if (river) bridgeBudget();
  function bridgeBudget() {
    const RV = mapgenResample(/** @type {number[][]} */ (river), 1),
      nR = RV.length,
      wetAt = p => !!(G.F[mapgenCellAt(G, p[0], p[1])] & 4),
      nearIdx = p => {
        let b = 0;
        for (let k = 1; k < nR; k++)
          if (Math.hypot(RV[k][0] - p[0], RV[k][1] - p[1]) < Math.hypot(RV[b][0] - p[0], RV[b][1] - p[1])) b = k;
        return b;
      },
      normalAt = k => {
        const a = RV[Math.max(0, k - 2)],
          b = RV[Math.min(nR - 1, k + 2)],
          L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        return [-(b[1] - a[1]) / L, (b[0] - a[0]) / L];
      },
      sideOf = p => {
        const k = nearIdx(p),
          [nx, nz] = normalAt(k);
        return (p[0] - RV[k][0]) * nx + (p[1] - RV[k][1]) * nz >= 0 ? 1 : -1;
      },
      /* the bank lane: beside the river, clear of its widened mouth */
      bankOff = k =>
        7.5 + ((ISLAND_MOUTH_W - ISLAND_RIVER_W) / 2) * mapgenSmooth(mapgenBetween((k / (nR - 1) - 0.66) / 0.34, 0, 1)),
      bankLine = (sd, k0, k1) => {
        const out = [],
          st = k1 >= k0 ? 1 : -1;
        for (let k = k0; k !== k1 + st; k += st) {
          const [nx, nz] = normalAt(k),
            o = bankOff(k) * sd;
          out.push([RV[k][0] + nx * o, RV[k][1] + nz * o]);
        }
        return out;
      };
    const crossings = () => {
      const out = [];
      for (const Rd of roads) {
        const wet = Rd.pts.map(p => wetAt(p));
        for (let k = 0; k < wet.length; k++) {
          if (!wet[k]) continue;
          let e = k;
          while (e + 1 < wet.length && wet[e + 1]) e++;
          const mid = Rd.pts[(k + e) >> 1];
          out.push({ Rd, k, e, mid, i: nearIdx(mid) });
          k = e;
        }
      }
      return out;
    };
    let all = crossings();
    if (!all.length) return;
    /* the first kept bridge: the town's cross street, else the crossing nearest the mouth */
    const first = all.find(C => C.Rd.name === 'town cross street') || all.slice().sort((a, b) => b.i - a.i)[0];
    const kept = [first];
    /* the second: upstream of it and far enough, the coast road's or a spoke's first, the furthest up */
    const far = all.filter(
      C => C !== first && Math.hypot(C.mid[0] - first.mid[0], C.mid[1] - first.mid[1]) >= ISLAND_BRIDGE_GAP
    );
    const pick =
      far.filter(C => C.i < first.i && !C.Rd.name.startsWith('town')).sort((a, b) => a.i - b.i)[0] ||
      far.filter(C => C.i < first.i).sort((a, b) => a.i - b.i)[0] ||
      far.sort((a, b) => a.i - b.i)[0];
    if (pick && kept.length < ISLAND_BRIDGES) kept.push(pick);
    else if (kept.length < ISLAND_BRIDGES) {
      /* no path crossed up the river: a footpath over it there (as far up as the fall allows), each end joined to the
         nearest path on its bank */
      let iU = -1,
        bd = 0;
      for (let k = 3; k < first.i; k++) {
        const d = Math.hypot(RV[k][0] - first.mid[0], RV[k][1] - first.mid[1]),
          ok = [1, -1].every(sd => {
            const p = bankLine(sd, k, k)[0];
            return okAt(p[0], p[1], 1) && !wetAt(p);
          });
        if (ok && d > bd) {
          bd = d;
          iU = k;
        }
      }
      if (bd < ISLAND_BRIDGE_GAP) iU = -1;
      const ends2 = iU >= 0 ? [1, -1].map(sd => bankLine(sd, iU, iU)[0]) : [];
      if (ends2.length === 2) {
        const nearRoad = p => {
          let best = null,
            bd = 25;
          for (const Rd of roads)
            for (const q of Rd.pts) {
              const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
              if (d < bd && sideOf(q) === sideOf(p) && !wetAt(q)) {
                bd = d;
                best = q;
              }
            }
          return best;
        };
        const qa = nearRoad(ends2[0]),
          qb = nearRoad(ends2[1]);
        const line = [
          ...(qa ? bendTo(qa, ends2[0], 0, 12) : []),
          ...bendTo(ends2[0], ends2[1], 0, 10),
          ...(qb ? bendTo(ends2[1], qb, 0, 12) : []),
        ];
        roads.push({ pts: mapgenResample(line, 0.5), width: 2, main: false, name: 'the footbridge path' });
        all = crossings();
        const C = all.find(X => X.Rd.name === 'the footbridge path');
        if (C) kept.push(C);
      }
    }
    const isKept = C => kept.some(K => Math.hypot(K.mid[0] - C.mid[0], K.mid[1] - C.mid[1]) < 3);
    /* each kept bridge's dry ends, by bank */
    const ends = kept.map(K => {
      const span = K.Rd.pts.slice(Math.max(0, K.k - 2), Math.min(K.Rd.pts.length, K.e + 3)),
        a = span[0],
        b = span[span.length - 1];
      /* the way over, from either bank */
      return { i: K.i, [sideOf(a)]: span, [sideOf(b)]: span.slice().reverse() };
    });
    for (let pass = 0; pass < 12; pass++) {
      const C = crossings().find(X => !isKept(X));
      if (!C) break;
      const { Rd } = C,
        a = Rd.pts[Math.max(0, C.k - 3)],
        b = Rd.pts[Math.min(Rd.pts.length - 1, C.e + 3)],
        sa = sideOf(a),
        sb = sideOf(b),
        ia = nearIdx(a),
        ib = nearIdx(b),
        E0 = ends.slice().sort((x, y) => Math.abs(x.i - C.i) - Math.abs(y.i - C.i))[0];
      let p1 = Rd.pts.slice(0, Math.max(0, C.k - 3)),
        p2 = Rd.pts.slice(Math.min(Rd.pts.length, C.e + 4));
      let pieces = /** @type {number[][][] | null} */ (null);
      if (sa !== sb && E0 && E0[sa] && E0[sb] && Math.abs(E0.i - C.i) <= ISLAND_DETOUR) {
        const l1 = bankLine(sa, ia, E0.i),
          l2 = bankLine(sb, E0.i, ib);
        /* along the bank to the bridge, over it on the kept path's own line, back along the other bank: one path */
        if (![...l1, ...l2].some(p => wetAt(p) || !inLand(p[0], p[1])))
          pieces = [mapgenResample([...p1, ...l1, ...E0[sa], ...l2, ...p2], 0.5)];
      }
      /* else it stops at each bank */
      if (!pieces) pieces = [p1, p2].filter(P => P.length >= 4).map(P => mapgenResample(P, 0.5));
      const at = roads.indexOf(Rd);
      roads.splice(at, 1);
      const ts = townStreets.indexOf(Rd);
      if (ts >= 0) townStreets.splice(ts, 1);
      pieces.forEach((P, m) => {
        const r = { ...Rd, pts: P, name: m ? `${Rd.name} (other bank)` : Rd.name };
        roads.push(r);
        if (ts >= 0) townStreets.push(r);
      });
    }
  }

  const plotPts = (x, z, pw, pd, a, m) => {
    const ca = Math.cos(a),
      sa = Math.sin(a),
      out = [];
    for (const u of [-1, -0.5, 0, 0.5, 1])
      for (const v of [-1, -0.5, 0, 0.5, 1]) {
        const ox = u * (pw / 2 + m),
          oz = v * (pd / 2 + m);
        out.push([x - sa * ox + ca * oz, z + ca * ox + sa * oz]);
      }
    return out;
  };
  /* HB-4a: the quarter turn nearest to facing out from the pivot (town.quarter), in radians */
  const quarterOut = (x, z) => Math.round(Math.atan2(z - peakP[1], x - peakP[0]) / (Math.PI / 2)) * (Math.PI / 2);
  /* HB-4b: the orbit's pivot is the summit spot, which the trail finds within 5 m of the peak later on: a quarter-turned
     plot keeps clear of the diagonals by as much as 5 m turns it seen from here, so its quarter turn is the one nearest
     facing out from the summit spot too (cam.orbit.c; the hub's door check) */
  const quarterHolds = (x, z) => {
    const d = Math.hypot(x - peakP[0], z - peakP[1]),
      t = Math.atan2(z - peakP[1], x - peakP[0]),
      fromDiag = Math.abs(t - quarterOut(x, z)),
      margin = d > 5.5 ? Math.asin(5.5 / d) : Math.PI;
    return Math.PI / 4 - fromDiag > margin;
  };
  /* a landmark's plot fits at x, z (HB-4a): on fine land, off the built zones, landmarks.shore metres from the water all
     round; its front's angle (the quarter turn with town.quarter, else a0), or null */
  const landmarkFits = (x, z, size, a0, turn = 0) => {
    const a = (D.town.quarter ? quarterOut(x, z) : a0) + turn;
    return plotPts(x, z, size[0], size[1], a, 0.5).every(
      ([px, pz]) =>
        inLand(px, pz) &&
        !(G.F[mapgenCellAt(G, px, pz)] & 4) &&
        Eat(px, pz) <= 0.6 &&
        !builtZones.some(Z => islandPointIn(Z.poly, px, pz)) &&
        /* landmarks.shore metres from the water all round */
        [0, 1, 2, 3, 4, 5, 6, 7].every(
          n =>
            !(
              G.F[
                mapgenCellAt(
                  G,
                  px + Math.cos((n * Math.PI) / 4) * D.landmarks.shore,
                  pz + Math.sin((n * Math.PI) / 4) * D.landmarks.shore
                )
              ] & 4
            )
        )
    )
      ? a
      : null;
  };
  /* HB-4b: the station's headland chosen before the paths are painted (what it reads, the land, the water, the slope and
     the built zones, the paths don't change), so the paths through it go round its plot's inland side */
  let stationSite = /** @type {{ x: number, z: number, t: number } | null} */ (null);
  if (D.landmarks.on) {
    const sqA = square ? polar(square[0], square[1])[1] : D.cove.a,
      inCove = t => D.cove.on && Math.abs(islandAngleDiff(t, D.cove.a)) < D.cove.span / 2 + 6,
      cands =
        D.landmarks.station.a >= 0
          ? [D.landmarks.station.a]
          : [...Array(161).keys()]
              .map(k => sqA - 80 + k)
              .filter(t => !inCove(t))
              .sort(
                (a, b) =>
                  coastAt(b) -
                  (coastAt(b - 25) + coastAt(b + 25)) / 2 -
                  (coastAt(a) - (coastAt(a - 25) + coastAt(a + 25)) / 2)
              );
    for (const t of cands.slice(0, 40)) {
      for (let r = coastAt(t) - 6; r > coastAt(t) - 20 && !stationSite; r -= 1) {
        const [x, z] = at(r, t);
        if (landmarkFits(x, z, STATION_PLOT, (t + 180) * ISLAND_RAD, STATION_TURN) !== null) stationSite = { x, z, t };
      }
      if (stationSite) break;
    }
  }
  if (stationSite) {
    /* every path point on the plot (and its path's half width and 1.5 m round) pushed toward the island's middle till
       it is clear, then the bend smoothed; three times, as the smoothing pulls the corners back in */
    const S0 = stationSite,
      a = landmarkFits(S0.x, S0.z, STATION_PLOT, (S0.t + 180) * ISLAND_RAD, STATION_TURN) ?? 0,
      on = (p, m) => {
        const dx = p[0] - S0.x,
          dz = p[1] - S0.z;
        return (
          Math.abs(dx * Math.cos(a) + dz * Math.sin(a)) <= STATION_PLOT[1] / 2 + m &&
          Math.abs(-dx * Math.sin(a) + dz * Math.cos(a)) <= STATION_PLOT[0] / 2 + m
        );
      };
    for (const Rd of roads) {
      const m = Rd.width / 2 + 1.5;
      if (!Rd.pts.some(p => on(p, m))) continue;
      let P = Rd.pts.map(p => [p[0], p[1]]);
      for (let pass = 0; pass < 3; pass++) {
        const moved = new Set();
        P = P.map((p, i) => {
          if (!on(p, m)) return p;
          moved.add(i);
          const L = Math.hypot(c[0] - p[0], c[1] - p[1]) || 1,
            q = [p[0], p[1]];
          for (let k = 0; k < 80 && on(q, m); k++) {
            q[0] += ((c[0] - p[0]) / L) * 0.5;
            q[1] += ((c[1] - p[1]) / L) * 0.5;
          }
          return q;
        });
        if (!moved.size) break;
        const lo = Math.max(1, Math.min(...moved) - 8),
          hi = Math.min(P.length - 2, Math.max(...moved) + 8);
        P = P.map((p, i) =>
          i < lo || i > hi
            ? p
            : [(P[i - 1][0] + p[0] * 2 + P[i + 1][0]) / 4, (P[i - 1][1] + p[1] * 2 + P[i + 1][1]) / 4]
        );
      }
      Rd.pts = mapgenResample(P, 0.5);
      notes.push(`${Rd.name} goes round the station`);
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
      const mx = (a[0] + b[0]) / 2,
        mz = (a[1] + b[1]) / 2;
      if (L > 14) notes.push(`${Rd.name} runs ${Math.round(L)} m over water: no bridge`);
      /* two paths over the water at one place share a bridge */
      else if (bridges.some(B => Math.hypot((B.a[0] + B.b[0]) / 2 - mx, (B.a[1] + B.b[1]) / 2 - mz) < 4)) continue;
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

  /* ---------- the square, the plots and their pads ---------- */
  const plots =
      /** @type {{ k: string, x: number, z: number, w: number, d: number, a: number, y: number, at: string }[]} */ ([]),
    yard = new Uint8Array(w * h);
  const cornerAt = (x, z) => G.H[mapgenBetween(Math.round(z), 0, h) * W1 + mapgenBetween(Math.round(x), 0, w)];
  if (square) {
    /* level, paved (plaza), walked like a street */
    const [sx, sz, sr] = square,
      y = cornerAt(sx, sz);
    for (let j = Math.floor(sz - sr - 3); j <= Math.ceil(sz + sr + 3); j++)
      for (let i = Math.floor(sx - sr - 3); i <= Math.ceil(sx + sr + 3); i++) {
        if (i < 0 || j < 0 || i > w || j > h) continue;
        const dd = Math.hypot(i - sx, j - sz);
        if (dd <= sr + 0.5) G.H[j * W1 + i] = y;
        else if (dd <= sr + 3) G.H[j * W1 + i] += (y - G.H[j * W1 + i]) * (1 - mapgenSmooth((dd - sr - 0.5) / 2.5));
        if (i < w && j < h && Math.hypot(i + 0.5 - sx, j + 0.5 - sz) <= sr && !(G.F[j * w + i] & 4)) {
          G.T[j * w + i] = 'c';
          G.F[j * w + i] |= 1 | 16;
        }
      }
  }
  /* a plot fits: every point of it (and a metre round) on fine land, off the streets and the square, 2.5 m from water,
     clear of the other plots, its ground rising no more than 2.4 m across it */
  /* HB-4b: whether a point lies inside a plot's rectangle grown by m (its front at angle L.a) */
  const inPlotRect = (L, px, pz, m) => {
    const dx = px - L.x,
      dz = pz - L.z,
      u = dx * Math.cos(L.a) + dz * Math.sin(L.a),
      v = -dx * Math.sin(L.a) + dz * Math.cos(L.a);
    return Math.abs(u) <= L.d / 2 + m && Math.abs(v) <= L.w / 2 + m;
  };
  /* tight (HB-4b, the square's ring): the plots' rectangles kept 0.6 m apart, not their round reach (a ring of plots
     round the square stands closer than the round test allows) */
  /* HB-4b: the opening's stage (cutscenes/opening.json: you wake in front of the lab, the others round you): in front of
     the lab's plot and to its sides, kept clear of every other plot */
  const stages = /** @type {{ x: number, z: number, w: number, d: number, a: number }[]} */ ([]);
  const plotFits = (x, z, pw, pd, a, tight = false) => {
    /* the street field is measured per metre cell: the check samples half a metre inside the plot */
    for (const [px, pz] of plotPts(x, z, pw, pd, a, -0.6)) {
      const q = mapgenCellAt(G, px, pz);
      if (G.F[q] & 1 || (G.near[q] >= 0 && G.dist[q] - G.roadPts[G.near[q]].r < 0.4)) return false;
    }
    for (const [px, pz] of plotPts(x, z, pw, pd, a, 1)) {
      if (!okAt(px, pz, 1.5)) return false;
      for (const [ox, oz] of [
        [2.5, 0],
        [-2.5, 0],
        [0, 2.5],
        [0, -2.5],
      ])
        if (G.F[mapgenCellAt(G, px + ox, pz + oz)] & 4) return false;
    }
    const r = Math.hypot(pw, pd) / 2;
    if (tight) {
      const me = { x, z, w: pw, d: pd, a },
        mine = plotPts(x, z, pw, pd, a, 0);
      if (
        plots.some(
          L =>
            mine.some(p => inPlotRect(L, p[0], p[1], 0.6)) ||
            plotPts(L.x, L.z, L.w, L.d, L.a, 0).some(p => inPlotRect(me, p[0], p[1], 0.6))
        )
      )
        return false;
    } else if (plots.some(L => Math.hypot(L.x - x, L.z - z) < r + Math.hypot(L.w, L.d) / 2 + 0.6)) return false;
    /* a kept (locked) zone's plots are its own: no new one inside it */
    if (kept.some(Z => islandPointIn(Z.poly, x, z))) return false;
    if (stages.length) {
      const me = { x, z, w: pw, d: pd, a };
      if (
        stages.some(
          R =>
            plotPts(x, z, pw, pd, a, 0).some(p => inPlotRect(R, p[0], p[1], 0)) ||
            plotPts(R.x, R.z, R.w, R.d, R.a, 0).some(p => inPlotRect(me, p[0], p[1], 0))
        )
      )
        return false;
    }
    const hs = plotPts(x, z, pw, pd, a, 0).map(p => cornerAt(p[0], p[1]));
    return Math.max(...hs) - Math.min(...hs) <= 2.4;
  };
  /* a plot facing its street: `front` the street's edge it opens onto (its pad lies at the street's level there) */
  /* HB-4a: the orbit's pivot (the peak; the summit spot is put on it) and whether a front at angle a, standing at x, z,
     faces out from it closely enough (town.face 'out'; always with 'street') */
  const facesOut = (x, z, a) =>
    D.town.face !== 'out' ||
    Math.abs(islandAngleDiff((a / ISLAND_RAD) % 360, Math.atan2(z - peakP[1], x - peakP[0]) / ISLAND_RAD)) <=
      D.town.tol;
  /* HB-4b: the airship hovers over its mast, tall: with the doors turned to the camera (town.quarter) no plot faces it
     from close behind (16 m, 35 degrees off its front), where it would stand between the camera and the front */
  const shipAhead = (k, x, z, a) => {
    if (!D.town.quarter) return false;
    const faces = (L, px, pz) =>
      Math.hypot(px - L.x, pz - L.z) < 16 &&
      Math.abs(islandAngleDiff(Math.atan2(pz - L.z, px - L.x) / ISLAND_RAD, L.a / ISLAND_RAD)) < 35;
    if (k === 'mast') return plots.some(L => L.k !== 'well' && faces(L, x, z));
    return plots.some(M => M.k === 'mast' && faces({ x, z, a }, M.x, M.z));
  };
  const addPlot = (k, x, z, pw, pd, a, front, where, tight = false) => {
    /* HB-4b: a house plot never smaller than a cottage (3.4 x 2.4 m) with 0.2 m round (town.scale's smaller plots) */
    if (k === 'house') [pw, pd] = [Math.max(pw, 3.8), Math.max(pd, 2.8)];
    if (D.town.quarter && k !== 'well') {
      /* turned, its corner may reach the street: stepped back from it a metre at a time, up to 3 */
      const bx = x - front[0],
        bz = z - front[1],
        bl = Math.hypot(bx, bz) || 1;
      for (const m of [0, 1, 2, 3]) {
        const qx = x + (bx / bl) * m,
          qz = z + (bz / bl) * m,
          qa = quarterOut(qx, qz);
        if (quarterHolds(qx, qz) && !shipAhead(k, qx, qz, qa) && plotFits(qx, qz, pw, pd, qa, tight)) {
          plots.push({ k, x: qx, z: qz, w: pw, d: pd, a: qa, y: cornerAt(front[0], front[1]), at: where });
          return true;
        }
      }
      return false;
    }
    if (!plotFits(x, z, pw, pd, a, tight)) return false;
    plots.push({ k, x, z, w: pw, d: pd, a, y: cornerAt(front[0], front[1]), at: where });
    return true;
  };
  /* along a street, one side or both: a plot every few metres, its front on the street */
  const plotsAlong = (st, width, sides, k, size, count, where) => {
    let placed = 0;
    if (!st) return 0;
    for (let i = 4; i < st.length - 4 && placed < count; i += Math.round((size[0] + rT.range(2, 4)) * 2)) {
      const p = st[i],
        dx = st[i + 2][0] - st[i - 2][0],
        dz = st[i + 2][1] - st[i - 2][1],
        L = Math.hypot(dx, dz) || 1;
      for (const sd of sides) {
        const pw0 = rT.range(size[0], size[1]),
          pd0 = rT.range(size[2], size[3]),
          nx = (-dz / L) * sd,
          nz = (dx / L) * sd,
          /* the angle its front faces: back toward the street */
          a = Math.atan2(-nz, -nx);
        if (!facesOut(p[0] + nx * (width / 2 + 4), p[1] + nz * (width / 2 + 4), a)) continue;
        /* as asked, else a size smaller (a cottage where a house won't go) */
        for (const f of [1, 0.8]) {
          const pw = pw0 * f,
            pd = pd0 * f,
            off = width / 2 + 1.2 + pd / 2;
          if (
            addPlot(
              k,
              p[0] + nx * off,
              p[1] + nz * off,
              pw,
              pd,
              a,
              [p[0] + nx * (width / 2), p[1] + nz * (width / 2)],
              where
            )
          ) {
            placed++;
            break;
          }
        }
        if (placed >= count) break;
      }
    }
    return placed;
  };
  const plotRing = (cx, cz, r0, k, size, tries, where) => {
    for (let n = 0; n < tries; n++) {
      const f = (n / tries) * Math.PI * 2 + rT.range(-0.1, 0.1),
        pd = size[1],
        rr = r0 + pd / 2 + 1.2,
        x = cx + Math.cos(f) * rr,
        z = cz + Math.sin(f) * rr;
      if (!facesOut(x, z, Math.atan2(cz - z, cx - x))) continue;
      if (
        addPlot(k, x, z, size[0], pd, Math.atan2(cz - z, cx - x), [cx + Math.cos(f) * r0, cz + Math.sin(f) * r0], where)
      )
        return true;
    }
    return false;
  };
  /* HB-4b: a plot lining the square (town.square.front): its edge 1.2 m off the square's rim, anywhere round it but the
     open side facing out from the pivot (the orbit camera looks into the square there), turned to face out (the
     quarter turn with town.quarter, else facing the square where that faces out) */
  const squareRing = (cx, cz, r0, k, size, tries, where) => {
    const outA = Math.atan2(cz - peakP[1], cx - peakP[0]),
      /* facing in: the side behind the square from the way its plots face, first */
      inA = (D.town.quarter ? quarterOut(cx, cz) : outA) + Math.PI;
    for (let n = 0; n < tries; n++) {
      const f = inA + ((n % 2 ? 1 : -1) * Math.ceil(n / 2) * Math.PI * 2) / tries;
      if (Math.abs(islandAngleDiff(f / ISLAND_RAD, outA / ISLAND_RAD)) < 50) continue;
      const fx = cx + Math.cos(f) * r0,
        fz = cz + Math.sin(f) * r0,
        a = D.town.quarter ? quarterOut(fx, fz) : Math.atan2(cz - fz, cx - fx),
        reach = Math.abs(Math.cos(f - a)) * (size[1] / 2) + Math.abs(Math.sin(f - a)) * (size[0] / 2),
        rr = r0 + reach + 1.2;
      if (!D.town.quarter && !facesOut(fx, fz, a)) continue;
      if (addPlot(k, cx + Math.cos(f) * rr, cz + Math.sin(f) * rr, size[0], size[1], a, [fx, fz], where, true))
        return true;
    }
    return false;
  };
  const townSt = name => (townStreets.find(r => r.name === name) || { pts: null }).pts;
  /* the look pass (a smaller island, a shorter town): the coast road's longest stretch within 45 m of the square, where
     the lab or the airship station goes when the town's own streets have no room */
  const nearSquare = () => {
    const L = roads.find(r => r.name === 'loop');
    if (!L || !square) return null;
    const sq = /** @type {number[]} */ (square);
    let best = [0, -1],
      a = -1;
    L.pts.forEach((p, i) => {
      const inR = Math.hypot(p[0] - sq[0], p[1] - sq[1]) < 45;
      if (inR && a < 0) a = i;
      if ((!inR || i === L.pts.length - 1) && a >= 0) {
        if (i - a > best[1] - best[0]) best = [a, i];
        a = -1;
      }
    });
    return best[1] > best[0] + 10 ? L.pts.slice(best[0], best[1]) : null;
  };
  /* HB-4a: a landmark's plot (turned to face out with town.quarter). A headland is narrower than the coast path's
     margins allow a 14 m station: a landmark only needs dry land, clear of the other plots and off the mountain; a
     path through it is re-routed when the island is built */
  const landmarkAt = (k, x, z, size, a0, turn = 0) => {
    const a = landmarkFits(x, z, size, a0, turn),
      rr = Math.hypot(size[0], size[1]) / 2;
    if (a === null || plots.some(L => Math.hypot(L.x - x, L.z - z) < rr + Math.hypot(L.w, L.d) / 2 + 0.6)) return false;
    plots.push({ k, x, z, w: size[0], d: size[1], a, y: cornerAt(x, z), at: 'landmark' });
    return true;
  };
  /* HB-4a: the landmarks (landmarks.on): the station on a headland by the town, its rail out over the sea up to the
     portal, and the lighthouse on an arm of the cove, before the town's plots take the coast (the windmill by the
     farm after the farmhouse) */
  let landmarks = /** @type {{ rail: number[][], portal: number[] } | null} */ (null);
  const LM = D.landmarks;
  if (LM.on) {
    /* a plot as near the coast at angle t as fits, its front toward the middle */
    const nearCoast = (k, t, size, from = 5) => {
      for (let r = coastAt(t) - from; r > coastAt(t) - from - 14; r -= 1) {
        const [x, z] = at(r, t);
        if (landmarkAt(k, x, z, size, (t + 180) * ISLAND_RAD)) return [x, z];
      }
      return null;
    };
    /* the station: on the headland chosen before the paths were painted (stationSite) */
    let st = /** @type {number[] | null} */ (null);
    const stA = stationSite ? stationSite.t : 0;
    if (
      stationSite &&
      landmarkAt('station', stationSite.x, stationSite.z, STATION_PLOT, (stA + 180) * ISLAND_RAD, STATION_TURN)
    )
      st = [stationSite.x, stationSite.z];
    if (!st) notes.push('no headland for the station');
    else {
      /* cutscenes track A: the track behind the station, out of its right-hand end, and the portal out in front */
      landmarks = stationLandmarks(plots[plots.length - 1]);
    }
    /* the lighthouse: the cove's arm further from the station (or the one asked for), as far out as fits */
    if (D.cove.on) {
      const arms = [-1, 1].map(sg => D.cove.a + sg * (D.cove.span / 2 + 4)),
        arm =
          LM.lighthouse.arm !== 0
            ? arms[LM.lighthouse.arm > 0 ? 1 : 0]
            : arms.sort((a, b) => Math.abs(islandAngleDiff(b, stA)) - Math.abs(islandAngleDiff(a, stA)))[0];
      if (![0, 3, -3, 6, -6].some(o => nearCoast('lighthouse', arm + o, [5, 5], 3)))
        notes.push('no room for the lighthouse on the cove');
    }
  }
  if (square) {
    plots.push({
      k: 'well',
      x: square[0],
      z: square[1],
      w: 3,
      d: 3,
      a: 0,
      y: cornerAt(square[0], square[1]),
      at: 'town',
    });
    if (
      !plotRing(square[0], square[1], square[2], 'lab', [14, 10], 24, 'town') &&
      !plotRing(square[0], square[1], square[2], 'lab', [12, 9], 24, 'town') &&
      !townStreets.some(r => plotsAlong(r.pts, r.width, [1, -1], 'lab', [12, 14, 9, 10], 1, 'town')) &&
      !plotsAlong(nearSquare(), D.paths.width, [1, -1], 'lab', [12, 14, 9, 10], 1, 'town')
    )
      notes.push('no room for the lab in the town');
    else {
      /* the stage: 2 m past the lab plot's front and 3.5 m past each side */
      const L = plots[plots.length - 1];
      stages.push({ x: L.x + Math.cos(L.a), z: L.z + Math.sin(L.a), w: L.w + 7, d: L.d + 2, a: L.a });
    }
    /* HB-4b: house plots town.scale times their size (a denser town of smaller, terraced cottages) */
    const hs = size => (D.town.scale === 1 ? size : size.map(v => v * D.town.scale));
    /* HB-4b: the plots round the square (town.square.front): the shop, the home, the town's other buildings, then
       houses */
    const onSquare = new Set(),
      ringSize = { shop: [8, 7], home: [8, 7], ...ISLAND_TOWN_EXTRA };
    let left = D.town.houses;
    for (let n = 0; n < D.town.square.front; n++) {
      const k = ['shop', 'home', ...D.town.extra].find(e => !onSquare.has(e)) || 'house',
        S = k === 'house' ? hs([7, 6]) : [ringSize[k][0], ringSize[k][2] ?? ringSize[k][1]];
      if (!squareRing(square[0], square[1], square[2], k, S, 24, 'town')) {
        if (k === 'house') break;
        onSquare.add(k); /* no room on the square: it goes on a street below */
        continue;
      }
      if (k === 'house') left--;
      else onSquare.add(k);
    }
    const quay = townSt('town quay');
    if (!(
      plotsAlong(quay, 3.4, [-side, side], 'mast', [12, 12, 12, 12], 1, 'town') ||
      plotsAlong(townSt('town east bank'), 3, [1, -1], 'mast', [12, 12, 12, 12], 1, 'town') ||
      townStreets.some(r => plotsAlong(r.pts, r.width, [1, -1], 'mast', [10, 12, 10, 12], 1, 'town')) ||
      plotsAlong(nearSquare(), D.paths.width, [1, -1], 'mast', [10, 12, 10, 12], 1, 'town')
    ))
      notes.push('no room for the airship station in the town');
    if (
      !plots.some(L => L.k === 'shop') &&
      !plotsAlong(townSt('town cross street'), 3.4, [1, -1], 'shop', [8, 8, 7, 7], 1, 'town')
    )
      townStreets.some(r => plotsAlong(r.pts, r.width, [1, -1], 'shop', [7, 8, 6, 7], 1, 'town')) ||
        plotsAlong(nearSquare(), D.paths.width, [1, -1], 'shop', [7, 8, 6, 7], 1, 'town');
    if (
      !plots.some(L => L.k === 'home') &&
      !plotsAlong(townSt('town main street'), 3.6, [sideBank], 'home', [8, 8, 7, 7], 1, 'town')
    )
      townStreets.some(r => plotsAlong(r.pts, r.width, [1, -1], 'home', [7, 8, 6, 7], 1, 'town')) ||
        plotsAlong(nearSquare(), D.paths.width, [1, -1], 'home', [7, 8, 6, 7], 1, 'town');
    /* HB-4a: the town's other buildings, on its streets nearest the square first */
    for (const k of D.town.extra)
      if (
        !plots.some(L => L.k === k) &&
        !townStreets.some(r => plotsAlong(r.pts, r.width, [1, -1], k, ISLAND_TOWN_EXTRA[k], 1, 'town')) &&
        !plotsAlong(nearSquare(), D.paths.width, [1, -1], k, ISLAND_TOWN_EXTRA[k], 1, 'town') &&
        /* still none: along any road within 60 m of the square, as the last cottages */
        !roads.some(r => {
          const near = r.pts.filter(p => Math.hypot(p[0] - square[0], p[1] - square[1]) < 60);
          return near.length > 10 && plotsAlong(near, r.width, [1, -1], k, ISLAND_TOWN_EXTRA[k], 1, 'town');
        })
      )
        notes.push(`no room for the ${k} in the town`);
    for (const [name, wd, sides] of [
      ['town main street', 3.6, [sideBank]],
      ['town cross street', 3.4, [1, -1]],
      ['town quay', 3.4, [1, -1]],
      ['town east bank', 3, [-sideBank]],
      ...townStreets.filter(r => r.name.startsWith('town second street')).map(r => [r.name, 3, [1, -1]]),
      ...[...Array(D.town.lanes).keys()].map(k => [`town lane ${k + 1}`, 2.6, [1, -1]]),
    ])
      left -= plotsAlong(
        townSt(/** @type {string} */ (name)),
        /** @type {number} */ (wd),
        /** @type {number[]} */ (sides),
        'house',
        hs([6, 9, 5, 7]),
        Math.ceil(left / 2),
        'town'
      );
    if (left > 0)
      for (const r of townStreets) left -= plotsAlong(r.pts, r.width, [1, -1], 'house', hs([6, 8, 5, 6]), left, 'town');
    /* still short: cottages along any road within 60 m of the square (the coast road through the town included) */
    if (left > 0)
      for (const r of roads) {
        if (left <= 0) break;
        if (r.name === 'hamlet lane') continue;
        const near = r.pts.filter(p => Math.hypot(p[0] - square[0], p[1] - square[1]) < 60);
        if (near.length > 10) left -= plotsAlong(near, r.width, [1, -1], 'house', hs([5, 7, 4.5, 5.5]), left, 'town');
      }
  }
  if (hamletAt) {
    let n = 0;
    for (let k = 0; k < D.hamlet.houses * 3 && n < D.hamlet.houses; k++) {
      const f = (k / (D.hamlet.houses * 3)) * Math.PI * 2,
        t = hamletAt.a * ISLAND_RAD,
        ex = Math.cos(f) * (hamletAt.rx + 1.3),
        ez = Math.sin(f) * (hamletAt.rz + 1.3),
        fx = hamletAt.c[0] + ex * Math.cos(t) - ez * Math.sin(t),
        fz = hamletAt.c[1] + ex * Math.sin(t) + ez * Math.cos(t),
        dx = fx - hamletAt.c[0],
        dz = fz - hamletAt.c[1],
        L = Math.hypot(dx, dz) || 1,
        pd = rT.range(5, 6.5);
      if (
        addPlot(
          'house',
          fx + (dx / L) * (pd / 2 + 1.2),
          fz + (dz / L) * (pd / 2 + 1.2),
          rT.range(6, 8),
          pd,
          Math.atan2(-dz, -dx),
          [fx, fz],
          'hamlet'
        )
      )
        n++;
    }
  }
  /* the farmhouse by the barn */
  const barnZ = zones.find(Z => Z.k === 'barn');
  if (barnZ) {
    const bc = barnZ.poly.reduce((m, p) => [m[0] + p[0] / barnZ.poly.length, m[1] + p[1] / barnZ.poly.length], [0, 0]),
      br = Math.max(...barnZ.poly.map(p => Math.hypot(p[0] - bc[0], p[1] - bc[1])));
    if (!plotRing(bc[0], bc[1], br + 2, 'farmhouse', [8, 7], 24, 'farm'))
      notes.push('no room for the farmhouse by the barn');
  }
  if (LM.on) {
    /* the windmill: beside the farm, a ring out past the farmhouse */
    if (LM.windmill && barnZ) {
      const bc = barnZ.poly.reduce(
          (m, p) => [m[0] + p[0] / barnZ.poly.length, m[1] + p[1] / barnZ.poly.length],
          [0, 0]
        ),
        br = Math.max(...barnZ.poly.map(p => Math.hypot(p[0] - bc[0], p[1] - bc[1])));
      /* the nearest ring round the barn with room, from just past the farmhouse out to 30 m */
      let done = false;
      for (let r = br + 6; r <= br + 30 && !done; r += 4)
        for (let n = 0; n < 36 && !done; n++) {
          const f = (n / 36) * Math.PI * 2;
          done = landmarkAt('windmill', bc[0] + Math.cos(f) * r, bc[1] + Math.sin(f) * r, [7, 7], f + Math.PI);
        }
      if (!done) notes.push('no room for the windmill by the farm');
    }
  }
  /* the pads: level at the street's height under each plot and a metre round it, eased back into the land over 3 m;
     the yard's ground is grass (the well's, the plaza). Every plot's easing first, then every pad level (plots close
     together: a later plot's easing tilted an earlier one's pad) */
  const padOut = (L, i, j) => {
    const ox = i - L.x,
      oz = j - L.z,
      u = Math.abs(-Math.sin(L.a) * ox + Math.cos(L.a) * oz) - L.w / 2,
      v = Math.abs(Math.cos(L.a) * ox + Math.sin(L.a) * oz) - L.d / 2;
    /* how far outside the plot's rectangle (0 inside) */
    return Math.hypot(Math.max(0, u), Math.max(0, v));
  };
  for (const pass of [0, 1])
    for (const L of plots) {
      const rr = Math.hypot(L.w, L.d) / 2 + 5;
      for (let j = Math.floor(L.z - rr); j <= Math.ceil(L.z + rr); j++)
        for (let i = Math.floor(L.x - rr); i <= Math.ceil(L.x + rr); i++) {
          if (i < 0 || j < 0 || i > w || j > h) continue;
          const out = padOut(L, i, j);
          if (pass) {
            if (out <= 1) G.H[j * W1 + i] = L.y;
          } else if (out > 1 && out <= 4)
            G.H[j * W1 + i] += (L.y - G.H[j * W1 + i]) * (1 - mapgenSmooth((out - 1) / 3));
          if (pass && i < w && j < h && out <= 0.6 && !(G.F[j * w + i] & (1 | 4)))
            yard[j * w + i] = L.k === 'well' ? 0 : 1;
        }
    }
  for (const L of plots) {
    for (const [px, pz] of plotPts(L.x, L.z, L.w, L.d, L.a, 1.5)) {
      const q = mapgenBetween(Math.floor(pz * 2), 0, h * 2 - 1) * W2 + mapgenBetween(Math.floor(px * 2), 0, W2 - 1);
      G.S[q] = 0;
      G.M[q] = 0;
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
        /* the look pass: forest climbs the mountain's foot, thinning out up the slope */
        if (e < 0.32 && nz(i, j, 8, 50) > 0.3 + e * 1.4 + jit * 0.05 && nz(i, j, 7, 37) <= 0.8) {
          const v = nz(i, j, 4, 10);
          ch = v > 0.62 ? 'L' : v < 0.38 ? 'F' : 'y';
        } else if (e > 0.55) ch = nz(i, j, 5, 1) > 0.58 ? 'r' : nz(i, j, 4, 33) > 0.62 ? 'H' : 'C';
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
  /* a plot's yard is grass */
  for (let q = 0; q < w * h; q++) if (yard[q] && !(G.F[q] & (1 | 4))) G.T[q] = 'g';
  /* the rock at a shelf's top (mapgen's), after the trail is in */
  if (shelves) mapgenRockEdges(G);

  /* ---------- water sits under its banks (mapgen's; the stream follows the land, the sea is level) ---------- */
  mapgenLowerWater(G);
  /* the open sea at one bed (ISLAND_SEA_BED: its water then lies a little under the sand at the waterline), and no
     water corner lower than that (the river's mouth meets the sea at its level) */
  {
    const sea = (i, j) => i < 0 || j < 0 || i >= w || j >= h || (G.F[j * w + i] & 4 && !inLand(i + 0.5, j + 0.5)),
      wet = (i, j) => i < 0 || j < 0 || i >= w || j >= h || !!(G.F[j * w + i] & 4);
    for (let j = 0; j <= h; j++)
      for (let i = 0; i <= w; i++) {
        const c0 = j * W1 + i;
        if (sea(i, j) && sea(i - 1, j) && sea(i, j - 1) && sea(i - 1, j - 1)) G.H[c0] = ISLAND_SEA_BED;
        else if (wet(i, j) && wet(i - 1, j) && wet(i, j - 1) && wet(i - 1, j - 1))
          G.H[c0] = Math.max(G.H[c0], ISLAND_SEA_BED);
      }
  }

  /* ---------- the kept zones: their ground exactly as it was, and their plots (after the water is lowered, which would
     lower theirs again) ---------- */
  if (kept.length && prev) {
    /* a kept zone's bridges are its own (a new one over its ground goes) */
    const inKept = B => kept.some(Z => islandPointIn(Z.poly, (B.a[0] + B.b[0]) / 2, (B.a[1] + B.b[1]) / 2));
    for (let k = bridges.length - 1; k >= 0; k--) if (inKept(bridges[k])) bridges.splice(k, 1);
    for (const B of Array.isArray(prev.bridges) ? prev.bridges : []) if (inKept(B)) bridges.push(B);
    for (const L of Array.isArray(prev.plots) ? prev.plots : [])
      if (kept.some(Z => islandPointIn(Z.poly, L.x, L.z)))
        plots.push({ ...L, a: L.a * ISLAND_RAD, y: L.y ?? 0, at: 'kept' });
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

  /* the look pass: two bridges over the river (a kept town's own come back with it) */
  if (river && bridges.filter(B => !B.pier).length < ISLAND_BRIDGES)
    notes.push(`one bridge only: no crossing ${ISLAND_BRIDGE_GAP} m up the river from the town's`);

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
      /* never inside the mountain's foot (where the mountain comes near the coast the belt is thin, not crossed:
         a smaller island's forest zone crossed itself there) */
      outer = ring(
        t =>
          Math.max(
            footAt(t) + 2,
            Math.min(
              footAt(t) + D.forest.deep * (0.8 + 0.4 * D.organic * mapgenNoise(t / 15, 1.3, sF)),
              coastAt(t) - arrAt(beachW, t) - 4
            )
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
  /* the town: the outline round its streets and plots (the hull, 3 m out), locked so the hand-placed town survives a
     new run; the hamlet round its green */
  const townPts = [
    ...townStreets.flatMap(r => r.pts.filter((_, i) => i % 4 === 0)),
    ...roads.filter(r => r.name.startsWith('town to the coast road')).flatMap(r => r.pts.filter((_, i) => i % 4 === 0)),
    ...plots.filter(L => L.at === 'town').flatMap(L => plotPts(L.x, L.z, L.w, L.d, L.a, 0)),
  ];
  if (townPts.length > 3) {
    const P2 = townPts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]),
      cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]),
      lo = [],
      hi = [];
    for (const p of P2) {
      while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
      lo.push(p);
    }
    for (const p of P2.reverse()) {
      while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop();
      hi.push(p);
    }
    const hull = [...lo.slice(0, -1), ...hi.slice(0, -1)],
      m = hull.reduce((a, p) => [a[0] + p[0] / hull.length, a[1] + p[1] / hull.length], [0, 0]);
    zones.push({
      k: 'town',
      poly: hull.map(p => {
        const d = Math.hypot(p[0] - m[0], p[1] - m[1]) || 1;
        return [p[0] + ((p[0] - m[0]) / d) * 3, p[1] + ((p[1] - m[1]) / d) * 3];
      }),
      lock: true,
    });
  }
  if (hamletAt) {
    const H0 = hamletAt,
      t = H0.a * ISLAND_RAD;
    zones.push({
      k: 'hamlet',
      poly: [...Array(20).keys()].map(k => {
        const f = (k / 20) * Math.PI * 2,
          ex = Math.cos(f) * (H0.rx + 10),
          ez = Math.sin(f) * (H0.rz + 10);
        return [H0.c[0] + ex * Math.cos(t) - ez * Math.sin(t), H0.c[1] + ex * Math.sin(t) + ez * Math.cos(t)];
      }),
      lock: true,
    });
  }
  zones.push(...keptPlaces);
  /* a zone of the scene's: on it, never crossing itself (islandProblems checks the rest) */
  for (const Z of zones) Z.poly = Z.poly.map(p => [mapgenBetween(p[0], 0, w), mapgenBetween(p[1], 0, h)]);

  /* ---------- IS-5: the wild Billies' tall grass, in patches (the game's encounters then wait in them alone,
     walk-view.js encounterCandidates, as on a run's map) ---------- */
  const grassPatches = /** @type {{ x: number, z: number, r: number, n: number, across: boolean }[]} */ ([]);
  if (D.wild.n > 0) {
    const rW = rng('wild'),
      sW = salt('wild'),
      [AMIN, AMAX] = [15, 70],
      off = zones.filter(Z => ['town', 'hamlet', 'barn', 'pasture', 'beach', 'cove', 'mountain'].includes(Z.k)),
      homes = zones.filter(Z => ['town', 'hamlet', 'barn', 'pasture'].includes(Z.k)),
      OPEN = 'GgEfHCB',
      WOODS = 'yLMFH',
      cellOk = q => {
        if (!OPEN.includes(G.T[q]) || G.F[q] & (1 | 2 | 4 | 8 | 16 | 32 | 64 | 128)) return false;
        const i = q % w,
          j = Math.floor(q / w),
          x = i + 0.5,
          z = j + 0.5;
        if (G.S[j * 2 * W2 + i * 2] || G.S[(j * 2 + 1) * W2 + i * 2 + 1]) return false;
        const H4 = [G.H[j * W1 + i], G.H[j * W1 + i + 1], G.H[(j + 1) * W1 + i], G.H[(j + 1) * W1 + i + 1]];
        if (Math.max(...H4) - Math.min(...H4) > 0.5) return false;
        if (off.some(Z => islandPointIn(Z.poly, x, z))) return false;
        /* and a stretch of open ground between the grass and where people live and the animals graze */
        if (homes.some(Z => islandPolyDist(Z.poly, x, z, 8) < 8)) return false;
        return !plots.some(L => Math.hypot(L.x - x, L.z - z) < Math.max(L.w, L.d) / 2 + 6);
      },
      /* by the woods or on the heath: a fifth of the ground within 9 m is forest floor or heath */
      wooded = (x, z) => {
        let n = 0,
          m = 0;
        for (let dj = -9; dj <= 9; dj += 3)
          for (let di = -9; di <= 9; di += 3) {
            const i = Math.floor(x + di),
              j = Math.floor(z + dj);
            if (i < 0 || j < 0 || i >= w || j >= h) continue;
            m++;
            if (WOODS.includes(G.T[j * w + i])) n++;
          }
        return m && n / m >= 0.2;
      };
    for (let tries = 0; grassPatches.length < D.wild.n && tries < 400 * D.wild.n; tries++) {
      const x = rW.range(4, w - 4),
        z = rW.range(4, h - 4),
        q = Math.floor(z) * w + Math.floor(x);
      if (!cellOk(q) || !wooded(x, z)) continue;
      const A = rW.range(AMIN + 10, AMAX),
        asp = rW.range(1, 2.2),
        ab = A / (Math.PI * 0.8),
        a = Math.sqrt(ab * asp),
        b = Math.sqrt(ab / asp),
        r = Math.max(a, b),
        ang = rW.range(0, Math.PI),
        ux = Math.cos(ang),
        uz = Math.sin(ang);
      if (grassPatches.some(g => Math.hypot(g.x - x, g.z - z) < g.r + r + 6)) continue;
      const cells = [];
      for (let j = Math.max(0, Math.floor(z - r - 1)); j <= Math.min(h - 1, Math.ceil(z + r + 1)); j++)
        for (let i = Math.max(0, Math.floor(x - r - 1)); i <= Math.min(w - 1, Math.ceil(x + r + 1)); i++) {
          const dx = i + 0.5 - x,
            dz = j + 0.5 - z,
            u = (dx * ux + dz * uz) / a,
            v = (-dx * uz + dz * ux) / b,
            t = Math.atan2(v, u),
            edge = 0.75 + 0.3 * mapgenNoise(Math.cos(t) * 1.5 + grassPatches.length * 7, Math.sin(t) * 1.5 + 3, sW),
            rr = Math.hypot(u, v) / edge;
          if (rr <= 1 && cellOk(j * w + i)) cells.push([j * w + i, rr]);
        }
      cells.sort((m, n) => m[1] - n[1] || m[0] - n[0]);
      const take = cells.slice(0, AMAX).map(c => c[0]);
      if (take.length < AMIN) continue;
      for (const c of take) {
        G.T[c] = 't';
        G.F[c] |= 32;
      }
      grassPatches.push({
        x: mapgenRound2(x),
        z: mapgenRound2(z),
        r: mapgenRound2(r * 1.05 + 0.75),
        n: take.length,
        across: false,
      });
    }
    if (grassPatches.length < D.wild.n) notes.push(`room for ${grassPatches.length} of ${D.wild.n} tall grass patches`);
  }

  /* ---------- the scene ---------- */
  const tiles = [];
  for (let j = h - 1; j >= 0; j--) tiles.push(G.T.slice(j * w, (j + 1) * w).join(''));
  const heights = [];
  for (let j = h; j >= 0; j--) heights.push(Array.from(G.H.subarray(j * W1, (j + 1) * W1), v => mapgenRound2(v) || 0));
  const town = zones.find(Z => Z.k === 'town') || zones.find(Z => ISLAND_GEN_BUILT.includes(Z.k)),
    well = plots.find(L => L.k === 'well');
  let hub = [c[0], c[1] - Rf - 8];
  /* you arrive in the square, beside the well */
  if (well) hub = [well.x + 3, well.z];
  else if (town) {
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
    ...(plots.length
      ? {
          plots: plots.map(L => ({
            k: L.k,
            x: mapgenRound2(L.x),
            z: mapgenRound2(L.z),
            w: mapgenRound2(L.w),
            d: mapgenRound2(L.d),
            a: Math.round(islandAngle(L.a / ISLAND_RAD) * 10) / 10,
            y: mapgenRound2(L.y),
          })),
        }
      : {}),
  };
  if (G.streams.length) sc.streams = G.streams;
  if (grassPatches.length) sc.grassPatches = grassPatches;
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
  return { scene: sc, notes, paths, ...(landmarks ? { landmarks } : {}) };
}
