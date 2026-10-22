// @ts-check
'use strict';
/* ================= WHERE THE MUSIC PLAYS (sound track SND-2) =================
   Which song fits where you are, from music.json's where table: an ordered list of rules, the first whose every key
   matches the state wins. sound.js's musicFor builds the state (started, the battle's kind, the open tab, indoors, the
   map, the place's kind and its own song, and in a run the node's type, biome and row) and plays what this picks.
   Logic only: no sound, no page; runs in Node (tools/test/sound.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  MUSIC_BATTLE_KINDS: [() => MUSIC_BATTLE_KINDS],
  MUSIC_WHERE_KEYS: [() => MUSIC_WHERE_KEYS],
  RED_ZONE: [() => RED_ZONE],
  // @ts-expect-error -- replaced on purpose
  musicArcBand: [() => musicArcBand, v => (musicArcBand = v)],
  // @ts-expect-error -- replaced on purpose
  musicBattleKind: [() => musicBattleKind, v => (musicBattleKind = v)],
  // @ts-expect-error -- replaced on purpose
  musicRedZone: [() => musicRedZone, v => (musicRedZone = v)],
  // @ts-expect-error -- replaced on purpose
  musicWhereMatches: [() => musicWhereMatches, v => (musicWhereMatches = v)],
  // @ts-expect-error -- replaced on purpose
  songFor: [() => songFor, v => (songFor = v)],
  // @ts-expect-error -- replaced on purpose
  songVariant: [() => songVariant, v => (songVariant = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** SND-5: the kinds of battle a where-rule's `battle` names. A friend's ghost (RL-15) joins when it exists */
export const MUSIC_BATTLE_KINDS = ['wild', 'trainer', 'rival', 'leader', 'boss'];

/**
 * SND-5: the kind of a battle, for the where table: a run's mini-boss is a leader and its boss the boss (logic/run-loop.js
 * runFoes' runFoe), Chad the rival, any other trainer a trainer, else wild. null out of battle
 * @param {{ kind?: string, T?: { who?: string, runFoe?: string } } | null | undefined} B the battle
 * @returns {string | null}
 */
export function musicBattleKind(B) {
  if (!B) return null;
  if (B.kind !== 'trainer') return 'wild';
  const T = B.T || {};
  return T.runFoe === 'boss' ? 'boss' : T.runFoe === 'miniboss' ? 'leader' : T.who === 'chad' ? 'rival' : 'trainer';
}

/** SND-5: the red zone, the share of its HP under which the lead Billie's battle song turns tense */
export const RED_ZONE = 0.25;
/**
 * SND-5: is a Billie with this much HP in the red zone? (alive, under a quarter)
 * @param {number} hp @param {number} max
 */
export function musicRedZone(hp, max) {
  return max > 0 && hp > 0 && hp / max < RED_ZONE;
}

/** the keys a where-rule can match on; a rule's `song` is what it picks */
export const MUSIC_WHERE_KEYS = ['started', 'battle', 'tab', 'indoor', 'map', 'placeKind', 'nodeType', 'biome', 'row'];

/**
 * does this rule fit the state? Every key the rule names must match: `map` is a list (any of them), `row` a range
 * (from, to), `started` and `indoor` yes or no, the others equal
 * @param {Record<string, any>} rule
 * @param {Record<string, any>} state
 */
export function musicWhereMatches(rule, state) {
  for (const k of MUSIC_WHERE_KEYS) {
    if (rule[k] === undefined) continue;
    const v = state[k];
    if (k === 'map') {
      if (!rule.map.includes(v)) return false;
    } else if (k === 'row') {
      if (typeof v !== 'number' || v < rule.row[0] || v > rule.row[1]) return false;
    } else if (k === 'started' || k === 'indoor') {
      if (!!v !== rule[k]) return false;
    } else if (rule[k] !== v) return false;
  }
  return true;
}

/**
 * the song for this state: the first matching rule's song. `$place` is the place's own song (state.placeMusic) when
 * it is a song, else that rule is passed over. null when no rule matches
 * @param {Record<string, any>} state
 * @param {Record<string, any>[]} where
 * @param {Record<string, unknown>} songs
 * @returns {string | null}
 */
export function songFor(state, where, songs) {
  for (const W of where || []) {
    if (!musicWhereMatches(W, state)) continue;
    if (W.song === '$place') {
      if (state.placeMusic && songs[state.placeMusic]) return state.placeMusic;
      continue;
    }
    return W.song;
  }
  return null;
}

/**
 * SND-5: the run's arc: the band of music.json's run.arc whose rows hold this place's row, on a run's walkable node
 * (not a town node, not the map tab); null elsewhere and on the rows no band names (the first, as written)
 * @param {Record<string, any>} state songFor's state
 * @param {{ arc?: { name: string, row: number[] }[] } | undefined} run music.json's run
 * @returns {string | null} the band's name
 */
export function musicArcBand(state, run) {
  if (!state.nodeType || state.nodeType === 'town' || state.tab === 'map' || typeof state.row !== 'number') return null;
  const B = ((run && run.arc) || []).find(b => state.row >= b.row[0] && state.row <= b.row[1]);
  return B ? B.name : null;
}

/**
 * SND-4: day or night. The song's night version ('town@night', audio/tracker.js trackerNight) when it is night
 * outdoors, out of battle, and the song has one (not `night: false`). Night from 0.6, day again below 0.4: in between,
 * what plays stays, so dusk doesn't flip the song back and forth. SND-5: in battle, the tense version ('wild@tense',
 * trackerTense) while the lead Billie is in the red zone (state.redZone), unless the song has `tense: false`. In a run, the
 * arc band's version first ('meadow@late', musicArcBand), unless the song has `arc: false`; at night 'meadow@late@night'.
 * In the run's last days (run.deadlineDays, and past the deadline) the deadline version alone ('meadow@deadline')
 * @param {string | null} name the song for the place (songFor)
 * @param {Record<string, any>} state songFor's state plus `night`, the environment's night level (0 day, 1 night)
 * @param {Record<string, any>} songs
 * @param {string | null} [playing] the song playing now
 * @param {{ arc?: { name: string, row: number[] }[], deadlineDays?: number }} [run] music.json's run
 * @returns {string | null}
 */
export function songVariant(name, state, songs, playing = null, run = undefined) {
  const S = name ? songs[name] : null;
  if (S && state.battle) return state.redZone && S.tense !== false ? name + '@tense' : name;
  if (!S || state.indoor) return name;
  /* SND-5: the run's last days before its deadline, and every day past it: the deadline version, over the band and
     the night (state.daysLeft: 1 on the deadline day, 0 or less past it) */
  if (
    S.deadline !== false &&
    state.nodeType &&
    state.tab !== 'map' &&
    typeof state.daysLeft === 'number' &&
    state.daysLeft <= ((run && run.deadlineDays) || 1)
  )
    return name + '@deadline';
  const band = S.arc === false ? null : musicArcBand(state, run),
    day = band ? name + '@' + band : name;
  if (S.night === false) return day;
  const n = state.night || 0,
    night = day + '@night';
  return n > 0.6 || (playing === night && n >= 0.4) ? night : day;
}
