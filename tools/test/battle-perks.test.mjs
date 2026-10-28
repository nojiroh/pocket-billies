// PK-1: a run's Perks in battle with the effects core (perks-track.md section 7): stat rows for every Billie of yours
// that takes the field (the switch-in fix), the moments rows act at, their conditions, counters and once marks,
// the run's turnHeal, pinchHeal and turnHurt rows, and a Perk's line. Test-only Perks: perks.json is not changed.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { data, fn, hooks, reseed, said, startedSave } from './setup-real.mjs';

const { RULES, SPECIES } = data;
const starter = () => Object.keys(SPECIES).find(k => SPECIES[k].line === RULES.start.starters[0]);
const wild = () =>
  Object.keys(SPECIES).find(k => SPECIES[k].stage === 0 && !RULES.start.starters.includes(SPECIES[k].line));

beforeEach(() => {
  hooks.provide({ activeBattle: null });
  said.length = 0;
});

/** rows of made-up Perks, as fxOfRun gives them (test-only: never in perks.json) */
const perks = (...defs) => {
  const P = Object.fromEntries(defs.map((d, i) => [d.id || 'test' + i, { name: d.name || 'Test ' + i, ...d }]));
  return { P, fx: fn('fxOfRun')({ perks: Object.keys(P) }, P) };
};
/** a seeded wild battle with a team of `n`, holding these rows; extra laid over */
function battle(fx, extra = {}, n = 2, lvl = 12) {
  reseed(7);
  const s = startedSave(starter(), lvl);
  while (s.team.length < n) s.team.push(fn('makeBilly')(starter(), lvl));
  const foe = fn('makeBilly')(wild(), lvl);
  assert.ok(fn('newBattle')('wild', [foe], { fmt: 'single', seed: 'perk-test', ...(fx ? { fx } : {}), ...extra }));
  return hooks.activeBattle;
}
const lines = b => b.events.map(e => e.t || '').filter(Boolean);
const withPerks = (P, run) => {
  const old = { ...data.PERKS };
  Object.assign(data.PERKS, P);
  try {
    return run();
  } finally {
    for (const k of Object.keys(P)) if (!(k in old)) delete data.PERKS[k];
  }
};

test('PK-1 switch in: a Perk’s stat rows reach a Billie that comes in, with a line; the foe’s don’t', () => {
  const { P, fx } = perks({ id: 'test_shoes', name: 'Test Shoes', fx: [{ kind: 'stat', stat: 'hus', stages: 1 }] });
  withPerks(P, () => {
    const b = battle(fx);
    assert.equal(b.sides[0].f[0].v.st.hus, 1, 'the lead, at the start');
    fn('sayBattleFx')();
    assert.ok(
      lines(b).some(t => /^Test Shoes: .*Speed rose\.$/.test(t)),
      lines(b).join('\n')
    );
    b.events.length = 0;
    fn('doSwitch')(0, 1);
    assert.equal(b.sides[0].f[0].act, 1);
    assert.equal(b.sides[0].f[0].v.st.hus, 1, 'the one that came in');
    assert.ok(
      lines(b).some(t => /^Test Shoes: .*Speed rose\.$/.test(t)),
      lines(b).join('\n')
    );
    /* the foe coming in gets none */
    b.sides[1].team.push(fn('makeBilly')(wild(), 12));
    fn('doSwitch')(1, 1);
    assert.equal(b.sides[1].f[0].v.st.hus, 0);
  });
  /* without Perks: nothing on a switch */
  const none = battle(null);
  fn('doSwitch')(0, 1);
  assert.equal(none.sides[0].f[0].v.st.hus, 0);
  assert.equal(none.fxState, undefined, 'no marks made');
});

test('PK-1 switch in: a stat row’s condition is the Billie’s own, and once: billie gives each one once', () => {
  const { P, fx } = perks(
    { id: 'test_crown', fx: [{ kind: 'stat', stat: 'lev', stages: 2, if: 'lead' }] },
    { id: 'test_once', fx: [{ kind: 'stat', stat: 'law', stages: 1, once: 'billie' }] }
  );
  withPerks(P, () => {
    const b = battle(fx);
    assert.equal(b.sides[0].f[0].v.st.lev, 2, 'the lead');
    assert.equal(b.sides[0].f[0].v.st.law, 1);
    fn('doSwitch')(0, 1);
    /* still in the lead's place: actor 0 leads whoever stands there */
    assert.equal(b.sides[0].f[0].v.st.lev, 2);
    assert.equal(b.sides[0].f[0].v.st.law, 1, 'its first time in');
    fn('doSwitch')(0, 0);
    assert.equal(b.sides[0].f[0].v.st.law, 0, 'the first one again: spent');
  });
});

test('PK-1 turn end: the run’s turnHeal, pinchHeal and turnHurt rows act on yours on the field, not the foe', () => {
  const { P, fx } = perks(
    { id: 'test_tea', name: 'Test Tea', fx: [{ kind: 'turnHeal', share: 0.1 }] },
    { id: 'test_bank', name: 'Test Bank', fx: [{ kind: 'pinchHeal', at: 0.25, share: 0.5 }] },
    { id: 'test_thorn', name: 'Test Thorn', fx: [{ kind: 'turnHurt', share: 0.05, if: 'turn:3' }] }
  );
  withPerks(P, () => {
    const b = battle(fx),
      m = b.sides[0].team[0],
      e = b.sides[1].team[0],
      mx = fn('maxHp')(m);
    m.hp = Math.floor(mx / 2);
    e.hp = Math.floor(fn('maxHp')(e) / 2);
    const foeHp = e.hp;
    b.turn = 1;
    fn('endTurn')();
    assert.equal(m.hp, Math.floor(mx / 2) + Math.max(1, Math.floor(mx * 0.1)), 'turnHeal');
    assert.equal(e.hp, foeHp, 'not the foe');
    assert.ok(lines(b).some(t => /^Test Tea: .* restored a little HP\.$/.test(t)));
    /* low: the pinch heal, once for this Billie in this battle */
    m.hp = 1;
    fn('endTurn')();
    assert.ok(m.hp > Math.floor(mx * 0.5), `pinch: ${m.hp}`);
    assert.ok(lines(b).some(t => /^Test Bank: .* restored HP\.$/.test(t)));
    m.hp = 1;
    fn('endTurn')();
    assert.ok(m.hp < mx * 0.25, 'spent for this Billie');
    /* turnHurt on turn 3 only */
    m.hp = mx;
    b.turn = 3;
    fn('endTurn')();
    assert.equal(m.hp, mx - Math.max(1, Math.floor(mx * 0.05)));
    assert.ok(lines(b).some(t => /^Test Thorn: .* lost a little HP\.$/.test(t)));
  });
});

test('PK-1 turn end: pinchHeal with once: battle heals one of yours once in the battle', () => {
  const { P, fx } = perks({ id: 'test_bank', fx: [{ kind: 'pinchHeal', at: 0.25, share: 0.25, once: 'battle' }] });
  withPerks(P, () => {
    const b = battle(fx),
      m = b.sides[0].team[0];
    m.hp = 1;
    fn('endTurn')();
    assert.ok(m.hp > 1);
    fn('doSwitch')(0, 1);
    const n = b.sides[0].team[1];
    n.hp = 1;
    fn('endTurn')();
    assert.equal(n.hp, 1, 'spent for the battle');
  });
});

/** a damaging move of a fighter that never misses */
const sureHit = m =>
  m.moves.find(id => {
    const M = data.MOVES[id];
    return (
      M && M.p > 0 && M.c !== 'X' && (!M.a || M.a >= 100) && !(M.fx && (M.fx.delay || M.fx.protect || M.fx.spread))
    );
  });
const st = (b, k) => b.sides[k === 0 ? 0 : 1].f[0].v.st;

test('PK-1 moments: battleStart, switchIn, move, hit, hurt, crit, ko, faint, turnEnd and throwMiss each act', () => {
  const at = when => ({ id: 'test_' + when, name: 'At ' + when, say: 'hi', fx: [{ kind: 'heal', share: 0.01, when }] });
  const whens = ['battleStart', 'switchIn', 'move', 'hit', 'hurt', 'crit', 'ko', 'faint', 'turnEnd', 'throwMiss'];
  const { P, fx } = perks(...whens.map(at));
  withPerks(P, () => {
    const b = battle(fx, {}, 3),
      mine = b.sides[0].team,
      seen = () =>
        new Set(
          lines(b)
            .map(t => (/^At (\w+):/.exec(t) || [])[1])
            .filter(Boolean)
        ),
      hurtAll = () => mine.forEach(m => (m.hp = Math.max(1, m.hp - 5)));
    /* the start's line waits for sayBattleFx */
    assert.ok(!seen().has('battleStart') && b.fxSay.some(([t]) => /^At battleStart: hi$/.test(t)));
    fn('sayBattleFx')();
    assert.ok(seen().has('battleStart'));
    hurtAll();
    fn('doSwitch')(0, 1);
    hurtAll();
    const myMove = sureHit(fn('fighter')(0)),
      foeMove = sureHit(fn('fighter')(1));
    assert.ok(myMove && foeMove, 'moves that never miss');
    const crit = data.RULES.battle.critChances.slice();
    data.RULES.battle.critChances.fill(1);
    try {
      fn('useMove')(0, myMove, 1);
    } finally {
      data.RULES.battle.critChances.splice(0, crit.length, ...crit);
    }
    hurtAll();
    fn('useMove')(1, foeMove, 0);
    hurtAll();
    b.sides[1].team[0].hp = 1;
    fn('useMove')(0, myMove, 1);
    hurtAll();
    fn('endTurn')();
    hurtAll();
    for (let i = 0; i < 40 && !seen().has('throwMiss'); i++) {
      b.sides[1].team[0].hp = fn('maxHp')(b.sides[1].team[0]);
      fn('catchRoll')('pyramid', 0.0001, false);
    }
    hurtAll();
    fn('fighter')(0).hp = 0;
    fn('checkFaints')();
    const got = seen();
    for (const w of whens.slice(1)) assert.ok(got.has(w), `${w}: ${[...got].join(', ')}`);
  });
});

test('PK-1 moments: a battle start row acts on yours on the field, its line after the sides come out', () => {
  const { P, fx } = perks({
    id: 'test_horn',
    name: 'Test Horn',
    fx: [{ kind: 'stat', stat: 'lev', stages: 1, when: 'battleStart' }],
  });
  withPerks(P, () => {
    const b = battle(fx);
    assert.equal(st(b, 0).lev, 1);
    assert.equal(st(b, 1).lev, 0, 'not the foe');
    assert.ok(!lines(b).some(t => t.startsWith('Test Horn')), 'waiting');
    fn('sayBattleFx')();
    assert.ok(
      lines(b).some(t => /^Test Horn: .*Attack rose\.$/.test(t)),
      lines(b).join('\n')
    );
  });
});

test('PK-1 moments: ko raises the knocker; every N counts moves over battles on the run’s marks; once: battle', () => {
  const { P, fx } = perks(
    { id: 'test_mic', name: 'Test Mic', fx: [{ kind: 'stat', stat: 'lob', stages: 1, when: 'ko' }] },
    { id: 'test_pen', name: 'Test Pen', fx: [{ kind: 'stat', stat: 'hus', stages: 1, when: 'move', every: 3 }] },
    {
      id: 'test_stamp',
      name: 'Test Stamp',
      say: 'Approved, {name}!',
      fx: [{ kind: 'damage', side: 'deal', mult: 3, when: 'hit', once: 'battle' }],
    }
  );
  withPerks(P, () => {
    const perkState = {},
      b = battle(fx, { perkState }),
      mid = sureHit(fn('fighter')(0)),
      foe = b.sides[1].team[0];
    /* the stamp: the first hit is three times, said once; the next is not */
    const before = fn('maxHp')(foe);
    foe.hp = before;
    fn('useMove')(0, mid, 1);
    const first = before - foe.hp;
    assert.ok(
      lines(b).some(t => /^Test Stamp: Approved, .+!$/.test(t)),
      lines(b).join('\n')
    );
    foe.hp = before;
    fn('useMove')(0, mid, 1);
    const second = before - foe.hp;
    assert.ok(first > second * 2, `${first} then ${second}`);
    assert.equal(lines(b).filter(t => t.startsWith('Test Stamp')).length, 1);
    /* two moves made: the pen's count is on the run's marks */
    assert.equal(perkState['test_pen/0'].n, 2);
    assert.equal(st(b, 0).hus, 0);
    /* the knock out: the mic, and the pen's third move */
    st(b, 0).lob = 0;
    foe.hp = 1;
    fn('useMove')(0, mid, 1);
    assert.equal(st(b, 0).lob, 1, 'ko');
    assert.equal(st(b, 0).hus, 1, 'the 3rd move');
    assert.equal(perkState['test_pen/0'].n, 0);
    /* a new battle on the same run: the stamp again, the count goes on */
    const b2 = battle(fx, { perkState });
    assert.deepEqual(b2.fxState || {}, {}, 'its own marks, fresh');
    b2.sides[1].team[0].hp = before;
    fn('useMove')(0, mid, 1);
    assert.equal(perkState['test_pen/0'].n, 1);
    assert.ok(b2.fxState['test_stamp/0'].used);
  });
});

test('PK-1 moments: conditions in battle: the foe, the weather, low HP, the move’s category, super effective', () => {
  const mult = (row, extra = {}, prep) => {
    const { P, fx } = perks({ id: 'test_if', fx: [row] });
    return withPerks(P, () => {
      const b = battle(fx, extra);
      if (prep) prep(b);
      const mid = sureHit(fn('fighter')(0));
      return fn('fxHitMult')(0, 1, data.MOVES[mid], { crit: false, te: 1 });
    });
  };
  const deal = { kind: 'damage', side: 'deal', mult: 2 };
  assert.equal(mult({ ...deal, if: 'foe:wild' }), 2);
  assert.equal(mult({ ...deal, if: 'foe:trainer|leader' }), 1);
  assert.equal(mult({ ...deal, if: 'weather:rain' }, { wx: { k: 'rain', m: {} } }), 2);
  assert.equal(mult({ ...deal, if: 'weather:rain' }), 1, 'no weather is clear');
  assert.equal(mult({ ...deal, if: 'hp<0.5' }), 1);
  assert.equal(
    mult({ ...deal, if: 'hp<0.5' }, {}, b => (b.sides[0].team[0].hp = 1)),
    2
  );
  assert.equal(mult({ ...deal, if: 'lead' }), 2);
  assert.equal(mult({ ...deal, if: 'notLead' }), 1);
  assert.equal(mult({ ...deal, if: 'alone' }), 1, 'two of yours standing');
  assert.equal(mult({ ...deal, if: 'turn:1' }), 1, 'turn 0 before the first');
  const mid = data.MOVES[sureHit(fn('makeBilly')(starter(), 12))];
  assert.equal(mult({ ...deal, if: 'cat:' + mid.c }), 2);
  const { P, fx } = perks({ id: 'test_se', fx: [{ ...deal, if: 'superEffective' }] });
  withPerks(P, () => {
    battle(fx);
    const M = data.MOVES[sureHit(fn('fighter')(0))];
    assert.equal(fn('fxHitMult')(0, 1, M, { crit: false, te: 2 }), 2);
    assert.equal(fn('fxHitMult')(0, 1, M, { crit: false, te: 1 }), 1);
  });
});

test('PK-1 moments: a growth resets when one of yours faints, on the run’s marks', () => {
  const { P, fx } = perks({
    id: 'test_streak',
    fx: [{ kind: 'damage', side: 'deal', mult: 1, grow: { on: 'win', by: 0.05, max: 0.25, reset: 'faint' } }],
  });
  withPerks(P, () => {
    const perkState = { 'test_streak/0': { v: 0.15 } },
      b = battle(fx, { perkState }),
      M = data.MOVES[sureHit(fn('fighter')(0))];
    assert.ok(Math.abs(fn('fxHitMult')(0, 1, M, { crit: false, te: 1 }) - 1.15) < 1e-9);
    b.sides[0].team[0].hp = 0;
    fn('checkFaints')();
    assert.equal(perkState['test_streak/0'].v, 0);
  });
});

test('PK-1 moments: a battle without Perks makes no marks and says no Perk line', () => {
  const b = battle(null, {}, 3),
    mid = sureHit(fn('fighter')(0));
  fn('useMove')(0, mid, 1);
  fn('endTurn')();
  fn('doSwitch')(0, 1);
  assert.equal(b.fxState, undefined);
  assert.equal(b.fxSay, undefined);
  assert.equal(fn('fxBattleRows')(b), undefined);
});

test('PK-1 lines: a boon is named by its event, not its raw source; other sources by their names', () => {
  const fx = [{ kind: 'stat', stat: 'hus', stages: 1, src: 'event:ring_light' }],
    b = battle(fx);
  fn('sayBattleFx')();
  assert.ok(
    lines(b).some(t => /^Ring Light Shrine: .*Speed rose\.$/.test(t)),
    lines(b).join('\n')
  );
  assert.ok(!lines(b).some(t => t.includes('event:')));
  const name = fn('fxSrcName');
  assert.equal(name('event:fountain'), 'The fountain’s wish');
  assert.equal(name('expedition'), 'The Expedition');
  assert.equal(name('mono'), data.MODIFIERS.challenges.mono.name);
  assert.equal(name('rel:chosen'), 'Chosen');
  assert.equal(name('res:mo'), data.RESIDENTS.mo.name);
  assert.equal(name('lucky_charm'), data.PERKS.lucky_charm.name);
  assert.equal(name('event:no_such_place'), 'No such place');
});
