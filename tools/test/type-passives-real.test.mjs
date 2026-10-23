// RF-3: the nine type passives (types.json passive, passiveName, passiveText) on the game's own data, each in a battle
// of its own with a silent host. Chances are fixed: the battle's stream (b.rng) is a list of numbers it hands out in
// order, so a test says exactly which crit roll and damage roll the engine draws.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { data, fn, hooks, logic, startedSave } from './setup-real.mjs';

const { MOVES, RULES, TYPES } = data;
const { SILENT_HOST } = logic;
const R = RULES.battle;

beforeEach(() => hooks.provide({ activeBattle: null }));

/** a battle with these species on each side, installed as the current one; rolls: the stream's numbers (the last
 * repeats) */
function battle(mine, foes, { lvl = 20, rolls = [0.5], kind = 'trainer' } = {}) {
  startedSave(mine[0], lvl);
  let i = 0;
  const b = fn('makeBattle')(
    kind,
    mine.map(sp => fn('makeBilly')(sp, lvl)),
    foes.map(sp => fn('makeBilly')(sp, lvl)),
    { host: SILENT_HOST, seen: {}, bag: {}, rng: () => rolls[Math.min(i++, rolls.length - 1)] }
  );
  hooks.provide({ activeBattle: b });
  return b;
}
const lines = b => b.events.map(e => e.t);
// a plain hit of a type (no effect, full accuracy), for damage that only the passives change
const plainMove = (t, c) =>
  Object.keys(MOVES).find(
    id =>
      MOVES[id].t === t &&
      MOVES[id].c === (c || MOVES[id].c) &&
      MOVES[id].c !== 'X' &&
      !MOVES[id].fx &&
      MOVES[id].a >= 100
  );

test('every type names its passive and says what it does; the ids are the nine the engine knows', () => {
  const known = ['kindling', 'undertow', 'regrowth', 'sharp', 'landlord', 'pivot', 'volatile', 'synergy', 'inherit'];
  assert.deepEqual(
    TYPES.map(t => data.PASSIVE[t]),
    known
  );
  for (const t of TYPES) {
    const p = data.PASSIVE_INFO[t];
    assert.ok(p.name && p.text, `${t} has a name and a text`);
  }
  assert.deepEqual(
    TYPES.map(t => data.PASSIVE_INFO[t].name),
    ['Kindling', 'Undertow', 'Regrowth', 'Live Wire', 'Bedrock', 'Slipstream', 'Wild Mind', 'Alloy', 'Parting Roar']
  );
  assert.equal(data.passiveName(['Psychic', 'Steel'], 'synergy'), 'Alloy');
  assert.equal(data.passiveName(['Water'], 'synergy'), '', 'a passive none of the types carries has no name');
});

test('Kindling (Fire): Attack +10% a turn in, up to +100%', () => {
  battle(['musk0'], ['gates0']);
  const v = fn('fieldState')(0),
    at = n => ((v.turnsIn = n), fn('effectiveStat')(0, 'lev'));
  const a0 = at(0);
  assert.ok(Math.abs(at(3) / a0 - (1 + 3 * R.kindlingBoost)) < 0.01);
  assert.ok(Math.abs(at(50) / a0 - (1 + R.kindlingTurns * R.kindlingBoost)) < 0.01, 'it stops at the cap');
  battle(['gates0'], ['musk0']);
  const w = fn('fieldState')(0),
    g0 = fn('effectiveStat')(0, 'lev');
  w.turnsIn = 5;
  assert.equal(fn('effectiveStat')(0, 'lev'), g0, 'another type does not ramp');
});

test('Undertow (Water): its Water moves hit 1.3x at a third of its HP or less, not above, not other types', () => {
  const water = plainMove('Water', 'S'),
    other = plainMove('None');
  const dmg = (hpShare, mid) => {
    battle(['bezos0'], ['musk0'], { rolls: [0.99, 0.5] });
    const me = fn('fighter')(0);
    me.hp = Math.max(1, Math.floor(fn('maxHp')(me) * hpShare));
    return fn('calcDamage')(0, 1, mid).dmg;
  };
  const full = dmg(1, water),
    low = dmg(0.3, water);
  assert.ok(Math.abs(low - full * R.undertowMult) <= 1, `${low} is 1.3x ${full}`);
  assert.equal(dmg(0.5, water), full, 'above a third: no boost');
  assert.equal(dmg(0.3, other), dmg(1, other), 'a move of another type: no boost');
});

test('Regrowth (Grass): 1/16 of its HP back at the end of a turn, named in the line', () => {
  const b = battle(['gates0'], ['musk0']);
  const me = fn('fighter')(0),
    mx = fn('maxHp')(me);
  me.hp = Math.floor(mx / 2);
  const was = me.hp;
  fn('endTurn')();
  assert.equal(me.hp - was, Math.max(1, Math.floor(mx / R.drainFraction)));
  assert.ok(
    lines(b).some(t => t === `${fn('billyName')(me)}’s Regrowth restored a little HP.`),
    lines(b).join(' | ')
  );
});

test('Live Wire (Electric): one crit stage up', () => {
  const mid = plainMove('None');
  /* a crit roll between stage 0's chance and stage 1's: Electric crits, the others don't */
  const roll = (R.critChances[0] + R.critChances[1]) / 2;
  battle(['zuck0'], ['musk0'], { rolls: [roll, 0.5] });
  assert.equal(fn('calcDamage')(0, 1, mid).crit, true);
  battle(['musk0'], ['zuck0'], { rolls: [roll, 0.5] });
  assert.equal(fn('calcDamage')(0, 1, mid).crit, false);
});

test('Wild Mind (Psychic): damage from 25% to 160% instead of 85% to 100%', () => {
  const mid = plainMove('None');
  const span = sp => {
    battle([sp], ['musk0'], { lvl: 100, rolls: [0.99, 0] });
    const lo = fn('calcDamage')(0, 1, mid).dmg;
    battle([sp], ['musk0'], { lvl: 100, rolls: [0.99, 0.999999] });
    return fn('calcDamage')(0, 1, mid).dmg / lo;
  };
  const wild = span('swift0'),
    plain = span('musk0');
  assert.ok(Math.abs(wild / (R.cryptoRollMax / R.cryptoRollMin) - 1) < 0.1, `Psychic swings ${wild.toFixed(2)}x`);
  assert.ok(Math.abs(plain - 1 / R.rollMin) < 0.1, `others swing ${plain.toFixed(2)}x`);
});

test('Alloy (Steel): +10% for each living teammate that shares its Steel type', () => {
  const mid = plainMove('None');
  const hit = (mates, alive) => {
    const b = battle(['kardashian1', ...mates], ['musk0'], { lvl: 100, rolls: [0.99, 0.5] });
    if (!alive) b.sides[0].team.slice(1).forEach(m => (m.hp = 0));
    return fn('calcDamage')(0, 1, mid).dmg;
  };
  const alone = hit(['gates0'], true),
    one = hit(['bezos3', 'gates0'], true),
    two = hit(['bezos3', 'kardashian2'], true);
  assert.ok(Math.abs(one / alone - (1 + R.retailSynergy)) < 0.02, `${one} / ${alone}`);
  assert.ok(Math.abs(two / alone - (1 + 2 * R.retailSynergy)) < 0.02, `${two} / ${alone}`);
  assert.equal(hit(['bezos3', 'kardashian2'], false), alone, 'fainted teammates count for nothing');
});

test('Slipstream (Flying): the first switch out costs no turn, the second does', () => {
  const b = battle(['swift0', 'swift1', 'gates0'], ['musk0']);
  const foe = b.sides[1].team[0],
    foeHp = foe.hp;
  fn('runTurn')([{ who: 0, k: 'switch', i: 1 }], b);
  assert.equal(b.sides[0].pivot, true);
  assert.ok(
    lines(b).some(t => /rode its Slipstream back without losing the turn/.test(t)),
    lines(b).join(' | ')
  );
  const mine = b.sides[0].team.map(m => m.hp);
  assert.deepEqual(
    mine,
    b.sides[0].team.map(m => fn('maxHp')(m)),
    'the foe did not act'
  );
  assert.equal(foe.hp, foeHp);
  fn('runTurn')([{ who: 0, k: 'switch', i: 2 }], b);
  assert.ok(
    lines(b).some(t => /, come back\.$/.test(t)),
    'the second switch is an ordinary one'
  );
});

test('Bedrock (Ground): from full HP a knockout hit leaves 1 HP, once a battle; never below full; no stone damage', () => {
  /* the hit as the engine lands it: a level 60 Billie against a level 5 Gildlet */
  startedSave('musk0', 60);
  const b = fn('makeBattle')('trainer', [fn('makeBilly')('musk0', 60)], [fn('makeBilly')('trump0', 5)], {
    host: SILENT_HOST,
    seen: {},
    bag: {},
    rng: () => 0.5,
  });
  hooks.provide({ activeBattle: b });
  const gild = b.sides[1].team[0],
    mid = plainMove('Fire', 'H') || plainMove('None');
  assert.ok(fn('calcDamage')(0, 1, mid).dmg > gild.hp, 'the hit would knock it out');
  fn('runTurn')([{ who: 0, k: 'move', mid, tk: 1 }], b);
  assert.equal(gild.hp, 1);
  assert.ok(
    lines(b).some(t => t === `${fn('billyName')(gild)} held on with Bedrock!`),
    lines(b).join(' | ')
  );
  assert.deepEqual(b.sides[1].held, [0]);
  /* healed to full, it doesn't hold again this battle */
  gild.hp = fn('maxHp')(gild);
  const r = { dmg: gild.hp + 10 };
  assert.equal(fn('bedrockHolds')(1, r), false);
  assert.equal(r.dmg, gild.hp + 10);

  battle(['musk0'], ['trump0']);
  const g2 = fn('fighter')(1);
  g2.hp -= 1;
  assert.equal(fn('bedrockHolds')(1, { dmg: 999 }), false, 'below full HP it does not hold');
  battle(['musk0'], ['gates0']);
  assert.equal(fn('bedrockHolds')(1, { dmg: 999 }), false, 'another type does not hold');

  /* sharp stones hurt others coming in, not Ground */
  const s = battle(['musk0', 'trump0', 'gates0'], ['musk0']);
  s.sides[0].rent = true;
  fn('doSwitch')(0, 1);
  assert.equal(fn('fighter')(0).hp, fn('maxHp')(fn('fighter')(0)), 'Gildlet takes no stone damage');
  fn('doSwitch')(0, 2);
  assert.ok(fn('fighter')(0).hp < fn('maxHp')(fn('fighter')(0)), 'Kidling does');
});

test('Parting Roar (Dragon): when it faints, the next one in gets +1 Attack and +1 Sp. Atk, on either side', () => {
  for (const si of [0, 1]) {
    const b = si ? battle(['musk0'], ['musk2', 'gates0']) : battle(['musk2', 'gates0'], ['musk0']);
    const k = si; /* actor 0 is yours, 1 the foe's */
    fn('fighter')(k).hp = 0;
    fn('checkFaints')();
    /* yours wait for your pick of who comes in; the foe's next comes in at once */
    if (!si) {
      assert.ok(b.sides[si].inh, 'the roar waits for the next one in');
      fn('doSwitch')(k, 1);
    }
    assert.equal(fn('fighter')(k).sp, 'gates0');
    const st = fn('fieldState')(k).st;
    assert.equal(st.lev, 1);
    assert.equal(st.lob, 1);
    assert.equal(st.law, 0);
    assert.ok(
      lines(b).some(t => /’s Parting Roar fired up /.test(t)),
      lines(b).join(' | ')
    );
    assert.equal(b.sides[si].inh, null);
  }
  /* another type leaves nothing behind */
  const b = battle(['musk0', 'gates0'], ['musk0']);
  fn('fieldState')(0).st.lev = 2;
  fn('fighter')(0).hp = 0;
  fn('checkFaints')();
  assert.equal(b.sides[0].inh, null);
});
