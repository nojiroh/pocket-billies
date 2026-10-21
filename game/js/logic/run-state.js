// @ts-check
'use strict';
/* ================= RUN STATE (roguelite track RL-3) =================
   The run in progress, kept in the save as saveData.run (null in the hub; roguelite-track.md 2a). While a run is
   on, the save's working fields (team, se, items, coins, trip, wild, eggs, flags, seats, visited) are the run's: every
   engine and screen reads them as before. runBegin copies the hub's into run.start and gives the run its own;
   runEnd pays out, puts the hub's back and keeps the Billies the player chose. Only the seed is stored for what can
   be made again (the map, the scenes): the counters (uidN, battleN) let a resumed run carry on its random streams.
   Pure: no DOM, no Date, no Math.random; runs in Node (tools/test/run-state.test.mjs). Starting and ending a run on
   the page (the airship, the payout screen) come in RL-8. */
/** @import { Run, RunStart, SaveData, Billy } from '../../types/save-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { META_MAX, recordOf, wholeIn } from './meta-state.js';
/* eslint-disable no-func-assign */
expose({
  RUN_DAYS: [() => RUN_DAYS],
  RUN_FIELDS: [() => RUN_FIELDS],
  RUN_LIST: [() => RUN_LIST],
  RUN_NODES: [() => RUN_NODES],
  RUN_PHASES: [() => RUN_PHASES],
  RUN_TIERS: [() => RUN_TIERS],
  copyOf: [() => copyOf],
  // @ts-expect-error -- replaced on purpose
  newRun: [() => newRun, v => (newRun = v)],
  // @ts-expect-error -- replaced on purpose
  payoutOf: [() => payoutOf, v => (payoutOf = v)],
  // @ts-expect-error -- replaced on purpose
  runBegin: [() => runBegin, v => (runBegin = v)],
  // @ts-expect-error -- replaced on purpose
  runEnd: [() => runEnd, v => (runEnd = v)],
  runNodeCount: [() => runNodeCount],
  // @ts-expect-error -- replaced on purpose
  runRestore: [() => runRestore, v => (runRestore = v)],
  runSnapshot: [() => runSnapshot],
  // @ts-expect-error -- replaced on purpose
  validRun: [() => validRun, v => (validRun = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the working fields a run swaps out (roguelite-track.md 2a) */
export const RUN_FIELDS = /** @type {const} */ ([
  'team',
  'se',
  'items',
  'coins',
  'trip',
  'wild',
  'eggs',
  'flags',
  'seats',
  'visited',
]);
export const RUN_PHASES = ['fly', 'walk', 'battle', 'menu', 'payout'],
  RUN_NODES = 64,
  RUN_DAYS = 9999,
  RUN_LIST = 5000,
  RUN_TIERS = 9;
export const copyOf = v => JSON.parse(JSON.stringify(v));
/** the hub's working fields, copied */
/** @param {SaveData} s @returns {RunStart} */
export const runSnapshot = s =>
  /** @type {RunStart} */ (Object.fromEntries(RUN_FIELDS.map(k => [k, copyOf(s[k] === undefined ? null : s[k])])));
/** a run as it starts; `start` is the hub's working fields at that moment */
/** @param {string} seed @param {number} tier @param {number} mapgenV @param {RunStart} start @returns {Run} */
export function newRun(seed, tier, mapgenV, start) {
  return {
    seed,
    tier,
    mapgenV,
    map: null,
    at: { phase: 'fly', battle: -1 },
    clock: 1,
    deadline: 0,
    forecast: [],
    relics: [],
    offer: null,
    mods: [],
    start,
    uidN: 0,
    battleN: 0,
    path: [],
    log: [],
    released: [],
    hints: {},
  };
}
/** how many nodes the run's world has: Copperleaf (node 0) and the map's nodes (node i + 1 is map node i) */
/** @param {Run | null | undefined} run */
export const runNodeCount = run => 1 + (run && run.map && Array.isArray(run.map.nodes) ? run.map.nodes.length : 0);
/** the load check for saveData.run: strict, like validSave (the Billies in run.start.team are checked there) */
/** @param {any} o @returns {boolean} */
export function validRun(o) {
  const plain = v => !!v && typeof v === 'object' && !Array.isArray(v) && !Object.hasOwn(v, '__proto__'),
    list = (v, most = RUN_LIST) => Array.isArray(v) && v.length <= most,
    id = v => typeof v === 'string' && /^[a-z0-9_]{1,40}$/.test(v),
    money = v => Number.isFinite(v) && v >= 0 && v <= META_MAX;
  if (!plain(o)) return false;
  if (typeof o.seed !== 'string' || !/^[A-Za-z0-9|_-]{1,40}$/.test(o.seed)) return false;
  if (!wholeIn(o.tier, 1, RUN_TIERS) || !wholeIn(o.mapgenV, 1, 1e6)) return false;
  if (o.map !== null) {
    if (!plain(o.map) || !list(o.map.nodes, RUN_NODES) || !o.map.nodes.length) return false;
    const n = o.map.nodes.length;
    for (const [i, node] of o.map.nodes.entries())
      if (
        !plain(node) ||
        !id(node.type) ||
        !wholeIn(node.row, 0, RUN_NODES - 1) ||
        !wholeIn(node.lane, 0, 7) ||
        !list(node.to, 8) ||
        node.to.some(j => !wholeIn(j, 0, n - 1) || j === i) ||
        new Set(node.to).size !== node.to.length ||
        (node.seen !== undefined && !wholeIn(node.seen, 0, 2))
      )
        return false;
  }
  const nodes = runNodeCount(o);
  if (!plain(o.at) || !RUN_PHASES.includes(o.at.phase) || !wholeIn(o.at.battle, -1, 1e6)) return false;
  if (!wholeIn(o.clock, 1, RUN_DAYS) || !wholeIn(o.deadline, 0, RUN_DAYS)) return false;
  if (!list(o.forecast, nodes) || o.forecast.some(days => !list(days, RUN_DAYS) || !days.every(id))) return false;
  if (!list(o.relics, 32) || !o.relics.every(id) || !list(o.mods, 32) || !o.mods.every(id)) return false;
  if (o.offer !== null && (!list(o.offer, 5) || !o.offer.every(id))) return false;
  if (!wholeIn(o.uidN, 0, 1e9) || !wholeIn(o.battleN, 0, 1e9)) return false;
  if (!list(o.path) || !o.path.every(i => wholeIn(i, 0, nodes - 2))) return false;
  if (!list(o.log) || !o.log.every(e => typeof e === 'string' && e.length <= 80)) return false;
  if (!list(o.released, 500) || !o.released.every(b => plain(b) && id(b.sp) && wholeIn(b.lvl, 1, 100))) return false;
  if (!recordOf(o.hints, 200, v => v === 1)) return false;
  /* the hub as the run started: shapes only (validSave checks its Billies like the team's) */
  const st = o.start,
    counts = v => recordOf(v, 500, n => wholeIn(n, 0, META_MAX));
  return (
    plain(st) &&
    list(st.team, 6) &&
    money(st.se) &&
    counts(st.items) &&
    counts(st.coins) &&
    plain(st.trip) &&
    Number.isInteger(st.trip.node) &&
    st.trip.node >= 0 &&
    list(st.trip.plan, 500) &&
    st.trip.plan.every(Number.isInteger) &&
    plain(st.wild) &&
    list(st.eggs, 500) &&
    plain(st.flags) &&
    list(st.seats, 64) &&
    st.seats.every(v => typeof v === 'string') &&
    plain(st.visited)
  );
}
/** start a run on the save: the hub's working fields go into run.start and the run gets its own. The party travels
    (a copy: what happens to it in the run never touches the hub's); money, items and coins are the run's starting
    ones (`give`, from the rules in RL-8); the trip starts at Copperleaf (node 0) for the airship; story flags and
    badges carry over, so conditions read as in the hub. Returns the run */
/**
 * @param {SaveData} s
 * @param {{ seed: string, tier: number, mapgenV: number, se: number, items?: Record<string, number>,
 *   coins?: Record<string, number> }} give
 * @returns {Run}
 */
export function runBegin(s, give) {
  if (s.run) throw new Error('runBegin: a run is already on');
  const start = runSnapshot(s),
    zero = rec => Object.fromEntries(Object.keys(rec || {}).map(k => [k, 0]));
  const run = (s.run = newRun(give.seed, give.tier, give.mapgenV, start));
  s.team = copyOf(start.team);
  s.se = give.se;
  s.items = Object.assign(zero(start.items), give.items || {});
  s.coins = Object.assign(zero(start.coins), give.coins || {});
  s.trip = { node: 0, plan: [] };
  s.wild = {};
  s.eggs = [];
  s.flags = copyOf(start.flags || {});
  s.seats = copyOf(start.seats || []);
  s.visited = { 0: 1 };
  return run;
}
/** what a run pays when it ends, as Capital and Audit Seals, with the lines the payout screen lists: the money at a
    rate, the items at a share of their price (then at the money rate), each released Billie, each node cleared, a
    win bonus; seals for a win. Rates are rules.json run.payout (placeholders until the first play) */
/**
 * @param {{ se: number, items: Record<string, number>, released: number, cleared: number, won: boolean }} end
 * @param {{ money: number, itemShare: number, released: number, node: number, win: number, winSeals: number }} rates
 * @param {(id: string) => number} itemPrice an item's shop price ($), 0 for none
 * @returns {{ capital: number, seals: number, lines: { what: string, n: number, capital: number }[] }}
 */
export function payoutOf(end, rates, itemPrice) {
  const itemValue = Object.entries(end.items || {}).reduce(
    (sum, [k, n]) => sum + Math.max(0, n) * Math.max(0, itemPrice(k) || 0) * rates.itemShare,
    0
  );
  const lines = [
    { what: 'money', n: Math.max(0, end.se), capital: Math.floor(Math.max(0, end.se) * rates.money) },
    { what: 'items', n: Math.floor(itemValue), capital: Math.floor(itemValue * rates.money) },
    { what: 'released', n: end.released, capital: end.released * rates.released },
    { what: 'nodes', n: end.cleared, capital: end.cleared * rates.node },
    { what: 'win', n: end.won ? 1 : 0, capital: end.won ? rates.win : 0 },
  ];
  return {
    capital: lines.reduce((sum, l) => sum + l.capital, 0),
    seals: end.won ? rates.winSeals : 0,
    lines,
  };
}
/** end the run on the save: pay out into saveData.meta, put the hub's working fields back, and keep the chosen
    Billies (`keep`, by uid). A kept Billie that travelled from the hub keeps what it gained in the run; one caught or
    bought in the run joins the team, or the box when the team is full. Every other Billie that travelled comes back
    as it left (roguelite-track.md section 3, option 3 of "keep-one vs ranch levels": how many are kept on a win or a
    loss is the owner's call, 8.2). Returns the payout */
/**
 * @param {SaveData} s
 * @param {{ won: boolean, keep: string[] }} how
 * @param {Parameters<typeof payoutOf>[1]} rates
 * @param {(id: string) => number} itemPrice
 */
export function runEnd(s, how, rates, itemPrice) {
  const run = s.run;
  if (!run) throw new Error('runEnd: no run is on');
  const pay = payoutOf(
    { se: s.se, items: s.items, released: run.released.length, cleared: run.path.length, won: how.won },
    rates,
    itemPrice
  );
  const kept = how.keep.map(uid => s.team.find(m => m.uid === uid)).filter(m => !!m);
  runRestore(s);
  for (const m of /** @type {Billy[]} */ (copyOf(kept))) {
    const home = s.team.findIndex(t => t.uid === m.uid);
    if (home >= 0) s.team[home] = m;
    else if (s.team.length < 6) s.team.push(m);
    else s.box.push(m);
  }
  s.meta.capital += pay.capital;
  s.meta.seals += pay.seals;
  s.meta.runs += 1;
  if (how.won) s.meta.wins += 1;
  return pay;
}
/** put the hub's working fields back from run.start and leave the run, paying nothing (runEnd's last step; also a
    run that can't be resumed, saves.js migrate) */
/** @param {SaveData} s */
export function runRestore(s) {
  const start = s.run && s.run.start;
  if (start && typeof start === 'object')
    for (const k of RUN_FIELDS) if (start[k] !== undefined && start[k] !== null) s[k] = copyOf(start[k]);
  s.run = null;
}
