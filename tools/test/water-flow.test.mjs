// Water track WA-2a: the flow map (game/js/walk/water-flow.js), built once with the water mesh
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flowMapAt, waterFlowMap, waterOpenSea } from '../../game/js/walk/water-flow.js';

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

test('WA-10: only still water joined to the edge is the open sea; a pond behind the beach is not', () => {
  /* 30 x 20: the sea along the south (j 0-3), a pond in the middle, a river cell column joining them (running) */
  const w = 30,
    h = 20,
    wet = (i, j) => j < 4 || Math.hypot(i - 15, j - 12) < 3 || (i === 15 && j < 12),
    run = (i, j) => i === 15 && j >= 4 && j < 10,
    open = waterOpenSea(w, h, (i, j) => wet(i, j) && !run(i, j));
  assert.equal(open[0], 1, 'the sea at the corner');
  assert.equal(open[2 * w + 20], 1, 'the sea by the shore');
  assert.equal(open[12 * w + 15], 2, 'the pond, joined only through running water');
  assert.equal(open[6 * w + 15], 0, 'the river itself');
  assert.equal(open[15 * w + 2], 0, 'dry land');
  /* the same pond with no river between: still water all the way, so it is the sea's */
  const joined = waterOpenSea(w, h, wet);
  assert.equal(joined[12 * w + 15], 1);
  /* a big enclosed body is a lake */
  const lake = waterOpenSea(60, 60, (i, j) => i > 5 && j > 5 && i < 54 && j < 54);
  assert.equal(lake[30 * 60 + 30], 3);
});

/* WA-10: a pond at the top, a 3 m channel down to the sea along the south; the line starts in the pond and runs on
   out into the sea (as Copperleaf's does) */
const pondSea = () => {
  const sc = {
      w: 40,
      h: 40,
      streams: [
        {
          pts: [
            [20, 30],
            [20, 25],
            [21, 15],
            [20, 2],
          ],
          speed: 0.6,
        },
      ],
    },
    lineDist = (x, z) => {
      const p = sc.streams[0].pts;
      let b = Infinity;
      for (let k = 0; k < p.length - 1; k++) {
        const [ax, az] = p[k],
          vx = p[k + 1][0] - ax,
          vz = p[k + 1][1] - az,
          t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
        b = Math.min(b, Math.hypot(ax + vx * t - x, az + vz * t - z));
      }
      return b;
    },
    wet = (x, z) => z < 8 || Math.hypot(x - 20, z - 30) < 5 || lineDist(x, z) < 1.5,
    bed = (x, z) =>
      Math.hypot(x - 20, z - 30) < 5 ? 1 : z < 8 ? -0.2 : -0.2 + (z - 8) * 0.06 + 0.08 * Math.sin(z * 3),
    F = waterFlowMap(sc, [], { wet, bed, step: () => 0, sea: true });
  return { sc, F, wet, bed };
};
const cellOf = (F, x, z) => Math.floor(z * 2) * F.W2 + Math.floor(x * 2);

test('WA-10: a river runs only in its channel: not in the pond it leaves, not in the sea it reaches', () => {
  const { F } = pondSea();
  assert.deepEqual(flowMapAt(F, 20.25, 30.25), [0, 0], 'the pond is still');
  assert.deepEqual(flowMapAt(F, 19.25, 27.25), [0, 0], 'the pond by the outflow is still');
  assert.notDeepEqual(flowMapAt(F, 20.75, 18.25), [0, 0], 'the channel runs');
  assert.equal(F.cls[cellOf(F, 20.75, 18.25)], 1);
  /* out in the sea there is no river, only the plume's drift near the mouth, which fades */
  assert.equal(F.cls[cellOf(F, 20.25, 2.25)] === 1 || F.cls[cellOf(F, 20.25, 2.25)] === 2, false);
  assert.deepEqual(flowMapAt(F, 5.25, 3.25), [0, 0], 'the open sea away from the mouth');
  const near = F.d[cellOf(F, 20.25, 6.75) * 4 + 3],
    far = F.d[cellOf(F, 20.25, 2.25) * 4 + 3];
  assert.ok(near > far && near > 0.3, `the river's share fades into the sea (${near} then ${far})`);
});

test("WA-10: a river's level never rises along its line and ends at the sea's", () => {
  const { sc, F } = pondSea(),
    p = sc.streams[0].pts;
  let prev = Infinity,
    n = 0,
    lastLev = NaN;
  for (let k = 0; k < p.length - 1; k++) {
    const l = Math.hypot(p[k + 1][0] - p[k][0], p[k + 1][1] - p[k][1]);
    for (let t = 0; t < l; t += 0.5) {
      const x = p[k][0] + ((p[k + 1][0] - p[k][0]) * t) / l,
        z = p[k][1] + ((p[k + 1][1] - p[k][1]) * t) / l,
        v = F.lev[cellOf(F, x, z)];
      if (isNaN(v)) continue;
      assert.ok(v <= prev + 1e-6, `rises at ${x.toFixed(2)}, ${z.toFixed(2)}: ${prev} to ${v}`);
      prev = lastLev = v;
      n++;
    }
  }
  assert.ok(n > 20, 'levels along the channel');
  assert.ok(Math.abs(lastLev - -0.2) < 0.05, `meets the sea's level (${lastLev})`);
});

test("WA-10: a river's level: a bumpy bed never rises, a terrace's drop stays a drop", () => {
  /* a 3 m channel straight down a 40 m map, no bodies; the land steps down 0.6 m at z 20 */
  const sc = {
      w: 20,
      h: 40,
      streams: [
        {
          pts: [
            [10, 39],
            [10, 1],
          ],
          speed: 1,
        },
      ],
    },
    step = (x, z) => (z > 20 ? 0.6 : 0),
    F = waterFlowMap(sc, [], {
      wet: x => Math.abs(x - 10) < 1.5,
      bed: (x, z) => step(x, z) + z * 0.01 + 0.06 * Math.sin(z * 2.7) - 0.12,
      step,
    });
  let prev = Infinity;
  const at = z => F.lev[Math.floor(z * 2) * F.W2 + 20];
  for (let z = 38.75; z > 1.5; z -= 0.5) {
    assert.ok(at(z) <= prev + 1e-6, `rises at z ${z}: ${prev} to ${at(z)}`);
    prev = at(z);
  }
  assert.ok(at(20.75) - at(19.75) > 0.4, `the drop stays a drop (${at(20.75)} to ${at(19.75)})`);
});
