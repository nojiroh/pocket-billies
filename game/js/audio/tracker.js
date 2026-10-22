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
function trackerCompose(D) {
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
export function trackerCreate(ctx, bus, opts = {}) {
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
  /* ---------- the player ---------- */
  /* a song starts 80 ms from now and fades in; the songs before it fade out. levels() is the game's say on the drums
     (softer standing still or at night) and the night pad; with none, drums are full and there is no pad */
  let songs = opts.songs || {};
  const levels = opts.levels || (() => null),
    composed = new Map();
  T.song = null;
  T.voices = [];
  T.timer = null;
  T.compose = name => {
    const D = songs[name];
    if (!D) return null;
    if (!composed.has(name)) composed.set(name, trackerCompose(D));
    return composed.get(name);
  };
  /* the Studio (SND-3): after a recipe is edited, compose again; the song playing keeps its place and plays the new
     notes from the next step. A new table (after an undo) replaces the old; a song gone from it stops */
  T.refresh = table => {
    if (table) songs = table;
    composed.clear();
    if (!T.song) return;
    const D = T.compose(T.song.name);
    if (D) T.song.D = D;
    else T.stop();
  };
  T.play = name => {
    if (T.song && T.song.name === name) return T.song;
    const D = T.compose(name);
    if (!D) return null;
    if (T.song) {
      const old = T.song;
      old.fade = c.currentTime;
    }
    const L = levels();
    T.song = { name, D, step: 0, next: c.currentTime + 0.08, gain: c.createGain() };
    T.song.gain.connect(bus);
    T.song.drums = c.createGain();
    T.song.drums.gain.value = L ? L.drums : 1;
    T.song.drums.connect(T.song.gain);
    T.song.gain.gain.setValueAtTime(0, c.currentTime);
    T.song.gain.gain.linearRampToValueAtTime(1, c.currentTime + 0.6);
    for (const v of T.voices) {
      const t = c.currentTime;
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setValueAtTime(v.gain.gain.value, t);
      v.gain.gain.linearRampToValueAtTime(0, t + 0.5);
      setTimeout(() => v.gain.disconnect(), 700);
    }
    T.voices = [T.song];
    if (!T.timer) T.timer = setInterval(T.tick, 25);
    return T.song;
  };
  T.stop = () => {
    if (T.song) {
      const t = c.currentTime,
        g = T.song.gain;
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + 0.4);
      setTimeout(() => g.disconnect(), 600);
    }
    T.song = null;
    T.voices = [];
    T.idle();
  };
  /* the scheduler's timer runs only while a song plays: idle() stops it (no song, or the page hidden), wake() starts
     it again for the song that was playing */
  T.idle = () => {
    if (T.timer) clearInterval(T.timer);
    T.timer = null;
  };
  T.wake = () => {
    if (T.song && !T.timer) T.timer = setInterval(T.tick, 25);
  };
  /* the scheduler: called every 25 ms, it schedules each step that starts in the next 140 ms */
  T.tick = () => {
    const sg = T.song;
    if (!sg) return T.idle();
    const D = sg.D,
      spb = 60 / D.bpm / 4;
    while (sg.next < c.currentTime + 0.14) {
      let Lv;
      const st = sg.step % D.steps,
        b = Math.floor(st / 16),
        i = st % 16,
        t = sg.next + (i % 2 ? spb * (D.swing || 0) : 0),
        bus = sg.gain,
        ch = D.prog[b],
        dg = D.deg;
      /* lead */ const L = D.notes[st];
      if (L)
        T.synthVoice(bus, {
          type: D.lead,
          freq: midiToFrequency(L[0]),
          t,
          dur: L[1] * spb * 0.9,
          vol: D.lead === 'triangle' ? 0.13 : 0.075,
          d: 0.1,
          s: 0.55,
          r: 0.06,
          vib: L[1] >= 6 ? 1 : 0,
          echo: D.echo || 0.15,
        });
      /* bass */ const bs = D.bass,
        root = dg(ch) - 24;
      if (bs === 'bounce' && i % 4 === 0)
        T.synthVoice(bus, {
          type: 'triangle',
          freq: midiToFrequency(i % 8 ? root + 7 : root),
          t,
          dur: spb * 3,
          vol: 0.2,
          s: 0.7,
        });
      else if (bs === 'gallop' && [0, 3, 4, 8, 11, 12].includes(i))
        T.synthVoice(bus, {
          type: 'triangle',
          freq: midiToFrequency(i % 8 === 4 ? root + 12 : root),
          t,
          dur: spb * 1.5,
          vol: 0.2,
        });
      else if (bs === 'long' && i === 0)
        T.synthVoice(bus, {
          type: 'triangle',
          freq: midiToFrequency(root),
          t,
          dur: spb * 15,
          vol: 0.16,
          a: 0.2,
          s: 0.8,
          r: 0.4,
        });
      else if (bs === 'walk' && i % 4 === 0)
        T.synthVoice(bus, {
          type: 'triangle',
          freq: midiToFrequency(dg(ch + [0, 2, 4, 5][i / 4]) - 24),
          t,
          dur: spb * 3.5,
          vol: 0.2,
        });
      else if (bs === 'drive' && i % 2 === 0)
        T.synthVoice(bus, {
          type: 'p50',
          freq: midiToFrequency(root + (i % 8 === 6 ? 12 : 0)),
          t,
          dur: spb * 1.6,
          vol: 0.07,
          cut: 900,
        });
      /* harmony */ const ar = D.arp,
        tri = [0, 2, 4, D.seventh ? 6 : 7].map(x => dg(ch + x)),
        pick = k => tri[((k % 4) + 4) % 4];
      if (ar === 'up' && i % 2 === 0)
        T.synthVoice(bus, {
          type: 'p12',
          freq: midiToFrequency(pick(i / 2) + 12),
          t,
          dur: spb * 1.2,
          vol: 0.035,
          s: 0.3,
          echo: 0.2,
        });
      else if (ar === 'updown' && i % 2 === 0) {
        const k = i / 2,
          seq = [0, 1, 2, 3, 2, 1, 0, 1];
        T.synthVoice(bus, {
          type: 'p12',
          freq: midiToFrequency(pick(seq[k % 8]) + 12),
          t,
          dur: spb * 1.2,
          vol: 0.035,
          s: 0.3,
          echo: 0.15,
        });
      } else if (ar === 'drip' && (i === 0 || i === 6 || i === 11))
        T.synthVoice(bus, {
          type: 'sine',
          freq: midiToFrequency(pick(i) + 24),
          t,
          dur: spb * 2,
          vol: 0.05,
          s: 0.2,
          r: 0.3,
          echo: 0.7,
        });
      else if (ar === 'chord7' && (i === 0 || i === 6 || i === 10))
        tri.forEach(n =>
          T.synthVoice(bus, {
            type: 'sine',
            freq: midiToFrequency(n + 12),
            t,
            dur: spb * (i === 0 ? 5 : 3),
            vol: 0.03,
            a: 0.02,
            s: 0.5,
            r: 0.2,
          })
        );
      /* drums (v27: on their own bus, softer when you stand still or at night) */ const dr = D.drums,
        db = sg.drums || bus;
      if (dr === 'soft') {
        if (i === 0 || i === 8) T.synthKick(db, t, 0.25);
        if (i === 4 || i === 12) T.synthNoise(db, { t, dur: 0.08, vol: 0.08, bp: 1800, q: 0.8 });
        if (i % 4 === 2) T.synthNoise(db, { t, dur: 0.03, vol: 0.04, hp: 7000 });
      } else if (dr === 'skip') {
        if (i === 0 || i === 10) T.synthKick(db, t, 0.3);
        if (i === 4 || i === 12) T.synthNoise(db, { t, dur: 0.1, vol: 0.1, bp: 2000, q: 0.7 });
        if (i % 2 === 0) T.synthNoise(db, { t, dur: 0.025, vol: 0.035, hp: 8000 });
      } else if (dr === 'drive') {
        if (i % 4 === 0) T.synthKick(db, t, 0.42);
        if (i === 4 || i === 12) T.synthNoise(db, { t, dur: 0.12, vol: 0.14, bp: 1800, q: 0.6 });
        T.synthNoise(db, { t, dur: 0.02, vol: i % 2 ? 0.025 : 0.045, hp: 8000 });
      } else if (dr === 'march') {
        if (i === 0 || i === 8 || i === 11) T.synthKick(db, t, 0.42);
        if (i % 4 === 2 || i === 14 || i === 15) T.synthNoise(db, { t, dur: 0.07, vol: 0.11, bp: 2400, q: 0.8 });
        if (i % 2 === 0) T.synthNoise(db, { t, dur: 0.02, vol: 0.03, hp: 9000 });
      } else if (dr === 'bossa') {
        if (i === 0 || i === 6 || i === 8 || i === 14) T.synthKick(db, t, 0.2);
        if ([3, 6, 10, 13].includes(i)) T.synthNoise(db, { t, dur: 0.03, vol: 0.05, bp: 3500, q: 2 });
      }
      /* v27: a soft pad under the night */ if (i === 0 && (Lv = levels()) && Lv.pad > 0.05)
        [0, 2, 4].forEach(x =>
          T.synthVoice(bus, {
            type: 'sine',
            freq: midiToFrequency(dg(ch + x) - 12),
            t,
            dur: spb * 15,
            vol: 0.022 * Lv.pad,
            a: 0.6,
            s: 0.9,
            r: 0.8,
          })
        );
      sg.step++;
      sg.next += spb;
    }
  };
  /* a short tune that plays once over a lead and a bass an octave down, on the bus it is given; the song ducks to 0.15
     for its length. Returns when it ends (on the context's clock) */
  T.jingle = (notes, bpm, type, out) => {
    const spb = 60 / bpm / 4,
      t0 = c.currentTime + 0.05;
    let t = t0;
    if (T.song) {
      const g = T.song.gain.gain;
      g.cancelScheduledValues(t0);
      g.setValueAtTime(g.value, t0);
      g.linearRampToValueAtTime(0.15, t0 + 0.1);
    }
    for (const [n, l] of notes) {
      if (n)
        (T.synthVoice(out, {
          type,
          freq: midiToFrequency(n),
          t,
          dur: l * spb * 0.9,
          vol: 0.12,
          s: 0.6,
          echo: 0.2,
        }),
          n &&
            T.synthVoice(out, {
              type: 'triangle',
              freq: midiToFrequency(n - 12),
              t,
              dur: l * spb * 0.9,
              vol: 0.12,
            }));
      t += l * spb;
    }
    if (T.song) {
      const g = T.song.gain.gain;
      g.linearRampToValueAtTime(0.15, t);
      g.linearRampToValueAtTime(1, t + 0.8);
    }
    return t;
  };
  return T;
}
