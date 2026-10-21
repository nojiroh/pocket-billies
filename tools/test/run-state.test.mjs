// RL-3: logic/run-state.js, the run in the save (saveData.run, roguelite-track.md 2a): a new run, the strict load
// check, starting a run (the hub's working fields set aside), ending it (the payout, the hub put back, the Billies
// kept) and the payout's sums.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fn, modules, startedSave } from './setup-fixture.mjs';

const { newRun, validRun, runBegin, runEnd, runRestore, payoutOf, runNodeCount, RUN_FIELDS } = modules['run-state'];
const { newMeta } = modules['meta-state'];
const RATES = { money: 0.1, itemShare: 0.5, released: 15, node: 10, win: 100, winSeals: 1 };
const PRICE = id => ({ potion: 200 })[id] || 0;
const GIVE = { seed: 'ABCDE12345', tier: 1, mapgenV: 1, se: 300, items: { potion: 1 } };
const copy = v => JSON.parse(JSON.stringify(v));

/** a hub save with meta, as newSave makes from RL-3 on */
function hubSave() {
  const s = startedSave('sparky0', 10);
  s.team.push(fn('makeBilly')('drip0', 7));
  s.se = 1234;
  s.items.potion = 4;
  s.flags = { tutorial: 1 };
  s.seats = ['seat_one'];
  s.visited = { 0: 1, 2: 1 };
  s.trip = { node: 2, plan: [1] };
  s.run = null;
  s.meta = newMeta();
  return s;
}
const MAP = {
  nodes: [
    { type: 'landing', row: 0, lane: 0, to: [1, 2] },
    { type: 'route', row: 1, lane: 0, to: [3] },
    { type: 'route', row: 1, lane: 1, to: [3] },
    { type: 'town', row: 2, lane: 0, to: [4] },
    { type: 'miniboss', row: 3, lane: 0, to: [] },
  ],
};

test('run: a new run starts on day 1 at the airship with nothing held', () => {
  const r = newRun('ABCDE12345', 2, 1, { team: [] });
  assert.equal(r.seed, 'ABCDE12345');
  assert.equal(r.tier, 2);
  assert.equal(r.clock, 1);
  assert.deepEqual(r.at, { phase: 'fly', battle: -1 });
  assert.equal(r.map, null);
  assert.deepEqual([r.relics, r.mods, r.path, r.log, r.released], [[], [], [], [], []]);
  assert.equal(runNodeCount(r), 1, 'Copperleaf alone until the map is made');
  assert.equal(runNodeCount({ ...r, map: MAP }), 6);
  assert.equal(runNodeCount(null), 1);
});

test('run: starting one sets the hub aside and gives the run its own working fields', () => {
  const s = hubSave(),
    before = copy(s);
  const run = runBegin(s, GIVE);
  assert.equal(s.run, run);
  for (const k of RUN_FIELDS) assert.deepEqual(run.start[k], before[k], `run.start.${k} is the hub's`);
  assert.deepEqual(s.team, before.team, 'the party travels');
  assert.notEqual(s.team[0], run.start.team[0], 'as a copy');
  assert.equal(s.se, 300);
  assert.equal(s.items.potion, 1);
  assert.ok(
    Object.keys(before.items).every(k => k in s.items),
    'every item key, at 0 unless given'
  );
  assert.deepEqual(s.trip, { node: 0, plan: [] });
  assert.deepEqual([s.wild, s.eggs, s.visited], [{}, [], { 0: 1 }]);
  assert.deepEqual([s.flags, s.seats], [before.flags, before.seats], 'story flags and badges carry over');
  assert.equal(validRun(run), true);
  assert.throws(() => runBegin(s, GIVE), /already/);
  // what happens in the run never reaches the hub's copy
  s.team[0].lvl = 50;
  s.flags.won_something = 1;
  assert.equal(run.start.team[0].lvl, 10);
  assert.equal(run.start.flags.won_something, undefined);
});

test('run: the load check refuses broken or tampered runs', () => {
  const s = hubSave();
  const ok = copy({ ...runBegin(s, GIVE), map: MAP, path: [0, 1], forecast: [['sun'], ['rain', 'sun']] });
  assert.equal(validRun(ok), true);
  const bad = [
    null,
    [],
    { ...ok, seed: '' },
    { ...ok, seed: 'has space' },
    { ...ok, seed: 'x'.repeat(41) },
    { ...ok, tier: 0 },
    { ...ok, mapgenV: 0 },
    { ...ok, map: { nodes: [] } },
    { ...ok, map: { nodes: [{ ...MAP.nodes[0], to: [9] }] } }, // a link off the map
    { ...ok, map: { nodes: [{ ...MAP.nodes[0], to: [0] }] } }, // to itself
    { ...ok, map: { nodes: [{ ...MAP.nodes[0], type: 'Bad Type' }] } },
    { ...ok, at: { phase: 'nap', battle: -1 } },
    { ...ok, at: { phase: 'walk', battle: -2 } },
    { ...ok, clock: 0 },
    { ...ok, forecast: [['sun'], 'rain'] },
    { ...ok, forecast: Array(7).fill([]) }, // more nodes than the map has
    { ...ok, relics: ['ok', 7] },
    { ...ok, offer: ['a', 'b', 'c', 'd', 'e', 'f'] },
    { ...ok, uidN: -1 },
    { ...ok, path: [5] }, // map nodes are 0..4
    { ...ok, log: ['x'.repeat(81)] },
    { ...ok, released: [{ sp: 'sparky0', lvl: 0 }] },
    { ...ok, hints: { first: 2 } },
    { ...ok, start: null },
    { ...ok, start: { ...ok.start, team: 'all' } },
    { ...ok, start: { ...ok.start, se: -1 } },
    { ...ok, start: { ...ok.start, trip: { node: 'x', plan: [] } } },
    { ...ok, start: { ...ok.start, seats: [1] } },
  ];
  for (const b of bad) assert.equal(validRun(b), false, JSON.stringify(b).slice(0, 200));
  assert.equal(validRun(JSON.parse(JSON.stringify(ok).replace('"hints":{}', '"hints":{"__proto__":1}'))), false);
});

test('run: the payout converts money, items, releases, nodes and a win into Capital, and a win into a Seal', () => {
  const p = payoutOf({ se: 455, items: { potion: 3, nothing: 2 }, released: 2, cleared: 4, won: true }, RATES, PRICE);
  assert.deepEqual(
    p.lines.map(l => [l.what, l.n, l.capital]),
    [
      ['money', 455, 45],
      ['items', 300, 30],
      ['released', 2, 30],
      ['nodes', 4, 40],
      ['win', 1, 100],
    ]
  );
  assert.equal(p.capital, 245);
  assert.equal(p.seals, 1);
  const lost = payoutOf({ se: 0, items: {}, released: 0, cleared: 1, won: false }, RATES, PRICE);
  assert.deepEqual([lost.capital, lost.seals], [10, 0]);
});

test('run: ending one pays into meta, puts the hub back and keeps the chosen Billies', () => {
  const s = hubSave(),
    hub = copy(s);
  const run = runBegin(s, GIVE);
  run.path = [0, 1, 0, 1, 3]; // walked back to the landing once: still three nodes cleared
  run.released.push({ sp: 'sprout0', lvl: 4 });
  s.se = 500;
  s.items.potion = 2;
  s.team[0].lvl = 14; // the starter gained levels in the run
  s.team[1].lvl = 12; // so did the second traveller
  const caught = fn('makeBilly')('sprout0', 6);
  s.team.push(caught);
  s.flags.run_flag = 1;
  const pay = runEnd(s, { won: false, keep: [s.team[0].uid] }, RATES, PRICE);
  assert.equal(s.run, null);
  assert.equal(pay.capital, 50 + 20 + 15 + 30);
  assert.deepEqual(s.meta, { ...newMeta(), capital: pay.capital, runs: 1 });
  for (const k of RUN_FIELDS.filter(k => k !== 'team')) assert.deepEqual(s[k], hub[k], `${k} is the hub's again`);
  assert.equal(s.team.length, 2, 'the Billie caught in the run is gone');
  assert.equal(s.team[0].lvl, 14, 'the kept traveller keeps its gains');
  assert.equal(s.team[1].lvl, 7, 'the other traveller comes back as it left');
  // a win, keeping the run-caught Billie: it joins the team (the box when the team is full)
  const t = hubSave();
  runBegin(t, GIVE);
  const fresh = fn('makeBilly')('sprout0', 6);
  t.team.push(fresh);
  runEnd(t, { won: true, keep: [fresh.uid] }, RATES, PRICE);
  assert.deepEqual([t.meta.runs, t.meta.wins, t.meta.seals], [1, 1, 1]);
  assert.equal(t.team.length, 3);
  assert.equal(t.team[2].uid, fresh.uid);
  const u = hubSave();
  while (u.team.length < 6) u.team.push(fn('makeBilly')('drip0', 5));
  runBegin(u, GIVE);
  const extra = { ...fn('makeBilly')('sprout0', 6), uid: 'extra-1' };
  u.team[5] = extra; // swapped in during the run
  const boxBefore = u.box.length;
  runEnd(u, { won: true, keep: ['extra-1', 'not-in-team'] }, RATES, PRICE);
  assert.equal(u.team.length, 6);
  assert.equal(u.box.length, boxBefore + 1);
  assert.equal(u.box.at(-1).uid, 'extra-1');
  assert.throws(() => runEnd(u, { won: false, keep: [] }, RATES, PRICE), /no run/);
});

test('run: restoring leaves the run without paying (a run that cannot be resumed)', () => {
  const s = hubSave(),
    hub = copy(s);
  runBegin(s, GIVE);
  s.se = 1;
  runRestore(s);
  assert.equal(s.run, null);
  for (const k of RUN_FIELDS) assert.deepEqual(s[k], hub[k]);
  assert.deepEqual(s.meta, newMeta());
  const t = { ...hubSave(), run: { start: null } };
  runRestore(t);
  assert.equal(t.run, null, 'a run with no hub copy just ends');
});
