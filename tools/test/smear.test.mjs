// VFX track VFX-1..VFX-4: the throw's pace, its afterimages, its ribbon, its stretch and the impact frame (game/js/logic/smear.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  IMPACT_LINES,
  IMPACT_SPEED_LIFE,
  RIBBON_CELLS,
  RIBBON_HALF,
  RIBBON_STEPS,
  SMEAR_GHOSTS,
  SMEAR_KEEP,
  SMEAR_NEAR,
  SMEAR_STEP,
  STRETCH_K,
  STRETCH_MAX,
  STRETCH_PACE,
  impactAt,
  impactFrame,
  impactLength,
  ribbonCells,
  ribbonEdges,
  ribbonTone,
  smearCount,
  smearGhosts,
  smearHistory,
  smearRecord,
  smearRibbon,
  smearStretch,
  throwArcEase,
  throwArcPace,
} from '../../game/js/logic/smear.js';

test('the throw keeps its start, middle and end, always moves forward, and is fastest at both ends', () => {
  assert.equal(throwArcEase(0), 0);
  assert.ok(Math.abs(throwArcEase(0.5) - 0.5) < 1e-12);
  assert.ok(Math.abs(throwArcEase(1) - 1) < 1e-12);
  const speed = k => (throwArcEase(k + 1e-4) - throwArcEase(k)) / 1e-4;
  for (let k = 0; k < 1; k += 0.01) assert.ok(speed(k) > 0, `forward at ${k}`);
  assert.ok(speed(0) > 1.4 && speed(0.999) > 1.4, 'fast from the hand and into the hit');
  assert.ok(speed(0.5) < 0.6, 'a hang at the top');
});

/* a pyramid flying along x at 10 m/s for 480 ms, stepped every 8 ms as battle-stage.js pyramidArc steps it */
const fly = (ms = 480) => {
  const H = smearHistory();
  let kept = 0;
  for (let t = 0; t <= ms; t += 8) kept += +smearRecord(H, t, { x: t / 100, y: 1, z: 0 });
  return { H, kept };
};

test('places are kept on the 24 fps grid, never more than the afterimages and the ribbon need', () => {
  const { H, kept } = fly();
  assert.equal(kept, Math.floor(480 / SMEAR_STEP) + 1);
  assert.equal(SMEAR_KEEP, Math.max(SMEAR_GHOSTS.length + 1, RIBBON_CELLS));
  assert.equal(H.list.length, SMEAR_KEEP);
  for (let i = 1; i < H.list.length; i++) assert.ok(H.list[i - 1].t > H.list[i].t, 'newest first');
});

test('in flight every afterimage shows, newest first, behind the pyramid and fading', () => {
  const { H } = fly(),
    G = smearGhosts(H, 480);
  assert.equal(G.length, SMEAR_GHOSTS.length);
  for (let i = 1; i < G.length; i++) {
    assert.ok(G[i].s.x < G[i - 1].s.x, 'older is further back');
    assert.ok(G[i].fade < G[i - 1].fade, 'older is fainter');
  }
  assert.ok(G[0].s.x < H.list[0].x, 'the first copy is a cell back, not on the pyramid');
});

test('once it stops the afterimages run out oldest first, and are all gone within their life', () => {
  const { H } = fly(),
    n = t => smearGhosts(H, t).length,
    end = H.list[0].t;
  let last = n(end);
  for (let t = end; t < end + 10 * SMEAR_STEP; t += 4) {
    assert.ok(n(t) <= last, 'never comes back');
    last = n(t);
  }
  assert.equal(n(end + (SMEAR_GHOSTS.length + 1) * SMEAR_STEP), 0);
});

test('an afterimage on top of the newer place (a slow moment) is not drawn', () => {
  const H = smearHistory();
  for (let t = 0; t <= 200; t += 8) smearRecord(H, t, { x: 0.001 * t, y: 1, z: 0 });
  assert.equal(smearGhosts(H, 200).length, 0);
});

test('no afterimage is drawn right in front of the camera', () => {
  const { H } = fly(),
    G = smearGhosts(H, 480),
    eye = { x: G[0].s.x + 1.5, y: 1, z: 0 },
    near = smearGhosts(H, 480, 3, eye),
    gap = g => Math.hypot(g.s.x - eye.x, g.s.y - eye.y, g.s.z - eye.z);
  assert.ok(near.length >= 1 && near.length < G.length, 'the copies at the lens are gone, the far ones stay');
  assert.ok(near.every(g => gap(g) >= SMEAR_NEAR));
  assert.equal(G.filter(g => gap(g) >= SMEAR_NEAR).length, near.length);
});

test('Reduced motion and the lowest quality draw none; level 2 draws two', () => {
  assert.equal(smearCount(true, 0), 0);
  assert.equal(smearCount(false, 3), 0);
  assert.equal(smearCount(false, 2), 2);
  assert.equal(smearCount(false, 0), SMEAR_GHOSTS.length);
  const { H } = fly();
  assert.equal(smearGhosts(H, 480, 2).length, 2);
  assert.deepEqual(smearGhosts(null, 0), []);
});

/* VFX-2: the ribbon */
const len = R =>
  R.reduce((a, p, i) => (i ? a + Math.hypot(p.x - R[i - 1].x, p.y - R[i - 1].y, p.z - R[i - 1].z) : 0), 0);

test('in flight the ribbon runs from the pyramid back along its last places, tapered and frayed at its tail', () => {
  const { H } = fly(),
    head = { x: 4.8, y: 1, z: 0 },
    R = smearRibbon(H, 480, RIBBON_CELLS, null, head);
  assert.deepEqual([R[0].x, R[0].y, R[0].z], [4.8, 1, 0], 'it reaches the pyramid');
  assert.ok(Math.abs(R[R.length - 1].x - H.list[RIBBON_CELLS - 1].x) < 1e-9, 'its tail is the oldest place it uses');
  assert.equal(R[0].w, RIBBON_HALF);
  assert.equal(R[R.length - 1].w, 0);
  for (let i = 1; i < R.length; i++) {
    assert.ok(R[i].x < R[i - 1].x, 'head first');
    assert.ok(R[i].w < R[i - 1].w, 'narrower toward the tail');
    assert.ok(R[i].e >= R[i - 1].e, 'more eroded toward the tail');
  }
  assert.equal(R[0].e, 0, 'the head is whole');
  assert.ok(R[R.length - 1].e > 0 && R[R.length - 1].e < 1, 'the tail is frayed, not gone');
  for (const p of R) assert.equal(p.e * RIBBON_STEPS, Math.round(p.e * RIBBON_STEPS), 'erosion moves in steps');
});

test('once the pyramid stops the ribbon erodes away in its steps, one a grid cell, and never comes back', () => {
  const { H } = fly(),
    end = H.list[0].t,
    worn = t => {
      const R = smearRibbon(H, t, RIBBON_CELLS);
      return R.length ? R.reduce((a, p) => a + p.e, 0) / R.length : 1;
    };
  let last = worn(end);
  const seen = new Set();
  for (let t = end; t < end + (RIBBON_STEPS + 2) * SMEAR_STEP; t += 4) {
    assert.ok(worn(t) >= last, 'never comes back');
    last = worn(t);
    seen.add(last.toFixed(6));
  }
  assert.ok(seen.size <= RIBBON_STEPS + 1, 'held between steps');
  assert.equal(smearRibbon(H, end + RIBBON_STEPS * SMEAR_STEP + 1, RIBBON_CELLS).length, 0, 'gone in about 150 ms');
  assert.ok(smearRibbon(H, (H.cell + RIBBON_STEPS) * SMEAR_STEP - 1, RIBBON_CELLS).length > 0, 'not sooner');
});

test('the ribbon ends before the camera, and the quality sets its length', () => {
  const { H } = fly(),
    far = smearRibbon(H, 480, RIBBON_CELLS),
    eye = { x: H.list[3].x - 1.9, y: 1, z: 0 },
    cut = smearRibbon(H, 480, RIBBON_CELLS, eye);
  assert.ok(cut.length > 1 && len(cut) < len(far), 'shorter');
  assert.ok(cut.every(p => Math.hypot(p.x - eye.x, p.y - eye.y, p.z - eye.z) >= 1.9 - 1e-9));
  assert.equal(ribbonCells(true, 0), 0);
  assert.equal(ribbonCells(false, 3), 0);
  assert.equal(ribbonCells(false, 2), 4);
  assert.equal(ribbonCells(false, 0), RIBBON_CELLS);
  assert.ok(len(smearRibbon(H, 480, 4)) < len(far));
  assert.deepEqual(smearRibbon(H, 480, 0), []);
  assert.deepEqual(smearRibbon(null, 0, RIBBON_CELLS), []);
});

test('the edges face the camera; a spinning throw twists them about the tumble axis', () => {
  const H = smearHistory();
  for (let t = 0; t <= 300; t += 8) smearRecord(H, t, { x: t / 100, y: 1, z: 0, tum: t / 40 });
  const R = smearRibbon(H, 300, RIBBON_CELLS),
    eye = { x: 1, y: 1, z: 10 },
    side = E => {
      const d = [0, 1, 2].map(j => E[1][j] - E[0][j]),
        l = Math.hypot(...d);
      return d.map(v => v / l);
    },
    flat = ribbonEdges(R, eye),
    spun = ribbonEdges(R, eye, [0.35, 0.3, 0.89]);
  assert.equal(flat.length, R.length);
  for (let i = 0; i < R.length - 1; i++) {
    const s = side(flat[i]);
    assert.ok(Math.abs(s[2]) < 1e-6 && Math.abs(s[0]) < 1e-6, 'square to the curve and to the eye: up');
    const w = Math.hypot(...[0, 1, 2].map(j => spun[i][1][j] - spun[i][0][j]));
    assert.ok(Math.abs(w - 2 * R[i].w) < 1e-9, 'the same width');
    assert.ok(Math.abs(side(spun[i])[0]) < 1e-6, 'still square to the curve');
  }
  const turned = spun.slice(0, -1).map(side),
    spread = Math.max(...turned.map(s => s[2])) - Math.min(...turned.map(s => s[2]));
  assert.ok(spread > 0.5, 'it twists along its length');
});

test("the ribbon's colour is the object's own, brighter, never past white", () => {
  const [r, g, b] = ribbonTone('#d47a3e');
  assert.ok(r > 0xd4 / 255 && r <= 1);
  assert.ok(Math.abs(r / g - 0xd4 / 0x7a) < 1e-9 && Math.abs(g / b - 0x7a / 0x3e) < 1e-9, 'the same hue');
  assert.deepEqual(ribbonTone('#ffffff'), [1, 1, 1]);
});

/* a 480 ms throw along x, 10 m, from far away from the eye, recorded as battle-stage.js pyramidArc records it */
function flight(dur = 480, len = 10, until = dur) {
  const H = smearHistory();
  for (let t = 0; t < until; t += 8) {
    const k = Math.min(1, t / dur);
    if (k < 1) smearRecord(H, t, { x: 20 + throwArcEase(k) * len, y: 1, z: 0, k });
  }
  return H;
}

test("the pace is the ease's slope, fast enough to stretch only at the arc's ends", () => {
  for (const k of [0.1, 0.3, 0.5, 0.8])
    assert.ok(Math.abs(throwArcPace(k) - (throwArcEase(k + 1e-6) - throwArcEase(k)) / 1e-6) < 1e-4);
  assert.ok(throwArcPace(0.05) >= STRETCH_PACE && throwArcPace(0.95) >= STRETCH_PACE);
  assert.ok(throwArcPace(0.2) < STRETCH_PACE && throwArcPace(0.5) < STRETCH_PACE && throwArcPace(0.8) < STRETCH_PACE);
});

test('the stretch shows on one or two cells at each end of a throw, dragged back toward the last place', () => {
  for (const dur of [380, 480]) {
    const on = [];
    for (let t = 0; t < dur; t += 8) {
      const H = flight(dur, 10, t + 1),
        S = smearStretch(H, t, true);
      if (!S) continue;
      on.push(H.cell);
      const [a, b] = H.list,
        l = Math.hypot(...S.d);
      assert.ok(S.d[0] < 0 && Math.abs(S.d[1]) < 1e-12, 'back along the motion');
      assert.ok(l <= STRETCH_MAX + 1e-9 && Math.abs(l - Math.min(STRETCH_MAX, (a.x - b.x) * STRETCH_K)) < 1e-9);
      assert.ok(S.seed >= 0 && S.seed < 1);
    }
    const cells = [...new Set(on)],
      last = Math.floor((dur - 1) / SMEAR_STEP);
    const head = cells.filter(c => c < last / 2),
      tail = cells.filter(c => c > last / 2);
    assert.ok(head.length >= 1 && head.length <= 2, `${dur}: at the release ${head}`);
    assert.ok(tail.length >= 1 && tail.length <= 2, `${dur}: before the hit ${tail}`);
    assert.ok(tail.includes(last), 'the last cell before the hit');
  }
});

test('the stretch holds for its cell, and none once stopped, when off, or near the eye', () => {
  const H = flight(480, 10, 470),
    t = 469;
  assert.ok(smearStretch(H, t, true));
  assert.deepEqual(smearStretch(H, t + 5, true), smearStretch(H, t, true), 'the same within the cell');
  assert.equal(smearStretch(H, t + SMEAR_STEP * 2, true), null, 'the cell has passed: stopped');
  assert.equal(smearStretch(H, t, false), null, 'Reduced motion, the lowest quality');
  const eye = { x: H.list[1].x - 1, y: 1, z: 0 };
  assert.equal(smearStretch(H, t, true, eye), null, 'the place a cell ago within SMEAR_NEAR of the eye');
  assert.ok(smearStretch(H, t, true, { x: H.list[1].x - SMEAR_NEAR - 1, y: 1, z: 0 }));
  assert.equal(smearStretch(smearHistory(), 0, true), null);
  const old = smearHistory();
  smearRecord(old, 0, { x: 0, y: 0, z: 0 });
  smearRecord(old, 50, { x: 1, y: 0, z: 0 });
  assert.equal(smearStretch(old, 50, true), null, 'places without a pace (not a thrown arc)');
});

test('the impact frame: catch, coin and crit; fewer cells as the quality drops; none under Reduced motion', () => {
  for (const k of ['catch', 'coin', 'crit']) {
    assert.equal(impactFrame(k, false, 0).cells, 2);
    assert.equal(impactFrame(k, false, 0).lines, IMPACT_LINES);
    assert.equal(impactFrame(k, false, 2).cells, 1);
    assert.equal(impactFrame(k, true, 0), null, 'Reduced motion');
  }
  assert.equal(impactFrame('catch', false, 3), null, 'quality 3: no frame');
  assert.deepEqual(
    impactFrame('crit', false, 3),
    { kind: 'crit', cells: 0, lines: 16, warm: true, speed: true },
    'quality 3: a crit keeps its speed lines (as before)'
  );
  assert.equal(impactFrame('catch', false, 0).warm, false);
  assert.equal(impactFrame('coin', false, 0).speed, false);
  assert.equal(impactFrame('sendout', false, 0), null, 'other kinds have none');
});

test('the impact frame shows the negative, then the positive, then (a crit) the speed lines, on the grid', () => {
  const F = impactFrame('crit', false, 0);
  assert.deepEqual(impactAt(F, 0), { mode: 1, age: 0 });
  assert.deepEqual(impactAt(F, SMEAR_STEP - 1), { mode: 1, age: 0 });
  assert.deepEqual(impactAt(F, SMEAR_STEP), { mode: 2, age: 0 });
  assert.deepEqual(impactAt(F, SMEAR_STEP * 2), { mode: 3, age: 0 });
  assert.deepEqual(impactAt(F, SMEAR_STEP * 2 + 5), { mode: 3, age: 0 }, 'held for its cell');
  assert.ok(Math.abs(impactAt(F, SMEAR_STEP * 3).age - SMEAR_STEP / IMPACT_SPEED_LIFE) < 1e-9);
  assert.equal(impactAt(F, SMEAR_STEP * 2 + IMPACT_SPEED_LIFE + SMEAR_STEP), null, 'over');
  const C = impactFrame('catch', false, 0);
  assert.equal(impactAt(C, SMEAR_STEP * 2), null, 'no speed lines after a catch');
  assert.deepEqual(impactAt(impactFrame('catch', false, 2), 0), { mode: 2, age: 0 }, 'one cell: the positive');
  assert.deepEqual(impactAt(impactFrame('crit', false, 3), 0), { mode: 3, age: 0 }, 'quality 3: lines alone');
  assert.equal(impactAt(null, 0), null);
  assert.equal(impactAt(F, -1), null);
  assert.equal(impactLength(F), SMEAR_STEP * 2);
  assert.equal(impactLength(null), 0);
});
