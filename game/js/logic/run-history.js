// @ts-check
'use strict';
/* ================= RUN HISTORY (roguelite track RL-S1) =================
   What the story remembers of past runs, kept in the save as saveData.meta.history: the newest HISTORY_MAX runs, oldest
   first, one entry each (historyEntry, made by run-state.js runEnd before the hub's fields come back). The story's
   conditions read it as facts (historyFacts): `last:<fact>` the last run, `lastby:<what>` what ended it, `history:<fact>`
   all of them, `rematch` how many runs a foe has ended. "What beat you" is caught as the battle ends
   (battle-rewards.js battleSettle: run.lostTo), the leaders beaten likewise (run.beat). No imports: conditions.js and
   meta-state.js read it on both pages. Logic only: no DOM, no Date, no Math.random (tools/test/run-history.test.mjs). */
/** @import { HistoryEntry, RunLostTo, Run, SaveData } from '../../types/save-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  HISTORY_ENDS: [() => HISTORY_ENDS],
  HISTORY_FACTS: [() => HISTORY_FACTS],
  HISTORY_MAX: [() => HISTORY_MAX],
  LAST_FACTS: [() => LAST_FACTS],
  LOST_TO_KINDS: [() => LOST_TO_KINDS],
  histId: [() => histId],
  histPlain: [() => histPlain],
  histWhole: [() => histWhole],
  // @ts-expect-error -- replaced on purpose
  historyEntry: [() => historyEntry, v => (historyEntry = v)],
  // @ts-expect-error -- replaced on purpose
  historyFacts: [() => historyFacts, v => (historyFacts = v)],
  // @ts-expect-error -- replaced on purpose
  historyPush: [() => historyPush, v => (historyPush = v)],
  // @ts-expect-error -- replaced on purpose
  historyRematch: [() => historyRematch, v => (historyRematch = v)],
  // @ts-expect-error -- replaced on purpose
  runLostTo: [() => runLostTo, v => (runLostTo = v)],
  // @ts-expect-error -- replaced on purpose
  validHistory: [() => validHistory, v => (validHistory = v)],
  // @ts-expect-error -- replaced on purpose
  validLostTo: [() => validLostTo, v => (validLostTo = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const HISTORY_MAX = 20,
  HISTORY_ENDS = ['won', 'lost', 'quit'],
  /** what can end a run: a wild Billie, a route trainer, an event's foe, a mini-boss, the boss, another trainer */
  LOST_TO_KINDS = ['wild', 'route', 'event', 'miniboss', 'boss', 'trainer'],
  /** `last:<fact>`: the last run's numbers (0 with no run yet) */
  LAST_FACTS = ['won', 'lost', 'quit', 'row', 'days', 'perks', 'team', 'leaders', 'expedition'],
  /** `history:<fact>`: over every run kept */
  HISTORY_FACTS = ['runs', 'wins', 'losses', 'quits', 'streak', 'lstreak', 'bureau'];

export const histPlain = (/** @type {any} */ v) =>
    !!v && typeof v === 'object' && !Array.isArray(v) && !Object.hasOwn(v, '__proto__'),
  histId = (/** @type {any} */ v) => typeof v === 'string' && /^[a-z0-9_]{1,40}$/.test(v),
  histWhole = (/** @type {any} */ v, /** @type {number} */ min, /** @type {number} */ max) =>
    Number.isInteger(v) && v >= min && v <= max;

/** what ended a lost battle, from the battle (its kind, its trainer, the foe still standing or its lead)
 * @param {any} b @returns {RunLostTo} */
export function runLostTo(b) {
  const T = b && b.T,
    foe = (b && b.sides && b.sides[1] && b.sides[1].team) || [],
    up = foe.find((/** @type {any} */ m) => m && m.hp > 0) || foe[0];
  /** @type {RunLostTo} */
  const by = { kind: T ? (LOST_TO_KINDS.includes(T.runFoe) ? T.runFoe : 'trainer') : 'wild' };
  const who = T && (T.from || T.cls);
  if (histId(who)) by.id = who;
  if (up && histId(up.sp)) by.sp = up.sp;
  if (T && T.bureau) by.bureau = 1;
  return by;
}
/** a lost-to record's shape (run.lostTo, an entry's `by`) @param {any} v */
export function validLostTo(v) {
  return (
    histPlain(v) &&
    Object.keys(v).every(k => ['kind', 'id', 'sp', 'bureau'].includes(k)) &&
    LOST_TO_KINDS.includes(v.kind) &&
    (v.id === undefined || histId(v.id)) &&
    (v.sp === undefined || histId(v.sp)) &&
    (v.bureau === undefined || v.bureau === 1)
  );
}

/** the history entry of the run on the save as it ends (before run-state.js runRestore puts the hub's fields back:
 * the team and the run's own records are still the run's) @param {SaveData} s @param {boolean} won
 * @returns {HistoryEntry} */
export function historyEntry(s, won) {
  const run = /** @type {Run} */ (s.run),
    nodes = (run.map && run.map.nodes) || [],
    R = run.region,
    beat = new Set(run.beat || []),
    leaders = [...((R && R.leaders) || [])];
  /* RL-R2: a side area's leader, when the run went that way */
  const side = run.map && run.map.side;
  if (side && side.leader && !leaders.includes(side.leader) && (beat.has(side.leader) || side.open))
    leaders.push(side.leader);
  const lostTo = !won && run.lostTo && validLostTo(run.lostTo) ? run.lostTo : null;
  return {
    seed: run.seed,
    theme: R && histId(R.theme) ? R.theme : '',
    region: R && typeof R.name === 'string' ? R.name.slice(0, 40) : '',
    exp: run.expedition || 1,
    end: won ? 'won' : lostTo ? 'lost' : 'quit',
    by: lostTo ? { ...lostTo } : null,
    row: Math.max(0, ...run.path.map(i => (nodes[i] ? nodes[i].row : 0))),
    days: run.clock,
    team: (s.team || [])
      .map(m => m && m.sp)
      .filter(histId)
      .slice(0, 6),
    perks: run.perks.filter(histId).slice(0, 32),
    leaders: leaders.filter(histId).map(l => ({ id: l, beat: beat.has(l) ? 1 : 0 })),
    rival: null,
    /* RS-2: the resident invited on it (they moved in, won or lost) */
    ...(run.invited && histId(run.invited) ? { res: run.invited } : {}),
  };
}
/** the history with a new entry, the newest HISTORY_MAX kept @param {HistoryEntry[] | undefined} list
 * @param {HistoryEntry} e @returns {HistoryEntry[]} */
export function historyPush(list, e) {
  return [...(Array.isArray(list) ? list : []), e].slice(-HISTORY_MAX);
}

/** the load check for meta.history (meta-state.js validMeta; metaFill drops a bad one on its own) @param {any} v */
export function validHistory(v) {
  const ids = (/** @type {any} */ l, /** @type {number} */ most) =>
    Array.isArray(l) && l.length <= most && l.every(histId);
  return (
    Array.isArray(v) &&
    v.length <= HISTORY_MAX &&
    v.every(
      e =>
        histPlain(e) &&
        Object.keys(e).every(k =>
          [
            'seed',
            'theme',
            'region',
            'exp',
            'end',
            'by',
            'row',
            'days',
            'team',
            'perks',
            'leaders',
            'rival',
            'res',
          ].includes(k)
        ) &&
        (e.res === undefined || histId(e.res)) &&
        typeof e.seed === 'string' &&
        /^[A-Za-z0-9|_-]{1,40}$/.test(e.seed) &&
        (e.theme === '' || histId(e.theme)) &&
        typeof e.region === 'string' &&
        e.region.length <= 40 &&
        histWhole(e.exp, 1, 9) &&
        HISTORY_ENDS.includes(e.end) &&
        (e.by === null || validLostTo(e.by)) &&
        histWhole(e.row, 0, 63) &&
        histWhole(e.days, 1, 9999) &&
        ids(e.team, 6) &&
        ids(e.perks, 32) &&
        Array.isArray(e.leaders) &&
        e.leaders.length <= 16 &&
        e.leaders.every(
          (/** @type {any} */ l) =>
            histPlain(l) &&
            Object.keys(l).every(k => k === 'id' || k === 'beat') &&
            histId(l.id) &&
            histWhole(l.beat, 0, 1)
        ) &&
        e.rival === null
    )
  );
}

/** the facts the story's conditions read (conditions.js storyStateOf): `last` (LAST_FACTS of the newest entry),
 * `lastby` (what ended it: its kind, its trainer or class id, the Billie, `bureau`) and `history` (HISTORY_FACTS)
 * @param {HistoryEntry[] | undefined} list
 * @returns {{ last: Record<string, number>, lastby: Record<string, number>, history: Record<string, number> }} */
export function historyFacts(list) {
  const H = Array.isArray(list) ? list : [],
    e = H[H.length - 1],
    /** @type {Record<string, number>} */ last = {},
    /** @type {Record<string, number>} */ lastby = {},
    count = (/** @type {(e: HistoryEntry) => boolean} */ f) => H.filter(f).length,
    /** how many runs in a row, newest back, end this way @param {string} end */
    streak = end => {
      let n = 0;
      for (let i = H.length - 1; i >= 0 && H[i].end === end; i--) n++;
      return n;
    };
  if (e) {
    Object.assign(last, {
      won: e.end === 'won' ? 1 : 0,
      lost: e.end === 'lost' ? 1 : 0,
      quit: e.end === 'quit' ? 1 : 0,
      row: e.row,
      days: e.days,
      perks: e.perks.length,
      team: e.team.length,
      leaders: e.leaders.filter(l => l.beat).length,
      expedition: e.exp,
    });
    if (e.by) {
      lastby[e.by.kind] = 1;
      if (e.by.id) lastby[e.by.id] = 1;
      if (e.by.sp) lastby[e.by.sp] = 1;
      if (e.by.bureau) lastby.bureau = 1;
    }
  }
  return {
    last,
    lastby,
    history: {
      runs: H.length,
      wins: count(e => e.end === 'won'),
      losses: count(e => e.end === 'lost'),
      quits: count(e => e.end === 'quit'),
      streak: streak('won'),
      lstreak: streak('lost'),
      bureau: count(e => !!(e.by && e.by.bureau)),
    },
  };
}
/** `rematch`: how many runs kept were ended by this foe (a leader's or a class's id) @param {HistoryEntry[] | undefined}
 * list @param {string} [foe] */
export function historyRematch(list, foe) {
  return foe && Array.isArray(list) ? list.filter(e => e.by && e.by.id === foe).length : 0;
}
