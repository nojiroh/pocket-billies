// RL-12: a run's Perks outside battle: the run's rows (none held: none), healing on walking into a place
// (run-loop.js runArriveHeal), the payout's Research row (run-state.js payoutOf with fxPayoutRates) and its screen row.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, fn, modules, reseed, startedSave } from './setup-real.mjs';

const E = modules.effects,
  L = modules['run-loop'],
  S = modules['run-state'],
  RELICS = GAME_DATA.relics,
  RATES = GAME_DATA.rules.run.payout;
const maxHp = fn('maxHp');

test('run fx: a run without Perks has no rows; the hub has none', () => {
  assert.equal(E.fxOfRun(null, RELICS), null);
  assert.equal(E.fxOfRun({ relics: [] }, RELICS), null);
  assert.deepEqual(
    E.fxOfRun({ relics: ['shelter'] }, RELICS).map(f => f.src),
    ['shelter']
  );
});

test('run fx: walking in heals by the share (rounded up), never past full HP, never a fainted Billie', () => {
  reseed();
  const s = startedSave('musk0', 20);
  s.team.push(fn('makeBilly')('musk0', 20), fn('makeBilly')('musk0', 20));
  const top = maxHp(s.team[0]);
  s.team[0].hp = 1;
  s.team[1].hp = 0;
  s.team[2].hp = top - 1;
  const gained = L.runArriveHeal(s.team, 0.15);
  assert.equal(s.team[0].hp, 1 + Math.ceil(top * 0.15));
  assert.equal(s.team[1].hp, 0, 'a fainted Billie stays fainted');
  assert.equal(s.team[2].hp, top, 'capped at full');
  assert.equal(gained, Math.ceil(top * 0.15) + 1);
  assert.equal(L.runArriveHeal(s.team, 0), 0, 'no share: nothing');
});

test('run fx: walking into a place on a run heals by the held Perks (runArriveFx: the page and the simulation)', () => {
  reseed();
  const s = startedSave('musk0', 20);
  const top = maxHp(s.team[0]);
  s.team[0].hp = 1;
  s.run = { relics: [] };
  assert.equal(L.runArriveFx(s, RELICS), 0, 'no Perks: nothing');
  assert.equal(s.team[0].hp, 1);
  s.run.relics = ['severance'];
  assert.equal(L.runArriveFx(s, RELICS), Math.ceil(top * 0.15));
  assert.equal(s.team[0].hp, 1 + Math.ceil(top * 0.15));
  assert.equal(L.runArriveFx({ team: s.team, run: null }, RELICS), 0, 'not on a run: nothing');
});

test('run fx: a lost run’s payout with Stock Options and Write-off adds a Perks row; without them, as before', () => {
  /* a loss: RL-9b brings a win's items home, so they are paid (and Write-off counts) only on a loss */
  const end = { se: 1000, items: { taxbreak: 2 }, released: 1, cleared: 5, won: false },
    price = () => 100,
    plain = S.payoutOf(end, RATES, price),
    same = S.payoutOf(end, E.fxPayoutRates(null, RATES), price);
  assert.deepEqual(same, plain, 'no rows: the same payout');
  const fx = E.fxRows(['options', 'writeoff'], RELICS),
    pay = S.payoutOf(end, E.fxPayoutRates(fx, RATES), price),
    items = pay.lines.find(l => l.what === 'items'),
    row = pay.lines.find(l => l.what === 'fx');
  assert.equal(items.n, 200, 'items at their full price');
  const before = pay.lines.filter(l => l.what !== 'fx').reduce((a, l) => a + l.capital, 0);
  assert.equal(row.n, 15);
  assert.equal(row.capital, Math.floor(before * 1.15) - before);
  assert.equal(pay.capital, before + row.capital, 'the rows add up to the total');
  const shown = L.runPayoutRows(pay, RATES).find(r => r.label === 'Perks');
  assert.deepEqual(shown, { label: 'Perks', note: '+15%', value: row.capital });
});
