// IN-1: the prepared first run (game/data/firstRun.json, logic/first-run.js, logic/run-start.js runStartPrepared) on the
// game's own data: the file reads and passes its checks, a run started from it is a valid run whose map is the
// file's, with the file's gift, wild Billies, trainers, event, foes, boss and planted Perk; the first run keeps every
// Billie, won or lost, and a later run doesn't. Its places are frozen in first-run-places.test.mjs (slow tier).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, data, fn, hooks, modules } from './setup-real.mjs';

const F = GAME_DATA.firstRun,
  { RULES, TRAINERS, EVENTS, SPECIES, PERKS, BOSSES } = data,
  R = RULES.run,
  FR = modules['first-run'],
  { runStartPrepared, runStartOn, runStartPlan } = modules['run-start'],
  { validRun, runEnd } = modules['run-state'],
  { runWorldData } = modules['run-world-data'];
const UNLOCK_DATA = { unlocks: GAME_DATA.unlocks, buildings: GAME_DATA.buildings };
const RATES = R.payout,
  PRICE = () => 0;

/** a new game's save with this starter (at the starter level), on the prepared run */
function prepared(line = RULES.start.starters[0]) {
  const s = fn('newSave')();
  s.started = true;
  s.starter = line;
  hooks.provide({ saveData: s, activeBattle: null });
  s.team.push(fn('makeBilly')(line + '0', RULES.start.starterLevel));
  const run = runStartPrepared(s, { ...runWorldData(), unlockData: UNLOCK_DATA });
  return { s, run };
}
const foesOf = run =>
  modules['run-loop'].runFoes(run, { leaders: Object.values(TRAINERS).filter(T => T.miniboss), rules: R });

test('firstRun.json reads and passes the data check (schema and references)', () => {
  assert.ok(F && F.nodes.length, 'firstRun.json is in the game data');
  assert.deepEqual(modules['data-checks'].dataFirstRun(GAME_DATA), []);
  assert.deepEqual(
    FR.FIRST_RUN_SPOTS.filter(k => !F.crash.spots[k]),
    [],
    'every spot IN-5 names'
  );
  assert.ok(BOSSES[F.boss], 'its boss is a bosses.json boss');
  assert.deepEqual(BOSSES[F.boss].expeditions, [], 'no Expedition fights the first run’s boss');
});

test('the data check catches a broken file: a link that skips a row, a species that isn’t, a missing spot', () => {
  const bad = JSON.parse(JSON.stringify(F));
  bad.nodes[0].to = [3];
  bad.nodes[1].wild = { lv: [3, 3], list: ['nobody0'] };
  delete bad.crash.spots.kappi;
  const out = modules['data-checks'].dataFirstRun({ ...GAME_DATA, firstRun: bad }).map(p => p[1]);
  assert.ok(
    out.some(t => /node 0: its link to 3 isn't one row on/.test(t)),
    out.join('\n')
  );
  assert.ok(
    out.some(t => /no species nobody0/.test(t)),
    out.join('\n')
  );
  assert.ok(
    out.some(t => /no spot kappi/.test(t)),
    out.join('\n')
  );
});

test('a prepared run is a valid run on the file’s seed, marked first, with the file’s gift and the lead alone', () => {
  const { s, run } = prepared();
  assert.equal(validRun(run), true);
  assert.equal(run.first, true);
  assert.equal(run.seed, F.seed);
  assert.deepEqual(run.home, [s.team[0].uid]);
  assert.equal(s.se, R.first.se);
  assert.equal(s.se, 0, 'no starting money (the owner)');
  assert.equal(s.pyramids.pyramid, 5);
  assert.equal(s.items.potion, 1);
  assert.deepEqual(run.perks, [], 'no hub bonus rides along');
  /* a run whose `first` isn't true doesn't load */
  assert.equal(validRun({ ...run, first: 1 }), false);
});

test('its map is the file’s: every node’s type, row, lane, biome and links, laid out on the region grid', () => {
  const { run } = prepared();
  assert.deepEqual(
    run.map.nodes.map(n => [n.type, n.row, n.lane, n.biome, n.to]),
    F.nodes.map(n => [n.type, n.row, n.lane, n.biome, n.to.slice().sort((a, b) => a - b)])
  );
  for (const n of run.map.nodes) assert.ok(n.at && n.size && n.ways, 'a footprint and its exits');
  assert.ok(!run.map.side, 'no side area');
  assert.ok(!run.map.nodes.some(n => n.type === 'rival' || n.type === 'ghost'), 'no Blake, no ghost');
  /* the region's zones follow the file's biomes, and its leaders are the file's */
  assert.deepEqual(
    run.region.zones.map(z => z.biome),
    FR.firstRunZones(F).map(z => z.biome)
  );
  assert.deepEqual(
    run.region.leaders,
    F.nodes.filter(n => n.leader).map(n => n.leader)
  );
  /* the landing is shown, and a forecast for every place */
  assert.equal(run.forecast.length, run.map.nodes.length + 1);
});

test('the same file makes the same run every time (nothing in it hangs on Math.random)', () => {
  const a = prepared().run,
    b = prepared().run;
  assert.deepEqual(a.map, b.map);
  assert.deepEqual(a.forecast, b.forecast);
  assert.deepEqual(a.region, b.region);
});

test('the places hold what the file pins: wild Billies by the starter, stock, trainers, the event', () => {
  for (const line of RULES.start.starters) {
    const { run } = prepared(line);
    const W = modules['run-scenes'].runWorldTables(run, data.LOCATIONS[0], runWorldData());
    F.nodes.forEach((n, i) => {
      if (!n.wild) return;
      const P = W.pools[`run_${i}`],
        ids = n.wild.list || n.wild.by[line];
      assert.deepEqual(
        P.list.map(e => e[0]),
        ids,
        `node ${i}'s wild Billies for ${line}`
      );
      assert.deepEqual(P.lv, n.wild.lv);
      if (n.wild.stock != null) assert.equal(W.locations[i + 1].stock, n.wild.stock);
    });
    const route = modules['route-trainers'].runRouteTrainers(run, {
      classes: EVENTS.classes,
      species: SPECIES,
      rules: R,
      arenas: GAME_DATA.arenas || null,
    });
    F.nodes.forEach((n, i) => {
      if (n.trainers != null)
        assert.equal(Object.values(route).filter(T => T.runNode === i).length, n.trainers, `node ${i}'s trainers`);
    });
    F.nodes.forEach((n, i) => {
      if (n.event) assert.equal(modules.encounters.eventAt(run, i, EVENTS), n.event);
    });
  }
});

test('the counter lane fields the starter’s counter type', () => {
  const lane = F.nodes.find(n => n.wild && n.wild.by);
  for (const line of RULES.start.starters) {
    const mine = SPECIES[line + '0'].types,
      foe = lane.wild.by[line].map(id => SPECIES[id].types);
    assert.ok(
      foe.every(t => t.some(a => fn('typeEffectiveness')(a, mine) > 1)),
      `${line}'s counter lane beats it (${foe})`
    );
  }
});

test('its mini-boss is the file’s leader with the file’s Billies, its boss the file’s bot', () => {
  const { run } = prepared();
  const foes = foesOf(run);
  F.nodes.forEach((n, i) => {
    const T = foes[`run_${i}_foe`];
    if (n.type === 'miniboss') {
      assert.equal(T.from, n.leader);
      if (n.team)
        assert.deepEqual(
          T.team.map(e => e.sp),
          n.team
        );
      assert.equal(T.double, true, 'doubles');
    }
    if (n.type === 'boss') {
      assert.equal(T.boss, F.boss);
      assert.equal(T.alpha, true);
    }
  });
  /* a later run's boss on Expedition I is still the Voltron */
  const s = fn('newSave')();
  s.started = true;
  hooks.provide({ saveData: s });
  s.team.push(fn('makeBilly')('musk0', 5));
  const later = runStartOn(
    s,
    runStartPlan('LATERRUN1', { ...runWorldData(), unlockData: UNLOCK_DATA }, { expedition: 1 }),
    {}
  );
  const B = Object.values(foesOf(later)).find(T => T.runFoe === 'boss');
  assert.equal(B.boss, 'retrieval');
});

test('the first mini-boss pick holds the planted Perk; later picks and other runs don’t', () => {
  const { run } = prepared();
  const P = modules.perks;
  const offer = P.perkOfferMake(run, PERKS, R.perks, undefined, 'leader');
  assert.ok(offer.includes(F.plant), offer.join(', '));
  assert.equal(offer.length, R.perks.leader.pick);
  /* the plant lives in the first pick only */
  assert.deepEqual(FR.firstRunPlant({ ...run, offerN: 1 }, ['a', 'b', 'c'], PERKS), ['a', 'b', 'c']);
  assert.deepEqual(FR.firstRunPlant({ ...run, first: undefined, offerN: 0 }, ['a', 'b', 'c'], PERKS), ['a', 'b', 'c']);
});

test('the first run keeps the starter and every Billie caught, lost or won; a later run keeps the one picked', () => {
  for (const won of [false, true]) {
    const { s, run } = prepared();
    const lead = s.team[0].uid,
      caught = fn('makeBilly')('hughes0', 3);
    s.team.push(caught);
    assert.ok(run.first);
    runEnd(s, { won, keep: [] }, RATES, PRICE);
    assert.equal(s.run, null);
    assert.deepEqual(s.team.map(m => m.uid).sort(), [lead, caught.uid].sort(), `won: ${won}`);
    assert.equal(s.meta.runs, 1);
  }
  /* a later run (no `first`): only the one picked comes home */
  const s = fn('newSave')();
  s.started = true;
  hooks.provide({ saveData: s });
  s.team.push(fn('makeBilly')('musk0', 5));
  runStartOn(s, runStartPlan('LATERRUN2', { ...runWorldData(), unlockData: UNLOCK_DATA }, {}), {});
  const caught = fn('makeBilly')('hughes0', 3);
  s.team.push(caught);
  runEnd(s, { won: false, keep: [] }, RATES, PRICE);
  assert.ok(!s.team.some(m => m.uid === caught.uid), 'the caught one is lost');
});

test('the crash site: the wreck and its cargo by the mast, turned with it, the area round the spots cleared', () => {
  const mast = { k: 'train_halt', x: 50, z: 20, act: 'fly' },
    scene = {
      props: [
        mast,
        { k: 'tree_oak_b', x: 50 + F.crash.spots.me[0], z: 20 + F.crash.spots.me[1] },
        { k: 'tree_oak_b', x: 0, z: 0 },
        { k: 'sign', x: 50 + F.crash.spots.me[0], z: 20 + F.crash.spots.me[1], act: 'sign' },
      ],
    };
  const put = FR.firstRunCrash(scene);
  assert.equal(put.length, F.crash.props.length);
  assert.deepEqual(
    put.map(p => [p.k, p.x, p.z]),
    F.crash.props.map(q => [q.k, 50 + q.at[0], 20 + q.at[1]])
  );
  const keys = scene.props.filter(p => !p.crash).map(p => p.k + (p.act ? ':' + p.act : ''));
  assert.deepEqual(
    keys,
    ['train_halt:fly', 'tree_oak_b', 'sign:sign'],
    'the tree on a spot went; the far one and a sign stayed'
  );
  /* turned a quarter: an offset east of the mast lands north of it */
  const turned = FR.firstRunSpots({ props: [{ ...mast, rot: 90 }] });
  const [dx, dz] = F.crash.spots.wreck;
  assert.ok(Math.abs(turned.wreck.x - (50 - dz)) < 0.02 && Math.abs(turned.wreck.z - (20 + dx)) < 0.02);
  assert.deepEqual(FR.firstRunSpots({ props: [] }), {}, 'no mast, no spots');
});

test('IN-5: the crash cutscene laid on the landing: its spots are the crash site’s, its shots turned with the mast', () => {
  const C = GAME_DATA.cutscenes.crash,
    mast = { k: 'train_halt', x: 50, z: 20, act: 'fly' };
  assert.ok(C && C.landing && C.map === 'first_run', 'crash.json is filmed on the landing');
  assert.deepEqual(C.spots, F.crash.spots, 'the cutscene’s spots are the crash site’s');
  const S = FR.firstRunCutscene(C, { props: [mast] }, 'run_landing');
  assert.equal(S.map, 'run_landing');
  const spots = FR.firstRunSpots({ props: [mast] });
  for (const [k, p] of Object.entries(S.spots)) assert.deepEqual(p, [spots[k].x, spots[k].z], k);
  for (const [k, K] of Object.entries(S.shots)) {
    assert.deepEqual(K.eye, [50 + C.shots[k].eye[0], C.shots[k].eye[1], 20 + C.shots[k].eye[2]], k + ' eye');
    assert.equal(K.tgt[1], C.shots[k].tgt[1], k + ': the heights stay');
  }
  /* turned a quarter, an area clears the square round its turned corners */
  const Q = FR.firstRunCutscene({ ...C, clear: { areas: [[1, 2, 3, 4]] } }, { props: [{ ...mast, rot: 90 }] }, 'x');
  assert.deepEqual(Q.clear.areas[0], [46, 21, 48, 23]);
  assert.equal(FR.firstRunCutscene(C, { props: [] }, 'x'), null, 'no mast, no scene');
});

test('IN-5: the starter picked at the crash takes the stand-in’s place on the run, the counter lane following it', () => {
  const [a, b] = RULES.start.starters,
    { s, run } = prepared(a),
    uid = s.team[0].uid;
  const old = FR.firstRunStarter(s, fn('makeBilly')(b + '0', RULES.start.starterLevel), b);
  assert.equal(old.sp, a + '0');
  assert.equal(s.team.length, 1);
  assert.equal(s.team[0].sp, b + '0');
  assert.equal(s.team[0].uid, uid, 'the same uid: the run’s home and the buddy still name it');
  assert.equal(s.buddy, uid);
  assert.equal(s.starter, b);
  assert.ok(s.caught[b + '0'] && s.seen[b + '0']);
  assert.equal(run.rival.lead, b + '0', 'the run’s lead is the picked one');
  assert.deepEqual(
    run.start.team.map(m => m.sp),
    [b + '0'],
    'the hub’s snapshot holds the picked one, not the stand-in'
  );
  const lane = F.nodes.findIndex(n => n.wild && n.wild.by);
  assert.deepEqual(
    FR.firstRunPool(run, lane).list.map(([id]) => id),
    F.nodes[lane].wild.by[b],
    'the counter lane is the picked starter’s'
  );
  assert.ok(validRun(run), 'still a valid run');
  assert.equal(FR.firstRunStarter({ team: [] }, {}, b), null);
});
