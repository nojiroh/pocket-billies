// @ts-check
'use strict';
/* ================= RUN STATE (roguelite track RL-3) =================
   The run in progress, kept in the save as saveData.run (null in the hub; roguelite-track.md 2a). While a run is
   on, the save's working fields (team, se, items, pyramids, trip, wild, eggs, flags, seats, visited, buddy) are the
   run's: every engine and screen reads them as before. runBegin copies the hub's into run.start and gives the run its
   own: the Billies from home (RL-9b: picked at the mast, from the team or storage) and the bag packed from the hub's;
   runEnd pays out, puts the hub's back and keeps the Billies the player chose. Only the seed is stored for what can
   be made again (the map, the scenes): the counters (uidN, battleN) let a resumed run carry on its random streams.
   Pure: no DOM, no Date, no Math.random; runs in Node (tools/test/run-state.test.mjs). Starting and ending a run on
   the page (the airship, the payout screen) come in RL-8. */
/** @import { Run, RunStart, SaveData, Billy } from '../../types/save-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
import { META_IDS, META_MAX, recordOf, wholeIn } from './meta-state.js';
import { expeditionAfterWin } from './modifiers.js';
/* eslint-disable no-func-assign */
expose({
  RUN_DAYS: [() => RUN_DAYS],
  RUN_EXPEDITIONS: [() => RUN_EXPEDITIONS],
  RUN_FIELDS: [() => RUN_FIELDS],
  RUN_LIST: [() => RUN_LIST],
  RUN_NODES: [() => RUN_NODES],
  RUN_PHASES: [() => RUN_PHASES],
  copyOf: [() => copyOf],
  // @ts-expect-error -- replaced on purpose
  newRun: [() => newRun, v => (newRun = v)],
  // @ts-expect-error -- replaced on purpose
  payoutOf: [() => payoutOf, v => (payoutOf = v)],
  // @ts-expect-error -- replaced on purpose
  runBegin: [() => runBegin, v => (runBegin = v)],
  runByExpedition: [() => runByExpedition],
  // @ts-expect-error -- replaced on purpose
  runEnd: [() => runEnd, v => (runEnd = v)],
  runHome: [() => runHome],
  runNodeCount: [() => runNodeCount],
  // @ts-expect-error -- replaced on purpose
  runRestore: [() => runRestore, v => (runRestore = v)],
  runSnapshot: [() => runSnapshot],
  // @ts-expect-error -- replaced on purpose
  validRun: [() => validRun, v => (validRun = v)],
  // @ts-expect-error -- replaced on purpose
  validRunEnc: [() => validRunEnc, v => (validRunEnc = v)],
  // @ts-expect-error -- replaced on purpose
  validRunFoe: [() => validRunFoe, v => (validRunFoe = v)],
  // @ts-expect-error -- replaced on purpose
  validRunRegion: [() => validRunRegion, v => (validRunRegion = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the working fields a run swaps out (roguelite-track.md 2a) */
export const RUN_FIELDS = /** @type {const} */ ([
  'team',
  'se',
  'items',
  'pyramids',
  'trip',
  'wild',
  'eggs',
  'flags',
  'seats',
  'visited',
  'buddy',
]);
export const RUN_PHASES = ['fly', 'walk', 'battle', 'menu', 'payout'],
  RUN_NODES = 64,
  RUN_DAYS = 9999,
  RUN_LIST = 5000,
  RUN_EXPEDITIONS = 9;
export const copyOf = v => JSON.parse(JSON.stringify(v));
/** RL-9b: a rule by Expedition (rules.json run.pack, run.points.budget): the expedition's entry, past the list's end its last */
/** @param {number[]} list @param {number} expedition */
export const runByExpedition = (list, expedition) =>
  list[Math.max(0, Math.min(list.length, Math.floor(expedition) || 1) - 1)];
provide({ runByExpedition }); /* to-module */
/** RL-9b: the uids of the Billies that came from home (picked at the mast); a run saved before RL-9b took the hub's
    whole team */
/** @param {Run} run @returns {string[]} */
export const runHome = run => (Array.isArray(run.home) ? run.home : run.start.team.map(m => m.uid));
/** the hub's working fields, copied */
/** @param {SaveData} s @returns {RunStart} */
export const runSnapshot = s =>
  /** @type {RunStart} */ (Object.fromEntries(RUN_FIELDS.map(k => [k, copyOf(s[k] === undefined ? null : s[k])])));
/** a run as it starts; `start` is the hub's working fields at that moment */
/** @param {string} seed @param {number} expedition @param {number} mapgenV @param {RunStart} start @returns {Run} */
export function newRun(seed, expedition, mapgenV, start) {
  return {
    seed,
    expedition,
    mapgenV,
    map: null,
    at: { phase: 'fly', battle: -1 },
    clock: 1,
    forecast: [],
    perks: [],
    offer: null,
    mods: [],
    offerN: 0,
    shelf: {},
    start,
    uidN: 0,
    battleN: 0,
    path: [],
    log: [],
    released: [],
    hints: {},
    home: ((start && start.team) || []).map(m => m.uid),
    pack: { items: {}, pyramids: {} },
  };
}
/** how many nodes the run's world has: Copperleaf (node 0) and the map's nodes (node i + 1 is map node i) */
/** @param {Run | null | undefined} run */
export const runNodeCount = run => 1 + (run && run.map && Array.isArray(run.map.nodes) ? run.map.nodes.length : 0);
/** RL-R1: a run's region (logic/run-region.js runRegionMake), its shape only @param {any} R @returns {boolean} */
export function validRunRegion(R) {
  const plain = (/** @type {any} */ v) =>
      !!v && typeof v === 'object' && !Array.isArray(v) && !Object.hasOwn(v, '__proto__'),
    id = (/** @type {any} */ v) => typeof v === 'string' && /^[a-z0-9_]{1,40}$/.test(v),
    ids = (/** @type {any} */ v, /** @type {number} */ most) => Array.isArray(v) && v.length <= most && v.every(id);
  return (
    plain(R) &&
    Object.keys(R).every(k => ['theme', 'name', 'zones', 'dex', 'swap', 'forms', 'leaders'].includes(k)) &&
    id(R.theme) &&
    typeof R.name === 'string' &&
    R.name.length >= 1 &&
    R.name.length <= 40 &&
    Array.isArray(R.zones) &&
    R.zones.length >= 1 &&
    R.zones.length <= 8 &&
    R.zones.every((/** @type {any} */ z) => plain(z) && id(z.biome) && wholeIn(z.rows, 1, RUN_NODES)) &&
    ids(R.dex, 200) &&
    recordOf(R.swap, 400, id) &&
    Object.keys(R.swap).every(id) &&
    recordOf(R.forms, 100, id) &&
    Object.keys(R.forms).every(id) &&
    ids(R.leaders, 16)
  );
}
/** the load check for saveData.run: strict, like validSave (the Billies in run.start.team are checked there) */
/** @param {any} o @returns {boolean} */
export function validRun(o) {
  const plain = v => !!v && typeof v === 'object' && !Array.isArray(v) && !Object.hasOwn(v, '__proto__'),
    list = (v, most = RUN_LIST) => Array.isArray(v) && v.length <= most,
    id = v => typeof v === 'string' && /^[a-z0-9_]{1,40}$/.test(v),
    money = v => Number.isFinite(v) && v >= 0 && v <= META_MAX;
  if (!plain(o)) return false;
  if (typeof o.seed !== 'string' || !/^[A-Za-z0-9|_-]{1,40}$/.test(o.seed)) return false;
  if (!wholeIn(o.expedition, 1, RUN_EXPEDITIONS) || !wholeIn(o.mapgenV, 1, 1e6)) return false;
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
        (node.seen !== undefined && !wholeIn(node.seen, 0, 2)) ||
        (node.biome !== undefined && !id(node.biome)) ||
        (node.zone !== undefined && !wholeIn(node.zone, 0, 7)) ||
        (node.side !== undefined && node.side !== 1)
      )
        return false;
    /* RL-R2: its side area (run-side.js): a kind, a move, a name, the obstacle's place on the main path, the way out
       (-1: none), its places (marked, after the main path's), its leader, its species, open */
    const S = o.map.side;
    if (S !== undefined) {
      const node = (/** @type {any} */ j) => wholeIn(j, 0, n - 1);
      if (
        !plain(S) ||
        Object.keys(S).some(
          k => !['kind', 'move', 'name', 'from', 'to', 'nodes', 'leader', 'dex', 'open'].includes(k)
        ) ||
        !['detour', 'alt'].includes(S.kind) ||
        !id(S.move) ||
        typeof S.name !== 'string' ||
        !S.name ||
        S.name.length > 40 ||
        !node(S.from) ||
        o.map.nodes[S.from].side ||
        !(S.to === -1 || (node(S.to) && !o.map.nodes[S.to].side)) ||
        !list(S.nodes, 8) ||
        !S.nodes.length ||
        !S.nodes.every(j => node(j) && o.map.nodes[j].side === 1) ||
        new Set(S.nodes).size !== S.nodes.length ||
        o.map.nodes.filter((/** @type {any} */ x) => x.side).length !== S.nodes.length ||
        (S.leader !== undefined && !id(S.leader)) ||
        (S.dex !== undefined && (!list(S.dex, 40) || !S.dex.every(id))) ||
        (S.open !== undefined && S.open !== 1)
      )
        return false;
    } else if (o.map.nodes.some((/** @type {any} */ x) => x.side)) return false;
  }
  /* RL-R1: the region (missing on a run from before regions) */
  if (o.region !== undefined && !validRunRegion(o.region)) return false;
  const nodes = runNodeCount(o);
  if (!plain(o.at) || !RUN_PHASES.includes(o.at.phase) || !wholeIn(o.at.battle, -1, 1e6)) return false;
  /* RL-8: at the payout, whether the run was won; in a battle, its foe as it began (run.js runFoeRef); nothing else */
  if (Object.keys(o.at).some(k => !['phase', 'battle', 'won', 'foe'].includes(k))) return false;
  if (o.at.won !== undefined && !wholeIn(o.at.won, 0, 1)) return false;
  if (o.at.foe !== undefined && !validRunFoe(o.at.foe)) return false;
  if (!wholeIn(o.clock, 1, RUN_DAYS)) return false;
  if (!list(o.forecast, nodes) || o.forecast.some(days => !list(days, RUN_DAYS) || !days.every(id))) return false;
  if (!list(o.perks, 32) || !o.perks.every(id) || !list(o.mods, 32) || !o.mods.every(id)) return false;
  if (o.offer !== null && (!list(o.offer, 5) || !o.offer.every(id))) return false;
  /* RL-12: the offers made, and the run shops' Perks by '<map node>:<day>' ('' once bought) */
  if (!wholeIn(o.offerN, 0, 1e6)) return false;
  if (
    !recordOf(o.shelf, RUN_LIST, v => v === '' || id(v)) ||
    !Object.keys(o.shelf).every(k => /^\d{1,2}:\d{1,4}$/.test(k))
  )
    return false;
  if (!wholeIn(o.uidN, 0, 1e9) || !wholeIn(o.battleN, 0, 1e9)) return false;
  if (!list(o.path) || !o.path.every(i => wholeIn(i, 0, nodes - 2))) return false;
  if (!list(o.log) || !o.log.every(e => typeof e === 'string' && e.length <= 80)) return false;
  if (!list(o.released, 500) || !o.released.every(b => plain(b) && id(b.sp) && wholeIn(b.lvl, 1, 100))) return false;
  if (!recordOf(o.hints, 200, v => v === 1)) return false;
  /* RL-11: the shop and biome unlocks the run started with (logic/unlocks.js runUnlocks); none on a run from before */
  if (
    o.unlocks !== undefined &&
    (!list(o.unlocks, META_IDS) || !o.unlocks.every(u => typeof u === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(u)))
  )
    return false;
  /* RL-9b: the Billies from home (uids) and what was packed (missing on a run saved before) */
  if (o.home !== undefined && (!list(o.home, 6) || !o.home.every(u => typeof u === 'string' && u.length <= 60)))
    return false;
  const packed = v => recordOf(v, 500, n => wholeIn(n, 0, META_MAX));
  if (o.pack !== undefined && !(plain(o.pack) && Object.keys(o.pack).every(k => k === 'items' || k === 'pyramids')))
    return false;
  if (o.pack !== undefined && !(packed(o.pack.items || {}) && packed(o.pack.pyramids || {}))) return false;
  /* RL-12b: its events and reward picks (missing on a run from before) */
  if (o.enc !== undefined && !validRunEnc(o.enc)) return false;
  /* the hub as the run started: shapes only (validSave checks its Billies like the team's) */
  const st = o.start,
    counts = v => recordOf(v, 500, n => wholeIn(n, 0, META_MAX));
  return (
    plain(st) &&
    list(st.team, 6) &&
    money(st.se) &&
    counts(st.items) &&
    counts(st.pyramids) &&
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
    plain(st.visited) &&
    (st.buddy === undefined || st.buddy === null || (typeof st.buddy === 'string' && st.buddy.length <= 60))
  );
}
/** RL-12b: a run's events and reward picks (logic/run-enc.js): shapes only @param {any} e @returns {boolean} */
export function validRunEnc(e) {
  const plain = (/** @type {any} */ v) =>
      !!v && typeof v === 'object' && !Array.isArray(v) && !Object.hasOwn(v, '__proto__'),
    id = (/** @type {any} */ v) => typeof v === 'string' && /^[a-z0-9_]{1,40}$/.test(v),
    num = (/** @type {any} */ v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e6,
    row = (/** @type {any} */ f) =>
      plain(f) &&
      id(f.kind) &&
      Object.keys(f).length <= 6 &&
      Object.values(f).every(v => num(v) || (typeof v === 'string' && v.length <= 20)),
    card = (/** @type {any} */ c) =>
      plain(c) &&
      Object.keys(c).every(k => ['id', 'kind', 'item', 'n', 'move'].includes(k)) &&
      id(c.id) &&
      ['item', 'candy', 'evo', 'tutor', 'held'].includes(c.kind) &&
      (c.item === undefined || id(c.item)) &&
      (c.move === undefined || id(c.move)) &&
      (c.n === undefined || wholeIn(c.n, 1, 99));
  return (
    plain(e) &&
    Object.keys(e).every(k => ['n', 'node', 'seen', 'boons', 'rewardN', 'reward', 'play'].includes(k)) &&
    (e.play == null ||
      (plain(e.play) &&
        Object.keys(e.play).every(k => ['id', 'i', 'opt', 'at', 'foe'].includes(k)) &&
        id(e.play.id) &&
        wholeIn(e.play.i, -1, RUN_NODES - 1) &&
        wholeIn(e.play.opt, 0, 2) &&
        Array.isArray(e.play.at) &&
        e.play.at.length <= 16 &&
        e.play.at.every((/** @type {any} */ n) => wholeIn(n, 0, 999)) &&
        (e.play.foe === undefined ||
          (plain(e.play.foe) &&
            id(e.play.foe.cls) &&
            wholeIn(e.play.foe.up, -20, 20) &&
            wholeIn(e.play.foe.n, 0, RUN_NODES - 1))))) &&
    wholeIn(e.n, 0, 1e6) &&
    recordOf(e.node, RUN_NODES, v => v === '' || id(v)) &&
    Object.keys(e.node).every(k => /^\d{1,2}$/.test(k)) &&
    Array.isArray(e.seen) &&
    e.seen.length <= RUN_NODES * 2 &&
    e.seen.every(id) &&
    Array.isArray(e.boons) &&
    e.boons.length <= 32 &&
    e.boons.every(
      (/** @type {any} */ b) =>
        plain(b) && Array.isArray(b.fx) && b.fx.length <= 8 && b.fx.every(row) && wholeIn(b.left, 0, 99) && id(b.src)
    ) &&
    wholeIn(e.rewardN, 0, 1e6) &&
    (e.reward === null ||
      (plain(e.reward) &&
        Array.isArray(e.reward.cards) &&
        e.reward.cards.length >= 1 &&
        e.reward.cards.length <= 5 &&
        e.reward.cards.every(card) &&
        wholeIn(e.reward.rolls, 0, 99) &&
        Object.keys(e.reward).every(k => ['cards', 'rolls', 'from', 'kind', 'n'].includes(k)) &&
        (e.reward.kind === undefined || ['item', 'candy', 'evo', 'tutor', 'held'].includes(e.reward.kind)) &&
        (e.reward.n === undefined || wholeIn(e.reward.n, 1, 5)) &&
        typeof e.reward.from === 'string' &&
        e.reward.from.length <= 60))
  );
}
/** RL-8: a run battle's foe as it began, kept in run.at so a reload starts the same battle again: its kind and
    format, the foe's Billies (1-6, each with a species and a level), and what the page gave it (an encounter's id, a
    trainer's id, the stage, a fish). Shapes only: the Billies are made by the game's own code */
/** @param {any} f @returns {boolean} */
export function validRunFoe(f) {
  const plain = v => !!v && typeof v === 'object' && !Array.isArray(v) && !Object.hasOwn(v, '__proto__'),
    id = v => typeof v === 'string' && /^[a-z0-9_]{1,40}$/.test(v);
  return (
    plain(f) &&
    Object.keys(f).every(k => ['kind', 'fmt', 'team', 'qid', 'tid', 'area', 'fished'].includes(k)) &&
    ['wild', 'trainer'].includes(f.kind) &&
    ['single', 'double', 'alpha'].includes(f.fmt) &&
    Array.isArray(f.team) &&
    f.team.length >= 1 &&
    f.team.length <= 6 &&
    f.team.every(m => plain(m) && typeof m.sp === 'string' && m.sp.length <= 60 && wholeIn(m.lvl, 1, 200)) &&
    (f.qid === undefined || (typeof f.qid === 'string' && f.qid.length <= 60)) &&
    (f.tid === undefined || id(f.tid)) &&
    (f.area === undefined || id(f.area)) &&
    (f.fished === undefined || f.fished === 1)
  );
}
/** start a run on the save: the hub's working fields go into run.start and the run gets its own. The Billies from
    home travel (`home`, by uid, from the team or storage; RL-9b: picked at the mast, the rules' count by Expedition is the
    page's to keep; left out, the team as it is): copies, so what happens to them in the run never touches the hub's,
    and the first is the buddy. The packed bag (`pack`) leaves the hub's (no more than it holds, so run.start keeps what
    stays home) and joins the run's starting money, items and pyramids (`give`, from the rules in RL-8); the trip starts at
    Copperleaf (node 0) for the airship; story flags and badges carry over, so conditions read as in the hub. Returns
    the run */
/**
 * @param {SaveData} s
 * @param {{ seed: string, expedition: number, mapgenV: number, se: number, items?: Record<string, number>,
 *   pyramids?: Record<string, number>, home?: string[],
 *   pack?: { items?: Record<string, number>, pyramids?: Record<string, number> } }} give
 * @returns {Run}
 */
export function runBegin(s, give) {
  if (s.run) throw new Error('runBegin: a run is already on');
  const start = runSnapshot(s),
    zero = rec => Object.fromEntries(Object.keys(rec || {}).map(k => [k, 0])),
    all = [...s.team, ...(s.box || [])],
    travel = [...new Set(give.home || s.team.map(m => m.uid))]
      .map(uid => all.find(m => m.uid === uid))
      .filter(m => !!m);
  if (!travel.length) throw new Error('runBegin: nobody from home travels');
  /** @type {{ items: Record<string, number>, pyramids: Record<string, number> }} */
  const pack = { items: {}, pyramids: {} };
  for (const kind of /** @type {const} */ (['items', 'pyramids']))
    for (const [k, n] of Object.entries((give.pack && give.pack[kind]) || {})) {
      const have = start[kind] || {},
        take = Math.max(0, Math.min(Math.floor(n) || 0, have[k] || 0));
      if (!take) continue;
      have[k] -= take;
      pack[kind][k] = take;
    }
  const run = (s.run = newRun(give.seed, give.expedition, give.mapgenV, start)),
    add = (/** @type {Record<string, number>} */ to, /** @type {Record<string, number>} */ more) => {
      for (const [k, n] of Object.entries(more)) to[k] = (to[k] || 0) + n;
      return to;
    };
  run.home = travel.map(m => m.uid);
  run.pack = copyOf(pack);
  s.team = /** @type {Billy[]} */ (copyOf(travel));
  s.buddy = travel[0].uid;
  s.se = give.se;
  s.items = add(Object.assign(zero(start.items), give.items || {}), pack.items);
  s.pyramids = add(Object.assign(zero(start.pyramids), give.pyramids || {}), pack.pyramids);
  s.trip = { node: 0, plan: [] };
  s.wild = {};
  s.eggs = [];
  s.flags = copyOf(start.flags || {});
  s.seats = copyOf(start.seats || []);
  s.visited = { 0: 1 };
  return run;
}
/** what a run pays when it ends, as Research and Crests, with the lines the payout screen lists: the money at a
    rate, the items at a share of their price (then at the money rate; RL-9b: on a loss only, a win takes the bag
    home), each released Billie, each node cleared, a win bonus; crests for a win; Scrap (RL-9, the ranch's material)
    for each node cleared and a win. Rates are rules.json run.payout (placeholders until the first play) */
/**
 * @param {{ se: number, items: Record<string, number>, released: number, cleared: number, won: boolean }} end
 * @param {{ money: number, itemShare: number, released: number, node: number, win: number, winCrests: number,
 *   scrapNode?: number, scrapWin?: number, research?: number }} rates research (RL-12, a Perk's): the Research times
 *   this, the difference as a line of its own
 * @param {(id: string) => number} itemPrice an item's shop price (Moneys), 0 for none
 * @returns {{ research: number, crests: number, scrap: number, lines: { what: string, n: number, research: number }[] }}
 */
export function payoutOf(end, rates, itemPrice) {
  const itemValue = Object.entries(end.won ? {} : end.items || {}).reduce(
    (sum, [k, n]) => sum + Math.max(0, n) * Math.max(0, itemPrice(k) || 0) * rates.itemShare,
    0
  );
  const lines = [
    { what: 'money', n: Math.max(0, end.se), research: Math.floor(Math.max(0, end.se) * rates.money) },
    { what: 'items', n: Math.floor(itemValue), research: Math.floor(itemValue * rates.money) },
    { what: 'released', n: end.released, research: end.released * rates.released },
    { what: 'nodes', n: end.cleared, research: end.cleared * rates.node },
    { what: 'win', n: end.won ? 1 : 0, research: end.won ? rates.win : 0 },
  ];
  /* RL-12: a Perk's payout row (logic/effects.js fxPayoutRates): the Research above times rates.research, as a row */
  const k = rates.research ?? 1;
  if (k !== 1) {
    const sum = lines.reduce((a, l) => a + l.research, 0);
    lines.push({ what: 'fx', n: Math.round((k - 1) * 100), research: Math.floor(sum * k) - sum });
  }
  return {
    research: lines.reduce((sum, l) => sum + l.research, 0),
    crests: end.won ? rates.winCrests : 0,
    scrap: Math.max(0, end.cleared) * (rates.scrapNode || 0) + (end.won ? rates.scrapWin || 0 : 0),
    lines,
  };
}
/** end the run on the save: pay out into saveData.meta, put the hub's working fields back, and keep the chosen
    Billies (`keep`, by uid). A kept Billie that travelled from home keeps what it gained in the run, where it lives
    (the team or storage); one caught or bought in the run joins the team, or the box when the team is full. Every
    other Billie from home comes back as it left (roguelite-track.md section 3, option 3 of "keep-one vs ranch
    levels"; 8.2: one kept on a loss, all on a win). RL-9b: on a win the run's items and pyramids go into the hub's bag
    (on a loss they were paid as Research). Returns the payout */
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
    /* nodes cleared: each node once (the path counts every arrival, backtracking included) */
    { se: s.se, items: s.items, released: run.released.length, cleared: new Set(run.path).size, won: how.won },
    rates,
    itemPrice
  );
  const kept = how.keep.map(uid => s.team.find(m => m.uid === uid)).filter(m => !!m),
    bag = how.won ? { items: copyOf(s.items || {}), pyramids: copyOf(s.pyramids || {}) } : null;
  runRestore(s);
  for (const m of /** @type {Billy[]} */ (copyOf(kept))) {
    const inTeam = s.team.findIndex(t => t.uid === m.uid),
      inBox = s.box.findIndex(t => t.uid === m.uid);
    if (inTeam >= 0) s.team[inTeam] = m;
    else if (inBox >= 0) s.box[inBox] = m;
    else if (s.team.length < 6) s.team.push(m);
    else s.box.push(m);
  }
  if (bag)
    for (const kind of /** @type {const} */ (['items', 'pyramids']))
      for (const [k, n] of Object.entries(bag[kind])) if (n > 0) s[kind][k] = (s[kind][k] || 0) + n;
  s.meta.research += pay.research;
  s.meta.crests += pay.crests;
  s.meta.scrap += pay.scrap;
  s.meta.runs += 1;
  if (how.won) s.meta.wins += 1;
  /* RL-13: winning the highest Expedition open opens the next (logic/modifiers.js) */
  s.meta.expedition = expeditionAfterWin(s.meta.expedition || 1, run.expedition || 1, how.won);
  return pay;
}
/** put the hub's working fields back from run.start and leave the run, paying nothing (runEnd's last step; also a
    run that can't be resumed, saves.js saveFill) */
/** @param {SaveData} s */
export function runRestore(s) {
  const start = s.run && s.run.start;
  if (start && typeof start === 'object')
    for (const k of RUN_FIELDS)
      if (start[k] !== undefined && (start[k] !== null || k === 'buddy')) /** @type {any} */ (s)[k] = copyOf(start[k]);
  s.run = null;
}
