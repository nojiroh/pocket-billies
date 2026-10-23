// v47's room rules in the game data: no step cell of a room is taller than the height most of its wall cells have (the
// back corners once stood twice the wall's height, where the walls overlapped), and no two rooms share a floor.
// (TC-3: were the full check's "Rooms: no wall taller than the room" and "Rooms: a floor of its own each" steps,
// tools/check-quick.py.)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readGameData } from '../data-files.mjs';

const D = readGameData(),
  ROOMS = Object.entries(D.maps).filter(([, sc]) => sc.kind === 'room');

/** a scene's step grid: its heights in twentieths of a metre (little-endian int16, base64) */
const stepHeights = sc => {
  const b = Buffer.from(sc.steps, 'base64');
  return Array.from({ length: b.length >> 1 }, (_, i) => b.readInt16LE(i * 2));
};

/** the cells of a room above its wall: the wall is the height most of its raised cells have */
function cellsAboveWall(sc) {
  const v = stepHeights(sc),
    count = new Map();
  for (const x of v) if (x > 0) count.set(x, (count.get(x) || 0) + 1);
  if (!count.size) return null;
  const wall = [...count].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  return { wall, over: v.filter(x => x > wall).length, top: Math.max(...v) };
}

/** a room's floor: the ground kind most of its cells have (the first one met, on a tie) */
const floorOf = sc => {
  const count = new Map();
  for (const ch of sc.tiles.join('')) count.set(ch, (count.get(ch) || 0) + 1);
  return [...count].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
};

test('no wall cell of a room stands taller than the room’s wall', () => {
  const bad = [];
  let n = 0;
  for (const [id, sc] of ROOMS) {
    if (!sc.steps) continue;
    const r = cellsAboveWall(sc);
    if (!r) continue;
    n++;
    if (r.over) bad.push(`${id}: ${r.over} cells above the wall (${r.top / 20} m, the wall is ${r.wall / 20} m)`);
  }
  assert.ok(n > 0, 'no room has a step grid');
  assert.deepEqual(bad, []);
});

test('a planted corner above the wall is found', () => {
  const [, sc] = ROOMS.find(([, s]) => s.steps && cellsAboveWall(s));
  const b = Buffer.from(sc.steps, 'base64'),
    { wall } = cellsAboveWall(sc);
  b.writeInt16LE(wall * 2, 0);
  assert.equal(cellsAboveWall({ steps: b.toString('base64') }).over, 1);
});

test('no two rooms share a floor', () => {
  const floors = new Map();
  for (const [id, sc] of ROOMS) {
    if (id.includes('@')) continue;
    const f = floorOf(sc);
    floors.set(f, [...(floors.get(f) || []), id]);
  }
  const shared = [...floors].filter(([, ids]) => ids.length > 1).map(([f, ids]) => `${f}: ${ids.join(', ')}`);
  assert.deepEqual(shared, []);
});
