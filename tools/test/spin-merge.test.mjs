// Fluid track FL-2b: a model's turning layers (a windmill's 37 sail layers) were a mesh and a draw each, though they
// all turn the same way. game/js/logic/spin-merge.js groups the layers by how they turn and lays their meshes (each
// still built on its own, so every vertex is the one it was) end to end: one spin mesh per model, one draw.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './load-logic.mjs';

const { recordingGL } = await import('./walk-renderer.mjs');
const G = globalThis;
const { spinGroups, spinOf, joinMeshes } = await import('../../game/js/logic/spin-merge.js');
const { lowPolyFromRecipe } = await import('../../game/js/prop-models.js');
const { readGameData } = await import('../data-files.mjs');
const { voxelise, greedyVoxelMesh } = /** @type {any} */ (G);

const D = readGameData(),
  SPINNING = Object.entries(D.scenery.props)
    .filter(([, M]) => typeof M.model === 'string')
    .map(([k, M]) => ({ k, path: M.model, rec: JSON.parse(readFileSync(join(ROOT, 'game/art', M.model), 'utf8')) }))
    .filter(({ rec }) => rec.kind !== 'mesh' && (rec.layers || []).some(l => l.spin && !l.hide));

test('the spinning models turn one way each: one group of layers per model', () => {
  const names = SPINNING.map(({ k }) => k);
  for (const k of ['windmill', 'gene_bank', 'workshop', 'cottage_solar', 'lighthouse', 'tree_giant_swing'])
    assert.ok(names.includes(k), `${k} spins`);
  for (const { k, rec } of SPINNING) {
    const g = spinGroups(rec.layers),
      n = rec.layers.filter(l => l.spin && !l.hide).length;
    assert.equal(g.length, 1, `${k}: ${g.length} ways of turning`);
    assert.equal(g[0].layers.length, n, k);
  }
});

test('layers that turn differently stay apart, in the order each way first appears; hidden ones are left out', () => {
  const L = [
    { k: 'box', spin: { x: 1, y: 2, z: 3, axis: 'y', rps: 2 } },
    { k: 'box', spin: { x: 0, y: 0, z: 0, axis: 'x', swing: 0.4 } },
    { k: 'box', spin: { x: 1, y: 2, z: 3, axis: 'y', rps: 2 } },
    { k: 'box', hide: 1, spin: { x: 9, axis: 'z' } },
    { k: 'box' },
  ];
  const g = spinGroups(L);
  assert.equal(g.length, 2);
  assert.deepEqual(g[0].layers, [L[0], L[2]]);
  assert.deepEqual(g[0].spin, { c: [1, 3, 2], a: [0, 0, 1], rps: 2, sw: 0 });
  assert.deepEqual(g[1].spin, { c: [0, 0, 0], a: [1, 0, 0], rps: 1.5, sw: 0.4 });
  assert.deepEqual(spinOf({ axis: [3, 0, 4] }).a, [0.6, 0.8, 0]);
});

/* the joined mesh holds each part's bytes as they were and its triangles pointing at the same vertices */
function sameAsParts(J, parts, stride) {
  let ob = 0,
    oi = 0;
  const u8 = new Uint8Array(J.vb);
  for (const m of parts) {
    const b = new Uint8Array(m.vb instanceof ArrayBuffer ? m.vb : m.vb.buffer, m.vb.byteOffset || 0, m.vb.byteLength);
    assert.deepEqual(u8.subarray(ob, ob + b.length), b);
    for (let i = 0; i < m.ib.length; i++) assert.equal(J.ib[oi + i], m.ib[i] + ob / stride);
    ob += b.length;
    oi += m.ib.length;
  }
  assert.equal(ob, J.vb.byteLength);
  assert.equal(oi, J.n);
}

test("the windmill's sails as low-poly parts joined: the same vertices and triangles", () => {
  const { rec } = SPINNING.find(({ k }) => k === 'windmill'),
    parts = spinGroups(rec.layers)[0].layers.map(l => lowPolyFromRecipe({ layers: [{ ...l, spin: undefined }] }));
  assert.ok(parts.length > 30);
  sameAsParts(joinMeshes(parts, 24), parts.filter(Boolean), 24);
});

test("the giant swing's ropes as voxels joined: the same quads", () => {
  const { rec } = SPINNING.find(({ k }) => k === 'tree_giant_swing'),
    parts = spinGroups(rec.layers)[0]
      .layers.map(l => greedyVoxelMesh(voxelise({ vpm: rec.vpm, layers: [{ ...l, spin: undefined }] }, 32), 32))
      .filter(Boolean);
  assert.ok(parts.length >= 2);
  sameAsParts(joinMeshes(parts, 16), parts, 16);
});

test('past 65,535 vertices the joined triangles use 32-bit indices', () => {
  const big = { vb: new ArrayBuffer(40000 * 16), ib: new Uint16Array([0, 1, 39999]) },
    J = joinMeshes([big, big], 16);
  assert.ok(J.ib instanceof Uint32Array);
  assert.deepEqual(Array.from(J.ib), [0, 1, 39999, 40000, 40001, 79999]);
  assert.equal(joinMeshes([null], 16), null);
});

test('propModelMesh builds one spin mesh per spinning model, drawn as one part', () => {
  G.gpuState.gl = recordingGL();
  for (const { k, path, rec } of SPINNING) {
    G.invalidatePropModel(path, true);
    const m = G.propModelMesh(path, rec);
    assert.ok(m, k);
    assert.equal(m.spins.length, 1, `${k}: ${m.spins.length} spin meshes`);
    const s = m.spins[0],
      n = rec.layers
        .filter(l => l.spin && !l.hide)
        .reduce((a, l) => a + ((lowPolyFromRecipe({ layers: [{ ...l, spin: undefined }] }) || { n: 0 }).n || 0), 0);
    assert.equal(s.n, n, `${k}: every layer's triangles`);
    assert.deepEqual(
      Object.keys(spinOf(rec.layers.find(l => l.spin).spin)).map(q => typeof s[q]),
      ['object', 'object', 'number', 'number']
    );
    G.invalidatePropModel(path, true);
  }
});
