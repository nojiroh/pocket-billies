// @ts-check
'use strict';
/* ================= THE RIVAL (roguelite track RL-S2) =================
   Blake in runs: he waits on the run's map (run-map.js runMapRival) with a team built against the Billie you led the run
   with, and it grows with every meeting you have had (meta.history's rival entries, then this run's). What a run
   keeps of him is run.rival: the lead's species at takeoff, the meetings before this run, this run's meetings and wins
   (battle-rewards.js counts them, run-state.js runEnd writes them into the history). The numbers are rules.json
   run.rival (placeholders until the owner answers). No imports: the data comes in as arguments (species, the
   region's dex, a type chart), so the run sim and the tests play the same rules. Logic only: no DOM, no Date, no
   Math.random (tools/test/rival.test.mjs). */
/** @import { HistoryEntry, RunRival } from '../../types/save-data' */
/** @import { RivalRules } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  RIVAL_TRAINER: [() => RIVAL_TRAINER],
  rivalPast: [() => rivalPast],
  rivalRunStart: [() => rivalRunStart],
  rivalSize: [() => rivalSize],
  // @ts-expect-error -- replaced on purpose
  rivalTeam: [() => rivalTeam, v => (rivalTeam = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the trainer whose name and words Blake has in runs (trainers/blake.json) */
export const RIVAL_TRAINER = 'blake';

/** the meetings with Blake in the runs kept (each entry's rival.met) @param {HistoryEntry[] | undefined} history */
export const rivalPast = history =>
  (history || []).reduce((n, e) => n + (e && e.rival && Number.isInteger(e.rival.met) ? e.rival.met : 0), 0);

/** a new run's record of him: the lead's species, the meetings before
 * @param {string} lead @param {HistoryEntry[] | undefined} history @returns {RunRival} */
export const rivalRunStart = (lead, history) => ({ lead, past: rivalPast(history), met: 0, won: 0 });

/** how many Billies he fields after `met` meetings: `size`, one more per `grow`, at most `max`
 * @param {RivalRules} R @param {number} met */
export const rivalSize = (R, met) => Math.max(1, Math.min(R.max, R.size + Math.floor(Math.max(0, met) / R.grow)));

/**
 * Blake's team for one meeting: rivalSize Billies, the ace at `top` (the row's top wild level + run.rival.up), each
 * other a level below the one before (1 at least). The ace is of a type that hits the lead's types for more than
 * normal damage (`beats`), from the region's dex first, then every species; the others any species of the dex (every
 * species with no dex), never the ace's species twice while there are others. Each at the stage its level allows, as a
 * wild Billie's (`step`: 0 a first stage, 1 a middle one, 2 a final form; a first stage under 16, no final form under
 * 32); none young enough: the youngest. Drawn from the node's stream, so a seed's Blake is the same every time.
 * @param {{ int: (lo: number, hi: number) => number }} g the node's stream ('team')
 * @param {string[]} leadTypes the lead's types ([] unknown: any species can be the ace)
 * @param {number} met meetings before this one (past runs' and this run's)
 * @param {number} top @param {RivalRules} R
 * @param {Record<string, { types?: string[] }>} species @param {string[] | null} dex the region's
 * @param {(attack: string, defs: string[]) => number} beats the type chart (game-data.js typeEffectiveness)
 * @param {(id: string) => number} step the species' stage (rules.js speciesStep)
 * @returns {{ sp: string, lvl: number }[]}
 */
export function rivalTeam(g, leadTypes, met, top, R, species, dex, beats, step) {
  const n = rivalSize(R, met),
    levels = Array.from({ length: n }, (_, k) => Math.max(1, Math.min(100, top - k))),
    all = Object.keys(species).sort(),
    own = dex && dex.length ? dex.filter(id => species[id]).sort() : all,
    counters = (/** @type {string[]} */ ids) =>
      leadTypes.length ? ids.filter(id => (species[id].types || []).some(t => beats(t, leadTypes) > 1)) : ids.slice(),
    fits = (/** @type {number} */ lvl) => (/** @type {string} */ id) =>
      lvl < 16 ? step(id) === 0 : lvl < 32 ? step(id) <= 1 : true,
    young = (/** @type {string[]} */ ids) => {
      const low = Math.min(...ids.map(step));
      return ids.filter(id => step(id) === low);
    },
    /** the first list with a species young enough for the level, else the youngest of the last non-empty one */
    choose = (/** @type {string[][]} */ lists, /** @type {number} */ lvl, /** @type {string[]} */ taken) => {
      const ok = lists.filter(l => l.length),
        fit = ok.map(l => l.filter(fits(lvl))).find(l => l.length) || (ok.length ? young(ok[ok.length - 1]) : []),
        left = fit.filter(id => !taken.includes(id)),
        from = left.length ? left : fit;
      return from[g.int(0, from.length - 1)];
    };
  /** @type {string[]} */
  const taken = [];
  return levels.map((lvl, k) => {
    const sp = k === 0 ? choose([counters(own), counters(all), own], lvl, taken) : choose([own, all], lvl, taken);
    taken.push(sp);
    return { sp, lvl };
  });
}
