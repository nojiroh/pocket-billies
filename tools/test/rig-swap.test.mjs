// Studio plan Phase 5, T5.2: a part swapped from the Parts Library keeps the Billie whole (logic/rig-swap.js), on
// three real species of art/next/rigs-next.js with the real kit parts and sheets: musk0 (a kit Billie, biped, horns on
// its head), huang0 (hand-drawn, four legs) and trump0 (kit, no legs, a crest). Which parts fit, where the children go,
// the frames (blink, squash), the sheet and geo.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import './robot-rig-node.mjs';
import { readPng } from './png.mjs';
import { rigBox, rigGeo } from '../../game/js/logic/rig-joints.js';
import {
  rigRefit,
  rigSwapApply,
  rigSwapMisfit,
  rigSwapNeeds,
  rigSwapSlot,
  rigSwapSocketsAt,
} from '../../game/js/logic/rig-swap.js';
import { kitBlinkFrame, kitSquashFrames } from '../../game/js/logic/kit-pixels.js';

globalThis.requestAnimationFrame ??= () => 0;
const { boneSlot, rigPose } = await import('../../game/js/skeleton-rig.js');
const { animFor } = await import('../../game/js/body-plan-animation.js');
const ROOT = new URL('../../', import.meta.url).pathname;
const src = readFileSync(join(ROOT, 'game/art/next/rigs-next.js'), 'utf8');
const RIGS = JSON.parse(src.slice(src.indexOf('RIGS_NEXT=') + 10).replace(/;\s*$/, ''));
const K = JSON.parse(readFileSync(join(ROOT, 'game/data/partKits.json'), 'utf8'));
const BAKE = JSON.parse(readFileSync(join(ROOT, 'game/data/kitBuilds.json'), 'utf8')).bake;
const slotOf = b => rigSwapSlot(b, boneSlot);
const P = Object.assign(rigPose(null, 0, 0, 0), {
  sy: 1,
  sx: 1,
  head: 0,
  hdy: 0,
  hdx: 0,
  aL: 0,
  aR: 0,
  tail: 0,
  face: 'idle',
  hov: { dx: 0, dy: 0, r: 0 },
});
const geoOf = (M, view) => rigGeo(M, view, animFor(M.plan, M.q || {})(P, view === 'back') || {}, P);
const pathOf = sp => view => 'art/' + RIGS[sp][view].sheet;
const sheetsOf = sp => {
  const m = new Map();
  for (const v of ['front', 'back']) m.set(pathOf(sp)(v), readPng(join(ROOT, 'game', pathOf(sp)(v))));
  return m;
};
const part = (id, view) => readPng(join(ROOT, 'game/art', K.parts[id].views[view].file));
const cut = (p, [x, y, w, h]) => {
  const out = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
  for (let j = 0; j < h; j++)
    out.data.set(p.data.subarray(((y + j) * p.width + x) * 4, ((y + j) * p.width + x + w) * 4), j * w * 4);
  return out;
};
const bone = (M, n) => M.bones.find(b => b.n === n);
/** a library part placed as the Studio places it at 100%, no turn or offset: its pivot on the bone's pivot */
function placed(sp, view, n, id) {
  const pic = part(id, view),
    v = K.parts[id].views[view],
    pv = v.pivot || K.pivots[K.parts[id].kind],
    ox = -Math.round(pv[0] * pic.width),
    oy = -Math.round(pv[1] * pic.height),
    needs = rigSwapNeeds(K, RIGS[sp][view], n, slotOf, K.parts[id].slot, view),
    at = rigSwapSocketsAt(v.sockets || {}, pv, pic.width, pic.height, false, 0, [
      ox + pv[0] * pic.width,
      oy + pv[1] * pic.height,
    ]);
  return { pic, ox, oy, needs, at };
}

test("a torso's children need its named sockets, on their own side; a head's horns need none", () => {
  const n = rigSwapNeeds(K, RIGS.musk0.front, 'torso', slotOf, 'body', 'front');
  assert.deepEqual(Object.fromEntries(n.map(x => [x.child, x.sockets[0]])), {
    legL: 'hipL',
    legR: 'hipR',
    armL: 'shoulderL',
    armR: 'shoulderR',
    tail: 'tail',
    head: 'neck',
  });
  const q = rigSwapNeeds(K, RIGS.huang0.front, 'torso', slotOf, 'body', 'front');
  assert.deepEqual(Object.fromEntries(q.map(x => [x.child, x.sockets[0]])), {
    legBF: 'hipR',
    legFF: 'shoulderR',
    tail: 'tail',
    legBN: 'hipL',
    legFN: 'shoulderL',
    head: 'neck',
  });
  assert.deepEqual(rigSwapNeeds(K, RIGS.musk0.front, 'head', slotOf, 'head', 'front'), []);
  const t = rigSwapNeeds(K, RIGS.trump0.front, 'torso', slotOf, 'body', 'front');
  assert.deepEqual(t.map(x => x.child).sort(), ['armL', 'armR', 'head', 'tail']);
});

test('a part without a socket a child needs is a misfit, with the reason; every library torso fits musk0', () => {
  const needs = rigSwapNeeds(K, RIGS.musk0.front, 'torso', slotOf, 'body', 'front');
  for (const [id, p] of Object.entries(K.parts))
    if (p.slot === 'body' && p.kind === 'torso') assert.equal(rigSwapMisfit(K, id, 'front', needs), '', id);
  const K2 = JSON.parse(JSON.stringify(K));
  delete K2.parts.cat_torso.views.front.sockets.tail;
  assert.equal(rigSwapMisfit(K2, 'cat_torso', 'front', needs), 'no tail socket for tail');
  delete K2.parts.cat_torso.views.back;
  assert.equal(rigSwapMisfit(K2, 'cat_torso', 'back', needs), 'no back picture');
});

test('the same picture swapped in changes nothing the game reads: children, geo, sizes of pictures (3 species)', () => {
  for (const sp of ['musk0', 'huang0', 'trump0']) {
    const sheets = sheetsOf(sp),
      prepared = ['front', 'back'].map(view => {
        const M = RIGS[sp][view],
          P0 = M.imgs[bone(M, 'torso').i],
          frames = Object.fromEntries(Object.entries(P0.f).map(([n, b]) => [n, cut(sheets.get(pathOf(sp)(view)), b)]));
        return { view, bone: 'torso', frames, ox: P0.ox, oy: P0.oy, at: {}, needs: [] };
      }),
      before = JSON.stringify(RIGS[sp]),
      { rig } = rigSwapApply(RIGS[sp], sheets, pathOf(sp), prepared, geoOf);
    assert.equal(JSON.stringify(RIGS[sp]), before, `${sp}: the input rig changed`);
    for (const view of ['front', 'back']) {
      const A = RIGS[sp][view],
        B = rig[view];
      assert.deepEqual(B.geo, A.geo, `${sp} ${view} geo`);
      for (const b of A.bones) assert.deepEqual(bone(B, b.n).at, b.at, `${sp} ${view} ${b.n}`);
      assert.deepEqual(rigBox(B.imgs[bone(B, 'torso').i]).slice(2), rigBox(A.imgs[bone(A, 'torso').i]).slice(2));
    }
  }
});

test('musk0: a library torso refits every child onto its socket and squashes again; the sheet keeps its old pixels', () => {
  const sp = 'musk0',
    sheets = sheetsOf(sp),
    prepared = ['front', 'back'].map(view => {
      const { pic, ox, oy, needs, at } = placed(sp, view, 'torso', 'cat_torso'),
        frames = kitSquashFrames(pic, BAKE.pad, BAKE.squash);
      return { view, bone: 'torso', frames, ox: ox - BAKE.pad, oy: oy - BAKE.pad, at, needs };
    }),
    { rig, sheets: out, how } = rigSwapApply(RIGS[sp], sheets, pathOf(sp), prepared, geoOf);
  assert.deepEqual(how['front torso'], {
    legL: 'hipL',
    legR: 'hipR',
    armL: 'shoulderL',
    armR: 'shoulderR',
    tail: 'tail',
    head: 'neck',
  });
  const v = K.parts.cat_torso.views.front,
    pic = part('cat_torso', 'front'),
    p0 = prepared[0];
  for (const [child, s] of Object.entries(how['front torso'])) {
    /* the socket from the bone's pivot, which sits on a whole pixel of the picture (ox, oy) */
    const want = [v.sockets[s][0] * pic.width + p0.ox + BAKE.pad, v.sockets[s][1] * pic.height + p0.oy + BAKE.pad];
    assert.deepEqual(
      bone(rig.front, child).at,
      want.map(x => +x.toFixed(3)),
      child
    );
  }
  const t = rig.front.imgs[bone(rig.front, 'torso').i];
  assert.deepEqual(Object.keys(t.f), ['main', 'squash', 'stretch']);
  assert.deepEqual([t.ox, t.oy], [p0.ox, p0.oy]);
  const S0 = sheets.get(pathOf(sp)('front')),
    S1 = out.get(pathOf(sp)('front'));
  assert.ok(S1.height > S0.height && S1.width >= S0.width);
  assert.deepEqual(rig.front.size, [S1.width, S1.height]);
  assert.deepEqual(rig.back.size, [S1.width, S1.height]);
  for (let y = 0; y < S0.height; y += 7)
    for (let x = 0; x < S0.width; x += 5) {
      const i = (y * S0.width + x) * 4,
        j = (y * S1.width + x) * 4;
      assert.deepEqual([...S1.data.subarray(j, j + 4)], [...S0.data.subarray(i, i + 4)]);
    }
  const [x, y, w, h] = t.f.main;
  assert.deepEqual(cut(S1, [x, y, w, h]).data, prepared[0].frames.main.data);
  assert.notEqual(rig.front.geo.hw, RIGS[sp].front.geo.hw, 'a cat torso is not the bear one: the width moves');
});

test('a head swap on a kit Billie keeps a blink and its horns in proportion; keeping the old frames keeps them', () => {
  for (const [sp, extra] of [
    ['musk0', 'hornL'],
    ['trump0', 'crest'],
  ]) {
    const sheets = sheetsOf(sp),
      M = RIGS[sp].front,
      { pic, ox, oy, needs, at } = placed(sp, 'front', 'head', 'cat_head'),
      blink = kitBlinkFrame(pic);
    assert.ok(blink, 'the cat head has eyes to shut');
    const { rig, how } = rigSwapApply(
      RIGS[sp],
      sheets,
      pathOf(sp),
      [{ view: 'front', bone: 'head', frames: { idle: pic, blink }, ox, oy, at, needs }],
      geoOf
    );
    const h = rig.front.imgs[bone(rig.front, 'head').i];
    assert.deepEqual(Object.keys(h.f), ['idle', 'blink'], sp);
    assert.equal(how['front head'][extra], 'in proportion');
    const o = M.imgs[bone(M, 'head').i],
      [, , ow, oh] = rigBox(o),
      fx = (bone(M, extra).at[0] * M.k - o.ox) / ow,
      fy = (bone(M, extra).at[1] * M.k - o.oy) / oh,
      e = bone(rig.front, extra).at;
    assert.ok(
      Math.abs(e[0] * M.k - (ox + fx * pic.width)) < 0.002 && Math.abs(e[1] * M.k - (oy + fy * pic.height)) < 0.002,
      `${sp} ${extra}`
    );
    const kept = rigSwapApply(
      RIGS[sp],
      sheets,
      pathOf(sp),
      [
        {
          view: 'front',
          bone: 'head',
          frames: { idle: pic },
          ox,
          oy,
          at,
          needs,
          keepFrames: ['blink', 'happy', 'hurt'],
        },
      ],
      geoOf
    ).rig;
    const k2 = kept.front.imgs[bone(kept.front, 'head').i];
    for (const f of Object.keys(o.f))
      if (f !== 'idle' && f !== 'main') assert.deepEqual(k2.f[f], o.f[f], `${sp} keeps ${f}`);
  }
});

test("rigRefit by a socket follows the picture's turn and scale", () => {
  const at = rigSwapSocketsAt({ neck: [0.5, 0] }, [0.5, 0.5], 20, 40, false, Math.PI / 2, [0, 0]);
  assert.deepEqual(
    at.neck.map(v => +v.toFixed(6) || 0),
    [20, 0]
  );
  const M = {
    k: 2,
    bones: [
      { n: 'torso', at: [0, 0] },
      { n: 'head', par: 'torso', at: [0, -5] },
    ],
  };
  rigRefit(M, 'torso', { ox: -5, oy: -10, w: 10, h: 20 }, { ox: -10, oy: -20, w: 20, h: 40 }, at, [
    { child: 'head', sockets: ['neck'] },
  ]);
  assert.deepEqual(M.bones[1].at, [10, 0]);
});
