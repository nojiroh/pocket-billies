// RL-12b: logic/rewards.js, the reward pick after a trainer battle, on the game's data: the same cards for the same
// run and pick, none twice, only cards the team can use (an evolution item, a tutor), a paid reroll that grows, taking
// a card (into the bag, a tutor's move learned or swapped in), and a route trainer's win leaving a pick.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fn, GAME_DATA, hooks, modules, reseed } from './setup-real.mjs';

const W = modules.rewards,
  { newRun, validRun } = modules['run-state'],
  { encOf } = modules['run-enc'],
  RULE = GAME_DATA.rules.run.rewards;

/** a run and a team of these species and levels */
function setup(team = [['zuck0', 10]], seed = 'REWARDS001') {
  reseed(1);
  const s = fn('newSave')();
  s.started = true;
  for (const [sp, lv] of team) s.team.push(fn('makeBilly')(sp, lv));
  hooks.provide({ saveData: s });
  s.run = newRun(seed, 1, 1, {
    team: [],
    se: 0,
    items: {},
    pyramids: {},
    trip: { node: 0, plan: [] },
    wild: {},
    eggs: [],
    flags: {},
    seats: [],
    visited: {},
  });
  return s;
}

test('rewards: a pick is the same for the same run, distinct, of rules.pick cards, saved and valid', () => {
  const a = setup(),
    b = setup(),
    A = W.rewardOfferMake(a.run, 'run_3_t0', W.rewardDataGame(a.team)),
    B = W.rewardOfferMake(b.run, 'run_3_t0', W.rewardDataGame(b.team));
  assert.deepEqual(A, B);
  assert.equal(A.cards.length, RULE.pick);
  assert.equal(new Set(A.cards.map(c => c.id + (c.move || ''))).size, A.cards.length);
  assert.equal(a.run.enc.rewardN, 1);
  assert.equal(validRun(a.run), true);
  const next = W.rewardOfferMake(a.run, 'run_4_t0', W.rewardDataGame(a.team));
  assert.notDeepEqual(next.cards, A.cards, 'the next pick draws from the next stream (on this seed)');
});

test('rewards: an evolution item only when a Billie evolves with it', () => {
  const D0 = W.rewardDataGame(setup([['zuck0', 10]]).team),
    D1 = W.rewardDataGame(setup([['zuck1', 20]]).team);
  assert.equal(W.evoUsable('bell', D0), false, 'Facelet evolves by level');
  assert.equal(W.evoUsable('bell', D1), true, 'Feedopus evolves with the Shining Stone');
  const g = { pick: w => Object.keys(w).sort()[0], int: lo => lo };
  for (let k = 0; k < 20; k++) {
    for (const c of W.rewardDraw(modules.rng.rngFrom('E' + k, 'x'), D0, { n: 5 })) assert.notEqual(c.kind, 'evo');
  }
  assert.deepEqual(W.rewardDraw(g, D1, { kind: 'evo' }), [{ id: 'shining_stone', kind: 'evo', item: 'bell' }]);
  assert.deepEqual(W.rewardDraw(g, D0, { kind: 'evo' }), []);
});

test('rewards: a held card (RL-12c) draws a held item nobody on the team holds; none when all are held', () => {
  const s = setup([['zuck0', 10]]),
    D = W.rewardDataGame(s.team),
    ids = modules.held.heldIds(GAME_DATA.items),
    g = { pick: w => Object.keys(w).sort()[0], int: lo => lo };
  assert.deepEqual(W.rewardDraw(g, D, { kind: 'held', n: 1 }), [{ id: 'held', kind: 'held', item: ids[0] }]);
  const three = W.rewardDraw(g, D, { kind: 'held', n: 3 }).map(c => c.item);
  assert.deepEqual(three, ids.slice(0, 3), 'a pick of held items only: three, each another');
  s.team[0].held = ids[0];
  assert.equal(W.rewardDraw(g, D, { kind: 'held', n: 1 })[0].item, ids[1], 'not the one it holds');
  for (let k = 0; k < 20; k++)
    for (const c of W.rewardDraw(modules.rng.rngFrom('H' + k, 'x'), D, { n: 5 }))
      if (c.kind === 'held') assert.ok(ids.includes(c.item) && c.item !== ids[0], c.item);
  const full = setup(ids.map(() => ['zuck0', 10]));
  full.team.forEach((m, i) => (m.held = ids[i]));
  assert.deepEqual(W.rewardDraw(g, W.rewardDataGame(full.team), { kind: 'held' }), []);
});

test('rewards: taking a held card gives it to the Billie named (its old one to the bag), or into the bag', () => {
  const ids = modules.held.heldIds(GAME_DATA.items);
  for (const uid of [null, 'me']) {
    const s = setup([['zuck0', 10]]);
    s.team[0].uid = 'me';
    s.team[0].held = ids[1];
    s.run.enc = {
      ...encOf(s.run),
      reward: { cards: [{ id: 'held', kind: 'held', item: ids[0] }], rolls: 0, from: 't' },
    };
    assert.equal(W.rewardTake(s.run, s, 0, W.rewardDataGame(s.team), uid ? { uid } : {}), '');
    if (uid) assert.deepEqual([s.team[0].held, s.items[ids[0]] || 0, s.items[ids[1]]], [ids[0], 0, 1]);
    else assert.deepEqual([s.team[0].held, s.items[ids[0]]], [ids[1], 1]);
  }
});

test('rewards: tutor moves are the line’s above its level, then its types’, none it knows', () => {
  const s = setup([['zuck0', 10]]),
    D = W.rewardDataGame(s.team),
    m = s.team[0],
    mv = W.tutorMoves(m, D),
    L = GAME_DATA.lines.find(l => l.id === 'zuck');
  for (const k of m.moves) assert.ok(!mv.includes(k));
  const above = L.learn.filter(([lv]) => lv > 10).map(e => e[1]);
  assert.deepEqual(mv.slice(0, new Set(above).size), [...new Set(above)].sort());
  for (const k of mv.slice(new Set(above).size)) assert.equal(GAME_DATA.moves[k].t, 'Electric');
  const tut = W.rewardDraw({ pick: w => Object.keys(w)[0], int: lo => lo }, D, { kind: 'tutor', n: 2 });
  assert.equal(tut.length, 2);
  assert.notEqual(tut[0].move, tut[1].move, 'two tutor cards, two moves');
});

test('rewards: a reroll costs reroll × grow^rolls Moneys and draws again', () => {
  const s = setup();
  W.rewardOfferMake(s.run, 'x', W.rewardDataGame(s.team));
  s.se = RULE.reroll - 1;
  assert.equal(W.rewardReroll(s.run, s, W.rewardDataGame(s.team)), 'money');
  s.se = 1000;
  assert.equal(W.rewardReroll(s.run, s, W.rewardDataGame(s.team)), '');
  assert.equal(s.se, 1000 - RULE.reroll);
  assert.equal(W.rewardRerollCost(s.run.enc.reward, RULE), Math.round(RULE.reroll * RULE.grow));
  W.rewardReroll(s.run, s, W.rewardDataGame(s.team));
  assert.equal(s.run.enc.reward.rolls, 2);
  assert.equal(validRun(s.run), true);
});

test('rewards: taking an item fills the bag; a tutor teaches, swapping a move when full; none clears the pick', () => {
  const s = setup([['zuck0', 10]]),
    D = W.rewardDataGame(s.team),
    e = encOf(s.run),
    m = s.team[0];
  e.reward = {
    cards: [
      { id: 'potions', kind: 'item', item: 'potion', n: 2 },
      { id: 'step_pyramids', kind: 'item', item: 'coin_step_pyramid', n: 2 },
    ],
    rolls: 0,
    from: 'x',
  };
  const p0 = s.items.potion || 0;
  assert.equal(W.rewardTake(s.run, s, 0, D), '');
  assert.equal(s.items.potion, p0 + 2);
  assert.equal(e.reward, null);
  e.reward = { cards: [{ id: 'step_pyramids', kind: 'item', item: 'coin_step_pyramid', n: 2 }], rolls: 0, from: 'x' };
  W.rewardTake(s.run, s, 0, D);
  assert.equal(s.pyramids.step_pyramid, 2);
  const mv = W.tutorMoves(m, D)[0];
  e.reward = { cards: [{ id: 'tutor', kind: 'tutor', move: mv }], rolls: 0, from: 'x' };
  assert.equal(W.rewardTake(s.run, s, 0, D, { uid: 'nobody' }), 'who');
  while (m.moves.length < D.slots) m.moves.push('tackle' + m.moves.length);
  assert.equal(W.rewardTake(s.run, s, 0, D, { uid: m.uid }), 'full');
  const old = m.moves[0];
  assert.equal(W.rewardTake(s.run, s, 0, D, { uid: m.uid, forget: old }), '');
  assert.equal(m.moves[0], mv);
  e.reward = { cards: [{ id: 'potions', kind: 'item', item: 'potion' }], rolls: 0, from: 'x' };
  assert.equal(W.rewardTake(s.run, s, null, D), '');
  assert.equal(e.reward, null);
});

test('rewards: a route trainer beaten leaves a pick; a mini-boss still leaves Perks, a wild Billie nothing', () => {
  const settle = modules['battle-rewards'].battleSettleWin;
  for (const [runFoe, kind, want] of [
    ['route', 'trainer', 'reward'],
    ['miniboss', 'trainer', 'perks'],
    [undefined, 'wild', 'none'],
  ]) {
    const s = setup();
    settle({ kind, tid: 't', T: { runFoe } }, s, { o: 'win', prize: 0, reward: 10 }, s.run);
    assert.equal(!!(s.run.enc && s.run.enc.reward), want === 'reward', String(runFoe));
    assert.equal(!!s.run.offer, want === 'perks', String(runFoe));
  }
});

test('rewards: a route pair beaten (RT-2, one entry for two) leaves one pick, pays both rewards and sets one flag', () => {
  const settle = modules['battle-rewards'].battleSettleWin,
    s = setup(),
    se = s.se;
  settle(
    { kind: 'trainer', tid: 'run_3_t0', T: { runFoe: 'route', mate: { cls: 'vlogger' } } },
    s,
    {
      o: 'win',
      prize: 0,
      reward: 300,
    },
    s.run
  );
  assert.equal(s.run.enc.rewardN, 1, 'one pick');
  assert.equal(s.se - se, 300);
  assert.equal(s.flags.run_3_t0, 1);
});
