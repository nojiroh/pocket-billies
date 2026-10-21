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
  s.items = { ...s.items, taxbreak: 2 };
  s.team[0].hp -= 5;
  const before = JSON.stringify(s);
  const team = copyTeam(s);
  const b = fn('makeBattle')('wild', team, [fn('makeBilly')(DEX_ORDER[1], 5)], {
    host: SILENT_HOST,
    bag: { taxbreak: 1 },
    buddy: team[1].uid,
  });
  const k = fn('canUse')('taxbreak', team[0], b);
  assert.equal(k, true, 'the battle uses its own bag');
  fn('runTurn')([{ who: 0, k: 'item', item: 'taxbreak', uid: team[0].uid }], b);
  assert.equal(b.bag.taxbreak, 0);
  playOut(b);
  assert.equal(b.over, 'win');
  assert.ok(team[1].xp > s.team[1].xp, 'the copied buddy got XP');
  assert.equal(JSON.stringify(s), before, 'the save is untouched');
  assert.deepEqual(said, []);
});

test("a battle on the save's team still marks seen and spends the save's items", () => {
  reseed(12);
  const s = startedSave(starter(), 12);
  s.items = { ...s.items, taxbreak: 1 };
  s.team[0].hp -= 5;
  const foe = fn('makeBilly')(DEX_ORDER[6], 8);
  fn('newBattle')('wild', [foe], { host: SILENT_HOST });
  assert.equal(s.seen[foe.sp], 1);
  fn('runTurn')([{ who: 0, k: 'item', item: 'taxbreak', uid: s.team[0].uid }]);
  assert.equal(s.items.taxbreak, 0);
});
