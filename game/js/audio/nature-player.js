'use strict';
/* ================= NATURE'S PLAYER (sound track SND-14) =================
   Plays the weather's, the wild's and the town's one-shots (game/data/soundscape.json `nature`; logic/nature-sound.js
   says when and how): the rain's patter and the drips off the eaves, thunder rolling in after a bolt, grasshoppers'
   chirrs and cicadas' swells, frogs' croaks, the town's quiet life (a door, a cart, a far voice, a dog, a bell) and a
   room's small sounds (a page, a cup, a tool, the straw). Each is a few nodes made when it plays and let go when it
   ends; every random choice comes from the seeded random it is given. Knows nothing of the game: nature-here.js
   makes it with a context, the beds' noise and the tracker, and asks for each sound with where it goes. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({ naturePlayerCreate: [() => naturePlayerCreate, v => (naturePlayerCreate = v)] });
/* eslint-enable no-func-assign */
/* to-module: end */
/**
 * a player on context c. env: { noise: {pink, brown} (AudioBuffers), tracker: the tracker (its bank: the drops),
 * rng: a seeded random }
 */
export function naturePlayerCreate(c, env) {
  const P = { started: 0, rolled: 0, thunderLive: 0 },
    r = env.rng,
    T = env.tracker;
  const filt = (type, f, q = 0.7) => {
    const F = c.createBiquadFilter();
    F.type = type;
    F.frequency.value = f;
    F.Q.value = q;
    return F;
  };
  /* a sound's way out: its level, its pan, then dest; let go a while after its last source ends */
  const out = (dest, gain, pan) => {
    const g = c.createGain();
    g.gain.value = gain;
    if (c.createStereoPanner && pan) {
      const p = c.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p);
      p.connect(dest);
      g.extra = p;
    } else g.connect(dest);
    return g;
  };
  /* nodes let go when src ends (after whatever was asked before) */
  const letGo = (src, ...nodes) => {
    const prev = src.onended;
    src.onended = ev => {
      if (prev) prev(ev);
      for (const n of nodes)
        try {
          n.disconnect();
          if (n.extra) n.extra.disconnect();
        } catch (e) {}
    };
  };
  /* a burst of the beds' noise through a filter into g: rises over a, falls away over d */
  const burst = (g, t, { type = 'bandpass', f, q = 1, a = 0.001, d, gain, brown = false }) => {
    const s = c.createBufferSource(),
      F = filt(type, f, q),
      e = c.createGain();
    s.buffer = brown ? env.noise.brown : env.noise.pink;
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(gain, t + a);
    e.gain.setTargetAtTime(0, t + a, d / 3);
    s.connect(F);
    F.connect(e);
    e.connect(g);
    s.start(t, r() * (s.buffer.duration - 2));
    s.stop(t + a + d * 2.5);
    letGo(s, e);
    P.started++;
    return s;
  };
  /* a tone through a band (a croak, a voice, a bark): its pitch f sliding to f * slide over dur */
  const tone = (g, t, { type = 'sawtooth', f, slide = 1, dur, a = 0.01, gain, band, q = 2, vib = 0 }) => {
    const o = c.createOscillator(),
      F = filt('bandpass', band, q),
      e = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(f * slide, t + dur);
    if (vib) {
      const l = c.createOscillator(),
        lg = c.createGain();
      l.frequency.value = vib;
      lg.gain.value = f * 0.03;
      l.connect(lg);
      lg.connect(o.frequency);
      l.start(t);
      l.stop(t + dur + 0.1);
    }
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(gain, t + a);
    e.gain.setTargetAtTime(0, t + dur * 0.6, dur / 4);
    o.connect(F);
    F.connect(e);
    e.connect(g);
    o.start(t);
    o.stop(t + dur * 1.6 + 0.05);
    letGo(o, e);
    P.started++;
    return o;
  };
  /* a ringing partial (a bell, a cup) */
  const ring = (g, t, f, gain, decay) => {
    const o = c.createOscillator(),
      e = c.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(gain, t + 0.004);
    e.gain.setTargetAtTime(0, t + 0.004, decay / 3);
    o.connect(e);
    e.connect(g);
    o.start(t);
    o.stop(t + decay * 2);
    letGo(o, e);
    P.started++;
    return o;
  };
  /* a drop from the tracker's bank (a plink, a drip off the eaves) */
  const shot = (dest, b) =>
    T && T.sampleShot && T.sampleShot(dest, { inst: b.bank, midi: b.midi, t: b.t, vol: b.gain, rate: b.rate || 1 })
      ? P.started++
      : 0;

  /** the rain's patter: a drop on a leaf or the ground (logic/nature-sound.js naturePatter), now and then a plink */
  P.drop = (dest, e, level, bank) => {
    const g = out(dest, level, e.pan),
      s = burst(g, e.t, { type: 'bandpass', f: e.f, q: e.q, a: 0.0015, d: e.d, gain: e.gain });
    letGo(s, g);
    if (e.plink && bank) shot(g, { bank, midi: 88 + Math.floor(r() * 18), t: e.t + 0.004, gain: e.gain * 0.6 });
  };
  /** a drip off the eaves (logic/soundscape.js soundscapeBubbles from nature.rain.drips) */
  P.drip = (dest, b, level) => {
    const g = out(dest, level, b.pan || 0);
    shot(g, b);
    setTimeout(() => {
      try {
        g.disconnect();
        if (g.extra) g.extra.disconnect();
      } catch (e) {}
    }, 2000);
  };
  /** thunder after a bolt (logic/nature-sound.js natureThunder): each roll brown noise through a low-pass that
   * closes as it fades, rising softly (never a sudden edge); at most cap rolling at once. muffle: indoors */
  P.thunder = (dest, plan, t0, cap, muffle = 1) => {
    if (P.thunderLive >= cap) return false;
    P.thunderLive++;
    P.rolled++;
    const g = out(dest, muffle, 0);
    let last = null,
      end = t0;
    for (const p of plan.parts) {
      const t = t0 + p.at,
        s = c.createBufferSource(),
        F = filt('lowpass', p.lp * (0.6 + 0.4 * muffle), 0.6),
        e = c.createGain();
      s.buffer = env.noise.brown;
      F.frequency.setValueAtTime(p.lp * (0.6 + 0.4 * muffle), t);
      F.frequency.exponentialRampToValueAtTime(Math.max(60, p.lp * 0.45), t + p.a + p.dur);
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(p.gain, t + p.a);
      e.gain.setTargetAtTime(0, t + p.a, p.dur / 3);
      s.connect(F);
      F.connect(e);
      e.connect(g);
      s.start(t, r() * (s.buffer.duration - 2));
      s.stop(t + p.a + p.dur * 2);
      letGo(s, e);
      P.started++;
      if (t + p.a + p.dur * 2 >= end) {
        end = t + p.a + p.dur * 2;
        last = s;
      }
    }
    const done = { disconnect: () => (P.thunderLive = Math.max(0, P.thunderLive - 1)) };
    if (last) letGo(last, g, done);
    else done.disconnect();
    return true;
  };
  /** a grasshopper's pulse (one of a chirr's: logic/nature-sound.js natureBouts) */
  P.chirr = (dest, t, G, gain, pan) => {
    const g = out(dest, gain, pan),
      s = burst(g, t, { type: 'bandpass', f: G.f * (0.97 + r() * 0.06), q: G.q, a: 0.002, d: 0.012, gain: G.gain });
    letGo(s, g);
  };
  /** a cicada's swell: band-passed noise pulsing many times a second, rising and falling over dur s */
  P.cicada = (dest, t, C, gain, pan) => {
    const dur = C.dur[0] + (C.dur[1] - C.dur[0]) * r(),
      g = out(dest, gain, pan),
      s = c.createBufferSource(),
      F = filt('bandpass', C.f * (0.95 + r() * 0.1), C.q),
      sh = filt('highshelf', 4500, 0.7),
      e = c.createGain(),
      am = c.createGain(),
      o = c.createOscillator(),
      og = c.createGain();
    sh.gain.value = -9;
    s.buffer = env.noise.pink;
    o.type = 'square';
    o.frequency.value = C.rate * (0.9 + r() * 0.2);
    og.gain.value = 0.45;
    am.gain.value = 0.55;
    o.connect(og);
    og.connect(am.gain);
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(C.gain, t + dur * 0.35);
    e.gain.setValueAtTime(C.gain, t + dur * 0.6);
    e.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(F);
    F.connect(sh);
    sh.connect(am);
    am.connect(e);
    e.connect(g);
    s.start(t, r() * (s.buffer.duration - dur - 0.5));
    s.stop(t + dur + 0.05);
    o.start(t);
    o.stop(t + dur + 0.05);
    letGo(s, e, am, g);
    P.started += 2;
  };
  /** a frog's croak: two or three quick pulses of a low buzz through its formant */
  P.croak = (dest, t, F, gain, pan, who) => {
    const g = out(dest, gain, pan),
      f = F.f[0] + (F.f[1] - F.f[0]) * (who ? 0.75 : 0.2) * (0.94 + r() * 0.12),
      n = 2 + Math.floor(r() * 2);
    let o = null;
    for (let i = 0; i < n; i++)
      o = tone(g, t + i * 0.055, { f, slide: 0.9, dur: 0.045, a: 0.006, gain: F.gain, band: F.formant, q: 3 });
    if (o) letGo(o, g);
  };
  /** the town's life (logic/nature-sound.js natureTown): e {kind, pan, far 0-1, v 0-1}; far ones duller */
  P.town = (dest, e, gain) => {
    const lp = filt('lowpass', 900 + 3500 * (1 - e.far), 0.5);
    lp.connect(dest);
    const g = out(lp, gain * (1 - 0.55 * e.far), e.pan),
      t = e.t;
    let last = null;
    if (e.kind === 'door') {
      /* a creak and the latch */
      last = tone(g, t, { f: 150 + e.v * 60, slide: 1.35, dur: 0.28, a: 0.04, gain: 0.25, band: 900, q: 4 });
      last = burst(g, t + 0.3, { type: 'lowpass', f: 380, q: 0.7, a: 0.004, d: 0.07, gain: 0.5, brown: true });
    } else if (e.kind === 'cart') {
      /* wheels rumbling by on the cobbles: low noise that swells and passes, its pan crossing over */
      const s = c.createBufferSource(),
        F = filt('bandpass', 260 + e.v * 120, 0.9),
        en = c.createGain(),
        am = c.createGain(),
        o = c.createOscillator(),
        og = c.createGain(),
        dur = 3 + e.v * 2;
      s.buffer = env.noise.brown;
      o.frequency.value = 7 + e.v * 5;
      og.gain.value = 0.35;
      am.gain.value = 0.65;
      o.connect(og);
      og.connect(am.gain);
      en.gain.setValueAtTime(0, t);
      en.gain.linearRampToValueAtTime(0.9, t + dur * 0.5);
      en.gain.linearRampToValueAtTime(0, t + dur);
      s.connect(F);
      F.connect(am);
      am.connect(en);
      en.connect(g);
      if (g.extra && g.extra.pan) {
        g.extra.pan.setValueAtTime(-e.pan || -0.5, t);
        g.extra.pan.linearRampToValueAtTime(e.pan || 0.5, t + dur);
      }
      s.start(t, r() * (s.buffer.duration - dur - 0.5));
      s.stop(t + dur + 0.05);
      o.start(t);
      o.stop(t + dur + 0.05);
      letGo(s, en, am);
      P.started += 2;
      last = s;
    } else if (e.kind === 'voice') {
      /* someone calling across the street: two syllables through a vowel's two formants */
      const f = 190 + e.v * 120;
      tone(g, t, { f, slide: 1.08, dur: 0.2, a: 0.03, gain: 0.3, band: 750, q: 3, vib: 5 });
      tone(g, t, { f, slide: 1.08, dur: 0.2, a: 0.03, gain: 0.12, band: 1250, q: 4 });
      tone(g, t + 0.27, { f: f * 0.85, slide: 0.9, dur: 0.32, a: 0.04, gain: 0.3, band: 650, q: 3, vib: 5 });
      last = tone(g, t + 0.27, { f: f * 0.85, slide: 0.9, dur: 0.32, a: 0.04, gain: 0.1, band: 1000, q: 4 });
    } else if (e.kind === 'dog') {
      /* a dog a few gardens away: two or three barks */
      const n = 2 + Math.floor(e.v * 2);
      for (let i = 0; i < n; i++) {
        const at = t + i * (0.32 + r() * 0.1);
        tone(g, at, { f: 420 + e.v * 80, slide: 0.65, dur: 0.11, a: 0.008, gain: 0.35, band: 950, q: 1.6 });
        last = burst(g, at, { type: 'bandpass', f: 1300, q: 1, a: 0.004, d: 0.06, gain: 0.12 });
      }
    } else if (e.kind === 'bell') {
      /* a bell in a tower somewhere: its partials dying away, struck once to three times */
      const f = 480 + e.v * 220,
        n = 1 + Math.floor(e.v * 3);
      for (let i = 0; i < n; i++) {
        const at = t + i * 1.5;
        ring(g, at, f, 0.22, 2.2);
        ring(g, at, f * 2.76, 0.07, 1.1);
        last = ring(g, at, f * 5.4, 0.025, 0.5);
      }
    }
    if (last) letGo(last, g, lp);
    P.started++;
  };
  /** a room's small sounds: a page turning, a cup set down, a tool's tick, straw shifting */
  P.room = (dest, kind, gain, t) => {
    const g = out(dest, gain, (r() * 2 - 1) * 0.6);
    let last = null;
    if (kind === 'page') last = burst(g, t, { type: 'highpass', f: 2200, q: 0.6, a: 0.06, d: 0.18, gain: 0.25 });
    else if (kind === 'clink') {
      const f = 2600 + r() * 900;
      ring(g, t, f, 0.06, 0.25);
      last = ring(g, t, f * 1.48, 0.03, 0.18);
      if (r() < 0.5) last = ring(g, t + 0.09 + r() * 0.05, f * 1.1, 0.035, 0.2);
    } else if (kind === 'tool') {
      const n = 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++)
        last = burst(g, t + i * (0.12 + r() * 0.1), {
          type: 'bandpass',
          f: 1600 + r() * 600,
          q: 6,
          a: 0.001,
          d: 0.025,
          gain: 0.5,
        });
    } else if (kind === 'straw') last = burst(g, t, { type: 'bandpass', f: 1500, q: 0.6, a: 0.12, d: 0.35, gain: 0.3 });
    if (last) letGo(last, g);
  };
  /** a footstep (logic/nature-sound.js natureStep): its hits, each a short burst of the beds' noise (brown under a
   * low-pass, else pink), the foot a little left or right */
  P.step = (dest, S, t) => {
    const g = out(dest, 1, S.pan);
    let last = null;
    for (const h of S.hits)
      last = burst(g, t + h.at, {
        type: h.type === 'lp' ? 'lowpass' : h.type === 'hp' ? 'highpass' : 'bandpass',
        f: h.f,
        q: h.q,
        a: h.a || 0.001,
        d: h.dur,
        gain: h.vol,
        brown: h.type === 'lp',
      });
    if (last) letGo(last, g);
  };
  /* what the debug log says (no save data): sources started and thunder rolls so far */
  P.stats = () => ({ started: P.started, thunder: P.rolled, thunderLive: P.thunderLive });
  return P;
}
