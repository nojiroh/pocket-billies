'use strict';
/* ================= MAP FILES (phase 04b) =================
   data/gamedata.js has every map without its ground and props (sc._lite says which ground kinds and props it uses);
   each map's own file, data/scenes/<id>.json, brings them when the map is needed. Rooms come whole.
   - scenesNeed(ids): fetch those maps (each once), resolves when they are whole.
   - scenesFor(viewId): the maps a walk view is put together from (a place's view also shows its neighbours).
   - sceneRing(node, hops): the place's map and its neighbours' maps, `hops` roads out.
   - scenesAll(): every map, a couple at a time, nearest first (started once the game has loaded).
   The view a player can walk into next is fetched ahead (scenesAhead, on arriving at a place), and prepareMap waits
   for a view's maps, so nothing is drawn from half a map. If anything was put together from a map before its file came
   (the world map's miniatures, say), the views are made again once it has (seamlessWorld.gen). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { S, provide, seamlessWorld } from './hooks.js';
import { ADJ, GD, LINKS, ROUTE, START_NODE } from './game-data.js';
/* eslint-disable no-func-assign */
expose({
  MAP_FIELDS: [() => MAP_FIELDS],
  SCENE_FILES: [() => SCENE_FILES],
  sceneLite: [() => sceneLite],
  sceneLoad: [() => sceneLoad, v => (sceneLoad = v)],
  sceneNode: [() => sceneNode],
  sceneRing: [() => sceneRing, v => (sceneRing = v)],
  sceneStale: [() => sceneStale, v => (sceneStale = v)],
  sceneWatch: [() => sceneWatch, v => (sceneWatch = v)],
  scenesAhead: [() => scenesAhead, v => (scenesAhead = v)],
  scenesAll: [() => scenesAll, v => (scenesAll = v)],
  scenesFor: [() => scenesFor, v => ((scenesFor = v), provide({ scenesFor }))],
  scenesNeed: [() => scenesNeed],
});
/* eslint-enable no-func-assign */
provide({ scenesFor });
/* to-module: end */
const SCENE_FILES = { busy: new Map(), touched: new Set(), all: null, ms: 0, n: 0, failed: [] };
provide({ SCENE_FILES }); /* to-module */
const MAP_FIELDS = ['heights', 'steps', 'stepm', 'tiles', 'props'];
export const sceneLite = id => !!(GD.scenes[id] && GD.scenes[id]._lite);
export function sceneLoad(id) {
  if (!sceneLite(id)) return Promise.resolve();
  if (SCENE_FILES.busy.has(id)) return SCENE_FILES.busy.get(id);
  const t0 = performance.now(),
    sc = GD.scenes[id];
  const p = (async () => {
    let last = null;
    for (let k = 0; k < 3; k++) {
      try {
        const r = await fetch('data/scenes/' + id + '.json');
        if (!r.ok) throw new Error(`data/scenes/${id}.json: ${r.status}`);
        const full = await r.json();
        /* only into the map it was asked for: the Studio's play test may have put its own (whole) maps in since */
        if (!sc._lite) return;
        for (const f of MAP_FIELDS) if (full[f] !== undefined) sc[f] = full[f];
        delete sc._lite;
        SCENE_FILES.n++;
        SCENE_FILES.ms += performance.now() - t0;
        sceneStale(id);
        return;
      } catch (e) {
        last = e;
        await new Promise(r => setTimeout(r, 400 * (k + 1)));
      }
    }
    SCENE_FILES.busy.delete(id);
    SCENE_FILES.failed.push(id);
    console.error('[gamedata] map ' + id + ' did not load: ' + (last && last.message));
    if (typeof NWLOG !== 'undefined') NWLOG.error('data', 'map ' + id + ' did not load: ' + (last && last.message));
  })();
  SCENE_FILES.busy.set(id, p);
  return p;
}
/* a view put together while this map was still without its ground: make the views again */
function sceneStale(id) {
  if (!SCENE_FILES.touched.has(id) || typeof seamlessWorld === 'undefined') return;
  const uses = v =>
    v &&
    typeof v === 'object' &&
    (v.baseId === id || v.aId === id || v.bId === id || (v.parts || []).some(p => p && p.id === id));
  const all = [...seamlessWorld.cache.values(), ...(seamlessWorld.fix ? seamlessWorld.fix.values() : [])];
  if (all.some(uses)) seamlessWorld.gen++;
}
const scenesNeed = ids => Promise.all([...new Set(ids)].filter(Boolean).map(sceneLoad));
provide({ scenesNeed }); /* to-module */
const sceneNode = sid => ROUTE.findIndex(r => r.scene === sid);
function sceneRing(node, hops = 1) {
  const seen = new Set([node]);
  let edge = [node];
  for (let h = 0; h < hops; h++) {
    const next = [];
    for (const n of edge)
      for (const e of ADJ[n] || [])
        if (!seen.has(e.to)) {
          seen.add(e.to);
          next.push(e.to);
        }
    edge = next;
  }
  return [...seen].map(n => ROUTE[n] && ROUTE[n].scene).filter(Boolean);
}
function scenesFor(id) {
  if (!id) return [];
  const out = [];
  let m = id.match(/#([^@#]+)@/);
  if (m) out.push(m[1]);
  if (!id.startsWith('w:')) return out.concat(id.split('#')[0]);
  m = id.match(/^w:road(\d+)@/);
  if (m) {
    const L = LINKS[+m[1]];
    return L ? out.concat(sceneRing(L[0], 1), sceneRing(L[1], 1)) : out;
  }
  m = id.match(/^w:(.+?)(\*|[<>]\d+)/);
  const node = m ? sceneNode(m[1]) : -1;
  return node >= 0 ? out.concat(sceneRing(node, 1)) : out;
}
/* on arriving at a place: the maps two roads out, so the next place's view is whole before you get there */
export function scenesAhead(node) {
  return scenesNeed(sceneRing(node, 2));
}
/* wherever you go (walking, the airship, a loaded game, the debug menu), the maps ahead follow */
export function sceneWatch() {
  let at = null;
  setInterval(() => {
    const n = typeof S !== 'undefined' && S && S.route ? S.route.node : null;
    if (n == null || n === at) return;
    at = n;
    scenesAhead(n);
  }, 1000);
}
export function scenesAll() {
  if (SCENE_FILES.all) return SCENE_FILES.all;
  const t0 = performance.now(),
    here = typeof S !== 'undefined' && S && S.route ? S.route.node : START_NODE,
    near = sceneRing(here, 3),
    ids = [...new Set([...near, ...Object.keys(GD.scenes)])].filter(sceneLite);
  SCENE_FILES.all = (async () => {
    let i = 0;
    const one = async () => {
      while (i < ids.length) await sceneLoad(ids[i++]);
    };
    await Promise.all([one(), one()]);
    if (typeof NWLOG !== 'undefined' && ids.length)
      NWLOG.add('data', `${ids.length} maps loaded in the background in ${Math.round(performance.now() - t0)} ms`);
  })();
  return SCENE_FILES.all;
}
