// Phase 13: the world on the game's own data. RL-5: the game's world is the hub, Copperleaf, alone (the old world is
// parked in game/data/legacy; a run's world is checked in run-world-real.test.mjs). Its place names its map and the
// map names it back, and the snapshot holds the graph (places, roads with their exits, gates, lifts; no costs) and
// the world tables game/js/game-data.js works out from it (the places with what it fills in, the roads with their
// metres, the roads from each place, the places by id, where a new game starts). When a change is meant, remake it with
//   node --test --test-update-snapshots tools/test/world-graph.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PB_DATA } from '../data-files.mjs';
import { data, GAME_DATA } from './setup-real.mjs';

const { locations, maps } = GAME_DATA;
const at = i => locations[i];
// phase 08b: the roads as the Studio and the tools read them (PB_DATA.road): seams and the glass lift
const links = GAME_DATA.roads.map(l => PB_DATA.road(GAME_DATA, l));

test('every location has its own id and its map, and the map names it back', () => {
  const ids = locations.map(l => l.id);
  assert.equal(new Set(ids).size, ids.length, 'two locations share an id');
  for (const l of locations) {
    assert.ok(maps[l.mapId], `${l.id}: no map ${l.mapId}`);
    assert.equal(maps[l.mapId].locationId, l.id, `${l.mapId} names ${maps[l.mapId].locationId}`);
  }
});

test('the graph and its world tables are the ones in the snapshot', t => {
  const L = data.LOCATIONS;
  t.assert.snapshot({
    start: at(data.START_NODE).id,
    places: locations.map(l => `${l.id} (${l.kind})${l.gate ? ' gate ' + l.gate : ''}${l.ride ? ' ride' : ''}`),
    roads: links.map(r => `${r.kind} ${r.id}: ${at(r.a).id}.${r.exitA} - ${at(r.b).id}.${r.exitB}`).sort(),
    tables: {
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
    },
  });
});
