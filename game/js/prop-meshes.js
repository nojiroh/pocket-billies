'use strict';
/* ================= MODEL MESHES ON A HELPER THREAD (fluid track FL-4b, the load track's LD-5) =================
   A low-poly model's mesh (logic/low-poly.js lowPolyMeshData) took 20-70 ms on the frame its prop first came into
   view (LD-5's measure, in software); a house kit's more. With quality.meshWorker it is built on a helper thread
   (prop-mesh-worker.js) and handed back without a copy; the page only uploads it (prop-models.js propModelMesh), and
   the prop's picture stands in until then. Where no worker can run (Node's tests, a page that refuses module
   workers) or once one has failed, it is built on the page as before. A mesh is asked for by its path with the
   recipe it was asked with: one asked again for another recipe (a Studio edit) is built again. Nothing here reads
   or sends a save. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { lowPolyMeshData } from './logic/low-poly.js';
/* eslint-disable no-func-assign */
expose({
  propMeshAhead: [() => propMeshAhead, v => (propMeshAhead = v)],
  propMeshFail: [() => propMeshFail, v => (propMeshFail = v)],
  propMeshGet: [() => propMeshGet, v => (propMeshGet = v)],
  propMeshMessage: [() => propMeshMessage, v => (propMeshMessage = v)],
  propMeshReport: [() => propMeshReport, v => (propMeshReport = v)],
  propMeshWorker: [() => propMeshWorker, v => (propMeshWorker = v)],
  propMeshes: [() => propMeshes],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the helper thread, its jobs and counts (debug log: gpuMemory.meshes) */
const propMeshes = {
  w: /** @type {Worker | null} */ (null),
  off: '',
  id: 0,
  /** path -> { id, rec } the job under way */
  jobs: new Map(),
  /** id -> path */
  ids: new Map(),
  /** path -> { rec, D } built, until the page takes it */
  done: new Map(),
  builds: 0,
  page: 0,
  ms: 0,
  pageMs: 0,
  failed: 0,
};
/** the helper thread, started the first time a mesh is wanted; null where there is none */
function propMeshWorker() {
  const M = propMeshes;
  if (M.off || M.w) return M.w;
  if (typeof Worker === 'undefined' || typeof document === 'undefined') {
    M.off = 'no helper thread here';
    return null;
  }
  try {
    const w = new Worker(new URL('js/prop-mesh-worker.js', document.baseURI), { type: 'module' });
    w.onmessage = ev => propMeshMessage(ev.data);
    w.onerror = () => propMeshFail('the helper thread failed to load');
    M.w = w;
  } catch (e) {
    M.off = 'no helper thread here';
  }
  return M.w;
}
/** the thread failed: every job under way is built on the page when next asked for */
function propMeshFail(why) {
  const M = propMeshes;
  M.off = why;
  M.failed++;
  if (M.w) M.w.terminate();
  M.w = null;
  M.jobs.clear();
  M.ids.clear();
  if (typeof debugLog !== 'undefined') debugLog.add('webgl', 'model meshes: ' + why);
}
/** a built mesh back from the thread */
function propMeshMessage(m) {
  const M = propMeshes;
  if (!m || !M.ids.has(m.id)) return;
  const path = M.ids.get(m.id),
    job = M.jobs.get(path);
  M.ids.delete(m.id);
  if (job && job.id === m.id) M.jobs.delete(path);
  if (m.kind === 'failed') {
    propMeshFail('mesh ' + path + ': ' + m.error);
    return;
  }
  if (!job || job.id !== m.id) return;
  M.builds++;
  M.ms += m.ms || 0;
  M.done.set(path, { rec: job.rec, D: m.D || null });
}
/**
 * a low-poly recipe's mesh data (logic/low-poly.js lowPolyMeshData's, or null: nothing to draw), or undefined while it
 * is built on the helper thread (asked for once). The page takes it once: prop-models.js keeps it on the card.
 * @param {string} path @param {any} rec
 */
export function propMeshGet(path, rec) {
  const M = propMeshes,
    R = M.done.get(path);
  if (R) {
    M.done.delete(path);
    if (R.rec === rec) return R.D;
  }
  const job = M.jobs.get(path);
  if (job && job.rec === rec) return undefined;
  const w = propMeshWorker();
  if (w) {
    const id = ++M.id;
    M.jobs.set(path, { id, rec });
    M.ids.set(id, path);
    try {
      w.postMessage({ kind: 'mesh', id, rec });
      return undefined;
    } catch (e) {
      propMeshFail(String((e && e.message) || e));
    }
  }
  /* on the page, as before */
  const t0 = performance.now(),
    D = lowPolyMeshData(rec);
  M.page++;
  M.pageMs += performance.now() - t0;
  return D;
}
/** FL-4b (quality.placeWarm): a mesh asked for ahead (the next place's), unless built, under way or kept already */
function propMeshAhead(path, rec) {
  const M = propMeshes;
  if (M.done.has(path) || (M.jobs.get(path) || {}).rec === rec || !propMeshWorker()) return false;
  propMeshGet(path, rec);
  return true;
}
/** the debug log's counts */
function propMeshReport() {
  const M = propMeshes;
  return {
    off: M.off || '',
    builds: M.builds,
    ms: Math.round(M.ms),
    page: M.page,
    pageMs: Math.round(M.pageMs),
    waiting: M.jobs.size,
    ready: M.done.size,
    failed: M.failed,
  };
}
