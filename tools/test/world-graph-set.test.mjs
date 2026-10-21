// RL-5: worldSetGraph puts another world's places and roads in (a run's, RL-7) and the first one back after: every
// world table the game reads is filled again in place (the same arrays and object, so every module's import sees the
// new rows), and putting the hub back leaves them exactly as they were. On the test data set (setup-fixture.mjs:
// Home Town, the Meadow and the Lake on two roads, Rival Ray on the Meadow).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { data, FIXTURE } from './setup-fixture.mjs';

const TABLES = ['LOCATIONS', 'ROADS', 'ROADS_BY_NODE', 'LOCATION_BY_ID'];
const tables = () => structuredClone({ ...Object.fromEntries(TABLES.map(k => [k, data[k]])), start: data.START_NODE });

/* a small run: a landing, a fork and an end, their maps with the exits the roads leave by (len: the walk from the
   middle out to the edge), and the glass lift from Home Town, which the walking tables leave out */
const RUN_MAPS = {
  run_a: { w: 20, h: 20, edgeExits: [{ id: 'north', side: 'N', len: 30 }] },
  run_b: {
    w: 20,
    h: 20,
    edgeExits: [
      { id: 'south', side: 'S', len: 25 },
      { id: 'east', side: 'E', len: 12 },
    ],
  },
  run_c: { w: 20, h: 20, edgeExits: [{ id: 'west', side: 'W', len: 8 }] },
};
const run = (id, name) => ({ id, name, kind: 'route', route: 'Route', pool: 'meadow', mapId: id });
const RUN_PLACES = [FIXTURE.locations[0], run('run_a', 'Landing'), run('run_b', 'Fork'), run('run_c', 'End')];
const RUN_ROADS = [
  {
    id: 'road:run_a-run_b',
    name: 'Run 1',
    kind: 'seam',
    a: { map: 'run_a', exit: 'north' },
    b: { map: 'run_b', exit: 'south' },
  },
  {
    id: 'road:run_b-run_c',
    name: 'Run 2',
    kind: 'seam',
    a: { map: 'run_b', exit: 'east' },
    b: { map: 'run_c', exit: 'west' },
  },
  { id: 'lift:home-run_c', kind: 'lift', a: { map: 'home' }, b: { map: 'run_c' } },
];

test('another world goes in and the hub comes back exactly, in the same tables', () => {
  const hub = tables(),
    same = TABLES.map(k => data[k]),
    maps0 = data.gameData.maps;
  data.gameData.maps = { ...(maps0 || {}), ...RUN_MAPS };
  try {
    data.worldSetGraph(RUN_PLACES, RUN_ROADS);
    assert.deepEqual(
      data.LOCATIONS.map(l => l.id),
      ['home', 'run_a', 'run_b', 'run_c']
    );
    /* the seams with their metres from the two exits; the lift is not a walking road */
    assert.deepEqual(
      data.ROADS.map(([a, b, m, j]) => [a, b, m, j.id, j.from, j.to]),
      [
        [1, 2, 55, 'road:run_a-run_b', 'run_a', 'run_b'],
        [2, 3, 20, 'road:run_b-run_c', 'run_b', 'run_c'],
      ]
    );
    assert.deepEqual(
      data.ROADS_BY_NODE.map(list => list.map(e => [e.to, e.cost])),
      [
        [],
        [[2, 55]],
        [
          [1, 55],
          [3, 20],
        ],
        [[2, 20]],
      ]
    );
    assert.equal(data.roadCost(2, 3), 20);
    assert.equal(data.LOCATION_BY_ID.run_b.node, 2);
    assert.equal(data.LOCATION_BY_ID.meadow, undefined, 'the places of the world before are gone');
    assert.equal(data.isTown(0), true);
    /* trainers stand by their node number, in whatever world is in: Rival Ray (node 1) is now on the landing. A run
       puts its own trainers in TRAINERS before its world (RL-7); after RL-5 no hub trainer stands on a node */
    assert.deepEqual(
      data.LOCATIONS.map(l => l.trainers),
      [[], ['ray'], [], []]
    );
    assert.deepEqual(
      data.trainersAt(1).map(T => T.id),
      ['ray']
    );

    data.worldSetGraph(FIXTURE.locations, FIXTURE.roads);
    assert.deepEqual(tables(), hub, 'the hub is back as it was');
    assert.deepEqual(
      TABLES.map((k, i) => data[k] === same[i]),
      [true, true, true, true],
      'the same tables, filled in place'
    );
  } finally {
    data.gameData.maps = maps0;
    data.worldSetGraph(FIXTURE.locations, FIXTURE.roads);
  }
});

test('putting the same world in again changes nothing', () => {
  const before = tables();
  data.worldSetGraph(data.LOCATIONS, FIXTURE.roads);
  assert.deepEqual(tables(), before, 'the list given may be LOCATIONS itself');
});
