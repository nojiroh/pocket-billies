// @ts-check
'use strict';
/* ================= MUSIC FOR THE STUDIO (sound track SND-3) =================
   What the Studio's Music & sound section and its Check need to know about music.json, as plain logic: a chord's
   roman numeral in a scale, a note's name, a where-rule in words, where each song plays, and the problems worth a
   warning. tools/check-data.mjs reports the same errors. Logic only: no sound, no page; runs in Node
   (tools/test/music-studio.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { MUSIC_PATTERN_ARP, MUSIC_PATTERN_BASS, MUSIC_PATTERN_DRUMS, musicJingleKitNote } from './music-patterns.js';
/* eslint-disable no-func-assign */
expose({
  MUSIC_CHOICES: [() => MUSIC_CHOICES],
  MUSIC_CODE_SONGS: [() => MUSIC_CODE_SONGS],
  MUSIC_RECIPE_KEYS: [() => MUSIC_RECIPE_KEYS],
  MUSIC_SCALES: [() => MUSIC_SCALES],
  MUSIC_STYLE_OF: [() => MUSIC_STYLE_OF],
  MUSIC_VERSION_LINES: [() => MUSIC_VERSION_LINES],
  NOTE_NAMES: [() => NOTE_NAMES],
  ROMAN: [() => ROMAN],
  // @ts-expect-error -- replaced on purpose
  chordNumeral: [() => chordNumeral, v => (chordNumeral = v)],
  isMusicPlaceholder: [() => isMusicPlaceholder],
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
    ['pedal', 'Pedal (eighths on the flat seventh: tense)'],
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
  /* SND-11: what an ensemble's part plays (music.schema.json ensemblePart.line) */
  line: [
    ['lead', 'Lead (the tune)'],
    ['counter', 'Counter (the countermelody)'],
    ['bass', 'Bass (the bass pattern)'],
    ['arp', 'Arpeggio (the arp pattern)'],
    ['pad', 'Pad (the bar’s chord, held)'],
    ['stabs', 'Stabs (the chord, short)'],
    ['timp', 'Timpani (roots and a roll)'],
    ['drums', 'Drums (the drum pattern on a kit)'],
  ],
  /* SND-11: an instrument's kind (instrument.kind) */
  kind: [
    ['pluck', 'Pluck (a string)'],
    ['fm', 'FM (bells, an e-piano)'],
    ['partials', 'Partials (struck bars, timpani)'],
    ['stack', 'Stack (strings, reeds, a choir, brass)'],
    ['wind', 'Wind (a flute, a clarinet, a bass)'],
    ['hit', 'Hit (a drum, a shaker)'],
  ],
};
/** SND-11: the keys a recipe may have (music.schema.json $defs.recipe), so musicFindings can catch a typo in a night,
    tense or arc version (the schema leaves a recipe open there); plus the lines a version may write anew */
export const MUSIC_RECIPE_KEYS = [
  'bpm',
  'key',
  'scale',
  'prog',
  'lead',
  'bass',
  'arp',
  'drums',
  'seed',
  'swing',
  'echo',
  'trim',
  'seventh',
  'extra',
  'pluck',
  'arpOctave',
  'counterAuto',
  'ensemble',
];
export const MUSIC_VERSION_LINES = ['hook', 'counter', 'intro'];
/** SND-11: which patterns a part's style may name, by its line */
export const MUSIC_STYLE_OF = /** @type {Record<string, string[]>} */ ({
  bass: MUSIC_PATTERN_BASS,
  arp: MUSIC_PATTERN_ARP,
  drums: MUSIC_PATTERN_DRUMS,
});
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
 * rule (its index) it is about, so the Studio can show it. SND-4: notes (info) on hooks and jingles still named as
 * placeholders; SND-6: on base cries and the species' cries (more.lines) too; SND-11: ensembles and instruments a song,
 * its versions or a part names that don't exist, a pattern a part can't play, typos in night, tense and arc versions
 * @param {{songs: Record<string, any>, where: Record<string, any>[], jingles?: Record<string, any>, cries?: {bases?: Record<string, any>}, instruments?: Record<string, any>, ensembles?: Record<string, any>, run?: {arc?: any[]}}} music
 * @param {{nodeTypes?: Record<string, unknown>, biomes?: Record<string, unknown>, locations?: any[], scriptText?: string, lines?: {id: string, names: string[], cry?: any[]}[]}} [more]
 * @returns {{lvl: 'error' | 'warn' | 'info', msg: string, song?: string, jingle?: string, cry?: string, rule?: number, place?: string}[]}
 */
export function musicFindings(music, more = {}) {
  /** @type {{lvl: 'error' | 'warn' | 'info', msg: string, song?: string, jingle?: string, cry?: string, rule?: number, place?: string}[]} */
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
  /* SND-11: ensembles: the ids songs and their versions name, the instruments their parts name, typos in versions */
  const ens = /** @type {Record<string, any>} */ (music.ensembles || {}),
    inst = /** @type {Record<string, any>} */ (music.instruments || {}),
    ensOk = (/** @type {unknown} */ id) => id === undefined || id === 'gb' || (typeof id === 'string' && !!ens[id]);
  for (const [id, S] of Object.entries(songs)) {
    if (!ensOk(S.ensemble)) out.push({ lvl: 'error', msg: `song "${id}": no ensemble "${S.ensemble}"`, song: id });
    for (const v of ['night', 'tense'])
      if (S[v] && typeof S[v] === 'object') {
        if (!ensOk(S[v].ensemble))
          out.push({ lvl: 'error', msg: `song "${id}" ${v}: no ensemble "${S[v].ensemble}"`, song: id });
        for (const k of Object.keys(S[v]))
          if (!MUSIC_RECIPE_KEYS.includes(k) && !MUSIC_VERSION_LINES.includes(k))
            out.push({ lvl: 'warn', msg: `song "${id}" ${v}: "${k}" is not part of a recipe (a typo?)`, song: id });
      }
  }
  ((music.run && music.run.arc) || []).forEach((/** @type {any} */ B) => {
    const ch = (B && B.changes) || {};
    if (!ensOk(ch.ensemble)) out.push({ lvl: 'error', msg: `run arc "${B.name}": no ensemble "${ch.ensemble}"` });
    for (const k of Object.keys(ch))
      if (!MUSIC_RECIPE_KEYS.includes(k))
        out.push({ lvl: 'warn', msg: `run arc "${B.name}": "${k}" is not part of a recipe (a typo?)` });
  });
  for (const [id, E] of Object.entries(ens))
    ((E && E.parts) || []).forEach((/** @type {any} */ P, i) => {
      const at = `ensemble "${id}" part ${i + 1} (${P.line})`;
      if (P.inst && !inst[P.inst]) out.push({ lvl: 'error', msg: `${at}: no instrument "${P.inst}"` });
      for (const [hit, k] of Object.entries(P.kit || {}))
        if (!inst[k]) out.push({ lvl: 'error', msg: `${at}: its ${hit} names no instrument "${k}"` });
      if (P.line === 'drums' && !P.kit) out.push({ lvl: 'warn', msg: `${at}: drums with no kit play nothing` });
      if (P.style && !(MUSIC_STYLE_OF[P.line] || []).includes(P.style))
        out.push({ lvl: 'error', msg: `${at}: "${P.style}" is not a ${P.line} pattern` });
    });
  /* SND-17: a jingle's ensemble and the lines its parts read */
  for (const [id, J] of Object.entries(/** @type {Record<string, any>} */ (music.jingles || {}))) {
    if (!ensOk(J.ensemble)) {
      out.push({ lvl: 'error', msg: `jingle "${id}": no ensemble "${J.ensemble}"`, jingle: id });
      continue;
    }
    const E = J.ensemble && J.ensemble !== 'gb' ? ens[J.ensemble] : null,
      lines = (E && E.parts ? E.parts : []).map((/** @type {any} */ P) => P.line),
      has = (/** @type {string[]} */ L) => L.some(l => lines.includes(l)),
      perc = /** @type {number[][]} */ (J.perc || []);
    if (!E && (J.harmony || J.bass || J.perc))
      out.push({
        lvl: 'warn',
        msg: `jingle "${id}": harmony, bass and perc play only on an ensemble (it has none)`,
        jingle: id,
      });
    if (!E) continue;
    if (J.harmony && J.harmony.length && !has(['pad', 'stabs', 'arp']))
      out.push({
        lvl: 'warn',
        msg: `jingle "${id}": no part of "${J.ensemble}" plays its harmony (pad, stabs or arp)`,
        jingle: id,
      });
    if (J.bass && J.bass.length && !has(['bass']))
      out.push({ lvl: 'warn', msg: `jingle "${id}": no part of "${J.ensemble}" plays its bass`, jingle: id });
    if (perc.some(N => musicJingleKitNote(N[1])) && !has(['drums']))
      out.push({
        lvl: 'warn',
        msg: `jingle "${id}": no drums part of "${J.ensemble}" plays its kit notes`,
        jingle: id,
      });
    if (perc.some(N => !musicJingleKitNote(N[1])) && !has(['timp']))
      out.push({
        lvl: 'warn',
        msg: `jingle "${id}": no timp part of "${J.ensemble}" plays its pitched perc notes`,
        jingle: id,
      });
  }
  const uses = musicSongUses(music, more);
  for (const [id, u] of Object.entries(uses))
    if (!u.length) out.push({ lvl: 'warn', msg: `song "${id}": no where-rule, place or script plays it`, song: id });
  /* SND-4: hooks and jingles still named as placeholders (Claude's drafts, for the owner to keep, change or rename) */
  const songsLeft = Object.keys(songs).filter(id => isMusicPlaceholder(songs[id].hookName)),
    jingles = music.jingles || {},
    jinglesLeft = Object.keys(jingles).filter(id => isMusicPlaceholder(jingles[id].name));
  if (songsLeft.length)
    out.push({
      lvl: 'info',
      msg: `placeholder hooks (${songsLeft.length}): ${songsLeft.join(', ')}. Keep, change or rename each`,
      song: songsLeft[0],
    });
  if (jinglesLeft.length)
    out.push({
      lvl: 'info',
      msg: `placeholder jingles (${jinglesLeft.length}): ${jinglesLeft.join(', ')}. Keep, change or rename each`,
      jingle: jinglesLeft[0],
    });
  /* SND-6: base cries and the species' own cries still named as placeholders */
  const bases = (music.cries && music.cries.bases) || {},
    basesLeft = Object.keys(bases).filter(k => isMusicPlaceholder(bases[k] && bases[k].name));
  if (basesLeft.length)
    out.push({
      lvl: 'info',
      msg: `placeholder base cries (${basesLeft.length}): ${basesLeft.join(', ')}. Keep, change or rename each`,
      cry: basesLeft[0],
    });
  const criesLeft = (more.lines || []).flatMap(L =>
    L.names.filter((n, i) => isMusicPlaceholder(((L.cry || [])[i] || {}).name)).map(n => n)
  );
  if (criesLeft.length)
    out.push({
      lvl: 'info',
      msg: `placeholder Billie cries (${criesLeft.length}): ${criesLeft.join(', ')}. Keep, change or rename each in its Cry card`,
    });
  return out;
}
/** SND-4: a hook's or jingle's name marks it as a placeholder while it starts with "placeholder" @param {unknown} name */
export const isMusicPlaceholder = name => typeof name === 'string' && /^\s*placeholder\b/i.test(name);

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
