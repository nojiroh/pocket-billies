// RL-8: the run simulation, on phase 13's harness. Studio plan T3.1: the simulation itself is game/js/logic/run-sim.js
// (runSimOn); this file is its Node host: it loads the logic on the game's data, reseeds util.js random before each
// run, and writes the report.
// The simulation (the logic in plain Node on the game's own data). It plays a whole
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
//   node tools/test/sim/run-sim.mjs --unlocks=all   runs with every unlock (default none: a fresh save's; Studio plan
//                                       T2.1, the run starts through logic/run-start.js as the mast's does)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { data, fn, hooks, logic, modules, reseed, ROOT, GAME_DATA } from '../setup-real.mjs';

/** the core on the game's data in Node; util.js random is reseeded before each run (`random`, 1 by default) */
export const { runSim, runStats } = modules['run-sim'].runSimOn({
  modules,
  fn,
  hooks,
  data,
  gameData: GAME_DATA,
  logic,
  beforeRun: o => reseed(o.random ?? 1),
});

if (process.argv[1] && process.argv[1].endsWith('run-sim.mjs')) {
  const arg = (k, d) => +((process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1] || d),
    t0 = Date.now(),
    unlocks = (process.argv.find(a => a.startsWith('--unlocks=')) || '--unlocks=none').split('=')[1],
    report = runStats(arg('runs', 50), {
      team: arg('team', 1),
      fights: arg('fights', 2),
      pack: arg('pack', 0),
      unlocks,
    });
  report.unlocks = unlocks;
  report.seconds = Math.round((Date.now() - t0) / 1000);
  mkdirSync(join(ROOT, 'validation/sim'), { recursive: true });
  writeFileSync(join(ROOT, 'validation/sim/runs.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
}
