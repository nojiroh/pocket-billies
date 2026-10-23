// @ts-check
'use strict';
/* ================= "PLAY THIS SEED": A TEST RUN'S ADDRESS (Studio plan Phase 2, T2.6) =================
   The game's address for a test run on a seed, behind ?debug only (boot.js makes it a test run: a fresh game that is
   never saved and never signs in, then a take-off from the mast as runTakeOff does):
     ?debug&run=<seed>         the seed, cleaned as the debug menu's Start a run cleans it (A-Z a-z 0-9 _ -, 20 at most)
     &unlocks=none|all|<ids>   what the save has unlocked (none: a fresh save's, the default)
     &short=1                  the debug menu's short map (RUN_TEST_SHORT)
     &party=<sp@lv,...>        who flies (species ids at a level, 1-100); none: the first starter, as a new game
     &relics=<ids>             Perks held from the start (rules.json run.relics.cap at most)
     &draft=1                  the open Studio's unsaved data first (boot.js studioDraftReady)
   An id the data doesn't know is left out and named in `left`. Logic only: no DOM (tools/test/run-test.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  RUN_TEST_SHORT: [() => RUN_TEST_SHORT],
  // @ts-expect-error -- replaced on purpose
  runTestOf: [() => runTestOf, v => (runTestOf = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the debug menu's short run (debug-menu.js runstart) */
export const RUN_TEST_SHORT = { rows: 5, minibosses: 1 };

/**
 * a test run's address, or null (no ?debug, or no seed)
 * @param {{ has: (k: string) => boolean, get: (k: string) => string | null }} q the address's query (URLSearchParams)
 * @param {{ species: Record<string, any>, unlocks: Record<string, any>, perks: Record<string, any>, cap: number }} D
 */
export function runTestOf(q, D) {
  if (!q.has('debug')) return null;
  const seed = String(q.get('run') || '')
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 20);
  if (!seed) return null;
  /** @type {string[]} */
  const left = [],
    list = (/** @type {string} */ k) =>
      (q.get(k) || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
    known = (/** @type {string[]} */ ids, /** @type {Record<string, any>} */ T, /** @type {string} */ what) =>
      ids.filter(id => Object.hasOwn(T, id) || (left.push(`${what} ${id}`), false));
  const u = q.get('unlocks') || 'none',
    unlocks = u === 'all' ? Object.keys(D.unlocks) : u === 'none' ? [] : known(list('unlocks'), D.unlocks, 'unlock'),
    party = list('party')
      .map(e => {
        const [sp, lv] = e.split('@');
        return { sp, lv: Math.max(1, Math.min(100, Math.round(+lv) || 1)) };
      })
      .filter(p => Object.hasOwn(D.species, p.sp) || (left.push(`Billie ${p.sp}`), false)),
    relics = known(list('relics'), D.perks, 'Perk').slice(0, Math.max(0, D.cap));
  return { seed, unlocks, short: q.get('short') === '1', party, relics, draft: q.get('draft') === '1', left };
}
