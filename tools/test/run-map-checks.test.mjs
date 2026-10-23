// Studio plan T2.3: a run map's structural checks and the seed sweep (game/js/logic/data-checks.js runMapProblems,
// runMapSweep), which the Studio's Run Lab shows over 1,000 seeds. On the game's rules every map of 1,000 seeds holds
// them, in well under a second; a planted bad rule is named with a seed that shows it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const C = modules['data-checks'];
const { runMapMake } = modules['run-map'];
const T = GAME_DATA.nodeTypes,
  M = GAME_DATA.rules.run.map,
  clock = GAME_DATA.rules.run.clock,
  rules = (/** @type {object} */ o) => ({ ...M, ...o });

test('the game’s rules: 1,000 maps hold every check, in under a second', () => {
  const t0 = performance.now(),
    S = C.runMapSweep(T, M, clock, { n: 1000 }),
    ms = performance.now() - t0;
  assert.deepEqual(S.problems, []);
  assert.equal(S.maps, 1000);
  assert.ok(ms < 1000, `${Math.round(ms)} ms`);
  assert.ok(S.nodes.min >= M.rows && S.nodes.max <= 2 * M.rows);
  assert.equal(S.types.boss, 1000);
  assert.equal(S.types.landing, 1000);
  assert.ok(S.townsPerPath.min >= M.minibosses, 'a rest stop before each mini-boss is on every path');
  assert.ok(S.ratio.towns > 0 && S.ratio.routes > 0);
  assert.ok(Object.keys(S.biomes).every(b => M.biomes[b] > 0));
  for (const o of S.outliers) assert.ok(o.seed && o.why);
});

test('one map: reachable, no dead end, each role row holds its type', () => {
  const map = runMapMake('CHECK1', T, M);
  assert.deepEqual(C.runMapProblems(map, M, clock), []);
  const cut = structuredClone(map);
  cut.nodes[0].to = cut.nodes[0].to.slice(0, 1);
  const lone = cut.nodes.findIndex((n, i) => i > 0 && !cut.nodes.some(m => m.to.includes(i)));
  if (lone > 0) assert.ok(C.runMapProblems(cut, M, clock).some(p => p.includes(`place ${lone} can’t be reached`)));
  const dead = structuredClone(map);
  dead.nodes[1].to = [];
  assert.ok(C.runMapProblems(dead, M, clock).some(p => p.includes('place 1 leads nowhere')));
  assert.ok(C.runMapProblems(map, M, { ...clock, slack: -1 }).some(p => p.includes('deadline')));
});

test('a planted bad rule is named with a seed that shows it', () => {
  // a mini-boss row on the last row: the rows can't hold it
  const tight = C.runMapSweep(T, rules({ rows: 2, minibosses: 1 }), clock, { n: 50 });
  assert.equal(tight.maps, 0);
  assert.match(tight.problems[0].text, /can.t make a map/);
  assert.ok(tight.problems[0].seed);
  // the last row made a mini-boss: no boss, so the run can't end
  const noBoss = C.runMapSweep(T, rules({ last: 'miniboss' }), clock, { n: 50 });
  assert.ok(noBoss.problems.some(p => /last row .*not the boss/.test(p.text) && p.seed && p.count === 50));
  // rest rows made routes: no town before a mini-boss
  const noRest = C.runMapSweep(T, rules({ rest: 'route' }), clock, { n: 50 });
  assert.ok(noRest.problems.some(p => /rest row .*not a town/.test(p.text)));
});
