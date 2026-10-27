// Hub track HB-10d: the fountain's coin (game/js/logic/fountain-wish.js) with the game's rules (rules.json
// square.wish): its cost, once per return, the same coin on a reload, the odds, a boon joining the next run at its
// take-off, a big win paid at once; meta.wish's load check (meta-state.js validWish).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA } from './setup-real.mjs';
import { wishCan, wishRoll, wishSaid, wishTakeoff, wishToss } from '../../game/js/logic/fountain-wish.js';
import { newMeta, validMeta, validWish } from '../../game/js/logic/meta-state.js';
import { encArrive, encBoonRows } from '../../game/js/logic/run-enc.js';

const R = GAME_DATA.rules.square.wish;
const metaWith = (scrap, runs = 0, seed = 'abc') => ({
  ...newMeta(),
  scrap,
  runs,
  history: runs
    ? [
        {
          seed,
          theme: '',
          region: 'R',
          exp: 1,
          end: 'lost',
          by: null,
          row: 3,
          days: 4,
          team: [],
          perks: [],
          leaders: [],
          rival: null,
        },
      ]
    : [],
});

test('the rules as the owner chose: 3 Scrap; 55 boon, 30 joke, 10 curse, 5 big win', () => {
  assert.deepEqual(R.cost, { cur: 'scrap', n: 3 });
  const w = pre => R.outcomes.filter(o => o.id.startsWith(pre)).reduce((a, o) => a + o.w, 0);
  assert.deepEqual([w('boon'), w('joke'), w('curse'), w('big')], [55, 30, 10, 5]);
  for (const o of R.outcomes.filter(o => o.fx)) assert.equal(o.places, o.id === 'curse' ? 2 : 3, o.id);
});

test('a toss costs 3 Scrap, once per return: the next waits for the next run to end', () => {
  const M = metaWith(10);
  assert.equal(wishCan(M, R), 'ok');
  const r = wishToss(M, R);
  assert.ok(r && r.say && R.outcomes.includes(r.out));
  assert.equal(M.scrap + (r.out.pay && r.out.pay.scrap ? -r.out.pay.scrap : 0), 7);
  assert.equal(wishCan(M, R), 'done');
  assert.equal(wishToss(M, R), null);
  M.runs += 1;
  assert.equal(wishCan(M, R), 'ok');
  assert.equal(wishCan(metaWith(2), R), 'poor');
  assert.equal(wishToss(metaWith(2), R), null);
});

test('the same coin on a reload: the roll comes from the return, not the moment', () => {
  const a = wishRoll(metaWith(5, 4, 'seed1'), R),
    b = wishRoll(metaWith(5, 4, 'seed1'), R);
  assert.deepEqual([a.out.id, a.say], [b.out.id, b.say]);
  const M = metaWith(5, 4, 'seed1');
  wishToss(M, R);
  assert.equal(wishSaid(M, R), a.say, 'the board shows the line the toss said');
  M.runs += 1;
  assert.equal(wishSaid(M, R), null);
});

test('over many returns the odds come out near the weights', () => {
  const n = {};
  for (let i = 0; i < 4000; i++) {
    const id = wishRoll(metaWith(5, i + 1, 's' + i), R).out.id.replace(/_.*/, '');
    n[id] = (n[id] || 0) + 1;
  }
  for (const [k, want] of Object.entries({ boon: 0.55, joke: 0.3, curse: 0.1, big: 0.05 }))
    assert.ok(Math.abs(n[k] / 4000 - want) < 0.03, `${k}: ${n[k] / 4000}`);
});

test('a boon joins the next run at take-off for its places, an item goes into the bag, once', () => {
  const boon = R.outcomes.find(o => o.id === 'boon_money'),
    heal = R.outcomes.find(o => o.id === 'boon_heal');
  const s = { meta: { ...metaWith(5), wish: { at: 0, out: 'boon_money' } }, run: {}, items: {} };
  assert.equal(wishTakeoff(s, R), boon);
  assert.deepEqual(
    encBoonRows(s.run).map(f => [f.kind, f.mult, f.src]),
    [['money', 1.1, 'event:fountain']]
  );
  assert.equal(wishTakeoff(s, R), null, 'used once');
  for (let i = 0; i < 3; i++) encArrive(s.run);
  assert.equal(encBoonRows(s.run).length, 1, 'still on in the third place');
  encArrive(s.run);
  assert.equal(encBoonRows(s.run).length, 0, 'gone after its three places');
  const t = { meta: { ...metaWith(5), wish: { at: 0, out: 'boon_heal' } }, run: {}, items: { hi_potion: 1 } };
  assert.equal(wishTakeoff(t, R), heal);
  assert.equal(t.items.hi_potion, 2);
  const old = { meta: { ...metaWith(5, 2), wish: { at: 1, out: 'boon_money' } }, run: {}, items: {} };
  assert.equal(wishTakeoff(old, R), null, 'a toss from an earlier return is spent');
});

test('a big win pays at once and leaves nothing for the run', () => {
  let M, r;
  for (let i = 1; ; i++) {
    M = metaWith(5, i, 'x' + i);
    if (wishRoll(M, R).out.id.startsWith('big')) {
      r = wishToss(M, R);
      break;
    }
  }
  const [[cur, n]] = Object.entries(r.out.pay);
  assert.equal(M[cur], (cur === 'scrap' ? 2 : 0) + n);
  assert.equal(M.wish.used, 1);
});

test("meta.wish's load check", () => {
  assert.ok(validWish(null) && validWish(undefined));
  assert.ok(validWish({ at: 3, out: 'joke' }) && validWish({ at: 0, out: 'boon_money', used: 1 }));
  for (const bad of [{ at: -1, out: 'joke' }, { at: 1, out: 'Joke!' }, { at: 1, out: 'joke', used: 2 }, [], 'joke'])
    assert.ok(!validWish(bad), JSON.stringify(bad));
  assert.ok(validMeta({ ...newMeta(), wish: { at: 0, out: 'joke' } }));
  assert.ok(!validMeta({ ...newMeta(), wish: { at: 0, out: 'joke', say: 'x' } }));
});
