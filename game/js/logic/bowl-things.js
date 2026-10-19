// @ts-check
'use strict';
/* ================= THE BOWL'S THINGS: LANDMARKS, BUILDINGS, TREES (phase 10, the look, session 4) =================
   Owner's answers (2026-10-19): far out one landmark per place as a pixel-art standee (its own picture, upright);
   close in each town's real buildings and trees from its walk map, drawn about three times their size like a board
   game (BOWL_THING_SCALE); between places clumps of trees in each region's kinds where the land suits them.
   Logic only: no DOM, runs in Node; world-bowl.js draws with it. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  BOWL_BUILDING_GROUP: [() => BOWL_BUILDING_GROUP],
  BOWL_REGION_TREES: [() => BOWL_REGION_TREES],
  BOWL_THING_SCALE: [() => BOWL_THING_SCALE],
  BOWL_TREE_KEY: [() => BOWL_TREE_KEY],
  BOWL_TREE_STYLES: [() => BOWL_TREE_STYLES],
  // @ts-expect-error -- replaced on purpose
  bowlArtSize: [() => bowlArtSize, v => (bowlArtSize = v)],
  // @ts-expect-error -- replaced on purpose
  bowlClumps: [() => bowlClumps, v => (bowlClumps = v)],
  // @ts-expect-error -- replaced on purpose
  bowlLandmarkPick: [() => bowlLandmarkPick, v => (bowlLandmarkPick = v)],
  // @ts-expect-error -- replaced on purpose
  bowlMapPoint: [() => bowlMapPoint, v => (bowlMapPoint = v)],
  // @ts-expect-error -- replaced on purpose
  bowlMapTurn: [() => bowlMapTurn, v => (bowlMapTurn = v)],
  // @ts-expect-error -- replaced on purpose
  bowlPropClass: [() => bowlPropClass, v => (bowlPropClass = v)],
  // @ts-expect-error -- replaced on purpose
  bowlThingHash: [() => bowlThingHash, v => (bowlThingHash = v)],
  // @ts-expect-error -- replaced on purpose
  bowlTreeStyle: [() => bowlTreeStyle, v => (bowlTreeStyle = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** how much bigger buildings and trees are drawn than they are (owner: "bigger buildings", about 3x) */
export const BOWL_THING_SCALE = 3;
/** @typedef {{ img?: string, ox?: number, oy?: number, box?: number[], build?: object, door?: object,
 *   room?: object, group?: string, landmark?: number, model?: string, tags?: string[] }} BowlPropArt */
/** @typedef {{ k: string, x: number, z: number, s?: number, rot?: number, f?: number }} BowlMapProp */

/** a point of a walk map on the bowl: the map sits with its north to the centre, its east counter-clockwise (as the
 * terrain stamps it). mx east and mz north in metres from the map's south-west corner.
 * @param {{ x: number, y: number }} spot @param {{ w: number, h: number }} map @param {number} mx @param {number} mz
 * @param {number} [metres] @returns {[number, number]} */
export function bowlMapPoint(spot, map, mx, mz, metres = 1000) {
  const r = Math.hypot(spot.x, spot.y),
    north = r < 1e-6 ? [0, 1] : [-spot.x / r, -spot.y / r],
    east = [north[1], -north[0]],
    u = (mx - map.w / 2) / metres,
    v = (mz - map.h / 2) / metres;
  return [spot.x + east[0] * u + north[0] * v, spot.y + east[1] * u + north[1] * v];
}
/** the turn of a walk map on the bowl (radians, counter-clockwise from the bowl's own east to the map's east)
 * @param {{ x: number, y: number }} spot */
export function bowlMapTurn(spot) {
  const r = Math.hypot(spot.x, spot.y);
  return r < 1e-6 ? 0 : Math.atan2(spot.x / r, -spot.y / r);
}

export const BOWL_BUILDING_GROUP =
  /house|shop|apartment|townhouse|tower|hall|inn|bank|library|clinic|school|barn|lab|market|cottage|chalet|villa|mansion|lodge|station|greenhouse|bakery|mill|office|dome|hut|plant|press|stage|church|temple/;
export const BOWL_TREE_KEY = /^(tree_|bush_|palm|mushroom|cactus|dry_bush|solar_tree)/;
/** what a prop is on the world map: a tree, a building, or nothing to draw
 * @param {string} k @param {BowlPropArt | undefined} art @returns {'tree' | 'building' | null} */
export function bowlPropClass(k, art) {
  if (!art) return null;
  if (BOWL_TREE_KEY.test(k) && !/fallen|stump|log/.test(k) && !art.landmark) return 'tree';
  const box = art.box || [0, 0],
    area = (box[0] || 0) * (box[1] || 0);
  if (art.build || art.door || art.room) return 'building';
  if (area >= 4.5 && BOWL_BUILDING_GROUP.test(art.group || k)) return 'building';
  return null;
}
/** how big a prop's picture is, from its anchor (pixels: half-width times height); for picking the landmark */
export function bowlArtSize(/** @type {BowlPropArt} */ art) {
  return Math.abs(art.ox || 20) * 2 * Math.abs(art.oy || 40);
}
/** a place's landmark: its own choice (locations.json "landmark", a prop key), else the biggest landmark prop in its
 * walk map, else its biggest building; null when it has neither (open routes keep their pin)
 * @param {{ landmark?: string } | undefined} place @param {{ props?: BowlMapProp[] } | undefined} map
 * @param {Record<string, BowlPropArt>} art @returns {BowlMapProp | null} */
export function bowlLandmarkPick(place, map, art) {
  const props = (map && map.props) || [];
  if (place && place.landmark) {
    const own = props.find(p => p.k === place.landmark);
    if (own) return own;
    if (art[place.landmark]) return { k: place.landmark, x: NaN, z: NaN };
  }
  /** @param {(p: BowlMapProp) => boolean} ok */
  const best = ok => {
    /** @type {BowlMapProp | null} */
    let top = null,
      score = -1;
    for (const p of props) {
      const a = art[p.k];
      if (!a || !a.img || !ok(p)) continue;
      const s = bowlArtSize(a) * (p.s || 1) * (p.s || 1);
      if (s > score) {
        score = s;
        top = p;
      }
    }
    return top;
  };
  return best(p => !!art[p.k].landmark) || best(p => bowlPropClass(p.k, art[p.k]) === 'building');
}

/** the kinds of tree drawn on the map, by a prop's key */
export const BOWL_TREE_STYLES = ['round', 'cone', 'tall', 'mushroom', 'palm', 'bush', 'crystal', 'dry'];
/** @param {string} k @returns {string} */
export function bowlTreeStyle(k) {
  if (/mushroom|shroom|puffball/.test(k)) return 'mushroom';
  if (/palm|coconut/.test(k)) return 'palm';
  if (/crystal|geode/.test(k)) return 'crystal';
  if (/pine|larch|fir|spruce|juniper|cedar/.test(k)) return 'cone';
  if (/poplar|cypress|birch/.test(k)) return 'tall';
  if (/cactus|dry|olive|solar/.test(k)) return 'dry';
  if (/^bush_|hedge/.test(k)) return 'bush';
  return 'round';
}
/** each region's trees between places (owner: clumps in each region's kinds) */
export const BOWL_REGION_TREES = {
  starter: ['round', 'round', 'tall', 'bush'],
  meadowlands: ['round', 'tall', 'bush'],
  goldenhills: ['dry', 'round', 'bush'],
  sporeforest: ['mushroom', 'mushroom', 'round'],
  crystalcaverns: ['crystal', 'crystal', 'cone'],
  coraltrench: ['palm', 'palm', 'bush'],
  cloudspire: ['cone', 'cone', 'tall'],
  innersun: ['dry', 'palm'],
};

/** a hash in 0-1 for a pair of whole numbers */
export function bowlThingHash(/** @type {number} */ i, /** @type {number} */ j) {
  const s = Math.sin(i * 127.1 + j * 311.7 + 17.3) * 43758.5453;
  return s - Math.floor(s);
}
/** @typedef {{ x: number, y: number, style: string, s: number, region: string }} BowlTree */
/** clumps of trees between places: in patches (a slow noise) on land that suits them (not under water or snow, not
 * on cliffs or rivers, a little wet), clear of the places' own ground and of the routes; each clump a few trees of its
 * region's kinds. Deterministic.
 * @param {{ n: number, e: number, h: Float32Array, c?: Float32Array, wet?: Float32Array, flow?: Uint8Array }} G
 * @param {{ x: number, y: number, reach: number, region: string }[]} places
 * @param {[number, number, number, number][]} roads segments seen from above
 * @param {(x: number, y: number) => number} relAt the height above the water at a point
 * @param {number} [spacing] between clump centres, in bowl radii @returns {BowlTree[]} */
export function bowlClumps(G, places, roads, relAt, spacing = 0.026) {
  /** @type {BowlTree[]} */
  const out = [];
  if (!G.c) return out;
  const w = G.n + 1,
    corner = (/** @type {number} */ x, /** @type {number} */ y) =>
      Math.round(((x + G.e) / (2 * G.e)) * G.n) + Math.round(((y + G.e) / (2 * G.e)) * G.n) * w,
    roadGap = (/** @type {number} */ x, /** @type {number} */ y) => {
      let d = 9;
      for (const [ax, ay, bx, by] of roads) {
        const vx = bx - ax,
          vy = by - ay,
          t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1)));
        d = Math.min(d, Math.hypot(x - ax - vx * t, y - ay - vy * t));
      }
      return d;
    },
    dry = (/** @type {number} */ x, /** @type {number} */ y) => {
      const k = corner(x, y);
      if (Math.hypot(x, y) > 0.95 || /** @type {Float32Array} */ (G.c)[k] > -0.006 || (G.flow && G.flow[k]))
        return false;
      const rel = relAt(x, y);
      if (rel > 0.07 || rel < 0.002) return false;
      for (const p of places) if (Math.hypot(x - p.x, y - p.y) < p.reach + 0.004) return false;
      return roadGap(x, y) > 0.012;
    };
  const n = Math.ceil(2 / spacing);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const cx = -1 + (i + 0.2 + bowlThingHash(i, j) * 0.6) * spacing,
        cy = -1 + (j + 0.2 + bowlThingHash(j, i + 91) * 0.6) * spacing;
      if (cx * cx + cy * cy > 0.9) continue;
      /* forest patches: a slow wave pattern, denser where the land is wetter */
      const k = corner(cx, cy),
        wet = G.wet ? G.wet[k] : 0.3,
        patch = Math.sin(cx * 11.3 + Math.sin(cy * 7.1) * 1.7) * Math.cos(cy * 9.7 - Math.sin(cx * 5.3) * 1.3);
      if (patch + wet * 0.8 < 0.55 + bowlThingHash(i + 3, j + 7) * 0.4) continue;
      if (!dry(cx, cy)) continue;
      let near = places[0],
        nd = 9;
      for (const p of places) {
        const d = Math.hypot(cx - p.x, cy - p.y);
        if (d < nd) {
          nd = d;
          near = p;
        }
      }
      const kinds =
          BOWL_REGION_TREES[/** @type {keyof typeof BOWL_REGION_TREES} */ (near && near.region)] ||
          BOWL_REGION_TREES.starter,
        count = 3 + Math.floor(bowlThingHash(i + 11, j) * 6);
      for (let q = 0; q < count; q++) {
        const a = bowlThingHash(i * 7 + q, j * 3) * Math.PI * 2,
          d = Math.sqrt(bowlThingHash(i + q * 13, j + 5)) * spacing * 0.45,
          x = cx + Math.cos(a) * d,
          y = cy + Math.sin(a) * d;
        if (!dry(x, y)) continue;
        out.push({
          x,
          y,
          style: kinds[Math.floor(bowlThingHash(i + q, j + q * 5) * kinds.length)],
          s: 0.8 + bowlThingHash(q, i + j) * 0.5,
          region: (near && near.region) || 'starter',
        });
      }
    }
  return out;
}
