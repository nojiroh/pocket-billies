// RL-12: logic/relics.js, where a run's Perks come from: the pick after a mini-boss (the same offer for the same
// run and counter, none held, the counter moving on, nothing left: no offer), a run shop's Perk for a day (drawn
// once, kept after a reload, gone once bought), holding at most the cap (a new one takes a let-go one's place), and
// validRun's checks of run.offerN and run.shelf.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, fn, modules, startedSave } from './setup-real.mjs';

const R = modules.relics,
  { runBegin, validRun } = modules['run-state'],
  RELICS = GAME_DATA.relics,
  RULE = GAME_DATA.rules.run.relics,
  copy = v => JSON.parse(JSON.stringify(v));
/** a run as runBegin starts one from a hub save (validRun checks the hub's copy too) */
function run(seed = 'RELIC12345') {
  const s = startedSave('musk0', 10);
  s.run = null;
  return runBegin(s, { seed, tier: 1, mapgenV: 1, se: 300, coins: {}, items: {} });
}

test('relics: a new run holds none, has made no offer and has nothing on a shelf; validRun takes it', () => {
  const r = run();
  assert.deepEqual([r.relics, r.offer, r.offerN, r.shelf], [[], null, 0, {}]);
  assert.equal(validRun(r), true);
});

test('relics: an offer is the same for the same run and counter, of distinct Perks, none held', () => {
  const a = run(),
    b = run();
  assert.deepEqual(R.relicOffer(a, RELICS, RULE), R.relicOffer(b, RELICS, RULE));
  const ids = R.relicOffer(a, RELICS, RULE);
  assert.equal(ids.length, RULE.pick);
  assert.equal(new Set(ids).size, ids.length);
  a.relics.push(ids[0]);
  assert.ok(!R.relicOffer(a, RELICS, RULE).includes(ids[0]), 'one held is never offered');
  const seen = new Set();
  for (let n = 0; n < 40; n++) {
    const c = run('S' + n);
    for (const id of R.relicOffer(c, RELICS, RULE)) seen.add(id);
  }
  assert.ok(seen.size >= Object.keys(RELICS).length - 2, `most Perks turn up over 40 runs (${seen.size})`);
});

test('relics: making an offer saves it on the run and moves the counter; the next differs', () => {
  const r = run(),
    first = R.relicOfferMake(r, RELICS, RULE);
  assert.deepEqual(r.offer, first);
  assert.equal(r.offerN, 1);
  assert.equal(validRun(r), true);
  const again = copy(r);
  assert.deepEqual(again.offer, first, 'a reload shows the same');
  assert.equal(R.relicChoose(r, first[1], RELICS, RULE), '');
  assert.deepEqual([r.relics, r.offer], [[first[1]], null]);
  const second = R.relicOfferMake(r, RELICS, RULE);
  assert.notDeepEqual(second, first);
  assert.equal(R.relicChoose(r, 'not-offered', RELICS, RULE), 'offer');
  assert.equal(R.relicChoose(r, null, RELICS, RULE), '', 'take none');
  assert.equal(r.offer, null);
  assert.equal(R.relicChoose(r, null, RELICS, RULE), 'offer', 'nothing to answer');
});

test('relics: when every Perk is held there is nothing to offer', () => {
  const r = run();
  r.relics = Object.keys(RELICS);
  assert.deepEqual(R.relicOffer(r, RELICS, RULE), []);
  assert.equal(R.relicOfferMake(r, RELICS, RULE), null);
  assert.equal(r.offer, null);
  assert.equal(R.relicShelf(r, 2, 3, RELICS, RULE), '');
});

test('relics: at most the cap; past it a new one takes the place of one let go', () => {
  const r = run(),
    ids = Object.keys(RELICS);
  for (const id of ids.slice(0, RULE.cap)) assert.equal(R.relicTake(r, id, RELICS, RULE), '');
  assert.equal(R.relicTake(r, ids[0], RELICS, RULE), 'held');
  assert.equal(R.relicTake(r, 'nope', RELICS, RULE), 'none');
  const next = ids[RULE.cap];
  assert.equal(R.relicTake(r, next, RELICS, RULE), 'full');
  assert.equal(R.relicTake(r, next, RELICS, RULE, 'nope'), 'drop');
  assert.equal(R.relicTake(r, next, RELICS, RULE, ids[2]), '');
  assert.equal(r.relics.length, RULE.cap);
  assert.equal(r.relics[2], next, 'in the place of the one let go');
  assert.ok(!r.relics.includes(ids[2]));
});

test('relics: a shop’s Perk for a day is drawn once, kept, priced by rarity and gone once bought', () => {
  const r = run(),
    id = R.relicShelf(r, 3, 4, RELICS, RULE);
  assert.ok(RELICS[id]);
  assert.deepEqual(r.shelf, { '3:4': id });
  assert.equal(R.relicShelf(run(), 3, 4, RELICS, RULE), id, 'the same shop and day in the same run');
  assert.equal(R.relicPrice(RELICS[id], RULE), RULE.price[RELICS[id].rarity]);
  assert.equal(validRun(r), true);
  assert.equal(R.relicBuy(r, 3, 4, RELICS, RULE), '');
  assert.deepEqual([r.relics, r.shelf['3:4']], [[id], '']);
  assert.equal(R.relicShelf(r, 3, 4, RELICS, RULE), '', 'nothing new on the shelf that day');
  assert.equal(R.relicBuy(r, 3, 4, RELICS, RULE), 'gone');
  assert.equal(validRun(r), true);
});

test('relics: validRun refuses a broken offer counter or shelf', () => {
  const bad = [
    r => (r.offerN = -1),
    r => (r.offerN = 1.5),
    r => delete r.offerN,
    r => (r.shelf = []),
    r => (r.shelf = { x: 'shelter' }),
    r => (r.shelf = { '3:4': 'Bad Id' }),
    r => (r.shelf = { '3:4': 5 }),
  ];
  for (const f of bad) {
    const r = run();
    f(r);
    assert.equal(validRun(r), false, f.toString());
  }
});

test('relics: a seed’s offer order (Studio plan T4.1) is the run’s picks in order, with nothing taken or one taken each time', () => {
  const picks = 4,
    none = R.relicOfferOrder('ORDER1', RELICS, RULE, picks),
    r = run('ORDER1'),
    game = [];
  for (let k = 0; k < picks; k++) game.push(R.relicOfferMake(r, RELICS, RULE) || []);
  assert.deepEqual(
    none.map(p => p.offer),
    game,
    'nothing taken: the picks the game makes on a run of that seed'
  );
  assert.ok(none.every(p => p.took === null));
  const first = R.relicOfferOrder('ORDER1', RELICS, RULE, picks, 'first');
  assert.deepEqual(first[0].offer, none[0].offer, 'the first pick is the same');
  assert.equal(first[0].took, first[0].offer[0]);
  const taken = first.map(p => p.took);
  assert.equal(new Set(taken).size, picks, 'a taken Perk is never offered again');
  first.forEach((p, k) => assert.ok(!taken.slice(0, k).some(id => p.offer.includes(id)), `pick ${k}`));
  const one = none[0].offer[1],
    want = R.relicOfferOrder('ORDER1', RELICS, RULE, picks, one);
  assert.equal(want[0].took, one, 'a chosen Perk is taken when it is offered');
  assert.ok(want.slice(1).every(p => p.took === null && !p.offer.includes(one)));
  const capped = R.relicOfferOrder('ORDER1', RELICS, { ...RULE, cap: 1 }, picks, 'first');
  assert.deepEqual(
    capped.map(p => !!p.took),
    [true, false, false, false],
    'past the cap nothing more is taken'
  );
});
