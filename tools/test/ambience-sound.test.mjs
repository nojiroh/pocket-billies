// Sound track SND-8a: the world's beds made gentle and cheap (game/js/logic/ambience-sound.js): their own noise,
// random drift, starting and stopping, crickets, crackles and birds as events, varied footsteps, water in buckets, and
// the preview the Sound Test and the loudness report share.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  AMBIENCE_FIXED,
  AMBIENCE_NOISE_RMS,
  AMBIENCE_SOFT_GROUND,
  AMBIENCE_SOURCES,
  ambienceBirdWait,
  ambienceBuckets,
  ambienceChirp,
  ambienceCrackles,
  ambienceCrickets,
  ambienceDrift,
  ambienceLiveStep,
  ambienceNearest,
  ambienceNoise,
  ambienceNoiseLoop,
  ambiencePlace,
  ambiencePreview,
  ambienceRandom,
  ambienceStep,
} from '../../game/js/logic/ambience-sound.js';
/* SND-10: the beds' recipes are data (game/data/soundscape.json `beds`) */
const AMBIENCE_BEDS = JSON.parse(
  readFileSync(new URL('../../game/data/soundscape.json', import.meta.url), 'utf8')
).beds;

const rms = d => Math.sqrt(d.reduce((a, v) => a + v * v, 0) / d.length);
/* the energy of a signal's sample-to-sample differences against its own: high for white, low for brown */
const roughness = d => {
  let a = 0;
  for (let i = 1; i < d.length; i++) a += (d[i] - d[i - 1]) ** 2;
  return a / d.length / (rms(d) ** 2 || 1);
};

test('the same seed makes the same numbers, another seed others', () => {
  const a = ambienceRandom(7),
    b = ambienceRandom(7),
    c = ambienceRandom(8);
  const A = [a(), a(), a()];
  assert.deepEqual(A, [b(), b(), b()]);
  assert.notDeepEqual(A, [c(), c(), c()]);
  assert.ok(A.every(v => v >= 0 && v < 1));
});

test('pink is smoother than white and brown smoother than pink', () => {
  const n = 48000,
    w = roughness(ambienceNoise('white', n, ambienceRandom(1))),
    p = roughness(ambienceNoise('pink', n, ambienceRandom(1))),
    b = roughness(ambienceNoise('brown', n, ambienceRandom(1)));
  assert.ok(w > p * 1.5 && p > b * 5, `white ${w}, pink ${p}, brown ${b}`);
});

test('a noise loop: its length, its loudness, no NaN, the same every time, and no click where it starts again', () => {
  for (const kind of ['pink', 'brown']) {
    const d = ambienceNoiseLoop(kind, 8000, 3, 11);
    assert.equal(d.length, 24000);
    assert.ok(Math.abs(rms(d) - AMBIENCE_NOISE_RMS) < 1e-3, `${kind} rms ${rms(d)}`);
    assert.ok(d.every(Number.isFinite));
    assert.deepEqual(d, ambienceNoiseLoop(kind, 8000, 3, 11));
    /* the jump from the last sample to the first is no bigger than the loop's own steps */
    const steps = [];
    for (let i = 1; i < d.length; i++) steps.push(Math.abs(d[i] - d[i - 1]));
    steps.sort((x, y) => x - y);
    assert.ok(
      Math.abs(d[0] - d[d.length - 1]) <= steps[Math.floor(steps.length * 0.999)],
      `${kind} seam ${Math.abs(d[0] - d[d.length - 1])}`
    );
  }
});

test('drift wanders around its base within its depth, a new value within its times', () => {
  const r = ambienceRandom(3);
  for (let i = 0; i < 200; i++) {
    const g = ambienceDrift({ on: 'gain', base: 0.8, depth: 0.5, min: 2, max: 6, tau: 1 }, r),
      f = ambienceDrift({ on: 0, base: 1000, depth: 0.5, min: 0.1, max: 0.4, tau: 0.1, oct: true }, r);
    assert.ok(g.value >= 0.4 - 1e-9 && g.value <= 1.2 + 1e-9 && g.wait >= 2 && g.wait <= 6);
    assert.ok(
      f.value >= 1000 / Math.SQRT2 - 1e-6 && f.value <= 1000 * Math.SQRT2 + 1e-6 && f.wait >= 0.1 && f.wait <= 0.4
    );
  }
  /* never a negative gain, however deep */
  assert.ok(ambienceDrift({ on: 'gain', base: 1, depth: 3, min: 1, max: 1, tau: 1 }, () => 0).value >= 0);
});

test('every bed recipe is sound: a known bus, layers of pink or brown with filters, drifts on what exists', () => {
  const types = ['lowpass', 'highpass', 'bandpass', 'highshelf'];
  /* SND-10: the five water beds went to soundscape.json `water`; SND-14 adds the heavy rain, the rain on roofs and two
     room tones */
  assert.equal(Object.keys(AMBIENCE_BEDS).length, 13);
  for (const [k, B] of Object.entries(AMBIENCE_BEDS)) {
    assert.ok(['world', 'amb'].includes(B.bus), k);
    assert.ok(B.trim > 0 && B.trim <= 4, `${k} trim ${B.trim}`);
    assert.ok(B.layers.length || B.events, `${k} makes no sound`);
    for (const L of B.layers) {
      assert.ok(['pink', 'brown'].includes(L.noise), `${k}: ${L.noise} (no white noise in a bed)`);
      assert.ok(
        L.filters.every(([t, f]) => types.includes(t) && f > 20 && f < 16000),
        k
      );
      for (const D of L.drift || []) {
        assert.ok(D.on === 'gain' || (D.on >= 0 && D.on < L.filters.length), `${k}: drift on ${D.on}`);
        assert.ok(D.min > 0 && D.max >= D.min && D.tau > 0, k);
      }
    }
  }
});

test('a bed starts when wanted and stops only after 2.5 s wanted at nothing', () => {
  const st = {};
  assert.equal(ambienceLiveStep(st, 0, 0), null);
  assert.equal(ambienceLiveStep(st, 0.3, 1), 'start');
  assert.equal(ambienceLiveStep(st, 0.3, 1.2), null);
  assert.equal(ambienceLiveStep(st, 0, 2), null);
  assert.equal(ambienceLiveStep(st, 0, 4.4), null);
  assert.equal(ambienceLiveStep(st, 0.1, 4.45), null, 'wanted again before it stopped: it plays on');
  assert.equal(ambienceLiveStep(st, 0, 5), null);
  assert.equal(ambienceLiveStep(st, 0, 7.5), 'stop');
  assert.equal(st.live, false);
  assert.equal(ambienceLiveStep(st, 0, 9), null);
});

test('crickets chirp in groups with rests, each chirp once, never before t0', () => {
  const r = ambienceRandom(5),
    st = [
      { next: 0, left: 0 },
      { next: 1.3, left: 0 },
    ];
  let all = [];
  for (let t = 0; t < 60; t += 0.2) all = all.concat(ambienceCrickets(st, t, t + 0.3, r));
  for (const who of [0, 1]) {
    const T = all.filter(c => c.who === who).map(c => c.t);
    assert.equal(new Set(T).size, T.length, 'a chirp twice');
    const gaps = T.slice(1).map((t, i) => t - T[i]);
    assert.ok(
      gaps.every(g => g >= 0.55 - 1e-9),
      'chirps too close'
    );
    assert.ok(
      gaps.some(g => g >= 2),
      'no rest between groups'
    );
    assert.ok(T.length > 30 && T.length < 90, `${T.length} chirps in a minute`);
  }
  assert.ok(all.every(c => c.gain >= 0.8 && c.gain <= 1));
});

test('a chirp is short, quiet at its ends and peaks near 1', () => {
  const d = ambienceChirp(44100, 3600, 1);
  assert.equal(d.length, Math.floor(0.09 * 44100));
  assert.ok(Math.abs(d[0]) < 1e-3 && Math.abs(d[d.length - 1]) < 1e-3);
  const peak = Math.max(...d.map(Math.abs));
  assert.ok(peak > 0.9 && peak <= 1, `peak ${peak}`);
});

test('a fire crackles about 3.5 times a second, in clusters, mostly quietly', () => {
  const r = ambienceRandom(9),
    st = { next: 0 };
  let all = [];
  for (let t = 0; t < 100; t += 0.2) all = all.concat(ambienceCrackles(st, t, t + 0.2, r));
  const clusters = new Set(all.map(c => c.pan + ':' + Math.floor(c.t * 4))).size;
  assert.ok(all.length > 400 && all.length < 1000, `${all.length} snaps in 100 s`);
  assert.ok(clusters > 200, `${clusters} clusters`);
  const quiet = all.filter(c => c.gain < 0.5).length / all.length;
  assert.ok(quiet > 0.5, `only ${quiet} quiet`);
  assert.ok(all.every(c => c.f >= 1300 && c.f <= 4500 && c.d > 0 && c.d < 0.02));
});

test('one bird in about ten seconds outside a town, rarer in one', () => {
  const r = ambienceRandom(2),
    out = Array.from({ length: 500 }, () => ambienceBirdWait(r, false)),
    town = Array.from({ length: 500 }, () => ambienceBirdWait(r, true)),
    mean = L => L.reduce((a, b) => a + b, 0) / L.length;
  assert.ok(Math.min(...out) >= 6 && mean(out) > 9 && mean(out) < 11);
  assert.ok(Math.min(...town) >= 14 && mean(town) > mean(out) * 1.8);
});

test('footsteps: soft on the natural grounds, hollow on boards, a click on stone; never twice the same', () => {
  for (const g of ['g', 'l', 'y', 's', 'u', 'D', 'R']) assert.ok(AMBIENCE_SOFT_GROUND.includes(g), g);
  for (const g of ['e', 'c', 'a', 'K', 'b', 'w']) assert.ok(!AMBIENCE_SOFT_GROUND.includes(g), g);
  const r = ambienceRandom(4),
    lawn = [0, 1, 2, 3].map(i => ambienceStep('l', r, i % 2)),
    stone = ambienceStep('e', r, 0);
  assert.ok(
    lawn.every(s => s.hits[0].lp && s.hits[0].lp < 450),
    'the lawn takes the soft thump'
  );
  assert.ok(stone.hits[0].bp === undefined || stone.hits[0].bp > 1900, 'stone clicks');
  assert.equal(new Set(lawn.map(s => s.hits[0].lp)).size, 4, 'four steps, four pitches');
  assert.deepEqual(
    lawn.map(s => s.pan),
    [-0.08, 0.08, -0.08, 0.08]
  );
  for (const s of lawn) for (const h of s.hits) assert.ok(h.vol > 0 && h.vol < 0.3);
  assert.ok(ambienceStep('b', r, 0).hits[0].bp < 600);
  assert.equal(ambienceStep('n', r, 0).hits.length, 2);
  assert.equal(ambienceStep('wet', r, 0).hits.length, 2);
});

test('water in buckets finds the same nearest cell as a scan of every cell', () => {
  const r = ambienceRandom(12),
    cells = Array.from({ length: 3000 }, () => [r() * 200 - 50, r() * 160 - 30]),
    B = ambienceBuckets(cells);
  for (let i = 0; i < 300; i++) {
    const x = r() * 220 - 60,
      z = r() * 180 - 40,
      range = [6, 8, 10][i % 3];
    let best = null;
    for (const c of cells) {
      const d = Math.hypot(c[0] - x, c[1] - z);
      if (d <= range && (!best || d < best.d)) best = { cell: c, d };
    }
    const got = ambienceNearest(B, x, z, range);
    assert.equal(got ? got.d : null, best ? best.d : null);
  }
  assert.equal(ambienceNearest(ambienceBuckets([]), 0, 0, 10), null);
});

test('the preview sets the beds as the game would: by distance for a source, the place gain for the rest', () => {
  assert.equal(ambiencePlace(0, 10), 1);
  assert.equal(ambiencePlace(11, 10), 0);
  /* SND-10: the water is logic/soundscape.js's (soundscapePreview): a water id here is left out */
  const T = ambiencePreview([
    ['fire', 3],
    ['sea_coast', 0],
    ['brook', 3],
    ['rain', 0],
    ['birds', 0],
  ]);
  assert.equal(T.fire, Math.pow(1 - 3 / 7, 1.6) * AMBIENCE_SOURCES.fire.gain);
  assert.equal(T.sea, AMBIENCE_FIXED.sea_coast.gain);
  assert.equal(T.rain, AMBIENCE_FIXED.rain.gain);
  assert.deepEqual(Object.keys(T).sort(), ['fire', 'rain', 'sea']);
  for (const k of [...Object.keys(AMBIENCE_SOURCES), ...Object.values(AMBIENCE_FIXED).map(f => f.bed)])
    assert.ok(AMBIENCE_BEDS[k], k);
});
