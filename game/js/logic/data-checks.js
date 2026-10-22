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
import { CLIMATE_WEATHER_ODDS } from './weather.js';
import { uiThemeContrast } from './ui-theme.js';
import { RUN_MARK_TYPES } from './run-marks.js';
import { runMapRowsFit } from './run-map.js';
import { MAPGEN_DEFAULTS, MAPGEN_FEATURES, MAPGEN_SHAPES, MAPGEN_SURFACES, MAPGEN_WATER } from './mapgen.js';
import { conditionNames, conditionProblem, conditionTree } from './conditions.js';
/* eslint-disable no-func-assign */
expose({
  ROBOT_FITS: [() => ROBOT_FITS],
  // @ts-expect-error -- replaced on purpose
  dataBattleRules: [() => dataBattleRules, v => (dataBattleRules = v)],
  // @ts-expect-error -- replaced on purpose
  dataBiomes: [() => dataBiomes, v => (dataBiomes = v)],
  // @ts-expect-error -- replaced on purpose
  dataBuildings: [() => dataBuildings, v => (dataBuildings = v)],
  // @ts-expect-error -- replaced on purpose
  dataCurrencies: [() => dataCurrencies, v => (dataCurrencies = v)],
  // @ts-expect-error -- replaced on purpose
  dataNodeTypes: [() => dataNodeTypes, v => (dataNodeTypes = v)],
  // @ts-expect-error -- replaced on purpose
  dataRanchRules: [() => dataRanchRules, v => (dataRanchRules = v)],
  // @ts-expect-error -- replaced on purpose
  dataRelics: [() => dataRelics, v => (dataRelics = v)],
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
  dataUiTheme: [() => dataUiTheme, v => (dataUiTheme = v)],
  // @ts-expect-error -- replaced on purpose
  dataUnderscoreKeys: [() => dataUnderscoreKeys, v => (dataUnderscoreKeys = v)],
  // @ts-expect-error -- replaced on purpose
  dataUnlocks: [() => dataUnlocks, v => (dataUnlocks = v)],
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
// the items' share of their price at most 1, the seals for a win a whole number
/** RL-3: rules.json run.payout @param {any} D @returns {DataProblem[]} */
export function dataRunPayout(D) {
  /** @type {DataProblem[]} */
  const out = [],
    problem = (/** @type {string} */ where, /** @type {string} */ what) => out.push([where, what]);
  {
    const pay = D.rules && D.rules.run && D.rules.run.payout,
      RATES = ['money', 'itemShare', 'released', 'node', 'win', 'winSeals', 'scrapNode', 'scrapWin'];
    if (!pay || typeof pay !== 'object') problem('rules.json', 'run.payout missing');
    else {
      for (const k of RATES)
        if (typeof pay[k] !== 'number' || !(pay[k] >= 0))
          problem('rules.json', `run.payout.${k} is not a number of 0 or more`);
      for (const k of Object.keys(pay)) if (!RATES.includes(k)) problem('rules.json', `run.payout.${k}: no such rate`);
      if (pay.itemShare > 1)
        problem('rules.json', 'run.payout.itemShare is more than 1 (items would pay over their price)');
      for (const k of ['winSeals', 'scrapNode', 'scrapWin'])
        if (!Number.isInteger(pay[k])) problem('rules.json', `run.payout.${k} is not a whole number`);
    }
  }
  return out;
}
// RL-9: the ranch (logic/ranch.js): training slots by ranch level (1-12 levels, each 1-20 slots, never fewer than the
// level before), the level cap (capBase at level 1, capStep more a level; at most the game's maxLevel), the hours a
// trainee banks (1-168), levels an hour (above 0, at most 10), the Scrap to start (0-10,000), the clock's slack for a
// rollback (0-1 hour); nothing else
/** RL-9, RL-10: rules.json ranch @param {any} D @returns {DataProblem[]} */
export function dataRanchRules(D) {
  /** @type {DataProblem[]} */
  const out = [],
    problem = (/** @type {string} */ where, /** @type {string} */ what) => out.push([where, what]);
  {
    const RA = D.rules && D.rules.ranch,
      whole = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi,
      KEYS = ['slots', 'capBase', 'capStep', 'bankHours', 'levelsPerHour', 'trainCost', 'guardMs', 'breed'];
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
// RL-6: the run's clock and what its map shows: whole days of slack (0-30) and of forecast ahead (1-30), whole rows
// shown ahead with their type (1-12) and as '?' (at least as far, up to 12); nothing else in rules.json run
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
    for (const k of Object.keys(R))
      if (
        ![
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
          'relics',
        ].includes(k)
      )
        problem('rules.json', `run.${k}: no such rule`);
    if (!C || typeof C !== 'object' || !whole(C.slack, 0, 30) || !whole(C.ahead, 1, 30))
      problem('rules.json', 'run.clock: slack (0-30) and ahead (1-30) are not whole numbers of days');
    else
      for (const k of Object.keys(C))
        if (!['slack', 'ahead'].includes(k)) problem('rules.json', `run.clock.${k}: no such rule`);
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
// RL-8: the run loop's numbers (placeholders): what a run starts with (money, known coins and items, whole counts), a
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
        typeof w === 'string' && (w.startsWith('coin:') ? !!(D.coins || {})[w.slice(5)] : !!(D.items || {})[w]),
      ST = R.start,
      SH = R.shop,
      F = R.foes;
    if (!rec(ST) || !whole(ST.se, 0, 1e6) || !rec(ST.coins) || !rec(ST.items))
      problem('rules.json', 'run.start: se (whole, 0-1,000,000), coins and items (records) are needed');
    else {
      only(ST, ['se', 'coins', 'items'], 'run.start');
      for (const [k, n] of Object.entries(ST.coins))
        if (!(D.coins || {})[k] || !whole(n, 0, 999))
          problem('rules.json', `run.start.coins.${k}: no such coin, or not a whole count`);
      for (const [k, n] of Object.entries(ST.items))
        if (!(D.items || {})[k] || !whole(n, 0, 999))
          problem('rules.json', `run.start.items.${k}: no such item, or not a whole count`);
    }
    // RL-9b: by Bracket (index 0 = Bracket I; past the end, the last): Billies from home a run takes (1-6, never fewer
    // than the Bracket before) and the things packed from Copperleaf's bag (0-99 items and coins in all)
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
          `run.${k} is not a list of 1-9 whole numbers (${what}, ${lo}-${hi}), one a Bracket, none fewer than the one before`
        );
    }
    if (!whole(R.healCost, 0, 100000)) problem('rules.json', 'run.healCost is not a whole number of $ (0-100,000)');
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
          problem('rules.json', `run.foes.${k}: up (whole, -20-50) and reward (whole $, 0-1,000,000) are needed`);
        else only(f, ['up', 'reward'], `run.foes.${k}`);
      }
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
// RL-12: Loopholes (relics): the schema, the types their damage rows name; rules.json run.relics: a cap of 1-12 held, a
// pick of 1-5 (run.offer holds up to 5), a weight of 0 or more and a whole price ($0-100,000) for each rarity, and
// something to offer
/** RL-12: relics.json and rules.json run.relics @param {any} D @param {DataValid} [valid] @returns {DataProblem[]} */
export function dataRelics(D, valid = () => true) {
  /** @type {DataProblem[]} */
  const out = [],
    problem = (/** @type {string} */ where, /** @type {string} */ what) => out.push([where, what]);
  {
    const RR = D.rules && D.rules.run && D.rules.run.relics,
      RARITIES = ['common', 'uncommon', 'rare'],
      whole = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi,
      types = new Set((D.types || []).map(t => t.id));
    if (D.relics && valid('relics.schema.json', D.relics, 'relics.json'))
      for (const [k, R] of Object.entries(D.relics))
        R.fx.forEach((f, n) => {
          if (f.type && !types.has(f.type))
            problem('relics.json', `${k}.fx[${n}].type: no type "${f.type}" (types.json)`);
        });
    if (!RR || typeof RR !== 'object' || Array.isArray(RR)) problem('rules.json', 'run.relics missing');
    else {
      for (const k of Object.keys(RR))
        if (!['cap', 'pick', 'rarity', 'price'].includes(k)) problem('rules.json', `run.relics.${k}: no such rule`);
      if (!whole(RR.cap, 1, 12)) problem('rules.json', 'run.relics.cap is not a whole number from 1 to 12');
      if (!whole(RR.pick, 1, 5)) problem('rules.json', 'run.relics.pick is not a whole number from 1 to 5');
      for (const g of ['rarity', 'price']) {
        const G = RR[g] && typeof RR[g] === 'object' ? RR[g] : {};
        for (const k of Object.keys(G))
          if (!RARITIES.includes(k)) problem('rules.json', `run.relics.${g}.${k}: no such rarity`);
        for (const r of RARITIES)
          if (g === 'rarity' ? !(typeof G[r] === 'number' && G[r] >= 0) : !whole(G[r], 0, 100000))
            problem(
              'rules.json',
              `run.relics.${g}.${r} is not ${g === 'rarity' ? 'a weight of 0 or more' : 'a whole price ($0-100,000)'}`
            );
      }
      if (D.relics && !Object.values(D.relics).some(R => (RR.rarity || {})[R.rarity] > 0))
        problem(
          'rules.json',
          'run.relics.rarity gives every Loophole in relics.json a weight of 0: nothing can be offered'
        );
    }
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
