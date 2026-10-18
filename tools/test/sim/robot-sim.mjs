// Phase 17: the robot balance simulation, on phase 13's harness (the logic in plain Node on the game's own data).
// Every robot build the data allows (each gem, torso, left arm, right arm and legs) fights a fixed reference set of
// robot builds and of Billies at the same level, one on one, both sides played by the computer's smart move choice.
// It reports each build's win rate, each part's average, and robots against Billies overall, so no single build or
// part dominates (phase 17 task 10). The bounds that count as "balanced" are the owner's call: report only.
//   node tools/test/sim/robot-sim.mjs            all builds against the reference set (a few minutes)
//   node tools/test/sim/robot-sim.mjs --quick    every 7th build (seconds)
// The JSON report goes to validation/sim/robots.json (not committed).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { data, fn, hooks, reseed, ROOT } from '../setup-real.mjs';

const { ROBOTS, LINES } = data;
const LVL = 30;

/** every build the data allows: [gem, torso, armL, armR, legs] */
export function allBuilds() {
  const of = slot => Object.keys(ROBOTS.parts).filter(id => ROBOTS.parts[id].slot === slot);
  const out = [];
  for (const gem of Object.keys(ROBOTS.gems))
    for (const torso of of('torso'))
      for (const armL of of('arm'))
        for (const armR of of('arm')) for (const legs of of('legs')) out.push({ gem, torso, armL, armR, legs });
  return out;
}
const makeBot = (b, lvl = LVL) => fn('makeRobot')(b.gem, fn('fitFromIds')(b), lvl);
const label = b => `${b.gem}.${b.torso}.${b.armL}.${b.armR}.${b.legs}`;

/** one battle, both sides played by the computer; true when side 0 wins */
export function duel(makeA, makeB, seed) {
  reseed(seed);
  const s = fn('newSave')();
  s.started = true;
  s.starter = 'musk';
  hooks.provide({ saveData: s });
  s.team.push(makeA());
  fn('newBattle')('trainer', [makeB()]);
  const B = () => hooks.activeBattle;
  for (let t = 0; t < 120 && !B().over; t++) {
    const c = fn('chooseAI')(0);
    if (!c) break;
    fn('runTurn')([{ who: 0, k: 'move', mid: c.mid, tk: c.tk, part: c.part }]);
  }
  return B().over === 'win';
}

/** the reference set: an even spread of robot builds, and every line's middle stage (a Billie at the same level) */
export function references(builds, nBots = 24) {
  const step = Math.max(1, Math.floor(builds.length / nBots)),
    bots = builds.filter((b, i) => i % step === Math.floor(step / 2)).slice(0, nBots);
  const billies = LINES.map(L => L.id + Math.min(1, L.names.length - 1));
  return { bots, billies };
}

export function simulate({ every = 1 } = {}) {
  const builds = allBuilds(),
    ref = references(builds),
    tried = builds.filter((b, i) => i % every === 0),
    rows = [];
  let seed = 1;
  for (const b of tried) {
    let vsBot = 0,
      vsBillie = 0;
    for (const r of ref.bots)
      vsBot += duel(
        () => makeBot(b),
        () => makeBot(r),
        seed++
      )
        ? 1
        : 0;
    for (const sp of ref.billies)
      vsBillie += duel(
        () => makeBot(b),
        () => fn('makeBilly')(sp, LVL),
        seed++
      )
        ? 1
        : 0;
    rows.push({ build: label(b), b, vsBot: vsBot / ref.bots.length, vsBillie: vsBillie / ref.billies.length });
  }
  // each part: the average win rate (against robots) of the builds that use it
  const parts = {};
  for (const r of rows)
    for (const [k, id] of Object.entries(r.b)) {
      const key = `${k === 'armL' || k === 'armR' ? 'arm' : k}:${id}`;
      (parts[key] = parts[key] || []).push(r.vsBot);
    }
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  const partRates = Object.fromEntries(Object.entries(parts).map(([k, a]) => [k, Math.round(avg(a) * 1000) / 1000]));
  rows.sort((a, b) => b.vsBot - a.vsBot);
  return {
    level: LVL,
    builds: rows.length,
    references: { robots: ref.bots.map(label), billies: ref.billies },
    best: rows.slice(0, 10).map(r => [r.build, r.vsBot, r.vsBillie]),
    worst: rows.slice(-10).map(r => [r.build, r.vsBot, r.vsBillie]),
    topRate: rows[0].vsBot,
    robotsVsBillies: Math.round(avg(rows.map(r => r.vsBillie)) * 1000) / 1000,
    parts: partRates,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const quick = process.argv.includes('--quick'),
    t0 = Date.now(),
    R = simulate({ every: quick ? 7 : 1 });
  const dir = join(ROOT, 'validation', 'sim');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'robots.json'), JSON.stringify(R, null, 1));
  const pct = x => `${Math.round(x * 100)}%`;
  console.log(`robot sim: ${R.builds} builds at level ${R.level}, ${Math.round((Date.now() - t0) / 1000)} s`);
  console.log(`  robots win ${pct(R.robotsVsBillies)} against Billies of the same level`);
  console.log(`  best build wins ${pct(R.topRate)} against the reference robots:`);
  for (const [b, x, y] of R.best.slice(0, 5)) console.log(`    ${b}  ${pct(x)} vs robots, ${pct(y)} vs Billies`);
  console.log('  worst:');
  for (const [b, x, y] of R.worst.slice(-5)) console.log(`    ${b}  ${pct(x)} vs robots, ${pct(y)} vs Billies`);
  console.log('  parts (average win rate of the builds using them):');
  for (const [k, v] of Object.entries(R.parts).sort((a, b) => b[1] - a[1]))
    console.log(`    ${k.padEnd(18)} ${pct(v)}`);
}
