// VFX track VFX-1 and VFX-2: the throw's pace, its afterimages and its ribbon (game/js/logic/smear.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RIBBON_CELLS,
  RIBBON_HALF,
  RIBBON_STEPS,
  SMEAR_GHOSTS,
  SMEAR_KEEP,
  SMEAR_NEAR,
  SMEAR_STEP,
  ribbonCells,
  ribbonEdges,
  ribbonTone,
  smearCount,
  smearGhosts,
  smearHistory,
  smearRecord,
  smearRibbon,
  throwArcEase,
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
