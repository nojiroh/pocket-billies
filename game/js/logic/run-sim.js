// @ts-check
'use strict';
/* ================= THE RUN SIMULATION'S CORE (roguelite track RL-8; Studio plan T3.1) =================
   A whole run from its seed, played as the page plays it, with the player's part played by a fixed policy (see runSim).
   The CLI (tools/test/sim/run-sim.mjs) and, later, the Studio's logic worker call it. It is handed the game's logic and
   data (`env`) instead of importing them, so it runs wherever they were loaded: plain Node (tools/test/setup-real.mjs)
   or a worker. The host reseeds util.js random before each run (env.beforeRun): a run's own draws come from its seed,
   and the replay test proves nothing in a run hangs on Math.random. Logic only: no DOM, no Node. */
/**
 * What the core needs: the logic modules by file name, the logic's functions by name, the page's shared names, the
 * data tables (game-data.js), the data files as read (GAME_DATA), the logic's other exports, and what the host does
 * before each run.
 * @typedef {{ modules: Record<string, any>, fn: (name: string) => any, hooks: any, data: any, gameData: any,
 *   logic: any, beforeRun?: (o: SimOptions) => void }} SimEnv
 * @typedef {{ random?: number, fights?: number, team?: number, pack?: number, unlocks?: 'none' | 'all' }} SimOptions
 */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  MAX_TURNS: [() => MAX_TURNS],
  brief: [() => brief],
  // @ts-expect-error -- replaced on purpose
  runSimOn: [() => runSimOn, v => (runSimOn = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const MAX_TURNS = 60;
/** @param {any} m */
export const brief = m => `${m.sp}:${m.lvl}:${m.hp}`;

/** the simulation on a set of loaded logic and data: runSim and runStats @param {SimEnv} env */
export function runSimOn(env) {
  const { modules, fn, hooks, data, gameData: GAME_DATA, logic } = env;
  const { RULES, TRAINERS } = data;
  const R = RULES.run,
    { runArrive, runNext, runWorldNode, runWeather } = modules['run-map'],
    { payoutOf, runByTier } = modules['run-state'],
    { runScenesMake, runWorldTables } = modules['run-scenes'],
    { runFoes, runBattleExtra, runClinic, runShopStock } = modules['run-loop'],
    { fxOfRun, fxRunPrice } = modules.effects,
    { runStartOn, runStartPlan } = modules['run-start'],
    { runUnlocks } = modules.unlocks;
  const MAP_DATA = { nodeTypes: GAME_DATA.nodeTypes, biomes: GAME_DATA.biomes, rules: R },
    UNLOCK_DATA = { unlocks: GAME_DATA.unlocks, buildings: GAME_DATA.buildings };
  const worldData = () => ({
    nodeTypes: GAME_DATA.nodeTypes,
    biomes: GAME_DATA.biomes,
    pools: data.POOLS,
    scenery: GAME_DATA.scenery,
    rules: R,
  });
  /* a battle's host in the simulation: shows and saves nothing, and plays the battle's own weather (b.wx, as the page's
     battleWeatherMultiplier does once a run battle has its forecast's weather) */
  const SIM_HOST = Object.freeze({
    ...logic.SILENT_HOST,
    /** @param {string} t */
    weather: t => {
      const w = hooks.activeBattle && hooks.activeBattle.wx;
      return (w && w.m[t]) || 1;
    },
  });

  /** play the battle on screen to its end, both sides by the computer; returns its outcome and turns */
  function playOut() {
    const B = hooks.activeBattle,
      liveActors = fn('liveActors');
    while (!B.over && B.turn < MAX_TURNS) {
      const plan = [];
      if (B.needSwitch && B.needSwitch.length) {
        /** @type {number[]} */
        const used = [];
        for (const k of B.needSwitch) {
          const i = fn('benchCandidates')(0, used)[0];
          if (i == null) continue;
          used.push(i);
          plan.push({ who: k, k: 'switch', i });
        }
      }
      for (const k of liveActors(0)) {
        if (plan.some(p => p.who === k)) continue;
        const c = fn('chooseAI')(k);
        if (c) plan.push({ who: k, k: 'move', mid: c.mid, tk: c.tk, part: c.part });
      }
      if (!plan.length) break;
      fn('runTurn')(plan);
    }
    return { over: B.over || 'draw', turns: B.turn };
  }

  /**
   * One run from its seed, played by the policy. Returns a log of everything that was drawn and how it went, and the
   * run's numbers. What the player does is a fixed policy: walk forward along a lane drawn from the seed, fight up to
   * `fights` of a place's wild Billies while the party is above 70% of its HP (a Potion on a Billie below 60%; tax the
   * first ones while the party is small), heal in towns when hurt, keep a few Copper Coins, beat the mini-boss, then
   * the boss. It starts as the mast does: the highest-level Billies from home (rules.json run.home at Bracket I;
   * `team` is how many starters wait at home) and a bag packed with Potions from home (`pack` of them at home, as many
   * as run.pack lets).
   * @param {string} seed @param {SimOptions} [o]
   */
  function runSim(seed, o = {}) {
    if (env.beforeRun) env.beforeRun(o);
    const s = fn('newSave')();
    s.started = true;
    s.starter = RULES.start.starters[0];
    hooks.provide({ saveData: s, activeBattle: null });
    s.team.push(fn('makeBilly')(s.starter + '0', RULES.start.starterLevel));
    for (let k = 1; k < (o.team ?? 1); k++) s.team.push(fn('makeBilly')(s.starter + '0', RULES.start.starterLevel));
    s.items.taxbreak = o.pack ?? 0;
    const home = s.team
        .slice()
        .sort((/** @type {any} */ a, /** @type {any} */ b) => b.lvl - a.lvl)
        .slice(0, runByTier(R.home, 1))
        .map((/** @type {any} */ m) => m.uid),
      pack = { items: { taxbreak: Math.min(o.pack ?? 0, runByTier(R.pack, 1)) }, coins: {} };
    /* Studio plan T2.1: started as the mast starts a run (logic/run-start.js), with what the save has unlocked: none (a
       fresh save, the default) or every unlock (unlocks: 'all') */
    if (o.unlocks === 'all') for (const id of Object.keys(UNLOCK_DATA.unlocks)) s.meta.unlocks[id] = 1;
    const run = runStartOn(
      s,
      runStartPlan(seed, { ...MAP_DATA, unlockData: UNLOCK_DATA }, { unlocks: runUnlocks(s, UNLOCK_DATA) }),
      { home, pack }
    );
    const scenes = runScenesMake(run, worldData()),
      W = runWorldTables(run, data.LOCATIONS[0], worldData()),
      foes = runFoes(run, { leaders: Object.values(TRAINERS).filter((/** @type {any} */ T) => T.miniboss), rules: R });
    data.worldPut({
      ...W,
      maps: Object.fromEntries(
        W.locations.slice(1).map((/** @type {any} */ p, /** @type {number} */ i) => [p.mapId, scenes[i]])
      ),
      trainers: foes,
    });
    /** @type {any} */
    const log = { seed, unlocks: run.unlocks, scenes: scenes.map((/** @type {any} */ sc) => sc.gen.seed), places: [] },
      stats = {
        battles: 0,
        turns: 0,
        caught: 0,
        healed: 0,
        spent: 0,
        won: false,
        lostAt: '',
        /** @type {any} */ days: 0,
      };
    try {
      runArrive(s, 0, MAP_DATA);
      let i = 0;
      for (;;) {
        const node = run.map.nodes[i],
          wn = runWorldNode(i),
          /** @type {any} */
          at = { i, type: node.type, day: run.clock, weather: runWeather(run, i, run.clock), battles: [] };
        log.places.push(at);
        /* a town: heal when hurt, then the day's shop (Copper Coins up to five) */
        if (node.type === 'town') {
          const { paid } = runClinic(s, fxRunPrice(run, data.RELICS, 'heal', R.healCost));
          if (paid) {
            stats.healed += paid;
            at.healed = paid;
          }
          const stock = runShopStock(run, i, run.clock, R.shop);
          at.shop = stock.map((/** @type {any} */ w) => w.coin || w.item);
          const coin = data.COINS.penny;
          while (
            stock.some((/** @type {any} */ w) => w.coin === 'penny') &&
            (s.coins.penny || 0) < 5 &&
            s.se >= coin.price + 100
          ) {
            s.se -= coin.price;
            s.coins.penny = (s.coins.penny || 0) + 1;
            stats.spent += coin.price;
          }
        }
        /* the place's wild Billies, up to `fights` of them */
        const stock = fn('encountersHere')(wn).slice(0, o.fights ?? 2);
        at.stock = stock.map((/** @type {any} */ q) => `${q.sp}:${q.lvl}${q.alpha ? 'A' : ''}`);
        for (const q of stock) {
          /* a careful player: a Potion on a Billie below 60%, and no wild fight while the party is below 70% */
          for (const m of s.team)
            if (m.hp > 0 && m.hp < fn('maxHp')(m) * 0.6 && (s.items.taxbreak || 0) > 0) {
              s.items.taxbreak--;
              m.hp = Math.min(fn('maxHp')(m), m.hp + data.ITEMS.taxbreak.hp);
            }
          const hp = s.team.reduce((/** @type {number} */ a, /** @type {any} */ m) => a + m.hp, 0),
            full = s.team.reduce((/** @type {number} */ a, /** @type {any} */ m) => a + fn('maxHp')(m), 0);
          if (hp < full * 0.7) break;
          const k = run.battleN++,
            build = { build: fn('encounterBuild')(q), coat: q.coat },
            foe = q.alpha ? fn('makeAlpha')(q.sp, q.lvl, build) : fn('makeBilly')(q.sp, q.lvl, build);
          if (
            !fn('newBattle')('wild', [foe], {
              qid: q.id,
              fmt: q.alpha ? 'alpha' : 'single',
              ...runBattleExtra(run, i, k, RULES.env, fxOfRun(run, data.RELICS)),
              host: SIM_HOST,
            })
          )
            break;
          const B = hooks.activeBattle;
          let res;
          /* tax it while the party is small and there are coins: one throw, then fight on */
          if (s.team.length < 3 && (s.coins.penny || 0) > 0 && !q.alpha) {
            s.coins.penny--;
            const c = fn('catchRoll')('penny', 1 + logic.CATCH_RULES.ring * 0.5, false);
            if (c.caught) {
              foe.hp = Math.max(1, foe.hp);
              fn('addBilly')(foe);
              stats.caught++;
              res = { over: 'caught', turns: B.turn };
            } else fn('enemyOnly')();
          }
          res = res || playOut();
          const pay = modules['battle-rewards'].battleRewards({ kind: 'wild', over: res.over, foe: [foe] }, s, () =>
            B.rng()
          );
          s.se += pay.prize;
          fn('dropEncounter')(q.id);
          hooks.provide({ activeBattle: null });
          hooks.uiState.learnQ.length = 0;
          stats.battles++;
          stats.turns += res.turns;
          at.battles.push({ k, foe: brief(foe), over: res.over, turns: res.turns, team: s.team.map(brief) });
          if (pay.o === 'lose') {
            stats.lostAt = node.type;
            return finish();
          }
        }
        /* its trainer: a mini-boss (doubles), the boss (an Alpha) */
        const T = Object.values(foes).find((/** @type {any} */ F) => F.runNode === i);
        if (T) {
          const k = run.battleN++,
            team = T.alpha ? [fn('makeAlpha')(T.team[0].sp, T.team[0].lvl)] : fn('trainerTeam')(TRAINERS[T.id]);
          if (!s.team.some((/** @type {any} */ m) => m.hp > 0)) {
            stats.lostAt = node.type;
            return finish();
          }
          fn('newBattle')('trainer', team, {
            tid: T.id,
            T: TRAINERS[T.id],
            fmt: T.alpha ? 'alpha' : T.double && team.length >= 2 ? 'double' : 'single',
            ...runBattleExtra(run, i, k, RULES.env, fxOfRun(run, data.RELICS)),
            host: SIM_HOST,
          });
          const res = playOut(),
            B = hooks.activeBattle,
            pay = modules['battle-rewards'].battleRewards(
              { kind: 'trainer', over: res.over, T: TRAINERS[T.id], tid: T.id, foe: team },
              s,
              () => B.rng()
            );
          hooks.provide({ activeBattle: null });
          hooks.uiState.learnQ.length = 0;
          stats.battles++;
          stats.turns += res.turns;
          at.battles.push({
            k,
            trainer: T.from,
            foe: team.map(brief).join(','),
            over: res.over,
            turns: res.turns,
            team: s.team.map(brief),
          });
          if (pay.o !== 'win') {
            stats.lostAt = node.type;
            return finish();
          }
          s.se += pay.reward;
          s.flags[T.id] = 1;
          if (node.type === 'boss') {
            stats.won = true;
            return finish();
          }
        }
        /* on: a lane drawn from the seed */
        const next = runNext(run.map, i);
        if (!next.length) return finish();
        i = next[modules.rng.rngFrom(seed, 'sim|path|' + i).int(0, next.length - 1)];
        runArrive(s, i, MAP_DATA);
      }
    } finally {
      data.worldHubBack();
    }
    function finish() {
      const pay = payoutOf(
        { se: s.se, items: s.items, released: run.released.length, cleared: new Set(run.path).size, won: stats.won },
        R.payout,
        (/** @type {string} */ id) => (data.ITEMS[id] && data.ITEMS[id].price) || 0
      );
      Object.assign(stats, {
        days: run.clock,
        places: run.path.length,
        se: s.se,
        capital: pay.capital,
        party: s.team.length,
        top: Math.max(...s.team.map((/** @type {any} */ m) => m.lvl)),
      });
      log.end = { ...stats, uids: run.uidN };
      return { log, stats: /** @type {any} */ (stats) };
    }
  }

  /** many runs (SIM0, SIM1, ...): the numbers the owner's first play will be read against (report only)
   * @param {number} [n] @param {SimOptions} [o] */
  function runStats(n = 50, o = {}) {
    /** @type {any[]} */
    const all = [];
    for (let k = 0; k < n; k++) all.push(runSim(`SIM${k}`, o).stats);
    const avg = (/** @type {(x: any) => number} */ f) =>
        Math.round((all.reduce((a, x) => a + f(x), 0) / all.length) * 10) / 10,
      /** @type {Record<string, number>} */
      lost = {};
    for (const x of all) if (!x.won) lost[x.lostAt || 'end'] = (lost[x.lostAt || 'end'] || 0) + 1;
    return {
      runs: n,
      won: all.filter(x => x.won).length,
      lostAt: lost,
      days: avg(x => x.days),
      places: avg(x => x.places),
      battles: avg(x => x.battles),
      turnsPerBattle:
        Math.round(
          (all.reduce((a, x) => a + x.turns, 0) /
            Math.max(
              1,
              all.reduce((a, x) => a + x.battles, 0)
            )) *
            10
        ) / 10,
      caught: avg(x => x.caught),
      healed: avg(x => x.healed),
      moneyLeft: avg(x => x.se),
      capital: avg(x => x.capital),
      topLevel: avg(x => x.top),
    };
  }

  return { runSim, runStats };
}
