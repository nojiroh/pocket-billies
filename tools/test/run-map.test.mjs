// RL-6: the run's node map and its clock (game/js/logic/run-map.js), on the tests' own small tables: rows from the
// landing to the boss, mini-boss rows with a town after each (WM-2), one or two lanes, links only to the next row, the
// region grid's footprints (WM-2), where it all sits on the bowl; the days, what the map shows and the forecast. run-map-real.test.mjs runs it on the game's data.
//   node --test --test-update-snapshots tools/test/run-map.test.mjs   remakes the frozen map (say why in the commit)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bowlCompass, bowlSeamTurn, bowlXY } from '../../game/js/logic/bowl.js';
import {
  RUN_BOWL,
  runArrive,
  runBack,
  runExits,
  runForecastFill,
  runGridCut,
  runGridExits,
  runGridLinks,
  runGridShared,
  runGridSide,
  RUN_GRID,
  runLinkDir,
  runMapLength,
  runMapMake,
  runMapNode,
  runMapRows,
  runMapRowsFit,
  runMapStart,
  runNext,
  runNodeSeed,
  runReveal,
  runShapeSize,
  runSpot,
  runSpotBoxes,
  runSpotCells,
  runWeather,
  runWorldNode,
} from '../../game/js/logic/run-map.js';
import { newRun, validRun } from '../../game/js/logic/run-state.js';
import { CLIMATE_WEATHER_ODDS } from '../../game/js/logic/weather.js';

const NODE_TYPES = {
  landing: { name: 'Landing', engine: 'scene' },
  route: { name: 'Route', engine: 'scene', weight: 4, routeLike: true },
  town: { name: 'Town', engine: 'scene', weight: 1 },
  miniboss: { name: 'Mini-boss', engine: 'scene', routeLike: true },
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
  pyramids: {},
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
const overlaps = (a, b) =>
  a.at[0] < b.at[0] + b.size[0] &&
  b.at[0] < a.at[0] + a.size[0] &&
  a.at[1] < b.at[1] + b.size[1] &&
  b.at[1] < a.at[1] + a.size[1];

test("the rows (WM-2): the landing first, the boss last, each mini-boss on a row of its own with its town's row after, a free row before each mini-boss and the boss", () => {
  assert.deepEqual(runMapRows(MAP_RULES), ['first', '', 'guard', 'rest', '', 'guard', 'rest', '', 'last']);
  assert.deepEqual(runMapRows({ ...MAP_RULES, rows: 10 }), [
    'first',
    '',
    'guard',
    'rest',
    '',
    '',
    'guard',
    'rest',
    '',
    'last',
  ]);
  assert.deepEqual(runMapRows({ ...MAP_RULES, rows: 12, minibosses: 3 }), [
    'first',
    '',
    'guard',
    'rest',
    '',
    'guard',
    'rest',
    '',
    'guard',
    'rest',
    '',
    'last',
  ]);
  assert.deepEqual(runMapRows({ ...MAP_RULES, rows: 6, minibosses: 1 }), ['first', '', 'guard', 'rest', '', 'last']);
  assert.deepEqual(runMapRows({ ...MAP_RULES, rows: 6, minibosses: 0 }), ['first', '', '', '', '', 'last']);
  // what can't be laid out: a mini-boss with no free row before it or its town right before the boss
  assert.equal(runMapRowsFit({ ...MAP_RULES, rows: 8 }), false);
  assert.equal(runMapRowsFit({ ...MAP_RULES, rows: 5, minibosses: 1 }), false);
  assert.equal(runMapRowsFit({ ...MAP_RULES, rows: 11, minibosses: 3 }), false);
  // the fewest with a mini-boss: the landing, a route, the mini-boss, its town, a route, the boss
  assert.ok(runMapRowsFit({ ...MAP_RULES, rows: 6, minibosses: 1 }));
  for (let rows = 9; rows <= 12; rows++) assert.ok(runMapRowsFit({ ...MAP_RULES, rows }), `${rows} rows`);
  assert.throws(() => runMapMake('X', NODE_TYPES, { ...MAP_RULES, rows: 8 }), /can't hold/);
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
  for (let rows = 6; rows <= 12; rows++) {
    const M = rulesFor(rows),
      roles = runMapRows(M);
    for (const s of seeds(rows === 9 ? 500 : 100)) {
      const map = runMapMake(s, NODE_TYPES, M),
        N = map.nodes;
      assert.equal(rowsOf(map), rows);
      // numbered row by row, lane by lane
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
      // WM-2: the grid: footprints that never overlap, every link across a shared edge east, north or south, the
      // landing's two east (lane 0) and north (lane 1), every lane of the free row before a mini-boss route-like
      N.forEach((n, i) => {
        assert.deepEqual(n.size, [2, 1]);
        for (let j = 0; j < i; j++) assert.ok(!overlaps(n, N[j]), `${s}: ${j} and ${i} overlap`);
        for (const j of n.to) assert.ok(['E', 'N', 'S'].includes(runLinkDir(map, i, j)), `${s}: ${i}->${j}`);
        if (roles[n.row + 1] === 'guard') assert.ok(NODE_TYPES[n.type].routeLike, `${s}: ${n.type} before a mini-boss`);
      });
      assert.deepEqual(N[0].at, [0, 0]);
      assert.deepEqual(
        N[0].to.map(j => [N[j].lane, runLinkDir(map, 0, j)]),
        [
          [0, 'E'],
          [1, 'N'],
        ]
      );
      // the save's check takes it
      assert.ok(validRun(JSON.parse(JSON.stringify({ ...newRun(s, 1, 3, START), map }))), s);
      count += N.length;
      maps++;
    }
  }
  assert.ok(maps > 1000);
});

test('the 9-row map: 9 on every path, two lanes on a free or town row as often as `wide` says, some lane switches', () => {
  // five rows may have two lanes (rows 1, 3, 4, 6, 7), row 1 always (WM-2: the landing's two ways on): 9 + 1 + 4 x 0.7
  // = 12.8 nodes on average, 10 to 14
  const sizes = seeds(500).map(s => runMapMake(s, NODE_TYPES, MAP_RULES).nodes.length),
    mean = sizes.reduce((a, b) => a + b, 0) / sizes.length,
    want = 10 + (runMapRows(MAP_RULES).filter(r => r === '' || r === 'rest').length - 1) * MAP_RULES.wide;
  assert.ok(Math.abs(want - 12.8) < 1e-9);
  assert.ok(Math.abs(mean - want) < 0.3, `mean ${mean}`);
  assert.ok(Math.min(...sizes) >= 10 && Math.max(...sizes) <= 14);
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

test('exits: one link in the middle of a side, two 10 m and 54 m along its 64 m; both ends of a link agree', () => {
  for (const s of seeds(200)) {
    const map = runMapMake(s, NODE_TYPES, MAP_RULES);
    map.nodes.forEach((n, i) => {
      const e = runExits(map, i);
      for (const side of [e.ahead, e.back])
        assert.deepEqual(
          side.map(x => x.t),
          [[], [0.5], [0.15625, 0.84375]][side.length]
        );
      for (const { to } of e.ahead) assert.ok(runExits(map, to).back.some(x => x.from === i));
      assert.deepEqual(e.ahead.map(x => x.to).sort(), runNext(map, i).sort());
      assert.deepEqual(e.back.map(x => x.from).sort(), runBack(map, i).sort());
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

/** a map as a run from before WM-2 has it: no footprints */
const unGridded = map => {
  for (const n of map.nodes) (delete n.at, delete n.size);
  return map;
};
test('a run from before WM-2 on the bowl (RL-8b, WM-1): rows from the west to the east across the bowl, lanes apart, maps facing north, roads leave and arrive the way their exits face', () => {
  for (let rows = 6; rows <= 12; rows++)
    for (const s of seeds(60)) {
      const map = unGridded(runMapMake(s, NODE_TYPES, rulesFor(rows))),
        N = map.nodes,
        P = N.map((_, i) => xy(map, i));
      N.forEach((n, i) => {
        const { a, r, up } = runSpot(map, i);
        assert.ok(a >= 0 && a < 360 && r >= 0 && r < 0.8, `${a}, ${r}`);
        assert.equal(up, 90, "a run's maps face the bowl's north");
        if (n.row === 0) assert.ok(P[i][0] < -0.3, `the landing is in the west (${P[i][0]})`);
        if (n.row === rows - 1) assert.ok(P[i][0] > 0.3, `the boss is in the east (${P[i][0]})`);
        for (const j of n.to) assert.ok(P[j][0] > P[i][0], `${i}->${j} goes east`);
      });
      // pins at least 0.1 of the bowl's radius apart; a place's map (112 x 64 m, facing north) never over another's
      for (let i = 0; i < P.length; i++)
        for (let j = i + 1; j < P.length; j++) {
          const dx = Math.abs(P[i][0] - P[j][0]),
            dy = Math.abs(P[i][1] - P[j][1]);
          assert.ok(
            Math.hypot(dx, dy) >= 0.1 - 1e-9,
            `${s}, ${rows} rows: pins ${i} and ${j} are ${Math.hypot(dx, dy).toFixed(3)} apart`
          );
          assert.ok(dx >= 0.112 || dy >= 0.064, `${s}, ${rows} rows: the maps of ${i} and ${j} overlap`);
        }
      // a road turns within the hub's 30 degrees from its exits, a lane switch within 45
      for (const [a, b] of links(map)) {
        const turn = bowlSeamTurn(P[a], P[b], 'east', 'west', 90),
          switching = N[a].lane !== N[b].lane && widthOf(map, N[a].row) === 2 && widthOf(map, N[b].row) === 2;
        assert.ok(turn <= (switching ? 45 : 30), `${s}, ${rows} rows: ${a}->${b} turns ${turn.toFixed(1)}`);
      }
      // each node's exits run south to north in the order its neighbours lie along its north on the bowl
      N.forEach((_, i) => {
        const { north } = bowlCompass(P[i][0], P[i][1], 90),
          along = j => (P[j][0] - P[i][0]) * north[0] + (P[j][1] - P[i][1]) * north[1],
          e = runExits(map, i);
        for (const side of [e.ahead.map(x => [x.to, x.t]), e.back.map(x => [x.from, x.t])]) {
          const byPlace = side
            .slice()
            .sort((p, q) => along(p[0]) - along(q[0]))
            .map(x => x[1]);
          assert.deepEqual(byPlace, byPlace.slice().sort(), `${s} node ${i}: its exits' t run south to north`);
        }
      });
    }
});

test("WM-4: on the bowl at the region grid: every place at its cells, to the walk's scale, the region centred, linked places touching", () => {
  for (let rows = 6; rows <= 12; rows++)
    for (const s of seeds(60)) {
      const map = runMapMake(s, NODE_TYPES, rulesFor(rows)),
        N = map.nodes,
        B = runSpotBoxes(map),
        P = N.map((_, i) => xy(map, i)),
        eps = 1e-9;
      assert.ok(B, `${s}: a gridded map has boxes`);
      N.forEach((n, i) => {
        const b = B[i];
        assert.equal(runSpot(map, i).up, 90, "a run's maps face the bowl's north");
        assert.ok(
          Math.abs(P[i][0] - b.x) < 1e-6 && Math.abs(P[i][1] - b.y) < 1e-6,
          `${s}: ${i}'s spot is its box's middle`
        );
        assert.ok(Math.abs(b.w - n.size[0] * 0.064) < eps && Math.abs(b.h - n.size[1] * 0.064) < eps, '64 m cells');
        for (const [cx, cy] of [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ])
          assert.ok(Math.hypot(b.x + (cx * b.w) / 2, b.y + (cy * b.h) / 2) < 0.8, `${s}: ${i} inside the bowl`);
      });
      /* the region's cells centred on the bowl */
      const x0 = Math.min(...B.map(b => b.x - b.w / 2)),
        x1 = Math.max(...B.map(b => b.x + b.w / 2)),
        y0 = Math.min(...B.map(b => b.y - b.h / 2)),
        y1 = Math.max(...B.map(b => b.y + b.h / 2));
      assert.ok(Math.abs(x0 + x1) < 1e-6 && Math.abs(y0 + y1) < 1e-6, `${s}: the region centred`);
      const landing = N.findIndex(n => n.row === 0),
        boss = N.findIndex(n => n.type === 'boss');
      assert.ok(B[landing].x < 0 && B[boss].x > 0, `${s}: the landing in the west, the boss in the east`);
      /* no two places' boxes overlap; linked ones share an edge */
      for (let i = 0; i < B.length; i++)
        for (let j = i + 1; j < B.length; j++) {
          const dx = Math.abs(B[i].x - B[j].x) - (B[i].w + B[j].w) / 2,
            dy = Math.abs(B[i].y - B[j].y) - (B[i].h + B[j].h) / 2;
          assert.ok(dx > -eps || dy > -eps, `${s}: ${i} and ${j} overlap`);
        }
      for (const [a, b] of links(map)) {
        const dx = Math.abs(B[a].x - B[b].x) - (B[a].w + B[b].w) / 2,
          dy = Math.abs(B[a].y - B[b].y) - (B[a].h + B[b].h) / 2;
        assert.ok(
          (Math.abs(dx) < eps && dy < -eps) || (Math.abs(dy) < eps && dx < -eps),
          `${s}: ${a}->${b} touch along an edge`
        );
      }
    }
});

test("WM-4: a side area's places on free cells from their obstacle's, a chain of touching footprints", () => {
  const map = runMapMake('WM4SIDE', NODE_TYPES, rulesFor(9)),
    from = map.nodes.findIndex(n => n.row === 3),
    first = map.nodes.length;
  for (let k = 0; k < 3; k++)
    map.nodes.push({ type: 'route', row: 4, lane: 0, to: k < 2 ? [first + k + 1] : [], seen: 0, side: 1 });
  map.side = {
    kind: 'detour',
    move: 'x',
    name: 'x',
    from,
    to: map.nodes[from].to[0],
    nodes: [first, first + 1, first + 2],
  };
  const C = runSpotCells(map);
  assert.ok(C, 'cells for every place');
  for (let i = 0; i < C.length; i++)
    for (let j = i + 1; j < C.length; j++) assert.ok(!overlaps(C[i], C[j]), `${i} and ${j} overlap`);
  const chain = [from, first, first + 1, first + 2];
  for (let k = 1; k < chain.length; k++)
    assert.ok(runGridSide(C[chain[k - 1]], C[chain[k]]), `${chain[k - 1]} and ${chain[k]} touch`);
  assert.deepEqual(C[first].size, [2, 1]);
  const north = { at: [C[from].at[0], C[from].at[1] + C[from].size[1]], size: [2, 1] };
  if (!C.slice(0, first).some(c => overlaps(c, north)))
    assert.deepEqual(C[first], north, 'the first north of its obstacle when free');
  assert.equal(map.nodes[first].at, undefined, 'worked out, never stored');
  /* a run from before WM-2: no cells, no boxes; its spots from rows and lanes */
  unGridded(map);
  assert.equal(runSpotCells(map), null);
  assert.equal(runSpotBoxes(map), null);
  assert.ok(runSpot(map, 0).r > 0.3, 'the landing near the rim, as before');
});

test("the world's numbering: Copperleaf first, map node i is world node i + 1", () => {
  assert.equal(runWorldNode(0), 1);
  assert.equal(runMapNode(1), 0);
  assert.equal(runMapNode(0), -1);
  for (let i = 0; i < 20; i++) assert.equal(runMapNode(runWorldNode(i)), i);
});

/* ---------- the clock (owner, 8.10): a day per arrival, backtracking included; the landing is day 1 ---------- */
const RUN_RULES = { map: MAP_RULES, clock: { ahead: 7 }, reveal: { icons: 1, unknown: 2 } };
const BIOMES = Object.fromEntries(Object.keys(MAP_RULES.biomes).map(b => [b, { climate: 'mild' }]));
const DATA = { nodeTypes: NODE_TYPES, biomes: BIOMES, rules: RUN_RULES };
/** a save on a run that has its map (as at the mast, before the flight) */
const onRun = seed => {
  const s = { run: newRun(seed, 1, 3, START), trip: { node: 0, plan: [] } };
  runMapStart(s.run, DATA);
  return s;
};
/** the fewest nodes from the landing to the boss (a search, not the row count) */
const shortest = map => {
  const last = map.nodes.length - 1,
    seen = new Map([[0, 1]]),
    queue = [0];
  while (queue.length) {
    const i = queue.shift();
    for (const j of runNext(map, i)) if (!seen.has(j)) (seen.set(j, seen.get(i) + 1), queue.push(j));
  }
  return seen.get(last);
};

test('the shortest walk to the boss: a row a day from the landing (RL-R2: no deadline on top)', () => {
  for (const s of seeds(100)) assert.equal(shortest(runMapMake(s, NODE_TYPES, MAP_RULES)), 9);
});

test("what's shown: the rows up to one ahead with their type, the next as '?', the boss always; never less", () => {
  const map = {
    nodes: [0, 1, 2, 3, 4, 5].map(row => ({ type: 'route', row, lane: 0, to: row < 5 ? [row + 1] : [], seen: 0 })),
  };
  runReveal(map, 2, RUN_RULES.reveal);
  assert.deepEqual(
    map.nodes.map(n => n.seen),
    [2, 2, 2, 2, 1, 2]
  );
  map.nodes[4].seen = 2;
  runReveal(map, 0, RUN_RULES.reveal);
  assert.deepEqual(
    map.nodes.map(n => n.seen),
    [2, 2, 2, 2, 2, 2],
    'what was shown stays shown'
  );
});

test("a new run's map: no deadline, the landing's view, a week of forecast for every node, none for the hub", () => {
  const { run } = onRun('RL6START'),
    map = run.map;
  assert.equal(run.deadline, undefined);
  assert.equal(run.clock, 1);
  assert.equal(run.forecast.length, map.nodes.length + 1);
  assert.deepEqual(run.forecast[0], []);
  for (const days of run.forecast.slice(1)) assert.equal(days.length, 1 + 7);
  for (const n of map.nodes) assert.equal(n.seen, n.row <= 1 || n.row === 8 ? 2 : n.row === 2 ? 1 : 0, `row ${n.row}`);
  assert.ok(validRun(JSON.parse(JSON.stringify(run))));
});

test('arriving: the landing first on day 1, then a day for each linked node, forward or back; nowhere else', () => {
  const s = onRun('RL6WALK'),
    map = s.run.map,
    before = JSON.stringify(s),
    ahead = runNext(map, 0)[0];
  assert.equal(runArrive(s, ahead, DATA), 0, 'not before the landing');
  assert.equal(runArrive(s, 99, DATA), 0, 'no such node');
  assert.equal(JSON.stringify(s), before, 'a refused arrival changes nothing');
  assert.equal(runArrive(s, 0, DATA), 1, 'the landing is day 1');
  assert.deepEqual([s.run.path, s.trip.node, s.run.clock], [[0], 1, 1]);
  assert.equal(runArrive(s, 0, DATA), 0, 'already here');
  assert.equal(runArrive(s, ahead, DATA), 2);
  assert.deepEqual([s.run.path, s.trip.node], [[0, ahead], runWorldNode(ahead)]);
  for (const n of map.nodes) if (n.row <= 2) assert.equal(n.seen, 2, `row ${n.row} shown from row 1`);
  const far = map.nodes.findIndex(n => n.row === 3);
  assert.equal(runArrive(s, far, DATA), 0, 'two rows ahead');
  assert.equal(runArrive(s, 0, DATA), 3, 'walking back costs a day');
  assert.deepEqual(s.run.path, [0, ahead, 0]);
  for (const days of s.run.forecast.slice(1)) assert.equal(days.length, 3 + 7, 'the forecast keeps a week ahead');
  // on to the boss: one row a day from here, two days past the shortest walk's day 9
  let at = 0;
  while (runNext(map, at).length) {
    at = runNext(map, at).at(-1);
    assert.ok(runArrive(s, at, DATA) > 0);
  }
  assert.equal(s.run.clock, 3 + 8);
  assert.equal(runArrive(s, runBack(map, at)[0], DATA), 12);
  assert.equal(runArrive(s, at, DATA), 13);
  assert.equal(s.trip.node, runWorldNode(at));
  assert.ok(validRun(JSON.parse(JSON.stringify(s.run))), 'the save takes it after the walk');
});

test('arriving goes from where trip.node says you stand (a debug jump or a test moves it alone)', () => {
  const s = onRun('RL7JUMP'),
    map = s.run.map;
  runArrive(s, 0, DATA);
  const row1 = runNext(map, 0)[0],
    row2 = runNext(map, row1)[0],
    row3 = runNext(map, row2)[0];
  s.trip.node = runWorldNode(row2);
  assert.equal(runArrive(s, row3, DATA), 2, 'on from where you were put, a day');
  assert.deepEqual(s.run.path, [0, row3]);
  s.trip.node = runWorldNode(row1);
  assert.equal(runArrive(s, row3, DATA), 0, 'not from the row before');
  s.trip.node = 0;
  assert.equal(runArrive(s, 0, DATA), 3, 'from Copperleaf only the landing');
});

test("the forecast: the same for a seed, a later fill gives a longer fill's days, each node's climate", () => {
  const one = onRun('RL6SKY').run,
    two = onRun('RL6SKY').run;
  assert.deepEqual(two.forecast, one.forecast);
  assert.notDeepEqual(onRun('RL6SKY2').run.forecast, one.forecast);
  // filled up to day 8 at the start, then to day 30, is what a fill to day 30 at once gives
  runForecastFill(one, BIOMES, 30);
  const once = { ...two, forecast: [] };
  runForecastFill(once, BIOMES, 30);
  assert.deepEqual(one.forecast, once.forecast);
  assert.ok(
    one.forecast.slice(1).every(days => days.length === 30 && days.every(Boolean)),
    'no gaps'
  );
  assert.equal(runWeather(one, 2, 5), one.forecast[3][4]);
  assert.equal(runWeather(one, 2, 31), '');
  assert.equal(runNodeSeed('ABC', 4), 'ABC|n4');
  // each node rolls from its biome's climate; a biome without one reads as mild
  const dry = { ...two, forecast: [] };
  runForecastFill(dry, Object.fromEntries(Object.keys(BIOMES).map(b => [b, { climate: 'dry' }])), 60);
  const seenDry = new Set(dry.forecast.flat());
  assert.ok(
    [...seenDry].every(w => w === 'clear' || w === 'cloudy'),
    [...seenDry].join()
  );
  const indoors = { ...two, forecast: [] };
  runForecastFill(indoors, Object.fromEntries(Object.keys(BIOMES).map(b => [b, { climate: 'none' }])), 20);
  assert.deepEqual([...new Set(indoors.forecast.flat())], ['clear']);
  const mild = { ...two, forecast: [] };
  runForecastFill(mild, {}, 400);
  const days = mild.forecast.flat(),
    clear = days.filter(w => w === 'clear').length / days.length;
  assert.ok(days.every(w => Object.hasOwn(CLIMATE_WEATHER_ODDS.mild, w)));
  assert.ok(clear > 0.45 && clear < 0.55, `clear on ${(clear * 100).toFixed(0)}% of days (mild: 50%)`);
});

test("RL-R1: a region's zones give the rows their biomes, each node its zone, and every zone leads into the next", () => {
  const zones = [
      { biome: 'lake', rows: 3 },
      { biome: 'meadow', rows: 2 },
      { biome: 'thicket', rows: 4 },
    ],
    M = { ...MAP_RULES, rows: 9, zones };
  for (const s of seeds(200)) {
    const map = runMapMake(s, NODE_TYPES, M),
      plain = runMapMake(s, NODE_TYPES, { ...MAP_RULES, rows: 9 });
    assert.equal(rowsOf(map), 9, s);
    // the zones change only the biomes: the shape and the types are the map without them
    assert.deepEqual(
      map.nodes.map(n => [n.type, n.row, n.lane, n.to]),
      plain.nodes.map(n => [n.type, n.row, n.lane, n.to]),
      s
    );
    for (const n of map.nodes) {
      const zone = n.row < 3 ? 0 : n.row < 5 ? 1 : 2;
      assert.equal(n.zone, zone, `${s}: row ${n.row}'s zone`);
      assert.equal(n.biome, zones[zone].biome, `${s}: row ${n.row}'s biome`);
    }
    // seamless across a zone's edge: every place on a zone's last row leads into the next zone
    for (const n of map.nodes.filter(x => x.row === 2 || x.row === 4)) {
      assert.ok(n.to.length > 0, s);
      assert.ok(
        n.to.every(j => map.nodes[j].zone === n.zone + 1),
        `${s}: row ${n.row} leads into zone ${n.zone + 1}`
      );
    }
  }
  assert.throws(() => runMapMake('X', NODE_TYPES, { ...M, rows: 10 }), /don't add up/);
  // a run's state keeps the zones
  const run = newRun('ZONED', 1, 1, START);
  runMapStart(run, {
    nodeTypes: NODE_TYPES,
    biomes: {},
    rules: { map: M, clock: { ahead: 7 }, reveal: { icons: 1, unknown: 2 } },
  });
  assert.ok(validRun(run));
  assert.equal(run.map.nodes.at(-1).zone, 2);
  run.map.nodes[0].zone = 9;
  assert.equal(validRun(run), false, 'a zone past 7');
  run.map.nodes[0].zone = 0;
  assert.ok(validRun(run));
  // WM-2: a footprint is whole cells: a cell within 64 of the landing's, a size of 1 to 8
  for (const [k, v] of [
    ['at', [0.5, 0]],
    ['at', [0]],
    ['at', [99, 0]],
    ['size', [0, 1]],
    ['size', [2, 1, 1]],
    ['size', 'big'],
  ]) {
    const was = run.map.nodes[1][k];
    run.map.nodes[1][k] = v;
    assert.equal(validRun(run), false, `${k} ${JSON.stringify(v)}`);
    run.map.nodes[1][k] = was;
  }
  delete run.map.nodes[1].at;
  assert.ok(validRun(run), 'a run from before WM-2 has none');
});

test('WM-2: a run’s places a path by Expedition and its mini-bosses as fit; given rows and mini-bosses stand', () => {
  const R = {
    ...MAP_RULES,
    rows: undefined,
    minibosses: undefined,
    path: [
      [9, 10],
      [11, 12],
    ],
    towns: [2, 3],
  };
  const got = seeds(200).map(s => runMapLength(s, R, 1));
  assert.deepEqual(
    [...new Set(got.map(g => g.rows))].sort((a, b) => a - b),
    [9, 10]
  );
  assert.ok(got.every(g => g.minibosses === 2));
  const late = seeds(200).map(s => runMapLength(s, R, 9));
  assert.deepEqual(
    [...new Set(late.map(g => g.rows))].sort((a, b) => a - b),
    [11, 12],
    'past the last Expedition, the last'
  );
  assert.ok(late.every(g => g.minibosses === (g.rows === 12 ? 3 : 2)));
  assert.deepEqual(runMapLength('X', { ...R, rows: 6, minibosses: 1 }, 5), { rows: 6, minibosses: 1 });
  assert.deepEqual(runMapLength('X', { ...R, rows: 6 }, 5), { rows: 6, minibosses: 2 }, 'within towns');
  assert.deepEqual(runMapLength('SAME', R, 1), runMapLength('SAME', R, 1));
  // rules without rows draw Expedition I's
  const map = runMapMake('NOROWS', NODE_TYPES, R);
  assert.equal(rowsOf(map), runMapLength('NOROWS', R, 1).rows);
});

test('WM-2: the grid’s sides; a link’s way; none for a place with no footprint', () => {
  const f = (x, y, w = 2, h = 1) => ({ at: [x, y], size: [w, h] });
  assert.equal(runGridSide(f(0, 0), f(2, 0)), 'E');
  assert.equal(runGridSide(f(0, 0), f(-2, 0)), 'W');
  assert.equal(runGridSide(f(0, 0), f(1, 1)), 'N');
  assert.equal(runGridSide(f(0, 0), f(-1, -1)), 'S');
  assert.equal(runGridSide(f(0, 0), f(2, 1)), '', 'corners only');
  assert.equal(runGridSide(f(0, 0), f(-2, 1)), '', 'corners only');
  assert.equal(runGridSide(f(0, 0, 3, 2), f(3, 1)), 'E');
  const map = runMapMake('DIRS', NODE_TYPES, MAP_RULES);
  assert.ok(['E', 'N'].includes(runLinkDir(map, 0, map.nodes[0].to[0])));
  delete map.nodes[0].at;
  assert.equal(runLinkDir(map, 0, map.nodes[0].to[0]), '');
});

test('WM-2: lane switches the grid can’t hold are dropped, nothing else changes; the same seed lays out the same', () => {
  let dropped = 0;
  for (const s of seeds(300)) {
    const a = runMapMake(s, NODE_TYPES, { ...MAP_RULES, cross: 1 }),
      b = runMapMake(s, NODE_TYPES, { ...MAP_RULES, cross: 1 });
    assert.deepEqual(a, b);
    const flat = runMapMake(s, NODE_TYPES, { ...MAP_RULES, cross: 0 });
    assert.deepEqual(
      a.nodes.map(n => [n.type, n.row, n.lane, n.biome]),
      flat.nodes.map(n => [n.type, n.row, n.lane, n.biome])
    );
    if (links(a).length === links(flat).length) dropped++;
  }
  assert.ok(dropped < 300, 'some maps keep their switches');
});

/* WM-3: the types with shapes, as nodeTypes.json gives them */
const SHAPED = {
  ...NODE_TYPES,
  route: { ...NODE_TYPES.route, shapes: { '2x1': 8, '3x1': 4, '1x2': 3, L: 4, '1x3': 1 } },
  event: { name: 'Waystation', engine: 'scene', weight: 2, shapes: { '1x1': 1 } },
};

test('WM-3: shapes by type: a footprint of its shape or a route’s, exits on the edges places share, spaced', () => {
  assert.deepEqual(['2x1', '3x1', '1x2', '1x3', '1x1', 'L', 'x', ''].map(runShapeSize), [
    [2, 1],
    [3, 1],
    [1, 2],
    [1, 3],
    [1, 1],
    [2, 2],
    [2, 1],
    [2, 1],
  ]);
  /** @type {Record<string, number>} */
  const got = {};
  let cuts = 0,
    exits = 0;
  for (const s of seeds(300)) {
    const map = runMapMake(s, SHAPED, MAP_RULES),
      N = map.nodes;
    N.forEach((n, i) => {
      const key = `${n.type} ${n.size}`;
      got[key] = (got[key] || 0) + 1;
      if (!SHAPED[n.type].shapes) assert.deepEqual(n.size, RUN_GRID.place, `${s}: a ${n.type} is two by one`);
      assert.equal(n.ways?.length, n.to.length, `${s}: an exit spot a link`);
      // each link crosses an edge the two share, a whole metre, RUN_GRID.edge from its ends; both see it at one spot
      n.to.forEach((j, k) => {
        const sh = runGridShared(n, N[j]),
          u = n.ways[k];
        assert.ok(sh && Number.isInteger(u), `${s}: ${i}->${j}`);
        assert.ok(u >= sh[0] * 64 + RUN_GRID.edge && u <= sh[1] * 64 - RUN_GRID.edge, `${s}: ${i}->${j} at ${u}`);
        const a = runGridExits(map, i).find(e => e.node === j),
          b = runGridExits(map, j).find(e => e.node === i),
          at = (/** @type {any} */ m, /** @type {any} */ e) =>
            e.side === 'N' || e.side === 'S'
              ? m.at[0] * 64 + e.t * m.size[0] * 64
              : m.at[1] * 64 + e.t * m.size[1] * 64;
        assert.equal({ E: 'W', N: 'S', S: 'N' }[a.side], b.side, `${s}: ${i}->${j} faces`);
        assert.ok(Math.abs(at(n, a) - u) < 1e-9 && Math.abs(at(N[j], b) - u) < 1e-9, `${s}: ${i}->${j} lines up`);
      });
      // the exits on a side 44 m apart, in the place's order (back first, ahead second)
      const E = runGridExits(map, i);
      assert.deepEqual(
        E.map(e => e.node),
        runGridLinks(N, i).map(e => e.node)
      );
      for (const side of 'NSEW') {
        const len = (side === 'N' || side === 'S' ? n.size[0] : n.size[1]) * 64,
          xs = E.filter(e => e.side === side)
            .map(e => e.t * len)
            .sort((a, b) => a - b);
        for (let k = 1; k < xs.length; k++) assert.ok(xs[k] - xs[k - 1] >= 44, `${s}: ${i}'s ${side} side`);
        exits += xs.length;
      }
      // an L: a corner of its two by two with no exit, its road in and out by diagonal cells
      if (n.cut) {
        cuts++;
        assert.deepEqual(n.size, [2, 2]);
        assert.ok([n.at[0], n.at[0] + 1].includes(n.cut[0]) && [n.at[1], n.at[1] + 1].includes(n.cut[1]));
        assert.deepEqual(runGridCut(N, i), n.cut);
        const cell = (/** @type {any} */ e) => {
          const L = (e.side === 'N' || e.side === 'S' ? 2 : 2) * 64,
            u = e.t * L;
          return e.side === 'E' || e.side === 'W'
            ? [e.side === 'E' ? n.at[0] + 1 : n.at[0], n.at[1] + Math.floor(u / 64)]
            : [n.at[0] + Math.floor(u / 64), e.side === 'N' ? n.at[1] + 1 : n.at[1]];
        };
        for (const e of E) assert.notDeepEqual(cell(e), n.cut, `${s}: an exit in ${i}'s cut`);
        const [a, b] = E.map(cell);
        assert.ok(a[0] !== b[0] && a[1] !== b[1], `${s}: ${i}'s road bends`);
      }
    });
    assert.ok(validRun(JSON.parse(JSON.stringify({ ...newRun(s, 1, 3, START), map }))), s);
    assert.deepEqual(runMapMake(s, SHAPED, MAP_RULES), map, `${s}: the same seed lays out the same`);
  }
  for (const k of ['route 2,1', 'route 3,1', 'route 1,2', 'route 1,3', 'route 2,2', 'event 1,1'])
    assert.ok(got[k] > 10, `${k}: ${got[k]}`);
  assert.ok(cuts > 30, `${cuts} Ls`);
  assert.ok(exits > 0);
});

test('WM-3: an L is cut only where its road bends; a square when its exits share a row or a column', () => {
  const sq = (/** @type {number[]} */ at) => ({ type: 'route', row: 1, lane: 0, to: [], at, size: [2, 2] });
  // in from the west by the south-west cell, out north by the north-east: the road turns through the south-east,
  // the north-west is cut
  const nodes = [
    { type: 'landing', row: 0, lane: 0, to: [1], at: [-2, 0], size: [2, 1], ways: [40] },
    { ...sq([0, 0]), to: [2], ways: [100] },
    { type: 'route', row: 2, lane: 0, to: [], at: [1, 2], size: [2, 1], ways: [] },
  ];
  assert.deepEqual(runGridCut(/** @type {any} */ (nodes), 1), [0, 1]);
  // out north by the north-west instead (the same column as nothing, the same row as nothing, but the west column):
  // in by the south-west and out by the north-west share a column: no bend, no cut
  nodes[1].ways = [30];
  nodes[2].at = [-1, 2];
  assert.equal(runGridCut(/** @type {any} */ (nodes), 1), null);
});
