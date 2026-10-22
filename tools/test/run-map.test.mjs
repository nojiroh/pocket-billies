// RL-6: the run's node map and its clock (game/js/logic/run-map.js), on the tests' own small tables: rows from the
// landing to the boss, mini-boss rows with a town before each, one or two lanes, links only to the next row, where it
// all sits on the bowl; the days, the deadline, what the map shows and the forecast. run-map-real.test.mjs runs it on the game's data.
//   node --test --test-update-snapshots tools/test/run-map.test.mjs   remakes the frozen map (say why in the commit)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bowlCompass, bowlSeamTurn, bowlXY } from '../../game/js/logic/bowl.js';
import {
  RUN_BOWL,
  runArrive,
  runBack,
  runDeadline,
  runExits,
  runForecastFill,
  runMapMake,
  runMapNode,
  runMapRows,
  runMapRowsFit,
  runMapStart,
  runNext,
  runNodeSeed,
  runOverdue,
  runReveal,
  runSpot,
  runWeather,
  runWorldNode,
} from '../../game/js/logic/run-map.js';
import { newRun, validRun } from '../../game/js/logic/run-state.js';
import { CLIMATE_WEATHER_ODDS } from '../../game/js/logic/weather.js';

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

test('on the bowl (RL-8b): rows from the east to the west across the bowl, lanes apart, maps facing north, roads leave and arrive the way their exits face', () => {
  for (let rows = 5; rows <= 12; rows++)
    for (const s of seeds(60)) {
      const map = runMapMake(s, NODE_TYPES, rulesFor(rows)),
        N = map.nodes,
        P = N.map((_, i) => xy(map, i));
      N.forEach((n, i) => {
        const { a, r, up } = runSpot(map, i);
        assert.ok(a >= 0 && a < 360 && r >= 0 && r < 0.8, `${a}, ${r}`);
        assert.equal(up, 90, "a run's maps face the bowl's north");
        if (n.row === 0) assert.ok(P[i][0] > 0.3, `the landing is in the east (${P[i][0]})`);
        if (n.row === rows - 1) assert.ok(P[i][0] < -0.3, `the boss is in the west (${P[i][0]})`);
        for (const j of n.to) assert.ok(P[j][0] < P[i][0], `${i}->${j} goes west`);
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
        const turn = bowlSeamTurn(P[a], P[b], 'west', 'east', 90),
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

test("the world's numbering: Copperleaf first, map node i is world node i + 1", () => {
  assert.equal(runWorldNode(0), 1);
  assert.equal(runMapNode(1), 0);
  assert.equal(runMapNode(0), -1);
  for (let i = 0; i < 20; i++) assert.equal(runMapNode(runWorldNode(i)), i);
});

/* ---------- the clock (owner, 8.10): a day per arrival, backtracking included; the landing is day 1 ---------- */
const RUN_RULES = { map: MAP_RULES, clock: { slack: 3, ahead: 7 }, reveal: { icons: 1, unknown: 2 } };
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

test('the deadline: the shortest walk to the boss in days (the landing is day 1) and the slack; days past it', () => {
  for (const s of seeds(100)) {
    const map = runMapMake(s, NODE_TYPES, MAP_RULES);
    assert.equal(runDeadline(map, 3), shortest(map) + 3);
    assert.equal(runDeadline(map, 3), 12);
  }
  assert.equal(runOverdue({ clock: 50, deadline: 0 }), 0, 'no deadline set');
  assert.equal(runOverdue({ clock: 12, deadline: 12 }), 0, 'the last day');
  assert.equal(runOverdue({ clock: 14, deadline: 12 }), 2);
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

test("a new run's map: the deadline, the landing's view, a week of forecast for every node, none for the hub", () => {
  const { run } = onRun('RL6START'),
    map = run.map;
  assert.equal(run.deadline, 12);
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
  // on to the boss: one row a day from here, three days past the shortest walk's day 9
  let at = 0;
  while (runNext(map, at).length) {
    at = runNext(map, at).at(-1);
    assert.ok(runArrive(s, at, DATA) > 0);
  }
  assert.equal(s.run.clock, 3 + 8);
  assert.equal(runOverdue(s.run), 0, 'day 11 of a day-12 deadline');
  assert.equal(runArrive(s, runBack(map, at)[0], DATA), 12);
  assert.equal(runArrive(s, at, DATA), 13);
  assert.equal(runOverdue(s.run), 1);
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
