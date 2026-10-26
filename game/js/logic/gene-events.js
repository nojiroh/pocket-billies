// @ts-check
'use strict';
/* ================= SPLICE EVENTS ON A RUN (splicing track SP-6) =================
   What a run's splice events (events.json, on RL-12b's event system: logic/encounters.js) do to your Billies and the
   Gene library. The Gene Bank splices only in the hub (logic/gene-bank.js bankWhy); these are a run's own ways:
   - the back-alley splicer (`splice wild`): one Gene drawn for a Billie, its donor of a line the region's dex holds
     (any Billie's when none fits), on any slot its form has (unlicensed: the Bank's level doesn't open slots here),
     never one it wears, never a splice Stability refuses at your limit;
   - the Bureau field lab (`splice lib`): a Gene of your library on a slot the Bank's level opens, by the Bank's rules
     and DNA price (bankWhyAt: every rule but "a run is on");
   - the Gene auction (`gene`): a Gene not yet in the library, its donor of the region's lines;
   - the Gene recall (`unsplice`): a slot's Gene comes off (it stays in the library, as at the Bank).
   A Gene spliced here also goes into the library (meta.genes): a run's Billie comes home only if it is the one kept
   (run-state.js runEnd), and its Gene isn't lost with it. Unstable is settled at your limit (rules.js geneLimit), its
   roll from the run's events stream. Every chance is a draw of `rnd` (the caller's encRng(run).next), so a run made
   again plays the same. `D` is rules.js geneData(). Logic only: no DOM (tools/test/gene-events.test.mjs). */
/** @typedef {import('./gene-bank.js').BankData} BankData */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { META_GENES, billyAug, billyGraft, geneLimit, unstableTidy } from '../hooks.js';
import {
  GRAFT_SLOTS,
  geneSplit,
  graftDonors,
  graftForm,
  graftKey,
  graftKind,
  graftRecipe,
  graftSet,
} from './graft-art.js';
import { geneOf } from './genes.js';
import { bankGenes, bankLevel, bankNative, bankPrice, bankSlots, bankTry, bankWhyAt } from './gene-bank.js';
/* eslint-disable no-func-assign */
expose({
  donorLine: [() => donorLine],
  // @ts-expect-error -- replaced on purpose
  geneEventDraw: [() => geneEventDraw, v => (geneEventDraw = v)],
  // @ts-expect-error -- replaced on purpose
  geneEventLab: [() => geneEventLab, v => (geneEventLab = v)],
  // @ts-expect-error -- replaced on purpose
  geneEventLearn: [() => geneEventLearn, v => (geneEventLearn = v)],
  // @ts-expect-error -- replaced on purpose
  geneEventRecall: [() => geneEventRecall, v => (geneEventRecall = v)],
  geneEventSlots: [() => geneEventSlots],
  // @ts-expect-error -- replaced on purpose
  geneEventSplice: [() => geneEventSplice, v => (geneEventSplice = v)],
  // @ts-expect-error -- replaced on purpose
  geneEventWild: [() => geneEventWild, v => (geneEventWild = v)],
  // @ts-expect-error -- replaced on purpose
  geneEventWildList: [() => geneEventWildList, v => (geneEventWildList = v)],
  linesOf: [() => linesOf],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the slots a Billie's form can wear a Gene on (a recipe with a bone there), in GRAFT_SLOTS' order; SP-5: not one
 * an Augment holds @param {BankData} D @param {any} m */
export const geneEventSlots = (D, m) =>
  GRAFT_SLOTS.filter(slot => !!bankNative(D, m.sp, slot) && !(/** @type {any} */ (billyAug(m) || {})[slot]));

/** the lines a list of species ids holds (the region's dex) @param {BankData} D @param {string[]} pool */
export const linesOf = (D, pool) => new Set(pool.map(id => D.species[id] && D.species[id].line).filter(Boolean));
/** a Gene's donor line ('' for none) @param {BankData} D @param {string} id */
export const donorLine = (D, id) => {
  const g = geneSplit(id),
    form = g && graftRecipe(D.kitBuilds, g.donor);
  return form ? form.line : '';
};

/** the back-alley splicer's Genes for a Billie: { slot, id } it may get, the region's lines first (every donor when
 * none of theirs fits), none it wears there, none Stability refuses at the limit, none whose recipe doesn't bake
 * @param {BankData} D @param {any} m @param {string[]} pool the region's dex @param {number} limit
 * @returns {{ slot: string, id: string }[]} */
export function geneEventWildList(D, m, pool, limit) {
  const lines = linesOf(D, pool),
    worn = billyGraft(m) || {},
    /** @type {{ slot: string, id: string }[]} */
    all = [];
  for (const slot of geneEventSlots(D, m))
    for (const id of graftDonors(D.kitBuilds, D.partKits, m.sp, slot))
      if (
        worn[slot] !== id &&
        geneOf(D, slot, id) &&
        graftForm(D.kitBuilds, D.partKits, m.sp, { [slot]: id }) &&
        !bankTry(D, m, slot, id, limit).st.refused
      )
        all.push({ slot, id });
  const near = all.filter(o => lines.has(donorLine(D, o.id)));
  return near.length ? near : all;
}

/** the back-alley splicer's Gene: a slot drawn first (of those with a Gene), then a Gene for it; null for none
 * @param {BankData} D @param {any} m @param {string[]} pool @param {number} limit @param {() => number} rnd */
export function geneEventWild(D, m, pool, limit, rnd) {
  const L = geneEventWildList(D, m, pool, limit),
    slots = [...new Set(L.map(o => o.slot))];
  if (!slots.length) return null;
  const slot = slots[Math.floor(rnd() * slots.length)],
    ids = L.filter(o => o.slot === slot);
  return ids[Math.floor(rnd() * ids.length)];
}

/** the Bureau field lab's offers for a Billie: each library Gene on each slot the Bank's level opens, with its DNA
 * price and why it can't be had now ('' when it can; 'dna' still listed, the rest left out)
 * @param {BankData} D @param {any} s @param {any} m @returns {{ slot: string, id: string, price: number, why: string }[]} */
export function geneEventLab(D, s, m) {
  const out = [];
  for (const slot of bankSlots(D, bankLevel(s)))
    for (const id of bankGenes(D, s, m, slot)) {
      const why = bankWhyAt(D, s, m, slot, id);
      if (!why || why === 'dna') out.push({ slot, id, price: bankPrice(D, m.sp, slot, id), why });
    }
  return out;
}

/** splice a Gene onto a Billie during a run: `dna` paid (never below 0), the splice set, Unstable settled at your
 * limit (from rnd), the Gene added to the library (at most META_GENES); whether the library grew
 * @param {BankData} D @param {any} s @param {any} m @param {string} slot @param {string} id @param {() => number} rnd
 * @param {number} [dna] */
export function geneEventSplice(D, s, m, slot, id, rnd, dna = 0) {
  if (dna) s.meta.dna = Math.max(0, (s.meta.dna || 0) - dna);
  graftSet(m, graftKey(bankTry(D, m, slot, id, geneLimit(s)).graft));
  unstableTidy(m, rnd, geneLimit(s));
  return geneEventLearn(s, id);
}

/** a Gene into the library unless it is there or the library is full; whether it went in @param {any} s
 * @param {string} id */
export function geneEventLearn(s, id) {
  const lib = s.meta.genes || (s.meta.genes = []);
  if (lib.includes(id) || lib.length >= META_GENES) return false;
  lib.push(id);
  return true;
}

/** the auction's Gene: one not in the library, of a line the region's dex holds (any line's when none is left),
 * drawn from rnd; { slot, id }, null when the library has every Gene @param {BankData} D @param {any} s
 * @param {string[]} pool @param {() => number} rnd */
export function geneEventDraw(D, s, pool, rnd) {
  const lines = linesOf(D, pool),
    have = new Set(s.meta.genes || []),
    /** @type {{ slot: string, id: string }[]} */
    all = [];
  for (const form of D.kitBuilds.forms)
    for (const slot of GRAFT_SLOTS) {
      const kind = graftKind(D.partKits, form, slot),
        id = kind ? `${form.parts[kind][0]}@${form.rig}` : '';
      if (id && !have.has(id) && geneOf(D, slot, id) && !all.some(o => o.id === id)) all.push({ slot, id });
    }
  const near = all.filter(o => lines.has(donorLine(D, o.id))),
    L = near.length ? near : all;
  return L.length ? L[Math.floor(rnd() * L.length)] : null;
}

/** the recall: a slot's Gene comes off a Billie (it goes into the library first, as at the Bank), Unstable settled at
 * your limit; whether there was one @param {BankData} D @param {any} s @param {any} m @param {string} slot
 * @param {() => number} rnd */
export function geneEventRecall(D, s, m, slot, rnd) {
  const g = billyGraft(m);
  if (!g || !g[slot]) return false;
  geneEventLearn(s, g[slot]);
  graftSet(m, graftKey(bankTry(D, m, slot, null, geneLimit(s)).graft));
  unstableTidy(m, rnd, geneLimit(s));
  return true;
}
