// PK-3: the battle kit's effect kinds in battle (perks-track.md 5.2 and section 7): crit, immune, inflict, chip,
// first and revive, each with test-only Perks first; then the 15 Wave A Perks of perks.json, each working in a
// battle, and a battle holding all of them at once staying finite.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { data, fn, hooks, modules, reseed, said, startedSave } from './setup-real.mjs';

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
/** a damaging move of a fighter that never misses (of a category when given) */
const sureHit = (m, cat) =>
  m.moves.find(id => {
    const M = data.MOVES[id];
    return (
      M &&
      M.p > 0 &&
      M.c !== 'X' &&
      (!cat || M.c === cat) &&
      (!M.a || M.a >= 100) &&
      !(M.fx && (M.fx.delay || M.fx.protect || M.fx.spread || M.fx.status || M.fx.selfStatus))
    );
  });
/** any damaging, never-missing move in the game of a category (to teach a fighter) */
const anyHit = cat =>
  Object.keys(data.MOVES).find(id => {
    const M = data.MOVES[id];
    return (
      M.p > 0 &&
      M.c === cat &&
      (!M.a || M.a >= 100) &&
      !M.pr &&
      !(M.fx && Object.keys(M.fx).some(k => k !== 'crit' || M.fx.crit))
    );
  });
/** the battle's stream, held at one value while `run` runs */
const fixedRoll = (b, v, run) => {
  const rng = b.rng;
  b.rng = () => v;
  try {
    return run();
  } finally {
    b.rng = rng;
  }
};
const foe = b => b.sides[1].team[0];
const mine = b => b.sides[0].team[0];
const tough = m => {
  m.hp = 99999;
  return m;
};

/* ---------- crit ---------- */

test('PK-3 crit: stages make your hits critical more often (critChances by stage), never the foe’s', () => {
  const { P, fx } = perks({ id: 'test_laser', fx: [{ kind: 'crit', stages: 3 }] });
  const mid = anyHit('H'),
    at = data.RULES.battle.critChances[3] - 0.01;
  assert.ok(at > data.RULES.battle.critChances[0], 'a roll between stage 0 and stage 3');
  withPerks(P, () => {
    const b = battle(fx);
    assert.equal(
      fixedRoll(b, at, () => fn('calcDamage')(0, 1, mid).crit),
      true,
      'yours: stage 3'
    );
    assert.equal(
      fixedRoll(b, at, () => fn('calcDamage')(1, 0, mid).crit),
      false,
      'the foe: stage 0'
    );
  });
  const b = battle(null);
  assert.equal(
    fixedRoll(b, at, () => fn('calcDamage')(0, 1, mid).crit),
    false,
    'no Perk: stage 0'
  );
  /* stages add up and stop at FX_CRIT */
  assert.equal(
    fn('fxCrit')([
      { kind: 'crit', stages: 2, src: 'a' },
      { kind: 'crit', stages: 3, src: 'b' },
    ]),
    3
  );
  assert.equal(fn('fxCrit')([{ kind: 'crit', when: 'move', src: 'a' }]), 0, 'a crit row at a moment gives no stages');
});

test('PK-3 crit at a move with every: each Nth attack of yours is a critical hit, counted over the run', () => {
  const { P, fx } = perks({
    id: 'test_pen',
    name: 'Test Pen',
    say: 'click',
    fx: [{ kind: 'crit', when: 'move', every: 3, if: 'cat:H|S' }],
  });
  withPerks(P, () => {
    const marks = {},
      b = battle(fx, { perkState: marks }),
      mid = sureHit(fn('fighter')(0));
    tough(foe(b));
    const crits = [];
    fixedRoll(b, 0.99, () => {
      for (let i = 0; i < 6; i++) {
        b.events.length = 0;
        fn('useMove')(0, mid, 1);
        crits.push(lines(b).includes('A critical hit!'));
      }
    });
    assert.deepEqual(crits, [false, false, true, false, false, true]);
    assert.equal(marks['test_pen/0'].n, 0, 'the run’s count');
    /* the foe's moves don't count, and its hits aren't made critical */
    b.events.length = 0;
    fixedRoll(b, 0.99, () => {
      tough(mine(b));
      for (let i = 0; i < 3; i++) fn('useMove')(1, sureHit(fn('fighter')(1)), 0);
    });
    assert.ok(!lines(b).includes('A critical hit!'));
    assert.equal(marks['test_pen/0'].n, 0);
  });
});

/* ---------- immune ---------- */

test('PK-3 immune: a status can’t land on yours (with a line), the foe still gets it', () => {
  const { P, fx } = perks(
    { id: 'test_mitts', name: 'Test Mitts', fx: [{ kind: 'immune', what: 'brn' }] },
    { id: 'test_muffs', name: 'Test Muffs', fx: [{ kind: 'immune', what: 'slp', if: 'lead' }] }
  );
  withPerks(P, () => {
    const b = battle(fx);
    fn('inflict')(0, 'brn', true);
    assert.equal(mine(b).status ?? null, null);
    assert.ok(
      lines(b).some(t => /^Test Mitts kept .* from being burned\.$/.test(t)),
      lines(b).join('\n')
    );
    fn('inflict')(0, 'slp', true);
    assert.equal(mine(b).status ?? null, null, 'the lead');
    assert.ok(lines(b).some(t => /^Test Muffs kept .* from falling asleep\.$/.test(t)));
    fn('inflict')(0, 'par', true);
    assert.equal(mine(b).status, 'par', 'nothing against paralysis');
    fn('inflict')(1, 'brn', true);
    assert.equal(foe(b).status, 'brn', 'the foe');
  });
  const b = battle(null);
  fn('inflict')(0, 'brn', true);
  assert.equal(mine(b).status, 'brn', 'no Perk');
});

test('PK-3 immune: the Sandstorm and sharp stones don’t hurt yours; without the Perk they do', () => {
  const { P, fx } = perks({
    id: 'test_suit',
    fx: [
      { kind: 'immune', what: 'sandstorm' },
      { kind: 'immune', what: 'stones' },
    ],
  });
  const shock = data.RULES.battle.shockType;
  for (const held of [true, false])
    withPerks(P, () => {
      const b = battle(held ? fx : null),
        notShock = m => !fn('billyTypes')(m).includes(shock);
      if (!notShock(mine(b)) || !notShock(foe(b))) return;
      const hp = mine(b).hp,
        foeHp = foe(b).hp;
      b.market = { k: 'sand', n: 3 };
      fn('endTurn')();
      assert.equal(mine(b).hp === hp, held, `sandstorm, held ${held}`);
      assert.ok(foe(b).hp < foeHp, 'the foe is buffeted');
      b.market = null;
      b.sides[0].stones = true;
      const next = b.sides[0].team[1],
        hp2 = next.hp;
      fn('doSwitch')(0, 1);
      assert.equal(
        next.hp === hp2,
        held || fn('hasPassive')(fn('billyTypes')(next), 'bedrock'),
        `stones, held ${held}`
      );
    });
});

test('PK-3 immune: an event’s status skips a team holding the Perk (runImmune)', () => {
  const { P } = perks({ id: 'test_mitts', fx: [{ kind: 'immune', what: 'brn' }] });
  const s = startedSave(starter(), 10);
  s.run = { perks: ['test_mitts'] };
  assert.equal(fn('runImmune')(s, P, 'brn'), true);
  assert.equal(fn('runImmune')(s, P, 'par'), false);
  s.run = { perks: [] };
  assert.equal(fn('runImmune')(s, P, 'brn'), false);
});

/* ---------- inflict ---------- */

test('PK-3 inflict: a hit of yours of the category gives the foe the status by the battle’s roll, with a line', () => {
  const { P, fx } = perks({
    id: 'test_buzzer',
    name: 'Test Buzzer',
    fx: [{ kind: 'inflict', status: 'par', chance: 0.15, when: 'hit', if: 'cat:H' }],
  });
  const H = anyHit('H'),
    S = anyHit('S');
  withPerks(P, () => {
    /* a roll under the chance lands it (every roll of the stream is held at 0.1 < 0.15) */
    let b = battle(fx);
    tough(foe(b));
    fixedRoll(b, 0.1, () => fn('useMove')(0, H, 1));
    assert.equal(foe(b).status, 'par');
    assert.ok(lines(b).includes('Test Buzzer kicked in!'), lines(b).join('\n'));
    /* over the chance: nothing */
    b = battle(fx);
    tough(foe(b));
    fixedRoll(b, 0.2, () => fn('useMove')(0, H, 1));
    assert.equal(foe(b).status ?? null, null);
    /* a special hit: the condition doesn't hold */
    b = battle(fx);
    tough(foe(b));
    fixedRoll(b, 0.01, () => fn('useMove')(0, S, 1));
    assert.equal(foe(b).status ?? null, null);
    /* the foe hitting yours: nothing on yours */
    b = battle(fx);
    tough(mine(b));
    fixedRoll(b, 0.01, () => fn('useMove')(1, H, 0));
    assert.equal(mine(b).status ?? null, null);
  });
});

test('PK-3 inflict: chances acting together count at most 50%, laid end to end on one roll', () => {
  const rows = [
    { kind: 'inflict', status: 'par', chance: 0.5, src: 'a' },
    { kind: 'inflict', status: 'brn', chance: 0.5, src: 'b' },
  ];
  const pick = r => (fn('fxInflictPick')(rows, r) || {}).status || null;
  assert.equal(pick(0.1), 'par');
  assert.equal(pick(0.3), 'brn', '0.25 each once scaled to 0.5 together');
  assert.equal(pick(0.49), 'brn');
  assert.equal(pick(0.5), null, 'never past 50%');
  assert.equal(fn('fxInflictPick')([{ kind: 'inflict', status: 'slp', chance: 0.1 }], 0.1), null);
  /* a seeded battle with two of them: the battle's stream, so the same seed gives the same statuses */
  const { P, fx } = perks(
    { id: 'test_a', fx: [{ kind: 'inflict', status: 'par', chance: 0.5, when: 'hit' }] },
    { id: 'test_b', fx: [{ kind: 'inflict', status: 'brn', chance: 0.5, when: 'hit' }] }
  );
  const H = anyHit('H'),
    play = () =>
      withPerks(P, () => {
        const got = [];
        for (let i = 0; i < 40; i++) {
          const b = battle(fx, { seed: 'inflict-' + i });
          tough(foe(b));
          fn('useMove')(0, H, 1);
          got.push(foe(b).status || '-');
        }
        return got.join(' ');
      });
  const one = play();
  assert.equal(play(), one, 'replayable');
  const landed = one.split(' ').filter(x => x !== '-').length;
  assert.ok(landed > 5 && landed < 35, `about half of 40: ${one}`);
});

/* ---------- chip ---------- */

test('PK-3 chip: a burn takes half as much from yours at a turn’s end; the foe’s burn is the same', () => {
  const { P, fx } = perks({ id: 'test_suit', fx: [{ kind: 'chip', what: 'burn', mult: 0.5 }] });
  const fr = Math.max(2, data.RULES.battle.drainFraction),
    lost = held =>
      withPerks(P, () => {
        const b = battle(held ? fx : null, {}, 2, 40);
        mine(b).status = 'brn';
        foe(b).status = 'brn';
        const a = mine(b).hp,
          e = foe(b).hp;
        fn('endTurn')();
        return [a - mine(b).hp, e - foe(b).hp, fn('maxHp')(mine(b)), fn('maxHp')(foe(b))];
      });
  const [mineHeld, foeHeld, mx, fmx] = lost(true),
    [mineNone, foeNone] = lost(false);
  assert.equal(mineNone, Math.max(1, Math.floor(mx / fr)));
  assert.equal(mineHeld, Math.max(1, Math.floor((mx / fr) * 0.5)));
  assert.ok(mineHeld < mineNone, `${mineHeld} < ${mineNone}`);
  assert.equal(foeHeld, foeNone);
  assert.equal(foeHeld, Math.max(1, Math.floor(fmx / fr)));
});

/* ---------- first ---------- */

test('PK-3 first: on turn 1 yours move before a faster foe (with a line); from turn 2 speed decides again', () => {
  const { P, fx } = perks({ id: 'test_clock', name: 'Test Clock', fx: [{ kind: 'first', if: 'turn:1' }] });
  const H = anyHit('H'),
    order = b =>
      b.events
        .filter(e => e.an && e.an.k === 'move')
        .map(e => e.an.si)
        .join(',');
  for (const held of [true, false])
    withPerks(P, () => {
      const b = battle(held ? fx : null);
      tough(mine(b));
      tough(foe(b));
      b.sides[0].f[0].v.st.hus = -6;
      b.sides[1].f[0].v.st.hus = 6;
      fn('runTurn')([{ who: 0, k: 'move', mid: H, tk: 1 }], b);
      assert.equal(b.turn, 1);
      assert.match(order(b), held ? /^0,1/ : /^1,0/, `turn 1, held ${held}`);
      assert.equal(
        lines(b).some(t => /^Test Clock: .* moves first\.$/.test(t)),
        held
      );
      fn('runTurn')([{ who: 0, k: 'move', mid: H, tk: 1 }], b);
      assert.match(order(b), /^1,0/, `turn 2, held ${held}`);
    });
});

/* ---------- revive ---------- */

test('PK-3 revive: once a run a wiped team gets back up with half its HP, back on the field; the next wipe loses', () => {
  const { P, fx } = perks({
    id: 'test_warranty',
    name: 'Test Warranty',
    fx: [{ kind: 'revive', share: 0.5, once: 'run' }],
  });
  withPerks(P, () => {
    const marks = {},
      b = battle(fx, { perkState: marks }),
      team = b.sides[0].team;
    team.forEach(m => ((m.hp = 0), (m.status = 'brn')));
    fn('checkFaints')();
    assert.ok(!b.over, 'not lost');
    for (const m of team) {
      assert.equal(m.hp, Math.max(1, Math.floor(fn('maxHp')(m) * 0.5)));
      assert.equal(m.status, null);
    }
    assert.equal(b.sides[0].f[0].on, true);
    assert.equal(b.sides[0].f[0].down, false);
    assert.ok(lines(b).includes('Test Warranty: your team got back up!'), lines(b).join('\n'));
    assert.deepEqual(marks['test_warranty/0'], { used: 1 }, 'spent for the run');
    /* the battle goes on: a move works */
    tough(foe(b));
    fn('useMove')(0, anyHit('H'), 1);
    team.forEach(m => (m.hp = 0));
    fn('checkFaints')();
    assert.equal(b.over, 'lose', 'the second wipe');
    /* a later battle of the same run: spent */
    const again = battle(fx, { perkState: marks });
    again.sides[0].team.forEach(m => (m.hp = 0));
    fn('checkFaints')();
    assert.equal(again.over, 'lose');
  });
  const none = battle(null);
  none.sides[0].team.forEach(m => (m.hp = 0));
  fn('checkFaints')();
  assert.equal(none.over, 'lose', 'no Perk');
});

test('PK-3 revive: in a double battle both of your places come back, each with its own Billie', () => {
  const { P, fx } = perks({ id: 'test_warranty', fx: [{ kind: 'revive', share: 0.5, once: 'battle' }] });
  withPerks(P, () => {
    const b = battle(fx, { fmt: 'double' }, 3);
    b.sides[0].team.forEach(m => (m.hp = 0));
    fn('checkFaints')();
    assert.ok(!b.over);
    const on = b.sides[0].f.filter(f => f.on).map(f => f.act);
    assert.equal(on.length, 2);
    assert.equal(new Set(on).size, 2, on.join());
    assert.equal(fn('liveActors')(0).length, 2);
  });
});

/* ---------- the 15 Wave A Perks of perks.json, each in a battle ---------- */

const WAVE_A = [
  'rubber_stamp',
  'click_pen',
  'laser_pointer',
  'screen_protector',
  'power_bank',
  'mic_drop',
  'joy_buzzer',
  'hot_sauce',
  'oven_mitts',
  'noise_headphones',
  'rubber_boots',
  'hazmat_suit',
  'alarm_clock',
  'plot_armor',
  'warranty_card',
];
/** a battle holding these Perks of perks.json, with the run's marks */
const real = (ids, extra = {}, n = 2) => {
  const marks = {},
    b = battle(fn('fxOfRun')({ perks: ids }, data.PERKS), { perkState: marks, ...extra }, n);
  return { b, marks };
};

test('PK-3 Wave A: all 15 are in perks.json with a picture, and nothing else is new', () => {
  for (const id of WAVE_A) {
    assert.ok(data.PERKS[id], id);
    assert.equal(data.PERKS[id].img, `perks/${id}.svg`);
  }
  assert.equal(Object.keys(data.PERKS).length, 28);
});

test('PK-3 Rubber Stamp: the first hit of the battle deals 50% more, then not; it says “Approved!”', () => {
  const { b } = real(['rubber_stamp']),
    M = data.MOVES[anyHit('H')];
  tough(foe(b));
  assert.equal(fn('fxHitMult')(0, 1, M, { crit: false, te: 1 }), 1.5);
  fn('useMove')(0, anyHit('H'), 1);
  assert.ok(lines(b).includes('Rubber Stamp: Approved!'), lines(b).join('\n'));
  assert.equal(fn('fxHitMult')(0, 1, M, { crit: false, te: 1 }), 1);
});

test('PK-3 Click Pen: every 8th attack is critical (the run’s count), status moves don’t count', () => {
  const { b, marks } = real(['click_pen']),
    H = anyHit('H'),
    X = Object.keys(data.MOVES).find(id => data.MOVES[id].c === 'X' && data.MOVES[id].fx && data.MOVES[id].fx.tgtStage);
  tough(foe(b));
  const crits = [];
  fixedRoll(b, 0.99, () => {
    for (let i = 0; i < 8; i++) {
      if (i === 3 && X) fn('useMove')(0, X, 1);
      b.events.length = 0;
      fn('useMove')(0, H, 1);
      crits.push(lines(b).includes('A critical hit!'));
    }
  });
  assert.deepEqual(crits, [false, false, false, false, false, false, false, true]);
  assert.ok(
    lines(b).some(t => /^Click Pen: Click! .* lines up a critical hit\.$/.test(t)),
    lines(b).join('\n')
  );
  assert.equal(marks['click_pen/0'].n, 0);
});

test('PK-3 Laser Pointer: a roll that misses stage 0 lands at stage 1', () => {
  const { b } = real(['laser_pointer']),
    C = data.RULES.battle.critChances,
    r = (C[0] + C[1]) / 2;
  assert.equal(
    fixedRoll(b, r, () => fn('calcDamage')(0, 1, anyHit('H')).crit),
    true
  );
  const none = battle(null);
  assert.equal(
    fixedRoll(none, r, () => fn('calcDamage')(0, 1, anyHit('H')).crit),
    false
  );
});

test('PK-3 Screen Protector: each of yours takes half from the first hit on it, once a battle', () => {
  const { b } = real(['screen_protector']),
    H = anyHit('H'),
    M = data.MOVES[H];
  tough(mine(b));
  assert.equal(fn('fxHitMult')(1, 0, M, { crit: false, te: 1 }), 0.5);
  fn('useMove')(1, H, 0);
  assert.ok(
    lines(b).some(t => /^Screen Protector: .* took only half the hit\.$/.test(t)),
    lines(b).join('\n')
  );
  assert.equal(fn('fxHitMult')(1, 0, M, { crit: false, te: 1 }), 1, 'spent for this one');
  fn('doSwitch')(0, 1);
  assert.equal(fn('fxHitMult')(1, 0, M, { crit: false, te: 1 }), 0.5, 'the next Billie has its own');
});

test('PK-3 Power Bank: once a battle, one of yours ending a turn under a quarter heals 25%', () => {
  const { b } = real(['power_bank']),
    m = mine(b),
    mx = fn('maxHp')(m);
  m.hp = 1;
  fn('endTurn')();
  assert.equal(m.hp, 1 + Math.max(1, Math.floor(mx * 0.25)));
  assert.ok(lines(b).some(t => /^Power Bank: .* restored HP\.$/.test(t)));
  m.hp = 1;
  fn('endTurn')();
  assert.equal(m.hp, 1, 'once a battle');
});

test('PK-3 Mic Drop: knocking a foe out raises the knocker’s Attack and Sp. Atk', () => {
  const { b } = real(['mic_drop']);
  foe(b).hp = 1;
  fn('useMove')(0, anyHit('H'), 1);
  assert.equal(foe(b).hp, 0);
  assert.equal(b.sides[0].f[0].v.st.lev, 1);
  assert.equal(b.sides[0].f[0].v.st.lob, 1);
  assert.ok(lines(b).some(t => /^Mic Drop: .*Attack rose\.$/.test(t)));
});

test('PK-3 Joy Buzzer and Hot Sauce: physical hits may paralyze, special hits may burn', () => {
  let { b } = real(['joy_buzzer']);
  tough(foe(b));
  fixedRoll(b, 0.1, () => fn('useMove')(0, anyHit('H'), 1));
  assert.equal(foe(b).status, 'par');
  assert.ok(lines(b).includes('Joy Buzzer kicked in!'));
  ({ b } = real(['hot_sauce']));
  tough(foe(b));
  fixedRoll(b, 0.05, () => fn('useMove')(0, anyHit('S'), 1));
  assert.equal(foe(b).status, 'brn');
  ({ b } = real(['hot_sauce']));
  tough(foe(b));
  fixedRoll(b, 0.05, () => fn('useMove')(0, anyHit('H'), 1));
  assert.equal(foe(b).status ?? null, null, 'not on a physical hit');
});

test('PK-3 Oven Mitts, Noise-Cancelling Headphones, Rubber Boots: each keeps its status off yours', () => {
  for (const [id, st] of [
    ['oven_mitts', 'brn'],
    ['noise_headphones', 'slp'],
    ['rubber_boots', 'par'],
  ]) {
    const { b } = real([id]);
    fn('inflict')(0, st, true);
    assert.equal(mine(b).status ?? null, null, id);
    assert.ok(lines(b).some(t => t.startsWith(data.PERKS[id].name + ' kept ')));
    fn('inflict')(1, st, true);
    assert.equal(foe(b).status, st, `${id}: the foe`);
  }
});

test('PK-3 Hazmat Suit: no Sandstorm or stones hurt, a burn half', () => {
  const { b } = real(['hazmat_suit']),
    shock = data.RULES.battle.shockType,
    fr = Math.max(2, data.RULES.battle.drainFraction),
    m = mine(b),
    mx = fn('maxHp')(m);
  if (!fn('billyTypes')(m).includes(shock)) {
    b.market = { k: 'sand', n: 3 };
    m.status = 'brn';
    const hp = m.hp;
    fn('endTurn')();
    assert.equal(hp - m.hp, Math.max(1, Math.floor((mx / fr) * 0.5)), 'half a burn, no Sandstorm');
  }
  b.market = null;
  b.sides[0].stones = true;
  const next = b.sides[0].team[1],
    hp2 = next.hp;
  fn('doSwitch')(0, 1);
  assert.equal(next.hp, hp2, 'no stones');
});

test('PK-3 Alarm Clock: yours move first on turn 1 only', () => {
  const { b } = real(['alarm_clock']),
    H = anyHit('H');
  tough(mine(b));
  tough(foe(b));
  b.sides[0].f[0].v.st.hus = -6;
  b.sides[1].f[0].v.st.hus = 6;
  const first = () => b.events.find(e => e.an && e.an.k === 'move').an.si;
  fn('runTurn')([{ who: 0, k: 'move', mid: H, tk: 1 }], b);
  assert.equal(first(), 0);
  fn('runTurn')([{ who: 0, k: 'move', mid: H, tk: 1 }], b);
  assert.equal(first(), 1);
});

test('PK-3 Plot Armor: your last Billie standing deals 30% more and takes 30% less', () => {
  const { b } = real(['plot_armor']),
    M = data.MOVES[anyHit('H')],
    h = { crit: false, te: 1 };
  assert.equal(fn('fxHitMult')(0, 1, M, h), 1, 'two standing');
  b.sides[0].team[1].hp = 0;
  assert.equal(fn('fxHitMult')(0, 1, M, h), 1.3);
  assert.equal(fn('fxHitMult')(1, 0, M, h), 0.7);
});

test('PK-3 Warranty Card: once a run, a wiped team gets back up with half its HP; then it is void', () => {
  const { b, marks } = real(['warranty_card']);
  b.sides[0].team.forEach(m => (m.hp = 0));
  fn('checkFaints')();
  assert.ok(!b.over);
  assert.ok(b.sides[0].team.every(m => m.hp === Math.max(1, Math.floor(fn('maxHp')(m) * 0.5))));
  assert.ok(lines(b).includes('Warranty Card: your team got back up!'));
  assert.deepEqual(marks['warranty_card/0'], { used: 1 });
});

test('PK-3 all 15 at once: whole battles end, every number finite, the stream replayable', () => {
  const play = seed => {
    const { b } = real(WAVE_A, { seed }, 3),
      out = [];
    for (let t = 0; t < 200 && !b.over; t++) {
      if ((b.needSwitch || []).length) {
        const i = fn('benchCandidates')(0)[0];
        if (i == null) break;
        fn('doSwitch')(b.needSwitch.shift(), i);
        continue;
      }
      const m = fn('fighter')(0);
      fn('runTurn')([{ who: 0, k: 'move', mid: sureHit(m) || m.moves[0], tk: 1 }], b);
      for (const side of b.sides)
        for (const q of side.team) assert.ok(Number.isInteger(q.hp) && q.hp >= 0, `hp ${q.hp}`);
      out.push(lines(b).length);
    }
    assert.ok(b.over, `${seed}: over within 200 turns`);
    return [b.over, ...out].join();
  };
  for (const seed of ['all-a', 'all-b', 'all-c']) assert.equal(play(seed), play(seed), seed);
  /* the damage rows of all 15 together stay within FX_LIMIT */
  const { b } = real(WAVE_A),
    M = data.MOVES[anyHit('H')];
  b.sides[0].team[1].hp = 0;
  const m = fn('fxHitMult')(0, 1, M, { crit: true, te: 2 });
  assert.ok(m >= modules.effects.FX_LIMIT.lo && m <= modules.effects.FX_LIMIT.hi, String(m));
});
