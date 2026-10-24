// @ts-check
'use strict';
/* ================= MODIFIERS (roguelite track RL-13) =================
   What a run's Expedition and challenges change (modifiers.json). The Expedition is run.expedition (I = 1; each one's
   row in `expeditions`); the challenges are ids in run.mods (`mono`, `noheal`, `noperks`, `fragile`; mono-type also
   holds its type as `mono_<type in lower case>`). Their effect rows join the run's Perks (logic/effects.js fxOfRun);
   the rules each challenge names are asked here by the places they change (the mast, catching, the clinic, run shops,
   the Perk pool, a battle's end). Winning the highest Expedition open opens the next (expeditionAfterWin).
   Logic only: no DOM, no Date, no Math.random (tools/test/modifiers.test.mjs). */
/** @import { ChallengeId, FxRow, ModifiersData } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { MODIFIERS } from '../hooks.js';
/* eslint-disable no-func-assign */
expose({
  CHALLENGE_IDS: [() => CHALLENGE_IDS],
  expeditionAfterWin: [() => expeditionAfterWin],
  expeditionCount: [() => expeditionCount],
  expeditionNumeral: [() => expeditionNumeral],
  modChallenges: [() => modChallenges],
  // @ts-expect-error -- replaced on purpose
  modFxRows: [() => modFxRows, v => (modFxRows = v)],
  modHas: [() => modHas],
  modMonoType: [() => modMonoType],
  modMonoTypeId: [() => modMonoTypeId],
  modTypeFits: [() => modTypeFits],
  // @ts-expect-error -- replaced on purpose
  modsMake: [() => modsMake, v => (modsMake = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the challenges the code knows (modifiers.schema.json's list) */
export const CHALLENGE_IDS = /** @type {const} */ (['mono', 'noheal', 'noperks', 'fragile']);
/** how many Expeditions there are @param {ModifiersData} [M] */
export const expeditionCount = (M = MODIFIERS) => Math.max(1, M.expeditions.length);
/** an Expedition's numeral (1 -> I) @param {number} n */
export const expeditionNumeral = n => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][n - 1] || String(n);
/** whether a run (or a list of mods) has a challenge @param {{ mods?: string[] } | null | undefined} run
 * @param {ChallengeId} id */
export const modHas = (run, id) => !!(run && Array.isArray(run.mods) && run.mods.includes(id));
/** a mono-type run's type id in lower case ('' when none) @param {{ mods?: string[] } | null | undefined} run */
export const modMonoTypeId = run =>
  modHas(run, 'mono') ? ((run && run.mods ? run.mods : []).find(m => m.startsWith('mono_')) || '').slice(5) : '';
/** a mono-type run's type as types.json names it ('Water'; '' when none) @param {{ mods?: string[] } | null | undefined} run
 * @param {string[]} typeNames the types' names */
export const modMonoType = (run, typeNames) => {
  const id = modMonoTypeId(run);
  return id ? typeNames.find(t => t.toLowerCase() === id) || '' : '';
};
/** whether a Billie of these types fits the run's mono-type rule (always, with no rule) @param {{ mods?: string[] } | null | undefined} run
 * @param {string[]} types */
export const modTypeFits = (run, types) => {
  const id = modMonoTypeId(run);
  return !id || types.some(t => t.toLowerCase() === id);
};
/** the challenge ids of a run, in modifiers.json's order @param {{ mods?: string[] } | null | undefined} run
 * @returns {ChallengeId[]} */
export const modChallenges = run => CHALLENGE_IDS.filter(id => modHas(run, id));
/** a run's mods from the mast's pick: the challenges (known ones, in order), a mono-type run's type, then the others
 * given (the debug menu's) @param {string[]} challenges @param {string} [monoType] @param {string[]} [more] */
export function modsMake(challenges, monoType, more = []) {
  const out = CHALLENGE_IDS.filter(id => challenges.includes(id) && (id !== 'mono' || !!monoType)).map(String);
  if (out.includes('mono')) out.push('mono_' + String(monoType).toLowerCase());
  for (const m of more) if (!out.includes(m)) out.push(m);
  return out;
}
/** the effect rows of a run's Expedition and challenges, each tagged with its source ('expedition', or the challenge
 * id); none for an Expedition past the data's last (it reads as the last) @param {{ expedition?: number, mods?: string[] } | null | undefined} run
 * @param {ModifiersData} [M] @returns {(FxRow & { src: string })[]} */
export function modFxRows(run, M = MODIFIERS) {
  if (!run) return [];
  const n = Math.max(1, Math.min(expeditionCount(M), Math.floor(run.expedition || 1))),
    E = M.expeditions[n - 1],
    rows = (E ? E.fx : []).map(f => ({ ...f, src: 'expedition' }));
  for (const id of modChallenges(run)) {
    const C = M.challenges[id];
    if (C) rows.push(...C.fx.map(f => ({ ...f, src: id })));
  }
  return rows;
}
/** the highest Expedition open after a run ends: winning the highest one open opens the next (never past the last)
 * @param {number} open meta.expedition @param {number} played run.expedition @param {boolean} won
 * @param {number} [most] how many there are */
export const expeditionAfterWin = (open, played, won, most = expeditionCount()) =>
  won && played >= open ? Math.min(most, open + 1) : open;
