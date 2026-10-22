'use strict';
/* ================= SOUND AND MUSIC =================
   Everything is synthesized with the Web Audio API: no sound files. Music is a small tracker: each song is a key, a
   tempo, a chord progression and a style; the melody is composed from the chords with a seeded random walk (so a
   song is the same every time), over a bass line, arpeggios or pads and drums. Sound effects are short synth
   recipes. Browsers only allow sound after the player touches the page, so nothing plays until the first tap.
   Settings → Music and Sound effects set the volumes (0 mutes). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { cutscene, mapIdAt, provide } from './hooks.js';
import { clamp } from './util.js';
import { LOCATIONS } from './game-data.js';
import { activeBattle, saveData, uiState } from './game-state.js';
import { battleStage } from './battle-stage.js';
import {
  FOOTSTEP_M,
  baseMapId,
  bridgeAt,
  mapBridges,
  mapById,
  stepWallAt,
  terrainAt,
  walkData,
  walkView,
} from './walk-view.js';
import { environment, environmentHour, environmentState } from './environment.js';
import { walkRenderer } from './walk/walk-state.js';
import { soundLevel, soundLevels } from './audio/levels.js';
/* eslint-disable no-func-assign */
expose({
  BIRD_CALLS: [() => BIRD_CALLS],
  JINGLES: [() => JINGLES],
  RARE_BIRDS: [() => RARE_BIRDS],
  SCALES: [() => SCALES],
  SONGS: [() => SONGS],
  ambience: [() => ambience],
  ambienceBeds: [() => ambienceBeds, v => (ambienceBeds = v)],
  ambienceFadeIn: [() => ambienceFadeIn, v => (ambienceFadeIn = v)],
  ambienceOutput: [() => ambienceOutput, v => (ambienceOutput = v)],
  applyAmbienceVolume: [() => applyAmbienceVolume, v => ((applyAmbienceVolume = v), provide({ applyAmbienceVolume }))],
  applyVolumes: [() => applyVolumes, v => ((applyVolumes = v), provide({ applyVolumes }))],
  battleSoundEffect: [() => battleSoundEffect, v => ((battleSoundEffect = v), provide({ battleSoundEffect }))],
  composeSong: [() => composeSong, v => (composeSong = v)],
  footstepAt: [() => footstepAt, v => (footstepAt = v)],
  initAmbience: [() => initAmbience, v => (initAmbience = v)],
  initSound: [() => initSound, v => (initSound = v)],
  jingle: [() => jingle, v => ((jingle = v), provide({ jingle }))],
  midiToFrequency: [() => midiToFrequency],
  music: [() => music, v => (music = v)],
  musicFor: [() => musicFor, v => (musicFor = v)],
  musicStop: [() => musicStop, v => (musicStop = v)],
  musicSync: [() => musicSync, v => (musicSync = v)],
  musicTick: [() => musicTick, v => (musicTick = v)],
  nearestSoundSource: [() => nearestSoundSource, v => (nearestSoundSource = v)],
  playBirdCall: [() => playBirdCall, v => (playBirdCall = v)],
  playClockTick: [() => playClockTick, v => (playClockTick = v)],
  playOwlCall: [() => playOwlCall, v => (playOwlCall = v)],
  playScrapClank: [() => playScrapClank, v => (playScrapClank = v)],
  songRandom: [() => songRandom, v => (songRandom = v)],
  soundEffect: [() => soundEffect, v => ((soundEffect = v), provide({ soundEffect }))],
  soundEffectAt: [() => soundEffectAt, v => ((soundEffectAt = v), provide({ soundEffectAt }))],
  soundEngine: [() => soundEngine],
  soundPlacement: [() => soundPlacement, v => (soundPlacement = v)],
  soundPreferences: [() => soundPreferences],
  synthKick: [() => synthKick, v => (synthKick = v)],
  synthNoise: [() => synthNoise, v => (synthNoise = v)],
  synthVoice: [() => synthVoice, v => (synthVoice = v)],
  testVolume: [() => testVolume, v => ((testVolume = v), provide({ testVolume }))],
  unlockSound: [() => unlockSound, v => (unlockSound = v)],
  updateAmbience: [() => updateAmbience, v => (updateAmbience = v)],
  volumePreference: [() => volumePreference, v => (volumePreference = v)],
});
/* eslint-enable no-func-assign */
provide({ applyAmbienceVolume, applyVolumes, battleSoundEffect, jingle, soundEffect, soundEffectAt, testVolume });
/* to-module: end */
export const soundEngine = {
  ctx: null,
  master: null,
  mus: null,
  fx: null,
  noise: null,
  waves: {},
  song: null,
  want: null,
  timer: null,
  step: 0,
  next: 0,
  voices: [],
  lastStep: 0,
};
/* SND-1: the volume maths is audio/levels.js (soundLevel, soundLevels); this reads the save's preferences for it */
const soundPreferences = () => (typeof saveData !== 'undefined' && saveData && saveData.preferences) || {};
function volumePreference(k) {
  return soundLevel(soundPreferences(), k);
}
function initSound() {
  if (soundEngine.ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try {
    const c = new AC();
    soundEngine.ctx = c;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    comp.connect(c.destination);
    soundEngine.master = c.createGain();
    soundEngine.master.gain.value = 0.9;
    soundEngine.master.connect(comp);
    soundEngine.mus = c.createGain();
    soundEngine.fx = c.createGain();
    /* v27: a filter on the music, closed a little in the rain */ soundEngine.musLP = c.createBiquadFilter();
    soundEngine.musLP.type = 'lowpass';
    soundEngine.musLP.frequency.value = 20000;
    soundEngine.mus.connect(soundEngine.musLP);
    soundEngine.musLP.connect(soundEngine.master);
    soundEngine.fx.connect(soundEngine.master);
    applyVolumes();
    /* a soft echo for the music (caves get more of it) */
    const d = c.createDelay(1),
      fb = c.createGain(),
      wet = c.createGain();
    d.delayTime.value = 0.27;
    fb.gain.value = 0.28;
    wet.gain.value = 0.16;
    soundEngine.echoIn = c.createGain();
    soundEngine.echoIn.connect(d);
    d.connect(fb);
    fb.connect(d);
    d.connect(wet);
    wet.connect(soundEngine.mus);
    soundEngine.echoWet = wet;
    const n = c.createBuffer(1, c.sampleRate, c.sampleRate),
      nd = n.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    soundEngine.noise = n;
    const pw = duty => {
      const N = 32,
        re = new Float32Array(N),
        im = new Float32Array(N);
      for (let k = 1; k < N; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
      return c.createPeriodicWave(re, im);
    };
    soundEngine.waves.p25 = pw(0.25);
    soundEngine.waves.p12 = pw(0.125);
    soundEngine.waves.p50 = pw(0.5);
    if (typeof debugLog !== 'undefined') debugLog.add('audio', 'ready ' + c.sampleRate + ' Hz');
    return true;
  } catch (e) {
    soundEngine.ctx = null;
    return false;
  }
}
/* alpha 0.5: a master volume and mute over everything (music, effects, world sounds, ambience all go through the master) */
function applyVolumes() {
  if (!soundEngine.ctx) return;
  const L = soundLevels(soundPreferences()),
    t = soundEngine.ctx.currentTime;
  soundEngine.master.gain.setTargetAtTime(L.master, t, 0.05);
  soundEngine.mus.gain.setTargetAtTime(L.music, t, 0.05);
  soundEngine.fx.gain.setTargetAtTime(L.sfx, t, 0.05);
}
/* the first touch unlocks sound; the song that was asked for starts then */
function unlockSound() {
  if (!initSound()) return;
  if (soundEngine.ctx.state === 'suspended') soundEngine.ctx.resume();
  if (soundEngine.want && !soundEngine.song) music(soundEngine.want);
}
['pointerdown', 'keydown', 'touchend'].forEach(e => addEventListener(e, unlockSound, { capture: true, passive: true }));
document.addEventListener('visibilitychange', () => {
  if (!soundEngine.ctx) return;
  if (document.hidden) soundEngine.ctx.suspend();
  else soundEngine.ctx.resume();
});
const midiToFrequency = m => 440 * Math.pow(2, (m - 69) / 12);
/* ---------- instruments ---------- */
function synthVoice(
  bus,
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
) {
  const c = soundEngine.ctx,
    o = c.createOscillator(),
    g = c.createGain();
  if (soundEngine.waves[type]) o.setPeriodicWave(soundEngine.waves[type]);
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
  let out = g;
  if (cut) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cut;
    g.connect(f);
    out = f;
  }
  o.connect(g);
  out.connect(bus);
  if (echo && soundEngine.echoIn) {
    const e = c.createGain();
    e.gain.value = echo;
    out.connect(e);
    e.connect(soundEngine.echoIn);
  }
  o.start(t);
  o.stop(t + Math.max(a + d, dur) + r + 0.02);
}
function synthNoise(bus, { t, dur = 0.05, vol = 0.2, hp = 0, lp = 0, bp = 0, q = 1 }) {
  const c = soundEngine.ctx,
    s = c.createBufferSource(),
    g = c.createGain();
  s.buffer = soundEngine.noise;
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
  g.connect(bus);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}
function synthKick(bus, t, v = 0.5) {
  const c = soundEngine.ctx,
    o = c.createOscillator(),
    g = c.createGain();
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o.connect(g);
  g.connect(bus);
  o.start(t);
  o.stop(t + 0.22);
}

/* ---------- songs ---------- */
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixo: [0, 2, 4, 5, 7, 9, 10],
};
const SONGS = {
  town: {
    bpm: 100,
    key: 60,
    scale: 'major',
    prog: [0, 5, 3, 4, 0, 5, 1, 4],
    lead: 'p25',
    bass: 'bounce',
    arp: 'up',
    drums: 'soft',
    seed: 3,
    swing: 0.08,
  },
  route: {
    bpm: 122,
    key: 67,
    scale: 'major',
    prog: [0, 3, 5, 4, 0, 3, 1, 4],
    lead: 'p25',
    bass: 'gallop',
    arp: 'updown',
    drums: 'skip',
    seed: 11,
  },
  cave: {
    bpm: 80,
    key: 57,
    scale: 'dorian',
    prog: [0, 6, 5, 6, 0, 3, 6, 4],
    lead: 'triangle',
    bass: 'long',
    arp: 'drip',
    drums: 'none',
    seed: 21,
    echo: 0.55,
  },
  city: {
    bpm: 116,
    key: 63,
    scale: 'mixo',
    prog: [0, 3, 4, 3, 0, 5, 3, 4],
    lead: 'p50',
    bass: 'walk',
    arp: 'chord7',
    drums: 'skip',
    seed: 91,
    seventh: 1,
    swing: 0.06,
  },
  mall: {
    bpm: 108,
    key: 65,
    scale: 'lydian',
    prog: [0, 1, 2, 1, 0, 1, 3, 4],
    lead: 'p50',
    bass: 'walk',
    arp: 'chord7',
    drums: 'bossa',
    seed: 31,
    seventh: 1,
  },
  hazel: {
    bpm: 88,
    key: 65,
    scale: 'major',
    prog: [0, 3, 4, 0, 5, 3, 1, 4],
    lead: 'triangle',
    bass: 'long',
    arp: 'up',
    drums: 'none',
    seed: 41,
    echo: 0.3,
  },
  map: {
    bpm: 96,
    key: 62,
    scale: 'mixo',
    prog: [0, 6, 3, 0, 0, 6, 4, 4],
    lead: 'p25',
    bass: 'long',
    arp: 'updown',
    drums: 'soft',
    seed: 51,
  },
  wild: {
    bpm: 152,
    key: 64,
    scale: 'minor',
    prog: [0, 5, 6, 0, 0, 5, 3, 4],
    lead: 'p25',
    bass: 'drive',
    arp: 'up',
    drums: 'drive',
    seed: 61,
  },
  trainer: {
    bpm: 162,
    key: 62,
    scale: 'minor',
    prog: [0, 3, 6, 2, 0, 3, 4, 4],
    lead: 'p12',
    bass: 'drive',
    arp: 'updown',
    drums: 'march',
    seed: 71,
  },
  rival: {
    bpm: 146,
    key: 59,
    scale: 'minor',
    prog: [0, 6, 5, 6, 0, 6, 3, 4],
    lead: 'p25',
    bass: 'drive',
    arp: 'up',
    drums: 'drive',
    seed: 81,
  },
  /* v47: the title, the fall into the Hollow Earth, the Variants, the Inner Sun */
  title: {
    bpm: 92,
    key: 62,
    scale: 'major',
    prog: [0, 4, 5, 3, 0, 4, 1, 4],
    lead: 'p25',
    bass: 'long',
    arp: 'updown',
    drums: 'soft',
    seed: 7,
    echo: 0.35,
  },
  fall: {
    bpm: 72,
    key: 57,
    scale: 'dorian',
    prog: [0, 6, 5, 6, 0, 3, 6, 4],
    lead: 'triangle',
    bass: 'long',
    arp: 'drip',
    drums: 'none',
    seed: 13,
    echo: 0.6,
  },
  variants: {
    bpm: 132,
    key: 61,
    scale: 'minor',
    prog: [0, 5, 3, 6, 0, 5, 4, 4],
    lead: 'p12',
    bass: 'bounce',
    arp: 'chord7',
    drums: 'march',
    seed: 23,
    seventh: 1,
  },
  innersun: {
    bpm: 140,
    key: 64,
    scale: 'mixo',
    prog: [0, 6, 3, 4, 0, 6, 5, 4],
    lead: 'p25',
    bass: 'drive',
    arp: 'updown',
    drums: 'drive',
    seed: 29,
  },
  /* v47 part 4: a song for each region (a place names it as "music") */
  meadow: {
    bpm: 112,
    key: 67,
    scale: 'lydian',
    prog: [0, 3, 4, 0, 5, 3, 4, 4],
    lead: 'triangle',
    bass: 'bounce',
    arp: 'updown',
    drums: 'soft',
    seed: 101,
    swing: 0.1,
  },
  hills: {
    bpm: 100,
    key: 65,
    scale: 'mixo',
    prog: [0, 4, 3, 0, 5, 4, 3, 4],
    lead: 'p50',
    bass: 'walk',
    arp: 'chord7',
    drums: 'bossa',
    seed: 111,
    seventh: 1,
    swing: 0.08,
  },
  spore: {
    bpm: 84,
    key: 59,
    scale: 'dorian',
    prog: [0, 3, 6, 3, 0, 5, 6, 4],
    lead: 'triangle',
    bass: 'long',
    arp: 'drip',
    drums: 'soft',
    seed: 121,
    echo: 0.45,
  },
  crystal: {
    bpm: 90,
    key: 57,
    scale: 'dorian',
    prog: [0, 5, 3, 6, 0, 5, 4, 4],
    lead: 'triangle',
    bass: 'long',
    arp: 'drip',
    drums: 'soft',
    seed: 131,
    echo: 0.5,
  },
  trench: {
    bpm: 84,
    key: 55,
    scale: 'minor',
    prog: [0, 6, 3, 4, 0, 6, 5, 4],
    lead: 'p50',
    bass: 'long',
    arp: 'updown',
    drums: 'soft',
    seed: 141,
    echo: 0.45,
    swing: 0.06,
  },
  spire: {
    bpm: 124,
    key: 62,
    scale: 'lydian',
    prog: [0, 4, 5, 3, 0, 4, 1, 4],
    lead: 'p12',
    bass: 'bounce',
    arp: 'chord7',
    drums: 'skip',
    seed: 151,
    seventh: 1,
  },
  /* alpha 0.4: Copperleaf, the hamlet where it all starts: an easy, swinging tune for round doors and beehives */
  copperleaf: {
    bpm: 94,
    key: 67,
    scale: 'major',
    prog: [0, 4, 5, 3, 0, 4, 3, 4],
    lead: 'p25',
    bass: 'bounce',
    arp: 'up',
    drums: 'soft',
    seed: 171,
    swing: 0.14,
    echo: 0.25,
  },
};
/* a seeded random number generator, so a song is composed the same way every time */
function songRandom(seed) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
function composeSong(name) {
  const D = SONGS[name];
  if (!D) return null;
  if (D.notes) return D;
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
  return Object.assign(D, { notes: lead, steps, deg });
}
export function music(name) {
  soundEngine.want = name;
  if (!soundEngine.ctx || soundEngine.ctx.state !== 'running') {
    return;
  }
  if (soundEngine.song && soundEngine.song.name === name) return;
  const D = composeSong(name);
  if (!D) return;
  if (soundEngine.song) {
    const old = soundEngine.song;
    old.fade = soundEngine.ctx.currentTime;
  }
  soundEngine.song = { name, D, step: 0, next: soundEngine.ctx.currentTime + 0.08, gain: soundEngine.ctx.createGain() };
  soundEngine.song.gain.connect(soundEngine.mus);
  soundEngine.song.drums = soundEngine.ctx.createGain();
  soundEngine.song.drums.gain.value = soundEngine.L ? soundEngine.L.drums : 1;
  soundEngine.song.drums.connect(soundEngine.song.gain);
  soundEngine.song.gain.gain.setValueAtTime(0, soundEngine.ctx.currentTime);
  soundEngine.song.gain.gain.linearRampToValueAtTime(1, soundEngine.ctx.currentTime + 0.6);
  for (const v of soundEngine.voices) {
    const t = soundEngine.ctx.currentTime;
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setValueAtTime(v.gain.gain.value, t);
    v.gain.gain.linearRampToValueAtTime(0, t + 0.5);
    setTimeout(() => v.gain.disconnect(), 700);
  }
  soundEngine.voices = [soundEngine.song];
  if (!soundEngine.timer) soundEngine.timer = setInterval(musicTick, 25);
}
function musicStop() {
  if (soundEngine.song) {
    const t = soundEngine.ctx.currentTime,
      g = soundEngine.song.gain;
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 0.4);
    setTimeout(() => g.disconnect(), 600);
  }
  soundEngine.song = null;
  soundEngine.want = null;
  soundEngine.voices = [];
}
function musicTick() {
  const c = soundEngine.ctx,
    sg = soundEngine.song;
  if (!c || !sg) return;
  const D = sg.D,
    spb = 60 / D.bpm / 4;
  while (sg.next < c.currentTime + 0.14) {
    const st = sg.step % D.steps,
      b = Math.floor(st / 16),
      i = st % 16,
      t = sg.next + (i % 2 ? spb * (D.swing || 0) : 0),
      bus = sg.gain,
      ch = D.prog[b],
      dg = D.deg;
    /* lead */ const L = D.notes[st];
    if (L)
      synthVoice(bus, {
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
      synthVoice(bus, {
        type: 'triangle',
        freq: midiToFrequency(i % 8 ? root + 7 : root),
        t,
        dur: spb * 3,
        vol: 0.2,
        s: 0.7,
      });
    else if (bs === 'gallop' && [0, 3, 4, 8, 11, 12].includes(i))
      synthVoice(bus, {
        type: 'triangle',
        freq: midiToFrequency(i % 8 === 4 ? root + 12 : root),
        t,
        dur: spb * 1.5,
        vol: 0.2,
      });
    else if (bs === 'long' && i === 0)
      synthVoice(bus, {
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
      synthVoice(bus, {
        type: 'triangle',
        freq: midiToFrequency(dg(ch + [0, 2, 4, 5][i / 4]) - 24),
        t,
        dur: spb * 3.5,
        vol: 0.2,
      });
    else if (bs === 'drive' && i % 2 === 0)
      synthVoice(bus, {
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
      synthVoice(bus, {
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
      synthVoice(bus, {
        type: 'p12',
        freq: midiToFrequency(pick(seq[k % 8]) + 12),
        t,
        dur: spb * 1.2,
        vol: 0.035,
        s: 0.3,
        echo: 0.15,
      });
    } else if (ar === 'drip' && (i === 0 || i === 6 || i === 11))
      synthVoice(bus, {
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
        synthVoice(bus, {
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
      if (i === 0 || i === 8) synthKick(db, t, 0.25);
      if (i === 4 || i === 12) synthNoise(db, { t, dur: 0.08, vol: 0.08, bp: 1800, q: 0.8 });
      if (i % 4 === 2) synthNoise(db, { t, dur: 0.03, vol: 0.04, hp: 7000 });
    } else if (dr === 'skip') {
      if (i === 0 || i === 10) synthKick(db, t, 0.3);
      if (i === 4 || i === 12) synthNoise(db, { t, dur: 0.1, vol: 0.1, bp: 2000, q: 0.7 });
      if (i % 2 === 0) synthNoise(db, { t, dur: 0.025, vol: 0.035, hp: 8000 });
    } else if (dr === 'drive') {
      if (i % 4 === 0) synthKick(db, t, 0.42);
      if (i === 4 || i === 12) synthNoise(db, { t, dur: 0.12, vol: 0.14, bp: 1800, q: 0.6 });
      synthNoise(db, { t, dur: 0.02, vol: i % 2 ? 0.025 : 0.045, hp: 8000 });
    } else if (dr === 'march') {
      if (i === 0 || i === 8 || i === 11) synthKick(db, t, 0.42);
      if (i % 4 === 2 || i === 14 || i === 15) synthNoise(db, { t, dur: 0.07, vol: 0.11, bp: 2400, q: 0.8 });
      if (i % 2 === 0) synthNoise(db, { t, dur: 0.02, vol: 0.03, hp: 9000 });
    } else if (dr === 'bossa') {
      if (i === 0 || i === 6 || i === 8 || i === 14) synthKick(db, t, 0.2);
      if ([3, 6, 10, 13].includes(i)) synthNoise(db, { t, dur: 0.03, vol: 0.05, bp: 3500, q: 2 });
    }
    /* v27: a soft pad under the night */ if (i === 0 && soundEngine.L && soundEngine.L.pad > 0.05)
      [0, 2, 4].forEach(x =>
        synthVoice(bus, {
          type: 'sine',
          freq: midiToFrequency(dg(ch + x) - 12),
          t,
          dur: spb * 15,
          vol: 0.022 * soundEngine.L.pad,
          a: 0.6,
          s: 0.9,
          r: 0.8,
        })
      );
    sg.step++;
    sg.next += spb;
  }
}
/* the music that fits where you are */
export function musicFor() {
  if (typeof saveData === 'undefined' || !saveData || !saveData.started) return 'hazel';
  if (typeof activeBattle !== 'undefined' && activeBattle)
    return activeBattle.kind === 'trainer'
      ? activeBattle.T && activeBattle.T.who === 'chad'
        ? 'rival'
        : 'trainer'
      : 'wild';
  if (uiState.tab === 'map') return 'map';
  const id = typeof mapIdAt === 'function' ? mapIdAt(saveData.trip.node) : null,
    sc = id && mapById(id),
    r = LOCATIONS[saveData.trip.node];
  if (sc && sc.indoor) return /lanternhall|pepperpot/.test(id) ? 'mall' : 'cave';
  if (r && r.music && SONGS[r.music]) return r.music;
  /* v47: a place's own song */ if (/lanternhall|pepperpot/.test(id || '')) return 'mall';
  if (id === 'verdigris' || (r && r.t === 'city')) return 'city';
  return r && r.town ? 'town' : 'route';
}
function musicSync() {
  if (typeof cutscene !== 'undefined' && cutscene.on) return;
  if (soundEngine.jingle && performance.now() < soundEngine.jingle) return;
  music(musicFor());
}
setInterval(() => {
  try {
    musicSync();
  } catch (e) {}
}, 1000);
/* a short tune that plays once (victory, level up, evolution), after which the place's music comes back */
export function jingle(notes, bpm = 150, type = 'p25') {
  if (!initSound() || soundEngine.ctx.state !== 'running') return;
  const c = soundEngine.ctx,
    spb = 60 / bpm / 4,
    t0 = c.currentTime + 0.05;
  let t = t0;
  if (soundEngine.song) {
    const g = soundEngine.song.gain.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(g.value, t0);
    g.linearRampToValueAtTime(0.15, t0 + 0.1);
  }
  for (const [n, l] of notes) {
    if (n)
      (synthVoice(soundEngine.fx, {
        type,
        freq: midiToFrequency(n),
        t,
        dur: l * spb * 0.9,
        vol: 0.12,
        s: 0.6,
        echo: 0.2,
      }),
        n &&
          synthVoice(soundEngine.fx, {
            type: 'triangle',
            freq: midiToFrequency(n - 12),
            t,
            dur: l * spb * 0.9,
            vol: 0.12,
          }));
    t += l * spb;
  }
  const end = t - c.currentTime;
  soundEngine.jingle = performance.now() + end * 1000 + 200;
  if (soundEngine.song) {
    const g = soundEngine.song.gain.gain;
    g.linearRampToValueAtTime(0.15, t);
    g.linearRampToValueAtTime(1, t + 0.8);
  }
}
export const JINGLES = {
  victory: [
    [72, 2],
    [76, 2],
    [79, 2],
    [84, 6],
    [83, 2],
    [84, 8],
  ],
  levelup: [
    [72, 1],
    [76, 1],
    [79, 1],
    [84, 3],
  ],
  evolve: [
    [67, 2],
    [71, 2],
    [74, 2],
    [79, 2],
    [83, 2],
    [86, 6],
  ],
  caught: [
    [79, 2],
    [84, 2],
    [88, 4],
    [86, 2],
    [88, 6],
  ],
  hatch: [
    [76, 2],
    [79, 2],
    [84, 4],
  ],
};
provide({ JINGLES }); /* to-module */
/* ---------- sound effects ---------- */
export function soundEffect(name, o = {}) {
  if (!soundEngine.ctx || soundEngine.ctx.state !== 'running') return;
  const c = soundEngine.ctx,
    t = c.currentTime + 0.005,
    F = soundEngine.fx;
  switch (name) {
    case 'tick':
      synthVoice(F, { type: 'p50', freq: 1320, t, dur: 0.025, vol: 0.05, r: 0.02 });
      break;
    case 'blip': {
      let h = 0;
      for (const ch of String(o.who || '')) h = (h * 31 + ch.charCodeAt(0)) % 997;
      const base =
        o.who === 'gini' ? 72 : o.who === 'me' ? 67 : /^folk/.test(o.who || '') ? 62 + (h % 10) : 60 + (h % 14);
      synthVoice(F, {
        type: 'p25',
        freq: midiToFrequency(base + [0, 2, 4, 7][Math.floor(Math.random() * 4)]),
        t,
        dur: 0.035,
        vol: 0.045,
        r: 0.02,
      });
      break;
    }
    case 'step': {
      if (o.ter === 'n') {
        synthNoise(F, { t, dur: 0.07, vol: 0.07, bp: 2600, q: 0.9 });
        synthNoise(F, { t: t + 0.025, dur: 0.05, vol: 0.05, bp: 4200, q: 1.2 });
        break;
      }
      if (o.ter === 'wet') {
        synthNoise(F, { t, dur: 0.09, vol: 0.07, bp: 1500, q: 0.5 });
        synthNoise(F, { t: t + 0.03, dur: 0.06, vol: 0.04, hp: 5000 });
        break;
      }
      const k = o.ter || 'g',
        soft = /[gGftn]/.test(k),
        wood = k === 'b';
      synthNoise(F, {
        t,
        dur: soft ? 0.05 : wood ? 0.06 : 0.035,
        vol: soft ? 0.05 : wood ? 0.08 : 0.07,
        bp: soft ? 900 : wood ? 520 : 2200,
        q: soft ? 0.6 : wood ? 2.2 : 1.4,
      });
      break;
    }
    case 'throw':
      synthVoice(F, { type: 'p25', freq: 600, t, dur: 0.18, vol: 0.06, slide: 2.4 });
      synthNoise(F, { t, dur: 0.15, vol: 0.05, hp: 3000 });
      break;
    case 'pop':
      synthVoice(F, { type: 'p50', freq: 900, t, dur: 0.05, vol: 0.07, slide: 1.6 });
      synthNoise(F, { t: t + 0.02, dur: 0.1, vol: 0.08, bp: 4000, q: 1 });
      break;
    case 'coin':
      [0, 4, 7, 12].forEach((n, i) =>
        synthVoice(F, { type: 'p50', freq: midiToFrequency(84 + n), t: t + i * 0.04, dur: 0.05, vol: 0.05 })
      );
      break;
    case 'hit':
      synthNoise(F, { t, dur: 0.12, vol: 0.25, lp: 1800 });
      synthVoice(F, { type: 'square', freq: 180, t, dur: 0.08, vol: 0.08, slide: 0.4 });
      break;
    case 'super':
      synthNoise(F, { t, dur: 0.2, vol: 0.3, lp: 3000 });
      synthVoice(F, { type: 'square', freq: 260, t, dur: 0.12, vol: 0.1, slide: 0.3 });
      synthVoice(F, { type: 'p25', freq: 880, t: t + 0.05, dur: 0.1, vol: 0.05, slide: 1.5 });
      break;
    case 'weak':
      synthNoise(F, { t, dur: 0.08, vol: 0.14, lp: 900 });
      break;
    case 'crit':
      synthNoise(F, { t, dur: 0.25, vol: 0.32, lp: 4000 });
      synthVoice(F, { type: 'square', freq: 1200, t, dur: 0.15, vol: 0.06, slide: 0.25 });
      synthKick(F, t, 0.5);
      break;
    case 'miss':
      synthNoise(F, { t, dur: 0.25, vol: 0.07, bp: 600, q: 0.5 });
      break;
    /* v47: the opening: the ground giving way, the long fall, the landing */
    case 'rumble':
      synthNoise(F, { t, dur: 1.4, vol: 0.22, lp: 220 });
      synthKick(F, t, 0.35);
      synthKick(F, t + 0.45, 0.3);
      synthKick(F, t + 0.9, 0.25);
      break;
    case 'crack':
      synthNoise(F, { t, dur: 0.35, vol: 0.3, bp: 1400, q: 0.7 });
      synthNoise(F, { t: t + 0.08, dur: 0.4, vol: 0.18, lp: 600 });
      synthKick(F, t, 0.45);
      break;
    case 'whoosh':
      synthNoise(F, { t, dur: o.dur || 1.6, vol: 0.12, bp: 700, q: 0.4 });
      synthNoise(F, { t: t + 0.2, dur: (o.dur || 1.6) * 0.8, vol: 0.07, hp: 2400 });
      break;
    case 'thud':
      synthKick(F, t, 0.7);
      synthNoise(F, { t, dur: 0.5, vol: 0.28, lp: 500 });
      synthNoise(F, { t: t + 0.05, dur: 0.6, vol: 0.1, bp: 2600, q: 0.5 });
      break;
    case 'faint':
      synthVoice(F, { type: 'p25', freq: 520, t, dur: 0.6, vol: 0.08, slide: 0.25 });
      break;
    case 'enc':
      [0, 7].forEach((n, i) =>
        synthVoice(F, { type: 'p25', freq: midiToFrequency(76 + n), t: t + i * 0.09, dur: 0.08, vol: 0.08 })
      );
      break;
    case 'heal':
      [0, 4, 7, 11, 14].forEach((n, i) =>
        synthVoice(F, { type: 'sine', freq: midiToFrequency(79 + n), t: t + i * 0.06, dur: 0.12, vol: 0.06, echo: 0.4 })
      );
      break;
    case 'status':
      synthVoice(F, { type: 'p12', freq: 300, t, dur: 0.3, vol: 0.06, vib: 3 });
      break;
    case 'stat':
      synthVoice(F, { type: 'p25', freq: o.down ? 600 : 400, t, dur: 0.25, vol: 0.06, slide: o.down ? 0.5 : 2 });
      break;
    case 'buy':
      [0, 7, 12].forEach((n, i) =>
        synthVoice(F, { type: 'p50', freq: midiToFrequency(79 + n), t: t + i * 0.05, dur: 0.06, vol: 0.05 })
      );
      synthNoise(F, { t: t + 0.15, dur: 0.15, vol: 0.05, hp: 5000 });
      break;
    case 'wobble':
      synthVoice(F, { type: 'triangle', freq: 300, t, dur: 0.06, vol: 0.1, slide: 0.8 });
      synthNoise(F, { t, dur: 0.04, vol: 0.06, bp: 1200 });
      break;
    case 'run':
      synthNoise(F, { t, dur: 0.3, vol: 0.08, bp: 700, q: 0.4 });
      break;
    case 'door':
      synthNoise(F, { t, dur: 0.08, vol: 0.08, lp: 600 });
      synthNoise(F, { t: t + 0.1, dur: 0.06, vol: 0.06, lp: 500 });
      break;
    case 'cry': {
      let h = 0;
      for (const ch of String(o.sp || '')) h = (h * 31 + ch.charCodeAt(0)) % 997;
      const b = 48 + (h % 24);
      synthVoice(F, {
        type: ['p25', 'p12', 'p50', 'square'][h % 4],
        freq: midiToFrequency(b),
        t,
        dur: 0.18,
        vol: 0.07,
        slide: 1.5 + (h % 5) * 0.2,
        vib: 2,
      });
      synthVoice(F, { type: 'p25', freq: midiToFrequency(b + 5), t: t + 0.17, dur: 0.2, vol: 0.06, slide: 0.6 });
      break;
    }
  }
}
/* battle animations make their sounds */
function battleSoundEffect(an, r) {
  if (!an || !soundEngine.ctx) return;
  const at = (ms, f) => setTimeout(f, Math.max(0, ms / (typeof battleStage !== 'undefined' ? battleStage.speed : 1)));
  switch (an.k) {
    case 'wild':
      soundEffect('enc');
      break;
    case 'cry': {
      const s = typeof battleStage !== 'undefined' && battleStage.s[an.si || 1];
      soundEffect('cry', { sp: s && s.sp });
      break;
    }
    case 'enter':
      soundEffect('throw');
      at(380, () => soundEffect('pop'));
      break;
    case 'faint':
      soundEffect('faint');
      break;
    case 'heal':
      soundEffect('heal');
      break;
    case 'status':
      soundEffect('status');
      break;
    case 'stat':
      soundEffect('stat', { down: an.n < 0 || an.down });
      break;
    case 'move':
      if (an.miss) {
        at(r.hit || 300, () => soundEffect('miss'));
        break;
      }
      if (an.self || an.protect) {
        soundEffect('status');
        break;
      }
      at(r.hit || 300, () => soundEffect(an.crit ? 'crit' : an.te > 1 ? 'super' : an.te < 1 ? 'weak' : 'hit'));
      break;
    case 'caught':
      jingle(JINGLES.caught);
      break;
    case 'lvl':
      jingle(JINGLES.levelup, 180);
      break;
    case 'run':
      soundEffect('run');
      break;
  }
}
/* footsteps while walking: one every FOOTSTEP_M walked (phase 08: by distance, so running steps faster) */
let footstepAt = 0;
setInterval(() => {
  try {
    if (
      typeof walkView === 'undefined' ||
      !walkView.ready ||
      !walkView.pl ||
      !walkView.pl.walk ||
      document.hidden ||
      (typeof activeBattle !== 'undefined' && activeBattle)
    )
      return;
    const P = walkView.pl,
      g = P.gait || 0;
    if (g < footstepAt) footstepAt = g; /* a new view starts its count again */
    if (g - footstepAt < FOOTSTEP_M) return;
    footstepAt = g;
    let ter = typeof terrainAt === 'function' ? terrainAt(P.x, P.z) : 'g';
    /* v18: hollow boards on wooden and rope bridges, stone on stone bridges and stairs */
    if (typeof bridgeAt === 'function' && bridgeAt(P.x, P.z) != null) {
      const b = (mapBridges() || []).find(b => {
        const vx = P.x - b.a[0],
          vz = P.z - b.a[1],
          t = (vx * b.ux + vz * b.uz) / b.len;
        return t >= -0.05 && t <= 1.05 && Math.abs(-vx * b.uz + vz * b.ux) <= b.w / 2 + 0.05;
      });
      ter = b && b.kind === 'stone' ? 'e' : 'b';
    } else if (typeof stepWallAt === 'function') {
      if ((stepWallAt(P.x, P.z) & 15) === 8) ter = 'e';
    }
    if (
      typeof environment !== 'undefined' &&
      environment.on &&
      walkView.sc &&
      !walkView.sc.indoor &&
      environment.wet > 0.5 &&
      !/[bew]/.test(ter)
    )
      ter = 'wet';
    if (
      typeof environment !== 'undefined' &&
      environment.on &&
      environment.sk &&
      environment.sk[3] > 0.3 &&
      /[gGflt]/.test(ter)
    )
      ter = 'n';
    soundEffect('step', { ter });
  } catch (e) {}
}, 50);
/* volume sliders apply while you drag */
document.addEventListener('input', ev => {
  const k = ev.target.dataset && ev.target.dataset.preference;
  if (k !== 'music' && k !== 'sfx' && k !== 'world') return;
  saveData.preferences = saveData.preferences || {};
  saveData.preferences[k] = +ev.target.value / 100;
  applyVolumes();
  if (typeof applyAmbienceVolume === 'function') applyAmbienceVolume();
  if (k === 'sfx') soundEffect('tick');
});
/* a soft tick on every button */
document.addEventListener(
  'click',
  ev => {
    const b = ev.target.closest && ev.target.closest('button,[role=tab]');
    if (b && !b.disabled) soundEffect('tick');
  },
  true
);

/* ================= v27: SOUNDS OF THE WORLD =================
   Beds of sound that swell as you walk near running water, waterfalls, the sea, ponds, fountains and fires, plus the
   rain, the wind and thunder (environment.js), each placed left or right of you; animals call and scurry from where they are.
   The music listens too: its drums soften while you stand still or at night, a pad hums under the night, and it
   sounds a little muffled in the rain. Settings → World sounds sets the volume (0 mutes). */
/* v31: world sounds are half as loud by default and fade in over a few seconds when you arrive somewhere; a second
   bus carries the ambience (Settings → Sound → Ambience): birdsong by day, crickets and the odd owl at night, leaves
   in the wind near trees, a town's murmur, a cave's hum and a room's quiet with its clock ticking */
export const ambience = { bus: null, amb: null, beds: {}, flash: 0, arrive: 0, id: null, lastCall: 0, ev: {} };
function ambienceFadeIn() {
  if (!soundEngine.ctx) return 1;
  return clamp((soundEngine.ctx.currentTime - ambience.arrive) / 2.8, 0, 1);
}
function applyAmbienceVolume() {
  if (!ambience.bus || !soundEngine.ctx) return;
  const L = soundLevels(soundPreferences()),
    f = ambienceFadeIn(),
    t = soundEngine.ctx.currentTime;
  ambience.bus.gain.setTargetAtTime(L.world * f, t, 0.1);
  if (ambience.amb) ambience.amb.gain.setTargetAtTime(L.amb * f, t, 0.1);
}
function initAmbience() {
  if (ambience.bus) return true;
  if (!soundEngine.ctx || soundEngine.ctx.state !== 'running') return false;
  const c = soundEngine.ctx;
  ambience.bus = c.createGain();
  ambience.bus.gain.value = 0;
  ambience.bus.connect(soundEngine.master);
  ambience.amb = c.createGain();
  ambience.amb.gain.value = 0;
  ambience.amb.connect(soundEngine.master);
  /* v47: the outdoors comes through a low-pass of its own, closed down when you are in a room laid into the place:
    the town's murmur, the birds, the rain on the roof and the fountain outside reach you through the walls */
  const lp = to => {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 20000;
    f.Q.value = 0.5;
    f.connect(to);
    return f;
  };
  ambience.lpA = lp(ambience.amb);
  ambience.lpW = lp(ambience.bus);
  applyAmbienceVolume();
  const loop =
    (filters, lfo, rate = 1) =>
    dest => {
      const s = c.createBufferSource();
      s.buffer = soundEngine.noise;
      s.loop = true;
      s.playbackRate.value = rate;
      let n = s;
      for (const [type, f, q] of filters) {
        const F = c.createBiquadFilter();
        F.type = type;
        F.frequency.value = f;
        F.Q.value = q || 0.7;
        n.connect(F);
        n = F;
      }
      if (lfo) {
        const m = c.createGain();
        m.gain.value = 1 - lfo[1];
        const o = c.createOscillator();
        o.frequency.value = lfo[0];
        const og = c.createGain();
        og.gain.value = lfo[1];
        o.connect(og);
        og.connect(m.gain);
        o.start();
        n.connect(m);
        n = m;
      }
      n.connect(dest);
      s.start(0, Math.random() * 0.9);
    };
  const bed = (name, make, bus = ambience.lpW) => {
    const g = c.createGain();
    g.gain.value = 0;
    const p = c.createStereoPanner ? c.createStereoPanner() : null;
    make(g);
    if (p) {
      g.connect(p);
      p.connect(bus);
    } else g.connect(bus);
    ambience.beds[name] = { g, p };
  };
  /* crickets: a high tone chopped fast, then gated in slow pulses; two of them, slightly apart */
  const cricket = (f, r1, r2) => dest => {
    const o = c.createOscillator();
    o.frequency.value = f;
    const a = c.createGain(),
      b = c.createGain();
    a.gain.value = 0.5;
    b.gain.value = 0.5;
    const l1 = c.createOscillator();
    l1.type = 'square';
    l1.frequency.value = r1;
    const g1 = c.createGain();
    g1.gain.value = 0.5;
    l1.connect(g1);
    g1.connect(a.gain);
    const l2 = c.createOscillator();
    l2.type = 'square';
    l2.frequency.value = r2;
    const g2 = c.createGain();
    g2.gain.value = 0.5;
    l2.connect(g2);
    g2.connect(b.gain);
    o.connect(a);
    a.connect(b);
    b.connect(dest);
    o.start();
    l1.start();
    l2.start();
  };
  bed(
    'crickets',
    d => {
      cricket(4300, 26, 0.9)(d);
      cricket(4650, 23, 0.7)(d);
    },
    ambience.lpA
  );
  bed(
    'leaves',
    loop(
      [
        ['bandpass', 3200, 0.5],
        ['highpass', 1200],
      ],
      [0.13, 0.8]
    ),
    ambience.lpA
  );
  bed(
    'town',
    loop(
      [
        ['bandpass', 420, 0.7],
        ['lowpass', 900],
      ],
      [0.21, 0.5],
      0.9
    ),
    ambience.lpA
  );
  bed(
    'cave',
    d => {
      loop([['lowpass', 140]], [0.05, 0.4], 0.5)(d);
      const o = c.createOscillator();
      o.frequency.value = 49;
      const g = c.createGain();
      g.gain.value = 0.18;
      o.connect(g);
      g.connect(d);
      o.start();
    },
    ambience.amb
  );
  bed(
    'room',
    loop(
      [
        ['lowpass', 260],
        ['highpass', 40],
      ],
      null,
      0.6
    ),
    ambience.amb
  );
  bed(
    'stream',
    loop(
      [
        ['bandpass', 1500, 0.9],
        ['highpass', 500],
      ],
      [2.7, 0.4]
    )
  );
  bed(
    'falls',
    loop(
      [
        ['lowpass', 1000],
        ['highpass', 90],
      ],
      null,
      0.8
    )
  );
  bed(
    'sea',
    loop(
      [
        ['lowpass', 650],
        ['highpass', 60],
      ],
      [0.09, 0.8],
      0.7
    )
  );
  bed('pond', loop([['bandpass', 520, 1.4]], [0.35, 0.6]));
  bed('fountain', loop([['bandpass', 2400, 0.8]], [5.5, 0.3]));
  bed('fire', loop([['bandpass', 3000, 1.6]], [11, 0.9]));
  bed('lava', loop([['lowpass', 260]], [0.6, 0.7], 0.6));
  bed(
    'rain',
    loop(
      [
        ['highpass', 1700],
        ['lowpass', 7500],
      ],
      null
    )
  );
  bed('wind', loop([['bandpass', 360, 0.6]], [0.06, 0.85]));
  return true;
}
/* where a sound is, as a volume and a left-right pan, from where you stand and which way the camera faces */
function soundPlacement(x, z, range) {
  const P = walkView.pl,
    C = walkView.C;
  if (!P) return null;
  const d = Math.hypot(x - P.x, z - P.z);
  if (d > range) return null;
  const R = (C && C.right) || [1, 0, 0],
    dx = (x - P.x) * R[0] + (z - P.z) * R[2];
  return { v: Math.pow(1 - d / range, 1.6), pan: clamp(dx / 7, -1, 1) * 0.75, d };
}
function nearestSoundSource(list, get, range) {
  let best = null;
  for (const it of list || []) {
    const [x, z] = get(it);
    const w = soundPlacement(x, z, range);
    if (w && (!best || w.d < best.d)) best = w;
  }
  return best;
}
function updateAmbience() {
  if (!soundEngine.ctx || soundEngine.ctx.state !== 'running') return;
  if (!ambience.bus && !initAmbience()) return;
  const c = soundEngine.ctx,
    t = c.currentTime,
    T = {};
  const walk =
    typeof walkView !== 'undefined' &&
    walkView.ready &&
    walkView.sc &&
    !document.hidden &&
    typeof uiState !== 'undefined' &&
    (uiState.tab === 'walk' || (typeof activeBattle !== 'undefined' && activeBattle));
  const E = typeof environment !== 'undefined' && environment.on ? environment : null,
    sc = walk ? walkView.sc : null;
  let pans = {};
  if (sc) {
    const put = (k, w, mul = 1) => {
      if (w && w.v * mul > (T[k] || 0)) {
        T[k] = w.v * mul;
        pans[k] = w.pan;
      }
    };
    put(
      'stream',
      nearestSoundSource(walkRenderer.streamCells, q => q, 10),
      0.5
    );
    put(
      'falls',
      nearestSoundSource(walkRenderer.falls, q => [q[0], q[2]], 14),
      0.7
    );
    if (sc.flatFar || sc.waterKind === 'sea' || sc.far === 'sea') {
      T.sea = 0.35;
      pans.sea = 0;
      put(
        'sea',
        nearestSoundSource(walkView.water, q => q, 8),
        0.6
      );
    } else
      put(
        'pond',
        nearestSoundSource(walkView.water, q => q, 6),
        0.22
      );
    if (sc.waterKind === 'lava')
      put(
        'lava',
        nearestSoundSource(walkView.water, q => q, 10),
        0.5
      );
    const C0 = walkData().sc,
      props = sc.props || [];
    put(
      'fountain',
      nearestSoundSource(
        props.filter(p => /fountain/.test(p.k)),
        p => [p.x, p.z],
        9
      ),
      0.45
    );
    put(
      'fire',
      nearestSoundSource(
        props.filter(p => {
          const M = C0.props[p.k];
          return M && (M.fx || []).some(e => e.k === 'fire');
        }),
        p => [p.x, p.z],
        7
      ),
      0.35
    );
    const thru = !sc.indoor ? 1 : sc.roomRect ? 0.45 : 0;
    if (E && thru) {
      T.rain = Math.min(1, E.rain) * 0.42 * thru;
      T.wind = (E.storm * 0.4 + (E.climate === 'alpine' ? 0.16 : 0) + E.snow * 0.1) * thru;
      pans.rain = pans.wind = 0;
    }
    /* thunder a moment after the flash */
    if (E && E.flash > 0.9 && !ambience.flash) {
      ambience.flash = 1;
      const d = 0.5 + Math.random() * 1.6;
      synthNoise(ambience.bus, { t: t + d, dur: 2.6, vol: 0.55, lp: 180 });
      synthNoise(ambience.bus, { t: t + d + 0.1, dur: 1.2, vol: 0.25, lp: 420 });
    } else if (E && E.flash < 0.5) ambience.flash = 0;
  }
  /* arriving somewhere: everything fades in */
  const sid = sc ? baseMapId() : null;
  if (sid !== ambience.id) {
    ambience.id = sid;
    ambience.arrive = t;
  }
  applyAmbienceVolume();
  {
    const muf = !!(sc && sc.roomRect);
    if (ambience.lpA) {
      ambience.lpA.frequency.setTargetAtTime(muf ? 620 : 20000, t, 0.3);
      ambience.lpW.frequency.setTargetAtTime(muf ? 850 : 20000, t, 0.3);
    }
  }
  if (sc) ambienceBeds(sc, E, T, pans, t);
  for (const [k, b] of Object.entries(ambience.beds)) {
    b.g.gain.setTargetAtTime(T[k] || 0, t, 0.35);
    if (b.p && pans[k] != null) b.p.pan.setTargetAtTime(pans[k], t, 0.25);
  }
  /* the music listens: drums soften when you stand still or at night, a pad at night, muffled in the rain */
  const night = E ? (E.raw || E).night : 0,
    moving = sc && walkView.pl && walkView.pl.walk;
  soundEngine.L = {
    drums: (moving || (typeof activeBattle !== 'undefined' && activeBattle) ? 1 : 0.45) * (1 - night * 0.4),
    pad: sc && !sc.indoor ? night : 0,
  };
  if (soundEngine.song && soundEngine.song.drums)
    soundEngine.song.drums.gain.setTargetAtTime(soundEngine.L.drums, t, 0.6);
  if (soundEngine.musLP)
    soundEngine.musLP.frequency.setTargetAtTime(E && sc && !sc.indoor && E.rain > 0.3 ? 2200 : 20000, t, 0.8);
}
setInterval(() => {
  try {
    updateAmbience();
  } catch (e) {}
}, 200);
/* the ambience: which beds play here, and the occasional bird, owl and clock tick */
function ambienceBeds(sc, E, T, pans, t) {
  const st = E || (typeof environmentState === 'function' ? environmentState(sc) : { night: 0, dusk: 0 }),
    night = st.night || 0,
    day = 1 - night,
    rain = E ? E.rain : 0,
    dt = 0.2,
    ev = ambience.ev,
    room = !!sc.room,
    cave = sc.indoor && sc.far === 'cave',
    ss = st.season || st.ss;
  /* v47: a room laid into a place hears the place outside, quieter and through the walls (the low-pass in updateAmbience) */
  const thru = !sc.indoor ? 1 : sc.roomRect ? 0.45 : 0;
  const node =
      typeof LOCATIONS !== 'undefined' && typeof saveData !== 'undefined' && saveData.trip
        ? LOCATIONS[saveData.trip.node]
        : null,
    town = thru > 0 && !!((node && node.town) || (!sc.indoor && (sc.far === 'town' || sc.far === 'city')));
  if (thru) {
    const C0 = walkData().sc,
      P = walkView.pl;
    let trees = 0;
    for (const p of sc.props || []) {
      if (Math.abs(p.x - P.x) > 9 || Math.abs(p.z - P.z) > 9) continue;
      const g = (C0.props[p.k] || {}).group || p.k;
      if (/tree|bush|hedge/.test(g)) trees++;
    }
    T.leaves = Math.min(1, trees / 8) * 0.22 * (0.5 + 0.5 * (sc.wind || 1)) * (1 + (E ? E.storm : 0) * 0.8) * thru;
    pans.leaves = 0;
    T.crickets = night * (1 - Math.min(1, rain)) * (town ? 0.05 : 0.11) * (ss === 'winter' ? 0.2 : 1) * thru;
    pans.crickets = 0;
    if (town) {
      T.town = 0.13 * (1 - night * 0.6) * thru;
      pans.town = 0;
    }
    /* birds: a short call now and then by day, fewer in the rain; v47: the birds of the place (BIRD_CALLS) */
    {
      const L = BIRD_CALLS[sc.biome] || BIRD_CALLS._;
      if (
        L.length &&
        day > 0.3 &&
        Math.random() < dt * (town ? 0.12 : 0.3) * day * (1 - Math.min(1, rain) * 0.8) * thru
      ) {
        const k = L[Math.floor(Math.random() * L.length)];
        if (Math.random() < (RARE_BIRDS[k] || 1)) playBirdCall(t, k);
      }
    }
    /* the farm's rooster at first light */
    const hr = typeof environmentHour === 'function' ? environmentHour() : 12;
    if (sc.biome === 'farm' && hr > 5 && hr < 8.5 && Math.random() < dt * 0.03 * thru) playBirdCall(t, 'rooster');
    /* the scrap yard: metal shifting somewhere, the crane's cable creaking when nobody is looking */
    if (sc.biome === 'bins' && Math.random() < dt * 0.035 * thru) playScrapClank(t);
    if (night > 0.6 && !town && Math.random() < dt * 0.025 * thru) playOwlCall(t);
  }
  if (cave) {
    T.cave = 0.3;
    pans.cave = 0;
  }
  if (room) {
    T.room = 0.16;
    pans.room = 0;
    if ((sc.props || []).some(p => /clock/.test(p.k))) {
      if (!ev.tick || ev.tick < t - 1) ev.tick = t + 0.05;
      while (ev.tick < t + 0.25) {
        ev.tock = !ev.tock;
        playClockTick(ev.tick, ev.tock);
        ev.tick += 1;
      }
    }
  }
}
function ambienceOutput(pan, dry) {
  const c = soundEngine.ctx,
    g = c.createGain();
  let out = g;
  if (c.createStereoPanner) {
    const p = c.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    out = p;
  }
  out.connect(dry ? ambience.amb : ambience.lpA || ambience.amb);
  setTimeout(() => {
    try {
      out.disconnect();
    } catch (e) {}
  }, 4000);
  return g;
}
/* v47: the birds of each place (by the scene's biome): sparrows' chips and pigeons in town, larks over the open grass,
   thrushes in the woods, a reed warbler by the pond, gulls by the sea, crows on the scrap heaps, choughs and now and
   then a hawk in the mountains; "song" is a phrase of no bird in particular. RARE_BIRDS makes some of them rarer. */
const BIRD_CALLS = {
  _: ['song'],
  town: ['sparrow', 'sparrow', 'pigeon', 'song'],
  food: ['sparrow', 'pigeon', 'sparrow'],
  city: ['pigeon', 'sparrow', 'pigeon'],
  grass: ['lark', 'lark', 'song'],
  golf: ['song', 'lark', 'thrush'],
  thicket: ['thrush', 'song', 'woodpecker'],
  pond: ['thrush', 'reed', 'song'],
  farm: ['sparrow', 'song', 'thrush'],
  canyon: ['hawk', 'song'],
  volcano: ['hawk'],
  bins: ['crow', 'crow', 'pigeon'],
  ridge: ['chough', 'lark', 'hawk'],
  pass: ['chough', 'hawk'],
  summit: ['chough', 'sparrow'],
  sea: ['gull'],
  island: ['gull', 'gull', 'sparrow'],
  lake: ['gull', 'reed', 'song'],
  grotto: [],
  mall: [],
  /* v47 part 4: the regions */ meadow: ['lark', 'lark', 'song'],
  blossom: ['song', 'thrush', 'sparrow'],
  mangrove: ['reed', 'song', 'gull'],
  vineyard: ['lark', 'sparrow', 'song'],
  saltflat: ['hawk'],
  badlands: ['hawk', 'song'],
  spore: ['song', 'thrush'],
  autumn: ['thrush', 'woodpecker', 'song'],
  jungle: ['song', 'woodpecker', 'thrush'],
  crystal: [],
  cavern: [],
  darkpool: [],
  tundra: ['chough'],
  reef: ['gull', 'gull'],
  harbour: ['gull', 'gull', 'sparrow'],
  trench: ['gull'],
  press: ['gull'],
  silicon: ['crow', 'sparrow'],
  park: ['crow', 'pigeon', 'sparrow'],
  sky: ['hawk'],
  desert: ['hawk'],
  sun: [],
};
const RARE_BIRDS = { hawk: 0.3, woodpecker: 0.45, rooster: 1 };
function playBirdCall(t, kind) {
  const g = ambienceOutput((Math.random() - 0.5) * 1.4),
    r = Math.random,
    V = o => synthVoice(g, o);
  g.gain.value = 0.5 + r() * 0.5;
  if (kind === 'sparrow') {
    const n = 3 + Math.floor(r() * 5),
      f = 3600 + r() * 700;
    let s = t;
    for (let i = 0; i < n; i++) {
      V({
        type: 'sine',
        freq: f * (1 + (r() - 0.5) * 0.08),
        t: s,
        dur: 0.035,
        vol: 0.04,
        a: 0.003,
        r: 0.02,
        slide: 0.7,
      });
      s += 0.07 + r() * 0.09;
    }
    return;
  }
  if (kind === 'lark') {
    const n = 12 + Math.floor(r() * 12);
    let s = t;
    for (let i = 0; i < n; i++) {
      V({
        type: 'sine',
        freq: 2900 + r() * 2200,
        t: s,
        dur: 0.03 + r() * 0.03,
        vol: 0.028,
        a: 0.003,
        r: 0.015,
        slide: 0.8 + r() * 0.5,
      });
      s += 0.045 + r() * 0.03;
    }
    return;
  }
  if (kind === 'thrush') {
    const m = [1700 + r() * 500, 2300 + r() * 500, 1900 + r() * 400],
      rep = 1 + Math.floor(r() * 2);
    let s = t;
    for (let k = 0; k < rep; k++)
      for (const f of m) {
        V({ type: 'sine', freq: f, t: s, dur: 0.11, vol: 0.035, a: 0.01, r: 0.04, slide: r() < 0.5 ? 1.2 : 0.85 });
        s += 0.15;
      }
    return;
  }
  if (kind === 'reed') {
    const n = 8 + Math.floor(r() * 8);
    let s = t;
    for (let i = 0; i < n; i++) {
      V({ type: 'triangle', freq: i % 2 ? 2400 : 1900, t: s, dur: 0.04, vol: 0.022, a: 0.004, r: 0.02, cut: 5000 });
      s += 0.07;
    }
    return;
  }
  if (kind === 'gull') {
    const n = 2 + Math.floor(r() * 3);
    let s = t;
    for (let i = 0; i < n; i++) {
      V({
        type: 'sawtooth',
        freq: 1150 + r() * 150,
        t: s,
        dur: 0.22 + r() * 0.08,
        vol: 0.018,
        a: 0.02,
        r: 0.06,
        slide: 0.55,
        cut: 2400,
      });
      s += 0.32 + r() * 0.1;
    }
    return;
  }
  if (kind === 'crow') {
    const n = 2 + Math.floor(r() * 2);
    let s = t;
    for (let i = 0; i < n; i++) {
      V({
        type: 'sawtooth',
        freq: 560 + r() * 60,
        t: s,
        dur: 0.2,
        vol: 0.028,
        a: 0.01,
        r: 0.05,
        slide: 0.82,
        cut: 1500,
      });
      synthNoise(g, { t: s, dur: 0.18, vol: 0.02, bp: 900, q: 1.2 });
      s += 0.34 + r() * 0.12;
    }
    return;
  }
  if (kind === 'pigeon') {
    [
      [440, 0.22],
      [520, 0.3],
      [430, 0.26],
    ].forEach(([f, d], i) =>
      V({ type: 'sine', freq: f, t: t + i * 0.3, dur: d, vol: 0.035, a: 0.04, r: 0.08, slide: 0.92, vib: 2 })
    );
    return;
  }
  if (kind === 'chough') {
    for (let i = 0; i < 2; i++)
      V({
        type: 'triangle',
        freq: 2700 + r() * 300,
        t: t + i * 0.3,
        dur: 0.16,
        vol: 0.024,
        a: 0.01,
        r: 0.04,
        slide: 0.65,
      });
    return;
  }
  if (kind === 'hawk') {
    V({ type: 'sine', freq: 3000, t, dur: 0.75, vol: 0.026, a: 0.03, r: 0.15, slide: 0.7, vib: 1.5 });
    return;
  }
  if (kind === 'woodpecker') {
    const n = 12 + Math.floor(r() * 6);
    for (let i = 0; i < n; i++)
      synthNoise(g, { t: t + i * 0.055, dur: 0.03, vol: 0.07 * (1 - (i / n) * 0.5), bp: 1100, q: 3 });
    return;
  }
  if (kind === 'rooster') {
    let s = t;
    [
      [620, 0.14],
      [880, 0.11],
      [980, 0.16],
      [820, 0.5],
    ].forEach(([f, d], i) => {
      V({
        type: 'triangle',
        freq: f,
        t: s,
        dur: d,
        vol: 0.04,
        a: 0.01,
        r: 0.06,
        slide: i === 3 ? 0.7 : 1.05,
        cut: 3000,
      });
      s += d + 0.03;
    });
    return;
  }
  const base = 2200 + r() * 1800,
    n = 2 + Math.floor(r() * 4),
    kd = r();
  for (let i = 0; i < n; i++) {
    const s = t + i * (0.09 + r() * 0.06);
    V({
      type: 'sine',
      freq: base * (kd < 0.5 ? 1 + (i % 2) * 0.18 : 1.25 - i * 0.06),
      t: s,
      dur: 0.06 + r() * 0.05,
      vol: 0.035,
      a: 0.004,
      r: 0.03,
      slide: kd < 0.5 ? 1.25 : 0.8,
    });
  }
}
/* v47: the scrap yard: a sheet of metal shifting, or a slow creak of cable */
function playScrapClank(t) {
  const g = ambienceOutput((Math.random() - 0.5) * 1.6);
  g.gain.value = 0.4 + Math.random() * 0.4;
  if (Math.random() < 0.5) {
    synthNoise(g, { t, dur: 0.35, vol: 0.05, bp: 700 + Math.random() * 500, q: 6 });
    synthVoice(g, {
      type: 'triangle',
      freq: 180 + Math.random() * 80,
      t,
      dur: 0.4,
      vol: 0.02,
      a: 0.005,
      r: 0.2,
      slide: 0.9,
    });
  } else
    synthVoice(g, {
      type: 'sawtooth',
      freq: 95 + Math.random() * 30,
      t,
      dur: 0.9,
      vol: 0.012,
      a: 0.2,
      r: 0.3,
      slide: 1.35,
      vib: 3,
      cut: 900,
    });
}
function playOwlCall(t) {
  const g = ambienceOutput((Math.random() - 0.5) * 1.2);
  [0, 0.42].forEach((d, i) =>
    synthVoice(g, {
      type: 'sine',
      freq: i ? 330 : 370,
      t: t + d,
      dur: i ? 0.55 : 0.3,
      vol: 0.045,
      a: 0.06,
      r: 0.18,
      vib: 3,
    })
  );
}
function playClockTick(t, tock) {
  const g = ambienceOutput(0.15, true);
  synthNoise(g, { t, dur: 0.018, vol: 0.05, bp: tock ? 2600 : 3400, q: 4 });
}
/* Settings → Sound: hear each volume */
function testVolume(k) {
  unlockSound();
  setTimeout(() => {
    if (!soundEngine.ctx || soundEngine.ctx.state !== 'running') return;
    initAmbience();
    ambience.arrive = -9;
    applyAmbienceVolume();
    const t = soundEngine.ctx.currentTime + 0.05;
    /* SND-1: the master volume plays a chime straight on the master bus, so it sounds whatever the other sliders are */
    if (k === 'master')
      [72, 79].forEach((n, i) =>
        synthVoice(soundEngine.master, { type: 'p25', freq: midiToFrequency(n), t: t + i * 0.12, dur: 0.14, vol: 0.06 })
      );
    else if (k === 'music') jingle(JINGLES.levelup);
    else if (k === 'sfx') soundEffect('coin');
    else if (k === 'world') {
      synthNoise(ambience.bus, { t, dur: 1.2, vol: 0.35, bp: 1500, q: 0.9 });
      [0, 0.14].forEach(d =>
        synthVoice(ambience.bus, {
          type: 'square',
          freq: 520,
          t: t + 0.5 + d,
          dur: 0.09,
          vol: 0.05,
          slide: 0.7,
          cut: 1600,
        })
      );
    } else if (k === 'amb') {
      playBirdCall(t);
      playBirdCall(t + 0.7);
    }
  }, 60);
}
/* a one-off sound somewhere in the scene: animals calling, scurrying off, a frog's plop */
function soundEffectAt(name, x, z, o = {}) {
  if (!soundEngine.ctx || soundEngine.ctx.state !== 'running' || typeof walkView === 'undefined' || !walkView.ready)
    return;
  const w = soundPlacement(x, z, 14);
  if (!w || w.v < 0.03) return;
  const c = soundEngine.ctx,
    t = c.currentTime + 0.01,
    g = c.createGain();
  g.gain.value = w.v;
  if (name === 'call') {
    if (t - ambience.lastCall < 3) return;
    ambience.lastCall = t;
  }
  let out = g;
  if (c.createStereoPanner) {
    const p = c.createStereoPanner();
    p.pan.value = w.pan;
    g.connect(p);
    out = p;
  }
  out.connect(ambience.bus || soundEngine.fx);
  const F = g;
  const k = o.k;
  if (name === 'plop') {
    synthVoice(F, { type: 'sine', freq: 900, t, dur: 0.08, vol: 0.12, slide: 0.35 });
    synthNoise(F, { t: t + 0.03, dur: 0.12, vol: 0.06, bp: 1200, q: 1 });
  } else if (name === 'rustle') synthNoise(F, { t, dur: 0.18, vol: 0.035, bp: 2600, q: 0.5 });
  else if (name === 'door') {
    synthVoice(F, { type: 'sawtooth', freq: 170, t, dur: 0.24, vol: 0.018, slide: 1.35 });
    synthNoise(F, { t: t + 0.24, dur: 0.06, vol: 0.06, lp: 700 });
  } /* v47: someone going in or out */
  else if (name === 'scurry') synthNoise(F, { t, dur: 0.25, vol: 0.06, bp: k === 'crab' ? 3800 : 1800, q: 0.6 });
  else if (name === 'call') {
    if (k === 'duck')
      [0, 0.14].forEach(d =>
        synthVoice(F, { type: 'square', freq: 520, t: t + d, dur: 0.09, vol: 0.03, slide: 0.7, cut: 1600 })
      );
    else if (k === 'pigeon') synthVoice(F, { type: 'sine', freq: 330, t, dur: 0.35, vol: 0.05, vib: 4 });
    else if (k === 'chicken')
      [0, 0.08, 0.16].forEach(d =>
        synthVoice(F, { type: 'p25', freq: 700 + Math.random() * 80, t: t + d, dur: 0.05, vol: 0.03, slide: 0.8 })
      );
    else if (k === 'sheep' || k === 'goat')
      synthVoice(F, { type: 'p25', freq: k === 'goat' ? 520 : 380, t, dur: 0.45, vol: 0.04, vib: 6, cut: 1800 });
    else if (k === 'cat') synthVoice(F, { type: 'triangle', freq: 650, t, dur: 0.35, vol: 0.05, slide: 1.4, vib: 2 });
    else if (k === 'gull')
      [0, 0.22].forEach(d => synthVoice(F, { type: 'p12', freq: 1100, t: t + d, dur: 0.18, vol: 0.035, slide: 0.6 }));
    else if (k === 'frog')
      [0, 0.12].forEach(d => synthVoice(F, { type: 'square', freq: 140, t: t + d, dur: 0.08, vol: 0.05, cut: 700 }));
    else if (k === 'rabbit' || k === 'squirrel')
      [0, 0.05, 0.1].forEach(d => synthVoice(F, { type: 'p50', freq: 2200, t: t + d, dur: 0.02, vol: 0.02 }));
    else if (k === 'crab') synthNoise(F, { t, dur: 0.04, vol: 0.05, hp: 5000 });
    else if (k === 'car') synthVoice(F, { type: 'p50', freq: 420, t, dur: 0.25, vol: 0.03, cut: 1200 });
  }
  setTimeout(() => {
    try {
      g.disconnect();
    } catch (e) {}
  }, 2500);
}
