// @ts-check
'use strict';
/* ================= AUGMENTS (splicing track SP-5) =================
   A bot part on a Billie. Billy.aug is { slot: a robots.json part instance { uid, id, up } }: genes.json augment.slots
   says which robot part a slot takes (front: an arm, on one side only; back: legs). From the part:
     Stability  genes.json stability.augment each (logic/genes.js graftStability adds it to a graft's)
     weight     the part's own `wt` in kg takes the place of the slot's share (an arm: its side's share) of the Billie's
                weight (logic/parts.js takes the ratio; the +/- cap still holds for the stats)
     type       its type joins the dominant-type pick as a Gene's would (the heaviest slot's, never a third type)
     stats      augment.statShare of its robots.json stats, upgrades included (rules.robots.upgradeStat), on the
                Billie's base stats
     move       its move beside the learned ones while it is fitted (augment.move 'extra'), lost while it is broken
     field      augment.field: the field move it counts for (the Hydrant Arm for Surf, the Auger Arm for Rock Smash)
   An Augment has no trait and is the only part that breaks (its limb's HP, as a robot's: rules.js partMaxHp).
   Every function takes the data as D = rules.js geneData() (its robots: robots.json, robotRules: rules.json robots).
   Logic only: no DOM, no Math.random (tools/test/augments.test.mjs). */
/** @import { PartInstance } from '../../types/save-data' */
/** @typedef {import('./genes.js').GeneData} GeneData */
/** @typedef {Partial<Record<'front' | 'back', PartInstance>>} Aug */
/** @typedef {{ slot: string, id: string, donor: string, sp: string, line: string, part: string, kind: string, kit: string,
 *   trait: string | null, type: string | null, move: string | null, field: string | null, aug: true, up: number,
 *   uid: string, wt: number, name: string }} AugGene */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { graftKind, graftRecipe } from './graft-art.js';
/* eslint-disable no-func-assign */
expose({
  AUG_SLOTS: [() => AUG_SLOTS],
  // @ts-expect-error -- replaced on purpose
  augBase: [() => augBase, v => (augBase = v)],
  // @ts-expect-error -- replaced on purpose
  augChoices: [() => augChoices, v => (augChoices = v)],
  // @ts-expect-error -- replaced on purpose
  augFit: [() => augFit, v => (augFit = v)],
  // @ts-expect-error -- replaced on purpose
  augFits: [() => augFits, v => (augFits = v)],
  // @ts-expect-error -- replaced on purpose
  augGenes: [() => augGenes, v => (augGenes = v)],
  // @ts-expect-error -- replaced on purpose
  augLimb: [() => augLimb, v => (augLimb = v)],
  // @ts-expect-error -- replaced on purpose
  augMoves: [() => augMoves, v => (augMoves = v)],
  // @ts-expect-error -- replaced on purpose
  augRel: [() => augRel, v => (augRel = v)],
  // @ts-expect-error -- replaced on purpose
  augWords: [() => augWords, v => (augWords = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the slots an Augment can take, in slot order */
export const AUG_SLOTS = /** @type {('front' | 'back')[]} */ (['front', 'back']);
/** the robot limb an Augment on a slot is in battle (rules.js partMaxHp, battle-engine.js hitPart): an arm on its
 * side, legs @param {GeneData} D @param {string} slot @returns {'armL' | 'armR' | 'legs' | null} */
export function augLimb(D, slot) {
  const R = D.genes.augment.slots[/** @type {'front' | 'back'} */ (slot)];
  if (!R) return null;
  return R.part === 'legs' ? 'legs' : R.side === 'L' ? 'armL' : 'armR';
}
/** can this robot part go on this slot of this species? (a robots.json part of the slot's kind; a species with a kit
 * rig whose slot has a bone) @param {GeneData} D @param {string} sp @param {string} slot @param {string} id */
export function augFits(D, sp, slot, id) {
  const R = D.genes.augment.slots[/** @type {'front' | 'back'} */ (slot)],
    P = D.robots && D.robots.parts[id];
  if (!R || !P || P.slot !== R.part) return false;
  const form = graftRecipe(D.kitBuilds, sp);
  return !!form && !!graftKind(D.partKits, form, slot);
}
/** an Augment set with only the slots that still fit the species, a part instance each; null when none is left
 * @param {GeneData} D @param {string} sp @param {unknown} a @returns {Aug | null} */
export function augFit(D, sp, a) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return null;
  /** @type {Aug} */
  const out = {};
  for (const slot of AUG_SLOTS) {
    const p = /** @type {any} */ (a)[slot];
    if (p && typeof p === 'object' && typeof p.uid === 'string' && augFits(D, sp, slot, p.id)) out[slot] = p;
  }
  return Object.keys(out).length ? out : null;
}
/** the Augments as Genes (for Stability, weight, the dominant type and field moves), in slot order. An arm's weight
 * stands for its side's share of the slot: `wt` is the part's kg @param {GeneData} D @param {string} sp
 * @param {Aug | null | undefined} a @returns {AugGene[]} */
export function augGenes(D, sp, a) {
  const fit = augFit(D, sp, a);
  if (!fit || !D.robots) return [];
  const A = D.genes.augment;
  return AUG_SLOTS.filter(s => fit[s]).map(slot => {
    const p = /** @type {PartInstance} */ (fit[slot]),
      P = /** @type {any} */ (D.robots).parts[p.id];
    return {
      slot,
      id: 'aug:' + p.id,
      donor: '',
      sp: '',
      line: '',
      part: p.id,
      kind: P.slot,
      kit: 'robot',
      trait: null,
      type: P.type || null,
      move: A.move === 'extra' ? P.move || null : null,
      field: A.field[p.id] || null,
      aug: true,
      up: Math.max(0, p.up || 0),
      uid: p.uid,
      wt: P.wt ?? 0,
      name: P.short || P.name,
    };
  });
}
/** per Augment slot, its weight over the Billie's own part's: the slot's own kg (share x the species' wt) with the
 * side's share of it swapped for the part's kg @param {GeneData} D @param {string} sp @param {Aug | null | undefined} a
 * @returns {Record<string, number> | null} */
export function augRel(D, sp, a) {
  const genes = augGenes(D, sp, a),
    own = D.species[sp];
  if (!genes.length || !own || !(own.wt > 0)) return null;
  /** @type {Record<string, number>} */
  const out = {};
  for (const g of genes) {
    const R = /** @type {{ share: number }} */ (D.genes.augment.slots[/** @type {'front' | 'back'} */ (g.slot)]),
      slotKg = ((D.parts && D.parts.share[g.slot]) ?? 0.15) * own.wt;
    out[g.slot] = slotKg > 0 ? 1 - R.share + g.wt / slotKg : 1;
  }
  return out;
}
/** what the Augments add to the base stats: genes.json augment.statShare of each part's robots.json stats, its
 * upgrades included (rules.json robots.upgradeStat a level) @param {GeneData} D @param {string} sp
 * @param {Aug | null | undefined} a @returns {Record<string, number>} */
export function augBase(D, sp, a) {
  /** @type {Record<string, number>} */
  const out = {};
  const up = (D.robotRules && D.robotRules.upgradeStat) || 0,
    share = D.genes.augment.statShare;
  for (const g of augGenes(D, sp, a)) {
    const S = /** @type {Record<string, number>} */ (/** @type {any} */ (D.robots).parts[g.part].stats || {}),
      f = share * (1 + up * g.up);
    for (const k of Object.keys(S)) out[k] = (out[k] || 0) + (S[k] || 0) * f;
  }
  return out;
}
/** the moves the Augments bring (augment.move 'extra'), in slot order, no repeats @param {GeneData} D
 * @param {string} sp @param {Aug | null | undefined} a @returns {string[]} */
export function augMoves(D, sp, a) {
  return [
    ...new Set(
      augGenes(D, sp, a)
        .map(g => g.move)
        .filter(m => m != null)
    ),
  ];
}
/** an Augment in words, for the battle's lines and the sheets: "a Hydrant Arm" @param {GeneData} D @param {string} id
 * a robots.json part id */
export function augWords(D, id) {
  const P = D.robots && D.robots.parts[id];
  if (!P) return '';
  return `${/^[AEIOU]/.test(P.name) ? 'an' : 'a'} ${P.name}`;
}
/** the robot parts an Escaped specimen of this species could wear (a slot that fits, a part of its kind), as
 * [slot, part id] pairs in slot and robots.json order @param {GeneData} D @param {string} sp
 * @returns {[string, string][]} */
export function augChoices(D, sp) {
  /** @type {[string, string][]} */
  const out = [];
  for (const slot of AUG_SLOTS)
    for (const id of Object.keys((D.robots && D.robots.parts) || {}))
      if (augFits(D, sp, slot, id)) out.push([slot, id]);
  return out;
}
