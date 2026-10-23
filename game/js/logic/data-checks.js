// @ts-check
'use strict';
/* ================= DATA CHECKS (Studio plan Phase 1, T1.3: one set of data checks for CI and the Studio) =================
   Pure checks on the game data, run by tools/check-data.mjs (CI) and the Studio's Check (studio/js/check.js), so the
   two agree. Each family takes the data (the game data's sections, as the Studio holds them) and returns its problems
   as [file, message] pairs, in check-data's words. A family that starts with a schema takes `valid(schema, value,
   where)`: check-data passes its schema check (which reports the schema's own problems), the Studio, which has no
   schema validator, passes none (every value counts as valid, so a family must not trust a shape it didn't test).
   Logic only: no DOM, runs in Node (tools/test/data-checks.test.mjs). */
/** @typedef {[string, string]} DataProblem a problem: the file it is in (as check-data names it) and what is wrong */
/** @typedef {(schema: string, value: unknown, where: string) => boolean} DataValid */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { lineSpeciesIds } from './forms.js';
import { CLIMATE_WEATHER_ODDS } from './weather.js';
import { uiThemeContrast } from './ui-theme.js';
import { RUN_MARK_TYPES } from './run-marks.js';
import { runRegionData, runRegionMake } from './run-region.js';
import { runMapMake, runMapRows, runMapRowsFit } from './run-map.js';
import { MAPGEN_DEFAULTS, MAPGEN_FEATURES, MAPGEN_SHAPES, MAPGEN_SURFACES, MAPGEN_WATER } from './mapgen.js';
import { fxRowOf } from './run-enc.js';
import { FX_KINDS, FX_LIMIT, FX_STAGES } from './effects.js';
import { conditionNames, conditionProblem, conditionTree } from './conditions.js';
import { islandProblems } from './island.js';
import { parseScript, scriptProblem } from './script-parse.js';
/* eslint-disable no-func-assign */
expose({
  ROBOT_FITS: [() => ROBOT_FITS],
  RUN_MAP_ROLE_NAMES: [() => RUN_MAP_ROLE_NAMES],
  RUN_MAP_ROLE_TYPES: [() => RUN_MAP_ROLE_TYPES],
  RUN_RULE_KEYS: [() => RUN_RULE_KEYS],
  base64Bytes: [() => base64Bytes],
  // @ts-expect-error -- replaced on purpose
  dataBattleRules: [() => dataBattleRules, v => (dataBattleRules = v)],
  // @ts-expect-error -- replaced on purpose
  dataBiomes: [() => dataBiomes, v => (dataBiomes = v)],
  // @ts-expect-error -- replaced on purpose
  dataBuildings: [() => dataBuildings, v => (dataBuildings = v)],
  // @ts-expect-error -- replaced on purpose
  dataCatchArt: [() => dataCatchArt, v => (dataCatchArt = v)],
  // @ts-expect-error -- replaced on purpose
  dataCurrencies: [() => dataCurrencies, v => (dataCurrencies = v)],
  // @ts-expect-error -- replaced on purpose
  dataEvents: [() => dataEvents, v => (dataEvents = v)],
  // @ts-expect-error -- replaced on purpose
  dataFieldMoves: [() => dataFieldMoves, v => (dataFieldMoves = v)],
  // @ts-expect-error -- replaced on purpose
  dataNodeTypes: [() => dataNodeTypes, v => (dataNodeTypes = v)],
  // @ts-expect-error -- replaced on purpose
  dataPerks: [() => dataPerks, v => (dataPerks = v)],
  // @ts-expect-error -- replaced on purpose
  dataRanchRules: [() => dataRanchRules, v => (dataRanchRules = v)],
  // @ts-expect-error -- replaced on purpose
  dataRegions: [() => dataRegions, v => (dataRegions = v)],
  // @ts-expect-error -- replaced on purpose
  dataRewards: [() => dataRewards, v => (dataRewards = v)],
  // @ts-expect-error -- replaced on purpose
  dataRigs: [() => dataRigs, v => (dataRigs = v)],
  // @ts-expect-error -- replaced on purpose
  dataRoadFindings: [() => dataRoadFindings, v => (dataRoadFindings = v)],
  // @ts-expect-error -- replaced on purpose
  dataRobotProblems: [() => dataRobotProblems, v => (dataRobotProblems = v)],
  // @ts-expect-error -- replaced on purpose
  dataRobots: [() => dataRobots, v => (dataRobots = v)],
  // @ts-expect-error -- replaced on purpose
  dataRunClock: [() => dataRunClock, v => (dataRunClock = v)],
  // @ts-expect-error -- replaced on purpose
  dataRunLoop: [() => dataRunLoop, v => (dataRunLoop = v)],
  // @ts-expect-error -- replaced on purpose
  dataRunMapRules: [() => dataRunMapRules, v => (dataRunMapRules = v)],
  // @ts-expect-error -- replaced on purpose
  dataRunPayout: [() => dataRunPayout, v => (dataRunPayout = v)],
  // @ts-expect-error -- replaced on purpose
  dataRunScene: [() => dataRunScene, v => (dataRunScene = v)],
  // @ts-expect-error -- replaced on purpose
  dataSceneFindings: [() => dataSceneFindings, v => (dataSceneFindings = v)],
  // @ts-expect-error -- replaced on purpose
  dataSpeciesKind: [() => dataSpeciesKind, v => (dataSpeciesKind = v)],
  // @ts-expect-error -- replaced on purpose
  dataUiTheme: [() => dataUiTheme, v => (dataUiTheme = v)],
  // @ts-expect-error -- replaced on purpose
  dataUnderscoreKeys: [() => dataUnderscoreKeys, v => (dataUnderscoreKeys = v)],
  // @ts-expect-error -- replaced on purpose
  dataUnlocks: [() => dataUnlocks, v => (dataUnlocks = v)],
  // @ts-expect-error -- replaced on purpose
  runMapProblems: [() => runMapProblems, v => (runMapProblems = v)],
  // @ts-expect-error -- replaced on purpose
  runMapSweep: [() => runMapSweep, v => (runMapSweep = v)],
  // @ts-expect-error -- replaced on purpose
  runMapTownsPerPath: [() => runMapTownsPerPath, v => (runMapTownsPerPath = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** T1.6 (plan F7): the paths of keys starting with `_` (and longer than `_`) in a data file's value. The Studio
 * leaves such keys out of every save (they are its in-memory caches), so one in a file would vanish on the next
 * proposal @param {unknown} v @param {string} [at] @returns {string[]} */
export function dataUnderscoreKeys(v, at = '') {
  if (!v || typeof v !== 'object') return [];
  const out = [];
  for (const [k, x] of Object.entries(v)) {
    const p = at ? `${at}.${k}` : k;
    if (!Array.isArray(v) && k[0] === '_' && k.length > 1) out.push(p);
    else out.push(...dataUnderscoreKeys(x, p));
  }
  return out;
}
// roguelite track RL-4: the turn cap, a whole number of turns, at least 10 (a short cap would end ordinary battles)
/** roguelite track RL-4: rules.json battle.turnCap @param {any} D @returns {DataProblem[]} */
export function dataBattleRules(D) {
  /** @type {DataProblem[]} */
  const out = [],
    problem = (/** @type {string} */ where, /** @type {string} */ what) => out.push([where, what]);
  {
    const cap = D.rules && D.rules.battle && D.rules.battle.turnCap;
    if (!Number.isInteger(cap) || cap < 10) problem('rules.json', 'battle.turnCap is not a whole number of 10 or more');
  }
  return out;
}
// roguelite track RL-3: what a run pays when it ends (logic/run-state.js payoutOf): every rate a number, none below 0,
// the items' share of their price at most 1, the crests for a win a whole number
/** RL-3: rules.json run.payout @param {any} D @returns {DataProblem[]} */
export function dataRunPayout(D) {
  /** @type {DataProblem[]} */
  const out = [],
    problem = (/** @type {string} */ where, /** @type {string} */ what) => out.push([where, what]);
  {
    const pay = D.rules && D.rules.run && D.rules.run.payout,
      RATES = ['money', 'itemShare', 'released', 'node', 'win', 'winCrests', 'scrapNode', 'scrapWin'];
    if (!pay || typeof pay !== 'object') problem('rules.json', 'run.payout missing');
    else {
      for (const k of RATES)
        if (typeof pay[k] !== 'number' || !(pay[k] >= 0))
          problem('rules.json', `run.payout.${k} is not a number of 0 or more`);
      for (const k of Object.keys(pay)) if (!RATES.includes(k)) problem('rules.json', `run.payout.${k}: no such rate`);
      if (pay.itemShare > 1)
        problem('rules.json', 'run.payout.itemShare is more than 1 (items would pay over their price)');
      for (const k of ['winCrests', 'scrapNode', 'scrapWin'])
        if (!Number.isInteger(pay[k])) problem('rules.json', `run.payout.${k} is not a whole number`);
    }
  }
  return out;
}
// RL-9: the ranch (logic/ranch.js): training slots by ranch level (1-12 levels, each 1-20 slots, never fewer than the
// level before), the level cap (capBase at level 1, capStep more a level; at most the game's maxLevel), the hours a
// trainee banks (1-168), levels an hour (above 0, at most 10), the Scrap to start (0-10,000), the clock's slack for a
// rollback (0-1 hour), the Billies in the pasture (IS-8: 0-12); nothing else
/** RL-9, RL-10: rules.json ranch @param {any} D @returns {DataProblem[]} */
export function dataRanchRules(D) {
  /** @type {DataProblem[]} */
  const out = [],
    problem = (/** @type {string} */ where, /** @type {string} */ what) => out.push([where, what]);
  {
    const RA = D.rules && D.rules.ranch,
      whole = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi,
      KEYS = [
        'slots',
        'capBase',
        'capStep',
        'bankHours',
        'levelsPerHour',
        'trainCost',
        'guardMs',
        'pasture',
        'breed',
        'income',
      ];
    if (!RA || typeof RA !== 'object' || Array.isArray(RA)) problem('rules.json', 'ranch missing');
    else {
      for (const k of Object.keys(RA)) if (!KEYS.includes(k)) problem('rules.json', `ranch.${k}: no such rule`);
      const S = RA.slots;
      if (
        !Array.isArray(S) ||
        S.length < 1 ||
        S.length > 12 ||
        !S.every((n, i) => whole(n, 1, 20) && (!i || n >= S[i - 1]))
      )
        problem('rules.json', 'ranch.slots is not a list of 1-12 whole numbers (1-20), none fewer than the one before');
      const most = (D.rules.progression && D.rules.progression.maxLevel) || 100;
      if (!whole(RA.capBase, 2, most) || !whole(RA.capStep, 0, most))
        problem('rules.json', `ranch.capBase (2-${most}) and capStep (0-${most}) are not whole levels`);
      if (!whole(RA.bankHours, 1, 168)) problem('rules.json', 'ranch.bankHours is not a whole number of hours (1-168)');
      if (typeof RA.levelsPerHour !== 'number' || !(RA.levelsPerHour > 0 && RA.levelsPerHour <= 10))
        problem('rules.json', 'ranch.levelsPerHour is not a number above 0 and at most 10');
      if (!whole(RA.trainCost, 0, 10000))
        problem('rules.json', 'ranch.trainCost is not a whole number of Scrap (0-10,000)');
      if (!whole(RA.guardMs, 0, 3600000))
        problem('rules.json', 'ranch.guardMs is not a whole number of ms (0-3,600,000)');
      if (!whole(RA.pasture, 0, 12)) problem('rules.json', 'ranch.pasture is not a whole number of Billies (0-12)');
      // RL-10: breeding (logic/breeding.js): nests by ranch level as slots are, the two costs (a risky pair never costs
      // more than a safe one), the hours to hatch (1-168), the level it hatches at, the risky odds adding up to 1, the
      // abomination's spike (1-3) and drawback (0.1-1); nothing else
      const B = RA.breed,
        BKEYS = ['nests', 'safeCost', 'riskyCost', 'hours', 'lvl', 'odds', 'abomUp', 'abomDown'];
      if (!B || typeof B !== 'object' || Array.isArray(B)) problem('rules.json', 'ranch.breed missing');
      else {
        for (const k of Object.keys(B)) if (!BKEYS.includes(k)) problem('rules.json', `ranch.breed.${k}: no such rule`);
        const N = B.nests;
        if (
          !Array.isArray(N) ||
          N.length < 1 ||
          N.length > 12 ||
          !N.every((n, i) => whole(n, 1, 20) && (!i || n >= N[i - 1]))
        )
          problem(
            'rules.json',
            'ranch.breed.nests is not a list of 1-12 whole numbers (1-20), none fewer than the one before'
          );
        if (!whole(B.safeCost, 0, 10000) || !whole(B.riskyCost, 0, 10000) || B.riskyCost > B.safeCost)
          problem(
            'rules.json',
            'ranch.breed.safeCost and riskyCost are not whole Scrap (0-10,000), risky at most safe'
          );
        if (!whole(B.hours, 1, 168)) problem('rules.json', 'ranch.breed.hours is not a whole number of hours (1-168)');
        if (!whole(B.lvl, 1, most)) problem('rules.json', `ranch.breed.lvl is not a whole level (1-${most})`);
        const O = B.odds,
          OK = ['safe', 'quirk', 'abom'];
        if (
          !O ||
          typeof O !== 'object' ||
          Object.keys(O).length !== 3 ||
          !OK.every(k => typeof O[k] === 'number' && O[k] >= 0 && O[k] <= 1) ||
          Math.abs(OK.reduce((a, k) => a + O[k], 0) - 1) > 1e-9
        )
          problem('rules.json', 'ranch.breed.odds is not safe, quirk and abom (each 0-1) adding up to 1');
        if (typeof B.abomUp !== 'number' || !(B.abomUp >= 1 && B.abomUp <= 3))
          problem('rules.json', 'ranch.breed.abomUp is not a number from 1 to 3');
        if (typeof B.abomDown !== 'number' || !(B.abomDown >= 0.1 && B.abomDown <= 1))
          problem('rules.json', 'ranch.breed.abomDown is not a number from 0.1 to 1');
      }
      // RL-10b: passive income (logic/ranch-income.js): Scrap an hour by ranch level (1-12 levels, each 0-1,000, never
      // less than the level before), the hours it banks (1-168); nothing else
      const I = RA.income;
      if (!I || typeof I !== 'object' || Array.isArray(I)) problem('rules.json', 'ranch.income missing');
      else {
        for (const k of Object.keys(I))
          if (!['rate', 'capHours'].includes(k)) problem('rules.json', `ranch.income.${k}: no such rule`);
        const R = I.rate;
        if (
          !Array.isArray(R) ||
          R.length < 1 ||
          R.length > 12 ||
          !R.every((n, i) => typeof n === 'number' && n >= 0 && n <= 1000 && (!i || n >= R[i - 1]))
        )
          problem(
            'rules.json',
            'ranch.income.rate is not a list of 1-12 numbers (0-1,000), none less than the one before'
          );
        if (!whole(I.capHours, 1, 168))
          problem('rules.json', 'ranch.income.capHours is not a whole number of hours (1-168)');
      }
    }
  }
  return out;
}
// RL-6: how a run's node map is laid out (logic/run-map.js): 5 to 12 rows, mini-bosses that fit (each on a row of
// its own, a town's row before it, after the landing's row and before the boss's), the four types it names in
// nodeTypes.json, chances from 0 to 1, biomes that exist with something to pick
/** RL-6: rules.json run.map @param {any} D @returns {DataProblem[]} */
export function dataRunMapRules(D) {
  /** @type {DataProblem[]} */
  const out = [],
    problem = (/** @type {string} */ where, /** @type {string} */ what) => out.push([where, what]);
  {
    const M = D.rules && D.rules.run && D.rules.run.map,
      KEYS = ['rows', 'minibosses', 'first', 'rest', 'guard', 'last', 'wide', 'cross', 'biomes'];
    if (!M || typeof M !== 'object') problem('rules.json', 'run.map missing');
    else {
      for (const k of Object.keys(M)) if (!KEYS.includes(k)) problem('rules.json', `run.map.${k}: no such rule`);
      if (!Number.isInteger(M.rows) || M.rows < 5 || M.rows > 12)
        problem('rules.json', 'run.map.rows is not a whole number from 5 to 12');
      else if (!Number.isInteger(M.minibosses) || M.minibosses < 0 || !runMapRowsFit(M))
        problem(
          'rules.json',
          `run.map: ${M.rows} rows can't hold ${M.minibosses} mini-bosses (each on a row of its own with a town's row before it)`
        );
      for (const k of ['first', 'rest', 'guard', 'last'])
        if (!(D.nodeTypes || {})[M[k]]) problem('rules.json', `run.map.${k}: no node type "${M[k]}" (nodeTypes.json)`);
      for (const k of ['wide', 'cross'])
        if (typeof M[k] !== 'number' || !(M[k] >= 0 && M[k] <= 1))
          problem('rules.json', `run.map.${k} is not a chance from 0 to 1`);
      const B = M.biomes && typeof M.biomes === 'object' ? Object.entries(M.biomes) : [];
      if (!B.some(([, w]) => w > 0)) problem('rules.json', 'run.map.biomes has no biome to pick');
      for (const [b, w] of B) {
        if (!(D.biomes || {})[b]) problem('rules.json', `run.map.biomes: no biome "${b}" (biomes.json)`);
        if (typeof w !== 'number' || !(w >= 0))
          problem('rules.json', `run.map.biomes.${b} is not a weight of 0 or more`);
      }
    }
  }
  return out;
}
// RL-6: the run's clock and what its map shows: whole days of forecast ahead (1-30; RL-R2: no deadline, no slack), whole rows
// shown ahead with their type (1-12) and as '?' (at least as far, up to 12); nothing else in rules.json run
/** T1.3: the keys of rules.json run, each a rule a family here checks (any other is "no such rule"). The one list:
 * an editor of run rules reads it from here */
export const RUN_RULE_KEYS = Object.freeze([
  'payout',
  'map',
  'clock',
  'reveal',
  'scene',
  'wild',
  'seamIn',
  'start',
  'home',
  'pack',
  'healCost',
  'shop',
  'foes',
  'perks',
  'side',
  'trainers',
  'rewards',
]);
/** RL-6: rules.json run.clock, run.reveal and the run keys @param {any} D @returns {DataProblem[]} */
export function dataRunClock(D) {
  /** @type {DataProblem[]} */
  const out = [],
    problem = (/** @type {string} */ where, /** @type {string} */ what) => out.push([where, what]);
  {
    const R = (D.rules && D.rules.run) || {},
      C = R.clock,
      V = R.reveal,
      whole = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
    for (const k of Object.keys(R)) if (!RUN_RULE_KEYS.includes(k)) problem('rules.json', `run.${k}: no such rule`);
    if (!C || typeof C !== 'object' || !whole(C.ahead, 1, 30))
      problem('rules.json', 'run.clock: ahead (1-30) is not a whole number of days');
    else for (const k of Object.keys(C)) if (k !== 'ahead') problem('rules.json', `run.clock.${k}: no such rule`);
    if (!V || typeof V !== 'object' || !whole(V.icons, 1, 12) || !whole(V.unknown, V.icons, 12))
      problem('rules.json', 'run.reveal: icons (1-12) and unknown (icons to 12) are not whole numbers of rows');
    else
      for (const k of Object.keys(V))
        if (!['icons', 'unknown'].includes(k)) problem('rules.json', `run.reveal.${k}: no such rule`);
  }
  return out;
}
// RL-7: how a run node's scene varies (logic/run-scenes.js): mapgen's dials, a [low, high] range from 0 to 1 for a
// number the generator keeps from 0 to 1 (land, nature and props, the road's wobble and verge), weights for a choice
// (water, the road's shape and surface, the feature) with something to pick; nothing the run sets itself (size, kind,
// biome, seed, exits, edges). Wild levels: whole numbers from 1 to 100, low to high, a whole number more a row and
// again on a node walked back to; the metres past a seam before a crossing counts (1-30)
/** RL-7: rules.json run.scene, run.wild, run.seamIn @param {any} D @returns {DataProblem[]} */
export function dataRunScene(D) {
  /** @type {DataProblem[]} */
  const out = [],
    problem = (/** @type {string} */ where, /** @type {string} */ what) => out.push([where, what]);
  {
    const R = (D.rules && D.rules.run) || {},
      SC = R.scene,
      CHOICES = {
        'land.water': MAPGEN_WATER,
        'road.shape': MAPGEN_SHAPES,
        'road.surface': MAPGEN_SURFACES,
        feature: MAPGEN_FEATURES,
      },
      RANGED = path => /^(land|nature|props)\.[a-z]+$|^road\.(wobble|verge)$/i.test(path),
      walk = (rule, def, path) => {
        for (const [k, v] of Object.entries(rule)) {
          const at = path ? `${path}.${k}` : k,
            d = def && typeof def === 'object' && !Array.isArray(def) ? def[k] : undefined;
          if (CHOICES[at]) {
            const W = v && typeof v === 'object' && !Array.isArray(v) ? Object.entries(v) : [];
            if (!W.some(([, w]) => w > 0)) problem('rules.json', `run.scene.${at} has nothing to pick`);
            for (const [c, w] of W) {
              if (!Object.hasOwn(CHOICES[at], c))
                problem('rules.json', `run.scene.${at}: no such choice "${c}" (logic/mapgen.js)`);
              if (typeof w !== 'number' || !(w >= 0))
                problem('rules.json', `run.scene.${at}.${c} is not a weight of 0 or more`);
            }
          } else if (typeof d === 'number' && RANGED(at)) {
            if (
              !Array.isArray(v) ||
              v.length !== 2 ||
              !v.every(x => typeof x === 'number' && x >= 0 && x <= 1) ||
              v[0] > v[1]
            )
              problem('rules.json', `run.scene.${at} is not a range [low, high] from 0 to 1`);
          } else if (
            d &&
            typeof d === 'object' &&
            !Array.isArray(d) &&
            v &&
            typeof v === 'object' &&
            !Array.isArray(v) &&
            !path
          )
            walk(v, d, at);
          else problem('rules.json', `run.scene.${at}: not a dial a run varies (logic/mapgen.js MAPGEN_DEFAULTS)`);
        }
      };
    if (!SC || typeof SC !== 'object' || Array.isArray(SC)) problem('rules.json', 'run.scene missing');
    else walk(SC, MAPGEN_DEFAULTS, '');
    const W = R.wild,
      whole = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
    if (
      !W ||
      typeof W !== 'object' ||
      !Array.isArray(W.lv) ||
      W.lv.length !== 2 ||
      !whole(W.lv[0], 1, 100) ||
      !whole(W.lv[1], W.lv[0], 100) ||
      !whole(W.perRow, 0, 20) ||
      !whole(W.back, 0, 20)
    )
      problem('rules.json', 'run.wild: lv [low, high] (1-100), perRow (0-20) and back (0-20) are not whole numbers');
    else
      for (const k of Object.keys(W))
        if (!['lv', 'perRow', 'back'].includes(k)) problem('rules.json', `run.wild.${k}: no such rule`);
    if (!whole(R.seamIn, 1, 30)) problem('rules.json', 'run.seamIn is not a whole number of metres from 1 to 30');
  }
  return out;
}
// RL-8: the run loop's numbers (placeholders): what a run starts with (money, known pyramids and items, whole counts), a
// run town's heal price per hurt Billie, its shop (wares that exist: an item id or coin:<id>; `more` drawn by weight
// from `pick`, with something to pick when more is above 0), a mini-boss's and the boss's levels over their row and
// their reward; nothing else in each
/** RL-8: rules.json run.start, home, pack, healCost, shop, foes @param {any} D @returns {DataProblem[]} */
export function dataRunLoop(D) {
  /** @type {DataProblem[]} */
  const out = [],
    problem = (/** @type {string} */ where, /** @type {string} */ what) => out.push([where, what]);
  {
    const R = (D.rules && D.rules.run) || {},
      whole = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi,
      rec = v => !!v && typeof v === 'object' && !Array.isArray(v),
      only = (o, keys, at) => {
        for (const k of Object.keys(o)) if (!keys.includes(k)) problem('rules.json', `${at}.${k}: no such rule`);
      },
      ware = w =>
        typeof w === 'string' && (w.startsWith('coin:') ? !!(D.pyramids || {})[w.slice(5)] : !!(D.items || {})[w]),
      ST = R.start,
      SH = R.shop,
      F = R.foes;
    if (!rec(ST) || !whole(ST.se, 0, 1e6) || !rec(ST.pyramids) || !rec(ST.items))
      problem('rules.json', 'run.start: se (whole, 0-1,000,000), pyramids and items (records) are needed');
    else {
      only(ST, ['se', 'pyramids', 'items'], 'run.start');
      for (const [k, n] of Object.entries(ST.pyramids))
        if (!(D.pyramids || {})[k] || !whole(n, 0, 999))
          problem('rules.json', `run.start.pyramids.${k}: no such coin, or not a whole count`);
      for (const [k, n] of Object.entries(ST.items))
        if (!(D.items || {})[k] || !whole(n, 0, 999))
          problem('rules.json', `run.start.items.${k}: no such item, or not a whole count`);
    }
    // RL-9b: by Expedition (index 0 = Expedition I; past the end, the last): Billies from home a run takes (1-6, never fewer
    // than the Expedition before) and the things packed from Copperleaf's bag (0-99 items and pyramids in all)
    for (const [k, lo, hi, what] of [
      ['home', 1, 6, 'Billies from home'],
      ['pack', 0, 99, 'things packed'],
    ]) {
      const L = R[k];
      if (
        !Array.isArray(L) ||
        L.length < 1 ||
        L.length > 9 ||
        !L.every((n, i) => whole(n, lo, hi) && (!i || n >= L[i - 1]))
      )
        problem(
          'rules.json',
          `run.${k} is not a list of 1-9 whole numbers (${what}, ${lo}-${hi}), one a Expedition, none fewer than the one before`
        );
    }
    if (!whole(R.healCost, 0, 100000))
      problem('rules.json', 'run.healCost is not a whole number of Moneys (0-100,000)');
    if (!rec(SH) || !Array.isArray(SH.always) || !whole(SH.more, 0, 12) || !rec(SH.pick))
      problem('rules.json', 'run.shop: always (a list), more (whole, 0-12) and pick (weights) are needed');
    else {
      only(SH, ['always', 'more', 'pick'], 'run.shop');
      for (const w of SH.always) if (!ware(w)) problem('rules.json', `run.shop.always: no such ware "${w}"`);
      for (const [w, n] of Object.entries(SH.pick)) {
        if (!ware(w)) problem('rules.json', `run.shop.pick: no such ware "${w}"`);
        if (typeof n !== 'number' || !(n >= 0))
          problem('rules.json', `run.shop.pick.${w} is not a weight of 0 or more`);
      }
      if (SH.more > 0 && !Object.values(SH.pick).some(n => n > 0))
        problem('rules.json', 'run.shop.pick has nothing to pick');
    }
    if (!rec(F)) problem('rules.json', 'run.foes missing');
    else {
      only(F, ['miniboss', 'boss'], 'run.foes');
      for (const k of ['miniboss', 'boss']) {
        const f = F[k];
        if (!rec(f) || !whole(f.up, -20, 50) || !whole(f.reward, 0, 1e6))
          problem('rules.json', `run.foes.${k}: up (whole, -20-50) and reward (whole Moneys, 0-1,000,000) are needed`);
        else only(f, ['up', 'reward'], `run.foes.${k}`);
      }
    }
    /* RL-12b: route trainers (how many a route, levels up, what they pay, how far they see) and the reward pick */
    const TR = R.trainers,
      RW = R.rewards;
    if (!rec(TR)) problem('rules.json', 'run.trainers missing');
    else {
      only(TR, ['perRoute', 'up', 'reward', 'sight'], 'run.trainers');
      if (
        !Array.isArray(TR.perRoute) ||
        TR.perRoute.length !== 2 ||
        !whole(TR.perRoute[0], 0, 4) ||
        !whole(TR.perRoute[1], TR.perRoute[0], 4)
      )
        problem('rules.json', 'run.trainers.perRoute: [fewest, most], whole, 0-4');
      if (!whole(TR.up, -20, 20)) problem('rules.json', 'run.trainers.up: whole, -20-20');
      if (!whole(TR.reward, 0, 1e6)) problem('rules.json', 'run.trainers.reward: whole Moneys, 0-1,000,000');
      if (!(typeof TR.sight === 'number' && TR.sight >= 1 && TR.sight <= 20))
        problem('rules.json', 'run.trainers.sight: 1-20 m');
    }
    if (!rec(RW)) problem('rules.json', 'run.rewards missing');
    else {
      only(RW, ['pick', 'reroll', 'grow'], 'run.rewards');
      if (!whole(RW.pick, 1, 5)) problem('rules.json', 'run.rewards.pick: whole, 1-5 cards');
      if (!whole(RW.reroll, 0, 1e5)) problem('rules.json', 'run.rewards.reroll: whole Moneys, 0-100,000');
      if (!(typeof RW.grow === 'number' && RW.grow >= 1 && RW.grow <= 10))
        problem('rules.json', 'run.rewards.grow: 1-10');
    }
  }
  return out;
}
// phase 17: robot parts and gems: the schema, then the moves and types they name and the slot each part fits
/** phase 17: robots.json @param {any} D @param {DataValid} [valid] @returns {DataProblem[]} */
export function dataRobots(D, valid = () => true) {
  /** @type {DataProblem[]} */
  const out = [],
    problem = (/** @type {string} */ where, /** @type {string} */ what) => out.push([where, what]);
  const moves = D.moves || {},
    robots = D.robots || { parts: {}, gems: {} },
    types = new Set([...(D.types || []).map(t => t.id), 'None']);
  if (D.robots) valid('robots.schema.json', D.robots, 'robots.json');
  else problem('robots.json', 'missing');
  for (const [id, P] of Object.entries(robots.parts || {})) {
    if (!types.has(P.type)) problem('robots.json', `part ${id} is type ${P.type}, no such type`);
    if (P.slot !== 'torso' && !moves[P.move]) problem('robots.json', `part ${id} gives ${P.move}, no such move`);
    if (P.slot === 'legs' && !(P.carry > 0)) problem('robots.json', `legs ${id} carry nothing (carry)`);
    // studio track ST-5: stored joints belong to a picture in that view; only a torso has sockets and a head
    const A = P.art || {};
    for (const [key, pics] of /** @type {[string, Record<string, unknown>][]} */ ([
      ['joints', { front: A.img, back: A.imgB }],
      ['headJoints', { front: A.head, back: A.headB }],
    ]))
      for (const [view, J] of Object.entries(A[key] || {})) {
        if (!pics[view]) problem('robots.json', `part ${id} has ${key}.${view} but no ${view} picture`);
        if (J.sockets && (P.slot !== 'torso' || key === 'headJoints'))
          problem('robots.json', `part ${id} ${key}.${view} has sockets; only a torso has sockets`);
      }
    if (P.slot !== 'torso' && (A.headJoints || A.headTurn))
      problem('robots.json', `part ${id} is not a torso but has a head`);
  }
  for (const [id, G] of Object.entries(robots.gems || {})) {
    if (!types.has(G.type)) problem('robots.json', `gem ${id} is type ${G.type}, no such type`);
    if (!moves[G.move]) problem('robots.json', `gem ${id} gives ${G.move}, no such move`);
  }
  return out;
}
// UI-1: the UI's look: the schema, then the colours read on the ground and on a solid surface (UI-3: text and quiet
// text at 4.5:1, danger and primary at 3:1) in the defaults, every preset and every screen's override, both sides
// (logic/ui-theme.js uiThemeContrast, which the Studio's Check uses too)
/** UI-1: uiTheme.json @param {any} D @param {DataValid} [valid] @returns {DataProblem[]} */
export function dataUiTheme(D, valid = () => true) {
  /** @type {DataProblem[]} */
  const out = [],
    problem = (/** @type {string} */ where, /** @type {string} */ what) => out.push([where, what]);
  if (D.uiTheme && valid('uiTheme.schema.json', D.uiTheme, 'uiTheme.json'))
    for (const f of uiThemeContrast(D.uiTheme))
      problem(
        'uiTheme.json',
        `${f.where || 'defaults'} ${f.side}: ${f.fg} on ${f.bg} reads at ${f.ratio.toFixed(2)}:1, under ${f.min}`
      );
  return out;
}
// map generator MG-1: the biome recipes: the schema, then the ground letters, prop kinds and life they name
/** MG-1: biomes.json @param {any} D @param {DataValid} [valid] @returns {DataProblem[]} */
export function dataBiomes(D, valid = () => true) {
  /** @type {DataProblem[]} */
  const out = [],
    problem = (/** @type {string} */ where, /** @type {string} */ what) => out.push([where, what]);
  if (D.biomes && valid('biomes.schema.json', D.biomes, 'biomes.json')) {
    const terr = (D.scenery && D.scenery.terrains) || {},
      props = (D.scenery && D.scenery.props) || {},
      life = (D.scenery && D.scenery.life) || {};
    for (const [b, B] of Object.entries(D.biomes)) {
      const G = B.ground;
      // RL-6: the weather it gets outdoors (none is for rooms)
      if (!Object.hasOwn(CLIMATE_WEATHER_ODDS, B.climate) || B.climate === 'none')
        problem('biomes.json', `${b}.climate: "${B.climate}" is not an outdoor climate (logic/weather.js)`);
      // RL-7: a run node's Billies, battle stage and colour grade
      if (!(D.pools || {})[B.pool]) problem('biomes.json', `${b}.pool: no pool "${B.pool}" (pools.json)`);
      if (!(D.battleStages || {})[B.battleStage])
        problem('biomes.json', `${b}.battleStage: no stage "${B.battleStage}" (battleStages.json)`);
      if (!(D.moods || {})[B.mood]) problem('biomes.json', `${b}.mood: no mood "${B.mood}" (moods.json)`);
      for (const [f, ch] of [...Object.entries(G).filter(([f]) => f !== 'patches'), ['road', B.road]])
        if (!terr[ch]) problem('biomes.json', `${b}.${f}: no terrain "${ch}" (scenery.json terrains)`);
      for (const ch of Object.keys(G.patches || {}))
        if (!terr[ch]) problem('biomes.json', `${b}.ground.patches: no terrain "${ch}"`);
      for (const pool of ['trees', 'shrubs', 'plants', 'rocks', 'waterPlants', 'tall'])
        for (const k of Object.keys(B[pool] || {})) if (!props[k]) problem('biomes.json', `${b}.${pool}: no prop ${k}`);
      for (const L of B.life || []) if (!life[L.k]) problem('biomes.json', `${b}.life: no animal ${L.k}`);
    }
  }
  return out;
}
// RL-R1: what a run's region is made from: the schema; biomes that exist and are run biomes (rules.json run.map.biomes:
// the ones with finished plants, roguelite-track 9.3); real types; ranges low to high; every mini-boss leader with a
// type; then a sweep: on a fresh save's biomes and on all of them, at every Expedition, each seed makes a region whose
// rows fit the map's mini-bosses, whose dex is real species within its size, with a leader for each mini-boss and the boss
/** RL-R1: regions.json @param {any} D @param {DataValid} [valid] @returns {DataProblem[]} */
export function dataRegions(D, valid = () => true) {
  /** @type {DataProblem[]} */
  const out = [],
    problem = (/** @type {string} */ where, /** @type {string} */ what) => out.push([where, what]);
  if (!D.regions || !valid('regions.schema.json', D.regions, 'regions.json')) return out;
  const R = D.regions,
    M = (D.rules && D.rules.run && D.rules.run.map) || {},
    runBiomes = M.biomes || {},
    types = new Set((D.types || []).map((/** @type {any} */ t) => t.id)),
    biome = (/** @type {string} */ b, /** @type {string} */ at) => {
      if (!(D.biomes || {})[b]) problem('regions.json', `${at}: no biome "${b}" (biomes.json)`);
      else if (!Object.hasOwn(runBiomes, b))
        problem('regions.json', `${at}: "${b}" is not a run biome (rules.json run.map.biomes, the finished ones)`);
    };
  for (const [b, G] of Object.entries(R.graph)) {
    biome(b, 'graph');
    for (const to of Object.keys(/** @type {any} */ (G))) biome(to, `graph.${b}`);
  }
  for (const [k, T] of Object.entries(R.themes)) {
    for (const f of ['start', 'biomes'])
      for (const b of Object.keys(T[f])) {
        biome(b, `themes.${k}.${f}`);
        if (!R.graph[b]) problem('regions.json', `themes.${k}.${f}: "${b}" is not in the graph`);
      }
    for (const t of Object.keys(T.types))
      if (!types.has(t)) problem('regions.json', `themes.${k}.types: no type "${t}"`);
  }
  for (const f of ['rows', 'dex'])
    if (R[f][0] > R[f][1]) problem('regions.json', `${f}: the fewest (${R[f][0]}) is more than the most (${R[f][1]})`);
  for (const [id, T] of Object.entries(D.trainers || {}))
    if (T && T.miniboss) {
      if (!T.type)
        problem(`trainers/${id}.json`, 'a mini-boss leader needs a type (RL-R1: a region picks its leaders by type)');
      else if (!types.has(T.type)) problem(`trainers/${id}.json`, `type: no type "${T.type}"`);
    }
  if (out.length || !Array.isArray(D.lines)) return out;
  /* the sweep: the biomes a fresh save has (none an unlock grants) and every run biome */
  const granted = new Set(Object.values(D.unlocks || {}).map((/** @type {any} */ u) => u.grant && u.grant.biome)),
    every = Object.keys(runBiomes).filter(b => runBiomes[b] > 0),
    data = runRegionData(D, D.trainers || {}),
    species = new Set(D.lines.flatMap((/** @type {any} */ L) => lineSpeciesIds(L))),
    roster = D.lines.reduce((/** @type {number} */ n, /** @type {any} */ L) => n + L.names.length, 0),
    seen = new Set();
  for (const [what, open] of [
    ['a fresh save', every.filter(b => !granted.has(b))],
    ['every run biome', every],
  ])
    for (let expedition = 1; expedition <= R.zones.length; expedition++)
      for (let k = 0; k < 40; k++) {
        const seed = `REGIONCHECK${k}`,
          note = (/** @type {string} */ text) => {
            if (seen.has(text)) return;
            seen.add(text);
            problem('regions.json', `${text} (${what}, Expedition ${expedition}, seed ${seed})`);
          },
          G = runRegionMake(seed, data, {
            open: /** @type {string[]} */ (open),
            expedition,
            guards: M.minibosses || 0,
          });
        if (!G) {
          note(`no theme can roll with only ${/** @type {string[]} */ (open).join(', ')} open`);
          continue;
        }
        const rows = G.zones.reduce((n, z) => n + z.rows, 0);
        if (!runMapRowsFit({ ...M, rows }))
          note(`${rows} rows (${G.zones.length} zones) can't hold ${M.minibosses} mini-bosses`);
        if (G.dex.some(sp => !species.has(sp))) note(`the dex names a species no line makes`);
        if (G.dex.length > R.dex[1] || (G.dex.length < R.dex[0] && roster >= R.dex[0]))
          note(`a dex of ${G.dex.length} species, not ${R.dex[0]}-${R.dex[1]}`);
        if (G.leaders.length !== (M.minibosses || 0) + 1) note('a leader short for its mini-bosses and boss');
      }
  return out;
}
// RL-6: the kinds of node on a run's map: the schema, a marker for each, and something to fill the free rows with
/** RL-6: nodeTypes.json @param {any} D @param {DataValid} [valid] @returns {DataProblem[]} */
export function dataNodeTypes(D, valid = () => true) {
  /** @type {DataProblem[]} */
  const out = [],
    problem = (/** @type {string} */ where, /** @type {string} */ what) => out.push([where, what]);
  if (D.nodeTypes && valid('nodeTypes.schema.json', D.nodeTypes, 'nodeTypes.json')) {
    for (const [k, T] of Object.entries(D.nodeTypes)) {
      const mark = T.mark || k;
      if (!RUN_MARK_TYPES.includes(mark) || mark === 'unknown')
        problem(
          'nodeTypes.json',
          `${k}: no marker "${mark}" (logic/run-marks.js: ${RUN_MARK_TYPES.filter(t => t !== 'unknown').join(', ')})`
        );
    }
    if (!Object.values(D.nodeTypes).some(T => (T.weight || 0) > 0))
      problem('nodeTypes.json', 'no type has a weight, so nothing can fill a free row of the run map');
  }
  return out;
}
// RL-R2: field moves (fieldMoves.json): the schema, a real type and a run biome each; rules.json run.side: the chances
// of a detour and of an alternate path (each 0-1, together at most 1), a detour's places [2-6], an alternate path's
// rows [2-6] and the chance it ends at a boss of its own, a weight of 0 or more for moves that exist (one above 0), and
// the lean (0-10) toward a move of the region's types
/** RL-R2: fieldMoves.json and rules.json run.side @param {any} D @param {DataValid} [valid] @returns {DataProblem[]} */
export function dataFieldMoves(D, valid = () => true) {
  /** @type {DataProblem[]} */
  const out = [],
    problem = (/** @type {string} */ where, /** @type {string} */ what) => out.push([where, what]),
    FM = D.fieldMoves,
    moves = FM && FM.moves ? FM.moves : {},
    types = new Set((D.types || []).map((/** @type {any} */ t) => t.id)),
    runBiomes = (D.rules && D.rules.run && D.rules.run.map && D.rules.run.map.biomes) || {};
  if (FM && valid('fieldMoves.schema.json', FM, 'fieldMoves.json'))
    for (const [k, M] of Object.entries(moves)) {
      if (!types.has(M.type)) problem('fieldMoves.json', `moves.${k}: no type "${M.type}" (types.json)`);
      if (!(D.biomes || {})[M.biome]) problem('fieldMoves.json', `moves.${k}: no biome "${M.biome}" (biomes.json)`);
      else if (!runBiomes[M.biome])
        problem('fieldMoves.json', `moves.${k}: "${M.biome}" is not a run biome (rules.json run.map.biomes)`);
    }
  const S = D.rules && D.rules.run && D.rules.run.side;
  if (!S) return out;
  const chance = (/** @type {any} */ v) => typeof v === 'number' && v >= 0 && v <= 1,
    span = (/** @type {any} */ v) =>
      Array.isArray(v) && v.length === 2 && v.every(n => Number.isInteger(n) && n >= 2 && n <= 6) && v[0] <= v[1];
  for (const k of Object.keys(S))
    if (!['detour', 'alt', 'places', 'altRows', 'altBoss', 'moves', 'lean'].includes(k))
      problem('rules.json', `run.side.${k}: no such rule`);
  if (!chance(S.detour) || !chance(S.alt) || !chance(S.altBoss) || S.detour + S.alt > 1)
    problem(
      'rules.json',
      'run.side: detour, alt and altBoss are not chances from 0 to 1 (detour and alt at most 1 together)'
    );
  if (!span(S.places)) problem('rules.json', 'run.side.places is not [fewest, most] whole places from 2 to 6');
  if (!span(S.altRows)) problem('rules.json', 'run.side.altRows is not [fewest, most] whole rows from 2 to 6');
  if (!(typeof S.lean === 'number' && S.lean >= 0 && S.lean <= 10))
    problem('rules.json', 'run.side.lean is not a number from 0 to 10');
  const W = S.moves && typeof S.moves === 'object' ? S.moves : {};
  for (const [k, w] of Object.entries(W)) {
    if (!moves[k]) problem('rules.json', `run.side.moves: no field move "${k}" (fieldMoves.json)`);
    if (!(typeof w === 'number' && w >= 0)) problem('rules.json', `run.side.moves.${k} is not a weight of 0 or more`);
  }
  if (!Object.values(W).some(w => typeof w === 'number' && w > 0))
    problem('rules.json', 'run.side.moves: no move has a weight, so no side area can be made');
  return out;
}
// RL-12b: events.json: the schema; every intro reads as lines only, every option's need as a condition and its `then`
// as a script; what they name is there (items, pyramids, loot tables, classes, types, statuses, Perks, biomes, people)
// and the event commands' arguments make sense
/** RL-12b: events.json @param {any} D @param {DataValid} [valid] @returns {DataProblem[]} */
export function dataEvents(D, valid = () => true) {
  /** @type {DataProblem[]} */
  const out = [],
    problem = (/** @type {string} */ what) => out.push(['events.json', what]),
    E = D.events;
  if (!E) return [['events.json', 'missing']];
  if (!valid('events.schema.json', E, 'events.json')) return out;
  const items = D.items || {},
    pyramids = D.pyramids || {},
    perks = D.perks || {},
    types = new Set((D.types || []).map((/** @type {any} */ t) => t.id)),
    stats = new Set((D.stats || []).map((/** @type {any} */ t) => t.id)),
    statuses = new Set((D.statuses || []).map((/** @type {any} */ t) => t.id)),
    biomes = new Set(Object.keys(D.biomes || {})),
    people = new Set(
      Array.isArray(D.people) ? D.people.map((/** @type {any} */ x) => x.id) : Object.keys(D.people || {})
    ),
    num = (/** @type {string | undefined} */ v) => (v != null && /^-?\d+(\.\d+)?$/.test(v) ? +v : NaN),
    thing = (/** @type {string} */ v) => (v.startsWith('coin:') ? !!pyramids[v.slice(5)] : !!items[v]);
  for (const [t, L] of Object.entries(E.loot))
    for (const k of Object.keys(/** @type {any} */ (L)))
      if (!items[k]) problem(`loot.${t}: no item "${k}" (items.json)`);
  for (const [k, C] of Object.entries(E.classes)) {
    const c = /** @type {any} */ (C);
    if (people.size && !people.has(c.who)) problem(`classes.${k}.who: no person "${c.who}" (people/)`);
    if (c.team[0] > c.team[1]) problem(`classes.${k}.team: the fewest is more than the most`);
  }
  /** @param {any[]} nodes @param {(n: any) => void} f */
  const walk = (nodes, f) => {
    for (const n of nodes) {
      f(n);
      if (n.k === 'choice') n.options.forEach((/** @type {any} */ o) => walk(o.body, f));
      else if (n.k === 'if') n.clauses.forEach((/** @type {any} */ c) => walk(c.body, f));
      else if (n.k === 'once') walk(n.body, f);
      else if (n.k === 'cycle' || n.k === 'seq') n.entries.forEach((/** @type {any} */ e) => walk(e, f));
    }
  };
  /** what a condition names that isn't there @param {string} where @param {string} cond */
  const names = (where, cond) => {
    const N = conditionNames(conditionTree(cond));
    for (const id of N.item || []) if (!items[id]) problem(`${where}: no item "${id}" (items.json)`);
    for (const id of [...(N.type || []), ...(N.badge || [])])
      if (types.size && !types.has(id)) problem(`${where}: no type "${id}" (types.json)`);
  };
  /** @param {string} where @param {any} n a command */
  const command = (where, n) => {
    const [a, b] = n.args,
      at = `${where}: "${n.name}${n.args.length ? ' ' + n.args.join(' ') : ''}"`;
    switch (n.name) {
      case 'give':
      case 'take':
        if (!thing(a)) problem(`${at}: no item or pyramid "${a}"`);
        if (b != null && !(Number.isInteger(num(b)) && num(b) >= 1 && num(b) <= 99)) problem(`${at}: a count of 1-99`);
        return;
      case 'loot':
        if (!E.loot[a]) problem(`${at}: no loot table "${a}"`);
        return;
      case 'foe':
        if (!E.classes[a]) problem(`${at}: no class "${a}"`);
        if (b != null && !(Number.isInteger(num(b)) && Math.abs(num(b)) <= 20))
          problem(`${at}: levels up of -20 to 20`);
        return;
      case 'wild':
      case 'recall':
        if (a != null && !(Number.isInteger(num(a)) && Math.abs(num(a)) <= 20))
          problem(`${at}: levels up of -20 to 20`);
        return;
      case 'level':
        if (!(Number.isInteger(num(a)) && num(a) !== 0 && Math.abs(num(a)) <= 10))
          problem(`${at}: -10 to 10 levels, not 0`);
        return;
      case 'perk':
        if (a != null && !['common', 'uncommon', 'rare'].includes(a) && !perks[a])
          problem(`${at}: not a rarity (common, uncommon, rare) or a Perk (perks.json)`);
        return;
      case 'status':
        if (statuses.size && !statuses.has(a)) problem(`${at}: no status "${a}" (statuses.json)`);
        return;
      case 'hurt':
      case 'heal':
        if (a != null && !(num(a) > 0 && num(a) <= 1)) problem(`${at}: a share above 0, at most 1`);
        return;
      case 'wager':
        if (!(num(a) >= 1 && num(a) <= 99)) problem(`${at}: a chance of 1-99 percent`);
        return;
      case 'money':
        if (!(Number.isInteger(num(a)) && num(a) !== 0)) problem(`${at}: a whole number of Moneys, not 0`);
        return;
      case 'reward':
        if (a != null && !['item', 'tutor', 'candy', 'evo'].includes(a))
          problem(`${at}: a kind (item, tutor, candy, evo)`);
        if (b != null && !(Number.isInteger(num(b)) && num(b) >= 1 && num(b) <= 5)) problem(`${at}: 1-5 cards`);
        return;
      case 'fx': {
        const places = num(a),
          row = fxRowOf(n.args.slice(1));
        if (!(Number.isInteger(places) && places >= 0 && places <= 20)) problem(`${at}: 0-20 more places`);
        if (!FX_KINDS.includes(/** @type {any} */ (row.kind))) problem(`${at}: no effect kind "${row.kind}"`);
        if ('mult' in row && !(typeof row.mult === 'number' && row.mult >= FX_LIMIT.lo && row.mult <= FX_LIMIT.hi))
          problem(`${at}: mult outside ${FX_LIMIT.lo} to ${FX_LIMIT.hi}`);
        if (row.kind === 'stat' && (!stats.has(row.stat) || row.stat === 'hp' || !Number.isInteger(row.stages)))
          problem(`${at}: a stat (stats.json, not hp) and whole stages`);
        if (row.kind === 'price' && !['shop', 'heal'].includes(/** @type {any} */ (row.what)))
          problem(`${at}: price what=shop or what=heal`);
        if (row.kind === 'heal' && !(typeof row.share === 'number' && row.share > 0 && row.share <= 1))
          problem(`${at}: heal share above 0, at most 1`);
        return;
      }
    }
  };
  for (const [k, V] of Object.entries(E.events)) {
    const ev = /** @type {any} */ (V);
    for (const b of ev.biomes || []) if (biomes.size && !biomes.has(b)) problem(`events.${k}.biomes: no biome "${b}"`);
    const ip = scriptProblem(ev.intro);
    if (ip) problem(`events.${k}.intro, line ${(ip.line || 0) + 1}: ${ip.message}`);
    else
      walk(
        parseScript(ev.intro),
        n => n.k !== 'say' && problem(`events.${k}.intro: lines only, no "${n.name || n.k}"`)
      );
    ev.options.forEach((/** @type {any} */ o, i) => {
      const where = `events.${k}.options[${i}]`;
      if (o.need) {
        const cp = conditionProblem(o.need);
        if (cp) problem(`${where}.need: ${cp.message}`);
        else names(`${where}.need`, o.need);
      }
      const sp = scriptProblem(o.then);
      if (sp) {
        problem(`${where}.then, line ${(sp.line || 0) + 1}: ${sp.message}`);
        return;
      }
      walk(parseScript(o.then), n => {
        if (n.k === 'cmd') command(`${where}.then`, n);
        else if (n.k === 'if') n.clauses.forEach((/** @type {any} */ c) => c.cond && names(`${where}.then`, c.cond));
      });
    });
  }
  return out;
}

// RL-12b: rewards.json: the schema; every item and pyramid there, a candy a level item, an evolution item one, held
// cards switched off until RL-12c, and something to offer
/** RL-12b: rewards.json @param {any} D @param {DataValid} [valid] @returns {DataProblem[]} */
export function dataRewards(D, valid = () => true) {
  /** @type {DataProblem[]} */
  const out = [],
    problem = (/** @type {string} */ what) => out.push(['rewards.json', what]),
    R = D.rewards;
  if (!R) return [['rewards.json', 'missing']];
  if (!valid('rewards.schema.json', R, 'rewards.json')) return out;
  const items = D.items || {},
    pyramids = D.pyramids || {};
  for (const [k, c] of Object.entries(R)) {
    const r = /** @type {any} */ (c);
    if (r.item && !items[r.item]) problem(`${k}.item: no item "${r.item}" (items.json)`);
    if (r.pyramid && !pyramids[r.pyramid]) problem(`${k}.pyramid: no pyramid "${r.pyramid}" (pyramids.json)`);
    if ((r.kind === 'item' || r.kind === 'candy' || r.kind === 'evo') && !r.item === !r.pyramid)
      problem(`${k}: an item or a pyramid, one of them`);
    if ((r.kind === 'candy' || r.kind === 'evo') && r.pyramid) problem(`${k}: a ${r.kind} is an item, not a pyramid`);
    if (r.kind === 'candy' && r.item && items[r.item] && !items[r.item].lvlUp)
      problem(`${k}: a candy's item gives levels (lvlUp in items.json)`);
    if (r.kind === 'evo' && r.item && items[r.item] && !items[r.item].evoItem)
      problem(`${k}: an evolution item's item is one (evoItem in items.json)`);
    if (r.kind === 'tutor' && (r.item || r.pyramid || r.n)) problem(`${k}: a tutor card names no item`);
    if (r.kind === 'held' && r.weight > 0) problem(`${k}: held items come with RL-12c; keep its weight 0`);
  }
  if (!Object.values(R).some((/** @type {any} */ r) => r.kind === 'item' && r.weight > 0))
    problem('no item card with a weight above 0: a pick could be empty');
  return out;
}

// RL-12: Perks (relics): the schema, the types their damage rows name; rules.json run.perks: a cap of 1-12 held, a
// pick of 1-5 (run.offer holds up to 5), a weight of 0 or more and a whole price ($0-100,000) for each rarity, and
// something to offer
/** RL-12: perks.json and rules.json run.perks @param {any} D @param {DataValid} [valid] @returns {DataProblem[]} */
export function dataPerks(D, valid = () => true) {
  /** @type {DataProblem[]} */
  const out = [],
    problem = (/** @type {string} */ where, /** @type {string} */ what) => out.push([where, what]);
  {
    const RR = D.rules && D.rules.run && D.rules.run.perks,
      RARITIES = ['common', 'uncommon', 'rare'],
      whole = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi,
      types = new Set((D.types || []).map(t => t.id)),
      stats = new Set((D.stats || []).map(t => t.id));
    if (D.perks && valid('perks.schema.json', D.perks, 'perks.json'))
      for (const [k, R] of Object.entries(D.perks))
        R.fx.forEach((f, n) => {
          if (f.type && !types.has(f.type))
            problem('perks.json', `${k}.fx[${n}].type: no type "${f.type}" (types.json)`);
          // Studio plan T4.1: the limits that live in the code (effects.js): a factor within FX_LIMIT, stages within
          // FX_STAGES (the schema allows 0-4 and -6 to 6; a factor under FX_LIMIT.lo would be clamped up)
          if ('mult' in f && !(typeof f.mult === 'number' && f.mult >= FX_LIMIT.lo && f.mult <= FX_LIMIT.hi))
            problem(
              'perks.json',
              `${k}.fx[${n}].mult: ${f.mult} is outside the code's limits, ${FX_LIMIT.lo} to ${FX_LIMIT.hi} (effects.js FX_LIMIT)`
            );
          if ('stages' in f && !(Number.isInteger(f.stages) && Math.abs(f.stages) <= FX_STAGES))
            problem(
              'perks.json',
              `${k}.fx[${n}].stages: ${f.stages} is not a whole number of stages from -${FX_STAGES} to ${FX_STAGES} (effects.js FX_STAGES)`
            );
          /* T1.3: the stats from stats.json (a stage of HP means nothing), not a list in the schema */
          if (f.kind === 'stat' && (f.stat === 'hp' || !stats.has(f.stat)))
            problem('perks.json', `${k}.fx[${n}].stat: no stat "${f.stat}" a stage can raise (stats.json, not hp)`);
        });
    if (!RR || typeof RR !== 'object' || Array.isArray(RR)) problem('rules.json', 'run.perks missing');
    else {
      for (const k of Object.keys(RR))
        if (!['cap', 'pick', 'rarity', 'price'].includes(k)) problem('rules.json', `run.perks.${k}: no such rule`);
      if (!whole(RR.cap, 1, 12)) problem('rules.json', 'run.perks.cap is not a whole number from 1 to 12');
      if (!whole(RR.pick, 1, 5)) problem('rules.json', 'run.perks.pick is not a whole number from 1 to 5');
      for (const g of ['rarity', 'price']) {
        const G = RR[g] && typeof RR[g] === 'object' ? RR[g] : {};
        for (const k of Object.keys(G))
          if (!RARITIES.includes(k)) problem('rules.json', `run.perks.${g}.${k}: no such rarity`);
        for (const r of RARITIES)
          if (g === 'rarity' ? !(typeof G[r] === 'number' && G[r] >= 0) : !whole(G[r], 0, 100000))
            problem(
              'rules.json',
              `run.perks.${g}.${r} is not ${g === 'rarity' ? 'a weight of 0 or more' : 'a whole price (0-100,000 Moneys)'}`
            );
      }
      if (D.perks && !Object.values(D.perks).some(R => (RR.rarity || {})[R.rarity] > 0))
        problem('rules.json', 'run.perks.rarity gives every Perk in perks.json a weight of 0: nothing can be offered');
    }
  }
  return out;
}
// RF-2: every catch item (pyramids.json; the ids stay the pyramids' until RF-4) has its icons and the model it is thrown as
// (art/coins/<id>_16.png, _32.png and <id>.json, made by tools/build-pyramids.py): a recipe with at least one shape
/** RF-2: pyramids.json against its art @param {any} pyramids @param {(path: string) => string | null} read the file under
 * game/art, or null when it isn't there @returns {DataProblem[]} */
export function dataCatchArt(pyramids, read) {
  /** @type {DataProblem[]} */
  const out = [],
    problem = (/** @type {string} */ what) => out.push(['pyramids.json', what]);
  for (const k of Object.keys(pyramids || {})) {
    for (const f of [`coins/${k}_16.png`, `coins/${k}_32.png`])
      if (read(f) == null) problem(`${k}: no icon art/${f} (tools/build-pyramids.py)`);
    const t = read(`coins/${k}.json`);
    if (t == null) {
      problem(`${k}: no model art/coins/${k}.json (tools/build-pyramids.py)`);
      continue;
    }
    /** @type {any} */
    let rec = null;
    try {
      rec = JSON.parse(t);
    } catch (e) {
      problem(`${k}: its model art/coins/${k}.json is not JSON`);
      continue;
    }
    if (!rec || !Array.isArray(rec.layers) || !rec.layers.length)
      problem(`${k}: its model art/coins/${k}.json has no shapes`);
  }
  return out;
}
// RL-11: the four currencies (the schema refuses a fifth or a missing one); money is the run's, the others meta's,
// each read by its id from saveData.meta (logic/meta-state.js)
/** RL-11: currencies.json @param {any} D @param {DataValid} [valid] @returns {DataProblem[]} */
export function dataCurrencies(D, valid = () => true) {
  /** @type {DataProblem[]} */
  const out = [],
    problem = (/** @type {string} */ where, /** @type {string} */ what) => out.push([where, what]);
  if (D.currencies && valid('currencies.schema.json', D.currencies, 'currencies.json')) {
    for (const [k, C] of Object.entries(D.currencies))
      if ((C.kept === 'run') !== (k === 'money'))
        problem('currencies.json', `${k}.kept: ${k === 'money' ? "money is the run's" : 'kept between runs (meta)'}`);
  }
  return out;
}
// RL-11: the hub's buildings: a meta currency each, an act some Copperleaf prop has, and the ranch's levels within what
// rules.json ranch gives slots for
/** RL-11: buildings.json @param {any} D @param {DataValid} [valid] @returns {DataProblem[]} */
export function dataBuildings(D, valid = () => true) {
  /** @type {DataProblem[]} */
  const out = [],
    problem = (/** @type {string} */ where, /** @type {string} */ what) => out.push([where, what]);
  if (D.buildings && valid('buildings.schema.json', D.buildings, 'buildings.json')) {
    const hub = ((D.maps || {}).copperleaf || {}).props || [],
      slots = (((D.rules || {}).ranch || {}).slots || []).length;
    for (const [k, B] of Object.entries(D.buildings)) {
      if (D.currencies && !(D.currencies[B.currency] && D.currencies[B.currency].kept === 'meta'))
        problem(
          'buildings.json',
          `${k}.currency: "${B.currency}" is not a currency kept between runs (currencies.json)`
        );
      if (B.act && !hub.some(p => p.act === B.act))
        problem('buildings.json', `${k}.act: no prop in Copperleaf has act "${B.act}"`);
      if (B.soon && B.levels > 1)
        problem('buildings.json', `${k}: a building that is coming later has no levels to sell`);
    }
    if (D.buildings.ranch && slots && D.buildings.ranch.levels > slots)
      problem(
        'buildings.json',
        `ranch.levels: ${D.buildings.ranch.levels}, but rules.json ranch.slots has ${slots} levels`
      );
  }
  return out;
}
// RL-11: the unlock table: sold at a building that is built, or earned by a condition that reads and names real
// unlocks; what it needs exists and goes round in no circle; every building level above 1 sold once, at its own
// building, after the level below; a shop item or biome it opens is one the run's rules can draw, and the rules keep
// something always open (a biome; the shop's always-stocked wares are never locked)
/** RL-11: unlocks.json @param {any} D @param {DataValid} [valid] @returns {DataProblem[]} */
export function dataUnlocks(D, valid = () => true) {
  /** @type {DataProblem[]} */
  const out = [],
    problem = (/** @type {string} */ where, /** @type {string} */ what) => out.push([where, what]);
  if (D.unlocks && valid('unlocks.schema.json', D.unlocks, 'unlocks.json')) {
    const U = D.unlocks,
      B = D.buildings || {},
      run = (D.rules || {}).run || {},
      pick = (run.shop || {}).pick || {},
      always = (run.shop || {}).always || [],
      biomes = (run.map || {}).biomes || {},
      levelRow = {};
    for (const [k, R] of Object.entries(U)) {
      if (R.at && !B[R.at]) problem('unlocks.json', `${k}.at: no building "${R.at}" (buildings.json)`);
      else if (R.at && B[R.at].soon) problem('unlocks.json', `${k}.at: ${R.at} is coming later and sells nothing yet`);
      if (R.when) {
        const p = conditionProblem(R.when);
        if (p) problem('unlocks.json', `${k}.when: ${p.message}`);
        else
          for (const u of conditionNames(conditionTree(R.when)).unlock || [])
            if (!U[u]) problem('unlocks.json', `${k}.when: unlock:${u}, no such unlock`);
      }
      for (const r of R.requires || [])
        if (!U[r] || r === k) problem('unlocks.json', `${k}.requires: no unlock "${r}"`);
      const G = R.grant;
      if (G.building) {
        const b = B[G.building];
        if (!b) problem('unlocks.json', `${k}.grant.building: no building "${G.building}"`);
        else if (G.level > b.levels) problem('unlocks.json', `${k}.grant: ${G.building} goes up to level ${b.levels}`);
        else if (R.at !== G.building)
          problem('unlocks.json', `${k}: a level of ${G.building} is sold at ${G.building}`);
        const key = `${G.building}:${G.level}`;
        if (levelRow[key])
          problem('unlocks.json', `${k}: ${G.building} level ${G.level} is sold by ${levelRow[key]} already`);
        levelRow[key] = k;
      }
      if (G.shop && !(G.shop in pick))
        problem('unlocks.json', `${k}.grant.shop: "${G.shop}" is not in rules.json run.shop.pick`);
      if (G.shop && always.includes(G.shop))
        problem('unlocks.json', `${k}.grant.shop: "${G.shop}" is always stocked (run.shop.always)`);
      if (G.biome && !(G.biome in biomes))
        problem('unlocks.json', `${k}.grant.biome: "${G.biome}" is not in rules.json run.map.biomes`);
      /* T1.3: a currency it grants is one of currencies.json kept between runs (not a list in the schema) */
      for (const c of Object.keys(G))
        if (!['building', 'level', 'shop', 'biome'].includes(c) && D.currencies)
          if (!(D.currencies[c] && D.currencies[c].kept === 'meta'))
            problem('unlocks.json', `${k}.grant.${c}: "${c}" is not a currency kept between runs (currencies.json)`);
    }
    for (const [b, Bd] of Object.entries(B))
      for (let n = 2; n <= Bd.levels; n++) {
        const k = levelRow[`${b}:${n}`];
        if (!k) problem('unlocks.json', `no row sells ${b} level ${n} (buildings.json ${b}.levels ${Bd.levels})`);
        else if (n > 2 && !(U[k].requires || []).includes(levelRow[`${b}:${n - 1}`]))
          problem(
            'unlocks.json',
            `${k}: ${b} level ${n} requires the level below (${levelRow[`${b}:${n - 1}`] || 'none sold'})`
          );
      }
    const seen = {},
      loop = (k, path) => {
        if (seen[k] === 2 || !U[k]) return;
        if (seen[k] === 1)
          return problem('unlocks.json', `${k}.requires goes round in a circle: ${[...path, k].join(' -> ')}`);
        seen[k] = 1;
        for (const r of U[k].requires || []) loop(r, [...path, k]);
        seen[k] = 2;
      };
    for (const k of Object.keys(U)) loop(k, []);
    const locked = new Set(
      Object.values(U)
        .map(R => R.grant.biome)
        .filter(Boolean)
    );
    if (Object.keys(biomes).length && Object.keys(biomes).every(b => locked.has(b)))
      problem(
        'unlocks.json',
        "every biome of rules.json run.map.biomes is locked: a new player's run map would have none"
      );
  }
  return out;
}
/** phase 16 (Studio plan T1.3: one rule for check-data and the Studio): what a species id names: 'line' for a stage
 * of a loaded line, 'legacy' for one of a line parked in game/data/legacy (the game stands in a new line's Billie for
 * it), '' for nothing; RO-1: a loaded line's regional forms (logic/forms.js) count as its stages. A legacy line given
 * with its names has that many stages; given as an id alone (the Studio
 * reads only legacy/index.json), any stage counts
 * @param {{ id: string, names?: unknown[] }[]} lines @param {{ id: string, names?: unknown[] }[]} legacyLines
 * @returns {(sp: unknown) => 'line' | 'legacy' | ''} */
export function dataSpeciesKind(lines, legacyLines) {
  const stages = (/** @type {{ id: string, names?: unknown[] }[]} */ L) =>
      new Set(L.flatMap(l => (l.names || []).map((_, i) => l.id + i))),
    /* RO-1: and its regional forms' stages */
    here = new Set((lines || []).flatMap(l => lineSpeciesIds(/** @type {any} */ (l)))),
    parked = stages(legacyLines || []),
    anyStage = new Set((legacyLines || []).filter(l => !l.names).map(l => l.id));
  return sp => {
    if (typeof sp !== 'string') return '';
    if (here.has(sp)) return 'line';
    const m = sp.match(/^(.*?)(\d+)$/);
    return parked.has(sp) || (m && anyStage.has(m[1])) ? 'legacy' : '';
  };
}
// phase 17: a trainer's robot: a gem and a part that fits each of its four slots
export const ROBOT_FITS = { torso: 'torso', armL: 'arm', armR: 'arm', legs: 'legs' };
/** what is wrong with a team member's robot (trainers/<id>.json) @param {any} D @param {any} R @returns {string[]} */
export function dataRobotProblems(D, R) {
  const robots = D.robots || { parts: {}, gems: {} };
  if (!R) return ['is a robot with no parts (robot)'];
  const out = [];
  if (!(robots.gems || {})[R.gem]) out.push(`has robot gem ${R.gem}, no such gem`);
  for (const [k, slot] of Object.entries(ROBOT_FITS)) {
    const P = (robots.parts || {})[R[k]];
    if (!P) out.push(`has robot ${k} ${R[k]}, no such part`);
    else if (P.slot !== slot) out.push(`has ${R[k]} as ${k}, but it is a ${P.slot} part`);
  }
  return out;
}

/* ---------- Studio plan Phase 5 (T5.3): the rigs (art/next/rigs-next.js) hold together ---------- */
/**
 * Each species' rig, both views: every picture's box inside its sheet, the rig's `size` the sheet's (and the same in
 * both views when they share it), every bone's parent there and its picture one of the view's, the same bones front
 * and back, and `geo` as the builders made it (its cx, base and k the view's, mid and cy halfway from the top to the
 * ground line, the top inside the pictures' boxes as the skeleton builder frames them and above the ground).
 * `sheetSize(path)` is a sheet's [w, h] (null when it is not known: the boxes are then checked against `size`);
 * `geoOf(M, view)` the skeleton builder's framing (logic/rig-joints.js rigGeo at the neutral pose).
 * @param {Record<string, any>} rigs by species @param {(sheet: string) => [number, number] | null} sheetSize
 * @param {(M: any, view: string) => Record<string, number> | null} geoOf @returns {DataProblem[]}
 */
export function dataRigs(rigs, sheetSize, geoOf) {
  /** @type {DataProblem[]} */
  const out = [];
  for (const [sp, R] of Object.entries(rigs || {})) {
    if (!R || typeof R !== 'object') continue;
    const views = ['front', 'back'].filter(v => R[v]),
      file = views.some(v => String(R[v].sheet || '').startsWith('next/')) ? 'art/next/rigs-next.js' : 'art/rigs.js',
      bad = (/** @type {string} */ msg) => out.push([file, `${sp} ${msg}`]);
    if (!views.length) continue;
    if (views.length === 2) {
      const names = (/** @type {any} */ M) =>
        M.bones
          .map((/** @type {any} */ b) => b.n)
          .sort()
          .join(', ');
      if (names(R.front) !== names(R.back))
        bad(`front and back have different bones (front ${names(R.front)}; back ${names(R.back)})`);
      if (R.front.sheet === R.back.sheet && String(R.front.size) !== String(R.back.size))
        bad(`size is ${R.front.size} in front and ${R.back.size} in back, on one sheet`);
    }
    for (const view of views) {
      const M = R[view],
        at = `${view}:`,
        known = M.sheet ? sheetSize(M.sheet) : null,
        [W, H] = known || M.size || [0, 0];
      if (known && String(M.size) !== String(known))
        bad(`${at} size ${M.size}, but its sheet ${M.sheet} is ${known.join(',')}`);
      const names = new Set(M.bones.map((/** @type {any} */ b) => b.n));
      for (const b of M.bones) {
        if (b.par && b.par !== 'root' && !names.has(b.par)) bad(`${at} ${b.n} hangs from ${b.par}, no such bone`);
        if (!Number.isInteger(b.i) || b.i < -1 || b.i >= M.imgs.length)
          bad(`${at} ${b.n} shows picture ${b.i}, but there are ${M.imgs.length}`);
      }
      M.imgs.forEach((/** @type {any} */ P, /** @type {number} */ i) => {
        for (const [f, box] of Object.entries(P.f || {})) {
          const [x, y, w, h] = /** @type {number[]} */ (box);
          if (x < 0 || y < 0 || w < 0 || h < 0 || x + w > W || y + h > H)
            bad(`${at} picture ${i} ${f} [${box}] is outside its sheet (${W} x ${H})`);
        }
      });
      const G = M.geo;
      if (!G) {
        bad(`${at} has no geo`);
        continue;
      }
      if (G.cx !== M.cx || G.base !== M.base || G.k !== M.k)
        bad(`${at} geo cx, base, k are ${G.cx}, ${G.base}, ${G.k}, not the view's ${M.cx}, ${M.base}, ${M.k}`);
      const mid = +((G.top + M.base) / 2).toFixed(2);
      if (Math.abs(G.mid - mid) > 0.01 || Math.abs(G.cy - mid) > 0.01)
        bad(`${at} geo mid ${G.mid} and cy ${G.cy} are not halfway from its top ${G.top} to the ground ${M.base}`);
      const g = geoOf(M, view);
      if (g && G.top < g.top - 0.01) bad(`${at} geo top ${G.top} is above every picture (the boxes start at ${g.top})`);
      if (G.top >= M.base) bad(`${at} geo top ${G.top} is not above the ground ${M.base}`);
    }
  }
  return out;
}

/* ---------- T1.3 step 5: the Studio's scene and road checks, here so check-data (CI) runs them too ----------
   In the Studio's words, with where Show me goes (go, sel) and a level: 'error' fails check-data and blocks Propose,
   'warn' never does. The owner's rule (2026-10-22): an error is only what check-data already refused (a schema, its
   ground, prop, island and stop checks, logic/seam-rules.js); the rest of what the Studio found is a warning. They take `roadOf`, game/js/data-files.js PB_DATA.road (a link with its ends as stop numbers). */
/** @typedef {{ lvl: 'error' | 'warn', where: string, msg: string, go?: string, sel?: object }} DataFinding */
/** @typedef {(D: any, link: any) => any} DataRoadOf */
/** the bytes a base64 text decodes to (the cliffs check, without decoding) @param {string} s */
export const base64Bytes = s => Math.floor((s.length * 3) / 4) - (s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0);

/** v46 to phase 08b: each scene (maps/<id>.json) against its stop, its ground, props, life, water, bridges, cliffs and
 * exits, the rooms you walk into, and the 3D buildings of scenery.json
 * @param {any} D @param {DataRoadOf} roadOf @returns {DataFinding[]} */
export function dataSceneFindings(D, roadOf) {
  /** @type {DataFinding[]} */
  const out = [],
    at =
      (/** @type {DataFinding['lvl']} */ lvl, /** @type {string} */ where) =>
      (/** @type {string} */ msg, /** @type {string} */ go, /** @type {object | undefined} */ sel = undefined) =>
        out.push({ lvl, where, msg, go, sel }),
    locations = D.locations || [],
    SCN = D.maps || {},
    SY = D.scenery || { terrains: {}, props: {} },
    people = new Set(Array.isArray(D.people) ? D.people.map(x => x.id) : Object.keys(D.people || {})),
    roads = (D.roads || []).map(l => roadOf(D, l));
  for (const [k, sc] of Object.entries(SCN)) {
    const err = at('error', `maps/${k}.json`),
      warn = at('warn', `maps/${k}.json`);
    const kd = sc.kind;
    if (!['town', 'route', 'room', 'test'].includes(kd)) {
      err(`${sc.name || k}: doesn’t say what it is (kind: town, route, room or test).`, 'scenes');
      continue;
    }
    const pl = locations.find(r => r.mapId === k);
    if ((kd === 'town' || kd === 'route') && !pl)
      warn(`${sc.name || k} is a ${kd} scene but no stop uses it.`, 'scenes');
    if (pl && pl.kind && pl.kind !== kd)
      warn(`${sc.name || k} is a ${kd} scene but its stop ${pl.name} is a ${pl.kind}.`, 'scenes');
    if (kd === 'room' && !sc.building)
      warn(`${sc.name || k} is a room but doesn’t say which building it’s the inside of.`, 'scenes');
  }
  locations.forEach((r, i) => {
    if (!['town', 'route'].includes(r.kind))
      at('warn', 'locations.json')(`Stop ${i + 1}, ${r.name}: doesn’t say whether it’s a town or a route.`, 'world');
  });
  /* v26: the rooms you walk into */
  for (const k of ['shop', 'clinic', 'lab', 'house'])
    if (!SCN['int_' + k])
      at('warn', `maps/int_${k}.json`)(
        `There’s no room to walk into for a ${k} (scene int_${k}), so tapping one opens it straight away.`,
        'scenes'
      );
  for (const [k, sc] of Object.entries(SCN))
    if (sc.room && sc.keeper && !String(sc.keeper).startsWith('folk:') && !people.has(sc.keeper))
      at('warn', `maps/${k}.json`)(
        `${sc.name || k}: the person behind the counter (${sc.keeper}) isn’t in People.`,
        'scenes'
      );
  locations.forEach((r, i) => {
    if (r.mapId && !SCN[r.mapId])
      at('error', 'locations.json')(`${r.name} uses a walk scene that doesn’t exist.`, 'world', {
        wtab: 'route',
        stop: i,
      });
  });
  for (const [k, s] of Object.entries(SCN)) {
    const g = { scene: k },
      err = at('error', `maps/${k}.json`),
      warn = at('warn', `maps/${k}.json`),
      bad = new Set();
    (s.tiles || []).forEach(row => {
      for (const ch of row) if (!SY.terrains[ch]) bad.add(ch);
    });
    if (bad.size) err(`Scene ${s.name || k} uses unknown ground ${[...bad].join(', ')}.`, 'scenes', g);
    /* IS-6a: the island fields and the ground lock (check-data refuses the same); they open in Hub island */
    for (const msg of islandProblems(s)) err(`Island ${s.name || k}: ${msg}.`, 'hub', { hub: k });
    if ((s.tiles || []).length !== s.h)
      warn(`Scene ${s.name || k} has ${(s.tiles || []).length} rows of ground but is ${s.h} tall.`, 'scenes', g);
    (s.props || []).forEach(p => {
      if (!SY.props[p.k]) err(`Scene ${s.name || k} places an unknown prop (${p.k}).`, 'scenes', g);
    });
    if (!s.hub && (!s.path || s.path.length < 2))
      warn(`Scene ${s.name || k} has no hub (where you stand) and no path.`, 'scenes', g);
    (s.life || []).forEach(L => {
      /* an animal of scenery.json life, or 'car' (ambient-life.js picks a coloured car on its road) */
      if (L.k !== 'car' && !(SY.life || {})[L.k])
        warn(`Scene ${s.name || k} lists unknown life (${L.k}).`, 'scenes', g);
      else if (L.k === 'car' && !(L.path && L.path.length > 1))
        warn(`Scene ${s.name || k} has cars without a road to drive along.`, 'scenes', g);
    });
    (s.props || []).forEach(p => {
      if (p.act === 'shop' && p.shop && !(D.shops || {})[p.shop])
        warn(`Scene ${s.name || k} has a shop door for a shop that doesn’t exist (${p.shop}).`, 'scenes', g);
    });
    /* v18: cliffs, stairs and bridges */
    if (typeof s.steps === 'string' && s.steps && Math.floor(base64Bytes(s.steps) / 2) !== s.w * 2 * s.h * 2)
      warn(
        `Scene ${s.name || k}: its cliffs and stairs were made for a different map size. Repaint them with Cliffs & stairs.`,
        'scenes',
        g
      );
    const ter = (/** @type {number} */ x, /** @type {number} */ z) => {
      const row = (s.tiles || [])[s.h - 1 - Math.floor(z)] || '';
      return row[Math.floor(x)] || s.edge;
    };
    (s.bridges || []).forEach((b, n) => {
      const L = Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1]);
      const off = (/** @type {number[]} */ p) => p[0] < 0 || p[1] < 0 || p[0] > s.w || p[1] > s.h;
      if (L < 1) warn(`Scene ${s.name || k}: bridge ${n + 1} is shorter than a metre.`, 'scenes', g);
      else if (off(b.a) || off(b.b)) warn(`Scene ${s.name || k}: bridge ${n + 1} runs off the map.`, 'scenes', g);
      else if ('wd'.includes(ter(b.a[0], b.a[1])) || 'wd'.includes(ter(b.b[0], b.b[1])))
        warn(
          `Scene ${s.name || k}: bridge ${n + 1} ends in the water, so nobody can step onto it. Drag it from bank to bank.`,
          'scenes',
          g
        );
    });
    (s.arches || []).forEach((a, n) => {
      if (a.x < 0 || a.z < 0 || a.x > s.w || a.z > s.h)
        warn(`Scene ${s.name || k}: arch ${n + 1} is off the map.`, 'scenes', g);
    });
    (s.waters || []).forEach((r, n) => {
      let wet = false;
      for (let z = Math.floor(r.z); z < r.z + r.h && !wet; z++)
        for (let x = Math.floor(r.x); x < r.x + r.w; x++) {
          const ch = ((s.tiles || [])[s.h - 1 - z] || '')[x];
          if (ch === 'w' || ch === 'd') {
            wet = true;
            break;
          }
        }
      if (!wet) warn(`Scene ${s.name || k}: water rectangle ${n + 1} (${r.k}) covers no water.`, 'scenes', g);
      if (!['pond', 'stream', 'canal', 'spring', 'swamp', 'lake'].includes(r.k))
        warn(`Scene ${s.name || k}: water rectangle ${n + 1} has an unknown kind “${r.k}”.`, 'scenes', g);
    });
    const users = locations.map((r, i) => [r, i]).filter(([r]) => r.mapId === k);
    users.forEach(([r, i]) => {
      const n = roads.filter(l => l.kind === 'seam' && (l.a === i || l.b === i)).length;
      if (n > (s.exits || []).length)
        warn(
          `${r.name} has ${n} road${n === 1 ? '' : 's'} but its scene ${s.name || k} has ${(s.exits || []).length} exit${(s.exits || []).length === 1 ? '' : 's'}, so some roads share an exit.`,
          'scenes',
          g
        );
      /* v42: each link names an exit this scene has (phase 08b: and the two ends face each other) */
      roads.forEach(l => {
        const end = l.a === i ? 'a' : l.b === i ? 'b' : null,
          id = end === 'a' ? l.exitA : end === 'b' ? l.exitB : null;
        if (!id) return;
        const e = (s.edgeExits || []).find(q => q.id === id),
          o = end === 'a' ? l.b : l.a;
        if (!e) {
          warn(
            `${r.name}: the road to ${(locations[o] || {}).name} leaves by “${id}”, but scene ${s.name || k} has no exit with that name.`,
            'scenes',
            g
          );
          return;
        }
        /* phase 08b: and the other end's exit faces it (east to west, north to south), or the places can't join */
        const os = SCN[(locations[o] || {}).mapId],
          oe = os && (os.edgeExits || []).find(q => q.id === (end === 'a' ? l.exitB : l.exitA)),
          OPP = { E: 'W', W: 'E', N: 'S', S: 'N' };
        if (end === 'a' && oe && OPP[e.side] !== oe.side)
          err(
            `${r.name}: the road to ${locations[o].name} leaves by ${id} (${e.side}), which doesn’t face ${oe.id} (${oe.side}) there, so the two can’t join.`,
            'scenes',
            g
          );
      });
    });
  }
  for (const [k, M] of Object.entries(SY.props || {})) {
    const B = M.build,
      warn = at('warn', 'scenery.json');
    if (!B) continue;
    if (!M.box) warn(`${M.name || k} is a 3D building without a footprint, so it is shown as its picture.`, 'scenes');
    if (B.wall && B.wall[0] >= B.wall[1])
      warn(`${M.name || k}: its 3D walls are the wrong way round (left is right of right).`, 'scenes');
  }
  return out;
}

/** v42 to phase 08b: the roads (roads.json): a name, the exits a seam leaves by, two stops that exist and differ, and
 * every stop reached from the first @param {any} D @param {DataRoadOf} roadOf @returns {DataFinding[]} */
export function dataRoadFindings(D, roadOf) {
  /** @type {DataFinding[]} */
  const out = [],
    err = (/** @type {string} */ msg, /** @type {string} */ go, /** @type {object | undefined} */ sel = undefined) =>
      out.push({ lvl: 'error', where: 'roads.json', msg, go, sel }),
    warn = (/** @type {string} */ msg, /** @type {string} */ go, /** @type {object | undefined} */ sel = undefined) =>
      out.push({ lvl: 'warn', where: 'roads.json', msg, go, sel }),
    locations = D.locations || [];
  (D.roads || []).forEach((L, i) => {
    const r = roadOf(D, L);
    if (!r.id)
      warn(`Road ${i + 1} (${(locations[r.a] || {}).name} – ${(locations[r.b] || {}).name}) has no name yet.`, 'world');
    /* phase 08b: a road joins two places at an exit of each; without both it joins nothing */
    if (r.kind === 'seam' && (!r.exitA || !r.exitB) && locations[r.a] && locations[r.b])
      err(
        `The road between ${locations[r.a].name} and ${locations[r.b].name} doesn’t say which exit it leaves by at ${!r.exitA ? locations[r.a].name : locations[r.b].name}.`,
        'world',
        { wtab: 'route', stop: !r.exitA ? r.a : r.b }
      );
  });
  const LK = (D.roads || []).map(l => roadOf(D, l));
  LK.forEach((l, k) => {
    if (!locations[l.a] || !locations[l.b])
      err(`Road ${k + 1} connects a stop that doesn’t exist.`, 'world', { wtab: 'route' });
    else if (l.a === l.b) err(`${locations[l.a].name} has a road to itself.`, 'world', { wtab: 'route', stop: l.a });
  });
  if (LK.length) {
    const seen = new Set([0]),
      st = [0];
    while (st.length) {
      const a = st.pop();
      LK.forEach(({ a: x, b: y }) => {
        const b = x === a ? y : y === a ? x : null;
        if (b != null && !seen.has(b) && locations[b]) {
          seen.add(b);
          st.push(b);
        }
      });
    }
    locations.forEach((r, i) => {
      if (!seen.has(i)) warn(`No road leads to ${r.name}.`, 'world', { wtab: 'route', stop: i });
    });
  }
  return out;
}

/* ---------- Studio plan T2.3: a run map's structure, and a sweep over many seeds ---------- */
/** the node type ids the game's code looks for on a map's role rows (run-loop.js runFoes: 'miniboss' and 'boss';
 * run-scenes.js: a 'town' has the clinic and shop, the 'landing' the mast) */
export const RUN_MAP_ROLE_TYPES = { first: 'landing', rest: 'town', guard: 'miniboss', last: 'boss' };
export const RUN_MAP_ROLE_NAMES = { first: 'landing', rest: 'rest', guard: 'mini-boss', last: 'last' };

/** what is wrong with one run map (run-map.js runMapMake's), as sentences: a place the landing can't reach, a place
 * that leads nowhere or skips a row, a role row without the type the game looks for; RL-12b: with the node types, two
 * places that sell things one after the other
 * @param {any} map @param {any} M rules.json run.map @param {Record<string, any>} [nodeTypes] @returns {string[]} */
export function runMapProblems(map, M, nodeTypes) {
  const out = [],
    nodes = map.nodes,
    last = Math.max(...nodes.map((/** @type {any} */ n) => n.row)),
    roles = runMapRows(M),
    seen = new Set([0]),
    todo = [0];
  while (todo.length)
    for (const j of nodes[/** @type {number} */ (todo.pop())].to)
      if (!seen.has(j)) {
        seen.add(j);
        todo.push(j);
      }
  nodes.forEach((/** @type {any} */ n, /** @type {number} */ i) => {
    if (!seen.has(i)) out.push(`place ${i} can’t be reached from the landing`);
    if (n.row < last && !n.to.length) out.push(`place ${i} leads nowhere (row ${n.row + 1} of ${last + 1})`);
    if (n.to.some((/** @type {number} */ j) => !nodes[j] || nodes[j].row !== n.row + 1))
      out.push(`place ${i} skips a row`);
    if (nodeTypes && nodeTypes[n.type] && nodeTypes[n.type].shop)
      for (const j of n.to)
        if (nodes[j] && nodeTypes[nodes[j].type] && nodeTypes[nodes[j].type].shop)
          out.push(
            `two places that sell things in a row (place ${i}, a ${n.type}, then place ${j}, a ${nodes[j].type})`
          );
    const role = /** @type {keyof typeof RUN_MAP_ROLE_TYPES} */ (roles[n.row]),
      want = RUN_MAP_ROLE_TYPES[role];
    if (want && n.type !== want)
      out.push(
        role === 'last'
          ? `the last row is a ${n.type}, not the boss`
          : `a ${RUN_MAP_ROLE_NAMES[role]} row (row ${n.row + 1}) is a ${n.type}, not a ${want === 'town' ? 'town' : want}`
      );
  });
  return [...new Set(out)];
}

/** the fewest and most towns on a walk from the landing to the last row (over every path) @param {any} map */
export function runMapTownsPerPath(map) {
  const nodes = map.nodes,
    lo = nodes.map(() => Infinity),
    hi = nodes.map(() => -Infinity),
    last = Math.max(...nodes.map((/** @type {any} */ n) => n.row));
  for (let i = nodes.length - 1; i >= 0; i--) {
    const t = nodes[i].type === 'town' ? 1 : 0;
    if (nodes[i].row === last) lo[i] = hi[i] = t;
    else
      for (const j of nodes[i].to) {
        lo[i] = Math.min(lo[i], t + lo[j]);
        hi[i] = Math.max(hi[i], t + hi[j]);
      }
  }
  return [lo[0], hi[0]];
}

/**
 * a sweep of n seeds (`${prefix}${k}`): the problems (each with how many maps have it and a seed that shows it), and
 * the figures a designer weighs: places per map, places by type, towns on a walk, biomes, the towns made against the
 * routes (rest rows are always towns, so the ratio isn't the weights'), and outlying seeds to open
 * @param {Record<string, any>} nodeTypes @param {any} M rules.json run.map (its biomes as the run's unlocks leave them)
 * @param {{ n?: number, prefix?: string }} [o]
 */
export function runMapSweep(nodeTypes, M, o = {}) {
  const n = o.n || 1000,
    prefix = o.prefix || 'SWEEP',
    /** @type {Map<string, { text: string, seed: string, count: number }>} */
    problems = new Map(),
    /** @type {Record<string, number>} */ types = {},
    /** @type {Record<string, number>} */ biomes = {},
    sizes = [],
    towns = [],
    /** @type {{ seed: string, why: string }[]} */ outliers = [];
  let maps = 0,
    lo = Infinity,
    hi = -Infinity;
  const note = (/** @type {string} */ text, /** @type {string} */ seed) => {
    const p = problems.get(text);
    if (p) p.count++;
    else problems.set(text, { text, seed, count: 1 });
  };
  for (let k = 0; k < n; k++) {
    const seed = prefix + k;
    let map;
    try {
      map = runMapMake(seed, nodeTypes, M);
    } catch (e) {
      note(`these rules can’t make a map: ${/** @type {Error} */ (e).message}`, seed);
      continue;
    }
    maps++;
    for (const p of runMapProblems(map, M, nodeTypes)) note(p, seed);
    sizes.push([map.nodes.length, seed]);
    for (const x of map.nodes) {
      types[x.type] = (types[x.type] || 0) + 1;
      biomes[x.biome] = (biomes[x.biome] || 0) + 1;
    }
    const [a, b] = runMapTownsPerPath(map);
    towns.push([a, seed]);
    lo = Math.min(lo, a);
    hi = Math.max(hi, b);
  }
  const stat = (/** @type {any[]} */ xs) =>
    xs.length
      ? {
          min: Math.min(...xs.map(x => x[0])),
          max: Math.max(...xs.map(x => x[0])),
          avg: xs.reduce((s, x) => s + x[0], 0) / xs.length,
        }
      : { min: 0, max: 0, avg: 0 };
  const nodes = stat(sizes),
    tp = stat(towns);
  if (maps) {
    outliers.push({
      seed: /** @type {any} */ (sizes.find(x => x[0] === nodes.min))[1],
      why: `fewest places (${nodes.min})`,
    });
    outliers.push({
      seed: /** @type {any} */ (sizes.find(x => x[0] === nodes.max))[1],
      why: `most places (${nodes.max})`,
    });
    outliers.push({
      seed: /** @type {any} */ (towns.find(x => x[0] === tp.min))[1],
      why: `fewest towns on a walk (${tp.min})`,
    });
  }
  return {
    maps,
    problems: [...problems.values()],
    nodes,
    types,
    biomes,
    townsPerPath: { min: maps ? lo : 0, max: maps ? hi : 0, avg: tp.avg },
    ratio: {
      towns: types.town || 0,
      routes: types.route || 0,
      weights: { town: (nodeTypes.town || {}).weight || 0, route: (nodeTypes.route || {}).weight || 0 },
    },
    outliers,
  };
}
