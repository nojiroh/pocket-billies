// Phase 13: saves checked against the game's own data, in plain Node (moved here from the browser steps v38 and
// alpha 0.1 of tools/check-quick.py).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { data, fn, GAME_DATA, modules, startedSave } from './setup-real.mjs';

const { RULES, SPECIES } = data;
const { runMapStart } = modules['run-map'];
const { newRun } = modules['run-state'];
const { MAPGEN_VERSION } = modules.mapgen;
const { runScenesMake, runWorldTables } = modules['run-scenes'];

test('a species the game no longer has is dropped from a save with its Guide marks; the rest loads as it was', () => {
  assert.equal(SPECIES.ghost0, undefined, 'the test needs a species the data does not have');
  assert.ok(SPECIES.swift0, 'the test needs swift0');
  const s = fn('saveFill')({
    started: true,
    team: [
      { uid: 'g1', sp: 'ghost0', lvl: 7, moves: [] },
      { uid: 'g2', sp: 'swift0', lvl: 6, moves: [] },
    ],
    box: [],
    seen: { ghost0: 1, swift1: 1 },
    caught: { ghost0: 1 },
    wild: { copperleaf: { at: 0, list: [{ id: 'q', sp: 'ghost0', lvl: 5 }] } },
  });
  assert.deepEqual(
    s.team.map(m => m.sp),
    ['swift0']
  );
  assert.ok(s.team[0].moves.length > 0, 'the Billie that stayed has no moves');
  assert.deepEqual(Object.keys(s.seen), ['swift1']);
  assert.deepEqual(Object.keys(s.caught), []);
  assert.equal(s.wild.copperleaf.list.length, 0);
});

test('preferences survive loading: 90 frames a second is kept, the picture setting is Sharpest by default', () => {
  const s = startedSave(Object.keys(SPECIES).find(k => SPECIES[k].line === RULES.start.starters[0]));
  s.preferences.fps = 90;
  const m = fn('saveFill')(JSON.parse(JSON.stringify(s)));
  assert.equal(m.preferences.fps, 90);
  assert.equal(m.preferences.aim, 'sharp');
});

test('wild Billies by place: a route keeps 4, a town with tall grass 2, a town without none', () => {
  /* on a run's world (made from a seed on the game's data, as the mast does), put in with its scenes and the hub
     back after; the run's towns all have tall grass, so one's grass is taken out for the last case */
  const R = GAME_DATA.rules.run,
    WD = {
      nodeTypes: GAME_DATA.nodeTypes,
      biomes: GAME_DATA.biomes,
      pools: data.POOLS,
      scenery: GAME_DATA.scenery,
      rules: R,
    },
    START = {
      team: [],
      se: 0,
      items: {},
      pyramids: {},
      trip: { node: 0, plan: [] },
      wild: {},
      eggs: [],
      flags: {},
      seats: [],
      visited: {},
    },
    run = newRun('SAVESWILD', 1, MAPGEN_VERSION, START);
  runMapStart(run, { nodeTypes: GAME_DATA.nodeTypes, biomes: GAME_DATA.biomes, rules: R });
  const made = runScenesMake(run, WD),
    W = runWorldTables(run, data.LOCATIONS[0], WD),
    maps = Object.fromEntries(W.locations.slice(1).map((p, i) => [p.mapId, made[i]])),
    route = W.locations.findIndex(p => p.kind === 'route'),
    town = W.locations.findIndex((p, i) => i > 0 && p.kind === 'town');
  assert.ok(route > 0 && town > 0, 'the run needs a route and a town');
  const s = startedSave(Object.keys(SPECIES).find(k => SPECIES[k].line === RULES.start.starters[0])),
    stock = fn('encounterStock');
  s.wild = {};
  assert.equal(stock(0), RULES.encounters.townGrass, 'Copperleaf, a town with tall grass');
  data.worldPut({ ...W, maps });
  try {
    assert.equal(stock(route), RULES.encounters.route);
    assert.equal(fn('encountersHere')(route).length, RULES.encounters.route, 'full on the first visit');
    /* RT-4: each waits in its habitat, by its types: the water's and the woods' only theirs, the rest in the grass */
    const H = RULES.run.wild.habitats,
      hab = (/** @type {string} */ sp) => modules['wild-pool'].wildHabitat(SPECIES[sp].types, H);
    for (let n = 0; n < 40; n++) fn('spawn')(false, null, route);
    for (const q of fn('wildList')(route)) {
      assert.equal(q.hab || 'grass', hab(q.sp), `${q.sp} (${SPECIES[q.sp].types}) waits in its habitat`);
      if (q.hab)
        assert.ok(
          H[q.hab].some(t => SPECIES[q.sp].types.includes(t)),
          `${q.sp} is a ${q.hab} Billie`
        );
      else
        assert.ok(
          Object.values(H).every(T => !T.some(t => SPECIES[q.sp].types.includes(t))),
          q.sp
        );
    }
    s.wild = {};
    /* RT-2: a run route's trainers stand in for some of its wild Billies, down to routeMin */
    const L = data.LOCATIONS[route],
      Wr = RULES.run.wild;
    for (const [n, want] of [
      [4, Wr.route - 4],
      [5, Wr.route - 5],
      [Wr.route, Wr.routeMin],
    ]) {
      L.trainerCount = n;
      assert.equal(stock(route), Math.max(Wr.routeMin, want), `${n} trainers`);
    }
    delete L.trainerCount;
    assert.equal(stock(town), RULES.encounters.townGrass);
    const sc = maps[W.locations[town].mapId];
    sc.tiles = sc.tiles.map((/** @type {string} */ row) => row.replaceAll('t', '.'));
    delete sc._lite;
    assert.equal(stock(town), 0);
    assert.equal(fn('encountersHere')(town).length, 0);
  } finally {
    data.worldHubBack();
  }
  assert.deepEqual(
    data.LOCATIONS.map(l => l.id),
    data.gameData.locations.map(l => l.id),
    'the hub is back'
  );
});
