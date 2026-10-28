'use strict';
/* ================= THE FIGURES' MESHES (characters track CH-4) =================
   A code figure's mesh (logic/figure-kit.js kitBuild: its blended head and hair, every part's shapes) takes about
   400 ms to build in Node for a gouache-night figure, several times that on a phone: CH-3b built it on the frame the
   first time a person was wanted, a hitch for each new face. Here it is built on a helper thread (figure-worker.js),
   and a person keeps today's picture until it is in. Where no worker can run (Node's tests, a page that refuses
   module workers) or once one has failed, it is built on the page as before.
   A mesh is asked for by key (the figure's name and detail): figureMeshGet gives it when built, else null and starts
   the build once. Built meshes are kept, the longest unused let go past FIGURE_MESH_BYTES (a lost context or the atlas
   asks again). Nothing here reads or sends a save. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { figureGpuMesh } from './logic/figure-pose.js';
import { kitBuild } from './logic/figure-kit.js';
/* eslint-disable no-func-assign */
expose({
  FIGURE_MESH_BYTES: [() => FIGURE_MESH_BYTES],
  figureMeshFail: [() => figureMeshFail, v => (figureMeshFail = v)],
  figureMeshGet: [() => figureMeshGet, v => (figureMeshGet = v)],
  figureMeshKeep: [() => figureMeshKeep, v => (figureMeshKeep = v)],
  figureMeshMessage: [() => figureMeshMessage, v => (figureMeshMessage = v)],
  figureMeshReport: [() => figureMeshReport, v => (figureMeshReport = v)],
  figureMeshWorker: [() => figureMeshWorker, v => (figureMeshWorker = v)],
  figureMeshes: [() => figureMeshes],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the built meshes kept, at most this many bytes of vertices */
const FIGURE_MESH_BYTES = 32 * 1048576;
/** the helper thread, its jobs and counts (debug log: people.figures.meshes) */
const figureMeshes = {
  w: /** @type {Worker | null} */ (null),
  off: '',
  id: 0,
  /** key -> the job under way */
  jobs: new Map(),
  /** id -> key */
  ids: new Map(),
  /** key -> the built mesh, the longest unused first */
  done: new Map(),
  bytes: 0,
  builds: 0,
  page: 0,
  ms: 0,
  pageMs: 0,
  failed: 0,
};
/** the helper thread, started the first time a mesh is wanted; null where there is none */
function figureMeshWorker() {
  const M = figureMeshes;
  if (M.off || M.w) return M.w;
  if (typeof Worker === 'undefined' || typeof document === 'undefined') {
    M.off = 'no helper thread here';
    return null;
  }
  try {
    const w = new Worker(new URL('js/figure-worker.js', document.baseURI), { type: 'module' });
    w.onmessage = ev => figureMeshMessage(ev.data);
    w.onerror = () => figureMeshFail('the helper thread failed to load');
    M.w = w;
  } catch (e) {
    M.off = 'no helper thread here';
  }
  return M.w;
}
/** the thread failed: every job under way is built on the page when next asked for */
function figureMeshFail(why) {
  const M = figureMeshes;
  M.off = why;
  M.failed++;
  if (M.w) M.w.terminate();
  M.w = null;
  M.jobs.clear();
  M.ids.clear();
  if (typeof debugLog !== 'undefined') debugLog.add('figures', 'meshes: ' + why);
}
/** a built mesh back from the thread */
function figureMeshMessage(m) {
  const M = figureMeshes;
  if (!m || !M.ids.has(m.id)) return;
  const key = M.ids.get(m.id);
  M.ids.delete(m.id);
  M.jobs.delete(key);
  if (m.kind === 'failed') {
    /* the thread can't build (its modules didn't load, or a figure it can't make): the page builds from now on */
    figureMeshFail('mesh ' + key + ': ' + m.error);
    return;
  }
  M.builds++;
  M.ms += m.ms || 0;
  figureMeshKeep(key, { ext: m.ext, data: m.data, count: m.count, colours: m.colours, slots: m.slots });
}
/** keep a built mesh; the longest unused go past FIGURE_MESH_BYTES (one is always kept) */
function figureMeshKeep(key, R) {
  const M = figureMeshes;
  M.done.set(key, R);
  M.bytes += R.data.byteLength;
  while (M.bytes > FIGURE_MESH_BYTES && M.done.size > 1) {
    const k = M.done.keys().next().value,
      old = M.done.get(k);
    M.bytes -= old.data.byteLength;
    M.done.delete(k);
  }
}
/**
 * a code figure's mesh at `detail` (logic/figure-pose.js figureGpuMesh's: data, count, colours, slots; with `extent`
 * its extent too, kitBuild's ext), or null while it is built on the helper thread (asked for once)
 * @param {string} key the figure's name and detail @param {any} F the figure @param {number} detail
 * @param {boolean} [extent] measure its extent too (its first build)
 */
export function figureMeshGet(key, F, detail, extent = false) {
  const M = figureMeshes,
    R = M.done.get(key);
  if (R && (R.ext || !extent)) {
    M.done.delete(key);
    M.done.set(key, R);
    return R;
  }
  if (M.jobs.has(key)) return null;
  const w = figureMeshWorker();
  if (w) {
    const id = ++M.id;
    M.jobs.set(key, id);
    M.ids.set(id, key);
    try {
      w.postMessage({ kind: 'mesh', id, F, detail, extent });
      return null;
    } catch (e) {
      figureMeshFail(String((e && e.message) || e));
    }
  }
  /* on the page, as CH-3b did */
  const t0 = performance.now(),
    B = extent ? kitBuild(F, detail) : { ext: null, ...figureGpuMesh(F, detail) };
  M.page++;
  M.pageMs += performance.now() - t0;
  if (R) {
    M.bytes -= R.data.byteLength;
    M.done.delete(key);
  }
  figureMeshKeep(key, B);
  return B;
}
/** the meshes' numbers for the debug log (numbers only) */
export function figureMeshReport() {
  const M = figureMeshes;
  return {
    thread: M.w ? 'on' : M.off || 'not started',
    builds: M.builds,
    ms: Math.round(M.ms),
    page: M.page,
    pageMs: Math.round(M.pageMs),
    waiting: M.jobs.size,
    kept: M.done.size,
    mb: Math.round((M.bytes / 1048576) * 10) / 10,
    failed: M.failed,
  };
}
