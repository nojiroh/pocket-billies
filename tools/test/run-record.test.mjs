// ON-2 (docs/phases/online-track.md; RL-15): logic/run-record.js, what a finished run leaves for friends: the record
// (shape, size, hostile names, legal Billies only), the ghosts/<uid> document (first daily attempt only, best per
// Expedition, fastest win), the boards' order, and a friend's ghost team (picked from the seed, never a blocked
// player, levels following the node).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { data, fn, modules, reseed, startedSave } from './setup-real.mjs';

const R = modules['run-record'],
  { onlineCopy } = modules['online-legal'],
  { newMeta } = modules['meta-state'],
  { runBegin, validRunGhost } = modules['run-state'],
  makeBilly = fn('makeBilly');
const ME = { u: 'uidME', n: 'Pat' },
  [SP0, SP1] = Object.keys(data.SPECIES),
  DAY = 86400000,
  /* day 20387 (2026-10-26), at noon UTC */
  NOW = 20387 * DAY + DAY / 2;

/** a save on a run that has been somewhere: a path, a clock, a Perk, a leader beaten */
function onRun(board) {
  reseed();
  const s = startedSave(SP0, 12);
  s.team.push(makeBilly(SP1, 9));
  s.meta = newMeta();
  s.run = null;
  const run = runBegin(s, { seed: board ? 'd2026-10-26' : 'REC1234567', expedition: 2, mapgenV: 3, se: 0, items: {} });
  Object.assign(run, { path: [0, 1, 2, 1, 3], clock: 6, perks: ['lucky_coin'], beat: ['marina'], mods: ['noheal'] });
  run.unlocks = ['shop_a', 'biome_b'];
  if (board) run.board = { k: 'd', n: 20387 };
  return s;
}

test('a record: how the run went, the party as online copies, under 8 KB, and it passes its own check', () => {
  const s = onRun(),
    r = R.runRecord(s, s.run, true, ME, 1000);
  assert.equal(r.kind, 'r');
  assert.equal(r.n, 0);
  assert.equal(r.exp, 2);
  assert.equal(r.won, 1);
  assert.equal(r.cleared, 4);
  assert.equal(r.leaders, 1);
  assert.equal(r.days, 6);
  assert.deepEqual(r.mods, ['noheal']);
  assert.deepEqual(r.path, [0, 1, 2, 1, 3]);
  assert.equal(r.party.length, 2);
  assert.deepEqual(r.party[0].ot, { u: 'uidME', n: 'Pat' });
  assert.equal(r.party[0].held, undefined);
  assert.ok(JSON.stringify(r).length <= R.RECORD_MOST);
  assert.equal(R.validRunRecord(r), true);
});

test("a daily's record carries its kind and day", () => {
  const s = onRun(true),
    r = R.runRecord(s, s.run, false, ME, 5);
  assert.equal(r.kind, 'd');
  assert.equal(r.n, 20387);
  assert.equal(R.validRunRecord(r), true);
  assert.equal(R.validRunRecord({ ...r, n: 0 }), false, 'a daily needs its day');
});

test('hostile names are cleaned; a planted name or field fails the check', () => {
  const s = onRun();
  s.team[0].nick = '<img src=x>';
  const r = R.runRecord(s, s.run, true, { u: 'u', n: '<script>alert(1)</script>' }, 1);
  assert.ok(!/[<>]/.test(r.name));
  assert.equal(r.party.length, 2, 'cleaned, not dropped');
  assert.ok(r.party.every(m => !/[<>]/.test(m.nick || '')));
  assert.equal(R.validRunRecord(r), true);
  assert.equal(R.validRunRecord({ ...r, name: '<b>x</b>' }), false);
  assert.equal(R.validRunRecord({ ...r, extra: 1 }), false);
  assert.equal(R.validRunRecord({ ...r, days: 0 }), false);
  assert.equal(R.validRunRecord({ ...r, cleared: 41 }), false);
  assert.equal(R.validRunRecord({ ...r, party: [...r.party, ...r.party, ...r.party, ...r.party] }), false);
  const hacked = JSON.parse(JSON.stringify(r));
  hacked.party[0].lvl = 101;
  assert.equal(R.validRunRecord(hacked), false, 'a Billie the game never makes');
  hacked.party[0].lvl = r.party[0].lvl;
  hacked.party[0].moves = ['not_a_move'];
  assert.equal(R.validRunRecord(hacked), false);
});

test('a record that would pass 8 KB drops the unlocks, then the oldest of the path', () => {
  const s = onRun();
  s.run.unlocks = Array.from(
    { length: 200 },
    (_, i) => 'unlock_with_a_long_name_that_fills_the_record_up_quickly_' + i
  );
  const r = R.runRecord(s, s.run, true, ME, 1);
  assert.deepEqual(r.unlocks, []);
  assert.ok(JSON.stringify(r).length <= R.RECORD_MOST);
});

test('the boards order: won, then places cleared, leaders, fewest days, then who posted first', () => {
  const e = (won, cleared, leaders, days, t) => ({ won, cleared, leaders, days, exp: 1, lead: '', t });
  const rows = [e(0, 9, 3, 5, 1), e(1, 7, 2, 9, 2), e(1, 7, 2, 8, 3), e(1, 8, 1, 20, 4), e(1, 7, 2, 8, 0)];
  assert.deepEqual(
    rows.sort(R.boardOrder).map(x => x.t),
    [4, 0, 3, 2, 1]
  );
  assert.equal(R.boardBetter(null, rows[0]), rows[0]);
  assert.equal(R.boardBetter(rows[0], rows[1]), rows[0]);
});

test('ghosts/<uid>: the last run always; a daily posts its first attempt only; runs keep the best per Expedition and the fastest win', () => {
  const s = onRun(true),
    d1 = R.runRecord(s, s.run, false, ME, 10);
  let doc = R.ghostDocNext(null, d1, 'Pat', NOW);
  assert.equal(doc.day.n, 20387);
  assert.equal(doc.day.e.won, 0);
  /* a second daily the same day (a cheat or a bug) doesn't replace the first */
  doc = R.ghostDocNext(doc, { ...d1, won: 1, t: 11 }, 'Pat', NOW);
  assert.equal(doc.day.e.won, 0);
  assert.equal(JSON.parse(doc.last).won, 1, 'the ghost is still the last run');
  /* the next day's posts */
  doc = R.ghostDocNext(doc, { ...d1, n: 20388, won: 1, t: 12 }, 'Pat', NOW + DAY);
  assert.equal(doc.day.n, 20388);
  /* ordinary runs */
  const t = onRun(),
    r1 = R.runRecord(t, t.run, true, ME, 20);
  doc = R.ghostDocNext(doc, r1, 'Pat', NOW);
  assert.equal(doc.x['2'].won, 1);
  assert.equal(doc.fast.days, 6);
  doc = R.ghostDocNext(doc, { ...r1, won: 0, days: 2, t: 21 }, 'Pat', NOW);
  assert.equal(doc.x['2'].won, 1, 'a loss never beats a win');
  assert.equal(doc.fast.days, 6, 'only wins are fast');
  doc = R.ghostDocNext(doc, { ...r1, days: 4, t: 22 }, 'Pat', NOW);
  assert.equal(doc.fast.days, 4);
  assert.equal(doc.x['2'].days, 4);
  /* read back as a friend reads it */
  const read = R.ghostDocRead(doc);
  assert.equal(read.name, 'Pat');
  assert.equal(read.last.days, 4);
  assert.equal(read.day.n, 20388);
  /* a daily that waited offline for days keeps only its ghost */
  const late = R.ghostDocNext(doc, { ...d1, n: 20389, t: 30 }, 'Pat', NOW + 5 * DAY);
  assert.equal(late.day.n, 20388);
  assert.equal(JSON.parse(late.last).n, 20389);
});

test("a friend's document that fails a check is read without that part", () => {
  const s = onRun(),
    doc = R.ghostDocNext(null, R.runRecord(s, s.run, true, ME, 1), '<i>Pat</i>', NOW);
  assert.equal(doc.name, 'iPat/i');
  const bad = { ...doc, last: '{"v":1', x: { 2: { won: 7 }, z: doc.x['2'] }, fast: { days: 0 } };
  const read = R.ghostDocRead(bad);
  assert.equal(read.last, null);
  assert.deepEqual(read.x, {});
  assert.equal(read.fast, null);
  assert.deepEqual(R.ghostDocRead(null).x, {});
});

test('boardRows: one board from everyone, mine among them, best first', () => {
  const e = (won, cleared, days, t) => ({ won, cleared, leaders: 0, days, exp: 1, lead: '', t });
  const docs = [
    {
      u: 'a',
      doc: R.ghostDocRead({ name: 'A', day: { n: 5, e: e(0, 4, 3, 1) }, x: { 1: e(1, 9, 9, 1) }, fast: e(1, 9, 9, 1) }),
    },
    { u: 'b', doc: R.ghostDocRead({ name: 'B', day: { n: 5, e: e(1, 9, 8, 2) }, x: {}, fast: e(1, 9, 7, 2) }) },
    { u: 'c', doc: R.ghostDocRead({ name: 'C', day: { n: 4, e: e(1, 9, 1, 0) }, x: {} }) },
  ];
  assert.deepEqual(
    R.boardRows(docs, 'day', 5).map(r => r.u),
    ['b', 'a']
  );
  assert.deepEqual(
    R.boardRows(docs, 'x1').map(r => r.u),
    ['a']
  );
  assert.deepEqual(
    R.boardRows(docs, 'fast').map(r => r.u),
    ['b', 'a']
  );
  assert.deepEqual(R.boardRows(docs, 'week', 5), []);
});

test('a ghost: picked from the seed among friends with a party, never a blocked one; its levels follow the node', () => {
  const s = onRun(),
    doc = R.ghostDocRead(R.ghostDocNext(null, R.runRecord(s, s.run, true, ME, 1), 'Pat', NOW)),
    docs = ['x', 'y', 'z'].map(u => ({ u, doc })),
    G = R.ghostPick(docs, 'SEED000001', []);
  assert.ok(G && ['x', 'y', 'z'].includes(G.u));
  assert.deepEqual(R.ghostPick(docs.slice().reverse(), 'SEED000001', []), G, 'the same friends, the same pick');
  assert.equal(R.ghostPick(docs, 'SEED000001', ['x', 'y', 'z']), null);
  assert.equal(R.ghostPick([{ u: 'q', doc: R.ghostDocRead(null) }], 'S', []), null, 'no record, no ghost');
  assert.equal(validRunGhost(G), true);
  assert.equal(validRunGhost({ ...G, party: [] }), false);
  assert.equal(validRunGhost({ ...G, extra: 1 }), false);
  const team = modules.rival.ghostTeam(G.party, 30),
    high = Math.max(...G.party.map(m => m.lvl));
  assert.equal(Math.max(...team.map(e => e.lvl)), 30);
  team.forEach((e, k) => assert.equal(e.lvl, Math.max(1, Math.round((30 * G.party[k].lvl) / high))));
  assert.equal(team[0].whole, G.party[0]);
});

test('onlineCopy and the record agree: a robot never goes into a record', () => {
  const s = onRun();
  s.team.push({ ...onlineCopy(s.team[0]), kind: 'robot' });
  const r = R.runRecord(s, s.run, true, ME, 1);
  assert.equal(r.party.length, 2);
});
