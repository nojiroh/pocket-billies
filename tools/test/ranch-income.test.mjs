// RL-10b: logic/ranch-income.js, the ranch's passive income on the game's own rules: the rate by ranch level, a new
// save starting at its first opening (no full pile at once), the cap, the part of a Scrap carried over, a full pile
// counting again from now, an upgrade banking the old rate's Scrap first, a clock turned back (through the ranch
// clock) paying nothing, and no income during a run.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules, reseed, startedSave } from './setup-real.mjs';

const I = modules['ranch-income'],
  { ranchNow } = modules['ranch-clock'],
  R = GAME_DATA.rules.ranch,
  H = 3600000;

function save(scrap = 0) {
  reseed();
  const s = startedSave('musk0', 10);
  s.meta.scrap = scrap;
  return s;
}

test('income: the rate follows the ranch level (past the list, its last)', () => {
  const s = save();
  assert.equal(I.incomeRate(s, R), R.income.rate[0]);
  s.meta.buildings.ranch = 2;
  assert.equal(I.incomeRate(s, R), R.income.rate[1]);
  s.meta.buildings.ranch = 99;
  assert.equal(I.incomeRate(s, R), R.income.rate[R.income.rate.length - 1]);
});

test('income: a new save starts counting at the first opening, not with a full pile', () => {
  const s = save();
  assert.equal(I.incomePile(s, 100 * H, R).started, false);
  assert.equal(I.incomeCollect(s, 100 * H, R), 0, 'the first Collect only starts it');
  assert.equal(s.ranch.income.lastAt, 100 * H);
  I.incomeStart(s, 200 * H);
  assert.equal(s.ranch.income.lastAt, 100 * H, 'started once');
});

test('income: Scrap an hour, whole Scrap paid, the part of one carried over', () => {
  const s = save(5),
    rate = I.incomeRate(s, R);
  I.incomeStart(s, 10 * H);
  const ms = (2.5 / rate) * H; // two and a half Scrap's time
  assert.equal(I.incomePile(s, 10 * H + ms, R).scrap, 2);
  assert.equal(I.incomeCollect(s, 10 * H + ms, R), 2);
  assert.equal(s.meta.scrap, 7);
  // the half already earned counts: half a Scrap's time more pays the third
  assert.equal(I.incomePile(s, 10 * H + ms + (0.5 / rate) * H + 1, R).scrap, 1);
});

test('income: the pile stops at the cap; Collect when full counts again from now', () => {
  const s = save(),
    rate = I.incomeRate(s, R),
    capMs = R.income.capHours * H;
  I.incomeStart(s, H);
  const P = I.incomePile(s, H + 3 * capMs, R);
  assert.equal(P.full, true);
  assert.equal(P.scrap, Math.floor(R.income.capHours * rate));
  assert.equal(P.left, 0);
  assert.equal(I.incomeCollect(s, H + 3 * capMs, R), Math.floor(R.income.capHours * rate));
  assert.equal(s.ranch.income.lastAt, H + 3 * capMs);
  assert.equal(I.incomePile(s, H + 3 * capMs, R).left, capMs);
});

test('income: an upgrade banks what the old level earned at the old rate', () => {
  const s = save();
  I.incomeStart(s, H);
  const r1 = I.incomeRate(s, R);
  assert.equal(I.incomeBank(s, H + 4 * H, R), Math.floor(4 * r1));
  s.meta.buildings.ranch = 2;
  const r2 = I.incomeRate(s, R);
  assert.equal(I.incomePile(s, H + 6 * H, R).scrap, Math.floor(4 * r1) + Math.floor(2 * r2));
  assert.equal(I.incomeCollect(s, H + 6 * H, R), Math.floor(4 * r1) + Math.floor(2 * r2));
  assert.equal(s.ranch.income.bank, 0);
});

test('income: a clock turned back pays nothing, then forward again only the real time', () => {
  const s = save(),
    rate = I.incomeRate(s, R),
    clock = t => ranchNow(s, t, R, 0).now;
  I.incomeStart(s, clock(10 * H));
  assert.equal(I.incomeCollect(s, clock(12 * H), R), Math.floor(2 * rate));
  // the clock set back to 0: time stands still at the mark
  assert.equal(I.incomeCollect(s, clock(0), R), 0);
  assert.equal(s.ranch.income.lastAt, 12 * H, 'lastAt never moves back');
  // forward again, an hour past: an hour's Scrap, not the gap
  assert.equal(I.incomeCollect(s, clock(13 * H), R), Math.floor(rate));
  // within the guard behind lastAt: nothing, nothing moves
  assert.equal(I.incomeCollect(s, 13 * H - R.guardMs, R), 0);
  assert.equal(s.ranch.income.lastAt, 13 * H);
});

test('income: nothing is paid during a run', () => {
  const s = save();
  I.incomeStart(s, H);
  s.run = /** @type {any} */ ({});
  assert.equal(I.incomeCollect(s, 10 * H, R), 0);
  assert.equal(s.meta.scrap, 0);
});
