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
import { META_GENES, billyAug, billyGraft, geneLimit, graftStability, maxHp, unstableTidy } from '../hooks.js';
import { random } from '../util.js';
import { graftKey, graftKind, graftRecipe, graftSet } from './graft-art.js';
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
  augKey: [() => augKey],
  // @ts-expect-error -- replaced on purpose
  augLimb: [() => augLimb, v => (augLimb = v)],
  // @ts-expect-error -- replaced on purpose
  augMoves: [() => augMoves, v => (augMoves = v)],
  augOf: [() => augOf],
  // @ts-expect-error -- replaced on purpose
  augRel: [() => augRel, v => (augRel = v)],
  // @ts-expect-error -- replaced on purpose
  augWords: [() => augWords, v => (augWords = v)],
  // @ts-expect-error -- replaced on purpose
  workFit: [() => workFit, v => (workFit = v)],
  workLevel: [() => workLevel],
  // @ts-expect-error -- replaced on purpose
  workOff: [() => workOff, v => (workOff = v)],
  // @ts-expect-error -- replaced on purpose
  workOpensAt: [() => workOpensAt, v => (workOpensAt = v)],
  workRow: [() => workRow],
  // @ts-expect-error -- replaced on purpose
  workSet: [() => workSet, v => (workSet = v)],
  workSpares: [() => workSpares],
  // @ts-expect-error -- replaced on purpose
  workTry: [() => workTry, v => (workTry = v)],
  workUpPrice: [() => workUpPrice],
  // @ts-expect-error -- replaced on purpose
  workUpWhy: [() => workUpWhy, v => (workUpWhy = v)],
  // @ts-expect-error -- replaced on purpose
  workUpgrade: [() => workUpgrade, v => (workUpgrade = v)],
  // @ts-expect-error -- replaced on purpose
  workWhy: [() => workWhy, v => (workWhy = v)],
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
      /* the word an Unstable name merges with: "Hydrant", "Crawler" */
      name: P.short || String(P.name).split(' ')[0],
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
/** an Augment in words, for the battle's lines and the sheets: "a Hydrant Arm", "Crawler Treads" (a plural name
 * takes no article) @param {GeneData} D @param {string} id a robots.json part id */
export function augWords(D, id) {
  const P = D.robots && D.robots.parts[id];
  if (!P) return '';
  if (/s$/.test(P.name)) return P.name;
  return `${/^[AEIOU]/.test(P.name) ? 'an' : 'a'} ${P.name}`;
}
/** Augments as a short, stable code for caches and the battle's snapshot ("back=treads+0,front=hydrant+1"); '' for
 * none @param {Aug | null | undefined} a */
export const augKey = a =>
  a
    ? Object.keys(a)
        .sort()
        .map(s => {
          const p = /** @type {PartInstance} */ (a[/** @type {'front' | 'back'} */ (s)]);
          return `${s}=${p.id}+${p.up || 0}`;
        })
        .join(',')
    : '';
/** a Billie's (or a snapshot's) Augments' code, '' for none @param {any} m */
export const augOf = m => (m && typeof m === 'object' && m.aug ? augKey(m.aug) : '');
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

/* ---------- the Workshop (SP-5): fitting, taking off and upgrading Augments for Scrap ----------
   A hub building (buildings.json workshop; its levels are unlocks.json rows, meta.buildings.workshop). Its levels
   (genes.json augment.levels) open the slots it fits and how far a fitted part is upgraded; the prices are Scrap
   (augment.price). A fitted part comes from your spare parts (saveData.parts: RL-14a's salvage) and goes back there
   when taken off (free) or swapped. A slot with a Gene takes an Augment only once the Gene is off: fitting takes it
   off for you and keeps it in the Gene library. Your Billies are held to your Gene Bank's Stability limit (rules.js
   geneLimit): past it Unstable, past it + refuse refused. Never during a run. */
/** @typedef {'' | 'run' | 'robot' | 'slot' | 'unknown' | 'fit' | 'same' | 'refused' | 'scrap' | 'none' | 'max'} WorkWhy */
/** the Workshop's level (1 with none bought) @param {any} s */
export const workLevel = s => Math.max(1, (s && s.meta && s.meta.buildings && s.meta.buildings.workshop) || 1);
/** a level's row of genes.json augment.levels (the last for a level past them) @param {GeneData} D @param {number} lv */
export const workRow = (D, lv) => {
  const L = D.genes.augment.levels;
  return L[Math.max(0, Math.min(lv, L.length) - 1)];
};
/** the level that first fits a slot (0 for none) @param {GeneData} D @param {string} slot */
export function workOpensAt(D, slot) {
  const i = D.genes.augment.levels.findIndex(R => R.slots.includes(/** @type {'front' | 'back'} */ (slot)));
  return i + 1;
}
/** your spare parts that fit a Billie's slot, in the order you have them @param {GeneData} D @param {any} s
 * @param {any} m @param {string} slot @returns {PartInstance[]} */
export const workSpares = (D, s, m, slot) =>
  (s.parts || []).filter((/** @type {PartInstance} */ p) => augFits(D, m.sp, slot, p.id));
/** a Billie's Augments with one slot changed (a part, or null to take it off), its splice without a Gene on that slot,
 * and the Stability of the two at a limit @param {GeneData} D @param {any} m @param {string} slot
 * @param {PartInstance | null} p @param {number} limit */
export function workTry(D, m, slot, p, limit) {
  /** @type {Aug} */
  const a = { ...(billyAug(m) || {}) };
  if (p) a[/** @type {'front' | 'back'} */ (slot)] = p;
  else delete a[/** @type {'front' | 'back'} */ (slot)];
  /** @type {Record<string, string>} */
  const g = { ...(billyGraft(m) || {}) };
  if (p) delete g[slot];
  const aug = Object.keys(a).length ? a : null,
    graft = Object.keys(g).length ? g : null;
  return { aug, graft, st: graftStability(D, m.sp, graft, limit, aug) };
}
/** why a spare part can't be fitted on this slot now ('' when it can): a run is on, a robot (refitted elsewhere), the
 * slot isn't open at this level, no such spare, it doesn't fit, it is the one already there, Stability would refuse
 * it, not enough Scrap @param {GeneData} D @param {any} s @param {any} m @param {string} slot @param {string} uid
 * @returns {WorkWhy} */
export function workWhy(D, s, m, slot, uid) {
  if (s.run) return 'run';
  if (!m || m.kind === 'robot') return 'robot';
  if (!workRow(D, workLevel(s)).slots.includes(/** @type {'front' | 'back'} */ (slot))) return 'slot';
  const p = (s.parts || []).find((/** @type {PartInstance} */ q) => q.uid === uid);
  if (!p) return 'unknown';
  if (!augFits(D, m.sp, slot, p.id)) return 'fit';
  if (workTry(D, m, slot, p, geneLimit(s)).st.refused) return 'refused';
  if ((s.meta.scrap || 0) < D.genes.augment.price.fit) return 'scrap';
  return '';
}
/** fit a spare part on a Billie's slot: pays the Scrap, the part it replaces goes back to your parts, a Gene on the
 * slot comes off (kept in the library), the limb's damage goes, Unstable settles at your limit; why not, or ''
 * @param {GeneData} D @param {any} s @param {any} m @param {string} slot @param {string} uid
 * @param {() => number} [rnd] @returns {WorkWhy} */
export function workFit(D, s, m, slot, uid, rnd = random) {
  const why = workWhy(D, s, m, slot, uid);
  if (why) return why;
  s.meta.scrap -= D.genes.augment.price.fit;
  const i = s.parts.findIndex((/** @type {PartInstance} */ q) => q.uid === uid),
    p = s.parts[i],
    old = billyAug(m) && /** @type {any} */ (billyAug(m))[slot],
    gene = (billyGraft(m) || {})[slot],
    { aug, graft } = workTry(D, m, slot, p, geneLimit(s));
  s.parts.splice(i, 1, ...(old ? [old] : []));
  if (gene && Array.isArray(s.meta.genes) && !s.meta.genes.includes(gene) && s.meta.genes.length < META_GENES)
    s.meta.genes.push(gene);
  workSet(D, m, aug, graft, slot);
  unstableTidy(m, rnd, geneLimit(s));
  return '';
}
/** take a slot's Augment off (free): back to your parts, its limb's damage gone, Unstable settled; why not, or ''
 * @param {GeneData} D @param {any} s @param {any} m @param {string} slot @returns {WorkWhy} */
export function workOff(D, s, m, slot) {
  if (s.run) return 'run';
  const a = billyAug(m),
    p = a && a[/** @type {'front' | 'back'} */ (slot)];
  if (!p) return 'none';
  const { aug } = workTry(D, m, slot, null, geneLimit(s));
  s.parts.push(p);
  workSet(D, m, aug, billyGraft(m), slot);
  unstableTidy(m, random, geneLimit(s));
  return '';
}
/** what the next upgrade of a fitted part costs (Infinity past the last price) @param {GeneData} D
 * @param {PartInstance} p */
export const workUpPrice = (D, p) => D.genes.augment.price.up[p.up || 0] ?? Infinity;
/** why a slot's Augment can't be upgraded now ('' when it can): a run, none there, at the level's highest, not enough
 * Scrap @param {GeneData} D @param {any} s @param {any} m @param {string} slot @returns {WorkWhy} */
export function workUpWhy(D, s, m, slot) {
  if (s.run) return 'run';
  const a = billyAug(m),
    p = a && a[/** @type {'front' | 'back'} */ (slot)];
  if (!p) return 'none';
  const max = Math.min(workRow(D, workLevel(s)).maxUp, (D.robotRules && D.robotRules.maxUpgrade) ?? 3);
  if ((p.up || 0) >= max) return 'max';
  if ((s.meta.scrap || 0) < workUpPrice(D, p)) return 'scrap';
  return '';
}
/** upgrade a slot's Augment one level for its Scrap (its stats grow by rules.json robots.upgradeStat); why not, or ''
 * @param {GeneData} D @param {any} s @param {any} m @param {string} slot @returns {WorkWhy} */
export function workUpgrade(D, s, m, slot) {
  const why = workUpWhy(D, s, m, slot);
  if (why) return why;
  const p = /** @type {PartInstance} */ (/** @type {any} */ (billyAug(m))[slot]),
    was = m.hp > 0 ? m.hp / Math.max(1, maxHp(m)) : 0;
  s.meta.scrap -= workUpPrice(D, p);
  p.up = (p.up || 0) + 1;
  m.aug[slot] = p;
  m.hp = m.hp > 0 ? Math.max(1, Math.round(maxHp(m) * was)) : 0;
  return '';
}
/** a Billie's Augments and splice set together: HP kept as the same share of the new most, the changed slot's limb
 * whole again @param {GeneData} D @param {any} m @param {Aug | null} aug @param {Record<string, string> | null} graft
 * @param {string} slot */
export function workSet(D, m, aug, graft, slot) {
  const was = m.hp > 0 ? m.hp / Math.max(1, maxHp(m)) : 0,
    limb = augLimb(D, slot);
  if (aug) m.aug = aug;
  else delete m.aug;
  graftSet(m, graftKey(graft));
  if (limb && m.partDmg) {
    delete m.partDmg[limb];
    if (!Object.keys(m.partDmg).length) delete m.partDmg;
  }
  m.hp = m.hp > 0 ? Math.max(1, Math.round(maxHp(m) * was)) : 0;
}
