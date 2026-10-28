// Sound track SND-9: instruments baked from numbers (game/js/logic/sound-bake.js): the same output every time, no NaN,
// peaks at most 1, seamless loops, strings in tune, a size budget, and the reverb's impulse. SND-10: water's bubbles and
// babble.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SOUND_BAKE_CHUNK,
  SOUND_BAKE_INSTRUMENTS,
  soundBakeAll,
  soundBakeBabble,
  soundBakeBiquad,
  soundBakeBubble,
  soundBakeEnvelope,
  soundBakeFm,
  soundBakeImpulse,
  soundBakeLoop,
  soundBakeOsc,
  soundBakeRoots,
  soundBakeRun,
  soundBakeString,
  soundBakeZoneFor,
  soundBakeZoneSteps,
} from '../../game/js/logic/sound-bake.js';
import { ambienceRandom } from '../../game/js/logic/ambience-sound.js';

const RATE = 48000;
const harp = SOUND_BAKE_INSTRUMENTS.harp;
/* a pad and a bell, so the other two kinds are tested before SND-11 gives them instruments */
const pad = {
  kind: 'osc',
  lo: 48,
  hi: 72,
  every: 12,
  wave: 'saw',
  a: 0.05,
  d: 0.1,
  s: 0.6,
  hold: 0.12,
  cut: 3000,
  level: 0.7,
};
const bell = {
  kind: 'fm',
  lo: 60,
  hi: 84,
  every: 12,
  sec: 0.6,
  ratio: 2.8,
  index: 6,
  indexEnd: 0.2,
  t60: 1.5,
  level: 0.7,
};

const peak = d => d.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
const finite = d => d.every(Number.isFinite);
const hzOf = m => 440 * Math.pow(2, (m - 69) / 12);

test('a bake is the same every time, at each rate', () => {
  for (const rate of [44100, 48000]) {
    const a = soundBakeAll(harp, rate),
      b = soundBakeAll(harp, rate);
    assert.equal(a.length, b.length);
    a.forEach((z, i) => assert.deepEqual(z.data, b[i].data, `zone ${i} at ${rate}`));
  }
  const [L1, R1] = soundBakeRun(soundBakeImpulse(RATE)),
    [L2] = soundBakeRun(soundBakeImpulse(RATE));
  assert.deepEqual(L1, L2);
  assert.notDeepEqual(L1, R1, 'the two sides differ (a stereo room)');
});

test('the bake never calls Math.random (the song fingerprints are seeded through it)', () => {
  const real = Math.random;
  let calls = 0;
  Math.random = () => (calls++, 0.5);
  try {
    soundBakeAll(harp, 44100);
    soundBakeAll(pad, 44100);
    soundBakeAll(bell, 44100);
    soundBakeRun(soundBakeImpulse(44100));
  } finally {
    Math.random = real;
  }
  assert.equal(calls, 0);
});

test('no NaN, peaks at most 1, every kind of zone', () => {
  for (const R of [harp, pad, bell])
    for (const z of soundBakeAll(R, RATE)) {
      assert.ok(finite(z.data), `${R.kind} ${z.root}: NaN`);
      const p = peak(z.data);
      assert.ok(p <= 1 && p > 0.1, `${R.kind} ${z.root}: peak ${p}`);
      assert.equal(z.rate, RATE);
    }
  for (const d of soundBakeRun(soundBakeImpulse(RATE))) {
    assert.ok(finite(d));
    assert.ok(peak(d) <= 1);
  }
});

test('zones cover lo to hi with no gap, one every `every` semitones, the root inside each', () => {
  const Z = soundBakeRoots(harp);
  assert.equal(Z[0].lo, harp.lo);
  assert.equal(Z[Z.length - 1].hi, harp.hi);
  for (let i = 1; i < Z.length; i++) assert.equal(Z[i].lo, Z[i - 1].hi + 1);
  for (const z of Z) assert.ok(z.root >= z.lo && z.root <= z.hi);
});

test('loops are seamless: the sample after the end (loopStart) follows the end as it follows loopStart - 1', () => {
  for (const R of [harp, pad, bell])
    for (const z of soundBakeAll(R, RATE)) {
      const d = z.data,
        e = z.loopEnd - 1;
      assert.ok(z.loopStart > 0 && z.loopStart < z.loopEnd && z.loopEnd === d.length);
      /* the end matches what comes before the loop's start, so the jump into loopStart is the same step as there */
      const scale = peak(d.subarray(z.loopStart));
      assert.ok(Math.abs(d[e] - d[z.loopStart - 1]) <= 0.02 * scale, `${R.kind} ${z.root}: the seam jumps`);
      /* the loop's level is flat: its first and last quarters within 1.5 dB */
      const q = Math.floor((z.loopEnd - z.loopStart) / 4),
        rms = (a, b) => Math.sqrt(d.subarray(a, b).reduce((s, x) => s + x * x, 0) / (b - a));
      const ratio = rms(z.loopStart, z.loopStart + q) / rms(z.loopEnd - q, z.loopEnd);
      assert.ok(Math.abs(20 * Math.log10(ratio)) < 1.5, `${R.kind} ${z.root}: the loop's level moves ${ratio}`);
    }
});

test('soundBakeLoop makes a decaying tone seamless', () => {
  const n = 4800,
    d = new Float32Array(n);
  for (let i = 0; i < n; i++) d[i] = Math.sin(i * 0.1234) * Math.exp(-i / 2000);
  soundBakeLoop(d, 3000, 240);
  assert.ok(Math.abs(d[n - 1] - d[2999]) < 1e-6);
});

test('a Karplus-Strong string is in tune (the all-pass): within 3 cents from low to high', () => {
  for (const m of [43, 57, 69, 81, 93]) {
    const f = hzOf(m),
      d = soundBakeRun(
        soundBakeString(f, RATE, 9600, { t60: 4, bright: 6000, pick: 0.13, seed: 1 }, ambienceRandom(7))
      );
    /* the period from the autocorrelation's peak near the expected lag, refined by a parabola */
    const P = RATE / f,
      from = 4800,
      ac = lag => {
        let s = 0;
        for (let i = from; i < from + 2400; i++) s += d[i] * d[i + lag];
        return s;
      };
    let best = Math.round(P);
    for (let l = Math.floor(P) - 2; l <= Math.ceil(P) + 2; l++) if (ac(l) > ac(best)) best = l;
    const [a, b, c] = [ac(best - 1), ac(best), ac(best + 1)],
      lag = best + (0.5 * (a - c)) / (a - 2 * b + c),
      cents = 1200 * Math.log2(P / lag);
    assert.ok(Math.abs(cents) < 3, `midi ${m}: ${cents.toFixed(2)} cents`);
  }
});

test('the bake yields every SOUND_BAKE_CHUNK samples, so the page can slice it', () => {
  const it = soundBakeZoneSteps(harp, RATE, 0);
  let yields = 0,
    r = it.next();
  while (!r.done) ((yields += 1), (r = it.next()));
  assert.ok(yields >= Math.floor(r.value.data.length / SOUND_BAKE_CHUNK) - 1, `${yields} yields`);
});

test('size budget: the harp under 1.6 MB at 48 kHz, an impulse of at most 1.2 s', () => {
  const bytes = soundBakeAll(harp, RATE).reduce((a, z) => a + z.data.length * 4, 0);
  assert.ok(bytes < 1.6 * 1024 * 1024, `the harp is ${(bytes / 1048576).toFixed(2)} MB`);
  const I = soundBakeRun(soundBakeImpulse(RATE, { sec: 3 }));
  assert.equal(I.length, 2);
  assert.ok(I[0].length <= 1.2 * RATE);
});

test('the impulse decays: its last 100 ms at least 40 dB under its first', () => {
  const [L] = soundBakeRun(soundBakeImpulse(RATE)),
    rms = d => Math.sqrt(d.reduce((s, x) => s + x * x, 0) / d.length);
  const head = rms(L.subarray(0, 4800)),
    tail = rms(L.subarray(L.length - 4800));
  assert.ok(20 * Math.log10(tail / head) < -40);
  assert.equal(L[0], 0, 'the pre-delay is silent');
});

test('soundBakeZoneFor: a note plays from its own zone; a dropped zone falls back to the nearest', () => {
  const Z = soundBakeRoots(harp),
    i = Z.findIndex(z => z.lo <= 60 && z.hi >= 60),
    own = soundBakeZoneFor(Z, 60);
  assert.equal(own.zone, Z[i]);
  assert.ok(own.own);
  assert.ok(Math.abs(own.rate - Math.pow(2, (60 - Z[i].root) / 12)) < 1e-12);
  const holes = Z.map((z, k) => (k === i ? null : z)),
    near = soundBakeZoneFor(holes, 60);
  assert.ok(!near.own && near.zone !== Z[i]);
  assert.equal(soundBakeZoneFor([null, null], 60), null);
});

test('the oscillators are band-limited: a high saw has far less aliasing than a naive one', () => {
  /* a 5 kHz saw at 48 kHz: a naive saw's aliases land between the harmonics; count energy off the harmonic bins */
  const n = 4800,
    f = 5000,
    d = soundBakeOsc('saw', f, RATE, n),
    naive = new Float32Array(n);
  for (let i = 0; i < n; i++) naive[i] = 2 * (((i * f) / RATE) % 1) - 1;
  const offHarmonic = x => {
    let off = 0;
    for (let k = 1; k < n / 2; k++) {
      const hz = (k * RATE) / n;
      if (Math.abs(hz / f - Math.round(hz / f)) < 0.02) continue;
      let re = 0,
        im = 0;
      for (let i = 0; i < n; i += 1)
        ((re += x[i] * Math.cos((2 * Math.PI * k * i) / n)), (im -= x[i] * Math.sin((2 * Math.PI * k * i) / n)));
      off += re * re + im * im;
    }
    return off;
  };
  assert.ok(offHarmonic(d) < offHarmonic(naive) * 0.5);
  for (const w of ['sine', 'triangle', 'pulse']) {
    const o = soundBakeOsc(w, 440, RATE, 4800, 0.25);
    assert.ok(finite(o) && peak(o) <= 1.3, w);
  }
});

test('envelope, biquad and FM keep to their shapes', () => {
  const e = soundBakeEnvelope(new Float32Array(1000).fill(1), 1000, { a: 0.1, d: 0.1, s: 0.5 });
  assert.equal(e[0], 0);
  assert.ok(Math.abs(e[100] - 1) < 1e-6);
  assert.ok(Math.abs(e[999] - 0.5) < 1e-6);
  /* a low-pass at 500 Hz takes most of a 10 kHz tone out and leaves a 100 Hz one */
  const tone = hzv => soundBakeOsc('sine', hzv, RATE, 4800),
    level = d => Math.sqrt(d.subarray(2400).reduce((s, x) => s + x * x, 0) / 2400);
  assert.ok(level(soundBakeBiquad(tone(10000), RATE, 'lowpass', 500)) < 0.02);
  assert.ok(level(soundBakeBiquad(tone(100), RATE, 'lowpass', 500)) > 0.6);
  assert.ok(level(soundBakeBiquad(tone(100), RATE, 'highpass', 5000)) < 0.02);
  const fm = soundBakeFm(440, RATE, 4800, { ratio: 2.8, index: 6, indexEnd: 0.2 });
  assert.ok(finite(fm) && peak(fm) <= 1);
});

/* SND-10: water's banks (game/data/soundscape.json `banks` holds the game's) */
const drop = { kind: 'bubble', lo: 50, hi: 115, every: 6, xi: 0.12, level: 0.9 };
const babble = {
  kind: 'babble',
  lo: 60,
  hi: 60,
  every: 1,
  sec: 2,
  layers: [
    [2, 800, 0.2],
    [6, 600, 0.5],
    [12, 400, 0.8],
  ],
  level: 0.25,
  seed: 0xb0b1,
};
/** zero crossings a second over the first ms milliseconds */
const crossings = (d, rate, ms) => {
  let n = 0;
  const m = Math.floor((rate * ms) / 1000);
  for (let i = 1; i < m; i++) if (d[i - 1] < 0 !== d[i] < 0) n++;
  return n / 2 / (ms / 1000);
};

test('a bubble rings at its pitch, rises a little and dies away; smaller ones shorter', () => {
  const f0 = 1000,
    b = soundBakeRun(soundBakeBubble(f0, 0.12, RATE));
  /* the first 5 ms near f0 (the rise is small that early) */
  const hz = crossings(b, RATE, 5);
  assert.ok(Math.abs(hz - f0) < 0.12 * f0, `${hz} Hz`);
  assert.ok(b.every(Number.isFinite));
  assert.ok(Math.abs(b[0]) < 1e-6 && Math.abs(b[b.length - 1]) < 1e-3, 'no click at either end');
  const big = soundBakeRun(soundBakeBubble(220, 0.7, RATE)),
    small = soundBakeRun(soundBakeBubble(4000, 0.1, RATE));
  assert.ok(big.length > b.length && b.length > small.length, `${big.length} ${b.length} ${small.length}`);
  assert.ok(big.length <= Math.ceil(0.7 * RATE));
});

test('bubble zones: every pitch from lo to hi, played once (no loop), peaks at the level', () => {
  const Z = soundBakeAll(drop, RATE);
  assert.equal(Z.length, soundBakeRoots(drop).length);
  let bytes = 0;
  for (const z of Z) {
    assert.equal(z.loopStart, z.data.length);
    let p = 0;
    for (const v of z.data) p = Math.max(p, Math.abs(v));
    assert.ok(Math.abs(p - drop.level) < 1e-6, `peak ${p}`);
    bytes += z.data.length * 4;
  }
  assert.ok(bytes < 400 * 1024, `${Math.round(bytes / 1024)} KB`);
});

test('the babble loops with no seam, at its RMS, the same every time', () => {
  const [z] = soundBakeAll(babble, RATE),
    d = z.data;
  assert.equal(d.length, babble.sec * RATE);
  assert.ok(d.every(Number.isFinite));
  let s = 0;
  for (const v of d) s += v * v;
  assert.ok(Math.abs(Math.sqrt(s / d.length) - babble.level) < 1e-4);
  /* the jump from the end back to the start is no bigger than the signal's own steps */
  let step = 0;
  for (let i = 1; i < d.length; i++) step = Math.max(step, Math.abs(d[i] - d[i - 1]));
  assert.ok(Math.abs(d[0] - d[d.length - 1]) <= step, `${Math.abs(d[0] - d[d.length - 1])} against ${step}`);
  assert.deepEqual(soundBakeAll(babble, RATE)[0].data, d);
  /* it yields while it works, so the page can slice it */
  const it = soundBakeBabble(RATE, babble);
  let yields = 0;
  while (!it.next().done) yields++;
  assert.ok(yields > 50, `${yields} yields`);
});
