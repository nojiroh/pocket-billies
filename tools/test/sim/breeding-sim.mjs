// RL-10: the breeding simulation, on phase 13's harness (the logic in plain Node on the game's own data). Every pair
// of lines breeds many eggs (logic/breeding.js breedRoll, a new seed each time through ranch.bred), safe for the pairs
// of one line and risky for all. It reports what hatches against rules.json ranch.breed.odds, which stats
// abominations raise and lower, the Scrap an abomination costs on average, and how bred Billies fare in battle: each
// abomination and quirk, raised to LVL, fights its twin (the same Billie without its mark: what the mark alone does)
// and a plain one of its species (all M, Prime), both played by the computer. The duel isn't even (the side that
// moves second wins more), so the report has a control: a plain Billie against its own copy. The bounds that count as
// fair are the owner's call: report only (roguelite-track.md, RL-10).
//   node tools/test/sim/breeding-sim.mjs            40 eggs a pair and mode, 4 battles each (a minute or so)
//   node tools/test/sim/breeding-sim.mjs --quick    8 eggs, 1 battle (seconds)
// The JSON report goes to validation/sim/breeding.json (not committed).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GAME_DATA, data, fn, modules, reseed, ROOT } from '../setup-real.mjs';
import { duel } from './robot-sim.mjs';

const { LINES } = data;
const K = modules.breeding,
  BR = GAME_DATA.rules.ranch.breed,
  LVL = 30;

/** a save with the two parents in storage, its pair count at n */
function pairSave(la, lb, n) {
  reseed(1000 + n);
  const s = fn('newSave')();
  s.started = true;
  s.starter = la;
  const a = fn('makeBilly')(la + '0', 10, { wild: true }),
    b = fn('makeBilly')(lb + '0', 10, { wild: true });
  s.box.push(a, b);
  s.ranch.bred = n;
  return { s, a, b };
}

/** a hatched Billie raised to `lvl` (its build, coat and mark kept; its line's moves at that level, plus a quirk's) */
function raised(m, lvl) {
  const x = JSON.parse(JSON.stringify(m)),
    line = fn('speciesOf')(x).line,
    learned = fn('movesAt')(line, lvl),
    extra = x.moves.filter(mv => !fn('movesAt')(line, BR.lvl).includes(mv));
  x.lvl = lvl;
  x.xp = fn('xpFor')(lvl);
  x.moves = [...new Set(learned.concat(extra))].slice(-GAME_DATA.rules.progression.moveSlots);
  x.hp = fn('maxHp')(x);
  return x;
}

export function simulate({ eggs = 40, battles = 4 } = {}) {
  const out = { safe: 0, quirk: 0, abom: 0 },
    up = {},
    down = {},
    sizes = { S: 0, M: 0, L: 0 },
    fights = { abom: [0, 0], quirk: [0, 0], abomTwin: [0, 0], quirkTwin: [0, 0], control: [0, 0] },
    names = new Set();
  let risky = 0,
    seed = 1;
  for (const A of LINES)
    for (const B of LINES)
      for (const mode of A.id === B.id ? ['safe', 'risky'] : ['risky'])
        for (let n = 0; n < eggs; n++) {
          const { s, a, b } = pairSave(A.id, B.id, n),
            { m, out: o } = K.breedRoll(s, a, b, mode, BR);
          if (mode === 'risky') {
            risky++;
            out[o]++;
          }
          for (const z of Object.values(m.build)) sizes[z]++;
          if (o === 'abom') {
            up[m.mut.up] = (up[m.mut.up] || 0) + 1;
            down[m.mut.down] = (down[m.mut.down] || 0) + 1;
            names.add(m.mut.name);
          }
          if (o === 'abom' || o === 'quirk')
            for (let k = 0; k < battles; k++) {
              const bred = raised(m, LVL),
                twin = { ...JSON.parse(JSON.stringify(bred)), mut: undefined },
                plain = () => fn('makeBilly')(m.sp, LVL),
                fight = (key, a, b) => {
                  fights[key][0] += duel(a, b, seed++) ? 1 : 0;
                  fights[key][1]++;
                };
              twin.hp = fn('maxHp')(twin);
              fight(o, () => JSON.parse(JSON.stringify(bred)), plain);
              fight(
                o + 'Twin',
                () => JSON.parse(JSON.stringify(bred)),
                () => JSON.parse(JSON.stringify(twin))
              );
              fight('control', plain, plain);
            }
        }
  const share = k => +(out[k] / Math.max(1, risky)).toFixed(3),
    rate = k => (fights[k][1] ? +(fights[k][0] / fights[k][1]).toFixed(3) : null);
  return {
    pairs: LINES.length * LINES.length,
    eggsPerPair: eggs,
    risky,
    odds: BR.odds,
    got: { safe: share('safe'), quirk: share('quirk'), abom: share('abom') },
    abomUp: up,
    abomDown: down,
    abomNames: names.size,
    sizes,
    scrapPerAbom: out.abom ? +((risky * BR.riskyCost) / out.abom).toFixed(1) : null,
    /* side 0's wins: a bred Billie against a plain one of its species, against its twin without the mark, and the
       control (plain against plain: what an even fight scores in this duel) */
    wins: {
      level: LVL,
      control: rate('control'),
      abomVsPlain: rate('abom'),
      abomVsTwin: rate('abomTwin'),
      quirkVsPlain: rate('quirk'),
      quirkVsTwin: rate('quirkTwin'),
      battles: Object.values(fights).reduce((n, f) => n + f[1], 0),
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const quick = process.argv.includes('--quick'),
    R = simulate(quick ? { eggs: 8, battles: 1 } : {});
  console.log(JSON.stringify(R, null, 1));
  const dir = join(ROOT, 'validation', 'sim');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'breeding.json'), JSON.stringify(R, null, 1));
}
