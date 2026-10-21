// RL-2: the battle golden record. Four seeded fights on the game's own data (a single wild battle, a double trainer
// battle, an Alpha, a robot against a Billie), both sides played by the computer, written down event by event with
// the end state of every fighter. RL-4 rewires the engine (the battle as an argument, its own random stream); this
// record must stay the same through every commit of that work, so a change in how battles play shows at once.
// The snapshot is in battle-golden.test.mjs.snapshot. A change to the battle data (moves, species, trainers, rules) or
// a change meant to alter battles remakes it, said in the commit:
//   node --test --test-update-snapshots tools/test/battle-golden.test.mjs
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { data, fn, hooks, reseed, said, startedSave } from './setup-real.mjs';

const { DEX_ORDER, RULES, SPECIES, TRAINERS } = data;
const liveActors = fn('liveActors'),
  fighter = fn('fighter');
const MAX_TURNS = 80;

beforeEach(() => {
  hooks.provide({ activeBattle: null });
  said.length = 0;
});

const starter = () => Object.keys(SPECIES).find(k => SPECIES[k].line === RULES.start.starters[0]);
function teamOfThree(lvl = 12) {
  const s = startedSave(starter(), lvl);
  while (s.team.length < 3) s.team.push(fn('makeBilly')(DEX_ORDER[(s.team.length * 5 + 3) % DEX_ORDER.length], lvl));
  return s;
}
const wildSpecies = () =>
  Object.keys(SPECIES).find(k => SPECIES[k].stage === 0 && !RULES.start.starters.includes(SPECIES[k].line));

// what a fighter is at the end (no uid or dates: those follow the clock, not the seed)
function fighterState(m) {
  const o = { sp: m.sp || m.gem, lvl: m.lvl, hp: m.hp, xp: m.xp, status: m.status || null };
  if (m.kind === 'robot') o.partDmg = m.partDmg;
  if (m.boss) o.boss = m.boss;
  return o;
}
// an event as the page would play it (what it says, what it shows, each fighter's snapshot), without the uids
const eventOf = e => JSON.parse(JSON.stringify(e, (k, v) => (k === 'uid' ? undefined : v)));

// Battles are short (two to four turns at these levels); the levels and seeds are picked so the record holds a crit,
// the Alpha's shield phase and a robot part breaking.
// both sides played by the computer; a fainted fighter of yours is replaced by the first one on the bench
function play() {
  const B = hooks.activeBattle,
    turns = [{ turn: 0, events: B.events.map(eventOf) }];
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
    turns.push({ turn: B.turn, events: B.events.map(eventOf) });
  }
  return {
    fmt: B.fmt,
    kind: B.kind,
    over: B.over,
    turns: B.turn,
    mine: B.sides[0].team.map(fighterState),
    foes: B.sides[1].team.map(fighterState),
    se: hooks.saveData.se,
    said: [...said],
    log: turns,
  };
}

test('golden: a single wild battle', t => {
  reseed(101);
  startedSave(starter(), 10);
  const q = { id: 'golden-single', sp: wildSpecies(), lvl: 12, no: 1 };
  fn('encountersHere')().push(q);
  fn('startWild')(q);
  t.assert.snapshot(play());
});

test('golden: a double trainer battle', t => {
  reseed(202);
  teamOfThree(7);
  /* RL-5: Leader Rocco (crude), a mini-boss who stays in the game (it took the first trainer with two Billies, Blake on
     the golf course, who is parked with his place) */
  const tid = 'crude';
  assert.ok(TRAINERS[tid].team.length >= 2);
  fn('startTrainer')(tid, { talked: true, double: true });
  t.assert.snapshot({ tid, ...play() });
});

test('golden: an Alpha battle (three of yours against one that acts twice)', t => {
  reseed(305);
  teamOfThree(14);
  const q = { id: 'golden-alpha', sp: wildSpecies(), lvl: 8, no: 1, alpha: true };
  fn('encountersHere')().push(q);
  fn('startWild')(q);
  t.assert.snapshot(play());
});

test('golden: a robot against a Billie (aimed moves, parts that break)', t => {
  reseed(404);
  const s = startedSave(starter(), 20);
  const bot = { gem: 'ember', torso: 'bulwark', armL: 'auger', armR: 'clamp', legs: 'treads' };
  s.team[0] = fn('makeRobot')(bot.gem, fn('fitFromIds')(bot), 20);
  fn('newBattle')('trainer', [fn('makeBilly')(starter().replace(/\d+$/, '1'), 26)]);
  t.assert.snapshot(play());
});
