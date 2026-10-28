// @ts-check
'use strict';
/* ================= MUSIC PATTERNS (sound track SND-11) =================
   What the song's fixed lines play at a step: the bass, the arpeggio (harmony) and the drums, as the tracker's tick
   wrote them since SND-2, made into pure "what plays at this step" functions. Both of the tracker's paths read them:
   `gb` (today's four chip voices, game/js/audio/tracker.js, its sound kept bit for bit) and an ensemble (baked
   instruments, music.json `ensembles`). A step is i, 0-15 in bar b; D is a composed song (trackerCompose: prog, key,
   deg). Lengths are in sixteenths (the tracker multiplies by its seconds a step). Logic only: plays nothing; runs in
   Node (tools/test/music-patterns.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  MUSIC_PATTERN_ARP: [() => MUSIC_PATTERN_ARP],
  MUSIC_PATTERN_BASS: [() => MUSIC_PATTERN_BASS],
  MUSIC_PATTERN_DRUMS: [() => MUSIC_PATTERN_DRUMS],
  // @ts-expect-error -- replaced on purpose
  musicArpAt: [() => musicArpAt, v => (musicArpAt = v)],
  // @ts-expect-error -- replaced on purpose
  musicBassAt: [() => musicBassAt, v => (musicBassAt = v)],
  // @ts-expect-error -- replaced on purpose
  musicChordTones: [() => musicChordTones, v => (musicChordTones = v)],
  // @ts-expect-error -- replaced on purpose
  musicDrumsAt: [() => musicDrumsAt, v => (musicDrumsAt = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/**
 * @typedef {{prog: number[], key: number, deg: (n: number) => number, bass?: string, arp?: string, drums?: string,
 *   seventh?: number, arpOctave?: number}} MusicPatternSong
 * @typedef {{m: number, len: number}} MusicPatternNote
 * @typedef {{notes: number[], len: number, kind: string}} MusicPatternChord
 * @typedef {{hit: 'kick' | 'snare' | 'hat' | 'rim', vol: number, gb?: {dur: number, hp?: number, bp?: number,
 *   q?: number}}} MusicPatternHit
 *   a drum hit; gb is the chip noise's shape (tracker.js synthNoise) that the `gb` path plays it with
 */

/** the bass patterns (music.schema.json recipe.bass) */
export const MUSIC_PATTERN_BASS = ['bounce', 'gallop', 'long', 'walk', 'drive', 'pedal', 'none'];
/** the arpeggio patterns (recipe.arp) */
export const MUSIC_PATTERN_ARP = ['up', 'updown', 'drip', 'chord7', 'none'];
/** the drum patterns (recipe.drums) */
export const MUSIC_PATTERN_DRUMS = ['soft', 'skip', 'drive', 'march', 'bossa', 'none'];

/**
 * the bass note that starts at step i of bar b, or null: the root two octaves under the chord, moved by the pattern
 * @param {MusicPatternSong} D
 * @param {number} b
 * @param {number} i
 * @param {string} [style] the pattern (the song's own when left out)
 * @returns {MusicPatternNote | null}
 */
export function musicBassAt(D, b, i, style = D.bass) {
  const ch = D.prog[b],
    root = D.deg(ch) - 24;
  if (style === 'bounce' && i % 4 === 0) return { m: i % 8 ? root + 7 : root, len: 3 };
  if (style === 'gallop' && [0, 3, 4, 8, 11, 12].includes(i)) return { m: i % 8 === 4 ? root + 12 : root, len: 1.5 };
  if (style === 'long' && i === 0) return { m: root, len: 15 };
  if (style === 'walk' && i % 4 === 0) return { m: D.deg(ch + [0, 2, 4, 5][i / 4]) - 24, len: 3.5 };
  if (style === 'drive' && i % 2 === 0) return { m: root + (i % 8 === 6 ? 12 : 0), len: 1.6 };
  /* SND-5: the tense pedal, eighths on the key's flat seventh (under the bass's home) whatever the chord */
  if (style === 'pedal' && i % 2 === 0) return { m: D.key - 26 + (i % 8 === 6 ? 12 : 0), len: 1.6 };
  return null;
}

/**
 * the bar's chord as the arpeggio picks from it: the triad and the seventh (or the octave), lifted by arpOctave
 * @param {MusicPatternSong} D
 * @param {number} b
 * @returns {number[]} four midi notes
 */
export function musicChordTones(D, b) {
  const ch = D.prog[b];
  return [0, 2, 4, D.seventh ? 6 : 7].map(x => D.deg(ch + x) + 12 * (D.arpOctave || 0));
}

/**
 * the arpeggio's notes that start at step i of bar b, or null. four: a four-voice song (the arp on the second pulse:
 * drip and chord7 thinner); otherwise an `extra` song's (sine drips two octaves up, chords of four)
 * @param {MusicPatternSong} D
 * @param {number} b
 * @param {number} i
 * @param {boolean} four
 * @param {string} [style] the pattern (the song's own when left out)
 * @returns {MusicPatternChord | null}
 */
export function musicArpAt(D, b, i, four, style = D.arp) {
  const tri = musicChordTones(D, b),
    pick = (/** @type {number} */ k) => tri[((k % 4) + 4) % 4];
  if (four && style === 'drip' && (i === 0 || i === 6 || i === 11))
    return { notes: [pick(i) + 12], len: 1.5, kind: 'drip' };
  if (four && style === 'chord7' && i % 2 === 0) return { notes: [tri[i % 4 ? 3 : 1] + 12], len: 1.2, kind: 'chord7' };
  if (style === 'up' && i % 2 === 0) return { notes: [pick(i / 2) + 12], len: 1.2, kind: 'up' };
  if (style === 'updown' && i % 2 === 0)
    return { notes: [pick([0, 1, 2, 3, 2, 1, 0, 1][(i / 2) % 8]) + 12], len: 1.2, kind: 'updown' };
  if (style === 'drip' && (i === 0 || i === 6 || i === 11)) return { notes: [pick(i) + 24], len: 2, kind: 'drip' };
  if (style === 'chord7' && (i === 0 || i === 6 || i === 10))
    return { notes: tri.map(n => n + 12), len: i === 0 ? 5 : 3, kind: 'chord7' };
  return null;
}

/**
 * the drum hits at step i, in the order the `gb` path plays them (its noise draws a random start each, so the order
 * is part of the sound)
 * @param {string | undefined} style
 * @param {number} i
 * @returns {MusicPatternHit[]}
 */
export function musicDrumsAt(style, i) {
  /** @type {MusicPatternHit[]} */
  const out = [];
  if (style === 'soft') {
    if (i === 0 || i === 8) out.push({ hit: 'kick', vol: 0.25 });
    if (i === 4 || i === 12) out.push({ hit: 'snare', vol: 0.08, gb: { dur: 0.08, bp: 1800, q: 0.8 } });
    if (i % 4 === 2) out.push({ hit: 'hat', vol: 0.04, gb: { dur: 0.03, hp: 7000 } });
  } else if (style === 'skip') {
    if (i === 0 || i === 10) out.push({ hit: 'kick', vol: 0.3 });
    if (i === 4 || i === 12) out.push({ hit: 'snare', vol: 0.1, gb: { dur: 0.1, bp: 2000, q: 0.7 } });
    if (i % 2 === 0) out.push({ hit: 'hat', vol: 0.035, gb: { dur: 0.025, hp: 8000 } });
  } else if (style === 'drive') {
    if (i % 4 === 0) out.push({ hit: 'kick', vol: 0.42 });
    if (i === 4 || i === 12) out.push({ hit: 'snare', vol: 0.14, gb: { dur: 0.12, bp: 1800, q: 0.6 } });
    out.push({ hit: 'hat', vol: i % 2 ? 0.025 : 0.045, gb: { dur: 0.02, hp: 8000 } });
  } else if (style === 'march') {
    if (i === 0 || i === 8 || i === 11) out.push({ hit: 'kick', vol: 0.42 });
    if (i % 4 === 2 || i === 14 || i === 15) out.push({ hit: 'snare', vol: 0.11, gb: { dur: 0.07, bp: 2400, q: 0.8 } });
    if (i % 2 === 0) out.push({ hit: 'hat', vol: 0.03, gb: { dur: 0.02, hp: 9000 } });
  } else if (style === 'bossa') {
    if (i === 0 || i === 6 || i === 8 || i === 14) out.push({ hit: 'kick', vol: 0.2 });
    if ([3, 6, 10, 13].includes(i)) out.push({ hit: 'rim', vol: 0.05, gb: { dur: 0.03, bp: 3500, q: 2 } });
  }
  return out;
}
