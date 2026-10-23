// IS-8: the pasture by Copperleaf's barn. logic/pasture.js (the fence's line from the zone, the wander line inside it,
// a wander step that never leaves it or walks into the hay, who wanders) and tools/build-pasture.mjs (the props: all
// in the zone, the fence closed but for the gate's gap, you can walk in through the gap from the barn's door, nothing
// outside the zone changed, a rerun the same).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, fn, modules, reseed, startedSave } from './setup-real.mjs';
import { pastureProps } from '../build-pasture.mjs';
import { pointInProp } from '../../game/js/logic/prop-turn.js';

const P = modules.pasture,
  HUB = GAME_DATA.maps.copperleaf,
  SC = GAME_DATA.scenery,
  ZONE = P.pastureZone(HUB);

/** a seeded random number, 0 to 1 */
const rndOf = (seed = 7) => {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

test('pasture: the fence line is the zone made straight, a little inside it, and the wander line inside that', () => {
  assert.ok(ZONE, 'the hub has a pasture zone');
  const line = P.pastureFenceLine(ZONE),
    roam = P.pastureRoamLine(ZONE);
  assert.ok(line.length >= 4 && line.length < ZONE.length / 2, `a few sides (${line.length})`);
  for (const p of line) assert.ok(P.pastureIn(ZONE, p[0], p[1]), `the fence's corner ${p} is in the zone`);
  for (const p of roam) assert.ok(P.pastureIn(line, p[0], p[1]), `the wander line's corner ${p} is inside the fence`);
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
      const [lx, lz] = pointInProp(p, x, z);
      if (Math.abs(lx) <= M.box[0] / 2 && lz >= -0.1 && lz <= M.box[1]) return true;
    } else if (M.solid && Math.hypot(x - p.x, z - p.z) < M.solid) return true;
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
    at = P.pastureSpot(P.pastureRoamLine(ZONE), [], () => 0.5),
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
  for (const [x, z] of out2)
    assert.ok(
      Math.hypot(x - out.gap[0], z - out.gap[1]) < 1.8,
      `the way out at (${x}, ${z}) is through the gate's gap at (${out.gap})`
    );
});

test('pasture: the hub as built carries the pasture (rerun tools/build-copperleaf.mjs if this fails)', () => {
  /* the build adds the pasture before IS-9's dressing (props marked dress), so it is checked on the hub without it */
  const town = { ...HUB, props: HUB.props.filter(p => !p.dress) };
  const out = pastureProps(town, SC);
  assert.deepEqual(out.props, town.props);
});
