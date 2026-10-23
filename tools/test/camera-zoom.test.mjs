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
