// Studio plan T2.3: a run map's structural checks and the seed sweep (game/js/logic/data-checks.js runMapProblems,
// runMapSweep), which the Studio's Run Lab shows over 1,000 seeds. On the game's rules every map of 1,000 seeds holds
// them, in well under a second; a planted bad rule is named with a seed that shows it. WM-2: the grid (footprints, links
// by shared edges, never west, the landing's north and east), two route-like places before every town, the path's
// places and the towns on a walk within the rules.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const C = modules['data-checks'];
const { runMapMake } = modules['run-map'];
const T = GAME_DATA.nodeTypes,
  M = GAME_DATA.rules.run.map,
  rules = (/** @type {object} */ o) => ({ ...M, ...o });

test('the game’s rules: 1,000 maps hold every check, in under a second', () => {
  const t0 = performance.now(),
    S = C.runMapSweep(T, M, { n: 1000 }),
    ms = performance.now() - t0;
  assert.deepEqual(S.problems, []);
  assert.equal(S.maps, 1000);
  assert.ok(ms < 1000, `${Math.round(ms)} ms`);
  assert.deepEqual([S.path.min, S.path.max], M.path[0], 'Expedition I’s places a path');
  assert.ok(S.nodes.min >= S.path.min && S.nodes.max <= 2 * S.path.max);
  assert.equal(S.types.boss, 1000);
  assert.equal(S.types.landing, 1000);
  assert.ok(S.townsPerPath.min >= M.towns[0], 'a town after each mini-boss is on every path');
  assert.ok(S.grid.high.max <= 7 && S.grid.wide.min >= 6, JSON.stringify(S.grid));
  assert.ok(S.dirs.E > 0 && S.dirs.N > 0 && S.dirs.S > 0 && !S.dirs.W && !S.dirs['?'], JSON.stringify(S.dirs));
  assert.ok(S.ratio.towns > 0 && S.ratio.routes > 0);
  assert.ok(Object.keys(S.biomes).every(b => M.biomes[b] > 0));
  for (const o of S.outliers) assert.ok(o.seed && o.why);
});

test('one map: reachable, no dead end, each role row holds its type', () => {
  const map = runMapMake('CHECK1', T, M);
  assert.deepEqual(C.runMapProblems(map, M), []);
  const cut = structuredClone(map);
  cut.nodes[0].to = cut.nodes[0].to.slice(0, 1);
  const lone = cut.nodes.findIndex((n, i) => i > 0 && !cut.nodes.some(m => m.to.includes(i)));
  if (lone > 0) assert.ok(C.runMapProblems(cut, M).some(p => p.includes(`place ${lone} can’t be reached`)));
  const dead = structuredClone(map);
  dead.nodes[1].to = [];
  assert.ok(C.runMapProblems(dead, M).some(p => p.includes('place 1 leads nowhere')));
});

test('a planted bad rule is named with a seed that shows it', () => {
  // a mini-boss row on the last row: the rows can't hold it
  const tight = C.runMapSweep(T, rules({ rows: 2, minibosses: 1 }), { n: 50 });
  assert.equal(tight.maps, 0);
  assert.match(tight.problems[0].text, /can.t make a map/);
  assert.ok(tight.problems[0].seed);
  // the last row made a mini-boss: no boss, so the run can't end
  const noBoss = C.runMapSweep(T, rules({ last: 'miniboss' }), { n: 50 });
  assert.ok(noBoss.problems.some(p => /last row .*not the boss/.test(p.text) && p.seed && p.count === 50));
  // rest rows made routes: no town before a mini-boss
  const noRest = C.runMapSweep(T, rules({ rest: 'route' }), { n: 50 });
  assert.ok(noRest.problems.some(p => /rest row .*not a town/.test(p.text)));
});

test('RL-12b: never two places that sell things one after the other; the sweep would name a map that had them', () => {
  for (let k = 0; k < 500; k++) {
    const map = runMapMake('SHOPS' + k, T, M);
    for (const n of map.nodes)
      if (T[n.type].shop)
        for (const j of n.to) assert.ok(!T[map.nodes[j].type].shop, `SHOPS${k}: ${n.type} then ${map.nodes[j].type}`);
  }
  /* WM-2: at Expedition I's 9-10 places every free row is before a mini-boss (route-like) or after a town (no
     stall), so stalls come with the longer paths */
  const S = C.runMapSweep(T, M, { n: 500, expedition: 5 });
  assert.ok(S.types.event > 0 && S.types.stall > 0, 'waystations and stalls are drawn');
  const two = structuredClone(runMapMake('CHECK1', T, M)),
    a = two.nodes.findIndex(n => n.to.length);
  two.nodes[a].type = 'stall';
  for (const j of two.nodes[a].to) two.nodes[j].type = 'town';
  assert.ok(C.runMapProblems(two, M, T).some(p => p.includes('two places that sell things in a row')));
  /* without the node types (an older caller) the check stays out */
  assert.ok(!C.runMapProblems(two, M).some(p => p.includes('sell things')));
});

test('WM-2: every Expedition’s paths, towns and grid; the checks name a broken grid and a town too soon', () => {
  M.path.forEach(([lo, hi], k) => {
    const S = C.runMapSweep(T, M, { n: 300, expedition: k + 1, prefix: 'EXP' + k });
    assert.deepEqual(S.problems, [], `Expedition ${k + 1}`);
    assert.deepEqual([S.path.min, S.path.max], [lo, hi], `Expedition ${k + 1}`);
    assert.ok(S.townsPerPath.min >= M.towns[0] && S.townsPerPath.max <= M.towns[1], `Expedition ${k + 1}`);
  });
  const map = runMapMake('CHECK1', T, M),
    has = (/** @type {any} */ m, /** @type {string} */ text) => C.runMapProblems(m, M, T).some(p => p.includes(text));
  assert.deepEqual(C.runMapProblems(map, M, T), []);
  const over = structuredClone(map);
  over.nodes[2].at = over.nodes[1].at.slice();
  assert.ok(has(over, 'overlap on the grid'));
  const far = structuredClone(map),
    j = far.nodes[0].to[0];
  far.nodes[j].at = [far.nodes[j].at[0] + 9, far.nodes[j].at[1]];
  assert.ok(has(far, `place 0 leads to place ${j}, which doesn’t share an edge`));
  const west = structuredClone(map);
  west.nodes[west.nodes[0].to[0]].at = [-2, 0];
  assert.ok(has(west, 'leads west'));
  assert.ok(has(west, 'not north and east'));
  const bare = structuredClone(map);
  delete bare.nodes[3].at;
  assert.ok(has(bare, 'no footprint'));
  /* a town right after the landing's row: fewer than 2 routes before it */
  const soon = structuredClone(map);
  for (const i of soon.nodes[0].to) soon.nodes[i].type = 'event';
  assert.ok(has(soon, 'after fewer than 2 routes (1)'));
  /* a planted short path and a missing town */
  const short = C.runMapSweep(T, { ...M, path: [[9, 9]], towns: [3, 3] }, { n: 20 });
  assert.ok(short.problems.some(p => /can.t make a map/.test(p.text)));
  const one = C.runMapProblems(runMapMake('ONE', T, { ...M, rows: 13, minibosses: 1 }), M, T);
  assert.ok(one.includes('13 places a path, not 9 to 12'), one.join('; '));
  assert.ok(one.includes('towns on a walk: 1, not 2 to 3'), one.join('; '));
});
