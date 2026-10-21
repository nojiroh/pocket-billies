// RL-5: the world tables game/js/game-data.js works out from the places and the roads, on the game's own data: the
// places with what it fills in (pool, battle stage, trainers, board), the roads with their metres, the roads from each
// place, the places by id and where a new game starts. A change is meant only when the places or the roads change;
// remake the snapshot then with
//   node --test --test-update-snapshots tools/test/world-tables-real.test.mjs
import { test } from 'node:test';
import { data } from './setup-real.mjs';

test('the world tables are the ones in the snapshot', t => {
  const L = data.LOCATIONS;
  t.assert.snapshot({
    start: data.START_NODE,
    places: L.map(
      (l, i) =>
        `${i} ${l.id} pool ${l.pool} stage ${l.battleStage}` +
        (l.trainers.length ? ` trainers ${l.trainers.join(',')}` : '') +
        (l.board ? ` board ${l.board}` : '')
    ),
    roads: data.ROADS.map(
      ([a, b, m, j]) => `${a}-${b} ${m} m` + (j ? ` ${j.id} ${j.a}/${j.b} ${j.from}-${j.to} ${j.name || ''}` : '')
    ),
    byNode: data.ROADS_BY_NODE.map((list, i) => `${i}: ${list.map(e => `${e.to}/${e.cost}/${e.i}`).join(' ')}`),
    /* the copies by id are made before the boards are filled in, and share the place's trainer list */
    byId: Object.entries(data.LOCATION_BY_ID).map(
      ([k, v]) =>
        `${k} ${v.node}${'board' in v ? ' board' : ''}${v.trainers === (L[v.node] || {}).trainers ? ' its trainers' : ''}`
    ),
  });
});
