// Map generator MG-2: the seam rules (game/js/logic/seam-rules.js), the one copy of how two places' maps must meet
// (check-data.mjs runs them on the game's data). The game's links pass; on two small maps, each planted fault gives
// the words check-data has always printed for it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';
import { PB_DATA } from '../data-files.mjs';

const R = modules['seam-rules'];
const T = GAME_DATA.scenery.terrains;
const run = D => {
  const L = R.seamRulesLinks({
    roads: D.roads,
    roadOf: l => PB_DATA.road(D, l),
    locations: D.locations,
    maps: D.maps,
    terrains: T,
  });
  return [...L.problems, ...R.seamRulesPlaces({ locations: D.locations, maps: D.maps, used: L.used })];
};

test("the game's links pass the seam rules", () => {
  assert.deepEqual(run(GAME_DATA), []);
});

/* two meadows 40 × 30, a east to b west, both exits half way along */
const map = (exits, ground = 'g') => ({
  w: 40,
  h: 30,
  edge: 'g',
  tiles: Array.from({ length: 30 }, () => ground.repeat(40)),
  edgeExits: exits,
});
const pair = () => ({
  locations: [
    { id: 'a', mapId: 'a' },
    { id: 'b', mapId: 'b' },
  ],
  maps: {
    a: map([{ id: 'east', side: 'E', t: 0.5, width: 2 }]),
    b: map([{ id: 'west', side: 'W', t: 0.5, width: 2 }]),
  },
  roads: [{ id: 'road:a-b', kind: 'seam', a: { map: 'a', exit: 'east' }, b: { map: 'b', exit: 'west' } }],
});

test('a pair that meets passes; an offset of a whole number of metres is still a join', () => {
  const D = pair();
  assert.deepEqual(run(D), []);
  D.maps.b.edgeExits[0].t = 0.5 + 3 / 30;
  assert.deepEqual(run(D), []);
});

test('each planted fault gives its words', () => {
  /** [the fault, how to plant it, the problems] */
  const cases = [
    [
      'not facing',
      D => (D.maps.b.edgeExits[0].side = 'N'),
      [['roads.json', "road:a-b: the exits don't face each other (a E, b N)"]],
    ],
    [
      'other widths',
      D => (D.maps.b.edgeExits[0].width = 3),
      [['roads.json', 'road:a-b: the exits are 2 m and 3 m wide']],
    ],
    [
      'missing by half a metre',
      D => (D.maps.b.edgeExits[0].t = 0.5 + 0.5 / 30),
      [['roads.json', 'road:a-b: the exits miss each other by 0.50 m']],
    ],
    [
      'water at an exit',
      D => (D.maps.a = { ...D.maps.a, tiles: D.maps.a.tiles.map(r => 'w'.repeat(r.length)) }),
      [['roads.json', "road:a-b: the ground at a's exit east can't be walked on"]],
    ],
    [
      'no such exit',
      D => (D.roads[0].a.exit = 'north'),
      [
        ['roads.json', 'road:a-b: a has no exit north (a road that joins nothing)'],
        ['maps/a.json', 'exit east is used by no link'],
      ],
    ],
    [
      'a second link on one exit',
      D => D.roads.push({ ...D.roads[0], id: 'road:a-b2' }),
      [
        ['maps/a.json', 'exit east is used by road:a-b and road:a-b2'],
        ['maps/b.json', 'exit west is used by road:a-b and road:a-b2'],
      ],
    ],
    [
      'two links with one id',
      D => D.roads.push({ ...D.roads[0] }),
      [
        ['roads.json', 'two links are road:a-b'],
        ['maps/a.json', 'exit east is used by road:a-b and road:a-b'],
        ['maps/b.json', 'exit west is used by road:a-b and road:a-b'],
      ],
    ],
    [
      'to itself',
      D => (D.roads[0].b = { map: 'a', exit: 'east' }),
      [
        ['roads.json', 'road:a-b joins a to itself'],
        ['roads.json', "road:a-b: the exits don't face each other (a E, a E)"],
        ['maps/a.json', 'exit east is used by road:a-b and road:a-b'],
        ['maps/b.json', 'exit west is used by no link'],
      ],
    ],
    [
      'a place that is not there',
      D => (D.roads[0].b.map = 'c'),
      [
        ['roads.json', 'road:a-b joins a and c, not two places'],
        ['maps/a.json', 'exit east is used by no link'],
        ['maps/b.json', 'exit west is used by no link'],
      ],
    ],
    [
      'three exits on a side, too close',
      D =>
        D.maps.a.edgeExits.push(
          { id: 'east2', side: 'E', t: 0.1, width: 2 },
          { id: 'east3', side: 'E', t: 0.9, width: 2 }
        ),
      [
        ['maps/a.json', 'exit east2 is used by no link'],
        ['maps/a.json', 'exit east3 is used by no link'],
        ['maps/a.json', '3 exits on its E side (two at most)'],
        ['maps/a.json', 'two exits on its E side 12.0 m apart (44 m at least)'],
        ['maps/a.json', 'two exits on its E side 12.0 m apart (44 m at least)'],
      ],
    ],
    [
      'a lift with no lift prop',
      D => (D.roads[0].kind = 'lift'),
      [
        ['roads.json', 'road:a-b: a has no lift going to b'],
        ['roads.json', 'road:a-b: b has no lift going to a'],
        ['maps/a.json', 'exit east is used by no link'],
        ['maps/b.json', 'exit west is used by no link'],
      ],
    ],
  ];
  for (const [what, plant, want] of cases) {
    const D = pair();
    plant(D);
    assert.deepEqual(run(D), want, what);
  }
});

test('the pair and side rules on their own', () => {
  const { maps } = pair();
  assert.deepEqual(R.seamRulesPair(maps.a, maps.a.edgeExits[0], maps.b, maps.b.edgeExits[0]), []);
  assert.deepEqual(R.seamRulesSides(maps.a), []);
  assert.equal(R.seamRulesAlong(maps.a, maps.a.edgeExits[0]), 15);
  assert.deepEqual(R.seamRulesExitPoint(maps.a, maps.a.edgeExits[0]), [38.9, 15]);
});
