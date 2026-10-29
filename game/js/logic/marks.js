// @ts-check
'use strict';
/* ================= THE MARKS (UI track, UI-14a) =================
   What each of the new marks shows, as data, so the kit's parts (js/ui-marks-kit.js: pb-tag, pb-chip, pb-proc, pb-info,
   pb-rarity) and the screens that use them later (UI-14b) agree: the colour code id that colours it (logic/signals.js),
   its glyph (UI_GLYPHS) or arrow, its short code, and the word a screen reader says (rule 3: never colour alone).
   docs/phases/ui-track.md, "The colour code": statuses are angled tags with a glyph and a 3-letter code; a boost or
   drop is the arrow first (▲ teal, ▼ red), the stat's short name and pips; a short effect is its glyph and the turns
   left; a plate's tag row shows up to 3 and "+N". Logic only: no DOM, runs in Node (tools/test/ui-marks.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { glyphOf } from './signals.js';
/* eslint-disable no-func-assign */
expose({
  MARK_CHIP_FAMILIES: [() => MARK_CHIP_FAMILIES],
  MARK_EFFECT_NAMES: [() => MARK_EFFECT_NAMES],
  MARK_PATTERNS: [() => MARK_PATTERNS],
  MARK_RARITY: [() => MARK_RARITY],
  MARK_ROW_MAX: [() => MARK_ROW_MAX],
  MARK_STATUS_CODES: [() => MARK_STATUS_CODES],
  MARK_STAT_SHORT: [() => MARK_STAT_SHORT],
  PIPS_MAX: [() => PIPS_MAX],
  STATUS_WORDS: [() => STATUS_WORDS],
  // @ts-expect-error -- replaced on purpose
  chipLook: [() => chipLook, v => (chipLook = v)],
  // @ts-expect-error -- replaced on purpose
  fxTags: [() => fxTags, v => (fxTags = v)],
  // @ts-expect-error -- replaced on purpose
  markRow: [() => markRow, v => (markRow = v)],
  // @ts-expect-error -- replaced on purpose
  rarityHighest: [() => rarityHighest, v => (rarityHighest = v)],
  // @ts-expect-error -- replaced on purpose
  rarityTier: [() => rarityTier, v => (rarityTier = v)],
  // @ts-expect-error -- replaced on purpose
  tagLook: [() => tagLook, v => (tagLook = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the statuses' codes (statuses.json ids; the owner's answer 2: a 3-letter code on an angled tag) */
export const MARK_STATUS_CODES = /** @type {Record<string, string>} */ ({ brn: 'BRN', par: 'PAR', slp: 'SLP' });
/** the statuses' words when the caller gives none (statuses.json has the game's) */
export const STATUS_WORDS = /** @type {Record<string, string>} */ ({ brn: 'Burned', par: 'Paralyzed', slp: 'Asleep' });
/** the stats' short names (stats.json ids; HP has a bar, not a tag), as Pokémon Showdown writes them */
export const MARK_STAT_SHORT = /** @type {Record<string, [string, string]>} */ ({
  lev: ['Atk', 'Attack'],
  law: ['Def', 'Defense'],
  lob: ['SpA', 'Sp. Atk'],
  pr: ['SpD', 'Sp. Def'],
  hus: ['Spe', 'Speed'],
});
/** the short effects' words (UI_GLYPHS.effect's ids) */
export const MARK_EFFECT_NAMES = /** @type {Record<string, string>} */ ({
  protect: 'Protect',
  shield: 'Shield',
  confused: 'Confused',
  soaked: 'Soaked',
  fork: 'Fork',
  delayed: 'Delayed hit',
  stones: 'Stones',
  sandstorm: 'Sandstorm',
});
/** a plate's tag row: up to 3 tags, then "+N" (ui-track.md "Less clutter"; UI-15 builds the row) */
export const MARK_ROW_MAX = 3;
/** the pips a boost or drop shows at most (rules.json battle.stageMax is 6) */
export const PIPS_MAX = 6;
/** the Colour shapes switch (the owner's answer 11): the pattern each colour code id draws over its colour, so two
 * marks that look alike to a colour-blind player still differ. Ids without one stay plain */
export const MARK_PATTERNS = /** @type {Record<string, string>} */ ({
  bad: 'cross',
  caution: 'stripe',
  brn: 'stripe',
  par: 'bars',
  slp: 'dots',
  special: 'dots',
  growth: 'rise',
});

/**
 * @typedef {{ kind: string, mark?: string, stat?: string, stages?: number, turns?: number, n?: number,
 *   word?: string }} TagSpec
 * @typedef {{ kind: string, sig: string, glyph: string, arrow: string, code: string, pips: number, turns: number,
 *   word: string, pattern: string }} TagLook
 */
/**
 * what a tag shows. kind: 'status' (mark brn, par or slp), 'stat' (stat a stats.json id, stages from -6 to 6: a
 * boost or a drop), 'effect' (mark a UI_GLYPHS.effect id, turns left; 0 or none: no count), 'more' (n hidden tags).
 * `word` overrides the spoken word (the game's own names, statuses.json). An unknown mark gives a neutral tag with
 * its id, never an empty one
 * @param {TagSpec} t @returns {TagLook}
 */
export function tagLook(t) {
  const k = String((t && t.kind) || ''),
    id = String((t && t.mark) || ''),
    out = { kind: k, sig: '', glyph: '', arrow: '', code: '', pips: 0, turns: 0, word: '', pattern: '' };
  if (k === 'status') {
    const G = glyphOf('status', id);
    out.sig = G ? G[1] : '';
    out.glyph = G ? G[0] : '';
    out.code = MARK_STATUS_CODES[id] || id.toUpperCase().slice(0, 3);
    out.word = t.word || STATUS_WORDS[id] || id;
  } else if (k === 'stat') {
    const s = Math.max(-PIPS_MAX, Math.min(PIPS_MAX, Math.trunc(Number(t.stages) || 0))),
      S = MARK_STAT_SHORT[String(t.stat || '')] || [String(t.stat || '?'), String(t.stat || '?')];
    out.sig = s > 0 ? 'good' : s < 0 ? 'bad' : '';
    out.arrow = s > 0 ? '▲' : s < 0 ? '▼' : '';
    out.code = S[0];
    out.pips = Math.abs(s);
    out.word =
      t.word || (s ? `${S[1]} ${s > 0 ? 'up' : 'down'} ${Math.abs(s)} stage${Math.abs(s) === 1 ? '' : 's'}` : S[1]);
  } else if (k === 'effect') {
    const G = glyphOf('effect', id),
      n = Math.max(0, Math.trunc(Number(t.turns) || 0));
    out.sig = G ? G[1] : '';
    out.glyph = G ? G[0] : '';
    out.turns = n;
    const name = t.word || MARK_EFFECT_NAMES[id] || id;
    out.word = n ? `${name}, ${n} turn${n === 1 ? '' : 's'} left` : name;
  } else if (k === 'more') {
    const n = Math.max(0, Math.trunc(Number(t.n) || 0));
    out.code = `+${n}`;
    out.word = t.word || `${n} more`;
  } else out.word = t.word || id || k;
  out.pattern = MARK_PATTERNS[out.sig] || '';
  return out;
}

/** a plate's tags in the order they show: the status first (its fixed slot by the HP bar), then boosts and drops,
 * then short effects; past `max`, the rest fold into one "+N" tag @param {TagSpec[]} tags @param {number} [max] */
export function markRow(tags, max = MARK_ROW_MAX) {
  const order = { status: 0, stat: 1, effect: 2 },
    list = (tags || [])
      .filter(t => t && t.kind in order)
      .map((t, i) => ({ t, i }))
      .sort((a, b) => (order[a.t.kind] ?? 3) - (order[b.t.kind] ?? 3) || a.i - b.i)
      .map(x => x.t);
  if (list.length <= max) return list;
  /* the "+N" takes the last spot, so the row is never wider than max tags */
  const shown = list.slice(0, Math.max(0, max - 1));
  return [...shown, { kind: 'more', n: list.length - shown.length }];
}

/** rarity: the four tiers of the loot ladder (the owner's answer 9) and their names. rarities.json's fifth tier,
 * `starter` (the starters' stat totals), shows as common: the ladder has four colours and a starter is no rarer than
 * a common Billie to the player (UI-14a, the owner to review) */
export const MARK_RARITY = /** @type {Record<string, string>} */ ({
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  mythical: 'Mythical',
});
/** a rarity id as its tier on the ladder: starter -> common; '' for none or an unknown one @param {string} [id] */
export function rarityTier(id) {
  const r = String(id || '').toLowerCase();
  if (r === 'starter') return 'common';
  return MARK_RARITY[r] ? r : '';
}
/** UI-14b: the highest tier of several (a Gene with two traits shows the rarer); '' when none has one
 * @param {(string | undefined)[]} ids */
export function rarityHighest(ids) {
  const order = Object.keys(MARK_RARITY);
  let best = -1;
  for (const id of ids || []) best = Math.max(best, order.indexOf(rarityTier(id)));
  return best < 0 ? '' : order[best];
}

/** UI-14b: what an effect's rows show as tags beside its text: each stat row (a Perk's, held item's or trait's "Speed
 * up a stage") as a boost or drop tag with Atk..Spe; the other kinds are numbers the text already says
 * @param {{ kind: string, stat?: string, stages?: number }[] | undefined} fx @returns {TagSpec[]} */
export function fxTags(fx) {
  return (fx || [])
    .filter(f => f && f.kind === 'stat' && f.stat && Number(f.stages))
    .map(f => ({ kind: 'stat', stat: String(f.stat), stages: Number(f.stages) }));
}

/** pb-chip's families: the currencies (currencies.json ids and their icons), the map's nodes (nodeTypes.json ids, with
 * UI-8c's place icons) and messages (the eight families by name). [colour code id ('' neutral), icon ('' the family's
 * glyph)] */
export const MARK_CHIP_FAMILIES = /** @type {Record<string, [string, string]>} */ ({
  money: ['value', 'coin'],
  research: ['growth', 'research'],
  scrap: ['machine', 'scrap'],
  dna: ['bio', 'dna'],
  crests: ['bad', 'crest'],
  beans: ['', 'bean'],
  /* UI-14b: a map node's chip shows its place icon (UI-8c's art/ui/node-*.svg, the bowl's badges); a stall and a
     friend's ghost have none, so they keep their family's glyph */
  landing: ['', 'node-landing'],
  route: ['', 'node-route'],
  town: ['good', 'node-town'],
  event: ['special', 'node-event'],
  stall: ['value', ''],
  shop: ['value', 'node-shop'],
  miniboss: ['bad', 'node-miniboss'],
  boss: ['bad', 'node-boss'],
  rival: ['bad', 'node-rival'],
  ghost: ['special', ''],
  scrapyard: ['machine', 'node-scrapyard'],
  good: ['good', ''],
  bad: ['bad', ''],
  caution: ['caution', ''],
  value: ['value', ''],
  special: ['special', ''],
  growth: ['growth', ''],
  machine: ['machine', ''],
  bio: ['bio', ''],
  info: ['', ''],
});
/** a chip's colour code id and icon: the kind's family, or `family` and `icon` given by the caller. icon is a UI icon
 * (art/ui, fixed colours: a currency's own) or, when the kind has none, its family's glyph (tinted, 'g-*'); `glyph`
 * says which. A neutral chip with no icon of its own has none
 * @param {string} kind @param {{ family?: string, icon?: string }} [o]
 * @returns {{ sig: string, icon: string, glyph: boolean }} */
export function chipLook(kind, o = {}) {
  const F = MARK_CHIP_FAMILIES[String(kind || '')] || ['', ''],
    sig = o.family != null && o.family !== '' ? String(o.family) : F[0];
  if (o.icon) return { sig, icon: String(o.icon), glyph: String(o.icon).startsWith('g-') };
  if (F[1]) return { sig, icon: F[1], glyph: false };
  const G = sig ? glyphOf('family', sig) : null;
  return { sig, icon: G ? G[0] : '', glyph: !!G };
}
