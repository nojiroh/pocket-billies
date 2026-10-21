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
    const c = fn('chooseAI')(0, b);
    if (!c) break;
    fn('runTurn')([{ who: 0, k: 'move', mid: c.mid, tk: c.tk, part: c.part }], b);
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
