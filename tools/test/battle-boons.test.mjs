// PK-9: boons and curses (perks-track.md 5.9 and section 7): the kinds the curses need (last, turnHurt at arrive,
// rewardPick below 0, the rules shopClosed and muteNewest), each with test-only rows first; then the 20 named boons and
// curses of boons.json, each working and running out, the appeal, Correction Fluid, and everything at once finite.
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
  assert.ok(fn('newBattle')('wild', [foe], { fmt: 'single', seed: 'boon-test', ...(fx ? { fx } : {}), ...extra }));
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
const foe = b => b.sides[1].team[0];
const mine = b => b.sides[0].team[0];
const tough = m => {
  m.hp = 99999;
  return m;
};
const order = b =>
  b.events
    .filter(e => e.an && e.an.k === 'move')
    .map(e => e.an.si)
    .join(',');

/* ---------- last ---------- */

test('PK-9 last: on turn 1 yours move after a slower foe (with a line); from turn 2 speed decides again', () => {
  const { P, fx } = perks({ id: 'test_hold', name: 'Test Hold', fx: [{ kind: 'last', if: 'turn:1' }] });
  const H = anyHit('H');
  for (const held of [true, false])
    withPerks(P, () => {
      const b = battle(held ? fx : null);
      tough(mine(b));
      tough(foe(b));
      b.sides[0].f[0].v.st.hus = 6;
      b.sides[1].f[0].v.st.hus = -6;
      fn('runTurn')([{ who: 0, k: 'move', mid: H, tk: 1 }], b);
      assert.match(order(b), held ? /^1,0/ : /^0,1/, `turn 1, held ${held}`);
      assert.equal(
        lines(b).some(t => /^Test Hold: .* moves last\.$/.test(t)),
        held
      );
      fn('runTurn')([{ who: 0, k: 'move', mid: H, tk: 1 }], b);
      assert.match(order(b), /^0,1/, `turn 2, held ${held}`);
    });
});

/* ---------- the run ---------- */

/** a started save on a fresh run holding these Perks (its map made) */
function runSave(perkIds = []) {
  reseed(3);
  const s = startedSave(starter(), 30),
    G = GAME_DATA;
  s.run = modules['run-state'].newRun('BOONSEED01', 1, 1, { team: [] });
  s.run.perks = perkIds;
  modules['run-map'].runMapStart(s.run, { nodeTypes: G.nodeTypes, biomes: G.biomes, rules: G.rules.run });
  return s;
}
const top = m => fn('maxHp')(m);

/* ---------- turnHurt at arrive ---------- */

test('PK-9 turnHurt at arrive: each place walked into costs a share of HP (rounded up), never below 1 HP', () => {
  const L = modules['run-loop'],
    { P } = perks({ id: 'test_cuts', name: 'Test Cuts', fx: [{ kind: 'turnHurt', share: 0.05, when: 'arrive' }] });
  withPerks(P, () => {
    const s = runSave(['test_cuts']),
      m = s.team[0],
      out = {};
    m.hp = top(m);
    L.runArriveFx(s, data.PERKS, out);
    assert.equal(m.hp, top(m) - Math.ceil(top(m) * 0.05));
    assert.equal(out.hurt, Math.ceil(top(m) * 0.05));
    assert.deepEqual(out.hurtBy, ['test_cuts']);
    m.hp = 2;
    L.runArriveFx(s, data.PERKS, out);
    assert.equal(m.hp, 1, 'never below 1 HP');
    m.hp = 0;
    L.runArriveFx(s, data.PERKS, out);
    assert.equal(m.hp, 0, 'a fainted Billie is left as it is');
    /* in battle a row with a when is read only at its moment: no turn-end hurt */
    const fx = fn('fxOfRun')(s.run, data.PERKS);
    assert.equal(modules.effects.fxAt(fx, {}, {}).length, 0);
  });
  const t = runSave([]),
    n = t.team[0];
  n.hp = top(n);
  L.runArriveFx(t, data.PERKS, {});
  assert.equal(n.hp, top(n), 'without the row nothing is lost');
});

/* ---------- rewardPick below 0 ---------- */

test('PK-9 rewardPick below 0: reward picks show one card fewer, never under one; the pick keeps its count', () => {
  const W = modules.rewards,
    { P } = perks({ id: 'test_review', name: 'Test Review', fx: [{ kind: 'rule', rule: 'rewardPick', n: -1 }] });
  withPerks(P, () => {
    const s = runSave(['test_review']),
      D = W.rewardDataGame(s.team),
      R = W.rewardOfferMake(s.run, 'test', D);
    assert.equal(R.cards.length, GAME_DATA.rules.run.rewards.pick - 1);
    assert.equal(R.n, GAME_DATA.rules.run.rewards.pick - 1);
    const one = W.rewardOfferMake(s.run, 'test', D, { n: 1 });
    assert.equal(one.cards.length, 1, 'never under one card');
  });
  const t = runSave([]);
  assert.equal(
    W.rewardOfferMake(t.run, 'test', W.rewardDataGame(t.team)).cards.length,
    GAME_DATA.rules.run.rewards.pick
  );
});
