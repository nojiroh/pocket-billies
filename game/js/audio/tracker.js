'use strict';
/* ================= THE TRACKER =================
   The game's music player (sound track SND-2), split out of sound.js so the Studio can play songs too. It knows
   nothing of the game: trackerCreate(ctx, bus) builds the instruments on an AudioContext (any, an OfflineAudioContext
   too) and plays into one bus. The Game Boy palette: pulse waves of 12.5, 25 and 50 %, square, triangle, sine, one
   noise buffer through filters, and a kick; a soft echo that every voice can send to. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import {
  SOUND_BAKE_INSTRUMENTS,
  soundBakeImpulse,
  soundBakeRoots,
  soundBakeZoneFor,
  soundBakeZoneSteps,
} from '../logic/sound-bake.js';
/* eslint-disable no-func-assign */
expose({
  SCALES: [() => SCALES],
  SOUND_BAKE_BUDGET: [() => SOUND_BAKE_BUDGET],
  SOUND_BAKE_IMPULSE_SEC: [() => SOUND_BAKE_IMPULSE_SEC],
  SOUND_BAKE_PLACES: [() => SOUND_BAKE_PLACES],
  SOUND_BAKE_ROOM_GAIN: [() => SOUND_BAKE_ROOM_GAIN],
  SOUND_BAKE_SLICE_MS: [() => SOUND_BAKE_SLICE_MS],
  midiToFrequency: [() => midiToFrequency],
  songRandom: [() => songRandom, v => (songRandom = v)],
  soundBakeBank: [() => soundBakeBank],
  soundBakeBytes: [() => soundBakeBytes, v => (soundBakeBytes = v)],
  soundBakeEntry: [() => soundBakeEntry, v => (soundBakeEntry = v)],
  soundBakeImpulseFor: [() => soundBakeImpulseFor, v => (soundBakeImpulseFor = v)],
  soundBakeKeep: [() => soundBakeKeep, v => (soundBakeKeep = v)],
  soundBakeNow: [() => soundBakeNow],
  soundBakePrune: [() => soundBakePrune, v => (soundBakePrune = v)],
  soundBakeSlice: [() => soundBakeSlice, v => (soundBakeSlice = v)],
  soundBakeStart: [() => soundBakeStart, v => (soundBakeStart = v)],
  soundBakeStats: [() => soundBakeStats, v => (soundBakeStats = v)],
  soundBakeWant: [() => soundBakeWant, v => (soundBakeWant = v)],
  trackerArc: [() => trackerArc, v => (trackerArc = v)],
  trackerCompose: [() => trackerCompose, v => (trackerCompose = v)],
  trackerCreate: [() => trackerCreate, v => (trackerCreate = v)],
  trackerNight: [() => trackerNight, v => (trackerNight = v)],
  trackerRecipe: [() => trackerRecipe, v => (trackerRecipe = v)],
  trackerTense: [() => trackerTense, v => (trackerTense = v)],
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
  /* SND-3: a written hook takes bars 1-2 and their repeat in bars 5-6 from the walk; a countermelody plays under them
     on a second pulse. Notes are [step from the song's start, midi, length in sixteenths]; only steps 0-31 count.
     SND-4: bars 3-4 answer them: the same rhythm, each note moved to the nearest tone of its new bar's chord */
  const counter = new Array(steps).fill(null),
    chordTone = (m, ch) => {
      let best = m,
        gap = Infinity;
      for (let o = -3; o <= 3; o++)
        for (const x of [0, 2, 4]) {
          const t = deg(ch + x) + 12 * o,
            g = Math.abs(t - m);
          /* a tie goes down: an answer falls */
          if (g < gap || (g === gap && t < best)) ((best = t), (gap = g));
        }
      return best;
    },
    written = (line, out) => {
      for (const [st, m, l] of line || [])
        if (st >= 0 && st < 32) {
          for (const at of [st, st + 64]) if (at < steps) out[at] = [m, l];
          const at = st + 32,
            b = Math.floor(at / 16);
          if (at < steps) out[at] = [chordTone(m, D.prog[b]), l];
        }
    };
  if (D.hook && D.hook.length) {
    lead.fill(null, 0, Math.min(64, steps));
    if (steps > 64) lead.fill(null, 64, Math.min(96, steps));
    written(D.hook, lead);
  }
  /* SND-5: a counter made from the hook where none is written (the run's late rows): each note on the nearest tone of
     its bar's chord at least a third below it */
  const below = (m, ch) => {
      let best = m - 12;
      for (let o = -3; o <= 3; o++)
        for (const x of [0, 2, 4]) {
          const t = deg(ch + x) + 12 * o;
          if (t <= m - 3 && t > best) best = t;
        }
      return best;
    },
    counterLine =
      D.counter && D.counter.length
        ? D.counter
        : D.counterAuto && D.hook
          ? D.hook.map(([st, m, l]) => [st, below(m, D.prog[Math.floor(st / 16)] || 0), l])
          : null;
  written(counterLine, counter);
  /* SND-4: the bars where the countermelody has the second pulse (the arp rests there) */
  const counterBars = Array.from({ length: bars }, (_, b) => counter.slice(b * 16, b * 16 + 16).some(Boolean));
  /* SND-5: the intro, one or two bars on the lead alone that play once before the song (a battle's chromatic run).
     Notes as a hook's, steps 0-31; it lasts the bars its notes reach */
  const line = (D.intro || []).filter(([st]) => st >= 0 && st < 32),
    introSteps = line.length ? Math.min(32, Math.ceil(Math.max(...line.map(([st, , l]) => st + l)) / 16) * 16) : 0,
    introNotes = new Array(introSteps).fill(null);
  for (const [st, m, l] of line) introNotes[st] = [m, Math.min(l, introSteps - st)];
  return { ...D, notes: lead, counterNotes: counter, counterBars, steps, deg, introNotes, introSteps };
}
export const midiToFrequency = m => 440 * Math.pow(2, (m - 69) / 12);
/* SND-4: a song's night version, the recipe with its `night` changes; with none written, slower by 8 bpm, a fourth
   down and soft drums (a song with no drums keeps none). null when the song has `night: false` */
function trackerNight(D) {
  if (!D || D.night === false) return null;
  const { night, ...day } = D,
    auto = { bpm: Math.max(40, D.bpm - 8), key: D.key - 5, drums: D.drums === 'none' ? 'none' : 'soft' };
  const N = { ...day, ...(night && typeof night === 'object' ? night : auto) },
    by = N.key - D.key,
    move = line => line && line.map(([st, m, l]) => [st, m + by, l]);
  /* a written hook and counter move with the key, unless the night writes its own */
  if (by && D.hook && !(night && night.hook)) N.hook = move(D.hook);
  if (by && D.counter && !(night && night.counter)) N.counter = move(D.counter);
  return N;
}
/* SND-5: a battle song's tense version, for the red zone (the lead Billie under a quarter of its HP, as Black and White
   did it): the song's `tense` changes, or by default 16 bpm faster, march drums and a pedal bass on the flat seventh.
   null when the song has `tense: false` */
function trackerTense(D) {
  if (!D || D.tense === false) return null;
  const { tense, ...rest } = D,
    auto = { bpm: Math.min(300, D.bpm + 16), drums: 'march', bass: 'pedal' };
  return { ...rest, ...(tense && typeof tense === 'object' ? tense : auto) };
}
/* SND-5: a song in a run's arc band (music.json run.arc: a band of rows and the recipe's changes there, the run's
   later rows busier); a song with `arc: false` stays as written */
function trackerArc(D, band) {
  if (!D || !band) return null;
  if (D.arc === false) return D;
  return { ...D, ...(band.changes || {}) };
}
/* SND-5: the recipe a song name plays: 'town' itself, 'town@night' its night version; null for a song or a part that
   doesn't exist; 'wild@tense' its tense version, 'meadow@late' its arc band's (run.arc), 'meadow@late@night' both. `run` is music.json's run (the arc's bands), for the parts that need
   it */
function trackerRecipe(songs, name, run) {
  const [base, ...parts] = String(name).split('@');
  let D = (songs && songs[base]) || null;
  for (const p of parts) {
    if (!D) return null;
    if (p === 'night') D = trackerNight(D);
    else if (p === 'tense') D = trackerTense(D);
    else
      D = trackerArc(
        D,
        ((run && run.arc) || []).find(b => b.name === p)
      );
  }
  return D;
}
/* ---------- SND-9: the bank ----------
   Baked instruments (logic/sound-bake.js) as AudioBuffers, kept here at module level by (instrument, sample rate): a
   buffer plays in any context, so a second context (the Studio's, check-sound's) never bakes again. Every buffer is
   made at its context's own rate. Baking runs zone by zone in setTimeout slices that stop after about 2 ms of work
   (iOS Safari has no requestIdleCallback), so no frame waits on it; each slice's time is kept for the debug log. The
   bank and the other baked buffers (the beds' noise, the tracker's noise, the reverb's impulse) stay within
   SOUND_BAKE_BUDGET together: past it the least recently played zone is dropped (a note then plays from the nearest
   zone left, and the dropped one is baked again) */
const SOUND_BAKE_BUDGET = 6 * 1024 * 1024;
const SOUND_BAKE_SLICE_MS = 2;
/* SND-9: the reverb. One ConvolverNode (a phone's costliest node: one, short), made the first time something sends to
   it, so a song that never asks (all of today's: the future `gb` ensemble) never makes it. Its impulse: 1.2 s of
   stereo decaying noise (logic/sound-bake.js). A place changes how much is sent, not the room: open air, a town, a
   forest, a room, a cave (no second convolver for caves until a cave needs a longer room) */
const SOUND_BAKE_IMPULSE_SEC = 1.2;
/* the normalised room comes back about 11 dB under what is sent (measured: noise through the 1.2 s impulse in
   Chromium); the return makes a send of 1 come back about level, so a send's gain reads as the room's level */
const SOUND_BAKE_ROOM_GAIN = 3.5;
const SOUND_BAKE_PLACES = { open: 0.6, town: 0.8, forest: 1, room: 0.7, cave: 1.8 };
const soundBakeBank = {
  /** 'harp@48000' -> { id, R, rate, ctx, zones: (zone | null)[], used: number[], queued: Set, wait: [] } */
  entries: new Map(),
  /** the reverb's impulse by sample rate: a Promise of its AudioBuffer */
  impulses: new Map(),
  /** SND-10: recipes from data beside SOUND_BAKE_INSTRUMENTS (soundscape.json `banks`: water's bubbles and babble) */
  recipes: /** @type {Record<string, any>} */ ({}),
  queue: [],
  timer: 0,
  /* a play counts up: the zone played longest ago has the smallest count */
  clock: 0,
  /* the other baked buffers' bytes (the beds' noise, the tracker's noise, the impulse), from the last tracker made */
  other: () => 0,
  ms: 0,
  /* the last impulse's own work (ms), for the reverb's line */
  impulseMs: 0,
  zones: 0,
  dropped: 0,
  slices: 0,
  sliceMaxMs: 0,
  /* the slowest single step (a slice can run over its budget by one step) */
  stepMaxMs: 0,
  lastSlicesMs: [],
};
const soundBakeNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
/* the bank's entry for an instrument at a context's rate (made empty the first time) */
function soundBakeEntry(id, c) {
  const R = SOUND_BAKE_INSTRUMENTS[id] || soundBakeBank.recipes[id];
  if (!R) return null;
  const key = id + '@' + c.sampleRate;
  let E = soundBakeBank.entries.get(key);
  if (!E) {
    const n = soundBakeRoots(R).length;
    E = {
      id,
      key,
      R,
      rate: c.sampleRate,
      ctx: c,
      zones: new Array(n).fill(null),
      used: new Array(n).fill(0),
      queued: new Set(),
      wait: [],
    };
    soundBakeBank.entries.set(key, E);
  }
  return E;
}
/* bakes what an entry lacks; resolves with the entry once every zone is baked */
function soundBakeWant(E) {
  E.zones.forEach((z, i) => {
    if (!z && !E.queued.has(i)) {
      E.queued.add(i);
      soundBakeBank.queue.push({ make: () => soundBakeZoneSteps(E.R, E.rate, i), keep: Z => soundBakeKeep(E, i, Z) });
    }
  });
  if (!E.queued.size) return Promise.resolve(E);
  soundBakeStart();
  return new Promise(res => E.wait.push(res));
}
/* the slices start (when they aren't running) */
function soundBakeStart() {
  if (!soundBakeBank.timer) soundBakeBank.timer = setTimeout(soundBakeSlice, 0);
}
/* one slice of baking: zone steps until about SOUND_BAKE_SLICE_MS have passed */
function soundBakeSlice() {
  const B = soundBakeBank,
    t0 = soundBakeNow();
  let job;
  while ((job = B.queue[0])) {
    if (!job.it) ((job.it = job.make()), (job.ms = 0));
    const s0 = soundBakeNow(),
      r = job.it.next();
    const step = soundBakeNow() - s0;
    job.ms += step;
    B.stepMaxMs = Math.max(B.stepMaxMs, step);
    if (r.done) {
      B.queue.shift();
      job.keep(r.value, job.ms);
    }
    if (soundBakeNow() - t0 > SOUND_BAKE_SLICE_MS) break;
  }
  const dt = soundBakeNow() - t0;
  B.ms += dt;
  B.slices++;
  B.sliceMaxMs = Math.max(B.sliceMaxMs, dt);
  B.lastSlicesMs.push(Math.round(dt * 100) / 100);
  if (B.lastSlicesMs.length > 16) B.lastSlicesMs.shift();
  B.timer = B.queue.length ? setTimeout(soundBakeSlice, 0) : 0;
}
/* a baked zone made into a buffer at its context's rate (its numbers dropped), the bank kept within its budget */
function soundBakeKeep(E, i, Z) {
  const b = E.ctx.createBuffer(1, Z.data.length, E.rate);
  if (b.copyToChannel) b.copyToChannel(Z.data, 0);
  else b.getChannelData(0).set(Z.data);
  E.zones[i] = {
    i,
    root: Z.root,
    lo: Z.lo,
    hi: Z.hi,
    buffer: b,
    loopStart: Z.loopStart / E.rate,
    loopEnd: Z.loopEnd / E.rate,
    tau: Z.tau,
    bytes: Z.data.length * 4,
  };
  E.used[i] = ++soundBakeBank.clock;
  E.queued.delete(i);
  soundBakeBank.zones++;
  soundBakePrune(E.zones[i]);
  if (!E.queued.size) for (const res of E.wait.splice(0)) res(E);
}
/* the reverb's impulse at a context's rate, baked in the same slices (once per rate) */
function soundBakeImpulseFor(c) {
  const B = soundBakeBank;
  if (!B.impulses.has(c.sampleRate))
    B.impulses.set(
      c.sampleRate,
      new Promise(res => {
        B.queue.push({
          make: () => soundBakeImpulse(c.sampleRate, { sec: SOUND_BAKE_IMPULSE_SEC }),
          keep: ([L, R], ms) => {
            B.impulseMs = Math.round(ms * 10) / 10;
            const b = c.createBuffer(2, L.length, c.sampleRate);
            [L, R].forEach((d, ch) => (b.copyToChannel ? b.copyToChannel(d, ch) : b.getChannelData(ch).set(d)));
            res(b);
          },
        });
        soundBakeStart();
      })
    );
  return B.impulses.get(c.sampleRate);
}
/* the bank's bytes, its zones' alone */
function soundBakeBytes() {
  let n = 0;
  for (const E of soundBakeBank.entries.values()) for (const z of E.zones) if (z) n += z.bytes;
  return n;
}
/* past the budget, the least recently played zones go (never the one just made) */
function soundBakePrune(keep) {
  while (soundBakeBytes() + soundBakeBank.other() > SOUND_BAKE_BUDGET) {
    let worst = null;
    for (const E of soundBakeBank.entries.values())
      E.zones.forEach((z, i) => {
        if (z && z !== keep && (!worst || E.used[i] < worst.E.used[worst.i])) worst = { E, i };
      });
    if (!worst) return;
    worst.E.zones[worst.i] = null;
    soundBakeBank.dropped++;
  }
}
/* what the debug log says about the bank (no save data) */
function soundBakeStats() {
  const B = soundBakeBank,
    mb = n => Math.round((n / 1048576) * 100) / 100;
  return {
    instruments: [...B.entries.values()].map(E => `${E.key} ${E.zones.filter(Boolean).length}/${E.zones.length}`),
    mb: mb(soundBakeBytes()),
    withOtherMb: mb(soundBakeBytes() + B.other()),
    budgetMb: mb(SOUND_BAKE_BUDGET),
    bakeMs: Math.round(B.ms),
    zones: B.zones,
    dropped: B.dropped,
    queued: B.queue.length,
    slices: B.slices,
    sliceMaxMs: Math.round(B.sliceMaxMs * 100) / 100,
    stepMaxMs: Math.round(B.stepMaxMs * 100) / 100,
    lastSlicesMs: B.lastSlicesMs.slice(),
  };
}
export function trackerCreate(ctx, bus, opts = {}) {
  const c = ctx,
    /* SND-8a: started counts the voices started (the debug log's sources a minute), late the steps scheduled after
       their time (a stall in the page) */
    T = { ctx, bus, waves: {}, started: 0, late: 0 };
  /* a soft echo for the music (caves get more of it). SND-8b: and one of its own for the effects (opts.fx, the Sound
     effects bus: jingles and the heal and seal effects), so their echo follows the Sound effects slider, not Music's
     and the rain's low-pass */
  const echoLine = out => {
    const d = c.createDelay(1),
      fb = c.createGain(),
      wet = c.createGain(),
      input = c.createGain();
    d.delayTime.value = 0.27;
    fb.gain.value = 0.28;
    wet.gain.value = 0.16;
    input.connect(d);
    d.connect(fb);
    fb.connect(d);
    d.connect(wet);
    wet.connect(out);
    return { input, wet };
  };
  const echoMusic = echoLine(bus);
  T.echoIn = echoMusic.input;
  T.echoWet = echoMusic.wet;
  T.echoFx = opts.fx ? echoLine(opts.fx).input : null;
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
      echoTo = null,
    }
  ) => {
    T.started++;
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
    /* SND-8b: echoTo is the echo it sends to (a song's send, after its fader); the music's echo when not given */
    const to = echoTo || T.echoIn;
    if (echo && to) {
      const e = c.createGain();
      e.gain.value = echo;
      o2.connect(e);
      e.connect(to);
    }
    o.start(t);
    o.stop(t + Math.max(a + d, dur) + r + 0.02);
  };
  T.synthNoise = (out, { t, dur = 0.05, vol = 0.2, hp = 0, lp = 0, bp = 0, q = 1 }) => {
    T.started++;
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
    T.started++;
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
  /* ---------- SND-9: baked instruments ---------- */
  /* the bytes of baked buffers outside the bank (the beds' noise: opts.memory, sound.js), for the bank's budget */
  soundBakeBank.other = () => (opts.memory ? opts.memory() : 0) + T.noise.length * 4 + (T.reverbBytes || 0);
  /* resolves once the instruments named are baked at this context's rate (at once when they are) */
  T.bankReady = ids =>
    Promise.all([].concat(ids).map(id => (soundBakeEntry(id, c) ? soundBakeWant(soundBakeEntry(id, c)) : null)));
  T.bankStats = soundBakeStats;
  /* SND-10: recipes from data (soundscape.json `banks`) the bank may bake, by id; an id it already has keeps its own */
  T.bankAdd = recipes => {
    for (const [id, R] of Object.entries(recipes || {}))
      if (!SOUND_BAKE_INSTRUMENTS[id] && !soundBakeBank.recipes[id]) soundBakeBank.recipes[id] = R;
  };
  /* SND-10: a baked zone's buffer and the rate that moves it to midi (a texture loops it); null (and the bank asked)
     when nothing of it is baked yet */
  T.bankBuffer = (inst, midi) => {
    const E = soundBakeEntry(inst, c);
    if (!E) return null;
    const P = soundBakeZoneFor(E.zones, midi);
    if (!P || !P.own) soundBakeWant(E);
    if (!P) return null;
    E.used[P.zone.i] = ++soundBakeBank.clock;
    return { buffer: P.zone.buffer, rate: P.rate };
  };
  /* SND-10: a baked sound played once (a bubble, a drip): one buffer source and one gain, the nearest zone moved to
     midi and then by rate (a little faster or slower), never looped. null (and the bank asked) when nothing of it is
     baked yet */
  T.sampleShot = (out, { inst, midi, t, vol = 1, rate = 1 }) => {
    const E = soundBakeEntry(inst, c);
    if (!E) return null;
    const P = soundBakeZoneFor(E.zones, midi);
    if (!P || !P.own) soundBakeWant(E);
    if (!P) return null;
    const Z = P.zone;
    E.used[Z.i] = ++soundBakeBank.clock;
    T.started++;
    const s = c.createBufferSource(),
      g = c.createGain(),
      k = P.rate * rate;
    s.buffer = Z.buffer;
    s.playbackRate.value = k;
    g.gain.value = vol;
    s.connect(g);
    g.connect(out);
    s.start(t);
    s.stop(t + Z.buffer.length / Z.buffer.sampleRate / k + 0.01);
    s.onended = () => g.disconnect();
    return { source: s, gain: g };
  };
  /* a note of a baked instrument: one buffer source and one gain. The zone nearest the note plays, moved to its pitch;
     its loop holds the note for as long as dur, a pluck's tail fading on (the zone's tau) the whole time; the release
     takes r. null (and the instrument asked for) when nothing of it is baked yet */
  T.sampleVoice = (out, { inst, midi, t, dur, vol = 0.2, r = 0.25 }) => {
    const E = soundBakeEntry(inst, c);
    if (!E) return null;
    const P = soundBakeZoneFor(E.zones, midi);
    if (!P || !P.own) soundBakeWant(E);
    if (!P) return null;
    const Z = P.zone;
    E.used[Z.i] = ++soundBakeBank.clock;
    T.started++;
    const s = c.createBufferSource(),
      g = c.createGain(),
      body = Z.loopStart / P.rate,
      end = t + Math.max(0.01, dur);
    s.buffer = Z.buffer;
    s.playbackRate.value = P.rate;
    s.loop = true;
    s.loopStart = Z.loopStart;
    s.loopEnd = Z.loopEnd;
    g.gain.setValueAtTime(vol, t);
    if (Z.tau && body < end - t) g.gain.setTargetAtTime(0, t + body, Z.tau / P.rate);
    g.gain.setTargetAtTime(0, end, r / 4);
    s.connect(g);
    g.connect(out);
    s.start(t);
    s.stop(end + r * 1.5);
    return { source: s, gain: g };
  };
  /* SND-9: the reverb's sends. A part that wants reverb connects to T.reverbSend('music'), ('sfx') or (SND-10) ('world') after its own
     gain; each send is scaled by its slider (reverbLevels, from sound.js applyVolumes: post-fader, so a slider at 0
     leaves no reverb behind) and by the place (reverbPlace), and the room returns to the master (opts.master; the
     Studio, which has none, to the bus). Made on the first send */
  const room = {
    conv: null,
    sends: null,
    level: { music: 1, sfx: 1, world: 1 },
    place: 'town',
    bakeMs: 0,
    readyMs: 0,
    setMs: 0,
    sec: 0,
  };
  const roomGain = k => room.level[k] * (SOUND_BAKE_PLACES[room.place] ?? 1);
  const roomApply = () => {
    if (room.sends)
      for (const k of ['music', 'sfx', 'world']) room.sends[k].gain.setTargetAtTime(roomGain(k), c.currentTime, 0.05);
  };
  T.reverbSend = (kind = 'music') => {
    if (!room.conv) {
      room.conv = c.createConvolver();
      const ret = c.createGain();
      ret.gain.value = SOUND_BAKE_ROOM_GAIN;
      room.conv.connect(ret);
      ret.connect(opts.master || bus);
      room.sends = {};
      for (const k of ['music', 'sfx', 'world']) {
        room.sends[k] = c.createGain();
        room.sends[k].gain.value = roomGain(k);
        room.sends[k].connect(room.conv);
      }
      const t0 = soundBakeNow();
      room.ready = soundBakeImpulseFor(c).then(b => {
        /* readyMs: from the first send to the impulse in place (it waits its turn in the slices); bakeMs: its own work */
        room.readyMs = Math.round(soundBakeNow() - t0);
        room.bakeMs = soundBakeBank.impulseMs;
        const t1 = soundBakeNow();
        room.conv.buffer = b;
        room.setMs = Math.round((soundBakeNow() - t1) * 100) / 100;
        room.sec = b.length / b.sampleRate;
        T.reverbBytes = b.length * 2 * 4;
        return room.conv;
      });
    }
    return room.sends[kind] || room.sends.music;
  };
  /* resolves once the room has its impulse (and makes it, as a send would) */
  T.reverbReady = () => (T.reverbSend(), room.ready);
  /* SND-10: world, the World slider's level (cave drips send to it); left out, it stays as it was */
  T.reverbLevels = (music, sfx, world = room.level.world) => {
    room.level = { music, sfx, world };
    roomApply();
  };
  T.reverbPlace = p => {
    room.place = p in SOUND_BAKE_PLACES ? p : 'town';
    roomApply();
  };
  T.reverbStats = () =>
    room.conv
      ? {
          place: room.place,
          sec: room.sec,
          bakeMs: room.bakeMs,
          readyMs: room.readyMs,
          setMs: room.setMs,
          kb: Math.round((T.reverbBytes || 0) / 1024),
        }
      : null;
  /* ---------- the player ---------- */
  /* a song starts 80 ms from now and fades in; the songs before it fade out. levels() is the game's say on the drums
     (softer standing still or at night) and the night pad; with none, drums are full and there is no pad */
  let songs = opts.songs || {};
  const levels = opts.levels || (() => null),
    composed = new Map();
  T.song = null;
  T.voices = [];
  T.timer = null;
  /* SND-4: 'town@night' is town's night version (trackerNight); SND-5: any name trackerRecipe knows */
  T.recipe = name => trackerRecipe(songs, name, opts.run);
  /* SND-8b: a song's fader. Its gain and its echo send move together, so the echo follows the fade-in, a crossfade, a
     stop and a jingle's duck (the send used to be taken before the fader). f moves one AudioParam and runs for both;
     unplug disconnects both after ms */
  const fader = (sg, f) => [sg.gain, sg.echo].forEach(n => f(n.gain)),
    /* SND-8b: a song's level, its `trim` (dB, music.json) as a gain: the fader's top, and what a duck is a share of */
    level = D => Math.pow(10, (D.trim || 0) / 20),
    unplug = (sg, ms) => setTimeout(() => [sg.gain, sg.echo].forEach(n => n.disconnect()), ms);
  T.compose = name => {
    const D = T.recipe(name);
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
    if (!D) return T.stop();
    T.song.D = D;
    /* SND-8b: a new trim is heard at once */
    const lv = level(D);
    if (lv !== T.song.level) {
      T.song.level = lv;
      fader(T.song, g => g.setTargetAtTime(lv, c.currentTime, 0.05));
    }
  };
  /* SND-5: o.intro plays the song's intro first; o.hold keeps the drums out until drumsIn() (the throw), or 8 s;
     o.restart starts the song again even when it is playing (a new battle with the same song) */
  T.play = (name, o = {}) => {
    if (T.song && T.song.name === name && !o.restart) return T.song;
    const D = T.compose(name);
    if (!D) return null;
    const L = levels();
    T.song = {
      name,
      D,
      step: o.intro ? -(D.introSteps || 0) : 0,
      next: c.currentTime + 0.08,
      gain: c.createGain(),
      echo: c.createGain(),
      level: level(D),
      /* a song that takes over a held one (the red zone during the intro) keeps the drums out too */
      hold: o.hold ? c.currentTime + 8 : (T.song && T.song.hold) || 0,
    };
    T.song.gain.connect(bus);
    T.song.echo.connect(T.echoIn);
    T.song.drums = c.createGain();
    T.song.drums.gain.value = L ? L.drums : 1;
    T.song.drums.connect(T.song.gain);
    const now = c.currentTime;
    fader(T.song, g => {
      g.setValueAtTime(0, now);
      g.linearRampToValueAtTime(T.song.level, now + 0.6);
    });
    for (const v of T.voices) {
      fader(v, g => {
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(0, now + 0.5);
      });
      unplug(v, 700);
    }
    T.voices = [T.song];
    if (!T.timer) T.timer = setInterval(T.tick, 25);
    return T.song;
  };
  T.stop = () => {
    if (T.song) {
      const t = c.currentTime;
      fader(T.song, g => {
        g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(0, t + 0.4);
      });
      unplug(T.song, 600);
    }
    T.song = null;
    T.voices = [];
    T.idle();
  };
  /* the scheduler's timer runs only while a song plays: idle() stops it (no song, or the page hidden), wake() starts
     it again for the song that was playing */
  /* SND-5: the drums come in (a battle's first throw) */
  T.drumsIn = () => {
    if (T.song) T.song.hold = 0;
  };
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
    if (sg.hold && c.currentTime > sg.hold) sg.hold = 0;
    while (sg.next < c.currentTime + 0.14) {
      if (sg.next < c.currentTime - 0.005) T.late++;
      /* SND-5: the intro, on the lead alone */
      if (sg.step < 0) {
        const N = D.introNotes[sg.step + D.introSteps];
        if (N)
          T.synthVoice(sg.gain, {
            type: D.lead,
            freq: midiToFrequency(N[0]),
            t: sg.next,
            dur: N[1] * spb * 0.9,
            vol: D.lead === 'triangle' ? 0.13 : 0.075,
            d: 0.06,
            s: 0.7,
            r: 0.04,
            echo: D.echo ?? 0.15,
            echoTo: sg.echo,
          });
        sg.step++;
        sg.next += spb;
        continue;
      }
      let Lv;
      const st = sg.step % D.steps,
        b = Math.floor(st / 16),
        i = st % 16,
        t = sg.next + (i % 2 ? spb * (D.swing || 0) : 0),
        bus = sg.gain,
        ch = D.prog[b],
        dg = D.deg,
        /* SND-4: four voices, as on the Game Boy: a pulse for the lead, a second pulse for the countermelody or the
           arp, the triangle for the bass, noise for the drums. A lead on the triangle keeps it, and the bass moves to
           the second pulse. An `extra` song (the title, the fall) keeps the thicker mix: sine arps and the night pad */
        four = !D.extra,
        waveLead = four && D.lead === 'triangle',
        pulse2Busy = four && (waveLead || (D.counterBars && D.counterBars[b])),
        bassVoice = o =>
          !(waveLead && D.counterBars && D.counterBars[b]) &&
          T.synthVoice(
            bus,
            !four
              ? o
              : waveLead
                ? { ...o, type: 'p50', vol: 0.07, cut: 900 }
                : { ...o, type: 'triangle', vol: o.type === 'triangle' ? o.vol : 0.18, cut: 0 }
          );
      /* lead */ const L = D.notes[st];
      if (L)
        T.synthVoice(bus, {
          type: D.lead,
          freq: midiToFrequency(L[0]),
          t,
          dur: L[1] * spb * 0.9,
          vol: D.lead === 'triangle' ? 0.13 : 0.075,
          /* SND-4: a music-box lead (pluck) is short, with no vibrato */
          d: D.pluck ? 0.14 : 0.1,
          s: D.pluck ? 0.12 : 0.55,
          r: D.pluck ? 0.12 : 0.06,
          vib: !D.pluck && L[1] >= 6 ? 1 : 0,
          echo: D.echo ?? 0.15,
          echoTo: sg.echo,
        });
      /* the countermelody (SND-3), when the song has one */ const C = D.counterNotes && D.counterNotes[st];
      if (C)
        T.synthVoice(bus, {
          type: 'p12',
          freq: midiToFrequency(C[0]),
          t,
          dur: C[1] * spb * 0.9,
          vol: 0.05,
          d: 0.1,
          s: 0.5,
          r: 0.06,
          echo: 0.1,
          echoTo: sg.echo,
        });
      /* bass */ const bs = D.bass,
        root = dg(ch) - 24;
      if (bs === 'bounce' && i % 4 === 0)
        bassVoice({
          type: 'triangle',
          freq: midiToFrequency(i % 8 ? root + 7 : root),
          t,
          dur: spb * 3,
          vol: 0.2,
          s: 0.7,
        });
      else if (bs === 'gallop' && [0, 3, 4, 8, 11, 12].includes(i))
        bassVoice({
          type: 'triangle',
          freq: midiToFrequency(i % 8 === 4 ? root + 12 : root),
          t,
          dur: spb * 1.5,
          vol: 0.2,
        });
      else if (bs === 'long' && i === 0)
        bassVoice({
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
        bassVoice({
          type: 'triangle',
          freq: midiToFrequency(dg(ch + [0, 2, 4, 5][i / 4]) - 24),
          t,
          dur: spb * 3.5,
          vol: 0.2,
        });
      else if (bs === 'drive' && i % 2 === 0)
        bassVoice({
          type: 'p50',
          freq: midiToFrequency(root + (i % 8 === 6 ? 12 : 0)),
          t,
          dur: spb * 1.6,
          vol: 0.07,
          cut: 900,
        });
      else if (bs === 'pedal' && i % 2 === 0)
        /* SND-5: the tense pedal, eighths on the key's flat seventh (under the bass's home) whatever the chord */
        bassVoice({
          type: 'p50',
          freq: midiToFrequency(D.key - 26 + (i % 8 === 6 ? 12 : 0)),
          t,
          dur: spb * 1.6,
          vol: 0.07,
          cut: 900,
        });
      /* harmony (SND-5: arpOctave lifts the arp, the run's later rows) */ const ar = D.arp,
        tri = [0, 2, 4, D.seventh ? 6 : 7].map(x => dg(ch + x) + 12 * (D.arpOctave || 0)),
        pick = k => tri[((k % 4) + 4) % 4];
      if (pulse2Busy) {
        /* the second pulse plays the countermelody or the bass this bar */
      } else if (four && ar === 'drip' && (i === 0 || i === 6 || i === 11))
        T.synthVoice(bus, {
          type: 'p12',
          freq: midiToFrequency(pick(i) + 12),
          t,
          dur: spb * 1.5,
          vol: 0.04,
          s: 0.2,
          r: 0.15,
          echo: 0.5,
          echoTo: sg.echo,
        });
      else if (four && ar === 'chord7' && i % 2 === 0)
        T.synthVoice(bus, {
          type: 'p12',
          freq: midiToFrequency(tri[i % 4 ? 3 : 1] + 12),
          t,
          dur: spb * 1.2,
          vol: 0.035,
          s: 0.3,
          echo: 0.15,
          echoTo: sg.echo,
        });
      else if (ar === 'up' && i % 2 === 0)
        T.synthVoice(bus, {
          type: 'p12',
          freq: midiToFrequency(pick(i / 2) + 12),
          t,
          dur: spb * 1.2,
          vol: 0.035,
          s: 0.3,
          echo: 0.2,
          echoTo: sg.echo,
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
          echoTo: sg.echo,
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
          echoTo: sg.echo,
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
      /* drums (v27: on their own bus, softer when you stand still or at night; SND-5: out until the throw) */ const dr =
          sg.hold ? 'none' : D.drums,
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
      /* v27: a soft pad under the night (SND-4: an `extra` song's only; a four-voice song has its night version) */
      if (!four && i === 0 && (Lv = levels()) && Lv.pad > 0.05)
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
     of its level for its length. Returns when it ends (on the context's clock). SND-6: o.shift moves it by semitones, o.duck false
     leaves the song alone (a coin on the payout) */
  T.jingle = (notes, bpm, type, out, o = {}) => {
    const spb = 60 / bpm / 4,
      t0 = c.currentTime + 0.05,
      up = o.shift || 0,
      duck = o.duck !== false;
    let t = t0;
    if (T.song && duck)
      fader(T.song, g => {
        g.cancelScheduledValues(t0);
        g.setValueAtTime(g.value, t0);
        g.linearRampToValueAtTime(0.15 * T.song.level, t0 + 0.1);
      });
    for (const [n, l] of notes) {
      if (n)
        (T.synthVoice(out, {
          type,
          freq: midiToFrequency(n + up),
          t,
          dur: l * spb * 0.9,
          vol: 0.12,
          s: 0.6,
          echo: 0.2,
          /* SND-8b: on the effects' echo, unless it plays on the music bus (Settings' Music test) */
          echoTo: out === bus ? T.echoIn : T.echoFx,
        }),
          n &&
            T.synthVoice(out, {
              type: 'triangle',
              freq: midiToFrequency(n + up - 12),
              t,
              dur: l * spb * 0.9,
              vol: 0.12,
            }));
      t += l * spb;
    }
    if (T.song && duck)
      fader(T.song, g => {
        g.linearRampToValueAtTime(0.15 * T.song.level, t);
        g.linearRampToValueAtTime(T.song.level, t + 0.8);
      });
    return t;
  };
  return T;
}
