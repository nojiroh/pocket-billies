// @ts-check
'use strict';
/* ================= A RUN'S SCENES AND WORLD (roguelite track RL-7) =================
   What a run's node map (logic/run-map.js) becomes when you stand in it: a walkable scene per node, made by the map
   generator (logic/mapgen.js) from the run's seed, and the world tables the game reads (game-data.js worldSetGraph):
   Copperleaf first (world node 0), then a place per map node (world node i + 1), joined by seam roads.
   - A node's scene is a 112 × 64 route (MAPGEN_SIZES.route). Its exits are runExits' (the owner: runs go east to
     west): west to the nodes it leads to, east to the ones that lead to it, at t 0.5, or 0.15625 and 0.84375 (10 m and 54 m along). The main road
     runs from its first east exit to its first west exit; the second ones branch off it.
   - A node's scene is made from every parent's edge (mapgenEdgeStrip into params.edges, map generator MG-2), so the
     two meet with no gap and a straight walk across. The map numbers nodes row by row, so every parent comes before
     its children: making the scenes in order makes each one after the ones it needs.
   - Its dials vary within rules.json run.scene, drawn from its own stream (runNodeSeed + 'scene|dials'); its seed,
     biome, size and exits are the run's. The same seed and the same data give the same scenes.
   - A place's pool is its own (a run node's Billies: its biome's species at its row's levels, rules.json run.wild),
     so the encounter code reads it like any other.
   Scenes are never saved: a run made again from its seed gets them back. Logic only: no DOM, runs in Node
   (tools/test/run-scenes.test.mjs, run-world-real.test.mjs). Every table comes in as an argument. */
/** @import { Run, RunMap } from '../../types/save-data' */
/** @import { Biome, LocationData, NodeType, Pool, RoadLink, RunSceneRules } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { hashString, rngFrom } from './rng.js';
import { runExits, runNodeSeed, runSpot } from './run-map.js';
import { MAPGEN_SIZES, mapgenEdgeStrip, mapgenScene } from './mapgen.js';
/* eslint-disable no-func-assign */
expose({
  RUN_BUILDINGS: [() => RUN_BUILDINGS],
  RUN_MOD_MOUNTAINS: [() => RUN_MOD_MOUNTAINS],
  RUN_SIDE_ID: [() => RUN_SIDE_ID],
  runMapIdOf: [() => runMapIdOf],
  runPlaceId: [() => runPlaceId],
  // @ts-expect-error -- replaced on purpose
  runPlaceName: [() => runPlaceName, v => (runPlaceName = v)],
  // @ts-expect-error -- replaced on purpose
  runSceneDials: [() => runSceneDials, v => (runSceneDials = v)],
  runSceneExitTo: [() => runSceneExitTo],
  // @ts-expect-error -- replaced on purpose
  runSceneExits: [() => runSceneExits, v => (runSceneExits = v)],
  // @ts-expect-error -- replaced on purpose
  runSceneMake: [() => runSceneMake, v => (runSceneMake = v)],
  // @ts-expect-error -- replaced on purpose
  runSceneParams: [() => runSceneParams, v => (runSceneParams = v)],
  // @ts-expect-error -- replaced on purpose
  runScenesMake: [() => runScenesMake, v => (runScenesMake = v)],
  runShopId: [() => runShopId],
  // @ts-expect-error -- replaced on purpose
  runWildLevels: [() => runWildLevels, v => (runWildLevels = v)],
  // @ts-expect-error -- replaced on purpose
  runWorldTables: [() => runWorldTables, v => (runWorldTables = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/**
 * @typedef {{ nodeTypes: Record<string, NodeType>, biomes: Record<string, Biome>, pools: Record<string, Pool>,
 *   scenery: any, rules: { scene: RunSceneRules, wild: { lv: [number, number], perRow: number, back: number } } }} RunWorldData
 */
/** a run node's place id (its row in the world tables, its wild Billies in saveData.wild) @param {number} i */
export const runPlaceId = i => `run_${i}`;
/** RL-8: a run town's shop id @param {number} i */
export const runShopId = i => `run_${i}_shop`;
/** a run node's map id: its place id and a tag of the run's seed, so no cache keyed by map id mixes two runs
 * @param {string} seed @param {number} i */
export const runMapIdOf = (seed, i) => `run_${i}_${(hashString(seed) % 1679616).toString(36)}`;
/** the side names mapgen gives a scene's exits, the first and then the second on a side (mapgenStageExits) */
export const RUN_SIDE_ID = { E: ['east', 'east2'], W: ['west', 'west2'] };
/** a node's exits in the order its scene is made with them, with the ids the generator gives them: the first east
 * (back), the first west (ahead; the main road between them), then the second east and the second west
 * @param {RunMap} map @param {number} i
 * @returns {{ side: 'E' | 'W', t: number, id: string, node: number }[]} node: the neighbour the exit leads to */
export function runSceneExits(map, i) {
  const ex = runExits(map, i),
    E = ex.back.map((e, k) => ({ side: /** @type {'E'} */ ('E'), t: e.t, id: RUN_SIDE_ID.E[k], node: e.from })),
    W = ex.ahead.map((e, k) => ({ side: /** @type {'W'} */ ('W'), t: e.t, id: RUN_SIDE_ID.W[k], node: e.to }));
  return [E[0], W[0], E[1], W[1]].filter(e => !!e);
}
/** the exit of node i that leads to node j, or null @param {RunMap} map @param {number} i @param {number} j */
export const runSceneExitTo = (map, i, j) => runSceneExits(map, i).find(e => e.node === j) || null;
/** draw a node's dials from run.scene: a number from each [low, high] range (to the hundredth), a choice by weight
 * from each record, groups in turn; keys and choices in name order, so the draws don't depend on how the file is
 * laid out
 * @param {RunSceneRules} rule @param {{ next: () => number, pick: (w: Record<string, number>) => string }} g
 * @returns {Record<string, any>} */
export function runSceneDials(rule, g) {
  /** @type {Record<string, any>} */
  const out = {};
  for (const k of Object.keys(rule).sort()) {
    const v = rule[k];
    if (Array.isArray(v)) out[k] = Math.round((v[0] + g.next() * (v[1] - v[0])) * 100) / 100;
    else if (Object.values(v).every(x => typeof x === 'number'))
      out[k] = g.pick(Object.fromEntries(Object.entries(/** @type {Record<string, number>} */ (v)).sort()));
    else out[k] = runSceneDials(/** @type {RunSceneRules} */ (v), g);
  }
  return out;
}
/** the generator's dials for node i: the run's seed, biome, size and exits, the dials drawn from run.scene, and the
 * edges of its parents' scenes (`scenes`, by map node; every parent's must be made)
 * @param {Run} run @param {number} i @param {any[]} scenes @param {RunWorldData} data */
export function runSceneParams(run, i, scenes, data) {
  const map = /** @type {RunMap} */ (run.map),
    node = map.nodes[i],
    size = MAPGEN_SIZES.route,
    nodeSeed = runNodeSeed(run.seed, i),
    exits = runSceneExits(map, i),
    dials = runSceneDials(data.rules.scene, rngFrom(nodeSeed, 'scene|dials'));
  const edges = exits
    .filter(e => e.side === 'E')
    .map(e => {
      const parent = scenes[e.node],
        out = runSceneExitTo(map, e.node, i);
      if (!parent || !out) throw new Error(`runSceneParams: node ${i} needs node ${e.node}'s scene first`);
      const strip = mapgenEdgeStrip(parent, out.id, { w: size.w, h: size.h }, e.t);
      if (!strip) throw new Error(`runSceneParams: node ${e.node} has no exit ${out.id}`);
      return strip;
    });
  return {
    ...dials,
    /* TR-2: the debug menu's mountains run (a mod on the run, so a reload makes the same scenes): every place gets
       the tallest mountains on its north side (the back: a run goes east to west), with trails, and terraces whose
       fronts are ledges (TR-2c), for measuring them on a phone and playing the route's shape */
    ...((run.mods || []).includes(RUN_MOD_MOUNTAINS)
      ? { land: { ...(dials.land || {}), mountains: 1, massif: 'N', terraces: 0.7, cliffs: 0.45, ledges: 1 } }
      : {}),
    /* RL-8: the buildings a node's type needs, beside the main road near its middle (mapgen's props dials: MG-2) */
    props: { ...(dials.props || {}), ...(RUN_BUILDINGS[node.type] || {}) },
    kind: 'route',
    biome: node.biome || Object.keys(data.biomes)[0],
    w: size.w,
    h: size.h,
    seed: hashString(nodeSeed + '|scene') % 2147483647,
    /* its east and west edges at height 0, so it meets any neighbour with no step (two neighbours' strips overlap on
       a 64 m edge, where one scene can't follow both) */
    pin: 'EW',
    road: { ...(dials.road || {}), exits: exits.map(e => ({ side: e.side, t: e.t, width: 2 })) },
    edges,
  };
}
/** TR-2: the debug menu's run mod that gives every place mountains (runSceneParams) */
export const RUN_MOD_MOUNTAINS = 'dbg_mountains';
/** RL-8: what stands beside the main road of a node of each type: the airship's mast where it lands you, a clinic
 * (paid healing) and a shop in a town (mapgen.js MAPGEN_HUB_BUILDINGS) */
export const RUN_BUILDINGS = /** @type {Record<string, Record<string, number>>} */ ({
  landing: { mast: 1 },
  town: { clinic: 1, shop: 1 },
});
/** a run node's name (a placeholder, the owner's call: its biome and its type, "Meadow Route")
 * @param {RunMap} map @param {number} i @param {RunWorldData} data */
export function runPlaceName(map, i, data) {
  const node = map.nodes[i],
    B = data.biomes[node.biome || ''],
    T = data.nodeTypes[node.type];
  return `${B ? B.name : 'Wild'} ${T ? T.name : 'Route'}`;
}
/** node i's scene, made from its parents' (see runSceneParams), with what the game reads off a place's scene: its
 * place, name, colour grade (mood) and climate (its biome's: environment.js reads a scene's climate first)
 * @param {Run} run @param {number} i @param {any[]} scenes @param {RunWorldData} data */
export function runSceneMake(run, i, scenes, data) {
  const map = /** @type {RunMap} */ (run.map),
    B = data.biomes[map.nodes[i].biome || ''] || /** @type {Biome} */ ({}),
    { scene, notes } = mapgenScene(runSceneParams(run, i, scenes, data), {
      scenery: data.scenery,
      biomes: data.biomes,
    });
  Object.assign(scene, {
    name: runPlaceName(map, i, data),
    locationId: runPlaceId(i),
    mood: B.mood,
    climate: B.climate,
  });
  return { scene, notes };
}
/** every scene of a run's map, in order (each after its parents), by map node @param {Run} run
 * @param {RunWorldData} data @returns {any[]} */
export function runScenesMake(run, data) {
  const map = /** @type {RunMap} */ (run.map),
    scenes = /** @type {any[]} */ ([]);
  for (let i = 0; i < map.nodes.length; i++) scenes.push(runSceneMake(run, i, scenes, data).scene);
  return scenes;
}
/** node i's wild levels: rules.json run.wild's on the landing's row, perRow more on each row after (1-100)
 * @param {RunMap} map @param {number} i @param {RunWorldData} data @returns {[number, number]} */
export function runWildLevels(map, i, data) {
  const W = data.rules.wild,
    up = map.nodes[i].row * W.perRow,
    lv = /** @type {[number, number]} */ (W.lv.map(v => Math.max(1, Math.min(100, v + up))));
  return lv;
}
/** the run's world: Copperleaf (`hub`, world node 0) and a place per map node, the seam roads between them (each
 * node's north exits to its children's south ones) and each node's pool (its biome's species at its row's levels).
 * A place is an ordinary row (game-data.js worldSetGraph) plus runNode, its map node
 * @param {Run} run @param {LocationData} hub @param {RunWorldData} data
 * @returns {{ locations: LocationData[], roads: RoadLink[], pools: Record<string, Pool>, shops: Record<string, any> }} */
export function runWorldTables(run, hub, data) {
  const map = /** @type {RunMap} */ (run.map),
    /** @type {Record<string, Pool>} */
    pools = {},
    /** @type {RoadLink[]} */
    roads = [],
    /** @type {Record<string, any>} */
    shops = {};
  const places = map.nodes.map((node, i) => {
    const B = data.biomes[node.biome || ''] || /** @type {Biome} */ ({}),
      T = data.nodeTypes[node.type],
      town = node.type === 'town',
      id = runPlaceId(i),
      source = data.pools[B.pool] || data.pools[Object.keys(data.pools)[0]];
    pools[id] = {
      lv: runWildLevels(map, i, data),
      list: source.list.map(e => /** @type {[string, number]} */ ([...e])),
    };
    /** @type {LocationData} */
    const row = {
      id,
      name: runPlaceName(map, i, data),
      mapId: runMapIdOf(run.seed, i),
      kind: town ? 'town' : 'route',
      route: T ? T.name : 'Route',
      pool: id,
      battleStage: B.battleStage,
      t: node.biome || '',
      biome: node.biome || '',
      mood: B.mood,
      blurb: '',
      bowl: runSpot(map, i),
      runNode: i,
    };
    if (town) {
      row.town = 1;
      /* RL-8: its shop (stocked by the day when it opens: logic/run-loop.js runShopStock) */
      row.shop = runShopId(i);
      shops[row.shop] = {
        name: `${row.name} Shop`,
        keeper: 'The shopkeeper',
        who: 'clerk',
        greeting: 'New stock every morning. Have a look.',
        stock: [],
        runNode: i,
      };
    }
    return row;
  });
  map.nodes.forEach((node, i) =>
    node.to.forEach(j => {
      const a = runSceneExitTo(map, i, j),
        b = runSceneExitTo(map, j, i);
      if (!a || !b) throw new Error(`runWorldTables: no exits between nodes ${i} and ${j}`);
      roads.push({
        id: `road:${runPlaceId(i)}-${runPlaceId(j)}`,
        name: '',
        kind: 'seam',
        a: { map: places[i].mapId, exit: a.id },
        b: { map: places[j].mapId, exit: b.id },
      });
    })
  );
  return { locations: [hub, ...places], roads, pools, shops };
}
