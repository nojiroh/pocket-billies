// @ts-check
'use strict';
/* ================= WEATHER ON WATER (water track WA-5a) =================
   A run's place made once from its seed (logic/run-scenes.js) takes the day's forecast (logic/run-map.js runWeather)
   on its water, from a kept dry copy, so the next day's weather starts again from the scene as made:
   - snow freezes still water (pond, lake, the marsh, the bog, an oasis; logic/water-kinds.js `still`) into ice you
     walk on: `waters` rectangles of kind `ice` over it; running water (a stream's line) keeps flowing;
   - a storm floods: the ground right beside a pond or a river (a cell next to its water) goes under shallows, and a
     river's middle runs deep; never a road's surface or the cells next to it, a building's door, the hub, an exit or a
     bridge's end, and the main path stays open: with the scene's scenery the flood is checked with the map
     generator's own reach (mapgen.js mapgenUnreachable, water dry), and held back from the road, then left out, when
     it would cut an exit off;
   - rain: its rings on the water exist already (walk/fountains-weather.js).
   The walk grid's other copies (mapgen.js mapgenReach, seam-rules.js) keep all water dry, as before.
   Logic only: no DOM, runs in Node (tools/test/water-weather.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { waterKindHeals, waterKindShut, waterKindStill, waterKindWalkOn } from './water-kinds.js';
import { wadeKindAt } from './wading.js';
import { mapgenUnreachable } from './mapgen.js';
import { waterGenRects } from './water-gen.js';
/* eslint-disable no-func-assign */
expose({
  WATERWX_CLEAR: [() => WATERWX_CLEAR],
  WATERWX_DRY: [() => WATERWX_DRY],
  WATERWX_ROAD: [() => WATERWX_ROAD],
  // @ts-expect-error -- replaced on purpose
  waterFloodCells: [() => waterFloodCells, v => (waterFloodCells = v)],
  // @ts-expect-error -- replaced on purpose
  waterFreezeCells: [() => waterFreezeCells, v => (waterFreezeCells = v)],
  // @ts-expect-error -- replaced on purpose
  waterRunningMask: [() => waterRunningMask, v => (waterRunningMask = v)],
  // @ts-expect-error -- replaced on purpose
  waterSetTiles: [() => waterSetTiles, v => (waterSetTiles = v)],
  // @ts-expect-error -- replaced on purpose
  waterWeatherApply: [() => waterWeatherApply, v => (waterWeatherApply = v)],
  // @ts-expect-error -- replaced on purpose
  waterWeatherDry: [() => waterWeatherDry, v => (waterWeatherDry = v)],
  waterWeatherFloods: [() => waterWeatherFloods],
  waterWeatherState: [() => waterWeatherState],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the scenes as made (tiles and water rectangles), kept the first time weather is laid on them */
export const WATERWX_DRY = new WeakMap();
/** road surfaces (mapgen.js MAPGEN_SURFACES) a flood never covers, nor the cells beside them */
export const WATERWX_ROAD = 'pvKq';
/** metres from the hub, an exit or a bridge's end a flood keeps clear */
export const WATERWX_CLEAR = 3;
/** the kinds a flood rises from (not lava, rapids, ice or a hot spring) */
export const waterWeatherFloods = (/** @type {string} */ k) =>
  !waterKindShut(k) && !waterKindWalkOn(k) && !waterKindHeals(k);
/** what the day's weather does to water: 'ice' in snow, 'flood' in a storm, else '' @param {string} weather */
export const waterWeatherState = weather => (weather === 'snow' ? 'ice' : weather === 'storm' ? 'flood' : '');

/** cells near a stream's line (running water: it never freezes, its middle runs deep in a flood) as a mask over the
 * scene's cells (index j * w + i, j from the near edge) @param {any} sc */
export function waterRunningMask(sc) {
  const { w, h } = sc,
    M = new Uint8Array(w * h);
  for (const st of sc.streams || []) {
    const P = st.pts || [];
    for (let n = 0; n + 1 < P.length; n++) {
      const [ax, az] = P[n],
        [bx, bz] = P[n + 1],
        r = ((Array.isArray(st.w) ? Math.max(st.w[n] || 0, st.w[n + 1] || 0) : st.w) || 1.6) / 2 + 0.75;
      for (
        let j = Math.max(0, Math.floor(Math.min(az, bz) - r));
        j <= Math.min(h - 1, Math.ceil(Math.max(az, bz) + r));
        j++
      )
        for (
          let i = Math.max(0, Math.floor(Math.min(ax, bx) - r));
          i <= Math.min(w - 1, Math.ceil(Math.max(ax, bx) + r));
          i++
        ) {
          const vx = bx - ax,
            vz = bz - az,
            L = vx * vx + vz * vz,
            t = L ? Math.max(0, Math.min(1, ((i + 0.5 - ax) * vx + (j + 0.5 - az) * vz) / L)) : 0;
          if (Math.hypot(ax + vx * t - i - 0.5, az + vz * t - j - 0.5) <= r) M[j * w + i] = 1;
        }
    }
  }
  return M;
}
/** the cells (index j * w + i) still water covers, frozen in snow @param {any} sc */
export function waterFreezeCells(sc) {
  const { w, h } = sc,
    run = waterRunningMask(sc),
    cells = [];
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const ch = sc.tiles[h - 1 - j][i];
      if ((ch === 'w' || ch === 'd') && !run[j * w + i] && waterKindStill(wadeKindAt(sc, i + 0.5, j + 0.5)))
        cells.push(j * w + i);
    }
  return cells;
}
/** the flood on the scene as made: the dry cells beside floodable water it covers (keep: metres from a road surface
 * kept dry besides the cell beside it) and the river cells it deepens @param {any} sc @param {number} keep */
export function waterFloodCells(sc, keep) {
  const { w, h } = sc,
    at = (/** @type {number} */ i, /** @type {number} */ j) =>
      i < 0 || j < 0 || i >= w || j >= h ? '' : sc.tiles[h - 1 - j][i],
    wet = (/** @type {number} */ i, /** @type {number} */ j) => {
      const c = at(i, j);
      return (c === 'w' || c === 'd') && waterWeatherFloods(wadeKindAt(sc, i + 0.5, j + 0.5));
    },
    run = waterRunningMask(sc),
    road = new Uint8Array(w * h),
    reach = 1 + Math.ceil(keep);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++)
      if (WATERWX_ROAD.includes(at(i, j)))
        for (let b = -reach; b <= reach; b++)
          for (let a = -reach; a <= reach; a++)
            if (i + a >= 0 && j + b >= 0 && i + a < w && j + b < h) road[(j + b) * w + i + a] = 1;
  const clear = [...(sc.hub ? [sc.hub] : []), ...(sc.exits || []), ...(sc.bridges || []).flatMap(B => [B.a, B.b])],
    doors = (sc.props || []).filter(p => p.act || p.label),
    flood = [],
    deep = [];
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const q = j * w + i,
        ch = at(i, j),
        x = i + 0.5,
        z = j + 0.5;
      if (road[q] || clear.some(p => p && Math.hypot(p[0] - x, p[1] - z) < WATERWX_CLEAR)) continue;
      if (ch === 'w') {
        if (
          run[q] &&
          wet(i - 1, j) &&
          wet(i + 1, j) &&
          wet(i, j - 1) &&
          wet(i, j + 1) &&
          waterWeatherFloods(wadeKindAt(sc, x, z))
        )
          deep.push(q);
        continue;
      }
      if (ch === 'd' || !(wet(i - 1, j) || wet(i + 1, j) || wet(i, j - 1) || wet(i, j + 1))) continue;
      if (doors.some(p => Math.hypot(p.x - x, p.z - z) < 2)) continue;
      flood.push(q);
    }
  return { flood, deep };
}
/** set cells of the scene's tiles to a letter @param {any} sc @param {number[]} cells @param {string} ch */
export function waterSetTiles(sc, cells, ch) {
  const { w, h } = sc,
    rows = sc.tiles.map((/** @type {string} */ r) => r.split(''));
  for (const q of cells) rows[h - 1 - Math.floor(q / w)][q % w] = ch;
  sc.tiles = rows.map((/** @type {string[]} */ r) => r.join(''));
}
/** lay the day's weather on a scene's water (snow: ice, a storm: a flood, else as made), from its kept dry copy;
 * scenery (scenery.json), when given, checks the flood keeps every exit reached. Returns what was laid ('ice',
 * 'flood' or ''); the scene's `wx` says it too @param {any} sc @param {string} weather @param {any} [scenery]
 * @returns {string} */
export function waterWeatherApply(sc, weather, scenery) {
  if (!sc || !sc.tiles) return '';
  let dry = WATERWX_DRY.get(sc);
  if (!dry) WATERWX_DRY.set(sc, (dry = { tiles: sc.tiles, waters: sc.waters }));
  sc.tiles = dry.tiles;
  if (dry.waters) sc.waters = dry.waters;
  else delete sc.waters;
  delete sc.wx;
  const state = waterWeatherState(weather);
  if (state === 'ice') {
    const cells = waterFreezeCells(sc);
    if (!cells.length) return '';
    sc.waters = [...(dry.waters || []), ...waterGenRects(sc.w, cells, 'ice')];
    sc.wx = state;
    return state;
  }
  if (state !== 'flood') return '';
  for (const keep of [0, 4]) {
    const { flood, deep } = waterFloodCells(sc, keep);
    if (!flood.length && !deep.length) return '';
    waterSetTiles(sc, flood, 'w');
    waterSetTiles(sc, deep, 'd');
    /* the flooded ground's kind: the place's own (it changes nothing, and tells a cache the water changed) */
    if (flood.length) sc.waters = [...(dry.waters || []), ...waterGenRects(sc.w, flood, sc.waterKind || 'pond')];
    if (!scenery || !mapgenUnreachable(sc, scenery).length) {
      sc.wx = state;
      return state;
    }
    sc.tiles = dry.tiles;
    if (dry.waters) sc.waters = dry.waters;
    else delete sc.waters;
  }
  return '';
}
/** the scene as made, before any weather (its kept dry tiles and water rectangles) @param {any} sc */
export function waterWeatherDry(sc) {
  const dry = WATERWX_DRY.get(sc);
  return dry ? { tiles: dry.tiles, waters: dry.waters } : { tiles: sc.tiles, waters: sc.waters };
}
