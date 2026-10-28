// RL-12: a run's Perks outside battle: the run's rows (none held: none), healing on walking into a place
// (run-loop.js runArriveHeal), the payout's Research row (run-state.js payoutOf with fxPayoutRates) and its screen row.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, fn, modules, reseed, startedSave } from './setup-real.mjs';

const E = modules.effects,
  L = modules['run-loop'],
  S = modules['run-state'],
  PERKS = GAME_DATA.perks,
  RATES = GAME_DATA.rules.run.payout;
const maxHp = fn('maxHp');

test('run fx: a run without Perks has no rows; the hub has none', () => {
  assert.equal(E.fxOfRun(null, PERKS), null);
  assert.equal(E.fxOfRun({ perks: [] }, PERKS), null);
  assert.deepEqual(
    E.fxOfRun({ perks: ['clinic_card'] }, PERKS).map(f => f.src),
    ['clinic_card']
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
  s.run = { perks: [] };
  assert.equal(L.runArriveFx(s, PERKS), 0, 'no Perks: nothing');
  assert.equal(s.team[0].hp, 1);
  s.run.perks = ['trail_snacks'];
  assert.equal(L.runArriveFx(s, PERKS), Math.ceil(top * 0.15));
  assert.equal(s.team[0].hp, 1 + Math.ceil(top * 0.15));
  assert.equal(L.runArriveFx({ team: s.team, run: null }, PERKS), 0, 'not on a run: nothing');
});

test('run fx: a lost run’s payout with Field Notebook and Lost Property Form adds a Perks row; without them, as before', () => {
  /* a loss: RL-9b brings a win's items home, so they are paid (and Lost Property Form counts) only on a loss */
  const end = { se: 1000, items: { potion: 2 }, released: 1, cleared: 5, won: false },
    price = () => 100,
    plain = S.payoutOf(end, RATES, price),
    same = S.payoutOf(end, E.fxPayoutRates(null, RATES), price);
  assert.deepEqual(same, plain, 'no rows: the same payout');
  const fx = E.fxRows(['field_notebook', 'lost_property'], PERKS),
    pay = S.payoutOf(end, E.fxPayoutRates(fx, RATES), price),
    items = pay.lines.find(l => l.what === 'items'),
    row = pay.lines.find(l => l.what === 'fx');
  assert.equal(items.n, 200, 'items at their full price');
  const before = pay.lines.filter(l => l.what !== 'fx').reduce((a, l) => a + l.research, 0);
  assert.equal(row.n, 15);
  assert.equal(row.research, Math.floor(before * 1.15) - before);
  assert.equal(pay.research, before + row.research, 'the rows add up to the total');
  const shown = L.runPayoutRows(pay, RATES).find(r => r.label === 'Perks');
  assert.deepEqual(shown, { label: 'Perks', note: '+15%', value: row.research });
});

// PK-1: the run's moments (arrive, buy, take, win, catch), their conditions and counters on run.perkState
/** a save on a run standing in a town, holding these test-only Perks (never in perks.json) */
function onRun(P) {
  reseed();
  const s = startedSave('musk0', 20);
  s.run = {
    perks: Object.keys(P),
    map: { nodes: [{ type: 'town' }, { type: 'route' }] },
    forecast: [[], ['rain'], ['sun']],
    clock: 1,
  };
  s.trip = { node: 1 };
  return s;
}
const hurt = s => (s.team[0].hp = 1);

test('run fx PK-1: arrive, with a condition on the place and every N, heals the team; counts on run.perkState', () => {
  const P = {
    test_pillow: { fx: [{ kind: 'heal', share: 0.25, when: 'arrive', if: 'place:town' }] },
    test_card: { fx: [{ kind: 'heal', share: 1, when: 'arrive', every: 3 }] },
  };
  const s = onRun(P),
    top = maxHp(s.team[0]);
  hurt(s);
  assert.equal(L.runArriveFx(s, P), Math.ceil(top * 0.25), 'a town: the pillow');
  assert.deepEqual(s.run.perkState, { 'test_card/0': { n: 1 } });
  s.trip.node = 2;
  hurt(s);
  assert.equal(L.runArriveFx(s, P), 0, 'a route: nothing yet');
  hurt(s);
  assert.equal(L.runArriveFx(s, P), top - 1, 'the 3rd place: full');
  assert.equal(s.run.perkState['test_card/0'].n, 0);
  /* the run's context: the team's types, the place and its weather today */
  const ctx = L.fxRunCtx(s);
  assert.equal(ctx.place, 'route');
  assert.equal(ctx.weather, 'sun', 'map node 1 is world node 2');
  assert.equal(ctx.team.length, s.team.length);
});

test('run fx PK-1: a heal row without when still heals on arrival, only where its condition holds', () => {
  const P = { test_rain: { fx: [{ kind: 'heal', share: 0.5, if: 'weather:sun' }] } };
  const s = onRun(P);
  hurt(s);
  assert.equal(L.runArriveFx(s, P), 0, 'no sun at the town');
  s.trip.node = 2;
  s.run.forecast = [[], [], ['sun']];
  assert.ok(L.runArriveFx(s, P) > 0);
  assert.equal(s.run.perkState, undefined, 'no marks made');
});

test('run fx PK-1: buy counts a run’s purchases; take acts once, on the Perk taken alone', () => {
  const P = {
    test_punch: { fx: [{ kind: 'heal', share: 1, when: 'buy', every: 2 }] },
    test_pass: { fx: [{ kind: 'heal', share: 1, when: 'take' }] },
    test_other: { fx: [{ kind: 'heal', share: 1, when: 'take' }] },
  };
  const s = onRun({ test_punch: P.test_punch, test_other: P.test_other }),
    R = modules.perks,
    rule = { cap: 6, pick: 3, rarity: { common: 1 }, price: { common: 1 } };
  hurt(s);
  assert.equal(L.runBuyFx(s, P).rows.length, 0);
  assert.equal(L.runBuyFx(s, P).rows.length, 1, 'the 2nd purchase');
  assert.equal(s.team[0].hp, maxHp(s.team[0]));
  /* taken without the save: nothing acts (the Studio, a preview) */
  hurt(s);
  assert.equal(R.perkTake(s.run, 'test_pass', P, rule), '');
  assert.equal(s.team[0].hp, 1);
  s.run.perks = s.run.perks.filter(id => id !== 'test_pass');
  assert.equal(R.perkTake(s.run, 'test_pass', P, rule, undefined, s), '');
  assert.equal(s.team[0].hp, maxHp(s.team[0]), 'its take row');
  /* only the one taken: test_other's take row didn't act again (it would heal) */
  hurt(s);
  assert.equal(L.runFxMoment(s, P, 'take', undefined, 'test_pass').rows.length, 1);
  assert.equal(L.runFxMoment(s, P, 'take', undefined, 'nope').rows.length, 0);
});

test('run fx PK-1: win and catch, from battleSettle: the foe’s kind, noFaint, a growth, once a run', () => {
  const P = {
    test_like: {
      fx: [{ kind: 'damage', side: 'deal', mult: 1, grow: { on: 'win', by: 0.01, max: 0.02, if: 'noFaint' } }],
    },
    test_bounty: { fx: [{ kind: 'heal', share: 1, when: 'win', if: 'foe:wild', once: 'run' }] },
    test_selfie: { fx: [{ kind: 'heal', share: 0.1, when: 'catch' }] },
  };
  const s = onRun(P),
    old = { ...GAME_DATA.perks };
  Object.assign(GAME_DATA.perks, P);
  try {
    const foe = fn('makeBilly')('musk0', 5),
      settle = (over, fainted = 0) =>
        fn('battleSettle')(
          { kind: 'wild', over, runK: 0, fainted, sides: [{ team: s.team }, { team: [foe] }], qid: 'x' },
          s
        );
    hurt(s);
    settle('win');
    assert.equal(s.run.perkState['test_like/0'].v, 0.01);
    assert.equal(s.team[0].hp, maxHp(s.team[0]), 'the bounty, once');
    hurt(s);
    settle('win', 1);
    assert.equal(s.run.perkState['test_like/0'].v, 0.01, 'a faint: no growth');
    assert.equal(s.team[0].hp, 1, 'once a run: spent');
    settle('win');
    settle('win');
    assert.equal(s.run.perkState['test_like/0'].v, 0.02, 'capped');
    settle('caught');
    assert.ok(s.team[0].hp > 1, 'caught: the selfie');
  } finally {
    for (const k of Object.keys(P)) if (!(k in old)) delete GAME_DATA.perks[k];
  }
});
