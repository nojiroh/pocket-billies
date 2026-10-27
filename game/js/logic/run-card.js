// @ts-check
'use strict';
/* ================= A RUN'S REGION CARD (cutscenes track, part C) =================
   What the run's loading screens say about the region (run-loading.js): on the way out, its zones in order (each
   biome's name and sky), the types it favours (its theme's weights), its leaders (the mini-bosses, then the boss), the
   size of its regional dex with a few of its species, the weather ahead (the first day's forecast over its places) and
   how many places, towns and guards its map holds; on the way home, what the run came to. Logic only: no DOM, runs in
   Node (tools/test/run-card.test.mjs). */
/** @import { Run } from '../../types/save-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  RUN_CARD: [() => RUN_CARD],
  // @ts-expect-error -- replaced on purpose
  runCardHome: [() => runCardHome, v => (runCardHome = v)],
  // @ts-expect-error -- replaced on purpose
  runCardOut: [() => runCardOut, v => (runCardOut = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** how much of the region a card shows */
export const RUN_CARD = { types: 3, sample: 6, weather: 3 };

/**
 * the facts a departure's card shows, or null for a run with no region (a run from before regions)
 * @param {Run | null | undefined} run
 * @param {{ themes?: Record<string, any>, biomes?: Record<string, any>, trainers?: Record<string, any> }} data regions.json's themes, biomes.json, the trainers
 */
export function runCardOut(run, data) {
  const R = run && run.region;
  if (!R) return null;
  const T = (data.themes || {})[R.theme] || {},
    B = data.biomes || {},
    TR = data.trainers || {},
    nodes = (run.map && run.map.nodes) || [];
  const zones = R.zones.map(z => {
    const b = B[z.biome] || {};
    return { biome: z.biome, name: b.name || z.biome, sky: (b.look && b.look.sky) || [] };
  });
  const types = Object.entries(T.types || {})
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, RUN_CARD.types)
    .map(e => e[0]);
  const leaders = R.leaders.map((id, i) => ({
    id,
    name: (TR[id] && TR[id].name) || id,
    boss: i === R.leaders.length - 1,
  }));
  /* the weather ahead: the first day's over every place but the hub's (forecast[0]), the most common first */
  /** @type {Record<string, number>} */
  const wx = {};
  for (const days of (run.forecast || []).slice(1)) if (days && days[0]) wx[days[0]] = (wx[days[0]] || 0) + 1;
  const weather = Object.entries(wx)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, RUN_CARD.weather)
    .map(e => e[0]);
  const towns = nodes.filter(n => n.type === 'town').length,
    guards = nodes.filter(n => n.type === 'miniboss').length;
  return {
    name: R.name,
    theme: T.name || R.theme,
    zones,
    types,
    leaders,
    dex: R.dex.length,
    sample: R.dex.slice(0, RUN_CARD.sample),
    weather,
    places: nodes.length,
    towns,
    guards,
    side: (run.map && run.map.side && run.map.side.name) || '',
    expedition: run.expedition || 1,
  };
}

/**
 * the facts the way home's card shows: the run as it ended (read before runEnd puts the hub back) and its payout
 * @param {Run} run @param {boolean} won
 * @param {{ research: number, crests: number, scrap: number }} pay
 * @param {string[]} kept the kept Billies' names
 */
export function runCardHome(run, won, pay, kept) {
  return {
    won,
    name: (run.region && run.region.name) || '',
    days: run.clock || 0,
    cleared: new Set(run.path || []).size,
    research: pay.research || 0,
    crests: pay.crests || 0,
    scrap: pay.scrap || 0,
    kept: kept.slice(),
  };
}
