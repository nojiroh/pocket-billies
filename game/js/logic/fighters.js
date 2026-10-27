// @ts-check
'use strict';
/* ================= FIGHTERS (phase 17) =================
   A team member is a Billie or a robot. Everything that needs a member's species data (name, types, base stats,
   weight, XP yield) asks here instead of reading SPECIES[m.sp], so a robot stands in the same team, the same battles
   and the same screens as a Billie.
   A robot is a gem (robots.json gems: its level, XP and signature move) with four parts fitted (robots.json parts): a
   torso with the head, a left arm, a right arm and legs. Any arm fits either side. Its sp is made from its gem and
   parts ('bot:volt.vane.tesla.auger.striders', robotSp), so the art (game/js/robot-art.js) can draw it from the sp
   alone, like a Billie's. Its species data is worked out from the parts (robotSpecies): stats are the parts' stats on
   a floor, weight against what the legs carry trades Speed, the torso's and legs' types are its types.
   The rules a robot member needs (its part HP, broken parts, making one) are in rules.js, beside makeBilly.
   Logic only (game/js/logic/): no DOM, runs in plain Node. */
/** @import { RobotGem, RobotPart, RobotRules, RobotSlot, Species } from '../../types/game-data' */
/** @import { PartInstance, RobotFit } from '../../types/save-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
import { MOVES, ROBOTS, RULES, SPECIES, STAT_IDS } from '../game-data.js';
import {
  robotMathAttack,
  robotMathBase,
  robotMathMoves,
  robotMathSpeed,
  robotMathTypes,
  robotMathWeight,
} from './robot-math.js';
/* eslint-disable no-func-assign */
expose({
  DEFAULT_ROBOT_RULES: [() => DEFAULT_ROBOT_RULES],
  ROBOT_LIMBS: [() => ROBOT_LIMBS],
  ROBOT_SLOTS: [() => ROBOT_SLOTS],
  ROBOT_SLOT_NAMES: [() => ROBOT_SLOT_NAMES],
  ROBOT_VIEWS: [() => ROBOT_VIEWS],
  SLOT_FITS: [() => SLOT_FITS],
  // @ts-expect-error -- replaced on purpose
  fitFromIds: [() => fitFromIds, v => (fitFromIds = v)],
  isRobot: [() => isRobot],
  isRobotSp: [() => isRobotSp],
  // @ts-expect-error -- replaced on purpose
  moveSources: [() => moveSources, v => (moveSources = v)],
  newPart: [() => newPart],
  partFits: [() => partFits],
  robotAttackFactor: [() => robotAttackFactor],
  robotBase: [() => robotBase],
  robotGemDef: [() => robotGemDef],
  // @ts-expect-error -- replaced on purpose
  robotIdsFromSp: [() => robotIdsFromSp, v => ((robotIdsFromSp = v), provide({ robotIdsFromSp }))],
  robotMoves: [() => robotMoves],
  // @ts-expect-error -- replaced on purpose
  robotName: [() => robotName, v => (robotName = v)],
  robotPartDef: [() => robotPartDef],
  robotRules: [() => robotRules],
  // @ts-expect-error -- replaced on purpose
  robotSp: [() => robotSp, v => (robotSp = v)],
  // @ts-expect-error -- replaced on purpose
  robotSpeciesFor: [() => robotSpeciesFor, v => (robotSpeciesFor = v)],
  robotSpeedFactor: [() => robotSpeedFactor],
  robotTypes: [() => robotTypes],
  robotViewsClear: [() => robotViewsClear],
  robotWeight: [() => robotWeight],
  // @ts-expect-error -- replaced on purpose
  speciesById: [() => speciesById, v => (speciesById = v)],
  // @ts-expect-error -- replaced on purpose
  speciesOf: [() => speciesOf, v => ((speciesOf = v), provide({ speciesOf }))],
  // @ts-expect-error -- replaced on purpose
  validRobot: [() => validRobot, v => (validRobot = v)],
});
/* eslint-enable no-func-assign */
provide({ robotIdsFromSp, speciesOf });
/* to-module: end */
/** the numbers when rules.json has no robots section (older data, the tests' small fixture) */
export const DEFAULT_ROBOT_RULES = /** @type {RobotRules} */ ({
  slots: ['torso', 'armL', 'armR', 'legs'],
  baseStat: 38,
  partHpRatio: 0.4,
  partShare: 1,
  hitWeights: { torso: 0.25, armL: 0.25, armR: 0.25, legs: 0.25 },
  legBreakSpeed: 0.5,
  upgradeStat: 0.08,
  maxUpgrade: 3,
  overweightExp: 0.8,
  lightBonus: 0.1,
  refWeight: 110,
  attackExp: 0.3,
  cap: 0.2,
  gemAffinity: 1.2,
  xpYield: 150,
});
/** @returns {RobotRules} */
export const robotRules = () => RULES.robots || DEFAULT_ROBOT_RULES;
/** @type {RobotSlot[]} */
export const ROBOT_SLOTS = ['torso', 'armL', 'armR', 'legs'];
/** the slots that can break (the torso is the robot's own HP bar) */
export const ROBOT_LIMBS = /** @type {('armL' | 'armR' | 'legs')[]} */ (['armL', 'armR', 'legs']);
/** which kind of part fits a slot */
export const SLOT_FITS = { torso: 'torso', armL: 'arm', armR: 'arm', legs: 'legs' };
export const ROBOT_SLOT_NAMES = { torso: 'torso', armL: 'left arm', armR: 'right arm', legs: 'legs', gem: 'gem' };
/** @param {any} m @returns {boolean} */
export const isRobot = m => !!m && m.kind === 'robot';
/** @param {any} sp @returns {boolean} */
export const isRobotSp = sp => typeof sp === 'string' && sp.startsWith('bot:');
/** @param {string} id @returns {RobotPart | undefined} */
export const robotPartDef = id => ROBOTS.parts[id];
provide({ robotPartDef }); /* to-module */
/** @param {string} id @returns {RobotGem | undefined} */
export const robotGemDef = id => ROBOTS.gems[id];
provide({ robotGemDef }); /* to-module */
/** does part id fit this slot? @param {string} id @param {RobotSlot} slot */
export const partFits = (id, slot) => !!ROBOTS.parts[id] && ROBOTS.parts[id].slot === SLOT_FITS[slot];
/** a robot's sp, from its gem and parts @param {string} gem @param {RobotFit} fit */
export function robotSp(gem, fit) {
  return 'bot:' + [gem, ...ROBOT_SLOTS.map(k => fit[k].id)].join('.');
}
/** the gem and part ids in a robot's sp, or null @param {string} sp */
export function robotIdsFromSp(sp) {
  if (!isRobotSp(sp)) return null;
  const a = sp.slice(4).split('.');
  if (a.length !== 5) return null;
  return { gem: a[0], torso: a[1], armL: a[2], armR: a[3], legs: a[4] };
}
/** a fit of new (upgrade 0) parts from ids, for trainers and for an sp alone
 * @param {{ torso: string, armL: string, armR: string, legs: string }} ids @returns {RobotFit} */
export function fitFromIds(ids) {
  return /** @type {RobotFit} */ (Object.fromEntries(ROBOT_SLOTS.map(k => [k, { uid: '', id: ids[k], up: 0 }])));
}
/** can this robot be built: a known gem and the right kind of part in each slot?
 * @param {string | undefined} gem @param {RobotFit | undefined} fit */
export function validRobot(gem, fit) {
  return !!gem && !!ROBOTS.gems[gem] && !!fit && ROBOT_SLOTS.every(k => !!fit[k] && partFits(fit[k].id, k));
}
/** @param {RobotFit} fit @returns {number} kg */
export const robotWeight = fit => robotMathWeight(ROBOTS, fit);
/** what weight against the legs' carry does to Speed (1 = nothing) @param {RobotFit} fit */
export const robotSpeedFactor = fit => robotMathSpeed(ROBOTS, robotRules(), fit);
/** what weight does to Attack and Sp. Atk (1 = nothing) @param {RobotFit} fit */
export const robotAttackFactor = fit => robotMathAttack(ROBOTS, robotRules(), fit);
/** a robot's base stats (stats.json order) before its level, like a species' base (logic/robot-math.js)
 * @param {string} gem @param {RobotFit} fit @returns {number[]} */
export const robotBase = (gem, fit) => robotMathBase(ROBOTS, robotRules(), STAT_IDS, gem, fit);
/** its types: the torso's, then the legs' when different @param {RobotFit} fit @returns {string[]} */
export const robotTypes = fit => robotMathTypes(ROBOTS, fit);
/** its moves: the left arm's, the right arm's, the legs', then the gem's (two arms giving the same move give it once)
 * @param {string} gem @param {RobotFit} fit @returns {string[]} */
export const robotMoves = (gem, fit) => robotMathMoves(ROBOTS, MOVES, gem, fit);
/** which of a robot's slots give a move ('gem' for its gem) @param {string} gem @param {RobotFit} fit @param {string} mid */
export function moveSources(gem, fit, mid) {
  const out = /** @type {string[]} */ ([]);
  for (const k of ROBOT_LIMBS) if (ROBOTS.parts[fit[k].id].move === mid) out.push(k);
  if (ROBOTS.gems[gem].move === mid) out.push('gem');
  return out;
}
/** its default name: the gem's short name and the torso's family ("Volt Vane") @param {string} gem @param {RobotFit} fit */
export function robotName(gem, fit) {
  const G = ROBOTS.gems[gem],
    T = ROBOTS.parts[fit.torso.id];
  return `${G.short || G.name} ${T.short || T.name}`;
}
export const ROBOT_VIEWS = new Map();
/** a robot's species data, worked out from its gem and parts (cached by parts and upgrades)
 * @param {string} gem @param {RobotFit} fit @returns {Species} */
export function robotSpeciesFor(gem, fit) {
  const key = robotSp(gem, fit) + ':' + ROBOT_SLOTS.map(k => fit[k].up || 0).join('');
  let v = ROBOT_VIEWS.get(key);
  if (v) return v;
  v = /** @type {Species} */ ({
    id: robotSp(gem, fit),
    name: robotName(gem, fit),
    line: '',
    stage: 2,
    types: robotTypes(fit),
    base: robotBase(gem, fit),
    cat: 'Robot',
    ht: 1.2,
    wt: robotWeight(fit),
    hab: '',
    diet: '',
    blurb: ROBOTS.parts[fit.torso.id].d || '',
    note: '',
    cr: 0,
    yld: robotRules().xpYield,
    next: null,
    alt: null,
    evo: null,
    no: 0,
    rar: 'robot',
    form: null,
  });
  if (ROBOT_VIEWS.size > 400) ROBOT_VIEWS.clear();
  ROBOT_VIEWS.set(key, v);
  return v;
}
/** forget worked-out robots (the Studio, after an edit to robots.json or rules.json) */
export const robotViewsClear = () => ROBOT_VIEWS.clear();
/** a team member's species data: a Billie's species, or a robot's worked out from its parts (undefined for a robot
 * whose gem or parts the data no longer has)
 * @param {{ sp: string, kind?: string, gem?: string, fit?: RobotFit }} m @returns {Species} */
export function speciesOf(m) {
  if (m.kind === 'robot')
    return validRobot(m.gem, m.fit)
      ? robotSpeciesFor(/** @type {string} */ (m.gem), /** @type {RobotFit} */ (m.fit))
      : /** @type {any} */ (undefined);
  return SPECIES[m.sp];
}
/** species data by id: a Billie's, or (phase 17) a robot's from its sp, with its parts not upgraded
 * @param {string} sp @returns {Species | undefined} */
export function speciesById(sp) {
  if (SPECIES[sp]) return SPECIES[sp];
  const ids = robotIdsFromSp(sp);
  if (!ids) return undefined;
  const fit = fitFromIds(ids);
  return validRobot(ids.gem, fit) ? robotSpeciesFor(ids.gem, fit) : undefined;
}
/** a part for the inventory @param {string} id @param {string} uid @returns {PartInstance} */
export const newPart = (id, uid) => ({ uid, id, up: 0 });
