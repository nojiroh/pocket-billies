// Player visibility: whether a tall picture nearer the camera covers the player on screen
// (game/js/logic/occlude.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modules } from './setup-real.mjs';

const O = modules['occlude'];
// the player's middle at screen (100, 200), 10 m from the eye; a picture 2 m wide and 4 m tall, 20 pixels a metre
const me = { x: 100, y: 200, d: 10 };
const at = (x, y, d) => ({ x, y, d, s: 20 });

test('a picture nearer the camera whose box holds the player covers them', () => {
  assert.equal(O.pictureCovers(me, at(100, 250, 8), 1, 4), true);
});

test('a picture beside, below or above the player on screen does not', () => {
  assert.equal(O.pictureCovers(me, at(130, 250, 8), 1, 4), false, 'beside: 30 px off, half width 20 px');
  assert.equal(O.pictureCovers(me, at(100, 190, 8), 1, 4), false, 'its foot above the player');
  assert.equal(O.pictureCovers(me, at(100, 300, 8), 1, 4), false, 'too short to reach up to the player');
});

test('a picture at the player’s depth or behind them does not', () => {
  assert.equal(O.pictureCovers(me, at(100, 250, 9.8), 1, 4), false, 'within 0.3 m');
  assert.equal(O.pictureCovers(me, at(100, 250, 12), 1, 4), false, 'behind');
});

test('the hidden amount comes on quickly, goes slowly and settles exactly', () => {
  let k = 0;
  for (let i = 0; i < 6; i++) k = O.hiddenEase(k, 1, 1 / 60);
  assert.ok(k > 0.6, `a tenth of a second behind something: ${k}`);
  let j = 1;
  for (let i = 0; i < 6; i++) j = O.hiddenEase(j, 0, 1 / 60);
  assert.ok(j > 0.6, `a tenth of a second out: ${j}`);
  for (let i = 0; i < 300; i++) j = O.hiddenEase(j, 0, 1 / 60);
  assert.equal(j, 0);
  assert.equal(O.hiddenEase(0.5, 1, 0), 0.5, 'no time, no change');
});
