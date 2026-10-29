'use strict';
/* ================= THE WATER HERE (sound track SND-10) =================
   What the world's water sounds like where you stand: the scene's emitters (logic/soundscape.js) made once per scene
   and ground, in buckets by recipe, the nearest few of each recipe each update with their level, pan (from the
   camera's right, as sound.js soundPlacement) and distance, rain on water while it rains (its rate by the rain), Surf's
   wake while you ride; audio/soundscape-player.js plays them. sound.js updateAmbience calls soundscapeHere every 200 ms
   and initAmbience soundscapeStart once. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide } from './hooks.js';
import { clamp } from './util.js';
import { SOUNDSCAPE } from './game-data.js';
import { WADE_DEPTH, wadeKindAt } from './logic/wading.js';
import { ambienceBuckets, ambienceRandom } from './logic/ambience-sound.js';
import {
  soundscapeCells,
  soundscapeCellsFromTiles,
  soundscapeEmitters,
  soundscapeSplash,
  soundscapeTide,
  soundscapeVoices,
} from './logic/soundscape.js';
import { walkView } from './walk-view.js';
import { environment, environmentHour } from './environment.js';
import { walkRenderer } from './walk/walk-state.js';
import { WATER_KIND_LOOKS } from './walk/water-data.js';
import { soundscapePlayerCreate } from './audio/soundscape-player.js';
import { ambience, soundEngine } from './sound.js';
/* eslint-disable no-func-assign */
expose({
  soundscapeFish: [() => soundscapeFish, v => ((soundscapeFish = v), provide({ soundscapeFish }))],
  soundscapeHere: [() => soundscapeHere, v => ((soundscapeHere = v), provide({ soundscapeHere }))],
  soundscapeOf: [() => soundscapeOf, v => (soundscapeOf = v)],
  soundscapeRuns: [() => soundscapeRuns],
  soundscapeScenes: [() => soundscapeScenes],
  soundscapeSplashPlay: [
    () => soundscapeSplashPlay,
    v => ((soundscapeSplashPlay = v), provide({ soundscapeSplashPlay })),
  ],
  soundscapeStart: [() => soundscapeStart, v => ((soundscapeStart = v), provide({ soundscapeStart }))],
  soundscapeWade: [() => soundscapeWade, v => ((soundscapeWade = v), provide({ soundscapeWade }))],
});
/* eslint-enable no-func-assign */
provide({ soundscapeFish, soundscapeHere, soundscapeSplashPlay, soundscapeStart, soundscapeWade });
/* to-module: end */
/* the scene's emitters in buckets, by scene, made again when the renderer's water grid changes */
const soundscapeScenes = new WeakMap();
/* a running kind when there is no flow map (logic/soundscape.js soundscapeCellsFromTiles) */
const soundscapeRuns = k => k === 'stream' || k === 'rapids';

/** the water's player on the ambience's context (initAmbience): its banks given to the tracker and baked in slices */
function soundscapeStart(c) {
  const T = soundEngine.tracker;
  if (!SOUNDSCAPE.water || !T || !T.bankAdd) return null;
  T.bankAdd(SOUNDSCAPE.banks);
  const P = soundscapePlayerCreate(c, {
    S: SOUNDSCAPE,
    noise: ambience.noise,
    out: ambience.lpW,
    tracker: T,
    rng: ambienceRandom(0x50d4),
    tide: () => soundscapeTide(typeof environmentHour === 'function' ? environmentHour() : 12),
    storm: () => (typeof environment !== 'undefined' && environment.on ? environment.storm || 0 : 0),
  });
  T.bankReady(P.banks());
  /* the water you touch has its own seeded random (never Math.random: logic/soundscape.js soundscapeSplash) */
  ambience.touchRng = ambienceRandom(0x50d5);
  return P;
}

/** a splash at t into dest (the World bus unless given): size 0-1, or a name in soundscape.json `touch` */
function soundscapeSplashPlay(size, t, dest) {
  const A = ambience.scape,
    S = SOUNDSCAPE.splash,
    k = typeof size === 'number' ? size : (SOUNDSCAPE.touch || {})[size];
  if (!A || !S || typeof k !== 'number' || !soundEngine.ctx) return false;
  A.splash(soundscapeSplash(S, k, ambience.touchRng), dest || ambience.bus, t ?? soundEngine.ctx.currentTime + 0.01);
  return true;
}

/** wading: a splash by how deep you stand (WA-6a), instead of a step's click */
function soundscapeWade(depth) {
  const U = SOUNDSCAPE.touch || {};
  if (U.wade == null) return false;
  const lo = U.wadeMin ?? 0.1;
  return soundscapeSplashPlay(lo + (U.wade - lo) * Math.min(1, depth / WADE_DEPTH));
}

/** fishing's sounds: the cast (a swish, then the float landing), a nibble, the bite, the reel's clicks while you hold
 * (one every touch.reel.every s however often it is asked), the fish fighting, the catch */
function soundscapeFish(k) {
  const U = SOUNDSCAPE.touch || {},
    A = ambience.scape,
    c = soundEngine.ctx;
  if (!A || !c) return;
  const t = c.currentTime + 0.01;
  if (k === 'cast') {
    if (U.swish)
      A.hit(ambience.bus, t, {
        type: 'highpass',
        f: U.swish.f,
        q: U.swish.q,
        a: 0.04,
        d: U.swish.d,
        gain: U.swish.gain,
      });
    soundscapeSplashPlay('cast', t + 0.55);
  } else if (k === 'reel') {
    const R = U.reel;
    if (!R || t - (ambience.reelAt || 0) < R.every) return;
    ambience.reelAt = t;
    A.hit(ambience.bus, t, { type: 'bandpass', f: R.f, q: R.q, a: 0.001, d: R.d, gain: R.gain });
  } else soundscapeSplashPlay(k, t);
}

/** the scene's emitters in buckets (made once per scene and water grid; the time and counts kept for the debug log) */
function soundscapeOf(sc) {
  const G = (typeof walkRenderer !== 'undefined' && walkRenderer.wgrid) || null;
  let M = soundscapeScenes.get(sc);
  if (M && M.G === G) return M;
  const t0 = performance.now(),
    cells = G
      ? soundscapeCells(
          G,
          WATER_KIND_LOOKS.map(w => w.k),
          walkRenderer.flowMap && walkRenderer.flowMap.cls,
          soundscapeRuns
        )
      : soundscapeCellsFromTiles(sc, (x, z) => wadeKindAt(sc, x, z), soundscapeRuns),
    E = soundscapeEmitters(SOUNDSCAPE, cells, sc, {
      sheets: (G && walkRenderer.falls) || [],
      fountains: (sc.props || []).filter(p => /fountain/.test(p.k)).map(p => [p.x, p.z]),
    });
  M = {
    G,
    buckets: Object.fromEntries(Object.entries(E).map(([k, L]) => [k, ambienceBuckets(L, 4)])),
    built: {
      ms: Math.round((performance.now() - t0) * 10) / 10,
      cells: cells.length,
      from: G ? 'grid' : 'tiles',
      emitters: Object.fromEntries(Object.entries(E).map(([k, L]) => [k, L.length])),
    },
  };
  soundscapeScenes.set(sc, M);
  return M;
}

/** the water near you now, played (sc null: none); E the environment */
function soundscapeHere(sc, E, t) {
  const A = ambience.scape,
    P = typeof walkView !== 'undefined' ? walkView.pl : null;
  if (!A) return;
  if (!sc || !P) {
    ambience.scapeWant = [];
    return void A.update([], t);
  }
  const M = soundscapeOf(sc),
    S = SOUNDSCAPE,
    R = (walkView.C && walkView.C.right) || [1, 0, 0],
    rain = E && !sc.indoor ? Math.min(1, E.rain || 0) : 0,
    want = [];
  ambience.scapeBuilt = M.built;
  for (const v of soundscapeVoices(S, M.buckets, P.x, P.z)) {
    /* rain on water: only while it rains, more drops the harder it does */
    if (v.recipe === S.rainOnWater) {
      if (rain < 0.05) continue;
      v.rate = rain;
      v.level *= Math.sqrt(rain);
    }
    v.pan = clamp(((v.x - P.x) * R[0] + (v.z - P.z) * R[2]) / 7, -1, 1) * 0.75;
    want.push(v);
  }
  /* cave drips ring in a cave's room (the tracker's reverb, SND-9), everything else in the open air's */
  const T = soundEngine.tracker,
    room = sc.indoor && sc.far === 'cave' ? 'cave' : 'open',
    R0 = T && T.reverbStats ? T.reverbStats() : null;
  /* (the Sound test's harp may have set another place: the room's own word is checked, not a copy) */
  if (T && T.reverbPlace && (R0 ? R0.place : ambience.scapeRoom) !== room) {
    ambience.scapeRoom = room;
    T.reverbPlace(room);
  }
  /* Surf: the wake round you while you ride and move */
  if (S.wake && P.surf && P.walk) want.push({ recipe: S.wake, k: 0, level: 1, d: 0.5, pan: 0 });
  /* SND-14: the frogs sing by the still water among these (nature-here.js) */
  ambience.scapeWant = want;
  A.update(want, t);
}
