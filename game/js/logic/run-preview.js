// @ts-check
'use strict';
/* ================= A RUN'S PREVIEW (Studio plan Phase 2, T2.4) =================
   What a run from a seed holds, worked out by the game's own logic on the game data as game-data.js reads it (its
   POOLS with stand-ins, TRAINERS, PERKS, RULES): the start (run-start.js runStartPlan, as the mast takes off), then
   - each mini-boss's and the boss's foe (run-loop.js runFoes, with the leaders run-world.js passes); RL-S2: Blake's
     on each rival node, against the first starter unless told otherwise;
   - each town's and stall's (RL-12b) stock on every day from the first it can be reached (its row + 1) to RUN_PREVIEW_LATE days past the
     shortest walk's last day (runShopStock with
     the run's shop unlocks, as shop.js opens it) and its shelf's Perk that day (perkShelf);
   - each place's wild table (run-scenes.js runWorldTables: its biome's pool at its row's levels), the side area's
     places too (RL-R2b: map.side, from the field moves as run-world.js passes them);
   - each waystation's event (RL-12b: encounters.js eventAt, with none played yet);
   - the Perk picks after each mini-boss row, in order (perkOfferMake), with nothing held;
   - RS-2: the run's resident on a first run (nobody in Copperleaf: the free first one) and on a later one (the first
     one living there): who, the towns they stand in (run-quests.js residentPlan; every town counted as having its
     notice board, which a town's square almost always fits) and the waystations whose event would be theirs.
   Held Perks change the shelves and the picks; the preview holds none. The Studio's Run Lab asks for it through its
   logic worker (studio/js/logic-worker.js), where GAMEDATA is the Studio's draft; it is on no page, since game-data.js
   would read the Studio's data as the game's (tools/test/run-preview.test.mjs compares it with the game's own path).
   Logic only: no DOM, no Date, no Math.random. */
/** @import { Run, RunMap } from '../../types/save-data' */
import {
  EVENTS,
  FIELD_MOVES,
  ARENAS,
  SET_PIECES,
  POOLS,
  NODE_TYPES,
  PERKS,
  QUESTS,
  RESIDENTS,
  RULES,
  SPECIES,
  START_NODE,
  TRAINERS,
  UNLOCK_DATA,
  gameData,
} from '../game-data.js';
import { MAPGEN_VERSION } from './mapgen.js';
import { perkOfferMake, perkShelf } from './perks.js';
import { runFoes, runShopStock } from './run-loop.js';
import { eventAt } from './encounters.js';
import { runPlaceId, runWorldTables } from './run-scenes.js';
import { runStartPlan } from './run-start.js';
import { runRegionData } from './run-region.js';
import { copyOf, newRun } from './run-state.js';
import { rivalRunStart } from './rival.js';
import { unlockOpen } from './unlocks.js';
import { runRouteTrainers } from './route-trainers.js';
import { residentCandidate } from './residents.js';
import { residentPlan } from './run-quests.js';

/** RL-R2: the days a town's stock is shown past the shortest walk's last day (the deadline's old slack: the owner
 * dropped the deadline) */
const RUN_PREVIEW_LATE = 3;
/** run-world.js runWorldData: what a run's tables are made from */
const runPreviewData = () => ({
  nodeTypes: NODE_TYPES,
  biomes: gameData.biomes || {},
  pools: POOLS,
  scenery: gameData.scenery,
  rules: RULES.run,
  region: runRegionData(gameData, TRAINERS),
  /* RL-R2b: the field moves, so a preview has the run's side area as the game does */
  fieldMoves: FIELD_MOVES,
  /* RT-3: and the set pieces, so a preview's places are the game's */
  setPieces: SET_PIECES,
  /* WM-7: and the leaders' arenas */
  arenas: ARENAS,
});

/**
 * a run's preview from its seed. `unlocks` is what the run carries (unlocks.js runUnlocks), `map` overrides rules.json
 * run.map (the debug menu's short map), `expedition` the run's Expedition; RL-S2: `lead` the Billie Blake counters
 * (the first starter's first species unless given) and `past` his meetings before the run (0)
 * @param {string} seed @param {{ unlocks?: string[], map?: object, expedition?: number, lead?: string, past?: number }} [o]
 */
export function runPreview(seed, o = {}) {
  const data = runPreviewData(),
    plan = runStartPlan(
      seed,
      { ...data, unlockData: UNLOCK_DATA },
      { unlocks: o.unlocks, map: o.map, expedition: o.expedition }
    ),
    /** @type {Run} */
    run = newRun(seed, plan.give.expedition, MAPGEN_VERSION, /** @type {any} */ ({}));
  run.unlocks = plan.unlocks.slice();
  run.map = copyOf(plan.map);
  run.forecast = copyOf(plan.forecast);
  if (plan.region) run.region = copyOf(plan.region);
  run.rival = { ...rivalRunStart(o.lead || `${RULES.start.starters[0]}0`, []), past: o.past || 0 };
  const map = /** @type {RunMap} */ (run.map),
    foes = runFoes(run, { leaders: Object.values(TRAINERS).filter(T => T.miniboss), rules: RULES.run }),
    W = runWorldTables(run, gameData.locations[START_NODE], /** @type {any} */ (data)),
    rule = RULES.run.shop,
    shopRule = { ...rule, pick: unlockOpen(rule.pick, 'shop', run.unlocks, UNLOCK_DATA) };
  const lastDay = 1 + Math.max(...map.nodes.map(n => n.row)) + RUN_PREVIEW_LATE;
  const nodes = map.nodes.map((n, i) => {
    /** @type {{ day: number, stock: any[], relic: string }[] | null} */
    let shop = null;
    /* a town's or a stall's (RL-12b: nodeTypes.json shop) */
    if (data.nodeTypes[n.type] && data.nodeTypes[n.type].shop) {
      shop = [];
      for (let day = n.row + 1; day <= lastDay; day++)
        shop.push({
          day,
          stock: runShopStock(run, i, day, shopRule),
          relic: perkShelf(run, i, day, PERKS, RULES.run.perks),
        });
    }
    return {
      wild: W.pools[runPlaceId(i)],
      foe: Object.values(foes).find(F => F.runNode === i) || null,
      shop,
      /* RL-12b: a waystation's event as drawn with none played yet (an event played earlier in the run leaves the
         pool, so a later stand may hold another; SP-6: an event with a `when` is left out, as for a new save) */
      event: n.type === 'event' ? eventAt(run, i, EVENTS) || null : null,
    };
  });
  const relicOffers = [],
    guards = new Set(map.nodes.filter(n => n.type === 'miniboss').map(n => n.row)).size;
  for (let k = 0; k < guards; k++) relicOffers.push(perkOfferMake(run, PERKS, RULES.run.perks) || []);
  return {
    seed,
    expedition: plan.give.expedition,
    unlocks: run.unlocks,
    map,
    forecast: run.forecast,
    nodes,
    relicOffers,
    residents: runPreviewResidents(run),
  };
}
/** RS-2: the run's resident on a first run and on a later one (the free first one living in Copperleaf): who, their
 * towns, and the waystations whose event would be theirs (encounters.js eventAt with them to meet, none played yet)
 * @param {Run} run */
function runPreviewResidents(run) {
  const trainers = runRouteTrainers(run, { classes: EVENTS.classes, species: SPECIES, rules: RULES.run }),
    at = /** @type {Record<number, number>} */ ({});
  for (const T of Object.values(trainers)) at[T.runNode] = (at[T.runNode] || 0) + 1;
  const nodes = /** @type {RunMap} */ (run.map).nodes,
    data = {
      quests: QUESTS,
      species: SPECIES,
      boards: nodes.flatMap((n, i) => (n.type === 'town' ? [i] : [])),
      trainersAt: (/** @type {number} */ i) => at[i] || 0,
    },
    first = Object.keys(RESIDENTS).find(id => RESIDENTS[id].first);
  /** @param {Record<string, number>} here */
  const one = here => {
    const s = /** @type {any} */ ({ meta: { residents: here, runs: 1 }, run: copyOf(run) }),
      plan = residentPlan(s, RESIDENTS, data);
    if (!plan) return null;
    const meet = !!residentCandidate(s, RESIDENTS, 'event'),
      events = nodes.flatMap((n, i) => {
        const ev = n.type === 'event' ? eventAt(s.run, i, EVENTS, undefined, meet) : '';
        return ev && EVENTS.events[ev].resident ? [i] : [];
      }),
      F = QUESTS.favours[plan.id];
    return { id: plan.id, towns: plan.towns, kind: (F && F.kind) || '', events };
  };
  return { first: one({}), next: first ? one({ [first]: 1 }) : null };
}
