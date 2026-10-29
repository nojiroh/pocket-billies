// Dialogue track DL-3: who wears which bubble, a line's seed and tilt (game/js/logic/talk-skins.js), and the game's own
// talkSkins.json against its schema and the rest of the data.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { talkAccentHue, talkSeed, talkSkinOf, talkTilt, talkVariant } from '../../game/js/logic/talk-skins.js';

const read = (/** @type {string} */ p) =>
  JSON.parse(readFileSync(new URL(`../../game/data/${p}`, import.meta.url), 'utf8'));
const SKINS = read('talkSkins.json');

test('a line wears the caller’s skin, else the speaker’s, else its trainer class’s, else the default', () => {
  const D = {
    default: 'folk',
    skins: { folk: {}, chosen: {}, bureau: {}, narration: {} },
    speakers: { chosen: 'chosen', me: 'narration', ghost: 'nope' },
    classes: { bureau_clerk: 'bureau' },
  };
  assert.equal(talkSkinOf(D, 'chosen'), 'chosen');
  assert.equal(talkSkinOf(D, 'me'), 'narration');
  assert.equal(talkSkinOf(D, 'folk:12'), 'folk');
  assert.equal(talkSkinOf(D, 'trainer_look', { cls: 'bureau_clerk' }), 'bureau');
  assert.equal(talkSkinOf(D, 'chosen', { skin: 'bureau' }), 'bureau', 'the caller wins');
  assert.equal(talkSkinOf(D, 'chosen', { skin: 'missing' }), 'chosen', 'an unknown skin is ignored');
  assert.equal(talkSkinOf(D, 'ghost'), 'folk', 'a speaker pointing at no skin wears the default');
  assert.equal(talkSkinOf(undefined, 'chosen'), 'folk', 'no data: the default');
});

test('the game’s skins: Chosen, Kappi, Blake (chad), the Bureau’s agents and narration each have their own', () => {
  assert.equal(talkSkinOf(SKINS, 'chosen'), 'chosen');
  assert.equal(talkSkinOf(SKINS, 'kappi'), 'kappi');
  assert.equal(talkSkinOf(SKINS, 'chad'), 'blake');
  assert.equal(talkSkinOf(SKINS, 'me'), 'narration');
  assert.equal(talkSkinOf(SKINS, 'x', { cls: 'bureau_clerk' }), 'bureau');
  assert.equal(talkSkinOf(SKINS, 'x', { cls: 'bureau_reclaimer' }), 'bureau');
  assert.equal(talkSkinOf(SKINS, 'folk:3'), 'folk');
});

test('a seed is the same for the same line and speaker, and differs between them', () => {
  assert.equal(talkSeed('Hello.', 'chosen'), talkSeed('Hello.', 'chosen'));
  assert.notEqual(talkSeed('Hello.', 'chosen'), talkSeed('Hello!', 'chosen'));
  assert.notEqual(talkSeed('Hello.', 'chosen'), talkSeed('Hello.', 'kappi'));
  assert.ok(Number.isInteger(talkSeed('')) && talkSeed('') >= 0);
});

test('a tilt stays within ±max, is never nearly flat, leans both ways over many lines, and 0 turns it off', () => {
  let left = 0,
    right = 0;
  for (let i = 0; i < 200; i++) {
    const a = talkTilt(talkSeed(`line ${i}`), 3);
    assert.ok(Math.abs(a) <= 3 && Math.abs(a) >= 0.99, `${a}`);
    if (a < 0) left++;
    else right++;
  }
  assert.ok(left > 50 && right > 50, `${left} / ${right}`);
  assert.equal(talkTilt(12345, 0), 0);
  assert.equal(talkTilt(12345, 3, 0), 0, 'a skin with tilt 0 never tilts');
  assert.ok(Math.abs(talkTilt(12345, 3, 2)) <= 6);
  assert.equal(talkTilt(12345, NaN), 0);
});

test('a burst variant is one of the held ones; an accent hue is a hue', () => {
  for (let i = 0; i < 50; i++) {
    const v = talkVariant(talkSeed(`l${i}`), 3);
    assert.ok(Number.isInteger(v) && v >= 0 && v < 3);
  }
  assert.equal(talkVariant(99, 1), 0);
  const h = talkAccentHue('folk:7');
  assert.ok(h >= 0 && h < 360 && h === talkAccentHue('folk:7'));
});
