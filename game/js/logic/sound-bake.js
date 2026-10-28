// @ts-check
'use strict';
/* ================= SOUND BAKE (sound track SND-9) =================
   Instruments made of numbers, the way a DS sound bank holds sampled notes, except that we compute ours (synth only:
   no sound files). Each instrument is a recipe; baking it renders a few notes (zones, one every few semitones) into
   arrays the tracker turns into AudioBuffers once, so a note then costs one buffer source and one gain. Also the
   reverb's stereo impulse. The pieces:
   - band-limited oscillators (sine, triangle, saw, pulse: PolyBLEP, so high notes don't alias), envelopes, an RBJ
     biquad, two-operator FM;
   - Karplus-Strong plucked strings tuned with an all-pass (a plain delay line can only be a whole number of samples
     long, so the pitch would be off by up to half a sample: tens of cents on a high note);
   - loop points: a sustained zone (or a pluck's tail) loops a whole number of periods, its level flattened and its end
     crossfaded into what comes before the loop's start, so the seam is silent;
   - noise from the beds' own seeded generator (logic/ambience-sound.js ambienceRandom, ambienceNoise): never
     Math.random, so a bake is the same every time and nothing the song fingerprints read moves.
   Every bake is a generator that yields every SOUND_BAKE_CHUNK samples, so the tracker can spread it over setTimeout
   slices of at most 4 ms (game/js/audio/tracker.js, the bank). Logic only: plays nothing; runs in Node
   (tools/test/sound-bake.test.mjs). SND-11 moves the recipes to music.json `instruments`. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { ambienceNoise, ambienceRandom } from './ambience-sound.js';
/* eslint-disable no-func-assign */
expose({
  SOUND_BAKE_CHUNK: [() => SOUND_BAKE_CHUNK],
  SOUND_BAKE_INSTRUMENTS: [() => SOUND_BAKE_INSTRUMENTS],
  // @ts-expect-error -- replaced on purpose
  soundBakeAll: [() => soundBakeAll, v => (soundBakeAll = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeBiquad: [() => soundBakeBiquad, v => (soundBakeBiquad = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeBiquadSteps: [() => soundBakeBiquadSteps, v => (soundBakeBiquadSteps = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeBlep: [() => soundBakeBlep, v => (soundBakeBlep = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeEnvelope: [() => soundBakeEnvelope, v => (soundBakeEnvelope = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeFm: [() => soundBakeFm, v => (soundBakeFm = v)],
  soundBakeHz: [() => soundBakeHz],
  // @ts-expect-error -- replaced on purpose
  soundBakeImpulse: [() => soundBakeImpulse, v => (soundBakeImpulse = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeLoop: [() => soundBakeLoop, v => (soundBakeLoop = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeOsc: [() => soundBakeOsc, v => (soundBakeOsc = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakePeak: [() => soundBakePeak, v => (soundBakePeak = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeRoots: [() => soundBakeRoots, v => (soundBakeRoots = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeRun: [() => soundBakeRun, v => (soundBakeRun = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeString: [() => soundBakeString, v => (soundBakeString = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeZoneFor: [() => soundBakeZoneFor, v => (soundBakeZoneFor = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeZoneSteps: [() => soundBakeZoneSteps, v => (soundBakeZoneSteps = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** samples rendered between two yields of a bake (well under a millisecond of work on a phone) */
export const SOUND_BAKE_CHUNK = 1024;

/**
 * @typedef {{kind: 'pluck', lo: number, hi: number, every: number, sec: number, minSec: number, maxSec: number,
 *   t60: number, bright: number, pick: number, tone: number, level: number, seed: number}} SoundBakePluck
 *   a Karplus-Strong string: zones from midi lo to hi, one every `every` semitones; each sec seconds long at middle C
 *   (shorter higher up, an octave halving it twice over), within minSec-maxSec; t60 the seconds it takes to fall 60 dB
 *   at middle C; bright the excitation's low-pass (Hz), pick the plucking point (a share of the string), tone the
 *   output's low-pass (Hz), level the zone's peak
 * @typedef {{kind: 'fm', lo: number, hi: number, every: number, sec: number, ratio: number, index: number,
 *   indexEnd: number, t60: number, level: number}} SoundBakeFm
 *   a two-operator FM tone (a bell at 1:2.8, a tine at 1:14): the index falls from index to indexEnd over the zone
 * @typedef {{kind: 'osc', lo: number, hi: number, every: number, wave: SoundBakeWave, duty?: number, a: number, d: number,
 *   s: number, hold: number, cut: number, level: number}} SoundBakeOsc
 *   an oscillator through an attack and decay into a sustain that loops (a pad or an organ), low-passed at cut
 * @typedef {SoundBakePluck | SoundBakeFm | SoundBakeOsc} SoundBakeRecipe
 * @typedef {'sine' | 'triangle' | 'saw' | 'pulse'} SoundBakeWave
 * @typedef {{root: number, lo: number, hi: number, rate: number, data: Float32Array, loopStart: number,
 *   loopEnd: number, tau: number}} SoundBakeZone
 *   one baked note: played from root's pitch for the notes lo-hi; it loops loopStart-loopEnd (samples) for as long as
 *   the note holds; tau (s) is how fast a voice keeps fading once the loop starts (0: a sustained sound that holds)
 */

/**
 * the instruments (SND-9: the proof instrument only; SND-11 adds the rest from music.json `instruments`)
 * @type {Record<string, SoundBakeRecipe>}
 */
export const SOUND_BAKE_INSTRUMENTS = {
  /* Copperleaf's harp: a soft, warm pluck (Chip+ meets DS, docs/phases/sound-track.md "The design" 2) */
  harp: {
    kind: 'pluck',
    lo: 43,
    hi: 98,
    every: 6,
    sec: 0.9,
    minSec: 0.35,
    maxSec: 1.2,
    t60: 3.2,
    bright: 3200,
    pick: 0.18,
    tone: 5200,
    level: 0.8,
    seed: 0x4a72,
  },
};

/**
 * the zones' roots and ranges for a recipe: one every `every` semitones from lo, the last reaching hi
 * @param {{lo: number, hi: number, every: number}} R
 * @returns {{root: number, lo: number, hi: number}[]}
 */
export function soundBakeRoots(R) {
  const out = [],
    half = Math.floor(R.every / 2);
  for (let lo = R.lo; lo <= R.hi; lo += R.every) {
    const hi = Math.min(R.hi, lo + R.every - 1);
    out.push({ root: Math.min(hi, lo + half), lo, hi });
  }
  return out;
}

/** @param {number} m midi @returns {number} Hz */
export const soundBakeHz = m => 440 * Math.pow(2, (m - 69) / 12);

/**
 * PolyBLEP: the correction that smooths a jump of a naive wave over the sample either side of it
 * @param {number} t the phase (0-1) @param {number} dt the phase step
 */
export function soundBakeBlep(t, dt) {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

/**
 * n samples of a band-limited oscillator at freq (sine, triangle, saw or a pulse of the given duty)
 * @param {SoundBakeWave} wave
 * @param {number} freq Hz
 * @param {number} rate
 * @param {number} n
 * @param {number} [duty] a pulse's share up (0.5 a square)
 * @returns {Float32Array}
 */
export function soundBakeOsc(wave, freq, rate, n, duty = 0.5) {
  const out = new Float32Array(n),
    dt = freq / rate;
  let ph = 0,
    /* a triangle's integrator starts at its trough, so it swings -1 to 1 from the first period */
    tri = -1;
  for (let i = 0; i < n; i++) {
    let v;
    if (wave === 'sine') v = Math.sin(2 * Math.PI * ph);
    else if (wave === 'saw') v = 2 * ph - 1 - soundBakeBlep(ph, dt);
    else {
      /* a pulse: two edges, each smoothed; a triangle is a square integrated (leaky, so it never drifts) */
      const w = wave === 'triangle' ? 0.5 : duty;
      v = (ph < w ? 1 : -1) + soundBakeBlep(ph, dt) - soundBakeBlep((ph - w + 1) % 1, dt);
      if (wave === 'triangle') {
        tri = 0.999 * tri + 4 * dt * v;
        v = tri;
      }
    }
    out[i] = v;
    ph += dt;
    if (ph >= 1) ph -= 1;
  }
  return out;
}

/**
 * an attack-decay-sustain envelope multiplied into data in place (the voice does the release)
 * @param {Float32Array} data
 * @param {number} rate
 * @param {{a: number, d: number, s: number}} E seconds, seconds, the sustain's level
 * @returns {Float32Array} data
 */
export function soundBakeEnvelope(data, rate, E) {
  const A = Math.max(1, Math.round(E.a * rate)),
    D = Math.max(1, Math.round(E.d * rate));
  for (let i = 0; i < data.length; i++) {
    const g = i < A ? i / A : i < A + D ? 1 - (1 - E.s) * ((i - A) / D) : E.s;
    data[i] *= g;
  }
  return data;
}

/**
 * an RBJ cookbook biquad (low-pass, high-pass or band-pass), run over data in place
 * @param {Float32Array} data
 * @param {number} rate
 * @param {'lowpass' | 'highpass' | 'bandpass'} type
 * @param {number} freq Hz
 * @param {number} [q]
 * @returns {Float32Array} data
 */
export function soundBakeBiquad(data, rate, type, freq, q = Math.SQRT1_2) {
  return soundBakeRun(soundBakeBiquadSteps(data, rate, type, freq, q));
}

/**
 * soundBakeBiquad as a bake's steps: yields every SOUND_BAKE_CHUNK samples
 * @param {Float32Array} data
 * @param {number} rate
 * @param {'lowpass' | 'highpass' | 'bandpass'} type
 * @param {number} freq
 * @param {number} [q]
 * @returns {Generator<number, Float32Array, void>}
 */
export function* soundBakeBiquadSteps(data, rate, type, freq, q = Math.SQRT1_2) {
  const w = (2 * Math.PI * Math.min(freq, rate * 0.49)) / rate,
    cw = Math.cos(w),
    al = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === 'lowpass') ((b0 = (1 - cw) / 2), (b1 = 1 - cw), (b2 = (1 - cw) / 2));
  else if (type === 'highpass') ((b0 = (1 + cw) / 2), (b1 = -(1 + cw)), (b2 = (1 + cw) / 2));
  else ((b0 = al), (b1 = 0), (b2 = -al));
  const a0 = 1 + al,
    a1 = -2 * cw,
    a2 = 1 - al;
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  for (let i = 0; i < data.length; i++) {
    const x = data[i],
      y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    data[i] = y;
    if (i % SOUND_BAKE_CHUNK === SOUND_BAKE_CHUNK - 1) yield i;
  }
  return data;
}

/**
 * n samples of two-operator FM: a sine carrier at freq whose phase a sine at freq·ratio moves by an index that falls
 * from index to indexEnd (exponentially, over the n samples)
 * @param {number} freq
 * @param {number} rate
 * @param {number} n
 * @param {{ratio: number, index: number, indexEnd: number}} F
 * @returns {Float32Array}
 */
export function soundBakeFm(freq, rate, n, F) {
  const out = new Float32Array(n),
    k = Math.log(Math.max(1e-3, F.indexEnd) / Math.max(1e-3, F.index)) / Math.max(1, n);
  for (let i = 0; i < n; i++) {
    const t = i / rate,
      I = F.index * Math.exp(k * i);
    out[i] = Math.sin(2 * Math.PI * freq * t + I * Math.sin(2 * Math.PI * freq * F.ratio * t));
  }
  return out;
}

/**
 * a Karplus-Strong string, n samples at freq: a burst of seeded noise (low-passed at bright, combed at the pick
 * point) circulates through a delay line, a two-point average (the string's loss, half a sample of delay) and a
 * first-order all-pass that makes up the fraction of a sample the line can't. A generator: yields every
 * SOUND_BAKE_CHUNK samples and returns the samples
 * @param {number} freq
 * @param {number} rate
 * @param {number} n
 * @param {{t60: number, bright: number, pick: number, seed: number}} P
 * @param {() => number} rnd seeded, 0-1
 * @returns {Generator<number, Float32Array, void>}
 */
export function* soundBakeString(freq, rate, n, P, rnd) {
  const period = rate / freq;
  /* the loop's delay is N + 0.5 (the average) + the all-pass's delay, kept in 0.1-1.1 samples so it stays stable */
  let N = Math.floor(period - 0.5),
    frac = period - 0.5 - N;
  if (frac < 0.1) ((N -= 1), (frac += 1));
  const C = (1 - frac) / (1 + frac),
    /* the loss per trip round the loop, so the string falls 60 dB in t60 seconds */
    rho = Math.pow(10, -3 / (P.t60 * freq)),
    line = new Float32Array(N),
    out = new Float32Array(n);
  /* the burst: white noise, low-passed one pole at bright, combed at the pick point, its DC taken out */
  const a = Math.exp((-2 * Math.PI * P.bright) / rate),
    burst = new Float32Array(N);
  let lp = 0,
    mean = 0;
  for (let i = 0; i < N; i++) {
    lp = (1 - a) * (rnd() * 2 - 1) + a * lp;
    burst[i] = lp;
  }
  const pk = Math.max(1, Math.round(P.pick * N));
  for (let i = 0; i < N; i++) {
    line[i] = burst[i] - (i >= pk ? burst[i - pk] : 0);
    mean += line[i];
  }
  mean /= N;
  for (let i = 0; i < N; i++) line[i] -= mean;
  let idx = 0,
    prev = 0,
    x1 = 0,
    y1 = 0;
  for (let i = 0; i < n; i++) {
    const x = line[idx],
      loss = rho * 0.5 * (x + prev),
      y = C * loss + x1 - C * y1;
    prev = x;
    x1 = loss;
    y1 = y;
    line[idx] = y;
    out[i] = x;
    if (++idx >= N) idx = 0;
    if (i % SOUND_BAKE_CHUNK === SOUND_BAKE_CHUNK - 1) yield i;
  }
  return out;
}

/**
 * makes data loop seamlessly from loopStart to its end: the loop's level flattened (a decaying tail would jump back
 * up at every turn), then its last `fade` samples crossfaded into the ones before loopStart, so the sample after the
 * end (loopStart) follows the end as it follows loopStart - 1
 * @param {Float32Array} data
 * @param {number} loopStart
 * @param {number} fade samples, at most loopStart and the loop's length
 * @returns {Float32Array} data
 */
export function soundBakeLoop(data, loopStart, fade) {
  const n = data.length,
    L = n - loopStart,
    q = Math.max(1, Math.floor(L / 4)),
    rms = (/** @type {number} */ a, /** @type {number} */ b) => {
      let s = 0;
      for (let i = a; i < b; i++) s += data[i] * data[i];
      return Math.sqrt(s / Math.max(1, b - a)) || 1e-9;
    };
  /* the level at the loop's start against its end, flattened by an exponential ramp over the loop */
  const k = Math.log(rms(loopStart, loopStart + q) / rms(n - q, n)) / Math.max(1, L - q);
  for (let i = loopStart; i < n; i++) data[i] *= Math.exp(k * (i - loopStart));
  const F = Math.max(1, Math.min(fade, loopStart, L));
  for (let i = 0; i < F; i++) {
    const w = (i + 1) / F,
      j = n - F + i;
    data[j] = data[j] * (1 - w) + data[loopStart - F + i] * w;
  }
  return data;
}

/**
 * scales d so its peak is `peak`, in a bake's steps
 * @param {Float32Array} d
 * @param {number} peak
 * @returns {Generator<number, Float32Array, void>}
 */
export function* soundBakePeak(d, peak) {
  let m = 0;
  for (let i = 0; i < d.length; i++) {
    m = Math.max(m, Math.abs(d[i]));
    if (i % (SOUND_BAKE_CHUNK * 4) === SOUND_BAKE_CHUNK * 4 - 1) yield i;
  }
  if (m > 0)
    for (let i = 0; i < d.length; i++) {
      d[i] *= peak / m;
      if (i % (SOUND_BAKE_CHUNK * 4) === SOUND_BAKE_CHUNK * 4 - 1) yield i;
    }
  return d;
}

/**
 * one zone of an instrument, baked: a generator that yields while it works and returns the zone
 * @param {SoundBakeRecipe} R
 * @param {number} rate the context's own sample rate (WebKit has distorted buffers at another rate)
 * @param {number} z which zone (soundBakeRoots' order)
 * @returns {Generator<number, SoundBakeZone, void>}
 */
export function* soundBakeZoneSteps(R, rate, z) {
  const { root, lo, hi } = soundBakeRoots(R)[z],
    f = soundBakeHz(root),
    period = rate / f;
  /* a loop of a whole number of periods, about 40 ms (a pluck's tail) or 120 ms (a sustain) */
  const loopOf = (/** @type {number} */ sec) => Math.max(1, Math.round(sec * f)) * period;
  let data, loopStart, tau;
  if (R.kind === 'pluck') {
    const sec = Math.min(R.maxSec, Math.max(R.minSec, R.sec * Math.pow(2, -(root - 60) / 24))),
      n = Math.round(sec * rate),
      /* higher strings ring shorter, as a harp's do */
      t60 = R.t60 * Math.pow(2, -(root - 60) / 30);
    data = yield* soundBakeString(
      f,
      rate,
      n,
      { t60, bright: R.bright, pick: R.pick, seed: R.seed },
      ambienceRandom(R.seed + z)
    );
    yield* soundBakeBiquadSteps(data, rate, 'lowpass', R.tone, 0.6);
    /* a 1.5 ms ramp in: the burst's first sample is never a click */
    const A = Math.round(rate * 0.0015);
    for (let i = 0; i < A; i++) data[i] *= i / A;
    loopStart = n - Math.round(loopOf(0.04));
    tau = t60 / 6.9;
  } else if (R.kind === 'fm') {
    /* fm and osc zones render in one step (no instrument uses them yet: SND-11 slices them like the string when one
       does) */
    const n = Math.round(R.sec * rate);
    data = soundBakeFm(f, rate, n, R);
    const k = -6.9 / (R.t60 * rate);
    for (let i = 0; i < n; i++) data[i] *= Math.exp(k * i) * Math.min(1, i / (rate * 0.002));
    loopStart = n - Math.round(loopOf(0.04));
    tau = R.t60 / 6.9;
    yield 0;
  } else {
    const head = R.a + R.d,
      L = Math.round(loopOf(R.hold)),
      n = Math.round(head * rate) + L + Math.round(rate * 0.02);
    data = soundBakeOsc(R.wave, f, rate, n, R.duty);
    if (R.cut) soundBakeBiquad(data, rate, 'lowpass', R.cut);
    soundBakeEnvelope(data, rate, R);
    loopStart = n - L;
    tau = 0;
    yield 0;
  }
  yield* soundBakePeak(data, R.level);
  soundBakeLoop(data, loopStart, Math.min(Math.round(rate * 0.01), Math.floor((data.length - loopStart) / 2)));
  return { root, lo, hi, rate, data, loopStart, loopEnd: data.length, tau };
}

/**
 * a whole instrument baked at once (Node and the tests; the page bakes zone by zone in slices)
 * @param {SoundBakeRecipe} R
 * @param {number} rate
 * @returns {SoundBakeZone[]}
 */
export function soundBakeAll(R, rate) {
  return soundBakeRoots(R).map((_, z) => soundBakeRun(soundBakeZoneSteps(R, rate, z)));
}

/**
 * the zone a note plays from: its own, or the nearest baked one (a zone the bank dropped is null), and the playback
 * rate that moves the zone's root to the note
 * @template {{root: number, lo: number, hi: number}} Z
 * @param {(Z | null)[]} zones
 * @param {number} midi
 * @returns {{zone: Z, rate: number, own: boolean} | null}
 */
export function soundBakeZoneFor(zones, midi) {
  /** @type {Z | null} */
  let best = null,
    gap = Infinity,
    own = false;
  for (const z of zones) {
    if (!z) continue;
    const inside = midi >= z.lo && midi <= z.hi,
      g = inside ? -1 : Math.abs(midi - z.root);
    if (g < gap) ((best = z), (gap = g), (own = inside));
  }
  return best ? { zone: best, rate: Math.pow(2, (midi - best.root) / 12), own } : null;
}

/**
 * the reverb's impulse: stereo decaying noise (each side its own seed), sec long at most 1.2 s, falling 60 dB in t60,
 * darker as it fades (a low-pass closing from bright to dark Hz), after a short gap (pre, s) and a 4 ms ramp in;
 * the last 50 ms fade to nothing. A generator like the zones'
 * @param {number} rate
 * @param {{sec?: number, t60?: number, pre?: number, bright?: number, dark?: number, seed?: number}} [o]
 * @returns {Generator<number, Float32Array[], void>}
 */
export function* soundBakeImpulse(rate, o = {}) {
  const sec = Math.min(1.2, o.sec ?? 1.2),
    t60 = o.t60 ?? 1.1,
    pre = Math.round((o.pre ?? 0.012) * rate),
    n = Math.round(sec * rate),
    ramp = Math.round(rate * 0.004),
    tail = Math.round(rate * 0.05),
    bright = o.bright ?? 7000,
    dark = o.dark ?? 1500,
    seed = o.seed ?? 0x1e5b,
    out = [];
  for (let ch = 0; ch < 2; ch++) {
    const d = ambienceNoise('white', n, ambienceRandom(seed + ch));
    let lp = 0;
    for (let i = 0; i < n; i++) {
      if (i < pre) {
        d[i] = 0;
        continue;
      }
      const t = (i - pre) / rate,
        f = dark + (bright - dark) * Math.exp(-t / (t60 / 3)),
        a = Math.exp((-2 * Math.PI * f) / rate);
      lp = (1 - a) * d[i] + a * lp;
      const env = Math.exp((-6.9 * t) / t60) * Math.min(1, (i - pre) / ramp) * Math.min(1, (n - i) / tail);
      d[i] = lp * env;
      if (i % SOUND_BAKE_CHUNK === 0) yield i;
    }
    yield* soundBakePeak(d, 0.9);
    out.push(d);
  }
  return out;
}

/**
 * runs a bake generator to its end (Node, the tests, a bake that needn't be sliced)
 * @template T
 * @param {Generator<number, T, void>} it
 * @returns {T}
 */
export function soundBakeRun(it) {
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}
