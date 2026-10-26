// Camera track CAM-2: one zoom drives the walking camera's tilt, distance and field of view along curves
// (game/js/logic/camera-zoom.js); CAM-4b: the curves run through the zoom stops, whose defaults give the zoom as it
// was before (14 degrees a unit, the distance times the zoom, the same field of view); camera goals carry a zoom too.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ZOOM_STOPS, stopShape } from '../../game/js/logic/camera-zoom.js';
import { blendGoals, followNew } from '../../game/js/logic/camera-follow.js';
import { readFileSync } from 'node:fs';

const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);

test('zoom 1 is the scene framing: no tilt, distance and field of view as they are', () => {
  const Z = stopShape(1, ZOOM_STOPS);
  near(Z.pitch, 0);
  near(Z.dist, 1);
  near(Z.fov, 1);
});

test('the default stops give the zoom as before CAM-2, inside the range and past it', () => {
  for (const z of [0.3, 0.42, 0.55, 0.8, 1, 1.2, 1.7, 2.1]) {
    const Z = stopShape(z, ZOOM_STOPS);
    near(Z.pitch, (z - 1) * 14, 1e-9);
    near(Z.dist, z, 1e-9);
    near(Z.fov, 1);
  }
});

test('the engine defaults are the default stops', () => {
  /* engine/settings.js reads them from logic/camera-zoom.js; the old ends are gone */
  const src = readFileSync(new URL('../../game/js/engine/settings.js', import.meta.url), 'utf8');
  assert.match(src, /stops: ZOOM_STOPS\.map\(s => \(\{ \.\.\.s \}\)\)/);
  assert.doesNotMatch(src, /zoom(Min|Max|Near\w+|Far\w+|Curve):/);
});

test('distance and field of view never fall to nothing', () => {
  const S = ZOOM_STOPS.map(s => ({ ...s }));
  Object.assign(S[0], { dist: 0.2, fov: 0.5 });
  const Z = stopShape(0.05, S);
  assert.ok(Z.dist >= 0.15 && Z.fov >= 0.2);
});

test('camera goals carry a zoom that ramps in with their weight and multiplies', () => {
  const st = followNew(0, 0, 0);
  const G0 = blendGoals(st, [{ id: 'a', w: 1, zoom: 0.5 }], 0.1, 0.4, true);
  near(G0.zoom, 0.5);
  const st2 = followNew(0, 0, 0),
    G1 = blendGoals(
      st2,
      [
        { id: 'a', w: 1, zoom: 0.5 },
        { id: 'b', w: 1, zoom: 1.2 },
      ],
      0,
      0,
      true
    );
  near(G1.zoom, 0.6);
  const st3 = followNew(0, 0, 0),
    G2 = blendGoals(st3, [{ id: 'a', w: 1, zoom: 0.5 }], 0.1, 0.4);
  assert.ok(G2.zoom < 1 && G2.zoom > 0.5, `part way: ${G2.zoom}`);
  const G3 = blendGoals(st3, [], 10, 0.4);
  near(G3.zoom, 1);
});

// CAM-4a: the zoom's feel (Camera > Feel)
const { zoomEase, pinchZoom, zoomBand, pinchLean } = await import('../../game/js/logic/camera-zoom.js');

test('the zoom eases in log space: the same share of the way in and out, exact at any frame rate', () => {
  /* after `smooth` seconds 63% of the way in log zoom, whichever way */
  const share = (z, zT) => Math.log(zoomEase(z, zT, 0.2, 0.2) / z) / Math.log(zT / z);
  near(share(1, 0.5), 1 - Math.exp(-1), 1e-12);
  near(share(1, 2), 1 - Math.exp(-1), 1e-12);
  /* 30, 60 and 144 frames a second land on the same zoom after half a second */
  const run = fps => {
    let z = 1.6;
    for (let i = 0; i < fps / 2; i++) z = zoomEase(z, 0.6, 0.25, 1 / fps);
    return z;
  };
  near(run(30), run(144), 1e-9);
  near(run(60), run(144), 1e-9);
  /* never passes its target; 0 seconds is at once */
  assert.ok(zoomEase(1, 0.5, 0.2, 5) >= 0.5);
  assert.equal(zoomEase(1, 0.7, 0, 0.016), 0.7);
});

test('a pinch follows the fingers at sensitivity 1, as before CAM-4a, and quicker above it', () => {
  near(pinchZoom(1, 200, 400, 1), 0.5);
  near(pinchZoom(0.8, 300, 150, 1), 1.6);
  near(pinchZoom(1, 200, 400, 2), 0.25);
  /* fingers closer than 20 px count as 20 */
  near(pinchZoom(1, 200, 5, 1), 10);
});

test('the rubber band: a hard stop at 0, and past a limit it gives no more than the band', () => {
  assert.equal(zoomBand(0.2, 0.55, 1.7, 0), 0.55);
  assert.equal(zoomBand(3, 0.55, 1.7, 0), 1.7);
  near(zoomBand(1.1, 0.55, 1.7, 0.15), 1.1);
  const lo = zoomBand(0.4, 0.55, 1.7, 0.15),
    far = zoomBand(0.01, 0.55, 1.7, 0.15),
    hi = zoomBand(2.5, 0.55, 1.7, 0.15);
  assert.ok(lo < 0.55 && lo > 0.55 * Math.exp(-0.15));
  assert.ok(far < lo && far > 0.55 * Math.exp(-0.15));
  assert.ok(hi > 1.7 && hi < 1.7 * Math.exp(0.15));
  /* smooth at the limit: just past it, it gives as much as it is asked */
  near(Math.log(zoomBand(0.55 * Math.exp(-1e-4), 0.55, 1.7, 0.15) / 0.55), -1e-4, 1e-7);
});

test('the pinch lean keeps the pinched point still, capped', () => {
  /* zooming in to half about a point 4 m east leans the aim 2 m east */
  const [x, z] = pinchLean(14, 10, 10, 10, 1, 0.5, 9);
  near(x, 2);
  near(z, 0);
  /* that point stays put: its offset from the new aim is half the old one, as the view is half as wide */
  near((14 - (10 + x)) / 4, 0.5);
  /* capped, and nothing at the starting zoom */
  const c = pinchLean(30, 10, 10, 10, 1, 0.5, 3);
  near(Math.hypot(c[0], c[1]), 3);
  assert.deepEqual(pinchLean(14, 10, 10, 10, 1, 1, 9), [0, 0]);
});

// CAM-4b: zoom stops (Camera > Zoom stops)
const { stopPull, nextStop, nearestStop, stopsProblems, stopsOrDefault } =
  await import('../../game/js/logic/camera-zoom.js');

test('each stop is reached at its zoom, and between stops a value never overshoots its neighbours', () => {
  const S = [
    { id: 'a', name: 'A', zoom: 0.5, pitch: -8, dist: 0.5, fov: 1.1, blur: 1.6, lead: 0.6 },
    { id: 'b', name: 'B', zoom: 0.8, pitch: -1, dist: 0.85, fov: 1, blur: 1.6, lead: 1 },
    { id: 'c', name: 'C', zoom: 1, pitch: 0, dist: 1, fov: 1, blur: 1, lead: 1 },
    { id: 'd', name: 'D', zoom: 2, pitch: 14, dist: 1.9, fov: 0.9, blur: 0.3, lead: 1.4 },
  ];
  for (const s of S) {
    const V = stopShape(s.zoom, S);
    for (const k of ['pitch', 'dist', 'fov', 'blur', 'lead']) near(V[k], s[k], 1e-9);
  }
  for (let i = 0; i < S.length - 1; i++)
    for (let t = 0; t <= 1; t += 0.01) {
      const z = S[i].zoom + (S[i + 1].zoom - S[i].zoom) * t,
        V = stopShape(z, S);
      for (const k of ['pitch', 'dist', 'fov', 'blur', 'lead']) {
        const lo = Math.min(S[i][k], S[i + 1][k]),
          hi = Math.max(S[i][k], S[i + 1][k]);
        assert.ok(V[k] >= lo - 1e-9 && V[k] <= hi + 1e-9, `${k} at ${z.toFixed(3)}: ${V[k]} in ${lo}-${hi}`);
      }
    }
  /* a flat stretch stays flat (blur 1.6 from A to B) */
  near(stopShape(0.65, S).blur, 1.6, 1e-9);
});

test('a pinch let go near a stop settles on it; far from any it stays; 0 never pulls', () => {
  /* Normal 1 and Far 1.7: the gap is ln 1.7 */
  const g = Math.log(1.7);
  assert.equal(stopPull(Math.exp(g * 0.9), ZOOM_STOPS, 0.2).stop.id, 'far');
  assert.equal(stopPull(Math.exp(g * 0.1), ZOOM_STOPS, 0.2).stop.id, 'normal');
  const mid = Math.exp(g * 0.5);
  assert.equal(stopPull(mid * 0.98, ZOOM_STOPS, 0.2).stop, null);
  near(stopPull(mid * 0.98, ZOOM_STOPS, 0.2).zoom, mid * 0.98);
  /* 0.5: always the nearest */
  assert.equal(stopPull(mid * 0.98, ZOOM_STOPS, 0.5).stop.id, 'normal');
  assert.equal(stopPull(Math.exp(g * 0.9), ZOOM_STOPS, 0).stop, null);
  /* past an end stop (the rubber band) it is pulled to the end */
  assert.equal(stopPull(1.8, ZOOM_STOPS, 0.2).stop.id, 'far');
});

test('the stops cycle from the one nearest, round to the first', () => {
  assert.equal(nearestStop(0.9, ZOOM_STOPS), 1);
  assert.equal(nextStop(1, ZOOM_STOPS).id, 'far');
  assert.equal(nextStop(1.7, ZOOM_STOPS).id, 'close');
  assert.equal(nextStop(0.6, ZOOM_STOPS).id, 'normal');
});

test('a broken list of stops is caught and the default ones used', () => {
  assert.deepEqual(stopsProblems(ZOOM_STOPS), []);
  assert.ok(stopsProblems(ZOOM_STOPS.slice(0, 2)).length);
  assert.ok(stopsProblems([...ZOOM_STOPS].reverse()).some(p => /rise/.test(p)));
  assert.ok(stopsProblems([ZOOM_STOPS[0], ZOOM_STOPS[0], ZOOM_STOPS[2]]).some(p => /twice/.test(p)));
  assert.ok(stopsProblems([{ ...ZOOM_STOPS[0], blur: 'x' }, ZOOM_STOPS[1], ZOOM_STOPS[2]]).length);
  assert.equal(stopsOrDefault(null), ZOOM_STOPS);
  const own = ZOOM_STOPS.map(s => ({ ...s }));
  assert.equal(stopsOrDefault(own), own);
});
