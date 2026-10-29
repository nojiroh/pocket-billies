// Dialogue track DL-5: the talk director (game/js/logic/talk-director.js): blinks, the mouth on the letters, faces and
// mid-line faces, emotes, the frame's bounce and the head's hits, all seeded; and faceToken, which picks the piece each
// wardrobe item wears from a combined expression.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BLINK_MS,
  EMOTE_MS,
  MOUTH_HOLD,
  bounceAt,
  creatureFace,
  emoteAt,
  faceToken,
  headAt,
  talkDirector,
} from '../../game/js/logic/talk-director.js';

/** the blinks over a span, sampled every 10 ms: [start, end] of each */
function blinks(D, from, to) {
  const out = [];
  let on = null;
  for (let t = from; t <= to; t += 10) {
    const s = D.at(t);
    if (s.eyes === 'shut' && on === null) on = t;
    if (s.eyes === 'open' && on !== null) (out.push([on, t]), (on = null));
  }
  return out;
}

test('faceToken: each item wears the last token it has pieces for', () => {
  const eyes = new Set(['blink', 'happy', 'sad']),
    mouth = new Set(['talk', 'happy']),
    brows = new Set(['angry', 'sad']);
  assert.equal(
    faceToken('happy+talk', x => eyes.has(x)),
    'happy'
  );
  assert.equal(
    faceToken('happy+talk', x => mouth.has(x)),
    'talk'
  );
  assert.equal(
    faceToken('happy+talk', x => brows.has(x)),
    null
  );
  assert.equal(
    faceToken('sad+blink+talk', x => eyes.has(x)),
    'blink'
  );
  assert.equal(
    faceToken('sad+blink+talk', x => brows.has(x)),
    'sad'
  );
  assert.equal(
    faceToken('happy', x => mouth.has(x)),
    'happy'
  );
  assert.equal(
    faceToken(null, () => true),
    null
  );
  assert.equal(
    faceToken('', () => true),
    null
  );
});

test('creatureFace: a rig face from a combination (blink before talk before happy)', () => {
  assert.equal(creatureFace('happy+blink+talk'), 'blink');
  assert.equal(creatureFace('happy+talk'), 'talk');
  assert.equal(creatureFace('happy'), 'happy');
  assert.equal(creatureFace('angry'), 'idle');
  assert.equal(creatureFace(null), 'idle');
});

test('blinks come every 2-6 s, last BLINK_MS, and the same seed blinks the same way', () => {
  const A = talkDirector({ seed: 11 }),
    B = talkDirector({ seed: 11 });
  A.start(0);
  B.start(0);
  const a = blinks(A, 0, 60000),
    b = blinks(B, 0, 60000);
  assert.deepEqual(a, b);
  assert.ok(a.length >= 10 && a.length <= 40, `${a.length} blinks in a minute`);
  assert.ok(a[0][0] >= 2000 && a[0][0] <= 6010, `the first blink at ${a[0][0]}`);
  for (const [s, e] of a) assert.ok(e - s >= BLINK_MS - 10 && e - s <= BLINK_MS + 10, `a blink of ${e - s} ms`);
});

test('about one blink in six is a double blink', () => {
  let doubles = 0,
    all = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const D = talkDirector({ seed });
    D.start(0);
    const b = blinks(D, 0, 120000);
    for (let i = 1; i < b.length; i++) if (b[i][0] - b[i - 1][1] < 200) doubles++;
    all += b.length;
  }
  const share = doubles / (all - doubles);
  assert.ok(share > 0.08 && share < 0.3, `double blinks ${doubles} of ${all - doubles} (${share.toFixed(2)})`);
});

test('no blinks while happy', () => {
  const D = talkDirector({ seed: 3, expr: 'happy' });
  D.start(0);
  assert.deepEqual(blinks(D, 0, 30000), []);
});

test('the mouth opens on vowels, shuts on spaces and punctuation, holds MOUTH_HOLD, and rests after the line', () => {
  const D = talkDirector({ seed: 1 });
  D.start(0);
  D.type('a', 0);
  assert.equal(D.at(0).mouth, 'open');
  D.type(' ', 20);
  assert.equal(D.at(20).mouth, 'open', 'held');
  assert.equal(D.at(MOUTH_HOLD).mouth, 'shut');
  D.type('o', 100);
  assert.equal(D.at(130).mouth, 'open');
  /* a pause: no letter for a while */
  assert.equal(D.at(400).mouth, 'shut');
  D.type('e', 500);
  assert.equal(D.at(560).mouth, 'open');
  D.done();
  assert.equal(D.at(640).mouth, 'shut');
});

test('combo: the face, a blink and the open mouth as one expression', () => {
  const D = talkDirector({ seed: 5, expr: 'happy' });
  D.start(0);
  D.type('a', 0);
  assert.equal(D.at(0).combo, 'happy+talk');
  D.done();
  assert.equal(D.at(100).combo, 'happy');
  const E = talkDirector({ seed: 5 });
  E.start(0);
  assert.equal(E.at(10).combo, null);
});

test('a mid-line [face=x] changes the face when the letters reach it, with its head hit and a bounce', () => {
  const D = talkDirector({
    seed: 2,
    expr: 'happy',
    events: [{ kind: 'face', at: 10, v: 'angry' }],
  });
  D.start(0);
  D.drain();
  D.reach(9, 100);
  assert.equal(D.at(100).expr, 'happy');
  D.reach(10, 200);
  assert.equal(D.at(200).expr, 'angry');
  assert.deepEqual(
    D.drain().map(p => p.kind),
    ['face', 'bounce']
  );
  /* the shake turns the head side to side */
  const yaws = [240, 290, 330].map(t => D.at(t).head.yaw);
  assert.ok(Math.max(...yaws) > 3 && Math.min(...yaws) < -3, `yaws ${yaws}`);
  assert.ok(D.at(200 + 50).bounce !== 0);
  assert.equal(D.at(2000).bounce, 0);
  assert.equal(D.at(2000).head.yaw, 0);
});

test('[emote=x] pops at its letter; a face with its own emote pops it only when the line has none', () => {
  const auto = { surprised: '!', angry: 'anger' };
  const D = talkDirector({ seed: 1, expr: 'surprised', auto, events: [{ kind: 'emote', at: 4, v: 'sweat' }] });
  D.start(0);
  assert.deepEqual(D.at(0).emotes, []);
  D.reach(4, 300);
  assert.deepEqual(
    D.at(300 + 500).emotes.map(e => e.v),
    ['sweat']
  );
  assert.deepEqual(D.at(300 + EMOTE_MS).emotes, []);
  const E = talkDirector({ seed: 1, expr: 'surprised', auto });
  E.start(0);
  assert.deepEqual(
    E.at(100).emotes.map(e => e.v),
    ['!']
  );
  assert.deepEqual(
    E.drain().map(p => p.kind + (p.v ? ':' + p.v : '')),
    ['emote:!', 'bounce']
  );
});

test('an emote pops 0 → 1.2 → 1 over 200 ms and fades by EMOTE_MS', () => {
  const e = { v: '!', t: 0 };
  assert.equal(emoteAt(e, 0, false).s, 0);
  assert.equal(emoteAt(e, 120, false).s, 1.2);
  assert.equal(emoteAt(e, 200, false).s, 1);
  assert.equal(emoteAt(e, 900, false).a, 1);
  assert.equal(emoteAt(e, EMOTE_MS, false).a, 0);
  assert.equal(emoteAt(e, 0, true).s, 1, 'no pop under Reduced');
});

test('head hits: a nod dips, a jolt lifts, a sad face droops and a smug one tilts', () => {
  assert.ok(headAt([{ kind: 'nod', t: 0 }], null, 0, 150).pitch > 4);
  assert.ok(headAt([{ kind: 'jolt', t: 0 }], null, 0, 60).pitch < -8);
  assert.ok(headAt([], 'sad', 0, 1000).pitch > 7);
  assert.ok(headAt([], 'smug', 0, 1000).roll > 7);
  assert.deepEqual(headAt([{ kind: 'nod', t: 0 }], null, 0, 5000), { yaw: 0, pitch: 0, roll: 0 });
});

test('the bounce is a damped spring that settles', () => {
  assert.ok(bounceAt([0], 0) > 0.1);
  assert.ok(bounceAt([0], 110) < 0, 'it swings back');
  assert.equal(bounceAt([0], 800), 0);
});

test('Reduced: blinks and the mouth stay; no bounce, no head, emotes without the pop', () => {
  const D = talkDirector({
    seed: 4,
    expr: 'happy',
    reduced: true,
    events: [
      { kind: 'face', at: 2, v: 'angry' },
      { kind: 'emote', at: 2, v: 'heart' },
    ],
  });
  D.start(0);
  D.type('a', 0);
  assert.equal(D.at(0).mouth, 'open');
  D.reach(2, 100);
  const s = D.at(150);
  assert.deepEqual(s.head, { yaw: 0, pitch: 0, roll: 0 });
  assert.equal(s.bounce, 0);
  assert.equal(s.emotes[0].s, 1);
  assert.ok(!D.drain().some(p => p.kind === 'bounce'));
  assert.ok(blinks(D, 200, 20000).length > 0, 'still blinks once angry');
});

test('no blink before the line starts; the next line goes on from the blink that was due', () => {
  const A = talkDirector({ seed: 9 });
  assert.equal(A.at(5000).eyes, 'open', 'not started');
  A.start(100000);
  const due = A.nextBlink();
  assert.ok(due >= 102000 && due <= 106000);
  const B = talkDirector({ seed: 1, blinkAt: due });
  B.start(due - 500);
  assert.equal(B.nextBlink(), due);
  assert.equal(B.at(due + 10).eyes, 'shut');
});
