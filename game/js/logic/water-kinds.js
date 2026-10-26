// @ts-check
'use strict';
/* ================= WATER KINDS AND THEIR PLAY (water track WA-5a) =================
   The water kinds in their fixed order and what each does to someone on foot. The order is the data contract's
   (docs/phases/water-track.md): the renderer's nine looks (walk/water-data.js WATER_KIND_LOOKS) first, the six of
   WA-5a appended, never reordered (a scene's water mesh holds the index; maps name kinds by their key). `swamp`
   stays the marsh.
   Until WA-5b draws the new kinds (kind looks in a texture), each borrows an old kind's look (WATER_KIND_BASE), for
   fishing's tables too.
   The play: `shut` is never entered (lava; rapids, neither waded nor surfed); `walkOn` is walked on top, its `d` too
   (ice: a frozen pond in snow, logic/water-weather.js); `slow` multiplies the wading speed (the marsh and the bog);
   `heal` heals the party once a run (a hot spring, logic/water-play.js); `still` freezes in snow.
   Only the walk grid reads the play (logic/wading.js, logic/surf.js): the map generator's reach check and the seam
   rules keep all water dry. Logic only: no DOM, runs in Node (tools/test/water-kinds.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
expose({
  WATER_KINDS: [() => WATER_KINDS],
  WATER_KIND_BASE: [() => WATER_KIND_BASE],
  WATER_KIND_PLAY: [() => WATER_KIND_PLAY],
  waterKindBase: [() => waterKindBase],
  waterKindHeals: [() => waterKindHeals],
  waterKindKnown: [() => waterKindKnown],
  waterKindShut: [() => waterKindShut],
  waterKindSlow: [() => waterKindSlow],
  waterKindStill: [() => waterKindStill],
  waterKindWalkOn: [() => waterKindWalkOn],
});
/* to-module: end */
/* the kinds in their fixed order (append only) */
export const WATER_KINDS = [
  'pond',
  'stream',
  'canal',
  'spring',
  'swamp',
  'lake',
  'sea',
  'lava',
  'ice',
  'rapids',
  'hotspring',
  'oasis',
  'bog',
  'reef',
  'cave',
];
/* the old look each new kind borrows until WA-5b draws it */
/** @type {Record<string, string>} */
export const WATER_KIND_BASE = {
  rapids: 'stream',
  hotspring: 'spring',
  oasis: 'pond',
  bog: 'swamp',
  reef: 'sea',
  cave: 'spring',
};
/** what each kind does to someone on foot (a kind left out does nothing special: waded in `w`, surfed in `d`)
 * @type {Record<string, { shut?: 1, walkOn?: 1, slow?: number, heal?: 1, still?: 1 }>} */
export const WATER_KIND_PLAY = {
  pond: { still: 1 },
  lake: { still: 1 },
  swamp: { still: 1, slow: 0.8 },
  bog: { still: 1, slow: 0.6 },
  oasis: { still: 1 },
  lava: { shut: 1 },
  rapids: { shut: 1 },
  ice: { walkOn: 1 },
  hotspring: { heal: 1 },
};
/** is k one of the kinds @param {string} k */
export const waterKindKnown = k => WATER_KINDS.includes(k);
/** the look a kind is drawn with until WA-5b (an old kind: itself) @param {string} k */
export const waterKindBase = k => WATER_KIND_BASE[k] || k;
/** is the kind never entered (neither waded nor surfed) @param {string} k */
export const waterKindShut = k => !!(WATER_KIND_PLAY[k] || {}).shut;
/** is the kind walked on top, shallow or deep @param {string} k */
export const waterKindWalkOn = k => !!(WATER_KIND_PLAY[k] || {}).walkOn;
/** the kind's share of the wading speed (1: none taken off) @param {string} k */
export const waterKindSlow = k => (WATER_KIND_PLAY[k] || {}).slow || 1;
/** does the kind heal the party @param {string} k */
export const waterKindHeals = k => !!(WATER_KIND_PLAY[k] || {}).heal;
/** does the kind freeze in snow @param {string} k */
export const waterKindStill = k => !!(WATER_KIND_PLAY[k] || {}).still;
