// RL-R1: a run's region on the game's own data (regions.json, the lines, the leaders). A run started with its region
// (logic/run-start.js runStartPlan) has a map whose rows follow the zones over its open biomes (a fresh save's: no
// ridge or autumn), a dex of real species, leaders of the theme's types, and a save that loads; the debug menu's short
// map still fits. run-region.test.mjs has the rules on small tables.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readGameData } from '../data-files.mjs';
import { fn, GAME_DATA, hooks, modules, reseed } from './setup-real.mjs';

const { runStartOn, runStartPlan } = modules['run-start'],
  { runRegionData } = modules['run-region'],
  { validRun, validRunRegion } = modules['run-state'],
  { lineSpeciesIds } = modules.forms,
  { runUnlocks } = modules.unlocks;
const RAW = readGameData(),
  REGION_DATA = runRegionData(RAW, RAW.trainers),
  UNLOCK_DATA = { unlocks: GAME_DATA.unlocks, buildings: GAME_DATA.buildings },
  DATA = {
    nodeTypes: GAME_DATA.nodeTypes,
    biomes: GAME_DATA.biomes,
    rules: GAME_DATA.rules.run,
    unlockData: UNLOCK_DATA,
    region: REGION_DATA,
  },
  SPECIES = new Set(RAW.lines.flatMap(L => lineSpeciesIds(L))),
  LEADER_TYPE = Object.fromEntries(REGION_DATA.leaders.map(L => [L.id, L.type])),
  SEEDS = Array.from({ length: 120 }, (_, k) => `R${k.toString(36).toUpperCase()}REAL`);

test('the leaders: every mini-boss trainer with its type', () => {
  assert.deepEqual(LEADER_TYPE, {
    alta: 'Flying',
    carat: 'Electric',
    crude: 'Ground',
    marina: 'Water',
    markdown: 'Steel',
    morel: 'Psychic',
    poppy: 'Grass',
    vault: 'Fire',
  });
});

test("a run's region: its map follows the zones over the open biomes, real species, leaders of its types", () => {
  const fresh = new Set(['meadow', 'lake', 'thicket']),
    themes = new Set();
  for (const [what, unlocks] of [
    ['fresh', []],
    ['all', Object.keys(GAME_DATA.unlocks)],
  ])
    for (const seed of SEEDS) {
      const plan = runStartPlan(seed, DATA, { unlocks }),
        G = plan.region,
        T = RAW.regions.themes[G.theme];
      themes.add(G.theme);
      assert.ok(validRunRegion(G), `${seed}: a region the save keeps`);
      assert.equal(G.zones.length, 3, `${seed}: 3 zones at Expedition I`);
      const rows = G.zones.reduce((n, z) => n + z.rows, 0);
      assert.equal(1 + Math.max(...plan.map.nodes.map(n => n.row)), rows, `${seed}: the map's rows are the zones'`);
      let row = 0;
      G.zones.forEach((z, k) => {
        if (what === 'fresh') assert.ok(fresh.has(z.biome), `${seed}: ${z.biome} is open on a fresh save`);
        for (const n of plan.map.nodes.filter(x => x.row >= row && x.row < row + z.rows)) {
          assert.equal(n.zone, k, seed);
          assert.equal(n.biome, z.biome, seed);
        }
        row += z.rows;
      });
      assert.ok(G.dex.length >= RAW.regions.dex[0] && G.dex.length <= RAW.regions.dex[1], `${seed}: ${G.dex.length}`);
      assert.ok(
        G.dex.every(sp => SPECIES.has(sp)),
        `${seed}: real species`
      );
      /* RO-3f: a mythical is in no regional dex */
      const myth = GAME_DATA.lines.filter(L => L.rar === 'mythical').map(L => L.id + '0');
      assert.ok(myth.length && !G.dex.some(sp => myth.includes(sp)), `${seed}: no mythical`);
      assert.equal(G.leaders.length, GAME_DATA.rules.run.map.minibosses + 1, seed);
      // each theme leans to 4 types with a leader each: all three leaders are of its types
      for (const id of G.leaders) assert.ok(T.types[LEADER_TYPE[id]] > 0, `${seed}: ${id} for ${G.theme}`);
    }
  assert.deepEqual([...themes].sort(), Object.keys(RAW.regions.themes).sort(), 'every theme rolls');
});

test("the run keeps its region, the save loads, and the debug menu's short map fits", () => {
  reseed(1);
  const s = fn('newSave')();
  s.started = true;
  s.starter = GAME_DATA.rules.start.starters[0];
  s.team.push(fn('makeBilly')(s.starter + '0', GAME_DATA.rules.start.starterLevel));
  hooks.provide({ saveData: s });
  const plan = runStartPlan('RLR1REAL', DATA, { unlocks: runUnlocks(s, UNLOCK_DATA) });
  const run = runStartOn(s, plan, { home: [s.team[0].uid] });
  assert.deepEqual(run.region, plan.region);
  assert.ok(validRun(run));
  assert.equal(validRun({ ...run, region: { ...run.region, name: '' } }), false, 'a region with no name');
  assert.equal(validRun({ ...run, region: { ...run.region, extra: 1 } }), false, 'a region with a key too many');
  const { region, ...before } = run;
  assert.ok(region && validRun(before), 'a run from before regions still loads');
  const short = runStartPlan('RLR1REAL', DATA, { unlocks: [], map: { rows: 5, minibosses: 1 } });
  assert.deepEqual(
    short.region.zones.map(z => z.rows),
    [3, 2]
  );
  assert.equal(short.region.leaders.length, 2);
  assert.equal(1 + Math.max(...short.map.nodes.map(n => n.row)), 5);
  // without its region data a start makes no region (the tests' own tables, and a run from before)
  assert.equal(runStartPlan('RLR1REAL', { ...DATA, region: undefined }, { unlocks: [] }).region, null);
});

test("a region run's places meet only its dex, in its varieties; its mini-bosses and boss are its leaders", () => {
  const { runWorldTables } = modules['run-scenes'],
    { runFoes } = modules['run-loop'],
    WORLD = {
      nodeTypes: GAME_DATA.nodeTypes,
      biomes: GAME_DATA.biomes,
      pools: GAME_DATA.pools,
      scenery: GAME_DATA.scenery,
      rules: GAME_DATA.rules.run,
    },
    TRAINERS = Object.entries(GAME_DATA.trainers).map(([id, T]) => ({ ...T, id }));
  for (const seed of SEEDS.slice(0, 40)) {
    reseed(1);
    const s = fn('newSave')();
    s.started = true;
    s.starter = GAME_DATA.rules.start.starters[0];
    s.team.push(fn('makeBilly')(s.starter + '0', GAME_DATA.rules.start.starterLevel));
    hooks.provide({ saveData: s });
    const run = runStartOn(s, runStartPlan(seed, DATA, { unlocks: [] }), { home: [s.team[0].uid] }),
      dex = new Set(run.region.dex),
      W = runWorldTables(run, GAME_DATA.locations[0], WORLD);
    for (const [id, P] of Object.entries(W.pools)) {
      assert.ok(P.list.length >= 1, `${seed}: ${id} has Billies to meet`);
      assert.ok(
        P.list.every(([sp]) => dex.has(sp)),
        `${seed}: ${id} meets ${P.list.map(e => e[0])} of ${[...dex]}`
      );
      assert.equal(new Set(P.list.map(e => e[0])).size, P.list.length, `${seed}: ${id} lists a species once`);
    }
    const foes = Object.values(runFoes(run, { leaders: TRAINERS.filter(T => T.miniboss), rules: GAME_DATA.rules.run }))
      .sort((a, b) => a.runNode - b.runNode)
      .map(F => F.from);
    assert.deepEqual(foes, run.region.leaders, `${seed}: the leaders in order`);
  }
});

test("the world map: each zone's places stand in a region of their own, with their zone's biome's ground", () => {
  const { runWorldTables } = modules['run-scenes'],
    { runBowlLook, runBowlGround } = modules['run-bowl'],
    { runSpot } = modules['run-map'],
    { rngFrom } = modules.rng,
    { bowlXY } = modules.bowl,
    WORLD = {
      nodeTypes: GAME_DATA.nodeTypes,
      biomes: GAME_DATA.biomes,
      pools: GAME_DATA.pools,
      scenery: GAME_DATA.scenery,
      rules: GAME_DATA.rules.run,
    };
  for (const seed of SEEDS.slice(0, 10)) {
    const plan = runStartPlan(seed, DATA, { unlocks: [] }),
      run = { seed, map: plan.map, region: plan.region },
      W = runWorldTables(run, GAME_DATA.locations[0], WORLD),
      spots = plan.map.nodes.map((_, i) => {
        const s = runSpot(plan.map, i);
        return bowlXY(s.a, s.r);
      }),
      look = runBowlLook(seed, plan.map, spots, GAME_DATA.biomes, GAME_DATA.worldmap, () => 'round', rngFrom);
    W.locations.slice(1).forEach((p, i) => {
      const node = plan.map.nodes[i];
      assert.equal(p.region, `zone${node.zone}`, `${seed}: place ${i}`);
      assert.equal(look.regions[p.region].ground, runBowlGround(GAME_DATA.biomes[node.biome]), `${seed}: ${p.region}`);
    });
    assert.ok(look.regions.starter, `${seed}: the starter region stays (between the zones)`);
  }
});

test('HB-7: every region theme has its own sky train, a train prop', () => {
  const props = RAW.scenery.props,
    trains = Object.values(RAW.regions.themes).map(T => T.train && T.train.k);
  for (const k of trains) assert.equal(props[k] && props[k].group, 'sky_train', `${k} is not a sky train`);
  assert.equal(new Set(trains).size, trains.length, 'two themes share a train');
});
