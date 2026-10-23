// RL-10: breeding at Copperleaf's ranch on the game's own rules: a bred Billie's mark (a quirk, an abomination's name,
// spike and drawback), what each mode makes, the egg's timer and hatching, and the save's checks.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, fn, modules, reseed, startedSave } from './setup-real.mjs';

const B = GAME_DATA.rules.ranch.breed;

test('breeding: an abomination raises one stat and lowers another by rules.json ranch.breed; its name shows', () => {
  reseed();
  const s = startedSave('musk0', 20),
    m = s.team[0],
    stat = fn('stat'),
    before = { lev: stat(m, 'lev'), hus: stat(m, 'hus'), law: stat(m, 'law') };
  assert.ok(
    Object.values(before).every(v => Number.isInteger(v) && v > 0),
    'real stats'
  );
  m.mut = { k: 'quirk' };
  assert.equal(stat(m, 'lev'), before.lev, 'a quirk changes no stat');
  m.mut = { k: 'abom', name: 'Emberotter', up: 'lev', down: 'hus' };
  assert.equal(stat(m, 'lev'), Math.round(before.lev * B.abomUp));
  assert.equal(stat(m, 'hus'), Math.round(before.hus * B.abomDown));
  assert.equal(stat(m, 'law'), before.law, 'the others as they were');
  assert.equal(fn('billyName')(m), 'Emberotter');
  m.nick = 'Bob';
  assert.equal(fn('billyName')(m), 'Bob', 'a nickname still wins');
});

test('breeding: the save check takes a quirk and a well-formed abomination, and nothing else', () => {
  reseed();
  const s = startedSave('musk0', 10),
    m = s.team[0],
    ok = fn('billiesOk');
  for (const mut of [{ k: 'quirk' }, { k: 'abom', name: 'Emberotter', up: 'lev', down: 'hus' }]) {
    m.mut = mut;
    assert.equal(ok(s.team), true, JSON.stringify(mut));
  }
  for (const mut of [
    'abom',
    { k: 'mutant' },
    { k: 'abom', name: 'X', up: 'lev', down: 'lev' },
    { k: 'abom', name: 'X', up: 'luck', down: 'hus' },
    { k: 'abom', name: '', up: 'lev', down: 'hus' },
    { k: 'abom', name: 'X'.repeat(25), up: 'lev', down: 'hus' },
  ]) {
    m.mut = /** @type {any} */ (mut);
    assert.equal(ok(s.team), false, JSON.stringify(mut));
  }
});

const K = modules.breeding,
  R = GAME_DATA.rules.ranch,
  H = 3600000;

/** a save with the starter on the team, two Billies in storage (a second of its line, one of another) and Scrap */
function breedSave(scrap = 100) {
  reseed();
  const s = startedSave('musk0', 10),
    mate = fn('makeBilly')('musk0', 12, { build: { head: 'S', body: 'L', front: 'M', back: 'S', sig: 'L' } }),
    other = fn('makeBilly')('bezos0', 8);
  s.box.push(mate, other);
  s.meta.scrap = scrap;
  return { s, a: s.team[0], mate, other };
}

test('breeding: nests by ranch level; a pair breeds only at home, two different Billies, one line for safe, a free nest and the Scrap', () => {
  const { s, a, mate, other } = breedSave();
  assert.equal(K.breedNests(s, B), B.nests[0]);
  s.meta.buildings.ranch = 99;
  assert.equal(K.breedNests(s, B), B.nests[B.nests.length - 1], 'past the list: its last');
  s.meta.buildings.ranch = 1;
  assert.equal(K.breedCan(s, a.uid, mate.uid, 'safe', B), '', 'the team and storage both count as home');
  assert.equal(K.breedCan(s, a.uid, other.uid, 'safe', B), 'line', 'safe: one line only');
  assert.equal(K.breedCan(s, a.uid, other.uid, 'risky', B), '', 'risky: any two');
  assert.equal(K.breedCan(s, a.uid, a.uid, 'risky', B), 'same');
  assert.equal(K.breedCan(s, a.uid, 'gone', 'risky', B), 'parent');
  s.meta.scrap = B.riskyCost;
  assert.equal(K.breedCan(s, a.uid, mate.uid, 'safe', B), B.safeCost > B.riskyCost ? 'scrap' : '');
  assert.equal(K.breedCan(s, a.uid, mate.uid, 'risky', B), '');
  s.meta.scrap = 999;
  for (let k = 0; k < B.nests[0]; k++) assert.equal(K.breedStart(s, a.uid, mate.uid, 'safe', 0, B), '');
  assert.equal(K.breedCan(s, a.uid, mate.uid, 'safe', B), 'full');
  const away = breedSave();
  away.s.run = /** @type {any} */ ({});
  assert.equal(K.breedCan(away.s, away.a.uid, away.mate.uid, 'safe', B), 'run', 'the ranch is closed on a run');
});

test('breeding: a safe egg is its line’s first stage at breed.lvl, each part from a parent; the same egg however it is asked', () => {
  const { s, a, mate } = breedSave(),
    before = JSON.stringify([a, mate]),
    { m, out } = K.breedRoll(s, a, mate, 'safe', B);
  assert.equal(out, 'safe');
  assert.equal(m.sp, 'musk0');
  assert.equal(m.lvl, B.lvl);
  assert.equal(m.mut, undefined);
  assert.deepEqual(m.moves, fn('movesAt')('musk', B.lvl));
  const pa = fn('cleanBuild')(a.build),
    pb = fn('cleanBuild')(mate.build);
  for (const k of Object.keys(m.build)) assert.ok([pa[k], pb[k]].includes(m.build[k]), `${k} from a parent`);
  assert.equal(m.hp, fn('maxHp')(m));
  assert.equal(JSON.stringify([a, mate]), before, 'the parents are not changed');
  assert.deepEqual(K.breedRoll(s, mate, a, 'safe', B).m, m, 'either order, the same egg');
  assert.deepEqual(K.breedRoll(s, a, mate, 'safe', B).m, m, 'asked again, the same egg');
  s.ranch.bred = 1;
  assert.notEqual(K.breedRoll(s, a, mate, 'safe', B).m.uid, m.uid, 'the next pair: another egg');
  assert.ok(![a.uid, mate.uid].includes(m.uid));
});

test('breeding: a risky egg is safe, a quirk or an abomination, each well-formed; the save check takes them all', () => {
  const { s, a, other } = breedSave(),
    seen = { safe: 0, quirk: 0, abom: 0 };
  for (let n = 0; n < 300; n++) {
    s.ranch.bred = n;
    const { m, out } = K.breedRoll(s, a, other, 'risky', B);
    seen[out]++;
    assert.ok(['musk0', 'bezos0'].includes(m.sp), 'one parent’s line');
    if (out === 'safe') assert.equal(m.mut, undefined);
    if (out === 'quirk') {
      assert.deepEqual(m.mut, { k: 'quirk' });
      assert.ok(m.moves.length <= GAME_DATA.rules.progression.moveSlots);
    }
    if (out === 'abom') {
      assert.equal(m.mut.k, 'abom');
      assert.ok(
        Object.values(m.build).every(z => z === 'S' || z === 'L'),
        'every part S or L'
      );
      assert.ok(m.mut.name.length > 0 && m.mut.name.length <= 24);
      assert.notEqual(m.mut.up, m.mut.down);
    }
    assert.equal(fn('billiesOk')([m]), true, out);
  }
  assert.ok(seen.safe && seen.quirk && seen.abom, JSON.stringify(seen));
  const q = [...Array(300).keys()]
    .map(n => ((s.ranch.bred = n), K.breedRoll(s, a, other, 'risky', B)))
    .find(x => x.out === 'quirk');
  const parentMoves = new Set([...a.moves, ...other.moves]),
    plain = new Set(fn('movesAt')(fn('speciesOf')(q.m).line, B.lvl));
  assert.ok(
    q.m.moves.some(mv => !plain.has(mv) && parentMoves.has(mv)) || [...parentMoves].every(mv => plain.has(mv)),
    'a quirk knows a parent’s move its line wouldn’t'
  );
  assert.equal(K.breedName('Emberox', 'Cartotter'), 'Embeotter');
});

test('breeding: starting pays and fills a nest; the egg hatches after breed.hours, onto the team or into storage', () => {
  const { s, a, mate } = breedSave(),
    rolled = K.breedRoll(s, a, mate, 'safe', B).m;
  assert.equal(K.breedStart(s, a.uid, mate.uid, 'safe', 1000, B), '');
  assert.equal(s.meta.scrap, 100 - B.safeCost);
  assert.equal(s.ranch.bred, 1);
  const e = s.ranch.nursery[0];
  assert.deepEqual(e.egg, rolled, 'the egg shown before paying');
  assert.equal(e.ready, 1000 + B.hours * H);
  assert.equal(K.breedHatch(s, 0, e.ready - 1), null, 'not before it is ready');
  const hatched = s.hatched || 0,
    got = K.breedHatch(s, 0, e.ready);
  assert.equal(got.where, 'team');
  assert.deepEqual(s.team.at(-1), { ...rolled, met: s.team.at(-1).met });
  assert.equal(s.ranch.nursery.length, 0);
  assert.equal(s.hatched, hatched + 1);
  assert.equal(s.caught.musk0, 1);
  assert.equal(s.team.at(-1).met.n, 'ranch');
  while (s.team.length < GAME_DATA.rules.progression.teamSize) s.team.push(fn('makeBilly')('musk0', 5));
  K.breedStart(s, a.uid, mate.uid, 'safe', 0, B);
  assert.equal(K.breedHatch(s, 0, B.hours * H).where, 'box', 'a full team: storage');
});

test('breeding: an egg’s ready time never moves: a clock turned back only delays it; the parents stay free', () => {
  const { s, a, mate } = breedSave();
  K.breedStart(s, a.uid, mate.uid, 'safe', 10 * H, B);
  const ready = s.ranch.nursery[0].ready;
  assert.equal(K.breedHatch(s, 0, 2 * H), null, 'the clock turned back: not yet');
  assert.equal(s.ranch.nursery[0].ready, ready, 'and its time unchanged, so turning it forward again gains nothing');
  assert.equal(K.breedHatch(s, 0, ready - 1), null);
  assert.equal(K.breedCan(s, a.uid, mate.uid, 'safe', B), B.nests[0] > 1 ? '' : 'full');
  assert.ok(s.box.includes(mate) && s.team.includes(a), 'the parents stay where they are');
  assert.ok(K.breedHatch(s, 0, ready));
});

test('breeding: a save with an egg in the nursery passes the checks and loads with it; a broken egg fails', () => {
  const { s, a, mate } = breedSave();
  K.breedStart(s, a.uid, mate.uid, 'risky', 0, B);
  const copy = () => JSON.parse(JSON.stringify(s));
  assert.equal(fn('validSave')(copy()), true);
  const loaded = fn('saveFill')(copy());
  assert.equal(loaded.ranch.nursery.length, 1);
  assert.equal(loaded.ranch.bred, 1);
  const twin = copy();
  twin.ranch.nursery[0].egg.uid = twin.team[0].uid;
  assert.equal(fn('validSave')(twin), false, 'an egg sharing a uid');
  const bad = copy();
  bad.ranch.nursery[0].egg.lvl = 0;
  assert.equal(fn('validSave')(bad), false, 'an egg that isn’t a Billie');
  const none = copy();
  delete none.ranch.nursery[0].egg;
  assert.equal(fn('validRanch')(none.ranch), false, 'a pair without its egg');
});
