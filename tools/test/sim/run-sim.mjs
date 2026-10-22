// RL-8: the run simulation, on phase 13's harness (the logic in plain Node on the game's own data). It plays a whole
// run from its seed as the page does (roguelite-track.md 2c): the map (logic/run-map.js), every place's scene and the
// run's world (logic/run-scenes.js, game-data.js worldPut), its mini-bosses and boss (logic/run-loop.js runFoes), a
// place's wild Billies (rules.js encountersHere: its own stream, the forecast's odds), its battles with their seeds and
// the forecast's weather (run-loop.js runBattleSeed, weather.js battleWeatherOf), both sides played by the computer
// (chooseAI), the run's rewards (battle-rewards.js), paid healing and the day's shop in towns, and the payout.
// What the player does is a fixed policy: walk forward along a lane drawn from the seed, fight up to `fights` of a
// place's wild Billies while the party is above 70% of its HP (a Potion on a Billie below 60%; tax the first ones while
// the party is small), heal in towns when hurt, keep a few Copper Coins, beat the mini-boss, then the boss. RL-9b: it
// starts as the mast does: the highest-level Billies from home (rules.json run.home at Bracket I; `team` is how many
// starters wait at home) and a bag packed with Potions from home (`pack` of them at home, as many as run.pack lets).
// Two uses:
//   - replay: the same seed played twice must come out the same, even with util.js random seeded differently (so
//     nothing in a run hangs on Math.random): runSim(seed, {random: n}) and compare;
//   - statistics: how long runs are, how many battles, how often they are won, what they pay (report only; the bounds
//     are the owner's call after the first play).
//   node tools/test/sim/run-sim.mjs            50 runs, the report in validation/sim/runs.json (not committed)
//   node tools/test/sim/run-sim.mjs --runs=200 --team=3 --fights=4 --pack=5   more runs, three starters at home
//                                       (one travels), up to four wild fights a place, five Potions packed
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { data, fn, hooks, logic, modules, reseed, ROOT, GAME_DATA } from '../setup-real.mjs';

const { RULES, TRAINERS, SPECIES, POOLS } = data;
const R = RULES.run,
  { runMapStart, runArrive, runNext, runMapNode, runWorldNode, runWeather } = modules['run-map'],
  { runBegin, payoutOf, runByTier } = modules['run-state'],
  { runScenesMake, runWorldTables } = modules['run-scenes'],
  { runGive, runFoes, runBattleSeed, runHealCost, runShopStock } = modules['run-loop'],
  { battleWeatherOf } = modules.weather,
  { MAPGEN_VERSION } = modules.mapgen;
const MAP_DATA = { nodeTypes: GAME_DATA.nodeTypes, biomes: GAME_DATA.biomes, rules: R };
const worldData = () => ({
  nodeTypes: GAME_DATA.nodeTypes,
  biomes: GAME_DATA.biomes,
  pools: POOLS,
  scenery: GAME_DATA.scenery,
  rules: R,
});
/* a battle's host in the simulation: shows and saves nothing, and plays the battle's own weather (b.wx, as the page's
   battleWeatherMultiplier does once a run battle has its forecast's weather) */
const SIM_HOST = Object.freeze({
  ...logic.SILENT_HOST,
  weather: t => {
    const w = hooks.activeBattle && hooks.activeBattle.wx;
    return (w && w.m[t]) || 1;
  },
});
const MAX_TURNS = 60;
const brief = m => `${m.sp}:${m.lvl}:${m.hp}`;

/** play the battle on screen to its end, both sides by the computer; returns its outcome and turns */
function playOut() {
  const B = hooks.activeBattle,
    liveActors = fn('liveActors');
  while (!B.over && B.turn < MAX_TURNS) {
    const plan = [];
    if (B.needSwitch && B.needSwitch.length) {
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
 * One run from its seed, played by the policy. `random` reseeds util.js random first (the replay test plays the same
 * seed with two of them). Returns a log of everything that was drawn and how it went, and the run's numbers.
 * @param {string} seed @param {{ random?: number, fights?: number, team?: number, pack?: number }} [o]
 */
export function runSim(seed, o = {}) {
  reseed(o.random ?? 1);
  const s = fn('newSave')();
  s.started = true;
  s.starter = RULES.start.starters[0];
  hooks.provide({ saveData: s, activeBattle: null });
  s.team.push(fn('makeBilly')(s.starter + '0', RULES.start.starterLevel));
  for (let k = 1; k < (o.team ?? 1); k++) s.team.push(fn('makeBilly')(s.starter + '0', RULES.start.starterLevel));
  s.items.taxbreak = o.pack ?? 0;
  const home = s.team
      .slice()
      .sort((a, b) => b.lvl - a.lvl)
      .slice(0, runByTier(R.home, 1))
      .map(m => m.uid),
    pack = { items: { taxbreak: Math.min(o.pack ?? 0, runByTier(R.pack, 1)) }, coins: {} };
  const run = runBegin(s, { ...runGive(seed, 1, MAPGEN_VERSION, R.start), home, pack });
  runMapStart(run, MAP_DATA);
  const scenes = runScenesMake(run, worldData()),
    W = runWorldTables(run, data.LOCATIONS[0], worldData()),
    foes = runFoes(run, { leaders: Object.values(TRAINERS).filter(T => T.miniboss), rules: R });
  data.worldPut({
    ...W,
    maps: Object.fromEntries(W.locations.slice(1).map((p, i) => [p.mapId, scenes[i]])),
    trainers: foes,
  });
  const log = { seed, scenes: scenes.map(sc => sc.gen.seed), places: [] },
    stats = { battles: 0, turns: 0, caught: 0, healed: 0, spent: 0, won: false, lostAt: '' };
  try {
    runArrive(s, 0, MAP_DATA);
    let i = 0;
    for (;;) {
      const node = run.map.nodes[i],
        wn = runWorldNode(i),
        at = { i, type: node.type, day: run.clock, weather: runWeather(run, i, run.clock), battles: [] };
      log.places.push(at);
      /* a town: heal when hurt, then the day's shop (Copper Coins up to five) */
      if (node.type === 'town') {
        const { hurt, cost } = runHealCost(s.team, R.healCost);
        if (hurt && s.se >= cost) {
          s.se -= cost;
          fn('healAll')();
          stats.healed += cost;
          at.healed = cost;
        }
        const stock = runShopStock(run, i, run.clock, R.shop);
        at.shop = stock.map(w => w.coin || w.item);
        const coin = data.COINS.penny;
        while (stock.some(w => w.coin === 'penny') && (s.coins.penny || 0) < 5 && s.se >= coin.price + 100) {
          s.se -= coin.price;
          s.coins.penny = (s.coins.penny || 0) + 1;
          stats.spent += coin.price;
        }
      }
      /* the place's wild Billies, up to `fights` of them */
      const stock = fn('encountersHere')(wn).slice(0, o.fights ?? 2);
      at.stock = stock.map(q => `${q.sp}:${q.lvl}${q.alpha ? 'A' : ''}`);
      for (const q of stock) {
        /* a careful player: a Potion on a Billie below 60%, and no wild fight while the party is below 70% */
        for (const m of s.team)
          if (m.hp > 0 && m.hp < fn('maxHp')(m) * 0.6 && (s.items.taxbreak || 0) > 0) {
            s.items.taxbreak--;
            m.hp = Math.min(fn('maxHp')(m), m.hp + data.ITEMS.taxbreak.hp);
          }
        const hp = s.team.reduce((a, m) => a + m.hp, 0),
          full = s.team.reduce((a, m) => a + fn('maxHp')(m), 0);
        if (hp < full * 0.7) break;
        const k = run.battleN++,
          wx = battleWeatherOf((w => (w === 'clear' || !w ? 'sunny' : w))(runWeather(run, i, run.clock)), RULES.env),
          build = { build: fn('encounterBuild')(q), coat: q.coat },
          foe = q.alpha ? fn('makeAlpha')(q.sp, q.lvl, build) : fn('makeBilly')(q.sp, q.lvl, build);
        if (
          !fn('newBattle')('wild', [foe], {
            qid: q.id,
            fmt: q.alpha ? 'alpha' : 'single',
            seed: runBattleSeed(run, i, k),
            wx,
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
        const pay = modules['battle-rewards'].battleRewards({ kind: 'wild', over: res.over, foe: [foe] }, s);
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
      const T = Object.values(foes).find(F => F.runNode === i);
      if (T) {
        const k = run.battleN++,
          wx = battleWeatherOf((w => (w === 'clear' || !w ? 'sunny' : w))(runWeather(run, i, run.clock)), RULES.env),
          team = T.alpha ? [fn('makeAlpha')(T.team[0].sp, T.team[0].lvl)] : fn('trainerTeam')(TRAINERS[T.id]);
        if (!s.team.some(m => m.hp > 0)) {
          stats.lostAt = node.type;
          return finish();
        }
        fn('newBattle')('trainer', team, {
          tid: T.id,
          T: TRAINERS[T.id],
          fmt: T.alpha ? 'alpha' : T.double && team.length >= 2 ? 'double' : 'single',
          seed: runBattleSeed(run, i, k),
          wx,
          host: SIM_HOST,
        });
        const res = playOut(),
          B = hooks.activeBattle,
          pay = modules['battle-rewards'].battleRewards(
            { kind: 'trainer', over: res.over, T: TRAINERS[T.id], tid: T.id, foe: team },
            s
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
      id => (data.ITEMS[id] && data.ITEMS[id].price) || 0
    );
    Object.assign(stats, {
      days: run.clock,
      places: run.path.length,
      se: s.se,
      capital: pay.capital,
      party: s.team.length,
      top: Math.max(...s.team.map(m => m.lvl)),
    });
    log.end = { ...stats, uids: run.uidN };
    return { log, stats };
  }
}

/** many runs: the numbers the owner's first play will be read against (report only) */
export function runStats(n = 50, o = {}) {
  const all = [];
  for (let k = 0; k < n; k++) all.push(runSim(`SIM${k}`, o).stats);
  const avg = f => Math.round((all.reduce((a, x) => a + f(x), 0) / all.length) * 10) / 10,
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

if (process.argv[1] && process.argv[1].endsWith('run-sim.mjs')) {
  const arg = (k, d) => +((process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1] || d),
    t0 = Date.now(),
    report = runStats(arg('runs', 50), { team: arg('team', 1), fights: arg('fights', 2), pack: arg('pack', 0) });
  report.seconds = Math.round((Date.now() - t0) / 1000);
  mkdirSync(join(ROOT, 'validation/sim'), { recursive: true });
  writeFileSync(join(ROOT, 'validation/sim/runs.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
}
