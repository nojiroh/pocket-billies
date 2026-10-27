// Camera track CAM-2: the camera's moments (game/js/logic/camera-moments.js): one at a time by priority, a two-shot
// while talking, a boss revealed once, a point of interest, a slow drift in standing still, an ease out running,
// nothing new right after a sharp turn, and reduced motion.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MOMENT_DIALS as D, momentNew, momentStep } from '../../game/js/logic/camera-moments.js';
import { blendGoals, followNew } from '../../game/js/logic/camera-follow.js';

const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);
const input = (o = {}) => ({
  px: 0,
  pz: 0,
  moving: false,
  running: false,
  dir: [0, 0],
  talk: null,
  boss: null,
  interest: null,
  reduced: false,
  ...o,
});
const run = (st, I, secs, fps = 60) => {
  let r;
  for (let i = 0; i < Math.round(secs * fps); i++) r = momentStep(st, I, D, 1 / fps);
  return r;
};

test('nothing happening asks for nothing', () => {
  const r = momentStep(momentNew(), input({ moving: true }), D, 1 / 60);
  assert.equal(r.id, null);
  assert.deepEqual(r.goals, []);
});

test('talking frames you both, zoomed in, and beats everything else', () => {
  const st = momentNew();
  run(st, input(), D.idleDelay + 1);
  const r = momentStep(
    st,
    input({ talk: [4, 2], running: true, interest: { w: 1, lean: [1, 0], zoom: 0.9 } }),
    D,
    1 / 60
  );
  assert.equal(r.id, 'talk');
  assert.equal(r.goals.length, 1);
  assert.deepEqual(r.goals[0].at, [2, 1]);
  near(r.goals[0].zoom, D.talkZoom);
});

test('a boss is revealed once, for a while, the lean capped', () => {
  const st = momentNew(),
    boss = { id: 'b', x: 0, z: 8 };
  assert.equal(momentStep(st, input({ boss: { ...boss, z: 30 } }), D, 1 / 60).id, null);
  const r = momentStep(st, input({ boss }), D, 1 / 60);
  assert.equal(r.id, 'boss');
  near(r.goals[0].at[1], D.bossLean);
  assert.equal(run(st, input({ boss }), D.bossTime - 0.2).id, 'boss');
  assert.equal(run(st, input({ boss }), 0.5).id, null);
  /* walking away and back: no second reveal */
  run(st, input({ boss: { ...boss, z: 30 } }), 1);
  assert.equal(momentStep(st, input({ boss }), D, 1 / 60).id, null);
});

test('standing still drifts in after the delay and goes quickly when you move', () => {
  const st = momentNew();
  assert.equal(run(st, input(), D.idleDelay - 0.1).id, null);
  const r = run(st, input(), 0.2);
  assert.equal(r.id, 'idle');
  assert.equal(r.goals[0].blend, D.idleBlend);
  assert.ok(r.goals[0].out < D.idleBlend);
  assert.equal(momentStep(st, input({ moving: true }), D, 1 / 60).id, null);
  assert.equal(st.still, 0);
});

test('running eases out, only while moving', () => {
  const st = momentNew();
  assert.equal(momentStep(st, input({ moving: true, running: true, dir: [1, 0] }), D, 1 / 60).id, 'run');
  assert.ok(momentStep(st, input({ moving: true, running: true, dir: [1, 0] }), D, 1 / 60).goals[0].zoom > 1);
  assert.equal(momentStep(st, input({ moving: false, running: true }), D, 1 / 60).id, null);
});

test('a point of interest leans by its own lean and weight', () => {
  const r = momentStep(momentNew(), input({ px: 1, interest: { w: 0.6, lean: [0, 1.5], zoom: 0.92 } }), D, 1 / 60);
  assert.equal(r.id, 'interest');
  assert.deepEqual(r.goals[0].at, [1, 1.5]);
  near(r.goals[0].w, 0.6);
});

test('nothing starts right after a sharp turn, but what is on carries on', () => {
  const st = momentNew(),
    go = dir => momentStep(st, input({ moving: true, running: true, dir }), D, 1 / 60);
  run(st, input({ moving: true, dir: [1, 0] }), 0.2);
  assert.equal(go([-1, 0]).id, null, 'a U-turn holds the ease out back');
  run(st, input({ moving: true, dir: [-1, 0] }), D.turnHold);
  assert.equal(go([-1, 0]).id, 'run');
  assert.equal(go([1, 0]).id, 'run', 'already on: carries on through a turn');
  assert.equal(go([0.9, 0.3]).id, 'run');
});

test('reduced motion: no drift in or ease out, the others at half', () => {
  const st = momentNew();
  assert.equal(run(st, input({ reduced: true }), D.idleDelay + 1).id, null);
  assert.equal(momentStep(st, input({ reduced: true, moving: true, running: true }), D, 1 / 60).id, null);
  const r = momentStep(st, input({ reduced: true, talk: [2, 0] }), D, 1 / 60);
  near(r.goals[0].w, 0.5);
});

test('a moment that ends ramps out as it last was, at its own pace', () => {
  const fol = followNew(0, 0, 0),
    st = momentNew();
  let G = blendGoals(fol, run(st, input(), D.idleDelay + 6).goals, 0, 0.4, true);
  near(G.zoom, D.idleZoom);
  G = blendGoals(fol, momentStep(st, input({ moving: true }), D, 0.3).goals, 0.3, 0.4);
  assert.ok(G.zoom > D.idleZoom && G.zoom < 1, `going: ${G.zoom}`);
  assert.ok(G.zoom > 1 - (1 - D.idleZoom) * 0.5, 'quickly: more than half gone in 0.3 s');
});

test("WM-7: a leader's arena frames the ring, eased out, and beats the talk its intro opens", () => {
  const r = momentStep(momentNew(), input({ arena: [10, 6], talk: [3, 1], moving: true }), D, 1 / 60);
  assert.equal(r.id, 'arena');
  assert.deepEqual(r.goals[0].at, [10, 6]);
  assert.equal(r.goals[0].zoom, D.arenaZoom);
  assert.ok(D.arenaZoom > 1, 'eased out');
  /* off, or once the intro is over, the talk frames you both again */
  assert.equal(
    momentStep(momentNew(), input({ arena: [10, 6], talk: [3, 1] }), { ...D, arenaOn: false }, 1 / 60).id,
    'talk'
  );
  assert.equal(momentStep(momentNew(), input({ talk: [3, 1] }), D, 1 / 60).id, 'talk');
});
