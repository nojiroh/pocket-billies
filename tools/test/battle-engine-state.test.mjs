// RL-4: a battle the page doesn't show. With SILENT_HOST the engine shows, saves and plays nothing (no toast, no
// save, no battle screen, no turn playback) and reads no weather; a battle handed to an entry point is played
// instead of the page's current one, so two fights can run side by side in one process.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { data, fn, hooks, logic, reseed, said, startedSave } from './setup-real.mjs';

const { DEX_ORDER, RULES, SPECIES } = data;
const { SILENT_HOST } = logic;

beforeEach(() => {
  hooks.provide({ activeBattle: null });
  said.length = 0;
});

const starter = () => Object.keys(SPECIES).find(k => SPECIES[k].line === RULES.start.starters[0]);
// both sides played by the computer until the battle ends (or the turn limit)
function playOut(b) {
  for (let t = 0; t < 80 && !b.over; t++) {
    const plan = (b.needSwitch || []).map(k => ({ who: k, k: 'switch', i: fn('benchCandidates')(0, [], b)[0] }));
    const c = plan.length ? null : fn('chooseAI')(0, b);
    if (c) plan.push({ who: 0, k: 'move', mid: c.mid, tk: c.tk, part: c.part });
    if (!plan.length || plan.some(p => p.i === undefined && p.k === 'switch')) break;
    fn('runTurn')(plan, b);
  }
  return b;
}

test('a silent battle shows, saves and plays nothing', () => {
  reseed(11);
  startedSave(starter(), 12);
  assert.equal(fn('newBattle')('wild', [fn('makeBilly')(DEX_ORDER[1], 10)], { host: SILENT_HOST }), true);
  const b = playOut(hooks.activeBattle);
  assert.ok(b.over, 'the battle ended');
  assert.deepEqual(said, [], 'no toast, save, battle screen or playback');
});

test('the page host still opens the screen and plays each turn', () => {
  reseed(11);
  startedSave(starter(), 12);
  fn('newBattle')('wild', [fn('makeBilly')(DEX_ORDER[1], 10)]);
  playOut(hooks.activeBattle);
  assert.ok(said.includes('playTurnEvents'));
});

// a deep copy of the save's team: the same Billies (same uids), other objects
const copyTeam = s => JSON.parse(JSON.stringify(s.team));

test('a battle on a copied team leaves the save as it was (HP, XP, items, buddy)', () => {
  reseed(12);
  const s = startedSave(starter(), 12);
  s.team.push(fn('makeBilly')(DEX_ORDER[4], 12));
  s.buddy = s.team[1].uid;
  s.items = { ...s.items, potion: 2 };
  s.team[0].hp -= 5;
  const before = JSON.stringify(s);
  const team = copyTeam(s);
  const b = fn('makeBattle')('wild', team, [fn('makeBilly')(DEX_ORDER[1], 5)], {
    host: SILENT_HOST,
    bag: { potion: 1 },
    buddy: team[1].uid,
  });
  const k = fn('canUse')('potion', team[0], b);
  assert.equal(k, true, 'the battle uses its own bag');
  fn('runTurn')([{ who: 0, k: 'item', item: 'potion', uid: team[0].uid }], b);
  assert.equal(b.bag.potion, 0);
  playOut(b);
  assert.equal(b.over, 'win');
  assert.ok(team[1].xp > s.team[1].xp, 'the copied buddy got XP');
  assert.equal(JSON.stringify(s), before, 'the save is untouched');
  assert.deepEqual(said, []);
});

test("a battle on the save's team still marks seen and spends the save's items", () => {
  reseed(12);
  const s = startedSave(starter(), 12);
  s.items = { ...s.items, potion: 1 };
  s.team[0].hp -= 5;
  const foe = fn('makeBilly')(DEX_ORDER[6], 8);
  fn('newBattle')('wild', [foe], { host: SILENT_HOST });
  assert.equal(s.seen[foe.sp], 1);
  fn('runTurn')([{ who: 0, k: 'item', item: 'potion', uid: s.team[0].uid }]);
  assert.equal(s.items.potion, 0);
});

// a seeded fight on copies, both sides played by the computer: its events without uids, and the end state
function seededFight(seed, between = () => {}) {
  reseed(31);
  const s = startedSave(starter(), 14);
  s.team.push(fn('makeBilly')(DEX_ORDER[4], 14));
  const foe = [fn('makeBilly')(DEX_ORDER[1], 13), fn('makeBilly')(DEX_ORDER[6], 13)];
  const b = fn('makeBattle')('trainer', copyTeam(s), foe, { fmt: 'double', seed, host: SILENT_HOST });
  const log = [];
  for (let t = 0; t < 80 && !b.over; t++) {
    between();
    const plan = (b.needSwitch || []).map(k => ({ who: k, k: 'switch', i: fn('benchCandidates')(0, [], b)[0] }));
    for (const k of fn('withBattle')(b, () => fn('liveActors')(0))) {
      if (plan.some(p => p.who === k)) continue;
      const c = fn('chooseAI')(k, b);
      if (c) plan.push({ who: k, k: 'move', mid: c.mid, tk: c.tk, part: c.part });
    }
    if (!plan.length) break;
    fn('runTurn')(plan, b);
    log.push(b.events.map(e => e.t));
  }
  return { over: b.over, turns: b.turn, log, hp: [...b.sides[0].team, ...b.sides[1].team].map(m => m.hp) };
}

test('a seeded battle plays the same twice, whatever else draws random numbers meanwhile', () => {
  const a = seededFight('rl4-seed');
  // between turns: Math.random draws (util.js random), and another battle played a turn on the page
  const b = seededFight('rl4-seed', () => {
    for (let i = 0; i < 7; i++) Math.random();
    const other = fn('makeBattle')('wild', [fn('makeBilly')(DEX_ORDER[2], 5)], [fn('makeBilly')(DEX_ORDER[3], 5)], {
      host: SILENT_HOST,
    });
    const c = fn('chooseAI')(0, other);
    if (c) fn('runTurn')([{ who: 0, k: 'move', mid: c.mid, tk: c.tk }], other);
  });
  assert.ok(a.over, 'the battle ended');
  assert.deepEqual(b, a);
  assert.notDeepEqual(seededFight('another-seed').log, a.log, 'another seed plays another battle');
});

test('a battle still going at the turn cap ends as a draw', () => {
  assert.equal(RULES.battle.turnCap, 40);
  const was = RULES.battle.turnCap;
  RULES.battle.turnCap = 2; // the same check, reached in two turns
  try {
    reseed(13);
    const s = startedSave(starter(), 30);
    const foe = fn('makeBilly')(DEX_ORDER[1], 30);
    const b = fn('makeBattle')('wild', copyTeam(s), [foe], { seed: 'cap', host: SILENT_HOST });
    // both fighters far too tough to fall in two turns
    for (const m of [b.sides[0].team[0], foe]) m.hp = 1e6;
    const turn = () => {
      const c = fn('chooseAI')(0, b);
      fn('runTurn')([{ who: 0, k: 'move', mid: c.mid, tk: c.tk }], b);
    };
    turn();
    assert.equal(b.over, null, 'one turn in: still going');
    turn();
    assert.equal(b.over, 'draw');
    assert.equal(b.turn, 2);
    assert.match(b.events.at(-1).t, /draw/);
  } finally {
    RULES.battle.turnCap = was;
  }
});
