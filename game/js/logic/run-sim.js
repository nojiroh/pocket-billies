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
 * @typedef {{ random?: number, fights?: number, team?: number, pack?: number, unlocks?: 'none' | 'all',
 *   policy?: string, scenes?: 'make' | 'skip' }} SimOptions
 */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  MAX_TURNS: [() => MAX_TURNS],
  SIM_LITE_PLACE: [() => SIM_LITE_PLACE],
  SIM_NOTE: [() => SIM_NOTE],
  SIM_POLICIES: [() => SIM_POLICIES],
  SIM_POLICY: [() => SIM_POLICY],
  SIM_POLICY_DRIVEN: [() => SIM_POLICY_DRIVEN],
  brief: [() => brief],
  // @ts-expect-error -- replaced on purpose
  runSimOn: [() => runSimOn, v => (runSimOn = v)],
  // @ts-expect-error -- replaced on purpose
  simPolicy: [() => simPolicy, v => (simPolicy = v)],
  // @ts-expect-error -- replaced on purpose
  simRelicChoice: [() => simRelicChoice, v => (simRelicChoice = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** a guard against a battle that never ends in the simulation: the game itself ends one at rules.json battle.turnCap
 * (battle-engine.js turnCapCheck), so this is never reached by a battle the game plays */
export const MAX_TURNS = 60;
/**
 * Studio plan T3.2: the player's part, the bot policy. Every number the simulation uses that isn't the game's own rule is
 * here, by name, and every report names the policy and its settings: the results measure this bot, not a player.
 * - home: who comes from home: the highest-level Billies, as many as rules.json run.home lets (the page's start
 *   sheet picks the buddy by default)
 * - fights: wild Billies fought in a place, at most (the first of its stock; `fights` in the options)
 * - fightAbove: no wild fight while the party's HP is below this share of its full HP
 * - potionBelow: a Potion (taxbreak) on a Billie below this share of its HP, before each wild fight
 * - clinic: a town's clinic whenever someone is hurt and the money is there
 * - penniesUpTo, reserve: Copper Coins bought in a town shop up to this many held, keeping this much money
 * - taxWhileBelow: one throw at a wild Billie (not an Alpha) while the party is smaller than this
 * - ring: the throw's ring timing (0 to 1, the page's ring phase; 0.5: a "Great throw")
 * - lane: the next place drawn from the run's seed among the ones linked ahead (never back)
 * - keep: on a loss, the highest-level Billie comes home
 * - relics: Perks (Studio plan T3.3). 'greedy': the pick after a mini-boss takes the rarest offered (the lowest
 *   rules.json run.relics.rarity weight, then by id), and a town shop's Perk is bought when the money is there
 *   beyond `reserve`; past the cap only for a rarer one than the plainest held, which is let go. 'never': none taken
 *   or bought (the "never pick" baseline)
 */
export const SIM_POLICY = Object.freeze({
  name: 'greedy-forward',
  home: 'top-level',
  fights: 2,
  fightAbove: 0.7,
  potionBelow: 0.6,
  clinic: 'when-hurt',
  penniesUpTo: 5,
  reserve: 100,
  taxWhileBelow: 3,
  ring: 0.5,
  lane: 'seeded',
  keep: 'top-level',
  relics: 'greedy',
});
/** the named policies a report can be asked for (`policy` in the options; greedy-forward by default) */
export const SIM_POLICIES = Object.freeze({
  'greedy-forward': SIM_POLICY,
  'never-pick': Object.freeze({ ...SIM_POLICY, name: 'never-pick', relics: 'never' }),
});
/** the policy a run plays with these options (`fights` is the CLI's --fights) @param {SimOptions} o */
export function simPolicy(o) {
  const P = o.policy ? /** @type {Record<string, any>} */ (SIM_POLICIES)[o.policy] : SIM_POLICY;
  if (!P) throw new Error(`no simulation policy ${o.policy} (${Object.keys(SIM_POLICIES).join(', ')})`);
  return { ...P, ...(o.fights != null ? { fights: o.fights } : {}) };
}
/**
 * The policy's answer to a Perk on offer (the pick's, or a shop's): which to take of `offer` and which held one to
 * let go past the cap, or null to take none. 'greedy': the rarest (lowest rarity weight), then by id; past the cap
 * only if it is rarer than the plainest held (the highest weight, then the last by id), which goes.
 * @param {string[]} offer @param {string[]} held @param {Record<string, any>} relics
 * @param {{ cap: number, rarity: Record<string, number> }} rule @param {{ relics: string }} P
 * @returns {{ id: string, drop?: string } | null}
 */
export function simRelicChoice(offer, held, relics, rule, P) {
  if (P.relics !== 'greedy' || !offer.length) return null;
  const w = (/** @type {string} */ id) => rule.rarity[relics[id].rarity] || 0,
    order = (/** @type {string} */ a, /** @type {string} */ b) => w(a) - w(b) || (a < b ? -1 : a > b ? 1 : 0),
    id = offer.slice().sort(order)[0];
  if (held.length < rule.cap) return { id };
  const drop = held.slice().sort(order).pop();
  return drop && w(id) < w(drop) ? { id, drop } : null;
}
/** the report's numbers that say more about the policy than about the game's balance */
export const SIM_POLICY_DRIVEN = Object.freeze(['caught', 'healed', 'spent', 'moneyLeft', 'relics']);
/** what every report says its numbers are good for */
export const SIM_NOTE =
  'A bot policy, not a player: a regression detector, not a balance oracle (legacy stand-in species).';
/**
 * Studio plan T3.3, balance mode (`scenes: 'skip'`): no place's scene is made (run-scenes.js runScenesMake is ~98% of a
 * run's time). The logic reads one thing off a run place's scene: whether its ground has tall grass, which decides
 * whether a town has wild Billies (rules.js encounterStock). In balance mode each place is a lite map (the game's own
 * kind: `_lite.tiles` names the ground kinds a map uses) whose ground has tall grass: every run place has had it
 * (344 of 344 towns, 650 of 650 routes over 80 maps, no unlocks and every one; Phase 3b). The equality test
 * (tools/test/run-sim.test.mjs) plays the same seeds in both modes and fails if that ever stops being true.
 */
export const SIM_LITE_PLACE = Object.freeze({ tiles: 't' });
/** @param {any} m */
export const brief = m => `${m.sp}:${m.lvl}:${m.hp}`;

/** the simulation on a set of loaded logic and data: runSim and runStats @param {SimEnv} env */
export function runSimOn(env) {
  const { modules, fn, hooks, data, gameData: GAME_DATA, logic } = env;
  const { simBanner, simDataHash, simSeeds, simSummary } = modules['sim-compare'];
  const { RULES, TRAINERS } = data;
  const R = RULES.run,
    { runArrive, runNext, runWorldNode, runWeather } = modules['run-map'],
    { runByTier, runEnd } = modules['run-state'],
    { runScenesMake, runWorldTables } = modules['run-scenes'],
    { runArriveFx, runFoes, runBattleExtra, runClinic, runItemPrice, runKept, runShopOpen } = modules['run-loop'],
    { fxOfRun, fxPayoutRates, fxRunPrice } = modules.effects,
    { runStartOn, runStartPlan } = modules['run-start'],
    { runRegionData } = modules['run-region'],
    { runUnlocks } = modules.unlocks,
    { relicBuy, relicChoose, relicPrice, relicShelf } = modules.relics;
  const MAP_DATA = {
      nodeTypes: GAME_DATA.nodeTypes,
      biomes: GAME_DATA.biomes,
      rules: R,
      region: runRegionData(GAME_DATA, TRAINERS),
    },
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
   * `fights` of a place's wild Billies while the party is above 70% of its HP (a Potion on a Billie below 60%; catch the
   * first ones while the party is small), heal in towns when hurt, keep a few Copper Coins, beat the mini-boss, then
   * the boss. It starts as the mast does: the highest-level Billies from home (rules.json run.home at Expedition I;
   * `team` is how many starters wait at home) and a bag packed with Potions from home (`pack` of them at home, as many
   * as run.pack lets).
   * @param {string} seed @param {SimOptions} [o]
   */
  function runSim(seed, o = {}) {
    if (env.beforeRun) env.beforeRun(o);
    const P = simPolicy(o);
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
    const balance = o.scenes === 'skip',
      scenes = balance ? null : runScenesMake(run, worldData()),
      W = runWorldTables(run, data.LOCATIONS[0], worldData()),
      foes = runFoes(run, { leaders: Object.values(TRAINERS).filter((/** @type {any} */ T) => T.miniboss), rules: R });
    data.worldPut({
      ...W,
      maps: Object.fromEntries(
        W.locations
          .slice(1)
          .map((/** @type {any} */ p, /** @type {number} */ i) => [
            p.mapId,
            scenes ? scenes[i] : { _lite: { ...SIM_LITE_PLACE } },
          ])
      ),
      trainers: foes,
    });
    /** @type {any} */
    const log = {
        seed,
        unlocks: run.unlocks,
        /* the map as runStartPlan made it: each node's type and biome */
        nodes: run.map.nodes.map((/** @type {any} */ n) => `${n.type}:${n.biome}`),
        scenes: scenes ? scenes.map((/** @type {any} */ sc) => sc.gen.seed) : null,
        ...(balance ? { mode: 'balance' } : {}),
        places: [],
      },
      stats = {
        battles: 0,
        turns: 0,
        caught: 0,
        healed: 0,
        spent: 0,
        won: false,
        lostAt: '',
        /** the lost place's row on the map (null: not lost there) @type {number | null} */
        lostRow: null,
        /** money in by where it came from, and out by what it paid for (Studio plan T3.4) */
        moneyIn: { prize: 0, reward: 0 },
        moneyOut: { heal: 0, shop: 0, relics: 0 },
        /** each run foe fought: its leader, its node's type, won or not @type {any[]} */
        foes: [],
        /** @type {any} */ days: 0,
      };
    try {
      runArrive(s, 0, MAP_DATA);
      let i = 0,
        fxHealed = 0;
      for (;;) {
        const node = run.map.nodes[i],
          wn = runWorldNode(i),
          /** @type {any} */
          at = { i, type: node.type, day: run.clock, weather: runWeather(run, i, run.clock), battles: [] };
        if (fxHealed) at.fxHealed = fxHealed;
        log.places.push(at);
        /* a town: heal when hurt, then the day's shop (Copper Coins up to five) */
        if (node.type === 'town') {
          const { paid } = runClinic(s, fxRunPrice(run, data.RELICS, 'heal', R.healCost));
          if (paid) {
            stats.healed += paid;
            stats.moneyOut.heal += paid;
            at.healed = paid;
          }
          /* the day's wares as the shop opens them: only what the run has unlocked (run-loop.js runShopOpen) */
          const stock = runShopOpen(run, i, run.clock, R.shop, UNLOCK_DATA);
          /* the shop's Perk, drawn as the shop opens (relics.js relicShelf), bought as the policy says, keeping the
             reserve (shop.js shopRelicBuy: its price with the price rows) */
          const shelf = relicShelf(run, i, run.clock, data.RELICS, R.relics);
          if (shelf) {
            const cost = fxRunPrice(run, data.RELICS, 'shop', relicPrice(data.RELICS[shelf], R.relics)),
              c = s.se >= cost + P.reserve ? simRelicChoice([shelf], run.relics, data.RELICS, R.relics, P) : null;
            at.relic = { id: shelf, price: cost };
            if (c && !relicBuy(run, i, run.clock, data.RELICS, R.relics, c.drop)) {
              s.se -= cost;
              stats.spent += cost;
              stats.moneyOut.relics += cost;
              at.relic.bought = c.drop ? { drop: c.drop } : 1;
            }
          }
          at.shop = stock.map((/** @type {any} */ w) => w.coin || w.item);
          /* the shop's price, with the Perks' price rows (shop.js warePrice) */
          const price = fxRunPrice(run, data.RELICS, 'shop', data.COINS.penny.price);
          while (
            stock.some((/** @type {any} */ w) => w.coin === 'penny') &&
            (s.coins.penny || 0) < P.penniesUpTo &&
            s.se >= price + P.reserve
          ) {
            s.se -= price;
            s.coins.penny = (s.coins.penny || 0) + 1;
            stats.spent += price;
            stats.moneyOut.shop += price;
          }
        }
        /* the place's wild Billies, up to `fights` of them */
        const stock = fn('encountersHere')(wn).slice(0, P.fights);
        at.stock = stock.map((/** @type {any} */ q) => `${q.sp}:${q.lvl}${q.alpha ? 'A' : ''}`);
        for (const q of stock) {
          /* a careful player: a Potion on a Billie below 60%, and no wild fight while the party is below 70% */
          for (const m of s.team)
            if (m.hp > 0 && m.hp < fn('maxHp')(m) * P.potionBelow && (s.items.taxbreak || 0) > 0)
              fn('applyItem')('taxbreak', m.uid, false); /* the bag's use out of battle, as the page's */
          const hp = s.team.reduce((/** @type {number} */ a, /** @type {any} */ m) => a + m.hp, 0),
            full = s.team.reduce((/** @type {number} */ a, /** @type {any} */ m) => a + fn('maxHp')(m), 0);
          if (hp < full * P.fightAbove) break;
          /* started as the page starts it (battle-engine.js startWild), with the run's seed, weather and Perks; its
             number is taken once it has begun, as run.js runBattleStart does */
          const k = run.battleN;
          fn('startWild')(q, {
            host: SIM_HOST,
            extra: runBattleExtra(run, i, k, RULES.env, fxOfRun(run, data.RELICS)),
          });
          if (!hooks.activeBattle) break;
          run.battleN = k + 1;
          const foe = hooks.activeBattle.sides[1].team[0];
          const B = hooks.activeBattle;
          let res;
          /* catch it while the party is small and there are coins: one throw, then fight on */
          if (s.team.length < P.taxWhileBelow && (s.coins.penny || 0) > 0 && !q.alpha) {
            s.coins.penny--;
            const c = fn('catchRoll')('penny', 1 + logic.CATCH_RULES.ring * P.ring, false); /* doThrow's T */
            if (c.caught) {
              fn('catchKeep')(foe);
              stats.caught++;
              res = { over: 'caught', turns: B.turn };
            } else {
              /* a miss: the foe's turn */
              fn('enemyOnly')();
            }
          }
          res = res || playOut();
          /* its end on the save as the page's endBattle does it (battle-rewards.js battleSettle, battleSettleWin) */
          B.over = res.over;
          const { pay } = fn('battleSettle')(B, s);
          fn('battleSettleWin')(B, s, pay, run);
          if (pay.o === 'win' && pay.prize > 0) stats.moneyIn.prize += pay.prize;
          hooks.provide({ activeBattle: null });
          hooks.uiState.learnQ.length = 0;
          stats.battles++;
          stats.turns += res.turns;
          at.battles.push({ k, foe: brief(foe), over: res.over, turns: res.turns, team: s.team.map(brief) });
          if (pay.o === 'lose') return lose(node);
        }
        /* its trainer: a mini-boss (doubles), the boss (an Alpha) */
        const T = Object.values(foes).find((/** @type {any} */ F) => F.runNode === i);
        if (T) {
          if (!s.team.some((/** @type {any} */ m) => m.hp > 0)) return lose(node);
          /* its team, format and market as the page starts it (battle-engine.js startTrainer: the boss is its leader's
             top Billie alone, as an Alpha) */
          const k = run.battleN;
          fn('startTrainer')(T.id, {
            host: SIM_HOST,
            extra: runBattleExtra(run, i, k, RULES.env, fxOfRun(run, data.RELICS)),
          });
          run.battleN = k + 1;
          const team = hooks.activeBattle.sides[1].team;
          const res = playOut(),
            B = hooks.activeBattle;
          B.over = res.over;
          const { pay } = fn('battleSettle')(B, s);
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
          stats.foes.push({ leader: T.from, type: node.type, won: pay.o === 'win' });
          if (pay.o !== 'win') return lose(node);
          /* its reward and flag; a mini-boss also makes the run's next pick of Perks (not answered yet) */
          fn('battleSettleWin')(B, s, pay, run);
          stats.moneyIn.reward += pay.reward;
          /* the pick it made, answered as the policy says (relic-screen.js relicPickDone: relics.js relicChoose) */
          if (run.offer) {
            const c = simRelicChoice(run.offer, run.relics, data.RELICS, R.relics, P);
            at.pick = { offer: run.offer.slice(), took: c ? c.id : null, ...(c && c.drop ? { drop: c.drop } : {}) };
            relicChoose(run, c ? c.id : null, data.RELICS, R.relics, c ? c.drop : undefined);
          }
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
        /* walking in: the Perks' heal rows (run-loop.js runArriveFx, as walk-control.js through runArrivedFx) */
        fxHealed = runArriveFx(s, data.RELICS);
      }
    } finally {
      data.worldHubBack();
    }
    /** the run lost at this node @param {any} node */
    function lose(node) {
      stats.lostAt = node.type;
      stats.lostRow = node.row;
      return finish();
    }
    function finish() {
      /* the end as the payout screen's "Fly home" (run.js runEndHome): the whole party on a win, else the one the
         policy keeps (the highest level, the first of them); the Perks' payout rates; runEnd pays and puts the
         hub's fields back, so the run's own numbers are read first */
      const se = s.se,
        party = s.team.length,
        top = s.team.reduce((/** @type {any} */ a, /** @type {any} */ m) => (m.lvl > a.lvl ? m : a), s.team[0]),
        keep = runKept(s.team, stats.won, top ? top.uid : null),
        pay = runEnd(s, { won: stats.won, keep }, fxPayoutRates(fxOfRun(run, data.RELICS), R.payout), runItemPrice);
      Object.assign(stats, {
        days: run.clock,
        places: run.path.length,
        se,
        capital: pay.capital,
        party,
        top: top ? top.lvl : 0,
        relics: run.relics.slice(),
      });
      log.end = { ...stats, uids: run.uidN };
      return { log, stats: /** @type {any} */ (stats) };
    }
  }

  /** many runs (SIM0, SIM1, ...): the numbers the owner's first play will be read against (report only)
   * @param {number} [n] @param {SimOptions} [o] */
  function runStats(n = 50, o = {}) {
    return runStatsOf(
      simSeeds(n).map(seed => runSim(seed, o).stats),
      o
    );
  }
  /** the report's averages over runs' stats @param {any[]} all @param {SimOptions} o */
  function runStatsOf(all, o) {
    const n = all.length,
      avg = (/** @type {(x: any) => number} */ f) =>
        Math.round((all.reduce((a, x) => a + f(x), 0) / all.length) * 10) / 10,
      /** @type {Record<string, number>} */
      lost = {};
    for (const x of all) if (!x.won) lost[x.lostAt || 'end'] = (lost[x.lostAt || 'end'] || 0) + 1;
    return {
      runs: n,
      /* the honesty rules (Studio plan Part 3): the bot that played, and what its numbers are good for */
      policy: simPolicy(o),
      policyDriven: SIM_POLICY_DRIVEN.slice(),
      note: SIM_NOTE,
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

  /**
   * Studio plan T3.4: a report over a seed list, the shape the CLI writes (--out) and compares (--compare) and the Run
   * Lab's Simulate card shows: runStats's numbers, the seeds and options, the data's hash, every run's stats in the
   * seeds' order (`results`) and their summary (sim-compare.js simSummary).
   * @param {string[]} seeds @param {SimOptions} [o] the options every run is played with (`random` aside)
   */
  function runReport(seeds, o = {}) {
    const results = seeds.map(seed => runSim(seed, o).stats);
    return {
      kind: 'pb-sim-report',
      version: 1,
      ...runStatsOf(results, o),
      banner: simBanner(simPolicy(o)),
      mode: o.scenes === 'skip' ? 'balance' : 'full',
      options: { ...o },
      dataHash: simDataHash(GAME_DATA),
      seeds: seeds.slice(),
      results,
      summary: simSummary(results),
    };
  }

  return { runSim, runStats, runReport };
}
