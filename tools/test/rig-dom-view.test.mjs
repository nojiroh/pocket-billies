// DOM previews must select the same view's rig as the view passed to drawing.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import './robot-rig-node.mjs';
globalThis.requestAnimationFrame ??= () => 0;
const hooks = await import('../../game/js/hooks.js');
const rig = await import('../../game/js/skeleton-rig.js');
hooks.provide({ SPECIES: { testBilly: { stage: 0 } } });

for (const sp of ['testBilly', 'bot:volt.vane.tesla.auger.striders']) {
  for (const view of ['front', 'back']) {
    test(`DOM ${sp} selects ${view} metadata and passes its coat and graft`, () => {
      const calls = [],
        drawn = [];
      const original = rig.rigParts,
        originalDraw = globalThis.drawRig;
      const selected = { BW: 224, BH: 208, clock: 0 };
      rig.setRigParts((...args) => {
        calls.push(args);
        return selected;
      });
      globalThis.drawRig = (...args) => drawn.push(args);
      const ctx = { setTransform() {}, clearRect() {} };
      const c = {
        dataset: { sp, v: view, coat: 'midnight', g: 'front=hawk_wing@swift1', still: '1' },
        width: 224,
        height: 208,
        getContext: () => ctx,
        classList: { contains: () => false },
      };
      try {
        globalThis.drawDomRig(c, 1000);
        assert.deepEqual(calls, [[sp, view === 'back' ? rig.RIG_BACK_VIEW : 1, 'midnight', 'front=hawk_wing@swift1']]);
        assert.equal(drawn[0][1], selected);
        assert.equal(drawn[0][3], view);
      } finally {
        rig.setRigParts(original);
        globalThis.drawRig = originalDraw;
      }
    });
  }
}
