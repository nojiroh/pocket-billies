// RL-9: logic/ranch.js, training at Copperleaf's ranch between runs on the game's own rules: the slots and cap by the
// ranch's level, what may start training and what it costs, levels from real time (each level its own size of XP),
// the bank's hours, the cap, a clock turned back, collecting, stopping, the team move and the tidy-up on load.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, fn, modules, reseed, startedSave } from './setup-real.mjs';

const K = modules.ranch,
  R = GAME_DATA.rules.ranch,
  H = 3600000,
  say = () => {};
const xpFor = fn('xpFor');

/** a save with one Billie of `lvl` in storage (the team keeps the starter) and some Scrap */
function ranchSave(lvl = 5, scrap = 50) {
  reseed();
  const s = startedSave('musk0', 10),
    m = fn('makeBilly')('musk0', lvl);
  s.box.push(m);
  s.meta.scrap = scrap;
  return { s, m };
}

test('ranch: level 1 until upgraded; its slots and cap follow rules.json ranch', () => {
  const { s } = ranchSave();
  assert.equal(K.ranchLevel(s), 1);
  assert.equal(K.ranchSlots(s, R), R.slots[0]);
  assert.equal(K.ranchCap(s, R), R.capBase);
  s.meta.buildings.ranch = 2;
  assert.equal(K.ranchSlots(s, R), R.slots[1]);
  assert.equal(K.ranchCap(s, R), R.capBase + R.capStep);
  s.meta.buildings.ranch = 99;
  assert.equal(K.ranchSlots(s, R), R.slots[R.slots.length - 1], 'past the list: its last');
  assert.ok(K.ranchCap(s, R) <= GAME_DATA.rules.progression.maxLevel, 'never past the game cap');
});

test('ranch: only a Billie in storage, under the cap, with a free slot and the Scrap may train; starting pays', () => {
  const { s, m } = ranchSave();
  assert.equal(K.ranchCanTrain(s, s.team[0].uid, R), 'stored', 'the team trains on runs, not here');
  assert.equal(K.ranchTrainStart(s, m.uid, 1000, R), '');
  assert.equal(s.meta.scrap, 50 - R.trainCost);
  assert.deepEqual(s.ranch.trainees, [{ uid: m.uid, at: 1000 }]);
  assert.equal(K.ranchCanTrain(s, m.uid, R), 'training');
  const broke = ranchSave(5, R.trainCost - 1);
  assert.equal(K.ranchTrainStart(broke.s, broke.m.uid, 0, R), 'scrap');
  assert.equal(broke.s.meta.scrap, R.trainCost - 1, 'nothing paid');
  const top = ranchSave(R.capBase);
  assert.equal(K.ranchCanTrain(top.s, top.m.uid, R), 'cap');
  const full = ranchSave(5, 999);
  for (let k = 0; k < R.slots[0]; k++) {
    const b = fn('makeBilly')('musk0', 5);
    full.s.box.push(b);
    assert.equal(K.ranchTrainStart(full.s, b.uid, 0, R), '');
  }
  assert.equal(K.ranchCanTrain(full.s, full.m.uid, R), 'full');
  const away = ranchSave();
  away.s.run = /** @type {any} */ ({});
  assert.equal(K.ranchCanTrain(away.s, away.m.uid, R), 'run', 'storage stays home on a run');
});

test('ranch: levelsPerHour levels an hour, each level its own size, up to bankHours', () => {
  const { s, m } = ranchSave(5);
  m.xp = xpFor(5);
  K.ranchTrainStart(s, m.uid, 0, R);
  const hours = 1 / R.levelsPerHour; /* one level's time */
  const one = K.ranchBanked(s, s.ranch.trainees[0], hours * H, R);
  assert.equal(one.xp, xpFor(6) - xpFor(5), 'one level exactly');
  const half = K.ranchBanked(s, s.ranch.trainees[0], (hours / 2) * H, R);
  assert.equal(half.xp, Math.floor((xpFor(6) - xpFor(5)) / 2));
  const full = K.ranchBanked(s, s.ranch.trainees[0], R.bankHours * H, R),
    over = K.ranchBanked(s, s.ranch.trainees[0], 10 * R.bankHours * H, R);
  assert.equal(full.full, true);
  assert.equal(over.xp, full.xp, 'nothing past the bank');
  const levels = R.bankHours * R.levelsPerHour;
  assert.equal(full.xp, xpFor(5 + levels) - xpFor(5), 'whole levels add up');
});

test('ranch: collecting levels a Billie up through gainXp and never past the cap', () => {
  const { s, m } = ranchSave(R.capBase - 2);
  m.xp = xpFor(m.lvl);
  K.ranchTrainStart(s, m.uid, 0, R);
  const got = K.ranchCollect(s, R.bankHours * H, R, say);
  assert.equal(m.lvl, R.capBase, 'stops at the cap');
  assert.equal(m.xp, xpFor(R.capBase));
  assert.equal(got[0].up, 2);
  assert.equal(s.ranch.trainees[0].at, R.bankHours * H, 'counting again from now');
  assert.equal(K.ranchCollect(s, 2 * R.bankHours * H, R, say)[0].xp, 0, 'at the cap: nothing more');
  assert.equal(K.ranchBanked(s, s.ranch.trainees[0], 0, R).atCap, true);
});

test('ranch: a clock turned back gains nothing and starts the trainee again; a minute behind is let through', () => {
  const { s, m } = ranchSave(5);
  K.ranchTrainStart(s, m.uid, 10 * H, R);
  const t = s.ranch.trainees[0];
  assert.equal(K.ranchBanked(s, t, 10 * H - R.guardMs, R).xp, 0, 'within the slack: no gain, no reset');
  K.ranchCollect(s, 10 * H - R.guardMs, R, say);
  assert.equal(t.at, 10 * H - R.guardMs);
  const lvl = m.lvl;
  K.ranchCollect(s, 2 * H, R, say);
  assert.equal(m.lvl, lvl, 'turned back: nothing');
  assert.equal(t.at, 2 * H, 'started again from the clock');
  K.ranchCollect(s, 10 * H, R, say);
  assert.ok(m.lvl <= lvl + R.bankHours * R.levelsPerHour, 'forward again: at most one bank');
});

test('ranch: Stop collects and ends; the team move collects and ends; gone Billies are tidied away', () => {
  const { s, m } = ranchSave(5);
  K.ranchTrainStart(s, m.uid, 0, R);
  const got = K.ranchStop(s, m.uid, 2 * H, R, say);
  assert.ok(got && got.xp > 0);
  assert.equal(s.ranch.trainees.length, 0);
  assert.equal(K.ranchStop(s, m.uid, 3 * H, R, say), null);
  K.ranchTrainStart(s, m.uid, Date.now() - 2 * H, R);
  const lvl = m.lvl;
  fn('toTeam')(m);
  assert.equal(s.ranch.trainees.length, 0, 'onto the team: training stops');
  assert.ok(m.lvl > lvl, 'with what it banked');
  const b = fn('makeBilly')('musk0', 5);
  s.box.push(b);
  K.ranchTrainStart(s, b.uid, 0, R);
  s.ranch.trainees.push({ uid: b.uid, at: 5 }, { uid: 'gone', at: 5 });
  s.box = s.box.filter(x => x !== b).concat([b]);
  K.ranchTidy(s);
  assert.deepEqual(s.ranch.trainees, [{ uid: b.uid, at: 0 }], 'twice and gone: dropped');
  s.box = s.box.filter(x => x !== b);
  const loaded = fn('migrate')(
    JSON.parse(JSON.stringify({ ...s, ranch: { ...s.ranch, trainees: [{ uid: b.uid, at: 0 }] } }))
  );
  assert.deepEqual(loaded.ranch.trainees, [], 'a save whose trainee left storage loads without it');
});
