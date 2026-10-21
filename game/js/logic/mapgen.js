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
import { stepCornerHeight } from '../hooks.js';
import { hashString, rngFrom } from './rng.js';
/* eslint-disable no-func-assign */
expose({
  MAPGEN_BAND: [() => MAPGEN_BAND],
  MAPGEN_BANK_REACH: [() => MAPGEN_BANK_REACH],
  MAPGEN_BANK_SLOPE: [() => MAPGEN_BANK_SLOPE],
  MAPGEN_BASE64: [() => MAPGEN_BASE64],
  MAPGEN_DEFAULTS: [() => MAPGEN_DEFAULTS],
  MAPGEN_EXIT_IN: [() => MAPGEN_EXIT_IN],
  MAPGEN_FAMILY_SHARE: [() => MAPGEN_FAMILY_SHARE],
  MAPGEN_FEATURES: [() => MAPGEN_FEATURES],
  MAPGEN_HUB_BUILDINGS: [() => MAPGEN_HUB_BUILDINGS],
  MAPGEN_INWARD: [() => MAPGEN_INWARD],
  MAPGEN_OPPOSITE: [() => MAPGEN_OPPOSITE],
  MAPGEN_OUTWARD: [() => MAPGEN_OUTWARD],
  MAPGEN_PATH_GROUND: [() => MAPGEN_PATH_GROUND],
  MAPGEN_PATH_RAMP: [() => MAPGEN_PATH_RAMP],
  MAPGEN_ROAD_CAP: [() => MAPGEN_ROAD_CAP],
  MAPGEN_ROAD_CLIMB: [() => MAPGEN_ROAD_CLIMB],
  MAPGEN_SHAPES: [() => MAPGEN_SHAPES],
  MAPGEN_SIDE_NAME: [() => MAPGEN_SIDE_NAME],
  MAPGEN_SIZES: [() => MAPGEN_SIZES],
  MAPGEN_STAGES: [() => MAPGEN_STAGES],
  MAPGEN_STAIR_RISE: [() => MAPGEN_STAIR_RISE],
  MAPGEN_STRAIGHT_IN: [() => MAPGEN_STRAIGHT_IN],
  MAPGEN_SURFACES: [() => MAPGEN_SURFACES],
  MAPGEN_TOWN_WALL: [() => MAPGEN_TOWN_WALL],
  MAPGEN_VERSION: [() => MAPGEN_VERSION],
  MAPGEN_WATER: [() => MAPGEN_WATER],
  MAPGEN_WET: [() => MAPGEN_WET],
  MAPGEN_WILD_MARK: [() => MAPGEN_WILD_MARK],
  mapgenAlong: [() => mapgenAlong],
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
  mapgenCopyable: [() => mapgenCopyable, v => (mapgenCopyable = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenCornerHeight: [() => mapgenCornerHeight, v => (mapgenCornerHeight = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenDecodeBase64: [() => mapgenDecodeBase64, v => (mapgenDecodeBase64 = v)],
  mapgenDepth: [() => mapgenDepth],
  // @ts-expect-error -- replaced on purpose
  mapgenEdgeCorrection: [() => mapgenEdgeCorrection, v => (mapgenEdgeCorrection = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenEdgeStrip: [() => mapgenEdgeStrip, v => (mapgenEdgeStrip = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenEncodeBase64: [() => mapgenEncodeBase64, v => (mapgenEncodeBase64 = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenExitOf: [() => mapgenExitOf, v => (mapgenExitOf = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenExitPoint: [() => mapgenExitPoint, v => (mapgenExitPoint = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenFbm: [() => mapgenFbm, v => (mapgenFbm = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenFootpath: [() => mapgenFootpath, v => (mapgenFootpath = v)],
  mapgenGround: [() => mapgenGround],
  // @ts-expect-error -- replaced on purpose
  mapgenGrowWild: [() => mapgenGrowWild, v => (mapgenGrowWild = v)],
  mapgenInLot: [() => mapgenInLot],
  // @ts-expect-error -- replaced on purpose
  mapgenJoinOffset: [() => mapgenJoinOffset, v => (mapgenJoinOffset = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenKnoll: [() => mapgenKnoll, v => (mapgenKnoll = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenLandProfile: [() => mapgenLandProfile, v => (mapgenLandProfile = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenLattice: [() => mapgenLattice, v => (mapgenLattice = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenLayRoads: [() => mapgenLayRoads, v => (mapgenLayRoads = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenLevelLot: [() => mapgenLevelLot, v => (mapgenLevelLot = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenLowerWater: [() => mapgenLowerWater, v => (mapgenLowerWater = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenMergeDefaults: [() => mapgenMergeDefaults, v => (mapgenMergeDefaults = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenNearJoined: [() => mapgenNearJoined, v => (mapgenNearJoined = v)],
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
  mapgenPairScene: [() => mapgenPairScene, v => (mapgenPairScene = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenParams: [() => mapgenParams, v => (mapgenParams = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenPinEdges: [() => mapgenPinEdges, v => (mapgenPinEdges = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenPolyLength: [() => mapgenPolyLength, v => (mapgenPolyLength = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenProfilesMeet: [() => mapgenProfilesMeet, v => (mapgenProfilesMeet = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenPutProp: [() => mapgenPutProp, v => (mapgenPutProp = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenRadius: [() => mapgenRadius, v => (mapgenRadius = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenRampLimit: [() => mapgenRampLimit, v => (mapgenRampLimit = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenReach: [() => mapgenReach, v => (mapgenReach = v)],
  mapgenReached: [() => mapgenReached],
  // @ts-expect-error -- replaced on purpose
  mapgenResample: [() => mapgenResample, v => (mapgenResample = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenRoadCurve: [() => mapgenRoadCurve, v => (mapgenRoadCurve = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenRoadDist: [() => mapgenRoadDist, v => (mapgenRoadDist = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenRoadGrades: [() => mapgenRoadGrades, v => (mapgenRoadGrades = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenRoadProfiles: [() => mapgenRoadProfiles, v => (mapgenRoadProfiles = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenRoadReport: [() => mapgenRoadReport, v => (mapgenRoadReport = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenRoadSides: [() => mapgenRoadSides, v => (mapgenRoadSides = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenRoadSurface: [() => mapgenRoadSurface, v => (mapgenRoadSurface = v)],
  mapgenRound2: [() => mapgenRound2],
  // @ts-expect-error -- replaced on purpose
  mapgenScene: [() => mapgenScene, v => (mapgenScene = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenSceneCorner: [() => mapgenSceneCorner, v => (mapgenSceneCorner = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenSceneGround: [() => mapgenSceneGround, v => (mapgenSceneGround = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenSeamAgreement: [() => mapgenSeamAgreement, v => (mapgenSeamAgreement = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenShareMask: [() => mapgenShareMask, v => (mapgenShareMask = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenSimplify: [() => mapgenSimplify, v => (mapgenSimplify = v)],
  mapgenSmooth: [() => mapgenSmooth],
  // @ts-expect-error -- replaced on purpose
  mapgenSpur: [() => mapgenSpur, v => (mapgenSpur = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageEdgeGround: [() => mapgenStageEdgeGround, v => (mapgenStageEdgeGround = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageExits: [() => mapgenStageExits, v => (mapgenStageExits = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageFeature: [() => mapgenStageFeature, v => (mapgenStageFeature = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageGrade: [() => mapgenStageGrade, v => (mapgenStageGrade = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageGround: [() => mapgenStageGround, v => (mapgenStageGround = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageHeights: [() => mapgenStageHeights, v => (mapgenStageHeights = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageLand: [() => mapgenStageLand, v => (mapgenStageLand = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageLots: [() => mapgenStageLots, v => (mapgenStageLots = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStagePlants: [() => mapgenStagePlants, v => (mapgenStagePlants = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageProps: [() => mapgenStageProps, v => (mapgenStageProps = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageRoad: [() => mapgenStageRoad, v => (mapgenStageRoad = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageWater: [() => mapgenStageWater, v => (mapgenStageWater = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenSteepStretch: [() => mapgenSteepStretch, v => (mapgenSteepStretch = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStepGridOf: [() => mapgenStepGridOf, v => (mapgenStepGridOf = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStreamLine: [() => mapgenStreamLine, v => (mapgenStreamLine = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenSwitchback: [() => mapgenSwitchback, v => (mapgenSwitchback = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenTerraceCount: [() => mapgenTerraceCount, v => (mapgenTerraceCount = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenTerraceField: [() => mapgenTerraceField, v => (mapgenTerraceField = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenTerraces: [() => mapgenTerraces, v => (mapgenTerraces = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenUnreachable: [() => mapgenUnreachable, v => (mapgenUnreachable = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenWalkGrid: [() => mapgenWalkGrid, v => (mapgenWalkGrid = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenWalkHeight: [() => mapgenWalkHeight, v => (mapgenWalkHeight = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const MAPGEN_VERSION = 2; /* MG-2: terraces at ground level by exits */
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
  props: { lamps: 0, benches: 0.3, signs: 1, bins: 0, folk: 0.3, mast: 0, clinic: 0, shop: 0 },
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
  /* MG-2: the edges joined to a neighbour (mapgenEdgeStrip), copied (mapgenMergeDefaults keeps unknown keys by
     reference); each one's exit is the nearest on its side within 44 m, moved onto it, or a new one */
  const edges = (Array.isArray(P.edges) ? P.edges : [])
    .filter(s => s && MAPGEN_OPPOSITE[s.side] && Array.isArray(s.heights) && s.t > 0 && s.t < 1)
    .map(s => JSON.parse(JSON.stringify(s)));
  delete P.edges;
  if (edges.length) P.edges = edges;
  for (const s of edges) {
    const L = s.side === 'N' || s.side === 'S' ? P.w : P.h;
    let best = /** @type {any} */ (null);
    for (const e of R.exits)
      if (
        e.side === s.side &&
        !e.joined &&
        Math.abs(e.t - s.t) * L < 44 &&
        (!best || Math.abs(e.t - s.t) < Math.abs(best.t - s.t))
      )
        best = e;
    if (!best && R.exits.length < 4) R.exits.push((best = { side: s.side, t: s.t, width: s.width }));
    if (best) Object.assign(best, { t: s.t, width: s.width, joined: 1 });
  }
  for (const e of R.exits) delete e.joined;
  return P;
}

/* ---------- MG-2: an edge joined to a neighbour ---------- */
export const MAPGEN_OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };
/**
 * what a neighbour shows where a new scene joins its exit, in the new scene's metres: the strip of its edge the new
 * scene must agree with (MAPGEN_BAND either side of the exit and 4 m more to fade out, clipped to the edge both
 * share). The new scene's exit goes on the opposite side, `t` along it (kept as near as it can be to the t asked
 * for) so the two exits are a whole number of metres apart, as wide as the neighbour's. size: the new scene's
 * {w, h}. The strip is plain data, so params.edges keeps the generator a function of its dials alone.
 * { side, t, width, from: {exit}, at (the exit, metres along the side), lo, hi, u0 (the first corner),
 *   heights (the neighbour's edge corners from u0, a metre apart), c0 (the first cell), ground (the neighbour's
 *   cells along its edge from c0), raise (its step raise along the edge, a half metre apart from c0, or null),
 *   props ([k, x, z, s] near the edge, outside the new scene) } or null
 * @param {any} nb @param {string} exitId @param {{ w: number, h: number }} size @param {number} [t]
 */
export function mapgenEdgeStrip(nb, exitId, size, t) {
  const xn = mapgenExitOf(nb, exitId);
  if (!xn) return null;
  const ns = xn.e.side,
    side = MAPGEN_OPPOSITE[ns],
    v = ns === 'E' || ns === 'W',
    L = v ? size.h : size.w,
    Lnb = v ? nb.h : nb.w,
    an = v ? xn.p[1] : xn.p[0],
    want = (t == null ? xn.e.t : t) * L;
  /* the offset of the new scene along the edge, a whole number of metres: its exit at an - o */
  let o = Math.round(an - want);
  while (an - o > 0.92 * L && o < an) o++;
  while (an - o < 0.08 * L && o > an - L) o--;
  const at = mapgenRound2(an - o),
    lo = Math.max(0, -o, at - MAPGEN_BAND - 4),
    hi = Math.min(L, Lnb - o, at + MAPGEN_BAND + 4);
  if (hi <= lo) return null;
  /* the neighbour's edge, by u in the new scene's metres along it */
  const corner = u =>
    v ? mapgenSceneCorner(nb, ns === 'E' ? nb.w : 0, u + o) : mapgenSceneCorner(nb, u + o, ns === 'N' ? nb.h : 0);
  const cellAt = (x, z) =>
    (nb.tiles[nb.h - 1 - mapgenBetween(Math.floor(z), 0, nb.h - 1)] || '')[mapgenBetween(Math.floor(x), 0, nb.w - 1)] ||
    nb.edge ||
    'g';
  const cell = c =>
    v ? cellAt(ns === 'E' ? nb.w - 0.5 : 0.5, c + o + 0.5) : cellAt(c + o + 0.5, ns === 'N' ? nb.h - 0.5 : 0.5);
  const u0 = Math.ceil(lo),
    c0 = Math.floor(lo),
    heights = [],
    ground = [];
  for (let u = u0; u <= hi; u++) heights.push(mapgenRound2(corner(u)));
  for (let c = c0; c < hi; c++) ground.push(cell(c));
  let raise = /** @type {number[] | null} */ (null);
  if (nb.steps) {
    const u8 = mapgenDecodeBase64(nb.steps),
      S = new Int16Array(u8.buffer, 0, u8.length >> 1),
      W2 = nb.w * 2;
    if (S.length === nb.w * nb.h * 4) {
      const R = [];
      for (let u = c0 + 0.25; u < hi; u += 0.5) {
        const x = v ? (ns === 'E' ? nb.w - 0.25 : 0.25) : u + o,
          z = v ? u + o : ns === 'N' ? nb.h - 0.25 : 0.25;
        R.push(
          S[mapgenBetween(Math.floor(z * 2), 0, nb.h * 2 - 1) * W2 + mapgenBetween(Math.floor(x * 2), 0, W2 - 1)] / 20
        );
      }
      if (R.some(r => r)) raise = R;
    }
  }
  /* the neighbour's things within 3 m of the edge, where they stand from the new scene */
  const props = [];
  for (const p of nb.props || []) {
    const d = ns === 'N' ? nb.h - p.z : ns === 'S' ? p.z : ns === 'E' ? nb.w - p.x : p.x,
      u = (v ? p.z : p.x) - o;
    if (d > 3 || u < lo - 3 || u > hi + 3) continue;
    const x = side === 'S' ? p.x - o : side === 'N' ? p.x - o : side === 'W' ? p.x - nb.w : size.w + p.x,
      z = side === 'S' ? p.z - nb.h : side === 'N' ? size.h + p.z : p.z - o;
    props.push([p.k, mapgenRound2(x), mapgenRound2(z), p.s || 1]);
  }
  return {
    side,
    t: at / L,
    width: xn.e.width || 2,
    from: { exit: exitId },
    at,
    lo: mapgenRound2(lo),
    hi: mapgenRound2(hi),
    u0,
    heights,
    c0,
    ground: ground.join(''),
    raise,
    props,
  };
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
    /* TR-1: the step flags per half-metre cell, as scene.stepm (32: a ramp, leaning between its neighbours) */
    M: new Uint8Array(4 * w * h),
    /* per cell: 1 road, 2 verge, 4 water, 8 bridge, 16 clear (no trees), 32 tall grass, 64 bank, 128 jetty */
    F: new Uint8Array(w * h),
    /* a branch's join: the main road's sample where it ends */
    road: /** @type {{ pts: number[][], base?: number, width: number, main: boolean, join?: number }[]} */ ([]),
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
    notes: /** @type {string[]} */ ([]),
    stepsUsed: false,
    /* TR-1: every road's grade (mapgenRoadGrades), once mapgenStageGrade has laid them */
    grades: /** @type {any} */ (null),
    /* MG-2: the buildings' lots, [x0, z0, x1, z1] (mapgenStageLots) */
    lots: /** @type {number[][]} */ ([]),
    /* MG-2: the edges joined to a neighbour that got their exit (mapgenParams) */
    joined: (P.edges || []).filter(s => P.road.exits.some(e => e.side === s.side && e.t === s.t)),
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

/* ---------- MG-2: two scenes as one, for the Studio's "Preview the pair" ---------- */
/**
 * two scenes joined at A's exit idA and B's exit idB, laid into one scene as the game lays them side by side
 * (seamlessJoin's offset) with nothing eased and no countryside, so the Studio's preview shows how they really meet.
 * B is the scene shown (its look, hub, animals and townsfolk spots); the rest of the box is B's edge ground, walled
 * off (sc.inside: where you may walk). Exits are points only (sc.exits and sc.exitNames), the two that meet left
 * out. null when an exit is missing.
 */
export function mapgenPairScene(A, idA, B, idB) {
  const xa = mapgenExitOf(A, idA),
    xb = mapgenExitOf(B, idB);
  if (!xa || !xb) return null;
  const off = mapgenJoinOffset(A, xa, B, xb),
    x0 = Math.min(0, off[0]),
    z0 = Math.min(0, off[1]),
    w = Math.max(A.w, off[0] + B.w) - x0,
    h = Math.max(A.h, off[1] + B.h) - z0,
    parts = [
      { S: B, o: [off[0] - x0, off[1] - z0], skip: idB },
      { S: A, o: [-x0, -z0], skip: idA },
    ];
  const cellOf = (i, j) => parts.find(P => i >= P.o[0] && j >= P.o[1] && i < P.o[0] + P.S.w && j < P.o[1] + P.S.h);
  const tiles = [];
  for (let j = h - 1; j >= 0; j--) {
    let row = '';
    for (let i = 0; i < w; i++) {
      const P = cellOf(i, j);
      row += P ? (P.S.tiles[P.S.h - 1 - (j - P.o[1])] || '')[i - P.o[0]] || P.S.edge || 'g' : B.edge || 'g';
    }
    tiles.push(row);
  }
  /* corners: a part's own (the joined edge agrees, B's taken); outside both, the nearest part's nearest corner */
  const heights = [];
  for (let j = h; j >= 0; j--) {
    const row = [];
    for (let i = 0; i <= w; i++) {
      let best = /** @type {any[]} */ ([]),
        bd = 1e9;
      for (const P of parts) {
        const cx = mapgenBetween(i, P.o[0], P.o[0] + P.S.w),
          cz = mapgenBetween(j, P.o[1], P.o[1] + P.S.h),
          d = Math.hypot(cx - i, cz - j);
        if (d < bd) ((bd = d), (best = [P, cx, cz]));
      }
      const [P, cx, cz] = best;
      row.push(mapgenSceneCorner(P.S, cx - P.o[0], cz - P.o[1]));
    }
    heights.push(row);
  }
  /** @type {any} */
  const sc = {};
  for (const [k, v] of Object.entries(B))
    if (
      ![
        'tiles',
        'heights',
        'steps',
        'stepm',
        'props',
        'exits',
        'edgeExits',
        'hub',
        'streams',
        'bridges',
        'waters',
        'npcSpots',
        'gen',
        'stepsV',
      ].includes(k)
    )
      sc[k] = v;
  Object.assign(sc, {
    name: `${B.name || 'draft'} + ${A.name || 'neighbour'}`,
    w,
    h,
    edge: B.edge || 'g',
    tiles,
    heights,
  });
  if (A.steps || B.steps) {
    const W2 = w * 2,
      S = new Int16Array(W2 * h * 2),
      M = new Uint8Array(W2 * h * 2);
    for (const P of parts) {
      if (!P.S.steps) continue;
      const u = mapgenDecodeBase64(P.S.steps),
        R = new Int16Array(u.buffer, 0, u.length >> 1),
        F = P.S.stepm ? mapgenDecodeBase64(P.S.stepm) : null,
        w2 = P.S.w * 2;
      for (let j = 0; j < P.S.h * 2; j++)
        for (let i = 0; i < w2; i++) {
          const q = (j + P.o[1] * 2) * W2 + i + P.o[0] * 2;
          S[q] = R[j * w2 + i] || 0;
          M[q] = F ? F[j * w2 + i] || 0 : 0;
        }
    }
    sc.steps = mapgenEncodeBase64(new Uint8Array(S.buffer));
    sc.stepm = mapgenEncodeBase64(M);
  }
  const tr = (P, x, z) => [mapgenRound2(x + P.o[0]), mapgenRound2(z + P.o[1])];
  sc.props = [];
  sc.exits = [];
  sc.exitNames = [];
  for (const P of parts) {
    const S = P.S;
    for (const q of S.props || []) {
      const [x, z] = tr(P, q.x, q.z);
      sc.props.push({ ...q, x, z });
    }
    for (const k of ['streams'])
      if (S[k]) sc[k] = (sc[k] || []).concat(S[k].map(o => ({ ...o, pts: o.pts.map(p => tr(P, p[0], p[1])) })));
    if (S.bridges)
      sc.bridges = (sc.bridges || []).concat(S.bridges.map(o => ({ ...o, a: tr(P, ...o.a), b: tr(P, ...o.b) })));
    if (S.waters) sc.waters = (sc.waters || []).concat(S.waters.map(o => ({ ...o, x: o.x + P.o[0], z: o.z + P.o[1] })));
    (S.edgeExits || []).forEach((e, k) => {
      if (e.id === P.skip) return;
      const p = (S.exits || [])[k] || mapgenExitPoint(S.w, S.h, e);
      sc.exits.push(tr(P, p[0], p[1]));
      sc.exitNames.push(`${P.S === B ? '' : (A.name || 'neighbour') + ' '}${e.id}`);
    });
  }
  sc.props.sort((a, b) => b.z - a.z || a.x - b.x);
  sc.hub = tr(parts[0], ...(B.hub || [B.w / 2, B.h / 2]));
  sc.npcSpots = (B.npcSpots || []).map(p => tr(parts[0], p[0], p[1]));
  sc.inside = parts.map(P => [P.o[0], P.o[1], P.o[0] + P.S.w, P.o[1] + P.S.h]);
  sc.pair = { a: idA, b: idB, off, of: [parts[1].o, parts[0].o] };
  return sc;
}

/* ---------- MG-2: the land meets the neighbour along a joined edge ---------- */
/** the depth of point (x, z) from a side of the map, and how far along that side it is */
export const mapgenDepth = (G, side, x, z) => (side === 'S' ? z : side === 'N' ? G.h - z : side === 'W' ? x : G.w - x);
export const mapgenAlong = (side, x, z) => (side === 'N' || side === 'S' ? x : z);
/** a side's corner heights corrected toward each joined strip: corr[u] for every corner u along the side. Full
 * correction where a strip is, a 4 m fade past its ends, and where two strips share a side (a node with two
 * parents) each holds to the midpoint between their exits less 2 m, blended across the 4 m between (as
 * seamless-world.js seamlessSeamOf shares a side) */
export function mapgenEdgeCorrection(G, side, strips) {
  const L = side === 'N' || side === 'S' ? G.w : G.h,
    edge = u =>
      mapgenCornerHeight(
        G,
        ...(side === 'N' || side === 'S' ? [u, side === 'N' ? G.h : 0] : [side === 'E' ? G.w : 0, u])
      ),
    list = strips.slice().sort((a, b) => a.at - b.at),
    corr = new Float32Array(L + 1),
    weight = new Float32Array(L + 1);
  list.forEach((s, k) => {
    const n = s.heights.length,
      a = Math.max(s.u0, k ? Math.ceil((list[k - 1].at + s.at) / 2 + 2) : -1e9),
      b = Math.min(s.u0 + n - 1, k < list.length - 1 ? Math.floor((s.at + list[k + 1].at) / 2 - 2) : 1e9);
    if (b < a) return;
    const diff = u => s.heights[mapgenBetween(u, a, b) - s.u0] - edge(mapgenBetween(u, a, b));
    for (let u = Math.max(0, a - 4); u <= Math.min(L, b + 4); u++) {
      const f = u < a ? mapgenSmooth(1 - (a - u) / 4) : u > b ? mapgenSmooth(1 - (u - b) / 4) : 1;
      if (f <= 0) continue;
      corr[u] += diff(u) * f;
      weight[u] += f;
    }
  });
  for (let u = 0; u <= L; u++) if (weight[u] > 1) corr[u] /= weight[u];
  return corr;
}
/** the land pinned to the joined strips: each corner moves by its side's correction, less and less further in
 * (gone at `fade` metres). Run on the raw land (fade 16) and again once nothing else moves the land (fade 6), so the
 * joined edge ends exactly at the neighbour's heights */
export function mapgenPinEdges(G, fade) {
  const sides = {};
  for (const s of G.joined) (sides[s.side] = sides[s.side] || []).push(s);
  for (const [side, strips] of Object.entries(sides)) {
    const corr = mapgenEdgeCorrection(G, side, strips);
    for (let j = 0; j <= G.h; j++)
      for (let i = 0; i <= G.w; i++) {
        const d = mapgenDepth(G, side, i, j);
        if (d >= fade) continue;
        const c = corr[mapgenAlong(side, i, j)];
        if (c) G.H[j * (G.w + 1) + i] += c * (1 - mapgenSmooth(d / fade));
      }
  }
}
/** is (x, z) within `depth` metres of a joined edge's strip (with its 4 m fade) */
export function mapgenNearJoined(G, x, z, depth) {
  for (const s of G.joined) {
    const u = mapgenAlong(s.side, x, z);
    if (mapgenDepth(G, s.side, x, z) < depth && u > s.u0 - 4 && u < s.u0 + s.heights.length + 3) return true;
  }
  return false;
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
/** the roads' centre lines (the main road, then a branch for each exit after the second), the hub's first guess and
 * the distance field. specs: for each road, its switchbacks (mapgenSwitchback) or nothing; each road keeps its
 * length before them (R.base) */
export function mapgenLayRoads(G, specs) {
  const { P, w, h } = G,
    rnd = G.rng('road'),
    ns = G.salt('road'),
    E = G.exits;
  G.road = [];
  G.roadPts = [];
  G.dist.fill(1e9);
  G.near.fill(-1);
  const bent = (k, pts) => {
    const base = mapgenPolyLength(pts);
    return { pts: (specs[k] && specs[k].need && mapgenSwitchback(G, pts, specs[k])) || pts, base };
  };
  if (E.length === 1) {
    /* a dead end: the road runs from the exit to a hub inside */
    const e = E[0],
      nA = MAPGEN_INWARD[e.side],
      deep = (e.side === 'N' || e.side === 'S' ? h : w) * 0.55;
    const end = [mapgenBetween(e.pt[0] + nA[0] * deep, 8, w - 8), mapgenBetween(e.pt[1] + nA[1] * deep, 8, h - 8)];
    G.road.push({
      ...bent(0, mapgenRoadCurve(G, e, { pt: end }, P.road.shape, rnd, ns)),
      width: P.road.width,
      main: true,
    });
  } else {
    G.road.push({
      ...bent(0, mapgenRoadCurve(G, E[0], E[1], P.road.shape, rnd, ns)),
      width: P.road.width,
      main: true,
    });
  }
  /* the hub, a first guess (chooseHub settles it once the water is in): half way along the main road, or at its end */
  const M = G.road[0].pts;
  let hk = E.length === 1 ? M.length - 1 : Math.floor(M.length / 2);
  /* TR-1: with switchbacks, where the middle was before the road bent */
  const sp0 = specs[0];
  if (E.length > 1 && sp0 && sp0.need && M.length - 1 !== Math.round(G.road[0].base * 2)) {
    const half = Math.floor(Math.round(G.road[0].base * 2) / 2) / 2,
      grow = mapgenPolyLength(M) - G.road[0].base,
      want = half <= sp0.s0 ? half : half + grow;
    hk = mapgenBetween(Math.round(want * 2), 0, M.length - 1);
  }
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
    /* TR-1: or where it can climb to the main road (mapgenSteepStretch) */
    const sp = specs[x - 1];
    if (sp && sp.join != null) best = mapgenBetween(sp.join, 0, M.length - 1);
    const b = bent(x - 1, mapgenRoadCurve(G, e, { pt: M[best] }, 'straight', rnd, ns + x));
    G.road.push({ ...b, width: Math.max(1.6, P.road.width * 0.85), main: false, join: best });
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
}
/** TR-1: the stretch of road most in need of switchbacks: where its grade can't keep near the cap (18%) between the
 * points it must meet (an exit, the hub, a junction), or where keeping to it leaves the road more than 2 m above or
 * below the land (less is a bank's work). {r, s0, s1, need} (a road, the stretch's ends along it in metres from its start, the length it would
 * need) or null. Not within an exit's straight run, the hub's level stretch or a junction's last 4 m */
export function mapgenSteepStretch(G, gr) {
  const cap = MAPGEN_ROAD_CAP * 2;
  let best = /** @type {any} */ (null);
  G.road.forEach((R, r) => {
    const f0 = gr.first[r],
      m = R.pts.length,
      sAt = i => G.roadPts[f0 + i].s - G.roadPts[f0].s,
      L = sAt(m - 1),
      lo = 2 * MAPGEN_STRAIGHT_IN,
      hubS = r === 0 ? sAt(mapgenBetween(G.hubK ?? 0, 0, m - 1)) : -1e9,
      open = i => {
        const s = sAt(i);
        if (s < lo || (L - s < lo && !(r > 0))) return false;
        if (r > 0 && L - s < 4) return false;
        return Math.abs(s - hubS) > 6;
      };
    /* worst: a climb it can't keep to (scored 1 and up), else the deepest cut or fill over 2 m */
    let bad = 0,
      at = -1,
      stuck = false;
    for (let i = 1; i < m; i++) {
      const dev = Math.min(0.99, Math.abs(gr.E[f0 + i] - gr.target[f0 + i]) - 2),
        jump = Math.abs(gr.E[f0 + i] - gr.E[f0 + i - 1]) - MAPGEN_ROAD_CAP * 1.3,
        v = jump > 0 ? 1 + jump : dev;
      if (v > bad) {
        bad = v;
        at = i;
        stuck = jump > 0;
      }
    }
    if (at < 0) return;
    /* the stretch: where the road can't keep to its points (out to the nearest ones it must meet), or where it
       leaves the land by more than half a metre round the worst point; within what may bend */
    const devAt = i => Math.abs(gr.E[f0 + i] - gr.target[f0 + i]);
    let a = at,
      b = at;
    if (stuck) {
      while (a > 0 && !gr.fixed[f0 + a - 1]) a--;
      while (b < m - 1 && !gr.fixed[f0 + b + 1]) b++;
    } else {
      while (a > 0 && !gr.fixed[f0 + a - 1] && devAt(a - 1) > 0.5) a--;
      while (b < m - 1 && !gr.fixed[f0 + b + 1] && devAt(b + 1) > 0.5) b++;
      a = Math.max(0, a - 6);
      b = Math.min(m - 1, b + 6);
    }
    const a0 = a,
      b0 = b;
    while (a < b && !open(a)) a++;
    while (b > a && !open(b)) b--;
    if (b - a < 16) {
      /* a branch too short to bend joins the main road where it can climb to it, at a little under the cap */
      if (r > 0 && stuck) {
        const f1 = gr.first[0],
          ex = R.pts[0],
          e0 = gr.E[f0],
          M = G.road[0].pts,
          hubS = G.roadPts[f1 + mapgenBetween(G.hubK ?? 0, 0, M.length - 1)].s;
        let k = -1,
          kd = 1e9;
        for (let i = 2 * MAPGEN_STRAIGHT_IN; i < M.length - 2 * MAPGEN_STRAIGHT_IN; i++) {
          const d = Math.hypot(M[i][0] - ex[0], M[i][1] - ex[1]);
          if (Math.abs(G.roadPts[f1 + i].s - hubS) < 6 || d >= kd) continue;
          if (Math.abs(gr.E[f1 + i] - e0) <= cap * 0.85 * (d - 2)) {
            k = i;
            kd = d;
          }
        }
        if (k >= 0 && (!best || bad > best.bad)) best = { r, join: k, bad };
      }
      return;
    }
    /* the length it needs: all the climbing and dropping the land asks for there, at a little under the cap */
    let tv = 0;
    for (let i = a + 1; i <= b; i++) tv += Math.abs(gr.target[f0 + i] - gr.target[f0 + i - 1]);
    if (stuck) {
      /* the whole climb between the points it must meet, less what the stretches that may not bend can take */
      const fa = gr.fixed[f0 + a0 - 1] ? gr.E[f0 + a0 - 1] : gr.target[f0 + a0],
        fb = gr.fixed[f0 + b0 + 1] ? gr.E[f0 + b0 + 1] : gr.target[f0 + b0],
        stiff = sAt(b0) - sAt(a0) - (sAt(b) - sAt(a));
      tv = Math.max(tv, Math.abs(fb - fa) - stiff * cap * 0.85);
    }
    const need = tv / (cap * 0.85),
      len = sAt(b) - sAt(a);
    if (need <= len * 1.05) return;
    if (!best || bad > best.bad) best = { r, s0: sAt(a), s1: sAt(b), need, bad };
  });
  return (
    best &&
    (best.join != null
      ? { r: best.r, join: best.join, bad: best.bad }
      : { r: best.r, s0: best.s0, s1: best.s1, need: best.need, bad: best.bad })
  );
}
/** TR-1: switchbacks: the road between s0 and s1 (metres from its start) winds across its line to be about `need`
 * metres long (room allowing); the turns are smoothed. The new centre line, or null with no room */
export function mapgenSwitchback(G, pts, sp) {
  const n = pts.length,
    s = [0];
  for (let i = 1; i < n; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const a = s.findIndex(v => v >= sp.s0),
    b = s.findIndex(v => v >= sp.s1);
  if (a < 4 || b < 0 || b > n - 5 || b - a < 16) return null;
  const Lb = s[b] - s[a],
    nrm = pts.map((_, i) => {
      const p = pts[Math.min(n - 1, i + 4)],
        q = pts[Math.max(0, i - 4)],
        l = Math.hypot(p[0] - q[0], p[1] - q[1]) || 1;
      return [-(p[1] - q[1]) / l, (p[0] - q[0]) / l];
    });
  /* the room either side, 6 m from the map's edges */
  let room = 12;
  for (let i = a; i <= b; i++)
    for (const sg of [1, -1]) {
      const [nx, nz] = nrm[i];
      let r = 12;
      if (nx * sg > 0) r = Math.min(r, (G.w - 6 - pts[i][0]) / (nx * sg));
      if (nx * sg < 0) r = Math.min(r, (6 - pts[i][0]) / (nx * sg));
      if (nz * sg > 0) r = Math.min(r, (G.h - 6 - pts[i][1]) / (nz * sg));
      if (nz * sg < 0) r = Math.min(r, (6 - pts[i][1]) / (nz * sg));
      room = Math.min(room, r);
    }
  if (room < 2.5) return null;
  /* a serpentine: k half waves across the line, legs at least 6.5 m apart (so the rule that keeps stretches near
     each other at one height leaves them apart and the land between them is a bank), as wide as the length asks */
  const k = Math.max(1, Math.floor(Lb / 6.5)),
    lenOf = A => {
      let L = 0;
      for (let t = 0; t < 64; t++) {
        const c = Math.cos((Math.PI * k * (t + 0.5)) / 64);
        L += Math.hypot(Lb / 64, ((A * Math.PI * k) / Lb) * c * (Lb / 64));
      }
      return L;
    };
  let lo = 0,
    hi = room;
  if (lenOf(hi) <= sp.need) lo = hi;
  else
    for (let it = 0; it < 30; it++) {
      const mid = (lo + hi) / 2;
      if (lenOf(mid) < sp.need) lo = mid;
      else hi = mid;
    }
  const A = lo;
  if (A < 1.5) return null;
  const out = pts.map(p => p.slice());
  for (let i = a; i <= b; i++) {
    const off = A * Math.sin((Math.PI * k * (s[i] - s[a])) / Lb);
    out[i] = [
      mapgenBetween(pts[i][0] + nrm[i][0] * off, 4, G.w - 4),
      mapgenBetween(pts[i][1] + nrm[i][1] * off, 4, G.h - 4),
    ];
  }
  let q = mapgenResample(out, 0.5);
  /* smooth the turns, inside the stretch only */
  const qs = [0];
  for (let i = 1; i < q.length; i++) qs.push(qs[i - 1] + Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]));
  const qa = qs.findIndex(v => v >= sp.s0),
    qb = qs.findIndex(v => v >= sp.s0 + (qs[qs.length - 1] - s[n - 1]) + Lb);
  for (let pass = 0; pass < 6; pass++) {
    const nx = q.map(p => p.slice());
    for (let i = Math.max(2, qa); i < Math.min(q.length - 2, qb < 0 ? q.length - 2 : qb); i++)
      nx[i] = [
        (q[i - 2][0] + q[i - 1][0] * 2 + q[i][0] * 2 + q[i + 1][0] * 2 + q[i + 2][0]) / 8,
        (q[i - 2][1] + q[i - 1][1] * 2 + q[i][1] * 2 + q[i + 1][1] * 2 + q[i + 2][1]) / 8,
      ];
    q = nx;
  }
  return mapgenResample(q, 0.5);
}
export function mapgenStageRoad(G) {
  const { P, w, h } = G;
  G.exits = P.road.exits.map(e => ({ ...e, pt: mapgenExitPoint(w, h, e) }));
  const half = P.road.width / 2;
  /* TR-1: a road that can't keep to the cap gets switchbacks where it climbs: one stretch a road, measured before it
     bends, made longer (and wider, to take in a new steep stretch) each time it still can't, four times at most */
  let specs = [],
    best = { specs, bad: 1e9 };
  for (let tries = 0; ; tries++) {
    mapgenLayRoads(G, specs);
    const sp = mapgenSteepStretch(G, mapgenRoadGrades(G));
    /* the try that left the road least steep is the one kept */
    const bad = sp ? sp.bad : 0;
    if (bad < best.bad) best = { specs: specs.map(x => x && { ...x }), bad };
    if (!sp || tries >= 5) {
      if (best.specs !== specs && bad > best.bad) mapgenLayRoads(G, (specs = best.specs));
      break;
    }
    const cur = specs[sp.r];
    if (sp.join != null) specs[sp.r] = { join: sp.join };
    else if (!cur || !cur.need) specs[sp.r] = { ...cur, s0: sp.s0, s1: sp.s1, need: sp.need };
    else {
      /* back to where the stretch lies before the bends: the bent span is longer by what the road grew */
      const Lb = cur.s1 - cur.s0,
        grow = mapgenPolyLength(G.road[sp.r].pts) - (G.road[sp.r].base ?? 0),
        back = u => (u <= cur.s0 ? u : u <= cur.s0 + Lb + grow ? cur.s0 + ((u - cur.s0) * Lb) / (Lb + grow) : u - grow),
        s0 = Math.min(cur.s0, back(sp.s0)),
        s1 = Math.max(cur.s1, back(sp.s1));
      specs[sp.r] = { ...cur, s0, s1, need: Math.max(cur.need * 1.3, s1 - s0 + sp.need - (sp.s1 - sp.s0)) };
    }
  }
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
  /* the land under the roads is laid once the hub is chosen (mapgenStageGrade) */
  void half;
}
export function mapgenCornerHeight(G, x, z) {
  const i = mapgenBetween(Math.round(x), 0, G.w),
    j = mapgenBetween(Math.round(z), 0, G.h);
  return G.H[j * (G.w + 1) + i];
}
/** the land's height along a road (one value a sample): its corners smoothed over 7 m either way, changing by no
 * more than lim a half metre */
export function mapgenLandProfile(G, pts, lim) {
  const n = pts.length,
    raw = pts.map(p => mapgenCornerHeight(G, p[0], p[1])),
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
  for (let i = 1; i < n; i++) sm[i] = mapgenBetween(sm[i], sm[i - 1] - lim, sm[i - 1] + lim);
  for (let i = n - 2; i >= 0; i--) sm[i] = mapgenBetween(sm[i], sm[i + 1] - lim, sm[i + 1] + lim);
  return sm;
}
/* TR-1: the steepest a road climbs, land and terrace raise together, a half metre at a time (15%) */
export const MAPGEN_ROAD_CAP = 0.07;
/** TR-1: the height of every road, both layers at once: the raise each road sample takes (mapgenRoadProfiles, when
 * there are terraces) and the walked height E (land plus raise), which follows the land smoothed along the road but
 * climbs no more than MAPGEN_ROAD_CAP a half metre, starts at the land by each exit, lies level through the hub and
 * meets the main road where a branch joins it; stretches that pass near each other differ by no more than the cap
 * over the gap (mapgenProfilesMeet). {E, sProf, sDiscs, target, fixed, first} (target: what E would be with no cap) */
export function mapgenRoadGrades(G) {
  const lim = MAPGEN_ROAD_CAP,
    n = G.roadPts.length,
    lv = mapgenTerraceCount(G.P);
  let sProf = new Float32Array(n),
    sDiscs = /** @type {{ x: number, z: number, r: number, v: number }[] | null} */ (null);
  if (lv > 0) {
    const { rise, lvl, zoneDist } = mapgenTerraceField(G, lv),
      r = mapgenRoadProfiles(
        G,
        p => lvl(p[0], p[1]) * rise,
        rise,
        (x, z) => zoneDist(x, z) <= 8
      );
    sProf = r.prof;
    sDiscs = r.discs;
  }
  const E = new Float64Array(n),
    target = new Float64Array(n),
    fixed = new Uint8Array(n),
    first = [];
  let o = 0;
  for (const R of G.road) {
    first.push(o);
    o += R.pts.length;
  }
  const ends = new Set(G.exits.map(e => `${e.pt[0]},${e.pt[1]}`));
  G.road.forEach((R, r) => {
    const m = R.pts.length,
      f0 = first[r],
      land = mapgenLandProfile(G, R.pts, 1e9),
      e = E.subarray(f0, f0 + m),
      fx = fixed.subarray(f0, f0 + m);
    for (let i = 0; i < m; i++) e[i] = target[f0 + i] = land[i] + sProf[f0 + i];
    /* by an exit the road starts at the land there (pinned to a joined neighbour), with no raise */
    for (const i of [0, m - 1])
      if (ends.has(`${R.pts[i][0]},${R.pts[i][1]}`)) {
        e[i] = mapgenCornerHeight(G, R.pts[i][0], R.pts[i][1]);
        fx[i] = 1;
      }
    if (r === 0) {
      /* level through the hub (4 m either way), as high as the cone from the exits allows */
      const hk = mapgenBetween(G.hubK ?? 0, 0, m - 1),
        S = G.roadPts[f0 + hk].s,
        lvl = [];
      for (let i = 0; i < m; i++) if (Math.abs(G.roadPts[f0 + i].s - S) <= 4) lvl.push(i);
      let hv = lvl.reduce((a, i) => a + e[i], 0) / (lvl.length || 1);
      for (let i = 0; i < m; i++)
        if (fx[i])
          for (const k of lvl) hv = mapgenBetween(hv, e[i] - lim * Math.abs(k - i), e[i] + lim * Math.abs(k - i));
      for (const i of lvl) {
        e[i] = hv;
        fx[i] = 1;
      }
    } else if (R.join != null) {
      e[m - 1] = E[first[0] + R.join];
      fx[m - 1] = 1;
    }
    mapgenRampLimit(e, fx, lim);
  });
  const discs = [[G.hub[0], G.hub[1], 3.5], ...G.exits.map(e => [e.pt[0], e.pt[1], 3])].map(([x, z, r], d) => {
    const k =
      d === 0 ? first[0] + mapgenBetween(G.hubK ?? 0, 0, G.road[0].pts.length - 1) : G.near[mapgenCellAt(G, x, z)];
    return { x, z, r, v: k >= 0 ? E[k] : 0 };
  });
  /* across a gap, half the cap: the land between two stretches blends them, so a walk along one that turns into
     the other adds the two slopes */
  mapgenProfilesMeet(G, E, fixed, first, discs, lim, lim);
  return { E, sProf, sDiscs, target, fixed, first };
}
/** TR-1: the land under and beside the roads, laid from their grades. Each road sample's land height is its walked
 * height less its raise; the corners under a centre line take that, the rest of the road and its sides are smooth
 * between them (so where two roads come near each other, at a junction or across a bend, the land between them is a
 * slope, never the height of whichever road is nearest), and the sides blend out to the land over 5 m. The hub's
 * round lies level. Corners at water stay under the road (a bridge spans them) */
export function mapgenStageGrade(G) {
  const { w, h } = G,
    W1 = w + 1,
    gr = mapgenRoadGrades(G),
    n = G.roadPts.length,
    hp = Float64Array.from(gr.E, (v, k) => v - gr.sProf[k]);
  G.grades = gr;
  const inner = 1.2,
    blend = 5,
    N = W1 * (h + 1),
    tw = new Float32Array(N).fill(-1),
    v = new Float64Array(N),
    bucket = new Map(),
    key = (x, z) => `${Math.floor(x / 2)},${Math.floor(z / 2)}`;
  G.roadPts.forEach((p, k) => {
    const b = key(p.x, p.z);
    if (!bucket.has(b)) bucket.set(b, []);
    bucket.get(b).push(k);
  });
  for (let j = 0; j <= h; j++)
    for (let i = 0; i <= w; i++) {
      const k0 = G.near[mapgenBetween(j, 0, h - 1) * w + mapgenBetween(i, 0, w - 1)];
      if (k0 < 0) continue;
      const p0 = G.roadPts[k0],
        d0 = Math.hypot(i - p0.x, j - p0.z),
        d = d0 - p0.r;
      if (d > inner + blend) continue;
      const c = j * W1 + i;
      tw[c] = d <= inner ? 1 : 1 - mapgenSmooth((d - inner) / blend);
      /* the road samples round the corner, weighted by how much further they are than the nearest: on a straight
         road that is the height where the corner lies along it, and where two stretches come near each other it
         blends from one to the other */
      const sg = 0.7 + 0.25 * d0,
        reach = d0 + 3 * sg,
        bi = Math.floor(i / 2),
        bj = Math.floor(j / 2),
        nb = Math.ceil(reach / 2);
      let sw = 0,
        sv = 0;
      for (let y = bj - nb; y <= bj + nb; y++)
        for (let x = bi - nb; x <= bi + nb; x++)
          for (const k of bucket.get(`${x},${y}`) || []) {
            const P = G.roadPts[k],
              e = (Math.hypot(i - P.x, j - P.z) - d0) / sg;
            if (e > 3) continue;
            const wt = Math.exp(-e * e);
            sw += wt;
            sv += wt * hp[k];
          }
      v[c] = sw ? sv / sw : hp[k0];
    }
  /* the hub's round: level at its road's height out to 2.5 m, easing back over 1.5 m */
  const [hx, hz] = G.hub,
    hk = gr.first[0] + mapgenBetween(G.hubK ?? 0, 0, G.road[0].pts.length - 1),
    hv = hp[hk];
  for (let j = Math.max(0, Math.floor(hz - 4)); j <= Math.min(h, Math.ceil(hz + 4)); j++)
    for (let i = Math.max(0, Math.floor(hx - 4)); i <= Math.min(w, Math.ceil(hx + 4)); i++) {
      const d = Math.hypot(i - hx, j - hz),
        c = j * W1 + i;
      if (d > 4) continue;
      const t = d < 2.5 ? 1 : 1 - mapgenSmooth((d - 2.5) / 1.5);
      if (tw[c] < 0) {
        tw[c] = t;
        v[c] = hv;
      } else {
        v[c] = v[c] * (1 - t) + hv * t;
        tw[c] = Math.max(tw[c], t);
      }
    }
  const wet = (i, j) => i >= 0 && j >= 0 && i < w && j < h && (G.F[j * w + i] & (4 | 8)) === 4;
  for (let c = 0; c < N; c++) {
    if (tw[c] < 0) continue;
    const i = c % W1,
      j = (c - i) / W1;
    if (wet(i, j) || wet(i - 1, j) || wet(i, j - 1) || wet(i - 1, j - 1)) {
      if (tw[c] >= 1) G.H[c] = Math.min(G.H[c], v[c] - 0.45);
      continue;
    }
    G.H[c] = G.H[c] * (1 - tw[c]) + v[c] * tw[c];
  }
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
    want = G.exits.length === 1 ? M.length - 1 : (G.hubK ?? Math.floor(M.length / 2)),
    lo = 2 * MAPGEN_STRAIGHT_IN + 6;
  const ok = (k, r, away) => {
    let dry = true;
    mapgenPaintDisc(G, M[k][0], M[k][1], r, q => {
      if (G.F[q] & (4 | 8)) dry = false;
    });
    return (
      dry &&
      G.exits.every(e => Math.hypot(M[k][0] - e.pt[0], M[k][1] - e.pt[1]) > away) &&
      !mapgenNearJoined(G, M[k][0], M[k][1], away)
    );
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
  const used = {};
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
  /* the hub: clear of trees (mapgenStageGrade lays it level) */
  const [hx, hz] = G.hub;
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
/** how many terrace levels the dials ask for (0: none) */
export function mapgenTerraceCount(P) {
  return P.feature === 'terraces' ? Math.max(2, Math.round(P.land.terraces * 3)) : Math.round(P.land.terraces * 3);
}
/** the terraces: bands across the depth that rise toward the back, each a step of rise metres; lvl(x, z) is the level
 * at a point, zoneDist(x, z) how far it is from the stretch of an exit's edge kept at ground level */
export function mapgenTerraceField(G, levels) {
  const { h, P } = G,
    rise = Math.round((0.4 + P.land.cliffs * 1.2) * 20) / 20,
    ns = G.salt('heights', 'terrace');
  /* MG-2: at ground level by every exit's edge, over the stretch a neighbour shows there (MAPGEN_BAND and 4 m), so a
     joined neighbour's land meets this one with no wall: within 8 m of that stretch no raise, then a level more
     every 6 m (never a wall of more than one rise) */
  const zones = G.exits.map(e => {
      const a = e.side === 'N' || e.side === 'S' ? e.pt[0] : e.pt[1];
      return { side: e.side, lo: a - MAPGEN_BAND - 4, hi: a + MAPGEN_BAND + 4 };
    }),
    zoneDist = (x, z) => {
      let best = 1e9;
      for (const Z of zones) {
        const u = mapgenAlong(Z.side, x, z),
          du = u < Z.lo ? Z.lo - u : u > Z.hi ? u - Z.hi : 0;
        best = Math.min(best, Math.hypot(du, mapgenDepth(G, Z.side, x, z)));
      }
      return best;
    };
  const lvl = (x, z) => {
    const t = (z - 8) / (h - 16) + (mapgenFbm(x / 14, z / 14, ns) - 0.5) * 0.35;
    return Math.min(
      mapgenBetween(Math.floor(t * (levels + 1)), 0, levels),
      Math.floor(Math.max(0, zoneDist(x, z) - 8) / 6)
    );
  };
  return { rise, lvl, zoneDist };
}
export function mapgenTerraces(G, levels) {
  /* bands across the depth that rise toward the back, each a step up; the road ramps through them */
  const { w, h } = G,
    W2 = w * 2,
    H2 = h * 2,
    { rise, lvl } = mapgenTerraceField(G, levels);
  for (let j = 0; j < H2; j++) for (let i = 0; i < W2; i++) G.S[j * W2 + i] = lvl((i + 0.5) / 2, (j + 0.5) / 2) * rise;
  /* TR-1: along each road the raise follows a profile that climbs no faster than 0.1 m a half metre (a level stretch
     through the hub, a branch ending at the main road's raise), and the roads, the hub round and the exits' rounds
     lie on one surface drawn from those profiles, with no step anywhere on it (it replaces a pass that lowered
     cells until each was within 0.25 m of its neighbours, which notched junctions and the hub round) */
  const { sProf: prof, sDiscs: discs } =
    G.grades && G.grades.sDiscs
      ? G.grades
      : mapgenRoadGrades(G); /* worked out with the land under the roads (mapgenStageGrade) */
  mapgenRoadSurface(G, prof, /** @type {any} */ (discs));
  mapgenRoadSides(G);
  /* water lies at the bottom: no raise under it (under a bridge the road's ramp goes on, so the deck meets its ends) */
  for (let j = 0; j < H2; j++)
    for (let i = 0; i < W2; i++)
      if ((G.F[mapgenCellAt(G, (i + 0.5) / 2, (j + 0.5) / 2)] & (4 | 8)) === 4) G.S[j * W2 + i] = 0;
  /* the cells at a wall's top edge get the rock ground */
  const rock = G.B.ground.rock;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const q = j * w + i;
      const m = G.M[j * 2 * W2 + i * 2];
      if (G.F[q] & (1 | 4) || m & 32 || (m & 15) === MAPGEN_TOWN_WALL)
        continue; /* a bank stays grass, a wall's top too */
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
/* TR-1: how fast a road's raise may change, a half metre at a time (20%) */
export const MAPGEN_ROAD_CLIMB = 0.1;
/** TR-1: no change between neighbouring samples of a profile over lim; only the samples not fixed move */
export function mapgenRampLimit(v, fixed, lim) {
  for (let pass = 0, moved = true; moved && pass < 40; pass++) {
    moved = false;
    for (let i = 1; i < v.length; i++)
      if (!fixed[i] && Math.abs(v[i] - v[i - 1]) > lim + 1e-9) {
        v[i] = mapgenBetween(v[i], v[i - 1] - lim, v[i - 1] + lim);
        moved = true;
      }
    for (let i = v.length - 2; i >= 0; i--)
      if (!fixed[i] && Math.abs(v[i] - v[i + 1]) > lim + 1e-9) {
        v[i] = mapgenBetween(v[i], v[i + 1] - lim, v[i + 1] + lim);
        moved = true;
      }
  }
}
/** TR-1: the raise along every road (one value per G.roadPts sample, in 5 cm steps) and the rounds that lie level
 * (the hub's, the exits'): {prof, discs}. rawAt(p) is the land's raise under a point, inZone(x, z) whether it is by
 * an exit's edge (raise 0) */
export function mapgenRoadProfiles(G, rawAt, rise, inZone) {
  const lim = MAPGEN_ROAD_CLIMB,
    n = G.roadPts.length,
    v = new Float64Array(n),
    fixed = new Uint8Array(n),
    first = [];
  let o = 0;
  for (const R of G.road) {
    first.push(o);
    o += R.pts.length;
  }
  G.road.forEach((R, r) => {
    const m = R.pts.length,
      raw = R.pts.map(rawAt),
      win = Math.ceil((rise / lim) * 0.6),
      sm = v.subarray(first[r], first[r] + m),
      fx = fixed.subarray(first[r], first[r] + m);
    for (let i = 0; i < m; i++) {
      let s = 0,
        c = 0;
      for (let k = Math.max(0, i - win); k <= Math.min(m - 1, i + win); k++) {
        s += raw[k];
        c++;
      }
      sm[i] = s / c;
    }
    /* MG-2: by an exit's edge the road lies at 0, so a joined neighbour meets it with no raise; the ramp limit from
       there caps the rest (a road running along an edge could be lifted by the smoothing otherwise) */
    const away = R.pts.map(p => (inZone(p[0], p[1]) ? 0 : 1e9));
    for (let i = 1; i < m; i++) away[i] = Math.min(away[i], away[i - 1] + 1);
    for (let i = m - 2; i >= 0; i--) away[i] = Math.min(away[i], away[i + 1] + 1);
    for (let i = 0; i < m; i++) {
      sm[i] = Math.min(sm[i], lim * away[i]);
      if (!away[i]) fx[i] = 1;
    }
    if (r === 0) {
      /* the main road lies level through the hub round (where the cone from an exit allows) */
      const hk = mapgenBetween(G.hubK ?? 0, 0, m - 1),
        hv = Math.round(sm[hk] * 20) / 20,
        S = G.roadPts[first[0] + hk].s;
      for (let i = 0; i < m; i++)
        if (Math.abs(G.roadPts[first[0] + i].s - S) <= 4 && hv <= lim * away[i] + 1e-9) {
          sm[i] = hv;
          fx[i] = 1;
        }
    } else if (R.join != null) {
      /* a branch ends at the main road's raise where it joins it */
      sm[m - 1] = v[first[0] + R.join];
      fx[m - 1] = 1;
    }
    mapgenRampLimit(sm, fx, lim);
  });
  /* the rounds lie level at their road's raise */
  const discs = [[G.hub[0], G.hub[1], 3.5], ...G.exits.map(e => [e.pt[0], e.pt[1], 3])].map(([x, z, r], d) => {
    const k =
      d === 0 && G.road.length
        ? first[0] + mapgenBetween(G.hubK ?? 0, 0, G.road[0].pts.length - 1)
        : G.near[mapgenCellAt(G, x, z)];
    return { x, z, r, v: k >= 0 ? Math.round(v[k] * 20) / 20 : 0 };
  });
  mapgenProfilesMeet(G, v, fixed, first, discs, lim);
  return { prof: Float32Array.from(v, x => Math.round(x * 20) / 20), discs };
}
/** TR-1: where two stretches of road pass near each other in space but not along the road (a bend that doubles
 * back, a branch beside the main road at a junction, another road) or near a round, their raise differs by no more
 * than lim a half metre of the gap between them, so the surface between them can be a ramp. A branch gives way to the
 * main road, and the fixed samples (an exit's stretch, the hub's) and the rounds do not move. slope: the change
 * allowed a metre of gap (lim a half metre, unless given) */
export function mapgenProfilesMeet(G, v, fixed, first, discs, lim, slope = lim * 2) {
  const P = G.roadPts,
    n = P.length,
    val = Float64Array.from([...v, ...discs.map(D => D.v)]),
    weight = q => (q >= n || fixed[q] ? 0 : G.road[P[q].k].main ? 1 : 2),
    pairs = [],
    cell = new Map(),
    key = (x, z) => `${Math.floor(x / 2)},${Math.floor(z / 2)}`;
  P.forEach((p, a) => {
    const k = key(p.x, p.z);
    if (!cell.has(k)) cell.set(k, []);
    cell.get(k).push(a);
  });
  const near = (x, z, reach, fn) => {
    const bi = Math.floor(x / 2),
      bj = Math.floor(z / 2),
      s = Math.ceil(reach / 2);
    for (let j = bj - s; j <= bj + s; j++)
      for (let i = bi - s; i <= bi + s; i++) for (const b of cell.get(`${i},${j}`) || []) fn(b);
  };
  const add = (a, b, d) => {
    let wa = weight(a),
      wb = weight(b);
    /* the main road keeps its profile against a branch */
    if (wa && wb && wa !== wb) wa === 2 ? (wb = 0) : (wa = 0);
    if (wa || wb) pairs.push([a, b, d, wa, wb]);
  };
  P.forEach((A, a) =>
    near(A.x, A.z, A.r + 4, b => {
      if (b <= a) return;
      const B = P[b],
        d = Math.hypot(A.x - B.x, A.z - B.z);
      if (d > A.r + B.r + 2.5 || (A.k === B.k && Math.abs(A.s - B.s) <= 1.5 * d)) return;
      add(a, b, d);
    })
  );
  discs.forEach((D, x) =>
    near(D.x, D.z, D.r + 4, b => {
      const d = Math.hypot(D.x - P[b].x, D.z - P[b].z) - D.r;
      if (d <= P[b].r + 1.5) add(n + x, b, Math.max(0, d));
    })
  );
  /* the samples a round moves hold still while the ramp limit runs, so their neighbours follow them (without that
     the limit's forward pass lifted a lowered sample straight back) */
  const held = new Uint8Array(n);
  for (let round = 0; round < 60; round++) {
    let worst = 0;
    held.set(fixed);
    for (const [a, b, d, wa, wb] of pairs) {
      const ex = Math.abs(val[a] - val[b]) - slope * d;
      if (ex <= 1e-6) continue;
      worst = Math.max(worst, ex);
      const sg = val[a] > val[b] ? 1 : -1;
      val[a] -= (sg * ex * wa) / (wa + wb);
      val[b] += (sg * ex * wb) / (wa + wb);
      if (a < n && wa) held[a] = 1;
      if (b < n && wb) held[b] = 1;
    }
    v.set(val.subarray(0, n));
    G.road.forEach((R, r) =>
      mapgenRampLimit(
        v.subarray(first[r], first[r] + R.pts.length),
        (worst < 1e-3 ? fixed : held).subarray(first[r], first[r] + R.pts.length),
        lim
      )
    );
    val.set(v);
    if (worst < 1e-3) break;
  }
}
/* TR-1: how steep a bank beside a road is (0.25 m a half metre, 27 degrees: walkable, and no steeper than a step
   between road cells may be), and how far out it reaches */
export const MAPGEN_BANK_SLOPE = 0.25;
export const MAPGEN_BANK_REACH = 6;
/* TR-1: the wall beside a town's roads (walk/heights.js WALL_MATERIALS: dressed stone) */
export const MAPGEN_TOWN_WALL = 5;
/** TR-1: the sides of the roads' cuts and fills. On a route a graded bank: within 3 m of the walkable surface (the
 * ramp cells mapgenRoadSurface made) the land's raise comes no nearer the road's than MAPGEN_BANK_SLOPE a half metre
 * away from it allows, as ramp cells of the land's own ground, so a road cut into a terrace has grassy slopes beside
 * it instead of walls; what a bank can't take (more than 1.5 m) stays a wall above it. In a town (any kind but a
 * route) a dressed-stone retaining wall at the road's edge instead. Not on water */
export function mapgenRoadSides(G) {
  const W2 = G.w * 2,
    H2 = G.h * 2,
    N = W2 * H2,
    R = MAPGEN_BANK_REACH,
    sl = MAPGEN_BANK_SLOPE,
    road = new Uint8Array(N),
    lo = new Float64Array(N).fill(-1e9),
    hi = new Float64Array(N).fill(1e9),
    wet = c => (G.F[mapgenCellAt(G, ((c % W2) + 0.5) / 2, (Math.floor(c / W2) + 0.5) / 2)] & (4 | 8)) === 4;
  for (let c = 0; c < N; c++) if (G.M[c] & 32) road[c] = 1;
  if (G.P.kind !== 'route') {
    /* in a town a retaining wall of dressed stone instead: the higher side of every step at the road's edge (a cut's
       land, a fill's road) is built (the wall takes the higher cell's material) */
    for (let c = 0; c < N; c++) {
      if (!road[c]) continue;
      const i = c % W2;
      for (const q of [i > 0 ? c - 1 : -1, i < W2 - 1 ? c + 1 : -1, c - W2, c + W2]) {
        if (q < 0 || q >= N || road[q] || wet(q) || Math.abs(G.S[q] - G.S[c]) < 0.04) continue;
        const top = G.S[q] > G.S[c] ? q : c;
        G.M[top] = (G.M[top] & ~15) | MAPGEN_TOWN_WALL;
      }
    }
    return;
  }
  for (let c = 0; c < N; c++) {
    if (!road[c]) continue;
    const i = c % W2,
      j = (c - i) / W2;
    for (let b = -R; b <= R; b++)
      for (let a = -R; a <= R; a++) {
        const ii = i + a,
          jj = j + b,
          d = Math.hypot(a, b);
        if (ii < 0 || jj < 0 || ii >= W2 || jj >= H2 || d > R + 0.01) continue;
        const q = jj * W2 + ii;
        if (road[q]) continue;
        lo[q] = Math.max(lo[q], G.S[c] - sl * d);
        hi[q] = Math.min(hi[q], G.S[c] + sl * d);
      }
  }
  /* the bank: the land's raise brought within the slope of the road, then of its neighbours in the bank (so two bank
     cells either side of a terrace's edge meet as a slope too) */
  /* in whole 5 cm units, so rounding never makes a step steeper than the slope */
  const u = Math.round(sl * 20),
    v = Int32Array.from(G.S, x => Math.round(x * 20)),
    zone = [];
  for (let q = 0; q < N; q++) {
    if (road[q] || hi[q] > 1e8 || wet(q)) continue;
    const a = Math.ceil(Math.min(lo[q], hi[q]) * 20 - 1e-6),
      b = Math.floor(Math.max(lo[q], hi[q]) * 20 + 1e-6);
    v[q] = mapgenBetween(v[q], a, Math.max(a, b));
    zone.push(q);
  }
  const inBank = new Uint8Array(N);
  for (const q of zone) inBank[q] = 1;
  for (let pass = 0, moved = true; moved && pass < 400; pass++) {
    moved = false;
    for (let x = 0; x < zone.length; x++) {
      const q = zone[pass % 2 ? zone.length - 1 - x : x],
        i = q % W2;
      let a = -1e9,
        b = 1e9;
      for (const r of [i > 0 ? q - 1 : -1, i < W2 - 1 ? q + 1 : -1, q - W2, q + W2]) {
        if (r < 0 || r >= N || !(road[r] || inBank[r])) continue;
        a = Math.max(a, v[r] - u);
        b = Math.min(b, v[r] + u);
      }
      const nv = a > b ? Math.round((a + b) / 2) : mapgenBetween(v[q], a, b);
      if (nv !== v[q]) {
        v[q] = nv;
        moved = true;
      }
    }
  }
  for (const q of zone)
    if (Math.abs(v[q] / 20 - G.S[q]) > 0.01) {
      G.S[q] = v[q] / 20;
      G.M[q] |= 32;
    }
}
/** TR-1: the walkable surface: every cell of a road's corridor (within its half width and 0.75 m) and of the rounds,
 * as ramps (stepm 32, so the game draws them leaning between their neighbours). The rounds lie level, the cells a
 * road's centre line crosses hold its profile, and the cells between are smooth (each the mean of its walkable
 * neighbours), with no step over 0.2 m between neighbours (0.25 m once rounded to 5 cm; a step is walkable up to
 * 0.34 m) */
export function mapgenRoadSurface(G, prof, discs) {
  const W2 = G.w * 2,
    H2 = G.h * 2,
    N = W2 * H2,
    walk = new Uint8Array(N),
    hold = new Uint8Array(N),
    v = new Float64Array(N);
  for (let j = 0; j < H2; j++)
    for (let i = 0; i < W2; i++) {
      const x = (i + 0.5) / 2,
        z = (j + 0.5) / 2,
        q = mapgenCellAt(G, x, z),
        c = j * W2 + i,
        k = G.near[q];
      if ((G.F[q] & (4 | 8)) === 4) continue; /* water: not walked on */
      if (k >= 0 && Math.hypot(x - G.roadPts[k].x, z - G.roadPts[k].z) <= G.roadPts[k].r + 0.75) {
        walk[c] = 1;
        v[c] = prof[k];
      }
      for (const D of discs)
        if (Math.hypot(x - D.x, z - D.z) <= D.r) {
          walk[c] = 1;
          hold[c] = 2;
          v[c] = D.v;
        }
    }
  const sum = new Float64Array(N),
    cnt = new Uint16Array(N);
  G.roadPts.forEach((p, k) => {
    const c = mapgenBetween(Math.floor(p.z * 2), 0, H2 - 1) * W2 + mapgenBetween(Math.floor(p.x * 2), 0, W2 - 1);
    if (walk[c] && hold[c] !== 2) {
      sum[c] += prof[k];
      cnt[c]++;
    }
  });
  for (let c = 0; c < N; c++)
    if (cnt[c]) {
      v[c] = sum[c] / cnt[c];
      hold[c] = 1;
    }
  const nbs = c => {
    const i = c % W2,
      out = [];
    if (i > 0 && walk[c - 1]) out.push(c - 1);
    if (i < W2 - 1 && walk[c + 1]) out.push(c + 1);
    if (c >= W2 && walk[c - W2]) out.push(c - W2);
    if (c < N - W2 && walk[c + W2]) out.push(c + W2);
    return out;
  };
  const cells = [];
  for (let c = 0; c < N; c++) if (walk[c]) cells.push([c, nbs(c)]);
  const free = cells.filter(([c, nb]) => !hold[c] && nb.length);
  for (let it = 0; it < 500; it++) {
    let ch = 0;
    for (const [c, nb] of free) {
      let s = 0;
      for (const b of nb) s += v[b];
      const nv = v[c] + 1.5 * (s / nb.length - v[c]);
      ch = Math.max(ch, Math.abs(nv - v[c]));
      v[c] = nv;
    }
    if (ch < 1e-4) break;
  }
  const lim = 0.2,
    soft = cells.filter(([c]) => hold[c] !== 2);
  for (let pass = 0, moved = true; moved && pass < 300; pass++) {
    moved = false;
    for (let x = 0; x < soft.length; x++) {
      const [c, nb] = soft[pass % 2 ? soft.length - 1 - x : x];
      let lo = -1e9,
        hi = 1e9;
      for (const b of nb) {
        lo = Math.max(lo, v[b] - lim);
        hi = Math.min(hi, v[b] + lim);
      }
      const nv = lo > hi ? (lo + hi) / 2 : mapgenBetween(v[c], lo, hi);
      if (Math.abs(nv - v[c]) > 1e-6) {
        v[c] = nv;
        moved = true;
      }
    }
  }
  for (const [c] of cells) {
    G.S[c] = Math.round(v[c] * 20) / 20;
    G.M[c] |= 32;
  }
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
    /* MG-2: and out of a joined edge's strip, so the edge meets the neighbour's land */
    for (let q = 0; q < G.w * G.h; q++)
      if (G.F[q] & 4 && mapgenNearJoined(G, (q % G.w) + 0.5, Math.floor(q / G.w) + 0.5, 6)) {
        G.F[q] &= ~4;
        G.T[q] = G.F[q] & 1 ? MAPGEN_SURFACES[P.road.surface] : B.ground.bank;
      }
    mapgenLowerWater(G);
  }
  mapgenBridgesOverWater(G);
}
export function mapgenStageLand(G) {
  const { P, B } = G,
    rnd = G.rng('ground', 'land'),
    s = G.salt('ground');
  const lv = mapgenTerraceCount(P);
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

/* ---------- MG-2: the neighbour's ground runs on across a joined edge ---------- */
/** ground a joined edge takes from its neighbour: natural ground, as the composer mingles it across a seam
 * (seamless-world.js: walkable, not paved, not water), less the road surfaces, boards and tall grass, whose places
 * are the scene's own */
export function mapgenCopyable(G, ch) {
  const T = G.terr[ch];
  return (
    !!T &&
    !T.paved &&
    T.walk !== false &&
    !MAPGEN_WET.includes(ch) &&
    !Object.values(MAPGEN_SURFACES).includes(ch) &&
    ch !== 'b' &&
    ch !== 't'
  );
}
/** after the feature: along each joined strip, the neighbour's natural ground is laid on the cells next to the
 * edge to a ragged depth of 1-4 m, on free cells only (no road, verge, water, bridge, tall grass, bank or jetty), and
 * the neighbour's things near the edge take their room, so nothing of this scene stands against them */
export function mapgenStageEdgeGround(G) {
  const sl = G.salt('ground', 'edge');
  for (const s of G.joined) {
    for (const [k, x, z, sz] of s.props || []) mapgenOccAdd(G, x, z, mapgenRadius(G.cat[k], sz || 1));
    for (let n = 0; n < s.ground.length; n++) {
      const ch = s.ground[n],
        c = s.c0 + n;
      if (!mapgenCopyable(G, ch)) continue;
      const deep = 1 + 3 * mapgenNoise(c / 3.1, s.side.charCodeAt(0), sl);
      for (let d = 0; d < deep; d++) {
        const i = s.side === 'W' ? d : s.side === 'E' ? G.w - 1 - d : c,
          j = s.side === 'S' ? d : s.side === 'N' ? G.h - 1 - d : c;
        if (i < 0 || j < 0 || i >= G.w || j >= G.h) continue;
        const q = j * G.w + i;
        if (G.F[q] & (1 | 2 | 4 | 8 | 32 | 64 | 128) || !mapgenCopyable(G, G.T[q])) continue;
        G.T[q] = ch;
      }
    }
  }
}

/* ---------- MG-2: the hub's buildings (a first take on MG-3's lots) ---------- */
/* what the props dials put at the hub: [dial, prop, what it does, label] (the act opens the clinic's or the shop's
   room, data-files.js ROOM_BY_USE; 'fly' is the airship's mast, airship.js) */
/** @type {[string, string, string, string | null][]} */
export const MAPGEN_HUB_BUILDINGS = [
  ['clinic', 'clinic', 'clinic', null],
  ['shop', 'shop', 'shop', null],
  ['mast', 'airship_station', 'fly', 'Airship station'],
];
/** is (x, z) on a building's lot, or within m metres of one */
export const mapgenInLot = (G, x, z, m = 0) =>
  G.lots.some(L => x > L[0] - m && x < L[2] + m && z > L[1] - m && z < L[3] + m);
/** the props dials' clinic, shop and airship mast beside the main road near the hub, facing the camera (south) like
 * every town building: north of the road, the front 2.5-5 m from its edge, on a level pad, with a path from the door
 * to the road. A lot keeps 12 m from the exits and joined edges, clear of the road, water, banks, bridges and
 * anything placed, its z on a half metre (so the door step isn't inside the building's walk block), and its door 7 m
 * from the sides and 10.4 m from the back, where the room laid behind a door fits (seamless-world.js
 * seamlessRoomPlacement). Its own random stream ('lots'). */
export function mapgenStageLots(G) {
  const { P, w, h } = G,
    want = MAPGEN_HUB_BUILDINGS.filter(b => P.props[b[0]] > 0);
  if (!want.length) return;
  const rnd = G.rng('lots'),
    M = G.road[0].pts,
    hk = G.hubK,
    ppu = 34,
    half = P.road.width / 2,
    cand = [];
  for (let k = Math.max(0, hk - 60); k <= Math.min(M.length - 1, hk + 60); k += 2) cand.push(k);
  for (let i = cand.length - 1; i > 0; i--) {
    const j = rnd.int(0, i);
    [cand[i], cand[j]] = [cand[j], cand[i]];
  }
  cand.sort((a, b) => Math.abs(a - hk) - Math.abs(b - hk) || 0); /* nearest the hub first; ties in the random order */
  const free = (x0, z0, x1, z1) => {
    if (x0 < 1 || z0 < 1 || x1 > w - 1 || z1 > h - 1) return false;
    for (let z = Math.floor(z0); z < Math.ceil(z1); z++)
      for (let x = Math.floor(x0); x < Math.ceil(x1); x++)
        if (G.F[z * w + x] & (1 | 2 | 4 | 8 | 64 | 128)) return false;
    const cx = (x0 + x1) / 2,
      cz = (z0 + z1) / 2,
      r = Math.hypot(x1 - x0, z1 - z0) / 2;
    if (Math.hypot(cx - G.hub[0], cz - G.hub[1]) < r + 3) return false;
    if (G.exits.some(e => Math.hypot(cx - e.pt[0], cz - e.pt[1]) < r + 12)) return false;
    if (mapgenNearJoined(G, cx, cz, 12 + r)) return false;
    if (G.lots.some(L => x0 < L[2] + 1 && x1 > L[0] - 1 && z0 < L[3] + 1 && z1 > L[1] - 1)) return false;
    for (const o of [...[...G.occ.values()].flat(), ...G.keep]) {
      const dx = Math.max(x0 - o[0], 0, o[0] - x1),
        dz = Math.max(z0 - o[1], 0, o[1] - z1);
      if (Math.hypot(dx, dz) < o[2]) return false;
    }
    return true;
  };
  for (const [dial, k, act, label] of want) {
    const C = G.cat[k];
    if (!C || !C.box) continue;
    const bw = C.box[0],
      bd = C.box[1],
      dx = ((C.door && C.door.x) || 0) / ppu;
    let done = /** @type {any} */ (null);
    for (const s of cand) {
      const R = M[s];
      /* north of the road (it runs across), or beside it (it runs north), always facing the camera */
      const spots = [];
      for (const gap of [2.5, 3.5, 4.5]) for (const ox of [0, 2, -2, 4, -4]) spots.push([ox - dx, half + gap]);
      for (const gap of [1.5, 2.5]) for (const sg of [1, -1]) spots.push([sg * (half + gap + bw / 2), -1]);
      for (const [ox, oz] of spots) {
        const z = Math.round((R[1] + oz) * 2) / 2,
          x = mapgenRound2(R[0] + ox),
          door = [x + dx, z],
          step = [door[0], z - 0.55];
        if (door[0] < 7 || door[0] > w - 7 || z > h - 10.4) continue;
        /* the road it fronts: the nearest sample to the door step, close and south of it */
        const q = mapgenCellAt(G, step[0], step[1]),
          nk = G.near[q];
        if (nk < 0) continue;
        const p = G.roadPts[nk];
        if (p.k !== 0 || step[1] < p.z - 1.5 || Math.hypot(step[0] - p.x, step[1] - p.z) > p.r + 5.5) continue;
        if (!free(x - bw / 2 - 0.5, z - 1, x + bw / 2 + 0.5, z + bd + 0.5)) continue;
        /* a spot for the mast's landing (airship.js flyLand: beside it, a step in front) */
        if (act === 'fly' && !free(x + bw / 2 + 0.4, z - 1.4, x + bw / 2 + 1.4, z - 0.4)) continue;
        done = { x, z, step, road: p, bw, bd };
        break;
      }
      if (done) break;
    }
    if (!done) {
      G.notes.push(`no room for the ${dial === 'mast' ? "airship's mast" : dial} beside the road near the hub`);
      continue;
    }
    mapgenLevelLot(G, done);
    const extra = label ? { act, label } : { act };
    mapgenPutProp(G, k, done.x, done.z, { force: true, extra });
    G.lots.push([done.x - bw / 2, done.z - 0.1, done.x + bw / 2, done.z + bd]);
    mapgenOccAdd(G, done.x, done.z + bd / 2, Math.hypot(bw, bd) / 2 + 0.4);
    if (act === 'fly') G.keep.push([done.x + bw / 2 + 0.9, done.z - 0.9, 1]);
  }
}
/** a lot made ready: its ground (the building, a metre round it and the door's path) level at the road's height
 * where the path meets it, the same step raise, the path painted to the door and kept clear */
export function mapgenLevelLot(G, L) {
  const { w, h } = G,
    W2 = w * 2,
    p = L.road,
    h0 = mapgenCornerHeight(G, p.x, p.z),
    raise = G.S[mapgenBetween(Math.floor(p.z * 2), 0, h * 2 - 1) * W2 + mapgenBetween(Math.floor(p.x * 2), 0, W2 - 1)],
    x0 = L.x - L.bw / 2 - 1,
    x1 = L.x + L.bw / 2 + 1,
    z0 = L.z - 1.5,
    z1 = L.z + L.bd + 1;
  /* the path: from the door step to the road's centre line */
  const path = [],
    n = Math.ceil(Math.hypot(L.step[0] - p.x, L.step[1] - p.z) / 0.25);
  for (let i = 0; i <= n; i++)
    path.push([L.step[0] + ((p.x - L.step[0]) * i) / n, L.step[1] + ((p.z - L.step[1]) * i) / n]);
  const onPath = (x, z, r) => path.some(q => Math.hypot(x - q[0], z - q[1]) <= r),
    /* the lots already made keep their ground */
    other = (x, z) => G.lots.some(Q => x >= Q[0] - 1 && x <= Q[2] + 1 && z >= Q[1] - 1.5 && z <= Q[3] + 1);
  /* corners: level on the lot and the path, blended out over 3 m, never moving the road itself */
  for (let j = Math.max(0, Math.floor(z0 - 3)); j <= Math.min(h, Math.ceil(z1 + 3)); j++)
    for (let i = Math.max(0, Math.floor(x0 - 3)); i <= Math.min(w, Math.ceil(x1 + 3)); i++) {
      const q = mapgenCellAt(G, i, j);
      if ((G.near[q] >= 0 && G.dist[q] < G.roadPts[G.near[q]].r + 0.5) || other(i, j)) continue;
      const dx = Math.max(x0 - i, 0, i - x1),
        dz = Math.max(z0 - j, 0, j - z1),
        d = Math.min(Math.hypot(dx, dz), onPath(i, j, 0.9) ? 0 : 1e9),
        t = d <= 0 ? 1 : 1 - mapgenSmooth(Math.min(1, d / 3));
      if (t > 0) G.H[j * (w + 1) + i] = G.H[j * (w + 1) + i] * (1 - t) + h0 * t;
    }
  /* half-metre cells: the lot's and the path's raise is the road's there */
  for (let j = Math.max(0, Math.floor(z0 * 2)); j < Math.min(h * 2, Math.ceil(z1 * 2)); j++)
    for (let i = Math.max(0, Math.floor(x0 * 2)); i < Math.min(W2, Math.ceil(x1 * 2)); i++) {
      if (other((i + 0.5) / 2, (j + 0.5) / 2)) continue;
      G.S[j * W2 + i] = raise;
      G.M[j * W2 + i] |= 32;
    }
  const surf = MAPGEN_SURFACES[G.P.road.surface];
  for (const [x, z] of path) {
    mapgenPaintDisc(G, x, z, 0.75, q => {
      if (G.F[q] & (1 | 4)) return;
      G.T[q] = surf;
      G.F[q] = (G.F[q] & ~(32 | 64)) | 2;
    });
    for (let j = Math.max(0, Math.floor((z - 0.75) * 2)); j < Math.min(h * 2, Math.ceil((z + 0.75) * 2)); j++)
      for (let i = Math.max(0, Math.floor((x - 0.75) * 2)); i < Math.min(W2, Math.ceil((x + 0.75) * 2)); i++) {
        G.S[j * W2 + i] = raise;
        G.M[j * W2 + i] |= 32;
      }
  }
  for (let i = 0; i < path.length; i += 4) G.keep.push([path[i][0], path[i][1], 0.9]);
  /* no tree on the lot */
  for (let z = Math.floor(z0); z < Math.ceil(z1); z++)
    for (let x = Math.floor(x0); x < Math.ceil(x1); x++) if (x >= 0 && z >= 0 && x < w && z < h) G.F[z * w + x] |= 16;
  if (raise) G.stepsUsed = true;
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
    mapgenKnoll(G, x, z, 5, 1.4); /* TR-1: was the land raised, out to 9 m: it lifted the road beside it */
    /* TR-1: the tower and the bench on the far side of the knoll from the road, the path's stairs ending before them
       (they stood at fixed offsets, often across the path's top) */
    const k = G.near[mapgenCellAt(G, x, z)],
      P0 = k >= 0 ? G.roadPts[k] : { x, z: z - 1 },
      L = Math.hypot(x - P0.x, z - P0.z) || 1,
      ux = (x - P0.x) / L,
      uz = (z - P0.z) / L,
      sd = ux >= 0 ? 1 : -1;
    mapgenPutProp(G, 'lookout_tower', x + ux * 1.1, z + uz * 1.1, { force: true });
    mapgenPutProp(G, 'bench_wood', x - uz * 2.3 * sd - ux * 0.6, z + ux * 2.3 * sd - uz * 0.6, { force: true });
    mapgenSpur(G, x, z, 1.1);
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
export function mapgenSpur(G, x, z, short = 1.5) {
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
  mapgenFootpath(G, [p.x, p.z], [x, z], L - short);
}
/* TR-1: a footpath climbs no faster than this a half metre: a stair's riser, or a ramp where the path runs aslant
   the half-metre grid (a stair's risers follow the grid, so a slanting flight would be ragged) */
export const MAPGEN_STAIR_RISE = 0.2;
export const MAPGEN_PATH_RAMP = 0.125;
/** TR-1: a footpath's climb (from a road at a to a feature, `len` metres toward b): stone steps (wall material 8,
 * risers of MAPGEN_STAIR_RISE at most, 0.25 m where the climb asks it) where it runs within 25 degrees of the grid
 * or a ramp couldn't fit, else a ramp of 25% (ramp cells), in the step raise: a terrace's or a knoll's raise it crosses is cut or filled to it, from the road's raise
 * where it leaves the road to the ground's at its end */
export function mapgenFootpath(G, a, b, len) {
  const W2 = G.w * 2,
    H2 = G.h * 2,
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    L0 = Math.hypot(dx, dz);
  if (L0 < 1 || len < 1) return;
  const ux = dx / L0,
    uz = dz / L0,
    ang = Math.abs(Math.atan2(uz, ux)) % (Math.PI / 2),
    square = Math.min(ang, Math.PI / 2 - ang) <= (25 * Math.PI) / 180,
    cellOf = (x, z) => mapgenBetween(Math.floor(z * 2), 0, H2 - 1) * W2 + mapgenBetween(Math.floor(x * 2), 0, W2 - 1),
    n = Math.floor(len * 2) + 1,
    Z = new Float64Array(n),
    fixed = new Uint8Array(n);
  /* in the raise (walking steps from cell to cell go by it; the land between corners is smooth and walkable) */
  for (let k = 0; k < n; k++) Z[k] = G.S[cellOf(a[0] + ux * k * 0.5, a[1] + uz * k * 0.5)];
  fixed[0] = fixed[n - 1] = 1;
  /* stairs where the path runs along the grid, a ramp where it slants, unless the ramp can't fit the climb in the
     length there is: then stairs anyway (ragged beats out of reach), with risers up to 0.25 m if they must be */
  const climb = Math.abs(Z[n - 1] - Z[0]),
    stairs = !square ? climb > MAPGEN_PATH_RAMP * (n - 1) : true,
    lim = !stairs ? MAPGEN_PATH_RAMP : climb > MAPGEN_STAIR_RISE * (n - 1) ? 0.25 : MAPGEN_STAIR_RISE;
  mapgenRampLimit(Z, fixed, lim);
  let any = false;
  const x0 = Math.min(a[0], b[0]) - 1,
    x1 = Math.max(a[0], b[0]) + 1,
    z0 = Math.min(a[1], b[1]) - 1,
    z1 = Math.max(a[1], b[1]) + 1;
  for (let j = Math.max(0, Math.floor(z0 * 2)); j < Math.min(H2, Math.ceil(z1 * 2)); j++)
    for (let i = Math.max(0, Math.floor(x0 * 2)); i < Math.min(W2, Math.ceil(x1 * 2)); i++) {
      const x = (i + 0.5) / 2,
        z = (j + 0.5) / 2,
        t = (x - a[0]) * ux + (z - a[1]) * uz,
        off = Math.abs((x - a[0]) * uz - (z - a[1]) * ux),
        q = mapgenCellAt(G, x, z);
      if (t < 0 || t > len || off > 0.75 || G.F[q] & (1 | 4)) continue;
      const k = Math.min(n - 1, Math.floor(t * 2)),
        f = Math.min(1, t * 2 - k),
        zt = Z[k] * (1 - f) + Z[Math.min(n - 1, k + 1)] * f,
        c = j * W2 + i,
        v = Math.round(zt * 20) / 20;
      if (Math.abs(v - G.S[c]) < 0.01 && !(stairs && v)) continue;
      G.S[c] = v;
      G.M[c] = stairs ? (G.M[c] & ~(15 | 32)) | 8 : G.M[c] | 32;
      any = true;
    }
  if (any) G.stepsUsed = true;
}
/** TR-1: a knoll for a lookout: the ground within about r of (x, z) raised by `by` as a step-grid rise (natural rock
 * at its edge), kept 2.5 m clear of a road and off water, so the road beside it stays as it was */
export function mapgenKnoll(G, x, z, r, by) {
  const W2 = G.w * 2,
    ns = G.salt('feature', 'knoll');
  for (let j = Math.max(0, Math.floor((z - r * 1.3) * 2)); j < Math.min(G.h * 2, Math.ceil((z + r * 1.3) * 2)); j++)
    for (let i = Math.max(0, Math.floor((x - r * 1.3) * 2)); i < Math.min(W2, Math.ceil((x + r * 1.3) * 2)); i++) {
      const cx = (i + 0.5) / 2,
        cz = (j + 0.5) / 2,
        d = Math.hypot(cx - x, cz - z),
        an = Math.atan2(cz - z, cx - x),
        q = mapgenCellAt(G, cx, cz);
      if (d > r * (0.85 + 0.3 * mapgenNoise(Math.cos(an) * 1.5 + 5, Math.sin(an) * 1.5 + 5, ns))) continue;
      if (G.F[q] & 4 || G.dist[q] - (G.near[q] >= 0 ? G.roadPts[G.near[q]].r : 0) < 2.5) continue;
      G.S[j * W2 + i] = Math.round((G.S[j * W2 + i] + by) * 20) / 20;
    }
  G.stepsUsed = true;
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
        for (const sg of [1, -1]) {
          const x = pts[k][0] + nx * r * sg,
            z = pts[k][1] + nz * r * sg;
          if (!mapgenInLot(G, x, z, 0.6) && mapgenPutProp(G, 'signpost', x, z, { force: true })) return;
        }
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
  for (const s of P.edges || [])
    if (!G.joined.includes(s))
      G.notes.push(`no room for the exit joined on the ${MAPGEN_SIDE_NAME[s.side]} side (four exits at most)`);
  mapgenStageHeights(G);
  mapgenPinEdges(G, 16);
  mapgenStageRoad(G);
  mapgenStageGround(G);
  mapgenStageWater(G);
  mapgenChooseHub(G);
  mapgenStageExits(G);
  mapgenStageGrade(G);
  mapgenStageLand(G);
  mapgenStageFeature(G);
  mapgenStageEdgeGround(G);
  mapgenStageLots(G);
  mapgenStagePlants(G);
  mapgenStageProps(G);
  mapgenPinEdges(G, 6);
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
      sc.stepm = mapgenEncodeBase64(G.M);
    }
  }
  sc.gen = { v: MAPGEN_VERSION, params: P, seed: P.seed };
  /* TR-1: a road still steeper than 20% somewhere (switchbacks had no room there) */
  const rr = mapgenRoadReport(sc);
  if (rr.grade > 0.2)
    G.notes.push(`a road climbs ${Math.round(rr.grade * 100)}% near ${rr.at.grade.map(Math.round).join(', ')}`);
  return { scene: sc, notes: G.notes };
}

/* ---------- checking a scene: can you walk from the hub to every exit? ---------- */
/** a scene's walk grid on half-metre cells (walk-view.js navGrid, simplified): blk, water blocked unless a bridge
 * crosses it and solid props; S, the step raise of each cell in 5 cm units (null with no steps) */
export function mapgenWalkGrid(sc, scenery) {
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
  return { N, gw, gh, blk, S: S && S.length === gw * gh ? S : null };
}
/** the half-metre cells you can walk to from a point (the hub unless given): water, solid props and a step taller
 * than 0.34 m stop you. { N, gw, gh, blk, S, seen } */
export function mapgenReach(sc, scenery, from = sc.hub) {
  const W = mapgenWalkGrid(sc, scenery),
    { N, gw, gh, blk, S } = W,
    start = mapgenBetween(Math.floor(from[1] * N), 0, gh - 1) * gw + mapgenBetween(Math.floor(from[0] * N), 0, gw - 1),
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
      if (S && Math.abs(S[r] - S[q]) / 20 > 0.34) continue;
      seen[r] = 1;
      Q.push(r);
    }
  }
  return { ...W, seen };
}
/** was the cell at (x, z) reached (R: from mapgenReach) */
export const mapgenReached = (R, x, z) =>
  !!R.seen[mapgenBetween(Math.floor(z * R.N), 0, R.gh - 1) * R.gw + mapgenBetween(Math.floor(x * R.N), 0, R.gw - 1)];
/** the exits the hub can't walk to (by edgeExits id) */
export function mapgenUnreachable(sc, scenery) {
  const R = mapgenReach(sc, scenery);
  return (sc.edgeExits || []).filter(e => !mapgenReached(R, ...mapgenExitPoint(sc.w, sc.h, e))).map(e => e.id);
}

/* ---------- MG-2: how two scenes meet where they join ---------- */
/* how far either side of an exit a neighbour shows in a place's view (seamless-world.js NEIGHBOR_BAND_HALF_WIDTH):
   the stretch of a joined edge that must agree */
export const MAPGEN_BAND = 26;
export const MAPGEN_OUTWARD = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] }; /* pointing out of the map */
/** a scene's corner height at whole metres (x east, z from the near edge), as stored */
export function mapgenSceneCorner(sc, x, z) {
  const r = (sc.heights || [])[sc.h - mapgenBetween(Math.round(z), 0, sc.h)];
  return r ? +r[mapgenBetween(Math.round(x), 0, sc.w)] || 0 : 0;
}
/** a scene's ground height at (x, z) between its corners (bilinear; walk/heights.js keeps within the same corners) */
export function mapgenSceneGround(sc, x, z) {
  const i = mapgenBetween(Math.floor(x), 0, sc.w - 1),
    j = mapgenBetween(Math.floor(z), 0, sc.h - 1),
    fx = mapgenBetween(x - i, 0, 1),
    fz = mapgenBetween(z - j, 0, 1),
    c = (a, b) => mapgenSceneCorner(sc, a, b);
  return (
    c(i, j) * (1 - fx) * (1 - fz) +
    c(i + 1, j) * fx * (1 - fz) +
    c(i, j + 1) * (1 - fx) * fz +
    c(i + 1, j + 1) * fx * fz
  );
}
/** a scene's exit and the point it stands on (sc.exits, as the game reads it; worked out when missing) */
export function mapgenExitOf(sc, id) {
  const k = (sc.edgeExits || []).findIndex(e => e.id === id);
  if (k < 0) return null;
  const e = sc.edgeExits[k];
  return { k, e, p: (sc.exits || [])[k] || mapgenExitPoint(sc.w, sc.h, e) };
}
/** where B's corner lies in A's metres when A's exit meets B's (seamless-world.js seamlessJoin) */
export function mapgenJoinOffset(A, xa, B, xb) {
  const s = xa.e.side;
  return s === 'E'
    ? [A.w, Math.round(xa.p[1] - xb.p[1])]
    : s === 'W'
      ? [-B.w, Math.round(xa.p[1] - xb.p[1])]
      : s === 'N'
        ? [Math.round(xa.p[0] - xb.p[0]), A.h]
        : [Math.round(xa.p[0] - xb.p[0]), -B.h];
}
/**
 * how well two scenes meet where A's exit idA joins B's exit idB, B laid as the game lays it: the largest height gap
 * between their corners along the shared edge within 6 m of the exit (dhNear, the a02_joins distance) and within the
 * neighbour band (dhBand); the step raise across the seam at the exit (raiseExit, B's minus A's) and its largest gap
 * along the band (raiseBand); and walk: null when a straight walk across, from 4 m inside A's exit to 5.2 m out (as
 * a02_joins walks it), crosses only walkable half-metre cells with no rise over 0.34 m between them (ground plus
 * raise, as the nav grid levels them), else what stops it. null when an exit is missing.
 * @returns {{ off: number[], dhNear: number, dhBand: number, raiseExit: number, raiseBand: number, walk: string | null } | null}
 */
export function mapgenSeamAgreement(A, idA, B, idB, scenery) {
  const xa = mapgenExitOf(A, idA),
    xb = mapgenExitOf(B, idB);
  if (!xa || !xb) return null;
  const s = xa.e.side,
    v = s === 'E' || s === 'W',
    off = mapgenJoinOffset(A, xa, B, xb),
    oa = v ? off[1] : off[0],
    e = v ? xa.p[1] : xa.p[0],
    lo = Math.max(0, oa, e - MAPGEN_BAND),
    hi = Math.min(v ? A.h : A.w, oa + (v ? B.h : B.w), e + MAPGEN_BAND);
  /* the shared edge, by u (metres along it, in A's): A's corner and B's, A's half-metre cell touching it and B's */
  const edge = u => {
    const ax = v ? (s === 'E' ? A.w : 0) : u,
      az = v ? u : s === 'N' ? A.h : 0;
    return [ax, az, ax - off[0], az - off[1]];
  };
  const inA = u => (v ? [s === 'E' ? A.w - 0.25 : 0.25, u] : [u, s === 'N' ? A.h - 0.25 : 0.25]),
    inB = u => {
      const [x, z] = inA(u);
      return [x + (v ? (s === 'E' ? 0.5 : -0.5) : 0) - off[0], z + (v ? 0 : s === 'N' ? 0.5 : -0.5) - off[1]];
    };
  let dhNear = 0,
    dhBand = 0;
  for (let u = Math.ceil(lo); u <= Math.floor(hi); u++) {
    const [ax, az, bx, bz] = edge(u),
      d = Math.abs(mapgenSceneCorner(B, bx, bz) - mapgenSceneCorner(A, ax, az));
    dhBand = Math.max(dhBand, d);
    if (Math.abs(u - e) <= 6) dhNear = Math.max(dhNear, d);
  }
  const WA = mapgenWalkGrid(A, scenery),
    WB = mapgenWalkGrid(B, scenery),
    cell = (W, x, z) =>
      mapgenBetween(Math.floor(z * W.N), 0, W.gh - 1) * W.gw + mapgenBetween(Math.floor(x * W.N), 0, W.gw - 1),
    raise = (W, x, z) => (W.S ? W.S[cell(W, x, z)] / 20 : 0);
  const raiseExit = mapgenRound2(raise(WB, ...inB(e)) - raise(WA, ...inA(e)));
  let raiseBand = 0;
  for (let u = Math.floor(lo) + 0.25; u < hi; u += 0.5)
    raiseBand = Math.max(raiseBand, Math.abs(raise(WB, ...inB(u)) - raise(WA, ...inA(u))));
  /* the walk across, every tenth of a metre, cell by cell */
  const d = MAPGEN_OUTWARD[s],
    a = [xa.p[0] - d[0] * 4, xa.p[1] - d[1] * 4];
  let walk = /** @type {string | null} */ (null),
    last = '',
    lv0 = NaN;
  for (let t = 0; t <= 9.2 + 1e-6 && !walk; t += 0.1) {
    let x = a[0] + d[0] * t,
      z = a[1] + d[1] * t,
      S = A,
      W = WA;
    if (x < 0 || z < 0 || x > A.w || z > A.h) {
      x -= off[0];
      z -= off[1];
      S = B;
      W = WB;
    }
    const q = cell(W, x, z),
      key = (S === A ? 'a' : 'b') + q;
    if (key === last) continue;
    last = key;
    const where = `${t.toFixed(1)} m along, in ${S === A ? 'the first' : 'the second'} scene`;
    if (W.blk[q]) walk = `blocked ${where}`;
    const lv = mapgenSceneGround(S, x, z) + (W.S ? W.S[q] / 20 : 0);
    if (lv0 === lv0 && Math.abs(lv - lv0) > 0.34) walk = `a step of ${Math.abs(lv - lv0).toFixed(2)} m ${where}`;
    lv0 = lv;
  }
  return {
    off,
    dhNear: mapgenRound2(dhNear),
    dhBand: mapgenRound2(dhBand),
    raiseExit,
    raiseBand: mapgenRound2(raiseBand),
    walk,
  };
}

/* ---------- TR-1: how a scene's roads climb ---------- */
/** a scene's step grid as the game builds it (walk-view.js stepGrid), or null with no steps */
export function mapgenStepGridOf(sc) {
  if (!sc.steps) return null;
  const u = mapgenDecodeBase64(sc.steps),
    S = new Int16Array(u.buffer, 0, u.length >> 1),
    M = sc.stepm ? mapgenDecodeBase64(sc.stepm) : new Uint8Array(S.length);
  return { w: sc.w * 2, h: sc.h * 2, H: Float32Array.from(S, v => v / 20), M, s: 1, m0: 1 };
}
/** the ground you walk on at (x, z): the land between its corners and the step raise as the game draws it (a ramp
 * cell leaning between its neighbours, walk-view.js stepRaiseAt without the natural edges' shaping) */
export function mapgenWalkHeight(sc, E, x, z) {
  const g = mapgenSceneGround(sc, x, z);
  if (!E) return g;
  const i = mapgenBetween(Math.floor(x * 2), 0, E.w - 1),
    j = mapgenBetween(Math.floor(z * 2), 0, E.h - 1),
    q = j * E.w + i,
    fx = mapgenBetween(x * 2 - i, 0, 1),
    fz = mapgenBetween(z * 2 - j, 0, 1),
    c = (a, b) => stepCornerHeight(E, q, a, b);
  return g + (c(0, 0) * (1 - fx) + c(1, 0) * fx) * (1 - fz) + (c(0, 1) * (1 - fx) + c(1, 1) * fx) * fz;
}
/**
 * TR-1: how the roads of a scene climb, measured along every walk from the hub to an exit (sc.edgeExits' paths)
 * every half metre: jump, the most the ground changes over a metre; grade, the steepest climb over 2 m; side, the
 * tallest wall beside a road (a road cell against a neighbour that is no ramp, out of water); stairs, the
 * stair cells (wall material 8). Each with where it is.
 * @returns {{ jump: number, grade: number, side: number, stairs: number, at: { jump: number[], grade: number[], side: number[] } }}
 */
export function mapgenRoadReport(sc) {
  const E = mapgenStepGridOf(sc),
    out = { jump: 0, grade: 0, side: 0, stairs: 0, at: { jump: [0, 0], grade: [0, 0], side: [0, 0] } },
    worst = (k, v, x, z) => {
      if (v > out[k]) {
        out[k] = v;
        out.at[k] = [mapgenRound2(x), mapgenRound2(z)];
      }
    };
  for (const e of sc.edgeExits || []) {
    const pts = [];
    for (let k = 1; k < e.path.length; k++) {
      const [a, b] = [e.path[k - 1], e.path[k]],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let t = 0; t < L; t += 0.5) pts.push([a[0] + ((b[0] - a[0]) * t) / L, a[1] + ((b[1] - a[1]) * t) / L]);
    }
    const y = pts.map(p => mapgenWalkHeight(sc, E, p[0], p[1]));
    for (let k = 2; k < pts.length; k++) worst('jump', Math.abs(y[k] - y[k - 2]), pts[k - 1][0], pts[k - 1][1]);
    for (let k = 4; k < pts.length; k++) worst('grade', Math.abs(y[k] - y[k - 4]) / 2, pts[k - 2][0], pts[k - 2][1]);
  }
  if (E) {
    const tile = (i, j) => (sc.tiles[sc.h - 1 - (j >> 1)] || '')[i >> 1],
      wet = (i, j) => MAPGEN_WET.includes(tile(i, j)),
      surf = MAPGEN_SURFACES[(sc.gen && sc.gen.params.road.surface) || 'dirt'];
    for (let q = 0; q < E.H.length; q++) {
      if ((E.M[q] & 15) === 8) out.stairs++;
      const i = q % E.w,
        j = (q - i) / E.w;
      if (!(E.M[q] & 32) || tile(i, j) !== surf) continue;
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const ii = i + di,
          jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= E.w || jj >= E.h || E.M[jj * E.w + ii] & 32 || wet(ii, jj)) continue;
        worst('side', Math.abs(E.H[jj * E.w + ii] - E.H[q]), (i + 0.5) / 2, (j + 0.5) / 2);
      }
    }
  }
  out.jump = mapgenRound2(out.jump);
  out.grade = mapgenRound2(out.grade);
  out.side = mapgenRound2(out.side);
  return out;
}
