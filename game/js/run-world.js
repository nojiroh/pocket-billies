'use strict';
/* ================= THE RUN'S WORLD ON THE PAGE (roguelite track RL-7) =================
   While a run is on (saveData.run with its map), the world the game walks is the run's: Copperleaf as world node 0
   and a place per map node after it, each with its scene made from the run's seed (logic/run-scenes.js), joined
   seamlessly by seam roads. In the hub it is the hub's (game data). runWorldSync makes the world match the save:
   boot calls it before the maps round you are fetched, and setSaveData calls it whenever the save is swapped (a new
   game, an account or backup restore, the debug menu, the in-game test); a run that starts or ends in place (RL-8)
   calls it too.
   Putting a world in: all of the run's scenes are made at once (about 30 ms each in Node, a run 12-14 of them;
   runWorld.ms says how long it took, for the debug log), then game-data.js worldPut swaps the tables in place, then
   everything that holds a node or a place from the old world is let go in the same tick: the seamless views and
   their caches, the walk view (mounted again by the next render), the bowl's spots, ground, sky, pick and pins, the
   rooms and roam spot you were in, a flight. A run whose world can't be made is left (its hub fields back, nothing
   paid) rather than stopping the game. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide, toast } from './hooks.js';
import {
  FIELD_MOVES,
  LOCATION_BY_ID,
  NODE_TYPES,
  POOLS,
  RULES,
  START_NODE,
  TRAINERS,
  gameData,
  worldHubBack,
  worldPut,
} from './game-data.js';
import { rngFrom } from './logic/rng.js';
import { runRestore } from './logic/run-state.js';
import { runRegionData } from './logic/run-region.js';
import { runSpot, runWeather } from './logic/run-map.js';
import { runScenesMake, runWorldTables } from './logic/run-scenes.js';
import { runBowlLook } from './logic/run-bowl.js';
import { runFoes } from './logic/run-loop.js';
import { bowlXY } from './logic/bowl.js';
import { bowlTreeStyle } from './logic/bowl-things.js';
import { saveData, uiState } from './game-state.js';
import { stopWalkView, walkView } from './walk-view.js';
import { environment } from './environment.js';
import { seamlessWorld } from './seamless-world.js';
import { worldBowl, worldBowlReset } from './world-bowl.js';
import { airshipFlight } from './airship.js';
/* eslint-disable no-func-assign */
expose({
  runPlaceWeather: [() => runPlaceWeather, v => ((runPlaceWeather = v), provide({ runPlaceWeather }))],
  runWorld: [() => runWorld],
  runWorldData: [() => runWorldData, v => (runWorldData = v)],
  runWorldLetGo: [() => runWorldLetGo, v => (runWorldLetGo = v)],
  runWorldSync: [() => runWorldSync, v => ((runWorldSync = v), provide({ runWorldSync }))],
});
/* eslint-enable no-func-assign */
provide({ runPlaceWeather, runWorldSync });
/* to-module: end */
/** the world that is in: the seed of the run it was made from ('' for the hub's), its scenes and how long they took
 * to make; live once boot has put the first world in (before that a swapped save waits for boot) */
export const runWorld = { seed: '', scenes: 0, ms: 0, live: false };
provide({ runWorld }); /* to-module */
/** what the run's scenes and tables are made from: the game data as the page holds it (POOLS with stand-ins); RL-R1:
 * and its region (logic/run-region.js: regions.json, the lines, the leaders) */
export function runWorldData() {
  return {
    nodeTypes: NODE_TYPES,
    biomes: gameData.biomes,
    pools: POOLS,
    scenery: gameData.scenery,
    rules: RULES.run,
    region: runRegionData(gameData, TRAINERS),
    /* RL-R2: the field moves that open a run's side area (logic/run-side.js) */
    fieldMoves: FIELD_MOVES,
  };
}
/** put in the world the save needs, if it isn't in yet: the run's while one is on with its map, else the hub's.
 * Returns whether the world changed */
export function runWorldSync() {
  const run = saveData && saveData.run,
    want = run && run.map ? run.seed : '';
  if (want === runWorld.seed) return false;
  if (want)
    try {
      const t0 = performance.now(),
        data = runWorldData(),
        scenes = runScenesMake(run, data),
        W = runWorldTables(run, gameData.locations[START_NODE], data),
        /* RL-8b: the run's own world map, from its seed */
        look = runBowlLook(
          run.seed,
          run.map,
          run.map.nodes.map((_, i) => {
            const s = runSpot(run.map, i);
            return bowlXY(s.a, s.r);
          }),
          data.biomes,
          gameData.worldmap,
          bowlTreeStyle,
          rngFrom
        );
      worldPut({
        ...W,
        look,
        maps: Object.fromEntries(W.locations.slice(1).map((p, i) => [p.mapId, scenes[i]])),
        /* RL-8: its mini-bosses and boss, each a leader's copy (logic/run-loop.js runFoes) */
        trainers: runFoes(run, { leaders: Object.values(TRAINERS).filter(T => T.miniboss), rules: RULES.run }),
      });
      Object.assign(runWorld, { seed: want, scenes: scenes.length, ms: Math.round(performance.now() - t0) });
    } catch (e) {
      console.error(e);
      runRestore(saveData);
      worldHubBack();
      Object.assign(runWorld, { seed: '', scenes: 0, ms: 0 });
      if (typeof toast === 'function') toast('The run couldn’t be made again on this device, so it was left.');
    }
  else {
    worldHubBack();
    Object.assign(runWorld, { seed: '', scenes: 0, ms: 0 });
  }
  runWorldLetGo();
  return true;
}
/** let go of everything that holds a node or a place of the world that was in (the same tick as the swap, so no
 * frame reads a node that isn't there) */
function runWorldLetGo() {
  seamlessWorld.gen++;
  seamlessWorld.cache.clear();
  seamlessWorld.aheadFrom = null;
  seamlessWorld.aheadFor = null;
  seamlessWorld.heldFor = null;
  /* the walk view: stopped and forgotten, so the next render mounts the new world's view of where you stand */
  if (walkView.id) {
    stopWalkView();
    walkView.id = null;
    walkView.sc = null;
  }
  worldBowlReset();
  worldBowl.sel = undefined;
  worldBowl.marks = [];
  if (worldBowl.skyState) worldBowl.skyState.at = -1e9;
  uiState.inside = null;
  uiState.goingIn = null;
  uiState.backAt = null;
  uiState.roam = null;
  uiState.mapSel = null;
  uiState.walkOk = null;
  if (airshipFlight.on) airshipFlight.on = false;
  airshipFlight.a = airshipFlight.b = -1;
  environment.id = null;
  if (typeof debugLog !== 'undefined')
    debugLog.add(
      'scene',
      runWorld.seed ? `a run's world in: ${runWorld.scenes} scenes made in ${runWorld.ms} ms` : "the hub's world in"
    );
}
/** a run place's weather today, from the run's forecast ('' outside a run and for the hub's places): environment.js
 * reads it instead of the real clock's @param {string} placeId */
function runPlaceWeather(placeId) {
  const run = saveData.run,
    L = placeId ? LOCATION_BY_ID[placeId] : null;
  return run && run.map && L && L.runNode != null ? runWeather(run, L.runNode, run.clock) : '';
}
