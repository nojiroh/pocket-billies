// Phase 13 (moved from logic.test.mjs, phase 04e): the battle engine (game/js/logic/battle-engine.js), on the small
// data set of setup-fixture.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { data, fn, hooks, reseed, said, startedSave } from './setup-fixture.mjs';

test('battle: damage, type matchup, status, a turn', () => {
  const s = startedSave('sparky0', 10);
  const foe = fn('makeBilly')('sprout0', 10);
  assert.equal(fn('newBattle')('wild', [foe]), true);
  assert.equal(hooks.activeBattle.kind, 'wild');
  assert.equal(fn('fighter')(0), s.team[0]);
  assert.equal(fn('fighter')(1), foe);
  // Ember (Fire, special, 40) from a level 10 Fire Billie at a Grass one: base (0.4*10+2)*40*15/15/50+2 = 6.8,
  // same type 1.5, super effective 2, a roll of 0.85 to 1, maybe a critical hit (1.5)
  for (let i = 0; i < 50; i++) {
    const r = fn('calcDamage')(0, 1, 'ember');
    assert.equal(r.te, 2);
    const lo = Math.floor(6.8 * 1.5 * 2 * 0.85),
      hi = Math.floor(6.8 * 1.5 * 2 * (r.crit ? 1.5 : 1));
    assert.ok(r.dmg >= lo && r.dmg <= hi, `${r.dmg} not in ${lo}..${hi}`);
  }
  fn('inflict')(1, 'scn');
  assert.equal(foe.status, 'scn');
  assert.ok(hooks.activeBattle.events.some(e => e.t === 'Sprout was burned.'));
  said.length = 0;
  fn('runTurn')([{ who: 0, k: 'move', mid: 'tackle', tk: 1 }]);
  assert.ok(said.includes('playTurnEvents'));
  assert.ok(foe.hp < 30 || s.team[0].hp < 30, 'nobody was hit');
});

test('battle: catching: lower HP and a status raise the odds, an Alpha lowers them, the Platinum Coin always catches', () => {
  startedSave('sparky0', 10);
  const foe = fn('makeBilly')('sprout0', 10);
  fn('newBattle')('wild', [foe]);
  const odds = () => fn('catchOdds')('penny', 1, false);
  const full = odds();
  foe.hp = 1;
  const low = odds();
  assert.ok(low > full, `${low} at 1 HP, ${full} at full`);
  foe.status = 'scn';
  const burned = odds();
  assert.ok(burned > low || burned === 1, `${burned} burned`);
  foe.status = 'sub';
  assert.ok(odds() >= burned, 'a subpoena (asleep) helps most');
  // an Alpha of the same species and level, at full HP
  fn('newBattle')('wild', [fn('makeAlpha')('sprout0', 10)]);
  assert.ok(fn('fighter')(1).boss, 'makeAlpha made no Alpha');
  assert.ok(odds() < full, `${odds()} for an Alpha, ${full} for a plain one`);
  assert.equal(fn('catchOdds')('tbtf', 1, false), 1);
  reseed();
  for (let i = 0; i < 20; i++) assert.equal(fn('catchRoll')('tbtf', 1, false).caught, true);
});

test('battle: the foe picks a move it knows, aimed at one of yours still standing; a smart trainer picks its best', () => {
  startedSave('sparky0', 10);
  const foe = fn('makeBilly')('drip0', 10);
  fn('newBattle')('wild', [foe]);
  reseed();
  for (let i = 0; i < 50; i++) {
    hooks.activeBattle.aiPlan = {};
    const p = fn('chooseAI')(1);
    assert.ok(foe.moves.includes(p.mid), p.mid);
    assert.ok(fn('liveActors')(0).includes(p.tk), String(p.tk));
  }
  // a trainer that always thinks: Splash (Water) at a Fire Billie beats Tackle
  const R = fn('newFieldState') && data.RULES.battle,
    smart = R.aiSmart;
  hooks.activeBattle.kind = 'trainer';
  R.aiSmart = 1;
  try {
    for (let i = 0; i < 10; i++) {
      hooks.activeBattle.aiPlan = {};
      assert.equal(fn('chooseAI')(1).mid, 'splash');
    }
  } finally {
    R.aiSmart = smart;
  }
});
