// @ts-check
'use strict';
/* ================= A RUN'S SCENES AND WORLD (roguelite track RL-7) =================
   What a run's node map (logic/run-map.js) becomes when you stand in it: a walkable scene per node, made by the map
   generator (logic/mapgen.js) from the run's seed, and the world tables the game reads (game-data.js worldSetGraph):
   Copperleaf first (world node 0), then a place per map node (world node i + 1), joined by seam roads.
   - A node's scene is its footprint's size on the region grid (WM-3: runPlaceSize, 64 m a cell; a side area's 128 x
     64; a run's from before WM-3 112 x 64, MAPGEN_SIZES.route). Its exits are runSceneExits': where its links cross
     its edges (run-map.js runGridExits: east, north or south ahead, west, north or south back), the first back and
     the first ahead joined by the main road, the others branching off it; an L's cut corner walled off (`cut`).
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
import { modFoeLevels } from './modifiers.js';
import { runZoneRegion } from './run-region.js';
import {
  RUN_GRID,
  runExits,
  runGridExits,
  runGridShared,
  runGridSide,
  runNodeSeed,
  runSideLay,
  runSpot,
} from './run-map.js';
import { MAPGEN_LAYOUTS, MAPGEN_SIDE_NAME, MAPGEN_SIZES, mapgenEdgeStrip, mapgenScene } from './mapgen.js';
import { arenaGenGates } from './arena-gen.js';
import { wildPoolList } from './wild-pool.js';
/* eslint-disable no-func-assign */
expose({
  RUN_BUILDINGS: [() => RUN_BUILDINGS],
  RUN_FIELD_IN: [() => RUN_FIELD_IN],
  RUN_FIELD_PROPS: [() => RUN_FIELD_PROPS],
  RUN_LAYOUT_MOD: [() => RUN_LAYOUT_MOD],
  RUN_MOD_MOUNTAINS: [() => RUN_MOD_MOUNTAINS],
  RUN_SIDE_ID: [() => RUN_SIDE_ID],
  RUN_TOWN_ROAD: [() => RUN_TOWN_ROAD],
  fieldMoveOf: [() => fieldMoveOf],
  // @ts-expect-error -- replaced on purpose
  runAlongBack: [() => runAlongBack, v => (runAlongBack = v)],
  // @ts-expect-error -- replaced on purpose
  runArenaOf: [() => runArenaOf, v => (runArenaOf = v)],
  // @ts-expect-error -- replaced on purpose
  runCutRect: [() => runCutRect, v => (runCutRect = v)],
  // @ts-expect-error -- replaced on purpose
  runExitIds: [() => runExitIds, v => (runExitIds = v)],
  // @ts-expect-error -- replaced on purpose
  runFieldProps: [() => runFieldProps, v => (runFieldProps = v)],
  // @ts-expect-error -- replaced on purpose
  runLayoutOf: [() => runLayoutOf, v => (runLayoutOf = v)],
  // @ts-expect-error -- replaced on purpose
  runLeaderPicks: [() => runLeaderPicks, v => (runLeaderPicks = v)],
  runMapIdOf: [() => runMapIdOf],
  runOnGrid: [() => runOnGrid],
  // @ts-expect-error -- replaced on purpose
  runPiecesOf: [() => runPiecesOf, v => (runPiecesOf = v)],
  runPlaceId: [() => runPlaceId],
  // @ts-expect-error -- replaced on purpose
  runPlaceName: [() => runPlaceName, v => (runPlaceName = v)],
  // @ts-expect-error -- replaced on purpose
  runPlaceSize: [() => runPlaceSize, v => (runPlaceSize = v)],
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
  // @ts-expect-error -- replaced on purpose
  runScenesSlices: [() => runScenesSlices, v => (runScenesSlices = v)],
  runShopId: [() => runShopId],
  // @ts-expect-error -- replaced on purpose
  runSideDoor: [() => runSideDoor, v => (runSideDoor = v)],
  // @ts-expect-error -- replaced on purpose
  runSideLand: [() => runSideLand, v => (runSideLand = v)],
  // @ts-expect-error -- replaced on purpose
  runTownLife: [() => runTownLife, v => (runTownLife = v)],
  // @ts-expect-error -- replaced on purpose
  runTownQuest: [() => runTownQuest, v => (runTownQuest = v)],
  // @ts-expect-error -- replaced on purpose
  runTownResident: [() => runTownResident, v => (runTownResident = v)],
  // @ts-expect-error -- replaced on purpose
  runWildLevels: [() => runWildLevels, v => (runWildLevels = v)],
  // @ts-expect-error -- replaced on purpose
  runWorldTables: [() => runWorldTables, v => (runWorldTables = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/**
 * @typedef {{ nodeTypes: Record<string, NodeType>, biomes: Record<string, Biome>, pools: Record<string, Pool>,
 *   scenery: any, rules: { scene: RunSceneRules, layouts?: Record<string, Record<string, number>>,
 *   wild: { lv: [number, number], perRow: number, back: number }, town?: import('../../types/game-data').RunTownRules },
 *   dex?: string[] | null, fieldMoves?: Record<string, import('../../types/game-data').FieldMove>,
 *   setPieces?: import('../../types/game-data').SetPiecesData | null,
 *   arenas?: import('../../types/game-data').ArenasData | null, region?: { leaders: { id: string, type: string }[] } }} RunWorldData
 * RO-1: dex, a region's species, cuts each place's biome pool to them (logic/wild-pool.js); RL-R1: without it, the
 * run's region's (run.region.dex, its other varieties swapped to the region's)
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
/** WM-3: is the map laid out on the region grid with its exits (`ways`, runGridWays)? A run's from before WM-3 isn't:
 * its places are 112 x 64 with exits east and west (runExits) @param {RunMap} map */
export const runOnGrid = map => map.nodes.some(n => !n.side && !!n.ways);
/** WM-3: node i's place in metres: its footprint's (RUN_GRID.cell a cell), a side area's place a route's
 * (RUN_GRID.place), MAPGEN_SIZES.route's on a run from before WM-3 @param {RunMap} map @param {number} i
 * @returns {{ w: number, h: number }} */
export function runPlaceSize(map, i) {
  const n = map.nodes[i],
    C = RUN_GRID.cell;
  if (!runOnGrid(map)) return { w: MAPGEN_SIZES.route.w, h: MAPGEN_SIZES.route.h };
  const size = !n.side && n.size ? n.size : RUN_GRID.place;
  return { w: size[0] * C, h: size[1] * C };
}
/** RL-R2: where the obstacle's place opens into its side area: WM-4b, on a grid map, on the edge it shares with the
 * side area's first place (run-map.js runSideLay: north, else south, the spot furthest from its other exits there);
 * the middle of the north side before @param {RunMap} map @returns {{ side: 'N' | 'S', t: number }} */
export function runSideDoor(map) {
  const lay = runOnGrid(map) ? runSideLay(map) : null;
  return lay ? lay.door : { side: 'N', t: 0.5 };
}
/** WM-3: give exits their ids as mapgen does (mapgenStageExits): the side's name, then 2, 3 ... for the later ones on
 * the same side, in the order the scene is made with them
 * @param {{ side: 'E' | 'W' | 'N' | 'S', t: number, node: number }[]} exits */
export function runExitIds(exits) {
  /** @type {Record<string, number>} */
  const used = {};
  return exits.map(e => {
    used[e.side] = (used[e.side] || 0) + 1;
    return { ...e, id: MAPGEN_SIDE_NAME[e.side] + (used[e.side] > 1 ? used[e.side] : '') };
  });
}
/** a node's exits in the order its scene is made with them, with the ids the generator gives them: the first back,
 * the first ahead (the main road between them), then the other back and ahead ones. WM-3: on the region grid each on
 * the side its link crosses, where it crosses it (runGridExits); on a run from before, back by the west and ahead by
 * the east at RUN_EXIT_T (WM-1: runs go west to east)
 * @param {RunMap} map @param {number} i
 * @returns {{ side: 'E' | 'W' | 'N' | 'S', t: number, id: string, node: number }[]} node: the neighbour the exit leads
 * to. RL-R2: a side area's places and the obstacle's door into it (run-side.js, runSideDoor) */
export function runSceneExits(map, i) {
  const S = map.side;
  /* RL-R2: a side area's place: its first comes in from the obstacle's place (by the side facing its door), the
     others from the one before; each but the last goes on to the next. WM-4b: on a grid map each link where the
     places' cells meet (run-map.js runSideLay: the door's spot, else the middle of the edge they share); before, the
     first by the middle of the side facing the door, the others west to east by their middles */
  if (S && map.nodes[i].side) {
    const k = S.nodes.indexOf(i),
      next = S.nodes[k + 1],
      lay = runOnGrid(map) ? runSideLay(map) : null,
      door = runSideDoor(map),
      C = RUN_GRID.cell;
    /** where node i's place meets the side place k + d (d -1 the one before, 1 the next) or the obstacle's */
    const link = (/** @type {number} */ d) => {
      const node = d < 0 ? (k ? S.nodes[k - 1] : S.from) : /** @type {number} */ (next);
      if (!lay) {
        if (k === 0 && d < 0)
          return { side: door.side === 'N' ? /** @type {'S'} */ ('S') : /** @type {'N'} */ ('N'), t: 0.5, node };
        return { side: d < 0 ? /** @type {'W'} */ ('W') : /** @type {'E'} */ ('E'), t: 0.5, node };
      }
      const me = lay.cells[k],
        F = map.nodes[S.from],
        other =
          k === 0 && d < 0
            ? { at: /** @type {number[]} */ (F.at), size: /** @type {number[]} */ (F.size) }
            : lay.cells[k + d],
        side = /** @type {'E' | 'W' | 'N' | 'S'} */ (
          runGridSide(me, other) || (k === 0 && d < 0 ? (door.side === 'N' ? 'S' : 'N') : d < 0 ? 'S' : 'N')
        ),
        ax = side === 'E' || side === 'W' ? 1 : 0,
        len = me.size[ax] * C;
      if (k === 0 && d < 0 && runGridSide(me, other)) {
        /* the obstacle's door, measured from its place's west end */
        const u = /** @type {number[]} */ (F.at)[0] * C + door.t * /** @type {number[]} */ (F.size)[0] * C;
        return { side, t: (u - me.at[0] * C) / len, node };
      }
      const sh = runGridShared(me, other);
      return { side, t: sh ? (((sh[0] + sh[1]) / 2 - me.at[ax]) * C) / len : 0.5, node };
    };
    return runExitIds([link(-1), ...(next === undefined ? [] : [link(1)])]);
  }
  const G = runOnGrid(map) ? runGridExits(map, i) : null;
  /** @type {{ side: 'E' | 'W' | 'N' | 'S', t: number, node: number }[]} */
  let out;
  if (G) out = G.map(e => ({ side: e.side, t: e.t, node: e.node }));
  else {
    const ex = runExits(map, i),
      W = ex.back.map(e => ({ side: /** @type {'W'} */ ('W'), t: e.t, node: e.from })),
      E = ex.ahead.map(e => ({ side: /** @type {'E'} */ ('E'), t: e.t, node: e.to }));
    out = [W[0], E[0], W[1], E[1]].filter(e => !!e);
  }
  if (S && S.from === i) out.push({ ...runSideDoor(map), node: S.nodes[0] });
  return runExitIds(out);
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
    size = runPlaceSize(map, i),
    nodeSeed = runNodeSeed(run.seed, i),
    exits = runSceneExits(map, i),
    dials = runSceneDials(data.rules.scene, rngFrom(nodeSeed, 'scene|dials')),
    layout = runLayoutOf(run, i, data),
    pieces = layout ? runPiecesOf(run, i, data) : 0,
    arena = runArenaOf(run, i, data);
  /* its parents: the neighbours made before it (a main place's west ones; RL-R2: a side place's south or west one) */
  const edges = exits
    .filter(e => e.node < i)
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
       the tallest mountains on its north and south sides (the back and the camera's side: a run goes west to east;
       south since TR-3's camera), with trails, and terraces whose fronts are ledges (TR-2c), for measuring them on a
       phone and playing the route's shape */
    ...((run.mods || []).includes(RUN_MOD_MOUNTAINS)
      ? { land: { ...(dials.land || {}), mountains: 1, massif: 'NS', terraces: 0.7, cliffs: 0.45, ledges: 1 } }
      : {}),
    /* RL-8: the buildings a node's type needs, beside the main road near its middle (mapgen's props dials: MG-2) */
    props: { ...(dials.props || {}), ...(RUN_BUILDINGS[node.type] || {}) },
    /* RL-R2: a side area's own land (fieldMoves.json `land`: Surf's coast water, walked on by riding; RL-R2b: the
       cave's rock walls) */
    ...(node.side && fieldMoveOf(map, data)
      ? runSideLand(/** @type {any} */ (fieldMoveOf(map, data)), node, dials)
      : {}),
    /* RT-1: a laid-out place's plan (a route, the landing, a mini-boss's or the boss's place) */
    ...(layout ? { layout } : {}),
    /* RT-3: and its set pieces (setPieces.json perPlace) */
    ...(pieces ? { pieces } : {}),
    /* WM-7: a mini-boss's ring on the road and the boss's arena (logic/arena-gen.js); WM-3: which of its exits lead
       on (`on`, by their order here), so the barrier stands between them and the ways in */
    ...(arena ? { arena: { ...arena, on: exits.flatMap((e, k) => (node.to.includes(e.node) ? [k] : [])) } } : {}),
    /* RL-14: a scrapyard's set pieces lean to its own (setPieces.json sites) */
    ...(node.type === 'scrapyard' ? { site: 'scrapyard' } : {}),
    /* TW-1: a town node is a town (mapgen.js mapgenStageTown: a street, a square, houses) */
    kind: node.type === 'town' ? 'town' : 'route',
    biome: node.biome || Object.keys(data.biomes)[0],
    w: size.w,
    h: size.h,
    seed: hashString(nodeSeed + '|scene') % 2147483647,
    /* its east and west edges at height 0, so it meets any neighbour with no step (two neighbours' strips overlap on
       a 64 m edge, where one scene can't follow both); WM-3: and every other side an exit crosses */
    pin: globalThis.PINEW ? 'EW' : [...new Set('EW' + exits.map(e => e.side).join(''))].join(''),
    /* WM-1: the way on leaves by the east (the tall grass across it, the pinches along it); WM-3: by the side of its
       first exit ahead (north or south on the grid), east when it has none */
    ahead: (exits.find(e => node.to.includes(e.node)) || { side: 'E' }).side,
    /* WM-3: an L's cut corner, walled off (metres: x, z of its south-west corner, then its north-east) */
    ...(node.cut && node.at && runOnGrid(map) ? { cut: runCutRect(node) } : {}),
    road: {
      ...(dials.road || {}),
      /* TW-1: a town's through road runs straight, so its street and square have room beside it */
      ...(node.type === 'town' ? RUN_TOWN_ROAD : {}),
      exits: exits.map(e => ({ side: e.side, t: e.t, width: 2 })),
    },
    /* TW-1: a town has no lookout, bridge or glade of its own */
    ...(node.type === 'town' ? { feature: 'none' } : {}),
    edges,
  };
}
/** WM-3: an L's cut cell as a rectangle in its place's metres: [x0, z0, x1, z1] (x east, z north)
 * @param {import('../../types/save-data').RunNode} node @returns {[number, number, number, number]} */
export function runCutRect(node) {
  const C = RUN_GRID.cell,
    [cx, cy] = /** @type {number[]} */ (node.cut),
    [ax, ay] = /** @type {number[]} */ (node.at);
  return [(cx - ax) * C, (cy - ay) * C, (cx - ax + 1) * C, (cy - ay + 1) * C];
}
/** the leader each mini-boss's and the boss's node asks for, by node (logic/run-loop.js runFoes fields it): RL-R1: the
 * region's leaders (run.region.leaders, the mini-bosses in order then the boss) while there are any; RL-R2: a side
 * area's own (run.map.side.leader; its places come after the main path's). Undefined where the run has none to ask for
 * (runFoes then draws one) @param {Run} run @returns {Record<number, string | undefined>} */
export function runLeaderPicks(run) {
  const map = /** @type {RunMap} */ (run.map),
    picks = (run.region && run.region.leaders) || [],
    /** @type {Record<number, string | undefined>} */
    out = {};
  let k = 0;
  map.nodes.forEach((node, i) => {
    if (node.type !== 'miniboss' && node.type !== 'boss') return;
    out[i] = node.side && map.side ? map.side.leader : picks[k++];
  });
  return out;
}
/** WM-7: node i's arena dial (logic/arena-gen.js), or null: a mini-boss's place gets a leader's ring and the boss's its
 * own, sized by arenas.json sizes and themed by its leader's type (the region's leaders' types; arenas.json themes,
 * `plain` for a type with none or a leader the run doesn't name). None without arenas.json
 * @param {Run} run @param {number} i @param {RunWorldData} data @returns {any} */
export function runArenaOf(run, i, data) {
  const A = data.arenas,
    node = /** @type {RunMap} */ (run.map).nodes[i];
  if (!A || (node.type !== 'miniboss' && node.type !== 'boss')) return null;
  const id = runLeaderPicks(run)[i],
    L = ((data.region && data.region.leaders) || []).find(x => x.id === id),
    mode = node.type === 'boss' ? 'boss' : 'leader';
  return { mode, ...A.sizes[mode], ...((L && A.themes[L.type]) || A.themes.plain) };
}
/** RT-1: the debug menu's run mod that gives every laid-out place one plan: the mod is this and the plan's id */
export const RUN_LAYOUT_MOD = 'dbg_layout_';
/** RT-1: node i's layout plan, or null: a place whose node type says layout (nodeTypes.json) draws one from
 * rules.json run.layouts by its biome (`default` for one not listed), from its own stream (so the other dials' draws
 * don't move); the debug menu's mod (RUN_LAYOUT_MOD) picks it instead
 * @param {Run} run @param {number} i @param {RunWorldData} data @returns {string | null} */
export function runLayoutOf(run, i, data) {
  const map = /** @type {RunMap} */ (run.map),
    node = map.nodes[i],
    T = data.nodeTypes[node.type];
  if (!T || !T.layout) return null;
  const forced = (run.mods || []).find(m => m.startsWith(RUN_LAYOUT_MOD));
  if (forced) {
    const id = forced.slice(RUN_LAYOUT_MOD.length);
    return Object.hasOwn(MAPGEN_LAYOUTS, id) ? id : null;
  }
  const L = data.rules.layouts,
    W = L && (L[node.biome || ''] || L.default);
  if (!W || !Object.values(W).some(w => w > 0)) return null;
  const id = rngFrom(runNodeSeed(run.seed, i), 'scene|layout').pick(Object.fromEntries(Object.entries(W).sort()));
  return id === 'none' ? null : id;
}
/** RT-3: how many set pieces node i's place asks for: setPieces.json perPlace, drawn from its own stream (so no other
 * dial's draw moves); 0 with no set pieces. Only a laid-out place asks (runSceneParams)
 * @param {Run} run @param {number} i @param {RunWorldData} data @returns {number} */
export function runPiecesOf(run, i, data) {
  const S = data.setPieces;
  if (!S || !S.perPlace) return 0;
  return rngFrom(runNodeSeed(run.seed, i), 'scene|pieces').int(S.perPlace[0], S.perPlace[1]);
}
/** TW-1: a town's through road (mapgen's road dials): a little wobble; WM-5: square turns between straight stretches
 * (mapgen.js 'dogleg'), so its streets and square have room beside it whatever heights its exits are at */
export const RUN_TOWN_ROAD = { shape: 'dogleg', wobble: 0.25 };
/** RL-R2b: a side place's land dials: the move's `land` over the run's, and a town's `townLand` over both (Surf's
 * islet) @param {any} M the field move @param {RunMap['nodes'][number]} node @param {any} dials */
export function runSideLand(M, node, dials) {
  if (!M.land && !(node.type === 'town' && M.townLand)) return {};
  return { land: { ...(dials.land || {}), ...(M.land || {}), ...(node.type === 'town' ? M.townLand || {} : {}) } };
}
/** TR-2: the debug menu's run mod that gives every place mountains (runSceneParams) */
export const RUN_MOD_MOUNTAINS = 'dbg_mountains';
/** RL-8: what stands beside the main road of a node of each type: the airship's mast where it lands you, a clinic
 * (paid healing) and a shop in a town (mapgen.js MAPGEN_HUB_BUILDINGS); RL-12b: a waystation's stand (its event) and
 * a stall (its shop, no clinic) */
export const RUN_BUILDINGS = /** @type {Record<string, Record<string, number>>} */ ({
  landing: { mast: 1 },
  town: { clinic: 1, shop: 1 },
  event: { stand: 1 },
  stall: { stall: 1 },
});
/** RL-R2: the run's side area's field move (fieldMoves.json), or null @param {RunMap} map @param {RunWorldData} data */
export const fieldMoveOf = (map, data) => (map.side && data.fieldMoves && data.fieldMoves[map.side.move]) || null;
/** RL-R2: what stands for a field move's obstacle (on the north exit's road, before the seam) and for a side area's
 * way out (at its last place's road end): scenery.json props */
export const RUN_FIELD_PROPS = /** @type {Record<string, { obstacle: string, out: string }>} */ ({
  thorns: { obstacle: 'bush_bramble', out: 'signpost' },
  boulder: { obstacle: 'boulder_granite', out: 'mine_entrance' },
  shore: { obstacle: 'rowboat', out: 'fishing_boat' },
});
/** RL-R2: how far in from its door (the north exit; WM-3: or the south) the obstacle stands (metres along the exit's road; past the walk's seamIn) */
export const RUN_FIELD_IN = 8;
/** RL-R2: put the side area's props on a made scene: the obstacle on the obstacle's place (act 'field', gone once
 * open: `unless`), the way out on the side's last place (act 'fieldout'); a ridden area's places are ridden
 * @param {RunMap} map @param {number} i @param {any} scene @param {RunWorldData} data */
export function runFieldProps(map, i, scene, data) {
  const S = map.side,
    M = fieldMoveOf(map, data);
  if (!S || !M) return;
  const P = RUN_FIELD_PROPS[M.obstacle] || RUN_FIELD_PROPS.thorns;
  if (i === S.from) {
    const door = runSceneExitTo(map, i, S.nodes[0]),
      e = door && (scene.edgeExits || []).find((/** @type {any} */ x) => x.id === door.id);
    if (!e) return;
    const at = runAlongBack(e.path, RUN_FIELD_IN);
    scene.props.push({
      k: P.obstacle,
      x: at[0],
      z: at[1],
      g: 1,
      act: 'field',
      move: S.move,
      label: M.name,
      unless: `opened:${S.move}`,
    });
  }
  if (map.nodes[i].side && M.ride) scene.ride = 1;
  if (i === S.nodes[S.nodes.length - 1] && S.to >= 0) {
    const h = scene.hub || [scene.w / 2, scene.h / 2];
    scene.props.push({ k: P.out, x: h[0], z: h[1] + 2, g: 1, act: 'fieldout', move: S.move, label: 'Way out' });
  }
}
/** the point `d` metres back from a path's end, along it (its start when it is shorter) @param {number[][]} path
 * @param {number} d @returns {number[]} */
export function runAlongBack(path, d) {
  let left = d;
  for (let k = path.length - 1; k > 0; k--) {
    const [ax, az] = path[k],
      [bx, bz] = path[k - 1],
      seg = Math.hypot(bx - ax, bz - az);
    if (seg >= left) {
      const f = left / seg;
      return [Math.round((ax + (bx - ax) * f) * 100) / 100, Math.round((az + (bz - az) * f) * 100) / 100];
    }
    left -= seg;
  }
  return path[0].slice();
}
/** a run node's name (a placeholder, the owner's call: its biome and its type, "Meadow Route"; RL-S2: the type's
 * `place` word when it has one)
 * @param {RunMap} map @param {number} i @param {RunWorldData} data */
export function runPlaceName(map, i, data) {
  const node = map.nodes[i],
    B = data.biomes[node.biome || ''],
    T = data.nodeTypes[node.type];
  /* RL-S2: a type's own word for its place, when it has one (a rival's place is a Route) */
  const word = T ? T.place || T.name : 'Route';
  /* RL-R2: a side area's places carry its name ("Bramble Grove Town") */
  if (node.side && map.side) return `${map.side.name} ${word}`;
  return `${B ? B.name : 'Wild'} ${word}`;
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
      setPieces: data.setPieces || null,
    });
  Object.assign(scene, {
    name: runPlaceName(map, i, data),
    locationId: runPlaceId(i),
    mood: B.mood,
    climate: B.climate,
  });
  runFieldProps(map, i, scene, data);
  /* WM-7: a leader's gate, shut until it is beaten (its foe's id: run-loop.js runFoeId) */
  arenaGenGates(scene, data.scenery, `beat:${runPlaceId(i)}_foe`);
  if (scene.kind === 'town') {
    runTownLife(run, i, scene, data);
    runTownQuest(run, i, scene, data);
  }
  return { scene, notes };
}
/** TW-2: a run town's own life, from its node's stream ('town|life'): its region's chat lines after its biome's
 * (rules.json run.town.chat by the region's theme), and its named locals (scene.people), run.town.locals of them on
 * the town's local spots (mapgen.js: the square's first, then a house's gate drawn), each with a seeded look (a
 * townsfolk one), a name from run.town.names (none twice in a town) and two of the biome's lines
 * @param {Run} run @param {number} i @param {any} scene @param {RunWorldData} data */
export function runTownLife(run, i, scene, data) {
  const T = data.rules.town;
  if (!T) return;
  const own = (run.region && T.chat[run.region.theme]) || [],
    lines = scene.chat || [];
  if (own.length) scene.chat = lines.concat(own);
  const rnd = rngFrom(runNodeSeed(run.seed, i), 'town|life'),
    spots = (scene.spots || []).filter((/** @type {any} */ s) => s.kind === 'local'),
    gates = spots.slice(1),
    names = T.names.slice(),
    n = Math.min(spots.length, rnd.int(T.locals[0], T.locals[1])),
    people = [];
  for (let k = 0; k < n && names.length; k++) {
    const at = k ? gates.splice(rnd.int(0, gates.length - 1), 1)[0] : spots[0];
    if (!at) break;
    const name = names.splice(rnd.int(0, names.length - 1), 1)[0],
      said = lines.length ? [rnd.int(0, lines.length - 1)] : [];
    if (lines.length > 1) said.push((said[0] + 1 + rnd.int(0, lines.length - 2)) % lines.length);
    people.push({
      id: `local${k}`,
      who: 'folk:' + rnd.int(1000, 99999),
      name,
      x: at.x,
      z: at.z,
      dir: 'down',
      lines: said.map(q => lines[q]),
    });
  }
  if (people.length) scene.people = people;
}
/** TW-3: a run town's quest giver (scene.people id 'quest', `quest: 1`: quest-board.js offers the town's quest),
 * from the node's own stream ('town|quest', so the locals' draws stay as they were): on the giver's spot by the notice
 * board (mapgen.js), a seeded townsfolk look and a name from run.town.names that none of the town's locals has. None
 * when the town has no board (its square didn't fit) @param {Run} run @param {number} i @param {any} scene
 * @param {RunWorldData} data */
export function runTownQuest(run, i, scene, data) {
  const T = data.rules.town,
    at = (scene.spots || []).find((/** @type {any} */ s) => s.kind === 'giver');
  if (!T || !at) return;
  const rnd = rngFrom(runNodeSeed(run.seed, i), 'town|quest'),
    taken = new Set((scene.people || []).map((/** @type {any} */ p) => p.name)),
    names = T.names.filter(n => !taken.has(n));
  if (!names.length) return;
  const name = names[rnd.int(0, names.length - 1)];
  scene.people = (scene.people || []).concat([
    { id: 'quest', who: 'folk:' + rnd.int(1000, 99999), name, x: at.x, z: at.z, dir: 'down', lines: [], quest: 1 },
  ]);
}
/** RS-2: a run's resident standing in a town (scene.people id 'resident', `resident: <id>`: quest-board.js offers
 * their favour or their invite), on the first of the town's local spots nobody stands on (mapgen.js: the square's
 * first, then the houses' gates), else beside the square's. Their look is their own (RS-3: people/<id>.json), the same
 * in every run @param {any} scene @param {string} id @param {string} name */
export function runTownResident(scene, id, name) {
  if (!scene) return;
  const people = scene.people || [],
    spots = (scene.spots || []).filter((/** @type {any} */ s) => s.kind === 'local'),
    free = spots.find(
      (/** @type {any} */ s) => !people.some((/** @type {any} */ p) => Math.hypot(p.x - s.x, p.z - s.z) < 1)
    ),
    at = free || (spots[0] ? { x: spots[0].x + 1.2, z: spots[0].z } : null);
  if (!at) return;
  /* RS-3: their look is the person of their id (people/<id>.json, the data check asks for one) */
  scene.people = people.concat([
    { id: 'resident', who: id, name, x: at.x, z: at.z, dir: 'down', lines: [], resident: id },
  ]);
}
/** WM-3b: how long one place took to make, for the debug log: its node, type, size, shape ('L' with a cut corner,
 * else '') and milliseconds. Nothing else: no names, nothing of the save
 * @typedef {[number, string, number, number, string, number]} RunPlaceTime */
/** every scene of a run's map, in order (each after its parents), by map node @param {Run} run
 * @param {RunWorldData} data @param {RunPlaceTime[]} [times] filled with each place's (WM-3b) @returns {any[]} */
export function runScenesMake(run, data, times) {
  const it = runScenesSlices(run, data, times);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}
/** HB-2: the same scenes one at a time, so the page can make them over several frames behind its loading screen:
 * each step makes one and yields how many are made of how many; the last returns the scenes
 * @param {Run} run @param {RunWorldData} data @param {RunPlaceTime[]} [times] filled with each place's (WM-3b)
 * @returns {Generator<[number, number], any[], void>} */
export function* runScenesSlices(run, data, times) {
  const map = /** @type {RunMap} */ (run.map),
    scenes = /** @type {any[]} */ ([]);
  for (let i = 0; i < map.nodes.length; i++) {
    const t0 = Date.now(),
      sc = runSceneMake(run, i, scenes, data).scene,
      node = map.nodes[i];
    scenes.push(sc);
    if (times) times.push([i, node.type, sc.w, sc.h, node.cut ? 'L' : '', Date.now() - t0]);
    if (i + 1 < map.nodes.length) yield [i + 1, map.nodes.length];
  }
  return scenes;
}
/** node i's wild levels: rules.json run.wild's on the landing's row, perRow more on each row after, and `more` (RL-13:
 * the run's Expedition, effects.js modFoeLevels) on all of them (1-100)
 * @param {RunMap} map @param {number} i @param {RunWorldData} data @param {number} [more] @returns {[number, number]} */
export function runWildLevels(map, i, data, more = 0) {
  const W = data.rules.wild,
    up = map.nodes[i].row * W.perRow + more,
    lv = /** @type {[number, number]} */ (W.lv.map(v => Math.max(1, Math.min(100, v + up))));
  return lv;
}
/** the run's world: Copperleaf (`hub`, world node 0) and a place per map node, the seam roads between them (each
 * node's east exits to its children's west ones) and each node's pool (its biome's species at its row's levels).
 * A place is an ordinary row (game-data.js worldSetGraph) plus runNode, its map node
 * @param {Run} run @param {LocationData} hub @param {RunWorldData} data
 * @returns {{ locations: LocationData[], roads: RoadLink[], pools: Record<string, Pool>, shops: Record<string, any> }} */
export function runWorldTables(run, hub, data) {
  const map = /** @type {RunMap} */ (run.map),
    /* RL-R1: the run's region: its dex (data.dex stands in when given) and its varieties */
    region = run.region || null,
    dex = data.dex !== undefined ? data.dex : region ? region.dex : null,
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
      /* RL-12b: a node type that sells (nodeTypes.json shop: a town, a stall) */
      sells = !!(T && T.shop),
      id = runPlaceId(i),
      source = data.pools[B.pool] || data.pools[Object.keys(data.pools)[0]];
    /* RL-R2: a side area's places meet its own species (lines the region left out), when it has them */
    const own = node.side && map.side && map.side.dex ? map.side.dex : null;
    pools[id] = {
      lv: runWildLevels(map, i, data, modFoeLevels(run)),
      list: own ? wildPoolList(source.list, own, null) : wildPoolList(source.list, dex, region ? region.swap : null),
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
    /* RL-R1: its zone's ground on the world map (run-bowl.js), so the run's land reads as bands of zones */
    if (node.zone !== undefined) row.region = runZoneRegion(node.zone);
    /* RL-R2: a side area's first place is closed until its obstacle is open (rules.js canEnter, gateText) */
    if (map.side && i === map.side.nodes[0]) row.field = map.side.move;
    if (node.side) row.side = 1;
    /* RL-12b: a waystation (an event's or a stall's place) has fewer wild Billies (rules.js encounterStock) */
    if (node.type === 'event' || node.type === 'stall') row.waystation = 1;
    if (town) row.town = 1;
    if (sells) {
      /* RL-8: its shop (stocked by the day when it opens: logic/run-loop.js runShopStock); RL-12b: a stall's too */
      row.shop = runShopId(i);
      shops[row.shop] = {
        name: town ? `${row.name} Shop` : row.name,
        keeper: town ? 'The shopkeeper' : 'The stallholder',
        who: 'clerk',
        greeting: town ? 'New stock every morning. Have a look.' : 'Fresh off the cart this morning. Have a look.',
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
  /* RL-R2: the seam from the obstacle's place north into its side area */
  const S = map.side;
  if (S) {
    const a = runSceneExitTo(map, S.from, S.nodes[0]),
      b = runSceneExitTo(map, S.nodes[0], S.from);
    if (!a || !b) throw new Error('runWorldTables: no exits between the obstacle and its side area');
    roads.push({
      id: `road:${runPlaceId(S.from)}-${runPlaceId(S.nodes[0])}`,
      name: '',
      kind: 'seam',
      a: { map: places[S.from].mapId, exit: a.id },
      b: { map: places[S.nodes[0]].mapId, exit: b.id },
    });
  }
  /* RL-8b: the run's map is its own land: Copperleaf stays world node 0 (flying home, a save's checks) but is off it */
  const home = { ...hub, bowl: { a: 0, r: 0, ...hub.bowl, off: true } };
  return { locations: [home, ...places], roads, pools, shops };
}
