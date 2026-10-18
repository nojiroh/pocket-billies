// @ts-check
'use strict';
/* ================= ROBOT MATH (phase 17) =================
   The arithmetic of a robot's parts, shared by the game (logic/fighters.js) and the Studio's Robots section, so both
   show the same numbers. D is robots.json, R is rules.json "robots", a fit is { torso, armL, armR, legs } of
   { id, up }. Logic only: no DOM, runs in Node. */
/** @import { RobotData, RobotRules } from '../../types/game-data' */
/** @import { RobotFit } from '../../types/save-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  RM_SLOTS: [() => RM_SLOTS],
  // @ts-expect-error -- replaced on purpose
  robotMathAttack: [() => robotMathAttack, v => (robotMathAttack = v)],
  // @ts-expect-error -- replaced on purpose
  robotMathBase: [() => robotMathBase, v => (robotMathBase = v)],
  // @ts-expect-error -- replaced on purpose
  robotMathMoves: [() => robotMathMoves, v => (robotMathMoves = v)],
  // @ts-expect-error -- replaced on purpose
  robotMathSpeed: [() => robotMathSpeed, v => (robotMathSpeed = v)],
  // @ts-expect-error -- replaced on purpose
  robotMathTypes: [() => robotMathTypes, v => (robotMathTypes = v)],
  // @ts-expect-error -- replaced on purpose
  robotMathWeight: [() => robotMathWeight, v => (robotMathWeight = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const RM_SLOTS = /** @type {('torso' | 'armL' | 'armR' | 'legs')[]} */ (['torso', 'armL', 'armR', 'legs']);
/** @param {RobotData} D @param {RobotFit} fit @returns {number} kg */
export function robotMathWeight(D, fit) {
  return RM_SLOTS.reduce((a, k) => a + (D.parts[fit[k].id].wt || 0), 0);
}
/** what weight against the legs' carry does to Speed (1 = nothing) @param {RobotData} D @param {RobotRules} R @param {RobotFit} fit */
export function robotMathSpeed(D, R, fit) {
  const w = robotMathWeight(D, fit),
    carry = D.parts[fit.legs.id].carry || 100;
  return w > carry ? Math.pow(carry / w, R.overweightExp) : 1 + R.lightBonus * (1 - w / carry);
}
/** what weight does to Attack and Sp. Atk (1 = nothing) @param {RobotData} D @param {RobotRules} R @param {RobotFit} fit */
export function robotMathAttack(D, R, fit) {
  return Math.min(1 + R.cap, Math.max(1 - R.cap, Math.pow(robotMathWeight(D, fit) / R.refWeight, R.attackExp)));
}
/** a robot's base stats, in statIds order, before its level
 * @param {RobotData} D @param {RobotRules} R @param {string[]} statIds @param {string} gem @param {RobotFit} fit
 * @returns {number[]} */
export function robotMathBase(D, R, statIds, gem, fit) {
  /** @type {Record<string, number>} */
  const v = Object.fromEntries(statIds.map(k => [k, R.baseStat]));
  for (const k of RM_SLOTS) {
    const S = /** @type {Record<string, number>} */ (D.parts[fit[k].id].stats),
      f = 1 + R.upgradeStat * Math.max(0, Math.min(R.maxUpgrade, fit[k].up || 0));
    for (const s in S) if (s in v) v[s] += (S[s] || 0) * f;
  }
  const G = /** @type {Record<string, number>} */ (D.gems[gem].stats);
  for (const s in G) if (s in v) v[s] += G[s] || 0;
  if ('hus' in v) v.hus *= robotMathSpeed(D, R, fit);
  const af = robotMathAttack(D, R, fit);
  if ('lev' in v) v.lev *= af;
  if ('lob' in v) v.lob *= af;
  return statIds.map(k => Math.max(1, Math.round(v[k])));
}
/** its types: the torso's, then the legs' when different @param {RobotData} D @param {RobotFit} fit @returns {string[]} */
export function robotMathTypes(D, fit) {
  const a = D.parts[fit.torso.id].type,
    b = D.parts[fit.legs.id].type;
  return a === b ? [a] : [a, b];
}
/** its moves: the left arm's, the right arm's, the legs', then the gem's, each once
 * @param {RobotData} D @param {Record<string, any>} moves @param {string} gem @param {RobotFit} fit @returns {string[]} */
export function robotMathMoves(D, moves, gem, fit) {
  const out = /** @type {string[]} */ ([]);
  for (const id of [D.parts[fit.armL.id].move, D.parts[fit.armR.id].move, D.parts[fit.legs.id].move, D.gems[gem].move])
    if (id && moves[id] && !out.includes(id)) out.push(id);
  return out;
}
