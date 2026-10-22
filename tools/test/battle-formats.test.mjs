// Phase 13: double and Alpha battles on the game's own data (trainers, rules, moves), in plain Node. Moved here from the
// browser steps v33 and v34 of tools/check-quick.py, which keep what needs a screen: the nameplates, the stage, picking
// a move and a target by hand, catching.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { data, fn, hooks, logic, reseed, startedSave } from './setup-real.mjs';

const { DEX_ORDER, MOVES, RULES, SPECIES, TRAINERS } = data;
const liveActors = fn('liveActors'),
  fighter = fn('fighter');

// a started save with three Billies that can fight, as v33 gives the browser
function teamOfThree() {
  const s = startedSave(
    Object.keys(SPECIES).find(k => SPECIES[k].line === RULES.start.starters[0]),
    12
  );
  while (s.team.length < 3) s.team.push(fn('makeBilly')(DEX_ORDER[(s.team.length * 5 + 3) % DEX_ORDER.length], 10));
  return s;
}
const doubleTrainer = () => Object.keys(TRAINERS).find(k => TRAINERS[k].team.length >= 2);
const damaging = m => m.moves.find(id => MOVES[id] && MOVES[id].c !== 'X') || m.moves[0];

beforeEach(() => {
  reseed();
  hooks.provide({ activeBattle: null });
});

test('a double battle: two a side, and each move hits the foe it was aimed at', () => {
  teamOfThree();
  const tid = doubleTrainer();
  assert.ok(tid, 'no trainer has two Billies');
  fn('startTrainer')(tid, { talked: true, double: true });
  const B = hooks.activeBattle;
  assert.equal(B.fmt, 'double');
  assert.equal(liveActors(0).length, 2);
  assert.equal(liveActors(1).length, 2);
  const target = liveActors(1).at(-1),
    name = fn('billyName')(fighter(target));
  fn('runTurn')(liveActors(0).map(k => ({ who: k, k: 'move', mid: damaging(fighter(k)), tk: target })));
  const mine = liveActors(0).map(k => fn('billyName')(fighter(k)));
  const hits = B.events.map(e => e.t || '').filter(t => mine.some(n => t.startsWith(n + ' used ')));
  assert.equal(hits.length, 2, B.events.map(e => e.t).join(' / '));
  for (const h of hits) assert.ok(h.endsWith(` on ${name}.`), h);
});

test('an Alpha battle: your team against one; below half it raises its shield', () => {
  const s = teamOfThree();
  const sp = Object.keys(SPECIES).find(k => SPECIES[k].stage === 0 && !RULES.start.starters.includes(SPECIES[k].line));
  const q = { id: 'alpha', sp, lvl: 6, no: 1, alpha: true };
  fn('encountersHere')().push(q);
  fn('startWild')(q);
  const B = hooks.activeBattle,
    a = fighter(1);
  assert.equal(B.fmt, 'alpha');
  assert.ok(a.boss, 'the Alpha has no boss state');
  assert.equal(liveActors(1).length, 1);
  assert.ok(liveActors(0).length >= 2, `only ${liveActors(0).length} of yours fight the Alpha`);
  a.hp = Math.floor(fn('maxHp')(a) * 0.55);
  B.events = [];
  fn('alphaPhase')(1);
  assert.ok(!a.boss.ph2, 'the shield came up above half');
  a.hp = Math.floor(fn('maxHp')(a) * 0.45);
  fn('alphaPhase')(1);
  assert.ok(a.boss.ph2, 'no shield phase below half');
  assert.ok(fn('fieldState')(1).shield >= 1);
  assert.ok(/shield/.test(B.events[0].t), B.events[0].t);
});

test('partner AI: in a double, two foes pile onto a fighter that is already going down less often', () => {
  teamOfThree();
  fn('startTrainer')(doubleTrainer(), { talked: true, double: true });
  const B = hooks.activeBattle,
    me = liveActors(0);
  fighter(me[0]).hp = 1;
  // the same draws with the partner's plan (a double) and without it (the single-battle choice)
  const piles = fmt => {
    reseed();
    B.fmt = fmt;
    let n = 0;
    for (let i = 0; i < 300; i++) {
      B.aiPlan = {};
      const [f1, f2] = liveActors(1),
        a = fn('chooseAI')(f1),
        b = fn('chooseAI')(f2);
      if (a && b && a.tk === me[0] && b.tk === me[0] && MOVES[a.mid].c !== 'X' && MOVES[b.mid].c !== 'X') n++;
    }
    B.fmt = 'double';
    return n;
  };
  const withPlan = piles('double'),
    without = piles('single');
  assert.ok(withPlan < without, `${withPlan} piles with the partner's plan, ${without} without`);
});

test('phase 08: your buddy gets the full XP of a win even when it sat out; the rest of the bench gets the share', () => {
  const s = teamOfThree();
  s.buddy = s.team[2].uid;
  const q = { id: 'xp', sp: s.team[0].sp, lvl: 10, no: 1 };
  fn('encountersHere')().push(q);
  fn('startWild')(q);
  const xp = s.team.map(m => m.xp);
  fn('award')(fighter(1));
  const got = s.team.map((m, i) => m.xp - xp[i]);
  assert.ok(got[0] > 0, 'the fighter got nothing');
  assert.equal(got[2], got[0], `the buddy got ${got[2]}, the fighter ${got[0]}`);
  assert.equal(got[1], Math.floor(got[0] * RULES.progression.teamXpShare));
});

test("a battle's start takes a host and the run's extras (seed, weather, Loopholes), trainer and wild alike", () => {
  const SILENT = logic.SILENT_HOST;
  teamOfThree();
  const tid = Object.keys(TRAINERS).find(k => TRAINERS[k].market && TRAINERS[k].team.length) || doubleTrainer(),
    wx = { m: { Fire: 1.5 } },
    fx = [{ kind: 'money', mult: 2, src: 'x' }];
  fn('startTrainer')(tid, { host: SILENT, extra: { seed: 'T3SEED', wx, fx } });
  let B = hooks.activeBattle;
  assert.equal(B.host, SILENT);
  assert.equal(B.seed, 'T3SEED');
  assert.equal(B.wx, wx);
  assert.equal(B.fx, fx);
  if (TRAINERS[tid].market) assert.ok(B.market, 'its market opens the battle');
  hooks.provide({ activeBattle: null });
  const sp = Object.keys(SPECIES).find(k => SPECIES[k].stage === 0 && !RULES.start.starters.includes(SPECIES[k].line)),
    q = { id: 'wildx', sp, lvl: 5, no: 2 };
  fn('encountersHere')().push(q);
  fn('startWild')(q, { host: SILENT, extra: { seed: 'T3WILD', wx } });
  B = hooks.activeBattle;
  assert.equal(B.host, SILENT);
  assert.equal(B.seed, 'T3WILD');
  assert.equal(B.wx, wx);
  assert.equal(B.fmt, 'single');
});
