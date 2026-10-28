'use strict';
/* ================= NATURE HERE (sound track SND-14) =================
   The weather, the wild and the town where you stand (game/data/soundscape.json `nature`; logic/nature-sound.js holds
   the numbers, audio/nature-player.js plays the one-shots):
   - rain by how hard it falls: the wash and the heavy roar (beds), patter round you, the rain on the roof over you
     indoors and on the nearest roof outdoors, drips off its eaves;
   - thunder after each of the weather's bolts (environment.bolts, not the flash), by its distance;
   - the wind by the place, lifted by the gusts the grass shows (the renderer's wind field where you stand), the leaves
     with it;
   - insects by the biome and hour, frogs at the still water near you at night (soundscape-here.js's water voices);
   - a fire by its size; the town's life instead of a murmur; a room's tone by its kind.
   sound.js calls natureHere every 200 ms (after ambienceBeds, before the beds are set) and natureStart once;
   the Sound test and tools/check-sound.py --loudness call naturePreviewTick. Birds and footsteps stay in sound.js,
   by these numbers. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide } from './hooks.js';
import { SOUNDSCAPE } from './game-data.js';
import { ambiencePlace, ambienceRandom } from './logic/ambience-sound.js';
import { soundscapeBubbles } from './logic/soundscape.js';
import {
  natureBouts,
  natureEvery,
  natureFire,
  natureFrogs,
  natureGust,
  natureInsects,
  naturePatter,
  natureRain,
  natureRoof,
  natureRoom,
  natureThunder,
  natureTown,
  natureWind,
} from './logic/nature-sound.js';
import { baseMapId, walkData, walkView } from './walk-view.js';
import { windGustAt } from './engine/webgl.js';
import { environmentHour } from './environment.js';
import { naturePlayerCreate } from './audio/nature-player.js';
import { ambience, soundEngine, soundPlacement } from './sound.js';
/* eslint-disable no-func-assign */
expose({
  NATURE_PREVIEW_KINDS: [() => NATURE_PREVIEW_KINDS],
  natureEaves: [() => natureEaves, v => (natureEaves = v)],
  natureFireNear: [() => natureFireNear, v => (natureFireNear = v)],
  natureGustAt: [() => natureGustAt, v => (natureGustAt = v)],
  natureHere: [() => natureHere, v => ((natureHere = v), provide({ natureHere }))],
  naturePreviewTick: [() => naturePreviewTick, v => ((naturePreviewTick = v), provide({ naturePreviewTick }))],
  natureRainHere: [() => natureRainHere, v => (natureRainHere = v)],
  natureStart: [() => natureStart, v => ((natureStart = v), provide({ natureStart }))],
  natureStates: [() => natureStates, v => (natureStates = v)],
  natureThunderHere: [() => natureThunderHere, v => (natureThunderHere = v)],
  natureTownHere: [() => natureTownHere, v => (natureTownHere = v)],
  natureWildHere: [() => natureWildHere, v => (natureWildHere = v)],
  natureWindHere: [() => natureWindHere, v => (natureWindHere = v)],
});
/* eslint-enable no-func-assign */
provide({ natureHere, naturePreviewTick, natureStart });
/* to-module: end */
/** the player and its states on the ambience's context (initAmbience); every choice from its own seeded random */
function natureStart(c) {
  if (!SOUNDSCAPE.nature) return null;
  ambience.natureRng = ambienceRandom(0x50d7);
  ambience.natureSt = natureStates();
  return naturePlayerCreate(c, { noise: ambience.noise, tracker: soundEngine.tracker, rng: ambienceRandom(0x50d6) });
}
/* where each stream of one-shots left off */
function natureStates() {
  return { patter: {}, drips: {}, town: {}, room: {}, cicada: {}, hop: [{}, {}], frogs: [{}, {}], bolts: null };
}

/** how far you stand from the nearest building's eaves (m; null with none within 12 m): its footprint as a circle */
function natureEaves(sc, P) {
  const C0 = walkData().sc;
  let best = null;
  for (const p of sc.props || []) {
    if (Math.abs(p.x - P.x) > 12 || Math.abs(p.z - P.z) > 12) continue;
    const M = C0.props[p.k];
    if (!M || !M.build || !M.box) continue;
    const d = Math.max(0, Math.hypot(p.x - P.x, p.z - P.z) - (Math.max(M.box[0], M.box[1]) * (p.s || 1)) / 2);
    if (best == null || d < best) best = d;
  }
  return best;
}

/** the nearest fire by its size: {v, pan, crackle} (sound.js soundPlacement), or null */
function natureFireNear(sc) {
  const F = SOUNDSCAPE.nature && SOUNDSCAPE.nature.fire,
    C0 = walkData().sc;
  if (!F) return null;
  let best = null;
  for (const p of sc.props || []) {
    const M = C0.props[p.k];
    if (!M || !(M.fx || []).some(e => e.k === 'fire')) continue;
    const S = natureFire(F, M.group || p.k, p.s || 1),
      w = soundPlacement(p.x, p.z, S.range);
    if (w && (!best || w.v * S.gain > best.v)) best = { v: w.v * S.gain, pan: w.pan, crackle: S.crackle };
  }
  return best;
}

/** the rain's beds and one-shots: k how hard it rains, thru how much of the outdoors you hear (1 out, 0.45 through a
 * room's walls, 0 indoors), indoor under a roof, eaves m from the nearest roof outdoors (null: none), leafy 0-1 */
function natureRainHere(T, pans, t, k, thru, indoor, eaves, leafy) {
  const N = SOUNDSCAPE.nature,
    R = natureRain(N.rain, k),
    A = ambience.naturePlayer,
    st = ambience.natureSt,
    r = ambience.natureRng;
  T.rain = R.wash * thru;
  T.rainHeavy = R.heavy * thru;
  T.rainRoof = natureRoof(N.rain.roof, eaves, indoor, k);
  pans.rain = pans.rainHeavy = pans.rainRoof = 0;
  if (!A) return;
  /* patter round you outdoors; drips off the eaves you stand under */
  for (const e of naturePatter(N.rain.patter, st.patter, t, t + 0.3, r, R.patter * (thru >= 1 ? 1 : 0), leafy))
    A.drop(ambience.lpW, e, 1, N.rain.patter.bank);
  const under = !indoor && eaves != null && eaves <= N.rain.roof.near && k > 0.05;
  for (const b of soundscapeBubbles(N.rain.drips, st.drips, t, t + 0.3, r, under ? Math.min(1, k) : 0))
    A.drip(ambience.lpW, b, 1);
}

/** thunder for each bolt since the last update (at most two at once), muffled indoors; none heard in a cave (deaf) */
function natureThunderHere(E, t, indoor, deaf) {
  const A = ambience.naturePlayer,
    st = ambience.natureSt,
    N = SOUNDSCAPE.nature;
  if (!A || !E) return;
  const n = E.bolts || 0;
  /* the bolts before you arrived, while the walk was not shown or the sound slept are not heard */
  if (st.bolts == null || n < st.bolts || t - (st.boltAt ?? -9) > 3 || deaf) st.bolts = n;
  st.boltAt = t;
  for (; st.bolts < n; st.bolts++) {
    const plan = natureThunder(N.thunder, ambience.natureRng);
    A.thunder(ambience.lpW, plan, t + plan.delay, N.thunder.cap, indoor ? 0.5 : 1);
    ambience.lastThunder = { km: plan.km, delay: Math.round(plan.delay * 10) / 10 };
  }
}

/** the wind's bed (by the place and the gusts) and the leaves lifted by the gusts: g the gust where you stand */
function natureWindHere(T, pans, E, sc, thru, town, g) {
  const W = SOUNDSCAPE.nature.wind;
  T.wind =
    natureWind(W, {
      storm: E ? E.storm : 0,
      snow: E ? E.snow : 0,
      alpine: !!E && E.climate === 'alpine',
      open: (sc.wind || 1) * (town ? W.town : 1),
      gust: g,
    }) * thru;
  pans.wind = 0;
  if (T.leaves) T.leaves *= natureGust({ gust: W.leaves }, g);
}

/** the wind field's gust at (x, z) now (engine/webgl.js windGustAt, the grass's own), 0 without one */
function natureGustAt(x, z, ms) {
  return typeof windGustAt === 'function' ? windGustAt(x, z, ms) : 0;
}

/** insects by the biome and hour; frogs at the still water near you (soundscape-here.js's voices) by night */
function natureWildHere(T, t, here, thru) {
  const N = SOUNDSCAPE.nature,
    A = ambience.naturePlayer,
    st = ambience.natureSt,
    r = ambience.natureRng,
    I = natureInsects(N.insects, here);
  T.crickets = I.crickets * thru;
  if (!A || thru <= 0) return;
  const amb = ambience.lpA || ambience.amb;
  if (I.day === 'grasshopper') {
    const G = N.insects.grasshopper;
    for (const e of natureBouts(st.hop.slice(0, G.callers), t, t + 0.3, r, G))
      A.chirr(amb, e.t, G, e.gain * thru, e.who ? 0.45 : -0.4);
  } else st.hop.forEach(k => (k.next = undefined));
  if (I.day === 'cicada') {
    const C = N.insects.cicada;
    for (const at of natureEvery(st.cicada, t, t + 0.3, r, C.every)) A.cicada(amb, at, C, thru, (r() * 2 - 1) * 0.6);
  } else st.cicada.next = undefined;
  /* frogs: by the nearest still water's voice, its level and pan */
  const F = N.frogs,
    f = natureFrogs(F, here.night, here.season, here.rain),
    V =
      f > 0
        ? (ambience.scapeWant || []).filter(v => F.near.includes(v.recipe)).sort((a, b) => b.level - a.level)[0]
        : null;
  if (!V) return void st.frogs.forEach(k => (k.next = undefined));
  for (const e of natureBouts(st.frogs.slice(0, F.callers), t, t + 0.3, r, F))
    A.croak(
      ambience.lpA || ambience.amb,
      e.t,
      F,
      e.gain * f * Math.min(1, V.level * 1.5) * thru,
      (V.pan || 0) + (e.who ? 0.25 : -0.25),
      e.who
    );
}

/** the town's life (instead of the murmur) and a room's tone by its kind, with its small sounds */
function natureTownHere(T, pans, t, town, thru, night, room, mapId) {
  const N = SOUNDSCAPE.nature,
    A = ambience.naturePlayer,
    st = ambience.natureSt,
    r = ambience.natureRng;
  T.town = 0;
  if (A && town && thru > 0)
    for (const e of natureTown(N.town, st.town, t, t + 0.3, r, night))
      A.town(ambience.lpA || ambience.amb, e, N.town.kinds[e.kind].gain * thru);
  if (!room) return;
  const R = natureRoom(N.rooms, mapId);
  T[R.bed] = Math.max(T[R.bed] || 0, R.level);
  pans[R.bed] = 0;
  if (A && R.events && R.every)
    for (const at of natureEvery(st.room, t, t + 0.3, r, R.every)) A.room(ambience.amb, R.events, 1, at);
}

/** the place's nature now: sets the beds' levels in T (and their pans), plays the one-shots */
function natureHere(sc, E, T, pans, t) {
  if (!SOUNDSCAPE.nature || !sc) return;
  const P = walkView.pl;
  if (!P) return;
  const indoor = !!sc.indoor && sc.far !== 'cave',
    thru = !sc.indoor ? 1 : sc.roomRect ? 0.45 : 0,
    rain = E && sc.far !== 'cave' ? E.rain || 0 : 0,
    g = natureGustAt(P.x, P.z, walkView.t || 0),
    night = (E && E.raw ? E.raw.night : 0) || 0,
    town = !!ambience.town;
  natureRainHere(
    T,
    pans,
    t,
    rain,
    thru,
    indoor,
    indoor ? null : natureEaves(sc, P),
    Math.min(1, (ambience.trees || 0) / 8)
  );
  natureThunderHere(E, t, indoor, sc.far === 'cave');
  natureWindHere(T, pans, E, sc, thru, town, g);
  const F = natureFireNear(sc);
  T.fire = F ? F.v : 0;
  pans.fire = F ? F.pan : 0;
  if (ambience.beds.fire) ambience.beds.fire.crackle = F ? F.crackle : undefined;
  natureWildHere(
    T,
    t,
    {
      biome: sc.biome,
      hour: typeof environmentHour === 'function' ? environmentHour() : 12,
      night,
      season: (E && E.season) || 'summer',
      rain,
      town,
    },
    thru
  );
  natureTownHere(T, pans, t, town, thru, night, !!sc.room, typeof baseMapId === 'function' ? baseMapId() : null);
}

/* the Sound test's and the loudness report's nature: [kind, metres, what] (rain, roof and roofIn by how hard it rains;
   thunder by its km; wind by the storm; grasshopper, cicada; frogs at metres; fire at metres by its size; townLife;
   roomTone by its kind) */
const NATURE_PREVIEW_KINDS = [
  'rain',
  'roof',
  'roofIn',
  'thunder',
  'wind',
  'gusts',
  'grasshopper',
  'cicada',
  'frogs',
  'fire',
  'townLife',
  'roomTone',
];

/** a preview's nature (sound.js ambiencePreviewTick): sets the beds' levels in T and plays the one-shots */
function naturePreviewTick(list, T, t) {
  const N = SOUNDSCAPE.nature;
  if (!N || !ambience.naturePlayer) return;
  const pans = {},
    g = natureGustAt(0, 0, t * 1000),
    st = ambience.natureSt;
  /* a new preview starts its one-shots at once (the game waits its usual while: a cicada may be 25 s away) */
  const key = JSON.stringify(list);
  if (st.preview !== key) {
    st.preview = key;
    for (const k of ['cicada', 'town', 'room']) st[k].next = t + 0.3;
    for (const k of [...st.hop, ...st.frogs]) Object.assign(k, { next: t + 0.3, left: 12 });
    st.previewThunder = null;
  }
  for (const [k, d, w] of list) {
    if (!NATURE_PREVIEW_KINDS.includes(k)) continue;
    if (k === 'rain') natureRainHere(T, pans, t, w ?? 1, 1, false, null, 0.5);
    else if (k === 'roof') natureRainHere(T, pans, t, w ?? 1, 1, false, d, 0.3);
    else if (k === 'roofIn') natureRainHere(T, pans, t, w ?? 1, 0, true, null, 0);
    else if (k === 'thunder') {
      /* one bolt at w km now and every 14 s */
      if (st.previewThunder == null || st.previewThunder > t + 20) st.previewThunder = t;
      if (t >= st.previewThunder) {
        const plan = natureThunder(N.thunder, ambience.natureRng, w ?? 1);
        ambience.naturePlayer.thunder(ambience.lpW, plan, t + 0.1, N.thunder.cap, 1);
        st.previewThunder = t + 14;
      }
    } else if (k === 'wind' || k === 'gusts')
      natureWindHere(
        T,
        pans,
        { storm: w ?? (k === 'wind' ? 1 : 0), snow: 0, climate: 'mild' },
        {},
        1,
        false,
        k === 'gusts' ? Math.max(g, 0.3 + 1.2 * Math.max(0, Math.sin(t / 3))) : g
      );
    else if (k === 'grasshopper' || k === 'cicada')
      natureWildHere(
        T,
        t,
        { biome: k === 'cicada' ? 'desert' : 'meadow', hour: 13, night: 0, season: 'summer', rain: 0, town: false },
        1
      );
    else if (k === 'frogs') {
      ambience.scapeWant = [{ recipe: N.frogs.near[0], level: ambiencePlace(d, 14), pan: 0 }];
      natureWildHere(T, t, { biome: 'pond', hour: 23, night: 1, season: 'summer', rain: 0, town: false }, 1);
    } else if (k === 'fire') {
      const S = natureFire(N.fire, 'campfire', w ?? 1);
      T.fire = ambiencePlace(d, S.range) * S.gain;
      if (ambience.beds.fire) ambience.beds.fire.crackle = S.crackle;
    } else if (k === 'townLife') natureTownHere(T, pans, t, true, 1, 0, false, null);
    else if (k === 'roomTone') natureTownHere(T, pans, t, false, 0, 0, true, 'int_' + (w || 'house'));
  }
}
