// Test data track TD-2: the benchmark path's rules (game/js/logic/bench-path.js): every engine dial has a need and a
// place to be measured (or a reason why not), the values it is measured at, the plan, the frame numbers, the memory
// guess and the saved progress. The Graphics test itself runs only by hand on a device; this file never runs it.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// engine/settings.js reads window and document when it loads (through hooks.js and art.js); nothing here draws
globalThis.window ??= globalThis;
globalThis.document ??= {};
const { ENGINE_DEFAULTS, ENGINE_SPEC, ENGINE_PRESETS } = await import('../../game/js/engine/settings.js');
const B = await import('../../game/js/logic/bench-path.js');

const allDials = ENGINE_SPEC.flatMap(([g, , rows]) => rows.map(r => [g, r[0]]));

test('every ENGINE_SPEC row has a need (a new row without one fails here: add it to NEEDS in bench-path.js)', () => {
  const none = allDials.filter(([g, k]) => !B.benchNeedOf(g, k)).map(([g, k]) => g + '.' + k);
  assert.deepEqual(none, []);
});

test('every need names a real dial, so a renamed or removed one is noticed', () => {
  const real = new Set(allDials.map(([g, k]) => g + '.' + k)),
    groups = new Set(ENGINE_SPEC.map(([g]) => g));
  const stale = Object.keys(B.BENCH_DIAL_NEEDS).filter(k =>
    k.endsWith('.*') ? !groups.has(k.slice(0, -2)) : !real.has(k)
  );
  assert.deepEqual(stale, []);
  for (const k of B.BENCH_BUILD) assert.ok(real.has(k), 'BENCH_BUILD names ' + k);
});

test('a dial is measured on a segment that has what it needs, or named with a reason', () => {
  for (const [g, k] of allDials) {
    const w = B.benchSegmentFor(g, k);
    if (w.notHere) assert.ok(Object.values(B.BENCH_NOT_HERE).includes(w.notHere), `${g}.${k}: ${w.notHere}`);
    else assert.ok(B.BENCH_SEGMENTS.find(s => s.id === w.segment).has.includes(B.benchNeedOf(g, k)));
  }
  /* the owner's examples (test-data-track.md 3.1): water at the water, see-through behind things, lamps at night */
  assert.equal(B.benchSegmentFor('water', 'fish').segment, 'shore');
  assert.equal(B.benchSegmentFor('camera', 'silhouette').segment, 'behind');
  assert.equal(B.benchSegmentFor('shadows', 'lampShadows').segment, 'lamps');
  assert.equal(B.benchSegmentFor('todNight', 'stars').segment, 'look-night');
  assert.match(B.benchSegmentFor('worldMap', 'lagoon').notHere, /world map/);
});

test('every segment has a route of points and real needs; ids are unique', () => {
  const ids = B.BENCH_SEGMENTS.map(s => s.id);
  assert.equal(new Set(ids).size, ids.length);
  const needs = new Set(Object.values(B.BENCH_DIAL_NEEDS));
  for (const s of B.BENCH_SEGMENTS) {
    assert.ok(s.route.length >= 1 && s.route.every(p => p.length === 2 && p.every(Number.isFinite)), s.id);
    assert.ok(s.route.length > 1 || s.hold > 0, s.id + ' walks or stands');
    for (const h of s.has) assert.ok(needs.has(h), `${s.id} has ${h}, which no dial needs`);
  }
});

test('the other value is a quarter of the range from the shipped one, inside the range, never the shipped one', () => {
  assert.equal(B.benchAltValue(['x', 'X', 0, 2, 0.05], 1), 1.5);
  assert.equal(B.benchAltValue(['x', 'X', 0, 2, 0.05], 2), 1.5);
  assert.equal(B.benchAltValue(['x', 'X', 0, 1, 0.01], 0), 0.25);
  assert.equal(B.benchAltValue(['x', 'X', 'bool'], true), false);
  assert.equal(
    B.benchAltValue(
      [
        'x',
        'X',
        'sel',
        [
          [1024, 'a'],
          [2048, 'b'],
          [4096, 'c'],
        ],
      ],
      2048
    ),
    4096
  );
  assert.equal(
    B.benchAltValue(
      [
        'x',
        'X',
        'sel',
        [
          [1024, 'a'],
          [2048, 'b'],
        ],
      ],
      2048
    ),
    1024
  );
  for (const [group, , rows] of ENGINE_SPEC)
    for (const row of rows) {
      const def = ENGINE_DEFAULTS[group][row[0]],
        v = B.benchAltValue(row, def);
      if (typeof row[2] === 'number') {
        assert.ok(v >= row[2] && v <= row[3], `${group}.${row[0]} = ${v} in ${row[2]}..${row[3]}`);
        assert.notEqual(v, def, `${group}.${row[0]}`);
      }
    }
});

test('each look is measured at an hour that shows it by itself', () => {
  const h = Object.fromEntries(
    ['dawn', 'day', 'golden', 'dusk', 'night'].map(k => [k, B.benchLookHour(k, ENGINE_DEFAULTS)])
  );
  assert.ok(h.dawn > 5 && h.dawn < h.day, JSON.stringify(h));
  assert.ok(h.day < h.golden && h.golden < h.dusk, JSON.stringify(h));
  assert.ok(h.night > h.dusk || h.night < 3, JSON.stringify(h));
});

test('the plan: a segment opens and closes with its shipped look, a drift check every 20 steps, presets at the end', () => {
  const presets = Object.entries(ENGINE_PRESETS).map(([k, P]) => [k, P.name]);
  const plan = B.benchPlan(ENGINE_SPEC, ENGINE_DEFAULTS, { presets });
  const dials = plan.filter(p => p.kind === 'dial' || p.kind === 'notHere');
  assert.equal(dials.length, allDials.length, 'every dial once');
  for (const p of plan.filter(x => x.kind === 'dial')) assert.notDeepEqual(p.value, p.shipped, p.dial);
  let run = 0;
  for (const p of plan) {
    if (p.kind === 'base' && p.drift) run = 0;
    else if (p.kind === 'dial') assert.ok(++run <= 20, 'a drift check at least every 20 dial steps');
  }
  assert.equal(plan.filter(p => p.kind === 'preset').length, presets.length);
  const seg = plan.filter(p => p.kind !== 'notHere' && !p.drift && p.kind !== 'preset');
  assert.equal(seg[0].kind, 'base');
  /* only the groups picked, and the time it should take */
  const lens = B.benchPlan(ENGINE_SPEC, ENGINE_DEFAULTS, { groups: ['lens'] });
  assert.ok(lens.filter(p => p.kind === 'dial').every(p => p.dial.startsWith('lens.')));
  assert.ok(B.benchMinutes(lens) >= 1 && B.benchMinutes(lens) < B.benchMinutes(plan));
});

test('frame numbers: fps, percentiles, the worst and the janky frames', () => {
  const s = B.benchFrameStats([...Array(98).fill(16.7), 50, 100]);
  assert.equal(s.frames, 100);
  assert.equal(s.p50, 16.7);
  assert.equal(s.p99, 100);
  assert.equal(s.worst, 100);
  assert.equal(s.jank, 2);
  assert.ok(s.fps > 50 && s.fps < 60);
  assert.equal(B.benchFrameStats([]).fps, null);
});

test('the memory guess grows with the resolution and the shadow map, and holds otherwise', () => {
  const kinds = { targets: 100, ground: 150, pictures: 40 };
  assert.equal(B.benchMemoryGuess(kinds, 'lens.grain', 0.1, 0.2), 290);
  assert.ok(B.benchMemoryGuess(kinds, 'quality.resolution', 1, 1.25) > B.BENCH_BUDGET_MB);
  assert.ok(B.benchMemoryGuess(kinds, 'quality.resolution', 1, 0.75) < 290);
  assert.ok(B.benchMemoryGuess(kinds, 'quality.shadowMap', 2048, 4096) > 290 + 90);
  assert.equal(B.benchMemoryGuess(kinds, 'world.wear', 1, 1.5, 20), 310);
});

test('the saved progress loads back, and not from another build or a broken text', () => {
  const st = {
    build: '0.1.0',
    created: '2026-10-29T10:00:00Z',
    groups: null,
    res: 1,
    at: 3,
    running: 3,
    steps: [{ i: 0 }],
  };
  assert.deepEqual(B.benchStateLoad(B.benchStatePack(st), '0.1.0').steps, [{ i: 0 }]);
  assert.equal(B.benchStateLoad(B.benchStatePack(st), '0.1.1'), null);
  assert.equal(B.benchStateLoad('{nope', '0.1.0'), null);
  assert.equal(B.benchStateLoad(null), null);
});
