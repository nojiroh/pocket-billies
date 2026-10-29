// Dialogue track DL-2: when each letter of a spoken line shows (game/js/logic/talk-type.js): Text speed, [slow] and
// [fast], [p] pauses, the beats after punctuation and the slow ellipsis.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseLine } from '../../game/js/logic/line-markup.js';
import { BEAT_LONG, BEAT_SHORT, ELLIPSIS_SLOW, TEXT_SPEEDS, letterTimes } from '../../game/js/logic/talk-type.js';

const N = TEXT_SPEEDS.normal;
const times = (/** @type {string} */ line, /** @type {string} */ speed = 'normal') =>
  letterTimes(parseLine(line), speed);

test('an even line: one letter every letter time, from 0', () => {
  const T = times('abcd');
  assert.deepEqual(T.at, [0, N, 2 * N, 3 * N]);
  assert.equal(T.end, 4 * N);
  assert.deepEqual(times('').at, []);
  assert.equal(times('').end, 0);
});

test('Text speed: slow, fast and an unknown speed (normal); instant shows everything at once', () => {
  assert.deepEqual(times('ab', 'slow').at, [0, TEXT_SPEEDS.slow]);
  assert.deepEqual(times('ab', 'fast').at, [0, TEXT_SPEEDS.fast]);
  assert.deepEqual(times('ab', 'zippy').at, [0, N]);
  assert.ok(TEXT_SPEEDS.slow > N && N > TEXT_SPEEDS.fast);
  const I = times('Wait,[p=2] what. [slow]No.[/slow]', 'instant');
  assert.ok(I.at.every(t => t === 0));
  assert.equal(I.end, 0);
});

test('[slow] letters take twice as long, [fast] half', () => {
  assert.deepEqual(times('a[slow]bc[/slow]d').at, [0, N, 3 * N, 5 * N]);
  assert.deepEqual(times('a[fast]bc[/fast]d').at, [0, N, 1.5 * N, 2 * N]);
});

test('[p] waits before the next letter, its seconds or the default', () => {
  assert.deepEqual(times('ab[p=0.5]c').at, [0, N, 2 * N + 500]);
  assert.deepEqual(times('ab[p]c').at, [0, N, 2 * N + 400]);
});

test('beats: short after , ; : and long after . ! ? when a space follows', () => {
  // "a, b": a at 0, ',' at N, then ' ' after the comma's time plus its beat
  assert.equal(times('a, b').at[2], 2 * N + BEAT_SHORT * N);
  assert.equal(times('a; b').at[2], 2 * N + BEAT_SHORT * N);
  assert.equal(times('a. b').at[2], 2 * N + BEAT_LONG * N);
  assert.equal(times('a! b').at[2], 2 * N + BEAT_LONG * N);
});

test('no beat inside "3.5", between "?!" or at the end; one beat after the last mark, past a quote', () => {
  assert.deepEqual(times('3.5').at, [0, N, 2 * N]);
  const Q = times('a?! b');
  assert.equal(Q.at[2], 2 * N, 'no beat between ? and !');
  assert.equal(Q.at[3], 3 * N + BEAT_LONG * N);
  assert.equal(times('Hi.').end, 3 * N, 'no beat at the end');
  assert.equal(times('"Hi." he').at[5], 5 * N + BEAT_LONG * N, 'the beat after the closing quote');
});

test('an ellipsis types slowly, then the long beat', () => {
  const D = times('a... b');
  assert.deepEqual(D.at.slice(0, 4), [0, N, N + ELLIPSIS_SLOW * N, N + 2 * ELLIPSIS_SLOW * N]);
  assert.equal(D.at[4], N + 3 * ELLIPSIS_SLOW * N + BEAT_LONG * N);
  const U = times('a… b');
  assert.equal(U.at[2], N + ELLIPSIS_SLOW * N + BEAT_LONG * N);
  assert.deepEqual(times('a.. b').at.slice(0, 3), [0, N, 2 * N], 'two dots are not an ellipsis');
});

test('indexes are the parse’s letters (code points), not UTF-16 units', () => {
  const T = times('🙂ab');
  assert.equal(T.at.length, 3);
  assert.deepEqual(T.at, [0, N, 2 * N]);
});
