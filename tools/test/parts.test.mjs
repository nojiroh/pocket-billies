// Phase 16: part sizes, weight and Prime (game/js/logic/rules.js), on the game's own rules.json "parts".
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { data, fn, reseed, startedSave } from './setup-real.mjs';

const { RULES, SPECIES, DEX_ORDER } = data;
const P = RULES.parts;
const allSize = s => Object.fromEntries(P.slots.map(k => [k, s]));

beforeEach(() => reseed());

test('the parts rules add up', () => {
  const share = P.slots.reduce((a, k) => a + P.share[k], 0);
  assert.ok(Math.abs(share - 1) < 1e-9, `slot shares add up to ${share}`);
  const odds = Object.values(P.sizes).reduce((a, s) => a + s.odds, 0);
  assert.ok(Math.abs(odds - 1) < 1e-9, `size odds add up to ${odds}`);
  assert.ok(P.sizes.M && P.sizes.M.weight === 1 && P.sizes.M.scale === 1, 'M is the normal size');
});

test('all M is the species weight and Prime; one slot off is not Prime', () => {
  assert.equal(fn('buildWeightRatio')(allSize('M')), 1);
  assert.equal(fn('isPrime')(allSize('M')), true);
  assert.equal(fn('isPrime')({ ...allSize('M'), body: 'L' }), false);
  assert.equal(fn('isPrime')(fn('primeBuild')()), true);
});

test('the worked example in the phase file: L body, head and signature, M front and back', () => {
  const b = { head: 'L', body: 'L', front: 'M', back: 'M', sig: 'L' },
    w = fn('buildWeightRatio')(b);
  assert.ok(Math.abs(w - 1.245) < 1e-9, `weight ratio ${w}`);
  const atk = fn('buildStatFactor')(b, 'lev'),
    spd = fn('buildStatFactor')(b, 'hus');
  assert.equal(Math.round((atk - 1) * 100), 12);
  assert.equal(Math.round((spd - 1) * 100), -12);
  assert.equal(fn('buildStatFactor')(b, 'law'), 1, 'Defense does not change with weight');
});

test('heavier hits harder and moves slower, within the caps; Prime adds its bonus', () => {
  const heavy = fn('buildStatFactor'),
    L = allSize('L'),
    S = allSize('S');
  assert.ok(heavy(L, 'lev') > 1 && heavy(L, 'hus') < 1);
  assert.ok(heavy(S, 'lev') < 1 && heavy(S, 'hus') > 1);
  for (const b of [L, S])
    for (const k of ['lev', 'lob', 'hus']) {
      const f = heavy(b, k);
      assert.ok(f >= 1 - P.cap - 1e-9 && f <= 1 + P.cap + 1e-9, `${k} factor ${f} is outside the cap`);
    }
  assert.ok(Math.abs(heavy(allSize('M'), 'law') - (1 + P.primeBonus)) < 1e-9);
});

test('a Billie gets its build: wild ones roll, starters and trainers are Prime', () => {
  startedSave(RULES.start.starters[0] + '0', 5);
  const sp = DEX_ORDER[0];
  assert.equal(fn('isPrime')(fn('makeBilly')(sp, 10).build), true, 'a made Billie is all M');
  const given = { head: 'S', body: 'L', front: 'M', back: 'S', sig: 'L' };
  assert.deepEqual(fn('makeBilly')(sp, 10, { build: given }).build, given);
  const q = fn('spawn')();
  assert.ok(q.build && P.slots.every(k => P.sizes[q.build[k]]), 'a spawned Billie has a size for every slot');
  const old = { id: 'x', sp, lvl: 5, no: 1 };
  const b = fn('encounterBuild')(old);
  assert.deepEqual(b, old.build, 'an old queued Billie gets sizes once and keeps them');
  assert.deepEqual(fn('cleanBuild')({ head: 'Q', body: 'L' }), { ...allSize('M'), body: 'L' });
});

test('the build changes the stats it should (an L-bodied Billie is stronger and slower)', () => {
  startedSave(RULES.start.starters[0] + '0', 5);
  const sp = Object.keys(SPECIES).find(k => SPECIES[k].wt > 1);
  const mk = s => fn('makeBilly')(sp, 40, { build: allSize(s) });
  const S = mk('S'),
    L = mk('L');
  assert.ok(fn('stat')(L, 'lev') > fn('stat')(S, 'lev'));
  assert.ok(fn('stat')(L, 'hus') < fn('stat')(S, 'hus'));
  assert.ok(fn('billyWeight')(L) > fn('billyWeight')(S));
});

// the simulation: thousands of wild rolls stay inside the caps and Prime comes out at about 0.6^5 (1 in 12)
test('simulation: 20000 wild builds', () => {
  const n = 20000;
  let prime = 0,
    lo = Infinity,
    hi = -Infinity;
  for (let i = 0; i < n; i++) {
    const b = fn('rollBuild')();
    if (fn('isPrime')(b)) prime++;
    for (const k of ['lev', 'lob', 'hus']) {
      const f = fn('buildStatFactor')(b, k) / (fn('isPrime')(b) ? 1 + P.primeBonus : 1);
      lo = Math.min(lo, f);
      hi = Math.max(hi, f);
    }
  }
  const want = Math.pow(P.sizes.M.odds, P.slots.length),
    got = prime / n;
  assert.ok(Math.abs(got - want) < 0.01, `Prime came out ${got}, expected about ${want}`);
  assert.ok(lo >= 1 - P.cap - 1e-9 && hi <= 1 + P.cap + 1e-9, `factors ran from ${lo} to ${hi}`);
});

test('the Build tab balance: all M leans nowhere; big parts lean to attack, small to speed', () => {
  const lean = fn('buildLean');
  const m = lean(allSize('M'));
  assert.deepEqual([m.attack, m.speed, m.lean, m.off, m.prime], [0, 0, 0, 0, true]);
  const big = lean(allSize('L')),
    small = lean(allSize('S'));
  assert.ok(big.attack > 0 && big.speed < 0 && big.lean > 0, `all L leans to attack: ${JSON.stringify(big)}`);
  assert.ok(small.attack < 0 && small.speed > 0 && small.lean < 0, `all S leans to speed: ${JSON.stringify(small)}`);
  assert.ok(Math.abs(big.lean) <= 1 && Math.abs(small.lean) <= 1);
  assert.equal(big.off, P.slots.length);
  assert.equal(lean({ ...allSize('M'), body: 'L' }).off, 1);
  // the meter's numbers are the ones the stats use (before Prime)
  const b = { ...allSize('M'), body: 'L' };
  assert.ok(Math.abs(1 + lean(b).attack - fn('buildStatFactor')(b, 'lev')) < 1e-9);
  assert.ok(Math.abs(1 + lean(b).speed - fn('buildStatFactor')(b, 'hus')) < 1e-9);
});
