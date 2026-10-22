'use strict';
/* ================= THE TRACKER =================
   The game's music player (sound track SND-2), split out of sound.js so the Studio can play songs too. It knows
   nothing of the game: trackerCreate(ctx, bus) builds the instruments on an AudioContext (any, an OfflineAudioContext
   too) and plays into one bus. The Game Boy palette: pulse waves of 12.5, 25 and 50 %, square, triangle, sine, one
   noise buffer through filters, and a kick; a soft echo that every voice can send to. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  SCALES: [() => SCALES],
  midiToFrequency: [() => midiToFrequency],
  songRandom: [() => songRandom, v => (songRandom = v)],
  trackerCompose: [() => trackerCompose, v => (trackerCompose = v)],
  trackerCreate: [() => trackerCreate, v => (trackerCreate = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixo: [0, 2, 4, 5, 7, 9, 10],
};
/* a seeded random number generator, so a song is composed the same way every time */
function songRandom(seed) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
/* a song's recipe (bpm, key, scale, the chords, the parts) made into notes: the lead is a seeded random walk over the
   chord tones. Returns a new object, the recipe with notes, steps and deg (scale degree to midi note) */
export function trackerCompose(D) {
  const sc = SCALES[D.scale],
    R = songRandom(D.seed),
    deg = n => {
      const o = Math.floor(n / 7),
        i = ((n % 7) + 7) % 7;
      return D.key + 12 * o + sc[i];
    };
  const bars = D.prog.length,
    steps = bars * 16,
    lead = new Array(steps).fill(null);
  const rhythms = [
    [0, 4, 6, 8, 12],
    [0, 2, 4, 8, 10, 12],
    [0, 3, 6, 8, 12, 14],
    [0, 4, 8, 10, 12],
    [0, 6, 8, 12],
    [0, 2, 4, 6, 8, 12],
  ];
  const makeBar = (b, rng) => {
    const ch = D.prog[b],
      rh = rhythms[Math.floor(rng() * rhythms.length)];
    let cur = ch + 7 + [0, 2, 4][Math.floor(rng() * 3)];
    const out = [];
    rh.forEach((st, i) => {
      const strong = st % 8 === 0;
      if (strong) {
        const tones = [ch, ch + 2, ch + 4].map(x => x + 7);
        cur = tones.reduce((a, b) => (Math.abs(b - cur) < Math.abs(a - cur) ? b : a));
      } else cur += [-2, -1, 1, 2, 1, -1][Math.floor(rng() * 6)];
      const len = (rh[i + 1] ?? 16) - st;
      out.push([st, deg(cur), len]);
    });
    return out;
  };
  /* bars 1-4 a phrase, 5-6 repeat its start, 7-8 a cadence that lands on the home note */
  const A = [0, 1, 2, 3].map(b => makeBar(b, R)),
    R2 = songRandom(D.seed + 7);
  for (let b = 0; b < bars; b++) {
    let bar = b < 4 ? A[b] : b < 6 ? A[b - 4] : makeBar(b, R2);
    if (b === bars - 1)
      bar = [
        [0, deg(D.prog[b] + 7 + 2), 4],
        [4, deg(D.prog[b] + 7), 4],
        [8, deg(7), 8],
      ];
    const sh = D.key >= 64 ? -12 : 0;
    bar.forEach(([s, n, l]) => {
      lead[b * 16 + s] = [n + sh, l];
    });
  }
  return { ...D, notes: lead, steps, deg };
}
export const midiToFrequency = m => 440 * Math.pow(2, (m - 69) / 12);
export function trackerCreate(ctx, bus) {
  const c = ctx,
    T = { ctx, bus, waves: {} };
  /* a soft echo for the music (caves get more of it) */
  const d = c.createDelay(1),
    fb = c.createGain(),
    wet = c.createGain();
  d.delayTime.value = 0.27;
  fb.gain.value = 0.28;
  wet.gain.value = 0.16;
  T.echoIn = c.createGain();
  T.echoIn.connect(d);
  d.connect(fb);
  fb.connect(d);
  d.connect(wet);
  wet.connect(bus);
  T.echoWet = wet;
  const n = c.createBuffer(1, c.sampleRate, c.sampleRate),
    nd = n.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  T.noise = n;
  const pw = duty => {
    const N = 32,
      re = new Float32Array(N),
      im = new Float32Array(N);
    for (let k = 1; k < N; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    return c.createPeriodicWave(re, im);
  };
  T.waves.p25 = pw(0.25);
  T.waves.p12 = pw(0.125);
  T.waves.p50 = pw(0.5);
  /* ---------- instruments ---------- */
  T.synthVoice = (
    out,
    {
      type = 'p25',
      freq,
      t,
      dur,
      vol = 0.1,
      a = 0.005,
      d = 0.08,
      s = 0.6,
      r = 0.08,
      slide = 0,
      vib = 0,
      cut = 0,
      echo = 0,
    }
  ) => {
    const o = c.createOscillator(),
      g = c.createGain();
    if (T.waves[type]) o.setPeriodicWave(T.waves[type]);
    else o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    if (vib) {
      const l = c.createOscillator(),
        lg = c.createGain();
      l.frequency.value = 5.5;
      lg.gain.value = freq * 0.012 * vib;
      l.connect(lg);
      lg.connect(o.frequency);
      l.start(t + 0.08);
      l.stop(t + dur + r);
    }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.linearRampToValueAtTime(vol * s, t + a + d);
    g.gain.setValueAtTime(vol * s, t + Math.max(a + d, dur));
    g.gain.linearRampToValueAtTime(0, t + Math.max(a + d, dur) + r);
    let o2 = g;
    if (cut) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cut;
      g.connect(f);
      o2 = f;
    }
    o.connect(g);
    o2.connect(out);
    if (echo && T.echoIn) {
      const e = c.createGain();
      e.gain.value = echo;
      o2.connect(e);
      e.connect(T.echoIn);
    }
    o.start(t);
    o.stop(t + Math.max(a + d, dur) + r + 0.02);
  };
  T.synthNoise = (out, { t, dur = 0.05, vol = 0.2, hp = 0, lp = 0, bp = 0, q = 1 }) => {
    const s = c.createBufferSource(),
      g = c.createGain();
    s.buffer = T.noise;
    s.loop = true;
    /* v47: longer than the one-second buffer (the fall) */ let n = s;
    for (const [type, f] of [
      ['highpass', hp],
      ['lowpass', lp],
      ['bandpass', bp],
    ])
      if (f) {
        const F = c.createBiquadFilter();
        F.type = type;
        F.frequency.value = f;
        F.Q.value = q;
        n.connect(F);
        n = F;
      }
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(g);
    g.connect(out);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  };
  T.synthKick = (out, t, v = 0.5) => {
    const o = c.createOscillator(),
      g = c.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + 0.22);
  };
  return T;
}
