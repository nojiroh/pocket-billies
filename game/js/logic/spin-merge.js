// @ts-check
'use strict';
/* ================= SPIN MERGE (fluid track FL-2b) =================
   A model's turning parts (a windmill's sails, a propeller's blades) are layers with a spin {x, y, z: the pivot in
   metres; axis; rps; swing}. Each was its own mesh and its own draw, though a model's spin layers mostly share the
   pivot, axis, speed and swing (Copperleaf's windmill: 37 layers, one way of turning). spinGroups puts the layers
   that turn together in one group; joinMeshes lays their meshes (each built on its own, so every vertex is the one it
   was) end to end in one buffer, one draw. Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  joinMeshes: [() => joinMeshes, v => (joinMeshes = v)],
  // @ts-expect-error -- replaced on purpose
  spinGroups: [() => spinGroups, v => (spinGroups = v)],
  // @ts-expect-error -- replaced on purpose
  spinOf: [() => spinOf, v => (spinOf = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* a layer's spin as the mesh keeps it: pivot c and unit axis a with up as y, turns (or swings) a second, swing */
export function spinOf(spin) {
  const ax = spin.axis,
    a = Array.isArray(ax)
      ? [ax[0] || 0, ax[2] || 0, ax[1] || 0]
      : ax === 'y'
        ? [0, 0, 1]
        : ax === 'z'
          ? [0, 1, 0]
          : [1, 0, 0],
    al = Math.hypot(a[0], a[1], a[2]) || 1;
  return {
    c: [spin.x || 0, spin.z || 0, spin.y || 0],
    a: a.map(v => v / al),
    rps: spin.rps ?? 1.5,
    sw: +spin.swing || 0,
  };
}
/* the shown spin layers grouped by how they turn, in the order each way first appears: [{ spin, layers }] */
export function spinGroups(layers) {
  const G = new Map();
  for (const l of layers || []) {
    if (!l || !l.spin || l.hide) continue;
    const s = spinOf(l.spin),
      k = [...s.c, ...s.a, s.rps, s.sw].join(',');
    let g = G.get(k);
    if (!g) G.set(k, (g = { spin: s, layers: [] }));
    g.layers.push(l);
  }
  return [...G.values()];
}
/* meshes [{ vb: ArrayBuffer or a typed array (stride bytes a vertex), ib: Uint16Array or Uint32Array }] end to end:
   { vb: ArrayBuffer, ib, n: indices, verts }. One mesh is handed back as it is */
export function joinMeshes(list, stride) {
  const M = (list || []).filter(Boolean);
  if (!M.length) return null;
  const bytes = m =>
    m.vb instanceof ArrayBuffer ? m.vb : m.vb.buffer.slice(m.vb.byteOffset, m.vb.byteOffset + m.vb.byteLength);
  if (M.length === 1) return { vb: M[0].vb, ib: M[0].ib, n: M[0].ib.length, verts: bytes(M[0]).byteLength / stride };
  let nb = 0,
    ni = 0;
  for (const m of M) {
    nb += bytes(m).byteLength;
    ni += m.ib.length;
  }
  const vb = new ArrayBuffer(nb),
    u8 = new Uint8Array(vb),
    verts = nb / stride,
    ib = verts > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let ob = 0,
    oi = 0;
  for (const m of M) {
    const b = bytes(m),
      base = ob / stride;
    u8.set(new Uint8Array(b), ob);
    for (let i = 0; i < m.ib.length; i++) ib[oi + i] = m.ib[i] + base;
    ob += b.byteLength;
    oi += m.ib.length;
  }
  return { vb, ib, n: ni, verts };
}
