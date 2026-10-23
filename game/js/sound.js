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
import { LOCATIONS, MUSIC, SPECIES } from './game-data.js';
import { maxHp } from './logic/rules.js';
import { runWeather } from './logic/run-map.js';
import { musicBattleKind, musicRedZone, musicWeatherCut, songFor, songVariant } from './logic/music-where.js';
import { cryLowHealth, cryRecipe, cryVoices } from './logic/cries.js';
import { uiSoundFor, uiSoundVoices } from './logic/ui-sounds.js';
import { fighter, liveActors } from './logic/battle-engine.js';
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
import { midiToFrequency, trackerCreate } from './audio/tracker.js';
/* eslint-disable no-func-assign */
expose({
  BIRD_CALLS: [() => BIRD_CALLS],
  CRIES: [() => CRIES],
  JINGLES: [() => JINGLES],
  LIVE_VOLUMES: [() => LIVE_VOLUMES],
  RARE_BIRDS: [() => RARE_BIRDS],
  SONGS: [() => SONGS],
  ambience: [() => ambience],
  ambienceBeds: [() => ambienceBeds, v => (ambienceBeds = v)],
  ambienceFadeIn: [() => ambienceFadeIn, v => (ambienceFadeIn = v)],
  ambienceOutput: [() => ambienceOutput, v => (ambienceOutput = v)],
  applyAmbienceVolume: [() => applyAmbienceVolume, v => ((applyAmbienceVolume = v), provide({ applyAmbienceVolume }))],
  applyVolumes: [() => applyVolumes, v => ((applyVolumes = v), provide({ applyVolumes }))],
  battleCry: [() => battleCry, v => (battleCry = v)],
  battleDrumsIn: [() => battleDrumsIn, v => (battleDrumsIn = v)],
  battleMusicStart: [() => battleMusicStart, v => (battleMusicStart = v)],
  battleSoundEffect: [() => battleSoundEffect, v => ((battleSoundEffect = v), provide({ battleSoundEffect }))],
  cryPlay: [() => cryPlay, v => (cryPlay = v)],
  footstepAt: [() => footstepAt, v => (footstepAt = v)],
  initAmbience: [() => initAmbience, v => (initAmbience = v)],
  initSound: [() => initSound, v => (initSound = v)],
  jingle: [() => jingle, v => ((jingle = v), provide({ jingle }))],
  jinglePlay: [() => jinglePlay, v => (jinglePlay = v)],
  lowHpBeep: [() => lowHpBeep, v => (lowHpBeep = v)],
  music: [() => music, v => (music = v)],
  musicFor: [() => musicFor, v => (musicFor = v)],
  musicMapCut: [() => musicMapCut, v => (musicMapCut = v)],
  musicParts: [() => musicParts, v => (musicParts = v)],
  musicState: [() => musicState, v => (musicState = v)],
  musicStop: [() => musicStop, v => (musicStop = v)],
  musicSync: [() => musicSync, v => (musicSync = v)],
  musicVariant: [() => musicVariant, v => (musicVariant = v)],
  nearestSoundSource: [() => nearestSoundSource, v => (nearestSoundSource = v)],
  playBirdCall: [() => playBirdCall, v => (playBirdCall = v)],
  playClockTick: [() => playClockTick, v => (playClockTick = v)],
  playOwlCall: [() => playOwlCall, v => (playOwlCall = v)],
  playScrapClank: [() => playScrapClank, v => (playScrapClank = v)],
  runArriveSound: [() => runArriveSound, v => (runArriveSound = v)],
  soundEffect: [() => soundEffect, v => ((soundEffect = v), provide({ soundEffect }))],
  soundEffectAt: [() => soundEffectAt, v => ((soundEffectAt = v), provide({ soundEffectAt }))],
  soundEngine: [() => soundEngine],
  soundLog: [() => soundLog, v => (soundLog = v)],
  soundPlacement: [() => soundPlacement, v => (soundPlacement = v)],
  soundPreferences: [() => soundPreferences],
  synthKick: [() => synthKick, v => (synthKick = v)],
  synthNoise: [() => synthNoise, v => (synthNoise = v)],
  synthVoice: [() => synthVoice, v => (synthVoice = v)],
  testVolume: [() => testVolume, v => ((testVolume = v), provide({ testVolume }))],
  uiButton: [() => uiButton, v => (uiButton = v)],
  uiSound: [() => uiSound, v => (uiSound = v)],
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
  /* SND-5: the battle whose song started on its flash (battleMusicStart), the battle seen without one, and a short
     log of the music's battle cues for the checks (kept here, never sent anywhere) */
  cued: null,
  seen: null,
  log: [],
};
function soundLog(e) {
  const L = soundEngine.log;
  L.push({ at: Math.round(performance.now()), e });
  if (L.length > 40) L.shift();
}
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
    /* SND-2: the echo, the noise and the waves are the tracker's (audio/tracker.js), on the music bus */
    const T = trackerCreate(c, soundEngine.mus, { songs: SONGS, run: MUSIC.run, levels: () => soundEngine.L });
    soundEngine.tracker = T;
    soundEngine.echoIn = T.echoIn;
    soundEngine.echoWet = T.echoWet;
    soundEngine.noise = T.noise;
    soundEngine.waves = T.waves;
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
/* the first touch unlocks sound; the song that was asked for starts then. SND-1: any touch also wakes sound that
   stopped for something else, as iOS Safari does after a call or Siri (its state is then 'interrupted', not
   'suspended') */
function unlockSound() {
  if (!initSound()) return;
  const st = soundEngine.ctx.state;
  if (st !== 'running' && st !== 'closed') soundEngine.ctx.resume().catch(() => {});
  if (soundEngine.want && !soundEngine.song) {
    /* SND-4: the night level first (updateAmbience), so a night starts on the night version, not a second of day */
    if (!soundEngine.L && soundEngine.ctx.state === 'running')
      try {
        updateAmbience();
      } catch (e) {}
    const w = soundEngine.want;
    music(w.includes('@') ? w : songVariant(w, musicState(), SONGS, null, MUSIC.run));
  }
}
['pointerdown', 'keydown', 'touchend'].forEach(e => addEventListener(e, unlockSound, { capture: true, passive: true }));
document.addEventListener('visibilitychange', () => {
  if (!soundEngine.ctx) return;
  /* SND-2: the music's scheduler stops too while hidden (it ran every 25 ms with nothing to do) */
  const T = soundEngine.tracker;
  if (document.hidden) {
    soundEngine.ctx.suspend();
    if (T) T.idle();
  } else {
    soundEngine.ctx.resume();
    if (T) T.wake();
  }
  soundEngine.timer = T ? T.timer : null;
});
/* ---------- instruments (SND-2: the tracker's, audio/tracker.js; every sound plays through them) ---------- */
function synthVoice(bus, o) {
  soundEngine.tracker.synthVoice(bus, o);
}
function synthNoise(bus, o) {
  soundEngine.tracker.synthNoise(bus, o);
}
function synthKick(bus, t, v) {
  soundEngine.tracker.synthKick(bus, t, v);
}

/* ---------- songs ---------- */
/* SND-2: the songs' recipes are data (music.json songs) */
const SONGS = MUSIC.songs;
/* SND-2: the song plays on the tracker (audio/tracker.js); this keeps what was asked for (the first touch starts it) */
/* SND-5: o as the tracker's play takes it ({ intro, hold, restart }: a battle's start) */
export function music(name, o) {
  soundEngine.want = name;
  if (!soundEngine.ctx || soundEngine.ctx.state !== 'running') {
    return;
  }
  const T = soundEngine.tracker;
  T.play(name, o);
  soundEngine.song = T.song;
  soundEngine.voices = T.voices;
  soundEngine.timer = T.timer;
}
function musicStop() {
  if (soundEngine.tracker) soundEngine.tracker.stop();
  soundEngine.timer = null;
  soundEngine.song = null;
  soundEngine.want = null;
  soundEngine.voices = [];
}
/* the music that fits where you are. SND-2: music.json's where table picks it (logic/music-where.js songFor) */
export function musicFor() {
  return songFor(musicState(), MUSIC.where, SONGS);
}
/* what the where table matches on */
function musicState() {
  if (typeof saveData === 'undefined' || !saveData || !saveData.started) return { started: false };
  const B = typeof activeBattle !== 'undefined' && activeBattle,
    battle = musicBattleKind(B),
    /* SND-5: the lead Billie, the first of the player's side still standing, for the red zone */
    lead = B ? liveActors(0)[0] : undefined,
    L = lead != null ? fighter(lead) : null,
    id = typeof mapIdAt === 'function' ? mapIdAt(saveData.trip.node) : null,
    sc = id && mapById(id),
    r = LOCATIONS[saveData.trip.node],
    run = saveData.run,
    node = run && run.map && r && r.runNode != null ? run.map.nodes[r.runNode] : null;
  return {
    started: true,
    battle,
    redZone: !!L && musicRedZone(L.hp, maxHp(L)),
    /* SND-4: the environment's night level outdoors (updateAmbience), for songVariant */
    night: soundEngine.L ? soundEngine.L.night || 0 : 0,
    tab: uiState.tab,
    indoor: !!(sc && sc.indoor),
    map: id,
    placeKind: r && r.t === 'city' ? 'city' : r && r.town ? 'town' : null,
    placeMusic: (r && r.music) || null,
    /* a run's place: its node's type, biome and row (logic/run-map.js) */
    nodeType: node ? node.type : null,
    biome: node ? node.biome || null : null,
    row: node ? node.row : null,
    /* SND-5: the days left to the run's deadline, today included (1 on the deadline day, 0 or less past it) */
    daysLeft: run && run.deadline ? run.deadline - run.clock + 1 : null,
  };
}
function musicSync() {
  if (typeof cutscene !== 'undefined' && cutscene.on) return;
  if (soundEngine.jingle && performance.now() < soundEngine.jingle) return;
  /* SND-4: at night outdoors, the song's night version (logic/music-where.js songVariant); the switch crossfades */
  const st = musicState();
  /* SND-5: a battle's song starts on its flash, with its intro (battleMusicStart); until then the walk's song plays on,
     for at most 2.5 s (a battle that never shows its flash then gets its song without one) */
  const B = typeof activeBattle !== 'undefined' && activeBattle;
  if (st.battle && B && soundEngine.cued !== B) {
    const now = performance.now();
    if (!soundEngine.seen || soundEngine.seen.B !== B) soundEngine.seen = { B, at: now };
    if (now - soundEngine.seen.at < 2500) return;
    soundEngine.cued = B;
    soundLog('battle ' + st.battle + ': no flash, the song without its intro');
  }
  music(songVariant(songFor(st, MUSIC.where, SONGS), st, SONGS, soundEngine.want, MUSIC.run));
}
/* SND-5: a battle's music, timed as Masuda timed it: the song starts on the encounter's flash (or the trainer coming
   in) with its intro, and the drums wait for the first throw (battleDrumsIn) */
function battleMusicStart() {
  const B = typeof activeBattle !== 'undefined' && activeBattle;
  if (!B || soundEngine.cued === B) return;
  soundEngine.cued = B;
  const st = musicState(),
    name = songVariant(songFor(st, MUSIC.where, SONGS), st, SONGS, null, MUSIC.run);
  if (!name) return;
  music(name, { intro: true, hold: true, restart: true });
  const sg = soundEngine.song;
  soundLog('battle ' + st.battle + ': ' + name + (sg && sg.name === name && sg.D.introSteps ? ', its intro' : ''));
}
function battleDrumsIn() {
  const T = soundEngine.tracker;
  if (T && T.song && T.song.hold) {
    T.drumsIn();
    soundLog('drums in');
  }
}
/* SND-5: the parts of a song the fingerprints (tools/check-sound.py) render besides day and night: its intro, its tense
   version, its run arc bands, its deadline version */
function musicParts(name) {
  const S = SONGS[name];
  const out = S && S.intro && S.intro.length ? ['intro'] : [];
  /* a battle song's tense version */
  if (S && S.tense !== false && MUSIC.where.some(W => W.battle && W.song === name)) out.push('tense');
  /* a run's songs (a biome's): each arc band */
  if (S && S.arc !== false && MUSIC.where.some(W => W.biome && W.song === name))
    for (const B of (MUSIC.run && MUSIC.run.arc) || []) out.push(B.name);
  /* a run's songs near the deadline */
  if (S && S.deadline !== false && MUSIC.where.some(W => (W.biome || W.nodeType) && W.song === name))
    out.push('deadline');
  return out;
}
/* SND-4: a song's name as it plays at this night level (1 night, 0 day): 'town@night' or the name itself */
function musicVariant(name, night) {
  return songVariant(name, { night }, SONGS, null);
}
setInterval(() => {
  try {
    musicSync();
  } catch (e) {}
}, 1000);
/* a short tune that plays once (victory, level up, evolution), after which the place's music comes back */
/* SND-1: bus is where it plays, the effects bus unless asked (Settings → Sound → Music's Test plays one on the music bus) */
export function jingle(notes, bpm = 150, type = 'p25', bus = null) {
  if (!initSound() || soundEngine.ctx.state !== 'running') return;
  const end = soundEngine.tracker.jingle(notes, bpm, type, bus || soundEngine.fx) - soundEngine.ctx.currentTime;
  soundEngine.jingle = performance.now() + end * 1000 + 200;
}
/* SND-6: a jingle by its name, at its own tempo and wave (music.json jingles bpm, wave); o.shift moves it by
   semitones, o.duck false plays it over the song without ducking it (and doesn't hold the music sync). Logs
   'jingle <name>' in soundEngine.log (in memory, never sent). Returns how long it lasts (s), 0 when silent */
export function jinglePlay(id, o = {}) {
  const J = MUSIC.jingles[id];
  if (!J || !initSound() || soundEngine.ctx.state !== 'running') return 0;
  const out = o.bus || soundEngine.fx,
    end =
      soundEngine.tracker.jingle(J.notes, J.bpm || 150, J.wave || 'p25', out, { shift: o.shift, duck: o.duck }) -
      soundEngine.ctx.currentTime;
  if (o.duck !== false) soundEngine.jingle = performance.now() + end * 1000 + 200;
  soundLog('jingle ' + id + (o.shift ? ' +' + o.shift : ''));
  return end;
}
/* SND-6: walking into a run's next place: a day passes (the day jingle), then the reveal jingle when the map shows more
   than it did */
export function runArriveSound(revealed) {
  const d = jinglePlay('day');
  if (revealed && d) setTimeout(() => jinglePlay('reveal'), d * 1000 + 120);
}
/* SND-2: the jingles are data (music.json jingles); here each is its note list, as jingle() takes it */
export const JINGLES = Object.fromEntries(Object.entries(MUSIC.jingles).map(([k, J]) => [k, J.notes]));
provide({ JINGLES }); /* to-module */
/* ---------- sound effects ---------- */
/* SND-2: the base cries are data (music.json cries.bases); a species picks one by its name */
const CRIES = MUSIC.cries.bases;
export function soundEffect(name, o = {}) {
  if (!soundEngine.ctx || soundEngine.ctx.state !== 'running') return;
  const c = soundEngine.ctx,
    t = c.currentTime + 0.005,
    F = soundEngine.fx;
  switch (name) {
    case 'tick':
      /* SND-6: the tick is the UI's select sound (music.json ui) */
      uiSound('select');
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
    case 'cry':
      cryPlay(o.sp, !!o.low);
      break;
  }
}
/* SND-3: a species' cry from its own base, pitch and length (lines/*.json cry), else from its id. SND-6: low, its
   low-HP version (faster and a third down: logic/cries.js cryLowHealth). Returns how long it lasts (s), 0 when silent */
function cryPlay(sp, low) {
  if (!soundEngine.ctx || soundEngine.ctx.state !== 'running') return 0;
  const t = soundEngine.ctx.currentTime + 0.005,
    C = cryRecipe(sp, (SPECIES[sp] || {}).cry, CRIES),
    V = cryVoices(low ? cryLowHealth(C) : C);
  for (const v of V)
    synthVoice(soundEngine.fx, {
      type: v.type,
      freq: midiToFrequency(v.midi),
      t: t + v.at,
      dur: v.dur,
      vol: v.vol,
      slide: v.slide,
      vib: v.vib,
    });
  return Math.max(0, ...V.map(v => v.at + v.dur));
}
/* SND-6: a Billie's cry in battle, from the line's snapshot of its slot (ev.s: its species and its HP then): its low-HP
   cry in the red zone (logic/music-where.js musicRedZone, as the music's tense version); robots have no cry yet */
function battleCry(ev, si, low) {
  const sn = ev && ev.s && ev.s[si];
  if (!sn || sn.bot || !sn.sp) return 0;
  return cryPlay(sn.sp, low || musicRedZone(sn.hp, sn.max));
}
/* SND-5: the classic low-HP beep (Settings → Sound, off by default): twice a second-ish while the lead Billie is in the
   red zone, on the effects bus. The music's tense version plays either way */
function lowHpBeep() {
  if (!soundPreferences().lowHpBeep || !soundEngine.ctx || soundEngine.ctx.state !== 'running') return;
  const B = typeof activeBattle !== 'undefined' && activeBattle,
    k = B ? liveActors(0)[0] : undefined,
    L = k != null ? fighter(k) : null,
    now = performance.now();
  if (!L || !musicRedZone(L.hp, maxHp(L)) || now < (soundEngine.beepAt || 0)) return;
  soundEngine.beepAt = now + 900;
  const t = soundEngine.ctx.currentTime + 0.01;
  synthVoice(soundEngine.fx, { type: 'p50', freq: 1760, t, dur: 0.07, vol: 0.035, r: 0.02 });
  synthVoice(soundEngine.fx, { type: 'p50', freq: 1318.5, t: t + 0.11, dur: 0.07, vol: 0.035, r: 0.02 });
}
/* SND-5: on a run's map tab the map song is muffled by today's forecast where you stand (logic/run-map.js runWeather,
   music.json run.weather); null off the map tab or out of a run */
function musicMapCut() {
  const run = typeof saveData !== 'undefined' && saveData && saveData.run;
  if (!run || !run.map || uiState.tab !== 'map' || (typeof activeBattle !== 'undefined' && activeBattle)) return null;
  const r = LOCATIONS[saveData.trip.node];
  if (!r || r.runNode == null) return null;
  return musicWeatherCut(runWeather(run, r.runNode, run.clock), MUSIC.run);
}
/* battle animations make their sounds. SND-6: ev is the line they belong to (its snapshot names who cries) */
function battleSoundEffect(an, r, ev) {
  if (!an || !soundEngine.ctx) return;
  const at = (ms, f) => setTimeout(f, Math.max(0, ms / (typeof battleStage !== 'undefined' ? battleStage.speed : 1)));
  switch (an.k) {
    case 'wild':
      soundEffect('enc');
      battleMusicStart();
      break;
    case 'trainerIn':
      battleMusicStart();
      break;
    case 'cry': {
      const s = typeof battleStage !== 'undefined' && battleStage.s[an.si || 1];
      if (!battleCry(ev, an.si || 1)) soundEffect('cry', { sp: s && s.sp });
      break;
    }
    case 'enter':
      battleDrumsIn();
      soundEffect('throw');
      at(380, () => soundEffect('pop'));
      /* SND-6: a Billie cries as it comes out (as in Gen 1), after the pop */
      at(520, () => battleCry(ev, an.si));
      break;
    case 'faint': {
      /* SND-6: its low-HP cry, then the fall */
      const d = battleCry(ev, an.si, true);
      at(d * 1000, () => soundEffect('faint'));
      break;
    }
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
    /* SND-2: nothing to work out while no sound can play (before the first touch, or suspended) */
    if (
      !soundEngine.ctx ||
      soundEngine.ctx.state !== 'running' ||
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
/* volume sliders apply while you drag (SND-1: all five; Volume and Ambience only applied when you let go) */
const LIVE_VOLUMES = ['master', 'music', 'sfx', 'world', 'amb'];
document.addEventListener('input', ev => {
  const k = ev.target.dataset && ev.target.dataset.preference;
  if (!LIVE_VOLUMES.includes(k)) return;
  saveData.preferences = saveData.preferences || {};
  saveData.preferences[k] = +ev.target.value / 100;
  applyVolumes();
  if (typeof applyAmbienceVolume === 'function') applyAmbienceVolume();
  if (k === 'sfx') soundEffect('tick');
});
/* SND-6: four UI sounds instead of one tick (music.json ui, logic/ui-sounds.js): a button picks one by its data-a and
   classes, so no screen changes. k is select, confirm, cancel or cant */
function uiSound(k) {
  if (!soundEngine.ctx || soundEngine.ctx.state !== 'running') return;
  const S = (MUSIC.ui && MUSIC.ui.sounds[k]) || null;
  if (!S) return;
  const t = soundEngine.ctx.currentTime + 0.005;
  for (const v of uiSoundVoices(S))
    synthVoice(soundEngine.fx, {
      type: v.type,
      freq: midiToFrequency(v.midi),
      t: t + v.at,
      dur: v.dur,
      vol: v.vol,
      slide: v.slide,
      r: 0.02,
    });
  soundLog('ui ' + k);
}
/* the button a press was on: a button or tab (a kit button's host, whose data-a and kind it carries), or the sheet's
   scrim when the press was on the scrim itself and the sheet can be closed that way. Disabled: the button or
   aria-disabled */
function uiButton(ev) {
  const path = ev.composedPath ? ev.composedPath() : [ev.target];
  for (const el of path) {
    if (!(el instanceof Element)) continue;
    if (el.matches('[data-a="scrim"]'))
      return path[0] === el && uiState.modal && !uiState.modal.lock ? { a: 'scrim', cls: [], disabled: false } : null;
    if (!el.matches('button,[role=tab]')) continue;
    const root = el.getRootNode(),
      host = root instanceof ShadowRoot ? root.host : null,
      b = host && host.matches('[data-a],[kind]') ? host : el;
    return {
      a: b.getAttribute('data-a'),
      cls: [...b.classList, b.getAttribute('kind') || ''].filter(Boolean),
      disabled: !!(el.disabled || b.disabled || b.getAttribute('aria-disabled') === 'true'),
    };
  }
  return null;
}
document.addEventListener(
  'click',
  ev => {
    const b = uiButton(ev);
    if (b && !b.disabled) uiSound(uiSoundFor(b, MUSIC.ui));
  },
  true
);
/* a disabled button gets no click, but the press still reaches it: the buzz then */
document.addEventListener(
  'pointerdown',
  ev => {
    const b = uiButton(ev);
    if (b && b.disabled) uiSound('cant');
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
    night: sc && !sc.indoor ? night : 0,
  };
  if (soundEngine.song && soundEngine.song.drums)
    soundEngine.song.drums.gain.setTargetAtTime(soundEngine.L.drums, t, 0.6);
  if (soundEngine.musLP) {
    const cut = musicMapCut();
    soundEngine.musLP.frequency.setTargetAtTime(
      cut != null ? cut : E && sc && !sc.indoor && E.rain > 0.3 ? 2200 : 20000,
      t,
      0.8
    );
  }
}
setInterval(() => {
  try {
    updateAmbience();
    lowHpBeep();
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
    else if (k === 'music') jingle(JINGLES.levelup, 150, 'p25', soundEngine.mus);
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
