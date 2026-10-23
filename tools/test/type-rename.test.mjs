// Studio plan Phase 6 (T6.6): renaming a type in the Studio (game/js/logic/type-rename.js) rewrites every place the
// data names it, and deleting one leaves no place naming it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const T = modules['type-rename'];
const copy = () => structuredClone(GAME_DATA);

test('a rename reaches the matchups, the moves, the Billies and the battle rules', () => {
  const D = copy(),
    from = D.rules.battle.shockType;
  const moves = Object.keys(D.moves).filter(k => D.moves[k].t === from);
  assert.ok(moves.length);
  T.renameTypeIn(D, from, 'Zap');
  assert.equal(D.rules.battle.shockType, 'Zap');
  for (const k of moves) assert.equal(D.moves[k].t, 'Zap');
  for (const t of D.types) assert.ok(![...t.strong, ...t.weak].includes(from));
  for (const L of D.lines) for (const a of L.types) assert.ok(!a.includes(from));
});

test('a deleted type leaves Normal moves and Billies with a type each', () => {
  const D = copy(),
    from = D.types[1].id;
  T.renameTypeIn(D, from, null);
  for (const m of Object.values(D.moves)) assert.notEqual(m.t, from);
  for (const L of D.lines) for (const a of L.types) assert.ok(a.length && !a.includes(from));
});
