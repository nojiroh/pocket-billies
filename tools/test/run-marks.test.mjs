// UI-4: the run map's node markers (game/js/logic/run-marks.js): one outline per node type, the same for the kit's
// <pb-node> (SVG) and the bowl's canvas painter.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  RUN_MARK_SHAPES,
  RUN_MARK_STATES,
  RUN_MARK_TYPES,
  runMarkClip,
  runMarkDraw,
  runMarkLook,
  runMarkPoints,
} from '../../game/js/logic/run-marks.js';

/** twice the signed area (shoelace); positive is clockwise with y down */
const area2 = pts =>
  pts.reduce((s, [x, y], i) => s + x * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * y, 0);

test("the plan's shapes: diamond boss, hexagon town, chevron route, slanted event", () => {
  assert.deepEqual(RUN_MARK_TYPES, [
    'landing',
    'route',
    'town',
    'miniboss',
    'boss',
    'event',
    'shop',
    'rival',
    'scrapyard',
    'unknown',
  ]);
  assert.equal(RUN_MARK_SHAPES.boss.length, 4, 'a diamond');
  assert.equal(RUN_MARK_SHAPES.town.length, 6, 'a hexagon');
  assert.equal(RUN_MARK_SHAPES.route.length, 6, 'a chevron');
  assert.equal(RUN_MARK_SHAPES.event.length, 4, 'a slanted card');
  // the event slants: its top edge sits right of its bottom edge
  assert.ok(RUN_MARK_SHAPES.event[0][0] > RUN_MARK_SHAPES.event[3][0]);
  assert.ok(RUN_MARK_SHAPES.shop[0][0] < RUN_MARK_SHAPES.shop[3][0], 'the shop slants the other way');
});

test('every outline sits in its 100 x 100 box, goes clockwise and is distinct', () => {
  const seen = new Set();
  for (const t of RUN_MARK_TYPES) {
    const pts = RUN_MARK_SHAPES[t];
    for (const [x, y] of pts) assert.ok(x >= 0 && x <= 100 && y >= 0 && y <= 100, `${t}: ${x},${y}`);
    assert.ok(area2(pts) > 0, `${t} goes clockwise`);
    const key = runMarkPoints(t);
    assert.ok(!seen.has(key), `${t} has its own outline`);
    seen.add(key);
  }
});

test('the SVG points and the clip-path are the same outline', () => {
  assert.equal(runMarkPoints('boss'), '50,0 100,50 50,100 0,50');
  assert.equal(runMarkClip('boss'), 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)');
  assert.equal(runMarkPoints('nope'), runMarkPoints('unknown'), 'a type it does not know reads as unknown');
});

test('states: hidden shows "?" whatever the type, current glows gold, visited and locked fade', () => {
  assert.deepEqual(RUN_MARK_STATES, ['seen', 'current', 'visited', 'locked', 'hidden']);
  const hidden = runMarkLook('boss', 'hidden');
  assert.equal(hidden.shape, 'unknown');
  assert.equal(hidden.glyph, '?');
  assert.equal(runMarkLook('town').tone, 'primary');
  assert.equal(runMarkLook('boss').tone, 'danger');
  const cur = runMarkLook('route', 'current');
  assert.equal(cur.tone, 'gold');
  assert.ok(cur.glow && !cur.faded);
  assert.ok(runMarkLook('town', 'visited').faded);
  assert.equal(runMarkLook('town', 'locked').tone, 'muted');
  assert.equal(runMarkLook('town', 'locked').glyph, 'lock');
});

test('the canvas painter: whole-pixel points, the role colours, one closed path', () => {
  const calls = [];
  const ctx = new Proxy(
    {},
    {
      get: (o, k) => (k in o ? o[k] : (...a) => calls.push([k, ...a])),
      set: (o, k, v) => ((o[k] = v), calls.push(['set', k, v]), true),
    }
  );
  const colors = {
    danger: { fill: '#c8492f', edge: '#5a1e12' },
    surface: { fill: '#fffbf0', edge: '#22301f' },
  };
  runMarkDraw(ctx, 100.3, 50.7, 22, 'boss', 'seen', colors);
  const pts = calls.filter(c => c[0] === 'moveTo' || c[0] === 'lineTo');
  assert.equal(pts.length, 4);
  for (const [, x, y] of pts) assert.ok(Number.isInteger(x - 0.5) && Number.isInteger(y - 0.5), `${x},${y}`);
  assert.ok(calls.some(c => c[0] === 'set' && c[1] === 'fillStyle' && c[2] === '#c8492f'));
  assert.ok(calls.some(c => c[0] === 'set' && c[1] === 'strokeStyle' && c[2] === '#5a1e12'));
  assert.deepEqual(
    calls.filter(c => ['closePath', 'fill', 'stroke'].includes(c[0])).map(c => c[0]),
    ['closePath', 'fill', 'stroke']
  );
  // a role the caller didn't give falls back to the surface colours
  calls.length = 0;
  runMarkDraw(ctx, 0, 0, 22, 'event', 'seen', colors);
  assert.ok(calls.some(c => c[0] === 'set' && c[1] === 'fillStyle' && c[2] === '#fffbf0'));
});
