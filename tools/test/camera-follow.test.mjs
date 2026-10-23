// Camera track CAM-1: the walking camera's follow (game/js/logic/camera-follow.js): a spring that moves the same at
// any frame rate and never overshoots, dead and soft zones, a look-ahead that dies away when you let go, small ground
// changes ignored, and goals that ramp and blend into one.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  blendGoals,
  followNew,
  followStep,
  leadStep,
  springStep,
  zoneAxis,
  zoneMetres,
} from '../../game/js/logic/camera-follow.js';

const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);
/* runs `secs` seconds at `fps` frames a second */
const run = (fps, secs, f) => {
  const n = Math.round(secs * fps);
  for (let i = 0; i < n; i++) f(1 / fps, i);
};

test('the spring ends at the same place at 30, 60 and 144 frames a second', () => {
  const at = fps => {
    let x = 0,
      v = 0;
    run(fps, 0.5, dt => ([x, v] = springStep(x, v, 10, 0.3, dt)));
    return [x, v];
  };
  const [a, av] = at(30),
    [b, bv] = at(60),
    [c, cv] = at(144);
  near(a, b, 1e-9);
  near(b, c, 1e-9);
  near(av, cv, 1e-9);
  assert.ok(a > 5 && a < 10, `${a} is on its way`);
});

test('a target moving steadily is followed at about the same lag at any frame rate', () => {
  const lag = fps => {
    let x = 0,
      v = 0,
      t = 0;
    run(fps, 3, dt => {
      [x, v] = springStep(x, v, 4 * (t + dt), 0.3, dt, 4 * t);
      t += dt;
    });
    return 4 * t - x;
  };
  near(lag(30), 1.2, 1e-6);
  near(lag(144), 1.2, 1e-6);
});

test('the spring never overshoots a target that holds still', () => {
  let x = 0,
    v = 0,
    most = 0;
  run(60, 4, dt => {
    [x, v] = springStep(x, v, 1, 0.25, dt);
    most = Math.max(most, x);
  });
  assert.ok(most <= 1 + 1e-12, `${most}`);
  near(x, 1, 1e-6);
  /* starting with speed away from the target it turns back once and still doesn't pass it */
  ((x = 0), (v = -5), (most = -Infinity));
  run(60, 4, dt => {
    [x, v] = springStep(x, v, 1, 0.25, dt);
    most = Math.max(most, x);
  });
  assert.ok(most <= 1 + 1e-12);
  /* a smooth time of 0 jumps */
  assert.deepEqual(springStep(3, 2, 7, 0, 0.016), [7, 0]);
});

test('the zones: still inside the dead zone, catching up past it, held at the soft zone', () => {
  assert.deepEqual(zoneAxis(0, 0.5, 1, 3), { target: 0, pos: 0, hold: true });
  assert.deepEqual(zoneAxis(0, 2, 1, 3), { target: 1, pos: 0, hold: false });
  assert.deepEqual(zoneAxis(0, -2, 1, 3), { target: -1, pos: 0, hold: false });
  assert.deepEqual(zoneAxis(0, 5, 1, 3), { target: 4, pos: 2, hold: false });
  /* a soft zone smaller than the dead zone acts as the dead zone */
  assert.deepEqual(zoneAxis(0, 2, 1, 0.5), { target: 1, pos: 1, hold: false });
});

test('a zone in metres grows with the view and covers more ground the flatter the camera looks', () => {
  const [a, f] = zoneMetres(0.1, 0.1, 16, 400, 800, Math.PI / 2);
  near(a, 0.8);
  near(f, 1.6);
  const [, f30] = zoneMetres(0.1, 0.1, 16, 400, 800, Math.PI / 6);
  near(f30, 3.2);
});

const input = (gx, gz, more = {}) => ({
  gx,
  gz,
  gy: 0,
  right: [1, 0],
  dead: [1, 1],
  soft: [3, 3],
  smooth: 0.3,
  band: 0.5,
  moving: true,
  ...more,
});

test('walking inside the dead zone leaves the camera still; past it the camera follows; you never leave the soft zone', () => {
  const st = followNew(0, 0, 0);
  st.move = 1;
  run(60, 1, dt => followStep(st, input(0.8, -0.6), dt));
  near(st.x, 0);
  near(st.z, 0);
  run(60, 2, dt => followStep(st, input(2, 0), dt));
  near(st.x, 1, 1e-3);
  /* a jump far past the soft zone: the aim is pulled at once to its edge */
  followStep(st, input(20, 0), 1 / 60);
  assert.ok(20 - st.x <= 3 + 1e-9, `${st.x}`);
});

test('standing still, the dead zone closes and the camera settles on you', () => {
  const st = followNew(0, 0, 0);
  st.move = 1;
  run(60, 1, dt => followStep(st, input(0.8, 0), dt));
  near(st.x, 0, 1e-3);
  run(60, 4, dt => followStep(st, input(0.8, 0, { moving: false }), dt));
  near(st.x, 0.8, 1e-3);
});

test('the zones are measured along the screen, whichever way the camera is turned', () => {
  /* turned a quarter: the screen's right is the world's -z, so a goal 0.8 m along -z is inside the dead zone across */
  const st = followNew(0, 0, 0);
  st.move = 1;
  run(60, 1, dt => followStep(st, input(0, -0.8, { right: [0, -1], dead: [1, 0.1] }), dt));
  near(st.z, 0);
  const st2 = followNew(0, 0, 0);
  st2.move = 1;
  run(60, 1, dt => followStep(st2, input(0.8, 0, { right: [0, -1], dead: [1, 0.1] }), dt));
  assert.ok(st2.x > 0.6, `${st2.x}: along the screen the dead zone is small`);
});

test('the follow comes out the same at 30 and 144 frames a second', () => {
  const at = fps => {
    const st = followNew(0, 0, 0);
    let t = 0;
    run(fps, 2, dt => {
      t += dt;
      followStep(st, input(3 * t, 0), dt);
    });
    return st.x;
  };
  near(at(30), at(144), 1e-3);
});

test('small changes of ground height are ignored while you walk, not when you stop', () => {
  const st = followNew(0, 0, 0);
  st.move = 1;
  run(60, 2, dt => followStep(st, { ...input(0, 0), gy: 0.4 }, dt));
  near(st.y, 0, 1e-6);
  run(60, 2, dt => followStep(st, { ...input(0, 0), gy: 2 }, dt));
  near(st.y, 1.5, 1e-3);
  run(60, 4, dt => followStep(st, { ...input(0, 0, { moving: false }), gy: 2 }, dt));
  near(st.y, 2, 1e-3);
});

test('the look-ahead points the way you push, reaches further sideways on a tall screen, and dies away', () => {
  const st = followNew(0, 0, 0);
  run(60, 4, dt => leadStep(st, [1, 0], 1.3, [1, 0], 1.5, false, 0.5, dt));
  near(st.lead[0], 1.3, 1e-3);
  near(st.lead[1], 0, 1e-9);
  run(60, 4, dt => leadStep(st, [1, 0], 1.3, [1, 0], 1.5, true, 0.5, dt));
  near(st.lead[0], 1.95, 1e-3);
  /* up the screen isn't stretched */
  run(60, 4, dt => leadStep(st, [0, 1], 1.3, [1, 0], 1.5, true, 0.5, dt));
  near(st.lead[0], 0, 1e-3);
  near(st.lead[1], 1.3, 1e-3);
  /* a half push leads half as far; letting go brings it back */
  run(60, 4, dt => leadStep(st, [0, 0.5], 1.3, [1, 0], 1.5, true, 0.5, dt));
  near(st.lead[1], 0.65, 1e-3);
  run(60, 4, dt => leadStep(st, [0, 0], 1.3, [1, 0], 1.5, true, 0.5, dt));
  near(st.lead[1], 0, 1e-3);
});

test('goals ramp in and out, their tilts add, their distances multiply, and their aims pull in order', () => {
  const st = followNew(0, 0, 0);
  let o = blendGoals(st, [{ id: 'up', w: 1, pitch: 9 }], 0.1, 0.4);
  assert.ok(o.pitch > 0 && o.pitch < 9);
  run(60, 4, dt => (o = blendGoals(st, [{ id: 'up', w: 1, pitch: 9 }], dt, 0.4)));
  near(o.pitch, 9, 1e-3);
  /* no longer asked: it ramps out and is forgotten */
  run(60, 0.2, dt => (o = blendGoals(st, [], dt, 0.4)));
  assert.ok(o.pitch > 0 && o.pitch < 9, `${o.pitch}: it ramps out as it last was`);
  run(60, 6, dt => (o = blendGoals(st, [], dt, 0.4)));
  assert.equal(st.w.up, undefined);
  assert.equal(st.last.up, undefined);
  near(o.pitch, 0);
  /* an aim that stops being asked for lets go gradually, not at once */
  blendGoals(st, [{ id: 'room', w: 1, at: [10, 0] }], 0.016, 0.4, true);
  o = blendGoals(st, [], 0.1, 0.4);
  assert.ok(o.atW > 0.5 && o.at[0] === 10, `${o.atW}`);
  run(60, 6, dt => (o = blendGoals(st, [], dt, 0.4)));
  assert.equal(o.at, null);
  /* snapped: at full weight at once; blend 0: no ramp */
  o = blendGoals(
    st,
    [
      { id: 'a', w: 0.5, pitch: 4, dist: 0.5 },
      { id: 'b', w: 1, blend: 0, pitch: -1, dist: 2 },
    ],
    0.016,
    0.4,
    true
  );
  near(o.pitch, 1);
  near(o.dist, 0.75 * 2);
  /* aims: the first pulls half way, the second all the way: the second wins */
  o = blendGoals(
    st,
    [
      { id: 'p', w: 0.5, at: [10, 0] },
      { id: 'q', w: 1, at: [0, 10] },
    ],
    0.016,
    0.4,
    true
  );
  near(o.atW, 1);
  near(o.at[0], 0);
  near(o.at[1], 10);
  /* two half pulls: the follow keeps a quarter; the first point a quarter, the second a half */
  o = blendGoals(
    st,
    [
      { id: 'p', w: 0.5, at: [8, 0] },
      { id: 'q', w: 0.5, at: [0, 8] },
    ],
    0.016,
    0.4,
    true
  );
  near(o.atW, 0.75);
  near(o.at[0] * o.atW, 2);
  near(o.at[1] * o.atW, 4);
});
