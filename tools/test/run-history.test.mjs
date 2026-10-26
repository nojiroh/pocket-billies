// RL-S1: logic/run-history.js, what the story remembers of past runs (saveData.meta.history): an ended run's entry,
// what beat you (caught by battleSettle), the leaders beaten, the cap, the load check, and the facts the conditions read.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fn, hooks, modules, startedSave } from './setup-fixture.mjs';

const H = modules['run-history'],
  { runBegin, runEnd, validRun } = modules['run-state'],
  { newMeta, metaFill, validMeta } = modules['meta-state'];
const RATES = { money: 0.1, itemShare: 0.5, released: 15, node: 10, win: 100, winCrests: 1 };
const GIVE = { seed: 'HIST123456', expedition: 2, mapgenV: 1, se: 300, items: {} };
const MAP = {
  nodes: [
    { type: 'landing', row: 0, lane: 0, to: [1] },
    { type: 'route', row: 1, lane: 0, to: [2] },
    { type: 'miniboss', row: 2, lane: 0, to: [3] },
    { type: 'boss', row: 3, lane: 0, to: [] },
  ],
};
/** a hub save on a run with a region and a map */
function onRun() {
  const s = startedSave('sparky0', 10);
  s.team.push(fn('makeBilly')('drip0', 7));
  s.meta = newMeta();
  s.run = null;
  const run = runBegin(s, GIVE);
  run.map = JSON.parse(JSON.stringify(MAP));
  run.region = {
    theme: 'coast',
    name: 'Pendingvale',
    zones: [{ biome: 'meadow', rows: 4 }],
    dex: [],
    swap: {},
    forms: {},
    leaders: ['marina', 'rocco'],
  };
  run.path = [0, 1, 2];
  run.clock = 4;
  run.perks = ['perk_a'];
  hooks.provide({ saveData: s });
  return s;
}
/** a battle as battleSettle sees it @param {any} s @param {string} over @param {any} [T] */
const battle = (s, over, T) => ({
  kind: T ? 'trainer' : 'wild',
  over,
  runK: 0,
  lead: s.team[0].uid,
  T,
  tid: T ? T.id : undefined,
  sides: [{ team: s.team }, { team: [fn('makeBilly')('sprout0', 9)] }],
  fx: null,
});

test('history: a lost battle names what beat you, a leader won is kept, and the run ends with its entry', () => {
  const s = onRun();
  const settle = modules['battle-rewards'].battleSettle;
  settle(battle(s, 'win', { id: 'run_2_foe', from: 'marina', runFoe: 'miniboss', team: [] }), s);
  assert.deepEqual(s.run.beat, ['marina']);
  for (const m of s.team) m.hp = 0;
  settle(battle(s, 'lose', { id: 'run_3_foe', from: 'rocco', runFoe: 'boss', team: [] }), s);
  assert.deepEqual(s.run.lostTo, { kind: 'boss', id: 'rocco', sp: 'sprout0' });
  assert.equal(validRun(s.run), true, 'lostTo and beat pass the load check');
  runEnd(s, { won: false, keep: [] }, RATES, () => 0);
  const [e] = s.meta.history;
  assert.deepEqual(e, {
    seed: 'HIST123456',
    theme: 'coast',
    region: 'Pendingvale',
    exp: 2,
    end: 'lost',
    by: { kind: 'boss', id: 'rocco', sp: 'sprout0' },
    row: 2,
    days: 4,
    team: ['sparky0', 'drip0'],
    perks: ['perk_a'],
    leaders: [
      { id: 'marina', beat: 1 },
      { id: 'rocco', beat: 0 },
    ],
    rival: null,
  });
  assert.equal(validMeta(s.meta), true);
});

test('history: a wild loss, a Bureau agent, a give-up and a win', () => {
  const w = H.runLostTo(battle(startedSave('sparky0', 5), 'lose'));
  assert.deepEqual(w, { kind: 'wild', sp: 'sprout0' });
  const s0 = startedSave('sparky0', 5);
  const agent = H.runLostTo(battle(s0, 'lose', { id: 'x', cls: 'bureau_clerk', runFoe: 'route', bureau: 1 }));
  assert.deepEqual(agent, { kind: 'route', id: 'bureau_clerk', sp: 'sprout0', bureau: 1 });
  const s = onRun();
  runEnd(s, { won: false, keep: [] }, RATES, () => 0);
  assert.equal(s.meta.history[0].end, 'quit');
  assert.equal(s.meta.history[0].by, null);
  const t = onRun();
  t.run.lostTo = { kind: 'wild' }; // a win ignores it
  runEnd(t, { won: true, keep: [] }, RATES, () => 0);
  assert.equal(t.meta.history[0].end, 'won');
  assert.equal(t.meta.history[0].by, null);
});

test('history: the newest 20 kept; a broken history is dropped on its own', () => {
  let list = [];
  const s = onRun();
  const e = H.historyEntry(s, true);
  for (let i = 0; i < 25; i++) list = H.historyPush(list, { ...e, days: i + 1 });
  assert.equal(list.length, H.HISTORY_MAX);
  assert.equal(list[0].days, 6);
  assert.equal(list.at(-1).days, 25);
  assert.equal(H.validHistory(list), true);
  for (const bad of [
    null,
    {},
    [{ ...e, end: 'draw' }],
    [{ ...e, extra: 1 }],
    [{ ...e, by: { kind: 'shark' } }],
    [{ ...e, team: Array(7).fill('drip0') }],
    [{ ...e, leaders: [{ id: 'marina', beat: 2 }] }],
    Array(21).fill(e),
  ])
    assert.equal(H.validHistory(bad), false, JSON.stringify(bad).slice(0, 60));
  const m = metaFill({ ...newMeta(), research: 50, history: [{ nonsense: true }] });
  assert.equal(m.research, 50, 'the rest of meta survives');
  assert.deepEqual(m.history, []);
  assert.equal(metaFill({ research: 5 }).history.length, 0, 'a meta from before RL-S1 gets an empty history');
});

test('history: the facts the story reads', () => {
  const s = onRun();
  const base = H.historyEntry(s, false),
    lost = { ...base, end: 'lost', by: { kind: 'route', id: 'bureau_clerk', bureau: 1 } },
    won = { ...base, end: 'won', by: null };
  assert.deepEqual(H.historyFacts([]), {
    last: {},
    lastby: {},
    history: {
      runs: 0,
      wins: 0,
      losses: 0,
      quits: 0,
      streak: 0,
      lstreak: 0,
      bureau: 0,
      rivalmet: 0,
      rivalwon: 0,
      rivallost: 0,
    },
  });
  const f = H.historyFacts([won, lost, lost]);
  assert.deepEqual(f.last, {
    won: 0,
    lost: 1,
    quit: 0,
    row: 2,
    days: 4,
    perks: 1,
    team: 2,
    leaders: 0,
    expedition: 2,
    rival: 0,
    rivalwon: 0,
  });
  assert.deepEqual(f.lastby, { route: 1, bureau_clerk: 1, bureau: 1 });
  assert.deepEqual(f.history, {
    runs: 3,
    wins: 1,
    losses: 2,
    quits: 0,
    streak: 0,
    lstreak: 2,
    bureau: 2,
    rivalmet: 0,
    rivalwon: 0,
    rivallost: 0,
  });
  assert.equal(H.historyFacts([lost, won, won]).history.streak, 2);
  assert.deepEqual(Object.keys(f.last).sort(), [...H.LAST_FACTS].sort(), 'every LAST_FACTS fact is given');
  assert.deepEqual(Object.keys(f.history).sort(), [...H.HISTORY_FACTS].sort());
  assert.equal(H.historyRematch([lost, won, lost], 'bureau_clerk'), 2);
  assert.equal(H.historyRematch([lost], 'marina'), 0);
  assert.equal(H.historyRematch([lost]), 0);
});

test("RL-S2: Blake's meetings and wins are counted in the run, kept in the history and read as facts", () => {
  const s = onRun();
  assert.deepEqual(s.run.rival, { lead: 'sparky0', past: 0, met: 0, won: 0 }, 'the lead and no meeting yet');
  const settle = modules['battle-rewards'].battleSettle,
    blake = { id: 'run_1_foe', from: 'blake', runFoe: 'rival', team: [] };
  /* RL-S2 part B: the first win over him on a run finds rules.json run.beans.rival Beans, the next none */
  const RR = hooks.RULES.run || (hooks.RULES.run = {}),
    hadBeans = RR.beans;
  RR.beans = { badge: 0, side: 0, rival: 2 };
  try {
    settle(battle(s, 'win', blake), s);
    assert.deepEqual([s.run.rival.met, s.run.rival.won, s.run.beans, s.meta.beans], [1, 1, 2, 2]);
    settle(battle(s, 'win', { ...blake, id: 'run_3_foe' }), s);
    assert.deepEqual([s.run.rival.met, s.run.rival.won, s.run.beans], [2, 2, 2], 'only the first win');
  } finally {
    RR.beans = hadBeans;
  }
  s.run.rival.met = s.run.rival.won = 1;
  for (const m of s.team) m.hp = 0;
  settle(battle(s, 'lose', { ...blake, id: 'run_2_foe' }), s);
  assert.deepEqual([s.run.rival.met, s.run.rival.won], [2, 1]);
  assert.deepEqual(s.run.lostTo, { kind: 'rival', id: 'blake', sp: 'sprout0' });
  assert.equal(validRun(s.run), true);
  assert.equal(validRun({ ...s.run, rival: { ...s.run.rival, won: 3 } }), false, 'never more wins than meetings');
  runEnd(s, { won: false, keep: [] }, RATES, () => 0);
  const [e] = s.meta.history;
  assert.deepEqual(e.rival, { met: 2, won: 1 });
  assert.equal(H.validHistory(s.meta.history), true);
  assert.equal(H.validHistory([{ ...e, rival: { met: 0, won: 0 } }]), false, 'a met entry met him');
  const f = H.historyFacts([e, e]);
  assert.deepEqual([f.last.rival, f.last.rivalwon, f.lastby.rival, f.lastby.blake], [2, 1, 1, 1]);
  assert.deepEqual([f.history.rivalmet, f.history.rivalwon, f.history.rivallost], [4, 2, 2]);
  // the next run starts knowing the meetings before it
  const t = onRun();
  t.run = null;
  t.meta.history = [e, e];
  assert.equal(runBegin(t, GIVE).rival.past, 4);
});
