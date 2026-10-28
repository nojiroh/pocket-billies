// PK-7: Fine Print's effect kinds (perks-track.md 5.6 and section 7): recoil, a money row's add on arrival, loot,
// the run rules noDrop and faintPaysNothing, each with test-only Perks first; foe levels and the boss's HP taken
// mid-run; then the 12 Fine Print Perks of perks.json, each working with its downside, and every Perk of Waves A-D
// and Fine Print held at once staying finite.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { GAME_DATA, data, fn, hooks, modules, reseed, said, startedSave } from './setup-real.mjs';

const { RULES, SPECIES } = data;
const starter = () => Object.keys(SPECIES).find(k => SPECIES[k].line === RULES.start.starters[0]);
const wild = () =>
  Object.keys(SPECIES).find(k => SPECIES[k].stage === 0 && !RULES.start.starters.includes(SPECIES[k].line));

beforeEach(() => {
  hooks.provide({ activeBattle: null });
  said.length = 0;
});

/** made-up Perks (test-only: never in perks.json) */
const perks = (...defs) => {
  const P = Object.fromEntries(defs.map((d, i) => [d.id || 'test' + i, { name: d.name || 'Test ' + i, ...d }]));
  return { P, fx: fn('fxOfRun')({ perks: Object.keys(P) }, P) };
};
const withPerks = (P, run) => {
  const old = { ...data.PERKS };
  Object.assign(data.PERKS, P);
  try {
    return run();
  } finally {
    for (const k of Object.keys(P)) if (!(k in old)) delete data.PERKS[k];
  }
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
/** a status move that never misses and does nothing to HP */
const anyStatus = () =>
  Object.keys(data.MOVES).find(id => {
    const M = data.MOVES[id];
    return M.c === 'X' && (!M.a || M.a >= 100) && M.fx && M.fx.selfStage && Object.keys(M.fx).length === 1;
  });
const foe = b => b.sides[1].team[0];
const mine = b => b.sides[0].team[0];
const tough = m => {
  m.hp = 99999;
  return m;
};
const RULE = GAME_DATA.rules.run.perks;
/** a run holding these Perks */
const runOf = (...ids) => {
  const r = modules['run-state'].newRun('FINERUN001', 1, 1, { team: [] });
  r.perks = ids;
  return r;
};

/* ---------- recoil ---------- */

test('PK-7 recoil: an attack of yours that deals damage costs its user a share of its HP; never the foe’s', () => {
  const { P, fx } = perks({ id: 'test_chip', name: 'Test Chip', fx: [{ kind: 'recoil', share: 0.1 }] });
  const H = anyHit('H'),
    X = anyStatus();
  assert.ok(H && X, 'a sure physical hit and a status move');
  withPerks(P, () => {
    const b = battle(fx),
      m = mine(b),
      mx = fn('maxHp')(m);
    tough(foe(b));
    m.hp = mx;
    fn('useMove')(0, H, 1);
    assert.equal(m.hp, mx - Math.max(1, Math.floor(mx * 0.1)), 'the attack cost 10% of its HP');
    assert.ok(
      lines(b).some(t => /^Test Chip: .* lost some HP\.$/.test(t)),
      'a line names the Perk'
    );
    /* a status move costs nothing */
    const was = m.hp;
    fn('useMove')(0, X, 1);
    assert.equal(m.hp, was, 'a status move costs nothing');
    /* the foe's attacks cost it nothing */
    const f = foe(b),
      fw = f.hp;
    m.hp = 99999;
    fn('useMove')(1, H, 0);
    assert.equal(f.hp, fw, 'the foe pays no recoil');
  });
  /* at low HP the cost can knock its user out */
  withPerks(P, () => {
    const b = battle(fx),
      m = mine(b);
    tough(foe(b));
    m.hp = 1;
    fn('useMove')(0, H, 1);
    assert.equal(m.hp, 0, 'the cost can make it faint');
  });
  /* without the row nothing is lost */
  const b = battle(null),
    m = mine(b),
    mx = fn('maxHp')(m);
  tough(foe(b));
  m.hp = mx;
  fn('useMove')(0, H, 1);
  assert.equal(m.hp, mx);
  /* several recoil rows add up, to at most a half */
  assert.equal(
    modules.effects.fxRecoil([
      { kind: 'recoil', share: 0.3 },
      { kind: 'recoil', share: 0.4 },
    ]),
    0.5
  );
});

/* ---------- a money row's add on arrival ---------- */

const ofType = T => {
  const ids = Object.keys(SPECIES).filter(k => (SPECIES[k].types || []).includes(T));
  return ids.find(k => SPECIES[k].types.length === 1) || ids[0];
};

test('PK-7 money add: walking in pays its Moneys, or charges them below 0 (never below none); none without the row', () => {
  const L = modules['run-loop'],
    { P } = perks(
      { id: 'test_box', fx: [{ kind: 'money', add: -15, when: 'arrive' }] },
      { id: 'test_tip', fx: [{ kind: 'money', add: 20, when: 'arrive' }] }
    );
  const walk = (se, ids) => {
    reseed(3);
    const s = startedSave(ofType('Water'), 30);
    s.se = se;
    s.run = { perks: ids, perkState: {} };
    const out = {};
    L.runArriveFx(s, P, out);
    return [s.se, out.money, out.cost];
  };
  assert.deepEqual(walk(100, ['test_box']), [85, 0, 15]);
  assert.deepEqual(walk(10, ['test_box']), [0, 0, 10], 'never below none: it takes what is there');
  assert.deepEqual(walk(0, ['test_box']), [0, 0, 0]);
  assert.deepEqual(walk(100, ['test_tip']), [120, 20, 0]);
  /* both: what is paid comes first, then the charge */
  assert.deepEqual(walk(0, ['test_box', 'test_tip']), [5, 20, 15]);
  assert.deepEqual(walk(100, []), [100, 0, 0]);
  /* a battle's money ignores an add row */
  assert.equal(fn('fxMoney')([{ kind: 'money', add: -15, when: 'arrive', src: 'x' }], 100), 100);
});
