// @ts-check
'use strict';
/* ================= GENE BANK (splicing track SP-4) =================
   The Copperleaf building that spends DNA (buildings.json genebank; its levels are unlocks.json rows). Its library
   is meta.genes, a set of Gene ids ("part@donor"): SP-3's Gene Samples, and every part a Billie of yours is sequenced
   for (free). A Gene is never used up: taking one off is free and it stays in the library, so a splice can always be
   undone. A splice costs DNA (genes.json bank.price: base + perCost x the Gene's Stability cost), goes only on the
   slots the Bank's level opens (bank.levels: sig, then front, then back) and is held to the level's Stability limit
   (rules.js geneLimit): past it the Billie is Unstable, past it + stability.refuse the splice is refused. Splicing is
   a hub action (never during a run). `D` is rules.js geneData(). Logic only: no DOM (tools/test/gene-bank.test.mjs). */
/** @import { Genes } from '../../types/game-data' */
/** @typedef {{ kitBuilds: any, partKits: any, genes: Genes, species: any, parts: any }} BankData */
/** @typedef {'' | 'run' | 'slot' | 'unknown' | 'fit' | 'same' | 'refused' | 'dna' | 'none' | 'aug'} BankWhy */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { META_GENES, billyAug, billyGraft, geneLimit, unstableTidy } from '../hooks.js';
import { random } from '../util.js';
import { GRAFT_SLOTS, graftForm, graftKey, graftKind, graftRecipe, graftSet } from './graft-art.js';
import { geneCost, geneOf, graftStability } from './genes.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  bankGenes: [() => bankGenes, v => (bankGenes = v)],
  bankLevel: [() => bankLevel],
  // @ts-expect-error -- replaced on purpose
  bankNative: [() => bankNative, v => (bankNative = v)],
  // @ts-expect-error -- replaced on purpose
  bankOpensAt: [() => bankOpensAt, v => (bankOpensAt = v)],
  // @ts-expect-error -- replaced on purpose
  bankPrice: [() => bankPrice, v => (bankPrice = v)],
  // @ts-expect-error -- replaced on purpose
  bankReads: [() => bankReads, v => (bankReads = v)],
  // @ts-expect-error -- replaced on purpose
  bankRow: [() => bankRow, v => (bankRow = v)],
  // @ts-expect-error -- replaced on purpose
  bankSequence: [() => bankSequence, v => (bankSequence = v)],
  // @ts-expect-error -- replaced on purpose
  bankSettle: [() => bankSettle, v => (bankSettle = v)],
  bankSlots: [() => bankSlots],
  // @ts-expect-error -- replaced on purpose
  bankSplice: [() => bankSplice, v => (bankSplice = v)],
  // @ts-expect-error -- replaced on purpose
  bankTry: [() => bankTry, v => (bankTry = v)],
  // @ts-expect-error -- replaced on purpose
  bankUnsplice: [() => bankUnsplice, v => (bankUnsplice = v)],
  // @ts-expect-error -- replaced on purpose
  bankWhy: [() => bankWhy, v => (bankWhy = v)],
  // @ts-expect-error -- replaced on purpose
  bankWhyAt: [() => bankWhyAt, v => (bankWhyAt = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the Bank's level @param {any} s */
export const bankLevel = s => Math.max(1, (s && s.meta && s.meta.buildings && s.meta.buildings.genebank) || 1);
/** a level's row of genes.json bank.levels (the last one past its end) @param {BankData} D @param {number} level */
export function bankRow(D, level) {
  const L = D.genes.bank.levels;
  return L[Math.min(Math.max(1, level), L.length) - 1];
}
/** the slots a level splices, in GRAFT_SLOTS' order @param {BankData} D @param {number} level */
export const bankSlots = (D, level) =>
  GRAFT_SLOTS.filter(k => /** @type {string[]} */ (bankRow(D, level).slots).includes(k));
/** the level that first opens a slot, 0 for none @param {BankData} D @param {string} slot */
export function bankOpensAt(D, slot) {
  const i = D.genes.bank.levels.findIndex(R => /** @type {string[]} */ (R.slots).includes(slot));
  return i + 1;
}

/** a Billie's own Gene for a slot: its recipe's part there, from its own rig; null when its form has no recipe (a
 * regional form without a rig) or no bone there @param {BankData} D @param {string} sp @param {string} slot */
export function bankNative(D, sp, slot) {
  const form = graftRecipe(D.kitBuilds, sp),
    kind = form && graftKind(D.partKits, form, slot);
  return form && kind ? `${form.parts[kind][0]}@${form.rig}` : null;
}
/** every Gene a Billie can be sequenced for: its own parts on the spliceable slots and the Genes spliced on it
 * @param {BankData} D @param {any} m @returns {string[]} */
export function bankReads(D, m) {
  const out = [];
  for (const slot of GRAFT_SLOTS) {
    const own = bankNative(D, m.sp, slot);
    if (own && geneOf(D, slot, own)) out.push(own);
  }
  for (const [slot, id] of Object.entries(billyGraft(m) || {})) if (geneOf(D, slot, id)) out.push(id);
  return [...new Set(out)];
}
/** sequence a Billie (free): its Genes not yet in the library go in (meta.genes, at most META_GENES); returns the new
 * ones @param {BankData} D @param {any} s @param {any} m @returns {string[]} */
export function bankSequence(D, s, m) {
  const have = new Set(s.meta.genes),
    add = bankReads(D, m).filter(id => !have.has(id));
  const room = Math.max(0, META_GENES - s.meta.genes.length),
    got = add.slice(0, room);
  s.meta.genes.push(...got);
  return got;
}

/** the library's Genes that go on this Billie's slot (the same bone, a recipe to bake), not its own part there
 * @param {BankData} D @param {any} s @param {any} m @param {string} slot @returns {string[]} */
export function bankGenes(D, s, m, slot) {
  const own = bankNative(D, m.sp, slot);
  return s.meta.genes.filter(
    (/** @type {string} */ id) =>
      id !== own && geneOf(D, slot, id) && graftForm(D.kitBuilds, D.partKits, m.sp, { [slot]: id })
  );
}
/** what splicing a Gene costs in DNA @param {BankData} D @param {string} sp @param {string} slot @param {string} id */
export function bankPrice(D, sp, slot, id) {
  const gene = geneOf(D, slot, id),
    P = D.genes.bank.price;
  return gene ? P.base + P.perCost * geneCost(D, sp, gene) : 0;
}
/** a Billie's splice with one slot changed (a Gene id, or null to take it off), and its Stability at a limit; graft
 * null when nothing is left @param {BankData} D @param {any} m @param {string} slot @param {string | null} id
 * @param {number} limit */
export function bankTry(D, m, slot, id, limit) {
  /** @type {Record<string, string>} */
  const g = { ...(billyGraft(m) || {}) };
  if (id) g[slot] = id;
  else delete g[slot];
  const graft = Object.keys(g).length ? g : null;
  /* SP-5: the Augments count too */
  return { graft, st: graftStability(D, m.sp, graft, limit, billyAug(m)) };
}
/** why this Gene can't be spliced onto this slot now ('' when it can): a run is on, the slot isn't open at this
 * level, the Gene isn't in the library, it doesn't fit, it is the Billie's own part or already there, the splice
 * would be refused, not enough DNA @param {BankData} D @param {any} s @param {any} m @param {string} slot
 * @param {string} id @returns {BankWhy} */
export function bankWhy(D, s, m, slot, id) {
  return s.run ? 'run' : bankWhyAt(D, s, m, slot, id);
}
/** SP-6: bankWhy's rules but the first (a run's Bureau field lab splices by them during a run; logic/gene-events.js)
 * @param {BankData} D @param {any} s @param {any} m @param {string} slot @param {string} id @returns {BankWhy} */
export function bankWhyAt(D, s, m, slot, id) {
  if (!bankSlots(D, bankLevel(s)).includes(slot)) return 'slot';
  /* SP-5: a slot an Augment holds takes no Gene (the Workshop takes the Augment off) */
  if (billyAug(m) && /** @type {any} */ (billyAug(m))[slot]) return 'aug';
  if (!s.meta.genes.includes(id)) return 'unknown';
  if (!bankGenes(D, s, m, slot).includes(id)) return 'fit';
  if ((billyGraft(m) || {})[slot] === id) return 'same';
  if (bankTry(D, m, slot, id, geneLimit(s)).st.refused) return 'refused';
  if (s.meta.dna < bankPrice(D, m.sp, slot, id)) return 'dna';
  return '';
}
/** splice a Gene from the library onto a Billie's slot: pays its DNA, sets the splice and settles Unstable at the
 * Bank's limit (a Gene it replaces stays in the library); why not, or '' @param {BankData} D @param {any} s
 * @param {any} m @param {string} slot @param {string} id @param {() => number} [rnd] @returns {BankWhy} */
export function bankSplice(D, s, m, slot, id, rnd = random) {
  const why = bankWhy(D, s, m, slot, id);
  if (why) return why;
  s.meta.dna -= bankPrice(D, m.sp, slot, id);
  const { graft } = bankTry(D, m, slot, id, geneLimit(s));
  graftSet(m, graftKey(graft));
  unstableTidy(m, rnd, geneLimit(s));
  return '';
}
/** take a slot's Gene off (free, on any slot, opened or not): the Billie's own part is back there and the Gene stays
 * in the library (it is sequenced first, so a wild Graft's part is kept); why not, or ''
 * @param {BankData} D @param {any} s @param {any} m @param {string} slot @returns {BankWhy} */
export function bankUnsplice(D, s, m, slot) {
  if (s.run) return 'run';
  const g = billyGraft(m);
  if (!g || !g[slot]) return 'none';
  bankSequence(D, s, m);
  graftSet(m, graftKey(bankTry(D, m, slot, null, geneLimit(s)).graft));
  unstableTidy(m, random, geneLimit(s));
  return '';
}
/** after the Bank's level changes: every Billie of yours (team, storage, the nursery's eggs) settled at the new limit
 * @param {any} s */
export function bankSettle(s) {
  const limit = geneLimit(s);
  for (const m of [...s.team, ...s.box, ...((s.ranch && s.ranch.nursery) || []).map((/** @type {any} */ n) => n.egg)])
    if (m && (m.graft || m.aug)) unstableTidy(m, random, limit);
}
