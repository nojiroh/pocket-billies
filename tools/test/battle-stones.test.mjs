// VFX-13: Scatter Stones lays its stones on the foe's side, as its line says ("around their side"). Before, a status
// move's target was the user itself, so they landed on the user's own side (found by VFX-14).
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { data, fn, hooks, reseed, said, startedSave } from './setup-real.mjs';

const { MOVES, RULES, SPECIES } = data;

beforeEach(() => {
  hooks.provide({ activeBattle: null });
  said.length = 0;
});

test('Scatter Stones: the stones go on the foe’s side, whoever uses it', () => {
  const mid = Object.keys(MOVES).find(k => MOVES[k].c === 'X' && MOVES[k].fx && MOVES[k].fx.stones);
  assert.ok(mid, 'a status move that scatters stones');
  const starter = Object.keys(SPECIES).find(k => SPECIES[k].line === RULES.start.starters[0]);
  for (const k of [0, 1]) {
    reseed(5);
    startedSave(starter, 12);
    assert.ok(fn('newBattle')('wild', [fn('makeBilly')(starter, 10)], { fmt: 'single', seed: 'stones' }));
    const b = hooks.activeBattle;
    fn('useMove')(k, mid, 1 - k);
    assert.equal(!!b.sides[1 - k].stones, true, `side ${1 - k} has the stones (used by ${k})`);
    assert.equal(!!b.sides[k].stones, false, `side ${k} has none`);
    const line = b.events.map(e => e.t || '').find(t => t.startsWith('Sharp stones are scattered'));
    assert.equal(line, `Sharp stones are scattered around ${k === 0 ? 'their' : 'your'} side.`);
  }
});
