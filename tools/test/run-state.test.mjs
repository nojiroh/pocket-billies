// RL-3: logic/run-state.js, the run in the save (saveData.run, roguelite-track.md 2a): a new run, the strict load
// check, starting a run (the hub's working fields set aside), ending it (the payout, the hub put back, the Billies
// kept) and the payout's sums.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fn, modules, startedSave } from './setup-fixture.mjs';

const { newRun, validRun, runBegin, runEnd, runRestore, payoutOf, runNodeCount, RUN_FIELDS, runHome, runByExpedition } =
  modules['run-state'];
const { runReleasePays } = modules['run-loop'];
const { newMeta } = modules['meta-state'];
const RATES = {
  money: 0.1,
  itemShare: 0.5,
  released: 15,
  node: 10,
  win: 100,
  winCrests: 1,
  scrapNode: 2,
  scrapWin: 10,
};
const PRICE = id => ({ potion: 200 })[id] || 0;
const GIVE = { seed: 'ABCDE12345', expedition: 1, mapgenV: 1, se: 300, items: { potion: 1 } };
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
  assert.equal(r.expedition, 2);
  assert.equal(r.clock, 1);
  assert.deepEqual(r.at, { phase: 'fly', battle: -1 });
  assert.equal(r.map, null);
  assert.deepEqual([r.perks, r.mods, r.path, r.log, r.released], [[], [], [], [], []]);
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

/* RL-8: a run battle's foe as it began */
const FOE = { kind: 'trainer', fmt: 'double', team: [{ sp: 'sparky0', lvl: 9 }], tid: 'run_3_foe', area: 'grass' };
test('run: the load check refuses broken or tampered runs', () => {
  const s = hubSave();
  const ok = copy({ ...runBegin(s, GIVE), map: MAP, path: [0, 1], forecast: [['sun'], ['rain', 'sun']] });
  assert.equal(validRun(ok), true);
  assert.equal(validRun({ ...ok, map: { nodes: MAP.nodes.map(n => ({ ...n, seen: 2, biome: 'meadow' })) } }), true);
  assert.equal(validRun({ ...ok, at: { phase: 'payout', battle: -1, won: 1 } }), true);
  assert.equal(validRun({ ...ok, at: { phase: 'battle', battle: 3, foe: FOE } }), true);
  assert.equal(validRun({ ...ok, unlocks: ['biome_ridge', 'shop_revive'] }), true, 'RL-11: the run’s copy');
  assert.equal(validRun({ ...ok, unlocks: [] }), true);
  assert.equal(validRun({ ...ok, invited: 'dottie' }), true, 'RS-1: the resident invited');
  const bad = [
    null,
    [],
    { ...ok, seed: '' },
    { ...ok, seed: 'has space' },
    { ...ok, seed: 'x'.repeat(41) },
    { ...ok, expedition: 0 },
    { ...ok, mapgenV: 0 },
    { ...ok, map: { nodes: [] } },
    { ...ok, map: { nodes: [{ ...MAP.nodes[0], to: [9] }] } }, // a link off the map
    { ...ok, map: { nodes: [{ ...MAP.nodes[0], to: [0] }] } }, // to itself
    { ...ok, map: { nodes: [{ ...MAP.nodes[0], type: 'Bad Type' }] } },
    { ...ok, map: { nodes: MAP.nodes.map((n, i) => (i === 2 ? { ...n, biome: 'Not A Biome' } : n)) } },
    { ...ok, at: { phase: 'nap', battle: -1 } },
    { ...ok, at: { phase: 'walk', battle: -2 } },
    { ...ok, at: { phase: 'payout', battle: -1, won: 2 } }, // RL-8: won is 0 or 1
    { ...ok, at: { phase: 'walk', battle: -1, extra: 1 } }, // RL-8: nothing else in at
    { ...ok, at: { phase: 'battle', battle: 0, foe: { ...FOE, kind: 'boss' } } },
    { ...ok, at: { phase: 'battle', battle: 0, foe: { ...FOE, team: [] } } },
    { ...ok, at: { phase: 'battle', battle: 0, foe: { ...FOE, team: [{ sp: 'sparky0', lvl: 0 }] } } },
    { ...ok, at: { phase: 'battle', battle: 0, foe: { ...FOE, tid: 'Not An Id' } } },
    { ...ok, at: { phase: 'battle', battle: 0, foe: { ...FOE, hp: 9 } } },
    { ...ok, unlocks: 'shop_revive' }, // RL-11: a list
    { ...ok, unlocks: ['Not An Id'] },
    { ...ok, unlocks: Array(201).fill('a') },
    { ...ok, clock: 0 },
    { ...ok, forecast: [['sun'], 'rain'] },
    { ...ok, forecast: Array(7).fill([]) }, // more nodes than the map has
    { ...ok, perks: ['ok', 7] },
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
    { ...ok, invited: 'Not An Id' }, // RS-1
    { ...ok, invited: 7 },
  ];
  for (const b of bad) assert.equal(validRun(b), false, JSON.stringify(b).slice(0, 200));
  assert.equal(validRun(JSON.parse(JSON.stringify(ok).replace('"hints":{}', '"hints":{"__proto__":1}'))), false);
});

test('run: the payout converts money, items, releases, nodes and a win into Research, and a win into a Crest', () => {
  const p = payoutOf({ se: 455, items: { potion: 3, nothing: 2 }, released: 2, cleared: 4, won: true }, RATES, PRICE);
  assert.deepEqual(
    p.lines.map(l => [l.what, l.n, l.research]),
    [
      ['money', 455, 45],
      ['items', 0, 0],
      ['released', 2, 30],
      ['nodes', 4, 40],
      ['win', 1, 100],
    ],
    'RL-9b: a win takes the bag home, so its items pay nothing'
  );
  const lostBag = payoutOf(
    { se: 455, items: { potion: 3, nothing: 2 }, released: 2, cleared: 4, won: false },
    RATES,
    PRICE
  );
  assert.deepEqual(lostBag.lines[1], { what: 'items', n: 300, research: 30 }, 'a loss pays the bag at half price');
  assert.equal(p.research, 215);
  assert.equal(p.crests, 1);
  assert.equal(p.scrap, 4 * 2 + 10, 'RL-9: Scrap a node cleared, more for a win');
  const lost = payoutOf({ se: 0, items: {}, released: 0, cleared: 1, won: false }, RATES, PRICE);
  assert.deepEqual([lost.research, lost.crests, lost.scrap], [10, 0, 2]);
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
  assert.equal(pay.research, 50 + 20 + 15 + 30);
  const history = s.meta.history;
  assert.deepEqual(s.meta, { ...newMeta(), research: pay.research, scrap: 3 * 2, runs: 1, history });
  /* RL-S1: the run as the story remembers it (no battle lost: given up) */
  assert.equal(history.length, 1);
  assert.equal(history[0].end, 'quit');
  assert.deepEqual(history[0].team, ['sparky0', 'drip0', 'sprout0']);
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
  assert.deepEqual([t.meta.runs, t.meta.wins, t.meta.crests], [1, 1, 1]);
  /* RL-13: winning Expedition I opens II (the fixture's data may have only one) */
  assert.equal(t.meta.expedition, Math.min(2, modules.modifiers.expeditionCount()));
  assert.equal(s.meta.expedition, 1, 'a loss opens nothing');
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

test('run: RS-1: the resident invited moves in when the run ends, won or lost', () => {
  for (const won of [false, true]) {
    const s = hubSave();
    runBegin(s, GIVE).invited = 'dottie';
    runEnd(s, { won, keep: [s.team[0].uid] }, RATES, PRICE);
    assert.deepEqual(s.meta.residents, { dottie: 1 }, `won: ${won}`);
  }
  const t = hubSave();
  runBegin(t, GIVE);
  runEnd(t, { won: true, keep: [] }, RATES, PRICE);
  assert.deepEqual(t.meta.residents, {}, 'nobody invited, nobody moves in');
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

/* RL-9b: the Billies from home (picked at the mast, from the team or storage) and the packed bag */
test('run: only the Billies from home travel, from the team or storage, the first the buddy', () => {
  const s = hubSave(),
    resting = fn('makeBilly')('sprout0', 9);
  s.box.push(resting);
  s.buddy = s.team[0].uid;
  const hub = copy(s),
    run = runBegin(s, { ...GIVE, home: [resting.uid, resting.uid, 'nobody'] });
  assert.deepEqual(
    s.team.map(m => m.uid),
    [resting.uid],
    'one copy, the unknown uid left out'
  );
  assert.notEqual(s.team[0], resting);
  assert.deepEqual(run.home, [resting.uid]);
  assert.equal(s.buddy, resting.uid, 'the traveller walks with you');
  assert.deepEqual(run.start.team, hub.team, 'the hub team stays home');
  assert.equal(run.start.buddy, hub.buddy);
  assert.deepEqual(s.box, hub.box, 'storage stays in Copperleaf');
  assert.equal(runReleasePays(run, s.team[0]), false, 'one from storage is from home: releasing it pays nothing');
  assert.equal(validRun(copy(run)), true);
  const t = hubSave();
  runBegin(t, GIVE);
  assert.deepEqual(
    runHome(t.run),
    t.team.map(m => m.uid),
    'no pick: the team as it is'
  );
  assert.throws(() => runBegin(hubSave(), { ...GIVE, home: ['nobody'] }), /nobody/);
});

test('run: a kept Billie from storage comes back to storage with its gains, once; one not kept as it left', () => {
  for (const kept of [true, false]) {
    const s = hubSave(),
      resting = fn('makeBilly')('sprout0', 9);
    s.box.push(resting);
    const hub = copy(s);
    runBegin(s, { ...GIVE, home: [resting.uid] });
    s.team[0].lvl = 13;
    s.team.push(fn('makeBilly')('drip0', 4)); // caught on the run
    runEnd(s, { won: false, keep: kept ? [resting.uid] : [s.team[1].uid] }, RATES, PRICE);
    const all = [...s.team, ...s.box].map(m => m.uid);
    assert.equal(new Set(all).size, all.length, 'no Billie twice');
    assert.deepEqual(s.team.slice(0, 2), hub.team, 'the hub team as it was');
    assert.equal(s.box.filter(m => m.uid === resting.uid).length, 1);
    assert.equal(s.box.find(m => m.uid === resting.uid).lvl, kept ? 13 : 9);
    assert.equal(s.buddy, hub.buddy, 'the hub buddy again');
  }
});

test('run: the packed bag leaves the hub, travels on top of the gift and comes home only on a win', () => {
  for (const won of [false, true]) {
    const s = hubSave(); // 4 potions at home
    s.pyramids.pyramid = 2;
    const run = runBegin(s, {
      ...GIVE,
      pyramids: { pyramid: 5 },
      pack: { items: { potion: 3, ghost: 2 }, pyramids: { pyramid: 9 } },
    });
    assert.deepEqual(run.pack, { items: { potion: 3 }, pyramids: { pyramid: 2 } }, 'no more than the bag holds');
    assert.deepEqual([run.start.items.potion, run.start.pyramids.pyramid], [1, 0], 'what stays home');
    assert.deepEqual([s.items.potion, s.pyramids.pyramid], [1 + 3, 5 + 2], 'the gift and the pack');
    assert.equal(validRun(copy(run)), true);
    s.items.potion = 2; // one used on the way
    s.pyramids.pyramid = 3;
    const pay = runEnd(s, { won, keep: [s.team[0].uid] }, RATES, PRICE);
    assert.deepEqual([s.items.potion, s.pyramids.pyramid], won ? [1 + 2, 3] : [1, 0]);
    assert.equal(pay.lines[1].research, won ? 0 : Math.floor(2 * 200 * 0.5 * 0.1), 'a loss pays the bag');
  }
});

test('run: the Expedition rules and the load check of what was picked and packed', () => {
  assert.deepEqual(
    [1, 2, 3, 9].map(t => runByExpedition([1, 2], t)),
    [1, 2, 2, 2]
  );
  const s = hubSave(),
    run = copy(runBegin(s, { ...GIVE, pack: { items: { potion: 1 } } }));
  const { home, pack, ...before } = run;
  assert.equal(validRun(before), true, 'a run saved before RL-9b');
  assert.deepEqual(
    runHome(before),
    run.start.team.map(m => m.uid)
  );
  for (const bad of [
    { ...run, home: 'x' },
    { ...run, home: [1] },
    { ...run, home: Array(7).fill('u') },
    { ...run, pack: { items: { potion: -1 }, pyramids: {} } },
    { ...run, pack: { items: {}, money: {} } },
    { ...run, start: { ...run.start, buddy: 7 } },
  ])
    assert.equal(validRun(bad), false, JSON.stringify(bad.home ?? bad.pack ?? bad.start.buddy));
});
