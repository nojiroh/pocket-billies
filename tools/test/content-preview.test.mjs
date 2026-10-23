// Studio plan Phase 4: logic/content-preview.js, what the Studio's content editors ask the logic worker. Each answer is
// the game's own logic: the Perk preview's stats are rules.js stat times the battle's stage factor, its numbers
// the fx readers' (clamped products named); a leader's run values are runFoes on that row; the stand-ins are
// standInSpecies'.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readGameData } from '../data-files.mjs';
import { data, fn, GAME_DATA, modules } from './setup-real.mjs';

const P = modules['content-preview'],
  E = modules.effects,
  { stageFactor } = modules['battle-engine'],
  { RULES, TRAINERS, SPECIES, standInSpecies } = data,
  SP = GAME_DATA.lines[0].id + '1';

test('stageFactor is the battle’s: +1 is x1.5, +2 x2, -1 x2/3, 0 x1', () => {
  assert.deepEqual([stageFactor(0), stageFactor(1), stageFactor(2), stageFactor(-1)], [1, 1.5, 2, 2 / 3]);
});

test('relic preview: nothing held changes nothing', () => {
  const p = P.perkPreview([], { sp: SP, lvl: 20 });
  assert.equal(p.sample.sp, SP);
  for (const s of p.stats) assert.equal(s.after, s.before, s.id);
  assert.deepEqual(p.money.prize[0], p.money.prize[1]);
  assert.equal(p.catch, 1);
  assert.deepEqual([p.damage.dealH, p.damage.take, p.heal.share, p.payout.research], [1, 1, 0, 1]);
  assert.deepEqual(p.limited, []);
});

test('relic preview: each kind reads its rows through the game’s fx functions', () => {
  const p = P.perkPreview(['insider', 'offshore', 'shelter', 'takeover', 'hedge', 'severance', 'options', 'writeoff'], {
      sp: SP,
      lvl: 30,
    }),
    m = fn('makeBilly')(SP, 30),
    hus = p.stats.find(s => s.id === 'hus');
  assert.equal(hus.before, fn('stat')(m, 'hus'));
  assert.equal(hus.stage, 1);
  assert.equal(hus.after, Math.round(hus.before * 1.5));
  assert.equal(p.money.reward[1], Math.round(RULES.run.foes.miniboss.reward * 1.2));
  assert.equal(p.price.heal[1], Math.round(RULES.run.healCost * 0.5));
  assert.equal(p.damage.dealH, 1.15);
  assert.equal(p.damage.dealS, 1);
  assert.equal(p.damage.take, 0.9);
  assert.equal(p.heal.share, 0.15);
  assert.equal(p.payout.research, 1.15);
  assert.equal(p.payout.itemShare[1], Math.min(1, RULES.run.payout.itemShare * 2));
});

test('relic preview: a product past FX_LIMIT is named with the product used', () => {
  const R = data.PERKS;
  R.__a = { name: 'A', d: 'a', rarity: 'common', fx: [{ kind: 'money', mult: 3 }] };
  R.__b = { name: 'B', d: 'b', rarity: 'common', fx: [{ kind: 'money', mult: 2 }] };
  try {
    const p = P.perkPreview(['__a', '__b'], { sp: SP, lvl: 10 });
    assert.deepEqual(p.limited, [{ kind: 'money', what: '', raw: 6, used: E.FX_LIMIT.hi }]);
    assert.equal(p.money.reward[1], RULES.run.foes.miniboss.reward * E.FX_LIMIT.hi);
  } finally {
    delete R.__a;
    delete R.__b;
  }
});

test('leader run values: runFoes on each mini-boss row and the boss row, for every mini-boss leader', () => {
  const V = P.leaderRunValues(),
    leaders = Object.values(TRAINERS).filter(T => T.miniboss),
    rows = modules['run-map'].runMapRows(RULES.run.map);
  assert.deepEqual(Object.keys(V).sort(), leaders.map(T => T.id).sort());
  const one = V[leaders[0].id];
  assert.deepEqual(
    one.map(r => [r.kind, r.row]),
    rows.flatMap((role, row) => (role === 'guard' ? [['miniboss', row]] : role === 'last' ? [['boss', row]] : []))
  );
  for (const r of one) {
    assert.equal(r.reward, RULES.run.foes[r.kind].reward);
    const top = RULES.run.wild.lv[1] + r.row * RULES.run.wild.perRow + RULES.run.foes[r.kind].up;
    assert.equal(r.levels[1], Math.min(100, top), 'the strongest is at the row’s top level plus up');
  }
  assert.equal(one.at(-1).team.length, 1, 'the boss brings its strongest Billie only');
  assert.deepEqual(Object.keys(P.leaderRunValues([leaders[0].id])), [leaders[0].id]);
});

test('species stand-ins: the game’s standInSpecies for ids it lacks; ids it has left out', () => {
  /* RO-1: the wild pools list only real lines now; the trainers still name legacy ids (in the data as read: the game
     puts its stand-ins in its own copy) */
  const legacy = Object.values(readGameData().trainers)
    .flatMap(T => (T.team || []).map(m => m.sp))
    .find(id => typeof id === 'string' && !SPECIES[id] && !/^@rival|^robot$/.test(id));
  assert.ok(legacy, 'a trainer still names a legacy id');
  const S = P.speciesStandIns([SP, legacy, '@rival', 'robot']);
  assert.deepEqual(Object.keys(S), [legacy]);
  assert.equal(S[legacy].to, standInSpecies(legacy));
  assert.equal(S[legacy].name, SPECIES[S[legacy].to].name);
});
