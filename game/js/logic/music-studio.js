// @ts-check
'use strict';
/* ================= MUSIC FOR THE STUDIO (sound track SND-3) =================
   What the Studio's Music & sound section and its Check need to know about music.json, as plain logic: a chord's
   roman numeral in a scale, a note's name, a where-rule in words, where each song plays, and the problems worth a
   warning. tools/check-data.mjs reports the same errors. Logic only: no sound, no page; runs in Node
   (tools/test/music-studio.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  MUSIC_CHOICES: [() => MUSIC_CHOICES],
  MUSIC_CODE_SONGS: [() => MUSIC_CODE_SONGS],
  MUSIC_SCALES: [() => MUSIC_SCALES],
  NOTE_NAMES: [() => NOTE_NAMES],
  ROMAN: [() => ROMAN],
  // @ts-expect-error -- replaced on purpose
  chordNumeral: [() => chordNumeral, v => (chordNumeral = v)],
  // @ts-expect-error -- replaced on purpose
  musicFindings: [() => musicFindings, v => (musicFindings = v)],
  // @ts-expect-error -- replaced on purpose
  musicJingleList: [() => musicJingleList, v => (musicJingleList = v)],
  // @ts-expect-error -- replaced on purpose
  musicJingleNotes: [() => musicJingleNotes, v => (musicJingleNotes = v)],
  musicNoteName: [() => musicNoteName],
  // @ts-expect-error -- replaced on purpose
  musicRuleText: [() => musicRuleText, v => (musicRuleText = v)],
  // @ts-expect-error -- replaced on purpose
  musicSongUses: [() => musicSongUses, v => (musicSongUses = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the scales a song can use, as semitones above the key (audio/tracker.js plays the same table) */
export const MUSIC_SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixo: [0, 2, 4, 5, 7, 9, 10],
};
/** a recipe's choices with the words the Studio shows for them (music.schema.json's enums, in the same order: a test
    holds them together) */
export const MUSIC_CHOICES = {
  scale: [
    ['major', 'Major'],
    ['minor', 'Minor'],
    ['dorian', 'Dorian (minor, bright sixth)'],
    ['lydian', 'Lydian (major, raised fourth)'],
    ['mixo', 'Mixolydian (major, flat seventh)'],
  ],
  wave: [
    ['p12', 'Pulse 12.5 % (thin)'],
    ['p25', 'Pulse 25 %'],
    ['p50', 'Pulse 50 % (square)'],
    ['square', 'Square (browser)'],
    ['triangle', 'Triangle (soft)'],
    ['sine', 'Sine (pure)'],
    ['sawtooth', 'Sawtooth (buzzy)'],
  ],
  bass: [
    ['bounce', 'Bounce (root, fifth)'],
    ['gallop', 'Gallop'],
    ['long', 'Long (one note a bar)'],
    ['walk', 'Walk (up the chord)'],
    ['drive', 'Drive (eighths)'],
    ['none', 'None'],
  ],
  arp: [
    ['up', 'Up'],
    ['updown', 'Up and down'],
    ['drip', 'Drip (three high drops)'],
    ['chord7', 'Chords (four sines; two notes in a four-voice song)'],
    ['none', 'None'],
  ],
  drums: [
    ['soft', 'Soft'],
    ['skip', 'Skip'],
    ['drive', 'Drive'],
    ['march', 'March'],
    ['bossa', 'Bossa'],
    ['none', 'None'],
  ],
};
/** the songs the game's code starts by name (title.js and story.js the title, opening-fall.js the fall), not the
    where table: tools/test/music-studio.test.mjs checks this list against the code */
export const MUSIC_CODE_SONGS = ['title', 'fall'];
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * the chord on a scale degree (0-6) as a roman numeral: upper case major, lower case minor, º diminished, + augmented,
 * with b or # where its root sits off the major scale's (mixolydian's VII is bVII)
 * @param {string} scale
 * @param {number} degree
 */
export function chordNumeral(scale, degree) {
  const sc = MUSIC_SCALES[/** @type {keyof typeof MUSIC_SCALES} */ (scale)] || MUSIC_SCALES.major,
    d = ((degree % 7) + 7) % 7,
    at = (/** @type {number} */ k) => sc[(d + k) % 7] + (d + k >= 7 ? 12 : 0),
    third = at(2) - at(0),
    fifth = at(4) - at(0),
    off = sc[d] - MUSIC_SCALES.major[d],
    acc = off < 0 ? 'b' : off > 0 ? '#' : '',
    up = third === 4;
  const name = up ? ROMAN[d] : ROMAN[d].toLowerCase();
  return acc + name + (fifth === 6 ? 'º' : fifth === 8 ? '+' : '');
}

/**
 * a midi note's name with its octave (60 is C4)
 * @param {number} midi
 */
export const musicNoteName = midi => NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);

/**
 * a where-rule in words, its song left out: "battle wild", "biome lake · rows 2-4", "everywhere else"
 * @param {Record<string, any>} rule
 */
export function musicRuleText(rule) {
  const parts = [];
  for (const [k, v] of Object.entries(rule)) {
    if (k === 'song') continue;
    if (k === 'row') parts.push(v[0] === v[1] ? `row ${v[0]}` : `rows ${v[0]}-${v[1]}`);
    else if (k === 'map') parts.push(`map ${v.join(', ')}`);
    else if (k === 'started') parts.push(v ? 'in the game' : 'before the game starts');
    else if (k === 'indoor') parts.push(v ? 'indoors' : 'outdoors');
    else parts.push(`${k} ${v}`);
  }
  return parts.length ? parts.join(' · ') : 'everywhere else';
}

/**
 * where each song plays: the where-rules that pick it (by number, with the rule in words), the places whose own
 * `music` names it (a `$place` rule plays them), the scripts that ask for it (`music <song>`) and the code
 * @param {{songs: Record<string, unknown>, where: Record<string, any>[]}} music
 * @param {{locations?: any[], scriptText?: string}} [more] the places, and all story text to look for `music <song>` in
 * @returns {Record<string, string[]>}
 */
export function musicSongUses(music, more = {}) {
  /** @type {Record<string, string[]>} */
  const uses = {};
  for (const id of Object.keys(music.songs || {})) uses[id] = [];
  (music.where || []).forEach((W, i) => {
    if (uses[W.song]) uses[W.song].push(`rule ${i + 1}: ${musicRuleText(W)}`);
  });
  for (const L of more.locations || []) if (L && L.music && uses[L.music]) uses[L.music].push(`place ${L.id}`);
  const said = new Set();
  for (const m of (more.scriptText || '').matchAll(/(?:^|[^\w])music ([a-z][\w]*)/g)) said.add(m[1]);
  for (const id of said) if (uses[id]) uses[id].push('a story script');
  for (const id of MUSIC_CODE_SONGS) if (uses[id]) uses[id].push('the game’s code');
  return uses;
}

/**
 * the music's problems: errors (a rule names no song, a node type or biome that doesn't exist, a last rule that
 * doesn't always match, a place's song that isn't one) and warnings (a song nothing plays). Each says which song or
 * rule (its index) it is about, so the Studio can show it
 * @param {{songs: Record<string, unknown>, where: Record<string, any>[]}} music
 * @param {{nodeTypes?: Record<string, unknown>, biomes?: Record<string, unknown>, locations?: any[], scriptText?: string}} [more]
 * @returns {{lvl: 'error' | 'warn', msg: string, song?: string, rule?: number, place?: string}[]}
 */
export function musicFindings(music, more = {}) {
  /** @type {{lvl: 'error' | 'warn', msg: string, song?: string, rule?: number, place?: string}[]} */
  const out = [];
  const songs = music.songs || {},
    where = music.where || [];
  where.forEach((W, i) => {
    if (W.song !== '$place' && !songs[W.song])
      out.push({ lvl: 'error', msg: `where[${i}]: no song "${W.song}"`, rule: i });
    if (W.nodeType && more.nodeTypes && !more.nodeTypes[W.nodeType])
      out.push({ lvl: 'error', msg: `where[${i}]: no node type "${W.nodeType}" (nodeTypes.json)`, rule: i });
    if (W.biome && more.biomes && !more.biomes[W.biome])
      out.push({ lvl: 'error', msg: `where[${i}]: no biome "${W.biome}" (biomes.json)`, rule: i });
  });
  const last = where[where.length - 1];
  if (!last || Object.keys(last).some(k => k !== 'song') || last.song === '$place')
    out.push({
      lvl: 'error',
      msg: 'the last where-rule must match everywhere (a song and nothing else), so some song always plays',
      rule: Math.max(0, where.length - 1),
    });
  for (const L of more.locations || [])
    if (L && L.music && !songs[L.music])
      out.push({ lvl: 'error', msg: `${L.id}: music "${L.music}" is not a song (music.json)`, place: L.id });
  const uses = musicSongUses(music, more);
  for (const [id, u] of Object.entries(uses))
    if (!u.length) out.push({ lvl: 'warn', msg: `song "${id}": no where-rule, place or script plays it`, song: id });
  return out;
}

/**
 * a jingle's list ([midi, sixteenths] one after another, 0 a rest) as notes on a timeline ([step, midi, length])
 * @param {number[][]} list
 */
export function musicJingleNotes(list) {
  /** @type {number[][]} */
  const out = [];
  let st = 0;
  for (const [m, l] of list) {
    if (m) out.push([st, m, l]);
    st += l;
  }
  return out;
}
/**
 * notes on a timeline as a jingle's list: in order, a gap a rest
 * @param {number[][]} notes
 */
export function musicJingleList(notes) {
  /** @type {number[][]} */
  const out = [];
  let at = 0;
  for (const [st, m, l] of [...notes].sort((a, b) => a[0] - b[0])) {
    if (st > at) out.push([0, st - at]);
    out.push([m, l]);
    at = st + l;
  }
  return out;
}
