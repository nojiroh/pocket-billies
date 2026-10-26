// @ts-check
'use strict';
/* ================= GRAFT ART (splicing track SP-1) =================
   A grafted Billie's recipe: its species' kit recipe (game/data/kitBuilds.json) with one or more slots' parts taken
   from another species' recipe, ready for kitBakeWhole (logic/kit-assemble.js) to bake at runtime. A graft is
   { slot: Gene id }, a Gene id "part@donor": a kit part and the donor rig whose colour and size it keeps (SP-2). The donor's part
   keeps its colour and its size on the donor (the fit scales the whole Billie down if it no longer fits the stage
   box). A slot is swapped only bone kind for bone kind (an arm for an arm or a wing, a leg for a leg or a foot, a tail
   for a tail): the baker places each kind its own way, so a tail can't stand in for legs. Extras and the head are
   not grafted yet. SP-2: the splice is saved on the Billie (graftOf, graftSet); its rules are logic/genes.js. Logic only: no DOM (tools/test/graft-art.test.mjs). */
/** @import { PartKits } from '../../types/game-data' */
/** @typedef {import('./kit-assemble.js').KitForm} KitForm */
/** @typedef {Record<string, string>} Graft slot (rules.json parts.slots) -> Gene id, "part@donor" (SP-2) */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  BONE_OF_SLOT: [() => BONE_OF_SLOT],
  GRAFT_SLOTS: [() => GRAFT_SLOTS],
  // @ts-expect-error -- replaced on purpose
  geneSplit: [() => geneSplit, v => (geneSplit = v)],
  // @ts-expect-error -- replaced on purpose
  graftDonors: [() => graftDonors, v => (graftDonors = v)],
  // @ts-expect-error -- replaced on purpose
  graftForm: [() => graftForm, v => (graftForm = v)],
  graftKey: [() => graftKey],
  // @ts-expect-error -- replaced on purpose
  graftKind: [() => graftKind, v => (graftKind = v)],
  // @ts-expect-error -- replaced on purpose
  graftLook: [() => graftLook, v => (graftLook = v)],
  // @ts-expect-error -- replaced on purpose
  graftLookSplit: [() => graftLookSplit, v => (graftLookSplit = v)],
  graftOf: [() => graftOf],
  // @ts-expect-error -- replaced on purpose
  graftParse: [() => graftParse, v => (graftParse = v)],
  graftRecipe: [() => graftRecipe],
  // @ts-expect-error -- replaced on purpose
  graftSet: [() => graftSet, v => (graftSet = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the slots SP-1 grafts */
export const GRAFT_SLOTS = ['front', 'back', 'sig'];

/** a species' own recipe (its form's rig is the species id; a regional form has its own) @param {{ forms: KitForm[] }} B
 * @param {string} sp @returns {KitForm | null} */
export const graftRecipe = (B, sp) => B.forms.find(f => f.rig === sp) || null;

/** the bone kind of a recipe that fills a slot (the form's "slots" first, then partKits.json "slots"), or null
 * @param {PartKits} K @param {KitForm} form @param {string} slot */
export function graftKind(K, form, slot) {
  for (const kind of Object.keys(form.parts)) if ((form.slots?.[kind] ?? K.slots?.[kind]) === slot) return kind;
  return null;
}

/** a graft as a short, stable code for caches ("front=swift1,sig=zuck2"); '' for none @param {Graft | null | undefined} g */
export const graftKey = g =>
  g
    ? Object.keys(g)
        .sort()
        .map(s => `${s}=${g[s]}`)
        .join(',')
    : '';

/** a graft code (graftKey) back as a graft; null for '' or a code with no slot=donor pair @param {string | null | undefined} key
 * @returns {Graft | null} */
export function graftParse(key) {
  if (!key) return null;
  /** @type {Graft} */
  const g = {};
  for (const pair of key.split(',')) {
    const [slot, sp] = pair.split('=');
    if (slot && sp) g[slot] = sp;
  }
  return Object.keys(g).length ? g : null;
}

/* SP-2: a Billie's (or wild encounter's) splice is its `graft` field (Billy.graft, kept by the save's validators) */
/** a Billie's graft code, '' for none @param {{ graft?: Graft } | null | undefined} m */
export const graftOf = m => (m && typeof m === 'object' ? graftKey(m.graft) : '');
/** SP-5: how a Billie (or an encounter, a snapshot) looks: its graft code and, after it, each Augment as "+slot=part"
 * ("sig=shark_tailfin@zuck2,+front=hydrant"); its graft code alone when it has none, so nothing else changes. Only the
 * drawing reads it (skeleton-rig.js rigParts); the splice's own code stays graftOf @param {any} m */
export function graftLook(m) {
  const g = graftOf(m),
    a = m && typeof m === 'object' && m.aug && typeof m.aug === 'object' ? m.aug : null,
    more = a
      ? Object.keys(a)
          .sort()
          .filter(s => a[s] && typeof a[s].id === 'string')
          .map(s => `+${s}=${a[s].id}`)
      : [];
  return more.length ? [g, ...more].filter(Boolean).join(',') : g;
}
/** a look code (graftLook) as its graft code and its Augments ({ slot: robots.json part id }, null for none)
 * @param {string | null | undefined} code @returns {{ graft: string, aug: Record<string, string> | null }} */
export function graftLookSplit(code) {
  if (!code || !code.includes('+')) return { graft: code || '', aug: null };
  /** @type {Record<string, string>} */
  const aug = {};
  const own = [];
  for (const pair of code.split(',')) {
    if (pair[0] !== '+') own.push(pair);
    else {
      const [slot, id] = pair.slice(1).split('=');
      if (slot && id) aug[slot] = id;
    }
  }
  return { graft: own.join(','), aug: Object.keys(aug).length ? aug : null };
}
/** give a Billie (or an encounter) a graft code; '' takes it off @param {object} m @param {string} key */
export function graftSet(m, key) {
  const g = graftParse(key),
    o = /** @type {{ graft?: Graft }} */ (m);
  if (g) o.graft = g;
  else delete o.graft;
}

/** SP-2: a Gene id, "part@donor" (a kit part id and the donor rig it came from), as its two halves; null for
 * anything else @param {unknown} id @returns {{ part: string, donor: string } | null} */
export function geneSplit(id) {
  if (typeof id !== 'string') return null;
  const at = id.indexOf('@');
  return at > 0 && at < id.length - 1 && id.indexOf('@', at + 1) < 0
    ? { part: id.slice(0, at), donor: id.slice(at + 1) }
    : null;
}
/** the bone a part goes on, from its kind's usual slot (partKits.json slots): front an arm, back a leg, sig a tail */
export const BONE_OF_SLOT = /** @type {Record<string, string>} */ ({ front: 'arm', back: 'leg', sig: 'tail' });

/** the recipe of a species with its grafted slots' parts (a Gene's part, at its donor's colour and size), or null
 * when a Gene or a slot doesn't fit: no recipe, no such donor or part, a donor without that bone, a part that goes
 * on another bone @param {{ forms: KitForm[] }} B @param {PartKits} K @param {string} sp @param {Graft} graft
 * @returns {KitForm | null} */
export function graftForm(B, K, sp, graft) {
  const base = graftRecipe(B, sp);
  if (!base) return null;
  const out = { ...base, parts: { ...base.parts }, name: `${base.name}~${graftKey(graft)}` };
  for (const [slot, id] of Object.entries(graft)) {
    const gene = geneSplit(id),
      donor = gene && graftRecipe(B, gene.donor),
      P = gene && K.parts[gene.part],
      kind = graftKind(K, base, slot);
    if (!donor || !P || !kind || graftKind(K, donor, slot) !== kind) return null;
    if (BONE_OF_SLOT[/** @type {Record<string, string>} */ (K.slots || {})[P.kind]] !== kind) return null;
    const [, size, col] = donor.parts[kind];
    out.parts[kind] = [gene.part, Math.round(((size * donor.scale) / base.scale) * 1e4) / 1e4, col];
  }
  return out;
}

/** the Genes a species can take for a slot, one per donor ("part@donor"): another line, the same bone kind, a
 * different part @param {{ forms: KitForm[] }} B @param {PartKits} K @param {string} sp @param {string} slot
 * @returns {string[]} */
export function graftDonors(B, K, sp, slot) {
  const base = graftRecipe(B, sp),
    kind = base && graftKind(K, base, slot);
  if (!base || !kind) return [];
  return B.forms
    .filter(f => f.line !== base.line && graftKind(K, f, slot) === kind && f.parts[kind][0] !== base.parts[kind][0])
    .map(f => `${f.parts[kind][0]}@${f.rig}`);
}
