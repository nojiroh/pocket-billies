// RL-R2: side areas and field moves (logic/run-side.js) on the game's own data: how often a run gets a detour or an
// alternate path (never both), that every side area is whole (runSideProblems), reached only through its obstacle
// once open and left only by its way out, that the clock counts its places, that an alternate path still reaches a
// boss, that the main path is the same with or without it, its species and leader, the save check, and the field move's
// answers (Pokémon's: no badge, no Billie of the type, or a yes).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readGameData } from '../data-files.mjs';
import { fn, GAME_DATA, hooks, modules } from './setup-real.mjs';

const { runStartPlan, runStartOn } = modules['run-start'],
  { runRegionData } = modules['run-region'],
  { runArrive, runNext } = modules['run-map'],
  { validRun, newRun } = modules['run-state'],
  S = modules['run-side'];
const RAW = readGameData(),
  REGION_DATA = runRegionData(RAW, RAW.trainers),
  MOVES = GAME_DATA.fieldMoves.moves,
  DATA = {
    nodeTypes: GAME_DATA.nodeTypes,
    biomes: GAME_DATA.biomes,
    rules: GAME_DATA.rules.run,
    unlockData: { unlocks: GAME_DATA.unlocks, buildings: GAME_DATA.buildings },
    region: REGION_DATA,
    fieldMoves: MOVES,
  },
  SEEDS = Array.from({ length: 600 }, (_, k) => `SIDE${k.toString(36).toUpperCase()}`),
  plan = (/** @type {string} */ seed, o = {}) => runStartPlan(seed, DATA, o);
/** a save on the run's landing, as the mast leaves it */
const onRun = (/** @type {string} */ seed, o = {}) => {
  const p = plan(seed, o),
    s = /** @type {any} */ ({
      se: 0,
      team: [],
      items: {},
      pyramids: {},
      trip: { node: 0, plan: [] },
      flags: {},
      seats: [],
      visited: {},
    });
  s.run = newRun(seed, 1, 3, /** @type {any} */ ({}));
  s.run.map = structuredClone(p.map);
  s.run.forecast = structuredClone(p.forecast);
  return { s, p };
};
/** walk the main path from the landing to map node i (row by row, any link that gets there) */
const walkTo = (/** @type {any} */ s, /** @type {any} */ data, /** @type {number} */ goal) => {
  const map = s.run.map,
    path = [goal];
  while (map.nodes[path[0]].row > 0) path.unshift(map.nodes.findIndex(n => !n.side && n.to.includes(path[0])));
  for (const i of path) assert.ok(runArrive(s, i, data) > 0, `walk to ${i}`);
};

test('how often: a detour on about 60% of runs, an alternate path on about 15%, never both; every side is whole', () => {
  const kinds = { detour: 0, alt: 0, none: 0 },
    moves = {};
  for (const seed of SEEDS) {
    const { map } = plan(seed),
      side = map.side;
    kinds[side ? side.kind : 'none']++;
    if (!side) {
      assert.ok(!map.nodes.some(n => n.side), seed);
      continue;
    }
    moves[side.move] = (moves[side.move] || 0) + 1;
    assert.deepEqual(S.runSideProblems(map), [], seed);
    assert.ok(side.nodes.length >= 2 && side.nodes.length <= 4, `${seed}: ${side.nodes.length} places`);
    assert.ok(MOVES[side.move].areas.includes(side.name));
    for (const i of side.nodes) assert.equal(map.nodes[i].biome, MOVES[side.move].biome);
  }
  assert.ok(kinds.detour / SEEDS.length > 0.5 && kinds.detour / SEEDS.length < 0.7, JSON.stringify(kinds));
  assert.ok(kinds.alt / SEEDS.length > 0.09 && kinds.alt / SEEDS.length < 0.21, JSON.stringify(kinds));
  assert.deepEqual(Object.keys(moves).sort(), ['cut', 'smash', 'surf']);
});

test('the main path is the same with or without a side area; the same seed makes the same side', () => {
  for (const seed of SEEDS.slice(0, 80)) {
    const a = plan(seed),
      none = runStartPlan(seed, { ...DATA, fieldMoves: undefined }),
      n = none.map.nodes.length;
    assert.deepEqual(
      a.map.nodes.slice(0, n).map(({ seen, ...nd }) => nd),
      none.map.nodes.map(({ seen, ...nd }) => nd),
      seed
    );
    assert.deepEqual(plan(seed).map, a.map);
  }
});

test('an alternate path still reaches a boss: by its way out to the main path, or at a boss of its own', () => {
  let own = 0,
    back = 0;
  for (const seed of SEEDS) {
    const { map } = plan(seed),
      side = map.side;
    if (!side || side.kind !== 'alt') continue;
    const end = map.nodes[side.nodes[side.nodes.length - 1]];
    if (side.to === -1) {
      own++;
      assert.equal(end.type, 'boss', seed);
      continue;
    }
    back++;
    assert.equal(end.type, 'miniboss', seed);
    // from the way out, the main path goes on to the boss
    let at = side.to;
    while (runNext(map, at).length) at = runNext(map, at)[0];
    assert.equal(map.nodes[at].type, 'boss', seed);
  }
  assert.ok(own > 0 && back > 0, `own ${own}, back ${back}`);
});

test('reached only through its obstacle, once open; left by its way out alone; a day a place', () => {
  let tried = 0;
  for (const seed of SEEDS) {
    const { s, p } = onRun(seed),
      map = s.run.map,
      side = map.side;
    if (!side || side.kind !== 'detour') continue;
    tried++;
    // nothing on the main path links into it
    for (const nd of map.nodes) if (!nd.side) for (const j of nd.to) assert.ok(!map.nodes[j].side, seed);
    walkTo(s, p.data, side.from);
    const day = s.run.clock,
      first = side.nodes[0];
    assert.equal(runArrive(s, first, p.data), 0, `${seed}: closed until the obstacle opens`);
    assert.equal(S.runSideOpen(map), true);
    assert.equal(S.runSideOpen(map), false, 'once');
    for (const i of side.nodes) assert.equal(map.nodes[i].seen, 2, 'shown once open');
    side.nodes.forEach((i, k) => assert.equal(runArrive(s, i, p.data), day + k + 1, `${seed}: place ${k}`));
    // back along the chain is a day too, then forward again
    if (side.nodes.length > 1) {
      assert.equal(runArrive(s, side.nodes.at(-2), p.data), day + side.nodes.length + 1);
      assert.ok(runArrive(s, side.nodes.at(-1), p.data) > 0);
    }
    const out = runArrive(s, side.to, p.data);
    assert.ok(out > 0, `${seed}: the way out`);
    assert.equal(runArrive(s, side.nodes.at(-1), p.data), 0, `${seed}: the way out is one way`);
    assert.deepEqual(S.runSideProblems(map), [], seed);
    if (tried >= 40) break;
  }
  assert.ok(tried >= 40);
});

test('its own species and leader: lines the region left out, a leader it didn’t pick (not of the move’s type)', () => {
  const lines = Object.fromEntries(RAW.lines.map(L => [L.id, L]));
  for (const seed of SEEDS.slice(0, 200)) {
    const { map, region } = plan(seed),
      side = map.side;
    if (!side) continue;
    const type = MOVES[side.move].type;
    assert.ok(side.leader && !region.leaders.includes(side.leader), seed);
    assert.notEqual(RAW.trainers[side.leader].type, type, seed);
    for (const sp of side.dex || []) {
      assert.ok(lines[sp.replace(/\d+$/, '')], `${seed}: ${sp}`);
      assert.ok(!region.dex.some(d => d.startsWith(sp.replace(/\d+$/, ''))), `${seed}: ${sp} is in the region`);
    }
  }
});

test('the debug mod forces a side area: dbg_side_<kind>_<move>', () => {
  assert.deepEqual(S.runSideForce(['x', 'dbg_side_alt_surf']), { kind: 'alt', move: 'surf' });
  assert.equal(S.runSideForce(['dbg_side_nope_cut']), null);
  for (const seed of SEEDS.slice(0, 30)) {
    const side = plan(seed, { mods: ['dbg_side_detour_cut'] }).map.side;
    assert.ok(side, seed);
    assert.deepEqual([side.kind, side.move], ['detour', 'cut']);
  }
});

test('the save takes a run with a side area and refuses a tampered one', () => {
  const seed = SEEDS.find(sd => plan(sd).map.side),
    s = fn('newSave')();
  s.started = true;
  s.starter = GAME_DATA.rules.start.starters[0];
  s.team.push(fn('makeBilly')(s.starter + '0', GAME_DATA.rules.start.starterLevel));
  hooks.provide({ saveData: s });
  const run = runStartOn(s, plan(seed), { home: [s.team[0].uid] });
  assert.ok(validRun(JSON.parse(JSON.stringify(run))));
  const bad = (/** @type {(r: any) => void} */ f) => {
    const r = JSON.parse(JSON.stringify(run));
    f(r);
    return validRun(r);
  };
  assert.equal(
    bad(r => (r.map.side.kind = 'portal')),
    false
  );
  assert.equal(
    bad(r => (r.map.side.from = r.map.side.nodes[0])),
    false
  );
  assert.equal(
    bad(r => (r.map.side.nodes = [])),
    false
  );
  assert.equal(
    bad(r => delete r.map.nodes[r.map.side.nodes[0]].side),
    false
  );
  assert.equal(
    bad(r => (r.map.side.open = 2)),
    false
  );
  assert.equal(
    bad(r => (r.map.side.extra = 1)),
    false
  );
  assert.equal(
    bad(r => delete r.map.side),
    false,
    'side places with no side'
  );
});

test("a field move's answer: no badge, no Billie of the type, or a yes", () => {
  const M = MOVES.cut,
    grass = [{ name: 'Leafy', types: ['Grass'] }],
    fire = [{ name: 'Sparky', types: ['Fire'] }];
  assert.deepEqual(S.fieldMoveState(M, {}, grass), { state: 'needBadge', billie: '' });
  assert.deepEqual(S.fieldMoveState(M, { water: 1 }, grass), { state: 'needBadge', billie: '' });
  assert.deepEqual(S.fieldMoveState(M, { grass: 1 }, fire), { state: 'needType', billie: '' });
  assert.deepEqual(S.fieldMoveState(M, { grass: 1 }, [...fire, ...grass]), { state: 'ask', billie: 'Leafy' });
  assert.equal(S.fieldMoveText(M, 'used', 'Leafy'), 'Leafy used Cut!');
  assert.match(S.fieldMoveText(M, 'needBadge'), /Grass Badge/);
  assert.equal(S.fieldBadgeKey('Water'), 'water');
});
