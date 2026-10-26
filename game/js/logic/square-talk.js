// @ts-check
'use strict';
/* ================= THE SQUARE'S TALK (hub track HB-10d) =================
   After a run Copperleaf's square talks about it until the next one: the folk standing at its stops (square-day.js)
   cheer a won run and gossip about a lost one (or one given up). Their lines are banter.json's rows for `square_won`
   and `square_lost` (the story director's table, RL-S1), each one line, its `when` read on the run history (`last:`,
   `lastby:`, `history:`). Unlike a hub character's line, which picks one, the square keeps every line that holds: its
   folk take turns through them, the most fitting (highest priority) first.
   Logic only: no DOM, runs in Node (tools/test/square-talk.test.mjs). */
/** @import { BanterLine } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
import { LINE_ID } from './script-parse.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  squareMood: [() => squareMood, v => ((squareMood = v), provide({ squareMood }))],
  // @ts-expect-error -- replaced on purpose
  squareTalk: [() => squareTalk, v => ((squareTalk = v), provide({ squareTalk }))],
});
/* eslint-enable no-func-assign */
provide({ squareMood, squareTalk });
/* to-module: end */
/** how the square feels about your last run: 'won', 'lost' (a run given up counts), or null before the first
 * @param {{ end?: string }[] | undefined} history meta.history, oldest first @returns {'won' | 'lost' | null} */
export function squareMood(history) {
  const e = history && history.length ? history[history.length - 1] : null;
  if (!e || !e.end) return null;
  return e.end === 'won' ? 'won' : 'lost';
}

/** the lines the square's folk say in this mood: every `square_<mood>` line whose `when` holds, highest priority
 * first (then by id), its line id and any speaker taken off (a bubble shows the words alone)
 * @param {Record<string, BanterLine>} banter banter.json @param {'won' | 'lost' | null} mood
 * @param {(cond: string) => boolean} holds whether a condition holds @returns {string[]} */
export function squareTalk(banter, mood, holds) {
  if (!mood) return [];
  const who = 'square_' + mood;
  return Object.entries(banter || {})
    .filter(([, B]) => B.who === who && (!B.when || holds(B.when)))
    .sort(([a, A], [b, B]) => B.priority - A.priority || (a < b ? -1 : 1))
    .map(([, B]) => B.script[0].replace(LINE_ID, '').replace(/^[A-Z][\w .'-]{0,24}:\s+/, ''));
}
