// @ts-check
'use strict';
/* ================= RESIDENTS (residents track RS-1) =================
   The people a run can invite to Copperleaf (residents.json). Each run meets at most one candidate: the free first
   resident (`first`) while nobody lives in Copperleaf, else one drawn from the run's own stream ('resident') among
   those who don't live there yet, by their `meet.weight` (0: not yet). Inviting them sets run.invited (one a run);
   when the run ends, won or lost (the owner, 2026-10-26), they move in: saveData.meta.residents (id -> the run, by
   meta.runs, they moved in after). Nobody moves out. Their services and levels are unlocks.json rows (RS-4); the
   conditions `resident:<id>` and `residents` read who lives there (logic/conditions.js). RS-3: in Copperleaf each one
   lives at their building, or a cottage of their own (residentHomes), and walks the town from there.
   The table is passed in (`R`: residents.json); logic only: no DOM, no Date, no Math.random
   (tools/test/residents.test.mjs). */
/** @import { Meta, Run, RunMap, SaveData } from '../../types/save-data' */
/** @import { Resident } from '../../types/game-data' */
/** @typedef {Record<string, Resident>} ResidentsTable */
/** @typedef {'town' | 'event'} MeetPlace */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { rngFrom } from './rng.js';
import { propDoor } from './prop-turn.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  resLevel: [() => resLevel, v => (resLevel = v)],
  // @ts-expect-error -- replaced on purpose
  residentCandidate: [() => residentCandidate, v => (residentCandidate = v)],
  // @ts-expect-error -- replaced on purpose
  residentDrawn: [() => residentDrawn, v => (residentDrawn = v)],
  // @ts-expect-error -- replaced on purpose
  residentFirstTowns: [() => residentFirstTowns, v => (residentFirstTowns = v)],
  // @ts-expect-error -- replaced on purpose
  residentHomes: [() => residentHomes, v => (residentHomes = v)],
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
/** RS-4: a resident's service level: 0 while they don't live in Copperleaf, else the highest level an owned
 * unlocks.json row grants them (`{resident, level}`), 1 when none does (their Lv 1 comes free with moving in)
 * @param {SaveData} s @param {string} id @param {Record<string, { grant: any }>} U unlocks.json */
export function resLevel(s, id, U) {
  const M = s.meta;
  if (!M || !(M.residents || {})[id]) return 0;
  let lv = 1;
  for (const u of Object.keys(M.unlocks || {})) {
    const G = U[u] && U[u].grant;
    if (G && G.resident === id && G.level > lv) lv = G.level;
  }
  return lv;
}
/** RS-2: this run's one resident to meet, whatever has happened on it (invited or not): the free first one while
 * nobody lives in Copperleaf, else one drawn from the run's own stream ('resident') among those left with a weight.
 * Drawn once among everyone, wherever they are met, so a town and an event never offer two different people. Null
 * with nobody left @param {SaveData} s @param {ResidentsTable} R @returns {string | null} */
export function residentDrawn(s, R) {
  const run = s.run;
  if (!run) return null;
  const here = (s.meta && s.meta.residents) || {};
  if (run.invited && R[run.invited]) return run.invited;
  if (!Object.keys(here).length) {
    const first = Object.keys(R).find(id => R[id].first);
    if (first) return first;
  }
  const left = Object.keys(R).filter(id => !here[id] && R[id].meet.weight > 0);
  if (!left.length) return null;
  const g = rngFrom(run.seed, 'resident');
  return g.pick(Object.fromEntries(left.map(id => [id, R[id].meet.weight])));
}
/** this run's one candidate, or null: none while one is invited already, or with nobody left to meet. The same run
 * (its seed) and the same residents always give the same one. With `where` (a town, an event): only if they are met
 * there (RS-2: one candidate a run, so another place doesn't draw another)
 * @param {SaveData} s @param {ResidentsTable} R @param {MeetPlace} [where] @returns {string | null} */
export function residentCandidate(s, R, where) {
  if (!s.run || s.run.invited) return null;
  const id = residentDrawn(s, R);
  return id && (!where || R[id].meet.where.includes(where)) ? id : null;
}
/** RS-2: the free first resident's towns: every town of the map's first row made of towns only, so every way through
 * the map walks into one (rules.json run.map `rest`, the row before a mini-boss) @param {RunMap} map
 * @returns {number[]} */
export function residentFirstTowns(map) {
  const rows = /** @type {Map<number, number[]>} */ (new Map());
  map.nodes.forEach((n, i) => rows.set(n.row, (rows.get(n.row) || []).concat(i)));
  for (const row of [...rows.keys()].sort((a, b) => a - b)) {
    const at = /** @type {number[]} */ (rows.get(row));
    if (at.every(i => map.nodes[i].type === 'town')) return at;
  }
  return [];
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
/** RS-3: where each resident lives and works in Copperleaf: their building (the prop whose `k` is their home, else the
 * one whose act is their buildings.json row's: the barn for the ranch, Skyline Station for the station), or for a
 * `house` resident a cottage of their own (act 'house'; nearest the town's middle first, handed out in the order they
 * moved in, so nobody's cottage changes when someone else moves in; Juniper's, act 'home', is never one), and `at`,
 * the spot just out of its door: they work and sleep there (the townsfolk's day, walk-view.js). Someone whose building
 * isn't there is left out. Ids in the order they moved in (residentsHere)
 * @param {any} map the hub's map (copperleaf.json) @param {string[]} ids @param {ResidentsTable} R
 * @param {Record<string, { act?: string }>} buildings buildings.json
 * @param {{ ppu?: number, props: Record<string, any> }} C scenery.json (the catalogue: doors)
 * @returns {Record<string, { prop: any, at: [number, number], cottage: boolean }>} */
export function residentHomes(map, ids, R, buildings, C) {
  const props = /** @type {any[]} */ ((map && map.props) || []),
    hub = map && map.hub ? map.hub : [0, 0],
    cottages = props
      .filter(p => p.act === 'house')
      .sort((a, b) => Math.hypot(a.x - hub[0], a.z - hub[1]) - Math.hypot(b.x - hub[0], b.z - hub[1]));
  /** @type {Record<string, { prop: any, at: [number, number], cottage: boolean }>} */
  const out = {};
  let next = 0;
  for (const id of ids) {
    const r = R[id];
    if (!r) continue;
    const act = buildings[r.home] && buildings[r.home].act,
      prop =
        r.home === 'house'
          ? cottages[next++]
          : props.find(p => p.k === r.home && p.act !== 'home') || (act ? props.find(p => p.act === act) : null);
    if (!prop) continue;
    const D = propDoor(prop, C.props[prop.k], C.ppu || 34),
      /** @type {[number, number]} */ at = [D.at[0] + D.out[0] * 0.55, D.at[1] + D.out[1] * 0.55];
    out[id] = { prop, at, cottage: r.home === 'house' };
  }
  return out;
}
