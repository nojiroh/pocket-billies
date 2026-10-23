// @ts-check
'use strict';
/* ================= A RUN'S ENCOUNTER STATE (roguelite track RL-12b) =================
   What a run keeps for its events (events.json, PokeRogue's mystery encounters) and its reward picks, in run.enc
   (missing on a run from before RL-12b: encOf makes it):
   - boons: effect rows an event left for a while (the `fx` command): each lasts the place it was given in and `left`
     more places; fxOfRun (effects.js) reads them beside the Perks' rows, encArrive counts them down;
   Logic only: no DOM, no Date, no Math.random (tools/test/run-enc.test.mjs). */
/** @import { Run, RunEnc } from '../../types/save-data' */
/** @import { FxRow } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  encArrive: [() => encArrive, v => ((encArrive = v), provide({ encArrive }))],
  // @ts-expect-error -- replaced on purpose
  encBoon: [() => encBoon, v => (encBoon = v)],
  encBoonRows: [() => encBoonRows],
  // @ts-expect-error -- replaced on purpose
  encOf: [() => encOf, v => (encOf = v)],
  // @ts-expect-error -- replaced on purpose
  fxRowOf: [() => fxRowOf, v => (fxRowOf = v)],
});
/* eslint-enable no-func-assign */
provide({ encArrive });
/* to-module: end */
/** a run's encounter state, made the first time it is asked for @param {Run} run @returns {RunEnc} */
export function encOf(run) {
  if (!run.enc) run.enc = { n: 0, node: {}, seen: [], boons: [], rewardN: 0, reward: null };
  return run.enc;
}

/** the boons' effect rows, each tagged with the event that gave it (none: []) @param {Run | null | undefined} run */
export const encBoonRows = run =>
  run && run.enc ? run.enc.boons.flatMap(b => b.fx.map(f => ({ ...f, src: 'event:' + b.src }))) : [];

/** an event leaves effect rows for this place and `places` more @param {Run} run @param {FxRow[]} fx
 * @param {number} places @param {string} src the event's id */
export function encBoon(run, fx, places, src) {
  encOf(run).boons.push({ fx: fx.map(f => ({ ...f })), left: Math.max(0, Math.floor(places)), src });
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
