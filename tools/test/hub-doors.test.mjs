// Hub track HB-4b: every building on the hub island has its door toward the orbit camera: within 45 degrees of facing
// out from the orbit's pivot (cam.orbit.c, the summit spot), on a quarter turn (0, 90, 180, 270) so its room stays
// square with its walls (logic/room-turn.js). Reads the built map (tools/build-island.mjs, then build-copperleaf.mjs).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readGameData } from '../data-files.mjs';
import { islandAngleDiff } from '../../game/js/logic/island-gen.js';

const D = readGameData(),
  C = D.scenery.props,
  M = D.maps.copperleaf;

/** the way a prop at rot faces, in degrees (0 east, 90 north; rot 0 faces south, logic/prop-turn.js) */
const facing = rot => {
  const r = ((rot || 0) * Math.PI) / 180;
  return (Math.atan2(-Math.cos(r), Math.sin(r)) * 180) / Math.PI;
};

test('every building on the hub island: its door within 45 degrees of facing out from the orbit pivot, on a quarter turn', () => {
  const [cx, cz] = M.cam.orbit.c,
    doors = M.props.filter(p => C[p.k] && C[p.k].door);
  assert.ok(doors.length >= 15, `${doors.length} buildings with a door`);
  for (const p of doors) {
    const off = islandAngleDiff(facing(p.rot), (Math.atan2(p.z - cz, p.x - cx) * 180) / Math.PI);
    assert.ok(Math.abs(off) <= 45, `${p.k} at ${p.x}, ${p.z}: ${Math.round(off)} degrees off facing out`);
    assert.equal(((Math.round(p.rot || 0) % 90) + 90) % 90, 0, `${p.k} at ${p.x}, ${p.z}: rot ${p.rot}`);
  }
});

test('the hub has the lab, the store, the home, the inn and the library standing, and plots for the rest', () => {
  for (const k of ['lab', 'shop', 'cottage_juniper', 'inn', 'library', 'barn'])
    assert.ok(
      M.props.some(p => p.k === k),
      `no ${k}`
    );
  for (const k of ['workshop', 'genebank', 'station', 'lighthouse', 'windmill'])
    assert.ok(
      M.plots.some(L => L.k === k),
      `no ${k} plot`
    );
  assert.ok(M.props.filter(p => p.act === 'house').length >= 8, 'at least 8 cottages');
  assert.ok(M.landmarks && M.landmarks.rail.length > 2, "the station's sky rail");
});
