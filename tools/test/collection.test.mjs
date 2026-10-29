// PK-12: the Field Guide's Perks tab record (game/js/logic/collection.js) on the game's data: what a run shows is
// seen, what it holds is taken, a set is taken once its bonus is on, held items from the bag and the team, boons and
// curses once on; the stored record is cleaned on load, and a new save starts empty.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { data, fn, modules, startedSave } from './setup-real.mjs';

const C = modules.collection;
const { PERKS, ITEMS, BOONS, PERK_SETS } = data;
const starter = () => Object.keys(data.SPECIES).find(k => data.SPECIES[k].line === data.RULES.start.starters[0]);
const held = Object.keys(ITEMS).filter(k => ITEMS[k].hold);
const office = Object.keys(PERKS).filter(k => (PERKS[k].tags || []).includes('office'));
const boon = Object.keys(BOONS).find(k => !BOONS[k].curse);

/** a started save on a run holding `perks`, offered `offer`, with a reward pick's `cards` and the boons `boons` */
function onRun({ perks = [], offer = null, shelf = {}, cards = [], boons = [] } = {}) {
  const s = startedSave(starter(), 10);
  s.run = /** @type {any} */ ({
    perks,
    offer,
    shelf,
    perkState: {},
    enc: {
      n: 0,
      node: {},
      seen: [],
      boons: boons.map(id => ({ id, left: 2, src: 'test' })),
      rewardN: 0,
      reward: { cards, rolls: 0, from: 'x' },
    },
  });
  for (const k of Object.keys(s.items)) s.items[k] = 0;
  s.collection = C.collectionNew();
  return s;
}
const st = (s, kind, id) => C.collectionRows(s, kind).find(r => r.id === id).st;

test('PK-12 collection: every kind lists the whole data in its order, unseen at first', () => {
  const s = onRun();
  assert.equal(C.collectionRows(s, 'perk').length, Object.keys(PERKS).length);
  assert.equal(C.collectionRows(s, 'set').length, Object.keys(PERK_SETS).length);
  assert.equal(C.collectionRows(s, 'item').length, held.length, 'held items only');
  assert.equal(C.collectionRows(s, 'boon').length, Object.keys(BOONS).length);
  assert.deepEqual(
    C.collectionRows(s, 'perk').map(r => r.id),
    Object.keys(PERKS)
  );
  for (const k of C.COLLECTION_KINDS)
    assert.ok(
      C.collectionRows(s, k).every(r => r.st === 'none'),
      k
    );
  assert.deepEqual(fn('newSave')().collection, { seen: {}, taken: {} }, 'a new save starts empty');
});

test('PK-12 collection: offered Perks are seen, held ones taken; a set seen with one, taken with its bonus on', () => {
  const others = Object.keys(PERKS).filter(k => !office.includes(k));
  const s = onRun({ perks: [office[0]], offer: [others[0], others[1]], shelf: { '3:2': others[2], '4:2': '' } });
  assert.ok(C.collectionNote(s) > 0);
  assert.equal(st(s, 'perk', office[0]), 'taken');
  for (const id of others.slice(0, 3)) assert.equal(st(s, 'perk', id), 'seen', id);
  assert.equal(st(s, 'perk', others[3]), 'none');
  assert.equal(st(s, 'set', 'office'), 'seen', 'one of its Perks held: seen');
  assert.equal(C.collectionNote(s), 0, 'nothing new the second time');
  s.run.perks = office.slice(0, 3);
  C.collectionNote(s);
  assert.equal(st(s, 'set', 'office'), 'taken', 'three held: its bonus was on');
  s.run.perks = [];
  C.collectionNote(s);
  assert.equal(st(s, 'set', 'office'), 'taken', 'it stays taken');
  assert.equal(st(s, 'perk', office[0]), 'taken');
});

test('PK-12 collection: held items from a reward pick (seen), the bag and the team (taken); boons once on', () => {
  const s = onRun({
    cards: [
      { id: 'c1', kind: 'held', item: held[0] },
      { id: 'c2', kind: 'perk', perk: 'lucky_charm' },
    ],
    boons: [boon],
  });
  s.items[held[1]] = 1;
  s.team[0].held = held[2];
  C.collectionNote(s);
  assert.equal(st(s, 'item', held[0]), 'seen');
  assert.equal(st(s, 'item', held[1]), 'taken');
  assert.equal(st(s, 'item', held[2]), 'taken');
  assert.equal(st(s, 'perk', 'lucky_charm'), 'seen', "a reward pick's Perk card");
  assert.equal(st(s, 'boon', boon), 'taken');
  const potion = Object.keys(ITEMS).find(k => !ITEMS[k].hold);
  s.items[potion] = 3;
  C.collectionNote(s);
  assert.ok(!(`item:${potion}` in s.collection.seen), 'a Bag item is not listed');
});

test('PK-12 collection: a stored record is cleaned on load (unknown ids and junk dropped, taken implies seen)', () => {
  const c = C.collectionFill({ seen: { 'perk:nope': 1, 'perk:lucky_charm': 1, x: 2 }, taken: { ['boon:' + boon]: 1 } });
  assert.deepEqual(c, { seen: { 'perk:lucky_charm': 1, ['boon:' + boon]: 1 }, taken: { ['boon:' + boon]: 1 } });
  assert.deepEqual(C.collectionFill(null), { seen: {}, taken: {} });
  assert.deepEqual(C.collectionFill({ seen: [1], taken: 'x' }), { seen: {}, taken: {} });
  const s = startedSave(starter(), 10);
  s.collection = { seen: { 'perk:lucky_charm': 1, 'perk:gone': 1 }, taken: {} };
  const m = fn('saveFill')(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(m.collection, { seen: { 'perk:lucky_charm': 1 }, taken: {} });
  assert.ok(fn('validSave')(JSON.parse(JSON.stringify(s))), 'a save with the record loads');
  delete s.collection;
  assert.ok(fn('validSave')(JSON.parse(JSON.stringify(s))), 'and one without it');
  assert.deepEqual(fn('saveFill')(JSON.parse(JSON.stringify(s))).collection, { seen: {}, taken: {} });
  assert.ok(!fn('validSave')({ ...JSON.parse(JSON.stringify(s)), collection: { seen: [] } }), 'a broken record fails');
});
