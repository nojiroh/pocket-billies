// @ts-check
'use strict';
/* ================= A RUN'S PREVIEW (Studio plan Phase 2, T2.4) =================
   What a run from a seed holds, worked out by the game's own logic on the game data as game-data.js reads it (its
   POOLS with stand-ins, TRAINERS, PERKS, RULES): the start (run-start.js runStartPlan, as the mast takes off), then
   - each mini-boss's and the boss's foe (run-loop.js runFoes, with the leaders run-world.js passes);
   - each town's stock on every day from the first it can be reached (its row + 1) to the deadline (runShopStock with
     the run's shop unlocks, as shop.js opens it) and its shelf's Perk that day (perkShelf);
   - each place's wild table (run-scenes.js runWorldTables: its biome's pool at its row's levels);
   - the Perk picks after each mini-boss row, in order (perkOfferMake), with nothing held.
   Held Perks change the shelves and the picks; the preview holds none. The Studio's Run Lab asks for it through its
   logic worker (studio/js/logic-worker.js), where GAMEDATA is the Studio's draft; it is on no page, since game-data.js
   would read the Studio's data as the game's (tools/test/run-preview.test.mjs compares it with the game's own path).
   Logic only: no DOM, no Date, no Math.random. */
/** @import { Run, RunMap } from '../../types/save-data' */
import { POOLS, NODE_TYPES, PERKS, RULES, START_NODE, TRAINERS, UNLOCK_DATA, gameData } from '../game-data.js';
import { MAPGEN_VERSION } from './mapgen.js';
import { perkOfferMake, perkShelf } from './perks.js';
import { runFoes, runShopStock } from './run-loop.js';
import { runPlaceId, runWorldTables } from './run-scenes.js';
import { runStartPlan } from './run-start.js';
import { runRegionData } from './run-region.js';
import { copyOf, newRun } from './run-state.js';
import { unlockOpen } from './unlocks.js';

/** run-world.js runWorldData: what a run's tables are made from */
const runPreviewData = () => ({
  nodeTypes: NODE_TYPES,
  biomes: gameData.biomes || {},
  pools: POOLS,
  scenery: gameData.scenery,
  rules: RULES.run,
  region: runRegionData(gameData, TRAINERS),
});

/**
 * a run's preview from its seed. `unlocks` is what the run carries (unlocks.js runUnlocks), `map` overrides rules.json
 * run.map (the debug menu's short map), `tier` the run's Expedition
 * @param {string} seed @param {{ unlocks?: string[], map?: object, tier?: number }} [o]
 */
export function runPreview(seed, o = {}) {
  const data = runPreviewData(),
    plan = runStartPlan(seed, { ...data, unlockData: UNLOCK_DATA }, { unlocks: o.unlocks, map: o.map, tier: o.tier }),
    /** @type {Run} */
    run = newRun(seed, plan.give.tier, MAPGEN_VERSION, /** @type {any} */ ({}));
  run.unlocks = plan.unlocks.slice();
  run.map = copyOf(plan.map);
  run.deadline = plan.deadline;
  run.forecast = copyOf(plan.forecast);
  if (plan.region) run.region = copyOf(plan.region);
  const map = /** @type {RunMap} */ (run.map),
    foes = runFoes(run, { leaders: Object.values(TRAINERS).filter(T => T.miniboss), rules: RULES.run }),
    W = runWorldTables(run, gameData.locations[START_NODE], /** @type {any} */ (data)),
    rule = RULES.run.shop,
    shopRule = { ...rule, pick: unlockOpen(rule.pick, 'shop', run.unlocks, UNLOCK_DATA) };
  const nodes = map.nodes.map((n, i) => {
    /** @type {{ day: number, stock: any[], relic: string }[] | null} */
    let shop = null;
    if (n.type === 'town') {
      shop = [];
      for (let day = n.row + 1; day <= run.deadline; day++)
        shop.push({
          day,
          stock: runShopStock(run, i, day, shopRule),
          relic: perkShelf(run, i, day, PERKS, RULES.run.relics),
        });
    }
    return {
      wild: W.pools[runPlaceId(i)],
      foe: Object.values(foes).find(F => F.runNode === i) || null,
      shop,
    };
  });
  const relicOffers = [],
    guards = new Set(map.nodes.filter(n => n.type === 'miniboss').map(n => n.row)).size;
  for (let k = 0; k < guards; k++) relicOffers.push(perkOfferMake(run, PERKS, RULES.run.relics) || []);
  return {
    seed,
    tier: plan.give.tier,
    unlocks: run.unlocks,
    map,
    deadline: run.deadline,
    forecast: run.forecast,
    nodes,
    relicOffers,
  };
}
