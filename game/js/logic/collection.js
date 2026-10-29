// @ts-check
'use strict';
/* ================= THE PERKS COLLECTION (perks track PK-12) =================
   What the Field Guide's Perks tab shows: every Perk, Perk set, held item and boon or curse, each seen or taken, the
   way the Field Guide records species (saveData.seen and caught). The save keeps one record, `collection`, of
   '<kind>:<id>' -> 1 in `seen` and in `taken` (kinds: perk, set, item, boon); it lasts between runs.
   collectionNote reads what the save shows now and marks it (game-state.js save() calls it, so whatever was saved was
   noted):
   - a Perk is seen when it is offered (a pick's offer, a run shop's shelf, a reward pick's Perk card) and taken once
     the run holds it;
   - a set is seen once one of its Perks is seen, taken once its bonus has been on (perkGroups);
   - a held item is seen when a reward pick offers it and taken once the bag or a Billie holds it;
   - a boon or curse is seen and taken once it is on the run (run.enc.boons).
   Logic only: no DOM (tools/test/collection.test.mjs). */
/** @import { SaveData } from '../../types/save-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { BOONS, ITEMS, PERKS, PERK_SETS } from '../game-data.js';
import { perkGroups, perkSetOf } from './perks.js';
/* eslint-disable no-func-assign */
expose({
  COLLECTION_KINDS: [() => COLLECTION_KINDS],
  // @ts-expect-error -- replaced on purpose
  collectionFill: [() => collectionFill, v => (collectionFill = v)],
  // @ts-expect-error -- replaced on purpose
  collectionNew: [() => collectionNew, v => (collectionNew = v)],
  // @ts-expect-error -- replaced on purpose
  collectionNote: [() => collectionNote, v => (collectionNote = v)],
  // @ts-expect-error -- replaced on purpose
  collectionRows: [() => collectionRows, v => (collectionRows = v)],
  gameSets: [() => gameSets],
  idsOf: [() => idsOf],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @typedef {{ seen: Record<string, number>, taken: Record<string, number> }} Collection */
/** @typedef {{ perks: Record<string, any>, sets: Record<string, any>, items: Record<string, any>,
 * boons: Record<string, any> }} CollectionData */
/** the kinds the tab lists, in its order */
export const COLLECTION_KINDS = /** @type {const} */ (['perk', 'set', 'item', 'boon']);
/** @returns {CollectionData} the game's data */
export const gameSets = () => ({ perks: PERKS, sets: PERK_SETS, items: ITEMS, boons: BOONS });
/** the ids of one kind in the data, in the file's order @param {string} kind @param {CollectionData} D */
export const idsOf = (kind, D) => {
  if (kind === 'perk') return Object.keys(D.perks || {});
  if (kind === 'set') return Object.keys(D.sets || {});
  if (kind === 'item') return Object.keys(D.items || {}).filter(k => D.items[k] && D.items[k].hold);
  return Object.keys(D.boons || {});
};
/** @returns {Collection} */
export function collectionNew() {
  return { seen: {}, taken: {} };
}
/** a stored record made safe: plain records of known '<kind>:<id>' keys (things the data no longer has are dropped)
 * @param {any} c @param {CollectionData} [D] @returns {Collection} */
export function collectionFill(c, D = gameSets()) {
  const out = collectionNew(),
    known = new Set(COLLECTION_KINDS.flatMap(k => idsOf(k, D).map(id => `${k}:${id}`)));
  if (!c || typeof c !== 'object') return out;
  for (const part of /** @type {const} */ (['seen', 'taken'])) {
    const r = c[part];
    if (!r || typeof r !== 'object' || Array.isArray(r)) continue;
    for (const k of Object.keys(r)) if (known.has(k)) out[part][k] = 1;
  }
  /* what was taken was seen */
  for (const k of Object.keys(out.taken)) out.seen[k] = 1;
  return out;
}
/** marks what the save shows now as seen or taken; returns how many marks are new
 * @param {SaveData} s @param {CollectionData} [D] */
export function collectionNote(s, D = gameSets()) {
  if (!s) return 0;
  const C = s.collection || (s.collection = collectionNew());
  let fresh = 0;
  /** @param {string} kind @param {string | undefined | null} id @param {boolean} [took] */
  const mark = (kind, id, took) => {
    if (!id) return;
    const ok =
      kind === 'perk'
        ? D.perks[id]
        : kind === 'set'
          ? D.sets[id]
          : kind === 'item'
            ? D.items[id] && D.items[id].hold
            : D.boons[id];
    if (!ok) return;
    const k = `${kind}:${id}`;
    if (!C.seen[k]) ((C.seen[k] = 1), fresh++);
    if (took && !C.taken[k]) ((C.taken[k] = 1), fresh++);
  };
  const run = s.run;
  if (run) {
    for (const id of run.perks || []) mark('perk', id, true);
    for (const id of run.offer || []) mark('perk', id);
    for (const id of Object.values(run.shelf || {})) mark('perk', id);
    const cards = (run.enc && run.enc.reward && run.enc.reward.cards) || [];
    for (const c of cards) {
      if (c.kind === 'perk') mark('perk', c.perk);
      else mark('item', c.item || c.id);
    }
    for (const b of (run.enc && run.enc.boons) || []) mark('boon', b.id, true);
    if (Array.isArray(run.perks)) for (const g of perkGroups(run, D.perks, D.sets)) if (g.on) mark('set', g.set, true);
  }
  for (const [id, n] of Object.entries(s.items || {})) if (n > 0) mark('item', id, true);
  for (const m of [...(s.team || []), ...(s.box || [])]) if (m && m.held) mark('item', m.held, true);
  /* a set is seen once one of its Perks is */
  for (const id of idsOf('perk', D)) if (C.seen[`perk:${id}`]) mark('set', perkSetOf(id, D.perks, D.sets));
  return fresh;
}
/** the tab's rows of one kind, in the data's order: id, the data entry and 'taken', 'seen' or 'none'
 * @param {any} s the save @param {string} kind @param {CollectionData} [D]
 * @returns {{ id: string, def: any, st: 'taken' | 'seen' | 'none' }[]} */
export function collectionRows(s, kind, D = gameSets()) {
  const C = (s && s.collection) || collectionNew(),
    all = kind === 'perk' ? D.perks : kind === 'set' ? D.sets : kind === 'item' ? D.items : D.boons;
  return idsOf(kind, D).map(id => {
    const k = `${kind}:${id}`;
    return { id, def: all[id], st: C.taken[k] ? 'taken' : C.seen[k] ? 'seen' : 'none' };
  });
}
