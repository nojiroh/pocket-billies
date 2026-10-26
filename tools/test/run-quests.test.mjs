// TW-3: logic/run-quests.js, a run's quests on the game's own data: the same offers for the same run, only what can be
// finished and handed in on this run, each kind's progress, the cap of three, a parcel only to a later town, the board
// takes a done quest at any town but its own and once only, a reload keeps them (validRun), the run's end clears them.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fn, GAME_DATA, hooks, modules, reseed } from './setup-real.mjs';

const Q = modules['run-quests'],
  RS = modules['run-state'],
  { runStartOn, runStartPlan } = modules['run-start'],
  { runUnlocks } = modules.unlocks,
  { runRouteTrainers } = modules['route-trainers'],
  QD = GAME_DATA.quests,
  RUN = GAME_DATA.rules.run,
  UNLOCK_DATA = { unlocks: GAME_DATA.unlocks, buildings: GAME_DATA.buildings },
  DATA = {
    nodeTypes: GAME_DATA.nodeTypes,
    biomes: GAME_DATA.biomes,
    pools: GAME_DATA.pools,
    scenery: GAME_DATA.scenery,
    rules: RUN,
    unlockData: UNLOCK_DATA,
    region: modules['run-region'].runRegionData(GAME_DATA, GAME_DATA.trainers),
  };

function start(seed) {
  reseed(1);
  const s = fn('newSave')();
  s.started = true;
  s.starter = GAME_DATA.rules.start.starters[0];
  s.team.push(fn('makeBilly')(s.starter + '0', 12));
  hooks.provide({ saveData: s });
  runStartOn(s, runStartPlan(seed, DATA, { unlocks: runUnlocks(s, UNLOCK_DATA) }), { home: [s.team[0].uid] });
  return s;
}
/** the quest data of a run: every town has a board (the scenes' own boards are mapgen-town.test.mjs's) */
function qdata(run, boards) {
  const T = runRouteTrainers(run, { classes: GAME_DATA.events.classes, species: hooks.SPECIES, rules: RUN }),
    at = {};
  for (const t of Object.values(T)) at[t.runNode] = (at[t.runNode] || 0) + 1;
  return {
    quests: QD,
    species: hooks.SPECIES,
    boards: boards || run.map.nodes.flatMap((n, i) => (n.type === 'town' ? [i] : [])),
    trainersAt: i => at[i] || 0,
  };
}
const towns = run => run.map.nodes.flatMap((n, i) => (n.type === 'town' ? [i] : []));
const SEEDS = Array.from({ length: 40 }, (_, k) => 'QUEST' + k.toString(36).toUpperCase().padStart(5, '0'));

test('run quests: the same run offers the same, only in a town with a board, and every kind turns up', () => {
  const kinds = new Set();
  for (const seed of SEEDS) {
    const run = start(seed).run,
      D = qdata(run);
    for (const [i, n] of run.map.nodes.entries()) {
      const o = Q.questOffer(run, i, D);
      if (n.type !== 'town') assert.equal(o, null, 'only a town offers');
      if (!o) continue;
      kinds.add(o.kind);
      assert.deepEqual(Q.questOffer(start(seed).run, i, qdata(start(seed).run)), o, 'the same run, the same offer');
      assert.equal(Q.questOffer(run, i, { ...D, boards: D.boards.filter(j => j !== i) }), null, 'no board, no offer');
      const R = QD.kinds[o.kind];
      assert.ok(o.goal >= R.goal[0] && o.goal <= R.goal[1], 'the goal in its range');
      assert.ok(
        QD.texts.some(t => t.id === o.text && t.kind === o.kind),
        'a text of its kind'
      );
      if (o.kind === 'catch') assert.ok(run.region.dex.some(sp => hooks.SPECIES[sp].types.includes(o.type)));
    }
  }
  assert.deepEqual([...kinds].sort(), ['catch', 'miniboss', 'parcel', 'trainers']);
});

test('run quests: nothing is offered that can’t be finished and handed in on this run', () => {
  for (const seed of SEEDS) {
    const run = start(seed).run,
      map = run.map,
      D = qdata(run),
      T = towns(run),
      reach = i => {
        const seen = new Set(),
          todo = [...map.nodes[i].to];
        while (todo.length) {
          const j = todo.pop();
          if (!seen.has(j)) (seen.add(j), todo.push(...map.nodes[j].to));
        }
        return seen;
      };
    for (const i of T) {
      const o = Q.questOffer(run, i, D);
      const later = T.filter(j => reach(i).has(j));
      if (!later.length) assert.equal(o, null, `town ${i}: no town ahead, no quest`);
      if (!o) continue;
      if (o.kind === 'miniboss')
        assert.ok([...reach(i)].some(m => map.nodes[m].type === 'miniboss' && T.some(j => reach(m).has(j))));
      if (o.kind === 'trainers') {
        const most = j =>
          D.trainersAt(j) + Math.max(T.includes(j) ? 0 : -99, ...map.nodes[j].to.map(most).concat([-99]));
        assert.ok(Math.max(...map.nodes[i].to.map(most)) >= o.goal, `town ${i}: ${o.goal} trainers can be met`);
      }
    }
    /* the last town on every way has nothing to offer */
    const last = T.filter(i => !T.some(j => reach(i).has(j)));
    for (const i of last) assert.equal(Q.questOffer(run, i, D), null);
  }
});

test('run quests: each kind’s progress; a mini-boss quest fails on a faint; a parcel only to a later town', () => {
  const run = start(SEEDS[0]).run,
    T = towns(run),
    at = T[0],
    /* a town's offer is taken once, so each quest here comes from a made-up town number */
    as = (kind, i, more) =>
      Q.questTake(run, i, { kind, text: QD.texts.find(t => t.kind === kind).id, goal: 1, ...more }, QD);
  const c = as('catch', 60, { type: 'Water' });
  assert.equal(Q.questCatch(run, ['Fire']).length, 0, 'another type');
  assert.deepEqual(Q.questCatch(run, ['Grass', 'Water']), [c]);
  assert.equal(c.done, 1);
  const t = as('trainers', 61, { goal: 2 });
  assert.equal(Q.questWin(run, 'event', false).done.length, 0, 'an event foe isn’t a route trainer');
  Q.questWin(run, 'route', false);
  assert.deepEqual([t.n, t.done], [1, 0]);
  assert.deepEqual(Q.questWin(run, 'route', false).done, [t]);
  as('parcel', 62);
  assert.equal(as('parcel', 63), null, 'three held: no more');
  assert.equal(as('parcel', 62), null, 'a town’s offer is taken once');
  Q.questPay(run, c);
  Q.questPay(run, t);
  const m = as('miniboss', 63);
  assert.deepEqual(Q.questWin(run, 'miniboss', true).failed, [m]);
  assert.ok(!Q.questsOf(run).held.includes(m), 'a failed quest goes');
  const m2 = as('miniboss', 59);
  assert.deepEqual(Q.questWin(run, 'miniboss', false).done, [m2]);
  /* a parcel: its own town and a place that isn't a town don't take it; a town on a later row does */
  Q.questsOf(run).held = [];
  const p = as('parcel', 58);
  p.at = at;
  const later = T.find(i => run.map.nodes[i].row > run.map.nodes[at].row),
    route = run.map.nodes.findIndex(n => n.type === 'route');
  assert.equal(Q.questArrive(run, at).length, 0, 'its own town');
  assert.equal(Q.questArrive(run, route).length, 0, 'not a town');
  assert.deepEqual(Q.questArrive(run, later), [p]);
});

test('run quests: the board takes a done quest at any town but its own, once', () => {
  const run = start(SEEDS[1]).run,
    T = towns(run),
    o = { kind: 'catch', text: 'book', goal: 1, type: 'Fire' },
    q = Q.questTake(run, T[0], o, QD);
  assert.deepEqual(Q.questPayable(run, T[1]), [], 'not done yet');
  Q.questCatch(run, ['Fire']);
  assert.deepEqual(Q.questPayable(run, T[0]), [], 'not at its own town');
  assert.deepEqual(Q.questPayable(run, T[1]), [q]);
  assert.ok(Q.questPay(run, q));
  assert.ok(!Q.questPay(run, q), 'once only');
  assert.deepEqual([Q.questsOf(run).held.length, Q.questsOf(run).paid], [0, 1]);
  assert.equal(Q.questFill(QD.say.done, q, QD), 'Notice board: Catch a Fire Billie. Done! Pick a reward.');
  assert.equal(Q.questFill(QD.kinds.trainers.title, { kind: 'trainers', goal: 3 }, QD), 'Beat 3 route trainers');
});

test('run quests: a reload keeps them (validRun); bad shapes are refused; the run’s end clears them', () => {
  const s = start(SEEDS[2]),
    run = s.run,
    T = towns(run);
  Q.questTake(run, T[0], { kind: 'trainers', text: 'club', goal: 2 }, QD);
  Q.questWin(run, 'route', false);
  const back = JSON.parse(JSON.stringify(run));
  assert.ok(RS.validRun(back));
  assert.deepEqual(back.quests, run.quests);
  for (const bad of [
    { ...back.quests, extra: 1 },
    { ...back.quests, held: [{ ...back.quests.held[0], kind: 'dance' }] },
    { ...back.quests, held: [{ ...back.quests.held[0], n: 5 }] },
    { ...back.quests, took: [-1] },
  ])
    assert.equal(RS.validRunQuests(bad), false);
  RS.runRestore(s);
  assert.equal(s.run, null);
});

// RS-2: a resident's favour (quests.json favours): offered in one seeded town where it can be finished and handed in,
// held over the cap, never twice, kept by validRun, and gone with an invite
test('run quests: RS-2: a favour’s town, its offer, held over the cap, kept by a reload', () => {
  const F = QD.favours;
  let met = 0;
  for (const seed of SEEDS) {
    const run = start(seed).run,
      D = qdata(run);
    for (const [id, f] of Object.entries(F)) {
      if (!f.kind) continue;
      const at = Q.favourAt(run, f.kind, D),
        okTowns = Q.favourTowns(run, f.kind, D);
      assert.equal(Q.favourAt(start(seed).run, f.kind, qdata(start(seed).run)), at, 'the same run, the same town');
      if (at < 0) {
        assert.deepEqual(okTowns, [], 'no town only when none can');
        continue;
      }
      assert.ok(okTowns.includes(at));
      const o = Q.favourOffer(run, at, id, f, D);
      assert.ok(o, `${seed} ${id}: an offer in its town`);
      assert.equal(o.res, id);
      assert.equal(o.kind, f.kind);
      assert.deepEqual(Q.favourOffer(run, at, id, f, D), o, 'the same offer');
      met++;
    }
    /* held over the cap: three town quests, then the favour */
    const f = Object.entries(F).find(([, x]) => x.kind === 'parcel'),
      at = Q.favourAt(run, 'parcel', D);
    if (at < 0) continue;
    for (const i of towns(run)) {
      const o = Q.questOffer(run, i, D);
      if (o) Q.questTake(run, i, o, QD);
    }
    const took = run.quests ? run.quests.took.slice() : [];
    const before = Q.questsHeld(run),
      o = Q.favourOffer(run, at, f[0], f[1], D),
      q = Q.favourTake(run, at, o);
    assert.ok(q && q.res === f[0], 'taken whatever the cap');
    assert.equal(Q.questsHeld(run), before, 'not counted towards the cap');
    assert.equal(Q.favourHeld(run), q);
    assert.equal(Q.favourOffer(run, at, f[0], f[1], D), null, 'not offered again while held');
    assert.equal(Q.favourTake(run, at, o), null, 'never two');
    assert.deepEqual(run.quests.took, took, 'the town’s own offer stays open');
    assert.ok(RS.validRun(JSON.parse(JSON.stringify(run))), 'a reload keeps it');
    assert.equal(
      RS.validRun({ ...JSON.parse(JSON.stringify(run)), quests: { ...run.quests, held: [{ ...q, res: 'No!' }] } }),
      false
    );
    Q.questArrive(
      run,
      towns(run).find(i => run.map.nodes[i].row > run.map.nodes[at].row)
    );
    assert.equal(q.done, 1, 'a parcel favour is done in a later town');
    assert.ok(Q.questPay(run, q), 'and handed in');
    assert.equal(Q.favourHeld(run), null);
    run.invited = f[0];
    assert.equal(Q.favourOffer(run, at, f[0], f[1], D), null, 'none once invited');
    assert.equal(Q.favourOffer(run, at, 'dottie', F.dottie, D), null, 'the free first one asks none');
  }
  assert.ok(met > SEEDS.length * 3, `favours are met in most runs (${met})`);
});

test('run quests: RS-2: the run’s resident stands in the first town row while nobody lives there, then one town', () => {
  const R = GAME_DATA.residents,
    first = modules.residents.residentFirstTowns;
  for (const seed of SEEDS.slice(0, 12)) {
    const s = start(seed),
      D = qdata(s.run),
      plan = Q.residentPlan(s, R, D);
    assert.deepEqual(plan, { id: 'dottie', towns: first(s.run.map) }, `${seed}: Dottie in every first-row town`);
    assert.ok(plan.towns.length >= 1);
    s.meta.residents = { dottie: 1 };
    const next = Q.residentPlan(s, R, D);
    assert.ok(next && next.id !== 'dottie' && R[next.id].meet.weight > 0, `${seed}: someone else`);
    assert.ok(next.towns.length <= 1, 'in one town at most');
    if (next.towns.length)
      assert.ok(Q.favourOffer(s.run, next.towns[0], next.id, QD.favours[next.id], D), 'offering their favour there');
    assert.deepEqual(Q.residentPlan(s, R, D), next, 'the same run, the same plan');
  }
  assert.equal(Q.residentPlan({ meta: {}, run: null }, R, qdata(start('X').run)), null);
});
