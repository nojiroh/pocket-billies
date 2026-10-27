// @ts-check
'use strict';
/* ================= THE COLOUR CODE (UI track, UI-11) =================
   uiTheme.json defaults.signals: the colours that mean something, the same in every palette (docs/phases/ui-track.md,
   "The colour code"). Each id has a fill (tags, chips and bars on dark glass, with dark text on them) and a text shade
   per side (words and bars on light and on dark screens). The theme sheet writes them as --sig-<id> and
   --sig-<id>-text (logic/ui-theme.js); this file holds the ids, the sets of colours that sit together on one screen,
   and the maths the checks use: OKLab distance and a colour-blind simulation (Machado, Oliveira and Fernandes 2009,
   full strength). Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  UI_CVD: [() => UI_CVD],
  UI_SIGNALS: [() => UI_SIGNALS],
  UI_SIGNAL_IDS: [() => UI_SIGNAL_IDS],
  UI_SIGNAL_MIN: [() => UI_SIGNAL_MIN],
  UI_SIGNAL_SETS: [() => UI_SIGNAL_SETS],
  // @ts-expect-error -- replaced on purpose
  cvdHex: [() => cvdHex, v => (cvdHex = v)],
  // @ts-expect-error -- replaced on purpose
  linearHex: [() => linearHex, v => (linearHex = v)],
  // @ts-expect-error -- replaced on purpose
  linearRgb: [() => linearRgb, v => (linearRgb = v)],
  // @ts-expect-error -- replaced on purpose
  nearestPair: [() => nearestPair, v => (nearestPair = v)],
  // @ts-expect-error -- replaced on purpose
  oklab: [() => oklab, v => (oklab = v)],
  // @ts-expect-error -- replaced on purpose
  oklabDistance: [() => oklabDistance, v => (oklabDistance = v)],
  sigVar: [() => sigVar],
  // @ts-expect-error -- replaced on purpose
  signalSetColours: [() => signalSetColours, v => (signalSetColours = v)],
  // @ts-expect-error -- replaced on purpose
  signalVars: [() => signalVars, v => (signalVars = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the ids in the Studio's order: id, name, group, what it means */
export const UI_SIGNALS = /** @type {[string, string, string, string][]} */ ([
  [
    'good',
    'Good (teal)',
    'family',
    'Healthy HP, boosts, heals, held items, good outcomes, Protect and shields, towns.',
  ],
  ['bad', 'Bad (red)', 'family', 'Low HP, drops, damage, bad outcomes, Broken, danger buttons, bosses, Crests.'],
  ['caution', 'Caution (amber)', 'family', 'Mid HP, Damaged, costs, field hazards (stones, Sandstorm).'],
  ['value', 'Value (gold)', 'family', 'The main action, Moneys, shops and stalls, rewards.'],
  ['special', 'Special (violet)', 'family', 'Perks, events and “?”, rumours, timed event effects, friends’ ghosts.'],
  ['growth', 'Growth (sky)', 'family', 'XP, candy, evolution, level-ups, Research, the Lab.'],
  ['machine', 'Machine (gunmetal)', 'family', 'Scrap, Augments, bot parts and limbs, scrapyards, the Workshop.'],
  ['bio', 'Bio (magenta)', 'family', 'DNA, Genes, splices, Unstable, quirks, the Gene Bank.'],
  ['brn', 'Burned (ember)', 'status', 'The BRN tag.'],
  ['par', 'Paralyzed (lemon)', 'status', 'The PAR tag.'],
  ['slp', 'Asleep (dusk)', 'status', 'The SLP tag.'],
  ['common', 'Common', 'rarity', 'Frame, pill and name of a common pick.'],
  ['uncommon', 'Uncommon', 'rarity', ''],
  ['rare', 'Rare', 'rarity', ''],
  ['mythical', 'Mythical', 'rarity', 'Orange, clear of the Perks’ violet.'],
]);
export const UI_SIGNAL_IDS = UI_SIGNALS.map(s => s[0]);
/** the colours that sit together on one screen, whose fills must stay apart; `types` adds types.json's nine. Rarity is
 * its own set: common sits close to Machine's gunmetal on purpose (on an Augment both are quiet, the pill names the
 * tier) */
export const UI_SIGNAL_SETS = /** @type {Record<string, {name: string, ids: string[], types?: boolean}>} */ ({
  battle: {
    name: 'Battle',
    ids: ['good', 'bad', 'caution', 'special', 'growth', 'brn', 'par', 'slp'],
    types: true,
  },
  pickups: {
    name: 'Pickups',
    ids: ['good', 'bad', 'caution', 'value', 'special', 'growth', 'machine', 'bio'],
    types: true,
  },
  map: { name: 'Map', ids: ['good', 'bad', 'caution', 'value', 'special', 'growth', 'machine', 'bio'] },
  rarity: { name: 'Rarity', ids: ['common', 'uncommon', 'rare', 'mythical'] },
});
/** the checks' minimums: OKLab distance (x100) within a set; a text shade on its side's surface and ground; dark text
 * (the dark side's ground) on a fill */
export const UI_SIGNAL_MIN = { distance: 5, surface: 4.5, ground: 3, ink: 4.5 };
/** good -> --sig-good, and its text shade --sig-good-text */
export const sigVar = (/** @type {string} */ id, text = false) => `--sig-${id}${text ? '-text' : ''}`;

/** @param {string} hex @returns {[number, number, number]} linear sRGB, 0..1 */
export function linearRgb(hex) {
  const h = String(hex).replace('#', ''),
    n = parseInt(h.slice(0, 6), 16) || 0;
  return /** @type {[number, number, number]} */ (
    [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    })
  );
}
/** linear sRGB back to #rrggbb @param {number[]} c */
export function linearHex(c) {
  return (
    '#' +
    c
      .map(v => {
        v = Math.max(0, Math.min(1, v));
        const s = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
        return Math.round(s * 255)
          .toString(16)
          .padStart(2, '0');
      })
      .join('')
  );
}
/** OKLab (Björn Ottosson 2020), times 100 @param {string} hex @returns {[number, number, number]} */
export function oklab(hex) {
  const [r, g, b] = linearRgb(hex);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b),
    m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b),
    s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    100 * (0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s),
    100 * (1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s),
    100 * (0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s),
  ];
}
/** how far apart two colours look (OKLab, x100: about 2 is a just-seen difference) @param {string} a @param {string} b */
export function oklabDistance(a, b) {
  const p = oklab(a),
    q = oklab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
/** Machado 2009's matrices at full strength, on linear sRGB */
export const UI_CVD = /** @type {Record<string, {name: string, m: number[][]}>} */ ({
  protan: {
    name: 'Protan (no red cones)',
    m: [
      [0.152286, 1.052583, -0.204868],
      [0.114503, 0.786281, 0.099216],
      [-0.003882, -0.048116, 1.051998],
    ],
  },
  deutan: {
    name: 'Deutan (no green cones)',
    m: [
      [0.367322, 0.860646, -0.227968],
      [0.280085, 0.672501, 0.047413],
      [-0.01182, 0.04294, 0.968881],
    ],
  },
  tritan: {
    name: 'Tritan (no blue cones)',
    m: [
      [1.255528, -0.076749, -0.178779],
      [-0.078411, 0.930809, 0.147602],
      [0.004733, 0.691367, 0.3039],
    ],
  },
});
/** a colour as someone with this colour blindness sees it ('' or an unknown kind: as it is)
 * @param {string} hex @param {string} kind */
export function cvdHex(hex, kind) {
  const M = UI_CVD[kind];
  if (!M) return String(hex).slice(0, 7).toLowerCase();
  const c = linearRgb(hex);
  return linearHex(M.m.map(row => row[0] * c[0] + row[1] * c[1] + row[2] * c[2]));
}
/** a set's colours: [label, fill], the types (types.json) after the ids
 * @param {any} signals @param {string} set @param {any[]} [types] @returns {[string, string][]} */
export function signalSetColours(signals, set, types = []) {
  const S = UI_SIGNAL_SETS[set],
    fill = (signals && signals.fill) || {};
  if (!S) return [];
  const out = /** @type {[string, string][]} */ (S.ids.filter(id => fill[id]).map(id => [id, fill[id]]));
  if (S.types) for (const t of types || []) if (t && t.id && t.color) out.push([`type ${t.id}`, t.color]);
  return out;
}
/** the two colours of a list that look closest (under a colour blindness when kind is given)
 * @param {[string, string][]} list @param {string} [kind] @returns {{a: string, b: string, d: number} | null} */
export function nearestPair(list, kind = '') {
  /** @type {{a: string, b: string, d: number} | null} */
  let best = null;
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const d = oklabDistance(cvdHex(list[i][1], kind), cvdHex(list[j][1], kind));
      if (!best || d < best.d) best = { a: list[i][0], b: list[j][0], d };
    }
  return best;
}
/** the sheet's lines: the fills (both sides) and each side's text shades @param {any} signals */
export function signalVars(signals) {
  const s = signals || {},
    fill = s.fill || {},
    side = (/** @type {'light' | 'dark'} */ k) =>
      UI_SIGNAL_IDS.filter(id => (s[k] || {})[id]).map(id => `${sigVar(id, true)}: ${String(s[k][id]).toLowerCase()};`);
  return {
    shared: UI_SIGNAL_IDS.filter(id => fill[id]).map(id => `${sigVar(id)}: ${String(fill[id]).toLowerCase()};`),
    light: side('light'),
    dark: side('dark'),
  };
}
