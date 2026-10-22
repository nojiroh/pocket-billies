// Island track IS-0: the island contract (docs/phases/island-track.md): the map fields cam.orbit, island, zones,
// islandGen and waterKind. The game's maps pass the schema and logic/island.js (check-data runs both); test_island
// carries every field; each planted fault on a small island gives its words; the schema's water kinds are the
// renderer's (walk/water-data.js WATER_KIND_LOOKS, which can't load in Node). The lock (the owner, 2026-10-22): a locked
// island's ground (letters, heights, steps, coast, zones) can't change without failing; its props can.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import { GAME_DATA, ROOT } from './setup-real.mjs';
import {
  ISLAND_PLOT_KINDS,
  ISLAND_ZONE_KINDS,
  islandGroundHash,
  islandPointIn,
  islandProblems,
} from '../../game/js/logic/island.js';

const SCHEMA = join(ROOT, 'game/data/schema');
const ajv = new Ajv2020({ allErrors: true, strict: false });
for (const f of readdirSync(SCHEMA)) ajv.addSchema(JSON.parse(readFileSync(join(SCHEMA, f), 'utf8')));
const fits = sc => ajv.validate('map.schema.json', sc);
const MAP_SCHEMA = JSON.parse(readFileSync(join(SCHEMA, 'map.schema.json'), 'utf8'));

/* a 40 x 40 island: a square coast, its middle, an orbit, a locked town */
const island = (o = {}) => ({
  name: 'Test',
  w: 40,
  h: 40,
  edge: 'w',
  kind: 'test',
  hub: [20, 12],
  exits: [],
  tiles: Array(40).fill('w'.repeat(40)),
  props: [],
  waterKind: 'sea',
  cam: { pitch: 34, h: 9, fov: 1, orbit: { c: [20, 20], dead: 3, lag: 0.6, turn: 30 } },
  island: {
    c: [20, 20],
    coast: [
      [5, 5],
      [35, 5],
      [35, 35],
      [5, 35],
    ],
  },
  zones: [
    {
      k: 'town',
      poly: [
        [12, 8],
        [28, 8],
        [28, 16],
        [12, 16],
      ],
      lock: true,
    },
  ],
  islandGen: { v: 0, seed: 'x', dials: {} },
  ...o,
});

test('every game map passes the island checks, and test_island carries every contract field', () => {
  for (const [id, sc] of Object.entries(GAME_DATA.maps)) assert.deepEqual(islandProblems(sc), [], id);
  const T = GAME_DATA.maps.test_island;
  assert.ok(T, 'test_island is in the game data');
  for (const k of ['island', 'zones', 'islandGen', 'waterKind']) assert.ok(T[k], `test_island has ${k}`);
  assert.ok(T.cam.orbit, 'test_island has cam.orbit');
  assert.equal(T.edge, 'w');
  assert.ok(fits(T), JSON.stringify(ajv.errors));
});

test('a sound island passes the schema and the checks', () => {
  assert.ok(fits(island()), JSON.stringify(ajv.errors));
  assert.deepEqual(islandProblems(island()), []);
});

test('the schema refuses a wrong shape', () => {
  const bad = {
    'an orbit without its lag': { cam: { orbit: { c: [20, 20], dead: 3, turn: 30 } } },
    'a turn over 180': { cam: { orbit: { c: [20, 20], dead: 3, lag: 1, turn: 200 } } },
    'a coast of two points': {
      island: {
        c: [20, 20],
        coast: [
          [5, 5],
          [35, 5],
        ],
      },
    },
    'an unknown zone kind': { zones: [{ k: 'volcano', poly: island().zones[0].poly }] },
    'a lock that is not true or false': { zones: [{ k: 'town', poly: island().zones[0].poly, lock: 1 }] },
    'islandGen without a seed': { islandGen: { v: 0 } },
    'an unknown water kind': { waterKind: 'ocean' },
  };
  for (const [what, o] of Object.entries(bad)) assert.equal(fits(island(o)), false, what);
});

test('each planted fault gives its words', () => {
  const sq = island().island.coast,
    zone = island().zones[0].poly,
    cases = [
      [{ cam: { orbit: { c: [50, 20], dead: 3, lag: 1, turn: 30 } } }, 'cam.orbit.c (50, 20) is off the scene'],
      [
        { cam: { orbit: { c: [20, 20], dead: 25, lag: 1, turn: 30 } } },
        "cam.orbit.dead 25 m is not from 0 to under half the scene's shorter side",
      ],
      [
        { cam: { orbit: { c: [20, 20], dead: 3, lag: 0, turn: 30 } } },
        'cam.orbit.lag 0 s is not above 0 and at most 10',
      ],
      [
        { cam: { orbit: { c: [20, 20], dead: 3, lag: 1, turn: -5 } } },
        'cam.orbit.turn -5 degrees is not from 0 to 180',
      ],
      [
        { island: { c: [20, 20], coast: [...sq.slice(0, 3), [5, 45]] } },
        'island.coast has a point off the scene (5, 45)',
      ],
      [
        { island: { c: [20, 20], coast: [...sq, sq[0]] } },
        'island.coast repeats its first point at the end (the last point joins the first by itself)',
      ],
      [{ island: { c: [20, 20], coast: [sq[0], sq[2], sq[1], sq[3]] } }, 'island.coast crosses itself (sides 0 and 2)'],
      [{ island: { c: [2, 2], coast: sq } }, 'island.c (2, 2) is not inside the coast'],
      [{ edge: 'g' }, 'an island\'s edge is "g", not water (w or d)'],
      [
        { zones: [{ k: 'volcano', poly: zone }] },
        `zones[0] (volcano): no such zone kind (${ISLAND_ZONE_KINDS.join(', ')})`,
      ],
      [{ zones: [{ k: 'town', poly: zone.slice(0, 2) }] }, 'zones[0] (town) is not 3 or more [x, z] points'],
      /* IS-2: building plots */
      [
        { plots: [{ k: 'castle', x: 10, z: 10, w: 6, d: 5, a: 90 }] },
        `plots[0] (castle): no such plot kind (${ISLAND_PLOT_KINDS.join(', ')})`,
      ],
      [{ plots: [{ k: 'house', x: 50, z: 10, w: 6, d: 5, a: 90 }] }, 'plots[0] (house) is off the scene (50, 10)'],
      [
        { plots: [{ k: 'lab', x: 10, z: 10, w: 0, d: 5, a: 90 }] },
        'plots[0] (lab) is 0 x 5 m, not above 0 and at most 40',
      ],
    ];
  for (const [o, words] of cases) assert.deepEqual(islandProblems(island(o)), [words], words);
});

test("a locked island's ground can't change, its props can", () => {
  const T = structuredClone(GAME_DATA.maps.test_island),
    h0 = islandGroundHash(T);
  T.islandGen = { ...T.islandGen, lock: true, hash: h0 };
  assert.ok(fits(T), JSON.stringify(ajv.errors));
  assert.deepEqual(islandProblems(T), []);
  /* props, people and the look are free */
  T.props.push({ k: 'bench_wood', x: 60, z: 40 });
  T.sky = ['#000000', '#000000', '#000000'];
  assert.equal(islandGroundHash(T), h0);
  assert.deepEqual(islandProblems(T), []);
  const LOCKED =
    "the island's ground is locked but changed (unlock it in the Studio's Hub island editor first, then lock it again)";
  const changes = {
    'one ground letter': S => (S.tiles[0] = 'g' + S.tiles[0].slice(1)),
    'one height': S => (S.heights[30][30] += 0.01),
    'a coast point': S => (S.island.coast[0] = [S.island.coast[0][0] + 1, S.island.coast[0][1]]),
    "a zone's lock": S => (S.zones[0].lock = true),
    'a step': S => (S.steps = 'AAAA'),
  };
  for (const [what, change] of Object.entries(changes)) {
    const S = structuredClone(T);
    change(S);
    assert.notEqual(islandGroundHash(S), h0, what);
    assert.deepEqual(islandProblems(S), [LOCKED], what);
  }
  T.islandGen.hash = undefined;
  assert.deepEqual(islandProblems(T), ['islandGen.lock is on with no hash (lock it again in the Studio)']);
  /* unlocked, the ground is free again */
  T.islandGen.lock = false;
  T.tiles[0] = 'g' + T.tiles[0].slice(1);
  assert.deepEqual(islandProblems(T), []);
});

test('a map without island fields has nothing to check', () => {
  assert.deepEqual(islandProblems({ w: 10, h: 8, edge: 'g' }), []);
});

test('a point is inside a polygon or not', () => {
  const L = [
    [0, 0],
    [10, 0],
    [10, 4],
    [4, 4],
    [4, 10],
    [0, 10],
  ];
  assert.equal(islandPointIn(L, 2, 8), true);
  assert.equal(islandPointIn(L, 8, 8), false);
  assert.equal(islandPointIn(L, 8, 2), true);
});

test("the schema's water kinds are the renderer's", () => {
  const src = readFileSync(join(ROOT, 'game/js/walk/water-data.js'), 'utf8'),
    looks = src.slice(src.indexOf('WATER_KIND_LOOKS = ['), src.indexOf('const WATER_KIND_INDEX')),
    kinds = [...looks.matchAll(/^ {4}k: '(\w+)'/gm)].map(m => m[1]);
  assert.ok(kinds.length >= 9, `found ${kinds.length} kinds`);
  assert.deepEqual(MAP_SCHEMA.properties.waterKind.enum, kinds);
  assert.deepEqual(MAP_SCHEMA.properties.zones.items.properties.k.enum, ISLAND_ZONE_KINDS);
  assert.deepEqual(MAP_SCHEMA.properties.plots.items.properties.k.enum, ISLAND_PLOT_KINDS);
});
