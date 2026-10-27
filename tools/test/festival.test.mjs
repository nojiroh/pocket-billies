// Hub track HB-10e: Copperleaf's festivals (game/js/logic/festival.js) with the game's festivals.json: the calendar day
// in the phone's time zone, a date festival's week (one running on into January), which one is on (a milestone, then
// a date, then a market day), the festival market's stock per occasion, paying for it, and what is coming.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA } from './setup-real.mjs';
import { festBuy, festDate, festDateOn, festNext, festStock, festivalOn } from '../../game/js/logic/festival.js';
import { newMeta } from '../../game/js/logic/meta-state.js';

const FS = GAME_DATA.festivals,
  at = (/** @type {string} */ iso, tz = 0) => festDate(Date.parse(iso), tz),
  never = () => false;

test('the calendar day: the phone’s time zone moves midnight', () => {
  assert.deepEqual([at('2026-03-20T00:30:00Z').m, at('2026-03-20T00:30:00Z').d], [3, 20]);
  /* New York (5 h west, getTimezoneOffset 300): half past midnight UTC is still the 19th there */
  assert.equal(at('2026-03-20T00:30:00Z', 300).d, 19);
  /* Tokyo (9 h east, -540): late on the 19th UTC is already the 20th */
  assert.equal(at('2026-03-19T20:00:00Z', -540).d, 20);
  assert.equal(at('2026-03-20T12:00:00Z').day - at('2026-03-19T12:00:00Z').day, 1);
});

test('a date festival’s week: on from its first day for its days, the year it began as its occasion', () => {
  const F = FS.festivals.sprout_fair;
  assert.equal(festDateOn(F, at('2026-03-19T12:00:00Z')), null);
  assert.equal(festDateOn(F, at('2026-03-20T12:00:00Z')), 2026);
  assert.equal(festDateOn(F, at('2026-03-26T12:00:00Z')), 2026);
  assert.equal(festDateOn(F, at('2026-03-27T12:00:00Z')), null);
  /* the Lantern Walk starts on 21 December and runs on into January: still the year it began */
  const L = FS.festivals.lantern_walk;
  assert.equal(festDateOn(L, at('2026-12-21T12:00:00Z')), 2026);
  assert.equal(festDateOn(L, at('2027-01-02T12:00:00Z')), null);
  assert.equal(festDateOn({ ...L, from: '12-30', days: 5 }, at('2027-01-02T12:00:00Z')), 2026);
});

test('which is on: a milestone before a date, a date before a market day, none in between', () => {
  const m = { ...newMeta(), runs: 4 },
    plain = at('2026-05-05T12:00:00Z'),
    fair = at('2026-03-21T12:00:00Z');
  assert.equal(festivalOn(FS, m, plain, never), null);
  assert.equal(festivalOn(FS, m, fair, never)?.id, 'sprout_fair');
  /* every third return is a market day; not before the first run */
  assert.equal(festivalOn(FS, { ...m, runs: 6 }, plain, never)?.id, 'market_day');
  assert.equal(festivalOn(FS, { ...m, runs: 6 }, plain, never)?.at, 6);
  assert.equal(festivalOn(FS, { ...m, runs: 0 }, plain, never), null);
  assert.equal(festivalOn(FS, { ...m, runs: 6 }, fair, never)?.id, 'sprout_fair');
  /* a milestone's condition is read by the caller (the story's conditions) */
  const first = (/** @type {string} */ c) => c === FS.festivals.homecoming.when;
  assert.equal(festivalOn(FS, { ...m, runs: 6 }, fair, first)?.id, 'homecoming');
  assert.equal(festivalOn(FS, m, plain, c => c === 'runs = 10')?.id, 'tenth_departure');
});

test('the festival market: its stock each occasion, paid in Scrap, into the bag or the pyramids', () => {
  const s = { meta: { ...newMeta(), runs: 3, scrap: 10 }, items: {}, pyramids: {} },
    on = /** @type {any} */ (festivalOn(FS, s.meta, at('2026-05-05T12:00:00Z'), never));
  assert.equal(on.id, 'market_day');
  const S0 = festStock(on, s.meta);
  assert.deepEqual(
    S0.map(w => w.left),
    on.F.stock.map((/** @type {any} */ w) => w.n)
  );
  const potion = S0.findIndex(w => w.ware.item === 'potion'),
    coin = S0.findIndex(w => w.ware.coin === 'pyramid');
  assert.equal(festBuy(s, on, potion, FS.cur), 'ok');
  assert.equal(s.items.potion, 1);
  assert.equal(s.meta.scrap, 10 - on.F.stock[potion].price);
  assert.equal(festBuy(s, on, coin, FS.cur), 'ok');
  assert.equal(s.pyramids.pyramid, 1);
  assert.deepEqual(s.meta.fest, { id: 'market_day', at: 3, got: { [potion]: 1, [coin]: 1 } });
  /* sold out this occasion */
  s.meta.scrap = 99;
  while (festStock(on, s.meta)[potion].left) assert.equal(festBuy(s, on, potion, FS.cur), 'ok');
  assert.equal(festBuy(s, on, potion, FS.cur), 'gone');
  assert.equal(festBuy(s, on, 99, FS.cur), 'gone');
  /* too poor: nothing changes */
  s.meta.scrap = 0;
  const was = JSON.stringify(s);
  assert.equal(festBuy(s, on, coin, FS.cur), 'poor');
  assert.equal(JSON.stringify(s), was);
  /* the next market day is a new occasion: the stock is back (the old count is left behind, not added to) */
  s.meta.runs = 6;
  const next = /** @type {any} */ (festivalOn(FS, s.meta, at('2026-05-05T12:00:00Z'), never));
  assert.equal(festStock(next, s.meta)[potion].left, on.F.stock[potion].n);
  s.meta.scrap = 5;
  assert.equal(festBuy(s, next, potion, FS.cur), 'ok');
  assert.deepEqual(s.meta.fest, { id: 'market_day', at: 6, got: { [potion]: 1 } });
});

test('what is coming: the date festivals by days to go (not the one on), the next market day by returns', () => {
  const m = { ...newMeta(), runs: 4 },
    N = festNext(FS, m, at('2026-03-21T12:00:00Z'));
  assert.ok(!N.some(n => n.id === 'sprout_fair'), 'the fair is on, not coming');
  const L = N.find(n => n.id === 'longest_light');
  assert.equal(L?.days, 91);
  assert.equal(N.find(n => n.id === 'market_day')?.runs, 2);
  /* after its week the fair is next year's */
  assert.equal(festNext(FS, m, at('2026-03-27T12:00:00Z')).find(n => n.id === 'sprout_fair')?.days, 358);
});
