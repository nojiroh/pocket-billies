// alpha 0.4's airship rules in the game data: every town has somewhere to fly from (a prop with act 'fly', or a sky
// lift for a town marked noFly; the hub, Copperleaf, has Skyline Station instead, HB-7: its airship is scenery), no old
// train station (the alpha's `station` prop) stands anywhere, every mast has its airship moored at it, and
// the mast and the airship are low-poly models (tools/build-airship.py): the airship bobbing, with two turning
// propellers, its vertex data the right size, painted from the building sheet. (TC-3: was the full check's "an
// airship mast in every town" step, tools/check-quick.py.)
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { readGameData } from '../data-files.mjs';
import { ROOT } from './load-logic.mjs';

const D = readGameData(),
  CAT = D.scenery.props,
  art = rel => join(ROOT, 'game/art', rel);

test('every town has somewhere to fly from; no train station is left', () => {
  const towns = D.locations.filter(l => l.kind === 'town');
  assert.ok(towns.length > 0, 'no town');
  for (const t of towns) {
    const act = t.id === 'copperleaf' ? 'station' : t.noFly ? 'lift' : 'fly';
    assert.ok(
      D.maps[t.mapId].props.some(p => p.act === act),
      `${t.id}: ${{ station: 'no Skyline Station', lift: 'no lift', fly: 'nowhere to fly from' }[act]}`
    );
  }
  const stations = Object.values(D.maps).flatMap(sc => (sc.props || []).filter(p => p.k === 'station'));
  assert.equal(stations.length, 0, 'an old train station is still standing');
});

test('every mast has its airship moored at it', () => {
  const lone = [];
  for (const [sid, sc] of Object.entries(D.maps)) {
    const P = sc.props || [];
    for (const m of P.filter(q => q.k === 'airship_mast' || q.k === 'airship_station'))
      if (!P.some(q => q.k === 'airship' && Math.abs(q.x - m.x) < 0.05 && Math.abs(q.z - m.z) < 0.05))
        lone.push(`${sid}: ${m.k} at ${m.x},${m.z}`);
  }
  assert.deepEqual(lone, []);
});

test('the mast and the airship are low-poly models, the airship bobbing with two turning propellers', () => {
  const M = CAT.airship_mast || {},
    A = CAT.airship || {};
  assert.ok(M.model && existsSync(art(M.model)), 'the mast has no 3D model');
  assert.ok(A.model && existsSync(art(A.model)), 'the airship has no 3D model');
  const mast = JSON.parse(readFileSync(art(M.model), 'utf8')),
    ship = JSON.parse(readFileSync(art(A.model), 'utf8')),
    spins = ship.spins || [];
  assert.equal(mast.kind, 'mesh', 'the mast is a low-poly model');
  assert.equal(ship.kind, 'mesh', 'the airship is a low-poly model');
  assert.equal(spins.length, 2, 'turning propellers');
  assert.ok(A.bob, 'the airship bobs');
  assert.ok((M.box || [9])[0] <= 2.5, 'the mast’s footprint reaches past the tower');
  for (const P of [...(ship.parts || []), ...(mast.parts || []), ...spins])
    assert.equal(Buffer.from(P.data, 'base64').length, P.n * 24 + P.ni * 2, `${P.name}: its vertex data`);
  const sheet = (D.scenery.buildArt || {}).detail;
  assert.ok(sheet && existsSync(art(sheet)), 'the building sheet the models are painted from is missing');
});
