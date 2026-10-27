// Characters track CH-2: a figure's parts, poses and view (game/js/logic/figure-pose.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLIP_FRAMES,
  TILT_STEP,
  WALK_CYCLE_M,
  cardPoint,
  cardSize,
  codeExtent,
  clipFrameAt,
  figureClipMatrix,
  figureFaceMarks,
  figureKey,
  figureMesh,
  figurePose,
  figureRamp,
  figureTick,
  figureView,
  jointMatrices,
  mannequinFigure,
  meshClipFrame,
  meshClipMatrices,
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

/** every vertex of a figure in its pose, in the figure's space, with its part */
function posedVertices(F, J) {
  const { data, count } = figureMesh(F),
    out = [];
  for (let v = 0; v < count; v++) {
    const j = data[v * 8 + 6];
    out.push({ p: apply(J.subarray(j * 16, j * 16 + 16), [data[v * 8], data[v * 8 + 1], data[v * 8 + 2]]), j });
  }
  return out;
}

test('figure pose: the mannequin is 1.75 m to its cowlick at about 2.75 heads, a parent before each child', () => {
  const F = mannequinFigure(),
    V = posedVertices(F, jointMatrices(F, restPose(F), 0)),
    ys = V.map(v => v.p[1]),
    of = id => V.filter(v => F.parts[v.j].id === id).map(v => v.p[1]);
  F.parts.forEach((p, i) => {
    assert.ok(p.parent < i, `${p.id} comes after its parent`);
    assert.ok(p.col in F.colours, `${p.id}'s colour`);
  });
  assert.ok(Math.abs(Math.min(...ys)) < 0.005, `the soles on the ground (${Math.min(...ys)})`);
  assert.ok(Math.abs(Math.max(...ys) - 1.75) < 0.02, `the cowlick's tip at about 1.75 m (${Math.max(...ys)})`);
  const head = Math.max(...of('hair')) - Math.min(...of('head'));
  assert.ok(Math.abs(1.75 / head - 2.75) < 0.2, `about 2.75 heads (${(1.75 / head).toFixed(2)})`);
  /* the head sits on the body: no gap at the neck */
  assert.ok(Math.min(...of('head')) <= Math.max(...of('torso')) + 0.005, 'no neck showing');
});

test('figure pose: the mesh: rounded shapes, each vertex on one joint, wound outward, smooth normals', () => {
  const F = mannequinFigure(),
    { data, count, colours } = figureMesh(F);
  assert.equal(count % 3, 0);
  assert.ok(count > 2000 && count < 20000, `${count} vertices`);
  assert.deepEqual(colours, Object.keys(F.colours));
  const seen = new Set();
  for (let v = 0; v < count; v++) {
    const j = data[v * 8 + 6];
    assert.ok(Number.isInteger(j) && j >= 0 && j < F.parts.length);
    seen.add(j);
    const n = Math.hypot(data[v * 8 + 3], data[v * 8 + 4], data[v * 8 + 5]);
    assert.ok(Math.abs(n - 1) < 1e-5, `vertex ${v}'s normal is a unit`);
  }
  assert.equal(seen.size, F.parts.length, 'every part has triangles');
  /* each triangle winds counter-clockwise seen from outside: its own normal goes with its vertices' */
  for (let t = 0; t < count; t += 3) {
    const p = k => [0, 1, 2].map(i => data[(t + k) * 8 + i]),
      [a, b, c] = [p(0), p(1), p(2)],
      e1 = b.map((x, i) => x - a[i]),
      e2 = c.map((x, i) => x - a[i]),
      n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]],
      vn = [3, 4, 5].map(i => data[t * 8 + i] + data[(t + 1) * 8 + i] + data[(t + 2) * 8 + i]),
      d = n[0] * vn[0] + n[1] * vn[1] + n[2] * vn[2];
    assert.ok(d > 0, `triangle ${t / 3}`);
  }
  /* smooth: the same point has one normal in every triangle round it */
  const at = new Map();
  for (let v = 0; v < count; v++) {
    const k = [0, 1, 2, 6].map(i => data[v * 8 + i].toFixed(5)).join(','),
      n = [3, 4, 5].map(i => data[v * 8 + i]);
    if (!at.has(k)) at.set(k, n);
    else
      assert.ok(
        at.get(k).every((x, i) => Math.abs(x - n[i]) < 1e-5),
        `one normal at ${k}`
      );
  }
  /* the hair is a cap: none of it below the back of the neck */
  const hair = F.parts.findIndex(q => q.id === 'hair');
  for (let v = 0; v < count; v++)
    if (data[v * 8 + 6] === hair) assert.ok(data[v * 8 + 1] > 0.305 - 0.302 * 0.75, 'the hair stops above the nape');
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
  assert.ok(P2.rootY < 0 && figurePose(F, 'walk', 0).rootY > 0, 'it drops as the legs part and bounces as they pass');
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

test('figure pose: the idle breathes, nods and blinks once', () => {
  const F = mannequinFigure(),
    at = id => F.parts.findIndex(p => p.id === id),
    blinks = [];
  for (let f = 0; f < CLIP_FRAMES.idle; f++) if (figurePose(F, 'idle', f).blink) blinks.push(f);
  assert.deepEqual(blinks, [14]);
  assert.ok(figurePose(F, 'idle', 6).lift[at('torso')][1] > figurePose(F, 'idle', 0).lift[at('torso')][1]);
  assert.notDeepEqual(figurePose(F, 'idle', 6).rot[at('head')], figurePose(F, 'idle', 0).rot[at('head')], 'a nod');
});

test('figure pose: the face: two eyes with glints, a mouth and blush seen from the front, none from behind', () => {
  const F = mannequinFigure(),
    t = (26 * Math.PI) / 180,
    S = cardSize(32, t),
    marks = (rel, clip = 'idle', f = 0) => {
      const P = figurePose(F, clip, f);
      return figureFaceMarks(F, jointMatrices(F, P, 32), P, { rel, tilt: t }, 32, S);
    },
    kinds = M =>
      M.map(m => m.kind)
        .sort()
        .join(' ');
  /* facing the camera (rel π): everything, the eyes 3 x 4 pixels with a glint at their top left */
  const front = marks(Math.PI);
  assert.equal(kinds(front), 'blush blush eye eye glint glint mouth');
  const eyes = front.filter(m => m.kind === 'eye');
  for (const e of eyes) assert.deepEqual([e.w, e.h], [3, 4]);
  for (const g of front.filter(m => m.kind === 'glint'))
    assert.ok(
      eyes.some(e => e.x === g.x && e.y === g.y),
      'a glint at the top left of an eye'
    );
  /* the two eyes level, apart, inside the picture, the mouth under them and between them */
  assert.equal(eyes[0].y, eyes[1].y);
  assert.ok(Math.abs(eyes[0].x - eyes[1].x) >= 5);
  const mouth = front.find(m => m.kind === 'mouth');
  assert.ok(
    mouth.y > eyes[0].y + 3 && mouth.x > Math.min(eyes[0].x, eyes[1].x) && mouth.x < Math.max(eyes[0].x, eyes[1].x)
  );
  for (const m of front) assert.ok(m.x >= 0 && m.y >= 0 && m.x + m.w <= S.w && m.y + m.h <= S.h);
  /* from behind: no face; side on: one narrow eye and no mouth */
  assert.equal(marks(0).length, 0);
  const side = marks(Math.PI / 2);
  assert.equal(side.filter(m => m.kind === 'eye').length, 1);
  assert.equal(side.find(m => m.kind === 'eye').w, 1);
  assert.equal(side.filter(m => m.kind === 'mouth').length, 0);
  /* a blink: the eyes a line, no glints */
  const shut = marks(Math.PI, 'idle', 14);
  for (const e of shut.filter(m => m.kind === 'eye')) assert.equal(e.h, 1);
  assert.equal(shut.filter(m => m.kind === 'glint').length, 0);
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
  /* the whole figure fits, in every pose and view, at the Normal and the Far tilts, 2 px kept free for the outline */
  const F = mannequinFigure();
  for (const deg of [26, 40])
    for (const clip of ['idle', 'walk'])
      for (let f = 0; f < CLIP_FRAMES[clip]; f++) {
        const tl = (deg * Math.PI) / 180,
          sz = cardSize(32, tl),
          V = posedVertices(F, jointMatrices(F, figurePose(F, clip, f), 32));
        for (let k = 0; k < 16; k++) {
          const M = figureClipMatrix((k * Math.PI) / 8, tl, 32, sz);
          for (const v of V) {
            const c = apply(M, v.p);
            assert.ok(Math.abs(c[0]) <= 1 - 4 / sz.w && Math.abs(c[1]) <= 1 - 4 / sz.h, `${deg} ${clip} ${f} ${k}`);
          }
        }
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
    'mannequin|walk|3|5/16|13|32|1|pixel'
  );
  assert.equal(
    figureKey('rogue', 'idle', 0, { k: 0, tiltStep: 13 }, 8, 128, false, 'smooth'),
    'rogue|idle|0|0/8|13|128|0|smooth'
  );
});

test('figure pose: a card as big as a figure reaches: a code figure’s as before, a model’s from its extent', () => {
  const t = (26 * Math.PI) / 180;
  assert.deepEqual(cardSize(32, t), cardSize(32, t, codeExtent(1.75)));
  const S = cardSize(32, t, { r: 0.9, depth: 0.9, top: 1.83, bottom: -0.1 });
  assert.equal(S.w, Math.ceil(0.9 * 32) * 2 + 4);
  assert.equal(S.ay, Math.ceil((1.83 + 0.9 * Math.tan(t)) * 32) + 2);
  assert.equal(S.h - S.ay - 2, Math.ceil((0.9 * Math.tan(t) + 0.1) * 32));
});

test('figure pose: a model’s clip: a walk by the distance at its own cadence, an idle on twos, an act on ones', () => {
  const tick = 1000 / 12,
    walk = { fps: 12, frames: 12, cycleM: 0.6, lift: [], mats: new Float32Array(0) },
    idle = { fps: 6, frames: 6, lift: [], mats: new Float32Array(0) },
    act = { fps: 12, frames: 20, lift: [], mats: new Float32Array(0) };
  /* at 3.4 m/s a 12-frame cycle at 12 fps takes 1 s: 3.4 m, longer than its 0.6 m stride, so 3.4 m a cycle */
  assert.equal(meshClipFrame(walk, 0, 0, 3.4), 0);
  assert.equal(meshClipFrame(walk, 0, 3.4 / 12, 3.4), 1);
  assert.equal(meshClipFrame(walk, 0, 3.4 * 1.5, 3.4), 6);
  /* slow enough, its own stride */
  assert.equal(meshClipFrame(walk, 0, 0.3, 0.1), 6);
  assert.equal(meshClipFrame(idle, tick * 1.9, 0, 3.4), 0);
  assert.equal(meshClipFrame(idle, tick * 2, 0, 3.4), 1);
  assert.equal(meshClipFrame(idle, tick * 12, 0, 3.4), 0, 'wraps after 6 poses');
  assert.equal(meshClipFrame(act, tick * 3, 0, 3.4), 3);
});

test('figure pose: a model’s clip matrices: 3 x 4 to 4 x 4, the hips’ lift snapped to whole texels', () => {
  const mats = new Float32Array(2 * 2 * 12);
  for (let f = 0; f < 2; f++)
    for (let j = 0; j < 2; j++) mats.set([1, 0, 0, 0, 1, 0, 0, 0, 1, j, f * 0.5 + 0.013, 0], (f * 2 + j) * 12);
  const c = { fps: 12, frames: 2, lift: [0.013, 0.513], mats },
    M = meshClipMatrices(c, 1, 2, 32);
  assert.equal(M.length, 32);
  assert.deepEqual([...M.subarray(0, 12)], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
  assert.equal(M[15], 1);
  assert.equal(M[16 + 12], 1, 'the second joint’s own move');
  /* lift 0.513 m is 16.4 texels: snapped to 16, so every joint is 0.013 m lower */
  assert.ok(Math.abs(M[13] - (0.5 + 0.013 + 16 / 32 - 0.513)) < 1e-6, `${M[13]}`);
  assert.deepEqual(meshClipMatrices(c, 3, 2, 32), M, 'the frames wrap');
});
