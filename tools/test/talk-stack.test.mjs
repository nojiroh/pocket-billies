// Dialogue track DL-4: the talk stack's rules (game/js/logic/talk-stack.js): sides, linked bubbles, how many stay, the
// height budget, the "…" wait and the cut.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cutAt, knockOf, stackFit, stackStep, waitMs } from '../../game/js/logic/talk-stack.js';

/** plays lines through stackStep, returning each step's answer */
const play = (/** @type {any[]} */ lines) => {
  let st = null;
  return lines.map(l => {
    const r = stackStep(st, l);
    st = r.state;
    return r;
  });
};

test('the first speaker talks from the left, the next from the right, and they alternate', () => {
  const r = play([{ who: 'chosen' }, { who: 'kappi' }, { who: 'chosen' }, { who: 'chad' }]);
  assert.deepEqual(
    r.map(x => x.side),
    ['left', 'right', 'left', 'right']
  );
  assert.ok(r.every(x => !x.linked));
});

test('one speaker’s lines in a row keep their side and are linked', () => {
  const r = play([{ who: 'chosen' }, { who: 'chosen' }, { who: 'kappi' }, { who: 'kappi' }]);
  assert.deepEqual(
    r.map(x => [x.side, x.linked]),
    [
      ['left', false],
      ['left', true],
      ['right', false],
      ['right', true],
    ]
  );
});

test('a line cut off is not linked to the same speaker’s next line', () => {
  const r = play([{ who: 'chad', cut: true }, { who: 'chad' }]);
  assert.equal(r[1].linked, false);
  assert.equal(r[1].side, 'left');
});

test('narration sits in the middle, never links and never turns the sides', () => {
  const r = play([
    { who: 'me', skin: 'narration' },
    { who: 'me', skin: 'narration' },
    { who: 'chosen' },
    { who: 'me', skin: 'narration' },
    { who: 'kappi' },
  ]);
  assert.deepEqual(
    r.map(x => x.side),
    ['mid', 'mid', 'left', 'mid', 'right']
  );
  assert.ok(r.every(x => !x.linked));
});

test('the player with lines (the you skin) always talks from the right', () => {
  const r = play([{ who: 'me', skin: 'you' }, { who: 'chosen' }, { who: 'me', skin: 'you' }]);
  assert.deepEqual(
    r.map(x => x.side),
    ['right', 'left', 'right']
  );
});

test('at most two older bubbles stay; the rest drop, the oldest first', () => {
  const r = play([{ who: 'a' }, { who: 'b' }, { who: 'a' }, { who: 'b' }, { who: 'a' }]);
  assert.deepEqual(
    r.map(x => [x.keep, x.drop, x.state.n]),
    [
      [0, 0, 1],
      [1, 0, 2],
      [2, 0, 3],
      [2, 1, 3],
      [2, 1, 3],
    ]
  );
});

test('the height budget: the bubbles over the bar within 40% of a 390×844 phone; the oldest drops first', () => {
  const o = { vh: 844, gap: 6 };
  assert.equal(stackFit([146, 64, 64], o), 2, 'the planned 146 + 64 + 64 fit in 337 px');
  assert.equal(stackFit([146, 64, 64], { ...o, vh: 640 }), 1, 'a short screen keeps one');
  assert.equal(stackFit([200, 64, 64], o), 1, 'a taller newest pushes the oldest out');
  assert.equal(stackFit([280, 64, 64], o), 0, 'a very tall newest keeps none');
  assert.equal(stackFit([146, 64, 64], { ...o, bottom: 130 }), 0, 'space counted under the stack takes from the cap');
  assert.equal(stackFit([146], o), 0);
  assert.equal(stackFit([100, 40, 40, 40], { vh: 2000 }), 2, 'never more than two older');
});

test('the "…" lasts 400-800 ms, the same for the same line', () => {
  for (const s of [0, 1, 7, 12345, 4294967295]) {
    const ms = waitMs(s);
    assert.ok(ms >= 400 && ms <= 800, String(ms));
    assert.equal(ms, waitMs(s));
  }
});

test('a line breaks off at its first cut; a knocked bubble goes away from its side', () => {
  assert.equal(cutAt({ events: [] }), -1);
  assert.equal(
    cutAt({
      events: [
        { at: 9, kind: 'cut' },
        { at: 4, kind: 'cut' },
        { at: 2, kind: 'pause' },
      ],
    }),
    4
  );
  assert.ok(knockOf('left').px < 0 && knockOf('left').deg < 0);
  assert.ok(knockOf('right').px > 0 && knockOf('right').deg > 0);
});
