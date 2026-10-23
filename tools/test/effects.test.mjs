// RL-12: logic/effects.js, what a run's Perks change: each effect kind at its point, rows that don't apply left
// out, the same answer whatever order the Perks were picked in, every Perk held at once staying finite, and no
// rows changing nothing (a battle or a run without Perks is as before).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const E = modules.effects,
  RELICS = GAME_DATA.relics,
  ALL = Object.keys(RELICS);
/** the rows of these made-up Perks (one row each) */
const rows = (...fx) =>
  E.fxRows(
    fx.map((_, i) => 'x' + i),
    Object.fromEntries(fx.map((f, i) => ['x' + i, { fx: [f] }]))
  );
const hit = (o = {}) => ({ cat: 'H', type: 'Fire', deal: true, take: false, ...o });

test('effects: no rows change nothing (exactly the number given)', () => {
  for (const fx of [[], null, undefined]) {
    assert.equal(E.fxMoney(fx, 137), 137);
    assert.equal(E.fxPrice(fx, 'shop', 250), 250);
    assert.equal(E.fxPrice(fx, 'heal', 60), 60);
    assert.equal(E.fxCatch(fx), 1);
    assert.equal(E.fxDamage(fx, hit()), 1);
    assert.deepEqual(E.fxStages(fx), {});
    assert.equal(E.fxHealShare(fx), 0);
    const r = { money: 0.1, itemShare: 0.5 };
    assert.deepEqual(E.fxPayoutRates(fx, r), { ...r, capital: 1 });
  }
});

test('effects: fxRows tags each row with its Perk, in the order held; an unknown id gives none', () => {
  const fx = E.fxRows(['shelter', 'nope', 'offshore'], RELICS);
  assert.deepEqual(
    fx.map(f => [f.src, f.kind]),
    [
      ['shelter', 'price'],
      ['offshore', 'money'],
    ]
  );
  assert.equal(RELICS.shelter.fx[0].src, undefined, 'the data is not changed');
});

test('effects: each kind at its point, and only there', () => {
  const fx = rows(
    { kind: 'money', mult: 1.2 },
    { kind: 'price', what: 'heal', mult: 0.5 },
    { kind: 'price', what: 'shop', mult: 0.85 },
    { kind: 'catch', mult: 1.25 },
    { kind: 'stat', stat: 'hus', stages: 1 },
    { kind: 'heal', share: 0.15 },
    { kind: 'payout', what: 'capital', mult: 1.15 },
    { kind: 'payout', what: 'itemShare', mult: 2 }
  );
  assert.equal(E.fxMoney(fx, 100), 120);
  assert.equal(E.fxMoney(fx, 33), 40, 'whole dollars');
  assert.equal(E.fxPrice(fx, 'heal', 60), 30);
  assert.equal(E.fxPrice(fx, 'shop', 250), 213);
  assert.equal(E.fxCatch(fx), 1.25);
  assert.deepEqual(E.fxStages(fx), { hus: 1 });
  assert.equal(E.fxHealShare(fx), 0.15);
  const p = E.fxPayoutRates(fx, { money: 0.1, itemShare: 0.5, win: 100 });
  assert.deepEqual(p, { money: 0.1, itemShare: 1, win: 100, capital: 1.15 });
  assert.equal(E.fxDamage(fx, hit()), 1, 'no damage rows');
});

test('effects: damage rows count for their side, category and type', () => {
  const fx = rows(
    { kind: 'damage', side: 'deal', cat: 'H', mult: 1.15 },
    { kind: 'damage', side: 'deal', type: 'Water', mult: 1.5 },
    { kind: 'damage', side: 'take', mult: 0.9 }
  );
  assert.equal(E.fxDamage(fx, hit()), 1.15, 'one of yours hits with a physical Fire move');
  assert.equal(E.fxDamage(fx, hit({ cat: 'S' })), 1, 'a special move: not the physical row');
  assert.equal(E.fxDamage(fx, hit({ type: 'Water' })), 1.15 * 1.5);
  assert.equal(E.fxDamage(fx, hit({ deal: false, take: true })), 0.9, 'a foe hits one of yours');
  assert.equal(E.fxDamage(fx, hit({ deal: false, take: false })), 1, 'foe on foe');
  assert.equal(E.fxDamage(fx, hit({ take: true })), 1.15 * 0.9, 'one of yours hits another of yours');
});

test('effects: stacking is the same whatever order the Perks were picked in', () => {
  const ids = ALL.slice(),
    one = E.fxRows(ids, RELICS),
    two = E.fxRows(ids.slice().reverse(), RELICS),
    sample = fx => [
      E.fxMoney(fx, 1234),
      E.fxPrice(fx, 'shop', 999),
      E.fxPrice(fx, 'heal', 60),
      E.fxCatch(fx),
      E.fxDamage(fx, hit({ take: true })),
      E.fxStages(fx),
      E.fxHealShare(fx),
      E.fxPayoutRates(fx, { itemShare: 0.5 }),
    ];
  assert.deepEqual(sample(one), sample(two));
  const m = [1.1, 1.3, 0.7, 1.9, 0.3].map(mult => ({ kind: 'catch', mult }));
  assert.equal(E.fxCatch(rows(...m)), E.fxCatch(rows(...m.slice().reverse())), 'bit for bit');
  assert.deepEqual(
    E.fxStages(rows({ kind: 'stat', stat: 'lev', stages: 2 }, { kind: 'stat', stat: 'lev', stages: 1 })),
    {
      lev: 3,
    }
  );
});

test('effects: many rows stay within the limits (every Perk at once, and the worst made-up stack)', () => {
  const fx = E.fxRows([...ALL, ...ALL, ...ALL], RELICS);
  for (const v of [E.fxMoney(fx, 1e6), E.fxPrice(fx, 'shop', 1e6), E.fxCatch(fx), E.fxHealShare(fx)])
    assert.ok(Number.isFinite(v) && v >= 0, `${v} finite`);
  const big = rows(...Array.from({ length: 40 }, () => ({ kind: 'catch', mult: 4 })));
  assert.equal(E.fxCatch(big), E.FX_LIMIT.hi);
  const small = rows(...Array.from({ length: 40 }, () => ({ kind: 'price', what: 'shop', mult: 0 })));
  assert.equal(E.fxPrice(small, 'shop', 100), Math.round(100 * E.FX_LIMIT.lo), 'never free');
  const st = rows(...Array.from({ length: 20 }, () => ({ kind: 'stat', stat: 'hus', stages: 6 })));
  assert.deepEqual(E.fxStages(st), { hus: E.FX_STAGES });
  assert.equal(E.fxHealShare(rows(...Array.from({ length: 20 }, () => ({ kind: 'heal', share: 0.5 })))), 1);
  assert.equal(E.fxPayoutRates(fx, { itemShare: 0.9 }).itemShare, 1, 'items never above their price');
});

test('effects: every Perk in relics.json uses a known kind', () => {
  for (const [id, R] of Object.entries(RELICS))
    for (const f of R.fx) assert.ok(E.FX_KINDS.includes(f.kind), `${id}: ${f.kind}`);
});

test("effects: fxRunPrice is a run's price with its Perks' price rows (none held, or no run: the price)", () => {
  const heal = ALL.find(id => (RELICS[id].fx || []).some(f => f.kind === 'price' && f.what === 'heal'));
  assert.ok(heal, 'a Perk with a heal price row');
  const run = { relics: [heal] };
  assert.equal(E.fxRunPrice(run, RELICS, 'heal', 60), E.fxPrice(E.fxRows([heal], RELICS), 'heal', 60));
  assert.notEqual(E.fxRunPrice(run, RELICS, 'heal', 60), 60);
  assert.equal(E.fxRunPrice(run, RELICS, 'shop', 60), 60, 'only its own kind of price');
  assert.equal(E.fxRunPrice({ relics: [] }, RELICS, 'heal', 60), 60);
  assert.equal(E.fxRunPrice(null, RELICS, 'heal', 60), 60);
});
