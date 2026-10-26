// Camera track CAM-2: one zoom drives the walking camera's tilt, distance and field of view along curves
// (game/js/logic/camera-zoom.js); the default ends give the zoom as it was before (14 degrees a unit, the distance
// times the zoom, the same field of view), and camera goals can carry a zoom of their own (blendGoals).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ZOOM_ENDS, zoomBend, zoomShape } from '../../game/js/logic/camera-zoom.js';
import { blendGoals, followNew } from '../../game/js/logic/camera-follow.js';
import { readFileSync } from 'node:fs';

const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);

test('zoom 1 is the scene framing: no tilt, distance and field of view as they are', () => {
  const Z = zoomShape(1, ZOOM_ENDS);
  near(Z.pitch, 0);
  near(Z.dist, 1);
  near(Z.fov, 1);
});

test('the default ends give the zoom as before CAM-2, inside the range and past it', () => {
  for (const z of [0.3, 0.42, 0.55, 0.8, 1, 1.2, 1.7, 2.1]) {
    const Z = zoomShape(z, ZOOM_ENDS);
    near(Z.pitch, (z - 1) * 14, 1e-9);
    near(Z.dist, z, 1e-9);
    near(Z.fov, 1);
  }
});

test('the engine defaults are the ends that match the old zoom', () => {
  /* engine/settings.js needs a page, so its numbers are read from the text */
  const src = readFileSync(new URL('../../game/js/engine/settings.js', import.meta.url), 'utf8'),
    c = /** @type {Record<string, number>} */ ({});
  for (const [, k, v] of src.matchAll(/^ {4}(zoom\w+): (-?[\d.]+),$/gm)) c[k] = +v;
  assert.equal(c.zoomMin, ZOOM_ENDS.min);
  assert.equal(c.zoomMax, ZOOM_ENDS.max);
  for (const k of ['Pitch', 'Dist', 'Fov'])
    for (const e of ['near', 'far']) assert.equal(c['zoom' + e[0].toUpperCase() + e.slice(1) + k], ZOOM_ENDS[e + k]);
  assert.equal(c.zoomCurve, ZOOM_ENDS.curve);
});

test('each end is reached at its zoom, and the curves move one way only', () => {
  const E = { ...ZOOM_ENDS, nearFov: 1.2, farFov: 0.9, curve: 2 };
  const a = zoomShape(E.min, E),
    b = zoomShape(E.max, E);
  near(a.pitch, E.nearPitch);
  near(a.dist, E.nearDist);
  near(a.fov, E.nearFov);
  near(b.pitch, E.farPitch);
  near(b.dist, E.farDist);
  near(b.fov, E.farFov);
  let last = zoomShape(0.3, E);
  for (let z = 0.31; z <= 2.2; z += 0.01) {
    const Z = zoomShape(z, E);
    assert.ok(Z.pitch >= last.pitch - 1e-9 && Z.dist >= last.dist - 1e-9, `rises at ${z}`);
    last = Z;
  }
});

test('the curve bends but stays continuous at its end', () => {
  near(zoomBend(0.5, 1), 0.5);
  near(zoomBend(0.5, 2), 0.25);
  near(zoomBend(1, 2), 1);
  near(zoomBend(1.000001, 2), 1, 1e-5);
  near(zoomBend(1.5, 2), 2);
  near(zoomBend(-1, 2), 0);
});

test('distance and field of view never fall to nothing', () => {
  const Z = zoomShape(0.05, { ...ZOOM_ENDS, nearDist: 0.2, nearFov: 0.5 });
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
const { ZOOM_STOPS, stopShape, stopPull, nextStop, nearestStop, stopsProblems, stopsOrDefault } =
  await import('../../game/js/logic/camera-zoom.js');

test('the default stops give the zoom before CAM-4b exactly, inside them and past the ends', () => {
  for (let z = 0.25; z <= 2.4; z += 0.0137) {
    const A = zoomShape(z, ZOOM_ENDS),
      B = stopShape(z, ZOOM_STOPS);
    near(B.pitch, A.pitch, 1e-9);
    near(B.dist, A.dist, 1e-9);
    near(B.fov, A.fov, 1e-9);
    near(B.blur, 1, 1e-9);
    near(B.lead, 1, 1e-9);
  }
});

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
