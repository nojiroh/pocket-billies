// Camera track CAM-4a: the Studio's Camera section: its readout of the walking camera (game/js/logic/camera-readout.js)
// and its folders, which hold every Camera dial exactly once (game/js/engine/settings.js CAMERA_FOLDERS).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cameraReadout, crispScale, gameRenderWidth } from '../../game/js/logic/camera-readout.js';

// engine/settings.js reads window and document when it loads (through hooks.js and art.js); nothing here draws
globalThis.window ??= globalThis;
globalThis.document ??= {};
const { CAMERA_FOLDERS, ENGINE_DEFAULTS, ENGINE_SPEC } = await import('../../game/js/engine/settings.js');

const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);

test('the readout: tilt, height, field of view and metres across from the camera', () => {
  /* 30 degrees down, 20 m back, a 1000 x 500 picture with F 1000: 20 m shows 20 m across, 10 m up */
  const R = cameraReadout({ rw: 1000, rh: 500, F: 1000, df: 20, sp: 0.5 });
  near(R.tilt, 30);
  near(R.height, 10);
  near(R.dist, 20);
  near(R.across, 20);
  near(R.vfov, 2 * Math.atan(0.25) * (180 / Math.PI));
  near(R.hfov, 2 * Math.atan(0.5) * (180 / Math.PI));
  /* 1000 drawing pixels over 20 m: 50 a metre, an art pixel (1/32 m) 1.5625 of them */
  near(R.artPx, 50 / 32);
});

test('the game drawing width: the pixel ratio up to 1.75, the resolution, the pixel budget', () => {
  assert.equal(gameRenderWidth(1280, 720, 1, 1), 1280);
  assert.equal(gameRenderWidth(1920, 1080, 1, 1), Math.round(1920 * Math.sqrt(1.6e6 / (1920 * 1080))));
  /* a phone at 3x draws at 1.75x, then within 1.6 million pixels */
  const w = gameRenderWidth(393, 852, 3, 1);
  assert.equal(w, Math.round(393 * 1.75));
  const big = gameRenderWidth(393, 852, 3, 2);
  assert.ok(Math.abs((big * big * 852) / 393 - 1.6e6) < 4000);
  assert.ok(gameRenderWidth(4000, 2000, 2, 1.5) <= 2400);
});

test('a crisp scale is within a few per cent of whole pixels', () => {
  assert.deepEqual(crispScale(2.03), { n: 2, crisp: true });
  assert.deepEqual(crispScale(2.5), { n: 3, crisp: false });
  assert.deepEqual(crispScale(0.4), { n: 1, crisp: false });
});

test('every Camera dial is in exactly one folder of the Camera section', () => {
  const spec = ENGINE_SPEC.find(g => g[0] === 'camera')[2].map(f => f[0]),
    folded = CAMERA_FOLDERS.flatMap(f => f[2]);
  assert.deepEqual([...folded].sort(), [...spec].sort());
  assert.equal(new Set(folded).size, folded.length);
  for (const k of folded) assert.ok(k in ENGINE_DEFAULTS.camera, k);
});
