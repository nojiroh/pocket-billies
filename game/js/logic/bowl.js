// @ts-check
'use strict';
/* ================= THE BOWL (phase 10) =================
   The world map is the lower half of the Hollow Earth: a bowl seen from above, the Inner Sun hanging over its centre.
   A place's spot (locations.json "bowl") is { a, r }: a in degrees counter-clockwise from east seen from above, r from
   0 at the centre of the floor to 1 at the rim. A place reached only by lift sits under another: { under: id }.
   The walkable maps keep their own compass. On the bowl each map turns with the curve: its north faces the centre and
   its east runs counter-clockwise, so the seams between maps line up all the way round (docs/phases/10-world-map-bowl.md).
   Shape (owner, 2026-10-19: only curves inside): a part of a sphere, lowest at the centre and curving up to 45 degrees
   at the rim, where the land ends against the sky (no flat floor, no land beyond the rim).
   Logic only: no DOM, runs in Node. The renderer, the Studio and the tests read the same numbers. */
/** @import { BowlSpot, LocationData } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  BOWL_GROUND_CELLS: [() => BOWL_GROUND_CELLS],
  BOWL_GROUND_EXTENT: [() => BOWL_GROUND_EXTENT],
  BOWL_ISLE_RIM: [() => BOWL_ISLE_RIM],
  BOWL_RELIEF_DEFAULT: [() => BOWL_RELIEF_DEFAULT],
  BOWL_RELIEF_KINDS: [() => BOWL_RELIEF_KINDS],
  BOWL_RELIEF_MAX: [() => BOWL_RELIEF_MAX],
  BOWL_RIM_HEIGHT: [() => BOWL_RIM_HEIGHT],
  BOWL_RIVER_COUNT: [() => BOWL_RIVER_COUNT],
  BOWL_RIVER_CUT: [() => BOWL_RIVER_CUT],
  BOWL_SEA_DEPTH: [() => BOWL_SEA_DEPTH],
  BOWL_SEA_RIM_LAND: [() => BOWL_SEA_RIM_LAND],
  BOWL_SEA_SHARE: [() => BOWL_SEA_SHARE],
  BOWL_SPHERE: [() => BOWL_SPHERE],
  BOWL_SUN_AZIMUTH: [() => BOWL_SUN_AZIMUTH],
  BOWL_SUN_SLANT: [() => BOWL_SUN_SLANT],
  EXIT: [() => EXIT],
  // @ts-expect-error -- replaced on purpose
  bowlBaseHeight: [() => bowlBaseHeight, v => (bowlBaseHeight = v)],
  // @ts-expect-error -- replaced on purpose
  bowlCoastAt: [() => bowlCoastAt, v => (bowlCoastAt = v)],
  // @ts-expect-error -- replaced on purpose
  bowlCoastGrid: [() => bowlCoastGrid, v => (bowlCoastGrid = v)],
  // @ts-expect-error -- replaced on purpose
  bowlCoastNoise: [() => bowlCoastNoise, v => (bowlCoastNoise = v)],
  // @ts-expect-error -- replaced on purpose
  bowlCompass: [() => bowlCompass, v => (bowlCompass = v)],
  // @ts-expect-error -- replaced on purpose
  bowlExitSide: [() => bowlExitSide, v => (bowlExitSide = v)],
  // @ts-expect-error -- replaced on purpose
  bowlGridHeight: [() => bowlGridHeight, v => (bowlGridHeight = v)],
  // @ts-expect-error -- replaced on purpose
  bowlGround: [() => bowlGround, v => (bowlGround = v)],
  // @ts-expect-error -- replaced on purpose
  bowlGroundGrid: [() => bowlGroundGrid, v => (bowlGroundGrid = v)],
  // @ts-expect-error -- replaced on purpose
  bowlHeight: [() => bowlHeight, v => (bowlHeight = v)],
  // @ts-expect-error -- replaced on purpose
  bowlIsles: [() => bowlIsles, v => (bowlIsles = v)],
  // @ts-expect-error -- replaced on purpose
  bowlPaintStroke: [() => bowlPaintStroke, v => (bowlPaintStroke = v)],
  // @ts-expect-error -- replaced on purpose
  bowlRelief: [() => bowlRelief, v => (bowlRelief = v)],
  // @ts-expect-error -- replaced on purpose
  bowlReliefFeatures: [() => bowlReliefFeatures, v => (bowlReliefFeatures = v)],
  // @ts-expect-error -- replaced on purpose
  bowlRivers: [() => bowlRivers, v => (bowlRivers = v)],
  // @ts-expect-error -- replaced on purpose
  bowlRoad: [() => bowlRoad, v => (bowlRoad = v)],
  // @ts-expect-error -- replaced on purpose
  bowlRoll: [() => bowlRoll, v => (bowlRoll = v)],
  // @ts-expect-error -- replaced on purpose
  bowlSeaInput: [() => bowlSeaInput, v => (bowlSeaInput = v)],
  // @ts-expect-error -- replaced on purpose
  bowlSeamTurn: [() => bowlSeamTurn, v => (bowlSeamTurn = v)],
  // @ts-expect-error -- replaced on purpose
  bowlSeedShift: [() => bowlSeedShift, v => (bowlSeedShift = v)],
  // @ts-expect-error -- replaced on purpose
  bowlSpotOf: [() => bowlSpotOf, v => (bowlSpotOf = v)],
  // @ts-expect-error -- replaced on purpose
  bowlSun: [() => bowlSun, v => (bowlSun = v)],
  // @ts-expect-error -- replaced on purpose
  bowlWaterLevel: [() => bowlWaterLevel, v => (bowlWaterLevel = v)],
  // @ts-expect-error -- replaced on purpose
  bowlWetAt: [() => bowlWetAt, v => (bowlWetAt = v)],
  // @ts-expect-error -- replaced on purpose
  bowlWetness: [() => bowlWetness, v => (bowlWetness = v)],
  // @ts-expect-error -- replaced on purpose
  bowlXY: [() => bowlXY, v => (bowlXY = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the flat floor's radius, as a share of the bowl's */
/** the sphere the bowl is part of: its radius, in bowl radii (the slope reaches 45 degrees at the rim) */
export const BOWL_SPHERE = Math.SQRT2;
/** the rim's height above the bowl's lowest point, as a share of its radius */
export const BOWL_RIM_HEIGHT = BOWL_SPHERE - 1;

/** the ground's height at r (0 centre to 1 rim): a curve all the way, no flat part @param {number} r
 * @returns {number} */
export function bowlHeight(r) {
  const k = Math.min(1, Math.abs(r));
  return BOWL_SPHERE - Math.sqrt(BOWL_SPHERE * BOWL_SPHERE - k * k);
}

/** a spot's place seen from above, x east and y north of the bowl @param {number} a @param {number} r
 * @returns {[number, number]} */
export function bowlXY(a, r) {
  const w = (a * Math.PI) / 180;
  return [r * Math.cos(w), r * Math.sin(w)];
}

/** a place's spot, following "under" to the place it hangs below (and how many levels it went down)
 * @param {LocationData} place @param {(id: string) => LocationData | undefined} byId
 * (RL-8b: and its up and off, when it has them) @returns {{ a: number, r: number, under: number, up?: number, off?: boolean }} */
export function bowlSpotOf(place, byId) {
  /** @type {BowlSpot} */
  let s = place.bowl,
    under = 0;
  while ('under' in s) {
    const p = byId(s.under);
    if (!p || ++under > 4) throw new Error(`${place.id}: its bowl spot hangs under ${s.under}, which has none`);
    s = p.bowl;
  }
  const o = /** @type {{ a: number, r: number, under: number, up?: number, off?: boolean }} */ ({
    a: s.a,
    r: s.r,
    under,
  });
  if ('up' in s && typeof s.up === 'number') o.up = s.up;
  if ('off' in s && s.off) o.off = true;
  return o;
}

/** a point on the ground: [x east, y north, h up] @param {number} x @param {number} y
 * @returns {[number, number, number]} */
export function bowlGround(x, y) {
  return [x, y, bowlHeight(Math.hypot(x, y))];
}

/** a map's compass where it sits on the bowl: its north faces the centre, its east runs counter-clockwise. Unit
 * vectors seen from above. At the very centre north is the bowl's north. RL-8b: a spot's up (degrees, 90 the bowl's
 * north) turns its north that way instead (a run's places all face the bowl's north)
 * @param {number} x @param {number} y @param {number} [up]
 * @returns {{ north: [number, number], east: [number, number] }} */
export function bowlCompass(x, y, up) {
  const r = Math.hypot(x, y),
    u = typeof up === 'number' ? (up * Math.PI) / 180 : null;
  /** @type {[number, number]} */
  const north = u !== null ? [Math.cos(u), Math.sin(u)] : r < 1e-6 ? [0, 1] : [-x / r, -y / r];
  return { north, east: [north[1], -north[0]] };
}

/** @type {Record<string, [number, number]>} */
export const EXIT = { east: [1, 0], west: [-1, 0], north: [0, 1], south: [0, -1] };
/** a map exit's side, without its number ('south2' is on the south side) @param {string} exit
 * @returns {[number, number]} */
export function bowlExitSide(exit) {
  const v = EXIT[exit.replace(/\d+$/, '')];
  if (!v) throw new Error(`no such map side: ${exit}`);
  return v;
}

/** how far, in degrees, a seam on the bowl turns from its two exits: 0 when the road leaves A the way A's exit
 * faces and reaches B the way B's exit faces back. The compass is taken at the road's midpoint (RL-8b: or turned
 * to up, as both places' maps are) @param {[number, number]} A @param {[number, number]} B @param {string} exitA
 * @param {string} exitB @param {number} [up]
 * @returns {number} */
export function bowlSeamTurn(A, B, exitA, exitB, up) {
  const sa = bowlExitSide(exitA),
    sb = bowlExitSide(exitB);
  let dx = sa[0] - sb[0],
    dy = sa[1] - sb[1];
  const n = Math.hypot(dx, dy) || 1;
  dx /= n;
  dy /= n;
  const { north, east } = bowlCompass((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, up),
    want = [dx * east[0] + dy * north[0], dx * east[1] + dy * north[1]],
    ex = B[0] - A[0],
    ey = B[1] - A[1],
    len = Math.hypot(ex, ey) || 1,
    c = (ex * want[0] + ey * want[1]) / len;
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}

/** a road on the ground between two spots seen from above: points [x, y, h] along it, and its length over the
 * ground (in bowl radii) @param {[number, number]} A @param {[number, number]} B @param {number} [steps]
 * @returns {{ pts: [number, number, number][], length: number }} */
export function bowlRoad(A, B, steps = 24) {
  /** @type {[number, number, number][]} */
  const pts = [];
  let length = 0;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps,
      p = bowlGround(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t);
    if (k) {
      const q = pts[k - 1];
      length += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    }
    pts.push(p);
  }
  return { pts, length };
}

/* ---------- the ground's relief (phase 10, session E-map-4) ----------
   Gentle and readable (owner, 2026-10-19): low hills and dips, a few clear landmarks (the peak by Frostcrown, the
   volcano, the canyon cut, the trench), never tall enough to hide a pin. Each place shapes the ground around it by its
   kind (locations.json "t"): a bump or a dip, [height, reach], both in bowl radii. Places reached by lift add nothing. */
/** @type {Record<string, [number, number]>} */
/* (the look, session 2: about 40% taller than E-map-4's gentle relief, for the living diorama's strong relief) */
export const BOWL_RELIEF_KINDS = {
  summit: [0.105, 0.11],
  pass: [0.063, 0.08],
  ridge: [0.05, 0.08],
  volcano: [0.09, 0.07],
  canyon: [-0.042, 0.05],
  sea: [-0.03, 0.12],
  island: [-0.012, 0.07],
  lake: [-0.022, 0.06],
  pond: [-0.014, 0.05],
  trench: [-0.05, 0.07],
  spire: [0.042, 0.06],
  sun: [0.042, 0.06],
  vault: [0.025, 0.07],
  silicon: [0.02, 0.06],
  spore: [0.014, 0.07],
};
/** a rolling bump for every other kind */
export const BOWL_RELIEF_DEFAULT = /** @type {[number, number]} */ ([0.008, 0.06]);
/** the most the relief may add or take, so pins and roads stay readable */
export const BOWL_RELIEF_MAX = 0.115;

/** @typedef {{ x: number, y: number, h: number, r: number }} BowlFeature */
/** RL-8b: where a world's seed moves the bowl's noise to (a run's own hills, patches and trees; 0: as made) @param {number} seed
 * @returns {[number, number]} */
export function bowlSeedShift(seed) {
  const s = Math.abs(Math.round(seed || 0)) % 9973;
  return s ? [(s % 997) * 1.731 + 11.3, (s % 991) * 2.377 + 7.9] : [0, 0];
}
/** @typedef {{ max: number, default: [number, number], kinds: Record<string, [number, number]> }} BowlReliefLook */
/** each place's bump or dip, from the world map's look (worldmap.json relief; without it the values above); RL-8b: a
 * world's seed moves the hills between them (bowlSeedShift)
 * @param {LocationData[]} places @param {BowlReliefLook | null} [R] @param {number} [seed]
 * @returns {BowlFeature[] & { max?: number, seed?: number }} */
export function bowlReliefFeatures(places, R = null, seed = 0) {
  const byId = (/** @type {string} */ id) => places.find(p => p.id === id),
    kinds = R ? R.kinds : BOWL_RELIEF_KINDS,
    def = R ? R.default : BOWL_RELIEF_DEFAULT;
  /** @type {BowlFeature[] & { max?: number, seed?: number }} */
  const out = [];
  out.max = R ? R.max : BOWL_RELIEF_MAX;
  out.seed = seed;
  for (const p of places) {
    if (!p.bowl || 'under' in p.bowl || p.bowl.off) continue;
    const s = bowlSpotOf(p, byId),
      [x, y] = bowlXY(s.a, s.r),
      [h, r] = /** @type {Record<string, [number, number]>} */ (kinds)[p.t] || def;
    out.push({ x, y, h, r });
  }
  return out;
}
/** a small deterministic roll so open ground isn't flat (value noise on a coarse lattice) @param {number} x
 * @param {number} y */
export function bowlRoll(x, y) {
  const hash = (/** @type {number} */ i, /** @type {number} */ j) => {
      const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
      return s - Math.floor(s);
    },
    u = x * 9,
    v = y * 9,
    i = Math.floor(u),
    j = Math.floor(v),
    fu = u - i,
    fv = v - j,
    a = hash(i, j),
    b = hash(i + 1, j),
    c = hash(i, j + 1),
    d = hash(i + 1, j + 1);
  return (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv - 0.5;
}
/** the relief at a point: the places' bumps and dips, a little roll, kept within BOWL_RELIEF_MAX and fading out
 * beyond the rim @param {BowlFeature[]} F @param {number} x @param {number} y */
export function bowlRelief(F, x, y) {
  const max = /** @type {BowlFeature[] & { max?: number }} */ (F).max ?? BOWL_RELIEF_MAX,
    [ox, oy] = bowlSeedShift(/** @type {BowlFeature[] & { seed?: number }} */ (F).seed || 0);
  let h = 0;
  for (const f of F) {
    const d2 = ((x - f.x) ** 2 + (y - f.y) ** 2) / (f.r * f.r);
    if (d2 < 9) h += f.h * Math.exp(-d2);
  }
  /* broad hills and dales between the places, and a little roll on them */
  h += bowlRoll(x / 3.2 + ox, y / 3.2 + oy) * 0.032 + bowlRoll(x + ox, y + oy) * 0.009;
  const r = Math.hypot(x, y),
    fade = r <= 1 ? 1 : Math.max(0, 1 - (r - 1) / 0.08);
  return Math.max(-max, Math.min(max, h)) * fade || 0;
}

/* ---------- the ground as a grid ----------
   The map draws the ground as a low-poly mesh over a square grid (two triangles a cell, split from the cell's
   south-west to its north-east corner); the camera, the pins and a tap read the height the same way, so everything
   agrees with what is drawn. Beyond the rim the land runs on flat for a short way. */
/** the grid: heights, and with a sea the coast (c, below 0 land), the rivers (flow per corner, their courses as
 * points) and how wet the land is (wet, 1 at the water to 0 far from it)
 * @typedef {{ n: number, e: number, h: Float32Array, c?: Float32Array, flow?: Uint8Array,
 *   rivers?: [number, number][][], wet?: Float32Array }} BowlGround */
/** how far the grid reaches from the centre (the rim: the land ends there) and its cells across */
export const BOWL_GROUND_EXTENT = 1;
export const BOWL_GROUND_CELLS = 320;
/** the ground's height with no relief: the bowl inside the rim, flat land beyond @param {number} x @param {number} y */
export function bowlBaseHeight(x, y) {
  const r = Math.hypot(x, y);
  return r <= 1 ? bowlHeight(r) : BOWL_RIM_HEIGHT;
}
/** the grid's heights for these features, and with a sea its coast (logic below) @param {BowlFeature[]} F
 * @param {number} [n] cells across @param {BowlSeaInput | null} [sea] @returns {BowlGround} */
export function bowlGroundGrid(F, n = BOWL_GROUND_CELLS, sea = null) {
  const e = BOWL_GROUND_EXTENT,
    w = n + 1,
    h = new Float32Array(w * w),
    coast = sea ? bowlCoastGrid(sea, n) : null,
    c = coast ? coast.c : null,
    depth = (sea && sea.opt && sea.opt.depth) || BOWL_SEA_DEPTH,
    [ox, oy] = bowlSeedShift(/** @type {BowlFeature[] & { seed?: number }} */ (F).seed || 0);
  for (let j = 0; j <= n; j++)
    for (let i = 0; i <= n; i++) {
      const x = -e + (2 * e * i) / n,
        y = -e + (2 * e * j) / n;
      let rel = bowlRelief(F, x, y);
      if (c) {
        /* the land comes down to the water's edge, the sea floor falls away from it */
        /* high land meets the sea as a cliff (it keeps its height almost to the edge), low land slopes to a beach */
        /* some stretches of coast are headlands: the land stands up there and drops to the sea as a cliff */
        const head = Math.min(1, Math.max(0, (bowlRoll(x / 2.2 + 5.3 + ox, y / 2.2 - 1.7 + oy) + 0.08) * 5));
        if (c[j * w + i] <= 0) rel += head * 0.024;
        /* and land never sinks below the water (that would be a dry pit): its dips flatten out into low ground */
        if (rel < 0.004) rel = 0.004 * Math.exp((rel - 0.004) / 0.004);
        const k = c[j * w + i],
          fadeW = 0.03 - 0.026 * Math.max(head, Math.min(1, Math.max(0, (rel - 0.015) / 0.03)));
        rel = k > 0 ? -Math.min(depth, 0.004 + k * 0.5) : rel * Math.min(1, -k / fadeW) + 0.0015;
      }
      h[j * w + i] = bowlBaseHeight(x, y) + rel;
    }
  if (!coast) return { n, e, h };
  const G = { n, e, h, c: coast.c };
  bowlRivers(G, coast.dp);
  bowlWetness(G);
  return G;
}

/* ---------- rivers (the look, session 2) ----------
   From the high ground down to the sea. The way down is found by flooding the land from the sea upward, lowest first
   (a priority flood): each square learns the square it drains into, so every course runs downhill (pits filled) and
   ends in the sea. Courses keep out of the places' own ground if they can (a heavy toll for crossing it). Up to
   BOWL_RIVER_COUNT springs, the highest first, spaced apart, each at least a few squares from the sea; a river that
   meets another joins it. Each course is cut a little into the ground and made to fall all the way. */
export const BOWL_RIVER_COUNT = 10;
/** how deep a river cuts into the ground, in bowl radii */
export const BOWL_RIVER_CUT = 0.002;
/** @param {BowlGround} G @param {Float32Array} dp distance past the nearest place's ground (below 0 inside it) */
export function bowlRivers(G, dp) {
  const { n, e, h } = G,
    c = /** @type {Float32Array} */ (G.c),
    w = n + 1,
    N = w * w,
    at = (/** @type {number} */ k) => [-e + (2 * e * (k % w)) / n, -e + (2 * e * Math.floor(k / w)) / n],
    rOf = (/** @type {number} */ k) => Math.hypot(...at(k)),
    land = new Uint8Array(N),
    pri = new Float32Array(N).fill(Infinity),
    down = new Int32Array(N).fill(-1),
    /* a binary heap of squares by priority */
    heap = new Int32Array(N),
    hp = new Float32Array(N),
    /* heights above the water's level: things fall towards the shell, so "downhill" is towards the bowl's curve */
    rel = new Float32Array(N);
  for (let k = 0; k < N; k++) rel[k] = h[k] - bowlHeight(Math.min(1, rOf(k)));
  let size = 0;
  const push = (/** @type {number} */ k, /** @type {number} */ p) => {
      let i = size++;
      while (i > 0) {
        const up = (i - 1) >> 1;
        if (hp[up] <= p) break;
        heap[i] = heap[up];
        hp[i] = hp[up];
        i = up;
      }
      heap[i] = k;
      hp[i] = p;
    },
    pop = () => {
      const top = heap[0],
        k = heap[--size],
        p = hp[size];
      let i = 0;
      for (;;) {
        let m = 2 * i + 1;
        if (m >= size) break;
        if (m + 1 < size && hp[m + 1] < hp[m]) m++;
        if (hp[m] >= p) break;
        heap[i] = heap[m];
        hp[i] = hp[m];
        i = m;
      }
      heap[i] = k;
      hp[i] = p;
      return top;
    };
  for (let k = 0; k < N; k++) {
    const r = rOf(k);
    if (r > 0.985) continue;
    if (c[k] > 0) {
      pri[k] = rel[k];
      push(k, rel[k]);
    } else land[k] = 1;
  }
  const nb = [1, -1, w, -w, w + 1, w - 1, -w + 1, -w - 1];
  while (size) {
    const k = pop(),
      i = k % w;
    for (const d of nb) {
      const q = k + d,
        qi = q % w;
      if (q < 0 || q >= N || Math.abs(qi - i) > 1 || !land[q] || pri[q] !== Infinity) continue;
      pri[q] =
        Math.max(rel[q], pri[k] + 2e-5) +
        (dp[q] < 0.008 ? 1 : 0); /* the small step: across flats the shortest way down */
      down[q] = k;
      push(q, pri[q]);
    }
  }
  /* springs: the highest land first, away from the places and from each other, far enough from the sea */
  const order = [];
  for (let k = 0; k < N; k++) if (land[k] && down[k] >= 0 && dp[k] > 0.015) order.push(k);
  const relOf = (/** @type {number} */ k) => rel[k];
  order.sort((a, b) => relOf(b) - relOf(a));
  const flow = new Uint8Array(N),
    /** @type {number[][]} */ courses = [],
    springs = [];
  for (const k of order) {
    if (courses.length >= BOWL_RIVER_COUNT || relOf(k) < 0.008) break;
    const [x, y] = at(k);
    if (springs.some(([sx, sy]) => Math.hypot(x - sx, y - sy) < 0.13) || flow[k]) continue;
    const path = [];
    let q = k,
      onRiver = false;
    while (q >= 0 && land[q]) {
      path.push(q);
      if (flow[q]) onRiver = true;
      q = down[q];
    }
    if (q >= 0) path.push(q); /* the mouth: the first square of sea */
    const own = onRiver ? path.findIndex(p => flow[p]) : path.length;
    /* not too short, not wandering for long across flats, clear of the places' ground and of the rim */
    if (own < 14 || path.length > 90 || path.some(p => (land[p] && dp[p] < 0) || rOf(p) > 0.94)) continue;
    springs.push([x, y]);
    for (const p of path) if (land[p]) flow[p] = Math.min(255, flow[p] + 1);
    courses.push(path);
  }
  /* cut the beds once, then make each course fall all the way */
  for (let k = 0; k < N; k++)
    if (flow[k]) {
      h[k] -= BOWL_RIVER_CUT;
      rel[k] -= BOWL_RIVER_CUT;
    }
  for (const path of courses) {
    let last = Infinity;
    for (const p of path) {
      if (rel[p] > last - 1e-6) {
        h[p] -= rel[p] - (last - 1e-6);
        rel[p] = last - 1e-6;
      }
      last = rel[p];
    }
  }
  G.flow = flow;
  G.rivers = courses.map(path => path.map(k => /** @type {[number, number]} */ (at(k))));
}
/** how wet the land is: 1 at the sea or a river, falling off over about ten squares @param {BowlGround} G */
export function bowlWetness(G) {
  const { n, c, flow } = G,
    w = n + 1,
    N = w * w,
    d = new Float32Array(N).fill(1e9),
    queue = new Int32Array(N);
  let head = 0,
    tail = 0;
  for (let k = 0; k < N; k++)
    if ((c && c[k] > 0) || (flow && flow[k])) {
      d[k] = 0;
      queue[tail++] = k;
    }
  while (head < tail) {
    const k = queue[head++],
      i = k % w;
    for (const q of [k + 1, k - 1, k + w, k - w]) {
      if (q < 0 || q >= N || Math.abs((q % w) - i) > 1 || d[q] <= d[k] + 1) continue;
      d[q] = d[k] + 1;
      queue[tail++] = q;
    }
  }
  const wet = new Float32Array(N);
  for (let k = 0; k < N; k++) wet[k] = Math.exp(-d[k] / 10);
  G.wet = wet;
}
/** how wet the land is at a point (0 without a sea) @param {BowlGround} G @param {number} x @param {number} y */
export function bowlWetAt(G, x, y) {
  return G.wet ? bowlGridHeight({ n: G.n, e: G.e, h: G.wet }, x, y) : 0;
}

/* ---------- the light (the look, session 2; owner chose A: the Inner Sun circles off the centre) ----------
   The light comes in slanted from where the Inner Sun is drawn, so hills shade on one side and cast shadows. Today it
   stands still at BOWL_SUN_AZIMUTH; session 3 moves it with the game's time of day. */
export const BOWL_SUN_SLANT = 40;
export const BOWL_SUN_AZIMUTH = 135;
/** the light's direction (towards the sun) and where the sun hangs, seen from the bowl: [x east, y north, h up]
 * @param {number} [az] degrees counter-clockwise from east @param {number} [slant] degrees from straight down */
export function bowlSun(az = BOWL_SUN_AZIMUTH, slant = BOWL_SUN_SLANT) {
  const a = (az * Math.PI) / 180,
    t = (slant * Math.PI) / 180,
    dir = /** @type {[number, number, number]} */ ([Math.sin(t) * Math.cos(a), Math.sin(t) * Math.sin(a), Math.cos(t)]);
  /* inside the hollow sphere, above the floor: from a point a little over the centre, out along the light */
  const at = /** @type {[number, number, number]} */ ([dir[0] * 1.15, dir[1] * 1.15, 0.15 + dir[2] * 1.15]);
  return { dir, at };
}

/* ---------- the sea (session 1 of the look, 2026-10-19: an inland sea with bays, about 40% of the bowl) ----------
   In the Hollow Earth things fall towards the shell, so water lies on the bowl's curve: the sea's surface is the bowl
   itself (bowlHeight), the land rises above it and the sea floor sinks below. Where the sea is comes from the places
   and the roads: land round every place (out past its walk map's corners) and along every road, the rest of the bowl
   sea, its coast roughened by a little noise, the line drawn so about BOWL_SEA_SHARE of the bowl is water. So the open
   side of the bowl becomes a sea and bays reach in between the regions; no place and no road is ever under water. */
export const BOWL_SEA_SHARE = 0.4;
/** how deep the sea floor goes below the water, in bowl radii */
export const BOWL_SEA_DEPTH = 0.035;
/** how strongly the land rises towards the rim (so the sea is an inland sea, not a ring round the edge) */
export const BOWL_SEA_RIM_LAND = 0.45;
/** the sea's settings (worldmap.json sea): share before painting, floor depth, the rise towards the rim, coast
 * roughness and seed, brush strokes forcing land or sea
 * @typedef {{ share: number, depth: number, rimLand: number, rough: number, seed: number, island?: number,
 *   isles?: BowlIsle[], paint?: { land: boolean, r: number, pts: [number, number][] }[] }} BowlSeaLook */
/** RL-8b: a round of land the sea leaves alone (bowl radii, seen from above) @typedef {{ x: number, y: number, r: number }} BowlIsle */
/** RL-8b, an island world: past this far from the centre the sea always wins, so the land never reaches the rim */
export const BOWL_ISLE_RIM = 0.86;
/** @typedef {{ places: { x: number, y: number, reach: number }[], roads: [number, number, number, number][],
 *   opt?: BowlSeaLook }} BowlSeaInput */
/** the land the sea must leave alone: each place with its walk map's half-diagonal (w, h in metres, BOWL_METRES to the
 * radius), and each road @param {LocationData[]} places @param {[number, number][]} roads pairs of place numbers
 * @param {(p: LocationData) => { w: number, h: number } | null} mapOf @param {number} [metres]
 * @returns {BowlSeaInput} */
export function bowlSeaInput(places, roads, mapOf, metres = 1000, opt = null) {
  const byId = (/** @type {string} */ id) => places.find(p => p.id === id),
    at = places.map(p => {
      const s = bowlSpotOf(p, byId);
      /* RL-8b: a place off this world's map (Copperleaf in a run) keeps no land, as one hung under another */
      return { xy: bowlXY(s.a, s.r), under: s.under || (s.off ? 1 : 0) };
    });
  return {
    places: places
      .map((p, i) => {
        const m = mapOf(p),
          half = m ? Math.hypot(m.w, m.h) / 2 / metres : 0.06;
        return at[i].under ? null : { x: at[i].xy[0], y: at[i].xy[1], reach: half + 0.012 };
      })
      .filter(o => o !== null),
    roads: roads
      .filter(([a, b]) => at[a] && at[b] && !at[a].under && !at[b].under)
      .map(([a, b]) => [at[a].xy[0], at[a].xy[1], at[b].xy[0], at[b].xy[1]]),
    opt: opt || undefined,
  };
}
/** the coast's roughness: a few octaves of the same value noise as the roll */
export function bowlCoastNoise(/** @type {number} */ x, /** @type {number} */ y) {
  return bowlRoll(x / 4.5, y / 4.5) * 0.16 + bowlRoll(x / 1.5, y / 1.5) * 0.06 + bowlRoll(x * 1.8, y * 1.8) * 0.018;
}
/** the coast on the ground's grid: per corner, below 0 land, above 0 sea, about BOWL_SEA_SHARE of the bowl at sea,
 * every place's ground and every road on land. How far a corner is from being land: its distance past the nearest
 * place's ground or road, plus the coast's noise; the line is then drawn at the share's quantile.
 * RL-8b, an island world (sea.island above 0, or sea.isles given): no share and no rise toward the rim; the land is
 * the places' ground, the roads and rounds of land (sea.isles, or one of radius sea.island round the places' middle),
 * the coast where the distance past them plus the noise crosses 0, and the sea always past BOWL_ISLE_RIM.
 * Also how far each corner is past the nearest place's ground (dp, below 0 inside it).
 * @param {BowlSeaInput} S @param {number} n @returns {{ c: Float32Array, dp: Float32Array }} */
export function bowlCoastGrid(S, n) {
  const e = BOWL_GROUND_EXTENT,
    w = n + 1,
    raw = new Float32Array(w * w),
    keep = new Float32Array(w * w),
    dpg = new Float32Array(w * w),
    inside = new Float32Array(w * w),
    /* flat arrays: the loop below runs about 100 000 corners times 100 places and roads */
    P = Float64Array.from(S.places.flatMap(p => [p.x, p.y, p.reach])),
    R = Float64Array.from(S.roads.flatMap(([ax, ay, bx, by]) => [ax, ay, bx - ax, by - ay])),
    np = P.length,
    nr = R.length,
    o = S.opt || null,
    share = o ? o.share : BOWL_SEA_SHARE,
    rimLand = o ? o.rimLand : BOWL_SEA_RIM_LAND,
    rough = o ? o.rough : 1,
    seed = o ? o.seed : 0,
    isles = bowlIsles(S),
    I = Float64Array.from((isles || []).flatMap(b => [b.x, b.y, b.r])),
    ni = I.length;
  let count = 0;
  for (let j = 0; j <= n; j++)
    for (let i = 0; i <= n; i++) {
      const x = -e + (2 * e * i) / n,
        y = -e + (2 * e * j) / n;
      let dp = 81,
        dr = 81;
      for (let k = 0; k < np; k += 3) {
        const dx = x - P[k],
          dy = y - P[k + 1],
          q = Math.sqrt(dx * dx + dy * dy) - P[k + 2];
        if (q < dp) dp = q;
      }
      for (let k = 0; k < nr; k += 4) {
        const vx = R[k + 2],
          vy = R[k + 3],
          ux = x - R[k],
          uy = y - R[k + 1];
        let t = (ux * vx + uy * vy) / (vx * vx + vy * vy || 1);
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = ux - vx * t,
          dy = uy - vy * t,
          q = dx * dx + dy * dy;
        if (q < dr) dr = q;
      }
      dr = Math.sqrt(dr) - 0.022;
      const rr = Math.sqrt(x * x + y * y);
      let v;
      if (isles) {
        /* RL-8b: an island world: land within the rounds and round the places, sea toward the rim */
        let di = 81;
        for (let k = 0; k < ni; k += 3) {
          const dx = x - I[k],
            dy = y - I[k + 1],
            q = Math.sqrt(dx * dx + dy * dy) - I[k + 2];
          if (q < di) di = q;
        }
        v =
          Math.min(dp, dr, di) +
          0.02 +
          bowlCoastNoise(x + seed * 3.17, y - seed * 1.93) * rough +
          Math.max(0, rr - BOWL_ISLE_RIM) * 4;
      } else
        /* the land rises towards the rim, so the continent wraps round the sea and the sea stays inland */
        v =
          Math.min(dp, dr) +
          0.02 +
          bowlCoastNoise(x + seed * 3.17, y - seed * 1.93) * rough -
          rimLand * Math.max(0, (rr - 0.8) / 0.2);
      raw[j * w + i] = v;
      keep[j * w + i] = Math.min(dp, dr);
      dpg[j * w + i] = dp;
      if (x * x + y * y <= 1) inside[count++] = v;
    }
  const sorted = isles ? null : inside.subarray(0, count).sort(),
    T = sorted ? sorted[Math.min(count - 1, Math.floor(count * (1 - share)))] : 0,
    c = new Float32Array(w * w);
  for (let k = 0; k < w * w; k++) c[k] = raw[k] - T;
  /* brush strokes (the Studio's land and sea brush): the line is drawn first, so painting moves only what it touches */
  for (const st of (o && o.paint) || []) bowlPaintStroke(c, n, e, st);
  for (let k = 0; k < w * w; k++) c[k] = Math.min(c[k], keep[k] - 0.004);
  return { c, dp: dpg };
}
/** RL-8b: an island world's rounds of land (sea.isles as given, or one of radius sea.island round the middle of the
 * places), null when the world isn't an island world @param {BowlSeaInput} S @returns {BowlIsle[] | null} */
export function bowlIsles(S) {
  const o = S.opt || null;
  if (o && o.isles && o.isles.length) return o.isles;
  const r = (o && o.island) || 0;
  if (!(r > 0)) return null;
  const n = S.places.length || 1,
    x = S.places.reduce((a, p) => a + p.x, 0) / n,
    y = S.places.reduce((a, p) => a + p.y, 0) / n;
  return [{ x, y, r }];
}
/** one brush stroke on the coast: within r of its line land (below 0) or sea (above 0), softly at the edge
 * @param {Float32Array} c @param {number} n @param {number} e @param {{ land: boolean, r: number, pts: [number, number][] }} st */
export function bowlPaintStroke(c, n, e, st) {
  const w = n + 1,
    P = st.pts,
    r = st.r,
    want = st.land ? -0.03 : 0.03;
  let x0 = 9,
    y0 = 9,
    x1 = -9,
    y1 = -9;
  for (const [x, y] of P) {
    x0 = Math.min(x0, x - r);
    y0 = Math.min(y0, y - r);
    x1 = Math.max(x1, x + r);
    y1 = Math.max(y1, y + r);
  }
  const i0 = Math.max(0, Math.floor(((x0 + e) / (2 * e)) * n)),
    i1 = Math.min(n, Math.ceil(((x1 + e) / (2 * e)) * n)),
    j0 = Math.max(0, Math.floor(((y0 + e) / (2 * e)) * n)),
    j1 = Math.min(n, Math.ceil(((y1 + e) / (2 * e)) * n));
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const x = -e + (2 * e * i) / n,
        y = -e + (2 * e * j) / n;
      let d = 9;
      for (let q = 0; q < P.length; q++) {
        const [ax, ay] = P[q],
          [bx, by] = P[Math.min(P.length - 1, q + 1)],
          vx = bx - ax,
          vy = by - ay,
          t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1)));
        d = Math.min(d, Math.hypot(x - ax - vx * t, y - ay - vy * t));
      }
      if (d >= r) continue;
      const k = j * w + i,
        f = Math.min(1, (r - d) / (r * 0.5));
      c[k] = st.land ? Math.min(c[k], c[k] + (want - c[k]) * f) : Math.max(c[k], c[k] + (want - c[k]) * f);
    }
}
/** the coast at a point, read from the grid like the heights @param {BowlGround} G @param {number} x @param {number} y */
export function bowlCoastAt(G, x, y) {
  if (!G.c) return -1;
  return bowlGridHeight({ n: G.n, e: G.e, h: G.c }, x, y);
}
/** the water's surface at a point: the bowl's own curve @param {number} x @param {number} y */
export function bowlWaterLevel(x, y) {
  return bowlHeight(Math.min(1, Math.hypot(x, y)));
}
/** the height of the drawn ground at a point (the triangle it falls in) @param {BowlGround} G @param {number} x
 * @param {number} y */
export function bowlGridHeight(G, x, y) {
  const { n, e, h } = G,
    u = Math.max(0, Math.min(n - 1e-9, ((x + e) / (2 * e)) * n)),
    v = Math.max(0, Math.min(n - 1e-9, ((y + e) / (2 * e)) * n)),
    i = Math.floor(u),
    j = Math.floor(v),
    fu = u - i,
    fv = v - j,
    w = n + 1,
    a = h[j * w + i],
    b = h[j * w + i + 1],
    c = h[(j + 1) * w + i],
    d = h[(j + 1) * w + i + 1];
  /* split along the diagonal from (i, j) to (i + 1, j + 1) */
  return fu >= fv ? a + (b - a) * fu + (d - b) * fv : a + (d - c) * fu + (c - a) * fv;
}
