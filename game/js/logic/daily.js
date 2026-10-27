// @ts-check
'use strict';
/* ================= DAILY AND WEEKLY RUNS (the online track, ON-2) =================
   The runs every player shares (docs/phases/online-track.md, ON-2; the owner, 2026-10-26): a daily from 00:00 UTC
   and a weekly from Monday 00:00 UTC. A board run is the same for everyone: its seed, its Expedition and challenges
   (rules.json run.boards), every unlock open, Blake meeting you for the first time and no hub person's bonus; who
   comes from home is still your own pick by starter points. Only the first attempt counts: the save marks the day
   (or week) when it takes off (meta.boards), and giving up ends it as a loss.
   Days and weeks are whole numbers from 1970-01-01 (UTC), the same sums firestore.rules does on request.time, so
   the rules can tell a board entry's day from the server's clock. Logic only: no DOM, no Date.now, no Math.random
   (tools/test/daily.test.mjs). */
/** @import { BoardRules } from '../../types/game-data' */
/** @import { RunBoard } from '../../types/save-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { rngFrom } from './rng.js';
/* eslint-disable no-func-assign */
expose({
  BOARD_KINDS: [() => BOARD_KINDS],
  DAY_MS: [() => DAY_MS],
  boardDay: [() => boardDay],
  // @ts-expect-error -- replaced on purpose
  boardPlan: [() => boardPlan, v => (boardPlan = v)],
  boardPlayed: [() => boardPlayed],
  boardSeed: [() => boardSeed],
  boardWeek: [() => boardWeek],
  boardWeekStart: [() => boardWeekStart],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const DAY_MS = 86400000,
  /** d: the daily, w: the weekly */
  BOARD_KINDS = /** @type {const} */ (['d', 'w']);

/** the UTC day number of a time (0 = 1970-01-01) @param {number} now ms */
export const boardDay = now => Math.floor(now / DAY_MS);
/** the week number of a time: weeks start on Monday 00:00 UTC (1970-01-01 was a Thursday, so day 4 starts week 1)
 * @param {number} now ms */
export const boardWeek = now => Math.floor((boardDay(now) + 3) / 7);
/** the first day of a week @param {number} w */
export const boardWeekStart = w => w * 7 - 3;
/** a board run's seed: 'd' and the day's date for a daily (as logic/rng.js dailySeed), 'w' and its Monday's for a
 * weekly @param {'d' | 'w'} k @param {number} n the day or week number */
export const boardSeed = (k, n) =>
  k + new Date((k === 'd' ? n : boardWeekStart(n)) * DAY_MS).toISOString().slice(0, 10);

/**
 * a board run as it starts: its kind and day (or week), seed, Expedition and challenges. A daily is rules.json
 * run.boards.daily as it stands; a weekly draws its Expedition from `expedition` [lo, hi] and `picks` [lo, hi] of
 * `challenges` from the week's own stream, so every player gets the same.
 * @param {'d' | 'w'} k @param {number} now ms @param {BoardRules} R rules.json run.boards
 * @returns {{ board: RunBoard, seed: string, expedition: number, mods: string[] }}
 */
export function boardPlan(k, now, R) {
  const n = k === 'd' ? boardDay(now) : boardWeek(now),
    seed = boardSeed(k, n);
  if (k === 'd') return { board: { k, n }, seed, expedition: R.daily.expedition, mods: R.daily.challenges.slice() };
  const W = R.weekly,
    g = rngFrom(seed, 'board'),
    expedition = g.int(W.expedition[0], W.expedition[1]),
    left = W.challenges.slice(),
    /** @type {string[]} */
    mods = [];
  for (let c = g.int(W.picks[0], Math.min(W.picks[1], left.length)); c > 0 && left.length; c--)
    mods.push(left.splice(g.int(0, left.length - 1), 1)[0]);
  /* in modifiers.json's order, as the start sheet lists them */
  return { board: { k, n }, seed, expedition, mods: W.challenges.filter(id => mods.includes(id)) };
}

/** whether the save has taken off on this board's run already (meta.boards: the last day and week taken)
 * @param {{ d?: number, w?: number } | undefined} played meta.boards @param {RunBoard} board */
export const boardPlayed = (played, board) => !!played && played[board.k] === board.n;
