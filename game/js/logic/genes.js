// @ts-check
'use strict';
/* ================= GENES (splicing track SP-2) =================
   The rules of a spliced Billie. A graft is { slot: Gene id } (graft-art.js), a Gene id "part@donor": a kit part
   (partKits.json) and the donor rig it came from (kitBuilds.json: its species, weight, colour), with what genes.json
   says about the part's kind (its trait) and the part itself (its dominant type, its move). From those:
     Stability  a foreign part costs genes.json stability.line (the Billie's own line), .kit (the same kit as the part
                it replaces), or .other; past the limit the splice is Unstable, past limit + refuse it is refused
     weight     a foreign part weighs what it did on its donor: the slot's weight times the donor's `wt` over the
                Billie's own (logic/parts.js takes the ratios; the +/- cap still holds)
     type       the heaviest grafted slot's dominant type becomes the second type (never a third)
     traits     one per kind, in slot order, at most genes.json maxTraits; their effect rows join the Billie's own
                (logic/effects.js fxOfBillie)
     Unstable   one stat times unstable.up, another times unstable.down, rolled once when the splice goes past the
                limit and kept on the Billie until it is stable again (rules.js unstableTidy), and the drawback's rows
   Every function takes the data as D = { kitBuilds, partKits, genes, species, parts } (species: SPECIES; parts:
   rules.json parts). Logic only: no DOM, no Math.random (tools/test/genes.test.mjs). */
/** @import { Genes, PartKits, PartRules } from '../../types/game-data' */
/** @import { Build } from '../../types/save-data' */
/** @typedef {import('./kit-assemble.js').KitForm} KitForm */
/** @typedef {import('./graft-art.js').Graft} Graft */
/** @typedef {{ kitBuilds: { forms: KitForm[] }, partKits: PartKits, genes: Genes,
 *   species: Record<string, { wt: number, types: string[], line: string, name: string }>, parts?: PartRules }} GeneData */
/** @typedef {{ slot: string, id: string, donor: string, sp: string, line: string, part: string, kind: string, kit: string,
 *   trait: string | null, type: string | null, move: string | null }} Gene */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { GRAFT_SLOTS, geneSplit, graftForm, graftKind, graftRecipe } from './graft-art.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  geneCost: [() => geneCost, v => (geneCost = v)],
  // @ts-expect-error -- replaced on purpose
  geneOf: [() => geneOf, v => (geneOf = v)],
  // @ts-expect-error -- replaced on purpose
  graftFit: [() => graftFit, v => (graftFit = v)],
  // @ts-expect-error -- replaced on purpose
  graftGenes: [() => graftGenes, v => (graftGenes = v)],
  // @ts-expect-error -- replaced on purpose
  graftHeaviest: [() => graftHeaviest, v => (graftHeaviest = v)],
  // @ts-expect-error -- replaced on purpose
  graftRel: [() => graftRel, v => (graftRel = v)],
  // @ts-expect-error -- replaced on purpose
  graftStability: [() => graftStability, v => (graftStability = v)],
  // @ts-expect-error -- replaced on purpose
  graftTraits: [() => graftTraits, v => (graftTraits = v)],
  // @ts-expect-error -- replaced on purpose
  graftTypes: [() => graftTypes, v => (graftTypes = v)],
  // @ts-expect-error -- replaced on purpose
  graftUnstable: [() => graftUnstable, v => (graftUnstable = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** a slot's Gene from its id ("part@donor"): the part, its kind and kit, the donor's species and line, the trait,
 * dominant type and move genes.json gives the part; null for an id with no such part or donor (graftFit says
 * whether it fits a species) @param {GeneData} D @param {string} slot @param {string} id @returns {Gene | null} */
export function geneOf(D, slot, id) {
  const gene = geneSplit(id),
    form = gene && graftRecipe(D.kitBuilds, gene.donor),
    P = gene && D.partKits.parts[gene.part];
  if (!gene || !form || !P) return null;
  const G = D.genes,
    own = G.parts[gene.part] || {};
  return {
    slot,
    id: /** @type {string} */ (id),
    donor: gene.donor,
    sp: form.line + form.stage,
    line: form.line,
    part: gene.part,
    kind: P.kind,
    kit: P.kit,
    trait: (G.kinds[P.kind] && G.kinds[P.kind].trait) || null,
    type: own.type || null,
    move: own.move || null,
  };
}

/** a graft with only the slots that can be spliced and fit the species (a slot of GRAFT_SLOTS, a donor whose part is
 * of the slot's bone), or null when none is left @param {GeneData} D @param {string} sp @param {Graft | null | undefined} g
 * @returns {Graft | null} */
export function graftFit(D, sp, g) {
  if (!g || typeof g !== 'object') return null;
  /** @type {Graft} */
  const out = {};
  for (const slot of GRAFT_SLOTS)
    if (typeof g[slot] === 'string' && graftForm(D.kitBuilds, D.partKits, sp, { [slot]: g[slot] })) out[slot] = g[slot];
  return Object.keys(out).length ? out : null;
}

/** the Genes of a species' graft, in slot order (the slots that fit) @param {GeneData} D @param {string} sp
 * @param {Graft | null | undefined} g @returns {Gene[]} */
export function graftGenes(D, sp, g) {
  const fit = graftFit(D, sp, g);
  return fit ? GRAFT_SLOTS.filter(s => fit[s]).map(s => /** @type {Gene} */ (geneOf(D, s, fit[s]))) : [];
}

/** what a Gene costs a species: its own line, the same kit as the part it replaces, another kit
 * @param {GeneData} D @param {string} sp @param {Gene} gene */
export function geneCost(D, sp, gene) {
  const S = D.genes.stability,
    form = graftRecipe(D.kitBuilds, sp),
    bone = form && graftKind(D.partKits, form, gene.slot),
    mine = bone && D.partKits.parts[form.parts[bone][0]];
  if (form && form.line === gene.line) return S.line;
  return mine && mine.kit === gene.kit ? S.kit : S.other;
}

/** a graft's Stability: its cost, the limit (genes.json stability.limit unless given: the Gene Bank raises it), and
 * whether it is Unstable (past the limit) or refused (past limit + refuse) @param {GeneData} D @param {string} sp
 * @param {Graft | null | undefined} g @param {number} [limit] */
export function graftStability(D, sp, g, limit) {
  const S = D.genes.stability,
    lim = limit ?? S.limit,
    cost = graftGenes(D, sp, g).reduce((n, gene) => n + geneCost(D, sp, gene), 0);
  return { cost, limit: lim, unstable: cost > lim, refused: cost > lim + S.refuse };
}

/** per grafted slot, its part's weight over the species' own part's: the donor's `wt` over the species' (parts.js
 * partsWeightRatio takes it); null with no graft @param {GeneData} D @param {string} sp
 * @param {Graft | null | undefined} g @returns {Record<string, number> | null} */
export function graftRel(D, sp, g) {
  const genes = graftGenes(D, sp, g),
    own = D.species[sp];
  if (!genes.length || !own || !(own.wt > 0)) return null;
  /** @type {Record<string, number>} */
  const out = {};
  for (const gene of genes) {
    const d = D.species[gene.sp];
    out[gene.slot] = d && d.wt > 0 ? d.wt / own.wt : 1;
  }
  return out;
}

/** the grafted slots, heaviest first (the slot's share x its size's weight x its relative weight; ties in slot order)
 * @param {GeneData} D @param {string} sp @param {Graft | null | undefined} g @param {Build | undefined} build
 * @returns {Gene[]} */
export function graftHeaviest(D, sp, g, build) {
  const P = D.parts,
    rel = graftRel(D, sp, g) || {},
    w = (/** @type {Gene} */ gene) =>
      P
        ? (P.share[gene.slot] ?? 0) * (P.sizes[(build && build[gene.slot]) || 'M'] || P.sizes.M).weight * rel[gene.slot]
        : rel[gene.slot];
  return graftGenes(D, sp, g)
    .map((gene, i) => ({ gene, i, w: w(gene) }))
    .sort((a, b) => b.w - a.w || a.i - b.i)
    .map(x => x.gene);
}

/** a spliced species' types: the heaviest grafted slot with a dominant type gives the second type (the first stays;
 * a dominant type the Billie already has first changes nothing) @param {GeneData} D @param {string} sp
 * @param {Graft | null | undefined} g @param {Build | undefined} build @returns {string[]} */
export function graftTypes(D, sp, g, build) {
  const own = (D.species[sp] && D.species[sp].types) || [],
    dom = graftHeaviest(D, sp, g, build).find(gene => gene.type);
  if (!dom || !own.length || own[0] === dom.type) return own;
  return [own[0], /** @type {string} */ (dom.type)];
}

/** a graft's traits (trait ids), one per kind of trait, in slot order, at most genes.json maxTraits
 * @param {GeneData} D @param {string} sp @param {Graft | null | undefined} g @returns {string[]} */
export function graftTraits(D, sp, g) {
  /** @type {string[]} */
  const out = [];
  for (const gene of graftGenes(D, sp, g))
    if (gene.trait && D.genes.traits[gene.trait] && !out.includes(gene.trait)) out.push(gene.trait);
  return out.slice(0, D.genes.maxTraits);
}

/** an Unstable splice's roll: a stat to raise, another to lower, and the donor its name merges with (its heaviest
 * foreign part's); rolled once when a splice goes past the limit and kept on the Billie (rules.js unstableTidy)
 * @param {GeneData} D @param {{ sp: string, graft?: Graft, build?: Build }} m @param {string[]} stats
 * @param {() => number} rnd a number in [0, 1) @returns {{ up: string, down: string, donor: string }} */
export function graftUnstable(D, m, stats, rnd) {
  const ids = stats.slice(),
    up = ids.splice(Math.floor(rnd() * ids.length), 1)[0],
    down = ids[Math.floor(rnd() * ids.length)],
    heavy = graftHeaviest(D, m.sp, m.graft, m.build)[0];
  return { up, down, donor: heavy ? heavy.sp : m.sp };
}
