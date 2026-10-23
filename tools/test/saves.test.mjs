// Phase 13 (moved from logic.test.mjs, phase 04e): saves (game/js/logic/saves.js), on the small data set of
// setup-fixture.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { data, fn, logic, modules, startedSave } from './setup-fixture.mjs';

test('saves: a new save, load checks, migrate, backup check', () => {
  const s = fn('newSave')();
  assert.equal(s.saveVersion, logic.SAVE_VERSION);
  assert.equal(s.gameVersion, globalThis.PB_VERSION);
  assert.equal(s.coins.penny, 5);
  assert.equal(s.items.potion, 2);
  assert.equal(fn('saveAge')(s), 'ok');
  assert.equal(fn('saveAge')({}), 'old');
  assert.equal(fn('saveAge')({ saveVersion: logic.SAVE_VERSION + 1 }), 'new');
  assert.equal(fn('saveAge')(null), null);
  assert.equal(fn('loadSave')({ team: [] }), null);
  const started = startedSave('sparky0', 10);
  started.box.push({ ...fn('makeBilly')('sprout0', 3), sp: 'gone0' }); // a species the Studio removed
  started.team[0].moves = ['tackle', 'nosuchmove'];
  const m = fn('migrate')(JSON.parse(JSON.stringify(started)));
  assert.equal(m.box.length, 0);
  assert.deepEqual(m.team[0].moves, ['tackle']);
  assert.equal(m.saveVersion, logic.SAVE_VERSION);
  const valid = fn('validSave');
  assert.equal(valid(m), true);
  assert.equal(valid(s), false); // not started
  assert.equal(valid({ ...m, team: [{ ...m.team[0], lvl: 101 }] }), false);
  assert.equal(valid(JSON.parse(JSON.stringify(m).replace('"flags":{}', '"flags":{"__proto__":1}'))), false);
});

test('saves: a started save comes back from its JSON (loading again changes nothing); a broken one is refused', () => {
  const s = startedSave('sparky0', 10);
  s.team.push(fn('makeBilly')('drip0', 7));
  const once = fn('loadSave')(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(once.team, s.team);
  assert.deepEqual(fn('loadSave')(JSON.parse(JSON.stringify(once))), once);
  const text = JSON.stringify(once);
  const valid = fn('validSave');
  assert.equal(valid(JSON.parse(text)), true);
  const broken = f => {
    const o = JSON.parse(text);
    f(o);
    return valid(o);
  };
  assert.equal(
    broken(o => (o.team[1].uid = o.team[0].uid)),
    false,
    'two Billies with one id'
  );
  assert.equal(
    broken(o => (o.team[0].moves = ['nosuchmove'])),
    false,
    'a move the game does not have'
  );
  assert.equal(
    broken(o => (o.trip.node = 99)),
    false,
    'a place the game does not have'
  );
  assert.equal(
    broken(o => (o.se = -1)),
    false,
    'money below zero'
  );
});

// RL-3 (save format 4): meta, run and ranch in the save; a run's trip is on the run's world, not today's LOCATIONS
const { runBegin } = modules['run-state'];
const GIVE = { seed: 'ABCDE12345', tier: 1, mapgenV: 1, se: 300 };
const RUN_MAP = {
  nodes: [
    { type: 'landing', row: 0, lane: 0, to: [1, 2] },
    { type: 'route', row: 1, lane: 0, to: [3] },
    { type: 'route', row: 1, lane: 1, to: [3] },
    { type: 'town', row: 2, lane: 0, to: [4] },
    { type: 'miniboss', row: 3, lane: 0, to: [] },
  ],
};
/** a save in the middle of a run: at the map's town (node 4: more than the fixture's three locations), heading on */
function runSave() {
  const s = startedSave('sparky0', 10);
  s.trip = { node: 2, plan: [] };
  runBegin(s, GIVE);
  s.run.map = RUN_MAP;
  s.run.path = [0, 1, 3];
  s.run.clock = 4;
  s.trip = { node: 4, plan: [5] };
  s.visited = { 0: 1, 1: 1, 2: 1, 4: 1 };
  s.wild = { run_1: { at: 0, list: [] } };
  return s;
}

test('saves: format 4 holds meta, the run (null in the hub) and the ranch; a format 3 save is old', () => {
  const s = fn('newSave')();
  assert.equal(logic.SAVE_VERSION, 4);
  assert.deepEqual(s.meta, modules['meta-state'].newMeta());
  assert.equal(s.run, null);
  assert.deepEqual(s.ranch, modules['ranch-state'].newRanch());
  assert.equal('v' in s, false, 'the old v field is gone');
  assert.equal(fn('saveAge')({ ...startedSave(), saveVersion: 3 }), 'old');
  assert.equal(fn('loadSave')({ ...startedSave(), saveVersion: 3 }), null);
});

test('saves: a save from a run loads with its trip, plan, visited places and run as they were', () => {
  const s = runSave();
  assert.equal(fn('validSave')(JSON.parse(JSON.stringify(s))), true);
  const back = fn('loadSave')(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.trip, { node: 4, plan: [5] }, 'not reset to the start, though LOCATIONS has 3 entries');
  assert.deepEqual(back.visited, s.visited);
  assert.deepEqual(back.run, JSON.parse(JSON.stringify(s.run)));
  assert.deepEqual(back.wild, s.wild);
  assert.deepEqual(fn('loadSave')(JSON.parse(JSON.stringify(back))), back, 'loading again changes nothing');
  // off the run's world: back to Copperleaf (node 0), not to the hub's start
  const off = fn('migrate')({ ...JSON.parse(JSON.stringify(s)), trip: { node: 6, plan: [9, 2, 'x'] } });
  assert.deepEqual(off.trip, { node: 0, plan: [] });
  const plan = fn('migrate')({ ...JSON.parse(JSON.stringify(s)), trip: { node: 3, plan: [9, 4, 'x'] } });
  assert.deepEqual(plan.trip, { node: 3, plan: [4] });
  // the hub's team as the run started is cleaned like the team (a species the Studio removed)
  const gone = JSON.parse(JSON.stringify(s));
  gone.run.start.team.push({ ...fn('makeBilly')('sprout0', 3), sp: 'gone0' });
  assert.equal(fn('migrate')(gone).run.start.team.length, 1);
});

test("saves: a hub save is checked against the hub's places while a run's world is in (RL-7)", () => {
  /* the run's world as RL-7 puts it in: Copperleaf (here the fixture's first place) and five run nodes */
  const hub = data.LOCATIONS.slice(),
    run = i => ({
      id: 'run_' + i,
      name: 'Node ' + i,
      kind: 'route',
      route: 'Route',
      pool: 'meadow',
      mapId: 'run_' + i,
    });
  data.worldSetGraph([hub[0], run(0), run(1), run(2), run(3), run(4)], []);
  try {
    assert.equal(data.LOCATIONS.length, 6);
    const s = startedSave('sparky0', 10);
    s.trip = { node: 4, plan: [5] };
    s.visited = { 0: 1, 4: 1 };
    assert.equal(fn('validSave')(JSON.parse(JSON.stringify(s))), false, "node 4 is not one of the hub's three");
    const m = fn('migrate')(JSON.parse(JSON.stringify(s)));
    assert.deepEqual(m.trip, { node: data.START_NODE, plan: [] });
    /* a run's save is still bounded by its own map */
    assert.deepEqual(fn('migrate')(JSON.parse(JSON.stringify(runSave()))).trip, { node: 4, plan: [5] });
  } finally {
    data.worldSetGraph(hub, data.gameData.roads);
  }
  assert.deepEqual(
    data.LOCATIONS.map(l => l.id),
    hub.map(l => l.id)
  );
});

test('saves: a run that fails its check is left, with the hub as it was when the run started', () => {
  const s = runSave(),
    hubTrip = s.run.start.trip;
  const broken = { ...JSON.parse(JSON.stringify(s)), run: { ...JSON.parse(JSON.stringify(s.run)), seed: 'bad seed' } };
  const m = fn('migrate')(broken);
  assert.equal(m.run, null);
  assert.deepEqual(m.trip, hubTrip);
  assert.equal(m.se, 600);
  assert.equal(fn('validSave')(m), true);
});

test('saves: the load check refuses a format 4 save with a broken meta, run, ranch or trip', () => {
  const s = JSON.parse(JSON.stringify(runSave())),
    valid = fn('validSave');
  assert.equal(valid(s), true);
  const badBilly = { ...s.run.start.team[0], lvl: 0 };
  for (const [what, bad] of [
    ['no run key', { ...s, run: undefined }],
    ['a broken run', { ...s, run: { ...s.run, clock: 0 } }],
    ['no meta', { ...s, meta: undefined }],
    ['a broken meta', { ...s, meta: { ...s.meta, capital: -1 } }],
    ['no ranch', { ...s, ranch: null }],
    ['the trip off the run world', { ...s, trip: { node: 6, plan: [] } }],
    ['a broken Billie in the hub team', { ...s, run: { ...s.run, start: { ...s.run.start, team: [badBilly] } } }],
    ['the hub trip off LOCATIONS', { ...s, run: { ...s.run, start: { ...s.run.start, trip: { node: 3, plan: [] } } } }],
  ])
    assert.equal(valid(bad), false, what);
  // in the hub the trip is bounded by LOCATIONS as before
  const hub = JSON.parse(JSON.stringify(startedSave('sparky0', 10)));
  assert.equal(valid(hub), true);
  assert.equal(valid({ ...hub, trip: { node: 3, plan: [] } }), false);
});
