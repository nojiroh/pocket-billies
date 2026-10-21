// RL-6: the run's node map (game/js/logic/run-map.js), on the tests' own small tables: rows from the landing to the
// boss, mini-boss rows with a town before each, one or two lanes, links only to the next row, and where it all sits on
// the bowl. run-map-real.test.mjs runs it on the game's data.
//   node --test --test-update-snapshots tools/test/run-map.test.mjs   remakes the frozen map (say why in the commit)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bowlCompass, bowlSeamTurn, bowlXY } from '../../game/js/logic/bowl.js';
import {
  RUN_BOWL,
  runBack,
  runExits,
  runMapMake,
  runMapNode,
  runMapRows,
  runMapRowsFit,
  runNext,
  runSpot,
  runWorldNode,
} from '../../game/js/logic/run-map.js';
import { newRun, validRun } from '../../game/js/logic/run-state.js';

const NODE_TYPES = {
  landing: { name: 'Landing', engine: 'scene' },
  route: { name: 'Route', engine: 'scene', weight: 4 },
  town: { name: 'Town', engine: 'scene', weight: 1 },
  miniboss: { name: 'Mini-boss', engine: 'scene' },
  boss: { name: 'Boss', engine: 'scene' },
};
const MAP_RULES = {
  rows: 9,
  minibosses: 2,
  first: 'landing',
  rest: 'town',
  guard: 'miniboss',
  last: 'boss',
  wide: 0.7,
  cross: 0.25,
  biomes: { meadow: 3, lake: 2, thicket: 2, ridge: 1, autumn: 1 },
};
const START = {
  team: [],
  se: 0,
  items: {},
  coins: {},
  trip: { node: 0, plan: [] },
  wild: {},
  eggs: [],
  flags: {},
  seats: [],
  visited: {},
};
const seeds = n => Array.from({ length: n }, (_, k) => `T${k.toString(36).toUpperCase()}SEED`);
/** the rules for a number of rows: two mini-bosses where they fit, else one */
const rulesFor = rows => {
  const two = { ...MAP_RULES, rows };
  return runMapRowsFit(two) ? two : { ...MAP_RULES, rows, minibosses: 1 };
};
const rowsOf = map => 1 + Math.max(...map.nodes.map(n => n.row));
const widthOf = (map, row) => map.nodes.filter(n => n.row === row).length;
const xy = (map, i) => {
  const s = runSpot(map, i);
  return bowlXY(s.a, s.r);
};
const links = map => map.nodes.flatMap((n, a) => n.to.map(b => [a, b]));

test("the rows: the landing first, the boss last, the mini-bosses on rows of their own with a town's row before", () => {
  assert.deepEqual(runMapRows(MAP_RULES), ['first', '', 'rest', 'guard', '', 'rest', 'guard', '', 'last']);
  assert.deepEqual(runMapRows({ ...MAP_RULES, rows: 5, minibosses: 1 }), ['first', '', 'rest', 'guard', 'last']);
  assert.deepEqual(runMapRows({ ...MAP_RULES, rows: 6, minibosses: 0 }), ['first', '', '', '', '', 'last']);
  // what can't be laid out: two mini-bosses side by side, one on the boss's row, one next to the landing
  assert.equal(runMapRowsFit({ ...MAP_RULES, rows: 5 }), false);
  assert.equal(runMapRowsFit({ ...MAP_RULES, rows: 3, minibosses: 1 }), false);
  assert.equal(runMapRowsFit({ ...MAP_RULES, rows: 7, minibosses: 3 }), false);
  // the fewest: the landing, a town, the mini-boss, the boss
  assert.deepEqual(runMapRows({ ...MAP_RULES, rows: 4, minibosses: 1 }), ['first', 'rest', 'guard', 'last']);
  assert.ok(runMapRowsFit({ ...MAP_RULES, rows: 4, minibosses: 1 }));
  for (let rows = 6; rows <= 12; rows++) assert.ok(runMapRowsFit({ ...MAP_RULES, rows }), `${rows} rows`);
  assert.throws(() => runMapMake('X', NODE_TYPES, { ...MAP_RULES, rows: 5 }), /can't hold/);
  const noFill = Object.fromEntries(Object.entries(NODE_TYPES).map(([k, t]) => [k, { ...t, weight: 0 }]));
  assert.throws(() => runMapMake('X', noFill, MAP_RULES), /no node type/);
});

test('the same seed makes the same map; other seeds make others', t => {
  const a = runMapMake('RL6SEED', NODE_TYPES, MAP_RULES);
  assert.deepEqual(runMapMake('RL6SEED', NODE_TYPES, MAP_RULES), a);
  const shapes = new Set(seeds(40).map(s => JSON.stringify(runMapMake(s, NODE_TYPES, MAP_RULES))));
  assert.ok(shapes.size >= 35, `${shapes.size} different maps from 40 seeds`);
  t.assert.snapshot(a);
});

test("a rule moves only what it rules: a lane switch's odds don't change the types or biomes", () => {
  for (const s of seeds(50)) {
    const a = runMapMake(s, NODE_TYPES, MAP_RULES),
      b = runMapMake(s, NODE_TYPES, { ...MAP_RULES, cross: 0.9 });
    assert.deepEqual(
      b.nodes.map(n => [n.type, n.row, n.lane, n.biome]),
      a.nodes.map(n => [n.type, n.row, n.lane, n.biome])
    );
  }
});

test('over many seeds and 5 to 12 rows: every path walks every row, two links at most each way, nothing crosses', () => {
  let count = 0,
    maps = 0;
  for (let rows = 5; rows <= 12; rows++) {
    const M = rulesFor(rows),
      roles = runMapRows(M);
    for (const s of seeds(rows === 9 ? 500 : 100)) {
      const map = runMapMake(s, NODE_TYPES, M),
        N = map.nodes;
      assert.equal(rowsOf(map), rows);
      // numbered row by row, west to east
      N.forEach((n, i) => {
        if (i) assert.ok(n.row > N[i - 1].row || (n.row === N[i - 1].row && n.lane === N[i - 1].lane + 1));
        assert.ok(n.lane < widthOf(map, n.row));
        assert.ok(Object.hasOwn(M.biomes, n.biome), n.biome);
        assert.equal(n.seen, 0);
      });
      // what each row holds
      roles.forEach((role, row) => {
        const here = N.filter(n => n.row === row);
        assert.ok(here.length >= 1 && here.length <= 2);
        if (role === 'first' || role === 'last' || role === 'guard') assert.equal(here.length, 1, `row ${row}`);
        const want = { first: M.first, last: M.last, guard: M.guard, rest: M.rest }[role];
        for (const n of here) assert.ok(want ? n.type === want : NODE_TYPES[n.type].weight > 0, `${s} row ${row}`);
      });
      // links: only to the next row, at most two each way, every node on the way from the landing to the boss
      for (const [a, b] of links(map)) assert.equal(N[b].row, N[a].row + 1);
      N.forEach((n, i) => {
        const ahead = runNext(map, i),
          back = runBack(map, i);
        assert.ok(ahead.length <= 2 && back.length <= 2);
        assert.equal(ahead.length === 0, n.row === rows - 1, `node ${i} leads on unless it is the boss`);
        assert.equal(back.length === 0, n.row === 0, `node ${i} is reached unless it is the landing`);
        for (const j of back) assert.ok(runNext(map, j).includes(i));
      });
      // no two links between the same rows cross (lane order kept)
      const L = links(map);
      for (const [a, b] of L)
        for (const [c, d] of L)
          if (N[a].row === N[c].row && N[a].lane < N[c].lane)
            assert.ok(N[b].lane <= N[d].lane, `${s}: ${a}->${b} crosses ${c}->${d}`);
      // the save's check takes it
      assert.ok(validRun(JSON.parse(JSON.stringify({ ...newRun(s, 1, 3, START), map }))), s);
      count += N.length;
      maps++;
    }
  }
  assert.ok(maps > 1000);
});

test('the 9-row map: 9 on every path, two lanes on a free or town row as often as `wide` says, some lane switches', () => {
  // five rows may have two lanes (rows 1, 2, 4, 5, 7): 9 + 5 x 0.7 = 12.5 nodes on average, 9 to 14
  const sizes = seeds(500).map(s => runMapMake(s, NODE_TYPES, MAP_RULES).nodes.length),
    mean = sizes.reduce((a, b) => a + b, 0) / sizes.length,
    want = 9 + runMapRows(MAP_RULES).filter(r => r === '' || r === 'rest').length * MAP_RULES.wide;
  assert.equal(want, 12.5);
  assert.ok(Math.abs(mean - want) < 0.3, `mean ${mean}`);
  assert.ok(Math.min(...sizes) >= 9 && Math.max(...sizes) <= 14);
  const switches = seeds(500).filter(s => {
    const map = runMapMake(s, NODE_TYPES, MAP_RULES);
    return links(map).some(
      ([a, b]) =>
        map.nodes[a].lane !== map.nodes[b].lane &&
        widthOf(map, map.nodes[a].row) === 2 &&
        widthOf(map, map.nodes[b].row) === 2
    );
  }).length;
  assert.ok(switches > 100 && switches < 400, `${switches} of 500 maps switch lanes`);
});

test('exits: one link in the middle of a side, two at a quarter and three quarters; both ends of a link agree', () => {
  for (const s of seeds(200)) {
    const map = runMapMake(s, NODE_TYPES, MAP_RULES);
    map.nodes.forEach((n, i) => {
      const e = runExits(map, i);
      for (const side of [e.north, e.south])
        assert.deepEqual(
          side.map(x => x.t),
          [[], [0.5], [0.25, 0.75]][side.length]
        );
      for (const { to } of e.north) assert.ok(runExits(map, to).south.some(x => x.from === i));
      assert.deepEqual(e.north.map(x => x.to).sort(), runNext(map, i).sort());
      assert.deepEqual(e.south.map(x => x.from).sort(), runBack(map, i).sort());
    });
  }
  const tooMany = {
    nodes: [
      { type: 'route', row: 0, lane: 0, to: [1, 2, 3], seen: 0 },
      ...[0, 1, 2].map(lane => ({ type: 'route', row: 1, lane, to: [], seen: 0 })),
    ],
  };
  assert.throws(() => runExits(tooMany, 0), /more than two/);
});

test('on the bowl: rows from the rim towards the centre, lanes apart, roads leave and arrive the way their exits face', () => {
  for (let rows = 5; rows <= 12; rows++)
    for (const s of seeds(60)) {
      const map = runMapMake(s, NODE_TYPES, rulesFor(rows)),
        N = map.nodes,
        P = N.map((_, i) => xy(map, i));
      N.forEach((n, i) => {
        const { a, r } = runSpot(map, i);
        assert.ok(a >= 0 && a < 360 && r > 0 && r < 1, `${a}, ${r}`);
        if (n.row === 0) assert.ok(Math.abs(r - RUN_BOWL.outer) < 1e-9);
        if (n.row === rows - 1) assert.ok(Math.abs(r - RUN_BOWL.inner) < 1e-9);
      });
      // pins at least 0.07 of the bowl's radius apart, Copperleaf at the centre too
      const all = [[0, 0], ...P];
      for (let i = 0; i < all.length; i++)
        for (let j = i + 1; j < all.length; j++) {
          const d = Math.hypot(all[i][0] - all[j][0], all[i][1] - all[j][1]);
          assert.ok(d >= 0.07 - 1e-9, `${s}, ${rows} rows: pins ${i - 1} and ${j - 1} are ${d.toFixed(3)} apart`);
        }
      // a road turns within the hub's 30 degrees from its exits, a lane switch within 45
      for (const [a, b] of links(map)) {
        const turn = bowlSeamTurn(P[a], P[b], 'north', 'south'),
          switching = N[a].lane !== N[b].lane && widthOf(map, N[a].row) === 2 && widthOf(map, N[b].row) === 2;
        assert.ok(turn <= (switching ? 45 : 30), `${s}, ${rows} rows: ${a}->${b} turns ${turn.toFixed(1)}`);
      }
      // each node's exits run west to east in the order its neighbours lie along its east on the bowl
      N.forEach((_, i) => {
        const { east } = bowlCompass(P[i][0], P[i][1]),
          along = j => (P[j][0] - P[i][0]) * east[0] + (P[j][1] - P[i][1]) * east[1],
          e = runExits(map, i);
        for (const side of [e.north.map(x => [x.to, x.t]), e.south.map(x => [x.from, x.t])]) {
          const byPlace = side
            .slice()
            .sort((p, q) => along(p[0]) - along(q[0]))
            .map(x => x[1]);
          assert.deepEqual(byPlace, byPlace.slice().sort(), `${s} node ${i}: its exits' t run west to east`);
        }
      });
    }
});

test("the world's numbering: Copperleaf first, map node i is world node i + 1", () => {
  assert.equal(runWorldNode(0), 1);
  assert.equal(runMapNode(1), 0);
  assert.equal(runMapNode(0), -1);
  for (let i = 0; i < 20; i++) assert.equal(runMapNode(runWorldNode(i)), i);
});
