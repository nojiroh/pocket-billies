/* ================= THE FIGURES' HELPER THREAD (characters track CH-4) =================
   A module worker that builds a figure's mesh off the page (figure-meshes.js starts it): a gouache-night figure's
   blended head and hair take about 400 ms in Node, several times that on a phone, a hitch for every new person when
   the page built it. It runs the figure kit's own code (logic/figure-kit.js kitBuild, logic/figure-pose.js
   figureGpuMesh) on the figure the page made from a look (plain data: its parts, shapes and colours).
   Messages: page -> worker { kind: 'mesh', id, F, detail, extent }; worker -> page { kind: 'mesh', id, ext, data,
   count, colours, slots, ms } (data handed over, not copied) or { kind: 'failed', id, error }. Nothing here reads or
   sends a save. */
import { kitBuild } from './logic/figure-kit.js';
import { figureGpuMesh } from './logic/figure-pose.js';

self.onmessage = ev => {
  const d = ev.data || {};
  if (d.kind !== 'mesh') return;
  try {
    const t0 = performance.now(),
      R = d.extent ? kitBuild(d.F, d.detail) : { ext: null, ...figureGpuMesh(d.F, d.detail) };
    self.postMessage({ kind: 'mesh', id: d.id, ...R, ms: performance.now() - t0 }, [R.data.buffer]);
  } catch (e) {
    self.postMessage({ kind: 'failed', id: d.id, error: String((e && e.message) || e) });
  }
};
