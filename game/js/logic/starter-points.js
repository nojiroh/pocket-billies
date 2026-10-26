// @ts-check
'use strict';
/* ================= STARTER POINTS (roguelite track RL-13) =================
   Who may start a run, and what each one costs. Only the Billies at the ranch (the team and storage) can start a run
   (9.6, 24); each costs points by its line's rarity and how far along its line it is (a final form counts as a
   final form: RO-2's two-stage lines and Billies with no evolutions included), and more for its levels (a Billie
   trained at the ranch, or brought home from a won run, is dearer: the levels are what a run gains, wherever they
   came from). A run's budget is rules.json run.points.budget by Expedition. This replaces RL-9b's "1 Billie from home
   a run" (rules.json run.home); the packed bag (run.pack) is unchanged.
   Every number is a placeholder for the run sim (9.6, 23).
   Logic only: no DOM, no Date, no Math.random (tools/test/starter-points.test.mjs). */
/** @import { Species, StarterPointRules } from '../../types/game-data' */
/** @typedef {{ sp: string, lvl?: number, uid?: string, graft?: Record<string, string> }} PointBilly */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { billySpliceCost, runByExpedition, speciesStep } from '../hooks.js';
import { modTypeFits } from './modifiers.js';
/* eslint-disable no-func-assign */
expose({
  pointBudget: [() => pointBudget],
  // @ts-expect-error -- replaced on purpose
  pointCost: [() => pointCost, v => (pointCost = v)],
  // @ts-expect-error -- replaced on purpose
  pointPick: [() => pointPick, v => (pointPick = v)],
  pointSpend: [() => pointSpend],
  // @ts-expect-error -- replaced on purpose
  pointStartable: [() => pointStartable, v => (pointStartable = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the points a run at this Expedition has to spend @param {StarterPointRules} R @param {number} expedition */
export const pointBudget = (R, expedition) => runByExpedition(R.budget, expedition);

/**
 * What one Billie costs: its line's rarity, `stage` more per step along its line (rules.js speciesStep; together at most
 * `most`), and one more per `perLevels` levels above `levelsFrom`; SP-4: one more per `perStability` of Stability its
 * splice spends (rules.js billySpliceCost). An unknown species costs the commonest rarity.
 * @param {PointBilly} m @param {Record<string, Species>} species @param {StarterPointRules} R @returns {number}
 */
export function pointCost(m, species, R) {
  const S = species[m.sp],
    rarity = Math.min(...Object.values(R.rarity)),
    base = Math.min(R.most, (S ? (R.rarity[S.rar] ?? rarity) : rarity) + speciesStep(S) * R.stage),
    over = Math.max(0, (m.lvl || 1) - R.levelsFrom);
  return base + Math.floor(over / R.perLevels) + (R.perStability ? Math.floor(billySpliceCost(m) / R.perStability) : 0);
}

/** what a pick costs in all @param {PointBilly[]} team @param {Record<string, Species>} species
 * @param {StarterPointRules} R */
export const pointSpend = (team, species, R) => team.reduce((sum, m) => sum + pointCost(m, species, R), 0);

/**
 * Whether this Billie may join the pick, and why not in words: it is already picked, the team is full, it costs more
 * than is left, or (a mono-type run) it is not of the run's type. '' when it may.
 * @param {PointBilly} m @param {PointBilly[]} picked @param {Record<string, Species>} species
 * @param {StarterPointRules} R @param {number} budget @param {{ mods?: string[] } | null} [run] its challenges
 * @returns {{ ok: boolean, why: string, cost: number }}
 */
export function pointStartable(m, picked, species, R, budget, run = null) {
  const cost = pointCost(m, species, R),
    left = budget - pointSpend(picked, species, R),
    S = species[m.sp],
    say = (/** @type {string} */ why) => ({ ok: !why, why, cost });
  if (picked.some(p => p.uid && p.uid === m.uid)) return say('');
  if (run && !modTypeFits(run, S ? S.types : [])) return say('not of this run’s type');
  if (picked.length >= R.team) return say(`only ${R.team} can go`);
  if (cost > left) return say(left > 0 ? `${cost} points, ${left} left` : 'no points left');
  return say('');
}

/**
 * The default pick at the mast: the dearest Billies the budget affords, strongest first (so a fresh save's one
 * starter is picked), each one that fits the challenges. `prefer` (the buddy) goes first when it fits.
 * @param {PointBilly[]} all the Billies at the ranch, the team first
 * @param {Record<string, Species>} species @param {StarterPointRules} R @param {number} budget
 * @param {{ mods?: string[] } | null} [run] @param {string} [prefer] @returns {PointBilly[]}
 */
export function pointPick(all, species, R, budget, run = null, prefer = '') {
  const order = all
    .filter(m => !run || modTypeFits(run, species[m.sp] ? species[m.sp].types : []))
    .slice()
    .sort((a, b) => {
      if (prefer && (a.uid === prefer) !== (b.uid === prefer)) return a.uid === prefer ? -1 : 1;
      return (
        pointCost(b, species, R) - pointCost(a, species, R) ||
        (b.lvl || 1) - (a.lvl || 1) ||
        (a.uid || '').localeCompare(b.uid || '')
      );
    });
  /** @type {PointBilly[]} */
  const out = [];
  for (const m of order) if (pointStartable(m, out, species, R, budget, run).ok) out.push(m);
  return out;
}
