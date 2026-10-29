// Characters track CH-3c: the movement pass (game/js/logic/figure-pose.js): each build's stride from its own legs, the
// foot on the ground staying put in a walk, a jog and a sprint, the gait picked by speed, the step off and the settle,
// and turns eased the shorter way.
import './figure-kit-data.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { lookFigure } from '../../game/js/logic/figure-kit.js';
import {
  CLIP_FRAMES,
  FIGURE_FPS,
  FIGURE_GAITS,
  FIGURE_TURN_RATE,
  figureGaitFor,
  figureLegs,
  figureMotion,
  figureMotionClip,
  figurePose,
  figureStride,
  figureTurn,
  jointMatrices,
  locoPose,
  restPose,
} from '../../game/js/logic/figure-pose.js';

const read = f => JSON.parse(readFileSync(new URL(`../../game/data/${f}`, import.meta.url), 'utf8'));
const W = read('wardrobe.json'),
  KIT = read('figureKit.json'),
  chosen = read('people/chosen.json');
const figureOf = build =>
  lookFigure(chosen.look, W.items, { name: 'moves-' + build, figure: { ...chosen.figure, build } });
const BUILDS = Object.keys(KIT.builds);
/* the speeds the game moves people at: townsfolk, your light push, your walk, your run (walk-view.js) */
const SPEEDS = { walk: 1.25, jog: 3.4, sprint: 3.4 * 1.7 };

/** a pose at `p` through the cycle, as figurePose would make it (but between frames) */
function poseAt(F, gait, p) {
  const P = restPose(F),
    at = id => F.parts.findIndex(q => q.id === id),
    G = { swing: 1, arms: 1, bounce: 1, lean: 0, hang: 0, head: 0, ...(F.gait || {}) };
  return locoPose(
    F,
    P,
    G,
    gait,
    p,
    at,
    (id, a) => at(id) >= 0 && (P.rot[at(id)][0] = a),
    (id, ax, a) => at(id) >= 0 && (P.rot[at(id)][ax] = a)
  );
}

test('figure moves: every build keeps the foot on the ground where it was put, walking, jogging and sprinting', () => {
  for (const build of BUILDS) {
    const F = figureOf(build),
      foot = F.parts.findIndex(q => q.id === 'footA');
    for (const gait of Object.keys(FIGURE_GAITS)) {
      const { cycle, duty } = figureStride(F, gait);
      let first = null;
      for (let i = 0; i < 40; i++) {
        const p = (duty * i) / 40,
          J = jointMatrices(F, poseAt(F, gait, p), 0),
          /* the body goes p of a cycle forward; the foot's place on the ground and its height */
          z = J[foot * 16 + 14] + p * cycle,
          y = J[foot * 16 + 13];
        first = first || { z, y };
        assert.ok(Math.abs(z - first.z) < 0.002, `${build} ${gait}: the foot slides ${z - first.z} m`);
        assert.ok(Math.abs(y - first.y) < 0.002, `${build} ${gait}: the foot lifts ${y - first.y} m`);
      }
    }
  }
});

test('figure moves: a stride from the legs, never shorter than four frames a cycle at the usual speed', () => {
  const avg = figureOf('average'),
    tall = figureOf('tall');
  for (const gait of Object.keys(FIGURE_GAITS)) {
    assert.ok(figureStride(tall, gait).cycle > figureStride(avg, gait).cycle, `${gait}: longer legs, longer steps`);
    for (const build of BUILDS) {
      const { cycle, z0 } = figureStride(figureOf(build), gait),
        perTick = SPEEDS[gait] / FIGURE_FPS;
      assert.ok(cycle / perTick >= 3.9, `${build} ${gait}: ${(cycle / perTick).toFixed(1)} ticks a cycle`);
      assert.ok(z0 <= figureLegs(figureOf(build)).L, `${build} ${gait}: a reach the leg has`);
    }
  }
  /* the walk is a walk (a foot always down), the jog and the sprint leave the ground */
  assert.equal(figureStride(avg, 'walk').duty, 0.5);
  assert.ok(figureStride(avg, 'jog').duty < 0.5 && figureStride(avg, 'sprint').duty < 0.5);
  assert.ok(figureStride(avg, 'jog').cycle > 1.3 && figureStride(avg, 'jog').cycle < 1.7, 'about 1.5 m a jog');
});

test('figure moves: in the air between a jog’s steps, never below the ground', () => {
  const F = figureOf('average'),
    { duty } = figureStride(F, 'jog'),
    land = poseAt(F, 'jog', 0).rootY,
    mid = poseAt(F, 'jog', (duty + 0.5) / 2).rootY;
  assert.ok(mid > land + 0.01, `the body rises ${mid - land} m between steps`);
  for (let i = 0; i < 24; i++) assert.ok(poseAt(F, 'walk', i / 24).rootY <= 1e-9, 'a walk never leaves the ground');
});

test('figure moves: the gait by speed, with a gap at each edge', () => {
  assert.equal(figureGaitFor(0.5), 'walk');
  assert.equal(figureGaitFor(1.25), 'walk');
  assert.equal(figureGaitFor(2.04), 'jog');
  assert.equal(figureGaitFor(3.4), 'jog');
  assert.equal(figureGaitFor(5.78), 'sprint');
  assert.equal(figureGaitFor(5.3), 'sprint', 'a trainer coming over runs');
  /* on the edge it keeps what it was doing */
  assert.equal(figureGaitFor(1.8, 'walk'), 'walk');
  assert.equal(figureGaitFor(1.8, 'jog'), 'jog');
  assert.equal(figureGaitFor(4.4, 'jog'), 'jog');
  assert.equal(figureGaitFor(4.4, 'sprint'), 'sprint');
  assert.equal(figureGaitFor(1.6, 'sprint'), 'walk');
});

test('figure moves: the step off and the settle stand on the ground, feet level', () => {
  const F = figureOf('average'),
    at = id => F.parts.findIndex(q => q.id === id);
  for (const [clip, n] of [
    ['start', CLIP_FRAMES.start],
    ['stop', CLIP_FRAMES.stop],
  ])
    for (let f = 0; f < n; f++) {
      const P = figurePose(F, clip, f);
      assert.ok(P.rootY < 0, `${clip} ${f}: the knees give`);
      for (const k of ['A', 'B']) {
        const level = P.rot[at('thigh' + k)][0] + P.rot[at('shin' + k)][0] + P.rot[at('foot' + k)][0];
        assert.ok(Math.abs(level) < 1e-9, `${clip} ${f}: foot ${k} level`);
      }
    }
  assert.ok(figurePose(F, 'stop', 0).rootY < figurePose(F, 'stop', 1).rootY, 'the settle straightens up');
});

test('figure moves: turns eased the shorter way at FIGURE_TURN_RATE', () => {
  const tick = 1 / FIGURE_FPS,
    step = FIGURE_TURN_RATE * tick;
  assert.equal(figureTurn(0, 0.1, tick), 0.1, 'a small turn at once');
  assert.ok(Math.abs(figureTurn(0, Math.PI / 2, tick) - step) < 1e-12);
  /* across the seam at a whole turn: the short way round, not back the long way */
  assert.equal(figureTurn(6.2, 0.1, tick), 0.1);
  assert.ok(Math.abs(figureTurn(5.5, 0.5, tick) - (5.5 + step)) < 1e-12, 'up through 2 pi');
  assert.ok(Math.abs(figureTurn(0.5, 5.5, tick) - (0.5 - step)) < 1e-12, 'down through 0');
  /* a half turn in about a quarter second */
  let h = 0,
    n = 0;
  while (Math.abs(Math.atan2(Math.sin(Math.PI - h), Math.cos(Math.PI - h))) > 1e-9 && n < 20) {
    h = figureTurn(h, Math.PI, tick);
    n++;
  }
  assert.ok(n >= 2 && n <= 4, `${n} ticks for a half turn`);
});

/** a person moved tick by tick: `speeds` m/s each tick, counted by the caller (`count`) or by where they stand */
function walkTicks(speeds, { count = true, heading = 0 } = {}) {
  const cycle = kind => ({ walk: 0.75, jog: 1.5, sprint: 1.9 })[kind];
  let M = null,
    g = 0,
    x = 0;
  const out = [];
  speeds.forEach((v, i) => {
    g += v / FIGURE_FPS;
    x += v / FIGURE_FPS;
    M = figureMotion(M, { tick: 100 + i, gait: count ? g : 0, at: [x, 0], heading, cycle });
    out.push({ M, clip: figureMotionClip(M) });
  });
  return out;
}

test('figure moves: setting off, a gait by speed, stopping and settling, a tick at a time', () => {
  const T = walkTicks([0, 0, 1.25, 1.25, 1.25, 1.25, 3.4, 3.4, 3.4, 3.4, 5.78, 5.78, 5.78, 0, 0, 0]);
  assert.equal(T[1].clip, null, 'standing: the idle');
  assert.deepEqual(T[2].clip, { clip: 'start', frame: 0 }, 'the tick they set off: the step off');
  assert.equal(T[3].clip.clip, 'walk');
  assert.equal(T[4].clip.clip, 'walk');
  assert.equal(T[7].clip.clip, 'jog', 'jogging at your walk speed (smoothed over a tick or two)');
  assert.equal(T[12].clip.clip, 'sprint', 'sprinting at your run');
  assert.deepEqual(T[13].clip, { clip: 'stop', frame: 0 }, 'stopped: the settle');
  assert.deepEqual(T[14].clip, { clip: 'stop', frame: 1 });
  assert.equal(T[15].clip, null, 'then the idle');
  /* the cycle moves on by the distance: 1.25 m/s is a sixth of a 0.75 m walk a tick, so the frames go up by about 1 */
  const f = T.slice(3, 6).map(o => o.clip.frame);
  assert.ok(f[1] > f[0] || f[1] === 0, `walk frames ${f}`);
});

test('figure moves: counted from where they stand (townsfolk), and a jump is a move, not a walk', () => {
  const T = walkTicks([1.25, 1.25, 1.25], { count: false });
  assert.equal(T[2].clip.clip, 'walk');
  assert.ok(Math.abs(T[2].M.speed - 1.25) < 1e-9);
  let M = figureMotion(null, { tick: 1, gait: 0, at: [0, 0], heading: 0, cycle: () => 1 });
  M = figureMotion(M, { tick: 2, gait: 0, at: [10, 0], heading: 0, cycle: () => 1 });
  assert.equal(M.moving, false, 'a person put somewhere else does not run there');
  /* the same tick again changes nothing; a long gap starts afresh */
  assert.equal(figureMotion(M, { tick: 2, gait: 0, at: [11, 0], heading: 1, cycle: () => 1 }), M);
  const N = figureMotion(M, { tick: 2 + FIGURE_FPS * 3, gait: 0, at: [11, 0], heading: 1, cycle: () => 1 });
  assert.equal(N.head, 1, 'afresh: facing the new way at once');
  assert.equal(N.moving, false);
});

test('figure moves: an actor’s new walk counts from 0 again; a lineup walking on the spot by its count', () => {
  let M = figureMotion(null, { tick: 1, gait: 2, at: [0, 0], heading: 0, cycle: () => 0.75 });
  M = figureMotion(M, { tick: 2, gait: 2.1, at: [0, 0], heading: 0, cycle: () => 0.75 });
  assert.ok(M.moving, 'walking on the spot by the count');
  M = figureMotion(M, { tick: 3, gait: 0.1, at: [0, 0], heading: 0, cycle: () => 0.75 });
  assert.ok(M.moving && Math.abs(M.speed - (0.4 * 1.2 + 0.6 * 1.2)) < 1e-9, 'a count that starts again');
});

test('figure moves: the way they face turns over a few ticks', () => {
  let M = figureMotion(null, { tick: 1, gait: 0, at: [0, 0], heading: 0, cycle: () => 1 });
  const seen = [];
  for (let i = 2; i < 8; i++) {
    M = figureMotion(M, { tick: i, gait: 0, at: [0, 0], heading: Math.PI, cycle: () => 1 });
    seen.push(M.head);
  }
  assert.ok(seen[0] > 0 && seen[0] < Math.PI, 'part way round after a tick');
  assert.equal(seen[seen.length - 1], Math.PI, 'facing the new way soon after');
});
