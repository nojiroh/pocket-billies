// @ts-check
'use strict';
/* ================= MUSIC LAYERS (sound track SND-13) =================
   Layers in play: a song's ensemble parts that the game brings in and out (music.json ensembles, a part's `layer` and
   `dim`), always on a beat or a bar line. The game says how much of each layer it wants (0-1, sound.js musicLayersNow):
   - walk: a tambourine (Copperleaf) or snare (routes) as you walk, out about a bar after you stop (B2W2's Route 1);
   - rain, snow, storm: a light ringing and brushes, sleigh bells, low strings and timpani rolls (ACNH's versions);
   - night: the tune handed to a flute, the drums thinner;
   - busker: a street musician's part by distance (earshot about 8 m), panned by direction (B2W2's musicians);
   - build, peak: a battle's intensity (turns, KOs, hits, the red zone, a boss's phases) and the run's arc.
   Two levels are read the other way round: `still` is 1 − walk and `calm` is 1 − build, and only when the game gives
   walk or build, so a song with no layer levels at all (every fingerprint render before SND-13) plays its ensemble as
   written: layer parts silent, nothing dimmed. Logic only: plays nothing; the tracker (audio/tracker.js) schedules the
   ramps at step times; runs in Node (tools/test/music-layers.test.mjs). A battle's hits and coming KOs are read with the
   VFX track's hitTier and koAhead (logic/battle-anims.js), handed in by the caller (sound.js) so this file imports
   nothing. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  MUSIC_LAYERS: [() => MUSIC_LAYERS],
  MUSIC_LAYER_ARC: [() => MUSIC_LAYER_ARC],
  MUSIC_LAYER_BUSKER: [() => MUSIC_LAYER_BUSKER],
  MUSIC_LAYER_DERIVED: [() => MUSIC_LAYER_DERIVED],
  MUSIC_LAYER_NAMES: [() => MUSIC_LAYER_NAMES],
  MUSIC_LAYER_QUICK: [() => MUSIC_LAYER_QUICK],
  MUSIC_LAYER_TESTS: [() => MUSIC_LAYER_TESTS],
  MUSIC_LAYER_WALK_HOLD: [() => MUSIC_LAYER_WALK_HOLD],
  musicLayerArc: [() => musicLayerArc],
  // @ts-expect-error -- replaced on purpose
  musicLayerBattle: [() => musicLayerBattle, v => (musicLayerBattle = v)],
  // @ts-expect-error -- replaced on purpose
  musicLayerBusker: [() => musicLayerBusker, v => (musicLayerBusker = v)],
  musicLayerClamp: [() => musicLayerClamp],
  // @ts-expect-error -- replaced on purpose
  musicLayerFight: [() => musicLayerFight, v => (musicLayerFight = v)],
  // @ts-expect-error -- replaced on purpose
  musicLayerFightStart: [() => musicLayerFightStart, v => (musicLayerFightStart = v)],
  // @ts-expect-error -- replaced on purpose
  musicLayerGain: [() => musicLayerGain, v => (musicLayerGain = v)],
  musicLayerHas: [() => musicLayerHas],
  // @ts-expect-error -- replaced on purpose
  musicLayerLevel: [() => musicLayerLevel, v => (musicLayerLevel = v)],
  // @ts-expect-error -- replaced on purpose
  musicLayerListen: [() => musicLayerListen, v => (musicLayerListen = v)],
  // @ts-expect-error -- replaced on purpose
  musicLayerMove: [() => musicLayerMove, v => (musicLayerMove = v)],
  musicLayerPan: [() => musicLayerPan],
  musicLayerRound: [() => musicLayerRound],
  // @ts-expect-error -- replaced on purpose
  musicLayerTests: [() => musicLayerTests, v => (musicLayerTests = v)],
  // @ts-expect-error -- replaced on purpose
  musicLayerWalk: [() => musicLayerWalk, v => (musicLayerWalk = v)],
  // @ts-expect-error -- replaced on purpose
  musicLayerWeather: [() => musicLayerWeather, v => (musicLayerWeather = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the layers the game sets (sound.js musicLayersNow), 0-1 each; buskerPan rides beside them */
export const MUSIC_LAYERS = ['walk', 'rain', 'snow', 'storm', 'night', 'busker', 'build', 'peak'];
/** the layers read the other way round, and what they are read from */
export const MUSIC_LAYER_DERIVED = /** @type {Record<string, string>} */ ({ still: 'walk', calm: 'build' });
/** every name a part's `layer` or `dim` may use (music.schema.json $defs.layer) */
export const MUSIC_LAYER_NAMES = [...MUSIC_LAYERS, ...Object.keys(MUSIC_LAYER_DERIVED)];
/** the layers that move on a beat (your steps, the busker as you pass); the rest move on a bar line */
export const MUSIC_LAYER_QUICK = ['walk', 'still', 'busker'];
/** the street musician: in earshot under 8 m (out again past 9), full within 2 m; you stop to listen within 5 m for
    3 s, and listen until you are 7 m off */
export const MUSIC_LAYER_BUSKER = { earshot: 8, off: 9, full: 2, listen: 5, leave: 7, listenSec: 3 };
/** walking: the beat stays this long (s) after you stop, so a pause between taps never drops it */
export const MUSIC_LAYER_WALK_HOLD = 0.4;
/** the run's arc as layers: how much `peak` each band of rows adds (music.json run.arc's names) */
export const MUSIC_LAYER_ARC = /** @type {Record<string, number>} */ ({ mid: 0.6, late: 1 });
/** the layer levels the fingerprints and the Sound test play: layer:<name> */
export const MUSIC_LAYER_TESTS = /** @type {Record<string, Record<string, number>>} */ ({
  walk: { walk: 1 },
  still: { walk: 0 },
  rain: { rain: 1 },
  snow: { snow: 1 },
  storm: { rain: 1, storm: 1 },
  night: { night: 1 },
  busker: { busker: 1, buskerPan: 0.4 },
  intensity1: { build: 0, peak: 0 },
  intensity2: { build: 1, peak: 0 },
  intensity3: { build: 1, peak: 1 },
});

/**
 * @typedef {{layer?: string, dim?: Record<string, number>}} MusicLayerPart an ensemble part's layer keys
 * @typedef {Record<string, number | undefined>} MusicLayerLevels the game's levels, 0-1 (and buskerPan, -1 to 1)
 */

export const musicLayerClamp = (/** @type {number} */ v) => (v > 1 ? 1 : v > 0 ? v : 0);
/** to the nearest 1/50, so a level that drifts a little never starts a new ramp */
export const musicLayerRound = (/** @type {number} */ v) => Math.round(v * 50) / 50;

/**
 * a layer's level (0 when the game gives none; still and calm only once walk or build is given)
 * @param {MusicLayerLevels | null | undefined} lv @param {string} k @returns {number}
 */
export function musicLayerLevel(lv, k) {
  if (!lv) return 0;
  const from = MUSIC_LAYER_DERIVED[k];
  if (from) return lv[from] == null ? 0 : 1 - musicLayerClamp(/** @type {number} */ (lv[from]));
  return musicLayerClamp(lv[k] || 0);
}

/**
 * a part's layer gain: its layer's level (1 for a part with none), times each `dim` reached as far as its layer is up
 * (dim {night: 0.3}: 0.3 of it at full night)
 * @param {MusicLayerPart} P @param {MusicLayerLevels | null | undefined} lv @returns {number}
 */
export function musicLayerGain(P, lv) {
  let g = P.layer ? musicLayerLevel(lv, P.layer) : 1;
  for (const [k, d] of Object.entries(P.dim || {})) g *= 1 - musicLayerLevel(lv, k) * (1 - d);
  return musicLayerRound(g);
}

/** whether a part moves with the layers at all @param {MusicLayerPart} P */
export const musicLayerHas = P => !!(P.layer || (P.dim && Object.keys(P.dim).length));

/**
 * whether a part's gain moves at this step (st, from the song's start) from `from` to `to`, and over how many beats:
 * a quick layer (walk, still, the busker) on a beat (walk in over a beat, out over two from a bar line, so the beat
 * goes about a bar after you stop); every other on a bar line, over a bar
 * @param {MusicLayerPart} P @param {number} st @param {number} from @param {number} to
 * @returns {{beats: number} | null}
 */
export function musicLayerMove(P, st, from, to) {
  if (from === to || st < 0) return null;
  const keys = [P.layer, ...Object.keys(P.dim || {})],
    busk = keys.includes('busker'),
    quick = keys.some(k => k && MUSIC_LAYER_QUICK.includes(k));
  if (busk) return st % 4 === 0 ? { beats: 1 } : null;
  if (quick) {
    /* coming in (the tambourine on a step, or the standing beat thinned): on the next beat */
    const up = P.layer === 'still' ? to < from : to > from;
    if (up) return st % 4 === 0 ? { beats: 1 } : null;
    return st % 16 === 0 ? { beats: 2 } : null;
  }
  return st % 16 === 0 ? { beats: 4 } : null;
}

/**
 * walking, as the beat hears it: 1 while you move and for a moment after you stop
 * @param {boolean} moving @param {number} stillSec seconds since you last moved @returns {number}
 */
export function musicLayerWalk(moving, stillSec) {
  return moving || stillSec < MUSIC_LAYER_WALK_HOLD ? 1 : 0;
}

/**
 * the weather a song's layers hear (the environment's rain, snow and storm, 0-1 or so), none indoors
 * @param {{rain?: number, snow?: number, storm?: number} | null | undefined} E @param {boolean} indoor
 */
export function musicLayerWeather(E, indoor) {
  const f = (/** @type {number | null | undefined} */ v) =>
    E && !indoor ? musicLayerRound(musicLayerClamp(((v || 0) - 0.2) / 0.6)) : 0;
  return { rain: f(E && E.rain), snow: f(E && E.snow), storm: f(E && E.storm) };
}

/**
 * the street musician by distance (m): in earshot under 8 m, out again past 9 (hysteresis: on is whether it was in
 * earshot), louder as you come nearer, full within 2 m
 * @param {number} d @param {boolean} on @returns {{on: boolean, level: number}}
 */
export function musicLayerBusker(d, on) {
  const K = MUSIC_LAYER_BUSKER,
    now = on ? d < K.off : d < K.earshot;
  if (!now) return { on: false, level: 0 };
  return { on: true, level: musicLayerRound(Math.pow(musicLayerClamp((K.off - d) / (K.off - K.full)), 1.5)) };
}

/**
 * whether you are listening to the busker (then its whole song, the last run's theme, plays): you stood still within 5 m
 * for 3 s, and until you are 7 m off
 * @param {number} d @param {number} stillSec @param {boolean} was @returns {boolean}
 */
export function musicLayerListen(d, stillSec, was) {
  const K = MUSIC_LAYER_BUSKER;
  return was ? d < K.leave : d < K.listen && stillSec >= K.listenSec;
}

/**
 * the busker's pan from where it stands against the camera's right (soundPlacement's pan), to the nearest 0.05
 * @param {number} pan -1 left to 1 right @returns {number}
 */
export const musicLayerPan = pan => Math.round(Math.max(-1, Math.min(1, pan)) * 20) / 20;

/**
 * @typedef {{events: any[] | null, at: number, turns: number, kos: number, phases: number, hits: number,
 *   koNext: boolean}} MusicLayerFight what a battle's music has heard so far
 */
/** a battle's record, at its start @returns {MusicLayerFight} */
export function musicLayerFightStart() {
  return { events: null, at: 0, turns: 0, kos: 0, phases: 0, hits: 0, koNext: false };
}

/**
 * the battle heard up to the line playing (activeBattle.events[ev]): a new turn's lines are a new list; KOs (faint),
 * a boss's phases (alphaPhase), crits and four-times hits (logic/battle-anims.js hitTier); and whether the line playing
 * knocks something out (koAhead)
 * @param {MusicLayerFight} F @param {{an?: any}[]} events @param {number} ev
 * @param {{hitTier: (an: any) => string, koAhead: (events: any[], i: number) => {ko: boolean}}} read
 *   logic/battle-anims.js's hitTier and koAhead
 * @returns {MusicLayerFight}
 */
export function musicLayerFight(F, events, ev, read) {
  if (!events) return F;
  if (events !== F.events) {
    if (F.events) F.turns++;
    F.events = events;
    F.at = 0;
  }
  const last = Math.min(ev, events.length - 1);
  for (; F.at <= last; F.at++) {
    const an = events[F.at] && events[F.at].an;
    if (!an) continue;
    if (an.k === 'faint') F.kos++;
    else if (an.k === 'alphaPhase') F.phases++;
    else if (an.k === 'move') {
      const h = read.hitTier(an);
      if (h === 'crit' || h === 'super4') F.hits++;
    }
  }
  F.koNext = ev >= 0 && ev < events.length && read.koAhead(events, ev).ko;
  return F;
}

/**
 * a battle's intensity as layers: build from the intro (0) to full as turns pass, KOs land, big hits and a boss's
 * phases; peak in the red zone, as a KO lands, and once a boss has changed phase
 * @param {MusicLayerFight} F @param {boolean} redZone @param {boolean} boss @returns {{build: number, peak: number}}
 */
export function musicLayerBattle(F, redZone, boss) {
  const build = musicLayerRound(musicLayerClamp(0.25 * F.turns + 0.3 * F.kos + 0.35 * F.phases + 0.15 * F.hits));
  return { build, peak: redZone || F.koNext || (boss && F.phases > 0) ? 1 : 0 };
}

/**
 * the run's arc as layers: its band's `peak` (rows 3-5 0.6, 6-8 full), none off the bands
 * @param {string | null} band musicArcBand's @returns {number}
 */
export const musicLayerArc = band => (band && MUSIC_LAYER_ARC[band]) || 0;

/**
 * the layer tests an ensemble can play (MUSIC_LAYER_TESTS names), from the layers its parts name: the fingerprints'
 * `layer:<name>` parts and the Sound test's
 * @param {{parts: MusicLayerPart[]} | null | undefined} E @returns {string[]}
 */
export function musicLayerTests(E) {
  const named = new Set();
  for (const P of (E && E.parts) || []) for (const k of [P.layer, ...Object.keys(P.dim || {})]) if (k) named.add(k);
  const out = [];
  if (named.has('walk')) out.push('walk');
  if (named.has('still')) out.push('still');
  for (const k of ['rain', 'snow', 'storm', 'night', 'busker']) if (named.has(k)) out.push(k);
  if (named.has('build') || named.has('calm')) out.push('intensity1');
  if (named.has('peak')) out.push('intensity3');
  return out;
}
