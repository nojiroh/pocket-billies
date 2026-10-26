// Phase 20 C5: the frame's point lights picked with stable keys (game/js/engine/light-pick.js). With nothing out of
// view and the fades settled it lights the same set as light.js pickPointLights; walking between two equal lamps it
// doesn't flicker; lights fade in and out over LIGHT_FADE_MS; it never lights more than it may; and what it keeps
// doesn't grow as you walk. Positions only, no graphics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './walk-renderer.mjs';

await import('../../game/js/engine/light-pick.js');
const G = globalThis;
const { lightPicker, pickStableLights, pickPointLights, LIGHT_FADE_MS, LIGHT_RANK_MS, LIGHT_HOLD_M } = G;

// a light as walk/lighting.js makes it, keyed by a stand-in prop
function lamp(x, z, o = {}) {
  return { p: [x, 3, z], r: 4, c: [1, 0.8, 0.5], src: o.src || { x, z }, kind: o.kind || 0, ...o };
}
// odd but repeatable positions (a small linear congruential generator)
function street(n, seed = 7) {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648) * 60 - 30;
  return Array.from({ length: n }, (_, i) => lamp(rnd(), rnd(), { front: i % 5 === 0 }));
}
const copy = L => L.map(l => ({ ...l, p: [...l.p], c: [...l.c] }));
const at = l => l.p.join(',');
// run the picker for ms at 60 frames a second, the player standing at (x, z); the last frame's lights
function settle(S, L, x, z, t0, ms, max = 16, inView = null) {
  let out = [];
  for (let t = t0; t <= t0 + ms; t += 1000 / 60) out = pickStableLights(S, L, x, z, t, max, inView);
  return out;
}

test('settled with nothing out of view: the same lights as pickPointLights, nearest first, full strength', () => {
  for (const [n, max, x, z] of [
    [40, 16, 0, 0],
    [40, 8, 6.5, -3],
    [12, 16, 1, 2],
    [70, 16, -20, 14],
  ]) {
    const L = street(n, n + max),
      S = lightPicker(),
      got = settle(S, L, x, z, 1000, 1000, max),
      want = pickPointLights(copy(L), x, z, max);
    assert.deepEqual(got.map(at), want.map(at), `${n} lights, ${max} lit, at ${x},${z}`);
    for (const l of got) {
      const src = L.find(c => at(c) === at(l));
      assert.deepEqual(l.c, src.c);
    }
  }
});

test('walking to and fro between two equal lamps: one stays lit (the old picker swaps them)', () => {
  const L = [lamp(-1, 2), lamp(1, 2)];
  const S = lightPicker();
  let swaps = 0,
    oldSwaps = 0,
    last = null,
    oldLast = null;
  // a scripted walk: along the street from x = -3, then back and forth across the middle (well inside the hold)
  const path = [];
  for (let x = -3; x < 0; x += 0.02) path.push(x);
  for (let i = 0; i < 600; i++) path.push(0.4 * Math.sin(i / 9));
  path.forEach((x, i) => {
    const t = 1000 + (i * 1000) / 60,
      lit = pickStableLights(S, L, x, 0, t, 1).find(l => l.c[0] > 0.5),
      old = pickPointLights(copy(L), x, 0, 1)[0];
    if (lit && last && at(lit) !== last) swaps++;
    if (lit) last = at(lit);
    if (oldLast && at(old) !== oldLast) oldSwaps++;
    oldLast = at(old);
  });
  assert.ok(oldSwaps > 4, `the walk does make the old picker swap (${oldSwaps})`);
  assert.equal(swaps, 0);
  // walking on past the hold, the far lamp takes over once
  for (let x = 0; x < 4; x += 0.02) {
    const t = 20000 + x * 1000,
      lit = pickStableLights(S, L, x, 0, t, 1).find(l => l.c[0] > 0.5);
    if (lit && at(lit) !== last) swaps++;
    if (lit) last = at(lit);
  }
  assert.equal(swaps, 1);
  assert.equal(last, at(L[1]));
  assert.ok(LIGHT_HOLD_M > 0.4);
});

test('a lamp coming into range fades in over LIGHT_FADE_MS; one going out of view fades out', () => {
  const near = lamp(0, 2),
    far = lamp(0, 40),
    S = lightPicker();
  let hide = null;
  const inView = l => l !== hide;
  settle(S, [near], 0, 0, 1000, 500, 2, inView);
  // the far lamp appears: chosen at the next ranking (at most LIGHT_RANK_MS), then fades in
  const L = [near, far],
    strength = () => S.out.find(l => at(l) === at(far))?.c[0] ?? 0;
  let t = 1500,
    first = null;
  for (; t < 1500 + LIGHT_RANK_MS + 1000; t += 1000 / 60) {
    pickStableLights(S, L, 0, 0, t, 2, inView);
    if (first == null && strength() > 0) first = t;
    if (strength() >= 1) break;
  }
  assert.ok(first != null && first - 1500 <= LIGHT_RANK_MS + 20, `chosen within a ranking (${first - 1500} ms)`);
  assert.ok(Math.abs(t - first - LIGHT_FADE_MS) <= 20, `faded in over ${Math.round(t - first)} ms`);
  // out of view: unlit by the next ranking plus a fade
  hide = near;
  const t0 = t;
  for (; t < t0 + 2000; t += 1000 / 60)
    if (!pickStableLights(S, L, 0, 0, t, 2, inView).some(l => at(l) === at(near))) break;
  assert.ok(t - t0 <= LIGHT_RANK_MS + LIGHT_FADE_MS + 40, `gone after ${Math.round(t - t0)} ms`);
  // a lamp no longer in the list fades out where it was
  const S2 = lightPicker();
  settle(S2, [near, far], 0, 0, 0, 500, 2);
  const out = pickStableLights(S2, [near], 0, 0, 520, 2),
    gone = out.find(l => at(l) === at(far));
  assert.ok(gone && gone.c[0] > 0 && gone.c[0] < 1, 'still there, dimmer');
});

test('never more lit than the limit; a new light waits for a fading one to go dark', () => {
  const L = street(60, 3),
    S = lightPicker();
  let most = 0;
  for (let i = 0; i < 3000; i++) {
    const x = Math.sin(i / 200) * 25,
      z = Math.cos(i / 130) * 25;
    most = Math.max(most, pickStableLights(S, L, x, z, (i * 1000) / 60, 8).length);
  }
  assert.equal(most, 8);
});

test('walking a long street: what it keeps stays small, and a lit light keeps its object', () => {
  const lamps = Array.from({ length: 2000 }, (_, i) => lamp((i % 2) * 6 - 3, i * 4));
  const S = lightPicker();
  let most = 0,
    obj = null,
    same = true;
  for (let i = 0; i < 6000; i++) {
    const z = i * 1.2 * (1000 / 60 / 1000) * 10,
      L = lamps.filter(l => Math.abs(l.p[2] - z) < 30),
      out = pickStableLights(S, L, 0, z, (i * 1000) / 60, 16);
    most = Math.max(most, S.owners.size);
    if (i === 100) obj = out.find(l => Math.abs(l.p[2] - z) < 4);
    if (i > 100 && i < 110 && obj && !out.includes(obj)) same = false;
  }
  assert.ok(most <= 40, `kept at most ${most} lights`);
  assert.ok(obj && same);
});

test('a jump (a door, a warp) starts again at full strength', () => {
  const S = lightPicker(),
    A = [lamp(0, 2)],
    B = [lamp(200, 202)];
  settle(S, A, 0, 0, 0, 500);
  const out = pickStableLights(S, B, 200, 200, 520);
  assert.deepEqual(out.map(at), B.map(at));
  assert.deepEqual(out[0].c, B[0].c);
});

test('two lights with the same key: the first keeps it', () => {
  const src = {},
    S = lightPicker(),
    out = settle(S, [lamp(0, 1, { src }), lamp(0, 2, { src })], 0, 0, 0, 500);
  assert.equal(out.length, 1);
  assert.equal(out[0].p[2], 1);
});

test('walk lighting: off, the nearest each frame as before; on, the stable picker; quality.lights caps both', () => {
  const Q = G.ENGINE_DEFAULTS.quality,
    keep = { ...Q },
    L = street(40, 11),
    P = { x: 2, z: -1 },
    C = { vp: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] };
  try {
    assert.deepEqual(G.pickLights(copy(L), C, P, null).map(at), pickPointLights(copy(L), P.x, P.z, 16).map(at));
    Q.lights = 6;
    assert.deepEqual(G.pickLights(copy(L), C, P, null).map(at), pickPointLights(copy(L), P.x, P.z, 6).map(at));
    Q.stableLights = true;
    Q.cull = false;
    const out = G.pickLights(L, C, P, null);
    assert.equal(out, G.LIGHT_PICK.out);
    assert.deepEqual(out.map(at), pickPointLights(copy(L), P.x, P.z, 6).map(at));
    // with the view test: the identity camera sees x and y in -1..1 (no far side), so only lights reaching that lit
    Q.cull = true;
    const near = [lamp(0, 0.5, { r: 0.5 }), lamp(30, 0.5, { r: 0.5 })];
    near.forEach(l => (l.p[1] = 0));
    assert.deepEqual(G.pickLights(near, C, { x: 100, z: 100 }, null).map(at), [at(near[0])]);
  } finally {
    Object.assign(Q, keep);
  }
});

test('lamp shadows: the lamps the old code shadowed; with steady lights, a shadowed lamp keeps its map', () => {
  const pick = G.pickShadowLamps,
    oldPick = (L, x, z, n) =>
      L.filter(l => !l.front && l.p[1] > 1.6 && l.r >= 3 && Math.hypot(l.p[0] - x, l.p[2] - z) < 22).slice(0, n);
  // lights made new each frame (the old picker): the same choice as before, whatever was shadowed last frame
  for (const [x, z, n] of [
    [0, 0, 2],
    [5, -8, 1],
    [-12, 3, 2],
    [0, 0, 0],
  ]) {
    const L = pickPointLights(
      street(50, 3).concat([lamp(x + 1, z, { r: 2 }), lamp(x, z + 1, { front: true })]),
      x,
      z,
      16
    );
    L.push({ ...L[0], p: [x, 1, z] });
    assert.deepEqual(pick(copy(L), x, z, n).map(at), oldPick(copy(L), x, z, n).map(at), `${x},${z} ${n}`);
  }
  // the same lamp objects frame to frame (the stable picker): walking to and fro between two, one keeps the map
  const A = lamp(-1, 2),
    B = lamp(1, 2);
  let swaps = 0,
    last = null;
  for (let i = 0; i < 600; i++) {
    const x = 0.4 * Math.sin(i / 9),
      got = pick(
        [A, B].sort((a, b) => Math.abs(a.p[0] - x) - Math.abs(b.p[0] - x)),
        x,
        0,
        1
      )[0];
    if (last && got !== last) swaps++;
    last = got;
  }
  assert.equal(swaps, 0);
  assert.equal(pick([A, B], 3, 0, 1)[0], B);
});
