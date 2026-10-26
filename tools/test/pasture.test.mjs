// IS-8: the pasture by Copperleaf's barn. logic/pasture.js (the fence's line from the zone, the wander line inside it,
// a wander step that never leaves it or walks into the hay, who wanders) and tools/build-pasture.mjs (the props: all
// in the zone, the fence closed but for the gate's gap, you can walk in through the gap from the barn's door, nothing
// outside the zone changed, a rerun the same). HB-6: the fence bends with the zone; a post at every joint and one rail
// sized to each span (no gaps, no overlaps, no doubled posts); the posts on the line the game's Billies wander inside.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, fn, modules, reseed, startedSave } from './setup-real.mjs';
import { PASTURE_SWELL, pastureGround, pastureProps } from '../build-pasture.mjs';
import { pointInProp, turnedPoint as turnedPointOf } from '../../game/js/logic/prop-turn.js';

const P = modules.pasture,
  HUB = GAME_DATA.maps.copperleaf,
  SC = GAME_DATA.scenery,
  ZONE = P.pastureZone(HUB);

/** a seeded random number, 0 to 1 */
const rndOf = (seed = 7) => {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

test('pasture: the fence line follows the zone with gentle bends, a little inside it, and the wander line inside that', () => {
  assert.ok(ZONE, 'the hub has a pasture zone');
  const line = P.pastureFenceLine(ZONE),
    roam = P.pastureRoamLine(ZONE),
    n = line.length;
  for (const p of line) assert.ok(P.pastureIn(ZONE, p[0], p[1]), `the fence's point ${p} is in the zone`);
  for (const p of roam) assert.ok(P.pastureIn(line, p[0], p[1]), `the wander line's point ${p} is inside the fence`);
  /* not a few straight sides: a point every metre or so, each within 0.6 m of the zone's own outline moved in */
  const plain = P.pastureInset(P.pastureResample(ZONE, 0.5), P.PASTURE_FENCE_IN);
  assert.ok(n > 60, `a point every metre or so (${n})`);
  for (const p of line) {
    const d = Math.min(...plain.map((q, i) => P.pastureSegDist(q, plain[(i + 1) % plain.length], p[0], p[1])));
    assert.ok(d < 0.6, `the line at ${p} strays ${d.toFixed(2)} m from the zone's own outline`);
  }
  /* gentle: walked in 2 m steps (a fence's spans), it never turns more than 35 degrees at once */
  const sp = P.pastureResample(line, 2);
  for (let i = 0; i < sp.length; i++) {
    const a = sp[(i - 1 + sp.length) % sp.length],
      b = sp[i],
      c = sp[(i + 1) % sp.length],
      t = Math.abs(
        Math.atan2(
          (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]),
          (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1])
        )
      );
    assert.ok(t < (35 * Math.PI) / 180, `a bend of ${((t * 180) / Math.PI).toFixed(0)} degrees at ${b}`);
  }
  /* a square's inset is the smaller square, either way round */
  const sq = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];
  assert.deepEqual(P.pastureInset(sq, 1), [
    [1, 1],
    [9, 1],
    [9, 9],
    [1, 9],
  ]);
  assert.deepEqual(P.pastureInset([...sq].reverse(), 1), [
    [1, 9],
    [9, 9],
    [9, 1],
    [1, 1],
  ]);
});

test('pasture: a wander step stays inside the line and clear of the hay; a blocked Billie stays put', () => {
  const roam = P.pastureRoamLine(ZONE),
    rounds = [[48.5, 74.6, 1.6]],
    rnd = rndOf(3);
  let at = P.pastureSpot(roam, rounds, rnd);
  assert.ok(at && P.pastureIn(roam, at[0], at[1]));
  for (let k = 0; k < 300; k++) {
    const b = P.pastureWander(roam, rounds, at, rnd);
    if (!b) continue;
    assert.ok(P.pastureClear(roam, rounds, at, b), 'the walk there is clear');
    assert.ok(P.pastureIn(roam, b[0], b[1]));
    assert.ok(Math.hypot(b[0] - 48.5, b[1] - 74.6) >= 1.6, 'never into the hay');
    at = b;
  }
  /* a walk across a notch in an L-shaped field is refused */
  const L = [
    [0, 0],
    [10, 0],
    [10, 4],
    [4, 4],
    [4, 10],
    [0, 10],
  ];
  assert.equal(P.pastureClear(L, [], [8, 2], [2, 8]), false);
  assert.equal(P.pastureClear(L, [], [8, 2], [2, 2]), true);
  assert.equal(
    P.pastureWander(
      [
        [0, 0],
        [0.5, 0],
        [0.5, 0.5],
      ],
      [],
      [0.2, 0.1],
      rndOf()
    ),
    null
  );
});

test('pasture: who wanders: storage only, the trainees first, then the highest levels; never the buddy; at most n', () => {
  reseed();
  const s = startedSave('musk0', 10),
    mk = lvl => fn('makeBilly')('musk0', lvl),
    a = mk(5),
    b = mk(20),
    c = mk(12),
    d = mk(20),
    e = mk(3);
  s.box.push(a, b, c, d, e);
  s.ranch.trainees = [{ uid: e.uid, at: 1 }];
  assert.deepEqual(
    P.pastureBillies(s, 6).map(m => m.uid),
    [e, b, d, c, a].map(m => m.uid)
  );
  assert.ok(!P.pastureBillies(s, 6).includes(s.team[0]), 'never the team');
  s.buddy = b.uid;
  assert.deepEqual(
    P.pastureBillies(s, 3).map(m => m.uid),
    [e, d, c].map(m => m.uid)
  );
  /* a trainee gone from storage (moved to the team) isn't drawn from the trainee list */
  s.ranch.trainees.push({ uid: s.team[0].uid, at: 1 });
  assert.ok(!P.pastureBillies(s, 6).includes(s.team[0]));
  assert.deepEqual(P.pastureBillies(s, 0), []);
});

/** the walk grid round the pasture: a cell blocked by a fence section, post, gate or hay (as the game's navGrid blocks
 * them: a box by its turned footprint, a solid by its round) */
function blockedAt(props, x, z) {
  for (const p of props) {
    const M = SC.props[p.k];
    if (!M) continue;
    if (M.box) {
      const [lx, lz] = pointInProp(p, x, z),
        s = p.s || 1;
      if (Math.abs(lx) <= (M.box[0] * s) / 2 && lz >= -0.1 && lz <= M.box[1] * s) return true;
    } else if (M.solid && Math.hypot(x - p.x, z - p.z) < M.solid * (p.s || 1)) return true;
  }
  return false;
}

test('pasture: the build step: every prop in the zone, the fence closed but for the gate, nothing else changed', () => {
  const base = { ...HUB, props: HUB.props.filter(p => !P.pastureIn(ZONE, p.x, p.z)) },
    out = pastureProps(base, SC);
  /* the same again on its own output */
  assert.deepEqual(pastureProps({ ...base, props: out.props }, SC).props, out.props, 'a rerun is the same');
  assert.deepEqual(out.props.slice(0, base.props.length), base.props, 'outside the zone: untouched');
  const made = out.props.slice(base.props.length);
  for (const p of made) assert.ok(P.pastureIn(ZONE, p.x, p.z), `${p.k} in the zone`);
  assert.equal(made.filter(p => p.act === 'pasture').length, 1, 'one gate that opens the ranch');
  assert.ok(made.some(p => p.k === 'water_trough') && made.some(p => p.k === 'hay_feeder'));
  /* flood the inside from the field's middle on a 0.25 m grid: it leaks out only where the gate's gap is */
  const step = 0.25,
    line = P.pastureFenceLine(ZONE),
    xs = ZONE.map(p => p[0]),
    zs = ZONE.map(p => p[1]),
    x0 = Math.min(...xs) - 3,
    z0 = Math.min(...zs) - 3,
    W = Math.ceil((Math.max(...xs) + 3 - x0) / step),
    H = Math.ceil((Math.max(...zs) + 3 - z0) / step),
    seen = new Uint8Array(W * H),
    at = P.pastureSpot(
      P.pastureRoamLine(ZONE),
      made.map(p => [p.x, p.z, 3]),
      rndOf(5)
    ),
    start = [Math.round((at[0] - x0) / step), Math.round((at[1] - z0) / step)],
    q = [start];
  seen[start[1] * W + start[0]] = 1;
  const out2 = [];
  while (q.length) {
    const [i, j] = q.pop(),
      x = x0 + i * step,
      z = z0 + j * step;
    if (!P.pastureIn(line, x, z)) {
      out2.push([x, z]);
      continue;
    }
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const a = i + di,
        b = j + dj;
      if (a < 0 || b < 0 || a >= W || b >= H || seen[b * W + a]) continue;
      seen[b * W + a] = 1;
      if (!blockedAt(made, x0 + a * step, z0 + b * step)) q.push([a, b]);
    }
  }
  assert.ok(!blockedAt(made, at[0], at[1]), 'the flood starts on open ground');
  assert.ok(out2.length > 0, 'you can walk out (through the gate)');
  /* the gate is where the island's path arrives: a path tile just outside the gap, walked to in a straight line */
  const tileAt = (x, z) => (HUB.tiles[HUB.h - 1 - Math.floor(z)] || '')[Math.floor(x)],
    inX = out.gap[0] - out.gate.x,
    inZ = out.gap[1] - out.gate.z;
  let path = null;
  for (let r = 0.5; r < 4 && !path; r += 0.25)
    for (let a = 0; a < 360 && !path; a += 10) {
      const x = out.gap[0] + Math.cos((a * Math.PI) / 180) * r,
        z = out.gap[1] + Math.sin((a * Math.PI) / 180) * r;
      if (tileAt(x, z) === 'p' && !P.pastureIn(line, x, z)) path = [x, z];
    }
  assert.ok(path, `a path tile within 4 m outside the gate's gap at ${out.gap} (the gate leans ${inX}, ${inZ} in)`);
  for (let f = 0; f <= 1; f += 0.05)
    assert.ok(
      !blockedAt(made, path[0] + (out.gap[0] - path[0]) * f, path[1] + (out.gap[1] - path[1]) * f),
      'from the path straight through the gap'
    );
  for (const [x, z] of out2)
    assert.ok(
      Math.hypot(x - out.gap[0], z - out.gap[1]) < 1.8,
      `the way out at (${x}, ${z}) is through the gate's gap at (${out.gap})`
    );
});

/** do the segments a-b and c-d cross (not just touch at an end)? */
const crosses = (a, b, c, d) => {
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return o(a, b, c) * o(a, b, d) < -1e-6 && o(c, d, a) * o(c, d, b) < -1e-6;
};

test('pasture: the fence: a post at every joint, one rail sized to each span, no gaps, no overlaps, gentle bends', () => {
  const base = { ...HUB, props: HUB.props.filter(p => !P.pastureIn(ZONE, p.x, p.z)) },
    out = pastureProps(base, SC),
    made = out.props.slice(base.props.length),
    R = SC.props.fence_rail.box[0],
    posts = out.posts,
    k = posts.length - 1,
    rails = made.filter(p => p.k === 'fence_rail'),
    fp = made.filter(p => p.k === 'fence_post'),
    gate = made.find(p => p.k === 'fence_gate'),
    line = P.pastureFenceLine(ZONE),
    nearPt = (a, b, tol = 0.02) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol;
  assert.equal(rails.length, k, 'one rail for each span');
  for (let j = 0; j < k; j++) {
    const a = posts[j],
      b = posts[j + 1],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      on = rails.filter(r => nearPt([r.x, r.z], mid));
    assert.equal(on.length, 1, `one rail on the span ${a} to ${b}`);
    const r = on[0],
      ends = [pointInProp(r, a[0], a[1]), pointInProp(r, b[0], b[1])];
    /* its two ends at the two posts' middles: no gap, no overlap */
    assert.ok(Math.abs(R * (r.s || 1) - L) < 0.02, `the rail fits its ${L.toFixed(2)} m span`);
    for (const e of ends) assert.ok(Math.abs(e[1]) < 0.02 && Math.abs(Math.abs(e[0]) - L / 2) < 0.02, 'along the span');
    assert.ok(Math.abs((r.s || 1) - 1) <= 0.08, 'sized a little at most');
    assert.ok(L > 1.6, `posts at least 1.6 m apart (${L.toFixed(2)})`);
  }
  /* rails meet only at posts */
  for (let i = 0; i < k; i++)
    for (let j = i + 2; j < k; j++)
      assert.ok(!crosses(posts[i], posts[i + 1], posts[j], posts[j + 1]), `the spans ${i} and ${j} cross`);
  /* a post at every joint, but the one the gate hangs on (its own post is there); no doubled posts */
  assert.equal(fp.length, k, 'a post at every joint but one');
  const hinge = posts.findIndex(q => !fp.some(p => nearPt([p.x, p.z], q)));
  assert.ok(hinge === 0 || hinge === k, 'the gate hangs at an end of the gap');
  const [gx, gz] = turnedPointOf(gate, -1, 0.125);
  assert.ok(nearPt([gx, gz], posts[hinge], 0.03), "the gate's own post stands where the fence's would");
  for (let i = 0; i < fp.length; i++)
    for (let j = i + 1; j < fp.length; j++)
      assert.ok(Math.hypot(fp[i].x - fp[j].x, fp[i].z - fp[j].z) > 1.6, 'no two posts side by side');
  /* the gap: the first and the last post a gate's width apart */
  const gap = Math.hypot(posts[k][0] - posts[0][0], posts[k][1] - posts[0][1]);
  assert.ok(gap > 2.2 && gap < 2.5, `the gate's gap is ${gap.toFixed(2)} m`);
  /* the posts stand on the line the game's Billies wander inside (pastureFenceLine, then pastureRoamLine in it) */
  for (const q of posts)
    assert.ok(
      Math.min(...line.map((a, i) => P.pastureSegDist(a, line[(i + 1) % line.length], q[0], q[1]))) < 0.02,
      `the post at ${q} is on the fence line`
    );
  for (const q of P.pastureRoamLine(ZONE))
    assert.ok(P.pastureIn(posts, q[0], q[1]), `the wander line at ${q} is inside`);
  /* each post a little turned and leaning; a few rails weathered or broken, never by the gate, never two side by side */
  for (const p of fp) {
    assert.ok(Math.abs(p.rot || 0) <= 12, 'a post turned a few degrees');
    assert.ok(Math.hypot(...p.tilt) <= 2.5 && Math.hypot(...p.tilt) > 0, 'a post leaning a little');
  }
  const broken = posts.slice(0, k).map((a, j) => {
    const b = posts[j + 1],
      r = rails.find(q => nearPt([q.x, q.z], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]));
    return r.v === 2 || r.v === 3;
  });
  assert.ok(broken.some(Boolean) && rails.some(r => r.v === 1 || r.v === 3), 'some rails weathered, some broken');
  assert.ok(!broken[0] && !broken[k - 1], 'no broken rail by the gate');
  for (let j = 1; j < k; j++) assert.ok(!(broken[j] && broken[j - 1]), 'never two broken side by side');
});

test('pasture: the hub as built carries the pasture (rerun tools/build-copperleaf.mjs if this fails)', () => {
  /* the build adds the pasture before IS-9's dressing (props marked dress), so it is checked on the hub without it */
  const town = { ...HUB, props: HUB.props.filter(p => !p.dress) };
  const out = pastureProps(town, SC);
  assert.deepEqual(out.props, town.props);
});

test('pasture: the field gently uneven, level at its edge and round the gate, nothing outside it changed', () => {
  const town = { ...HUB, props: HUB.props.filter(p => !p.dress) },
    out = pastureProps(town, SC),
    sc = { ...HUB, heights: HUB.heights.map(r => [...r]) },
    S = PASTURE_SWELL;
  /* the hub as built carries it: running it again moves nothing */
  assert.equal(pastureGround(sc, out.gap), 0, 'rerun tools/build-copperleaf.mjs');
  /* flatten the zone, swell it again: the same ground; outside the zone nothing moved */
  const flat = { ...HUB, heights: HUB.heights.map(r => [...r]) },
    inZone = (a, b) => P.pastureIn(ZONE, a, b);
  let level = null;
  for (let b = 0; b <= HUB.h; b++)
    for (let a = 0; a <= HUB.w; a++)
      if (inZone(a, b)) {
        const d = Math.min(...ZONE.map((q, i) => P.pastureSegDist(q, ZONE[(i + 1) % ZONE.length], a, b)));
        if (d < S.fade[0]) level = HUB.heights[HUB.h - b][a];
      }
  assert.ok(level != null, "the zone's edge has corners at its level");
  for (let b = 0; b <= HUB.h; b++)
    for (let a = 0; a <= HUB.w; a++) if (inZone(a, b)) flat.heights[HUB.h - b][a] = level;
  pastureGround(flat, out.gap);
  assert.deepEqual(flat.heights, HUB.heights, 'made again from a flat field: the same ground');
  let most = 0;
  for (let b = 0; b <= HUB.h; b++)
    for (let a = 0; a <= HUB.w; a++) {
      const v = HUB.heights[HUB.h - b][a] - level;
      if (!inZone(a, b)) continue;
      most = Math.max(most, Math.abs(v));
      if (Math.hypot(a - out.gap[0], b - out.gap[1]) <= S.gate) assert.equal(v, 0, `level by the gate at ${a}, ${b}`);
    }
  assert.ok(most <= S.h + 0.005 && most > S.h / 2, `the field rises and sinks up to ${most.toFixed(2)} m`);
});
