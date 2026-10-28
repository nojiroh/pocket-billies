// RL-12: logic/perks.js, where a run's Perks come from: the pick after a mini-boss (the same offer for the same
// run and counter, none held, the counter moving on, nothing left: no offer), a run shop's Perk for a day (drawn
// once, kept after a reload, gone once bought), holding at most the cap (a new one takes a let-go one's place), and
// validRun's checks of run.offerN and run.shelf.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, fn, modules, startedSave } from './setup-real.mjs';

const R = modules.perks,
  { runBegin, validRun } = modules['run-state'],
  PERKS = GAME_DATA.perks,
  RULE = GAME_DATA.rules.run.perks,
  copy = v => JSON.parse(JSON.stringify(v));
/** a run as runBegin starts one from a hub save (validRun checks the hub's copy too) */
function run(seed = 'RELIC12345') {
  const s = startedSave('musk0', 10);
  s.run = null;
  return runBegin(s, { seed, expedition: 1, mapgenV: 1, se: 300, pyramids: {}, items: {} });
}

test('relics: a new run holds none, has made no offer and has nothing on a shelf; validRun takes it', () => {
  const r = run();
  assert.deepEqual([r.perks, r.offer, r.offerN, r.shelf], [[], null, 0, {}]);
  assert.equal(validRun(r), true);
});

test('relics: an offer is the same for the same run and counter, of distinct Perks, none held', () => {
  const a = run(),
    b = run();
  assert.deepEqual(R.perkOffer(a, PERKS, RULE), R.perkOffer(b, PERKS, RULE));
  const ids = R.perkOffer(a, PERKS, RULE);
  assert.equal(ids.length, RULE.pick);
  assert.equal(new Set(ids).size, ids.length);
  a.perks.push(ids[0]);
  assert.ok(!R.perkOffer(a, PERKS, RULE).includes(ids[0]), 'one held is never offered');
});

/** PK-4: a team holding every type (each Billie's types), so every Perk's needs hold */
const EVERY_TYPE = GAME_DATA.types.map(t => [t.id]);
test('PK-4 relics: with a team of every type, every Perk of each rarity turns up over 300 picks', () => {
  /* rares weigh 1 of about 150 (43 Perks): 300 picks of 3 see each about 6 times */
  const seen = new Set();
  for (let n = 0; n < 300; n++) for (const id of R.perkOffer(run('S' + n), PERKS, RULE, EVERY_TYPE)) seen.add(id);
  for (const r of Object.keys(RULE.rarity)) {
    const all = Object.keys(PERKS).filter(id => PERKS[id].rarity === r),
      miss = all.filter(id => !seen.has(id));
    assert.deepEqual(miss, [], `${r}: every one of ${all.length} turns up`);
  }
});

test('PK-4 relics: a Perk that needs a type is never offered without it, in a pick, a shelf or an event', () => {
  const needy = Object.keys(PERKS).filter(id => PERKS[id].needs);
  assert.ok(needy.length >= 9, 'the type Perks need their types');
  for (const T of GAME_DATA.types.map(t => t.id)) {
    const team = [[T]],
      ok = new Set(needy.filter(id => R.perkFits(PERKS[id], team))),
      got = new Set();
    for (let n = 0; n < 120; n++) {
      const r = run('N' + T + n);
      for (const id of R.perkOffer(r, PERKS, RULE, team)) got.add(id);
      got.add(R.perkShelf(r, 1, 1, PERKS, RULE, team));
      got.add(modules.encounters.encPerk(r, undefined, PERKS, RULE, team));
    }
    for (const id of got) assert.ok(!PERKS[id] || !PERKS[id].needs || ok.has(id), `${id} offered to a ${T} team`);
    assert.equal(ok.size, 1, `${T}: one type Perk fits`);
    assert.ok(
      [...ok].every(id => got.has(id)),
      `${T}: its own type Perk turns up`
    );
  }
});

test('PK-4 relics: a type Perk whose type is on the team is offered about bias times as often as an untagged one', () => {
  const team = [['Fire'], ['Water']],
    count = { bellows: 0, joy_buzzer: 0 };
  for (let n = 0; n < 1500; n++) {
    const id = R.perkShelf(run('B' + n), 1, 1, PERKS, RULE, team);
    if (id in count) count[id]++;
  }
  assert.equal(PERKS.bellows.rarity, PERKS.joy_buzzer.rarity);
  const ratio = count.bellows / count.joy_buzzer;
  assert.ok(Math.abs(ratio - RULE.bias) < 0.8, `${JSON.stringify(count)}: about ${RULE.bias} times`);
});

test('relics: making an offer saves it on the run and moves the counter; the next differs', () => {
  const r = run(),
    first = R.perkOfferMake(r, PERKS, RULE);
  assert.deepEqual(r.offer, first);
  assert.equal(r.offerN, 1);
  assert.equal(validRun(r), true);
  const again = copy(r);
  assert.deepEqual(again.offer, first, 'a reload shows the same');
  assert.equal(R.perkChoose(r, first[1], PERKS, RULE), '');
  assert.deepEqual([r.perks, r.offer], [[first[1]], null]);
  const second = R.perkOfferMake(r, PERKS, RULE);
  assert.notDeepEqual(second, first);
  assert.equal(R.perkChoose(r, 'not-offered', PERKS, RULE), 'offer');
  assert.equal(R.perkChoose(r, null, PERKS, RULE), '', 'take none');
  assert.equal(r.offer, null);
  assert.equal(R.perkChoose(r, null, PERKS, RULE), 'offer', 'nothing to answer');
});

test('relics: when every Perk is held there is nothing to offer', () => {
  const r = run();
  r.perks = Object.keys(PERKS);
  assert.deepEqual(R.perkOffer(r, PERKS, RULE), []);
  assert.equal(R.perkOfferMake(r, PERKS, RULE), null);
  assert.equal(r.offer, null);
  assert.equal(R.perkShelf(r, 2, 3, PERKS, RULE), '');
});

test('relics: at most the cap; past it a new one takes the place of one let go', () => {
  const r = run(),
    ids = Object.keys(PERKS);
  for (const id of ids.slice(0, RULE.cap)) assert.equal(R.perkTake(r, id, PERKS, RULE), '');
  assert.equal(R.perkTake(r, ids[0], PERKS, RULE), 'held');
  assert.equal(R.perkTake(r, 'nope', PERKS, RULE), 'none');
  const next = ids[RULE.cap];
  assert.equal(R.perkTake(r, next, PERKS, RULE), 'full');
  assert.equal(R.perkTake(r, next, PERKS, RULE, 'nope'), 'drop');
  assert.equal(R.perkTake(r, next, PERKS, RULE, ids[2]), '');
  assert.equal(r.perks.length, RULE.cap);
  assert.equal(r.perks[2], next, 'in the place of the one let go');
  assert.ok(!r.perks.includes(ids[2]));
});

test('relics: a shop’s Perk for a day is drawn once, kept, priced by rarity and gone once bought', () => {
  const r = run(),
    id = R.perkShelf(r, 3, 4, PERKS, RULE);
  assert.ok(PERKS[id]);
  assert.deepEqual(r.shelf, { '3:4': id });
  assert.equal(R.perkShelf(run(), 3, 4, PERKS, RULE), id, 'the same shop and day in the same run');
  assert.equal(R.perkPrice(PERKS[id], RULE), RULE.price[PERKS[id].rarity]);
  assert.equal(validRun(r), true);
  assert.equal(R.perkBuy(r, 3, 4, PERKS, RULE), '');
  assert.deepEqual([r.perks, r.shelf['3:4']], [[id], '']);
  assert.equal(R.perkShelf(r, 3, 4, PERKS, RULE), '', 'nothing new on the shelf that day');
  assert.equal(R.perkBuy(r, 3, 4, PERKS, RULE), 'gone');
  assert.equal(validRun(r), true);
});

test('relics: validRun refuses a broken offer counter or shelf', () => {
  const bad = [
    r => (r.offerN = -1),
    r => (r.offerN = 1.5),
    r => delete r.offerN,
    r => (r.shelf = []),
    r => (r.shelf = { x: 'clinic_card' }),
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
    none = R.perkOfferOrder('ORDER1', PERKS, RULE, picks),
    r = run('ORDER1'),
    game = [];
  for (let k = 0; k < picks; k++) game.push(R.perkOfferMake(r, PERKS, RULE) || []);
  assert.deepEqual(
    none.map(p => p.offer),
    game,
    'nothing taken: the picks the game makes on a run of that seed'
  );
  assert.ok(none.every(p => p.took === null));
  const first = R.perkOfferOrder('ORDER1', PERKS, RULE, picks, 'first');
  assert.deepEqual(first[0].offer, none[0].offer, 'the first pick is the same');
  assert.equal(first[0].took, first[0].offer[0]);
  const taken = first.map(p => p.took);
  assert.equal(new Set(taken).size, picks, 'a taken Perk is never offered again');
  first.forEach((p, k) => assert.ok(!taken.slice(0, k).some(id => p.offer.includes(id)), `pick ${k}`));
  const one = none[0].offer[1],
    want = R.perkOfferOrder('ORDER1', PERKS, RULE, picks, one);
  assert.equal(want[0].took, one, 'a chosen Perk is taken when it is offered');
  assert.ok(want.slice(1).every(p => p.took === null && !p.offer.includes(one)));
  const capped = R.perkOfferOrder('ORDER1', PERKS, { ...RULE, cap: 1 }, picks, 'first');
  assert.deepEqual(
    capped.map(p => !!p.took),
    [true, false, false, false],
    'past the cap nothing more is taken'
  );
});

test('PK-3 perkCount: a counter as n/every, VOID once a once-a-run row is spent, nothing otherwise', () => {
  const r = run();
  assert.equal(R.perkCount(r, 'click_pen', PERKS), '0/8');
  r.perkState = { 'click_pen/0': { n: 5 }, 'warranty_card/0': { used: 1 } };
  assert.equal(R.perkCount(r, 'click_pen', PERKS), '5/8');
  assert.equal(R.perkCount(r, 'warranty_card', PERKS), 'VOID');
  assert.equal(R.perkCount(run(), 'warranty_card', PERKS), '', 'not spent yet');
  assert.equal(R.perkCount(r, 'lucky_charm', PERKS), '');
  assert.equal(R.perkCount(null, 'click_pen', PERKS), '0/8');
  assert.equal(R.perkCount(r, 'nope', PERKS), '');
});

// PK-4: offers ask a Perk's needs of the team (perkFits): a test-only Perk that needs a Fire Billie
const NEEDY = {
  test_fire_only: {
    name: 'Test',
    d: 'A test.',
    rarity: 'common',
    needs: 'team:Fire',
    fx: [{ kind: 'money', mult: 1.1 }],
  },
  test_plain: { name: 'Test', d: 'A test.', rarity: 'common', fx: [{ kind: 'money', mult: 1.1 }] },
};
test('PK-4 needs: a Perk that needs team:Fire is drawn only for a team with a Fire Billie; with no team, it is', () => {
  const r = run(),
    water = [['Water'], ['Grass']],
    fire = [['Water'], ['Fire', 'Steel']];
  assert.deepEqual(R.perkPool(r, NEEDY, RULE, [], water), ['test_plain']);
  assert.deepEqual(R.perkPool(r, NEEDY, RULE, [], fire), ['test_fire_only', 'test_plain']);
  assert.deepEqual(R.perkPool(r, NEEDY, RULE), ['test_fire_only', 'test_plain'], 'no team given: needs not asked');
  assert.equal(R.perkFits({ needs: ['team:Fire', 'mono'] }, [['Fire'], ['Fire', 'Water']]), true);
  assert.equal(R.perkFits({ needs: ['team:Fire', 'mono'] }, [['Fire'], ['Water']]), false);
  assert.deepEqual(R.perkTeamOf(startedSave('musk0', 10).team), [['Fire']]);
  /* the pick, a shop's shelf and an event draw from the same pool */
  for (let n = 0; n < 30; n++) {
    const p = run('NEED' + n);
    assert.ok(!(R.perkOffer(p, NEEDY, RULE, water) || []).includes('test_fire_only'), 'the pick');
    assert.notEqual(R.perkShelf(p, 2, 1, NEEDY, RULE, water), 'test_fire_only', 'the shelf');
    assert.notEqual(modules.encounters.encPerk(p, undefined, NEEDY, RULE, water), 'test_fire_only', 'an event');
  }
  assert.equal(modules.encounters.encPerk(r, 'test_fire_only', NEEDY, RULE, water), 'test_fire_only', 'named: given');
});

test('PK-4 tags: a Perk whose tag is a type on the team or a held Perk’s tag weighs run.perks.bias times more', () => {
  const P = {
      test_fire: { name: 'T', d: 'T.', rarity: 'common', tags: ['Fire'], fx: [{ kind: 'money', mult: 1.1 }] },
      test_kit: { name: 'T', d: 'T.', rarity: 'common', tags: ['weather'], fx: [{ kind: 'money', mult: 1.1 }] },
      test_umb: { name: 'T', d: 'T.', rarity: 'uncommon', tags: ['weather'], fx: [{ kind: 'money', mult: 1.1 }] },
      test_none: { name: 'T', d: 'T.', rarity: 'common', fx: [{ kind: 'money', mult: 1.1 }] },
    },
    rule = { ...RULE, bias: 2 },
    r = run(),
    w = RULE.rarity.common;
  assert.equal(R.perkWeight(r, 'test_fire', P, rule, [['Fire']]), 2 * w);
  assert.equal(R.perkWeight(r, 'test_fire', P, rule, [['Water']]), w);
  assert.equal(R.perkWeight(r, 'test_fire', P, rule), w, 'no team: no type lean');
  assert.equal(R.perkWeight(r, 'test_kit', P, rule, [['Water']]), w);
  r.perks = ['test_umb'];
  assert.equal(R.perkWeight(r, 'test_kit', P, rule, [['Water']]), 2 * w, 'a held Perk’s theme');
  assert.equal(R.perkWeight(r, 'test_none', P, rule, [['Fire']]), w, 'no tags');
  assert.equal(R.perkWeight(r, 'test_kit', P, { ...rule, bias: 1 }, [['Water']]), w, 'bias 1: none');
  /* over many shelves, the matching Perk is drawn about twice as often as the other common one */
  const Q = { test_fire: P.test_fire, test_none: P.test_none },
    count = team => {
      let n = 0;
      for (let k = 0; k < 400; k++) if (R.perkShelf(run('BIAS' + k), 1, 1, Q, rule, team) === 'test_fire') n++;
      return n / 400;
    };
  const lean = count([['Fire']]),
    even = count([['Water']]);
  assert.ok(Math.abs(even - 0.5) < 0.08, `even ${even}`);
  assert.ok(Math.abs(lean - 2 / 3) < 0.08, `lean ${lean}`);
});
