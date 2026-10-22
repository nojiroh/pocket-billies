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
  MUSIC_WHERE_KEYS: [() => MUSIC_WHERE_KEYS],
  // @ts-expect-error -- replaced on purpose
  musicWhereMatches: [() => musicWhereMatches, v => (musicWhereMatches = v)],
  // @ts-expect-error -- replaced on purpose
  songFor: [() => songFor, v => (songFor = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
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
