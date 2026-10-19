// Phase 13: the world-map graph on the game's own data: locations, the roads between them, the map edges each road
// joins, gates and lifts. Phases 08 and 10 rework travel and the world map; whatever they change, the places, their
// connections and their gates stay (the snapshot leaves out costs, which may change). The snapshot is in
// world-graph.test.mjs.snapshot; when a change to the graph is meant, remake it with
//   node --test --test-update-snapshots tools/test/world-graph.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PB_DATA } from '../data-files.mjs';
import { data, GAME_DATA } from './setup-real.mjs';

const { locations, maps, trainers } = GAME_DATA;
// phase 08b: the roads as the Studio and the tools read them (PB_DATA.road), whatever shape roads.json has
const roads = GAME_DATA.roads.map(l => PB_DATA.road(GAME_DATA, l));
const at = i => locations[i];
const mapOf = loc => maps[loc.mapId];
const lifts = locations.filter(l => l.lift).map(l => [l.id, l.lift]);

test('every location has its own id and its map, and the map names it back', () => {
  const ids = locations.map(l => l.id);
  assert.equal(new Set(ids).size, ids.length, 'two locations share an id');
  for (const l of locations) {
    assert.ok(mapOf(l), `${l.id}: no map ${l.mapId}`);
    assert.equal(mapOf(l).locationId, l.id, `${l.mapId} names ${mapOf(l).locationId}`);
  }
});

test('every road joins two different places once, and names them as its numbers do', () => {
  const seenIds = new Set(),
    pairs = new Set();
  roads.forEach(({ a, b, ...r }) => {
    assert.ok(at(a) && at(b), `${r.id}: a place it joins does not exist`);
    assert.notEqual(a, b, `${r.id} goes nowhere`);
    assert.ok(!seenIds.has(r.id), `two roads are ${r.id}`);
    seenIds.add(r.id);
    const pair = [a, b].sort((x, y) => x - y).join('-');
    assert.ok(!pairs.has(pair), `${at(a).id} and ${at(b).id} are joined twice`);
    pairs.add(pair);
    // phase 08b: a road names its places by their maps, and its id by their ids
    assert.equal(r.id, `road:${at(a).id}-${at(b).id}`, `${r.id} joins ${at(a).id} and ${at(b).id}`);
  });
});

test('each road leaves by an exit on the edge of each map, and each map exit has exactly one road', () => {
  const used = new Map();
  for (const r of roads)
    for (const [loc, exit] of [
      [at(r.a), r.exitA],
      [at(r.b), r.exitB],
    ]) {
      const m = mapOf(loc),
        e = (m.edgeExits || []).find(x => x.id === exit);
      assert.ok(e, `${r.id}: ${loc.mapId} has no exit ${exit}`);
      const key = `${loc.mapId}:${exit}`;
      assert.ok(!used.has(key), `${key} is used by ${used.get(key)} and ${r.id}`);
      used.set(key, r.id);
    }
  for (const l of locations) {
    const m = mapOf(l);
    for (const e of m.edgeExits || [])
      assert.ok(used.has(`${l.mapId}:${e.id}`), `${l.mapId}: exit ${e.id} has no road`);
    assert.equal((m.exits || []).length, (m.edgeExits || []).length, `${l.mapId}: stored exits and edge exits differ`);
  }
});

test('every exit lies on its side of the map, where its path ends', () => {
  for (const l of locations) {
    const m = mapOf(l);
    for (const e of m.edgeExits || []) {
      const [x, z] = e.path.at(-1),
        want = { W: [x, e.in], E: [x, m.w - e.in], S: [z, e.in], N: [z, m.h - e.in] }[e.side];
      assert.ok(want, `${l.mapId}: exit ${e.id} has no side`);
      assert.ok(Math.abs(want[0] - want[1]) < 0.05, `${l.mapId}: exit ${e.id} (${e.side}) ends at ${x}, ${z}`);
    }
  }
});

test('every gate has the trainer whose badge opens it; lifts go both ways', () => {
  const seats = new Set(
    Object.values(trainers)
      .map(t => t.seat && t.seat.id)
      .filter(Boolean)
  );
  for (const l of locations.filter(l => l.gate))
    assert.ok(seats.has(l.gate), `${l.id}: nobody holds the ${l.gate} gate`);
  for (const [from, to] of lifts)
    assert.ok(
      lifts.some(([a, b]) => a === to && b === from),
      `the lift from ${from} to ${to} has no way back`
    );
});

test('every place can be reached from the start, by road or by lift', () => {
  const next = locations.map(() => []);
  for (const { a, b } of roads) (next[a].push(b), next[b].push(a));
  for (const [from, to] of lifts)
    next[locations.findIndex(l => l.id === from)].push(locations.findIndex(l => l.id === to));
  const seen = new Set([data.START_NODE]),
    todo = [data.START_NODE];
  while (todo.length) for (const n of next[todo.pop()]) if (!seen.has(n)) (seen.add(n), todo.push(n));
  assert.deepEqual(
    locations.filter((l, i) => !seen.has(i)).map(l => l.id),
    []
  );
});

test('the graph is the one in the snapshot (places, roads with their exits, gates, lifts; no costs)', t => {
  t.assert.snapshot({
    start: at(data.START_NODE).id,
    places: locations.map(l => `${l.id} (${l.kind})${l.gate ? ' gate ' + l.gate : ''}${l.ride ? ' ride' : ''}`),
    roads: roads.map(r => `${r.id}: ${at(r.a).id}.${r.exitA} - ${at(r.b).id}.${r.exitB}`).sort(),
    lifts: lifts.map(([a, b]) => `${a} -> ${b}`).sort(),
  });
});

test('phase 08: every road is measured in metres, from each place’s middle to the exit it leaves by', () => {
  for (const [a, b, len, ends] of data.ROADS) {
    const exit = (i, id) => (mapOf(at(i)).edgeExits || []).find(e => e.id === id);
    const ea = exit(a, ends.a),
      eb = exit(b, ends.b);
    assert.ok(ea && eb, `${ends.id}: an exit it names is missing`);
    assert.equal(len, Math.round(ea.len + eb.len), ends.id);
    assert.ok(len >= 20 && len <= 400, `${ends.id} is ${len} m`);
  }
});
