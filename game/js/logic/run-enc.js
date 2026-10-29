// @ts-check
'use strict';
/* ================= A RUN'S ENCOUNTER STATE (roguelite track RL-12b) =================
   What a run keeps for its events (events.json, PokeRogue's mystery encounters) and its reward picks, in run.enc
   (missing on a run from before RL-12b: encOf makes it):
   - boons: effect rows an event left for a while (the `fx` command): each lasts the place it was given in and `left`
     more places; fxOfRun (effects.js) reads them beside the Perks' rows, encArrive counts them down; PK-9: a named
     boon or curse of boons.json (the `boon` and `curse` commands, the fountain's wish) is kept by its `id` alone, its
     rows read from the data when asked (src `boon:<id>`), so a pack's or the Studio's change reaches a run in play;
   Logic only: no DOM, no Date, no Math.random (tools/test/run-enc.test.mjs). */
/** @import { Run, RunEnc } from '../../types/save-data' */
/** @import { Boon, FxRow } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { BOONS, provide } from '../hooks.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  encArrive: [() => encArrive, v => ((encArrive = v), provide({ encArrive }))],
  // @ts-expect-error -- replaced on purpose
  encBoon: [() => encBoon, v => (encBoon = v)],
  // @ts-expect-error -- replaced on purpose
  encBoonGive: [() => encBoonGive, v => ((encBoonGive = v), provide({ encBoonGive }))],
  // @ts-expect-error -- replaced on purpose
  encBoonLine: [() => encBoonLine, v => (encBoonLine = v)],
  encBoonRows: [() => encBoonRows],
  encBoonsOn: [() => encBoonsOn],
  // @ts-expect-error -- replaced on purpose
  encOf: [() => encOf, v => ((encOf = v), provide({ encOf }))],
  // @ts-expect-error -- replaced on purpose
  fxRowOf: [() => fxRowOf, v => (fxRowOf = v)],
});
/* eslint-enable no-func-assign */
provide({ encArrive, encBoonGive, encOf });
/* to-module: end */
/** a run's encounter state, made the first time it is asked for @param {Run} run @returns {RunEnc} */
export function encOf(run) {
  if (!run.enc) run.enc = { n: 0, node: {}, seen: [], boons: [], rewardN: 0, reward: null };
  return run.enc;
}

/** the boons' effect rows, each tagged with the event that gave it (none: []); PK-9: a named boon's rows from boons.json,
 * tagged `boon:<id>` (none when the data has no such boon any more) @param {Run | null | undefined} run
 * @param {Record<string, Boon>} [boons] */
export const encBoonRows = (run, boons = BOONS) =>
  run && run.enc
    ? run.enc.boons.flatMap(b =>
        b.id
          ? ((boons && boons[b.id] && boons[b.id].fx) || []).map(f => ({ ...f, src: 'boon:' + b.id }))
          : (b.fx || []).map(f => ({ ...f, src: 'event:' + b.src }))
      )
    : [];

/** PK-9: give a named boon or curse (boons.json): it lasts this place and its `places` more. Given again while it is
 * on, it lasts the longer of the two (it never stacks). Returns the places it lasts after this one, or -1 when there
 * is no such boon. PK-9: a curse lasts `shorter` places less (Correction Fluid's curseShorter), and while fewer than
 * `erase` curses were erased this run (run.enc.erased) it is erased instead: -2, nothing given
 * @param {Run} run @param {string} id @param {string} src who gave it (an event's id, 'fountain')
 * @param {Record<string, Boon>} [boons] @param {{ shorter?: number, erase?: number }} [rule]
 * @returns {number} */
export function encBoonGive(run, id, src, boons = BOONS, rule = {}) {
  const B = boons && boons[id];
  if (!B) return -1;
  const E = encOf(run);
  if (B.curse && (E.erased || 0) < (rule.erase || 0)) {
    E.erased = (E.erased || 0) + 1;
    return -2;
  }
  const left = Math.max(0, Math.floor(B.places) - (B.curse ? rule.shorter || 0 : 0)),
    on = E.boons.find(b => b.id === id);
  if (on) on.left = Math.max(on.left, left);
  else E.boons.push({ id, left, src });
  return left;
}
/** PK-9: the named boons and curses on now, in the order given, each with its data and the places it lasts after this
 * one (`left`; 0: this place is its last) @param {Run | null | undefined} run @param {Record<string, Boon>} [boons]
 * @returns {{ id: string, left: number, src: string, boon: Boon }[]} */
export const encBoonsOn = (run, boons = BOONS) =>
  run && run.enc
    ? run.enc.boons
        .filter(b => b.id && boons && boons[b.id])
        .map(b => ({
          id: /** @type {string} */ (b.id),
          left: b.left,
          src: b.src,
          boon: boons[/** @type {string} */ (b.id)],
        }))
    : [];

/** an event leaves effect rows for this place and `places` more @param {Run} run @param {FxRow[]} fx
 * @param {number} places @param {string} src the event's id */
export function encBoon(run, fx, places, src) {
  encOf(run).boons.push({ fx: fx.map(f => ({ ...f })), left: Math.max(0, Math.floor(places)), src });
}
/** PK-9: an event's or the fountain's words for a boon or curse given: "Curse: Surge Pricing, for this place and 3
 * more. Run shops charge 25% more." @param {Boon} B @param {number} left */
export function encBoonLine(B, left) {
  const span = left > 0 ? `for this place and ${left} more` : 'for this place';
  return `${B.curse ? 'Curse' : 'Boon'}: ${B.name}, ${span}. ${B.d}`;
}

/** walking into a place: every boon counts one place down; one with none left goes @param {Run} run */
export function encArrive(run) {
  if (!run.enc) return;
  run.enc.boons = run.enc.boons.filter(b => b.left-- > 0);
}

/** an effect row from the `fx` command's words: the kind, then key=value (numbers read as numbers):
 * ['price', 'what=shop', 'mult=1.25'] -> { kind: 'price', what: 'shop', mult: 1.25 } @param {string[]} words
 * @returns {Record<string, any>} */
export function fxRowOf(words) {
  /** @type {Record<string, any>} */
  const row = { kind: words[0] || '' };
  for (const w of words.slice(1)) {
    const i = w.indexOf('=');
    if (i <= 0) continue;
    const k = w.slice(0, i),
      v = w.slice(i + 1);
    if (k === 'kind' || k === '__proto__') continue;
    row[k] = /^-?\d+(\.\d+)?$/.test(v) ? +v : v;
  }
  return row;
}
