/* ================= THE MODEL MESHES' HELPER THREAD (fluid track FL-4b, the load track's LD-5) =================
   A module worker that builds a low-poly model's mesh off the page (prop-meshes.js starts it, with quality.meshWorker):
   logic/low-poly.js lowPolyMeshData on the recipe (plain data: its layers, shapes and colours).
   Messages: page -> worker { kind: 'mesh', id, rec }; worker -> page { kind: 'mesh', id, D, ms } (its buffers handed
   over, not copied) or { kind: 'failed', id, error }. Nothing here reads or sends a save. */
let propMeshWorkerMods = null;
self.onmessage = async ev => {
  const d = ev.data || {};
  if (d.kind !== 'mesh') return;
  try {
    /* the low-poly modules (one bundled file in the built site: prop-mesh-worker-modules.js) */
    const m = await (propMeshWorkerMods || (propMeshWorkerMods = import('./prop-mesh-worker-modules.js'))),
      t0 = performance.now(),
      D = m.lowPolyMeshData(d.rec);
    self.postMessage({ kind: 'mesh', id: d.id, D, ms: performance.now() - t0 }, m.lowPolyMeshBuffers(D));
  } catch (e) {
    self.postMessage({ kind: 'failed', id: d.id, error: String((e && e.message) || e) });
  }
};
