// Characters track CH-2: a figure's parts, poses and view (game/js/logic/figure-pose.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLIP_FRAMES,
  TILT_STEP,
  WALK_CYCLE_M,
  cardPoint,
  cardSize,
  clipFrameAt,
  figureClipMatrix,
  figureKey,
  figureMesh,
  figurePose,
  figureRamp,
  figureTick,
  figureView,
  jointMatrices,
  mannequinFigure,
  outlineOf,
  restPose,
  toonBand,
} from '../../game/js/logic/figure-pose.js';

/* tools/build-scene-props.py ramp(c) and olc(c), printed by Python for these colours */
const PROPS = {
  '248,214,178': [
    [113, 94, 102],
    [178, 153, 142],
    [248, 214, 178],
    [250, 223, 183],
    [252, 237, 212],
    [51, 39, 59],
  ],
  '132,84,60': [
    [68, 45, 57],
    [103, 67, 65],
    [132, 84, 60],
    [169, 132, 101],
    [206, 185, 164],
    [41, 27, 49],
  ],
  '46,164,160': [
    [36, 76, 95],
    [46, 120, 130],
    [46, 164, 160],
    [109, 188, 171],
    [171, 217, 204],
    [33, 35, 58],
  ],
  '70,84,112': [
    [45, 45, 76],
    [62, 67, 99],
    [70, 84, 112],
    [126, 132, 137],
    [181, 185, 185],
    [35, 27, 53],
  ],
  '178,118,72': [
    [86, 57, 61],
    [133, 90, 72],
    [178, 118, 72],
    [201, 156, 109],
    [224, 198, 169],
    [45, 31, 50],
  ],
  '37,91,203': [
    [32, 48, 111],
    [40, 72, 159],
    [37, 91, 203],
    [102, 137, 201],
    [168, 188, 222],
    [32, 28, 61],
  ],
};

/** a point through a column-major 4x4 matrix */
const apply = (m, p) => [0, 1, 2, 3].map(r => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);

test('figure pose: the ramps and the outline are the scene props’ own, to the unit', () => {
  for (const [k, want] of Object.entries(PROPS)) {
    const c = k.split(',').map(Number);
    assert.deepEqual(figureRamp(c), want.slice(0, 5), k);
    assert.deepEqual(outlineOf(c), want[5], k);
  }
});

test('figure pose: the light is from the top left: tops and left sides lit, right sides in shadow', () => {
  assert.equal(toonBand([0, 1, 0]), 2);
  assert.equal(toonBand([-1, 0, 0]), 2);
  assert.equal(toonBand([0, 0, -1]), 1, 'a face toward the camera is the base');
  assert.equal(toonBand([1, 0, 0]), 0);
  assert.equal(toonBand([0, -1, 0]), 0);
});

test('figure pose: the mannequin is 1.75 m at about 2.75 heads, a parent before each child', () => {
  const F = mannequinFigure(),
    M = jointMatrices(F, restPose(F), 0);
  let top = -1,
    bottom = 9;
  F.parts.forEach((p, i) => {
    assert.ok(p.parent < i, `${p.id} comes after its parent`);
    assert.ok(p.col in F.colours, `${p.id}'s colour`);
    for (const x of [0, 3])
      for (const y of [1, 4])
        for (const z of [2, 5]) {
          const q = apply(M.subarray(i * 16, i * 16 + 16), [p.box[x], p.box[y], p.box[z]]);
          top = Math.max(top, q[1]);
          bottom = Math.min(bottom, q[1]);
        }
  });
  assert.ok(Math.abs(bottom) < 1e-6, `the soles on the ground (${bottom})`);
  assert.ok(Math.abs(top - 1.74) < 0.02, `the hair's top at about 1.75 m (${top})`);
  const head = F.parts.find(p => p.id === 'head');
  assert.ok(Math.abs(1.75 / (head.box[4] - head.box[1]) - 2.75) < 0.1, 'about 2.75 heads');
});

test('figure pose: the mesh is 36 vertices a box, each on one joint, the normals outward', () => {
  const F = mannequinFigure(),
    { data, count, colours } = figureMesh(F);
  assert.equal(count, F.parts.length * 36);
  assert.deepEqual(colours, Object.keys(F.colours));
  for (let v = 0; v < count; v++) {
    const j = data[v * 8 + 6];
    assert.ok(Number.isInteger(j) && j >= 0 && j < F.parts.length);
  }
  /* each triangle winds counter-clockwise seen along its normal */
  for (let t = 0; t < count; t += 3) {
    const p = k => [0, 1, 2].map(i => data[(t + k) * 8 + i]),
      [a, b, c] = [p(0), p(1), p(2)],
      e1 = b.map((x, i) => x - a[i]),
      e2 = c.map((x, i) => x - a[i]),
      n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]],
      d = n[0] * data[t * 8 + 3] + n[1] * data[t * 8 + 4] + n[2] * data[t * 8 + 5];
    assert.ok(d > 0, `triangle ${t / 3}`);
  }
});

test('figure pose: the walk swings the legs against each other and the arms against the legs', () => {
  const F = mannequinFigure(),
    at = id => F.parts.findIndex(p => p.id === id);
  assert.equal(CLIP_FRAMES.walk, 8);
  const P2 = figurePose(F, 'walk', 2),
    P6 = figurePose(F, 'walk', 6);
  assert.ok(P2.rot[at('thighA')][0] < -0.5 && P2.rot[at('thighB')][0] > 0.5, 'frame 2: A forward, B back');
  assert.ok(P2.rot[at('armA')][0] > 0.4, 'the arm on the side of the forward leg swings back');
  assert.deepEqual(P6.rot[at('thighA')], P2.rot[at('thighB')]);
  assert.ok(P2.rootY < 0 && Math.abs(figurePose(F, 'walk', 0).rootY) < 1e-9, 'it drops as the legs part');
  for (let f = 0; f < 8; f++) {
    const P = figurePose(F, 'walk', f);
    for (const k of ['A', 'B']) {
      const foot = P.rot[at('thigh' + k)][0] + P.rot[at('shin' + k)][0] + P.rot[at('foot' + k)][0];
      assert.ok(Math.abs(foot) < 1e-9, `frame ${f}: foot ${k} level`);
    }
  }
  /* the frames wrap */
  assert.deepEqual(figurePose(F, 'walk', 9), figurePose(F, 'walk', 1));
});

test('figure pose: the idle breathes and blinks once', () => {
  const F = mannequinFigure(),
    at = id => F.parts.findIndex(p => p.id === id),
    blinks = [];
  for (let f = 0; f < CLIP_FRAMES.idle; f++) {
    const P = figurePose(F, 'idle', f);
    if (P.scale[at('eyeA')][1] < 1) blinks.push(f);
  }
  assert.deepEqual(blinks, [14]);
  assert.ok(figurePose(F, 'idle', 6).lift[at('torso')][1] > figurePose(F, 'idle', 0).lift[at('torso')][1]);
});

test('figure pose: the lift is snapped to whole texels', () => {
  const F = mannequinFigure(),
    P = figurePose(F, 'walk', 2),
    M = jointMatrices(F, P, 32),
    y = M[13];
  assert.ok(Math.abs((y - 0.5) * 32 - Math.round((y - 0.5) * 32)) < 1e-4, `hips at ${y}`);
});

test('figure pose: the view steps the heading as the camera sees it, and the tilt', () => {
  /* facing away from an unturned camera is step 0; facing it (heading π) is half way round */
  assert.equal(figureView(0, 0, 0.45, 16).k, 0);
  assert.equal(figureView(Math.PI, 0, 0.45, 16).k, 8);
  assert.equal(figureView(Math.PI, Math.PI, 0.45, 16).k, 0, 'turned with the camera');
  assert.equal(figureView(-Math.PI / 2, 0, 0.45, 8).k, 6);
  assert.equal(figureView(0.19, 0, 0.45, 16).k, 0);
  assert.equal(figureView(0.2, 0, 0.45, 16).k, 1);
  const V = figureView(0, 0, (26 * Math.PI) / 180, 16);
  assert.equal(V.tiltStep, 13);
  assert.ok(Math.abs(V.tilt - 13 * TILT_STEP) < 1e-12);
});

test('figure pose: the oblique card, shortened by the camera, is what the camera sees', () => {
  /* a camera tilted t looking down along +z: a point's height on the screen is y cos t + z sin t. On the upright card
     it is v, shortened by cos t: v cos t must be the same */
  const t = (26 * Math.PI) / 180;
  for (const p of [
    [0, 1.7, 0],
    [0.2, 0.1, 0.3],
    [-0.3, 0.9, -0.25],
  ]) {
    const q = cardPoint(p, 0, t);
    assert.ok(Math.abs(q.v * Math.cos(t) - (p[1] * Math.cos(t) + p[2] * Math.sin(t))) < 1e-12);
    assert.ok(Math.abs(q.depth - (p[2] * Math.cos(t) - p[1] * Math.sin(t))) < 1e-12);
  }
  /* turned a quarter, the figure's +z (its front) points to the camera's right */
  const q = cardPoint([0, 0, 1], Math.PI / 2, t);
  assert.ok(Math.abs(q.u - 1) < 1e-12 && Math.abs(q.v) < 1e-12);
});

test('figure pose: the clip matrix puts the card on the bake’s pixels', () => {
  const t = (26 * Math.PI) / 180,
    S = cardSize(32, t),
    M = figureClipMatrix(0.7, t, 32, S);
  for (const p of [
    [0, 0, 0],
    [0.1, 1.6, -0.2],
    [-0.25, 0.4, 0.3],
  ]) {
    const c = apply(M, p),
      q = cardPoint(p, 0.7, t),
      col = ((c[0] + 1) / 2) * S.w,
      row = ((1 - c[1]) / 2) * S.h;
    assert.ok(Math.abs(col - (S.ax + q.u * 32)) < 1e-3, 'across');
    assert.ok(Math.abs(row - (S.ay - q.v * 32)) < 1e-3, 'down');
    assert.ok(Math.abs(c[2] - q.depth / 2.5) < 1e-6, 'depth');
    assert.equal(c[3], 1);
  }
  /* the whole figure fits, in every pose and view */
  const F = mannequinFigure();
  for (const clip of ['idle', 'walk'])
    for (let f = 0; f < CLIP_FRAMES[clip]; f++) {
      const J = jointMatrices(F, figurePose(F, clip, f), 32);
      for (let k = 0; k < 16; k++)
        F.parts.forEach((p, i) => {
          for (const x of [0, 3])
            for (const y of [1, 4])
              for (const z of [2, 5]) {
                const w = apply(J.subarray(i * 16, i * 16 + 16), [p.box[x], p.box[y], p.box[z]]),
                  c = apply(
                    figureClipMatrix((k * Math.PI) / 8, (40 * Math.PI) / 180, 32, cardSize(32, (40 * Math.PI) / 180)),
                    w
                  ),
                  sz = cardSize(32, (40 * Math.PI) / 180);
                /* 2 px kept free for the outline */
                assert.ok(
                  Math.abs(c[0]) <= 1 - 4 / sz.w && Math.abs(c[1]) <= 1 - 4 / sz.h,
                  `${clip} ${f} ${k} ${p.id}`
                );
              }
        });
    }
});

test('figure pose: the clock: the idle on twos, the walk by the distance walked', () => {
  const tick = 1000 / 12;
  assert.equal(clipFrameAt('idle', 0), 0);
  assert.equal(clipFrameAt('idle', tick * 1.5), 0);
  assert.equal(clipFrameAt('idle', tick * 2), 1);
  assert.equal(clipFrameAt('idle', tick * 32), 0, 'wraps after 16 poses');
  assert.equal(clipFrameAt('walk', 0, 0), 0);
  assert.equal(clipFrameAt('walk', 0, WALK_CYCLE_M / 8), 1);
  assert.equal(clipFrameAt('walk', 0, WALK_CYCLE_M * 1.5), 4);
  assert.equal(figureTick(tick * 3 + 1), 3);
  assert.equal(
    figureKey('mannequin', 'walk', 3, { k: 5, tiltStep: 13 }, 16, 32, true),
    'mannequin|walk|3|5/16|13|32|1'
  );
});
