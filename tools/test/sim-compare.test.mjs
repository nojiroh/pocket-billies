// Studio plan T3.4: the simulation's numbers and their compare (game/js/logic/sim-compare.js), pure: the Wilson
// interval, paired differences, a report's summary, two reports of the same seeds compared, the data hash.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modules } from './setup-fixture.mjs';

const C = modules['sim-compare'];

test('sim compare: the Wilson interval (95%) against known values', () => {
  /* textbook values: 0 of 10 -> [0, 0.2775]; 5 of 10 -> [0.2366, 0.7634]; 81 of 263 -> [0.2553, 0.3662] */
  assert.deepEqual(C.simWilson(0, 10), { k: 0, n: 10, p: 0, lo: 0, hi: 0.278 });
  assert.deepEqual(C.simWilson(5, 10), { k: 5, n: 10, p: 0.5, lo: 0.237, hi: 0.763 });
  const w = C.simWilson(81, 263);
  assert.equal(w.lo, 0.255);
  assert.equal(w.hi, 0.366);
  assert.deepEqual(C.simWilson(10, 10), { k: 10, n: 10, p: 1, lo: 0.722, hi: 1 });
  assert.deepEqual(C.simWilson(0, 0), { k: 0, n: 0, p: 0, lo: 0, hi: 1 }, 'no runs: anything');
});

test('sim compare: paired differences, their mean and interval; all zero gives [0, 0]', () => {
  assert.deepEqual(C.simPaired([0, 0, 0]), { n: 3, mean: 0, lo: 0, hi: 0, changed: 0 });
  const p = C.simPaired([-60, -60, -120, 0]);
  assert.equal(p.mean, -60);
  assert.equal(p.changed, 3);
  /* sd = sqrt(((0)^2 + 0 + 60^2 + 60^2) / 3) = 48.99; half = 1.959964 * 48.99 / 2 = 48.009 */
  assert.equal(p.lo, -108.009);
  assert.equal(p.hi, -11.991);
  assert.deepEqual(C.simPaired([]), { n: 0, mean: 0, lo: 0, hi: 0, changed: 0 });
});

const run = (o = {}) => ({
  won: false,
  lostAt: 'town',
  lostRow: 2,
  days: 4,
  places: 4,
  battles: 3,
  caught: 1,
  healed: 60,
  spent: 30,
  se: 500,
  research: 80,
  top: 9,
  perks: [],
  foes: [],
  moneyIn: { prize: 100 },
  moneyOut: { heal: 60 },
  ...o,
});

test('sim compare: a summary has the win rate, losses by type and row, money, Perks and leaders', () => {
  const S = C.simSummary([
    run(),
    run({ won: true, lostAt: '', lostRow: null, perks: ['offshore'], foes: [{ leader: 'crude', won: true }] }),
    run({ lostAt: 'miniboss', lostRow: 3, perks: ['offshore', 'hedge'], foes: [{ leader: 'crude', won: false }] }),
  ]);
  assert.equal(S.runs, 3);
  assert.equal(S.won.k, 1);
  assert.deepEqual(S.lostAt, { town: 1, miniboss: 1 });
  assert.deepEqual(S.lostRow, { 2: 1, 3: 1 });
  assert.deepEqual(S.perks, { offshore: 2, hedge: 1 });
  assert.equal(S.leaders.crude.fought, 2);
  assert.equal(S.leaders.crude.beaten, 1);
  assert.equal(S.avg.perks, 1);
  assert.equal(S.avg.moneyLeft, 500);
  assert.deepEqual(S.moneyIn, { prize: 100 });
  assert.deepEqual(S.moneyOut, { heal: 60 });
});

test('sim compare: identical reports show zero difference; a dearer clinic shows a paired one with flips', () => {
  const seeds = ['A', 'B', 'C', 'D'],
    base = { seeds, results: seeds.map((_s, i) => run({ won: i === 0, healed: 60 * (i + 1) })) },
    same = C.simCompare(base, JSON.parse(JSON.stringify(base)));
  assert.equal(same.same, true);
  for (const k of C.SIM_METRICS) assert.deepEqual(same.diff[k], { n: 4, mean: 0, lo: 0, hi: 0, changed: 0 }, k);
  assert.deepEqual(same.flips, { won: [], lost: [] });
  const draft = { seeds, results: base.results.map((r, i) => ({ ...r, healed: r.healed * 2, won: i === 1 })) },
    c = C.simCompare(base, draft);
  assert.equal(c.same, false);
  assert.equal(c.diff.healed.mean, 150);
  assert.ok(c.diff.healed.lo > 0, 'the interval is above 0');
  assert.deepEqual(c.flips, { won: ['B'], lost: ['A'] });
  assert.equal(c.diff.won.mean, 0);
  assert.throws(() => C.simCompare(base, { seeds: ['A'], results: [run()] }), /different seeds/);
});

test('sim compare: the data hash is the same for the same data in any key order, and changes with a value', () => {
  const a = C.simDataHash({ rules: { run: { healCost: 60, x: [1, 2] } }, b: 1 });
  assert.match(a, /^[0-9a-f]{8}$/);
  assert.equal(C.simDataHash({ b: 1, rules: { run: { x: [1, 2], healCost: 60 } } }), a);
  assert.notEqual(C.simDataHash({ b: 1, rules: { run: { x: [1, 2], healCost: 120 } } }), a);
});

test('sim compare: the seed list, the banner, a report compare refuses unpaired reports; the hash skips maps', () => {
  assert.deepEqual(C.simSeeds(3), ['SIM0', 'SIM1', 'SIM2']);
  const policy = { name: 'greedy-forward' };
  assert.equal(C.simBanner(policy), 'Bot policy greedy-forward: a lower bound on a careful player, not a prediction');
  const seeds = C.simSeeds(2),
    rep = h => ({
      seeds,
      results: [run(), run()],
      options: { team: 3 },
      policy,
      policyDriven: ['caught'],
      dataHash: h,
    }),
    c = C.simCompareReports(rep('aaaa0000'), rep('bbbb1111'));
  assert.equal(c.kind, 'pb-sim-compare');
  assert.equal(c.banner, C.simBanner(policy));
  assert.deepEqual(c.hash, { base: 'aaaa0000', draft: 'bbbb1111' });
  assert.equal(c.same, true);
  assert.throws(() => C.simCompareReports(rep('a'), { ...rep('b'), options: { team: 1 } }), /different options/);
  assert.throws(() => C.simCompareReports(rep('a'), { ...rep('b'), policy: { name: 'x' } }), /different policy/);
  assert.equal(C.simDataHash({ rules: 1, maps: { a: 1 } }), C.simDataHash({ rules: 1, maps: { a: 2 } }), 'maps');
  assert.notEqual(C.simDataHash({ rules: 1 }), C.simDataHash({ rules: 2 }));
});
