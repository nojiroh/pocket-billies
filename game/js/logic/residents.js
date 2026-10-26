// @ts-check
'use strict';
/* ================= RESIDENTS (residents track RS-1) =================
   The people a run can invite to Copperleaf (residents.json). Each run meets at most one candidate: the free first
   resident (`first`) while nobody lives in Copperleaf, else one drawn from the run's own stream ('resident') among
   those who don't live there yet, by their `meet.weight` (0: not yet). Inviting them sets run.invited (one a run);
   when the run ends, won or lost (the owner, 2026-10-26), they move in: saveData.meta.residents (id -> the run, by
   meta.runs, they moved in after). Nobody moves out. Their services and levels are unlocks.json rows (RS-4); the
   conditions `resident:<id>` and `residents` read who lives there (logic/conditions.js).
   The table is passed in (`R`: residents.json); logic only: no DOM, no Date, no Math.random
   (tools/test/residents.test.mjs). */
/** @import { Meta, Run, SaveData } from '../../types/save-data' */
/** @import { Resident } from '../../types/game-data' */
/** @typedef {Record<string, Resident>} ResidentsTable */
/** @typedef {'town' | 'event'} MeetPlace */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { rngFrom } from './rng.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  residentCandidate: [() => residentCandidate, v => (residentCandidate = v)],
  // @ts-expect-error -- replaced on purpose
  residentInvite: [() => residentInvite, v => (residentInvite = v)],
  // @ts-expect-error -- replaced on purpose
  residentSettle: [() => residentSettle, v => (residentSettle = v)],
  // @ts-expect-error -- replaced on purpose
  residentsHere: [() => residentsHere, v => (residentsHere = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** who lives in Copperleaf (ids, in the order they moved in) @param {SaveData} s @returns {string[]} */
export function residentsHere(s) {
  const here = (s.meta && s.meta.residents) || {};
  return Object.keys(here).sort((a, b) => here[a] - here[b] || (a < b ? -1 : 1));
}
/** this run's one candidate, or null: none while one is invited already, or with nobody left to meet. The same run
 * (its seed) and the same residents always give the same one. `where` is where they are met (a town, an event)
 * @param {SaveData} s @param {ResidentsTable} R @param {MeetPlace} [where] @returns {string | null} */
export function residentCandidate(s, R, where = 'town') {
  const run = s.run;
  if (!run || run.invited) return null;
  const here = (s.meta && s.meta.residents) || {},
    left = Object.keys(R).filter(id => !here[id] && R[id].meet.weight > 0 && R[id].meet.where.includes(where));
  if (!Object.keys(here).length) {
    const first = Object.keys(R).find(id => R[id].first);
    if (first) return R[first].meet.where.includes(where) ? first : null;
  }
  if (!left.length) return null;
  const g = rngFrom(run.seed, 'resident');
  return g.pick(Object.fromEntries(left.map(id => [id, R[id].meet.weight])));
}
/** invite a resident on this run: refused for one who lives in Copperleaf already, one not in the table, or when
 * someone is invited already (one a run). Returns whether they were invited
 * @param {SaveData} s @param {string} id @param {ResidentsTable} R */
export function residentInvite(s, id, R) {
  const run = s.run;
  if (!run || run.invited || !R[id] || ((s.meta && s.meta.residents) || {})[id]) return false;
  run.invited = id;
  return true;
}
/** at the run's end, won or lost (logic/run-state.js runEnd, after meta.runs counts it): the invited resident moves in.
 * Returns their id, or null when nobody was invited (or they live there already)
 * @param {Meta} meta @param {Run} run @returns {string | null} */
export function residentSettle(meta, run) {
  const id = run && run.invited;
  if (!id) return null;
  if (!meta.residents) meta.residents = {};
  if (meta.residents[id]) return null;
  meta.residents[id] = Math.max(1, meta.runs);
  return id;
}
