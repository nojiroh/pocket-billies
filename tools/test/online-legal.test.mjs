// ON-1 (docs/phases/online-track.md): the legality check before anything goes online (game/js/logic/online-legal.js),
// on the game's own data: every species as the game makes it passes, at the levels a save holds; hand-made cheats
// (a stat the game never makes, a move no tutor teaches, a hidden field) are named.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { data, fn, GAME_DATA, modules, reseed, startedSave } from './setup-real.mjs';

const L = modules['online-legal'],
  makeBilly = fn('makeBilly'),
  { SPECIES, MOVES, LINE_BY_ID } = data;
const copy = m => L.onlineCopy(m);
const one = () => copy(makeBilly(Object.keys(SPECIES)[0], 20, { wild: true }));

test('every species, caught wild or given at the levels a save holds, is legal online', () => {
  reseed();
  const bad = [];
  for (const sp of Object.keys(SPECIES))
    for (const lvl of [1, 5, 37, 100]) {
      const why = L.legalBilly(copy(makeBilly(sp, lvl, { wild: lvl !== 1 })));
      if (why) bad.push(`${sp} Lv${lvl}: ${why}`);
    }
  assert.deepEqual(bad, []);
});

test('what goes online: no held item, full HP, no status, the XP of its level, no battle-only fields', () => {
  const m = makeBilly(Object.keys(SPECIES)[0], 12);
  Object.assign(m, { held: 'x', hp: 1, status: 'psn', sTurns: 3, xp: m.xp + 5, boss: { hp: 3, st: 2 }, wins: 9 });
  const c = copy(m);
  assert.equal(c.held, undefined);
  assert.equal(c.boss, undefined);
  assert.equal(c.wins, undefined);
  assert.equal(c.status, null);
  assert.equal(c.hp, fn('maxHp')(c));
  assert.equal(c.xp, fn('xpFor')(12));
  assert.equal(L.onlineCopy({ ...m, kind: 'robot' }), null);
  assert.equal(L.legalBilly(c), '');
});

test('cheats on level, HP and hidden fields are named', () => {
  const max = GAME_DATA.rules.progression.maxLevel;
  assert.equal(L.legalBilly({ ...one(), lvl: max + 1 }), 'level');
  assert.equal(L.legalBilly({ ...one(), lvl: 0 }), 'level');
  assert.equal(L.legalBilly({ ...one(), xp: 0 }), 'xp');
  assert.equal(L.legalBilly({ ...one(), hp: 99999 }), 'hp');
  assert.equal(L.legalBilly({ ...one(), boss: { hp: 9, st: 9 } }), 'keys');
  assert.equal(L.legalBilly({ ...one(), sp: 'nobody' }), 'species');
  assert.equal(L.legalBilly({ ...one(), sp: '__proto__' }), 'species');
  assert.equal(L.legalBilly({ ...one(), kind: 'robot' }), 'robot');
  assert.equal(L.legalBilly({ ...one(), nick: '<b>hi</b>' }), 'nick');
  assert.equal(L.legalBilly({ ...one(), status: 'nope' }), 'status');
  assert.equal(L.legalBilly(null), 'shape');
});

test('moves: the line’s and its types’ tutors pass; one no tutor teaches, a fifth, a repeat do not', () => {
  const m = one(),
    S = SPECIES[m.sp],
    own = LINE_BY_ID[S.line].learn.map(([, mv]) => mv);
  /* a move of its line above its level (a tutor) */
  assert.equal(L.legalBilly({ ...m, moves: [own[own.length - 1]] }), '');
  const stranger = Object.keys(MOVES).find(k => !S.types.includes(MOVES[k].t) && !own.includes(k));
  assert.ok(stranger, 'a move of another type');
  assert.equal(L.legalBilly({ ...m, moves: [stranger] }), 'moves');
  /* a quirk egg may bring one from the other parent, if some line learns it */
  const learned = new Set(GAME_DATA.lines.flatMap(l => l.learn.map(([, mv]) => mv))),
    parentMove = Object.keys(MOVES).find(k => learned.has(k) && !S.types.includes(MOVES[k].t) && !own.includes(k));
  if (parentMove) {
    assert.equal(L.legalBilly({ ...m, mut: { k: 'quirk' }, moves: [own[0], parentMove] }), '');
    assert.equal(L.legalBilly({ ...m, mut: { k: 'quirk' }, moves: [parentMove, stranger] }), 'moves');
  }
  assert.equal(L.legalBilly({ ...m, moves: [own[0], own[0]] }), 'moves');
  assert.equal(L.legalBilly({ ...m, moves: [] }), 'moves');
  assert.equal(L.legalBilly({ ...m, moves: Array(5).fill(own[0]) }), 'moves');
});

test('sizes, coats and an abomination’s mark are the game’s', () => {
  const m = one(),
    slots = GAME_DATA.rules.parts.slots,
    all = size => Object.fromEntries(slots.map(k => [k, size]));
  assert.equal(L.legalBilly({ ...m, build: { ...all('M'), head: 'XL' } }), 'build');
  assert.equal(L.legalBilly({ ...m, coat: 'nope' }), 'coat');
  const formCoat = Object.keys(GAME_DATA.coats).find(c => GAME_DATA.coats[c].form);
  if (formCoat && SPECIES[m.sp].coat !== formCoat) assert.equal(L.legalBilly({ ...m, coat: formCoat }), 'coat');
  const [up, down] = GAME_DATA.stats.map(t => t.id).slice(1, 3),
    abom = { k: 'abom', name: 'Muskzuck', up, down };
  const big = { ...m, build: all('L'), mut: abom };
  big.hp = fn('maxHp')(big);
  assert.equal(L.legalBilly(big), '');
  assert.equal(L.legalBilly({ ...big, build: all('M') }), 'build');
  assert.equal(L.legalBilly({ ...big, mut: { ...abom, down: up } }), 'mark');
  assert.equal(L.legalBilly({ ...big, mut: { k: 'super' } }), 'mark');
});

test('splices: a real one passes; a made-up gene, or Unstable with no splice, does not', () => {
  const m = copy(makeBilly('swift0', 20)),
    s = { ...m, graft: { front: 'eagle_wing@hughes2' } };
  s.hp = fn('maxHp')(s);
  assert.equal(L.legalBilly(s), '');
  assert.equal(L.legalBilly({ ...m, graft: { front: 'laser@nobody' } }), 'splice');
  assert.equal(L.legalBilly({ ...m, unstable: { up: 'lev', down: 'law', name: 'X' } }), 'unstable');
});

test('robot parts and eggs', () => {
  const id = Object.keys(GAME_DATA.robots.parts)[0],
    most = GAME_DATA.rules.robots.maxUpgrade;
  assert.equal(L.legalPart({ uid: 'p1', id, up: 0 }), '');
  assert.equal(L.legalPart({ uid: 'p1', id, up: most + 1 }), 'upgrade');
  assert.equal(L.legalPart({ uid: 'p1', id: 'nope', up: 0 }), 'part');
  assert.equal(L.legalPart({ uid: 'p1', id, up: 0, extra: 1 }), 'shape');
  const B = GAME_DATA.rules.ranch.breed,
    egg = copy(makeBilly(Object.keys(SPECIES)[0], B.lvl)),
    n = { a: 'x', b: 'y', mode: 'safe', at: 1000, ready: 1000 + B.hours * 3600e3, egg };
  assert.equal(L.legalEgg(n), '');
  assert.equal(L.legalEgg({ ...n, ready: n.at + 1e12 }), 'time');
  assert.equal(L.legalEgg({ ...n, egg: copy(makeBilly(Object.keys(SPECIES)[0], B.lvl + 3)) }), 'level');
  assert.equal(L.legalEgg({ ...n, egg: { ...egg, mut: { k: 'quirk' } } }), 'mark');
  assert.equal(L.legalEgg({ ...n, mode: 'odd' }), 'mode');
});

test('every egg the ranch makes, safe or risky (quirks and abominations), is legal online', () => {
  const K = modules.breeding,
    BR = GAME_DATA.rules.ranch.breed,
    s = startedSave(Object.keys(SPECIES)[0], 10),
    sps = Object.keys(SPECIES).filter(k => SPECIES[k].stage === 0),
    seen = new Set(),
    bad = [];
  for (let k = 0; k < 200; k++) {
    const A = makeBilly(sps[k % sps.length], 30, { wild: true }),
      B = makeBilly(sps[(k * 7 + 3) % sps.length], 30, { wild: true });
    A.uid = 'a' + k;
    B.uid = 'b' + k;
    const { m, out } = K.breedRoll(s, A, B, 'risky', BR);
    seen.add(out);
    const why = L.legalEgg({ a: A.uid, b: B.uid, mode: 'risky', at: 0, ready: BR.hours * 3600e3, egg: copy(m) });
    if (why) bad.push(`${out} ${m.sp}: ${why}`);
  }
  assert.deepEqual(bad, []);
  assert.ok(seen.has('quirk') && seen.has('abom'), [...seen].join());
});

test('the original trainer: stamped once, kept wherever it goes; the save refuses a bad mark', () => {
  const m = makeBilly(Object.keys(SPECIES)[0], 9),
    c = L.onlineCopy(m, { u: 'uid-a', n: 'Ana<' });
  assert.deepEqual(c.ot, { u: 'uid-a', n: 'Ana' });
  assert.deepEqual(L.onlineCopy(c, { u: 'uid-b', n: 'Ben' }).ot, { u: 'uid-a', n: 'Ana' }, 'traded on: still Ana’s');
  assert.equal(L.onlineCopy(m).ot, undefined, 'none without a trainer');
  assert.equal(L.legalBilly(c), '');
  assert.equal(L.legalBilly({ ...c, traded: { at: 5, from: 'uid-a' } }), '');
  const billiesOk = fn('billiesOk');
  assert.equal(billiesOk([{ ...m, ot: { u: 'x', n: 7 } }]), false);
  assert.equal(billiesOk([{ ...m, traded: { at: -1, from: 'x' } }]), false);
  assert.equal(billiesOk([{ ...m, ot: { u: 'x', n: 'Ana' }, traded: { at: 1, from: 'x' } }]), true);
  assert.equal(L.legalBilly({ ...c, ot: { u: 'x', n: 7 } }), 'trainer');
  assert.equal(L.legalBilly({ ...c, partDmg: 1 }), 'keys');
});
