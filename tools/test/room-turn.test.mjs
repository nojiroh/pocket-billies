// Island track IS-5: rooms that face four ways (game/js/logic/room-turn.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  roomDoorPush,
  roomToLocal,
  roomToWorld,
  roomTurnOf,
  roomVecToWorld,
  roomWorldRect,
  roomYaw,
  turnCellArray,
  turnHeightRows,
  turnTileRows,
  turnedCells,
} from '../../game/js/logic/room-turn.js';

test('room turn: a building turn picks its nearest quarter; out of the door is the turned south', () => {
  assert.deepEqual([0, 30, 44, 46, 90, 178, 268.3, -91.7, 359.9, -10].map(roomTurnOf), [0, 0, 0, 1, 1, 2, 3, 3, 0, 0]);
  /* the door's way out, (sin r, -cos r) for a building turned r (walk-view.js doorOf), is the room's -z turned */
  for (let q = 0; q < 4; q++) {
    const r = (q * Math.PI) / 2,
      o = roomVecToWorld({ q, p: [0, 0], rect: [0, 0, 1, 1] }, 0, -1);
    assert.ok(Math.abs(o[0] - Math.sin(r)) < 1e-12 && Math.abs(o[1] + Math.cos(r)) < 1e-12, `q ${q}`);
    /* the camera looks in: its forward [sin yaw, cos yaw] is the room's +z */
    const y = roomYaw({ q, p: [0, 0], rect: [0, 0, 1, 1] }),
      f = roomVecToWorld({ q, p: [0, 0], rect: [0, 0, 1, 1] }, 0, 1);
    assert.ok(Math.abs(Math.sin(y) - f[0]) < 1e-12 && Math.abs(Math.cos(y) - f[1]) < 1e-12, `yaw q ${q}`);
  }
});

test('room turn: points go out and back; q 0 is the room untouched', () => {
  for (let q = 0; q < 4; q++) {
    const F = { q, p: [40, 31], rect: [36, 30, 10, 7] };
    for (const [x, z] of [
      [36, 30],
      [41.25, 33.5],
      [46, 37],
    ]) {
      const w = roomToWorld(F, x, z),
        l = roomToLocal(F, w[0], w[1]);
      assert.ok(Math.abs(l[0] - x) < 1e-9 && Math.abs(l[1] - z) < 1e-9);
    }
  }
  assert.deepEqual(roomToWorld({ q: 0, p: [40, 31], rect: [0, 0, 1, 1] }, 1.234, 5.678), [1.234, 5.678]);
  /* east-facing (q 1): the room's back wall (+z) lies west of the door */
  const F = { q: 1, p: [40, 31], rect: [36, 30, 10, 7] },
    back = roomToWorld(F, 41, 37),
    door = roomToWorld(F, 41, 30.6);
  assert.ok(back[0] < door[0]);
  assert.deepEqual(roomWorldRect(F), [34, 27, 7, 10]);
  /* the world rect holds the turned room's every corner, on whole metres */
  for (let q = 0; q < 4; q++) {
    const G = { q, p: [40, 31], rect: [36, 30, 10, 7] },
      R = roomWorldRect(G);
    for (const [x, z] of [
      [36, 30],
      [46, 30],
      [36, 37],
      [46, 37],
    ]) {
      const w = roomToWorld(G, x, z);
      assert.ok(w[0] >= R[0] - 1e-9 && w[0] <= R[0] + R[2] + 1e-9 && w[1] >= R[1] - 1e-9 && w[1] <= R[1] + R[3] + 1e-9);
    }
    assert.ok(R.every(Number.isInteger));
  }
});

test('room turn: a grid turned lands each cell where its middle goes, for cells, tiles and corners', () => {
  const w = 3,
    h = 2;
  for (let q = 0; q < 4; q++) {
    const F = { q, p: [10, 20], rect: [7, 19, w, h] },
      R = roomWorldRect(F),
      T = turnedCells(q, w, h);
    assert.deepEqual([T.w, T.h], [R[2], R[3]]);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const m = roomToWorld(F, 7 + i + 0.5, 19 + j + 0.5),
          [ii, jj] = T.at(i, j);
        assert.deepEqual([ii, jj], [Math.floor(m[0] - R[0]), Math.floor(m[1] - R[1])], `q ${q} cell ${i},${j}`);
      }
    /* cells of a step grid */
    const a = [0, 1, 2, 3, 4, 5],
      b = turnCellArray(a, w, h, q);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const [ii, jj] = T.at(i, j);
        assert.equal(b[jj * T.w + ii], a[j * w + i]);
      }
    /* tile rows, the far row first */
    const rows = ['def', 'abc'],
      tr = turnTileRows(rows, w, h, q);
    assert.equal(tr.length, T.h);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const [ii, jj] = T.at(i, j);
        assert.equal(tr[T.h - 1 - jj][ii], rows[h - 1 - j][i]);
      }
    /* height corners: a corner at the room's own (x, z) keeps its height where the corner lands */
    const hr = [
        [6, 7, 8, 9],
        [3, 4, 5, 6.5],
        [0, 1, 2, 3],
      ],
      th = turnHeightRows(hr, w, h, q);
    for (let j = 0; j <= h; j++)
      for (let i = 0; i <= w; i++) {
        const m = roomToWorld(F, 7 + i, 19 + j),
          x = Math.round(m[0] - R[0]),
          z = Math.round(m[1] - R[1]);
        assert.equal(th[R[3] - z][x], hr[h - j][i], `q ${q} corner ${i},${j}`);
      }
  }
  assert.equal(turnTileRows(['ab'], 2, 1, 0)[0], 'ab');
});

test('room door push (towns TW-0): pushing out at the doorway leaves, anywhere else or any other way does not', () => {
  /* a room facing south: its exit at (10, 5.6), a 1.2 m doorway */
  const sc = { exits: [[10, 5.6]], roomGap: 1.2 };
  assert.equal(roomDoorPush(sc, 10, 5.5, 0, -1), true, 'at the exit pushing south');
  assert.equal(roomDoorPush(sc, 10.4, 5.8, 0.2, -1), true, 'a little off, pushing mostly south');
  assert.equal(roomDoorPush(sc, 10, 5.5, 0, 1), false, 'pushing in');
  assert.equal(roomDoorPush(sc, 10, 5.5, 1, 0), false, 'pushing along the wall');
  assert.equal(roomDoorPush(sc, 11.5, 5.5, 0, -1), false, 'beside the doorway');
  assert.equal(roomDoorPush(sc, 10, 8, 0, -1), false, 'deeper in the room');
  assert.equal(roomDoorPush(sc, 10, 5.5, 0, 0), false, 'no push');
  assert.equal(roomDoorPush({}, 10, 5.5, 0, -1), false, 'no exit');
  /* each turned room: the room's own point near its exit and its own "out" (-z), turned into the place */
  for (let q = 1; q < 4; q++) {
    const F = { q, p: [20, 20], rect: [14, 19, 12, 8] },
      E = roomToWorld(F, 20, 19.6),
      at = roomToWorld(F, 20.2, 19.5),
      out = roomVecToWorld(F, 0, -1),
      T = { exits: [E], roomGap: 1.2, roomFrame: F };
    assert.equal(roomDoorPush(T, at[0], at[1], out[0], out[1]), true, `q ${q} out`);
    assert.equal(roomDoorPush(T, at[0], at[1], -out[0], -out[1]), false, `q ${q} in`);
  }
});
