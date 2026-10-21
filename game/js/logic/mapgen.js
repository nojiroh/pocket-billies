// @ts-check
'use strict';
/* ================= MAP GENERATOR (map generator track MG-1) =================
   A whole walk scene from dials and a seed, in the game's own scene format (tiles, heights, steps, props, hub,
   edgeExits with path and len, streams, bridges, waters, the look keys), so a generated place is drawn and walked
   like a hand-built one. Logic only: no DOM, no Math.random, runs in Node (tools/test/mapgen.test.mjs). The Studio's
   Generate card (studio/js/map-generate.js) shows it as a draft.
   - The same params and seed give the same scene. Each stage draws from its own random stream (rngFrom(seed,
     stage)), so a stage can be rerolled alone (params.seeds[stage]).
   - What it makes is marked: every prop carries g: 1 (its wild plants also w: 42, as tools/grow-wild.py marks them),
     the scene carries gen: {v, params, seed}.
   - The stages, in order: heights, ground, road (carves, flattens and paves), exits and hub, plants (the grow-wild
     rules, fixed: nothing on any path, door, water or bridge), feature, props.
   Coordinates are the game's: metres, x east, z from the near (south) edge; one tile is a metre. Internally every grid
   is near row first; the scene's tiles and heights are far row first, its steps near row first (walk-view.js). */
/** @import { Biome } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { hashString, rngFrom } from './rng.js';
/* eslint-disable no-func-assign */
expose({
  MAPGEN_BASE64: [() => MAPGEN_BASE64],
  MAPGEN_DEFAULTS: [() => MAPGEN_DEFAULTS],
  MAPGEN_EXIT_IN: [() => MAPGEN_EXIT_IN],
  MAPGEN_FAMILY_SHARE: [() => MAPGEN_FAMILY_SHARE],
  MAPGEN_FEATURES: [() => MAPGEN_FEATURES],
  MAPGEN_INWARD: [() => MAPGEN_INWARD],
  MAPGEN_PATH_GROUND: [() => MAPGEN_PATH_GROUND],
  MAPGEN_SHAPES: [() => MAPGEN_SHAPES],
  MAPGEN_SIDE_NAME: [() => MAPGEN_SIDE_NAME],
  MAPGEN_SIZES: [() => MAPGEN_SIZES],
  MAPGEN_STAGES: [() => MAPGEN_STAGES],
  MAPGEN_STRAIGHT_IN: [() => MAPGEN_STRAIGHT_IN],
  MAPGEN_SURFACES: [() => MAPGEN_SURFACES],
  MAPGEN_VERSION: [() => MAPGEN_VERSION],
  MAPGEN_WATER: [() => MAPGEN_WATER],
  MAPGEN_WET: [() => MAPGEN_WET],
  MAPGEN_WILD_MARK: [() => MAPGEN_WILD_MARK],
  mapgenBetween: [() => mapgenBetween],
  // @ts-expect-error -- replaced on purpose
  mapgenBezier: [() => mapgenBezier, v => (mapgenBezier = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenBridgesOverWater: [() => mapgenBridgesOverWater, v => (mapgenBridgesOverWater = v)],
  mapgenCellAt: [() => mapgenCellAt],
  // @ts-expect-error -- replaced on purpose
  mapgenChooseHub: [() => mapgenChooseHub, v => (mapgenChooseHub = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenClearRound: [() => mapgenClearRound, v => (mapgenClearRound = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenCornerHeight: [() => mapgenCornerHeight, v => (mapgenCornerHeight = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenDecodeBase64: [() => mapgenDecodeBase64, v => (mapgenDecodeBase64 = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenEncodeBase64: [() => mapgenEncodeBase64, v => (mapgenEncodeBase64 = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenExitPoint: [() => mapgenExitPoint, v => (mapgenExitPoint = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenFbm: [() => mapgenFbm, v => (mapgenFbm = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenFlattenRoads: [() => mapgenFlattenRoads, v => (mapgenFlattenRoads = v)],
  mapgenGround: [() => mapgenGround],
  // @ts-expect-error -- replaced on purpose
  mapgenGrowWild: [() => mapgenGrowWild, v => (mapgenGrowWild = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenLattice: [() => mapgenLattice, v => (mapgenLattice = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenLowerWater: [() => mapgenLowerWater, v => (mapgenLowerWater = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenMergeDefaults: [() => mapgenMergeDefaults, v => (mapgenMergeDefaults = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenNearRoadWidth: [() => mapgenNearRoadWidth, v => (mapgenNearRoadWidth = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenNewWork: [() => mapgenNewWork, v => (mapgenNewWork = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenNoise: [() => mapgenNoise, v => (mapgenNoise = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenOccAdd: [() => mapgenOccAdd, v => (mapgenOccAdd = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenOccFree: [() => mapgenOccFree, v => (mapgenOccFree = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenPaintCoast: [() => mapgenPaintCoast, v => (mapgenPaintCoast = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenPaintDisc: [() => mapgenPaintDisc, v => (mapgenPaintDisc = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenPaintPond: [() => mapgenPaintPond, v => (mapgenPaintPond = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenPaintStream: [() => mapgenPaintStream, v => (mapgenPaintStream = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenParams: [() => mapgenParams, v => (mapgenParams = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenPolyLength: [() => mapgenPolyLength, v => (mapgenPolyLength = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenPutProp: [() => mapgenPutProp, v => (mapgenPutProp = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenRadius: [() => mapgenRadius, v => (mapgenRadius = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenRaise: [() => mapgenRaise, v => (mapgenRaise = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenResample: [() => mapgenResample, v => (mapgenResample = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenRoadCurve: [() => mapgenRoadCurve, v => (mapgenRoadCurve = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenRoadDist: [() => mapgenRoadDist, v => (mapgenRoadDist = v)],
  mapgenRound2: [() => mapgenRound2],
  // @ts-expect-error -- replaced on purpose
  mapgenScene: [() => mapgenScene, v => (mapgenScene = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenShareMask: [() => mapgenShareMask, v => (mapgenShareMask = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenSimplify: [() => mapgenSimplify, v => (mapgenSimplify = v)],
  mapgenSmooth: [() => mapgenSmooth],
  // @ts-expect-error -- replaced on purpose
  mapgenSpur: [() => mapgenSpur, v => (mapgenSpur = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageExits: [() => mapgenStageExits, v => (mapgenStageExits = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageFeature: [() => mapgenStageFeature, v => (mapgenStageFeature = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageGround: [() => mapgenStageGround, v => (mapgenStageGround = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageHeights: [() => mapgenStageHeights, v => (mapgenStageHeights = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageLand: [() => mapgenStageLand, v => (mapgenStageLand = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStagePlants: [() => mapgenStagePlants, v => (mapgenStagePlants = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageProps: [() => mapgenStageProps, v => (mapgenStageProps = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageRoad: [() => mapgenStageRoad, v => (mapgenStageRoad = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageWater: [() => mapgenStageWater, v => (mapgenStageWater = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStreamLine: [() => mapgenStreamLine, v => (mapgenStreamLine = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenTerraces: [() => mapgenTerraces, v => (mapgenTerraces = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenUnreachable: [() => mapgenUnreachable, v => (mapgenUnreachable = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const MAPGEN_VERSION = 1;
export const MAPGEN_STAGES = ['heights', 'ground', 'road', 'exits', 'lots', 'plants', 'feature', 'props'];
export const MAPGEN_SHAPES = {
  straight: 'Straight',
  winding: 'Gentle winding',
  scurve: 'S-curve',
  switchback: 'Switchback',
};
export const MAPGEN_SURFACES = { dirt: 'p', gravel: 'v', cobbles: 'K', pavers: 'q' };
export const MAPGEN_WATER = { none: 'None', stream: 'Stream', pond: 'Pond', coast: 'Coast' };
export const MAPGEN_FEATURES = {
  none: 'None',
  bridge: 'Stream and bridge',
  lookout: 'Lookout',
  jetty: 'Jetty',
  glade: 'Glade',
  lava: 'Lava flow',
  terraces: 'Terraces',
};
export const MAPGEN_SIZES = {
  route: { name: 'Route', w: 112, h: 64 },
  small_town: { name: 'Small town', w: 80, h: 60 },
  big_town: { name: 'Big town', w: 128, h: 96 },
};
/* grow-wild.py's share of each plant family */
export const MAPGEN_FAMILY_SHARE = {
  flowers: 0.36,
  ground: 0.34,
  water: 0.1,
  shrubs: 0.09,
  rocks: 0.06,
  seasons: 0.03,
  trees: 0.02,
};
export const MAPGEN_WILD_MARK = 42;
export const MAPGEN_PATH_GROUND =
  'pcmbaqhevuKTiPsS'; /* ground a plant never takes when it is part of a road (plus every paved terrain) */
export const MAPGEN_WET = 'wd';
export const MAPGEN_EXIT_IN = 1.1;
export const MAPGEN_STRAIGHT_IN = 7; /* metres of road that run straight in from an exit, so a seam is crossed head on */

/** the dials, as the Studio's Generate card shows them (a group per card section) */
export const MAPGEN_DEFAULTS = {
  kind: 'route',
  biome: 'meadow',
  w: 112,
  h: 64,
  seed: 1,
  seeds: {},
  land: { hills: 0.4, terraces: 0, cliffs: 0.3, water: 'none', waterAmount: 0.5 },
  road: {
    exits: [
      { side: 'W', t: 0.5, width: 2 },
      { side: 'E', t: 0.5, width: 2 },
    ],
    shape: 'winding',
    wobble: 0.5,
    width: 2.4,
    surface: 'dirt',
    verge: 0.5,
  },
  nature: { growth: 0.8, tall: 0.5, clearings: 0.3, trees: 0.5 },
  feature: 'none',
  props: { lamps: 0, benches: 0.3, signs: 1, bins: 0, folk: 0.3 },
};

export const mapgenBetween = (v, a, b) => (v < a ? a : v > b ? b : v);
export const mapgenRound2 = v => Math.round(v * 100) / 100;
export const mapgenSmooth = t => t * t * (3 - 2 * t);

export function mapgenLattice(i, j, s) {
  let h = Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** smooth value noise in [0,1] at (x, z) for a salt s */
export function mapgenNoise(x, z, s) {
  const i = Math.floor(x),
    j = Math.floor(z),
    fx = mapgenSmooth(x - i),
    fz = mapgenSmooth(z - j);
  const a = mapgenLattice(i, j, s),
    b = mapgenLattice(i + 1, j, s),
    c = mapgenLattice(i, j + 1, s),
    d = mapgenLattice(i + 1, j + 1, s);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
export function mapgenFbm(x, z, s) {
  return (
    0.6 * mapgenNoise(x, z, s) +
    0.3 * mapgenNoise(x * 2.03, z * 2.03, s + 17) +
    0.1 * mapgenNoise(x * 4.1, z * 4.1, s + 31)
  );
}

/* ---------- params ---------- */
export function mapgenMergeDefaults(def, v) {
  if (Array.isArray(def))
    return Array.isArray(v) ? v.map(e => (e && typeof e === 'object' ? { ...e } : e)) : def.map(e => ({ ...e }));
  if (def && typeof def === 'object') {
    const out = {};
    for (const k of Object.keys(def))
      out[k] = mapgenMergeDefaults(def[k], v && typeof v === 'object' ? v[k] : undefined);
    if (v && typeof v === 'object') for (const k of Object.keys(v)) if (!(k in def)) out[k] = v[k];
    return out;
  }
  return v === undefined || v === null || (typeof def === 'number' && typeof v !== 'number') ? def : v;
}
/** the dials filled in from the defaults and kept in range (a copy; the given params are not changed) */
export function mapgenParams(p) {
  const P = mapgenMergeDefaults(MAPGEN_DEFAULTS, p || {});
  P.w = mapgenBetween(Math.round(P.w), 24, 200);
  P.h = mapgenBetween(Math.round(P.h), 24, 200);
  P.seed = Math.floor(Math.abs(Number(P.seed) || 0)) % 2147483647;
  for (const g of ['land', 'nature', 'props'])
    for (const k of Object.keys(P[g])) if (typeof P[g][k] === 'number') P[g][k] = mapgenBetween(P[g][k], 0, 1);
  const R = P.road;
  R.wobble = mapgenBetween(R.wobble, 0, 1);
  R.verge = mapgenBetween(R.verge, 0, 1);
  R.width = mapgenBetween(R.width, 1.2, 6);
  if (!MAPGEN_SHAPES[R.shape]) R.shape = 'winding';
  if (!MAPGEN_SURFACES[R.surface]) R.surface = 'dirt';
  if (!MAPGEN_WATER[P.land.water]) P.land.water = 'none';
  if (!MAPGEN_FEATURES[P.feature]) P.feature = 'none';
  R.exits = (R.exits || [])
    .filter(e => e && 'NSEW'.includes(e.side))
    .slice(0, 4)
    .map(e => ({ side: e.side, t: mapgenBetween(+e.t || 0.5, 0.08, 0.92), width: mapgenBetween(+e.width || 2, 1, 6) }));
  if (!R.exits.length) R.exits = [{ side: 'S', t: 0.5, width: 2 }];
  return P;
}

/** where an edge exit is, as walk-view.js exitPoint works it out */
export function mapgenExitPoint(w, h, e) {
  const n = e.in == null ? MAPGEN_EXIT_IN : e.in;
  return e.side === 'N'
    ? [mapgenRound2(e.t * w), mapgenRound2(h - n)]
    : e.side === 'S'
      ? [mapgenRound2(e.t * w), mapgenRound2(n)]
      : e.side === 'E'
        ? [mapgenRound2(w - n), mapgenRound2(e.t * h)]
        : [mapgenRound2(n), mapgenRound2(e.t * h)];
}
export const MAPGEN_INWARD = { N: [0, -1], S: [0, 1], E: [-1, 0], W: [1, 0] }; /* pointing into the map */
export const MAPGEN_SIDE_NAME = { N: 'north', S: 'south', E: 'east', W: 'west' };

/** the radius a prop takes up (tools/grow-wild.py radius) */
export function mapgenRadius(M, s = 1) {
  if (!M) return 0.5;
  if (M.box) return Math.max(...M.box) * 0.5 * s + 0.6;
  if (M.solid) return M.solid * s + 0.15;
  if (M.flat) return 0.35 * s;
  return Math.max(0.3, (M.shadow || 0) * 0.42 * s + 0.2);
}

/* ---------- the generator's working state ---------- */
export function mapgenNewWork(P, ctx) {
  const w = P.w,
    h = P.h,
    biomes = ctx.biomes || {},
    /** @type {Biome} */
    B = biomes[P.biome] || biomes[Object.keys(biomes)[0]];
  if (!B) throw new Error('mapgen: no biomes (game/data/biomes.json)');
  const seedOf = st => (P.seeds && P.seeds[st] != null ? P.seeds[st] : P.seed);
  return {
    P,
    B,
    w,
    h,
    cat: (ctx.scenery && ctx.scenery.props) || {},
    terr: (ctx.scenery && ctx.scenery.terrains) || {},
    /* a stage's random stream and noise salt; sub separates the parts of a stage (they all follow its seed) */
    rng: (st, sub = '') => rngFrom(seedOf(st), st + sub),
    salt: (st, sub = '') => hashString(`${seedOf(st)}|${st}${sub}|noise`) % 100000,
    /* ground per cell, near row first */
    T: new Array(w * h).fill(B.ground.base),
    /* corner heights, (w+1) x (h+1), near row first */
    H: new Float32Array((w + 1) * (h + 1)),
    /* step raise per half-metre cell (2w x 2h) */
    S: new Float32Array(4 * w * h),
    /* per cell: 1 road, 2 verge, 4 water, 8 bridge, 16 clear (no trees), 32 tall grass, 64 bank, 128 jetty */
    F: new Uint8Array(w * h),
    road: /** @type {{ pts: number[][], width: number, main: boolean }[]} */ ([]),
    dist: new Float32Array(w * h).fill(1e9) /* to the nearest road's centre line, at cell centres */,
    near: new Int32Array(w * h).fill(-1) /* which road sample is nearest (index into roadPts) */,
    roadPts: /** @type {{ x: number, z: number, r: number, s: number, k: number }[]} */ ([]),
    props: /** @type {any[]} */ ([]),
    occ: new Map() /* 2 m buckets of [x, z, r] */,
    keep: /** @type {number[][]} */ ([]),
    hub: [w / 2, h / 2],
    exits: [],
    edgeExits: [],
    streams: [],
    bridges: [],
    waters: [],
    npcSpots: [],
    notes: [],
    stepsUsed: false,
  };
}
export const mapgenCellAt = (G, x, z) =>
  mapgenBetween(Math.floor(z), 0, G.h - 1) * G.w + mapgenBetween(Math.floor(x), 0, G.w - 1);
export const mapgenGround = (G, x, z) => G.T[mapgenCellAt(G, x, z)];
export function mapgenOccAdd(G, x, z, r) {
  const k = `${Math.floor(x / 2)},${Math.floor(z / 2)}`;
  let L = G.occ.get(k);
  if (!L) G.occ.set(k, (L = []));
  L.push([x, z, r]);
}
export function mapgenOccFree(G, x, z, r) {
  const n = Math.ceil((r + 3) / 2);
  const bi = Math.floor(x / 2),
    bj = Math.floor(z / 2);
  for (let j = bj - n; j <= bj + n; j++)
    for (let i = bi - n; i <= bi + n; i++) {
      const L = G.occ.get(`${i},${j}`);
      if (L) for (const o of L) if (Math.hypot(x - o[0], z - o[1]) < o[2] + r) return false;
    }
  for (const o of G.keep) if (Math.hypot(x - o[0], z - o[1]) < o[2] + r) return false;
  return true;
}
/* the road nearest a point: distance to the centre line and the half width there */
export function mapgenRoadDist(G, x, z) {
  const q = mapgenCellAt(G, x, z);
  return G.dist[q];
}
export function mapgenNearRoadWidth(G, x, z) {
  const q = mapgenCellAt(G, x, z),
    k = G.near[q];
  return k >= 0 ? G.roadPts[k].r : 0;
}
/** put a prop (marked g: 1) if its spot is free; o: { avoid: ground letters, road: extra clearance, water: allowed } */
export function mapgenPutProp(G, k, x0, z0, o = {}) {
  const M = G.cat[k];
  if (!M) return null;
  /* checked where it is stored: rounding can move a prop into the next cell */
  const x = mapgenRound2(x0),
    z = mapgenRound2(z0);
  const s = o.s || 1,
    r = mapgenRadius(M, s) * (o.squeeze || 1);
  if (x < 0.5 || z < 0.5 || x > G.w - 0.5 || z > G.h - 0.5) return null;
  const q = mapgenCellAt(G, x, z),
    ch = G.T[q];
  /* never in water (unless it grows there), on a bridge or a jetty, even when placed by hand (force) */
  if (G.F[q] & (4 | 8 | 128) && !o.water) return null;
  if (!o.force) {
    if (G.F[q] & 1) return null;
    if (o.avoid && o.avoid.includes(ch)) return null;
    const d = G.dist[q] - G.roadPts[Math.max(0, G.near[q])]?.r;
    if (G.near[q] >= 0 && d < (o.road ?? 0.6) + r * 0.6) return null;
    if (!mapgenOccFree(G, x, z, r + (o.gap || 0))) return null;
  }
  const p = { k, x: mapgenRound2(x), z: mapgenRound2(z), g: 1 };
  if (Math.abs(s - 1) > 0.02) p.s = mapgenRound2(s);
  if (o.f) p.f = 1;
  if (o.w) p.w = o.w;
  if (o.extra) Object.assign(p, o.extra);
  G.props.push(p);
  mapgenOccAdd(G, x, z, r);
  return p;
}

/* ---------- 1. heights ---------- */
export function mapgenStageHeights(G) {
  const { P, w, h } = G,
    s = G.salt('heights'),
    amp = P.land.hills * 2.6;
  let sum = 0;
  for (let j = 0; j <= h; j++)
    for (let i = 0; i <= w; i++) {
      const v = amp * (mapgenFbm(i / 26, j / 26, s) - 0.5) * 2 + amp * 0.35 * (mapgenFbm(i / 8, j / 8, s + 5) - 0.5);
      G.H[j * (w + 1) + i] = v;
      sum += v;
    }
  const mean = sum / ((w + 1) * (h + 1));
  for (let q = 0; q < G.H.length; q++) G.H[q] -= mean;
}

/* ---------- 3. road: a curve between the exits through the hub, sampled every half metre ---------- */
export function mapgenBezier(a, b, c, d, t) {
  const u = 1 - t;
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ];
}
export function mapgenResample(pts, step) {
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let t = step - carry;
    while (t <= L) {
      out.push([a[0] + ((b[0] - a[0]) * t) / L, a[1] + ((b[1] - a[1]) * t) / L]);
      t += step;
    }
    carry = L - (t - step);
  }
  const last = pts[pts.length - 1],
    tail = out[out.length - 1];
  if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > step * 0.3) out.push(last);
  else out[out.length - 1] = last;
  return out;
}
export function mapgenPolyLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}
/** a road from exit a to exit b (or to a point inside when b has no side), in the given shape */
export function mapgenRoadCurve(G, A, B, shape, rnd, ns) {
  const { w, h, P } = G,
    wob = P.road.wobble,
    m = 4;
  const nA = MAPGEN_INWARD[A.side],
    a0 = A.pt,
    a1 = [a0[0] + nA[0] * MAPGEN_STRAIGHT_IN, a0[1] + nA[1] * MAPGEN_STRAIGHT_IN];
  const nB = B.side ? MAPGEN_INWARD[B.side] : null,
    b0 = B.pt,
    b1 = nB ? [b0[0] + nB[0] * MAPGEN_STRAIGHT_IN, b0[1] + nB[1] * MAPGEN_STRAIGHT_IN] : b0;
  const L = Math.hypot(b1[0] - a1[0], b1[1] - a1[1]) || 1;
  const c1 = [a1[0] + nA[0] * L * 0.35, a1[1] + nA[1] * L * 0.35],
    c2 = nB ? [b1[0] + nB[0] * L * 0.35, b1[1] + nB[1] * L * 0.35] : [(a1[0] + b1[0]) / 2, (a1[1] + b1[1]) / 2];
  const n = Math.max(24, Math.ceil(L / 0.5));
  const base = [];
  for (let i = 0; i <= n; i++) base.push(mapgenBezier(a1, c1, c2, b1, i / n));
  /* the shape: an offset across the base curve that fades in and out at both ends */
  const across = Math.min(w, h),
    waves = rnd.range(1.3, 2.2),
    ph = rnd.range(0, Math.PI * 2),
    ph2 = rnd.range(0, Math.PI * 2),
    legs = mapgenBetween(Math.round(L / 28), 3, 5);
  const amp = { straight: 0, winding: 0.16, scurve: 0.26, switchback: 0.28 }[shape] * across * (0.6 + 0.8 * wob);
  const out = [a0];
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      p = base[i],
      q = base[Math.min(n, i + 1)],
      o = base[Math.max(0, i - 1)];
    let tx = q[0] - o[0],
      tz = q[1] - o[1];
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    const env = Math.pow(Math.sin(Math.PI * t), 0.8);
    let off = 0;
    if (shape === 'winding')
      off = Math.sin(t * waves * 2 * Math.PI + ph) + 0.25 * Math.sin(t * 5.1 * 2 * Math.PI + ph2);
    else if (shape === 'scurve') off = Math.sin(t * 2 * Math.PI);
    else if (shape === 'switchback') {
      const u = t * legs;
      off = 1 - 2 * Math.abs(((u + 0.25) % 1) * 2 - 1);
      off = Math.sign(off) * Math.pow(Math.abs(off), 0.6);
    }
    off = off * amp * env + (mapgenNoise(t * L * 0.08, 3.7, ns) - 0.5) * 2 * wob * 3 * env;
    out.push([mapgenBetween(p[0] - tz * off, m, w - m), mapgenBetween(p[1] + tx * off, m, h - m)]);
  }
  if (nB) out.push(b0);
  /* smooth the corners the between and the switchback make, keeping the straight ends */
  let pts = mapgenResample(out, 0.5);
  for (let pass = 0; pass < (shape === 'switchback' ? 8 : 4); pass++) {
    const nx = pts.map(p => p.slice());
    for (let i = 2; i < pts.length - 2; i++) {
      const fromA = i * 0.5,
        fromB = (pts.length - 1 - i) * 0.5;
      if (fromA < MAPGEN_STRAIGHT_IN - 0.5 || (nB && fromB < MAPGEN_STRAIGHT_IN - 0.5)) continue;
      nx[i] = [
        (pts[i - 2][0] + pts[i - 1][0] * 2 + pts[i][0] * 2 + pts[i + 1][0] * 2 + pts[i + 2][0]) / 8,
        (pts[i - 2][1] + pts[i - 1][1] * 2 + pts[i][1] * 2 + pts[i + 1][1] * 2 + pts[i + 2][1]) / 8,
      ];
    }
    pts = nx;
  }
  return mapgenResample(pts, 0.5);
}
export function mapgenStageRoad(G) {
  const { P, w, h } = G,
    rnd = G.rng('road'),
    ns = G.salt('road');
  const E = P.road.exits.map(e => ({ ...e, pt: mapgenExitPoint(w, h, e) }));
  G.exits = E;
  const half = P.road.width / 2;
  if (E.length === 1) {
    /* a dead end: the road runs from the exit to a hub inside */
    const e = E[0],
      nA = MAPGEN_INWARD[e.side],
      deep = (e.side === 'N' || e.side === 'S' ? h : w) * 0.55;
    const end = [mapgenBetween(e.pt[0] + nA[0] * deep, 8, w - 8), mapgenBetween(e.pt[1] + nA[1] * deep, 8, h - 8)];
    G.road.push({ pts: mapgenRoadCurve(G, e, { pt: end }, P.road.shape, rnd, ns), width: P.road.width, main: true });
  } else {
    G.road.push({ pts: mapgenRoadCurve(G, E[0], E[1], P.road.shape, rnd, ns), width: P.road.width, main: true });
  }
  /* the hub, a first guess (chooseHub settles it once the water is in): half way along the main road, or at its end */
  const M = G.road[0].pts,
    hk = E.length === 1 ? M.length - 1 : Math.floor(M.length / 2);
  G.hubK = hk;
  G.hub = [mapgenRound2(M[hk][0]), mapgenRound2(M[hk][1])];
  /* more exits branch off the main road where it passes nearest the end of their straight run in (a gentle
     curve: a shaped branch doubles back on itself) */
  for (let x = 2; x < E.length; x++) {
    const e = E[x],
      n = MAPGEN_INWARD[e.side],
      in7 = [e.pt[0] + n[0] * MAPGEN_STRAIGHT_IN, e.pt[1] + n[1] * MAPGEN_STRAIGHT_IN];
    let best = hk,
      bd = 1e9;
    for (let i = 2 * MAPGEN_STRAIGHT_IN; i < M.length - 2 * MAPGEN_STRAIGHT_IN; i++) {
      const d = Math.hypot(M[i][0] - in7[0], M[i][1] - in7[1]);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    const pts = mapgenRoadCurve(G, e, { pt: M[best] }, 'straight', rnd, ns + x);
    G.road.push({ pts, width: Math.max(1.6, P.road.width * 0.85), main: false });
  }
  /* the distance field: every road sample stamps the cells round it */
  let s = 0;
  for (let k = 0; k < G.road.length; k++) {
    const R = G.road[k];
    for (let i = 0; i < R.pts.length; i++) {
      if (i) s += Math.hypot(R.pts[i][0] - R.pts[i - 1][0], R.pts[i][1] - R.pts[i - 1][1]);
      G.roadPts.push({ x: R.pts[i][0], z: R.pts[i][1], r: R.width / 2, s, k });
    }
  }
  const reach = 14;
  G.roadPts.forEach((p, n) => {
    for (let j = Math.max(0, Math.floor(p.z - reach)); j < Math.min(h, Math.ceil(p.z + reach)); j++)
      for (let i = Math.max(0, Math.floor(p.x - reach)); i < Math.min(w, Math.ceil(p.x + reach)); i++) {
        const d = Math.hypot(i + 0.5 - p.x, j + 0.5 - p.z),
          q = j * w + i;
        if (d - p.r < G.dist[q] - (G.near[q] >= 0 ? G.roadPts[G.near[q]].r : 0)) {
          G.dist[q] = d;
          G.near[q] = n;
        }
      }
  });
  /* paint: the surface, then a verge whose edge the softness dial roughens */
  const surf = MAPGEN_SURFACES[P.road.surface],
    verge = G.B.ground.verge,
    vw = 0.4 + 1.4 * P.road.verge,
    vs = G.salt('road', 'verge');
  for (let q = 0; q < w * h; q++) {
    if (G.near[q] < 0) continue;
    const r = G.roadPts[G.near[q]].r,
      d = G.dist[q] - r,
      x = q % w,
      z = Math.floor(q / w);
    if (d <= 0) {
      G.T[q] = surf;
      G.F[q] |= 1;
    } else if (d < vw * (0.35 + 0.9 * mapgenNoise(x / 2.3, z / 2.3, vs)) && P.road.verge > 0.02) {
      G.T[q] = verge;
      G.F[q] |= 2;
    }
  }
  /* flatten: a smoothed height along each road, its slope limited, blended out to the sides */
  mapgenFlattenRoads(G, half);
}
export function mapgenCornerHeight(G, x, z) {
  const i = mapgenBetween(Math.round(x), 0, G.w),
    j = mapgenBetween(Math.round(z), 0, G.h);
  return G.H[j * (G.w + 1) + i];
}
export function mapgenFlattenRoads(G, half) {
  const { w, h } = G,
    prof = new Float32Array(G.roadPts.length);
  for (const R of G.road) {
    const n = R.pts.length,
      raw = R.pts.map(p => mapgenCornerHeight(G, p[0], p[1])),
      win = 14;
    const sm = raw.map((_, i) => {
      let s = 0,
        c = 0;
      for (let k = Math.max(0, i - win); k <= Math.min(n - 1, i + win); k++) {
        s += raw[k];
        c++;
      }
      return s / c;
    });
    const lim = 0.09; /* per half metre: 18% at most */
    for (let i = 1; i < n; i++) sm[i] = mapgenBetween(sm[i], sm[i - 1] - lim, sm[i - 1] + lim);
    for (let i = n - 2; i >= 0; i--) sm[i] = mapgenBetween(sm[i], sm[i + 1] - lim, sm[i + 1] + lim);
    R.prof = sm;
  }
  let o = 0;
  for (const R of G.road) {
    for (let i = 0; i < R.pts.length; i++) prof[o + i] = R.prof[i];
    o += R.pts.length;
  }
  /* corners: nearest road sample by brute force within reach (the cell field is at centres) */
  for (let j = 0; j <= h; j++)
    for (let i = 0; i <= w; i++) {
      const q = mapgenBetween(j, 0, h - 1) * w + mapgenBetween(i, 0, w - 1),
        k = G.near[q];
      if (k < 0) continue;
      const p = G.roadPts[k],
        d = Math.hypot(i - p.x, j - p.z) - p.r,
        inner = 1.2,
        blend = 5;
      if (d > inner + blend) continue;
      const t = d <= inner ? 1 : 1 - mapgenSmooth((d - inner) / blend),
        c = j * (w + 1) + i;
      G.H[c] = G.H[c] * (1 - t) + prof[k] * t;
    }
  void half;
}

/* ---------- 4. exits and hub ---------- */
export function mapgenSimplify(pts, tol) {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = /** @type {number[]} */ (st.pop());
    let md = 0,
      mi = -1;
    const A = pts[a],
      B = pts[b],
      vx = B[0] - A[0],
      vz = B[1] - A[1],
      l2 = vx * vx + vz * vz || 1e-9;
    for (let i = a + 1; i < b; i++) {
      const t = mapgenBetween(((pts[i][0] - A[0]) * vx + (pts[i][1] - A[1]) * vz) / l2, 0, 1),
        d = Math.hypot(A[0] + vx * t - pts[i][0], A[1] + vz * t - pts[i][1]);
      if (d > md) {
        md = d;
        mi = i;
      }
    }
    if (md > tol && mi > 0) {
      keep[mi] = 1;
      st.push([a, mi], [mi, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}
/* the hub: the main road's sample nearest its middle (or its end) with dry ground all round, away from the exits */
export function mapgenChooseHub(G) {
  const M = G.road[0].pts,
    want = G.exits.length === 1 ? M.length - 1 : Math.floor(M.length / 2),
    lo = 2 * MAPGEN_STRAIGHT_IN + 6;
  const ok = (k, r, away) => {
    let dry = true;
    mapgenPaintDisc(G, M[k][0], M[k][1], r, q => {
      if (G.F[q] & (4 | 8)) dry = false;
    });
    return dry && G.exits.every(e => Math.hypot(M[k][0] - e.pt[0], M[k][1] - e.pt[1]) > away);
  };
  /* first with room round it; on a crowded map (water along a short road) a dry spot of the road will do */
  for (const [r, away, from] of [
    [4, 10, Math.min(lo, want)],
    [1.5, 4, 4],
  ])
    for (let d = 0; d < M.length; d++)
      for (const k of [want - d, want + d])
        if (k >= from && k < M.length && ok(k, r, away)) {
          G.hubK = k;
          G.hub = [mapgenRound2(M[k][0]), mapgenRound2(M[k][1])];
          return;
        }
  G.notes.push('no dry spot on the road for the hub');
}
export function mapgenStageExits(G) {
  const { w, h } = G,
    used = {};
  const M = G.road[0].pts,
    hk = G.hubK;
  G.edgeExits = G.exits.map((e, x) => {
    used[e.side] = (used[e.side] || 0) + 1;
    const id = MAPGEN_SIDE_NAME[e.side] + (used[e.side] > 1 ? used[e.side] : '');
    /* the walk from the hub: along the main road, or along it to the branch and then out */
    let path;
    if (x === 0) path = M.slice(0, hk + 1).reverse();
    else if (x === 1) path = M.slice(hk);
    else {
      const R = G.road[x - 1].pts,
        end = R[R.length - 1];
      let bi = 0,
        bd = 1e9;
      for (let i = 0; i < M.length; i++) {
        const d = Math.hypot(M[i][0] - end[0], M[i][1] - end[1]);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
      const toBranch = bi >= hk ? M.slice(hk, bi + 1) : M.slice(bi, hk + 1).reverse();
      path = toBranch.concat(R.slice().reverse());
    }
    path = path.slice();
    path[0] = G.hub;
    path[path.length - 1] = e.pt;
    const len = Math.round(mapgenPolyLength(path) * 2) / 2;
    G.keep.push([e.pt[0], e.pt[1], 2.2]);
    return {
      id,
      side: e.side,
      t: +e.t.toFixed(4),
      in: MAPGEN_EXIT_IN,
      width: e.width,
      len,
      path: mapgenSimplify(path, 0.4).map(p => [mapgenRound2(p[0]), mapgenRound2(p[1])]),
    };
  });
  /* the hub: flat, clear of trees */
  const [hx, hz] = G.hub,
    hh = mapgenCornerHeight(G, hx, hz);
  for (let j = Math.max(0, Math.floor(hz - 4)); j <= Math.min(h, Math.ceil(hz + 4)); j++)
    for (let i = Math.max(0, Math.floor(hx - 4)); i <= Math.min(w, Math.ceil(hx + 4)); i++) {
      const d = Math.hypot(i - hx, j - hz);
      if (d > 4) continue;
      const t = d < 2.5 ? 1 : 1 - mapgenSmooth((d - 2.5) / 1.5),
        c = j * (w + 1) + i;
      G.H[c] = G.H[c] * (1 - t) + hh * t;
    }
  G.keep.push([hx, hz, 2.2]);
}

/* ---------- land: water and terraces (part of the ground stage, after the road is known) ---------- */
export function mapgenPaintDisc(G, cx, cz, r, fn) {
  for (let j = Math.max(0, Math.floor(cz - r - 1)); j < Math.min(G.h, Math.ceil(cz + r + 1)); j++)
    for (let i = Math.max(0, Math.floor(cx - r - 1)); i < Math.min(G.w, Math.ceil(cx + r + 1)); i++) {
      const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cz);
      if (d <= r) fn(j * G.w + i, d);
    }
}
export function mapgenLowerWater(G) {
  /* water corners sit a little under their bank, each body levelled to its lowest corner */
  const { w, h } = G,
    isW = (i, j) => i >= 0 && j >= 0 && i < w && j < h && G.F[j * w + i] & 4;
  const seen = new Uint8Array(w * h);
  for (let q0 = 0; q0 < w * h; q0++) {
    if (!(G.F[q0] & 4) || seen[q0]) continue;
    const body = [q0];
    seen[q0] = 1;
    for (let n = 0; n < body.length; n++) {
      const q = body[n],
        i = q % w,
        j = Math.floor(q / w);
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        if (isW(i + di, j + dj) && !seen[(j + dj) * w + i + di]) {
          seen[(j + dj) * w + i + di] = 1;
          body.push((j + dj) * w + i + di);
        }
    }
    const flow = body.length > 40 && G.streams.length; /* a stream follows the land; a pond lies level */
    let lo = 1e9;
    for (const q of body) lo = Math.min(lo, mapgenCornerHeight(G, q % w, Math.floor(q / w)));
    for (const q of body) {
      const i = q % w,
        j = Math.floor(q / w);
      for (const [ci, cj] of [
        [i, j],
        [i + 1, j],
        [i, j + 1],
        [i + 1, j + 1],
      ]) {
        const c = cj * (w + 1) + ci,
          inside = isW(ci, cj) && isW(ci - 1, cj) && isW(ci, cj - 1) && isW(ci - 1, cj - 1);
        const target = flow ? G.H[c] - (inside ? 0.45 : 0.15) : lo - (inside ? 0.45 : 0.15);
        G.H[c] = Math.min(G.H[c], target);
      }
    }
  }
}
export function mapgenStreamLine(G, rnd, kind) {
  /* across the map between two sides with no exit if there are such, crossing the main road */
  const { w, h } = G,
    sides = 'NSEW'.split('').filter(s => !G.exits.some(e => e.side === s));
  const pairs = [
    ['N', 'S'],
    ['E', 'W'],
  ];
  let pair = pairs.find(p => sides.includes(p[0]) && sides.includes(p[1])) || pairs[rnd.int(0, 1)];
  if (rnd.chance(0.5)) pair = [pair[1], pair[0]];
  const M = G.road[0].pts,
    mid =
      M[Math.floor(M.length * (rnd.chance(0.5) ? rnd.range(0.22, 0.38) : rnd.range(0.62, 0.78)))]; /* not at the hub */
  const edge = (s, t) =>
    s === 'N' ? [t * w, h + 1] : s === 'S' ? [t * w, -1] : s === 'E' ? [w + 1, t * h] : [-1, t * h];
  const along = pair[0] === 'N' || pair[0] === 'S' ? mid[0] / w : mid[1] / h;
  const A = edge(pair[0], mapgenBetween(along + rnd.range(-0.2, 0.2), 0.15, 0.85)),
    Z = edge(pair[1], mapgenBetween(along + rnd.range(-0.2, 0.2), 0.15, 0.85));
  const pts = [];
  const n = 40,
    ns = G.salt('heights', 'stream' + kind);
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      bx = i < n / 2 ? A[0] + (mid[0] - A[0]) * (t * 2) : mid[0] + (Z[0] - mid[0]) * (t * 2 - 1),
      bz = i < n / 2 ? A[1] + (mid[1] - A[1]) * (t * 2) : mid[1] + (Z[1] - mid[1]) * (t * 2 - 1);
    const off = (mapgenNoise(t * 4, 1.3, ns) - 0.5) * 9 * Math.sin(Math.PI * t);
    const nx = pair[0] === 'N' || pair[0] === 'S' ? 1 : 0;
    pts.push([bx + off * nx, bz + off * (1 - nx)]);
  }
  return mapgenResample(pts, 0.5);
}
export function mapgenPaintStream(G, pts, width, kind) {
  const bank = G.B.ground.bank;
  for (const p of pts)
    mapgenPaintDisc(G, p[0], p[1], width / 2 + 0.9, (q, d) => {
      if (d <= width / 2) {
        G.T[q] = d < width / 2 - 1.1 ? 'd' : 'w';
        G.F[q] = (G.F[q] & ~(2 | 32 | 64)) | 4;
      } else if (!(G.F[q] & (1 | 4))) {
        G.T[q] = bank;
        G.F[q] |= 64;
      }
    });
  const inside = pts.filter(p => p[0] >= 0 && p[1] >= 0 && p[0] <= G.w && p[1] <= G.h);
  const st = {
    pts: mapgenSimplify(inside, 0.3).map(p => [mapgenRound2(p[0]), mapgenRound2(p[1])]),
    speed: kind === 'lava' ? 0.15 : 0.6,
  };
  G.streams.push(st);
  for (let i = 0; i < inside.length; i += 3) mapgenOccAdd(G, inside[i][0], inside[i][1], 0.8);
  if (kind === 'lava') {
    /* lava is a water kind by area: a rectangle round each stretch of the flow */
    for (let i = 0; i < inside.length; i += 16) {
      const seg = inside.slice(i, i + 17);
      let x0 = 1e9,
        z0 = 1e9,
        x1 = -1e9,
        z1 = -1e9;
      for (const p of seg) {
        x0 = Math.min(x0, p[0]);
        z0 = Math.min(z0, p[1]);
        x1 = Math.max(x1, p[0]);
        z1 = Math.max(z1, p[1]);
      }
      const m = width / 2 + 0.6;
      G.waters.push({
        x: mapgenRound2(x0 - m),
        z: mapgenRound2(z0 - m),
        w: mapgenRound2(x1 - x0 + 2 * m),
        h: mapgenRound2(z1 - z0 + 2 * m),
        k: 'lava',
      });
    }
  }
}
export function mapgenPaintPond(G, rnd, size) {
  /* a pond away from the road, as big as the amount dial says */
  const { w, h } = G,
    R = 4 + size * 9;
  /** @type {number[] | null} */
  let best = null,
    bs = -1e9;
  for (let t = 0; t < 60; t++) {
    const x = rnd.range(R + 4, w - R - 4),
      z = rnd.range(R + 4, h - R - 4),
      d = mapgenRoadDist(G, x, z) - mapgenNearRoadWidth(G, x, z) - R - 2,
      hub = Math.hypot(x - G.hub[0], z - G.hub[1]) - R;
    const score = Math.min(d, 6) + Math.min(hub, 10) * 0.3 + rnd.next();
    if (d > 0 && score > bs) {
      bs = score;
      best = [x, z];
    }
  }
  if (!best) {
    G.notes.push('no room for a pond away from the road');
    return null;
  }
  const [cx, cz] = best,
    ns = G.salt('heights', 'pond'),
    ex = rnd.range(0.75, 1.3);
  const bank = G.B.ground.bank;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const dx = (i + 0.5 - cx) / ex,
        dz = (j + 0.5 - cz) * ex,
        a = Math.atan2(dz, dx),
        rr = R * (0.8 + 0.4 * mapgenNoise(Math.cos(a) * 2 + 5, Math.sin(a) * 2 + 5, ns)),
        d = Math.hypot(dx, dz),
        q = j * w + i;
      if (G.F[q] & 1) continue;
      if (d <= rr) {
        G.T[q] = d < rr - 2.2 ? 'd' : 'w';
        G.F[q] = (G.F[q] & ~(2 | 32 | 64)) | 4;
      } else if (d <= rr + 1.4 && !(G.F[q] & 4)) {
        G.T[q] = bank;
        G.F[q] |= 64;
      }
    }
  mapgenOccAdd(G, cx, cz, R * 0.8);
  return { x: cx, z: cz, r: R };
}
export function mapgenPaintCoast(G, rnd, size) {
  /* the sea along a side with no exit */
  const free = 'NSEW'.split('').filter(s => !G.exits.some(e => e.side === s));
  if (!free.length) {
    G.notes.push('every side has an exit: no coast');
    return;
  }
  const side = free.includes('N') ? 'N' : free[rnd.int(0, free.length - 1)],
    { w, h } = G,
    ns = G.salt('heights', 'coast');
  const deep = (side === 'N' || side === 'S' ? h : w) * (0.12 + 0.25 * size);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const q = j * w + i,
        along = side === 'N' || side === 'S' ? i : j,
        from = side === 'N' ? h - j : side === 'S' ? j + 1 : side === 'E' ? w - i : i + 1,
        line = deep + (mapgenNoise(along / 9, 0.5, ns) - 0.5) * 8;
      if (G.F[q] & 1) continue; /* a road along the shore stays a road */
      if (from < line) {
        G.T[q] = from < line - 3 ? 'd' : 'w';
        G.F[q] = (G.F[q] & ~(2 | 32 | 64)) | 4;
      } else if (from < line + 1.6) {
        G.T[q] = 'S';
        G.F[q] |= 64;
      } else if (from < line + 4.5 && !(G.F[q] & 1)) G.T[q] = 's';
    }
  G.waterKind = 'sea';
}
export function mapgenTerraces(G, levels) {
  /* bands across the depth that rise toward the back, each a step up; the road ramps through them */
  const { w, h, P } = G,
    W2 = w * 2,
    H2 = h * 2,
    rise = Math.round((0.4 + P.land.cliffs * 1.2) * 20) / 20,
    ns = G.salt('heights', 'terrace');
  const lvl = (x, z) => {
    const t = (z - 8) / (h - 16) + (mapgenFbm(x / 14, z / 14, ns) - 0.5) * 0.35;
    return mapgenBetween(Math.floor(t * (levels + 1)), 0, levels);
  };
  for (let j = 0; j < H2; j++) for (let i = 0; i < W2; i++) G.S[j * W2 + i] = lvl((i + 0.5) / 2, (j + 0.5) / 2) * rise;
  /* along each road: the raise ramps no faster than 0.1 m a half metre */
  let o = 0;
  const prof = new Float32Array(G.roadPts.length);
  for (const R of G.road) {
    const n = R.pts.length,
      raw = R.pts.map(p => lvl(p[0], p[1]) * rise);
    const win = Math.ceil((rise / 0.1) * 0.6),
      sm = raw.map((_, i) => {
        let s = 0,
          c = 0;
        for (let k = Math.max(0, i - win); k <= Math.min(n - 1, i + win); k++) {
          s += raw[k];
          c++;
        }
        return s / c;
      });
    for (let i = 1; i < n; i++) sm[i] = mapgenBetween(sm[i], sm[i - 1] - 0.1, sm[i - 1] + 0.1);
    for (let i = n - 2; i >= 0; i--) sm[i] = mapgenBetween(sm[i], sm[i + 1] - 0.1, sm[i + 1] + 0.1);
    for (let i = 0; i < n; i++) prof[o + i] = Math.round(sm[i] * 20) / 20;
    o += n;
  }
  for (let j = 0; j < H2; j++)
    for (let i = 0; i < W2; i++) {
      const x = (i + 0.5) / 2,
        z = (j + 0.5) / 2,
        q = mapgenCellAt(G, x, z),
        k = G.near[q];
      if (k < 0) continue;
      const p = G.roadPts[k];
      if (Math.hypot(x - p.x, z - p.z) <= p.r + 0.75) G.S[j * W2 + i] = prof[k];
    }
  /* the hub's and the exits' surroundings sit at their road's raise */
  for (const [cx, cz, rr] of [[G.hub[0], G.hub[1], 3.5], ...G.exits.map(e => [e.pt[0], e.pt[1], 3])]) {
    const k = G.near[mapgenCellAt(G, cx, cz)],
      v = k >= 0 ? prof[k] : 0;
    for (let j = 0; j < H2; j++)
      for (let i = 0; i < W2; i++) if (Math.hypot((i + 0.5) / 2 - cx, (j + 0.5) / 2 - cz) <= rr) G.S[j * W2 + i] = v;
  }
  /* water lies at the bottom: no raise under it (under a bridge the road's ramp goes on, so the deck meets its ends) */
  for (let j = 0; j < H2; j++)
    for (let i = 0; i < W2; i++)
      if ((G.F[mapgenCellAt(G, (i + 0.5) / 2, (j + 0.5) / 2)] & (4 | 8)) === 4) G.S[j * W2 + i] = 0;
  /* where ramps meet (a branch on the main road, the hub's and the exits' rounds) a walkable cell is lowered until it
     is no more than 0.25 m above any walkable neighbour (a step is walkable up to 0.34 m) */
  const walk = new Uint8Array(W2 * H2);
  for (let j = 0; j < H2; j++)
    for (let i = 0; i < W2; i++) {
      const x = (i + 0.5) / 2,
        z = (j + 0.5) / 2,
        k = G.near[mapgenCellAt(G, x, z)];
      if (k >= 0 && Math.hypot(x - G.roadPts[k].x, z - G.roadPts[k].z) <= G.roadPts[k].r + 0.75) walk[j * W2 + i] = 1;
      if (Math.hypot(x - G.hub[0], z - G.hub[1]) <= 3.5 || G.exits.some(e => Math.hypot(x - e.pt[0], z - e.pt[1]) <= 3))
        walk[j * W2 + i] = 1;
    }
  for (let pass = 0, moved = 1; moved && pass < 400; pass++) {
    moved = 0;
    for (let q0 = 0; q0 < W2 * H2; q0++) {
      const q = pass % 2 ? W2 * H2 - 1 - q0 : q0;
      if (!walk[q]) continue;
      const i = q % W2,
        j = Math.floor(q / W2);
      let lo = G.S[q];
      if (i > 0 && walk[q - 1]) lo = Math.min(lo, G.S[q - 1] + 0.25);
      if (i < W2 - 1 && walk[q + 1]) lo = Math.min(lo, G.S[q + 1] + 0.25);
      if (j > 0 && walk[q - W2]) lo = Math.min(lo, G.S[q - W2] + 0.25);
      if (j < H2 - 1 && walk[q + W2]) lo = Math.min(lo, G.S[q + W2] + 0.25);
      if (lo < G.S[q] - 1e-6) {
        G.S[q] = lo;
        moved = 1;
      }
    }
  }
  /* the cells at a wall's top edge get the rock ground */
  const rock = G.B.ground.rock;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const q = j * w + i;
      if (G.F[q] & (1 | 4)) continue;
      const me = G.S[j * 2 * W2 + i * 2];
      let wall = false;
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const ii = mapgenBetween(i * 2 + di * 2, 0, W2 - 1),
          jj = mapgenBetween(j * 2 + dj * 2, 0, H2 - 1);
        if (me - G.S[jj * W2 + ii] > 0.3) wall = true;
      }
      if (wall) G.T[q] = rock;
    }
  G.stepsUsed = true;
}

/* ---------- 2. ground: the base, patches by noise, water, terraces, tall grass, clearings ---------- */
export function mapgenShareMask(G, eligible, share, s, scale) {
  /* the cells (of those eligible) whose noise is in the top share: exactly that share, in blobs */
  const vals = [];
  for (let q = 0; q < G.w * G.h; q++)
    if (eligible(q)) vals.push([mapgenFbm((q % G.w) / scale, Math.floor(q / G.w) / scale, s), q]);
  vals.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  return vals.slice(0, Math.round(vals.length * share)).map(v => v[1]);
}
export function mapgenStageGround(G) {
  const { B } = G,
    s = G.salt('ground');
  let n = 0;
  for (const [ch, share] of Object.entries(B.ground.patches || {}))
    for (const q of mapgenShareMask(G, q => !(G.F[q] & 3), share, s + 101 * ++n, 7 + n * 2)) G.T[q] = ch;
}
/* water and the feature's water (land: it follows the heights stage's seed), then the
   bridges where a road crosses it. The road's straight run in from each exit stays dry, so a seam is never a bridge */
export function mapgenStageWater(G) {
  const { P, B } = G,
    rnd = G.rng('heights', 'water');
  const wk = P.land.water,
    amt = P.land.waterAmount;
  if (wk === 'stream' || P.feature === 'bridge')
    mapgenPaintStream(G, mapgenStreamLine(G, rnd, 'w'), 1.6 + amt * 2.6, 'w');
  if (P.feature === 'lava') mapgenPaintStream(G, mapgenStreamLine(G, rnd, 'lava'), 2 + amt * 2, 'lava');
  if (wk === 'pond' || P.feature === 'jetty')
    G.pond = mapgenPaintPond(G, rnd, wk === 'pond' ? amt : Math.max(0.5, amt));
  if (wk === 'coast') mapgenPaintCoast(G, rnd, amt);
  if (G.F.some(f => f & 4)) {
    G.waterKind = G.waterKind || (P.feature === 'lava' && wk === 'none' ? 'lava' : B.water);
    for (const e of G.exits) {
      const n = MAPGEN_INWARD[e.side];
      for (let t = 0; t <= MAPGEN_STRAIGHT_IN + 1.5; t += 0.5)
        mapgenPaintDisc(G, e.pt[0] + n[0] * t, e.pt[1] + n[1] * t, e.width / 2 + G.P.road.width / 2 + 1, q => {
          if (G.F[q] & 4) {
            G.F[q] &= ~4;
            G.T[q] = G.F[q] & 1 ? MAPGEN_SURFACES[P.road.surface] : B.ground.bank;
          }
        });
    }
    mapgenLowerWater(G);
  }
  mapgenBridgesOverWater(G);
}
export function mapgenStageLand(G) {
  const { P, B } = G,
    rnd = G.rng('ground', 'land'),
    s = G.salt('ground');
  const lv = P.feature === 'terraces' ? Math.max(2, Math.round(P.land.terraces * 3)) : Math.round(P.land.terraces * 3);
  if (lv > 0) mapgenTerraces(G, lv);
  /* tall grass in drifts beside the road (where the wild billionaires wait), away from the hub and the exits */
  const away = q => {
    const x = (q % G.w) + 0.5,
      z = Math.floor(q / G.w) + 0.5;
    if (Math.hypot(x - G.hub[0], z - G.hub[1]) < 7) return false;
    for (const e of G.exits) if (Math.hypot(x - e.pt[0], z - e.pt[1]) < 7) return false;
    return true;
  };
  if (P.nature.tall > 0) {
    const ok = q => {
      if (G.F[q] & (1 | 2 | 4 | 64)) return false;
      const d = G.dist[q] - (G.near[q] >= 0 ? G.roadPts[G.near[q]].r : 0);
      return d > 1.5 && d < 11 && away(q);
    };
    for (const q of mapgenShareMask(G, ok, 0.08 + P.nature.tall * 0.42, s + 7, 4)) {
      G.T[q] = B.ground.tall;
      G.F[q] |= 32;
    }
  }
  /* clearings: open ground where no tree grows, a ragged blob whose floor thins out toward its edge */
  const nc = Math.round(P.nature.clearings * 4);
  for (let c = 0; c < nc; c++) {
    const x = rnd.range(8, G.w - 8),
      z = rnd.range(8, G.h - 8),
      r = rnd.range(3.5, 7),
      cs = s + 300 + c;
    mapgenPaintDisc(G, x, z, r * 1.4, q => {
      const i = q % G.w,
        j = Math.floor(q / G.w),
        a = Math.atan2(j + 0.5 - z, i + 0.5 - x),
        edge = r * (0.75 + 0.5 * mapgenNoise(Math.cos(a) * 1.6 + 9, Math.sin(a) * 1.6 + 9, cs)),
        d = Math.hypot(i + 0.5 - x, j + 0.5 - z);
      if (d > edge) return;
      G.F[q] |= 16;
      if (!(G.F[q] & (1 | 2 | 4 | 32 | 64)) && mapgenNoise(i / 2.2, j / 2.2, cs) > 0.25 + 0.6 * (d / edge))
        G.T[q] = B.ground.floor;
    });
  }
}
export function mapgenBridgesOverWater(G) {
  for (const R of G.road) {
    let run = [];
    const flush = () => {
      if (run.length >= 2) {
        const a = run[0],
          b = run[run.length - 1],
          dx = b[0] - a[0],
          dz = b[1] - a[1],
          L = Math.hypot(dx, dz) || 1,
          ext = 0.8;
        G.bridges.push({
          a: [mapgenRound2(a[0] - (dx / L) * ext), mapgenRound2(a[1] - (dz / L) * ext)],
          b: [mapgenRound2(b[0] + (dx / L) * ext), mapgenRound2(b[1] + (dz / L) * ext)],
          w: mapgenRound2(Math.max(1.4, R.width + 0.5)),
          kind: G.P.feature === 'lava' ? 'stone' : 'wood',
        });
        for (const p of run) mapgenPaintDisc(G, p[0], p[1], R.width / 2 + 0.5, q => (G.F[q] |= 8));
      }
      run = [];
    };
    for (const p of R.pts) {
      if (G.F[mapgenCellAt(G, p[0], p[1])] & 4) run.push(p);
      else flush();
    }
    flush();
  }
}

/* ---------- 6. plants: groves and an edge belt of trees, shrubs, rocks, tall grass, then the wild growth ---------- */
export function mapgenStagePlants(G) {
  const { P, B, w, h } = G,
    rnd = G.rng('plants');
  const nearExit = (x, z, r) => G.exits.some(e => Math.hypot(x - e.pt[0], z - e.pt[1]) < r);
  const treeOk = (x, z) =>
    !(G.F[mapgenCellAt(G, x, z)] & 16) && Math.hypot(x - G.hub[0], z - G.hub[1]) > 7 && !nearExit(x, z, 6);
  const treeAvoid = MAPGEN_PATH_GROUND + MAPGEN_WET;
  const T = P.nature.trees,
    gw = P.nature.growth;
  /* groves */
  const ng = Math.round(1 + T * 5);
  for (let g = 0; g < ng; g++) {
    const cx = rnd.range(6, w - 6),
      cz = rnd.range(6, h - 6),
      rx = rnd.range(4, 9),
      rz = rnd.range(3, 7);
    if (mapgenRoadDist(G, cx, cz) < 5) continue;
    const n = Math.round(((rx * rz) / 5) * (0.4 + T));
    for (let i = 0; i < n * 3 && n > 0; i++) {
      const a = rnd.range(0, Math.PI * 2),
        d = Math.sqrt(rnd.next()),
        x = cx + Math.cos(a) * rx * d,
        z = cz + Math.sin(a) * rz * d;
      if (treeOk(x, z))
        mapgenPutProp(G, rnd.pick(B.trees), x, z, {
          s: rnd.range(0.85, 1.15),
          f: rnd.chance(0.45),
          avoid: treeAvoid,
          road: 1.2,
        });
    }
  }
  /* a belt of trees along the edges, open at the exits */
  const belt = Math.round((w + h) * 2 * 0.14 * T);
  for (let i = 0; i < belt * 3; i++) {
    const side = rnd.int(0, 3),
      u = rnd.next(),
      inset = Math.abs(rnd.gauss()) * 2.5 + 1;
    const x = side === 0 ? u * w : side === 1 ? u * w : side === 2 ? inset : w - inset,
      z = side === 0 ? inset : side === 1 ? h - inset : u * h;
    if (treeOk(x, z) && !nearExit(x, z, 8))
      mapgenPutProp(G, rnd.pick(B.trees), x, z, {
        s: rnd.range(0.85, 1.2),
        f: rnd.chance(0.45),
        avoid: treeAvoid,
        road: 1.2,
      });
  }
  /* shrubs and rocks, scattered */
  const area = w * h;
  for (const [pool, per] of [
    [B.shrubs, 220],
    [B.rocks, 300],
  ]) {
    if (!pool) continue;
    const n = Math.round((area / per) * (0.4 + gw));
    for (let i = 0; i < n * 4 && n; i++) {
      const x = rnd.range(1, w - 1),
        z = rnd.range(1, h - 1);
      if (Math.hypot(x - G.hub[0], z - G.hub[1]) < 5) continue;
      mapgenPutProp(G, rnd.pick(pool), x, z, {
        s: rnd.range(0.85, 1.15),
        f: rnd.chance(0.45),
        avoid: treeAvoid,
        road: 0.9,
      });
    }
  }
  /* tall grass props in the tall grass */
  for (let q = 0; q < w * h; q++)
    if (G.F[q] & 32 && rnd.chance(0.35 * (0.5 + gw)))
      mapgenPutProp(G, rnd.pick(B.tall), (q % w) + rnd.range(0.1, 0.9), Math.floor(q / w) + rnd.range(0.1, 0.9), {
        s: rnd.range(0.85, 1.15),
        f: rnd.chance(0.45),
        squeeze: 0.5,
      });
  /* water plants on the banks and in shallow water */
  if (B.waterPlants && G.waterKind !== 'sea' && G.waterKind !== 'lava' && G.waterKind !== 'ice')
    for (let q = 0; q < w * h; q++)
      if (G.F[q] & 64 && !(G.F[q] & 8) && rnd.chance(0.12 * (0.4 + gw)))
        mapgenPutProp(G, rnd.pick(B.waterPlants), (q % w) + rnd.next(), Math.floor(q / w) + rnd.next(), {
          s: rnd.range(0.85, 1.15),
          f: rnd.chance(0.45),
        });
  mapgenGrowWild(G, rnd, gw);
}
/* the grow-wild rules (tools/grow-wild.py grow_scene), with its path test fixed: paved terrains, the path letters
   and the road itself are kept clear; never on a bridge or a jetty */
export function mapgenGrowWild(G, rnd, density) {
  const { w, h, cat, terr, B } = G,
    letters = new Set(G.T);
  const noWater = G.waterKind === 'sea' || G.waterKind === 'lava' || G.waterKind === 'ice';
  if (noWater) for (const c of MAPGEN_WET) letters.delete(c);
  const pool = {};
  for (const [k, M] of Object.entries(cat))
    if (M.family && M.grow && M.weight && [...M.grow].some(c => letters.has(c)))
      (pool[M.family] = pool[M.family] || []).push(k);
  const fams = Object.keys(MAPGEN_FAMILY_SHARE).filter(f => pool[f]);
  if (!fams.length) return;
  const share = Object.fromEntries(fams.map(f => [f, MAPGEN_FAMILY_SHARE[f]]));
  const want = Math.floor(((w * h) / 30) * density),
    count = {},
    cap = Math.max(6, Math.floor(want / 5)),
    favour = B.plants || {};
  const paved = c => (terr[c] && terr[c].paved) || MAPGEN_PATH_GROUND.includes(c);
  let added = 0;
  for (let tries = 0; added < want && tries < want * 40; tries++) {
    const fam = rnd.pick(share),
      x = rnd.range(0.5, w - 0.5),
      z = rnd.range(0.5, h - 0.5),
      q = mapgenCellAt(G, x, z),
      c = G.T[q];
    if (G.F[q] & (1 | 2 | 8 | 128)) continue;
    let near = false;
    for (const dx of [-0.5, 0, 0.5])
      for (const dz of [-0.5, 0, 0.5]) if (paved(mapgenGround(G, x + dx, z + dz))) near = true;
    if (near || paved(c)) continue;
    if (MAPGEN_WET.includes(c) && noWater) continue;
    const ks = pool[fam].filter(k => cat[k].grow.includes(c) && (count[k] || 0) < cap);
    if (!ks.length) continue;
    const k = rnd.pick(Object.fromEntries(ks.map(k => [k, cat[k].weight * (favour[k] ? 3 : 1)])));
    const M = cat[k];
    if (MAPGEN_WET.includes(c) && !M.grow.includes('w') && !M.grow.includes('d')) continue;
    const s = rnd.range(0.85, 1.15);
    if ((fam === 'trees' || fam === 'shrubs') && Math.hypot(x - G.hub[0], z - G.hub[1]) < 6) continue;
    const p = mapgenPutProp(G, k, x, z, {
      s,
      f: rnd.chance(0.45),
      w: MAPGEN_WILD_MARK,
      water: MAPGEN_WET.includes(c),
      gap: 0.25,
      road: 0.8,
    });
    if (p) {
      added++;
      count[k] = (count[k] || 0) + 1;
    }
  }
}

/* ---------- 7. feature ---------- */
export function mapgenStageFeature(G) {
  const { P, B } = G,
    rnd = G.rng('feature'),
    f = P.feature;
  const spotBeside = (minD, maxD, tries = 80) => {
    /* a spot this far from the road, away from the hub, the exits and water */
    for (let t = 0; t < tries; t++) {
      const x = rnd.range(8, G.w - 8),
        z = rnd.range(8, G.h - 8),
        q = mapgenCellAt(G, x, z),
        d = G.dist[q] - (G.near[q] >= 0 ? G.roadPts[G.near[q]].r : 0);
      if (d < minD || d > maxD || G.F[q] & 4) continue;
      if (Math.hypot(x - G.hub[0], z - G.hub[1]) < 12 || G.exits.some(e => Math.hypot(x - e.pt[0], z - e.pt[1]) < 12))
        continue;
      return [x, z];
    }
    return null;
  };
  if (f === 'lookout') {
    const at = spotBeside(4, 9);
    if (!at) return G.notes.push('no room for the lookout');
    const [x, z] = at;
    mapgenClearRound(G, x, z, 4.5);
    mapgenRaise(G, x, z, 5, 1.4);
    mapgenPutProp(G, 'lookout_tower', x, z + 1, { force: true });
    mapgenPutProp(G, 'bench_wood', x + 2.2, z - 1.6, { force: true });
    mapgenSpur(G, x, z);
  } else if (f === 'glade') {
    const at = spotBeside(5, 14);
    if (!at) return G.notes.push('no room for the glade');
    const [x, z] = at;
    mapgenClearRound(G, x, z, 7);
    mapgenPaintDisc(G, x, z, 6.5, q => {
      if (!(G.F[q] & (1 | 4))) G.T[q] = G.terr.E ? 'E' : B.ground.floor;
      G.F[q] = (G.F[q] & ~32) | 16;
    });
    mapgenPutProp(G, 'campfire', x, z, { force: true });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + rnd.range(-0.3, 0.3);
      mapgenPutProp(G, i ? 'log' : 'stump', x + Math.cos(a) * 2.2, z + Math.sin(a) * 2.2, { force: true });
    }
    mapgenSpur(G, x, z);
  } else if (f === 'jetty' && G.pond) {
    /* boards from the bank toward the pond's middle, over the water */
    const { x: px, z: pz, r } = G.pond;
    const M = G.road[0].pts;
    let best = M[0],
      bd = 1e9;
    for (const p of M) {
      const d = Math.hypot(p[0] - px, p[1] - pz);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    const dx = (px - best[0]) / (bd || 1),
      dz = (pz - best[1]) / (bd || 1);
    const start = bd - r - 2,
      end = bd - r * 0.25;
    for (let t = Math.max(0, start - 3); t < end; t += 0.25)
      for (let o = -0.9; o <= 0.9; o += 0.3) {
        const x = best[0] + dx * t - dz * o,
          z = best[1] + dz * t + dx * o,
          q = mapgenCellAt(G, x, z);
        if (t < start && !(G.F[q] & (1 | 4))) {
          G.T[q] = MAPGEN_SURFACES[P.road.surface];
          G.F[q] |= 2;
        } else if (t >= start) {
          G.T[q] = 'b';
          G.F[q] = (G.F[q] & ~4) | 128;
        }
      }
    for (const o of [-1.1, 1.1])
      for (let t = start + 1; t < end; t += 2.4)
        mapgenPutProp(G, 'dock_post', best[0] + dx * t - dz * o, best[1] + dz * t + dx * o, {
          force: true,
          water: true,
        });
  }
}
export function mapgenClearRound(G, x, z, r) {
  G.props = G.props.filter(p => Math.hypot(p.x - x, p.z - z) > r);
  for (const [k, L] of G.occ)
    G.occ.set(
      k,
      L.filter(o => Math.hypot(o[0] - x, o[1] - z) > r)
    );
  G.keep.push([x, z, r * 0.6]);
}
export function mapgenRaise(G, x, z, r, by) {
  for (let j = 0; j <= G.h; j++)
    for (let i = 0; i <= G.w; i++) {
      const d = Math.hypot(i - x, j - z);
      if (d < r + 4) G.H[j * (G.w + 1) + i] += by * (d < r ? 1 : 1 - mapgenSmooth((d - r) / 4));
    }
}
export function mapgenSpur(G, x, z) {
  /* a short path from the road to a feature */
  const k = G.near[mapgenCellAt(G, x, z)];
  if (k < 0) return;
  const p = G.roadPts[k],
    L = Math.hypot(x - p.x, z - p.z),
    surf = MAPGEN_SURFACES[G.P.road.surface];
  for (let t = 0; t < L - 1.5; t += 0.3)
    mapgenPaintDisc(G, p.x + ((x - p.x) * t) / L, p.z + ((z - p.z) * t) / L, 0.7, q => {
      if (!(G.F[q] & (1 | 4))) {
        G.T[q] = surf;
        G.F[q] = (G.F[q] & ~32) | 2;
      }
    });
}

/* ---------- 8. props: signposts at the exits, lamps along the road, benches and bins, townsfolk spots ---------- */
export function mapgenStageProps(G) {
  const { P } = G,
    rnd = G.rng('props'),
    D = P.props;
  const side = (k, off) => {
    /* a point beside main-road sample k, off metres from its edge (sign = side) */
    const R = G.road[0].pts,
      a = R[Math.max(0, k - 1)],
      b = R[Math.min(R.length - 1, k + 1)],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1,
      p = R[k],
      r = P.road.width / 2 + Math.abs(off);
    const sg = Math.sign(off) || 1;
    return [p[0] - ((b[1] - a[1]) / L) * r * sg, p[1] + ((b[0] - a[0]) / L) * r * sg];
  };
  const R = G.road[0].pts;
  if (D.signs > 0)
    G.exits.forEach((e, x) => {
      const pts = x === 0 ? R : x === 1 ? R.slice().reverse() : G.road[x - 1].pts;
      const r = (x < 2 ? P.road.width : G.road[x - 1].width) / 2 + 1;
      for (let k = Math.min(pts.length - 2, 12); k < Math.min(pts.length - 1, 60); k += 2) {
        const a = pts[k - 1],
          b = pts[k + 1],
          L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1,
          nx = -(b[1] - a[1]) / L,
          nz = (b[0] - a[0]) / L;
        if (mapgenPutProp(G, 'signpost', pts[k][0] + nx * r, pts[k][1] + nz * r, { force: true })) break;
        if (mapgenPutProp(G, 'signpost', pts[k][0] - nx * r, pts[k][1] - nz * r, { force: true })) break;
      }
    });
  if (D.lamps > 0) {
    const every = Math.round(40 - 30 * D.lamps) * 2; /* samples: 80 m down to 20 m */
    let sg = 1;
    for (let k = 20; k < R.length - 20; k += every) {
      const [x, z] = side(k, 0.9 * sg);
      if (mapgenPutProp(G, 'streetlamp', x, z, { road: 0.3 })) sg = -sg;
    }
  }
  const nb = Math.round(D.benches * 4);
  for (let i = 0; i < nb; i++) {
    const k = Math.floor(R.length * (0.15 + 0.7 * ((i + rnd.range(0.2, 0.8)) / Math.max(1, nb)))),
      sg = rnd.chance(0.5) ? 1 : -1,
      [x, z] = side(k, 1.3 * sg);
    if (mapgenPutProp(G, 'bench_wood', x, z, { road: 0.3 }) && rnd.chance(D.bins)) {
      const [bx, bz] = side(Math.min(R.length - 1, k + 3), 1.1 * sg);
      mapgenPutProp(G, 'trash', bx, bz, { road: 0.3 });
    }
  }
  const nf = Math.round(D.folk * 4);
  for (let i = 0; i < nf; i++) {
    const k = Math.floor(R.length * rnd.range(0.15, 0.85)),
      [x, z] = side(k, (rnd.chance(0.5) ? 1 : -1) * 1.1),
      q = mapgenCellAt(G, x, z);
    if (!(G.F[q] & 4) && mapgenOccFree(G, x, z, 0.6)) {
      G.npcSpots.push([mapgenRound2(x), mapgenRound2(z)]);
      G.keep.push([x, z, 1]);
    }
  }
}

/* ---------- the scene ---------- */
export const MAPGEN_BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/* base64 by hand: the logic has no atob or btoa (it runs with no DOM lib) */
export function mapgenDecodeBase64(s) {
  const n = s.replace(/=+$/, '').length,
    out = new Uint8Array(Math.floor((n * 3) / 4));
  let o = 0;
  for (let i = 0; i < n; i += 4) {
    const v =
      (MAPGEN_BASE64.indexOf(s[i]) << 18) |
      (MAPGEN_BASE64.indexOf(s[i + 1]) << 12) |
      (Math.max(0, MAPGEN_BASE64.indexOf(s[i + 2] || 'A')) << 6) |
      Math.max(0, MAPGEN_BASE64.indexOf(s[i + 3] || 'A'));
    out[o++] = (v >> 16) & 255;
    if (o < out.length) out[o++] = (v >> 8) & 255;
    if (o < out.length) out[o++] = v & 255;
  }
  return out;
}
export function mapgenEncodeBase64(bytes) {
  const A = MAPGEN_BASE64;
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    s +=
      A[(n >> 18) & 63] +
      A[(n >> 12) & 63] +
      (i + 1 < bytes.length ? A[(n >> 6) & 63] : '=') +
      (i + 2 < bytes.length ? A[n & 63] : '=');
  }
  return s;
}
/**
 * the scene for these dials: { scene, notes }. ctx: { scenery (terrains, props), biomes }.
 * @param {any} params @param {{ scenery: any, biomes: Record<string, Biome> }} ctx
 */
export function mapgenScene(params, ctx) {
  const P = mapgenParams(params),
    G = mapgenNewWork(P, ctx);
  mapgenStageHeights(G);
  mapgenStageRoad(G);
  mapgenStageGround(G);
  mapgenStageWater(G);
  mapgenChooseHub(G);
  mapgenStageExits(G);
  mapgenStageLand(G);
  mapgenStageFeature(G);
  mapgenStagePlants(G);
  mapgenStageProps(G);
  const { w, h, B } = G;
  const tiles = [];
  for (let j = h - 1; j >= 0; j--) tiles.push(G.T.slice(j * w, (j + 1) * w).join(''));
  const heights = [];
  for (let j = h; j >= 0; j--)
    heights.push(Array.from(G.H.subarray(j * (w + 1), (j + 1) * (w + 1)), v => mapgenRound2(v) || 0));
  G.props.sort((a, b) => b.z - a.z || a.x - b.x);
  /** @type {any} */
  const sc = {
    name: (B.name || P.biome) + ' route',
    kind: P.kind,
    biome: P.biome,
    w,
    h,
    edge: B.ground.base,
    cam: { pitch: 34, h: 9, fov: 1 },
    blur: 1,
    folk: 0,
    ...(B.look || {}),
    hub: G.hub,
    exits: G.edgeExits.map(e => mapgenExitPoint(w, h, e)),
    edgeExits: G.edgeExits,
    tiles,
    heights,
    props: G.props,
    life: (B.life || []).map(l => ({ ...l })),
    npcSpots: G.npcSpots,
    wild: MAPGEN_WILD_MARK,
  };
  if (G.streams.length) sc.streams = G.streams;
  if (G.bridges.length) sc.bridges = G.bridges;
  if (G.waters.length) sc.waters = G.waters;
  if (G.waterKind) sc.waterKind = G.waterKind;
  if (G.stepsUsed) {
    const raw = new Int16Array(G.S.length);
    let any = false;
    for (let i = 0; i < raw.length; i++) if ((raw[i] = Math.round(G.S[i] * 20))) any = true;
    if (any) {
      sc.steps = mapgenEncodeBase64(new Uint8Array(raw.buffer));
      sc.stepm = mapgenEncodeBase64(new Uint8Array(G.S.length));
    }
  }
  sc.gen = { v: MAPGEN_VERSION, params: P, seed: P.seed };
  return { scene: sc, notes: G.notes };
}

/* ---------- checking a scene: can you walk from the hub to every exit? ---------- */
/** the exits the hub can't walk to (by edgeExits id), on a half-metre grid: water is blocked unless a bridge
 * crosses it, solid props block, a step taller than 0.34 m blocks (walk-view.js navGrid, simplified) */
export function mapgenUnreachable(sc, scenery) {
  const N = 2,
    gw = sc.w * N,
    gh = sc.h * N,
    blk = new Uint8Array(gw * gh),
    C = scenery || { terrains: {}, props: {} };
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      const ch = (sc.tiles[sc.h - 1 - Math.floor(j / N)] || '')[Math.floor(i / N)] || sc.edge,
        T = C.terrains[ch];
      if (!(T && T.walk != null ? T.walk : !MAPGEN_WET.includes(ch) || sc.ride)) blk[j * gw + i] = 1;
    }
  const each = (x0, z0, x1, z1, fn) => {
    for (let j = Math.max(0, Math.floor(z0 * N)); j < Math.min(gh, Math.ceil(z1 * N)); j++)
      for (let i = Math.max(0, Math.floor(x0 * N)); i < Math.min(gw, Math.ceil(x1 * N)); i++)
        fn(j * gw + i, (i + 0.5) / N, (j + 0.5) / N);
  };
  for (const b of sc.bridges || []) {
    const L = Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1]) || 1;
    for (let t = 0; t <= L; t += 0.25) {
      const x = b.a[0] + ((b.b[0] - b.a[0]) * t) / L,
        z = b.a[1] + ((b.b[1] - b.a[1]) * t) / L;
      each(x - b.w / 2, z - b.w / 2, x + b.w / 2, z + b.w / 2, (q, cx, cz) => {
        if (Math.hypot(cx - x, cz - z) <= b.w / 2) blk[q] = 0;
      });
    }
  }
  for (const p of sc.props || []) {
    const M = C.props[p.k];
    if (!M || M.walk) continue;
    const s = p.s || 1;
    if (M.box)
      each(p.x - (M.box[0] * s) / 2, p.z - 0.1, p.x + (M.box[0] * s) / 2, p.z + M.box[1] * s, q => (blk[q] = 1));
    else {
      const r = M.solid != null ? M.solid * s : M.flat ? 0 : (M.shadow || 0) * 0.42 * s;
      if (r > 0.05)
        each(
          p.x - r,
          p.z - r,
          p.x + r,
          p.z + r,
          (q, x, z) => Math.hypot(x - p.x, z - p.z - r * 0.2) <= r && (blk[q] = 1)
        );
    }
  }
  /* steps: the raise of each cell (decoded from base64 Int16) */
  /** @type {Int16Array | null} */
  let S = null;
  if (sc.steps) {
    const u = mapgenDecodeBase64(sc.steps);
    S = new Int16Array(u.buffer, 0, u.length >> 1);
  }
  const hub = sc.hub,
    start = Math.floor(hub[1] * N) * gw + Math.floor(hub[0] * N),
    seen = new Uint8Array(gw * gh),
    Q = [start];
  seen[start] = 1;
  for (let n = 0; n < Q.length; n++) {
    const q = Q[n],
      i = q % gw,
      j = Math.floor(q / gw);
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const ii = i + di,
        jj = j + dj,
        r = jj * gw + ii;
      if (ii < 0 || jj < 0 || ii >= gw || jj >= gh || seen[r] || blk[r]) continue;
      if (S && S.length === gw * gh && Math.abs(S[r] - S[q]) / 20 > 0.34) continue;
      seen[r] = 1;
      Q.push(r);
    }
  }
  return (sc.edgeExits || [])
    .filter(e => {
      const [x, z] = mapgenExitPoint(sc.w, sc.h, e);
      return !seen[mapgenBetween(Math.floor(z * N), 0, gh - 1) * gw + mapgenBetween(Math.floor(x * N), 0, gw - 1)];
    })
    .map(e => e.id);
}
