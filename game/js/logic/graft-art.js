// @ts-check
'use strict';
/* ================= GRAFT ART (splicing track SP-1) =================
   A grafted Billie's recipe: its species' kit recipe (game/data/kitBuilds.json) with one or more slots' parts taken
   from another species' recipe, ready for kitBakeWhole (logic/kit-assemble.js) to bake at runtime. A graft is
   { slot: donor species id } (SP-1's art spike; SP-2's Genes resolve to the same part and donor). The donor's part
   keeps its colour and its size on the donor (the fit scales the whole Billie down if it no longer fits the stage
   box). A slot is swapped only bone kind for bone kind (an arm for an arm or a wing, a leg for a leg or a foot, a tail
   for a tail): the baker places each kind its own way, so a tail can't stand in for legs. Extras and the head are
   not grafted yet. Logic only: no DOM (tools/test/graft-art.test.mjs). */
/** @import { PartKits } from '../../types/game-data' */
/** @typedef {import('./kit-assemble.js').KitForm} KitForm */
/** @typedef {Record<string, string>} Graft slot (rules.json parts.slots) -> donor species id */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
/* eslint-disable no-func-assign */
expose({
  GRAFTS: [() => GRAFTS],
  GRAFT_SLOTS: [() => GRAFT_SLOTS],
  // @ts-expect-error -- replaced on purpose
  graftDonors: [() => graftDonors, v => (graftDonors = v)],
  // @ts-expect-error -- replaced on purpose
  graftForm: [() => graftForm, v => ((graftForm = v), provide({ graftForm }))],
  graftKey: [() => graftKey],
  // @ts-expect-error -- replaced on purpose
  graftKind: [() => graftKind, v => (graftKind = v)],
  graftOf: [() => graftOf],
  // @ts-expect-error -- replaced on purpose
  graftParse: [() => graftParse, v => ((graftParse = v), provide({ graftParse }))],
  graftRecipe: [() => graftRecipe],
  // @ts-expect-error -- replaced on purpose
  graftSet: [() => graftSet, v => (graftSet = v)],
});
/* eslint-enable no-func-assign */
provide({ graftForm, graftParse });
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

/* SP-1: this session's grafts, by Billie object (or wild encounter), as graft codes. Never saved: saveFill keeps a
   Billie's unknown fields, so a field would land in the save; SP-2 gives Billy a validated `graft` instead. */
export const GRAFTS = new WeakMap();
/** a Billie's graft code, '' for none @param {object | null | undefined} m */
export const graftOf = m => (m && typeof m === 'object' && GRAFTS.get(m)) || '';
/** give a Billie (or an encounter) a graft code; '' takes it off @param {object} m @param {string} key */
export function graftSet(m, key) {
  if (key) GRAFTS.set(m, key);
  else GRAFTS.delete(m);
}

/** the recipe of a species with its grafted slots' parts from their donors, or null when a donor or a slot doesn't fit
 * (no recipe, no part of that kind) @param {{ forms: KitForm[] }} B @param {PartKits} K @param {string} sp
 * @param {Graft} graft @returns {KitForm | null} */
export function graftForm(B, K, sp, graft) {
  const base = graftRecipe(B, sp);
  if (!base) return null;
  const out = { ...base, parts: { ...base.parts }, name: `${base.name}~${graftKey(graft)}` };
  for (const [slot, donorSp] of Object.entries(graft)) {
    const donor = graftRecipe(B, donorSp),
      kind = graftKind(K, base, slot);
    if (!donor || !kind || graftKind(K, donor, slot) !== kind) return null;
    const [pid, size, col] = donor.parts[kind];
    out.parts[kind] = [pid, Math.round(((size * donor.scale) / base.scale) * 1e4) / 1e4, col];
  }
  return out;
}

/** the species that can give a species a part for a slot: another line, the same bone kind, a different part
 * @param {{ forms: KitForm[] }} B @param {PartKits} K @param {string} sp @param {string} slot @returns {string[]} */
export function graftDonors(B, K, sp, slot) {
  const base = graftRecipe(B, sp),
    kind = base && graftKind(K, base, slot);
  if (!base || !kind) return [];
  return B.forms
    .filter(f => f.line !== base.line && graftKind(K, f, slot) === kind && f.parts[kind][0] !== base.parts[kind][0])
    .map(f => f.rig);
}
