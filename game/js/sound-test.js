'use strict';
/* ================= SOUND TEST (sound track SND-8a) =================
   The debug menu's Sound test, for listening on the phone (the Studio is for a computer): any song by day or at night,
   and any world sound alone or in a made-up scene, at a distance. It plays through the game's own sound code
   (soundEngine; sound.js ambiencePreviewTick, the same preview tools/check-sound.py --loudness measures), never writes
   the save, and stops when the menu closes: the place's own music and world sounds come back. SND-9: and the first
   baked instrument, the harp, playing Copperleaf's tune and chords with a little reverb, as in a chosen place. */
/* the world sounds it can play: [id, label, [[kind, metres or 'd' for the distance picked], ...]] */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide, toast } from './hooks.js';
import { uiState } from './game-state.js';
import { SONGS, ambience, music, musicSync, musicVariant, soundEngine, unlockSound } from './sound.js';
/* eslint-disable no-func-assign */
expose({
  SOUND_TEST_DISTANCES: [() => SOUND_TEST_DISTANCES],
  SOUND_TEST_HARP: [() => SOUND_TEST_HARP],
  SOUND_TEST_PLACES: [() => SOUND_TEST_PLACES],
  SOUND_TEST_WORLD: [() => SOUND_TEST_WORLD],
  soundTest: [() => soundTest],
  soundTestAction: [() => soundTestAction, v => ((soundTestAction = v), provide({ soundTestAction }))],
  soundTestButton: [() => soundTestButton],
  soundTestHTML: [() => soundTestHTML, v => ((soundTestHTML = v), provide({ soundTestHTML }))],
  soundTestHarp: [() => soundTestHarp, v => (soundTestHarp = v)],
  soundTestHarpStop: [() => soundTestHarpStop, v => (soundTestHarpStop = v)],
  soundTestSelect: [() => soundTestSelect],
  soundTestStop: [() => soundTestStop, v => (soundTestStop = v)],
});
/* eslint-enable no-func-assign */
provide({ soundTestAction, soundTestHTML });
/* to-module: end */
const SOUND_TEST_WORLD = [
  ['rain', 'Rain', [['rain', 0]]],
  ['wind', 'Storm wind', [['wind', 0]]],
  ['leaves', 'Leaves in the woods', [['leaves', 0]]],
  ['crickets', 'Crickets at night', [['crickets', 0]]],
  ['birds', 'Birds', [['birds', 0]]],
  ['town', 'A town’s murmur', [['town', 0]]],
  ['cave', 'A cave', [['cave', 0]]],
  ['room', 'A room', [['room', 0]]],
  ['stream', 'A stream', [['stream', 'd']]],
  ['falls', 'A waterfall', [['falls', 'd']]],
  ['fountain', 'A fountain', [['fountain', 'd']]],
  ['pond', 'Still water', [['pond', 'd']]],
  [
    'sea',
    'The sea',
    [
      ['sea_coast', 0],
      ['sea', 'd'],
    ],
  ],
  ['fire', 'A campfire', [['fire', 'd']]],
  ['lava', 'Lava', [['lava', 'd']]],
  ['steps_l', 'Steps on a lawn', [['steps', 0, 'l']]],
  ['steps_e', 'Steps on stone', [['steps', 0, 'e']]],
  ['steps_b', 'Steps on boards', [['steps', 0, 'b']]],
  [
    'square',
    'Copperleaf’s square',
    [
      ['sea_coast', 0],
      ['fountain', 'd'],
      ['town', 0],
      ['birds', 0],
    ],
  ],
  [
    'route_rain',
    'A route in the rain',
    [
      ['rain', 0],
      ['leaves', 0],
    ],
  ],
  [
    'meadow_night',
    'A meadow at night',
    [
      ['crickets', 0],
      ['leaves', 0],
    ],
  ],
];
const SOUND_TEST_DISTANCES = [1, 3, 6, 10, 20];
/* SND-9: where the harp plays: the reverb's send by place (tracker.js SOUND_BAKE_PLACES), or none */
const SOUND_TEST_PLACES = [
  ['town', 'In Copperleaf'],
  ['open', 'On a route'],
  ['forest', 'In a forest'],
  ['room', 'In a room'],
  ['cave', 'In a cave'],
  ['dry', 'No reverb'],
];
/* the harp's own send to the reverb (a little), its notes' levels */
const SOUND_TEST_HARP = { send: 0.35, lead: 0.36, chord: 0.16 };
const soundTest = { song: null, world: null, timer: 0, harp: null };
const soundTestSelect = (id, opts, val) =>
  `<select id="${id}">${opts.map(([v, n]) => `<option value="${v}"${v === val ? ' selected' : ''}>${n}</option>`).join('')}</select>`;
const soundTestButton = (x, l) => `<button class="pb small" data-a="dbg" data-x="${x}">${l}</button>`;
/* the section's body */
function soundTestHTML() {
  const songs = Object.keys(SONGS).map(k => [k, k]);
  return `<div class="dbg-row">${soundTestSelect('sndSong', songs, soundTest.song ? soundTest.song.split('@')[0] : songs[0][0])}${soundTestSelect(
    'sndTime',
    [
      ['day', 'By day'],
      ['night', 'At night'],
    ],
    soundTest.song && soundTest.song.endsWith('@night') ? 'night' : 'day'
  )}${soundTestButton('sndSong', 'Play the song')}</div>
  <div class="dbg-row">${soundTestSelect(
    'sndWorld',
    SOUND_TEST_WORLD.map(([id, l]) => [id, l]),
    soundTest.world ? soundTest.world.id : 'rain'
  )}${soundTestSelect(
    'sndDist',
    SOUND_TEST_DISTANCES.map(d => [String(d), d + ' m away']),
    soundTest.world ? String(soundTest.world.d) : '3'
  )}${soundTestButton('sndWorld', 'Play the sound')}</div>
  <div class="dbg-row">${soundTestSelect('sndPlace', SOUND_TEST_PLACES, soundTest.harp ? soundTest.harp.place : 'town')}${soundTestButton(
    'sndHarp',
    'Play the harp'
  )}</div>
  <div class="dbg-row">${soundTestButton('sndStop', 'Stop the test')}</div>
  <p class="note">Plays at your sliders over the place’s sound; the song and the world sound can play together. Closing the menu stops the test. iPhones mute the game with the silent switch.</p>`;
}
/* a Sound test button (debug-menu.js debugAction: every data-x starting snd) */
function soundTestAction(x) {
  const v = id => {
    const e = document.getElementById(id);
    return e ? /** @type {HTMLSelectElement} */ (e).value : null;
  };
  unlockSound();
  if (x === 'sndSong') {
    const name = v('sndSong');
    if (!name) return;
    soundTest.song = v('sndTime') === 'night' ? musicVariant(name, 1) : name;
    soundEngine.test = true;
    music(soundTest.song, { restart: true });
    toast(`Playing ${soundTest.song}.`);
  } else if (x === 'sndWorld') {
    const W = SOUND_TEST_WORLD.find(w => w[0] === v('sndWorld'));
    if (!W) return;
    const d = +(v('sndDist') || 3);
    soundTest.world = { id: W[0], d };
    ambience.preview = W[2].map(([k, m, ter]) => [k, m === 'd' ? d : m, ter]);
    ambience.arrive = -9;
    toast(`Playing ${W[1].toLowerCase()}${W[2].some(e => e[1] === 'd') ? `, ${d} m away` : ''}.`);
  } else if (x === 'sndHarp') {
    const place = v('sndPlace') || 'town';
    soundTestHarp(place);
    const P = SOUND_TEST_PLACES.find(q => q[0] === place);
    toast(`Playing the harp, ${(P ? P[1] : place).toLowerCase()}.`);
  } else if (x === 'sndStop') {
    soundTestStop();
    toast('Sound test stopped.');
    return;
  }
  /* the test stops with the menu (checked twice a second while it plays) */
  if (!soundTest.timer)
    soundTest.timer = setInterval(() => {
      if (!(uiState.modal && uiState.modal.dbg)) soundTestStop();
    }, 500);
}
/* back to the place's own music and world sounds */
function soundTestStop() {
  if (soundTest.timer) clearInterval(soundTest.timer);
  soundTest.timer = 0;
  soundTest.song = null;
  soundTest.world = null;
  soundTestHarpStop();
  ambience.preview = null;
  if (soundEngine.test) {
    soundEngine.test = false;
    musicSync();
  }
}
/* SND-9: the harp (the first baked instrument, logic/sound-bake.js) plays Copperleaf's tune once, with its chords
   plucked low, alone: the place's song stops for it (soundEngine.test). The bank bakes it on the first press (in
   slices, so nothing stalls) and the reverb is made with its impulse; then the notes are scheduled */
function soundTestHarp(place) {
  const T = soundEngine.tracker,
    c = soundEngine.ctx;
  if (!T || !c) return;
  soundTestHarpStop();
  soundEngine.test = true;
  T.stop();
  soundTest.song = null;
  const stem = c.createGain();
  stem.connect(soundEngine.mus);
  const H = { place, stem, send: null };
  soundTest.harp = H;
  if (place !== 'dry') {
    T.reverbPlace(place);
    H.send = c.createGain();
    H.send.gain.value = SOUND_TEST_HARP.send;
    stem.connect(H.send);
    H.send.connect(T.reverbSend('music'));
  }
  Promise.all([T.bankReady('harp'), place !== 'dry' ? T.reverbReady() : null]).then(() => {
    if (soundTest.harp !== H) return;
    const D = T.compose('copperleaf');
    if (!D) return;
    const spb = 60 / D.bpm / 4,
      t0 = c.currentTime + 0.1;
    for (let st = 0; st < D.steps; st++) {
      const N = D.notes[st],
        t = t0 + st * spb;
      if (N) T.sampleVoice(stem, { inst: 'harp', midi: N[0], t, dur: N[1] * spb, vol: SOUND_TEST_HARP.lead });
      /* each bar's chord, plucked up from its root an octave under the tune */
      if (st % 16 === 0) {
        const ch = D.prog[st / 16];
        [0, 2, 4].forEach((x, i) =>
          T.sampleVoice(stem, {
            inst: 'harp',
            midi: D.deg(ch + x) - 12,
            t: t + i * spb,
            dur: 14 * spb,
            vol: SOUND_TEST_HARP.chord,
          })
        );
      }
    }
  });
}
/* the harp fades out in 0.1 s and is let go */
function soundTestHarpStop() {
  const H = soundTest.harp;
  soundTest.harp = null;
  if (!H || !soundEngine.ctx) return;
  const t = soundEngine.ctx.currentTime;
  H.stem.gain.setTargetAtTime(0, t, 0.03);
  setTimeout(() => {
    H.stem.disconnect();
    if (H.send) H.send.disconnect();
  }, 200);
}
