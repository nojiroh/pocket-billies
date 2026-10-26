// Roster track RO-3a: the body plans (game/data/bodyPlans.json) and the placeholder Billies baked from them
// (game/js/logic/placeholder-art.js). Every plan the animation knows has a template whose bones the animation moves
// (or that ride on one it moves); a sample Billie on each plan bakes inside the stage box, the same twice, with a
// rig the renderer can read; its drawing sheets (a Billie's and a plan's, at any scale) cut back into the same cells;
// a drawn cell wins over the placeholder, an empty one doesn't; the placeholders never use the sheets' magenta; and
// every committed placeholder Billie bakes as committed (npm run bake:placeholders --check).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readJson } from '../data-files.mjs';
import { POSES_BY_PLAN } from '../../game/js/body-plan-animation.js';
import * as PA from '../../game/js/logic/placeholder-art.js';
import { bakePlaceholders, samplePlaceholder } from '../bake-placeholders.mjs';

const P = readJson('bodyPlans.json');
const D = readJson('kitBuilds.json').bake;
const POSE = {
  ...{ t: 100, seed: 1, body: 0, bdy: 0, head: 0, hdx: 0, hdy: 0, aL: 0, aR: 0, lL: 0, lR: 0, tail: 0 },
  ...{ hov: { dx: 0, dy: 0, r: 0 }, k: 0, act: 'idle', flap: 1, fall: 0, sy: 1 },
};
const PLANS = Object.keys(POSES_BY_PLAN);
const sample = plan => samplePlaceholder(plan);
const sameCells = (a, b) =>
  PA.PLACEHOLDER_VIEWS.every(
    v =>
      Object.keys(a[v]).length === Object.keys(b[v]).length &&
      Object.entries(a[v]).every(
        ([k, p]) => b[v][k] && Buffer.compare(Buffer.from(p.data), Buffer.from(b[v][k].data)) === 0
      )
  );

test('every animated plan has a template, and only those', () => {
  assert.deepEqual(Object.keys(P.plans).sort(), [...PLANS].sort());
});

test("every bone is moved by its plan's animation or rides on one that is", () => {
  for (const plan of PLANS) {
    const moved = new Set(Object.keys(POSES_BY_PLAN[plan](POSE, P.plans[plan].q))),
      bones = PA.placeholderBones(P, sample(plan)),
      byName = Object.fromEntries(bones.map(b => [b.n, b]));
    let any = 0;
    for (const b of bones) {
      if (moved.has(b.n)) any++;
      let up = b;
      while (up && !moved.has(up.n) && up.par !== 'root') up = byName[up.par];
      assert.ok(up && (moved.has(up.n) || !up.size), `${plan}: ${b.n} is never moved`);
    }
    assert.ok(any >= 2, `${plan}: the animation moves ${any} of its bones`);
  }
});

test('a sample Billie on each plan bakes inside the box, the same twice, with a readable rig', () => {
  for (const plan of PLANS) {
    const a = PA.placeholderBake(P, sample(plan), D),
      b = PA.placeholderBake(P, sample(plan), D);
    assert.deepEqual(JSON.parse(JSON.stringify(a.rig)), JSON.parse(JSON.stringify(b.rig)), plan);
    assert.equal(Buffer.compare(Buffer.from(a.sheet.data), Buffer.from(b.sheet.data)), 0, plan);
    for (const v of PA.PLACEHOLDER_VIEWS) {
      const R = a.rig[v],
        seen = new Set(['root']);
      assert.equal(R.plan, plan);
      for (const bone of R.bones) {
        assert.ok(seen.has(bone.par), `${plan} ${v}: ${bone.n} before its parent ${bone.par}`);
        seen.add(bone.n);
        assert.ok(bone.i === -1 || R.imgs[bone.i], `${plan} ${v}: ${bone.n}'s picture`);
        assert.ok('slot' in bone, `${plan} ${v}: ${bone.n} has no slot (null or one)`);
      }
      for (const im of R.imgs)
        for (const [x, y, w, h] of Object.values(im.f))
          assert.ok(
            x >= 0 && y >= 0 && x + w <= a.sheet.width && y + h <= a.sheet.height,
            `${plan} ${v}: a frame off the sheet`
          );
      assert.ok(R.geo.top >= D.margin, `${plan} ${v}: too tall`);
    }
  }
});

test('every plan fills the head and body slots (splicing maps parts by slot)', () => {
  for (const plan of PLANS) {
    const slots = new Set(PA.placeholderBones(P, sample(plan)).map(b => b.slot));
    for (const s of ['body', 'front', 'back', 'sig'])
      if (plan !== 'octo' || s !== 'body') assert.ok(slots.has(s), `${plan}: no ${s} slot`);
    assert.ok(slots.has('head') || plan === 'blob', `${plan}: no head slot`);
  }
});

test("a Billie's sheet and a plan's sheet cut back into the same cells, at any scale", () => {
  for (const plan of PLANS) {
    const f = sample(plan),
      g = { ...sample(plan), name: `other-${plan}`, colours: { main: '#4060a0' }, size: { head: 1.3 } },
      cells = { [f.name]: PA.placeholderPaintCells(P, f), [g.name]: PA.placeholderPaintCells(P, g) };
    for (const scale of [1, 3]) {
      const one = PA.placeholderSheetCut(P, [f], PA.placeholderSheet(P, [f], cells, false, scale));
      assert.ok(sameCells(one[f.name], cells[f.name]), `${plan}: a Billie's sheet at ${scale}x`);
      const both = PA.placeholderSheetCut(P, [f, g], PA.placeholderSheet(P, [f, g], cells, true, scale), true);
      assert.ok(
        sameCells(both[f.name], cells[f.name]) && sameCells(both[g.name], cells[g.name]),
        `${plan}: a plan's sheet at ${scale}x`
      );
    }
  }
});

test('a sheet that does not fit the layout is refused, with why', () => {
  const f = sample('quad'),
    sheet = PA.placeholderSheet(P, [f], { [f.name]: PA.placeholderPaintCells(P, f) });
  assert.throws(() => PA.placeholderSheetCut(P, [{ ...f, plan: 'crab' }], sheet), /layout/);
});

test('a drawn cell wins over the placeholder; an empty one keeps it; magenta is clear', () => {
  const f = sample('biped'),
    painted = PA.placeholderPaintCells(P, f),
    sheet = PA.placeholderSheet(P, [f], { [f.name]: painted }),
    lay = PA.placeholderSheetLayout(P, [f]),
    head = lay.cells.find(c => c.key === 'head' && c.view === 'front'),
    tail = lay.cells.find(c => c.key === 'tail' && c.view === 'front');
  /* the head drawn over as a solid green box; the tail's cell wiped to magenta */
  for (let y = 0; y < head.h; y++)
    for (let x = 0; x < head.w; x++) sheet.data.set([20, 200, 60, 255], ((head.y + y) * sheet.width + head.x + x) * 4);
  for (let y = 0; y < tail.h; y++)
    for (let x = 0; x < tail.w; x++) sheet.data.set([255, 0, 255, 255], ((tail.y + y) * sheet.width + tail.x + x) * 4);
  const cut = PA.placeholderSheetCut(P, [f], sheet)[f.name],
    cells = PA.placeholderCellsWith(P, f, cut);
  assert.deepEqual([...cells.front.head.data.subarray(0, 4)], [20, 200, 60, 255]);
  assert.ok(
    sameCells({ front: { tail: cells.front.tail }, back: {} }, { front: { tail: painted.front.tail }, back: {} })
  );
  const made = PA.placeholderBake(P, f, D, cells);
  assert.ok(made.rig.front.imgs.length > 0);
});

test('placeholders never paint near the magenta a sheet is cut by', () => {
  for (const plan of PLANS) {
    const cells = PA.placeholderPaintCells(P, sample(plan));
    for (const v of PA.PLACEHOLDER_VIEWS)
      for (const [k, p] of Object.entries(cells[v]))
        for (let i = 0; i < p.data.length; i += 4)
          if (p.data[i + 3]) assert.ok(!PA.placeholderNearKey([...p.data.subarray(i, i + 3)]), `${plan} ${v} ${k}`);
  }
});

test('every committed placeholder Billie bakes as committed', () => {
  assert.deepEqual(bakePlaceholders({ check: true, log: () => {} }), []);
});
