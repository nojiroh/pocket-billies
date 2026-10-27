// @ts-check
'use strict';
/* ================= RUN RECORD, FRIENDS' BOARDS AND GHOSTS (the online track, ON-2; RL-15) =================
   What a finished run leaves online for friends (docs/phases/online-track.md, ON-2). Firebase stays on Spark: no
   server code, so friends' boards are friends only (the owner, 2026-10-26) and a faked score is accepted.
   - runRecord: the run as a record, under RECORD_MOST bytes of JSON: its seed, kind (r a run, d a daily, w a weekly)
     and board number, Expedition, challenges, generator version, unlocks, path and Perks (what a server could replay
     the map from, if Blaze ever comes), how it went (won, places cleared, leaders beaten, days) and the party as
     online copies (logic/online-legal.js onlineCopy), with the trainer's name (cleanName). validRunRecord is strict,
     and every Billie in it must pass legalBilly.
   - ghosts/<uid>, one document per player (the owner's choice, ON-2: one read per friend refreshes every board and
     ghost): { name, last (the record as JSON text, so the rules can cap its size), day, week, x, fast }. day and week
     are the first daily and weekly attempts ({ n, e }); x the best run per Expedition; fast the fewest days of a won
     run. A board entry is { won, cleared, leaders, days, exp, lead, t }, ranked by won, then places cleared, then
     leaders beaten, then fewest days (no score: the owner's choice), then who posted first.
   - Ghosts: a friend's last run's party waits on the ghost node (logic/run-map.js runMapGhost), picked from the
     friends' records at take-off from the run's seed and kept in run.ghost, so a reload fights the same team; its
     levels follow the node like Blake's (logic/rival.js ghostTeam).
   Logic only: no DOM, no Date.now, no Math.random (tools/test/run-record.test.mjs). */
/** @import { Billy, Run, RunGhost, SaveData } from '../../types/save-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { rngFrom } from './rng.js';
import { cleanName } from './rules.js';
import {
  LEGAL_NAME_MOST,
  LEGAL_NICK_MOST,
  LEGAL_UID_MOST,
  legalBilly,
  legalPlain,
  legalWhole,
  onlineCopy,
} from './online-legal.js';
import { boardDay, boardWeek } from './daily.js';
/* eslint-disable no-func-assign */
expose({
  ENTRY_KEYS: [() => ENTRY_KEYS],
  RECORD_ID: [() => RECORD_ID],
  RECORD_KEYS: [() => RECORD_KEYS],
  RECORD_KINDS: [() => RECORD_KINDS],
  RECORD_MOST: [() => RECORD_MOST],
  RECORD_V: [() => RECORD_V],
  boardBetter: [() => boardBetter],
  boardEntry: [() => boardEntry],
  boardEntryOk: [() => boardEntryOk],
  boardOrder: [() => boardOrder],
  // @ts-expect-error -- replaced on purpose
  boardRows: [() => boardRows, v => (boardRows = v)],
  // @ts-expect-error -- replaced on purpose
  ghostDocNext: [() => ghostDocNext, v => (ghostDocNext = v)],
  // @ts-expect-error -- replaced on purpose
  ghostDocRead: [() => ghostDocRead, v => (ghostDocRead = v)],
  // @ts-expect-error -- replaced on purpose
  ghostPick: [() => ghostPick, v => (ghostPick = v)],
  // @ts-expect-error -- replaced on purpose
  runRecord: [() => runRecord, v => (runRecord = v)],
  // @ts-expect-error -- replaced on purpose
  validRunRecord: [() => validRunRecord, v => (validRunRecord = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const RECORD_V = 1,
  /** a record's JSON, at most (the rules cap ghosts/<uid>.last at the same) */
  RECORD_MOST = 8192,
  /** r a run, d a daily, w a weekly */
  RECORD_KINDS = ['r', 'd', 'w'];
export const RECORD_ID = /^[a-z0-9_]{1,64}$/,
  RECORD_KEYS = [
    'v',
    'seed',
    'kind',
    'n',
    'exp',
    'mods',
    'mapgenV',
    'unlocks',
    'won',
    'cleared',
    'leaders',
    'days',
    'party',
    'perks',
    'path',
    'name',
    't',
  ],
  ENTRY_KEYS = ['won', 'cleared', 'leaders', 'days', 'exp', 'lead', 't'];

/**
 * a run as its record, read as it ends (the run's own team, before runEnd puts the hub's back). `me` is the player
 * (their uid stamps a Billie's original trainer, their name the record's); `t` the time it ended (ms). What doesn't
 * fit RECORD_MOST is left out: first the unlocks, then the oldest of the path
 * @param {SaveData} s @param {Run} run @param {boolean} won @param {{ u: string, n: string }} me @param {number} t
 */
export function runRecord(s, run, won, me, t) {
  const party = s.team
    .map(m => onlineCopy(m, me))
    /* a nickname typed before names were cleaned everywhere goes out cleaned, not dropped */
    .map(m => (m && typeof m.nick === 'string' ? { ...m, nick: cleanName(m.nick, LEGAL_NICK_MOST) } : m))
    .filter(m => m && !legalBilly(m))
    .slice(0, 6);
  /** @type {any} */
  const r = {
    v: RECORD_V,
    seed: run.seed,
    kind: run.board ? run.board.k : 'r',
    n: run.board ? run.board.n : 0,
    exp: run.expedition || 1,
    mods: (run.mods || []).slice(0, 8),
    mapgenV: run.mapgenV,
    unlocks: (run.unlocks || []).slice(),
    won: won ? 1 : 0,
    cleared: new Set(run.path).size,
    leaders: (run.beat || []).length,
    days: run.clock,
    party,
    perks: (run.perks || []).slice(0, 6),
    path: run.path.slice(-64),
    name: cleanName(me.n || '', LEGAL_NAME_MOST) || 'Trainer',
    t,
  };
  if (JSON.stringify(r).length > RECORD_MOST) r.unlocks = [];
  while (JSON.stringify(r).length > RECORD_MOST && r.path.length) r.path.shift();
  while (JSON.stringify(r).length > RECORD_MOST && r.party.length > 1) r.party.pop();
  return r;
}

/** whether a record is one runRecord makes: the keys, their shapes and caps, every Billie legal online
 * @param {any} r */
export function validRunRecord(r) {
  if (!legalPlain(r) || Object.keys(r).some(k => !RECORD_KEYS.includes(k))) return false;
  const ids = (/** @type {any} */ v, /** @type {number} */ most) =>
    Array.isArray(v) && v.length <= most && v.every(x => typeof x === 'string' && RECORD_ID.test(x));
  return (
    r.v === RECORD_V &&
    typeof r.seed === 'string' &&
    /^[A-Za-z0-9|_-]{1,40}$/.test(r.seed) &&
    RECORD_KINDS.includes(r.kind) &&
    legalWhole(r.n, 0, 1e7) &&
    (r.kind === 'r') === (r.n === 0) &&
    legalWhole(r.exp, 1, 9) &&
    ids(r.mods, 8) &&
    legalWhole(r.mapgenV, 1, 1e6) &&
    ids(r.unlocks, 200) &&
    legalWhole(r.won, 0, 1) &&
    legalWhole(r.cleared, 0, 40) &&
    legalWhole(r.leaders, 0, 16) &&
    legalWhole(r.days, 1, 999) &&
    Array.isArray(r.party) &&
    r.party.length <= 6 &&
    r.party.every((/** @type {any} */ m) => legalBilly(m) === '') &&
    ids(r.perks, 6) &&
    Array.isArray(r.path) &&
    r.path.length <= 64 &&
    r.path.every((/** @type {any} */ i) => legalWhole(i, 0, 39)) &&
    typeof r.name === 'string' &&
    r.name.length <= LEGAL_NAME_MOST &&
    cleanName(r.name, LEGAL_NAME_MOST) === r.name &&
    Number.isFinite(r.t) &&
    r.t >= 0 &&
    JSON.stringify(r).length <= RECORD_MOST
  );
}

/** a record's line on a board: how it went, its Expedition, the Billie that led it ('' none), when
 * @param {any} r a valid record */
export const boardEntry = r => ({
  won: r.won,
  cleared: r.cleared,
  leaders: r.leaders,
  days: r.days,
  exp: r.exp,
  lead: r.party.length ? r.party[0].sp : '',
  t: r.t,
});
/** whether a board entry has boardEntry's shape (the rules check the same caps) @param {any} e */
export const boardEntryOk = e =>
  legalPlain(e) &&
  Object.keys(e).length === ENTRY_KEYS.length &&
  ENTRY_KEYS.every(k => Object.hasOwn(e, k)) &&
  legalWhole(e.won, 0, 1) &&
  legalWhole(e.cleared, 0, 40) &&
  legalWhole(e.leaders, 0, 16) &&
  legalWhole(e.days, 1, 999) &&
  legalWhole(e.exp, 1, 9) &&
  typeof e.lead === 'string' &&
  (e.lead === '' || RECORD_ID.test(e.lead)) &&
  Number.isFinite(e.t);
/** the boards' order: won first, then more places cleared, more leaders beaten, fewer days, then who posted first
 * @param {any} a @param {any} b */
export const boardOrder = (a, b) =>
  b.won - a.won || b.cleared - a.cleared || b.leaders - a.leaders || a.days - b.days || a.t - b.t;
/** the better of two entries (either may be missing) @param {any} a @param {any} b */
export const boardBetter = (a, b) => (!a ? b : !b ? a : boardOrder(b, a) < 0 ? b : a);

/**
 * a player's ghosts/<uid> document after a run ends: the record becomes the last run (the ghost friends meet); a
 * daily or weekly posts its entry only if none is there for that day or week (the first attempt; the rules refuse a
 * change); any other run keeps the best per Expedition and the fastest win. A daily posted more than a day late
 * (or a weekly a week late: a run that waited offline) keeps only its ghost: the rules take a board entry only for
 * the server's day or week, or the one before
 * @param {any} prev the document as it stands (null: none yet) @param {any} rec a valid record @param {string} name
 * @param {number} now ms
 */
export function ghostDocNext(prev, rec, name, now) {
  const P = ghostDocRead(prev),
    e = boardEntry(rec),
    /** @type {any} */
    doc = { name: cleanName(name || '', LEGAL_NAME_MOST) || 'Trainer', last: JSON.stringify(rec), x: { ...P.x } };
  if (P.day) doc.day = P.day;
  if (P.week) doc.week = P.week;
  if (P.fast) doc.fast = P.fast;
  const day = boardDay(now),
    week = boardWeek(now),
    fresh = (/** @type {number} */ n, /** @type {number} */ at) => n === at || n === at - 1;
  if (rec.kind === 'd' && fresh(rec.n, day) && !(P.day && P.day.n === rec.n)) doc.day = { n: rec.n, e };
  if (rec.kind === 'w' && fresh(rec.n, week) && !(P.week && P.week.n === rec.n)) doc.week = { n: rec.n, e };
  if (rec.kind === 'r') {
    doc.x[String(rec.exp)] = boardBetter(P.x[String(rec.exp)], e);
    if (rec.won && (!P.fast || e.days < P.fast.days)) doc.fast = e;
  }
  return doc;
}

/** a ghosts/<uid> document as read (a friend's, or mine), every part checked; what fails is left out
 * @param {any} d @returns {{ name: string, last: any, day: { n: number, e: any } | null,
 *   week: { n: number, e: any } | null, x: Record<string, any>, fast: any }} */
export function ghostDocRead(d) {
  const dated = (/** @type {any} */ v) =>
    legalPlain(v) && legalWhole(v.n, 0, 1e7) && boardEntryOk(v.e) ? { n: v.n, e: v.e } : null;
  let last = null;
  if (d && typeof d.last === 'string' && d.last.length <= RECORD_MOST)
    try {
      const r = JSON.parse(d.last);
      if (validRunRecord(r)) last = r;
    } catch {
      last = null;
    }
  /** @type {Record<string, any>} */
  const x = {};
  if (d && legalPlain(d.x))
    for (const [k, e] of Object.entries(d.x)) if (/^[1-9]$/.test(k) && boardEntryOk(e)) x[k] = e;
  return {
    name: d && typeof d.name === 'string' ? cleanName(d.name, LEGAL_NAME_MOST) || 'Trainer' : 'Trainer',
    last,
    day: d ? dated(d.day) : null,
    week: d ? dated(d.week) : null,
    x,
    fast: d && boardEntryOk(d.fast) ? d.fast : null,
  };
}

/**
 * one board's rows from the players' documents (mine among them), best first: `day` the daily of day n, `week` the
 * weekly of week n, `x<k>` the best run on Expedition k, `fast` the fastest win
 * @param {{ u: string, doc: any }[]} docs read through ghostDocRead @param {string} board @param {number} [n]
 * @returns {{ u: string, name: string, e: any }[]}
 */
export function boardRows(docs, board, n = 0) {
  /** @type {{ u: string, name: string, e: any }[]} */
  const rows = [];
  for (const { u, doc } of docs) {
    const e =
      board === 'day'
        ? doc.day && doc.day.n === n && doc.day.e
        : board === 'week'
          ? doc.week && doc.week.n === n && doc.week.e
          : board === 'fast'
            ? doc.fast
            : /^x[1-9]$/.test(board)
              ? doc.x[board.slice(1)]
              : null;
    if (e) rows.push({ u, name: doc.name, e });
  }
  return rows.sort((a, b) => (board === 'fast' ? a.e.days - b.e.days || a.e.t - b.e.t : boardOrder(a.e, b.e)));
}

/** the friend whose last run waits on a run's ghost node: drawn from the run's seed among the friends (by uid, so
 * the same friends give the same pick) whose last record has a party; never a blocked player. null: none
 * @param {{ u: string, doc: any }[]} docs friends' documents read through ghostDocRead @param {string} seed
 * @param {string[]} blocked @returns {RunGhost | null} */
export function ghostPick(docs, seed, blocked) {
  const can = docs
    .filter(({ u, doc }) => u && !blocked.includes(u) && doc.last && doc.last.party.length)
    .sort((a, b) => (a.u < b.u ? -1 : a.u > b.u ? 1 : 0));
  if (!can.length) return null;
  const { u, doc } = can[rngFrom(seed, 'ghost').int(0, can.length - 1)];
  return { u: u.slice(0, LEGAL_UID_MOST), n: doc.name, party: JSON.parse(JSON.stringify(doc.last.party)) };
}
