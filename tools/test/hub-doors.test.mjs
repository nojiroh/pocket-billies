// Hub track HB-4b: every building on the hub island has its door toward the orbit camera: within 45 degrees of facing
// out from the orbit's pivot (cam.orbit.c, the summit spot), on a quarter turn (0, 90, 180, 270) so its room stays
// square with its walls (logic/room-turn.js). Reads the built map (tools/build-island.mjs, then build-copperleaf.mjs).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readGameData } from '../data-files.mjs';
import { SKY_RAIL, islandAngleDiff } from '../../game/js/logic/island-gen.js';

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

test('hub placing: the new buildings on their plots, their doors open their rooms, the store sells nothing yet', () => {
  const on = (k, L) => {
    const p = M.props.find(q => q.k === k);
    assert.ok(p, `no ${k}`);
    const P = M.plots.find(q => q.k === L);
    assert.ok(P && Math.hypot(p.x - P.x, p.z - P.z) < Math.hypot(P.w, P.d) / 2, `${k} isn't on its ${L} plot`);
    return p;
  };
  for (const [k, L] of [
    ['workshop', 'workshop'],
    ['gene_bank', 'genebank'],
    ['lighthouse', 'lighthouse'],
    ['windmill', 'windmill'],
    ['train_station', 'station'],
    ['inn', 'inn'],
    ['library', 'library'],
  ])
    on(k, L);
  for (const k of ['inn', 'library', 'workshop', 'gene_bank']) {
    const p = M.props.find(q => q.k === k);
    /* SP-4, SP-5: the Gene Bank's and the Workshop's doors are their own acts (ROOM_BY_USE opens their rooms) */
    assert.equal(p.act, { gene_bank: 'genebank', workshop: 'workshop' }[k] || 'enter', `${k}'s door`);
    assert.ok(C[k].room && D.maps[C[k].room], `${k} has no room`);
  }
  const shop = M.props.find(q => q.k === 'shop');
  assert.equal(shop.act, 'shop');
  assert.ok(!shop.shop, 'the General store has a stock');
  assert.equal(M.props.find(q => q.k === 'train_station').act, 'station');
});

test('cutscenes track A: Skyline Station faces out, its track chained from its right-hand end, level with it, the portal floating out in front', () => {
  const st = M.props.find(q => q.k === 'train_station'),
    L = M.plots.find(q => q.k === 'station'),
    pieces = M.props.filter(q => q.k === 'sky_rail'),
    portal = M.props.find(q => q.k === 'sky_portal'),
    r = ((st.rot || 0) * Math.PI) / 180,
    /* a point in the station's own metres (x along its front, z back from it) */
    own = q => [
      (q.x - st.x) * Math.cos(r) + (q.z - st.z) * Math.sin(r),
      -(q.x - st.x) * Math.sin(r) + (q.z - st.z) * Math.cos(r),
    ];
  /* its front toward the orbit camera, which looks in from out at sea */
  const [cx, cz] = M.cam.orbit.c,
    front = [Math.sin(r), -Math.cos(r)],
    outward = [st.x - cx, st.z - cz];
  assert.ok(front[0] * outward[0] + front[1] * outward[1] > 0.8 * Math.hypot(...outward), 'it faces out');
  assert.equal(pieces.length, SKY_RAIL.looks.length);
  const back = C.train_station.box[1] / 2 + SKY_RAIL.from[1];
  pieces.forEach((q, i) => {
    const [u, v] = own(q);
    assert.ok(Math.abs(u - SKY_RAIL.from[0] - SKY_RAIL.piece * (i + 0.5)) < 0.02, `piece ${i} at ${u} along`);
    assert.ok(Math.abs(v - back) < 0.02, `piece ${i} ${v} m back`);
    assert.equal(q.y, L.y, `piece ${i} level with the station`);
    assert.equal(q.rot || 0, st.rot || 0);
    const look = SKY_RAIL.looks[i],
      V = look ? C.sky_rail.variants[q.v - 1] : null;
    assert.equal(V ? V.form : '', look, `piece ${i}'s look`);
  });
  const [pu, pv] = own(portal);
  assert.ok(Math.abs(pu - SKY_RAIL.from[0] - SKY_RAIL.tear[0]) < 0.02 && Math.abs(pv - back + SKY_RAIL.tear[1]) < 0.02);
  assert.ok(portal.y > L.y + 10, 'floating');
  /* the data (the ride flies the train from it) runs down the drawn track's middle */
  for (const [x, z, y] of M.landmarks.rail) {
    const [, v] = own({ x, z });
    assert.ok(Math.abs(v - back) < 0.05, `the track data ${v} m back`);
    assert.ok(Math.abs(y - L.y - SKY_RAIL.height) < 0.05, `the track data at ${y}`);
  }
});
