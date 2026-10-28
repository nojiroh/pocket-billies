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
  soundBakeAds: [() => soundBakeAds, v => (soundBakeAds = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeAll: [() => soundBakeAll, v => (soundBakeAll = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeBabble: [() => soundBakeBabble, v => (soundBakeBabble = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeBiquad: [() => soundBakeBiquad, v => (soundBakeBiquad = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeBiquadSteps: [() => soundBakeBiquadSteps, v => (soundBakeBiquadSteps = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeBlep: [() => soundBakeBlep, v => (soundBakeBlep = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeBubble: [() => soundBakeBubble, v => (soundBakeBubble = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeEnvelope: [() => soundBakeEnvelope, v => (soundBakeEnvelope = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeFm: [() => soundBakeFm, v => (soundBakeFm = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeFmSteps: [() => soundBakeFmSteps, v => (soundBakeFmSteps = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeHitSteps: [() => soundBakeHitSteps, v => (soundBakeHitSteps = v)],
  soundBakeHz: [() => soundBakeHz],
  // @ts-expect-error -- replaced on purpose
  soundBakeImpulse: [() => soundBakeImpulse, v => (soundBakeImpulse = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeLoop: [() => soundBakeLoop, v => (soundBakeLoop = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeLoopSteps: [() => soundBakeLoopSteps, v => (soundBakeLoopSteps = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeOsc: [() => soundBakeOsc, v => (soundBakeOsc = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeOscSteps: [() => soundBakeOscSteps, v => (soundBakeOscSteps = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakePartialsSteps: [() => soundBakePartialsSteps, v => (soundBakePartialsSteps = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakePeak: [() => soundBakePeak, v => (soundBakePeak = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeRoots: [() => soundBakeRoots, v => (soundBakeRoots = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeRun: [() => soundBakeRun, v => (soundBakeRun = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeStackSteps: [() => soundBakeStackSteps, v => (soundBakeStackSteps = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeString: [() => soundBakeString, v => (soundBakeString = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeSvf: [() => soundBakeSvf, v => (soundBakeSvf = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeTail: [() => soundBakeTail, v => (soundBakeTail = v)],
  // @ts-expect-error -- replaced on purpose
  soundBakeWindSteps: [() => soundBakeWindSteps, v => (soundBakeWindSteps = v)],
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
 *   indexEnd: number, t60: number, level: number, tine?: number, tineRatio?: number, tineTau?: number}} SoundBakeFm
 *   a two-operator FM tone (a bell at 1:2.8, a tine at 1:14): the index falls from index to indexEnd over the zone;
 *   SND-11: tine a third operator's index (at tineRatio, dying in tineTau s: the DX7 e-piano's bark)
 * @typedef {{kind: 'osc', lo: number, hi: number, every: number, wave: SoundBakeWave, duty?: number, a: number, d: number,
 *   s: number, hold: number, cut: number, level: number}} SoundBakeOsc
 *   an oscillator through an attack and decay into a sustain that loops (a pad or an organ), low-passed at cut
 * @typedef {{kind: 'bubble', lo: number, hi: number, every: number, xi: number, level: number}} SoundBakeBubble
 *   SND-10: water's bubbles (van den Doel): a zone's root is the pitch a bubble of radius 3/f m rings at (1 mm: 3 kHz);
 *   it falls away at its own rate (smaller ones faster) while its pitch rises by xi (0.1 a drop, 0.5-1 a bigger
 *   bubble). Played once, never looped: a zone moved to another pitch is a smaller or bigger bubble
 * @typedef {{kind: 'babble', lo: number, hi: number, every: number, sec: number, layers: number[][], level: number,
 *   seed: number}} SoundBakeBabble
 *   SND-10: running water's babble (after Farnell's Designing Sound): sines whose pitch jumps at random and glides,
 *   loud only while it rises, a layer each [ms between jumps, centre Hz, gain]; one zone, a seamless loop sec long at
 *   RMS `level`, played from a random point at a rate (a river slower, rapids faster)
 * @typedef {{kind: 'partials', lo: number, hi: number, every: number, sec: number, list: number[][], a?: number,
 *   click?: number, bend?: number, bendTau?: number, thump?: number, thumpLp?: number, level: number, seed: number}}
 *   SoundBakePartials
 *   SND-11: struck bars, tines and bells (a music box, a celesta, a glockenspiel, timpani): sines at ratios of the
 *   note, each [ratio, amp, seconds to fall to 1/e], a attack (s), click a tick of noise at the strike, bend how far
 *   above the pitch a drum starts (a share; it settles in bendTau s), thump a felt mallet's low-passed noise (level,
 *   thumpLp Hz). Played once, never looped
 * @typedef {{kind: 'stack', lo: number, hi: number, every: number, wave: SoundBakeWave, duty?: number,
 *   cents: number[], a: number, d?: number, s?: number, cut: number, track?: number, base?: number, q?: number,
 *   formants?: number[][], vib?: number, vibRate?: number, vibDelay?: number, scoop?: number, open?: number,
 *   openTau?: number, noise?: number, hold?: number, fade?: number, level: number, seed: number}} SoundBakeStack
 *   SND-11: detuned oscillators together (a string section, an accordion's reeds, a choir, brass): one per cents
 *   offset, through two low-passes in a row at min(cut, f·track + base) (Q q), or through formants [Hz, Q, gain] instead (a
 *   choir's vowel); an attack a, a decay d to the sustain s (s 0: a one-shot, an orchestra hit); vib a vibrato's depth
 *   (a share of the pitch) at vibRate Hz from vibDelay s; scoop cents under the pitch at the start (brass); open how
 *   far the filter opens at the start (×, falling in openTau s); noise a breath of it. Sustained zones loop hold s
 *   (fade s crossfaded)
 * @typedef {{kind: 'wind', lo: number, hi: number, every: number, harmonics: number[], a: number, d?: number,
 *   s?: number, breath?: number, breathAt?: number, breathQ?: number, chiff?: number, vib?: number, vibRate?: number,
 *   vibDelay?: number, hold?: number, fade?: number, level: number, seed: number}} SoundBakeWind
 *   SND-11: a tone of harmonics (the amplitude of the 1st, 2nd, 3rd...: a flute nearly a sine, a clarinet the odd
 *   ones, a warm bass), breath noise band-passed at breathAt × the pitch, a chiff of noise at the start, a vibrato,
 *   an attack, decay and sustain as a stack's; loops hold s while held
 * @typedef {{kind: 'hit', lo: number, hi: number, every: number, sec: number, tone?: number, from?: number, to?: number,
 *   sweep?: number, toneTau?: number, noise?: number, filter?: 'lowpass' | 'highpass' | 'bandpass', at?: number,
 *   q?: number, noiseA?: number, noiseTau?: number, metal?: number[], metalTau?: number, shake?: number,
 *   click?: number, level: number, seed: number}} SoundBakeHit
 *   SND-11: a drum or a shaken thing, one zone (lo = hi): a tone sweeping from `from` to `to` Hz (sweep s) and dying in
 *   toneTau; noise through a filter at `at` Hz, rising in noiseA s and dying in noiseTau; metal partials (Hz) dying in
 *   metalTau, shaken at `shake` Hz (a tambourine, sleigh bells); a click. Played once
 * @typedef {SoundBakePluck | SoundBakeFm | SoundBakeOsc | SoundBakeBubble | SoundBakeBabble | SoundBakePartials |
 *   SoundBakeStack | SoundBakeWind | SoundBakeHit} SoundBakeRecipe
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
  return soundBakeRun(soundBakeOscSteps(wave, freq, rate, n, duty));
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
  return soundBakeRun(soundBakeFmSteps(freq, rate, n, F));
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
  return soundBakeRun(soundBakeLoopSteps(data, loopStart, fade));
}

/**
 * SND-11: soundBakeLoop as a bake's steps (a sustained zone's loop is long: its flattening yields)
 * @param {Float32Array} data
 * @param {number} loopStart
 * @param {number} fade
 * @returns {Generator<number, Float32Array, void>}
 */
export function* soundBakeLoopSteps(data, loopStart, fade) {
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
  for (let i = loopStart; i < n; i++) {
    data[i] *= Math.exp(k * (i - loopStart));
    if ((i - loopStart) % (SOUND_BAKE_CHUNK * 4) === SOUND_BAKE_CHUNK * 4 - 1) yield i;
  }
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
 * SND-11: a two-pole state-variable filter (the trapezoidal, zero-delay form: stable at any cutoff and Q) whose
 * cutoff may move every sample: returns a function of (input, cutoff Hz) that gives the low-pass and keeps the
 * band-pass in .bp and the high-pass in .hp. The cutoff is held under 0.45 of the rate
 * @param {number} rate
 * @param {number} q
 */
export function soundBakeSvf(rate, q) {
  const k = 1 / Math.max(0.3, q);
  let s1 = 0,
    s2 = 0,
    fcWas = -1,
    g = 0,
    a1 = 0,
    a2 = 0,
    a3 = 0;
  const f = (/** @type {number} */ x, /** @type {number} */ fc) => {
    if (fc !== fcWas) {
      fcWas = fc;
      g = Math.tan((Math.PI * Math.min(fc, rate * 0.45)) / rate);
      a1 = 1 / (1 + g * (g + k));
      a2 = g * a1;
      a3 = g * a2;
    }
    const v3 = x - s2,
      v1 = a1 * s1 + a2 * v3,
      v2 = s2 + a2 * s1 + a3 * v3;
    s1 = 2 * v1 - s1;
    s2 = 2 * v2 - s2;
    f.bp = v1;
    f.hp = x - k * v1 - v2;
    return v2;
  };
  f.bp = 0;
  f.hp = 0;
  return f;
}

/**
 * SND-11: an attack, decay and sustain at time t (s): a linear rise over a, then a fall to s that is 1/e of the way in
 * d seconds (no d: s at once)
 * @param {number} t
 * @param {number} a
 * @param {number | undefined} d
 * @param {number} s
 */
export function soundBakeAds(t, a, d, s) {
  if (t < a) return t / a;
  return d ? s + (1 - s) * Math.exp(-(t - a) / d) : s;
}

/**
 * SND-11: two-operator FM (soundBakeFm) as a bake's steps, with an optional third operator, the tine, dying fast
 * @param {number} freq
 * @param {number} rate
 * @param {number} n
 * @param {{ratio: number, index: number, indexEnd: number, tine?: number, tineRatio?: number, tineTau?: number}} F
 * @returns {Generator<number, Float32Array, void>}
 */
export function* soundBakeFmSteps(freq, rate, n, F) {
  const out = new Float32Array(n),
    k = Math.log(Math.max(1e-3, F.indexEnd) / Math.max(1e-3, F.index)) / Math.max(1, n),
    w = 2 * Math.PI * freq,
    tr = F.tineRatio || 14,
    tt = F.tineTau || 0.035;
  for (let i = 0; i < n; i++) {
    const t = i / rate,
      I = F.index * Math.exp(k * i),
      tine = F.tine ? F.tine * Math.exp(-t / tt) * Math.sin(w * tr * t) : 0;
    out[i] = Math.sin(w * t + I * Math.sin(w * F.ratio * t) + tine);
    if (i % SOUND_BAKE_CHUNK === SOUND_BAKE_CHUNK - 1) yield i;
  }
  return out;
}

/**
 * SND-11: soundBakeOsc as a bake's steps (the same samples, a chunk at a time)
 * @param {SoundBakeWave} wave
 * @param {number} freq
 * @param {number} rate
 * @param {number} n
 * @param {number} [duty]
 * @returns {Generator<number, Float32Array, void>}
 */
export function* soundBakeOscSteps(wave, freq, rate, n, duty = 0.5) {
  const out = new Float32Array(n),
    dt = freq / rate;
  let ph = 0,
    tri = -1;
  for (let i = 0; i < n; i++) {
    let v;
    if (wave === 'sine') v = Math.sin(2 * Math.PI * ph);
    else if (wave === 'saw') v = 2 * ph - 1 - soundBakeBlep(ph, dt);
    else {
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
    if (i % SOUND_BAKE_CHUNK === SOUND_BAKE_CHUNK - 1) yield i;
  }
  return out;
}

/**
 * SND-11: struck partials (SoundBakePartials) n samples at freq. A bake generator
 * @param {number} freq
 * @param {number} rate
 * @param {number} n
 * @param {SoundBakePartials} P
 * @param {() => number} rnd seeded, 0-1
 * @returns {Generator<number, Float32Array, void>}
 */
export function* soundBakePartialsSteps(freq, rate, n, P, rnd) {
  const out = new Float32Array(n),
    bend = P.bend || 0,
    bt = P.bendTau || 0.06;
  for (const [ratio, amp, dec] of P.list) {
    if (freq * ratio * (1 + bend) > rate * 0.45) continue;
    let ph = rnd() * 2 * Math.PI;
    const fall = Math.exp(-1 / (dec * rate)),
      w = (2 * Math.PI * freq * ratio) / rate;
    let g = amp;
    for (let i = 0; i < n; i++) {
      ph += bend ? w * (1 + bend * Math.exp(-i / rate / bt)) : w;
      out[i] += Math.sin(ph) * g;
      g *= fall;
      if (i % SOUND_BAKE_CHUNK === SOUND_BAKE_CHUNK - 1) yield i;
    }
  }
  /* the mallet: a felt thump (low-passed noise) and a tick */
  if (P.thump) {
    const N = Math.min(n, Math.round(rate * 0.03)),
      a = Math.exp((-2 * Math.PI * (P.thumpLp || 900)) / rate);
    let lp = 0;
    for (let i = 0; i < N; i++) {
      lp = (1 - a) * (rnd() * 2 - 1) + a * lp;
      out[i] += lp * P.thump * (1 - i / N);
    }
  }
  if (P.click) {
    const N = Math.min(n, Math.round(rate * 0.003));
    for (let i = 0; i < N; i++) out[i] += (rnd() * 2 - 1) * P.click * (1 - i / N);
  }
  yield 0;
  const A = Math.max(1, Math.round((P.a ?? 0.002) * rate));
  for (let i = 0; i < Math.min(n, A); i++) out[i] *= i / A;
  return out;
}

/**
 * SND-11: a stack of detuned oscillators (SoundBakeStack) n samples at freq. A bake generator
 * @param {number} freq
 * @param {number} rate
 * @param {number} n
 * @param {SoundBakeStack} S
 * @param {() => number} rnd seeded, 0-1
 * @returns {Generator<number, Float32Array, void>}
 */
export function* soundBakeStackSteps(freq, rate, n, S, rnd) {
  const out = new Float32Array(n),
    det = S.cents.map(c => Math.pow(2, c / 1200)),
    ph = det.map(() => rnd()),
    tri = det.map(() => -1),
    q = S.q ?? 0.6,
    lp1 = soundBakeSvf(rate, q),
    lp2 = soundBakeSvf(rate, q),
    forms = (S.formants || []).map(([f, fq, g]) => ({ f, g, F: soundBakeSvf(rate, fq) })),
    cut = Math.min(S.cut, freq * (S.track || 99) + (S.base || 0)),
    duty = S.duty ?? 0.5,
    gain = 1 / Math.sqrt(det.length),
    breath = soundBakeSvf(rate, 0.8);
  for (let i = 0; i < n; i++) {
    const t = i / rate,
      vib = S.vib
        ? 1 +
          S.vib *
            Math.sin(2 * Math.PI * (S.vibRate || 5) * t) *
            Math.min(1, Math.max(0, (t - (S.vibDelay ?? 0.25)) / 0.3))
        : 1,
      scoop = S.scoop ? Math.pow(2, (-S.scoop * Math.exp(-t / 0.03)) / 1200) : 1;
    let x = 0;
    for (let k = 0; k < det.length; k++) {
      const dt = (freq * det[k] * vib * scoop) / rate;
      let v;
      if (S.wave === 'sine') v = Math.sin(2 * Math.PI * ph[k]);
      else if (S.wave === 'saw') v = 2 * ph[k] - 1 - soundBakeBlep(ph[k], dt);
      else {
        const w = S.wave === 'triangle' ? 0.5 : duty;
        v = (ph[k] < w ? 1 : -1) + soundBakeBlep(ph[k], dt) - soundBakeBlep((ph[k] - w + 1) % 1, dt);
        if (S.wave === 'triangle') {
          tri[k] = 0.999 * tri[k] + 4 * dt * v;
          v = tri[k];
        }
      }
      x += v;
      ph[k] += dt;
      if (ph[k] >= 1) ph[k] -= 1;
    }
    x *= gain;
    if (S.noise) x += (breath((rnd() * 2 - 1) * S.noise, freq * 3), breath.bp);
    let y;
    if (forms.length) {
      y = 0;
      for (const F of forms) {
        F.F(x, F.f);
        y += F.F.bp * F.g;
      }
    } else {
      const open = S.open ? 1 + S.open * (1 - Math.exp(-t / 0.03)) * Math.exp(-t / (S.openTau || 0.22)) : 1,
        fc = cut * open;
      y = lp2(lp1(x, fc), fc * 1.4);
    }
    out[i] = y * soundBakeAds(t, S.a, S.d, S.s ?? 1);
    /* a stack costs a voice per offset a sample: it yields a quarter as long */
    if (i % (SOUND_BAKE_CHUNK / 4) === SOUND_BAKE_CHUNK / 4 - 1) yield i;
  }
  return out;
}

/**
 * SND-11: a wind tone (SoundBakeWind) n samples at freq. A bake generator
 * @param {number} freq
 * @param {number} rate
 * @param {number} n
 * @param {SoundBakeWind} W
 * @param {() => number} rnd seeded, 0-1
 * @returns {Generator<number, Float32Array, void>}
 */
export function* soundBakeWindSteps(freq, rate, n, W, rnd) {
  const out = new Float32Array(n),
    H = W.harmonics.filter((_, k) => freq * (k + 1) < rate * 0.45),
    bp = soundBakeSvf(rate, W.breathQ || 1.5),
    chiffN = Math.round(rate * 0.03);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate,
      vib = W.vib
        ? 1 +
          W.vib *
            Math.sin(2 * Math.PI * (W.vibRate || 5) * t) *
            Math.min(1, Math.max(0, (t - (W.vibDelay ?? 0.3)) / 0.4))
        : 1,
      env = soundBakeAds(t, W.a, W.d, W.s ?? 1);
    ph += (2 * Math.PI * freq * vib) / rate;
    let x = 0;
    for (let k = 0; k < H.length; k++) x += H[k] * Math.sin((k + 1) * ph);
    if (W.breath) {
      bp(rnd() * 2 - 1, freq * (W.breathAt || 2));
      x += bp.bp * W.breath;
    }
    out[i] = x * env + (W.chiff && i < chiffN ? (rnd() * 2 - 1) * W.chiff * (1 - i / chiffN) : 0);
    if (i % SOUND_BAKE_CHUNK === SOUND_BAKE_CHUNK - 1) yield i;
  }
  return out;
}

/**
 * SND-11: a drum or a shaken thing (SoundBakeHit), n samples. A bake generator
 * @param {number} rate
 * @param {number} n
 * @param {SoundBakeHit} H
 * @param {() => number} rnd seeded, 0-1
 * @returns {Generator<number, Float32Array, void>}
 */
export function* soundBakeHitSteps(rate, n, H, rnd) {
  const out = new Float32Array(n),
    F = soundBakeSvf(rate, H.q ?? 0.8),
    metal = (H.metal || []).map(f => ({
      w: (2 * Math.PI * f * (0.98 + rnd() * 0.04)) / rate,
      ph: rnd() * 2 * Math.PI,
    })),
    clickN = Math.round(rate * 0.004);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    let x = 0;
    if (H.tone) {
      const f = (H.to ?? 60) + ((H.from ?? H.to ?? 60) - (H.to ?? 60)) * Math.exp(-t / (H.sweep || 0.035));
      ph += (2 * Math.PI * f) / rate;
      x += Math.sin(ph) * H.tone * Math.exp(-t / (H.toneTau || 0.15));
    }
    if (H.noise) {
      const w = rnd() * 2 - 1,
        lo = F(w, H.at || 1000),
        y = H.filter === 'highpass' ? F.hp : H.filter === 'bandpass' ? F.bp : H.filter === 'lowpass' ? lo : w;
      x += y * H.noise * Math.min(1, t / (H.noiseA || 0.0005)) * Math.exp(-t / (H.noiseTau || 0.06));
    }
    if (metal.length) {
      let m = 0;
      for (const M of metal) m += Math.sin(M.ph + M.w * i);
      const shake = H.shake ? 0.6 + 0.4 * Math.sin(2 * Math.PI * H.shake * t) : 1;
      x += (m / metal.length) * Math.exp(-t / (H.metalTau || 0.08)) * shake;
    }
    if (H.click && i < clickN) x += (rnd() * 2 - 1) * H.click * (1 - i / clickN);
    out[i] = x;
    if (i % SOUND_BAKE_CHUNK === SOUND_BAKE_CHUNK - 1) yield i;
  }
  return out;
}

/**
 * SND-11: the last ms of a one-shot faded out, so a zone that ends never clicks
 * @param {Float32Array} d
 * @param {number} rate
 */
export function soundBakeTail(d, rate) {
  const N = Math.min(d.length, Math.round(rate * 0.005));
  for (let i = 0; i < N; i++) d[d.length - 1 - i] *= i / N;
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
  if (R.kind === 'bubble') {
    /* SND-10: one bubble, played once: no loop (loopStart is its end) */
    data = yield* soundBakeBubble(f, R.xi, rate);
    yield* soundBakePeak(data, R.level);
    return { root, lo, hi, rate, data, loopStart: data.length, loopEnd: data.length, tau: 0 };
  }
  if (R.kind === 'babble') {
    /* SND-10: running water's babble, a seamless loop from its start to its end */
    data = yield* soundBakeBabble(rate, R);
    return { root, lo, hi, rate, data, loopStart: 0, loopEnd: data.length, tau: 0 };
  }
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
    /* SND-11: sliced like the string (SND-9 rendered it in one step while nothing used it) */
    const n = Math.round(R.sec * rate);
    data = yield* soundBakeFmSteps(f, rate, n, R);
    const k = -6.9 / (R.t60 * rate);
    for (let i = 0; i < n; i++) {
      data[i] *= Math.exp(k * i) * Math.min(1, i / (rate * 0.002));
      if (i % (SOUND_BAKE_CHUNK * 4) === SOUND_BAKE_CHUNK * 4 - 1) yield i;
    }
    loopStart = n - Math.round(loopOf(0.04));
    tau = R.t60 / 6.9;
  } else if (R.kind === 'partials' || R.kind === 'hit' || ((R.kind === 'stack' || R.kind === 'wind') && R.s === 0)) {
    /* SND-11: a one-shot (a struck bar, a drum, an orchestra hit): played once, never looped */
    const rnd = ambienceRandom(R.seed + z),
      sec = R.kind === 'stack' || R.kind === 'wind' ? R.a + 6 * (R.d || 0.1) : R.sec,
      n = Math.round(sec * rate);
    if (R.kind === 'partials') data = yield* soundBakePartialsSteps(f, rate, n, R, rnd);
    else if (R.kind === 'hit') data = yield* soundBakeHitSteps(rate, n, R, rnd);
    else if (R.kind === 'stack') data = yield* soundBakeStackSteps(f, rate, n, R, rnd);
    else data = yield* soundBakeWindSteps(f, rate, n, R, rnd);
    yield* soundBakePeak(data, R.level);
    soundBakeTail(data, rate);
    return { root, lo, hi, rate, data, loopStart: data.length, loopEnd: data.length, tau: 0 };
  } else if (R.kind === 'stack' || R.kind === 'wind') {
    /* SND-11: a sustained tone: its attack and decay, then hold s that loop while the note is held */
    const rnd = ambienceRandom(R.seed + z),
      head = R.a + 3 * (R.d || 0) + 0.05,
      L = Math.round(loopOf(R.hold ?? 0.5)),
      n = Math.round(head * rate) + L;
    data =
      R.kind === 'stack'
        ? yield* soundBakeStackSteps(f, rate, n, R, rnd)
        : yield* soundBakeWindSteps(f, rate, n, R, rnd);
    loopStart = n - L;
    tau = 0;
    /* the loop first (its flattening can lift the end), then the peak */
    yield* soundBakeLoopSteps(data, loopStart, Math.min(Math.round(rate * (R.fade ?? 0.06)), Math.floor(L / 2)));
    yield* soundBakePeak(data, R.level);
    return { root, lo, hi, rate, data, loopStart, loopEnd: data.length, tau };
  } else {
    /* SND-11: sliced (SND-9 rendered it in one step while nothing used it) */
    const head = R.a + R.d,
      L = Math.round(loopOf(R.hold)),
      n = Math.round(head * rate) + L + Math.round(rate * 0.02);
    data = yield* soundBakeOscSteps(R.wave, f, rate, n, R.duty);
    if (R.cut) yield* soundBakeBiquadSteps(data, rate, 'lowpass', R.cut);
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
 * SND-10: a bubble ringing at f0 Hz (van den Doel, "Physically-based models for liquid sounds", 2005): radius r =
 * 3 / f0 m, falling away at d = 0.13 / r + 0.0072 r^-1.5 a second, its pitch rising as f0 (1 + xi d t); a 0.6 ms ramp
 * in and the last 4 ms faded out, so it never clicks. At most 0.7 s; peak about 1. A bake generator
 * @param {number} f0
 * @param {number} xi the rise (0.1 a raindrop, 0.5-1 a bigger bubble)
 * @param {number} rate
 * @returns {Generator<number, Float32Array, void>}
 */
export function* soundBakeBubble(f0, xi, rate) {
  const r = 3 / f0,
    d = 0.13 / r + 0.0072 * Math.pow(r, -1.5),
    n = Math.ceil(Math.min(0.7, 6.9 / d + 0.004) * rate),
    out = new Float32Array(n),
    fMax = rate * 0.42,
    ramp = rate * 0.0006,
    tail = Math.max(1, Math.round(rate * 0.004));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    ph += (2 * Math.PI * Math.min(fMax, f0 * (1 + xi * d * t))) / rate;
    out[i] = Math.sin(ph) * Math.exp(-d * t) * Math.min(1, i / ramp) * Math.min(1, (n - i) / tail);
    if (i % SOUND_BAKE_CHUNK === SOUND_BAKE_CHUNK - 1) yield i;
  }
  return out;
}

/**
 * SND-10: running water's babble (after Farnell, Designing Sound, "running water"; our own code): for each layer
 * [ms, centre, gain], a sine whose pitch jumps to a random height every ms milliseconds and glides there in 2.7 ms,
 * loud only while its pitch rises (a bubble forming); made sec + 0.2 s long and the start crossfaded (equal power)
 * with what follows the end, so it loops with no seam; scaled to RMS R.level. A bake generator
 * @param {number} rate
 * @param {SoundBakeBabble} R
 * @returns {Generator<number, Float32Array, void>}
 */
export function* soundBakeBabble(rate, R) {
  const rnd = ambienceRandom(R.seed),
    len = Math.floor(rate * R.sec),
    fade = Math.floor(rate * 0.2),
    n = len + fade,
    a = new Float32Array(n),
    glide = Math.max(1, Math.round(0.002689 * rate)),
    k10 = 1 - Math.exp((-2 * Math.PI * 10) / rate);
  for (const [ms, depth, g] of R.layers) {
    const step = Math.max(1, Math.round((ms / 1000) * rate));
    let ph = rnd() * 2 * Math.PI,
      f = depth,
      from = f,
      to = f,
      tg = glide,
      next = 0,
      prev = f,
      env = 0;
    for (let i = 0; i < n; i++) {
      if (i >= next) {
        from = f;
        const mag = Math.exp(9 * rnd()) / 23000;
        to = depth + 1600 * (rnd() < 0.5 ? -mag : mag);
        tg = 0;
        next = i + step;
      }
      if (tg < glide) {
        tg++;
        f = from + ((to - from) * tg) / glide;
      }
      const rise = Math.max(0, Math.min(1, f - prev));
      prev = f;
      env += (rise - env) * k10;
      ph += (2 * Math.PI * Math.max(30, f)) / rate;
      a[i] += Math.sin(ph) * env * env * 0.81 * g;
      if (i % SOUND_BAKE_CHUNK === SOUND_BAKE_CHUNK - 1) yield i;
    }
  }
  const o = a.slice(0, len);
  for (let i = 0; i < fade; i++) {
    const th = (i / fade) * (Math.PI / 2);
    o[i] = a[i] * Math.sin(th) + a[len + i] * Math.cos(th);
  }
  yield 0;
  let s = 0;
  for (let i = 0; i < len; i++) {
    s += o[i] * o[i];
    if (i % (SOUND_BAKE_CHUNK * 8) === SOUND_BAKE_CHUNK * 8 - 1) yield i;
  }
  const k = R.level / (Math.sqrt(s / Math.max(1, len)) || 1);
  for (let i = 0; i < len; i++) {
    o[i] *= k;
    if (i % (SOUND_BAKE_CHUNK * 8) === SOUND_BAKE_CHUNK * 8 - 1) yield i;
  }
  return o;
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
    /* the noise is made a chunk at a time (the same sequence as all at once), so no step does the whole second */
    const d = new Float32Array(n),
      r = ambienceRandom(seed + ch),
      /* the envelope falls by a constant factor a sample; the low-pass's cutoff moves slowly, so it is worked out
         every 32 samples */
      fall = Math.exp(-6.9 / (t60 * rate));
    let lp = 0,
      env = 1,
      a = 0;
    for (let at = 0; at < n; at += SOUND_BAKE_CHUNK) {
      const e = Math.min(n, at + SOUND_BAKE_CHUNK);
      d.set(ambienceNoise('white', e - at, r), at);
      for (let i = Math.max(at, pre); i < e; i++) {
        if ((i - pre) % 32 === 0) {
          const f = dark + (bright - dark) * Math.exp(-(i - pre) / rate / (t60 / 3));
          a = Math.exp((-2 * Math.PI * f) / rate);
        }
        lp = (1 - a) * d[i] + a * lp;
        d[i] = lp * env * Math.min(1, (i - pre) / ramp) * Math.min(1, (n - i) / tail);
        env *= fall;
      }
      for (let i = at; i < Math.min(e, pre); i++) d[i] = 0;
      yield at;
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
