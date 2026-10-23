// @ts-check
'use strict';
/* ================= REGIONAL FORMS (roster track RO-1) =================
   A line's `forms` (lines/<id>.json): a regional look of the whole line, a coat (coats.json, one marked `form`) plus a
   type swap, and a regional word before each stage's name ("Waterfront Gildlet"). Each stage of a form is a species
   of its own, with the id <line>_<form><stage> (trump_waterfront0), so the stage number stays last as in trump0 and
   the next stage is the same form's. A form keeps its base's stats, moves, dex number and art (recoloured by its coat).
   One rule for the game (game-data.js), check-data and the Studio's Check.
   Logic only: no DOM, runs in Node. */
/** @import { Line, LineForm } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  formProblems: [() => formProblems, v => (formProblems = v)],
  formSpeciesId: [() => formSpeciesId],
  // @ts-expect-error -- replaced on purpose
  formSpeciesOf: [() => formSpeciesOf, v => (formSpeciesOf = v)],
  // @ts-expect-error -- replaced on purpose
  formTypes: [() => formTypes, v => (formTypes = v)],
  // @ts-expect-error -- replaced on purpose
  lineSpeciesIds: [() => lineSpeciesIds, v => (lineSpeciesIds = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** a form's species id for a stage @param {string} line @param {string} form @param {number} st0 */
export const formSpeciesId = (line, form, st0) => `${line}_${form}${st0}`;

/** every species id a line makes: its stages, then each form's stages
 * @param {{ id: string, names?: unknown[], forms?: { id: string }[] }} L @returns {string[]} */
export function lineSpeciesIds(L) {
  const n = (L.names || []).length,
    out = [];
  for (let i = 0; i < n; i++) out.push(L.id + i);
  for (const F of L.forms || []) for (let i = 0; i < n; i++) out.push(formSpeciesId(L.id, F.id, i));
  return out;
}

/** a form's types: each type swapped by its `swap`, a type named twice kept once
 * @param {string[]} types @param {Record<string, string> | undefined} swap */
export function formTypes(types, swap) {
  const out = [];
  for (const t of types) {
    const to = (swap && swap[t]) || t;
    if (!out.includes(to)) out.push(to);
  }
  return out;
}

/** the species of a form's stage, from its base stage's species (made by game-data.js); the base is not changed
 * @template {{ id: string, name: string, types: string[], next: string | null, alt: string | null }} S
 * @param {S} base @param {{ id: string }} L @param {LineForm} F @returns {S & { formOf: string, coat: string }} */
export function formSpeciesOf(base, L, F) {
  const st0 = +base.id.slice(L.id.length),
    to = (/** @type {string | null} */ id) => (id ? formSpeciesId(L.id, F.id, +id.slice(L.id.length)) : null);
  return {
    ...base,
    id: formSpeciesId(L.id, F.id, st0),
    name: `${F.name} ${base.name}`,
    types: formTypes(base.types, F.swap),
    next: to(base.next),
    alt: to(base.alt),
    formOf: base.id,
    coat: F.coat,
  };
}

/** what is wrong with a line's forms (check-data and the Studio's Check): ids, names, coats and swapped types
 * @param {Line} L @param {Record<string, { form?: boolean }>} coats @param {string[]} typeIds @returns {string[]} */
export function formProblems(L, coats, typeIds) {
  const out = [],
    seen = new Set();
  for (const F of L.forms || []) {
    if (seen.has(F.id)) out.push(`two forms are called ${F.id}`);
    seen.add(F.id);
    if (!coats[F.coat]) out.push(`form ${F.id} has coat ${F.coat}, no such coat`);
    else if (!coats[F.coat].form) out.push(`form ${F.id}'s coat ${F.coat} is not marked "form" in coats.json`);
    for (const [a, b] of Object.entries(F.swap || {}))
      for (const t of [a, b]) if (!typeIds.includes(t)) out.push(`form ${F.id} swaps type ${t}, no such type`);
    const changes = (L.types || []).some(ts => formTypes(ts, F.swap).join() !== ts.join());
    if (!changes) out.push(`form ${F.id} changes no stage's types`);
  }
  return out;
}
