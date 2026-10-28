'use strict';
/* ================= THE SOUNDSCAPE'S PLAYER (sound track SND-10) =================
   Plays the world's water (game/data/soundscape.json `water`; logic/soundscape.js says where it is and when its events
   fall): a voice per recipe and place, made when it is wanted and stopped once it has faded (logic/ambience-sound.js
   ambienceLiveStep), each a few layers of the beds' own noise through filters with drift, a baked texture played from
   a random point, and events (bubbles from the tracker's bank, laps, the surf's waves) a little ahead of time. A voice
   sits in the world by its level (distance and a fall's height), its pan and the air's low-pass (far water darker);
   a recipe with a big reverb send (cave drips) sends to the tracker's room. Knows nothing of the game: sound.js makes
   it with a context, the beds' noise, a bus and the tracker, and tells it what to play every 200 ms. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { ambienceDrift, ambienceLiveStep } from '../logic/ambience-sound.js';
import { soundscapeAir, soundscapeBubbles, soundscapeLaps, soundscapeWaves } from '../logic/soundscape.js';
/* eslint-disable no-func-assign */
expose({
  SOUNDSCAPE_AHEAD: [() => SOUNDSCAPE_AHEAD],
  SOUNDSCAPE_EVENT_CAP: [() => SOUNDSCAPE_EVENT_CAP],
  SOUNDSCAPE_EVENT_HUSH: [() => SOUNDSCAPE_EVENT_HUSH],
  SOUNDSCAPE_EVENT_QUIET: [() => SOUNDSCAPE_EVENT_QUIET],
  SOUNDSCAPE_ROOM_SEND: [() => SOUNDSCAPE_ROOM_SEND],
  soundscapePlayerCreate: [() => soundscapePlayerCreate, v => (soundscapePlayerCreate = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* events are scheduled this far ahead each update (longer than the 200 ms between updates: headless Chromium's clock
   runs fast, SND-8a) */
const SOUNDSCAPE_AHEAD = 0.3;
/* at most this many events an update over every voice (a phone's voice budget); quiet voices play none */
const SOUNDSCAPE_EVENT_CAP = 48;
const SOUNDSCAPE_EVENT_QUIET = 0.02;
/* a bubble whose gain times its voice's level is under this is left out (about -50 dB: under the bed it sits in) */
const SOUNDSCAPE_EVENT_HUSH = 0.003;
/* a send this big makes the tracker's room (a cave's drips); smaller ones use it only when something else made it */
const SOUNDSCAPE_ROOM_SEND = 0.3;

/**
 * a player on context c. env: { S: soundscape.json, noise: {pink, brown} (AudioBuffers), out: the node voices play
 * into, tracker: the tracker (its bank and room), rng: a seeded random, tide: () => 0-1, storm: () => 0-1 }
 */
export function soundscapePlayerCreate(c, env) {
  const P = { voices: new Map(), started: 0, events: 0, dropped: 0 };
  const T = env.tracker,
    r = env.rng;
  const filt = (type, f, q = 0.7, gain = 0) => {
    const F = c.createBiquadFilter();
    F.type = type;
    F.frequency.value = f;
    F.Q.value = q;
    if (gain) F.gain.value = gain;
    return F;
  };
  /* a voice of recipe R: inp (its trim) -> level -> the air's low-pass -> pan -> out; its layers, texture and events
     feed inp. Nothing sounds until it starts */
  const make = (id, R) => {
    const V = { id, R, st: {}, drifts: [], parts: [], srcs: [], ev: (R.events || []).map(() => ({})), want: 0 };
    V.inp = c.createGain();
    V.inp.gain.value = R.trim;
    V.lvl = c.createGain();
    V.lvl.gain.value = 0;
    V.air = filt('lowpass', 16000, 0.5);
    V.pan = c.createStereoPanner ? c.createStereoPanner() : null;
    V.inp.connect(V.lvl);
    V.lvl.connect(V.air);
    if (V.pan) {
      V.air.connect(V.pan);
      V.pan.connect(env.out);
    } else V.air.connect(env.out);
    /* events come in left, middle or right of the voice */
    V.evOut = [-1, 0, 1].map(k => {
      const q = c.createStereoPanner ? c.createStereoPanner() : c.createGain();
      if (q.pan) q.pan.value = k * 0.35;
      q.connect(V.inp);
      return q;
    });
    for (const L of R.layers) {
      const F = L.filters.map(([type, f, q, g]) => filt(type, f, q || 0.7, g || 0)),
        m = c.createGain();
      m.gain.value = L.gain;
      F.forEach((f, i) => f.connect(F[i + 1] || m));
      m.connect(V.inp);
      for (const D of L.drift || []) V.drifts.push({ D, param: D.on === 'gain' ? m.gain : F[D.on].frequency, next: 0 });
      V.parts.push({ buffer: env.noise[L.noise], rate: L.rate || 1, head: F[0] || m });
    }
    return V;
  };
  const sendFor = V => {
    const s = V.R.send || 0;
    if (!s || !T || !T.reverbSend) return;
    if (s < SOUNDSCAPE_ROOM_SEND && !(T.reverbStats && T.reverbStats())) return;
    V.send = c.createGain();
    V.send.gain.value = s;
    V.lvl.connect(V.send);
    V.send.connect(T.reverbSend('world'));
  };
  const start = (V, t) => {
    for (const p of V.parts) {
      const s = c.createBufferSource();
      s.buffer = p.buffer;
      s.loop = true;
      s.playbackRate.value = p.rate;
      s.connect(p.head);
      s.start(t, r() * p.buffer.duration);
      V.srcs.push(s);
    }
    if (!V.send) sendFor(V);
    P.started += V.srcs.length;
  };
  /* the texture waits for its bank: it starts on the first update after the bake */
  const texture = (V, t) => {
    const X = V.R.texture;
    if (!X || V.tex || !T || !T.bankBuffer) return;
    const Z = T.bankBuffer(X.bank, 60);
    if (!Z) return;
    const s = c.createBufferSource(),
      g = c.createGain();
    s.buffer = Z.buffer;
    s.loop = true;
    s.playbackRate.value = Z.rate * X.rate;
    g.gain.value = X.gain;
    s.connect(g);
    g.connect(V.inp);
    s.start(t, r() * Z.buffer.duration);
    V.tex = s;
    V.srcs.push(s);
    P.started++;
  };
  const stop = (V, t) => {
    for (const s of V.srcs)
      try {
        s.stop(t);
      } catch (e) {}
    V.srcs = [];
    V.tex = null;
    for (const w of V.drifts) w.next = 0;
    V.ev = (V.R.events || []).map(() => ({}));
  };
  const drift = (V, t) => {
    for (const w of V.drifts) {
      if (w.next < t) w.next = t;
      while (w.next < t + SOUNDSCAPE_AHEAD) {
        const { value, wait } = ambienceDrift(w.D, r);
        w.param.setTargetAtTime(value, w.next, w.D.tau);
        w.next += wait;
      }
    }
  };
  /* an event's way out: left, middle or right */
  const outFor = (V, pan) => V.evOut[pan < -0.12 ? 0 : pan > 0.12 ? 2 : 1];
  const shot = (V, e, at) => {
    /* a bubble too quiet to hear here (a far voice's) is never made */
    if (e.gain * V.want < SOUNDSCAPE_EVENT_HUSH) return;
    if (P.budget <= 0) return void P.dropped++;
    P.budget--;
    if (
      T &&
      T.sampleShot &&
      T.sampleShot(outFor(V, e.pan), { inst: e.bank, midi: e.midi, t: at, vol: e.gain, rate: e.rate })
    )
      P.events++;
  };
  /* a soft wash of low noise (a lap at a bank) */
  const lap = (V, e) => {
    if (P.budget <= 0) return void P.dropped++;
    P.budget--;
    const s = c.createBufferSource(),
      F = filt('lowpass', e.f, 0.6),
      g = c.createGain();
    s.buffer = env.noise.brown;
    g.gain.setValueAtTime(0, e.t);
    g.gain.linearRampToValueAtTime(e.gain, e.t + e.a);
    g.gain.setTargetAtTime(0, e.t + e.a, e.d / 3);
    s.connect(F);
    F.connect(g);
    g.connect(outFor(V, e.pan));
    s.start(e.t, r() * (s.buffer.duration - 2));
    s.stop(e.t + e.a + e.d * 2);
    s.onended = () => g.disconnect();
    P.events++;
    if (e.plip) shot(V, { ...e.plip, rate: 1, pan: e.pan }, e.t + 0.05 + r() * 0.12);
  };
  /* a wave: pink noise rising while a low-pass opens, falling while a high-pass closes; foam fizzing as it draws back */
  const wave = (V, E, e) => {
    if (P.budget <= 0) return void P.dropped++;
    P.budget--;
    const s = c.createBufferSource(),
      lp = filt('lowpass', 300, 0.5),
      hp = filt('highpass', 40, 0.5),
      g = c.createGain(),
      t = e.t,
      end = t + e.A + e.D;
    s.buffer = env.noise.pink;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(e.peak, t + e.A);
    g.gain.linearRampToValueAtTime(0, end);
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.exponentialRampToValueAtTime(2400, t + e.A);
    lp.frequency.exponentialRampToValueAtTime(900, end);
    hp.frequency.setValueAtTime(40, t + e.A);
    hp.frequency.exponentialRampToValueAtTime(450, end);
    s.connect(lp);
    lp.connect(hp);
    hp.connect(g);
    g.connect(outFor(V, e.pan));
    s.start(t, r() * (s.buffer.duration - 1));
    s.stop(end + 0.1);
    s.onended = () => g.disconnect();
    P.events++;
    if (e.fizz > 0 && E.bank) {
      const F = {
          type: 'bubbles',
          bank: E.bank,
          rate: e.fizz,
          rMin: 0.5,
          rMax: 1.3,
          gamma: 1,
          level: 0.35 * e.peak,
          beta: 3,
        },
        a = t + e.A * 0.9;
      for (const b of soundscapeBubbles(F, {}, a, a + Math.min(e.D, 3), r)) shot(V, b, b.t);
    }
  };
  const events = (V, t, rate) => {
    if (V.want < SOUNDSCAPE_EVENT_QUIET) return;
    const t1 = t + SOUNDSCAPE_AHEAD;
    (V.R.events || []).forEach((E, i) => {
      const st = V.ev[i];
      if (E.type === 'bubbles') for (const b of soundscapeBubbles(E, st, t, t1, r, rate)) shot(V, b, b.t);
      else if (E.type === 'laps') for (const e of soundscapeLaps(E, st, t, t1, r)) lap(V, e);
      else if (E.type === 'waves')
        for (const e of soundscapeWaves(E, st, t, t1, r, env.tide ? env.tide() : 0.5, env.storm ? env.storm() : 0))
          wave(V, E, e);
    });
  };
  /* the banks this player's recipes use, so the tracker bakes them before they are needed */
  P.banks = () => {
    const ids = new Set();
    for (const R of Object.values(env.S.water || {})) {
      if (R.texture) ids.add(R.texture.bank);
      for (const E of R.events || []) if (E.bank) ids.add(E.bank);
    }
    return [...ids];
  };
  /* want: [{recipe, k, level, d, pan, rate?}]: every voice to its level, pan and air; a voice not wanted fades out
     and stops; events for the live ones */
  P.update = (want, t) => {
    P.budget = SOUNDSCAPE_EVENT_CAP;
    const seen = new Set();
    for (const w of want) {
      const R = env.S.water[w.recipe];
      if (!R) continue;
      const key = w.recipe + '#' + (w.k || 0);
      seen.add(key);
      let V = P.voices.get(key);
      if (!V) P.voices.set(key, (V = make(key, R)));
      V.want = w.level;
      V.rate = w.rate ?? 1;
      if (V.pan) V.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, w.pan || 0)), t, 0.25);
      V.air.frequency.setTargetAtTime(soundscapeAir(w.d), t, 0.3);
    }
    for (const [key, V] of P.voices) {
      if (!seen.has(key)) V.want = 0;
      const step = ambienceLiveStep(V.st, V.want, t);
      if (step === 'start') start(V, t);
      else if (step === 'stop') stop(V, t);
      V.lvl.gain.setTargetAtTime(V.want, t, 0.35);
      if (!V.st.live) continue;
      texture(V, t);
      drift(V, t);
      events(V, t, V.rate);
    }
  };
  P.stop = t => {
    for (const V of P.voices.values()) {
      V.lvl.gain.setTargetAtTime(0, t, 0.1);
      stop(V, t + 0.5);
      V.st = {};
    }
  };
  /* what the debug log says (no save data): the live voices and their levels, sources and events so far */
  P.stats = () => {
    const live = [...P.voices.values()].filter(V => V.st.live);
    return {
      voices: Object.fromEntries(live.map(V => [V.id, Math.round(V.want * 1000) / 1000])),
      sources: live.reduce((a, V) => a + V.srcs.length, 0),
      started: P.started,
      events: P.events,
      dropped: P.dropped,
    };
  };
  return P;
}
