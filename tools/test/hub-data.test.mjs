// RL-5: Copperleaf Town, the hub, on its own in the game data: a new game starts there, it is the only place, nothing
// leads out of it, the lab and Granny Juniper's cottage stand there and nowhere else outdoors, she stands in her garden,
// the hamlet has no shop or clinic, and nothing solid stands on the opening's stage. (TC-3: was the full check's
// "Copperleaf Town, the hub on its own" step, tools/check-quick.py.)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readGameData } from '../data-files.mjs';

const D = readGameData(),
  HUB = D.maps.copperleaf,
  CAT = D.scenery.props;

test('a new game starts in Copperleaf, the only place, with no exit and no road out', () => {
  assert.equal((D.rules.start || {}).locationId, 'copperleaf');
  assert.deepEqual(
    D.locations.map(l => l.id),
    ['copperleaf']
  );
  assert.ok(!(HUB.exits || []).length && !(HUB.edgeExits || []).length, 'an exit leads out of the hub');
  assert.deepEqual(D.roads, []);
});

test('the lab and Granny Juniper’s cottage stand in Copperleaf and in no other outdoor scene', () => {
  const outdoor = Object.entries(D.maps).filter(([k, v]) => !k.includes('@') && ['town', 'route'].includes(v.kind));
  for (const act of ['lab', 'home']) {
    const where = outdoor.flatMap(([k, v]) => (v.props || []).filter(p => p.act === act).map(() => k));
    assert.deepEqual(where, ['copperleaf'], `act ${act}`);
  }
});

test('Copperleaf has no shop or clinic; Granny Juniper stands there with her script, a page in the Lore', () => {
  const acts = new Set(HUB.props.map(p => p.act));
  assert.ok(!acts.has('shop') && !acts.has('clinic'), 'Copperleaf has a shop or a clinic');
  assert.ok(
    (HUB.people || []).some(p => p.who === 'juniper' && p.script),
    'Granny Juniper isn’t in Copperleaf'
  );
  assert.ok(D.people.juniper, 'Granny Juniper is a person');
  assert.ok(((D.lore || {}).locations || {}).copperleaf, 'no lore for copperleaf');
  assert.ok(((D.lore || {}).people || {}).juniper, 'Granny Juniper has no page in the Lore');
});

test('nothing solid stands on the opening’s stage, east and south of the lab’s door', () => {
  /* game/data/cutscenes/opening.json has its spots there; IS-5: in the lab's own metres (it faces its street on the
     island: x along its front, z back from it) */
  const lab = HUB.props.find(p => p.act === 'lab'),
    M = CAT[lab.k],
    dx = (M.door.x / 34) * (lab.s || 1) * (lab.f ? -1 : 1),
    ra = ((lab.rot || 0) * Math.PI) / 180,
    own = (x, z) => [
      (x - lab.x) * Math.cos(ra) + (z - lab.z) * Math.sin(ra),
      -(x - lab.x) * Math.sin(ra) + (z - lab.z) * Math.cos(ra),
    ];
  const onStage = [];
  for (const p of HUB.props) {
    const Q = CAT[p.k] || {};
    if (Q.flat || p === lab) continue;
    const solid = Q.box || (Q.solid || 0) > 0.25,
      [lx, lz] = own(p.x, p.z);
    if (solid && dx + 0.8 < lx && lx < dx + 9.6 && -4.8 < lz && lz < -1.4) onStage.push(`${p.k} at ${p.x},${p.z}`);
  }
  assert.deepEqual(onStage, []);
});
