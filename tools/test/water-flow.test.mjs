// Water track WA-2a: the flow map (game/js/walk/water-flow.js), built once with the water mesh
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flowMapAt, waterFlowMap } from '../../game/js/walk/water-flow.js';

const FLOW_RAPIDS = 1.6; /* water-flow.js FLOW_RAPIDS (the page exports only what another module imports) */
/* the foam at a spot: the cell's third number */
const flowFoamAt = (F, x, z) => F.d[(Math.floor(z * 2) * F.W2 + Math.floor(x * 2)) * 4 + 2];

/* the old per-vertex search (walk/water-data.js waterFlowField before WA-2a), kept here to compare against */
function oldFlow(sc) {
  const S = sc.streams || [];
  return (x, z) => {
    let best = null,
      bd = 2.5;
    for (const st of S) {
      const p = st.pts || [];
      for (let k = 0; k < p.length - 1; k++) {
        const a = p[k],
          b = p[k + 1],
          vx = b[0] - a[0],
          vz = b[1] - a[1],
          l2 = vx * vx + vz * vz || 1e-9,
          t = Math.min(1, Math.max(0, ((x - a[0]) * vx + (z - a[1]) * vz) / l2)),
          d = Math.hypot(a[0] + vx * t - x, a[1] + vz * t - z);
        if (d < bd) {
          bd = d;
          const l = Math.sqrt(l2);
          best = [(vx / l) * (st.speed || 1), (vz / l) * (st.speed || 1)];
        }
      }
    }
    return best || [0, 0];
  };
}

/* test_water's two streams, as tools/build-test-scenes.py draws them */
const plain = () => ({
  w: 58,
  h: 28,
  streams: [
    {
      pts: [
        [30, 27.5],
        [30.5, 21],
        [29.8, 16],
        [30.4, 12],
        [31, 8.6],
      ],
      speed: 0.8,
    },
    {
      pts: [
        [50, 27.5],
        [50.3, 22],
        [49.8, 17.5],
        [50, 14.5],
      ],
      speed: 1.0,
    },
    {
      pts: [
        [10, 2],
        [14, 2],
        [14, 6],
      ],
    },
  ],
});

test('a plain {pts, speed} stream runs as the old search said, at every cell', () => {
  const sc = plain(),
    F = waterFlowMap(sc),
    old = oldFlow(sc);
  assert.equal(F.W2, 116);
  assert.equal(F.H2, 56);
  let running = 0;
  for (let j = 0; j < F.H2; j++)
    for (let i = 0; i < F.W2; i++) {
      const x = (i + 0.5) / 2,
        z = (j + 0.5) / 2,
        a = flowMapAt(F, x, z),
        b = old(x, z);
      assert.ok(Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6, `${x},${z}: ${a} vs ${b}`);
      if (b[0] || b[1]) running++;
    }
  assert.ok(running > 300, `${running} running cells`);
});

test('still water and outside the scene: no flow, no foam', () => {
  const F = waterFlowMap(plain());
  assert.deepEqual(flowMapAt(F, 5, 20), [0, 0]);
  assert.deepEqual(flowMapAt(F, -3, 5), [0, 0]);
  assert.equal(flowFoamAt(F, 5, 20), 0);
  assert.deepEqual(
    waterFlowMap({ w: 4, h: 4 }).d.every(v => v === 0),
    true
  );
});

test('a wide river reaches past 2.5 m; rapids run faster and foam; the mouth churns', () => {
  const sc = {
      w: 40,
      h: 20,
      streams: [
        {
          pts: [
            [2, 10],
            [12, 10],
            [22, 10],
            [32, 10],
          ],
          speed: 1,
          w: [2, 3, 6, 6],
          rapids: [[0.4, 0.6]],
          src: 'edge',
          mouth: 'pool',
        },
      ],
    },
    F = waterFlowMap(sc);
  /* 3.5 m off the line where it is 6 m wide (reach 4 m): still running */
  assert.ok(flowMapAt(F, 27.25, 13.75)[0] > 0);
  assert.deepEqual(flowMapAt(F, 4.25, 13.75), [0, 0]);
  /* the middle 40-60% (x 14-20) is rapids */
  assert.ok(Math.abs(flowMapAt(F, 17.25, 10.25)[0] - FLOW_RAPIDS) < 1e-6);
  assert.ok(Math.abs(flowMapAt(F, 6.25, 10.25)[0] - 1) < 1e-6);
  assert.ok(flowFoamAt(F, 17.25, 10.25) > 0.5);
  assert.equal(flowFoamAt(F, 6.25, 10.25), 0);
  /* the mouth's churn, strongest at the end */
  assert.ok(flowFoamAt(F, 31.75, 10.25) > 0.4);
  assert.ok(flowFoamAt(F, 31.75, 10.25) > flowFoamAt(F, 29.25, 10.25));
});

test("a fall's foot foams in its pool", () => {
  const F = waterFlowMap({ w: 20, h: 20 }, [[10, 10, 2]]);
  assert.ok(flowFoamAt(F, 10.25, 10.25) > 0.8);
  assert.ok(flowFoamAt(F, 11.25, 10.25) < flowFoamAt(F, 10.25, 10.25));
  assert.equal(flowFoamAt(F, 13.25, 10.25), 0);
});

test('a big map builds quickly', () => {
  const pts = [];
  for (let k = 0; k <= 120; k++) pts.push([k * 1.5, 40 + Math.sin(k * 0.3) * 12]);
  const sc = { w: 180, h: 90, streams: [{ pts, speed: 1, w: pts.map((_, k) => 1.5 + k * 0.02) }] },
    t0 = performance.now();
  waterFlowMap(sc);
  assert.ok(performance.now() - t0 < 200);
});
