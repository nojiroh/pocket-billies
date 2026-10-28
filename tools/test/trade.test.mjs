// ON-4 (docs/phases/online-track.md): friend trades' pure parts (game/js/logic/trade.js) on the game's own data. The
// offer's steps as the rules allow them (offerPatch is firebase/firestore.rules' twin: the same cheats are refused
// as in firebase/test/offers.test.mjs), what may go (never during a run, never the team's last, a week's cooldown
// after a trade, no robots, ready eggs, spare parts), a whole trade on two saves applied once each however often
// it's run again, a refused give that comes back, ribbons travelling with a Billie, the save's trade history.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { data, fn, GAME_DATA, modules, reseed, startedSave } from './setup-real.mjs';

const T = modules.trade,
  M = modules['meta-state'],
  makeBilly = fn('makeBilly'),
  validSave = fn('validSave'),
  { SPECIES } = data,
  NOW = 1_800_000_000_000,
  DAY = 86400e3,
  B = GAME_DATA.rules.ranch.breed,
  PART = Object.keys(GAME_DATA.robots.parts)[0],
  ann = { u: 'ann', n: 'Ann' },
  bob = { u: 'bob', n: 'Bob' };
const sp0 = Object.keys(SPECIES)[0];

/* a save with a team of two, two in storage (one in a pen, one training), a ready egg, an egg still warm, a part */
function saveOf(tag) {
  reseed();
  const s = startedSave(sp0, 20);
  s.team[0].uid = tag + '-t0';
  const t1 = makeBilly(sp0, 12);
  t1.uid = tag + '-t1';
  t1.held = 'potion';
  s.team.push(t1);
  for (const n of [0, 1]) {
    const m = makeBilly(sp0, 15);
    m.uid = `${tag}-b${n}`;
    s.box.push(m);
  }
  s.ranch.pens.push(tag + '-b0');
  s.ranch.trainees.push({ uid: tag + '-b1', at: 5 });
  const egg = (uid, ready) => {
    const e = makeBilly(sp0, B.lvl);
    e.uid = uid;
    return { a: tag + '-t0', b: tag + '-t1', mode: 'safe', at: ready - B.hours * 3600e3, ready, egg: e };
  };
  s.ranch.nursery.push(egg(tag + '-e0', NOW - 1), egg(tag + '-e1', NOW + DAY));
  s.parts.push({ uid: tag + '-p0', id: PART, up: 0 });
  return s;
}
/* the offer both games read: Ann opens it, Bob fills his side, both ok */
function lockedOffer(sa, sb) {
  const ga = [
    T.tradeThing(sa, 'b', 'ann-t1', ann, NOW),
    T.tradeThing(sa, 'e', 'ann-e0', ann, NOW),
    T.tradeThing(sa, 'p', 'ann-p0', ann, NOW),
  ];
  let o = T.offerNew('ann', 'Ann', 'bob', ga, 'k1');
  const step = (who, s, arg) => {
    const p = T.offerPatch(o, who, s, arg);
    assert.equal(typeof p, 'object', `${who} ${s}: ${p}`);
    o = { ...o, ...p };
  };
  step('bob', 'give', { give: [T.tradeThing(sb, 'b', 'bob-b0', bob, NOW)], name: 'Bob' });
  step('ann', 'ok');
  step('bob', 'ok');
  return { o, step: (who, s, arg) => (step(who, s, arg), o), get: () => o };
}

test('the offer: one per pair, the smaller uid first; my side filled, the other empty, version 1', () => {
  assert.equal(T.offerId('bob', 'ann'), 'ann_bob');
  assert.equal(T.offerId('ann', 'bob'), 'ann_bob');
  const o = T.offerNew('bob', 'Bob', 'ann', [{ k: 'p', d: '{}' }], 'k9');
  assert.deepEqual(
    [o.a, o.b, o.na, o.nb, o.ga.length, o.gb.length, o.v, o.k],
    ['ann', 'bob', '', 'Bob', 0, 1, 1, 'k9']
  );
  assert.equal(T.offerSide(o, 'ann'), 'a');
  assert.equal(T.offerSide(o, 'cat'), '');
  assert.equal(T.offerNew('ann', 'Ann', 'bob', [1, 2, 3, 4], 'k'), null);
  assert.equal(T.tradeKey(o), 'ann_bob:k9');
});

test('offerPatch refuses what the rules refuse (the emulator cheat suite, in Node)', () => {
  const sa = saveOf('ann'),
    sb = saveOf('bob'),
    L = lockedOffer(sa, sb);
  let o = L.get();
  assert.equal(T.offerNext(o, 'ann', NOW), 'give');
  assert.equal(T.offerPatch(o, 'cat', 'ok'), 'party');
  /* a give change moves the version, so both oks are on the old one */
  const moved = { ...o, ...T.offerPatch(o, 'bob', 'give', { give: o.gb }) };
  assert.equal(moved.v, o.v + 1);
  assert.equal(T.offerNext(moved, 'ann', NOW), 'edit');
  assert.equal(T.offerPatch(moved, 'ann', 'gave', { now: NOW }), 'open');
  assert.equal(T.offerPatch(o, 'bob', 'give', { give: [1, 2, 3, 4] }), 'cap');
  assert.equal(T.offerPatch(o, 'bob', 'give', { give: [{ k: 'robot', d: '{}' }] }), 'shape');
  /* receiving before both gave */
  assert.equal(T.offerPatch(o, 'ann', 'got'), 'early');
  assert.equal(T.offerPatch(o, 'ann', 'refuse'), 'late');
  o = L.step('ann', 'gave', { now: NOW });
  assert.equal(T.offerPatch(o, 'ann', 'gave', { now: NOW }), 'twice');
  assert.equal(T.offerPatch(o, 'bob', 'give', { give: [] }), 'locked');
  assert.equal(T.offerPatch(o, 'bob', 'unok'), 'locked');
  assert.equal(T.offerPatch(o, 'bob', 'cancel'), 'locked');
  assert.equal(T.offerNext(o, 'ann', NOW), 'wait');
  assert.equal(T.offerNext(o, 'bob', NOW), 'give');
  assert.equal(T.offerPatch(o, 'ann', 'stale', { now: NOW + DAY }), 'early');
  assert.equal(T.offerNext(o, 'ann', NOW + 8 * DAY), 'stale');
  o = L.step('bob', 'gave', { now: NOW });
  assert.equal(T.offerNext(o, 'ann', NOW), 'take');
  assert.equal(T.offerPatch(o, 'ann', 'stale', { now: NOW + 8 * DAY }), 'late');
  o = L.step('bob', 'got');
  /* Bob has Ann's things: nobody refuses now */
  assert.equal(T.offerPatch(o, 'ann', 'refuse'), 'late');
  assert.equal(T.offerPatch(o, 'bob', 'refuse'), 'late');
  assert.equal(T.offerGone(o), false);
  o = L.step('ann', 'got');
  assert.equal(T.offerNext(o, 'ann', NOW), 'done');
  assert.equal(T.offerGone(o), true);
});

test('what may go: not during a run, not the team’s last, not within a week of a trade, no robot, ready eggs, spare parts', () => {
  const s = saveOf('ann');
  assert.equal(T.tradeWhyNot(s, 'b', 'ann-t0', NOW), '');
  assert.equal(T.tradeWhyNot(s, 'b', 'nope', NOW), 'missing');
  assert.equal(T.tradeWhyNot(s, 'e', 'ann-e0', NOW), '');
  assert.equal(T.tradeWhyNot(s, 'e', 'ann-e1', NOW), 'egg');
  assert.equal(T.tradeWhyNot(s, 'p', 'ann-p0', NOW), '');
  s.box[0].traded = { at: NOW - DAY, from: 'bob' };
  assert.equal(T.tradeWhyNot(s, 'b', 'ann-b0', NOW), 'cooldown');
  assert.equal(T.tradeWhyNot(s, 'b', 'ann-b0', NOW + 7 * DAY), '');
  s.box[1].kind = 'robot';
  assert.equal(T.tradeWhyNot(s, 'b', 'ann-b1', NOW), 'robot');
  s.team.pop();
  assert.equal(T.tradeWhyNot(s, 'b', 'ann-t0', NOW), 'last');
  s.run = /** @type {any} */ ({});
  assert.equal(T.tradeWhyNot(s, 'p', 'ann-p0', NOW), 'run');
  assert.equal(T.tradeThing(s, 'p', 'ann-p0', ann, NOW), null);
});

test('a whole trade on two saves: what went is gone, what came is there, once however often it runs', () => {
  const sa = saveOf('ann'),
    sb = saveOf('bob'),
    L = lockedOffer(sa, sb);
  assert.equal(T.tradeLegal(L.get().ga), '');
  assert.equal(T.tradeLegal(L.get().gb), '');
  /* Ann gives: her Billie (its held item stays in her bag), the ready egg, the part */
  const potions = sa.items.potion;
  assert.equal(T.tradeGive(sa, L.step('ann', 'gave', { now: NOW }), 'ann', NOW), true);
  assert.equal(T.tradeGive(sa, L.get(), 'ann', NOW), false, 'a second run does nothing');
  assert.equal(sa.items.potion, potions + 1);
  assert.ok(!sa.team.some(m => m.uid === 'ann-t1'));
  assert.ok(!sa.ranch.nursery.some(n => n.egg.uid === 'ann-e0'));
  assert.ok(!sa.parts.some(p => p.uid === 'ann-p0'));
  assert.equal(sa.meta.trades[0].st, 'gave');
  assert.ok(validSave(JSON.parse(JSON.stringify(sa))));
  /* Bob gives his pen Billie: out of the pen too */
  T.tradeGive(sb, L.step('bob', 'gave', { now: NOW }), 'bob', NOW);
  assert.ok(!sb.box.some(m => m.uid === 'bob-b0'));
  assert.ok(!sb.ranch.pens.includes('bob-b0'));
  /* Bob receives */
  const came = T.tradeTake(sb, L.get(), 'bob', NOW + 5);
  assert.equal(came.length, 1);
  assert.deepEqual(came[0].traded, { at: NOW + 5, from: 'ann' });
  assert.deepEqual(came[0].ot, { u: 'ann', n: 'Ann' });
  assert.equal(came[0].held, undefined);
  assert.ok(sb.box.includes(came[0]));
  assert.ok(sb.ranch.nursery.some(n => n.egg.uid === 'ann-e0' && n.egg.ot === undefined && !n.egg.traded));
  assert.ok(sb.parts.some(p => p.uid === 'ann-p0'));
  assert.equal(T.tradeTake(sb, L.get(), 'bob', NOW + 5), 'twice');
  assert.equal(sb.box.filter(m => m.uid === 'ann-t1').length, 1);
  const r = sb.meta.trades[0];
  assert.deepEqual([r.k, r.u, r.n, r.st, r.gave.length, r.got.length], ['ann_bob:k1', 'ann', 'Ann', 'done', 1, 3]);
  assert.ok(M.validMeta(sb.meta));
  assert.ok(validSave(JSON.parse(JSON.stringify(sb))));
  /* the traded Billie waits a week before it can go again */
  assert.equal(T.tradeWhyNot(sb, 'b', 'ann-t1', NOW + DAY), 'cooldown');
  /* Ann receives Bob's */
  T.tradeTake(sa, L.step('bob', 'got'), 'ann', NOW + 9);
  assert.ok(sa.box.some(m => m.uid === 'bob-b0' && m.traded.from === 'bob'));
  assert.deepEqual(sa.meta.trades[0].got, [{ k: 'b', sp: sp0, lvl: 15 }]);
});

test('a uid the receiver already has gets a new one (worn parts too)', () => {
  const sa = saveOf('ann'),
    sb = saveOf('ann'),
    L = lockedOffer(sa, saveOf('bob'));
  let n = 0;
  T.tradeTake(sb, { ...L.get(), gb: L.get().ga, b: 'bob' }, 'bob', NOW, () => 'new' + n++);
  const uids = [...sb.team, ...sb.box].map(m => m.uid);
  assert.equal(new Set(uids).size, uids.length);
  assert.ok(sb.parts.some(p => p.uid.startsWith('new')));
});

test('a refused give: what fails the check stops it whole, and the giver takes theirs back once', () => {
  const sa = saveOf('ann'),
    sb = saveOf('bob'),
    L = lockedOffer(sa, sb);
  const hacked = JSON.parse(L.get().ga[0].d);
  hacked.lvl = 999;
  const o = { ...L.get(), ga: [L.get().ga[1], { k: 'b', d: JSON.stringify(hacked) }] };
  assert.equal(T.tradeLegal(o.ga), 'level');
  T.tradeGive(sa, { ...o, da: true }, 'ann', NOW);
  const before = sb.box.length;
  assert.equal(T.tradeTake(sb, o, 'bob', NOW), 'level');
  assert.equal(sb.box.length, before);
  assert.equal(sb.ranch.nursery.length, 2, 'not even the legal egg came');
  const closed = { ...o, da: true, ...T.offerPatch({ ...o, da: true }, 'bob', 'refuse') };
  assert.equal(closed.x, 'refused');
  assert.equal(T.offerNext(closed, 'ann', NOW), 'back');
  /* the hacked one can't come back either: Ann's own legal things only are what she gave */
  const mine = { ...closed, ga: L.get().ga };
  const eggs = sa.ranch.nursery.length;
  assert.equal(T.tradeBack(sa, mine, 'ann', NOW), true);
  assert.equal(T.tradeBack(sa, mine, 'ann', NOW), false);
  assert.equal(sa.ranch.nursery.length, eggs + 1);
  assert.ok(sa.box.some(m => m.uid === 'ann-t1' && !m.traded));
  assert.equal(sa.meta.trades[0].st, 'back');
  assert.equal(T.offerGone({ ...closed, ka: true }), true);
});

test('ribbons travel with a Billie; a broken one is refused', () => {
  const m = makeBilly(sp0, 20);
  m.ribbons = [{ w: 2900, th: 'abom', p: 0 }];
  const c = modules['online-legal'].onlineCopy(m, ann);
  assert.deepEqual(c.ribbons, m.ribbons);
  assert.equal(modules['online-legal'].legalBilly(c), '');
  c.ribbons = [{ w: 'x', th: 'abom', p: 0 }];
  assert.equal(modules['online-legal'].legalBilly(c), 'ribbons');
});

test('the save’s trade history: newest first, at most 20, checked on load; a broken one is dropped alone', () => {
  const s = saveOf('ann');
  for (let i = 0; i < 25; i++) {
    const o = { ...T.offerNew('ann', 'Ann', 'bob', [], 'k' + i), nb: 'Bob' };
    T.tradeGive(s, o, 'ann', NOW + i);
  }
  assert.equal(s.meta.trades.length, 20);
  assert.equal(s.meta.trades[0].k, 'ann_bob:k24');
  assert.ok(M.validMeta(s.meta));
  assert.equal(M.validTrades([{ k: 'x', at: 1, u: 'u', n: 'n', st: 'stolen', gave: [], got: [] }]), false);
  const filled = M.metaFill({ ...s.meta, trades: [{ bad: 1 }] });
  assert.deepEqual(filled.trades, []);
  assert.equal(filled.runs, s.meta.runs);
});
