// Fluid track FL-5b, the phone look trades: the far shadow map's size and target (game/js/walk/shadows.js
// farShadowSize, quality.phoneShadow) and one-picture far trees (prop-models.js farTreeLook, quality.farTrees). No graphics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './walk-renderer.mjs';
await import('../../game/js/walk/shadows.js');

// FL-5b (quality.phoneShadow): the far map's size chosen only when the canvas changes size or the place changes, and a
// battle's map a target of its own. (Node has no phone: the 2048 cap on a phone is the in-game check's.)
test('the far shadow map: latched in a walk, its own target in a battle', async () => {
  const { engineContext } = await import('../../game/js/engine/settings.js'),
    { walkView } = await import('../../game/js/walk-view.js'),
    { walkRenderer } = await import('../../game/js/walk/walk-state.js'),
    { farShadowSize } = /** @type {any} */ (globalThis),
    keep = { look: engineContext.look, R: walkView.R, id: walkView.id, bt: walkRenderer.bt, q: walkRenderer.q };
  try {
    walkView.id = 'here';
    walkView.R = 1;
    walkRenderer.q = 0;
    walkRenderer.bt = null;
    walkRenderer.resizes = 0;
    walkRenderer.resD = null;
    engineContext.look = { quality: { shadowMap: 4096, phoneShadow: false } };
    assert.deepEqual(farShadowSize(), [4096, 'shadow']);
    walkRenderer.q = 2;
    assert.deepEqual(farShadowSize(), [1024, 'shadow'], 'off: follows the step at once');
    engineContext.look = { quality: { shadowMap: 4096, phoneShadow: true } };
    walkRenderer.q = 0;
    walkRenderer.resizes = 1;
    assert.deepEqual(farShadowSize(), [4096, 'shadow']);
    walkRenderer.q = 2;
    walkView.R = 0.6;
    assert.deepEqual(farShadowSize(), [4096, 'shadow'], 'on: a step mid-walk waits');
    walkRenderer.resizes = 2;
    assert.deepEqual(farShadowSize(), [1024, 'shadow'], 'taken when the canvas changes size');
    walkRenderer.q = 0;
    walkView.R = 1;
    walkView.id = 'there';
    assert.deepEqual(farShadowSize(), [4096, 'shadow'], 'and when the place changes');
    walkRenderer.bt = {};
    assert.deepEqual(farShadowSize(), [1024, 'shadowB'], "a battle's lite look: its own small map");
  } finally {
    engineContext.look = keep.look;
    walkView.R = keep.R;
    walkView.id = keep.id;
    walkRenderer.bt = keep.bt;
    walkRenderer.q = keep.q;
  }
});

// FL-5b (quality.farTrees): a tree past the band is its crown alone; in the band the crown fades in; a model without a
// crown core, or the switch off, is left as it is.
test('one-picture far trees: the band and the crown', async () => {
  await import('../../game/js/prop-models.js');
  const { engineContext } = await import('../../game/js/engine/settings.js'),
    { walkView } = await import('../../game/js/walk-view.js'),
    { farTreeLook } = /** @type {any} */ (globalThis),
    keep = { look: engineContext.look, pl: walkView.pl },
    rec = {
      layers: [
        { k: 'img', img: 'crown.png', shade: 0.78, x: 0, y: 0.8, z: 2 },
        { k: 'img', img: 'crown.png', clip: [10, 10, 5], x: 2, y: -0.8, z: 2 },
        { k: 'img', img: 'crown.png', clip: [20, 10, 5], x: -1, y: 0.5, z: 3 },
      ],
    };
  try {
    walkView.pl = { x: 0, z: 0 };
    engineContext.look = { quality: { farTrees: false } };
    assert.equal(farTreeLook({ x: 60, z: 0 }, rec), null, 'off');
    engineContext.look = { quality: { farTrees: true } };
    assert.equal(farTreeLook({ x: 20, z: 0 }, rec), null, 'near');
    const mid = farTreeLook({ x: 39, z: 0 }, rec);
    assert.ok(mid.t > 0.4 && mid.t < 0.6, 'half way through the band');
    const far = farTreeLook({ x: 0, z: 50 }, rec);
    assert.equal(far.t, 1);
    assert.ok(far.imgs.has('crown.png'));
    assert.ok(Math.abs(far.front - (Math.hypot(2, 1.6) + 0.3)) < 1e-9, 'in front of the widest clump');
    assert.equal(farTreeLook({ x: 60, z: 0 }, { layers: [{ k: 'img', img: 'a.png', clip: [1, 1, 1] }] }), null);
  } finally {
    engineContext.look = keep.look;
    walkView.pl = keep.pl;
  }
});
