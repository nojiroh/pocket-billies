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
 * @typedef {{ random?: number, fights?: number, team?: number, pack?: number, unlocks?: 'none' | 'all', residents?: 'none' | 'all',
 *   policy?: string, scenes?: 'make' | 'skip', expedition?: number, mods?: string[], lvl?: number,
 *   badges?: 'none' | 'all' }} SimOptions
 */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  MAX_TURNS: [() => MAX_TURNS],
  SIM_CLOCK: [() => SIM_CLOCK],
  SIM_LITE_PLACE: [() => SIM_LITE_PLACE],
  SIM_NOTE: [() => SIM_NOTE],
  SIM_POLICIES: [() => SIM_POLICIES],
  SIM_POLICY: [() => SIM_POLICY],
  SIM_POLICY_DRIVEN: [() => SIM_POLICY_DRIVEN],
  brief: [() => brief],
  // @ts-expect-error -- replaced on purpose
  runSimOn: [() => runSimOn, v => (runSimOn = v)],
  // @ts-expect-error -- replaced on purpose
  simPerkChoice: [() => simPerkChoice, v => (simPerkChoice = v)],
  // @ts-expect-error -- replaced on purpose
  simPolicy: [() => simPolicy, v => (simPolicy = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** a guard against a battle that never ends in the simulation: the game itself ends one at rules.json battle.turnCap
 * (battle-engine.js turnCapCheck), so this is never reached by a battle the game plays */
export const MAX_TURNS = 60;
/**
 * Studio plan T3.2: the player's part, the bot policy. Every number the simulation uses that isn't the game's own rule is
 * here, by name, and every report names the policy and its settings: the results measure this bot, not a player.
 * - home: who comes from home: the dearest Billies the starter-point budget affords (RL-13, logic/starter-points.js
 *   pointPick, as the start sheet's default pick), out of the `team` at the ranch
 * - fights: wild Billies fought in a place, at most (the first of its stock; `fights` in the options)
 * - fightAbove: no wild fight while the party's HP is below this share of its full HP
 * - potionBelow: a Potion (potion) on a Billie below this share of its HP, before each wild fight
 * - clinic: a town's clinic whenever someone is hurt and the money is there
 * - pyramidsUpTo, reserve: Pyramids bought in a town shop up to this many held, keeping this much money
 * - catchWhileBelow: one throw at a wild Billie (not an Alpha) while the party is smaller than this
 * - ring: the throw's ring timing (0 to 1, the page's ring phase; 0.5: a "Great throw")
 * - lane: the next place drawn from the run's seed among the ones linked ahead (never back)
 * - keep: on a loss, the highest-level Billie comes home
 * - trainers: RT-2's route trainers: 'required+healthy' fights the ones by the road (you can't pass them unseen) and
 *   an optional one while the party is above `fightAbove`; 'required' only the ones by the road
 * - rewards: the pick after a route trainer: 'first-item' takes its first card that isn't a move to learn, else none
 * - perks: Perks (Studio plan T3.3). 'greedy': the pick after a mini-boss takes the rarest offered (the lowest
 *   rules.json run.perks.rarity weight, then in perks.json's order), and a town shop's Perk is bought when the money is there
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
  pyramidsUpTo: 5,
  reserve: 100,
  catchWhileBelow: 3,
  ring: 0.5,
  lane: 'seeded',
  keep: 'top-level',
  trainers: 'required+healthy',
  rewards: 'first-item',
  perks: 'greedy',
});
/**
 * RT-2: what a run's length is estimated from (a guess at a phone's pace, to compare data before and after, not a
 * measurement): seconds a place takes to walk, a battle's own (its start, its end and its pick), and each turn's
 */
export const SIM_CLOCK = Object.freeze({ placeS: 60, battleS: 15, turnS: 6 });
/** the named policies a report can be asked for (`policy` in the options; greedy-forward by default) */
export const SIM_POLICIES = Object.freeze({
  'greedy-forward': SIM_POLICY,
  'never-pick': Object.freeze({ ...SIM_POLICY, name: 'never-pick', perks: 'never' }),
});
/** the policy a run plays with these options (`fights` is the CLI's --fights) @param {SimOptions} o */
export function simPolicy(o) {
  const P = o.policy ? /** @type {Record<string, any>} */ (SIM_POLICIES)[o.policy] : SIM_POLICY;
  if (!P) throw new Error(`no simulation policy ${o.policy} (${Object.keys(SIM_POLICIES).join(', ')})`);
  return { ...P, ...(o.fights != null ? { fights: o.fights } : {}) };
}
/**
 * The policy's answer to a Perk on offer (the pick's, or a shop's): which to take of `offer` and which held one to
 * let go past the cap, or null to take none. 'greedy': the rarest (lowest rarity weight), then in perks.json's order; past the cap
 * only if it is rarer than the plainest held (the highest weight, then the last in perks.json's order), which goes.
 * @param {string[]} offer @param {string[]} held @param {Record<string, any>} perks
 * @param {{ cap: number, rarity: Record<string, number> }} rule @param {{ perks: string }} P
 * @returns {{ id: string, drop?: string } | null}
 */
export function simPerkChoice(offer, held, perks, rule, P) {
  if (P.perks !== 'greedy' || !offer.length) return null;
  const w = (/** @type {string} */ id) => rule.rarity[perks[id].rarity] || 0,
    at = Object.keys(perks),
    order = (/** @type {string} */ a, /** @type {string} */ b) => w(a) - w(b) || at.indexOf(a) - at.indexOf(b),
    id = offer.slice().sort(order)[0];
  if (held.length < rule.cap) return { id };
  const drop = held.slice().sort(order).pop();
  return drop && w(id) < w(drop) ? { id, drop } : null;
}
/** the report's numbers that say more about the policy than about the game's balance */
export const SIM_POLICY_DRIVEN = Object.freeze(['caught', 'healed', 'spent', 'moneyLeft', 'perks']);
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
    { fieldBadgeKey, fieldMoveState, runSideOpen } = modules['run-side'],
    MOVES = (GAME_DATA.fieldMoves && GAME_DATA.fieldMoves.moves) || {},
    { runByExpedition, runEnd } = modules['run-state'],
    { runScenesMake, runWorldTables } = modules['run-scenes'],
    { eventAt } = modules.encounters,
    { runArriveFx, runBuyFx, runFoes, runBattleExtra, runClinic, runItemPrice, runKept, runShopOpen } =
      modules['run-loop'],
    { fxOfRun, fxPayoutRates, fxRunPrice } = modules.effects,
    { runStartOn, runStartPlan } = modules['run-start'],
    { runRegionData } = modules['run-region'],
    { runUnlocks } = modules.unlocks,
    { routeTrainerTally, runRouteTrainers } = modules['route-trainers'],
    { rewardDataGame, rewardTake } = modules.rewards,
    { perkBuy, perkChoose, perkPrice, perkShelf, perkTeamOf } = modules.perks,
    { pointBudget, pointPick } = modules['starter-points'],
    { modTypeFits } = modules.modifiers,
    { residentCandidate } = modules.residents,
    { questDataOf, residentPlan } = modules['run-quests'];
  const MAP_DATA = {
      nodeTypes: GAME_DATA.nodeTypes,
      biomes: GAME_DATA.biomes,
      rules: R,
      region: runRegionData(GAME_DATA, TRAINERS),
      /* RL-R2b: the field moves, so a run has its side area as the game's does */
      fieldMoves: MOVES,
    },
    UNLOCK_DATA = { unlocks: GAME_DATA.unlocks, buildings: GAME_DATA.buildings };
  const worldData = () => ({
    nodeTypes: GAME_DATA.nodeTypes,
    biomes: GAME_DATA.biomes,
    pools: data.POOLS,
    scenery: GAME_DATA.scenery,
    rules: R,
    fieldMoves: MOVES,
    /* RT-3: the set pieces, so a run's places are the game's */
    setPieces: GAME_DATA.setPieces || null,
    /* WM-7: the leaders' arenas, themed by the region's leaders' types */
    arenas: GAME_DATA.arenas || null,
    region: runRegionData(GAME_DATA, TRAINERS),
  });
  /** RS-2: the run's resident and their towns (run-quests.js residentPlan), or null
   * @param {any} s the save on its run @param {any[] | null} scenes @param {Record<string, any>} route */
  const simResident = (s, scenes, route) => {
    const run = s.run,
      qd = scenes
        ? questDataOf(run, scenes, route, data.QUESTS, data.SPECIES)
        : {
            ...questDataOf(run, [], route, data.QUESTS, data.SPECIES),
            boards: run.map.nodes.flatMap((/** @type {any} */ n, /** @type {number} */ i) =>
              n.type === 'town' ? [i] : []
            ),
          },
      plan = residentPlan(s, data.RESIDENTS, qd);
    return plan ? { id: plan.id, towns: plan.towns } : null;
  };
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
   * first ones while the party is small), heal in towns when hurt, keep a few Pyramids, beat the mini-boss, then
   * the boss. It starts as the mast does: the Billies the starter points afford (RL-13: rules.json run.points at the
   * run's Expedition, logic/starter-points.js pointPick;
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
    /* RL-13: `lvl` is the level the ranch has trained them to (it costs starter points); the starter's own level
       by default */
    const lvl = Math.max(1, Math.floor(o.lvl || RULES.start.starterLevel));
    s.team.push(fn('makeBilly')(s.starter + '0', lvl));
    for (let k = 1; k < (o.team ?? 1); k++) s.team.push(fn('makeBilly')(s.starter + '0', lvl));
    s.items.potion = o.pack ?? 0;
    const expedition = Math.max(1, Math.floor(o.expedition || 1)),
      /* RL-13: the starter points the Expedition's budget buys, the dearest first (the start sheet's default pick) */
      home = pointPick(
        [...s.team, ...(s.box || [])],
        data.SPECIES,
        R.points,
        pointBudget(R.points, expedition),
        { mods: o.mods || [] },
        s.buddy
      ).map((/** @type {any} */ m) => m.uid),
      pack = { items: { potion: Math.min(o.pack ?? 0, runByExpedition(R.pack, 1)) }, pyramids: {} };
    /* Studio plan T2.1: started as the mast starts a run (logic/run-start.js), with what the save has unlocked: none (a
       fresh save, the default) or every unlock (unlocks: 'all') */
    if (o.unlocks === 'all') for (const id of Object.keys(UNLOCK_DATA.unlocks)) s.meta.unlocks[id] = 1;
    /* RS-4: the residents: none (a fresh save, the default) or everyone with a service moved in at their top level
       (residents: 'all'), so their power levels ride along as the takeoff gives them (logic/residents.js) */
    if (o.residents === 'all')
      for (const [id, r] of Object.entries(GAME_DATA.residents || {}))
        if (/** @type {any} */ (r).service) {
          s.meta.residents[id] = 1;
          for (const u of /** @type {any} */ (r).levels) s.meta.unlocks[u] = 1;
        }
    /* RL-R2b: the badges kept: none (a fresh save, the default: the side area stays shut) or every field move's
       (badges: 'all') */
    if (o.badges === 'all') for (const M of Object.values(MOVES)) s.meta.badges[fieldBadgeKey(M.type)] = 1;
    const run = runStartOn(
      s,
      runStartPlan(
        seed,
        { ...MAP_DATA, unlockData: UNLOCK_DATA },
        { unlocks: runUnlocks(s, UNLOCK_DATA), expedition, mods: o.mods || [] }
      ),
      { home, pack }
    );
    const balance = o.scenes === 'skip',
      scenes = balance ? null : runScenesMake(run, worldData()),
      W = runWorldTables(run, data.LOCATIONS[0], worldData()),
      foes = runFoes(run, { leaders: Object.values(TRAINERS).filter((/** @type {any} */ T) => T.miniboss), rules: R }),
      /* RT-2: the route trainers, and the wild Billies they stand in for (as run-world.js puts them) */
      route = runRouteTrainers(run, {
        classes: data.EVENTS.classes,
        species: data.SPECIES,
        rules: R,
        arenas: GAME_DATA.arenas || null,
      }),
      tally = routeTrainerTally(route);
    for (const L of W.locations) if (L.runNode != null && tally[L.runNode]) L.trainerCount = tally[L.runNode];
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
      trainers: { ...foes, ...route },
    });
    /** @type {any} */
    const log = {
        seed,
        unlocks: run.unlocks,
        /* the map as runStartPlan made it: each node's type and biome */
        nodes: run.map.nodes.map((/** @type {any} */ n) => `${n.type}:${n.biome}`),
        scenes: scenes ? scenes.map((/** @type {any} */ sc) => sc.gen.seed) : null,
        ...(balance ? { mode: 'balance' } : {}),
        /* RS-2: the run's resident and their towns, as run-world.js places them (balance mode: every town counted as
           having its notice board); the bot does no favour, so it changes nothing else */
        resident: simResident(s, scenes, route),
        places: [],
      },
      stats = {
        battles: 0,
        /** RT-2: route trainers fought (a pair is one battle) */
        trainers: 0,
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
        moneyOut: { heal: 0, shop: 0, perks: 0 },
        /** each run foe fought: its leader, its node's type, won or not @type {any[]} */
        foes: [],
        /** @type {any} */ days: 0,
        /** SP-3: wild splices fought, caught, and what beating them banked (DNA, Genes sampled for the first time) */
        splices: 0,
        caughtSpliced: 0,
        dna: 0,
        genes: 0,
        /** SP-5: Escaped specimens fought */
        escaped: 0,
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
        /* RL-12b: a waystation: the event its stand holds, noted (the bot walks past it: no option is played) */
        if (node.type === 'event')
          at.event = eventAt(run, i, data.EVENTS, undefined, !!residentCandidate(s, data.RESIDENTS, 'event')) || null;
        /* RS-2: walked into the resident's town */
        if (log.resident && log.resident.towns.includes(i)) at.resident = log.resident.id;
        /* a town: heal when hurt; a town or a stall (RL-12b, nodeTypes.json shop): the day's shop (Pyramids up to
           five) */
        if (node.type === 'town') {
          const { paid } = runClinic(s, fxRunPrice(run, data.PERKS, 'heal', R.healCost));
          if (paid) {
            stats.healed += paid;
            stats.moneyOut.heal += paid;
            at.healed = paid;
          }
        }
        if (GAME_DATA.nodeTypes[node.type] && GAME_DATA.nodeTypes[node.type].shop) {
          /* the day's wares as the shop opens them: only what the run has unlocked (run-loop.js runShopOpen) */
          const stock = runShopOpen(run, i, run.clock, R.shop, UNLOCK_DATA);
          /* the shop's Perk, drawn as the shop opens (perks.js perkShelf), bought as the policy says, keeping the
             reserve (shop.js shopPerkBuy: its price with the price rows) */
          const shelf = perkShelf(run, i, run.clock, data.PERKS, R.perks, perkTeamOf(s.team));
          if (shelf) {
            const cost = fxRunPrice(run, data.PERKS, 'shop', perkPrice(data.PERKS[shelf], R.perks)),
              c = s.se >= cost + P.reserve ? simPerkChoice([shelf], run.perks, data.PERKS, R.perks, P) : null;
            at.relic = { id: shelf, price: cost };
            if (c && !perkBuy(run, i, run.clock, data.PERKS, R.perks, c.drop, s)) {
              s.se -= cost;
              /* PK-1: the buy moment (shop.js shopPerkBuy) */
              runBuyFx(s, data.PERKS);
              stats.spent += cost;
              stats.moneyOut.perks += cost;
              at.relic.bought = c.drop ? { drop: c.drop } : 1;
            }
          }
          at.shop = stock.map((/** @type {any} */ w) => w.coin || w.item);
          /* the shop's price, with the Perks' price rows (shop.js warePrice) */
          const price = fxRunPrice(run, data.PERKS, 'shop', data.PYRAMIDS.pyramid.price);
          while (
            stock.some((/** @type {any} */ w) => w.coin === 'pyramid') &&
            (s.pyramids.pyramid || 0) < P.pyramidsUpTo &&
            s.se >= price + P.reserve
          ) {
            s.se -= price;
            s.pyramids.pyramid = (s.pyramids.pyramid || 0) + 1;
            /* PK-1: the buy moment (shop.js shopBuy) */
            runBuyFx(s, data.PERKS);
            stats.spent += price;
            stats.moneyOut.shop += price;
          }
        }
        /* RT-2: its route trainers, in the order they stand: the required ones always, an optional one as the policy
           says; their pick answered as the policy says (rewards.js rewardTake) */
        for (const T of Object.values(route)
          .filter((/** @type {any} */ F) => F.runNode === i && !s.flags[F.id])
          .sort((/** @type {any} */ a, /** @type {any} */ b) => a.route.k - b.route.k)) {
          if (T.route.opt) {
            const hp = s.team.reduce((/** @type {number} */ a, /** @type {any} */ m) => a + m.hp, 0),
              full = s.team.reduce((/** @type {number} */ a, /** @type {any} */ m) => a + fn('maxHp')(m), 0);
            if (P.trainers === 'required' || hp < full * P.fightAbove) continue;
          }
          if (!s.team.some((/** @type {any} */ m) => m.hp > 0)) return lose(node);
          const k = run.battleN;
          fn('startTrainer')(T.id, {
            host: SIM_HOST,
            extra: runBattleExtra(run, i, k, RULES.env, fxOfRun(run, data.PERKS)),
          });
          if (!hooks.activeBattle) continue;
          run.battleN = k + 1;
          const team = hooks.activeBattle.sides[1].team,
            res = playOut(),
            B = hooks.activeBattle;
          B.over = res.over;
          const { pay } = fn('battleSettle')(B, s);
          hooks.provide({ activeBattle: null });
          hooks.uiState.learnQ.length = 0;
          stats.battles++;
          stats.trainers++;
          stats.turns += res.turns;
          at.battles.push({
            k,
            trainer: T.cls + (T.mate ? '+' + T.mate.cls : ''),
            foe: team.map(brief).join(','),
            over: res.over,
            turns: res.turns,
            team: s.team.map(brief),
          });
          if (pay.o !== 'win') return lose(node);
          fn('battleSettleWin')(B, s, pay, run);
          stats.moneyIn.reward += pay.reward;
          const pick = run.enc && run.enc.reward,
            c =
              pick && P.rewards === 'first-item'
                ? pick.cards.findIndex((/** @type {any} */ x) => x.kind !== 'tutor')
                : -1;
          if (pick) rewardTake(run, s, c >= 0 ? c : null, rewardDataGame(s.team));
        }
        /* the place's wild Billies, up to `fights` of them */
        const stock = fn('encountersHere')(wn).slice(0, P.fights);
        at.stock = stock.map((/** @type {any} */ q) => `${q.sp}:${q.lvl}${q.alpha ? 'A' : ''}`);
        for (const q of stock) {
          /* a careful player: a Potion on a Billie below 60%, and no wild fight while the party is below 70% */
          for (const m of s.team)
            if (m.hp > 0 && m.hp < fn('maxHp')(m) * P.potionBelow && (s.items.potion || 0) > 0)
              fn('applyItem')('potion', m.uid, false); /* the bag's use out of battle, as the page's */
          const hp = s.team.reduce((/** @type {number} */ a, /** @type {any} */ m) => a + m.hp, 0),
            full = s.team.reduce((/** @type {number} */ a, /** @type {any} */ m) => a + fn('maxHp')(m), 0);
          if (hp < full * P.fightAbove) break;
          /* started as the page starts it (battle-engine.js startWild), with the run's seed, weather and Perks; its
             number is taken once it has begun, as run.js runBattleStart does */
          const k = run.battleN;
          fn('startWild')(q, {
            host: SIM_HOST,
            extra: runBattleExtra(run, i, k, RULES.env, fxOfRun(run, data.PERKS)),
          });
          if (!hooks.activeBattle) break;
          run.battleN = k + 1;
          const foe = hooks.activeBattle.sides[1].team[0];
          const B = hooks.activeBattle;
          if (q.graft) stats.splices++;
          if (q.aug) stats.escaped++;
          let res;
          /* catch it while the party is small and there are pyramids: one throw, then fight on */
          if (
            s.team.length < P.catchWhileBelow &&
            (s.pyramids.pyramid || 0) > 0 &&
            !q.alpha &&
            /* RL-14: a bot is never caught */
            fn('catchable')(foe) &&
            /* RL-13: a mono-type run takes only its own type (logic/modifiers.js) */
            modTypeFits(run, data.SPECIES[q.sp] ? data.SPECIES[q.sp].types : [])
          ) {
            s.pyramids.pyramid--;
            const c = fn('catchRoll')('pyramid', 1 + logic.CATCH_RULES.ring * P.ring, false); /* doThrow's T */
            if (c.caught) {
              fn('catchKeep')(foe);
              stats.caught++;
              if (q.graft) stats.caughtSpliced++;
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
          const sampled = /** @type {{ dna?: number, sampled?: unknown[] }} */ (pay);
          stats.dna += sampled.dna || 0;
          stats.genes += (sampled.sampled || []).length;
          /* RL-14: a wild bot's salvage, answered as a trainer's pick is */
          const salvage = run.enc && run.enc.reward;
          if (salvage) rewardTake(run, s, P.rewards === 'first-item' ? 0 : null, rewardDataGame(s.team));
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
            extra: runBattleExtra(run, i, k, RULES.env, fxOfRun(run, data.PERKS)),
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
          /* the pick it made, answered as the policy says (perk-screen.js perkPickDone: perks.js perkChoose) */
          if (run.offer) {
            const c = simPerkChoice(run.offer, run.perks, data.PERKS, R.perks, P);
            at.pick = { offer: run.offer.slice(), took: c ? c.id : null, ...(c && c.drop ? { drop: c.drop } : {}) };
            perkChoose(run, c ? c.id : null, data.PERKS, R.perks, c ? c.drop : undefined, s);
          }
          if (node.type === 'boss') {
            stats.won = true;
            return finish();
          }
        }
        /* on: into the side area when its field move can be used here (the policy takes it), out by its way out
           at its last place, else a lane drawn from the seed */
        const next = runNext(run.map, i),
          side = simSideNext(run.map, i, s.meta.badges, simTypes());
        if (side) {
          if (side.open) {
            runSideOpen(run.map);
            log.side = { move: run.map.side.move, kind: run.map.side.kind };
          }
          i = side.to;
        } else if (!next.length) return finish();
        else i = next[modules.rng.rngFrom(seed, 'sim|path|' + i).int(0, next.length - 1)];
        runArrive(s, i, MAP_DATA);
        /* walking in: the Perks' heal rows (run-loop.js runArriveFx, as walk-control.js through runArrivedFx) */
        fxHealed = runArriveFx(s, data.PERKS);
      }
    } finally {
      data.worldHubBack();
    }
    /** the team's Billies standing, as the field moves read them (field-moves.js fieldTeam) */
    function simTypes() {
      return s.team
        .filter((/** @type {any} */ m) => m.hp > 0 && fn('speciesOf')(m))
        .map((/** @type {any} */ m) => ({ name: m.uid, types: fn('billyFieldTypes')(m) }));
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
        pay = runEnd(s, { won: stats.won, keep }, fxPayoutRates(fxOfRun(run, data.PERKS), R.payout), runItemPrice);
      Object.assign(stats, {
        days: run.clock,
        places: run.path.length,
        se,
        research: pay.research,
        party,
        top: top ? top.lvl : 0,
        perks: run.perks.slice(),
        /* RS-2: the run's resident, and whether the walk went through their town */
        resident: log.resident ? log.resident.id : null,
        metResident: log.places.some((/** @type {any} */ p) => p.resident) ? 1 : 0,
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
      trainers: avg(x => x.trainers || 0),
      /* RT-2: the estimated minutes a run takes (SIM_CLOCK: a guess, to compare before and after) */
      minutes: avg(x => (x.places * SIM_CLOCK.placeS + x.battles * SIM_CLOCK.battleS + x.turns * SIM_CLOCK.turnS) / 60),
      clock: { ...SIM_CLOCK },
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
      research: avg(x => x.research),
      topLevel: avg(x => x.top),
      /* RS-2: the runs whose walk went through their resident's town */
      metResident: all.filter(x => x.metResident).length,
      /* SP-3: wild splices fought and caught a run, the DNA and new Genes beating them banked */
      splices: avg(x => x.splices || 0),
      caughtSpliced: avg(x => x.caughtSpliced || 0),
      dna: avg(x => x.dna || 0),
      genes: avg(x => x.genes || 0),
      /* SP-5: Escaped specimens fought a run */
      escaped: avg(x => x.escaped || 0),
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

  /**
   * RL-R2b: the policy at a side area: from the obstacle's place into the side when its field move can be used (the
   * badge kept and a Billie of the type standing: `open`), from its last place out by its way out; else null (the
   * lane as usual) @param {any} map @param {number} i @param {Record<string, number>} badges
   * @param {{ name: string, types: string[] }[]} team @returns {{ to: number, open?: boolean } | null}
   */
  function simSideNext(map, i, badges, team) {
    const S = map.side;
    if (!S) return null;
    if (i === S.from && MOVES[S.move] && fieldMoveState(MOVES[S.move], badges, team).state === 'ask')
      return { to: S.nodes[0], open: true };
    if (i === S.nodes[S.nodes.length - 1] && S.to >= 0) return { to: S.to };
    return null;
  }
  return { runSim, runStats, runReport, simSideNext };
}
