'use strict';
/* ================= THE TRACKER =================
   The game's music player (sound track SND-2), split out of sound.js so the Studio can play songs too. It knows
   nothing of the game: trackerCreate(ctx, bus) builds the instruments on an AudioContext (any, an OfflineAudioContext
   too) and plays into one bus. The Game Boy palette: pulse waves of 12.5, 25 and 50 %, square, triangle, sine, one
   noise buffer through filters, and a kick; a soft echo that every voice can send to. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({ midiToFrequency: [() => midiToFrequency], trackerCreate: [() => trackerCreate, v => (trackerCreate = v)] });
/* eslint-enable no-func-assign */
/* to-module: end */
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
