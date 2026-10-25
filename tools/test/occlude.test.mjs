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

test('the outline colour keeps a bright top’s colour and lifts a dark one', () => {
  assert.deepEqual(
    O.outlineColour('#ff0000'),
    [1, 0, 0].map(v => (v === 1 ? 1 : 0.2)),
    'pure red lifted to 0.6'
  );
  const navy = O.outlineColour('#2E3A6A');
  const L = (Math.max(...navy) + Math.min(...navy)) / 2;
  assert.ok(Math.abs(L - 0.6) < 0.01, `navy lifted to lightness 0.6: ${navy}`);
  assert.ok(navy[2] > navy[0] && navy[2] > navy[1], 'still blue');
  const cream = O.outlineColour('#F2EEE4');
  assert.ok(
    cream.every(v => v > 0.85),
    'a light colour stays light'
  );
  const grey = O.outlineColour('#202020');
  assert.ok(Math.abs(grey[0] - grey[2]) < 1e-9 && grey[0] >= 0.6 - 1e-9, 'a dark grey becomes a light grey');
  assert.equal(O.outlineColour('red'), null);
  assert.equal(O.outlineColour(null), null);
});

test('a picture covering you fades to the dial, milder while the circle is on', () => {
  assert.equal(O.coverTarget(0.4, 0), 0.4);
  assert.ok(Math.abs(O.coverTarget(0.4, 1) - 0.7) < 1e-9);
  assert.equal(O.coverTarget(1, 1), 1, 'off');
  assert.equal(O.coverTarget(2, -1), 1, 'kept in range');
});

test('a fade thins out in about a quarter of a second, comes back slower and settles exactly', () => {
  let v = 1;
  for (let i = 0; i < 15; i++) v = O.fadeEase(v, 0.4, 1 / 60);
  assert.ok(v < 0.45, `a quarter of a second: ${v}`);
  let w = 0.4;
  for (let i = 0; i < 15; i++) w = O.fadeEase(w, 1, 1 / 60);
  assert.ok(w > 0.8 && w < 1, `coming back: ${w}`);
  for (let i = 0; i < 120; i++) w = O.fadeEase(w, 1, 1 / 60);
  assert.equal(w, 1);
});
