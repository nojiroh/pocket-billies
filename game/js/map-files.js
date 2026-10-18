'use strict';
/* ================= MAP FILES (phase 04b) =================
   data/gamedata.js has every map without its ground and props (sc._lite says which ground kinds and props it uses);
   each map's own file, data/maps/<id>.json, brings them when the map is needed. Rooms come whole.
   - needMaps(ids): fetch those maps (each once), resolves when they are whole.
   - mapsOfView(viewId): the maps a walk view is put together from (a place's view also shows its neighbours).
   - mapsAround(node, hops): the place's map and its neighbours' maps, `hops` roads out.
   - loadAllMaps(): every map, a couple at a time, nearest first (started once the game has loaded).
   The view a player can walk into next is fetched ahead (loadMapsAhead, on arriving at a place), and prepareMap waits
   for a view's maps, so nothing is drawn from half a map. If anything was put together from a map before its file came
   (the world map's miniatures, say), the views are made again once it has (seamlessWorld.gen). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide, saveData, seamlessWorld } from './hooks.js';
import { LOCATIONS, ROADS, ROADS_BY_NODE, START_NODE, gameData } from './game-data.js';
/* eslint-disable no-func-assign */
expose({
  MAP_FIELDS: [() => MAP_FIELDS],
  isLiteMap: [() => isLiteMap],
  loadAllMaps: [() => loadAllMaps, v => (loadAllMaps = v)],
  loadMapFile: [() => loadMapFile, v => (loadMapFile = v)],
  loadMapsAhead: [() => loadMapsAhead, v => (loadMapsAhead = v)],
  mapFiles: [() => mapFiles],
  mapsAround: [() => mapsAround, v => (mapsAround = v)],
  mapsOfView: [() => mapsOfView, v => ((mapsOfView = v), provide({ mapsOfView }))],
  needMaps: [() => needMaps],
  nodeOfMap: [() => nodeOfMap],
  remakeViewsOfMap: [() => remakeViewsOfMap, v => (remakeViewsOfMap = v)],
  watchMapsAhead: [() => watchMapsAhead, v => (watchMapsAhead = v)],
});
/* eslint-enable no-func-assign */
provide({ mapsOfView });
/* to-module: end */
const mapFiles = { busy: new Map(), touched: new Set(), all: null, ms: 0, n: 0, failed: [] };
provide({ mapFiles }); /* to-module */
const MAP_FIELDS = ['heights', 'steps', 'stepm', 'tiles', 'props'];
export const isLiteMap = id => !!(gameData.maps[id] && gameData.maps[id]._lite);
export function loadMapFile(id) {
  if (!isLiteMap(id)) return Promise.resolve();
  if (mapFiles.busy.has(id)) return mapFiles.busy.get(id);
  const t0 = performance.now(),
    sc = gameData.maps[id];
  const p = (async () => {
    let last = null;
    for (let k = 0; k < 3; k++) {
      try {
        const r = await fetch('data/maps/' + id + '.json');
        if (!r.ok) throw new Error(`data/maps/${id}.json: ${r.status}`);
        const full = await r.json();
        /* only into the map it was asked for: the Studio's play test may have put its own (whole) maps in since */
        if (!sc._lite) return;
        for (const f of MAP_FIELDS) if (full[f] !== undefined) sc[f] = full[f];
        delete sc._lite;
        mapFiles.n++;
        mapFiles.ms += performance.now() - t0;
        remakeViewsOfMap(id);
        return;
      } catch (e) {
        last = e;
        await new Promise(r => setTimeout(r, 400 * (k + 1)));
      }
    }
    mapFiles.busy.delete(id);
    mapFiles.failed.push(id);
    console.error('[gamedata] map ' + id + ' did not load: ' + (last && last.message));
    if (typeof debugLog !== 'undefined')
      debugLog.error('data', 'map ' + id + ' did not load: ' + (last && last.message));
  })();
  mapFiles.busy.set(id, p);
  return p;
}
/* a view put together while this map was still without its ground: make the views again */
function remakeViewsOfMap(id) {
  if (!mapFiles.touched.has(id) || typeof seamlessWorld === 'undefined') return;
  const uses = v =>
    v &&
    typeof v === 'object' &&
    (v.baseId === id || v.aId === id || v.bId === id || (v.parts || []).some(p => p && p.id === id));
  const all = [...seamlessWorld.cache.values(), ...(seamlessWorld.fix ? seamlessWorld.fix.values() : [])];
  if (all.some(uses)) seamlessWorld.gen++;
}
const needMaps = ids => Promise.all([...new Set(ids)].filter(Boolean).map(loadMapFile));
provide({ needMaps }); /* to-module */
const nodeOfMap = sid => LOCATIONS.findIndex(r => r.scene === sid);
function mapsAround(node, hops = 1) {
  const seen = new Set([node]);
  let edge = [node];
  for (let h = 0; h < hops; h++) {
    const next = [];
    for (const n of edge)
      for (const e of ROADS_BY_NODE[n] || [])
        if (!seen.has(e.to)) {
          seen.add(e.to);
          next.push(e.to);
        }
    edge = next;
  }
  return [...seen].map(n => LOCATIONS[n] && LOCATIONS[n].scene).filter(Boolean);
}
function mapsOfView(id) {
  if (!id) return [];
  const out = [];
  let m = id.match(/#([^@#]+)@/);
  if (m) out.push(m[1]);
  if (!id.startsWith('w:')) return out.concat(id.split('#')[0]);
  m = id.match(/^w:road(\d+)@/);
  if (m) {
    const L = ROADS[+m[1]];
    return L ? out.concat(mapsAround(L[0], 1), mapsAround(L[1], 1)) : out;
  }
  m = id.match(/^w:(.+?)(\*|[<>]\d+)/);
  const node = m ? nodeOfMap(m[1]) : -1;
  return node >= 0 ? out.concat(mapsAround(node, 1)) : out;
}
/* on arriving at a place: the maps two roads out, so the next place's view is whole before you get there */
export function loadMapsAhead(node) {
  return needMaps(mapsAround(node, 2));
}
/* wherever you go (walking, the airship, a loaded game, the debug menu), the maps ahead follow */
export function watchMapsAhead() {
  let at = null;
  setInterval(() => {
    const n = typeof saveData !== 'undefined' && saveData && saveData.route ? saveData.route.node : null;
    if (n == null || n === at) return;
    at = n;
    loadMapsAhead(n);
  }, 1000);
}
export function loadAllMaps() {
  if (mapFiles.all) return mapFiles.all;
  const t0 = performance.now(),
    here = typeof saveData !== 'undefined' && saveData && saveData.route ? saveData.route.node : START_NODE,
    near = mapsAround(here, 3),
    ids = [...new Set([...near, ...Object.keys(gameData.maps)])].filter(isLiteMap);
  mapFiles.all = (async () => {
    let i = 0;
    const one = async () => {
      while (i < ids.length) await loadMapFile(ids[i++]);
    };
    await Promise.all([one(), one()]);
    if (typeof debugLog !== 'undefined' && ids.length)
      debugLog.add('data', `${ids.length} maps loaded in the background in ${Math.round(performance.now() - t0)} ms`);
  })();
  return mapFiles.all;
}
