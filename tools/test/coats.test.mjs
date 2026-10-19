// Studio track ST-0: coats, a recolour of a Billie's art in place of the old Golden sheets (game/js/logic/coats.js,
// game/data/coats.json).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { COAT_NEAR, coatArt, coatColorMap, coatRecolor, coatRoll } from '../../game/js/logic/coats.js';

const ROOT = join(import.meta.dirname, '..', '..');
const PALETTE = JSON.parse(
  readFileSync(join(ROOT, 'game', 'art', 'next', 'palette.js'), 'utf8')
    .replace(/^[^=]*=/, '')
    .replace(/;\s*$/, '')
);
const COATS = JSON.parse(readFileSync(join(ROOT, 'game', 'data', 'coats.json'), 'utf8'));
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const px = (...hexes) => new Uint8ClampedArray(hexes.flatMap(h => [...rgb(h), 255]));

test('a ramp swap maps every step of one ramp onto the same step of the other', () => {
  const m = coatColorMap({ name: 'x', ramps: { ember: 'indigo' } }, PALETTE);
  assert.equal(m.size, PALETTE.ramps.ember.length);
  PALETTE.ramps.ember.forEach((c, i) => assert.equal(m.get(c.slice(1)), PALETTE.ramps.indigo[i].slice(1)));
});

test('exact swaps come after the ramps and win over them', () => {
  const e3 = PALETTE.ramps.ember[3];
  const m = coatColorMap({ name: 'x', ramps: { ember: 'indigo' }, swap: { [e3.toUpperCase()]: '#123456' } }, PALETTE);
  assert.equal(m.get(e3.slice(1)), '123456');
});

test('recolouring changes swapped shades, keeps other shades and leaves transparent pixels alone', () => {
  const m = coatColorMap({ name: 'x', ramps: { ember: 'indigo' } }, PALETTE),
    d = px(PALETTE.ramps.ember[3], PALETTE.ramps.leaf[3]);
  d[7] = 255;
  const clear = new Uint8ClampedArray([...rgb(PALETTE.ramps.ember[3]), 0]);
  assert.equal(coatRecolor(d, m, PALETTE), 1);
  assert.deepEqual([...d.slice(0, 3)], rgb(PALETTE.ramps.indigo[3]));
  assert.deepEqual([...d.slice(4, 7)], rgb(PALETTE.ramps.leaf[3]));
  assert.equal(coatRecolor(clear, m, PALETTE), 0);
});

test('a pixel slightly off the palette still recolours; one far from every shade stays', () => {
  const m = coatColorMap({ name: 'x', ramps: { ember: 'indigo' } }, PALETTE),
    [r, g, b] = rgb(PALETTE.ramps.ember[3]),
    near = new Uint8ClampedArray([r + 4, g, b - 3, 255]);
  coatRecolor(near, m, PALETTE);
  assert.deepEqual([...near.slice(0, 3)], rgb(PALETTE.ramps.indigo[3]));
  const far = new Uint8ClampedArray([1, 254, 1, 255]);
  assert.equal(coatRecolor(far, m, PALETTE), 0);
  assert.ok(COAT_NEAR > 0);
});

test('a shade of an unswapped ramp that sits near a swapped one keeps its colour', () => {
  const m = coatColorMap({ name: 'x', ramps: { ember: 'indigo' } }, PALETTE),
    keep = Object.entries(PALETTE.ramps)
      .filter(([k]) => k !== 'ember')
      .flatMap(([, r]) => r);
  const d = px(...keep);
  const before = [...d];
  coatRecolor(d, m, PALETTE);
  const moved = keep.filter(
    (c, i) => d[i * 4] !== before[i * 4] || d[i * 4 + 1] !== before[i * 4 + 1] || d[i * 4 + 2] !== before[i * 4 + 2]
  );
  // a colour shared by two ramps is the only way an unswapped shade may move
  for (const c of moved) assert.ok(PALETTE.ramps.ember.includes(c), `${c} moved`);
});

test('coat rolls: no odds means no random number drawn; odds are tried in turn', () => {
  let calls = 0;
  const rnd = () => (calls++, 0);
  assert.equal(coatRoll({ a: { name: 'A' } }, 'wild', rnd), undefined);
  assert.equal(calls, 0);
  assert.equal(
    coatRoll({ a: { name: 'A', odds: { egg: 10 } }, b: { name: 'B', odds: { wild: 4 } } }, 'wild', rnd),
    'b'
  );
  assert.equal(
    coatRoll({ b: { name: 'B', odds: { wild: 4 } } }, 'wild', () => 0.5),
    undefined
  );
});

test('a hand-painted sheet wins over the recolour for its species and view only', () => {
  const C = { name: 'x', art: { musk0: { front: 'next/coats/musk0_x.png' } } };
  assert.equal(coatArt(C, 'musk0', 'front'), 'next/coats/musk0_x.png');
  assert.equal(coatArt(C, 'musk0', 'back'), null);
  assert.equal(coatArt(C, 'bezos0', 'front'), null);
});

test("the game's coats name real palette ramps and none is rolled yet", () => {
  for (const [id, C] of Object.entries(COATS)) {
    for (const [a, b] of Object.entries(C.ramps || {}))
      assert.ok(PALETTE.ramps[a] && PALETTE.ramps[b], `${id}: ${a} -> ${b}`);
    assert.ok(!C.odds, `${id} has odds: the owner sets them in the Studio`);
  }
});
