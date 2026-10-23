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

// every place in the data whose text is a type id, as [path, value]; terrain names (Grass, Water) are not types
const NOT_TYPES = [/^scenery\.terrains\.[^.]+\.name$/];
function typeFields(D, ids = new Set(D.types.map(t => t.id))) {
  const out = [];
  (function walk(v, path) {
    if (typeof v === 'string') {
      if (ids.has(v) && !NOT_TYPES.some(r => r.test(path))) out.push([path, v]);
    } else if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], path ? path + '.' + k : k);
  })(D, '');
  return out.filter(([p]) => !/^types\.\d+\.id$/.test(p));
}
// a relic's damage row may name a type (none does today): one is planted so the walk covers it
const planted = () => {
  const D = copy();
  D.relics._planted = { name: 'P', d: 'P', fx: [{ kind: 'damage', side: 'deal', type: D.types[0].id, mult: 1.5 }] };
  return D;
};

test('a rename rewrites every field of the data that names the type', () => {
  for (const { id } of GAME_DATA.types) {
    const D = planted(),
      before = typeFields(D).filter(([, v]) => v === id);
    T.renameTypeIn(D, id, 'Zz' + id);
    D.types.find(t => t.id === id).id = 'Zz' + id;
    const left = typeFields(D).filter(([, v]) => v === id);
    assert.deepEqual(left, [], `${id} is still named at ${left.map(([p]) => p).join(', ')}`);
    assert.deepEqual(
      typeFields(D)
        .filter(([, v]) => v === 'Zz' + id)
        .map(([p]) => p),
      before.map(([p]) => p)
    );
  }
});

test('a deleted type is named nowhere', () => {
  for (const { id } of GAME_DATA.types) {
    const D = planted();
    T.renameTypeIn(D, id, null);
    D.types = D.types.filter(t => t.id !== id);
    const left = typeFields(D, new Set([id]));
    assert.deepEqual(left, [], `${id} is still named at ${left.map(([p]) => p).join(', ')}`);
  }
});

test('after a rename the robots and Loopholes still pass the data checks', () => {
  const C = modules['data-checks'],
    checks = D => [...C.dataRobots(D), ...C.dataRelics(D)].map(p => p.join(': '));
  const was = checks(copy());
  for (const { id } of GAME_DATA.types) {
    const D = copy();
    T.renameTypeIn(D, id, 'Zz' + id);
    D.types.find(t => t.id === id).id = 'Zz' + id;
    assert.deepEqual(checks(D), was, id);
  }
});

test('deleting the type the battle rules name gives them a type that is left', () => {
  for (const { id } of GAME_DATA.types) {
    const D = copy();
    D.rules.battle.shockType = D.rules.battle.spinType = id;
    T.renameTypeIn(D, id, null);
    D.types = D.types.filter(t => t.id !== id);
    for (const k of ['shockType', 'spinType'])
      assert.ok(
        D.types.some(t => t.id === D.rules.battle[k]),
        `${id}: ${k}`
      );
  }
});
