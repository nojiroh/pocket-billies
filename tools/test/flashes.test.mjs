// Style track SY-1: the battle's flashes under the Flashes and Reduced motion settings (game/js/logic/smear.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLASH_DARK, FLASH_SOFT_MAX, flashFor, flashLuma, impactFrame } from '../../game/js/logic/smear.js';

test('a colour reads as bright or dark: hex long and short; anything else counts as bright', () => {
  assert.equal(flashLuma('#FFFFFF'), 1);
  assert.equal(flashLuma('#000'), 0);
  assert.ok(flashLuma('#FFF2A8') > 0.9, 'the crit gold');
  assert.ok(flashLuma('#5A1030') < FLASH_DARK, "a faint's deep red");
  assert.equal(flashLuma('#fff'), flashLuma('#FFFFFF'));
  assert.equal(flashLuma('white'), 1);
  assert.equal(flashLuma(''), 1);
});

test('flashes on: every flash shows as asked', () => {
  assert.deepEqual(flashFor('#FFFFFF', 0.55, false, false), { col: '#FFFFFF', a: 0.55 });
  assert.deepEqual(flashFor('#5A1030', 0.45, false, false), { col: '#5A1030', a: 0.45 });
  assert.equal(flashFor('#FFFFFF', 0, false, false), null, 'nothing to show');
});

test('Reduced motion: no flash at all, bright or dark, whatever Flashes says', () => {
  for (const off of [false, true]) {
    assert.equal(flashFor('#FFFFFF', 0.6, true, off), null);
    assert.equal(flashFor('#5A1030', 0.45, true, off), null);
  }
});

test('Flashes off: a bright flash is held to a faint tint; a dark one stays; a faint one is not raised', () => {
  for (const col of ['#FFFFFF', '#FFF2A8', '#FFD860', '#C8A060', '#FF5A7A'])
    assert.deepEqual(flashFor(col, 0.6, false, true), { col, a: FLASH_SOFT_MAX }, col);
  assert.deepEqual(flashFor('#5A1030', 0.45, false, true), { col: '#5A1030', a: 0.45 }, 'dark stays');
  assert.deepEqual(flashFor('#FFFFFF', 0.1, false, true), { col: '#FFFFFF', a: 0.1 }, 'already faint');
  assert.ok(FLASH_SOFT_MAX <= 0.2);
});

test('Flashes off: the impact frame drops its two-tone cells; a crit keeps its speed lines', () => {
  assert.equal(impactFrame('catch', false, 0, true), null);
  assert.equal(impactFrame('coin', false, 0, true), null);
  assert.deepEqual(impactFrame('crit', false, 0, true), {
    kind: 'crit',
    cells: 0,
    lines: 24,
    warm: true,
    speed: true,
  });
  assert.equal(impactFrame('crit', true, 0, true), null, 'Reduced motion still wins');
  assert.equal(impactFrame('catch', false, 0).cells, 2, 'Flashes on: as before');
});
