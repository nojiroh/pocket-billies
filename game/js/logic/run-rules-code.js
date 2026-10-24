// @ts-check
'use strict';
/* ================= RUN RULES THAT LIVE IN CODE (Studio plan Phase 2, T2.5) =================
   The numbers and choices a run's map and places follow that are written in the code, not in rules.json, for the Run
   Lab's rules card to show read-only beside the ones it edits (the rule against hidden magic numbers; moving them into
   the data is a game ticket of its own). Each names its file and the code that holds it; the Studio finds the line by
   searching that file (runRulesCodeLine), so the line shown can't go stale, and tools/test/run-rules-code.test.mjs
   fails when a snippet stops matching exactly one line. Logic only: no DOM. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  RUN_RULES_IN_CODE: [() => RUN_RULES_IN_CODE],
  // @ts-expect-error -- replaced on purpose
  runRulesCodeLine: [() => runRulesCodeLine, v => (runRulesCodeLine = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @typedef {{ what: string, value: string, file: string, code: string }} RunRuleInCode */
/** @type {RunRuleInCode[]} */
export const RUN_RULES_IN_CODE = [
  {
    what: 'Lanes a row may have',
    value: 'at most 2; only filler and rest rows widen (rules.run.map.wide is the chance)',
    file: 'game/js/logic/run-map.js',
    code: "return { width: (role === '' || role === 'rest') && wide ? 2 : 1, cross, west };",
  },
  {
    what: 'Which way a cross-link goes',
    value: 'even odds, west or east (rules.run.map.cross is whether there is one)',
    file: 'game/js/logic/run-map.js',
    code: 'west = g.next() < 0.5;',
  },
  {
    what: 'Where the mini-boss rows fall',
    value: 'evenly spaced: row round(k × rows / (mini-bosses + 1))',
    file: 'game/js/logic/run-map.js',
    code: "for (let k = 1; k <= M.minibosses; k++) rows[Math.round((k * M.rows) / (M.minibosses + 1))] = 'guard';",
  },
  {
    what: 'A rest stop before each mini-boss',
    value: 'the row before a mini-boss row is a rest row (rules.run.map.rest), when it is a filler',
    file: 'game/js/logic/run-map.js',
    code: "if (role === 'guard' && g >= 2 && rows[g - 1] === '') rows[g - 1] = 'rest';",
  },
  {
    what: 'Where links meet a scene’s side',
    value: 'one link: the middle; two: 10 m and 54 m along a 64 m edge',
    file: 'game/js/logic/run-map.js',
    code: 'export const RUN_EXIT_T = [',
  },
  {
    what: 'Where the run sits on the world map',
    value: 'x 0.72, step 0.18, lane 0.1, bend 0.06 (bowl radii); a side area 2 lanes north',
    file: 'game/js/logic/run-map.js',
    code: 'export const RUN_BOWL = { x: 0.72, step: 0.18, lane: 0.1, bend: 0.06, side: 2 };',
  },
  {
    what: 'Buildings by the main road',
    value: 'the landing: the airship’s mast; a town: a clinic and a shop; a waystation: a stand; a stall: a stall',
    file: 'game/js/logic/run-scenes.js',
    code: 'export const RUN_BUILDINGS = /** @type {Record<string, Record<string, number>>} */ ({',
  },
  {
    what: 'Wild levels',
    value: 'kept within 1–100',
    file: 'game/js/logic/run-scenes.js',
    code: 'lv = /** @type {[number, number]} */ (W.lv.map(v => Math.max(1, Math.min(100, v + up))));',
  },
  {
    what: 'How the foes fight',
    value: 'a mini-boss: a double battle that blocks the way on; the boss: its leader’s top Billie alone, as an Alpha',
    file: 'game/js/logic/run-loop.js',
    code: "boss = node.type === 'boss';",
  },
  {
    what: 'Which leaders a run meets',
    value:
      "the region's leaders, picked by its types (run-region.js), in order; else the trainers marked miniboss, none twice in a run while others are left",
    file: 'game/js/logic/run-loop.js',
    code: 'want = pool.find(T => T.id === pick);',
  },
];

/** the 1-based line of `code` in a file's text, or 0 when it isn't there exactly once
 * @param {string} text @param {string} code */
export function runRulesCodeLine(text, code) {
  const lines = String(text).split('\n'),
    at = lines.flatMap((l, k) => (l.includes(code) ? [k + 1] : []));
  return at.length === 1 ? at[0] : 0;
}
