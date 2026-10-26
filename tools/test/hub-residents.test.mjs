// Residents track RS-3: where the residents live in Copperleaf (logic/residents.js residentHomes), on the real map and
// data: each at their own building or a cottage of their own, by its door; Juniper's cottage never handed out; nobody's
// cottage changes when someone else moves in.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readGameData } from '../data-files.mjs';
import { residentHomes } from '../../game/js/logic/residents.js';

const D = readGameData(),
  M = D.maps.copperleaf,
  R = D.residents,
  B = D.buildings,
  C = D.scenery;

test('hub residents: everyone in residents.json has a building in Copperleaf, the door spot beside it', () => {
  const ids = Object.keys(R),
    H = residentHomes(M, ids, R, B, C);
  assert.deepEqual(Object.keys(H).sort(), ids.slice().sort(), 'everyone has a home');
  for (const id of ids) {
    const h = H[id],
      want = R[id].home;
    if (want === 'house') assert.equal(h.prop.act, 'house', `${id} in a cottage`);
    else assert.ok(h.prop.k === want || h.prop.act === (B[want] && B[want].act), `${id} at ${h.prop.k}`);
    assert.notEqual(h.prop.act, 'home', `${id} isn’t given Juniper’s cottage`);
    const d = Math.hypot(h.at[0] - h.prop.x, h.at[1] - h.prop.z);
    assert.ok(d < 6, `${id}: ${d.toFixed(1)} m from ${h.prop.k}`);
  }
  assert.equal(H.hayden.prop.k, 'barn');
  assert.equal(H.rosa.prop.k, 'train_station');
  assert.equal(H.mo.prop.k, 'shop');
});

test('hub residents: cottage residents each get their own, kept as more move in; the order they moved in decides', () => {
  const R2 = {
    ...R,
    ann: { ...R.seamus, name: 'Ann' },
    bea: { ...R.seamus, name: 'Bea' },
  };
  const one = residentHomes(M, ['seamus'], R2, B, C),
    three = residentHomes(M, ['dottie', 'seamus', 'ann', 'bea'], R2, B, C);
  assert.equal(three.seamus.prop, one.seamus.prop, 'Seamus keeps his cottage');
  const homes = new Set(['seamus', 'ann', 'bea'].map(id => three[id].prop));
  assert.equal(homes.size, 3, 'a cottage each');
  const hub = M.hub,
    far = (/** @type {any} */ p) => Math.hypot(p.x - hub[0], p.z - hub[1]);
  assert.ok(far(three.seamus.prop) <= far(three.ann.prop) && far(three.ann.prop) <= far(three.bea.prop));
});

test('hub residents: an unknown id or a building that isn’t there is left out', () => {
  const H = residentHomes(M, ['nobody', 'dottie'], R, B, C);
  assert.deepEqual(Object.keys(H), ['dottie']);
  const bare = { ...M, props: M.props.filter((/** @type {any} */ p) => p.k !== 'library') };
  assert.deepEqual(Object.keys(residentHomes(bare, ['dottie'], R, B, C)), []);
});
