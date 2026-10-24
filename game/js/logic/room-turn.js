// @ts-check
'use strict';
/* ================= ROOMS THAT FACE FOUR WAYS (island track IS-5) =================
   A room laid into its place (seamless-world.js seamlessRoomMap) is made in its own metres as it always was: its door
   on its near (south) side, its back wall far off along +z, the camera looking in from the door. A building may face
   any way on the island, so the finished room is turned by quarter turns about a point near the door (`p`, on whole
   metres, so the room's metre and half-metre cells land on the place's) before it goes in. A quarter turn `q` turns
   x toward z (prop-turn.js's way): a room behind a door facing east (out +x) is q 1, north q 2, west q 3. q 0 is the
   room as before, untouched. The frame `{ q, p, rect }` (rect: the room in its own metres, [x0, z0, w, d]) is kept in
   the room's view (`roomFrame`) for what draws the room (rooms.js, the ground shader, the camera). Logic only: no DOM,
   runs in Node (tools/test/room-turn.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  COS: [() => COS],
  SIN: [() => SIN],
  // @ts-expect-error -- replaced on purpose
  roomDoorPush: [() => roomDoorPush, v => (roomDoorPush = v)],
  // @ts-expect-error -- replaced on purpose
  roomToLocal: [() => roomToLocal, v => (roomToLocal = v)],
  // @ts-expect-error -- replaced on purpose
  roomToWorld: [() => roomToWorld, v => (roomToWorld = v)],
  // @ts-expect-error -- replaced on purpose
  roomTurnOf: [() => roomTurnOf, v => (roomTurnOf = v)],
  // @ts-expect-error -- replaced on purpose
  roomVecToWorld: [() => roomVecToWorld, v => (roomVecToWorld = v)],
  // @ts-expect-error -- replaced on purpose
  roomWorldRect: [() => roomWorldRect, v => (roomWorldRect = v)],
  // @ts-expect-error -- replaced on purpose
  roomYaw: [() => roomYaw, v => (roomYaw = v)],
  // @ts-expect-error -- replaced on purpose
  turnCellArray: [() => turnCellArray, v => (turnCellArray = v)],
  // @ts-expect-error -- replaced on purpose
  turnHeightRows: [() => turnHeightRows, v => (turnHeightRows = v)],
  // @ts-expect-error -- replaced on purpose
  turnTileRows: [() => turnTileRows, v => (turnTileRows = v)],
  // @ts-expect-error -- replaced on purpose
  turnedCells: [() => turnedCells, v => (turnedCells = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @typedef {{ q: number, p: number[], rect: number[] }} RoomFrame */

export const SIN = [0, 1, 0, -1],
  COS = [1, 0, -1, 0];

/** the quarter a building's turn (degrees) is nearest: 0 south, 1 east, 2 north, 3 west @param {number | undefined} rot */
export function roomTurnOf(rot) {
  const q = Math.round((+(rot || 0) || 0) / 90) % 4;
  return (q + 4) % 4;
}

/** a point in the room's own metres, in the place's @param {RoomFrame | null | undefined} F @param {number} x @param {number} z @returns {[number, number]} */
export function roomToWorld(F, x, z) {
  if (!F || !F.q) return [x, z];
  const c = COS[F.q],
    s = SIN[F.q],
    dx = x - F.p[0],
    dz = z - F.p[1];
  return [F.p[0] + dx * c - dz * s, F.p[1] + dx * s + dz * c];
}

/** a point in the place's metres, in the room's own @param {RoomFrame | null | undefined} F @param {number} x @param {number} z @returns {[number, number]} */
export function roomToLocal(F, x, z) {
  if (!F || !F.q) return [x, z];
  const c = COS[F.q],
    s = SIN[F.q],
    dx = x - F.p[0],
    dz = z - F.p[1];
  return [F.p[0] + dx * c + dz * s, F.p[1] - dx * s + dz * c];
}

/** a direction in the room's own metres, in the place's @param {RoomFrame | null | undefined} F @param {number} x @param {number} z @returns {[number, number]} */
export function roomVecToWorld(F, x, z) {
  if (!F || !F.q) return [x, z];
  const c = COS[F.q],
    s = SIN[F.q];
  return [x * c - z * s, x * s + z * c];
}

/** the camera's yaw that looks into the room through its door (yaw 0 looks along +z) @param {RoomFrame | null | undefined} F */
export function roomYaw(F) {
  return F && F.q ? (-F.q * Math.PI) / 2 : 0;
}

/** the room's rect ([x0, z0, w, d], its own metres) as it lies in the place: [x0, z0, w, d] @param {RoomFrame} F @returns {number[]} */
export function roomWorldRect(F) {
  const [x0, z0, w, d] = F.rect;
  if (!F.q) return [x0, z0, w, d];
  const a = roomToWorld(F, x0, z0),
    b = roomToWorld(F, x0 + w, z0 + d);
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), F.q % 2 ? d : w, F.q % 2 ? w : d];
}

/** where a cell (i, j) of a w x h grid (j counting +z) goes when the grid turns by q quarters, and the turned size
 * @param {number} q @param {number} w @param {number} h @returns {{ w: number, h: number, at: (i: number, j: number) => number[] }} */
export function turnedCells(q, w, h) {
  if (q === 1) return { w: h, h: w, at: (i, j) => [h - 1 - j, i] };
  if (q === 2) return { w, h, at: (i, j) => [w - 1 - i, h - 1 - j] };
  if (q === 3) return { w: h, h: w, at: (i, j) => [j, w - 1 - i] };
  return { w, h, at: (i, j) => [i, j] };
}

/** a grid's values (row-major, j counting +z: a step grid) turned by q quarters
 * @template {Float32Array | Uint8Array | Int16Array | number[]} T
 * @param {T} a @param {number} w @param {number} h @param {number} q @returns {T} */
export function turnCellArray(a, w, h, q) {
  if (!q) return a;
  const T = turnedCells(q, w, h),
    out = /** @type {T} */ (Array.isArray(a) ? new Array(a.length) : new /** @type {any} */ (a.constructor)(a.length));
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const [ii, jj] = T.at(i, j);
      out[jj * T.w + ii] = a[j * w + i];
    }
  return out;
}

/** a map's tile rows (strings, the far (north) row first) turned by q quarters @param {string[]} rows @param {number} w @param {number} h @param {number} q @returns {string[]} */
export function turnTileRows(rows, w, h, q) {
  if (!q) return rows;
  const T = turnedCells(q, w, h),
    g = [];
  for (let j = 0; j < T.h; j++) g.push(new Array(T.w).fill(' '));
  for (let j = 0; j < h; j++) {
    const r = rows[h - 1 - j] || '';
    for (let i = 0; i < w; i++) {
      const [ii, jj] = T.at(i, j);
      g[jj][ii] = r[i] ?? ' ';
    }
  }
  const out = [];
  for (let j = T.h - 1; j >= 0; j--) out.push(g[j].join(''));
  return out;
}

/** a map's height rows (corners: h + 1 rows of w + 1, the far row first) turned by q quarters
 * @param {number[][]} rows @param {number} w @param {number} h @param {number} q @returns {number[][]} */
export function turnHeightRows(rows, w, h, q) {
  if (!q) return rows;
  /* corners turn as the cells of a (w + 1) x (h + 1) grid do */
  const T = turnedCells(q, w + 1, h + 1),
    g = [];
  for (let j = 0; j < T.h; j++) g.push(new Array(T.w).fill(0));
  for (let j = 0; j <= h; j++) {
    const r = rows[h - j] || [];
    for (let i = 0; i <= w; i++) {
      const [ii, jj] = T.at(i, j);
      g[jj][ii] = r[i] ?? 0;
    }
  }
  const out = [];
  for (let j = T.h - 1; j >= 0; j--) out.push(g[j]);
  return out;
}

/** towns track TW-0: whether a step at (x, z) pushing along (dx, dz) (the place's metres, any length) walks out
 * through a room's doorway: within half the doorway's width of its exit, no further in than the exit (plus a little),
 * and pushing out of the door (toward the room's near side, in its own metres)
 * @param {{ exits?: number[][], roomGap?: number, roomFrame?: RoomFrame | null }} sc @param {number} x @param {number} z
 * @param {number} dx @param {number} dz @returns {boolean} */
export function roomDoorPush(sc, x, z, dx, dz) {
  const E = sc.exits && sc.exits[0],
    l = Math.hypot(dx, dz);
  if (!E || !l) return false;
  const F = sc.roomFrame,
    [u, v] = roomToLocal(F, x, z),
    [eu, ev] = roomToLocal(F, E[0], E[1]),
    /* the push turned into the room's metres (the same turn, about the origin) */
    [, pv] = roomToLocal(F ? { q: F.q, p: [0, 0], rect: F.rect } : null, dx / l, dz / l);
  return Math.abs(u - eu) < (sc.roomGap || 1.2) / 2 && v <= ev + 0.3 && pv < -0.5;
}
