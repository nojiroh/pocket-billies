// UI-4: the run map's node markers (game/js/logic/run-marks.js): one outline per node type, the same for the kit's
// <pb-node> (SVG) and the bowl's canvas painter.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { svgToPixels } from '../../game/js/logic/svg-pixels.js';
import {
  RUN_MARK_ART,
  RUN_MARK_SHAPES,
  RUN_MARK_SIZES,
  RUN_MARK_STATES,
  RUN_MARK_TYPES,
  runMarkClip,
  runMarkDraw,
  runMarkGrey,
  RUN_MARK_FAMILIES,
  runMarkLook,
  runMarkPixels,
  runMarkPoints,
} from '../../game/js/logic/run-marks.js';
import { MARK_CHIP_FAMILIES } from '../../game/js/logic/marks.js';

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
  /* UI-14b: the family table: towns good, bosses bad, shops value, events and "?" special, scrapyards machine */
  assert.equal(runMarkLook('town').family, 'good');
  assert.equal(runMarkLook('boss', 'hidden').family, 'special');
  assert.equal(runMarkLook('town', 'locked').family, '');
  for (const k of Object.keys(RUN_MARK_FAMILIES))
    if (MARK_CHIP_FAMILIES[k]) assert.equal(runMarkLook(k).family, MARK_CHIP_FAMILIES[k][0], `${k}: the chip's family`);
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

// UI-8c: the places as 36 px pixel icons (game/art/ui/node-<shape>.svg, Badges)
const UI = join(import.meta.dirname, '../../game/art/ui');
const iconPx = (/** @type {string} */ name) => {
  const px = svgToPixels(readFileSync(join(UI, `${name}.svg`), 'utf8'));
  assert.ok(!('error' in px), `${name}: ${px.error}`);
  return px;
};
/** is (x, y) inside a polygon (even-odd) */
const inside = (x, y, pts) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i],
      [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

test('UI-8c: each state names its icon, its badge and its size (28 px, 34 where you stand)', () => {
  assert.deepEqual(RUN_MARK_SIZES, { seen: 28, current: 34 });
  assert.equal(runMarkLook('town').icon, 'node-town');
  assert.equal(runMarkLook('boss', 'hidden').icon, 'node-unknown', 'a hidden place shows the "?" whatever it is');
  assert.equal(runMarkLook('nope').icon, 'node-unknown');
  assert.equal(runMarkLook('shop', 'current').size, 34);
  assert.equal(runMarkLook('shop', 'seen').size, 28);
  assert.equal(runMarkLook('town', 'visited').badge, 'node-check');
  assert.equal(runMarkLook('town', 'locked').badge, 'node-lock');
  assert.equal(runMarkLook('town', 'current').badge, '');
});

test('UI-8c: every place icon is a 36 px picture in the pixel format, inside its UI-4 outline', () => {
  const N = RUN_MARK_ART.grid;
  for (const t of RUN_MARK_TYPES) {
    const px = iconPx(`node-${t}`);
    assert.equal(px.w, N, t);
    assert.equal(px.h, N, t);
    let n = 0;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        if (px.data[(y * N + x) * 4 + 3] < 128) continue;
        n++;
        /* the plate sits on the 36 grid inset by 2; a pixel is in when any of its corners is inside the outline */
        const at = (/** @type {number} */ v) => ((v - 2) / (N - 4)) * 100,
          hit = [0, 1].some(dx => [0, 1].some(dy => inside(at(x + dx), at(y + dy), RUN_MARK_SHAPES[t])));
        assert.ok(hit, `${t}: the pixel at ${x},${y} is outside its outline`);
      }
    assert.ok(n > 150, `${t}: only ${n} pixels`);
  }
  for (const b of ['node-check', 'node-lock']) {
    const px = iconPx(b);
    /* the badges sit in the bottom-right corner, so the place's glyph stays clear */
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++)
        if (px.data[(y * N + x) * 4 + 3] >= 128) assert.ok(x >= 24 && y >= 24, `${b}: a pixel at ${x},${y}`);
  }
});

test('UI-8c: the picture per state: the gold rim where you stand, done faded, locked grey, the badge on top', () => {
  const N = RUN_MARK_ART.grid,
    R = RUN_MARK_ART.rim,
    W = N + 2 * R;
  /* one red pixel in the middle of the grid */
  const icon = new Uint8ClampedArray(N * N * 4),
    mid = (18 * N + 18) * 4;
  icon.set([200, 73, 47, 255], mid);
  const px = (/** @type {any} */ p, /** @type {number} */ x, /** @type {number} */ y) =>
    Array.from(p.data.slice((y * W + x) * 4, (y * W + x) * 4 + 4));
  const seen = runMarkPixels(icon, null, 'seen');
  assert.equal(seen.w, W);
  assert.deepEqual(px(seen, 18 + R, 18 + R), [200, 73, 47, 255], 'the icon sits inside the rim margin');
  assert.equal(px(seen, 18 + R + 1, 18 + R)[3], 0, 'no rim unless you stand there');
  const cur = runMarkPixels(icon, null, 'current');
  assert.deepEqual(px(cur, 18 + R, 18 + R), [200, 73, 47, 255], 'the icon over its rim');
  assert.deepEqual(px(cur, 18 + R + 1, 18 + R).slice(0, 3), RUN_MARK_ART.rimFill, 'the rim inside');
  assert.deepEqual(px(cur, 18 + R + 2, 18 + R).slice(0, 3), RUN_MARK_ART.rimEdge, 'its outer edge darker');
  assert.equal(px(cur, 18 + R + 3, 18 + R)[3], 0, 'two art pixels wide');
  assert.equal(px(cur, 18 + R + 2, 18 + R + 2)[3], 0, 'its corners rounded off');
  assert.equal(px(runMarkPixels(icon, null, 'visited'), 18 + R, 18 + R)[3], Math.round(255 * RUN_MARK_ART.dim));
  const grey = px(runMarkPixels(icon, null, 'locked'), 18 + R, 18 + R);
  assert.deepEqual(grey.slice(0, 3), runMarkGrey(200, 73, 47));
  assert.equal(grey[0], grey[1], 'grey');
  /* the badge covers the icon and is never faded */
  const badge = new Uint8ClampedArray(N * N * 4);
  badge.set([59, 132, 70, 255], mid);
  assert.deepEqual(px(runMarkPixels(icon, badge, 'visited'), 18 + R, 18 + R), [59, 132, 70, 255]);
});
