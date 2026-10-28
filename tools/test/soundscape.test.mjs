// Sound track SND-10: where the world's water sounds come from (game/js/logic/soundscape.js): water cells from the
// renderer's grid or the tiles, emitters by kind, river lines, falls by height and their pools, the nearest few in
// buckets, distance and air, and the events (bubbles, laps, the surf on the tide), seeded.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SOUNDSCAPE_APART,
  soundscapeAir,
  soundscapeBubbles,
  soundscapeCells,
  soundscapeCellsFromTiles,
  soundscapeEmitters,
  soundscapeFallRecipe,
  soundscapeFindings,
  soundscapeHeight,
  soundscapeLaps,
  soundscapeLevel,
  soundscapeMidi,
  soundscapeNearest,
  soundscapePreview,
  soundscapeSplash,
  soundscapeTide,
  soundscapeVoices,
  soundscapeWaves,
} from '../../game/js/logic/soundscape.js';
import { ambienceBuckets, ambienceRandom } from '../../game/js/logic/ambience-sound.js';
import { WATER_KINDS } from '../../game/js/logic/water-kinds.js';
import { readFileSync } from 'node:fs';

/* a small water table: the game's is game/data/soundscape.json `water` */
const S = {
  kinds: {
    pond: { recipe: 'pond' },
    sea: { recipe: 'surf' },
    lava: { recipe: 'lava', at: 'all' },
    stream: { recipe: 'brook', at: 'all' },
    rapids: { recipe: 'rapids', at: 'all' },
  },
  running: { brook: 'brook', river: 'river', rapids: 'rapids', spring: 'spring', riverWidth: 2.5, near: 3 },
  falls: { small: 'fallSmall', tall: 'fallTall', tallFrom: 3, pool: 'plunge', sheet: 'fallSmall' },
  fountain: 'fountain',
  water: {
    pond: { range: 10, line: true, trim: 1, layers: [] },
    surf: { range: 30, line: true, voices: 2, trim: 1, layers: [] },
    brook: { range: 14, line: true, trim: 1, layers: [] },
    fallSmall: { range: 12, byHeight: true, trim: 1, layers: [] },
    fallTall: { range: 30, byHeight: true, trim: 1, layers: [] },
    fountain: { range: 10, trim: 1, layers: [] },
  },
};
const names = ['pond', 'stream', 'canal', 'spring', 'swamp', 'lake', 'sea', 'lava'];

/** a renderer-style half-metre grid from rows of 1 m characters: '.' dry, 'p' pond, 's' sea, 'r' a stream */
function grid(rows) {
  const H = rows.length,
    W = rows[0].length,
    W2 = W * 2,
    H2 = H * 2,
    dep = new Float32Array(W2 * H2),
    kind = new Uint8Array(W2 * H2),
    cls = new Uint8Array(W2 * H2),
    K = { p: 0, s: 6, r: 1, l: 7 };
  for (let j = 0; j < H2; j++)
    for (let i = 0; i < W2; i++) {
      const c = rows[H - 1 - Math.floor(j / 2)][Math.floor(i / 2)];
      if (c === '.') continue;
      const q = j * W2 + i;
      dep[q] = 0.5;
      kind[q] = K[c];
      if (c === 'r') cls[q] = 1;
    }
  return { G: { W2, H2, dep, kind }, cls };
}

test('cells from the grid: a metre each, its kind, its shore, running where the flow map runs', () => {
  const { G, cls } = grid(['.....', '.ppp.', '.ppp.', '.ppp.', '.....']);
  const C = soundscapeCells(G, names, cls);
  assert.equal(C.length, 9);
  assert.ok(C.every(c => c[2] === 'pond' && c[4] === 0));
  /* the middle metre has water all round: not a shore */
  assert.deepEqual(
    C.filter(c => !c[3]).map(c => [c[0], c[1]]),
    [[2.5, 2.5]]
  );
  const R = grid(['.rr.', '.rr.']);
  assert.ok(soundscapeCells(R.G, names, R.cls).every(c => c[2] === 'stream' && c[4] === 1));
  /* with no flow map, a running kind runs */
  assert.ok(soundscapeCells(R.G, names, null, k => k === 'stream').every(c => c[4] === 1));
});

test('cells from the tiles agree with the grid on the same water', () => {
  const sc = { w: 5, h: 5, tiles: ['.....', '.www.', '.wdw.', '.www.', '.....'] };
  const A = soundscapeCellsFromTiles(
      sc,
      () => 'pond',
      () => false
    ),
    { G } = grid(['.....', '.ppp.', '.ppp.', '.ppp.', '.....']),
    B = soundscapeCells(G, names, null);
  assert.deepEqual(
    A.map(c => c.slice(0, 4)),
    B.map(c => c.slice(0, 4))
  );
});

test('emitters: still water at its shores, running water along its cells by its line, lava all over (thinned)', () => {
  const C = [
    [1.5, 1.5, 'pond', 1, 0],
    [2.5, 2.5, 'pond', 0, 0],
    [10.5, 10.5, 'lava', 0, 0],
    [11.5, 10.5, 'lava', 0, 0],
    [20.5, 4.5, 'sea', 1, 1],
    [21.5, 4.5, 'sea', 1, 1],
    [30.5, 30.5, 'stream', 0, 1],
  ];
  const sc = {
    streams: [
      /* a wide river through the sea's cells (WA-10: the river's own kind only by its line) */
      {
        pts: [
          [18, 4.5],
          [24, 4.5],
        ],
        w: 3,
        src: 'spring',
      },
      /* a narrow one with rapids over its first half */
      {
        pts: [
          [30.5, 20],
          [30.5, 40],
        ],
        w: [1, 1.2],
        rapids: [[0, 0.5]],
      },
    ],
  };
  const E = soundscapeEmitters(S, C, sc);
  assert.deepEqual(E.pond, [[1.5, 1.5, 0]]);
  assert.deepEqual(E.lava, [[10.5, 10.5, 0]]);
  /* the river's cells play the river (thinned to every other metre), its spring at its start; no surf there */
  assert.deepEqual(E.river, [[20.5, 4.5, 0]]);
  assert.deepEqual(E.spring, [[18, 4.5, 0]]);
  assert.equal(E.surf, undefined);
  /* 30.5, 30.5 is past the narrow line's middle: a brook, not its rapids */
  assert.deepEqual(E.brook, [[30.5, 30.5, 0]]);
  /* a running cell far from any line plays its kind's recipe */
  assert.deepEqual(soundscapeEmitters(S, [[50.5, 50.5, 'rapids', 0, 1]], {}).rapids, [[50.5, 50.5, 0]]);
});

test('falls by height, the pool past the lip, the automatic cascades, fountains', () => {
  const E = soundscapeEmitters(
    S,
    [],
    {
      falls: [
        { x: 50, z: 17, dir: [0, -1], h: 6, pool: 2.2 },
        { x: 10, z: 10, dir: [1, 0], h: 1.2 },
      ],
    },
    { sheets: [[3, 1, 4, 0.8, 1, 0]], fountains: [[148.6, 59.4]] }
  );
  assert.deepEqual(E.fallTall, [[50, 16.4, 6]]);
  assert.deepEqual(E.plunge, [[50, 17 - 2.45, 6]]);
  assert.deepEqual(E.fallSmall, [
    [10.6, 10, 1.2],
    [3, 4, 0.8],
  ]);
  assert.deepEqual(E.fountain, [[148.6, 59.4, 0]]);
  assert.equal(soundscapeFallRecipe(S, 2.9), 'fallSmall');
  assert.equal(soundscapeFallRecipe(S, 3), 'fallTall');
  /* taller falls louder and heard further, within bounds */
  const a = soundscapeHeight(0.5),
    b = soundscapeHeight(3),
    c = soundscapeHeight(15);
  assert.ok(a.gain < b.gain && b.gain < c.gain && c.gain <= 2 && a.gain >= 0.4);
  assert.equal(b.gain, 1);
  assert.ok(c.reach <= 1.8 && a.reach >= 0.7);
});

test('level and air: 0 at the range, a line falls slower than a point, far water darker', () => {
  assert.equal(soundscapeLevel(10, 10), 0);
  assert.equal(soundscapeLevel(1, 30), (soundscapeLevel(2, 30) / (1 - (2 / 30) ** 2)) * (1 - (1 / 30) ** 2));
  assert.ok(soundscapeLevel(8, 30, true) > soundscapeLevel(8, 30));
  for (let d = 0; d < 30; d += 0.5) assert.ok(soundscapeLevel(d + 0.5, 30) <= soundscapeLevel(d, 30));
  assert.ok(soundscapeAir(1) > soundscapeAir(10) && soundscapeAir(10) > soundscapeAir(40));
  assert.ok(soundscapeAir(200) >= 900);
});

test('the nearest few: nearest first, apart from each other, a line placed at its neighbours middle', () => {
  const pts = [];
  for (let x = 0; x <= 40; x++) pts.push([x, 0, 0]);
  const B = ambienceBuckets(pts, 4);
  const N = soundscapeNearest(B, 20, 3, 30, 2, false);
  assert.equal(N.length, 2);
  assert.equal(N[0].d, 3);
  assert.ok(Math.hypot(N[1].x - N[0].x, N[1].z - N[0].z) >= SOUNDSCAPE_APART);
  /* standing beside a straight shore, its sound comes from straight in front, not from one cell */
  const L = soundscapeNearest(B, 20.4, 3, 30, 1, true)[0];
  assert.ok(Math.abs(L.x - 20.4) < 0.5, `${L.x}`);
  assert.deepEqual(soundscapeNearest(B, 20, 50, 30, 2), []);
});

test('voices: each recipe nearest few with levels; a tall fall reaches further than a small one', () => {
  const buckets = {
    surf: ambienceBuckets(
      [
        [0, 0, 0],
        [20, 0, 0],
      ],
      4
    ),
    fallTall: ambienceBuckets([[0, 40, 12]], 4),
    fallSmall: ambienceBuckets([[0, 40, 1]], 4),
    nothing: ambienceBuckets([[0, 0, 0]], 4),
  };
  const V = soundscapeVoices(S, buckets, 0, 20);
  assert.deepEqual(
    V.map(v => [v.recipe, v.k]),
    [
      ['surf', 0],
      ['surf', 1],
      ['fallTall', 0],
    ]
  );
  assert.ok(V.every(v => v.level > 0 && v.level <= 2));
});

test('bubbles: seeded, at their rate, never closer than the gap, pitches by radius, gains and pans in range', () => {
  const E = { type: 'bubbles', bank: 'drop', rate: 20, rMin: 1, rMax: 6, gamma: 2, level: 0.9, gap: 0.02, pan: 0.4 };
  const run = seed => soundscapeBubbles(E, {}, 0, 60, ambienceRandom(seed));
  const A = run(5);
  assert.deepEqual(run(5), A);
  /* about rate a second (quiet ones dropped: fewer, never more) */
  assert.ok(A.length < 20 * 60 * 1.1 && A.length > 20 * 60 * 0.3, `${A.length}`);
  for (let i = 1; i < A.length; i++) assert.ok(A[i].t - A[i - 1].t >= E.gap - 1e-9);
  assert.ok(A.every(b => b.midi >= soundscapeMidi(6) - 1e-9 && b.midi <= soundscapeMidi(1) + 1e-9));
  assert.ok(A.every(b => b.gain > 0.002 && b.gain <= 0.9 && Math.abs(b.pan) <= 0.4 && b.bank === 'drop'));
  assert.ok(Math.abs(soundscapeMidi(3) - (69 + 12 * Math.log2(1000 / 440))) < 1e-9, '3 mm rings at 1 kHz');
  /* a tick at a time gives the same as one long tick */
  const st = {},
    r = ambienceRandom(5),
    B = [];
  for (let t = 0; t < 60; t += 0.3) B.push(...soundscapeBubbles(E, st, t, t + 0.3, r));
  assert.deepEqual(
    B.filter(b => b.t < 60),
    A
  );
  /* the rate's multiplier (rain on water): none at 0 */
  assert.deepEqual(soundscapeBubbles(E, {}, 0, 10, ambienceRandom(1), 0), []);
});

test('laps every few seconds with a plip now and then; waves bigger and closer at high tide and in a storm', () => {
  const L = soundscapeLaps(
    { type: 'laps', every: [1.6, 4.5], gain: 1, plip: 0.7, bank: 'drop' },
    {},
    0,
    120,
    ambienceRandom(2)
  );
  assert.ok(L.length > 120 / 4.5 && L.length < 120 / 1.6 + 2);
  assert.ok(L.some(l => l.plip) && L.some(l => !l.plip));
  const W = { type: 'waves', every: [1, 4], rise: [2, 4.5], fall: [3, 4], peak: [0.35, 1], fizz: 60 };
  const low = soundscapeWaves(W, {}, 0, 600, ambienceRandom(3), 0),
    high = soundscapeWaves(W, {}, 0, 600, ambienceRandom(3), 1),
    storm = soundscapeWaves(W, {}, 0, 600, ambienceRandom(3), 1, 1),
    mean = a => a.reduce((s, w) => s + w.peak, 0) / a.length;
  assert.ok(high.length > low.length && storm.length > high.length);
  assert.ok(mean(high) > mean(low) && mean(storm) > mean(high));
  assert.ok(storm.every(w => w.peak <= 1.4 && w.D >= w.A * 3));
  assert.equal(soundscapeTide(9), 1);
  assert.equal(soundscapeTide(21), 1);
  assert.ok(Math.abs(soundscapeTide(15)) < 1e-9);
});

test("the game's water (soundscape.json): every water kind has a recipe, every recipe and bank named exists", () => {
  const D = JSON.parse(readFileSync(new URL('../../game/data/soundscape.json', import.meta.url), 'utf8'));
  assert.deepEqual(soundscapeFindings(D, WATER_KINDS), []);
  assert.equal(Object.keys(D.kinds).length, 15);
  /* every recipe a gentle one: no white noise, filters in the audible band */
  for (const [id, R] of Object.entries(D.water)) {
    for (const L of R.layers) assert.ok(['pink', 'brown'].includes(L.noise), id);
    assert.ok(R.trim > 0 && R.trim <= 2, `${id} trim ${R.trim}`);
  }
  /* a planted mistake of each sort is found */
  const bad = structuredClone(D);
  delete bad.kinds.bog;
  bad.kinds.pond.recipe = 'nosuch';
  bad.water.brook.texture.bank = 'drop';
  bad.water.lake.events[0].bank = 'babble';
  bad.water.river.layers[1].drift[0].on = 5;
  assert.equal(soundscapeFindings(bad, WATER_KINDS).length, 5);
});

test('rain on water: every surface but lava and ice (half of them); a one-metre strip keeps half its cells', () => {
  const R = { ...S, rainOnWater: 'rainOnWater', kinds: { ...S.kinds, canal: { recipe: 'canal', at: 'all' } } };
  const C = [];
  for (let x = 0; x < 10; x++) C.push([x + 0.5, 25.5, 'canal', 1, 0]);
  C.push([40.5, 40.5, 'lava', 0, 0], [41.5, 40.5, 'ice', 1, 0]);
  const E = soundscapeEmitters(R, C, {});
  assert.equal(E.canal.length, 5);
  assert.equal(E.rainOnWater.length, 5);
  assert.ok(E.rainOnWater.every(e => e[1] === 25.5));
});

test('the preview: a recipe at a distance as the game would set it; a fall by its height; unknown ids left out', () => {
  const V = soundscapePreview(S, [
    ['surf', 3],
    ['fallTall', 10, 12],
    ['fallTall', 10, 3],
    ['nosuch', 1],
  ]);
  assert.deepEqual(
    V.map(v => v.recipe),
    ['surf', 'fallTall', 'fallTall']
  );
  assert.equal(V[0].level, soundscapeLevel(3, 30, true));
  assert.ok(V[1].level > V[2].level, 'a 12 m fall louder than a 3 m one at 10 m');
  assert.equal(V[2].level, soundscapeLevel(10, 30));
});

test('a splash: bigger means longer, louder and more bubbles, bigger ones; seeded', () => {
  const D = JSON.parse(readFileSync(new URL('../../game/data/soundscape.json', import.meta.url), 'utf8'));
  const small = soundscapeSplash(D.splash, 0.1, ambienceRandom(4)),
    big = soundscapeSplash(D.splash, 1, ambienceRandom(4)),
    sum = a => a.reduce((s, b) => s + b.gain, 0),
    low = a => Math.min(...a.map(b => b.midi));
  assert.deepEqual(soundscapeSplash(D.splash, 1, ambienceRandom(4)), big);
  assert.ok(big.hits[0].d > small.hits[0].d && big.hits[0].gain > small.hits[0].gain);
  assert.ok(big.bubbles.length > small.bubbles.length && sum(big.bubbles) > sum(small.bubbles));
  assert.ok(low(big.bubbles) < low(small.bubbles), 'bigger bubbles ring lower');
  assert.ok([...small.bubbles, ...big.bubbles].every(b => b.bank === D.splash.bubbles.bank && b.at >= 0.01));
  /* sizes past the ends are the ends */
  assert.deepEqual(soundscapeSplash(D.splash, 3, ambienceRandom(4)), big);
});
