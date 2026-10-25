// SP-2: the splicing balance simulation, on phase 13's harness (the logic in plain Node on the game's own data). Every
// species is spliced with 1, 2 and 3 Genes from other lines (donors picked at random from logic/graft-art.js
// graftDonors, every part at M), and each splice fights its Prime twin (the same species, every part its own at M) at
// each Prime bonus tried, both sides played by the computer. Each pair fights twice, each side moving first once, so
// an even fight scores 0.5; the control (a Prime Billie against its own copy) shows it. Results come by Gene count and
// for stable and Unstable splices. Prime's bonus is the owner's call from this report (splicing-track.md, Ask me before).
//   node tools/test/sim/splice-sim.mjs            8 splices a species and Gene count (a few minutes)
//   node tools/test/sim/splice-sim.mjs --quick    1 splice (seconds)
// The JSON report goes to validation/sim/splice.json (not committed).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { data, fn, GAME_DATA, modules, ROOT } from '../setup-real.mjs';
import { duel } from './robot-sim.mjs';

const { SPECIES, RULES } = data;
const LVL = 30,
  BONUSES = [0.1, 0.05, 0],
  SLOTS = modules['graft-art'].GRAFT_SLOTS,
  M = () => Object.fromEntries(RULES.parts.slots.map(k => [k, 'M']));

/** a Billie of `sp` at LVL, every part at M, with `graft` (or none) */
function billie(sp, graft) {
  const m = fn('makeBilly')(sp, LVL, { build: M() });
  if (graft) m.graft = { ...graft };
  m.hp = fn('maxHp')(m);
  return m;
}

/** side A's share of a pair of fights on one seed, each side moving first once */
function fair(a, b, seed) {
  const one = duel(a, b, seed) ? 1 : 0,
    two = duel(b, a, seed) ? 0 : 1;
  return (one + two) / 2;
}

/** `n` slots of `sp` spliced with random donors from other lines; null when the species has too few slots that take one */
function rollGraft(sp, n, r) {
  const open = SLOTS.filter(
    s => modules['graft-art'].graftDonors(GAME_DATA.kitBuilds, GAME_DATA.partKits, sp, s).length
  );
  if (open.length < n) return null;
  const pick = open.slice();
  /** @type {Record<string, string>} */
  const g = {};
  for (let i = 0; i < n; i++) {
    const slot = pick.splice(r.int(0, pick.length - 1), 1)[0],
      donors = modules['graft-art'].graftDonors(GAME_DATA.kitBuilds, GAME_DATA.partKits, sp, slot);
    g[slot] = donors[r.int(0, donors.length - 1)];
  }
  return g;
}

export function simulate({ splices = 8 } = {}) {
  const P = RULES.parts,
    was = P.primeBonus,
    r = modules.rng.rngFrom('splice-sim'),
    species = Object.keys(SPECIES).filter(sp => fn('geneData')().kitBuilds.forms.some(f => f.rig === sp)),
    /** the splices to fight with, the same at every bonus */
    tried = [];
  for (const sp of species)
    for (const n of [1, 2, 3])
      for (let k = 0; k < splices; k++) {
        const g = rollGraft(sp, n, r);
        if (g) tried.push({ sp, n, graft: g, unstable: fn('billyUnstable')(billie(sp, g)) !== null });
      }
  const rows = {};
  let seed = 1;
  try {
    for (const bonus of BONUSES) {
      P.primeBonus = bonus;
      /** key -> [score, fights] */
      const acc = {},
        add = (key, v) => {
          acc[key] = acc[key] || [0, 0];
          acc[key][0] += v;
          acc[key][1]++;
        };
      for (const t of tried) {
        const v = fair(
          () => billie(t.sp, t.graft),
          () => billie(t.sp, null),
          seed
        );
        seed += 2;
        add(`genes${t.n}`, v);
        add(t.unstable ? 'unstable' : 'stable', v);
        add('all', v);
      }
      for (const sp of species) {
        add(
          'control',
          fair(
            () => billie(sp, null),
            () => billie(sp, null),
            seed
          )
        );
        seed += 2;
      }
      rows[String(bonus)] = Object.fromEntries(
        Object.entries(acc).map(([k, [s, n]]) => [k, { vsPrimeTwin: +(s / n).toFixed(3), fights: n * 2 }])
      );
    }
  } finally {
    P.primeBonus = was;
  }
  return {
    level: LVL,
    species: species.length,
    splices: tried.length,
    unstableShare: +(tried.filter(t => t.unstable).length / Math.max(1, tried.length)).toFixed(3),
    stability: GAME_DATA.genes.stability,
    /* per Prime bonus: the spliced side's share of wins against its Prime twin (0.5 is even) */
    byPrimeBonus: rows,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const quick = process.argv.includes('--quick'),
    R = simulate(quick ? { splices: 1 } : {});
  console.log(JSON.stringify(R, null, 1));
  const dir = join(ROOT, 'validation', 'sim');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'splice.json'), JSON.stringify(R, null, 1));
}
